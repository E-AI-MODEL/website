# Uitvoerbestanden uit Git: proef op de huidige hoofdversie

Hoofdversie: 7e97e43b8634f3308e974ccd385973ef50c4e81a. De 20 onderstaande bron-uitvoerparen zijn op deze commit byte-identiek (gelijke Git blob SHA en bestandsmodus). De losse Schuine worp is al definitief uit main verwijderd via #412 en is niet in deze lijst opgenomen. Totale omvang van de kopieën: 2.290.470 bytes; dit is geen voorspelling van bespaarde Git-opslag.

| Uitvoer | Leidende bron |
|---|---|
| `tools/abyss/index.html` | `content/abyss/ABYSS.html` |
| `tools/eaimesh/start/index.html` | `content/eaimesh/start.html` |
| `tools/eaistudio/studio/icons/apple-touch-icon.png` | `content/eaistudio/pwa/icons/apple-touch-icon.png` |
| `tools/eaistudio/studio/icons/icon-192.png` | `content/eaistudio/pwa/icons/icon-192.png` |
| `tools/eaistudio/studio/icons/icon-512.png` | `content/eaistudio/pwa/icons/icon-512.png` |
| `tools/eaistudio/studio/index.html` | `content/eaistudio/studio.html` |
| `tools/eaistudio/studio/manifest.webmanifest` | `content/eaistudio/pwa/manifest.webmanifest` |
| `tools/eaistudio/studio/service-worker.js` | `content/eaistudio/pwa/service-worker.js` |
| `tools/melkweg-lab/index.html` | `content/melkweg-lab/index.html` |
| `tools/science-observatory/labs/gravitatie-banen/index.html` | `content/science-observatory/labs/gravitatie-banen.html` |
| `tools/science-observatory/labs/leeuw/index.html` | `content/science-observatory/labs/leeuw.html` |
| `tools/science-observatory/labs/melkweg/index.html` | `content/science-observatory/labs/melkweg.html` |
| `tools/science-observatory/labs/natuurkunde/index.html` | `content/science-observatory/labs/natuurkunde.html` |
| `tools/science-observatory/labs/wiskunde-a/index.html` | `content/science-observatory/labs/wiskunde-a.html` |
| `tools/science-observatory/labs/wiskunde-b/index.html` | `content/science-observatory/labs/wiskunde-b.html` |
| `tools/wihtml/bibliotheek/kansen-twee-worpen.json` | `content/wihtml/bibliotheek/kansen-twee-worpen.json` |
| `tools/wihtml/bibliotheek/lineaire-verbanden.json` | `content/wihtml/bibliotheek/lineaire-verbanden.json` |
| `tools/wihtml/studio/index.html` | `content/wihtml/studio.html` |
| `tools/wihtml/voorbeeld-lesinhoud.json` | `content/wihtml/voorbeeld-lesinhoud.json` |
| `tools/wihtml/voorbeeld/index.html` | `content/wihtml/verdubbelen-halveren-v9.html` |

De oorspronkelijke [generatorproef](https://github.com/E-AI-MODEL/website/actions/runs/45652888716) controleerde alleen build_site.py voor en na tijdelijke verwijdering: 362 uitvoerbestanden, geen verschillen. Die proef bewees geen volledige release of Pages-publicatie. De latere draft #411 faalde in het register, bronlinkcontrole, Leeuw en EAIspeak-registercontrole.

## Aanpassing in deze draft

- De catalogus onderscheidt een opgeslagen bron van een gegenereerde publieke route. Iedere afwezige uitvoer heeft een concrete bron; onverklaarde ontbrekende bestanden blijven een fout.
- De bronlinkcontrole accepteert uitsluitend expliciet gemapte uitvoer met aanwezige bron. De gebouwde website moet nog steeds alle publieke bestanden en links bevatten.
- Leeuw gebruikt de gecontroleerde site-release uit dezelfde workflow. De bron- en publicatiecontroles blijven bestaan.
- De extra buildtest vergelijkt alle 20 uitvoerbestanden byte voor byte met hun bron na de definitieve sitevoorbereiding.
- ICT-scan, anatomie, TOPO, EAIspeak en bronarchieven blijven buiten de verwijderlijst.

## Blokkade vóór merge

De actieve Pages-build [45700852522](https://github.com/E-AI-MODEL/website/actions/runs/45700852522) gebruikt Jekyll op de Git-repository. Theory7 gebruikt het gevalideerde site-release artifact; TOPO heeft een eigen gevalideerd artifact. Een nieuw groen CI-resultaat is onvoldoende om de 20 kopieën uit main te verwijderen. Pages moet eerst van branch/Jekyll naar een gecontroleerde GitHub Actions-publicatie worden omgezet of door de eigenaar expliciet worden beëindigd. De huidige Pages-configuratie is niet via de beschikbare GitHub-connector wijzigbaar.

Voorkeursvolgorde:
1. Bouw niets opnieuw tijdens publicatie. Hergebruik het succesvolle main-validation artifact met gecontroleerde run, poging, commit, boom en SHA-256-inventaris. Voor Pages moet de afzonderlijk gevalideerde TOPO-package worden samengevoegd zonder overlappende paden; PHP/hostheaders en Cloudflare/FTPS-functies worden op Pages niet uitgevoerd. Publiceer nooit private bronbestanden of geheime gegevens.
2. Laat de eigenaar Pages naar GitHub Actions omschakelen. Controleer de domeinconfiguratie en publiceer eerst met de huidige kopieën nog aanwezig. Controleer de 20 bestemmingen en relevante PWA-bestanden, deep links, zoekindex en afzonderlijke TOPO-route.
3. Pas daarna #411 merge na volledige groene controles en bevestigde artifact-publicatie op Pages. Geen globale serververwijdering, geen overschrijving van main vanuit een build.

Deze PR is een proef; geen nieuwe Pages-instellingen, domeinwijzigingen of productiepublicatie zijn hier geautoriseerd.
