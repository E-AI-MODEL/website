# Materialen en techniek: gericht verzamelen
**Versie 0.1 | Zoekprofielen, geen al gedownloade of goedgekeurde assets**

Een grote map vol willekeurige 3D-bestanden is niet nuttig. We verzamelen **geschikte kandidaten**, testen ze in dezelfde scène en bewaren herkomst, licenties, technische gegevens en reden van selectie. De definitieve modellen gaan pas na beoordeling naar de website. Bij een beperkt modelbudget kiezen we samenhang boven hoeveelheid.

## Wat zoeken we per wereld?

| Wereld | 3D-onderdelen | Interactie | Belangrijkst |
|---|---|---|---|
| Getijtuinen (Natuur) | Riet, terrassen, kweekbakken, kanalen, peilstokken, dieren op afstand | Schuif, peilmeter, waterstroom | Waarneembaar, reageert op instellingen |
| Haven van Vier (Wereld) | Oude havenhuizen, pont, lading, touwen, toegankelijke paden, bewoners | Routes vergelijken, gesprekken, keuzes met gevolgen | Een echte bewoonde plek, niet alleen decor |
| Echoarchief (Taal) | Archiefkamers, boekenkasten, historische kaarten, instrumenten, glas | Bronnen vergelijken, details onderzoeken | Tekst moet leesbaar zijn en inhoudelijk kloppen |
| Tandradkliffen (Rekenen) | Waterrad, lier, tandwielen, ketting, gewichten, verplaatsbare brug | Berekening, voorspelling, proef en beweging | Echt manipuleerbare onderdelen |
| Verbindingen | Steenwegen, beek, houten brug, helling, pier, bomen | Vrij bewegen, camera, route openen | Eén doorlopend schaalbaar landschap |

## Kandidaten om te onderzoeken
Deze links zijn **startpunten**, geen gekeurde sets. Licentievoorwaarden, bestandsafmetingen, stijlmatch en betrouwbaarheid zijn per pakket en versie te controleren voordat assets worden opgenomen.

- [Kenney](https://kenney.nl/assets): natuurlijke objecten en bouwvormen.
- [KayKit](https://kaylousberg.itch.io/): stylized personages, omgevingen en animaties.
- [Poly Haven](https://polyhaven.com/): materialen, omgevingstexturen en belichting, al dan niet passend te styliseren.
- [Quaternius](https://quaternius.com/): 3D-omgeving en rekwisieten. **Let op de precieze licentie per pakket en datum**; algemene oude claims over CC0 mogen niet automatisch voor alle bestanden gelden.
- [Three.js](https://threejs.org/): renderer, animatie, raycasting, belichting en modelimport.
- [glTF](https://www.khronos.org/gltf/): uitwisselformaat voor 3D-scènes; bij voorkeur geoptimaliseerde `.glb`-bestanden voor distributie.
- [glTF Transform](https://gltf-transform.dev/): inspectie en optimalisatie van glTF, onder controle van beeldkwaliteit.

## Elke kandidaat krijgt één regel in het register

```json
{
  "id": "voorbeeld-waterwheel-001",
  "sourcePage": "https://voorbeeld.invalid/item",
  "assetVersion": "te-vullen",
  "author": "te-vullen",
  "license": "niet-gecontroleerd",
  "licenseProof": null,
  "attributionRequired": null,
  "files": [],
  "originalSizeBytes": null,
  "optimizedSizeBytes": null,
  "triangles": null,
  "materials": null,
  "animations": [],
  "mobileTest": "niet-getest",
  "styleMatch": "niet-beoordeeld",
  "decision": "kandidaat",
  "notes": "Niet overnemen zonder controle"
}
```

Het dummyadres hierboven is geen echte asset. Werkelijke downloads moeten de bron en licentie behouden. Geen ongecontroleerde kopie van een commerciële game, onduidelijk Sketchfab-model of AI-reconstructie van andermans werk.

## Zelf maken versus aanpassen
- **Uit bestaande modellen:** landschap, begroeiing, veel architectuur, meubels en basisfiguren. Bepaal eerst of de stijl en licentie passen.
- **Bestaande modellen ombouwen:** brug, waterrad, sluis en kleine machines; deze hebben draaipunten, botsingen en maatvoeringen nodig.
- **Zelf bouwen:** onderwijskundige opdrachtlogica, kaart en camerabediening, speltoestand, reacties van personages en toegankelijke UI.
- **Zelf modelleren bij uitzondering:** een uniek herkenningspunt of mechanisme waarvoor geen passend model beschikbaar is. Geen handmatige 3D-productie van het complete eiland als startvoorwaarde.

## Technische selectie
- De bestaande EAIgame gebruikt Three.js. Eerst binnen deze renderer onderzoeken of hoogwaardige GLB-modellen, goed licht en materialen voldoende zijn.
- Begin met één watermolen, één brug, twee verschillende stukjes landschap en één spelerfiguur; meet de werkelijke bestands- en renderkosten.
- Gebruik niveau van detail, herhaalde geometrie en gepaste textuurresoluties wanneer dat merkbaar helpt.
- Mobiel krijgt dezelfde spelinhoud en wereldtoestand, maar mag minder schaduwen, weersdeeltjes en verre details tonen.
- Vereis een lage-detaillaag of 2D-alternatief vóór nieuwe 3D als voorwaarde voor spelen. WebGL is een presentatieoptie, geen opslagmedium.
- Test met vaste screenshots en spelhandelingen: een mooi renderbeeld bewijst nog geen werkende brug.

## Grenzen van het huidige werk
De oorspronkelijke Sites-SVG en de geïsoleerde 3D-proef uit PR #277 kunnen helpen als visuele referentie en regressiecontrole, maar zijn geen complete 3D-assets voor een vrij verkenbaar eiland. De twee eerder gemaakte sfeerbeelden zijn conceptkunst. Er zijn in deze ontwerpmap **nog geen nieuwe modellen geselecteerd, gedownload of getest**.

## Voor iedere import
- Bron, maker, pakketversie, directe downloadlocatie en licentiebewijs gecontroleerd.
- Geen botsende stijl, onbedoelde scripts, extreem grote bestanden of onnodige texture-atlassen.
- Correcte schaal, oorsprong, draaipunten en animatie.
- Screenshots bij identieke camera: desktop, mobiel, belichting en de interactieve proef.
- Pas na review wordt de geoptimaliseerde kopie onderdeel van `website`.

## Waar hoort wat?
Deze ontwerpmap staat op een losse tak van `E-AI-MODEL/website`. Een eventuele latere `eaigame-lab`-repository voor grote prototypes en bronassets is nog **niet** aangemaakt. De website-repository blijft voorlopig de vindplaats van ontwerpbesluiten. Geen automatische publicatie vanuit de verzamelmap.
