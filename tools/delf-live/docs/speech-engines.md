# EAIspeak · Moshi, Hibiki, Hibiki-Zero en Dessa

Deze vier keuzes staan onder **Vrij praten > Taal en model > Model draait**, naast WebLLM, Ollama en Puter. Ze veranderen de bestaande podiumvoorstelling niet.

| Engine | Functie | Talen | Status |
| --- | --- | --- | --- |
| [Moshi](https://github.com/kyutai-labs/moshi) | Live full-duplex gesprek | Engels → Engels | Eigen Moshi-server + adapter nodig |
| [Hibiki](https://github.com/kyutai-labs/hibiki) | Live spraakvertaling | Frans → Engels | Eigen Hibiki-server + adapter nodig |
| [Hibiki-Zero](https://github.com/kyutai-labs/hibiki-zero) | Live spraakvertaling | Frans/Spaans/Portugees/Duits → Engels | Eigen NVIDIA-server + adapter nodig (8 GB VRAM minimum volgens makers) |
| [Dessa](https://block.xyz/dessa) | Live full-duplex gesprek | Niet publiek geverifieerd | Niet startbaar: geen publieke API/gewichten |

**Nederlands is niet ondersteund door deze open spraakmodellen.** De bestaande browser-, Ollama- en Puter-routes blijven voor Nederlands beschikbaar. Geen automatische taalomzetting naar een andere taal of heimelijke terugval.

## Aansluiten

De browser heeft een generieke **EAIspeak PCM WebSocket v1**-client. Moshi, Hibiki en Hibiki-Zero spreken *niet rechtstreeks* dit protocol. Je moet zelf een serveradapter inzetten die hun echte transport en audiocodecs vertaalt. Het selectievakje is geen modelinstallatie, en een groene frontendtest is geen bewijs dat de audio met een modelserver werkt.

1. Start de passende Moshi/Hibiki-server volgens zijn officiële repository en controleer het licentiegebruik.
2. Draai op dezelfde machine een **eigen** WebSocket-adapter die het protocol hieronder spreekt. Die adapter is nog **niet** meegeleverd en is noodzakelijk. Direct verbinden met de standaardserver van Kyutai werkt dus niet.
3. Stel in EAIspeak het bridge-adres in, bijvoorbeeld `ws://localhost:8765/eaispeak` op de eigen computer, of `wss://spraak.example.nl/eaispeak` met een correct geconfigureerde HTTPS reverse proxy.
4. Kies de ondersteunde bron- en antwoordtaal, kies **Begin met spreken** en geef microfoontoestemming. **Stop gesprek** sluit de socket en microfoon.

Voor een remote bridge hoort de server Origin-verificatie, authenticatie/autorisatie, limieten op sessies en audiogrootte, versleutelde verbindingen, privacybeleid en een duidelijke bewaartermijn af te dwingen. De client verstuurt microfoonaudio naar de gekozen server. Een `wss://`-adres betekent **niet** dat de verwerking lokaal is.

### Browser → bridge

De WebSocket verstuurt eerst JSON:

```json
{
  "type": "start",
  "protocol": "eaispeak-pcm-v1",
  "engine": "hibiki",
  "source_language": "fr-FR",
  "target_language": "en-US",
  "input": {"codec": "pcm_s16le", "sample_rate": 48000, "channels": 1},
  "output": {"codec": "pcm_s16le", "sample_rate": 24000, "channels": 1}
}
```

De werkelijke `input.sample_rate` komt uit de browser-AudioContext (kan 44.100 of 48.000 zijn). De bridge moet dit resamplen naar de frequentie en de codec van het model. Na ontvangst van de bevestiging stuurt de browser **binaire WebSocket-frames** met mono raw PCM16 little-endian, zonder WAV-header.

### Bridge → browser

- `{"type":"ready","protocol":"eaispeak-pcm-v1","output_sample_rate":24000}`: de client begint microfoonaudio te sturen.
- `{"type":"status","message":"..." }`: operationele status, zonder persoonsgegevens.
- `{"type":"transcript","text":"..."}`: optionele transcriptie van bronaudio.
- `{"type":"translation","text":"..."}`: optionele vertaling of tekst van antwoord.
- **Binaire WebSocket-frames:** ruwe mono PCM16 little-endian voor audio-uitvoer. De browser speelt de chunks direct en in volgorde af.
- `{"type":"error","message":"..."}`, `{"type":"end"}`: beëindigen de sessie.

De bridge moet de native modelcodec (bijvoorbeeld Mimi voor Moshi) decoderen naar PCM16. Bij Dessa is geen bruikbaar modelprotocol beschikbaar en blijft starten geblokkeerd.

## Grenzen van deze eerste integratie

- Getest in code: catalogus, taalcontrole, WebSocket-URL-validatie, PCM16-conversie, UI-koppeling en stoppen.
- **Niet aangetoond:** een end-to-end live sessie met een echte Moshi/Hibiki(-Zero)-server, vloeiende full-duplex turn-taking, latency, stabiele iOS/WebKit-microfoon, of Nederlandse vertaling.
- Audio loopt via een `ScriptProcessorNode` als brede browsercompatibiliteit. Dat is een verouderde API; een `AudioWorklet` is nodig voor een definitieve, nauwkeuriger streamingimplementatie. Geen claim van productierijpheid.
- De bestaande tekstgesprekken werken los van deze audio-engines. Aparte audio-sessies slaan geen modelresponsen in gespreksgeschiedenis op.

De integratie staat bewust in een eigen pull request naar `feature/delf-live-stage-2026-11-19`, niet rechtstreeks op `main` en niet automatisch op de gepubliceerde site.
