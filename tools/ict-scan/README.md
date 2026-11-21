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

- De standaardbron is de openbare repository `E-AI-MODEL/website`, map `tools/ict-scan/bronnen` op `main`. Een openbare repository kan zonder token worden gelezen. Publiceer geen wachtwoorden, toegangssleutels of ruwe accountgegevens. Voor andere, afgeschermde bronmappen kan een privé-repository met beperkte leestoken worden gebruikt.
- Voor een privé-repository wordt een tijdelijke GitHub fine-grained access token gevraagd, beperkt tot die repository met **Contents: Read**. De token gaat alleen met GET-verzoeken naar `https://api.github.com`, wordt niet opgeslagen, niet meegestuurd in exports en na de synchronisatie uit het scherm gewist. Gebruik geen accountbrede of schrijfgerechtigde token.
- Alle bestanden worden eerst opgehaald en pas daarna ingelezen. Bij een importfout of annulering tijdens het verwerken wordt de vorige werkstand teruggezet. Bij een vooraf gevuld overzicht vraagt **Vervangen** om bevestiging, ook wanneer dezelfde GitHub-versie eerder is gesynchroniseerd.
- De scanner leest een map met ondersteunde bronbestanden (ook submappen, begrensd). Bij een GitHub-lijst met 1.000 items weigert de synchronisatie om onvolledige data ongemerkt als compleet te presenteren. Beperk de map tot de te gebruiken nulmeting. Een `README.md` en andere documenten zonder ondersteunde extensie worden overgeslagen.
- De status toont of een synchronisatie is geslaagd en vermeldt welke bestanden zijn gebruikt; de GitHub-bestand-SHA wordt per bron opgeslagen in de huidige browsersessie.
- Er wordt niet automatisch gesynchroniseerd of geüpload. Iedere handmatige synchronisatie verwerkt de gekozen GitHub-versie opnieuw, ook na lokale aanpassingen. Lokaal opslaan blijft een afzonderlijke handeling.
- Voor een snelle openbare *technische test* bestaat `tests/fixtures/ict-scan-github-sync/demo.json`; dit bevat uitsluitend fictieve gegevens. Nooit gebruiken als schoolinventaris.

De publieke repository `E-AI-MODEL/website` bevat nu een gestructureerde 2026-inventaris in `tools/ict-scan/bronnen/2026-applicatielandschap.json` en een gecontroleerd werkregister in `tools/ict-scan/bronnen/2026-werkregister.json`. Beide bestanden worden beschreven in `manifest.json`. De ruwe Entra-roltoewijzingen en persoonlijke accountgegevens zijn niet gepubliceerd. De verborgen 404-ingang is geen toegangsbeveiliging.

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

De GitHub-sync vergelijkt de bestanden en de aantallen met het manifest in tools/ict-scan/bronnen. Een verschil tussen het manifest en de GitHub-versie stopt de import; bij een mislukte verwerking wordt de vorige stand hersteld. De bronbestanden zelf worden niet veranderd vanuit de browser. De nieuwe grafieken zijn uitgevoerd met HTML, CSS en JavaScript, zonder externe bibliotheken of extra netwerkverzoeken.

## Eén JSON-kaart, wettelijke kaders en logboek

De uitklapbare zijbalk bevat **JSON-kaarten beheren**. De editor werkt voor dertien registers: toepassingen, AI-functies, Entra, technische onderdelen, kandidaten, controles, DPIA, AI-beheer, apparaten, licenties, werkacties, softwarecontroles en veelgestelde vragen. Per type verschijnen de juiste invulvelden. Originele Excelteksten, bronnummers, bronrijen en herkomst blijven bewaard.

De kaart bewaart conceptwijzigingen buiten de actuele inventaris. Nog niet goedgekeurde concepten veranderen de grafieken en rapportages niet. Nieuwe registraties krijgen een ID per register; bestaande IDs blijven onveranderd.

Relaties hebben een relatietype, doelregister, doel-ID, status, bewijs en toelichting. Bevestigde relaties vereisen bewijs. De toetsingskaders staan afzonderlijk in tools/ict-scan/frameworks.json: IBP, AVG, UAVG, AI-verordening en WVO 2020, met officiële bronlinks. De gebruiker kiest de concrete norm of het wetsartikel en voegt een beoordeling toe. Er volgt nooit automatisch het oordeel dat aan een wet is voldaan.

Voor de bronstructuur is geleerd van de HOVI- en OnderwijsIN-datasets en het eigen onderwijscorpus: bronlagen en gegevensmodellen scheiden, oorspronkelijke IDs en beschrijvingen bewaren, rechten en peildatum vastleggen en relaties uitsluitend op grond van brongegevens toevoegen. Inhoudelijke HOVI-gegevens zijn niet aan het schoolregister toegevoegd.

### Wijzigingen naar GitHub

