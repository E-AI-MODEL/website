"""Loopback-only local transcription. No recording files or cloud audio requests."""
import argparse
import asyncio
from contextlib import suppress
import json
import os
from pathlib import Path
from aiohttp import web, WSMsgType
import numpy as np
import soxr

PROTOCOL = "eaispeak-pcm-v1"
LANGUAGES = {"nl-NL", "en-US", "fr-FR", "de-DE", "es-ES", "pt-PT"}
ORIGINS = {"https://eaimodel.nl", "https://www.eaimodel.nl", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"}

def handshake(raw):
    msg = json.loads(raw)
    if not isinstance(msg, dict) or msg.get("protocol") != PROTOCOL or msg.get("type") not in ("start", "probe") or msg.get("engine") not in ("whisper", "apple"):
        raise ValueError("Invalid transcription handshake")
    source = msg.get("source_language")
    if not isinstance(source, str) or source not in LANGUAGES or source != msg.get("target_language"):
        raise ValueError("Unsupported transcription language")
    media = msg.get("input", {})
    if not isinstance(media, dict):
        raise ValueError("Invalid PCM format")
    rate = media.get("sample_rate")
    if media.get("codec") != "pcm_s16le" or media.get("channels") != 1 or type(rate) is not int or not 8000 <= rate <= 96000:
        raise ValueError("Invalid PCM format")
    return msg["type"], msg["engine"], source, rate

def decode_audio(data, rate):
    if len(data) % 2:
        raise ValueError("Invalid PCM frame")
    audio = np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768
    return soxr.resample(audio, rate, 16000) if rate != 16000 else audio

class OverlappingPCM:
    """Use a 1-second context on both sides of 4-second commit intervals.
    Keep every received sample until the interval owning it has been decoded.
    """
    def __init__(self, rate):
        self.rate = rate
        self.step = rate * 4
        self.context = rate
        self.buffer = bytearray()
        self.start = self.committed = self.end = 0

    def append(self, data):
        if len(data) % 2:
            raise ValueError("Invalid PCM frame")
        self.buffer.extend(data)
        self.end += len(data) // 2

    def windows(self, final=False):
        while self.committed < self.end:
            boundary = min(self.committed + self.step, self.end)
            if not final and self.end < boundary + self.context:
                break
            if not final and boundary < self.committed + self.step:
                break
            end = min(boundary + self.context, self.end)
            start = self.start
            data = bytes(self.buffer[:(end-start)*2])
            low = (self.committed-start)/self.rate
            high = (boundary-start)/self.rate
            yield data, low, high, final and boundary == self.end
            self.committed = boundary
            keep = max(0, boundary-self.context)
            del self.buffer[:(keep-self.start)*2]
            self.start = keep
        if final:
            self.buffer.clear()

def transcribe_window(model, pcm, rate, lang, low, high, final):
    audio = decode_audio(pcm, rate)
    if not audio.size:
        return ""
    segments, _ = model.transcribe(audio, language=lang.split("-")[0], vad_filter=True,
                                   condition_on_previous_text=False, word_timestamps=True)
    words = []
    for seg in segments:
        for word in seg.words or []:
            mid = (word.start + word.end) / 2
            if low <= mid < high or (final and low <= mid <= high):
                words.append(word.word)
    return "".join(words).strip()

async def whisper_session(ws, model, lang, rate, mode):
    await ws.send_json({"type":"ready","protocol":PROTOCOL,"probe":mode=="probe","provider":"Whisper","output_sample_rate":24000})
    if mode == "probe":
        return
    pcm = OverlappingPCM(rate)
    async def consume(final=False):
        for data, low, high, last in pcm.windows(final):
            text = await asyncio.to_thread(transcribe_window, model, data, rate, lang, low, high, last)
            if text and not ws.closed:
                await ws.send_json({"type":"transcript","text":text,"final":True})
    async for frame in ws:
        if frame.type == WSMsgType.TEXT and json.loads(frame.data) == {"type":"finish"}:
            await consume(True)
            await ws.send_json({"type":"end"})
            return
        if frame.type != WSMsgType.BINARY:
            if frame.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                return
            raise ValueError("Expected PCM audio or finish")
        pcm.append(frame.data)
        await consume()

async def apple_session(ws, helper, lang, rate, mode):
    """The Swift child owns the installed Apple model. PCM is piped, not saved."""
    args = [str(helper), "--probe" if mode == "probe" else "--stream", lang, str(rate)]
    proc = await asyncio.create_subprocess_exec(*args, stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL, limit=65536)
    async def next_message():
        line = await proc.stdout.readline()
        if not line:
            raise RuntimeError("Apple helper stopped before completion")
        msg = json.loads(line)
        if not isinstance(msg, dict) or msg.get("type") not in ("ready","transcript","error","end"):
            raise RuntimeError("Invalid Apple helper response")
        return msg
    try:
        ready = await asyncio.wait_for(next_message(), 20)
        if ready.get("type") != "ready":
            await ws.send_json({"type":"error","message":str(ready.get("message","Apple model unavailable"))[:250]})
            return
        await ws.send_json({"type":"ready","protocol":PROTOCOL,"probe":mode=="probe","provider":ready.get("provider","Apple"),"locale":ready.get("locale",lang),"output_sample_rate":24000})
        if mode == "probe":
            return
        async def receive():
            async for frame in ws:
                if frame.type == WSMsgType.TEXT and json.loads(frame.data)=={"type":"finish"}:
                    proc.stdin.close()
                    await proc.stdin.wait_closed()
                    return True
                if frame.type != WSMsgType.BINARY or len(frame.data)%2:
                    return False
                proc.stdin.write(frame.data)
                await asyncio.wait_for(proc.stdin.drain(), 10)
            return False
        async def send():
            while True:
                msg = await next_message()
                if msg["type"] == "transcript":
                    await ws.send_json({"type":"transcript","text":str(msg.get("text",""))[:5000],"final":msg.get("final") is True})
                elif msg["type"] == "end":
                    await ws.send_json({"type":"end"})
                    return
                elif msg["type"] == "error":
                    await ws.send_json({"type":"error","message":str(msg.get("message","Apple transcription failed"))[:250]})
                    return
        incoming = asyncio.create_task(receive())
        outgoing = asyncio.create_task(send())
        try:
            done,_ = await asyncio.wait({incoming,outgoing},return_when=asyncio.FIRST_COMPLETED)
            if incoming in done and incoming.result():
                await asyncio.wait_for(outgoing,30)
            elif outgoing in done:
                outgoing.result()
        finally:
            for task in (incoming,outgoing):
                if not task.done():
                    task.cancel()
            await asyncio.gather(incoming,outgoing,return_exceptions=True)
    finally:
        if proc.returncode is None:
            with suppress(ProcessLookupError):
                proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(),3)
            except asyncio.TimeoutError:
                with suppress(ProcessLookupError):
                    proc.kill()
                await proc.wait()

