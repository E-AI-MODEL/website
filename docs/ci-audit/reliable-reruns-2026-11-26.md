# Herstarten zonder opnieuw te bouwen

Uitgangspunt: main `c0cc75069cbe28d57d8f50340c7f4716a3dd7dbd`. GitHub Pages, Theory7, TOPO, Cloudflare, de publicatieautorisatie en de bestaande bron-/uitvoerbestanden blijven ongewijzigd. #411 is gesloten; dit is geen vervolg op die verwijderingsproef.

## Wijzigingen

- De succesvolle producent en diens uploadtijd bepalen het artifact binnen dezelfde run, ook na een gedeeltelijke rerun. De productieselector blijft uitsluitend voor main-publicatie. CI controleert daarnaast run, repository, branch, bron-SHA, checkout-SHA, bronboom, archiefhash en de bestandsinventaris. Een PR heeft een andere checkout-SHA (mergecommit) dan de bron-SHA in de Jobs API. Beide worden afzonderlijk gecontroleerd.
- Screenshots en testbewijs hebben een pogingsnummer. Een herstart schrijft het oudere bewijs niet over.
- De Apple-adaptercompilaties op macOS en Xcode draaien bij geraakte EAIspeak-bronnen en bij een volledige selectie. De audio-/protocol-/beveiligingstest, frontendbouw, browsertest en alle algemene releasecontroles blijven verplicht.
- TOPO, LO Aanvalslab en EAIspeak browser-smoke gebruiken vooraf gebouwde Playwright-images. Node behoudt 1.56.1; de voorheen niet vastgezette Python-binding van LO wordt vastgezet op 1.65.2, de versie in de geslaagde hoofdvalidatie 45801359512, poging 3. Het pakket moet passen bij de geïnstalleerde browsers. Geen apt-installatie van browserbibliotheken in deze jobs. De browserproeven zelf blijven gelijk.
- Overige browserjobs blijven in hun bestaande omgeving. Migratie daarvan is pas zinvol na een geslaagde proef met deze drie. Handmatige herstelpublicaties hebben een afzonderlijk goedkeuringscontract en worden niet gewijzigd.

## Acceptatie

1. Bestaande bron-, numerieke, browser- en integriteitsproeven slagen. De workflow-inventaris en actionlint melden geen nieuwe fouten.
2. Testfixtures accepteren exact de succesvolle eerdere upload in dezelfde run, en weigeren een oude bronboom, gewijzigde inhoud, verkeerde run, verlopen of dubbel artifact, foutieve upload en onveilige archiefpaden.
3. Na een geslaagde CI-proef: herstart één artifact-afhankelijke browserjob terwijl de producent geslaagd blijft. Bewijs uit Jobs API en log moet aantonen dat de oorspronkelijke buildpoging gebruikt is, zonder nieuw websitebuildartifact. Geen geforceerd rood of versoepeling van tests.
4. Controleer in een documentatie-PR of ongewijzigde Apple-compilaties overgeslagen worden; een wijziging in EAIspeak, gedeelde code of onbekende paden selecteert ze wel.
5. Meet installatietijden en volledige jobtijden tegen concrete eerdere runs. Geen tijdwinstclaim vóór de meting.

De afzonderlijke dagelijkse Firefox/Cloudflare-problemen blijven een vervolgvraagstuk. Geen algemene betrouwbaarheidsgarantie op basis van deze beperkte verandering.
