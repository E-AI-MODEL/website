# EAIspeak

Vrij praten, live vertalen, ondertitelen, transcriberen en voorlezen. De gebruiker kiest taal, model en stem. De vaste opnamen en voorstellingslogica zijn verwijderd; oudere versies blijven in de Git-geschiedenis.

## Gebruik
- Live: kies functie, bron- en doeltaal. Bereid de gekozen vertaalroute voor en start. Stop sluit de microfoon. Bij lokale transcriptie wordt het laatste audiostuk verwerkt. Tekst kan expliciet worden gedownload.
- Vrij praten: WebLLM, Ollama, Puter of een ondersteunde Kyutai-spraakengine. Geen automatische externe fallback. Dessa is niet beschikbaar.
- Voorlezen: browserstem of de Franse Phonon-stem. Eigen tekst, geen verplichte speech.
- Instellingen: microfoon en vertaaltest. Techniek: status, lokale verbindingen, fullscreen.

## Lokale transcriptie
Zie [Apple en Whisper](docs/local-transcription.md). De browsertranscriptie kan een externe browserdienst gebruiken. De lokale bridge slaat geen audio op en is uitsluitend op loopback beschikbaar. De gekozen modellen moeten op de computer zijn geïnstalleerd. De browser kan lokale netwerkverbindingen beperken; gebruik indien nodig de lokale Vite-app.

## Vertaling
Chrome Translator controleert elk taalpaar bij het laden. Het ONNX-model ondersteunt uitsluitend Nederlands naar Frans. Hibiki en Hibiki-Zero vereisen een echte Kyutai-server en ondersteunen alleen de in de catalogus vastgelegde taalrichtingen. Zie [spraakengines](docs/speech-engines.md).

## Ontwikkeling
```bash
npm install --no-audit --no-fund
npm test
npm run dev
npm run build
```
Tests en build draaien in GitHub Actions. Voor publicatie is een geslaagde build op main en een expliciete handmatige release nodig. De release gebruikt het gecontroleerde artifact, zonder opnieuw te bouwen. De oude URL leidt naar /tools/eaispeak/.

## Nog te meten
Herkenning, vertaalbetekenis, hoorbare stemmen, vertraging en browsergedrag op echte MacBooks, iPhones en andere apparaten. Apple-modellen en taalbeschikbaarheid zijn runtime-eigenschappen, niet gegarandeerd door de build.
