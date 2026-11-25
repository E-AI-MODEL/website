"""Local-only Whisper transcription bridge. No audio files or remote requests."""
import asyncio
import json
import os
from aiohttp import web, WSMsgType
import numpy as np
import soxr

PROTOCOL = "eaispeak-pcm-v1"
LANGUAGES = {"nl-NL", "en-US", "fr-FR", "de-DE", "es-ES", "pt-PT"}
ORIGINS = {"https://eaimodel.nl", "https://www.eaimodel.nl", "http://localhost:5173", "http://127.0.0.1:5173"}

def handshake(raw):
    msg = json.loads(raw)
    if not isinstance(msg, dict) or msg.get("protocol") != PROTOCOL or msg.get("type") not in ("start", "probe") or msg.get("engine") != "whisper":
        raise ValueError("Invalid transcription handshake")
    source = msg.get("source_language")
    if source not in LANGUAGES or source != msg.get("target_language"):
        raise ValueError("Unsupported transcription language")
    media = msg.get("input", {})
    rate = media.get("sample_rate")
    if media.get("codec") != "pcm_s16le" or media.get("channels") != 1 or type(rate) is not int or not 8000 <= rate <= 96000:
        raise ValueError("Invalid PCM format")
    return msg["type"], source.split("-")[0], rate

def decode_audio(data, rate):
    if len(data) % 2:
        raise ValueError("Invalid PCM frame")
    audio = np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768
    return soxr.resample(audio, rate, 16000) if rate != 16000 else audio

def create_app(model, origins=ORIGINS):
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
                mode, lang, rate = handshake(first.data)
                await ws.send_json({"type":"ready","protocol":PROTOCOL,"probe":mode=="probe","output_sample_rate":24000})
                if mode == "probe":
                    return ws
                buf = bytearray()
                async for frame in ws:
                    if frame.type != WSMsgType.BINARY:
                        if frame.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                            break
                        raise ValueError("Expected PCM audio")
                    if len(frame.data) % 2:
                        raise ValueError("Invalid PCM frame")
                    buf.extend(frame.data)
                    if len(buf) >= rate * 2 * 4:
                        audio = decode_audio(bytes(buf), rate)
                        buf.clear()
                        def infer():
                            segments, _ = model.transcribe(audio, language=lang, vad_filter=True, condition_on_previous_text=False)
                            return " ".join(s.text.strip() for s in segments).strip()
                        text = await asyncio.to_thread(infer)
                        if text and not ws.closed:
                            await ws.send_json({"type":"transcript","text":text})
            except (ValueError, TypeError, AttributeError, asyncio.TimeoutError):
                if not ws.closed:
                    await ws.send_json({"type":"error","message":"Invalid audio or session configuration"})
            except Exception:
                if not ws.closed:
                    await ws.send_json({"type":"error","message":"Local transcription failed"})
            finally:
                await ws.close()
            return ws
    app.router.add_get("/eaispeak", socket)
    return app

if __name__ == "__main__":
    from faster_whisper import WhisperModel
    path = os.environ.get("EAISPEAK_WHISPER_MODEL")
    if not path or not os.path.isdir(path):
        raise SystemExit("Set EAISPEAK_WHISPER_MODEL to a downloaded local CTranslate2 model directory.")
    model = WhisperModel(path, device="cpu", compute_type="int8", local_files_only=True)
    web.run_app(create_app(model), host="127.0.0.1", port=8766, access_log=None)
