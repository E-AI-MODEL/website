import asyncio
import json
from pathlib import Path
import sys

import aiohttp
from aiohttp import WSMsgType, web
from aiohttp.test_utils import TestServer
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import (
    Config, NativeOpusCodec, PROTOCOL, VALID_PAIRS, config_from_env,
    create_app, parse_handshake, validate_upstream,
)


ORIGIN = "https://eaimodel.nl"


def start_message(engine="moshi", source="en-US", target="en-US", rate=48000):
    return {
        "type": "start", "protocol": PROTOCOL, "engine": engine,
        "source_language": source, "target_language": target,
        "input": {"codec": "pcm_s16le", "sample_rate": rate, "channels": 1},
        "output": {"codec": "pcm_s16le", "sample_rate": 24000, "channels": 1},
    }


def test_language_coverage_and_no_dessa():
    assert VALID_PAIRS["moshi"] == {("en-US", "en-US")}
    assert VALID_PAIRS["hibiki"] == {("fr-FR", "en-US")}
    assert len(VALID_PAIRS["hibiki-zero"]) == 4
    assert "dessa" not in VALID_PAIRS
    for name, pairs in VALID_PAIRS.items():
        for source, target in pairs:
            assert parse_handshake(json.dumps(start_message(name, source, target)))[0] == name


@pytest.mark.parametrize("message", [
    {**start_message(), "engine": "dessa"},
    {**start_message(), "source_language": "nl-NL"},
    {**start_message(), "protocol": "other"},
    {**start_message(), "type": "unknown"},
    {**start_message(), "input": {"codec": "opus", "sample_rate": 48000, "channels": 1}},
    {**start_message(), "input": {"codec": "pcm_s16le", "sample_rate": 48000, "channels": 2}},
    {**start_message(), "input": {"codec": "pcm_s16le", "sample_rate": True, "channels": 1}},
])
def test_rejects_unsupported_configs(message):
    with pytest.raises(ValueError):
        parse_handshake(json.dumps(message))


def test_does_not_allow_unsafe_upstreams():
    assert validate_upstream("ws://127.0.0.1:8998/api/chat")
    assert validate_upstream("wss://voice.example.org/api/chat")
    for value in (
        "http://localhost:8998/api/chat", "ws://external.example.org/api/chat",
        "wss://user:pass@external.example.org/api/chat",
        "wss://external.example.org/api/chat?token=abc",
    ):
        with pytest.raises(ValueError):
            validate_upstream(value)
    with pytest.raises(ValueError):
        config_from_env({"EAISPEAK_ALLOWED_ORIGINS": "*"})


def test_pcm_input_resamples_and_bounds():
    codec = NativeOpusCodec(48000)
    signal = (np.sin(np.arange(48000, dtype=np.float32) * .02) * 10000).astype("<i2")
    frames = [
        codec.browser_to_native(signal[idx:idx + 2048].tobytes())
        for idx in range(0, len(signal), 2048)
    ]
    assert any(frame.startswith(b"\x01") for frame in frames if frame)
    with pytest.raises(ValueError):
        codec.browser_to_native(b"\x01")
    with pytest.raises(ValueError):
        codec.browser_to_native(b"\0" * (256 * 1024 + 2))


class FakeCodec:
    def __init__(self, rate):
        self.rate = rate

    def browser_to_native(self, payload):
        return b"\x01" + payload

    def native_to_browser(self, payload):
        return payload


