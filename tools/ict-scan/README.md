# Applicatielandschap Emmauscollege

Een zelfstandige pagina van de EAI-website. Geen bronbestanden, tokens, wachtwoorden, persoonsgegevens, boekingsregels of andere schoolinhoud worden naar GitHub of naar een server verstuurd. De import, de controles en de exports draaien in het browservenster.

## Gebruik

De route staat niet in de gewone website-navigatie of de sitemap. De pagina begint met de standaard 404-weergave. Dubbelklik op de middelste 0 van 404. Het dashboard opent direct, zonder toegangscode of wachtwoord. De verborgen ingang is geen authenticatie of beveiliging van de broncode.

Open een of meer bestanden via Bronnen en export. Op het overzicht staan de aantallen en de verdelingen. Toepassingen en AI-functies zijn gescheiden van Entra-registraties en onderliggende productonderdelen. Controles met gelijke ID worden samengevoegd en de bronregels blijven herkenbaar. Nieuwe onderzoekssignalen staan apart. De rapportselectie biedt zes uitvoerprofielen: volledige nulmeting, applicatielandschap, Entra en toegang, AI in het onderwijs, DPIA en AI Act, en controlepunten. Een volledige Excel-export heeft de tabbladen Schoolbreed, AI in de klas, AI in de school en Controle & bronnen. Andere selecties beperken het aantal tabbladen zonder onderliggende bronbeschrijvingen weg te laten. De uitgebreide omschrijvingen zijn onder een AI-ID uitklapbaar en de lesfaseverdeling staat vooraan. De PDF is een zelfstandig leesrapport met de verdelingen en volledige inhoudelijke beschrijvingen. De JSON-export bewaart de ingelezen gegevens voor een volgende controlesessie.

## Ondersteunde bestanden

- .xlsx: Excel-werkbladen met herkende kolomnamen, inclusief verborgen bronbladen.
- .csv: komma, puntkomma of tab, met aanhalingstekens en meerrijige inhoud.
- .json: tabellen en Microsoft Graph-export met `value`-lijst, of een export uit deze tool.
- .docx: tekst uit Word lokaal lezen; nog geen geautomatiseerd juridisch oordeel.
- .pdf: bronregistratie, geen automatische inhoudsextractie.

Het dashboard start leeg. Er worden geen aantallen of controles verzonnen. Categorieen en namen komen uit de ingevoerde bestanden. De 2026-ICT-registratie levert alleen mogelijke toepassingen op; het systeem verwijdert alle financiële velden en gebruikt die niet in de rapportages. Een vermelding is geen bewijs van gebruik. De Excel en de PDF zijn rapportages, geen volledige herimportbestanden; bewaar het JSON-bestand of de oorspronkelijke bronexports voor de volgende sessie.

## Grenzen

Er is geen toegangscode of server-side toegangsbeveiliging. De 404-ingang is alleen een verborgen navigatieroute. Bestanden worden niet geüpload. Standaard verdwijnen gegevens na herladen. Alleen via de uitdrukkelijke knop **Bewaar op dit apparaat** wordt een lokale momentopname opgeslagen in IndexedDB, te verwijderen met **Wis lokale gegevens**. De site heeft geen toegang tot de live Microsoft 365-tenant. Een Entra-registratie is geen bewijs van een actieve gegevenskoppeling. Juridische verwijzingen zijn niet automatisch juridisch advies. DPIA-beoordelingen hebben een bewijsstatus en vragen lokale verificatie. Publicatie op een openbaar domein maakt de code openbaar, niet de lokaal ingelezen inhoud.

De pagina laadt geen externe JavaScript-bibliotheken, analytics of lettertypen. `emmaus-logo.svg` bevat het originele Emmauscollege-logo lokaal en vraagt niets op van een externe website. De CSP staat alleen GitHub API-verzoeken toe voor de vrijwillige, alleen-lezen-synchronisatie; andere externe verbindingen vanuit JavaScript zijn niet toegestaan. Exports worden lokaal gegenereerd. PDF loopt via het afdrukvenster van de browser.

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

- Vast scherm met bovenbalk en de bestaande iconenzijbalk. De dubbele horizontale menubalk is verwijderd. Extra functies staan in het uitklapbare menu onderaan de zijbalk. De inhoud scrolt alleen binnen de hoofdruimte. Op mobiel staat de iconenbalk onderaan en opent het extra menu naar boven.
- Acht schermen: Overzicht, Toepassingen, Koppelingen, AI, Privacy & AI Act, Controles, Rapporten en Bronnen.
- Klikbare staafgrafieken op het schoolbrede dashboard, keuzelijstfilters, een ringdiagram als alternatieve weergave en een staafdiagram naar lesfase op het AI-scherm.
- Aanvullende staafdiagrammen voor Entra-registratiestatus en controlepunten; openen van applicaties via overzicht en wereldwijde zoekbalk.
- Een rapportmaker met zes selecties; Excel exporteert per onderwerp aparte tabbladen en behoudt uitgebreide inhoud, PDF ontstaat via de printdialoog van de browser.
- Lege startpositie, geen schoolgegevens in de publieke code.