Een gebruiker met de juiste rechten kan vanuit de kaart een GitHub-pull-request maken. Hiervoor is voorlopig een fijnmazig token nodig met Contents en Pull requests: Read and write op E-AI-MODEL/website. Het token wordt niet opgeslagen; het invoerveld wordt na afloop leeggemaakt. Er is een aparte bevestiging nodig dat de wijziging openbaar mag worden voorgesteld.

De website haalt de actuele GitHub-versie op, vergelijkt de basisvelden met het concept en controleert IDs, onderlinge verbanden, bewijsstatus en manifest. Vervolgens schrijft de website de wijzigingen op een nieuwe branch en opent een pull request. De kaart schrijft niet naar main.

Dit is een eerste oplossing. Een GitHub App met afgeschermde aanmelding verdient de voorkeur voor gebruik door meerdere beheerders.

### Logboek

Na publicatie via pull request bevat de registratie een auditTrail met tijdstip, GitHub-gebruiker, gewijzigde velden en reden. In Bronnen staat een uitklapbaar logboek; de eerste regel beschrijft de start van de inventarisatie op 10 augustus 2026 volgens de metadata. Excel en JSON behouden de wijzigingsgegevens. GitHub bewaart daarnaast het commitverschil en de reviewgeschiedenis.

Het logboek bevat kaartwijzigingen en is niet automatisch een volledige weergave van alle rechtstreekse GitHub-bewerkingen. Bevestigde relaties of juridische oordelen vragen altijd afzonderlijk bewijs.

Test: node --check tools/ict-scan/record-cards.js, node --check tools/ict-scan/record-github.js, en node --test tests/test_ict_scan_cards.mjs.

## Vragen voorspellen tijdens het typen

De zoekbalk in de bestaande zijbalk laat eerst mogelijke vragen zien. De teksten klinken als gewone vragen, bijvoorbeeld **Welke printsoftware gebruiken we?**, **Wie beheert 3CX?** en **Wat betekent een Entra-registratie?**. Er verschijnt nog geen antwoord tijdens het typen.

De suggesties komen uit de FAQ-vragen en hun alternatieve formuleringen, uit vaste vraagvormen en uit namen van toepassingen die echt in het register voorkomen. Ze verwijzen naar een bestaande bronroute, niet naar een gegenereerd antwoord. De lijst blijft beperkt tot vijf voorstellen en is met de pijltjestoetsen en Enter te bedienen. Een aangeklikte vraag wordt beantwoord, maar de gebruiker kan ook de eigen vraag afmaken en met Enter zoeken. Escape sluit de voorstellen.

De zoekfunctie gebruikt de geladen lokale JSON-gegevens; de input wordt niet naar een externe dienst gestuurd. Het antwoord noemt de bronstatus en laat onbekende informatie onbevestigd. De vaste FAQ-kaarten blijven via dezelfde JSON-editor bewerkbaar.

## Vragen stellen zonder AI

De bestaande zoekfunctie in de uitklapbare zijbalk heeft een antwoordweergave. Er is geen nieuwe hoofdmenuoptie of afzonderlijke chatbot toegevoegd. De HTML gebruikt lokale JavaScript-regels om een vraag te herkennen, de relevante gegevens te selecteren en het resultaat samen met de bronstatus te tonen. Er gaan geen vraagteksten naar een AI-dienst.

De drie antwoordroutes zijn:
- **Geregistreerde feiten:** antwoorden op vragen over een specifieke toepassing, zoals verantwoordelijke, omschrijving, gebruikte gegevens, verwerkersafspraken, DPIA-status, bron, AI-functies of Entra-matches. Een niet-bevestigd veld blijft expliciet niet vastgesteld.
- **Berekende selecties:** aantallen en lijsten uit de geladen JSON-registers. Bijvoorbeeld toepassingen met beschreven AI-functies, open verantwoordelijken, Entra-matches, printersoftware en telefonie.
- **Vaste FAQ's:** brongebonden, redactioneel nog te beoordelen antwoorden uit het afzonderlijke bestand tools/ict-scan/bronnen/2026-faq.json. Iedere kaart bevat een ID, hoofdvraag, alternatieve vragen, antwoord, onderwerp, status en bronverwijzing.

De FAQ is als dertiende register beschikbaar via dezelfde JSON-kaarteneditor. Concepten worden voor de FAQ op dezelfde manier gecontroleerd en via een pull request voorgesteld als voor de andere twaalf registers. Het manifest bevat de SHA en het aantal FAQ's; de GitHub-synchronisatie weigert afwijkende bronbestanden.

