# Gegenereerde toolbestanden uit Git

Deze proefbranch verwijdert 21 identieke kopieën, samen 2.327.904 bytes,
en bewaart alle canonieke contentbestanden. De eerdere
[generatorproef](https://github.com/E-AI-MODEL/website/actions/runs/45647220425)
gaf vóór en na tijdelijke verwijdering 415 bestanden zonder verschil.
Deze PR voert de volledige centrale testreeks uit met de kopieën afwezig.
De bron- en outputlijst staat in catalog/generated-tool-sources.json.

| Bron | Kopie die op de proefbranch verdwijnt |
|---|---|
| `content/abyss/ABYSS.html` | `tools/abyss/index.html` |
| `content/eaimesh/start.html` | `tools/eaimesh/start/index.html` |
| `content/eaistudio/pwa/icons/apple-touch-icon.png` | `tools/eaistudio/studio/icons/apple-touch-icon.png` |
| `content/eaistudio/pwa/icons/icon-192.png` | `tools/eaistudio/studio/icons/icon-192.png` |
| `content/eaistudio/pwa/icons/icon-512.png` | `tools/eaistudio/studio/icons/icon-512.png` |
| `content/eaistudio/studio.html` | `tools/eaistudio/studio/index.html` |
| `content/eaistudio/pwa/manifest.webmanifest` | `tools/eaistudio/studio/manifest.webmanifest` |
| `content/eaistudio/pwa/service-worker.js` | `tools/eaistudio/studio/service-worker.js` |
| `content/melkweg-lab/index.html` | `tools/melkweg-lab/index.html` |
| `content/science-observatory/labs/gravitatie-banen.html` | `tools/science-observatory/labs/gravitatie-banen/index.html` |
| `content/science-observatory/labs/leeuw.html` | `tools/science-observatory/labs/leeuw/index.html` |
| `content/science-observatory/labs/melkweg.html` | `tools/science-observatory/labs/melkweg/index.html` |
| `content/science-observatory/labs/natuurkunde.html` | `tools/science-observatory/labs/natuurkunde/index.html` |
| `content/science-observatory/labs/schuine-worp.html` | `tools/science-observatory/labs/schuine-worp/index.html` |
| `content/science-observatory/labs/wiskunde-a.html` | `tools/science-observatory/labs/wiskunde-a/index.html` |
| `content/science-observatory/labs/wiskunde-b.html` | `tools/science-observatory/labs/wiskunde-b/index.html` |
| `content/wihtml/bibliotheek/kansen-twee-worpen.json` | `tools/wihtml/bibliotheek/kansen-twee-worpen.json` |
| `content/wihtml/bibliotheek/lineaire-verbanden.json` | `tools/wihtml/bibliotheek/lineaire-verbanden.json` |
| `content/wihtml/studio.html` | `tools/wihtml/studio/index.html` |
| `content/wihtml/voorbeeld-lesinhoud.json` | `tools/wihtml/voorbeeld-lesinhoud.json` |
| `content/wihtml/verdubbelen-halveren-v9.html` | `tools/wihtml/voorbeeld/index.html` |

## Voorwaarden voor merge

- Volledige CI groen met de verwijderde kopieën.
- Nieuwe regressietest bevestigt dat de publicatieroutes nog bestaan en de
  statische PWA/JSON-assets byte-identiek worden opgebouwd.
- GitHub Pages publiceert nu nog via de root/Jekyll en heeft CNAME eaimodel.nl.
  Bevestig de actieve Pages-configuratie en vervang de rootpublicatie
  door een gecontroleerde artifact-route (of beëindig de tweede publicatie
  met expliciete toestemming) voordat deze PR naar main mag.
- Geen verwijderingen uit ICT-scan, anatomie, TOPO, historische bronarchieven
  of bestanden die niet in de gecontroleerde lijst staan.
- Geen wijziging van bestaande URLs, geen geschiedenis herschrijven,
  geen automatische publicatie vanaf de proefbranch.

De anatomiemap wordt pas in een volgende proef behandeld. De gebouwde
hartmeshes blijven onderdeel van de gepubliceerde toepassing.
