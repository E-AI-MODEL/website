import json
from types import SimpleNamespace
import numpy as np
import pytest
from aiohttp.test_utils import TestClient, TestServer
from transcribe import handshake, decode_audio, OverlappingPCM, transcribe_window, create_app

def hello(engine="whisper",mode="start",rate=8000):
    return {"type":mode,"protocol":"eaispeak-pcm-v1","engine":engine,"source_language":"nl-NL","target_language":"nl-NL","input":{"codec":"pcm_s16le","channels":1,"sample_rate":rate}}

def test_handshake():
    assert handshake(json.dumps(hello(rate=48000))) == ("start","whisper","nl-NL",48000)
    assert handshake(json.dumps(hello("apple","probe"))) == ("probe","apple","nl-NL",8000)
    msg=hello();msg["target_language"]="fr-FR"
    with pytest.raises(ValueError):
        handshake(json.dumps(msg))

def test_audio():
    assert len(decode_audio(np.zeros(48000,dtype="<i2").tobytes(),48000)) == 16000
    with pytest.raises(ValueError):
        decode_audio(b"x",16000)

def test_window_coverage_overlap_and_tail():
    rate=8000
    pcm=OverlappingPCM(rate)
    pcm.append(np.arange(rate*5,dtype="<i2").tobytes())
    first=list(pcm.windows())
    assert [(len(data)//2,low,high,final) for data,low,high,final in first]==[(rate*5,0,4,False)]
    pcm.append(np.arange(rate*4,dtype="<i2").tobytes())
    second=list(pcm.windows())
    assert [(len(data)//2,low,high,final) for data,low,high,final in second]==[(rate*6,1,5,False)]
    pcm.append(b"\x00\x00"*123)
    final=list(pcm.windows(True))
    assert len(final)==1 and final[0][1]==1 and final[0][2]==pytest.approx(2+123/rate)
    assert pcm.committed==pcm.end and not pcm.buffer

class Model:
    def transcribe(self,audio,**kwargs):
        assert kwargs["word_timestamps"]
        return iter([SimpleNamespace(words=[SimpleNamespace(start=.1,end=.3,word=" eerste"),SimpleNamespace(start=1.1,end=1.3,word=" tweede"),SimpleNamespace(start=4.1,end=4.3,word=" derde")])]),None

def test_word_ownership():
    data=b"\x00\x00"*8000*5
    assert transcribe_window(Model(),data,8000,"nl-NL",0,4,False)=="eerste tweede"
    assert transcribe_window(Model(),data,8000,"nl-NL",1,5,False)=="tweede derde"

@pytest.mark.asyncio
async def test_websocket_flush_and_origin():
    async with TestClient(TestServer(create_app(Model()))) as client:
        with pytest.raises(Exception):
            await client.ws_connect("/eaispeak",headers={"Origin":"https://evil.example"})
        async with client.ws_connect("/eaispeak",headers={"Origin":"https://eaimodel.nl"}) as ws:
            await ws.send_json(hello())
            assert (await ws.receive_json())["type"]=="ready"
            await ws.send_bytes(b"\x00\x00"*8000)
            await ws.send_json({"type":"finish"})
            result=await ws.receive_json()
            assert result=={"type":"transcript","text":"eerste","final":True}
            assert (await ws.receive_json())["type"]=="end"

@pytest.mark.asyncio
async def test_apple_not_installed_does_not_claim_ready():
    async with TestClient(TestServer(create_app(Model()))) as client:
        async with client.ws_connect("/eaispeak",headers={"Origin":"https://eaimodel.nl"}) as ws:
            await ws.send_json(hello("apple","probe"))
            assert (await ws.receive_json())["type"]=="error"
