# EAIspeak: lessen uit Project PiM

Bron: [Project PiM](https://github.com/E-AI-MODEL/project-pim), standaardbranch `main`; relevante bestanden zijn `README.md`, `src/lib/pim/modelCatalog.ts`, `src/lib/pim/nerSlm.ts`, `src/lib/pim/rewriteLlm.ts` en `src/lib/pim/clearStorage.ts`.

## Wat PiM daadwerkelijk doet

- Haalt publieke NER-modelbestanden van Hugging Face op en draait inferentie met `@huggingface/transformers` in de browser.
- Probeert WebGPU, met WASM als alternatief voor de ondersteunde NER-route.
- Heeft een catalogus met model-ID, vaste revisie, configuratie- en tokenizerhashes, uitvoerapparaat, release-status en gebruiksbeperkingen.
- Geeft zichtbare status voor laden, initialiseren, modelcontrole, test en fout.
- Beheert gedownloade modellen via de browsercache en laat cache wissen, met uitleg dat daarna opnieuw een download nodig is.
- Bevat een kleine Qwen-generator via `@mlc-ai/web-llm`, maar deze is design-only. Het model is niet vastgepind zoals de NER-modellen en is niet vrijgegeven voor productie-uitvoer.

Dat is **geen bewijs** dat PiM al een vrije meertalige stemconversatie ondersteunt.

## Overnemen voor EAIspeak

1. Eén centrale modelcatalogus met taken: spraak-naar-tekst, vertaling, vrije chat, tekst-naar-spraak. Leg per model vast: model-ID, bron, versie/revisie, omvang, licentie, benodigde hardware, WebGPU/WASM en geteste browsers.
2. Lazy loading: laad een model pas als de bezoeker die functie kiest. Laat downloadvoortgang en modelstatus zien. Laad de gratis externe route niet mee wanneer de gebruiker alleen een bestaande MP3-voorstelling start.
3. Gebruik een vaste versie en modelcontrole wanneer modellen van Hugging Face worden geladen. Een label 'offline' verschijnt pas na aangetoonde lokale inferentie, niet alleen omdat de code `transformers` importeert.
4. Houd modeluitvoer gescheiden van audiosynthese. Een werkende LLM-tekstreactie is nog geen werkend gesproken gesprek.
5. Fallback is per taak zichtbaar: WebGPU → ondersteunde WASM-variant, lokaal → cloud alleen na expliciete keuze, audio → opgenomen bestand voor de vaste voorstelling.
6. Geef bezoekers een knop om een gedownload model uit de cache te verwijderen, zonder gespreksinstellingen of de opnamen onbedoeld mee te wissen.
7. Test Nederlands, Engels en Frans afzonderlijk op echte apparaten, inclusief Safari en Chrome. Niet alle LLM's hebben even goede ondersteuning voor alle drie.

## Huidige status

- De DELF-uitreiking blijft beschikbaar in de EAIspeak-app, met twee vaste Franse MP3's.
- De bestaande NL→FR-ondertiteling blijft ongewijzigd.
- Vrij praten gebruikt momenteel de externe Puter-route. Dat is geen in-browser LLM en het gesprek is nog niet end-to-end gevalideerd.
- Een browser-LLM via WebLLM/Transformers.js is een volgende afzonderlijke implementatie, niet al functioneel door dit document.
- Vrij praten ondersteunt de zes combinaties van Nederlands, Engels en Frans als gespreksinstelling; alle zes live-ondertitelingsroutes zijn nog niet gebouwd. Opnames en de gescripte DELF-voorstelling blijven onafhankelijk.

## Adres

Nieuwe primaire proef-URL: `https://eaimodel.nl/tools/eaispeak/`.
Bestaande DELF-link `https://eaimodel.nl/tools/delf-live/` blijft voorlopig bereikbaar zodat reeds gedeelde links niet breken. Beide wijzen bij deze overgang naar dezelfde build; er is geen server-side redirect nodig. De fysieke bronmap blijft eerst `tools/delf-live` om CI en bestandsafhankelijkheden niet onnodig te breken. Een interne maphernoeming is geen voorwaarde om de publieke URL te wijzigen.

## EAIspeak uitbreidingsstatus (20 november 2026)

- Twee routes voor vrije gesprekken: Puter online en WebLLM lokaal in de browser. Geen terminal nodig voor de browserroute.
- Vier browsermodellen: Qwen2.5 0,5B, Qwen2.5 1,5B, Qwen2.5 3B en Llama 3.2 1B. De catalogus staat in `src/browser-llm.js`. Download en geheugenbehoefte kunnen groot zijn.
- Voor vrij praten kan de gebruiker Nederlands, Engels en Frans onafhankelijk instellen voor invoer en antwoord. De zes taalparen zijn **niet** automatisch ook zes werkende live-ondertitelingsroutes.
- Bij een lokaal model kiest de app standaard de lokale browserstem, zodat geen Puter-aanmelding nodig is. De stemkwaliteit hangt af van de beschikbare systeemstemmen.
- Modellen worden pas geladen na een expliciete gebruikshandeling. WebGPU-ondersteuning wordt gecontroleerd, het laden toont voortgang en er is geen verzwegen cloudfallback.
- De instellingen voor vrij praten staan onder een licht zwevend menu met de actuele taalroute, niet permanent in een lange lijst.
- Automatische tests en bundeling zijn geslaagd. Een werkelijk vrij gesproken gesprek met een lokaal model in Safari of Chrome moet nog op het doelapparaat worden vastgesteld.

De primaire URL is `/tools/eaispeak/`; de oude `/tools/delf-live/` blijft tijdelijk beschikbaar.
