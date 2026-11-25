# Local transcription in EAIspeak

Cicada (https://github.com/wquguru/cicada) inspired the separation of recognition and translation. This implementation is independent; it does not embed Cicada or its providers.

Install the bridge dependencies and requirements-whisper.txt in a virtual environment. Obtain a multilingual faster-whisper CTranslate2 model separately, set EAISPEAK_WHISPER_MODEL to its local directory, then run python transcribe.py from bridge/. The service binds to 127.0.0.1:8766, allows only explicit origins and accepts mono PCM. Choose Whisper in Studio. Audio is processed in four-second chunks, not continuously revised; words crossing chunk boundaries and the last partial chunk may be lost. No audio files are written. Actual microphone latency and recognition accuracy are not yet verified.

Apple SpeechTranscriber and DictationTranscriber are future native adapters; their supported locales must be queried on the device. Browser translation is separate and may need a compatible browser or model. No automatic substitution with a cloud provider.
