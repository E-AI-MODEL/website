# Franse spreker: modelkeuze en uitvoeringsvoorwaarden

Onderzocht op 20 november 2026. Dit document onderscheidt leveranciersclaims van werking in de DELF-podiumapp.

## Doel

Één Franse spreker voor de diploma-uitreiking:
- Via de microfoon kunnen spreken, in het Frans of Nederlands.
- Een hoorbaar, kort en passend Frans antwoord, zonder verplicht Nederlands stemmodel.
- Een goedgekeurde speech die woordelijk blijft, per passage te pauzeren en door te klikken.
- De docent kan onmiddellijk het woord terugnemen; bij een fout blijft de vaste speech bruikbaar.

## Aangetroffen in deze code

- `src/main.js`: Chrome Web Speech met `nl-NL` en vertaling naar Frans; Phonon 40M maakt Franse audio uit vaste tekst.
- `src/script.mjs`: `speech` is de vaststaande Franse inhoud.
- `src/system-probes.mjs`: Ollama/LM Studio/llama.cpp hebben alleen lokale HTTP-controles voor tekstmodellen.
- Deze branch voegt handmatig bladeren door speechpassages toe en maakt de Nederlandse browserstem optioneel.
- **Nog niet aanwezig:** een echte gekoppelde audio-naar-audio-gespreksdienst.

## Onderzochte modellen

| Route | Ondersteuning Frans | Kan direct reageren op microfoon? | Benodigde uitvoering | Keuze |
|---|---|---|---|---|
| Qwen3-Omni-30B-A3B-Instruct | Franse audio-invoer en audio-uitvoer, Nederlands als invoertaal | Ja volgens modelkaart | Zware GPU-server; modelkaart toont BF16-configuraties met circa 79+ GB bij video | Interessant voor een serverproef, niet standaard in Chrome |
| Kyutai Unmute (STT + LLM + TTS) | Kyutai STT 1B: Engels en Frans; TTS: Frans | Ja via WebSocket en eigen backend | Een online of lokale inference-backend; voor Nederlands is andere STT nodig | Beste open architectuur voor een beheerste podiumproef |
| OpenAI Realtime API | Spraakgesprek via WebRTC | Ja; onderbrekingen en instructies | Betaalde API, eigen server voor tijdelijke browsercredential; netwerkverbinding | Praktisch alternatief bij beschikbaar budget/backend |
| Qwen3 4B Instruct + Whisper + Franse TTS | Frans via losse componenten, Whisper ook Nederlands | Ja na eigen koppeling, niet één end-to-end model | STT-server, LLM-server, Franse stem, audio streaming | Lichtere lokale noodvariant |
| Phonon 40M | Franse tekst-naar-spraak | Nee | Draait nu in browser | Behouden voor de woordelijk vaste speech |
| Kyutai Moshi | Volgens officiële FAQ alleen Engels | Nee voor het gewenste Frans | Niet van toepassing | Afvallen |

Bronnen:
- https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct
- https://github.com/kyutai-labs/unmute
- https://kyutai.org/unmute/
- https://kyutai.org/stt/
- https://huggingface.co/kyutai/tts-1.6b-en_fr
- https://github.com/kyutai-labs/moshi/blob/main/FAQ.md
- https://developers.openai.com/api/docs/guides/realtime
- https://huggingface.co/openai/whisper-large-v3-turbo
- https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507

## Technisch besluit

1. **Vaste speech:** altijd uit de opgeslagen en goedgekeurde tekst, uitgesproken door de bestaande Franse TTS. Niet via vrije LLM-generatie. Acties `pauze`, `vorige`, `volgende`, `stop` moeten in code werken, ook als een gespreksmodel faalt.
2. **Vrij gesprek:** een optionele audioverbinding achter dezelfde Franse spreker. De zichtbare interface mag geen verplichte aparte Nederlandse stem of Ollama-instelling vereisen.
3. **Aanbevolen open backendproef:** Kyutai Unmute, met een Franstalig model voor korte reacties. De actuele microfoon-naar-audio-beleving en turn-taking moeten op echte Chrome/Mac en iPhone getest worden; de productdemonstratie van Unmute bewijst geen DELF-integratie.
4. **Alternatieve hosted proef:** OpenAI Realtime met een kortlevend browsertoken uit een eigen backend. API-geheimen nooit in `index.html` of browserstorage.
5. **Qwen3-Omni:** afzonderlijke serverbenchmark met FR-input en FR-output; geen automatische downloadaanvraag op mobiele browser.
6. **Taalherkenning:** Kyutai STT ondersteunt volgens de bron geen Nederlands; kies bij NL-input een aparte Whisper-route, of beperk de gespreksmodus expliciet tot Frans. Verwar de NL->FR-ondertiteling niet met het Franstalige gesprek.

## Testen vóór live gebruik

- Franse microfoonzin -> feitelijk Frans audioantwoord, met tijd tussen einde zin en eerste audio gemeten.
- Nederlandse microfoonzin -> herkenning in Nederlands en hoorbaar Frans antwoord (alleen wanneer NL-route is aangesloten).
- Onderbreken tijdens AI-antwoord; onmiddellijke stop met doorlopende gespreksstaat.
- Speechtekst woord-voor-woord vergeleken met bron; geen toegevoegd, weggelaten of herschreven deel.
- Volgende/vorige tijdens actieve TTS; geen overlappende audio; geen oude async-generator die een oude passage terugschrijft.
- Offline/netwerkfout en geblokkeerde microfoon: zichtbare diagnose, geen schijnreactie.
- Browserproef op een MacBook en een iPhone; test kort met publiek geluid.
- FR uitspraak in naamgevallen, schoolnaam, A2/B2 en DELF door menselijke luisterproef.

## Grenzen van deze wijziging

De code in deze branch bestuurt de bestaande Phonon-speech. Er is **geen live Franse audio-naar-audio-backend** beschikbaar gesteld of getest. Het toevoegen van modelnamen aan Hugging Face of GitHub maakt geen werkende realtime voice-inferentie. Een vervolgpatch moet een gekozen backend werkelijk verbinden en een geslaagde spraakronde meten, voordat de interface 'gesprek gereed' zegt.
