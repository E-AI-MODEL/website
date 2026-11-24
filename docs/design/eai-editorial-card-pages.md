# EAI: rustige tekstpagina's met kaartnavigatie

## Referenties en reikwijdte

- Ontwerpreferentie: [Upstream, Ramotion, Dribbble](https://dribbble.com/shots/26544442--Case-Study-SaaS-UI-UX-Design-for-Upstream). Geïnspecteerd: de aangeleverde schermbeelden tonen een smalle zijbalk, een rustige bovenbalk, één goed zichtbaar paneel, kleine statusaccenten, compacte kaarten en terughoudende kleurverlopen. De exacte maten van die aangeleverde beelden zijn geen gemeten CSS-waarden.
- Doelsite: [EAImodel.nl](https://eaimodel.nl/nl/onderzoek/), geraadpleegd op 15 november 2026. De bestaande basis in `assets/site-redesign.css` gebruikt onder meer `#f8f9f6` (papier), `#315d4f` (groen), `#1e322a` (tekst), Inter en een smalle, doorzichtige navigatiebalk.
- Bij de implementatie blijven de bestaande EAI-kleuren leidend. De referentie dient voor structuur, niet voor het kopiëren van de merkvorm of beelden.

## Gebruikershandeling

De lezer ziet het onderwerp en wat hij hier kan vinden. Daaronder volgt per blok één duidelijke kaart. Swipen, toetsenbordpijlen of de kleine knoppen brengen de volgende kaart in beeld. Een teller maakt zichtbaar hoeveel kaarten er zijn. Een kaart blijft volledig leesbaar, ook wanneer de tekst langer is.

Wie iets specifieks zoekt, heeft rechtsboven direct toegang tot het bestaande zoekveld. Op brede schermen staan vijf duidelijke hoofdroutes in een kleine navigatiestrook links. Op de telefoon blijft het bestaande uitklapmenu behouden.

De broninhoud, alle hyperlinks en de volgorde binnen de kaartgroepen blijven bestaan. Zonder JavaScript zijn de oorspronkelijke kaarten en links gewoon zichtbaar.

## Nieuwe onderdelen

| Onderdeel | Uitvoering |
| --- | --- |
| Achtergrond | Papier `#f6f8f6`, met uiterst licht groene en warme accenten in de intro |
| Tekst | Donkergroen `#20382f`, secundair `#607669` |
| Grenslijn | `#dce8e0` |
| Accent | EAI-groen en licht turquoise; een dunne warme lijn onder de introductie |
| Kaart | Wit, radius 16 px, zachte schaduw, minstens 21 px binnenruimte |
| Op mobiel | Eén kaart per swipe, zonder paginabrede horizontale scroll |
| Op desktop | Eén leesbare kaart van hoogstens 770 px breed, plus vaste hoofdnavigatie vanaf 1320 px |
| Bediening | Vorige/volgende, teller, toetsenbord, touch-swipe, respect voor 'verminder beweging' |
| Zoeken | Bestaande zoekindex en URL's, direct beschikbaar via de bovenbalk |

## Afbakening

Alleen deze bestaande algemene indexpagina's krijgen het nieuwe kaartsysteem: `/nl/onderwijs/`, `/nl/onderzoek/`, `/nl/publicaties/`, `/nl/toepassingen/`, `/nl/tools/`, `/nl/over/` en hun Engelse tegenhangers.

Het nieuwe CSS- en JS-bestand wordt **uitsluitend** aan die twaalf pagina's toegevoegd. De bestaande natuurkunde-, wiskunde-, anatomie-, hartslag-, sport- en LLM-omgevingen zijn uitgesloten. Hun bediening, grafieken, meetwaarden en eigen stijlen veranderen niet.

Artikelen die om aandachtig lezen vragen en het doorzoekbare woordenboek worden niet geforceerd in een carrousel. De kaartvorm is voor overzicht en keuze, niet voor het onderbreken van doorlopende uitleg.

## Controle

- Broncontrole op exact twaalf toegestane routes en uitsluiting van alle genoemde interactieve labs.
- Browsercontrole op 320, 390, 768 en 1440 px: één kaart per swipe, scroll-snap, werkende knoppen, teller, zoekfunctie, links en geen horizontale pagina-overloop.
- Zonder JavaScript blijven oorspronkelijke kaarten en links aanwezig.
- Schermbeelden worden voor de reviewer opgeslagen in CI; een geslaagde build alleen is niet het bewijs.
- PR en publicatiestatus zijn los van elkaar te beoordelen.