Bestanden: `index.html` (ingang en structuur), `style.css` (basis), `monitor.css` (schoolstijl en vaste schermindeling), `app.js` (inlezen, normaliseren en export), `enhancements.js` (dashboards, grafieken, rapportkeuze en vrijwillige lokale opslag), `emmaus-logo.svg` (schoollogo). De websitebuild moet al deze bestanden meenemen.

## Verborgen LiteSpeed-ingang (v3)

De openingspagina is uiterlijk gelijk aan het normale 404-scherm op eaimodel.nl: zwart vlak, grijze 404 en Not Found, met de LiteSpeed-voettekst. Geen EAI-menu of herkenbare navigatie. Twee klikken op de **middelste 0** openen direct het dashboard, zonder formulier of wachtwoord. Een enkele klik doet niets. Op mobiel werkt dubbel tikken; met het toetsenbord tweemaal Enter of spatie. Een eerder lokaal bewaarde momentopname kan bij het openen worden teruggezet.

Dit is een bewust vermomde ingang en geen server-side login. Een echte 404 van de webserver, bijvoorbeeld voor een niet-gepubliceerde URL, kan geen formulier openen. De juiste route moet daadwerkelijk zijn gepubliceerd. Browser- en brondata blijven lokaal.
## GitHub synchronisatie (v4)

Onder **Bronnen** staat **Sync data met GitHub**. Deze functie leest uitsluitend gegevens uit GitHub en verandert geen bestanden in de repository. De GitHub-map, branch/tag en repository zijn instelbaar. Dezelfde invoer voor XLSX, CSV, JSON, DOCX en PDF wordt gebruikt als bij lokale bestanden; PDF's worden alleen geregistreerd, niet inhoudelijk beoordeeld.

- De standaardbron is de openbare repository `E-AI-MODEL/website`, map `ict-scan/bronnen` op `main`. Een openbare repository kan zonder token worden gelezen. Publiceer geen wachtwoorden, toegangssleutels of ruwe accountgegevens. Voor andere, afgeschermde bronmappen kan een privé-repository met beperkte leestoken worden gebruikt.
- Voor een privé-repository wordt een tijdelijke GitHub fine-grained access token gevraagd, beperkt tot die repository met **Contents: Read**. De token gaat alleen met GET-verzoeken naar `https://api.github.com`, wordt niet opgeslagen, niet meegestuurd in exports en na de synchronisatie uit het scherm gewist. Gebruik geen accountbrede of schrijfgerechtigde token.
- Alle bestanden worden eerst opgehaald en pas daarna ingelezen. Bij een importfout of annulering tijdens het verwerken wordt de vorige werkstand teruggezet. Bij een vooraf gevuld overzicht vraagt **Vervangen** om bevestiging, ook wanneer dezelfde GitHub-versie eerder is gesynchroniseerd.
- De scanner leest een map met ondersteunde bronbestanden (ook submappen, begrensd). Bij een GitHub-lijst met 1.000 items weigert de synchronisatie om onvolledige data ongemerkt als compleet te presenteren. Beperk de map tot de te gebruiken nulmeting. Een `README.md` en andere documenten zonder ondersteunde extensie worden overgeslagen.
- De status toont of een synchronisatie is geslaagd en vermeldt welke bestanden zijn gebruikt; de GitHub-bestand-SHA wordt per bron opgeslagen in de huidige browsersessie.
- Er wordt niet automatisch gesynchroniseerd of geüpload. Iedere handmatige synchronisatie verwerkt de gekozen GitHub-versie opnieuw, ook na lokale aanpassingen. Lokaal opslaan blijft een afzonderlijke handeling.
- Voor een snelle openbare *technische test* bestaat `tests/fixtures/ict-scan-github-sync/demo.json`; dit bevat uitsluitend fictieve gegevens. Nooit gebruiken als schoolinventaris.

De publieke repository `E-AI-MODEL/website` bevat nu een gestructureerde 2026-inventaris in `ict-scan/bronnen/2026-applicatielandschap.json` en een gecontroleerd werkregister in `ict-scan/bronnen/2026-werkregister.json`. Beide bestanden worden beschreven in `manifest.json`. De ruwe Entra-roltoewijzingen en persoonlijke accountgegevens zijn niet gepubliceerd. De verborgen 404-ingang is geen toegangsbeveiliging.

