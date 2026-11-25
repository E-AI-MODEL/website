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
2. Lazy loading: laad een model pas als de bezoeker die functie kiest. Laat downloadvoortgang en modelstatus zien. Laad geen externe route mee wanneer de gebruiker een lokale functie kiest.
3. Gebruik een vaste versie en modelcontrole wanneer modellen van Hugging Face worden geladen. Een label 'offline' verschijnt pas na aangetoonde lokale inferentie, niet alleen omdat de code `transformers` importeert.
4. Houd modeluitvoer gescheiden van audiosynthese. Een werkende LLM-tekstreactie is nog geen werkend gesproken gesprek.
5. Fallback is per taak zichtbaar: WebGPU → ondersteunde WASM-variant, lokaal → cloud alleen na expliciete keuze.
6. Geef bezoekers een knop om een gedownload model uit de cache te verwijderen, zonder gespreksinstellingen  onbedoeld mee te wissen.
7. Test Nederlands, Engels en Frans afzonderlijk op echte apparaten, inclusief Safari en Chrome. Niet alle LLM's hebben even goede ondersteuning voor alle drie.

## Huidige opzet
EAIspeak gebruikt afzonderlijke routes voor live transcriptie, vertaling, vrije gesprekken en stemuitvoer. Zie README.md en docs/local-transcription.md voor de feitelijke huidige mogelijkheden. De bronmap is tools/eaispeak en de vroegere URL is een redirect. Oudere proeven staan in de Git-geschiedenis.
