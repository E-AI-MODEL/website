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
- `heart.js`: weergave van brongeometrie, bewegende doorsnede, selecties, stroomdeeltjes, camera en grafieken
- `scripts/extract_hart_atlas.mjs`: eerdere Z-Anatomy-export als terugval
- `scripts/extract_hart_rich.mjs`: gecontroleerde import van 34 BodyParts3D 4.0-structuren, met vastgezette broncommit en SHA-256

Bij het draaien van het 3D-hart werken muis en aanraakscherm met dezelfde camerabediening. Eén vinger of de linkermuisknop draait. Met twee vingers kun je inzoomen en het model verschuiven; op een computer werkt verschuiven met Shift-slepen en zoomen met het muiswiel. **Startaanzicht** herstelt ook een eerdere verschuiving.

De elf stroomroutes volgen de middenlijnen van de grote vaten uit dezelfde vastgezette BodyParts3D-bron als het 3D-hart. In de kamers lopen ze via de van de brongeometrie afgeleide binnenpunten en klepcentra. De herkomst en coördinatenomzetting staan bij de code. Dit voorkomt dat getekende bloedbanen onnodig dwars door de zichtbare vaat- en hartvormen lopen. De oude felle stippellijnen zijn vervangen door rustige, doorlopende, halfdoorzichtige rode en blauwe stroombanen met een langgerekte bewegende kleurpuls. Hun onderlinge beweging volgt de hartcyclus: de zes toevoerroutes blijven bewegen, de twee routes door de AV-kleppen en drie uitgaande slagaderroutes bewegen uitsluitend bij geopende kleppen. De stroombanen verschuiven en draaien mee met dezelfde 3D-camera; het 3D-weefsel blijft op het bronmodel gebaseerd. Een beperkt aantal kleine 3D-stroompunten houdt ruimtelijke diepte herkenbaar, zonder de kleppen te overstemmen. Rood en blauw zijn schoolkleuren voor zuurstofrijk en zuurstofarm bloed, niet de werkelijke bloedkleur. De getekende banen en bewegingspulsen zijn didactische richtingaanduidingen, geen echte bloedcellen, vaatdebiet of gemeten stromingsveld. Via **Lagen** kan de stroomweergave uit.

De leerling kan drie samenhangende weergaven gebruiken:

- **Echte anatomische buitenkant:** 34 afzonderlijk benoemde structuren uit BodyParts3D 4.0, via een reproduceerbaar open hartmodel. De twee boezemwanden en gezamenlijke kamerwand, de vier bloedruimten, kleppen, papillairspieren, grote vaten, kransslagaders en hartaders zijn echte geometrische bronvormen. De 142 oorspronkelijke atlasdelen zijn hiervoor gegroepeerd. De aanwezige schaduw- en weefselgegevens worden in de lichte WebGL-renderer gebruikt. De browser laadt een lokaal exportbestand; de originele auteur en CC BY 4.0-voorwaarden staan in [MODEL_SOURCE.md](MODEL_SOURCE.md).
- **Echte anatomische binnenkant:** de voorste delen van de hartspierwand zijn weggehaald uit het zicht, zodat de werkelijke klepstructuren en spierwanden kunnen worden bestudeerd. Dit is een virtuele doorsnede, geen gemeten medische snede.
- **Klepbeweging onderzoeken:** dezelfde rijke BodyParts3D-mesh blijft zichtbaar. De vier anatomische klepmeshes krijgen een beperkte, fasegestuurde vervorming. Die laat de volgorde van openen en sluiten zien, maar is geen gevalideerde biomechanische beweging. De pompbeweging, druk, volume en stromingspunten volgen dezelfde vijf hartfasen. De stromingspunten volgen routes tussen de middens van de betreffende anatomische structuren. Ze tonen alleen de richting en geen exacte bloedstroom.

De bestaande buitenkant van Z-Anatomy/BodyParts3D blijft als terugvalbestand aanwezig. De oorspronkelijke schematische klepanimatie wordt alleen getoond als het uitgebreide anatomische model niet beschikbaar is. De terugvalbron wordt niet hergebruikt onder de CC BY 4.0-voorwaarden van het nieuwe model; de eigen upstreamlicentie en bronvermelding blijven gelden.

