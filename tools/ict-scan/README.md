# Schoolbrede ICT-scan

Een zelfstandige pagina van de EAI-website. Geen bronbestanden, tokens, wachtwoorden, persoonsgegevens, boekingsregels of andere schoolinhoud worden naar GitHub of naar een server verstuurd. De import, de controles en de exports draaien in het browservenster.

## Gebruik

De route staat niet in de gewone website-navigatie of de sitemap. De pagina begint met de standaard 404-weergave. Dubbelklik op de middelste 0 van 404 en voer de afgesproken toegangscode in. Dit is een verborgen ingang, geen authenticatie of beveiliging van de broncode.

Open een of meer bestanden via Bronnen en export. Op het overzicht staan de aantallen en de verdelingen. Toepassingen en AI-functies zijn gescheiden van Entra-registraties en onderliggende productonderdelen. Controles met gelijke ID worden samengevoegd en de bronregels blijven herkenbaar. Nieuwe onderzoekssignalen staan apart. De rapportselectie biedt zes uitvoerprofielen: volledige nulmeting, applicatielandschap, Entra en toegang, AI in het onderwijs, DPIA en AI Act, en controlepunten. Een volledige Excel-export heeft de tabbladen Schoolbreed, AI in de klas, AI in de school en Controle & bronnen. Andere selecties beperken het aantal tabbladen zonder onderliggende bronbeschrijvingen weg te laten. De uitgebreide omschrijvingen zijn onder een AI-ID uitklapbaar en de lesfaseverdeling staat vooraan. De PDF is een zelfstandig leesrapport met de verdelingen en volledige inhoudelijke beschrijvingen. De JSON-export bewaart de ingelezen gegevens voor een volgende controlesessie.

## Ondersteunde bestanden

- .xlsx: Excel-werkbladen met herkende kolomnamen, inclusief verborgen bronbladen.
- .csv: komma, puntkomma of tab, met aanhalingstekens en meerrijige inhoud.
- .json: tabellen en Microsoft Graph-export met `value`-lijst, of een export uit deze tool.
- .docx: tekst uit Word lokaal lezen; nog geen geautomatiseerd juridisch oordeel.
- .pdf: bronregistratie, geen automatische inhoudsextractie.

Het dashboard start leeg. Er worden geen aantallen of controles verzonnen. Categorieen en namen komen uit de ingevoerde bestanden. De 2026-ICT-registratie levert alleen mogelijke toepassingen op; het systeem verwijdert alle financiële velden en gebruikt die niet in de rapportages. Een vermelding is geen bewijs van gebruik. De Excel en de PDF zijn rapportages, geen volledige herimportbestanden; bewaar het JSON-bestand of de oorspronkelijke bronexports voor de volgende sessie.

## Grenzen

De toegangscode is zichtbaar in publieke JavaScript en is niet geschikt als toegangsbeveiliging voor serverdata. Bestanden worden niet geupload. Standaard verdwijnen gegevens na herladen. Alleen via de uitdrukkelijke knop **Bewaar op dit apparaat** wordt een lokale momentopname opgeslagen in IndexedDB, te verwijderen met **Wis lokale gegevens**. De site heeft geen toegang tot de live Microsoft 365-tenant. Een Entra-registratie is geen bewijs van een actieve gegevenskoppeling. Juridische verwijzingen zijn niet automatisch juridisch advies. DPIA-beoordelingen hebben een bewijsstatus en vragen lokale verificatie. Publicatie op een openbaar domein maakt de code openbaar, niet de lokaal ingelezen inhoud.

De pagina laadt geen externe JavaScript-bibliotheken, analytics of lettertypen. `emmaus-logo.svg` bevat het originele Emmauscollege-logo lokaal en vraagt niets op van een externe website. De CSP verbiedt netwerkverzoeken vanuit JavaScript. Exports worden lokaal gegenereerd. PDF loopt via het afdrukvenster van de browser.

## Controle

