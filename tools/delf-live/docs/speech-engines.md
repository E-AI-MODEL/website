# EAIspeak · Moshi, Hibiki, Hibiki-Zero en Dessa

Deze vier keuzes staan onder **Vrij praten > Taal en model > Model draait**, naast WebLLM, Ollama en Puter. Ze veranderen de bestaande podiumvoorstelling niet.

| Engine | Functie | Talen | Status |
| --- | --- | --- | --- |
| [Moshi](https://github.com/kyutai-labs/moshi) | Live full-duplex gesprek | Engels → Engels | Eigen Moshi-server + meegeleverde bridge |
| [Hibiki](https://github.com/kyutai-labs/hibiki) | Live spraakvertaling | Frans → Engels | Eigen Hibiki-server + meegeleverde bridge |
| [Hibiki-Zero](https://github.com/kyutai-labs/hibiki-zero) | Live spraakvertaling | Frans/Spaans/Portugees/Duits → Engels | Eigen NVIDIA-server + meegeleverde bridge (8 GB VRAM minimum volgens makers) |
| [Dessa](https://block.xyz/dessa) | Live full-duplex gesprek | Niet publiek geverifieerd | Niet startbaar: geen publieke API/gewichten |

**Nederlands is niet ondersteund door deze open spraakmodellen.** De bestaande browser-, Ollama- en Puter-routes blijven voor Nederlands beschikbaar. Geen automatische taalomzetting naar een andere taal of heimelijke terugval.

## Aansluiten

De browser heeft een generieke **EAIspeak PCM WebSocket v1**-client. Moshi, Hibiki en Hibiki-Zero spreken *niet rechtstreeks* dit protocol. De map `tools/delf-live/bridge/` bevat nu een Python-adapter die via het native Kyutai-WebSocket-protocol audio vertaalt en doorstuurt. Het selectievakje is geen modelinstallatie, en een groene frontendtest is geen bewijs dat de audio met een modelserver werkt.

1. Start de passende Moshi/Hibiki-server volgens zijn officiële repository en controleer het licentiegebruik.
2. Installeer de meegeleverde bridge met `python -m pip install -r tools/delf-live/bridge/requirements.txt` en start `python tools/delf-live/bridge/server.py` na het instellen van de upstream-URL. De bridge luistert standaard alleen op `127.0.0.1:8765`.
3. Stel in EAIspeak het bridge-adres in, bijvoorbeeld `ws://localhost:8765/eaispeak` op de eigen computer, of `wss://spraak.example.nl/eaispeak` met een correct geconfigureerde HTTPS reverse proxy.
4. Kies de ondersteunde bron- en antwoordtaal, kies **Begin met spreken** en geef microfoontoestemming. **Stop gesprek** sluit de socket en microfoon.

De meegeleverde bridge heeft een expliciete Origin-allowlist, localhost-binding, één sessie per model en audiogroottelimieten. Voor remote gebruik is nog een eigen reverse proxy met toegangscontrole, TLS, authenticatie, rate limits, privacybeleid en bewaartermijn vereist. De client verstuurt microfoonaudio naar de gekozen server. Een `wss://`-adres betekent **niet** dat de verwerking lokaal is.


## De meegeleverde native spraakbridge starten

Zorg voor Python 3.12, een werkende modelserver en voldoende hardware. Voor de lokale Moshi MLX-versie op macOS kan de server gestart worden met:

```bash
python -m pip install -U moshi_mlx
python -m moshi_mlx.local_web --host localhost --port 8998
```

Voor Hibiki (MLX op macOS):

```bash
python -m moshi_mlx.local_web --hf-repo kyutai/hibiki-1b-mlx-bf16 --host localhost --port 8998
```

Voor Hibiki-Zero (NVIDIA GPU met ongeveer 8 tot 12 GB VRAM):

```bash
uvx -p 3.13 hibiki-zero serve --host localhost --port 8998
```

Moshi en Hibiki-Zero gebruiken in deze configuratie standaard dezelfde poort. Start verschillende modellen op **verschillende poorten** of slechts één tegelijk. De native modellen zijn grote downloads, niet geschikt voor elke telefoon of laptop.

Start de bridge in een **andere terminal** met de juiste model-URL:

```bash
python -m pip install -r tools/delf-live/bridge/requirements.txt
export EAISPEAK_MOSHI_WS=ws://localhost:8998/api/chat
export EAISPEAK_HIBIKI_WS=ws://localhost:8999/api/chat
export EAISPEAK_HIBIKI_ZERO_WS=ws://localhost:9000/api/chat
python tools/delf-live/bridge/server.py
```

De drie omgevingsvariabelen zijn onafhankelijk. Laat een niet-gebruikte engine weg. Een ingestelde URL garandeert niet dat het model draait: de bridge controleert dat bij verbinden. De bridge ondersteunt ook een beperkte herkomstlijst, te configureren met `EAISPEAK_ALLOWED_ORIGINS`, met komma's tussen de volledige origins. De standaardlijst bevat de EAIspeak-site en lokale Vite-ontwikkelservers.

De controle-URL is `http://127.0.0.1:8765/health`. Voer de tests uit met `python -m pytest -q tools/delf-live/bridge/tests`.

De Python-server kan niet in een gewone mobiele browser draaien. EAIspeak op een telefoon kan wel verbinden met een beveiligde bridge op een andere machine. De bridge is standaard alleen via localhost bereikbaar. Een eigen, beveiligde reverse proxy is nodig voor externe apparaten.

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

De bridge vertaalt de browser-PCM-audio naar de Kyutai Opus-stream op 24 kHz en zet ontvangen Opus-audio terug naar PCM16. De echte modelservers gebruiken daarnaast Mimi intern. Bij Dessa is geen bruikbaar modelprotocol beschikbaar en blijft starten geblokkeerd.

## Grenzen van deze eerste integratie

- Automatische controles: catalogus, taalcontrole, WebSocket-URL-validatie, PCM16/Opus-conversie, mock-native-WebSocket-server, Origin-beveiliging, UI-koppeling en stoppen.
- **Niet aangetoond:** een end-to-end live sessie met een echte Moshi/Hibiki(-Zero)-server, vloeiende full-duplex turn-taking, latency, stabiele iOS/WebKit-microfoon, of Nederlandse vertaling.
- Audio loopt via een `ScriptProcessorNode` als brede browsercompatibiliteit. Dat is een verouderde API; een `AudioWorklet` is nodig voor een definitieve, nauwkeuriger streamingimplementatie. Geen claim van productierijpheid.
- De bestaande tekstgesprekken werken los van deze audio-engines. Aparte audio-sessies slaan geen modelresponsen in gespreksgeschiedenis op.

De integratie staat bewust in een eigen pull request naar `feature/delf-live-stage-2026-11-19`, niet rechtstreeks op `main` en niet automatisch op de gepubliceerde site.

## Modellen echt verbinden en testen

De knop **Controleer modelverbinding** staat onder **Vrij praten → Taal en model → EAIspeak-spraakbridge**. Hij opent **geen microfoon**. De browser vraagt de EAIspeak-bridge een native Kyutai-verbinding te openen. Alleen een echte \`0x00\`-gereedmelding van de geselecteerde modelserver leidt tot een positieve uitslag. De bridge sluit die proefverbinding daarna weer. Zo is het verschil zichtbaar tussen:

- een bereikbaar serveradres (onvoldoende);
- een native model dat een geldige handdruk geeft (verbindingsproef geslaagd);
- een daadwerkelijk gesproken gesprek met herkenning, audio en onderbrekingen (aparte gebruikerstest).

Een **Mac met Apple Silicon** kan voor Moshi of Hibiki de lokale modelserver en bridge starten met één opdracht vanuit de root van de repository:

\`\`\`bash
bash tools/delf-live/bridge/start-macos.sh moshi
# Of:
bash tools/delf-live/bridge/start-macos.sh hibiki
\`\`\`

Het script vereist Python 3.12, installeert twee **gescheiden virtuele omgevingen** en downloadt het gekozen model via de officiële PyPI- en Hugging Face-pakketten. Het draait beide processen lokaal; het installeert **geen** service, maakt **geen** publieke tunnel en start **geen** GPU in de cloud. Stoppen met Ctrl-C sluit beide af. De eerste download kan meerdere gigabytes kosten aan schijfruimte en tijd. Het opstartscript is een hulpmiddel, **nog geen bevestigde Mac-proef**.

De webapp staat op HTTPS. Lokale \`ws://localhost\`-verbindingen kunnen op Safari of door beveiligingsinstellingen worden geweigerd. Op de iPhone verwijst \`localhost\` naar de **iPhone zelf**, niet naar de Mac. Een mobiele proef vereist een eigen GPU/Mac-server met een afgeschermde \`wss://\`-verbinding, authenticatie en toegangscontrole. **Origin-controle is geen gebruikersauthenticatie.** Een openbare anonieme WebSocket-proxy is hiervoor niet geschikt.

De nieuwe verbindingstest en de bridge worden met GitHub Actions getoetst via een nagebootste native Kyutai-server. Dat is geen bewijs van een realistisch gesprek: daarvoor is een draaiend model nodig, plus handmatige meting van latency, audiokwaliteit en onderbreken.