def create_app(model=None, origins=ORIGINS, apple_helper=None):
    app = web.Application()
    lock = asyncio.Lock()
    async def socket(request):
        if request.headers.get("Origin") not in origins:
            raise web.HTTPForbidden()
        if lock.locked():
            raise web.HTTPServiceUnavailable()
        async with lock:
            ws = web.WebSocketResponse(max_msg_size=262144, heartbeat=20)
            await ws.prepare(request)
            try:
                first = await asyncio.wait_for(ws.receive(), 10)
                if first.type != WSMsgType.TEXT:
                    raise ValueError("Missing handshake")
                mode, engine, lang, rate = handshake(first.data)
                if engine=="whisper" and model is not None:
                    await whisper_session(ws,model,lang,rate,mode)
                elif engine=="apple" and apple_helper is not None:
                    await apple_session(ws,apple_helper,lang,rate,mode)
                else:
                    await ws.send_json({"type":"error","message":"Gekozen lokale engine is niet gestart."})
            except (ValueError, TypeError, AttributeError, asyncio.TimeoutError):
                if not ws.closed:
                    await ws.send_json({"type":"error","message":"Ongeldige audio of sessie, of tijdslimiet bereikt."})
            except Exception:
                if not ws.closed:
                    await ws.send_json({"type":"error","message":"Lokale transcriptie mislukt."})
            finally:
                await ws.close()
            return ws
    app.router.add_get("/eaispeak", socket)
    return app

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--engine",choices=("whisper","apple"),default="whisper")
    args=parser.parse_args()
    model=helper=None
    if args.engine=="apple":
        helper=Path(os.environ.get("EAISPEAK_APPLE_HELPER",str(Path(__file__).resolve().parent/"apple"/"eaispeak-apple")))
        if not helper.is_file() or not os.access(helper,os.X_OK):
            raise SystemExit("Compile the Apple helper first (see docs/local-transcription.md).")
    else:
        from faster_whisper import WhisperModel
        path = os.environ.get("EAISPEAK_WHISPER_MODEL")
        if not path or not os.path.isdir(path):
            raise SystemExit("Set EAISPEAK_WHISPER_MODEL to a downloaded local CTranslate2 model directory.")
        model = WhisperModel(path, device="cpu", compute_type="int8", local_files_only=True)
    web.run_app(create_app(model,apple_helper=helper), host="127.0.0.1", port=8766, access_log=None)