Het 3D-hart heeft een compacte knop **Lagen**. De **Buitenlaag** toont de volledige orgaanvorm met dezelfde drie BodyParts3D-wandmeshes. In het binnenaanzicht is die laag halfdoorzichtig, zodat de kleppen, hartkamers en bloedstroom zichtbaar blijven. Via **Bekijk buitenkant** zie je dezelfde wand ondoorzichtig. De aparte optie **Hartwand in doorsnede** blijft de opengewerkte hartwand aan- en uitzetten. Zo kan een leerling de buitenkant vergelijken met de binnenkant zonder van 3D-model te wisselen. Hartkleppen, grote bloedvaten, kransvaten en papillairspieren zijn eveneens afzonderlijk te tonen of te verbergen. De getoonde onderdelen blijven de oorspronkelijke BodyParts3D-meshes; verbergen maakt een onderdeel ook niet-selecteerbaar. Onder **Doorkijk bloedvaten** wordt de camera-gerichte helft van de bestaande bronoppervlakken van de grote aders en slagaders tijdelijk niet getekend. Zo zie je de achterwand van de vaten en blijven de al bestaande geprojecteerde stromingsroutes herkenbaar. De opening beweegt mee met de kijkrichting. Dit is een educatieve kijkopening, geen scan, echte snede door een vaatwand of gevalideerd stromingsmodel. De kransvaten blijven als dunne, gesloten bronstructuren herkenbaar. De functie staat standaard uit en verschijnt als één extra keuze binnen **Lagen**, zonder extra knop op het hoofdscherm. Stroomrichting en namen staan in hetzelfde menu, met een knop om de standaardweergave te herstellen. De hartslag loopt gewoon door tijdens het wisselen van lagen.

Op mobiel staan namen standaard uit. De stroomrichting is een optionele indicator over de anatomie; aangezette namen krijgen dunne aanwijslijnen. **Druk en volume** staat als compacte meetregel onder de animatie, met een uitklapbare grafiek. Instellingen, opdrachten, uitleg, bronnen en grotere grafieken zitten samen onder **Onderzoek en instellingen**. Daardoor blijft het eerste scherm gericht op het bewegende hart en de actuele fase. De anatomische onderdelen zijn aanwijsbaar en selecteerbaar. Alle drie de weergaven delen de tijdlijn, hartfrequentie en grafieken. De beperkte uitzetting van de bronmesh is een onderwijseffect en **geen anatomisch gevalideerde hartcontractie**.

## Leren met de animatie

De eerste weergave laat het anatomische hart doorlopend kloppen, met een vaste uitleg die niet elke fractie van een seconde verspringt. De leerling kan de bloedstroom volgen zonder voortdurend nieuwe tekst te hoeven lezen. De start-/pauzeknop en de tijdschuif staan onder de uitleg.

Met **Bekijk stap voor stap** bekijkt de leerling de vijf hartfasen in eigen tempo. De simulatie stopt op een passend tijdstip per fase; de betrokken structuren worden uitgelicht en één korte uitleg verschijnt onder het model. Met **Vorige** en **Volgende stap** bepaalt de leerling wanneer het beeld verandert. De hartkleppen en meetwaarden gebruiken nog steeds dezelfde vereenvoudigde faseberekening. **Terug naar hartslag** hervat de doorlopende weergave.

**Zelf onderzoeken** zet de beweging stil zodat leerlingen het model kunnen draaien, onderdelen aanraken en de knop **Lagen** gebruiken. Onder **Onderzoek en instellingen** blijven de onderzoeksvraag, bronnen, uitgebreide grafieken en de overige bediening beschikbaar. Dit is een interfacekeuze voor begrijpelijkheid, geen claim dat leerwinst met leerlingen is aangetoond.

## Fysiologie

Een fysiologische cyclus duurt in het voorbeeld 0,80 s (75 slagen/min). Voor het bekijken speelt de website standaard op 0,25× snelheid, zodat een volledige slag 3,2 seconden op het scherm duurt. Het kleponderzoek toont het relevante deel nog langzamer. De vijf fasen zijn: vulling, boezemsamentrekking, isovolumetrische contractie, uitpompen en isovolumetrische relaxatie. De AV-kleppen zijn open tijdens de vulling; de slagaderkleppen tijdens het uitpompen. Tussen beide liggen korte fasen waarin alle kleppen dicht zijn. Bij de isovolumetrische fasen is het kamervolume constant.

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

Een biomechanisch gevalideerde hartcontractie, patiëntspecifieke data, geavanceerde druk-volume-relaties, zuurstofuitwisseling in de longcapillairen, inspanningsfysiologie en ziektebeelden. Dit zijn vervolgonderwerpen, geen functies die deze versie claimt.

**Onderwijsgebruik:** havo 4/vwo 5, bekijken, voorspellen, afspelen, vergelijken en verklaren. Geen medisch advies.