Voor een technische test: `node --test tests/test_ict_scan_github_sync.mjs`. De websitebuild controleert ook dat `github-sync.js` wordt gepubliceerd en dat de toegestane netwerkverbinding beperkt blijft tot `https://api.github.com`.

## Uitklapbaar functiemenu (v5)

De acht oorspronkelijke iconen voor de hoofdonderdelen zijn gehandhaafd. De extra knop onderaan opent zoeken, GitHub-synchronisatie, lokale bestandsimport en rapportexports (Excel, PDF, JSON). De zoekbalk en losse acties zijn uit de bovenbalk gehaald; de dubbele horizontale navigatie bestaat niet meer. Op een klein scherm opent de functiesectie boven de onderste iconenbalk. Sluiten kan met Escape, de sluitknop of een klik buiten het menu. De toets `/` opent de zoekfunctie buiten invoervelden.

De GitHub-actie in dit menu start de alleen-lezen-synchronisatie en opent het bronnenscherm voor de status. Bij de eerste opening haalt de website de twee openbare JSON-bestanden op, mits er geen lokale momentopname klaarstaat. Handmatig synchroniseren blijft mogelijk. Het manifest bevat de startdatum (10 augustus 2026), samensteller (Hans Visser) en aantallen. De 61 basisregistraties zijn niet het definitieve totaal; 76 kandidaten blijven apart.

## Brondata 2026 (20 november)

De hoofdbron bewaart 61 basisregistraties, 76 volledig beschreven AI-functies, 93 Entra-registraties, 76 aanvullende kandidaten, 10 DPIA-punten, 22 AI-beheerpunten, 16 samenvattende controles, 13 technisch gekoppelde onderdelen, 40 licentiecontrole-registraties en vier afzonderlijke apparaatmetingen. Het werkregister bevat daarnaast 13 open acties en 12 softwarecontroles. De 76 kandidaten tellen niet mee bij de basisregistraties. De JSON bewaart zowel de velden voor het dashboard als de oorspronkelijke teksten en herkomstverwijzingen uit de Excelbestanden.

De code kent aparte registers voor kandidaten, licentiecontrole, werkacties en softwarecontrole. Bij synchronisatie worden de bronnen uit GitHub gelezen zonder terugschrijven. De website en de exports vermelden een bronstatus en mogen ontbrekende bevestigingen niet invullen.

## Visualisaties uit de brondata

De zijbalk, de acht schermen en de uitgebreide beschrijvingen blijven behouden. De overzichtspagina toont de geregistreerde toepassingen uit dezelfde dataset als het applicatieregister, zonder fictieve aantallen of een vaste voorbeeldketen.

- **Gebruik en soort:** per grafiek instelbaar op staaf, ring, tegels (proportionele vlakverdeling) of exacte tabel. Geen verborgen top-7 of top-9: alle categorieën blijven meetellen. Een categorie selecteren filtert de toepassingen; het andere diagram houdt de overige categorieën zichtbaar.
- **Kruising:** gebruiksgebied × soort voorziening, als matrix met aantallen en totalen of als tabel. Een matrixvak filtert op beide velden.
- **Toepassingsfamilies:** elke toepassing is selecteerbaar. De kaart en lijst lezen uitsluitend expliciete bronrelaties uit parent, parentId of matchedId. Technische onderdelen, AI-functies en mogelijke Entra-matches hebben eigen labels. Een match bewijst geen live koppeling. Registraties zonder beschreven relaties blijven zichtbaar.
- **Onderwijs-AI en Entra:** dezelfde keuze uit staaf, ring, tegels of tabel. Lesfasevermeldingen kunnen hoger uitvallen dan het aantal unieke AI-functies, omdat een functie meerdere lesfasen kan betreffen.
- **Gegevensdekking:** beschrijving, verantwoordelijke, lokaal gebruik en gegevensuitwisseling zijn afzonderlijk gemeten op de geselecteerde basisregistraties. Onbekend is geen afkeuring.

De bronpopulaties blijven gescheiden: 61 basisregistraties, 76 beschreven AI-functies, 93 Entra-registraties en 76 aanvullende kandidaten volgens de gecontroleerde bronnen uit november 2026. De grafieken presenteren deze groepen niet als het definitieve aantal daadwerkelijk gebruikte applicaties.

De GitHub-sync vergelijkt de bestanden en de aantallen met het manifest in ict-scan/bronnen. Een verschil tussen het manifest en de GitHub-versie stopt de import; bij een mislukte verwerking wordt de vorige stand hersteld. De bronbestanden zelf worden niet veranderd vanuit de browser. De nieuwe grafieken zijn uitgevoerd met HTML, CSS en JavaScript, zonder externe bibliotheken of extra netwerkverzoeken.
