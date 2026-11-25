# Lokale transcriptie

De techniek is onafhankelijk gebouwd; [Cicada](https://github.com/wquguru/cicada) is de inspiratie voor gescheiden spraakherkenning en vertaling. Er is geen Ling-, Ming- of Google-integratie.

## Apple (macOS 26 of hoger)
Gebruik een Mac met recente Xcode-commandline-tools. Vanuit de map bridge:
```bash
xcrun swiftc -swift-version 5 -target arm64-apple-macos26.0 apple/main.swift -o apple/eaispeak-apple
./apple/eaispeak-apple --capabilities nl-NL 48000
./apple/eaispeak-apple --probe nl-NL 48000
# Alleen wanneer je het taalmodel wilt installeren:
./apple/eaispeak-apple --install nl-NL 48000
python -m pip install -r requirements.txt
python transcribe.py --engine apple
```
De probe controleert de ondersteunde taal en geïnstalleerde assets. SpeechTranscriber krijgt voorrang, anders DictationTranscriber. De helper stuurt voorlopige en definitieve resultaten uit een doorlopende analyzer via stdin/stdout; de bridge schrijft geen audiobestanden. De ondersteunde taal en echte audiokwaliteit moeten op je Mac worden vastgesteld. Apple-assetdownloads gebeuren alleen met --install. Kies Apple in Studio. De gekozen bridge luistert op 127.0.0.1:8766.

## Whisper
Installeer requirements.txt en requirements-whisper.txt in een virtualenv. Download een meertalig faster-whisper CTranslate2-model op eigen initiatief en zet EAISPEAK_WHISPER_MODEL op het lokale modelpad. Start python transcribe.py --engine whisper. Kies Whisper in Studio.
Het model verwerkt een schuivend venster van vier seconden met telkens maximaal een seconde context voor en na de vastgelegde woorden; woordtijdstempels bepalen welke resultaten bij het interval horen. Stop sluit de microfoon en verwerkt het laatste korte stuk. Dit voorkomt het planmatig weggooien van audiobufferrestanten; het garandeert niet dat elk woord goed wordt herkend of dat tijdstempels exact zijn. Vertraging en grensherkenning moeten met echte spraak worden gemeten.

Beide services zijn lokaal, met expliciete browser-Origin-controle. Geen automatische fallback naar cloud. Op sommige browsers vereist de verbinding vanaf HTTPS een lokaal vertrouwde WSS-proxy; de lokale Vite-omgeving werkt als alternatief. Geen opname of transcript wordt door de bridge op schijf opgeslagen.

De CI compileert de helper op macOS 26 en macOS 27. De capability-uitvoer onderscheidt ondersteuning, aanwezige assets en beschikbare hardware. De browserproef gebruikt gesimuleerde spraakresultaten, geen fysieke microfoon.