@pytest.mark.asyncio
async def test_bridge_relays_pcm_audio_and_generated_text(monkeypatch):
    import server as bridge
    monkeypatch.setattr(bridge, "NativeOpusCodec", FakeCodec)
    received = []

    async def native_handler(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.send_bytes(b"\x00")
        async for event in ws:
            if event.type == WSMsgType.BINARY:
                received.append(event.data)
                await ws.send_bytes(b"\x02" + "Hello".encode())
                await ws.send_bytes(event.data)
        return ws

    native = web.Application()
    native.router.add_get("/api/chat", native_handler)
    async with TestServer(native) as native_server:
        url = str(native_server.make_url("/api/chat")).replace("http://", "ws://")
        cfg = Config(origins=frozenset([ORIGIN]), upstreams={"moshi": url})
        async with TestServer(create_app(cfg)) as bridge_server:
            browser_url = str(bridge_server.make_url("/eaispeak")).replace("http://", "ws://")
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(browser_url, headers={"Origin": ORIGIN}) as ws:
                    await ws.send_json(start_message())
                    ready = None
                    for _ in range(5):
                        result = await asyncio.wait_for(ws.receive(), 2)
                        if result.type == WSMsgType.TEXT and json.loads(result.data)["type"] == "ready":
                            ready = json.loads(result.data)
                            break
                    assert ready["protocol"] == PROTOCOL
                    await ws.send_bytes(b"\x00\x10\x01\x10")
                    messages = [await asyncio.wait_for(ws.receive(), 2) for _ in range(2)]
                    assert any(x.type == WSMsgType.TEXT and json.loads(x.data).get("text") == "Hello" for x in messages)
                    assert any(x.type == WSMsgType.BINARY and x.data == b"\x00\x10\x01\x10" for x in messages)
                assert received == [b"\x01\x00\x10\x01\x10"]


@pytest.mark.asyncio
async def test_rejects_unknown_origin_and_unconfigured_engine():
    app = create_app(Config(origins=frozenset([ORIGIN]), upstreams={}))
    async with TestServer(app) as test_server:
        endpoint = str(test_server.make_url("/eaispeak")).replace("http://", "ws://")
        async with aiohttp.ClientSession() as session:
            with pytest.raises(aiohttp.WSServerHandshakeError) as exc:
                await session.ws_connect(endpoint, headers={"Origin": "https://other.example"})
            assert exc.value.status == 403
            async with session.ws_connect(endpoint, headers={"Origin": ORIGIN}) as ws:
                await ws.send_json(start_message())
                reply = await asyncio.wait_for(ws.receive(), 2)
                assert json.loads(reply.data)["type"] == "error"
                assert "niet geconfigureerd" in json.loads(reply.data)["message"]


@pytest.mark.asyncio
async def test_no_audio_before_native_ready(monkeypatch):
    import server as bridge
    monkeypatch.setattr(bridge, "NativeOpusCodec", FakeCodec)
    async def silent_native(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.send_bytes(b"\x07")
        await asyncio.sleep(.05)
        return ws
    native = web.Application()
    native.router.add_get("/api/chat", silent_native)
    async with TestServer(native) as upstream:
        url = str(upstream.make_url("/api/chat")).replace("http://", "ws://")
        async with TestServer(create_app(Config(frozenset([ORIGIN]), {"moshi": url}))) as local:
            endpoint = str(local.make_url("/eaispeak")).replace("http://", "ws://")
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(endpoint, headers={"Origin": ORIGIN}) as ws:
                    await ws.send_json(start_message())
                    messages = [await asyncio.wait_for(ws.receive(), 2) for _ in range(3)]
                    assert not any(m.type == WSMsgType.TEXT and json.loads(m.data).get("type") == "ready" for m in messages)
                    assert any(m.type == WSMsgType.TEXT and json.loads(m.data).get("type") == "error" for m in messages)



@pytest.mark.asyncio
async def test_probe_checks_real_native_handshake_without_transmitting_microphone_audio():
    received = []

    async def native_handler(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.send_bytes(b"\x00")
        async for event in ws:
            if event.type == WSMsgType.BINARY:
                received.append(event.data)
        return ws

    native = web.Application()
    native.router.add_get("/api/chat", native_handler)
    async with TestServer(native) as upstream:
        native_url = str(upstream.make_url("/api/chat")).replace("http://", "ws://")
        cfg = Config(origins=frozenset([ORIGIN]), upstreams={"moshi": native_url})
        async with TestServer(create_app(cfg)) as bridge:
            url = str(bridge.make_url("/eaispeak")).replace("http://", "ws://")
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(url, headers={"Origin": ORIGIN}) as socket:
                    hello = start_message()
                    hello["type"] = "probe"
                    await socket.send_json(hello)
                    kinds = []
                    while True:
                        item = await asyncio.wait_for(socket.receive(), timeout=3)
                        if item.type == WSMsgType.TEXT:
                            msg = json.loads(item.data)
                            kinds.append(msg["type"])
                            if msg["type"] == "ready":
                                assert msg["probe"] is True
                                assert msg["protocol"] == PROTOCOL
                        if item.type in (WSMsgType.CLOSE, WSMsgType.CLOSED):
                            break
                    assert "ready" in kinds
                    assert "end" in kinds
    assert received == [], "Probe must never send user audio to the native model"