De bronparser is getest met een echte inventarisbestand (69 toepassingen, 76 AI-functies, 93 Entra-registraties, 27 productonderdelen, 10 DPIA-bronregels, 22 AI-beheerregels) en de ICT-registratie 2026. In de controlelijst werden 184 regels met 151 unieke ID's gevonden. De gegenereerde XLSX is opnieuw geopend met openpyxl. De uiteindelijke pagina moet nog in Safari en Chrome op een regulier werkstation worden beproefd. Voordat de site beschikbaar wordt gemaakt, moet de bronpublicatie in de websitebuild zijn opgenomen en de bestaande publicatietests slagen.

## Rapportopbouw

- **Schoolbreed:** vier herkenbare hoofdcijfers, twee verdelingen, onderlinge productstructuur, register met omschrijvingen. Geen financiële bedragen, boekingen of leveranciersbetalingen.
- **AI in de klas:** functies binnen het onderwijsleerproces, lesfasen en de volledige bronbeschrijvingen van de AI-handeling, docentinstellingen, leerlinghandeling, leerstrategie, didactiek en onbekende zaken.
- **AI in de school:** organisatie- en beheertoepassingen, AI-beheeradviezen, lokale status en DPIA-deelregistraties.
- **Controle & bronnen:** open controle-ID's, Entra-koppelingen, apparaatgroepen, aanvullende signalen, bronvermeldingen en juridische verwijzingen. Dit is de technische bijlage, niet de primaire leespagina.

De browser toont binnen het AI-deel twee aparte keuzes, `AI in de klas` en `AI in de school`. Kennis uit bronbestanden wordt niet aangevuld met onbewezen lokale instellingen. De uitklapbare rijen blijven daadwerkelijk in de XLSX opgeslagen.

Test de generator bij een codewijziging met `node tests/test_ict_scan_export.mjs` en de sitecontroles met `python -m unittest discover -s tests -p 'test_ict_scan_publish.py' -v`.

## Dashboard en vormgeving (v2)

De website volgt de navigatie van de EAIact Model Monitor, maar gebruikt de kleuren van het Emmauscollege. Het officiële logo is overgenomen uit `LogoEmmausCollege4000px.png` en lokaal als `emmaus-logo.svg` opgenomen.

- Vast scherm met bovenbalk, iconennavigatie en horizontaal tabmenu. De inhoud scrolt alleen binnen de hoofdruimte. Op mobiel staat de iconenbalk onderaan.
- Acht schermen: Overzicht, Toepassingen, Koppelingen, AI, Privacy & AI Act, Controles, Rapporten en Bronnen.
- Klikbare staafgrafieken op het schoolbrede dashboard, keuzelijstfilters, een ringdiagram als alternatieve weergave en een staafdiagram naar lesfase op het AI-scherm.
- Aanvullende staafdiagrammen voor Entra-registratiestatus en controlepunten; openen van applicaties via overzicht en wereldwijde zoekbalk.
- Een rapportmaker met zes selecties; Excel exporteert per onderwerp aparte tabbladen en behoudt uitgebreide inhoud, PDF ontstaat via de printdialoog van de browser.
- Lege startpositie, geen schoolgegevens in de publieke code.

Bestanden: `index.html` (ingang en structuur), `style.css` (basis), `monitor.css` (schoolstijl en vaste schermindeling), `app.js` (inlezen, normaliseren en export), `enhancements.js` (dashboards, grafieken, rapportkeuze en vrijwillige lokale opslag), `emmaus-logo.svg` (schoollogo). De websitebuild moet al deze bestanden meenemen.

## Verborgen LiteSpeed-ingang (v3)

De openingspagina is uiterlijk gelijk aan het normale 404-scherm op eaimodel.nl: zwart vlak, grijze 404 en Not Found, met de LiteSpeed-voettekst. Geen EAI-menu of herkenbare navigatie. Twee klikken op de **middelste 0** openen direct het dashboard, zonder formulier of wachtwoord. Een enkele klik doet niets. Op mobiel werkt dubbel tikken; met het toetsenbord tweemaal Enter of spatie. Een eerder lokaal bewaarde momentopname kan bij het openen worden teruggezet.

Dit is een bewust vermomde ingang en geen server-side login. Een echte 404 van de webserver, bijvoorbeeld voor een niet-gepubliceerde URL, kan geen formulier openen. De juiste route moet daadwerkelijk zijn gepubliceerd. Browser- en brondata blijven lokaal.