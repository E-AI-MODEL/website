# DELF scolaire · podiumapp

Een zelfstandige webapp voor de diploma-uitreiking. Je spreekt Nederlands, de Franse tekst verschijnt live. Daarna onderbreekt een stem je in het Nederlands, neemt de Franse stem de toespraak over en geeft het woord weer aan jou. De Franse stem wordt **tijdens de uitvoering** gemaakt. Er staan geen opnamen in de repository.

## Gebruik

Vóór de opening staat er helemaal geen tekst in beeld, alleen een bijna witte, langzaam bewegende achtergrond. Tijdens je Nederlandse opening en slot ziet de zaal uitsluitend de actuele Franse vertaling van je echte spraak. Tijdens de AI-overname staan er geen ondertitels: dan reageert een kleine animatie van dunne lijnen op de stem. Er zijn geen iconen, titelbalk, voetregels of knoppen op het gespiegeld scherm. Je begint in het Nederlands; Chrome herkent jouw woorden en vertaalt ze zo snel mogelijk naar korte Franse tekstregels. De tekst staat op een vaste plek. Het scherm gebruikt een lichte, rustige achtergrond.

Voor aanvang open je met `Esc` de instellingen en bereid je het Franse vertaalmodel, de microfoon, het Franse stemmodel en een bewust gekozen Nederlandse onderbrekingsstem voor. Klik op **Luister naar de Franse stem** om het Franse accent en de intonatie te beoordelen. Met `1` begin je live te vertalen. Alle bediening werkt via de MacBook-toetsen. Met `Esc` open of sluit je het instellingenpaneel. Doe de voorbereiding voordat het bord zichtbaar is voor de zaal.

**Eén druk op `→`** tijdens de Nederlandse opening begint de volledige overname: de Nederlandse stem onderbreekt je; je krijgt ruim vier seconden om te antwoorden; de Franse Phonon-stem spreekt de voorbereide Franse tekst **live** uit; en de Nederlandse stem geeft het woord weer aan jou. Meteen daarna schakelt de app zelf de live vertaling weer in voor jouw Nederlandse slot. Toets `→` heeft tijdens het slot geen effect.

**`Spatie`** pauzeert en hervat de stem. **`X`** stopt alle stemgeluiden en de microfoon meteen. Met `0` begin je opnieuw. De toetsen `2` tot en met `5` blijven beschikbaar om een onderdeel bij een storing handmatig te starten. `F` zet het scherm volledig open.

De vertaling en spraakgeneratie blijven afhankelijk van de browser, het geladen model en eventuele online spraakherkenning. De app verzint bij uitval geen Franse ondertitels.

## Franse spraak

De app gebruikt `phonon-tts@0.7.1` en specifiek het Franse checkpoint `gradium/phonon-40m-fr`. Dit model is toegankelijk nadat de gebruiker op Hugging Face de voorwaarden heeft aanvaard. De modelgewichten hebben **CC BY-NC 4.0** als licentie. Het is niet toegestaan de gewichten zomaar via de openbare website of GitHub te publiceren. De repository bevat deze gewichten niet.

Accepteer zelf de voorwaarden op https://huggingface.co/gradium/phonon-40m-fr en download de checkpointmap. In Chrome open je vervolgens die map bij **Frans stemmodel openen**. De app leest de bestanden lokaal, maakt tijdelijke blob-URL's en laadt het model in een browser-worker. De map moet in ieder geval `model.q8.gguf`, `config.json`, `tokenizer.json` en een Franse stem bevatten (`default-voice.safetensors` of een stem-embeddingsbestand). Opnieuw laden na het sluiten van de browser vraagt opnieuw de map kiezen. Er worden geen Franse audiobestanden opgeslagen.

De app speelt de PCM-audio van Phonon live af via Web Audio. Franse zinsdelen verschijnen wanneer het bijbehorende geluid start. Ze meet de model-laadtijd en de tijd tot het eerste audiostuk. Dat zijn apparaatgebonden metingen.

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

## Mobiel: echte modelproef

`mobile-preview.html` gebruikt de **publiek beschikbare Phonon 40M multilingual**-modelkopie van `ldenoue/phonon-40m-multilingual` op Hugging Face (CC BY-NC 4.0, oorspronkelijke auteur Gradium). De iPhone downloadt de q8-gewichten rechtstreeks en voert de Franse TTS uit met `phonon-tts`. De stemmen Hélène, Lucien en Noémie komen uit de openbare Gradium-voicecatalogus. Tik achtereenvolgens op Model laden en Beluister Frans. Dit is een echte on-device modeltest en **geen telefoon-systeemstem**. Niet de aparte, gated `gradium/phonon-40m-fr` uit de MacBook-podiumapp. De grote download en de iOS-browseruitvoering moeten nog op een echte iPhone worden gecontroleerd. Voor een test van het specifieke Franse checkpoint is ook de officiële Phonon-demo beschikbaar: https://gradium-phonon.static.hf.space/index.html

De mobiele modelproef heeft bewust geen live vertaling: de browser Translator API werkt daar niet. De MacBook-podiumapp blijft ongewijzigd.

## Definitieve teksten en beeldreactie voor de uitreiking

`src/script.mjs` bevat de goedgekeurde teksten voor de middag: Nederlandse opening en afsluiting uitsluitend als spiektekst, de vaste Nederlandse onderbreking en teruggave, en de vaste Franse toespraak. Mevrouw Klatten krijgt een bedankje. Ouders worden niet aangesproken. De rector kan er niet bij zijn. De opening en afsluiting worden niet uit het script geprojecteerd: alleen de echte microfoonherkenning wordt vertaald en als Franse ondertiteling getoond. Tijdens Nederlandse en Franse AI-stemmen blijft het scherm zonder tekst en komen vanuit het midden subtiele lijnen tevoorschijn. Franse audiobuffers sturen de lijnen via een Web Audio Analyser; de Nederlandse browserstem gebruikt spreekgebeurtenissen. Na de onderbreking luistert de app kort naar de reactie en kan de start van de vaste Franse tekst iets opschuiven.
