"""EAIspeak WebSocket bridge for Kyutai's native Moshi/Hibiki servers.

Browser: JSON start, then raw little-endian PCM16 audio frames.
Kyutai: 0x00 ready; 0x01 followed by Ogg Opus bytes; 0x02 text fragments.
Never sends microphone audio to a model until that model signals readiness.
"""
from __future__ import annotations

import argparse
import asyncio
from contextlib import suppress
from dataclasses import dataclass
import json
import logging
import os
from urllib.parse import urlsplit

from aiohttp import ClientSession, ClientTimeout, ClientWSTimeout, WSMsgType, web
import numpy as np
import soxr
import sphn

LOG = logging.getLogger("eaispeak.bridge")
PROTOCOL = "eaispeak-pcm-v1"
MODEL_RATE = 24000
MAX_PCM_MESSAGE = 256 * 1024
VALID_PAIRS = {
    "moshi": {("en-US", "en-US")},
    "hibiki": {("fr-FR", "en-US")},
    "hibiki-zero": {(language, "en-US") for language in ("fr-FR", "es-ES", "pt-PT", "de-DE")},
}
UPSTREAM_ENV = {
    "moshi": "EAISPEAK_MOSHI_WS",
    "hibiki": "EAISPEAK_HIBIKI_WS",
    "hibiki-zero": "EAISPEAK_HIBIKI_ZERO_WS",
}
DEFAULT_ORIGINS = (
    "https://eaimodel.nl",
    "https://www.eaimodel.nl",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
APP_CONFIG = web.AppKey("config", object)
APP_SESSION = web.AppKey("http_session", ClientSession)
APP_LOCKS = web.AppKey("model_locks", dict)


@dataclass(frozen=True)
class Config:
    origins: frozenset[str]
    upstreams: dict[str, str]
    upstream_timeout: float = 40.0


def validate_upstream(url: str) -> str:
    value = urlsplit(url)
    if value.scheme not in ("ws", "wss") or not value.hostname:
        raise ValueError("Modelendpoint moet ws:// of wss:// gebruiken.")
    if value.username or value.password or value.fragment or value.query:
        raise ValueError("Gebruik geen credentials, fragmenten of tokens in model-URL.")
    if value.scheme == "ws" and value.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Gebruik wss:// buiten localhost.")
    return url


def config_from_env(environ: dict[str, str] | None = None) -> Config:
    env = os.environ if environ is None else environ
    origins = env.get("EAISPEAK_ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS))
    trusted = frozenset(o.strip().rstrip("/") for o in origins.split(",") if o.strip())
    if not trusted or "*" in trusted:
        raise ValueError("Een expliciete Origin-allowlist is vereist; '*' is onveilig.")
    upstreams = {
        name: validate_upstream(env[key].strip())
        for name, key in UPSTREAM_ENV.items()
        if env.get(key, "").strip()
    }
    return Config(origins=trusted, upstreams=upstreams)


def parse_handshake(text: str) -> tuple[str, str, str, int]:
    try:
        message = json.loads(text)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Ongeldige JSON-handshake.") from exc
    if not isinstance(message, dict) or message.get("type") not in ("start", "probe") or message.get("protocol") != PROTOCOL:
        raise ValueError("EAIspeak-protocol niet herkend.")
    engine = message.get("engine")
    input_lang = message.get("source_language")
    output_lang = message.get("target_language")
    if engine not in VALID_PAIRS:
        raise ValueError("Geen beschikbare native Kyutai-spraakengine.")
    if (input_lang, output_lang) not in VALID_PAIRS[engine]:
        raise ValueError("De geselecteerde taalrichting wordt niet door het model ondersteund.")
    media = message.get("input")
    output = message.get("output")
    if not isinstance(media, dict) or media.get("codec") != "pcm_s16le" or media.get("channels") != 1:
        raise ValueError("De invoer moet mono PCM16 little-endian zijn.")
    if not isinstance(output, dict) or output.get("codec") != "pcm_s16le" or output.get("channels") != 1:
        raise ValueError("De uitvoer moet mono PCM16 little-endian zijn.")
    rate = media.get("sample_rate")
    if type(rate) is not int or not (8000 <= rate <= 192000):
        raise ValueError("De microfoonfrequentie valt buiten het toegestane bereik.")
    return engine, input_lang, output_lang, rate


class NativeOpusCodec:
    """Stateful browser PCM16 <-> Kyutai framed Opus conversion."""
    def __init__(self, input_rate: int):
        self.resampler = soxr.ResampleStream(input_rate, MODEL_RATE, 1, dtype="float32", quality="MQ")
        self.encoder = sphn.OpusStreamWriter(MODEL_RATE)
        self.decoder = sphn.OpusStreamReader(MODEL_RATE)
        # Opus accepts fixed frame sizes. Browser audio and SOXR produce variable chunks.
        self.pending = np.empty(0, dtype=np.float32)
        self.frame_size = 1920  # 80 ms at 24 kHz, same as Kyutai's reference clients

    def browser_to_native(self, raw_pcm: bytes) -> bytes:
        if not raw_pcm or len(raw_pcm) % 2 or len(raw_pcm) > MAX_PCM_MESSAGE:
            raise ValueError("Ongeldig PCM16-audioblok.")
        pcm = np.frombuffer(raw_pcm, dtype="<i2").astype(np.float32) / 32768.0
        samples = self.resampler.resample_chunk(pcm)
        if samples.size:
            self.pending = np.concatenate((self.pending, samples))
        encoded = bytearray()
        while self.pending.size >= self.frame_size:
            chunk = self.pending[:self.frame_size]
            packet = self.encoder.append_pcm(chunk)
            if packet:
                encoded.extend(packet)
            self.pending = self.pending[self.frame_size:]
        return b"\x01" + bytes(encoded) if encoded else b""

    def native_to_browser(self, native_opus: bytes) -> bytes:
        if not native_opus:
            return b""
        pcm = self.decoder.append_bytes(native_opus)
        if pcm is None or pcm.size == 0:
            return b""
        scaled = np.rint(np.clip(pcm, -1.0, 1.0) * 32767).astype("<i2")
        return scaled.tobytes()


async def notify(ws: web.WebSocketResponse, kind: str, **values: object) -> None:
    if not ws.closed:
        with suppress(ConnectionResetError, RuntimeError):
            await ws.send_json({"type": kind, **values})


async def client_to_model(browser: web.WebSocketResponse, model, codec: NativeOpusCodec) -> None:
    async for frame in browser:
        if frame.type == WSMsgType.BINARY:
            packet = codec.browser_to_native(frame.data)
            if packet:
                await model.send_bytes(packet)
        elif frame.type == WSMsgType.TEXT:
            raise ValueError("Audio verwacht; startbericht mag slechts eenmaal worden verzonden.")
        elif frame.type == WSMsgType.ERROR:
            raise ConnectionError("Browserverbinding verbroken.")


async def model_to_client(browser: web.WebSocketResponse, model, codec: NativeOpusCodec, engine: str) -> None:
    text = ""
    async for frame in model:
        if frame.type == WSMsgType.BINARY:
            data = frame.data
            if not data:
                continue
            if data[0] == 1:
                pcm = codec.native_to_browser(data[1:])
                if pcm:
                    await browser.send_bytes(pcm)
            elif data[0] == 2:
                # Kyutai sends generated text-token fragments, not source-side ASR.
                token = data[1:].decode("utf-8", errors="replace")
                if token:
                    text = (text + token)[-5000:]
                    await notify(browser, "translation", text=text)
            elif data[0] != 0:
                raise ValueError("Onbekend frame van de modelserver.")
        elif frame.type == WSMsgType.ERROR:
            raise ConnectionError("Modelserververbinding verbroken.")
    raise ConnectionError("Modelserver heeft de verbinding afgesloten.")


async def relay(browser: web.WebSocketResponse, model, codec: NativeOpusCodec, engine: str) -> None:
    tasks = {
        asyncio.create_task(client_to_model(browser, model, codec)),
        asyncio.create_task(model_to_client(browser, model, codec, engine)),
    }
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            exc = task.exception()
            if exc is not None:
                raise exc
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def bridge_socket(request: web.Request) -> web.StreamResponse:
    config: Config = request.app[APP_CONFIG]
    origin = request.headers.get("Origin", "").rstrip("/")
    if origin not in config.origins:
        raise web.HTTPForbidden(text="Origin niet toegestaan.")
    browser = web.WebSocketResponse(heartbeat=20, max_msg_size=MAX_PCM_MESSAGE)
    await browser.prepare(request)
    try:
        greeting = await asyncio.wait_for(browser.receive(), timeout=10)
        if greeting.type != WSMsgType.TEXT:
            raise ValueError("Verwacht eerst een JSON-startbericht.")
        engine, _, _, input_rate = parse_handshake(greeting.data)
        probe = json.loads(greeting.data)["type"] == "probe"
        upstream_url = config.upstreams.get(engine)
        if not upstream_url:
            raise ValueError("Deze modelserver is nog niet geconfigureerd. Controleer de bridge-instellingen.")
        lock = request.app[APP_LOCKS][engine]
        if lock.locked():
            raise ValueError("Dit model verwerkt al een gesprek. Probeer het later opnieuw.")
        async with lock:
            await notify(browser, "status", message="Verbinden met Kyutai-model…")
            session: ClientSession = request.app[APP_SESSION]
            async with session.ws_connect(
                upstream_url, heartbeat=20,
                timeout=ClientWSTimeout(ws_receive=config.upstream_timeout),
                max_msg_size=MAX_PCM_MESSAGE,
            ) as model:
                first = await asyncio.wait_for(model.receive(), timeout=config.upstream_timeout)
                if first.type != WSMsgType.BINARY or first.data != b"\x00":
                    raise ValueError("Modelserver gaf geen geldige Kyutai-startmelding.")
                if probe:
                    # Health probe: no microphone permission or audio frames are needed.
                    await notify(browser, "ready", protocol=PROTOCOL, output_sample_rate=MODEL_RATE, probe=True)
                    await notify(browser, "end")
                else:
                    codec = NativeOpusCodec(input_rate)
                    await notify(browser, "ready", protocol=PROTOCOL, output_sample_rate=MODEL_RATE)
                    await relay(browser, model, codec, engine)
    except (asyncio.TimeoutError, ConnectionError, OSError, ValueError) as exc:
        # Do not log user audio, transcripts or private URLs.
        await notify(browser, "error", message=str(exc)[:230])
        LOG.warning("Bridge session ended (%s).", type(exc).__name__)
    except Exception:
        LOG.exception("Bridge failed.")
        await notify(browser, "error", message="Onverwachte fout in de spraakbridge.")
    finally:
        await browser.close()
    return browser


async def health(_: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "protocol": PROTOCOL})


async def client_lifecycle(app: web.Application):
    app[APP_SESSION] = ClientSession(timeout=ClientTimeout(total=None, sock_connect=45), trust_env=False)
    try:
        yield
    finally:
        await app[APP_SESSION].close()


def create_app(config: Config | None = None) -> web.Application:
    selected = config or config_from_env()
    app = web.Application(client_max_size=MAX_PCM_MESSAGE)
    app[APP_CONFIG] = selected
    app[APP_LOCKS] = {name: asyncio.Lock() for name in VALID_PAIRS}
    app.cleanup_ctx.append(client_lifecycle)
    app.router.add_get("/health", health)
    app.router.add_get("/eaispeak", bridge_socket)
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="EAIspeak bridge for native Moshi/Hibiki websocket servers")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        parser.error("De bridge luistert uitsluitend op localhost. Gebruik voor remote toegang een beveiligde reverse proxy.")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    web.run_app(create_app(), host=args.host, port=args.port, access_log=None)


if __name__ == "__main__":
    main()
