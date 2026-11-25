import json
import numpy as np
import pytest
from transcribe import handshake, decode_audio

def test_handshake():
    msg = {"type":"start","protocol":"eaispeak-pcm-v1","engine":"whisper","source_language":"nl-NL","target_language":"nl-NL","input":{"codec":"pcm_s16le","channels":1,"sample_rate":48000}}
    assert handshake(json.dumps(msg)) == ("start","nl",48000)
    msg["target_language"] = "fr-FR"
    with pytest.raises(ValueError):
        handshake(json.dumps(msg))

def test_audio():
    assert len(decode_audio(np.zeros(48000,dtype="<i2").tobytes(),48000)) == 16000
    with pytest.raises(ValueError):
        decode_audio(b"x",16000)