Een ingevoerde vraag wordt eerst vergeleken met exacte FAQ-vragen of alternatieve formuleringen, daarna met expliciete toepassingsnamen en vraagtypes, en vervolgens met berekenbare selecties. Een bijna identieke FAQ-vraag kan automatisch worden herkend wanneer geen twijfel tussen meerdere antwoorden bestaat. Bij twijfel verschijnen alleen suggesties. Er worden geen nieuwe feiten geschreven op basis van een vermoedelijke overeenkomst.

De vragenverzameling in tests/test_ict_scan_answers.mjs bevat 28 echte Nederlandse zoekvragen, met controles op bronvelden, aantallen, onvoldoende bewijs, de bronverwijzing en de afwezigheid van generatieve tekst. De JavaScript-code is lokaal: tools/ict-scan/answer-engine.js. De vormgeving staat in answer-engine.css.

Vragen worden niet opgeslagen als zoeklog, niet gebruikt als profiel en niet verzonden naar externe zoekdiensten. De verborgen 404-ingang is geen beveiliging. De gepubliceerde JSON-bestanden zijn openbaar in de GitHub-repository.

## Interactieve Dashboard Builder (21 november 2026)

De bestaande Dashboard Studio is uitgebreid met keuze tussen lijn-, staaf- en ringweergave, een categoriefilter voor de gekozen gegevensgroep, slepen en verplaatsen van panelen, afzonderlijke kaartbreedtes en JSON-import/export van de persoonlijke opmaak. Het ontwerp en de selecties staan gescheiden van de bronregisters. Op een smal scherm worden de kaarten onder elkaar geplaatst en zijn verplaatsknoppen beschikbaar.

Daarnaast is de originele open-source [Dashboard Builder](https://github.com/nateriera/dashboard-builder) van Nate Riera geselecteerd, niet vervangen door alleen een nagebouwde schermafbeelding. De GitHub Actions-workflow `.github/workflows/import-ict-dashboard-builder.yml` bouwt de onveranderlijke upstream-revisie `0c72e80b6b2106c24dd643607157932ca25f7717` met Node 22, bewaart de MIT-licentie en voegt de statische bestanden toe onder `tools/ict-scan/dashboard-builder-app/`. De websitebuilder publiceert deze bestanden onder dezelfde URL-structuur, zonder de schoolse bronmap mee te kopiëren. De publicatie is afhankelijk van een geslaagde importworkflow en review van het pull request.

**Volledige bouwer** opent de oorspronkelijke Dashboard Builder in een schermvullende werkruimte binnen de ICT-scan. De JSON-kaarten uit de actuele browsersessie worden rechtstreeks, binnen hetzelfde domein, doorgegeven. Er is geen afzonderlijke import/export meer nodig. Gebruikers zien alleen de registers waarvoor de rol is ingeschakeld. De oorspronkelijke editor, kaarten, rapporten en GitHub-synchronisatie blijven bestaan. De volledige bouwer kan een bronkaart openen om die via de bestaande kaarteditor te wijzigen.

Via **Schrijf terug** opent altijd eerst een bevestigingsvenster. Dat venster vermeldt de gekozen bron, de dashboardonderdelen, de verschillen ten opzichte van de opgeslagen versie en het exacte GitHub-pad. Een toelichting, een tijdelijk GitHub-token met beperkte schrijfrechten en expliciete toestemming voor openbare publicatie zijn vereist. De site maakt vervolgens een nieuwe branch met een pull request, nooit een rechtstreekse wijziging in `main`. Er worden alleen layoutvelden opgeslagen in `tools/ict-scan/dashboard-layouts/<register>.json`. Bronregistraties, afgeleide aantallen, persoonsgegevens en tokens zitten niet in die JSON. De JSON-kaart en het formele schoolregister blijven leidend voor bronwijzigingen. Hiervoor geldt de bestaande concept-, bewijs- en PR-procedure. Controleer bij een HTML-export vanuit de Builder zelf of de ingelezen gegevens gedeeld mogen worden. Zo'n export kan datasets bevatten.

De upstream-revisie is niet handmatig in geminificeerde code aangepast. `scripts/patch_ict_dashboard_builder.py` voegt de brug toe vóór de Vite-bouw en weigert een onverwachte upstream-indeling. De gebundelde Builder mag alleen dezelfde oorsprong en lokale assets benaderen. De brondata worden tijdens de koppeling niet automatisch in IndexedDB opgeslagen. De bestaande dashboardindeling kan lokaal in de browser worden bewaard. Een ingediende GitHub-PR krijgt na beoordeling een nieuwe publicatie, waarna de bouwer de versie uit `dashboard-layouts/<register>.json` weer kan ophalen.

Validatie: `node --check tools/ict-scan/dashboard-bridge.js`, `node --check tools/ict-scan/builder-src/ict-bridge.js`, `node --test tests/test_ict_scan_dashboard_builder.mjs` en de bestaande ICT-scan/browser/publicatietests. Alleen samenvoegen nadat de bundel en tests zijn gecontroleerd.
