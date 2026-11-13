# EAI LLMscan als zelfstandige website

Deze map bevat de oorspronkelijke openbare EAI LLMscan zonder iframe en zonder afhankelijkheid van de Sites-editor.

## Inhoud
- `catalogue.js`: kopie van alle 51 bestaande product- en modeldossiers, zoals gepubliceerd op 13 november 2026. Bewaar deze inhoud bij updates; herschrijf niet onbedoeld de beoordelingen.
- `app.js`: bestaande filters, dossiers, tabbladen en vergelijking.
- `site.css`: bestaande vormgeving.
- `onderzoek/index.html` en `updates.js`: apart overzicht van beoordeelde onderzoeken en aanvullende toolfuncties.
- `scripts/llmscan_assets.py`: eenmalige kopie van de beeldbestanden vanaf de oude Sites-host. Laat deze stap slagen vóór het afsluiten van de oude host.

## Publiceren
De GitHub-website bouwt bronnen uit `nl/` naar `site-build/nl/`. De bestaande URL is `https://eaimodel.nl/nl/llmscan/`. De nieuwe route `/nl/llmscan/onderzoek/` wordt eveneens door de build meegenomen.

De definitieve omschakeling naar een eigen subdomein `llmscan.eaimodel.nl` vraagt nog een controle van DNS en hostinginstellingen. Doe dat pas nadat de bestaande route functioneel is getest. Verwijder de oude @Sites-versie niet voor die controle.

## Dagelijkse scan
De geplande GitHub Action `llmscan-daily-discovery.yml` zoekt bij Crossref en arXiv naar nieuwe publicaties en opent een PR met kandidaten. Nieuwe bronnen worden **niet automatisch als bewezen leereffect gepubliceerd**. Beoordeel bron, vergelijking, meetmoment en conclusie, vergelijk DOI/arXiv-identiteit met bestaande dossiers en voeg dan unieke resultaten toe aan `updates.js`.

De ChatGPT-taak `EAI LLMscan · Onderzoek & toolscan` zoekt ook naar nieuwe onderwijstools en bronwijzigingen. Deze taak heeft een instructie om wijzigingen via GitHub voor te stellen; een daadwerkelijke push is pas bevestigd na een opgeslagen commit of PR.

## Vereiste controles vóór merge
1. JavaScript-syntax en regressietests uit `tests/test_llmscan_standalone.py`.
2. Alle beeldbestanden lokaal, geen externe afbeeldingsafhankelijkheden met de oude Sites-host.
3. Desktop en mobiel: filters, zoekveld, dossiernavigatie, vergelijken, bronverwijzingen, onderzoeks- en tooloverzicht.
4. De gebouwde website op testadres, zonder foutmeldingen in de browser.
5. Volledige historische dossiers en correcte datums en bronlinks.

De huidige PR is een concept zolang deze controles openstaan.
