# Hartslaglab

**Website:** `/tools/anatomie/labs/hartslag/`  
**Hoofdroute:** `/tools/anatomie/`

Het Hartslaglab hoort bij het Anatomisch Observatorium. Het is een aparte onderzoeksruimte voor **de werking van één hartslag**, naast de 3D-atlas waarin leerlingen de ligging van structuren bekijken. De atlas blijft bereikbaar via de vaste teruglink. Het menu Observatoria, de atlasheader en de Tools-pagina verwijzen naar deze module.

## Bronnen en publicatie

Bewerk de bestanden onder `content/anatomie/labs/hartslag/`. `scripts/build_anatomie.py` kopieert ze naar `site-build/tools/anatomie/labs/hartslag/`. Aanpassingen rechtstreeks in de gegenereerde `tools/anatomie/`-map gaan verloren.

- `index.html`: bediening, teksten, onderzoeken en bronverwijzingen
- `heart.css`: vormgeving en responsief gedrag
- `cycle.js`: de enige berekening voor de vijf fasen, de druk, het volume en de klepstanden; de klepbladen hebben tussenliggende standen
- `anatomyGeometry.js`: opengewerkte kamers met spierwand, inwendige holtes, harttussenschot, klepbladen en vertakte bloedvaten
- `heart.js`: interactieve WebGL-geometrie, klepbladen, stroomdeeltjes, camera en grafieken

Er wordt **geen externe 3D-engine** geladen. Het hart is een zelfgetekend, beweegbaar en vervormbaar WebGL-model. Het is **niet** het stilstaande anatomische GLB-hart uit de atlas. In de tweede versie kun je van een buitenaanzicht naar een doorsnede schakelen. De kamerwanden hebben echte 3D-dikte; de linkerkamerwand is dikker dan de rechter. Je ziet het tussenschot, de uitgewerkte atrioventriculaire kleppen en de kleppen bij de grote slagaders. De mitralisklep heeft twee klepbladen, de tricuspidalisklep en beide slagaderkleppen hebben er drie. De chordae tendineae worden schematisch weergegeven, alleen bij de AV-kleppen. **Dit blijft een onderwijsmodel**, niet een medisch gevalideerde scan of een biomechanisch rigged hart.

## Fysiologie

Een cyclus duurt in het voorbeeld 0,80 s (75 slagen/min). De vijf fasen zijn: vulling, boezemsamentrekking, isovolumetrische contractie, uitpompen en isovolumetrische relaxatie. De AV-kleppen zijn open tijdens de vulling; de slagaderkleppen tijdens het uitpompen. Tussen beide liggen korte fasen waarin alle kleppen dicht zijn. Bij de isovolumetrische fasen is het kamervolume constant.

De linkerhartkamer vult in dit vereenvoudigde voorbeeld van 60 naar 130 ml. Het slagvolume is daarmee 70 ml. De drukcurve is een onderwijsvoorbeeld, niet van een proefpersoon gemeten. Stromende punten tonen de **richting** van de bloedstroom. Het zijn geen individuele bloedcellen. Het aantal punten representeert geen exacte volumestroom. De tijdlijn bepaalt zowel de 3D-beweging als de grafieken en klepstanden.

Bronnen: [OpenStax, bouw van het hart](https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy), [OpenStax, hartcyclus](https://openstax.org/books/anatomy-and-physiology-2e/pages/19-3-cardiac-cycle).

## Testen

```sh
node scripts/test_hartslaglab_cycle.mjs
node scripts/test_hartslaglab_geometry.mjs
python scripts/build_anatomie.py --out site-build/tools/anatomie
python -m unittest discover -s tests -p 'test_anatomie_publish.py' -v
node scripts/test_hartslaglab_browser.mjs site-build chromium
node scripts/test_hartslaglab_browser.mjs site-build webkit
```

De echte bouw van de 3D-atlas gebruikt een vastgezette Z-Anatomy-bron en vereist GitHub of een lokale kopie van die bron, evenals Node en npm. De automatische GitHub-workflows bouwen en controleren ook het Hartslaglab.

## Nog niet in deze versie

Een realistisch vervormend, anatomisch rigged hart, patiëntspecifieke data, geavanceerde druk-volume-relaties, zuurstofuitwisseling in de longcapillairen, inspanningsfysiologie en ziektebeelden. Dit zijn vervolgonderwerpen, geen functies die deze versie claimt.

**Onderwijsgebruik:** havo 4/vwo 5, bekijken, voorspellen, afspelen, vergelijken en verklaren. Geen medisch advies.
