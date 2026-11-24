# Visuele samenhang publieke website

De homepage is het voorbeeld voor de gewone publieke pagina's.

## Vaste ontwerpafspraken

- De hoofdnavigatie, paginabreedte, kophiërarchie en voetregel blijven herkenbaar bij doorklikken.
- Hoofdpagina's gebruiken een heldere tweekoloms-introductie met een inhoudelijke aanvulling waar die helpt.
- Onderwerpen en toepassingen staan in open rasters. Geen carrousel die andere keuzes onzichtbaar maakt.
- Kaarten hebben een inhoudelijke illustratie en gebruiken hetzelfde rustige wit, groen en ruime zetwerk als de homepage.
- Op een telefoon worden de kaarten onder elkaar getoond, zonder horizontale scroll.
- Het menu wordt compacter voordat de beschikbare schermbreedte krap wordt.
- Teksten, links, URL's, ankers en de bronregistraties blijven leidend. De stijllaag herschrijft de inhoud niet.

## Technische uitvoering

De routes staan in `scripts/home_continuity.py` (`HUBS` en `ARTICLES`).
`prepare_ui.py` voegt alleen binnen deze routes de visuele HTML toe. De gedeelde
CSS en het kleine navigatiescript blijven `assets/site-story-cards.css` en
`assets/site-story-cards.js`. De bestanden zijn lokaal, versiegebonden en
worden met een hash gepubliceerd.

De acht vakgebieden op `/nl/tools/` en `/en/tools/` hebben elk een
eigen SVG-illustratie in de bron. De bestaande inhoud en gebruikerskeuzes
blijven behouden.

## Uitzonderingen

De homepage, het EAI-model, de 3D-omgevingen, individuele labs, monitors,
interne schermen, beveiligde pagina's en de zelfstandige tools zijn geen
gewone redactionele pagina's. De brede site-CSS mag niet onbedoeld ingrijpen
in hun eigen bediening.

## Controle bij iedere wijziging

De Python-test `tests/test_story_cards.py` en de browsertest
`scripts/test_story_cards_browser.mjs` controleren de routekeuze,
zichtbare kaarten, acht unieke vakillustraties, desktop/mobile en
het behoud van de pagina zonder JavaScript. De volledige
`Verify public UI`-workflow controleert ook de overige toepassingen.
