# DELF scolaire · podiumapp

Een zelfstandige webapp voor de diploma-uitreiking. Je spreekt Nederlands, de Franse tekst verschijnt live. Daarna onderbreekt een stem je in het Nederlands, neemt de Franse stem de toespraak over en geeft het woord weer aan jou. De Franse stem wordt **tijdens de uitvoering** gemaakt. Er staan geen opnamen in de repository.

## Gebruik

Open de app in een recente desktopversie van Chrome. Druk op Esc voor het regiepaneel. Bereid vóór de bijeenkomst de Nederlandse spraakherkenning, de Chrome Translator API en het Franse stemmodel voor. Test de geluidsuitvoer en beluister de Nederlandse stem. In de zaal: `1` start de Nederlandse microfoon met live Franse vertaling; `2` laat de Nederlandse stem je onderbreken; na je eigen reactie start `3` de Franse toespraak; de app geeft daarna automatisch in het Nederlands het woord terug; `5` begint je slot weer met live vertaling. Met `X` wordt alle audio gestopt. `0` zet alles terug.

## Franse spraak

De app gebruikt `phonon-tts@0.7.1` en specifiek het Franse checkpoint `gradium/phonon-40m-fr`. Dit model is toegankelijk nadat de gebruiker op Hugging Face de voorwaarden heeft aanvaard. De modelgewichten hebben **CC BY-NC 4.0** als licentie. Het is niet toegestaan de gewichten zomaar via de openbare website of GitHub te publiceren. De repository bevat deze gewichten niet.

Accepteer zelf de voorwaarden op https://huggingface.co/gradium/phonon-40m-fr en download de checkpointmap. In Chrome open je vervolgens die map bij **Frans stemmodel openen**. De app leest de bestanden lokaal, maakt tijdelijke blob-URL's en laadt het model in een browser-worker. De map moet in ieder geval `model.q8.gguf`, `config.json`, `tokenizer.json` en een Franse stem bevatten (`default-voice.safetensors` of een stem-embeddingsbestand). Opnieuw laden na het sluiten van de browser vraagt opnieuw de map kiezen. Er worden geen Franse audiobestanden opgeslagen.

De app speelt de PCM-audio van Phonon live af via Web Audio. Ze meet de model-laadtijd en de tijd tot het eerste audiostuk. Dat zijn apparaatgebonden metingen.

## Nederlandse onderbreking

De Franse stem moet Frans spreken en kan het Nederlandse gedeelte niet overnemen. De app laat je expliciet een Nederlandse stem kiezen uit de aanwezige systeemstemmen. Er is geen automatische stemfallback. Deze route is alleen geschikt wanneer je zelf een overtuigende Nederlandse stem hebt beluisterd. Een aparte hoogwaardige Nederlandse spraakgenerator is nog niet aangesloten. Vermeld dat bij een podiumproef, en noem de volledige ervaring niet klaar zolang de Nederlandse stem onvoldoende klinkt.

## Live vertaling

De vertaling gebruikt Chrome `Translator` (nl → fr) en spraakherkenning via `SpeechRecognition`. Deze browserfuncties zijn niet op elk apparaat beschikbaar. Spraakherkenning kan van een online dienst afhankelijk zijn, ook wanneer het vertaalmodel op de laptop staat. De app toont een foutmelding in plaats van een vooraf geschreven vertaling als een onderdeel ontbreekt. Onderbreking en Franse speech schakelen de microfoon uit, zodat de computer zijn eigen stem niet vertaalt.

## Bouwen en testen

```sh
npm install
npm test
npm run build
```

De output staat in `dist/`. Op eaimodel.nl wordt die in `/tools/delf-live/` geplaatst door de websitebuild. Een geslaagde syntax- of mocktest is geen bewijs van modelkwaliteit, een echte stemmeting of compatibiliteit met de gebruikte laptop.

Bronnen: https://github.com/gradium-ai/xn-ptts/blob/main/ptts-wasm/js/README.md en https://developer.chrome.com/docs/ai/translator-api .
