# Applicatielandschap Emmauscollege

Een zelfstandige pagina van de EAI-website. Inlezen, zoeken, controleren en rapporteren werken met gewone JavaScript-code, zonder modelaanroepen. De gepubliceerde inventaris staat in GitHub. Het dashboard leest die bron bij het openen. Lokale imports en exports blijven op het apparaat. Alleen de afzonderlijke, uitdrukkelijk gekozen wijzigingsroute verstuurt kaartwijzigingen naar een nieuwe GitHub-branch en pull request.

## Verantwoordelijken en controleerbare verbanden (23 november 2026)

De eigenaar op de applicatiekaart is de door de schoolleiding aangewezen **verantwoordelijke functie**, geen autorisatie in Microsoft Entra of elders. De technische inrichting van Microsoft 365, Teams, Copilot, Power BI, Entra, Intune, Jamf, de lokale identiteitsvoorzieningen, Apple Klaslokaal, Canon uniFLOW en Limid staat op `ICT-beheer`. LessonUp en Showbie staan op `Stuurgroep ICT`. Het veld `recordMeta.ownerSource` bewaart de herkomst van de aanvulling.

De bestaande 61 applicaties tellen nu 64 brongebonden relaties op 34 applicaties. De 10 nieuwe technische relatievoorstellen verbinden onder meer NIVO, lokale AD, AFAS, Magister, Jamf en Intune met Entra, en uniFLOW met Microsoft 365 en Teams. Deze staan op **Vermoedelijk**; een controlevraag of technische registratie bewijst geen actuele werkende synchronisatie, SSO of gegevensuitwisseling. Het dashboard toont ook inkomende verbanden, zodat Microsoft 365 en Entra niet als losse, nauwelijks verbonden kaarten verschijnen.

Voor vier hardwaregroepen uit de IAM-werkmap (iPads, laptops, smartboards en printers) is `ICT-beheer` vastgelegd. Hun koppelingen aan Jamf, Intune, Apple Klaslokaal, Limid en Canon staan als `hardwareLinks[]` op bestaande applicatiekaarten. De zes Microsoft 365-beheeronderwerpen, waaronder SharePoint, OneDrive, Exchange, Purview, Defender en leerlingtoegang, staan als `serviceLinks[]` bij Microsoft 365. Beide lijsten behouden bronverwijzing en bewijsgrens; ze worden niet als actieve apparaten, losse applicaties of aparte licenties geteld. De oorspronkelijke vier Entra-apparaatmetingen blijven ongewijzigd.

De persoonlijke LessonUp- en Showbie-accountlijsten en financiële detailregels zijn **niet** toegevoegd aan de openbare GitHub-bron. Bewerkvoorstellen blijven via de bestaande gecontroleerde PR-route gaan; de 404-ingang en de bewerkpop-up zijn geen toegangsbeveiliging.

## Huidige uitbreiding: herbruikbare controles

De map [assurance](assurance/README.md) bevat een zelfstandige controlefunctie, een vast testcorpus en expliciete organisatieprofielen. Het huidige dashboard gebruikt Emmauscollege. Dezelfde controlefunctie is ook met een tweede, fictieve organisatie beproefd. De bestaande onderwijsinterface is daarmee nog niet voor iedere sector aangepast.

Het scherm **Controles** toont Gegevens, Bronnen, Beoordelingen, Wijzigingen en Tests. Elke kleur heeft een tekst. Groen betekent dat die controle slaagde; oranje vraagt aandacht; rood wijst op een afgekeurde controle; grijs betekent dat de controle niet is uitgevoerd. Een lege inventaris, ontbrekende vergelijking of ontbrekende beoordeling kan niet ongemerkt groen worden. De uitslag is geen verklaring van juridische conformiteit.

De controles lopen in een lokale Web Worker. Een nieuwe invoer maakt de vorige uitslag direct ongeldig en beëindigt een oudere run. Ook vóór een export wordt de invoer opnieuw vergeleken. Een fout of timeout geeft een zichtbare mislukking. Een vergelijkingsstand wordt alleen na een bewuste handeling gebruikt. Bewaar het vergelijkingsbestand voor hergebruik; de browser schrijft dit niet vanzelf naar GitHub of lokale permanente opslag.

Dezelfde code draait via:

```bash
node scripts/check_ict_assurance.mjs --as-of 2026-11-21 --output artifacts/ict-assurance.json
node --test tests/test_ict_scan_assurance*.mjs tests/test_ict_scan_cards.mjs tests/test_ict_scan_github_sync.mjs
```

De CLI controleert eerst de exacte bronbytes tegen de Git-blob-SHA's en registertellingen in het manifest. Het verslag bevat datum, bronidentiteit, controleversie, policy en bestandsvingerafdrukken. Exit 0 betekent dat geen technische afkeuring is gevonden. Oranje en grijs blijven in het verslag zichtbaar en worden niet als een groen totaal gepresenteerd.

De workflow `check-ict-assurance.yml` voert deze controles op relevante PR's en pushes, op aanvraag en dagelijks uit. De dagelijkse planning wordt pas actief wanneer de workflow op de standaardbranch staat. De workflow heeft alleen leesrechten en publiceert geen wijzigingen. Resultaten worden als run-artifact bewaard.

### Beoordeling en opvolging

Iedere normverwijzing kan rol, beoordelaar, datum, volgende beoordeling, vervolgactie, actiehouder, actiestatus en uitvoeringsbewijs bewaren. Voor Onderbouwd zijn bronbewijs, beoordelaar en datum nodig; EN 18286 vereist ook de rol. Niet van toepassing vereist een toelichting, beoordelaar en datum. Afgerond vereist een omschreven actie met uitvoeringsbewijs. Bestaande bronvelden en onbekende gestructureerde velden blijven behouden. Excel, JSON en het afzonderlijke controleverslag bewaren de relevante gegevens.

Het organisatieprofiel bepaalt de bronmap en de bestemming voor wijzigingen. Een concept wordt bij het begin van de bewerking aan zijn bron gebonden. Een latere bronwissel maakt een lokaal of vreemd concept niet geschikt voor publicatie naar die andere bron. De hele wijzigingsbatch wordt eerst op een kopie gevalideerd. Onjuiste invoer wijzigt de originele documenten niet.

### Beveiliging en gebruik

GitHub-tokens blijven alleen tijdens de gekozen handeling beschikbaar en worden uit het invoerveld gewist. De publicatieroute beperkt verzoeken tot de ingestelde GitHub-repository en de gebruikerscontrole, weigert redirects en controleert ook committeksten op toegangssleutels. Kaart- en foutteksten worden als tekst getoond. Schrijfhandelingen vanuit een iframe worden geweigerd.

De `.htaccess` bevat HTTP-headers voor Apache/LiteSpeed, waaronder `frame-ancestors 'none'` en `X-Frame-Options: DENY`. De daadwerkelijke productieheaders moeten na publicatie worden gecontroleerd. Een bestand in Git is daarvoor geen uitvoeringsbewijs. De verborgen 404-ingang blijft een navigatiekeuze, geen toegangssysteem.

Volledige offline herstart is niet aangetoond. De toepassing heeft geen serviceworker die de volledige installatie vooraf bewaart. Geen AI tijdens gebruik betekent ook niet dat de code, gegevens of eerdere redactiewerkzaamheden nooit met AI-hulp zijn gemaakt.

[Architectuur](../../docs/ict-assurance-architecture.md), [broncontrole EN 18286](../../docs/ict-assurance-sources.md) en [herkomst van hergebruik](../../docs/ict-assurance-reuse.md) beschrijven de gemaakte keuzes en hun bewijsgrenzen.

De paragrafen hieronder beschrijven de bestaande functies en hun ontwikkeling. De bovenstaande uitbreiding is de actuele beschrijving van controles en schrijven naar GitHub.

## Eén gegevensbetekenis, geen AI in de website

De ICT-scan gebruikt geen taalmodel. Zoeken, gegevenskaarten, grafieken,
rapporten en controles zijn deterministisch. Het woord AI verwijst uitsluitend
naar geïnventariseerde functies en toepassingen, niet naar de techniek van de site.

`record-taxonomy.js` legt de interpretatie vast van de bestaande JSON-velden
`domain` en `phase`, en van de contextafhankelijke veldnamen. De bron-JSON
blijft de enige inhoudelijke registratie. Kaarten, schermen en exports
gebruiken dezelfde indeling. Onbekende domeinen worden niet op basis
van andere ingevulde velden geraden.

Bij `Onderwijsleerproces` is een lesfase relevant; bij `Organisatie en beheer`
is de lesfase niet van toepassing. Oorspronkelijke gegevens, technische
ID's, bronverwijzingen, 404-ingang en gecontroleerde PR-route blijven behouden.

## Gebruik

De route staat niet in de gewone website-navigatie of de sitemap. De pagina begint met de standaard 404-weergave. Dubbelklik op de middelste 0 van 404. Het dashboard opent direct, zonder toegangscode of wachtwoord. De verborgen ingang is geen authenticatie of beveiliging van de broncode.

Open een of meer bestanden via Bronnen en export. Op het overzicht staan de aantallen en de verdelingen. Toepassingen en AI-functies zijn gescheiden van Entra-registraties en onderliggende productonderdelen. Controles met gelijke ID worden samengevoegd en de bronregels blijven herkenbaar. Nieuwe onderzoekssignalen staan apart. De rapportselectie biedt zes uitvoerprofielen: volledige nulmeting, applicatielandschap, Entra en toegang, AI in het onderwijs, DPIA en AI Act, en controlepunten. Een volledige Excel-export heeft de tabbladen Schoolbreed, AI in de klas, AI in de school en Controle & bronnen. Andere selecties beperken het aantal tabbladen zonder onderliggende bronbeschrijvingen weg te laten. De uitgebreide omschrijvingen zijn onder een AI-ID uitklapbaar en de lesfaseverdeling staat vooraan. De PDF is een zelfstandig leesrapport met de verdelingen en volledige inhoudelijke beschrijvingen. De JSON-export bewaart de ingelezen gegevens voor een volgende controlesessie.

## Ondersteunde bestanden

- .xlsx: Excel-werkbladen met herkende kolomnamen, inclusief verborgen bronbladen.
- .csv: komma, puntkomma of tab, met aanhalingstekens en meerrijige inhoud.
- .json: tabellen en Microsoft Graph-export met `value`-lijst, of een export uit deze tool.
- .docx: tekst uit Word lokaal lezen; nog geen geautomatiseerd juridisch oordeel.
- .pdf: bronregistratie, geen automatische inhoudsextractie.

De eerste weergave bevat geen verzonnen aantallen. Na het openen worden de ingestelde openbare bronbestanden geladen, tenzij een bewaarde lokale stand wordt hersteld. Categorieen en namen komen uit de ingevoerde bestanden. De 2026-ICT-registratie levert alleen mogelijke toepassingen op; het systeem verwijdert alle financiële velden en gebruikt die niet in de rapportages. Een vermelding is geen bewijs van gebruik. De Excel en de PDF zijn rapportages, geen volledige herimportbestanden; bewaar het JSON-bestand of de oorspronkelijke bronexports voor de volgende sessie.

## Grenzen

Er is geen toegangscode of server-side toegangsbeveiliging. De 404-ingang is alleen een verborgen navigatieroute. Lokale bestanden worden niet tijdens import geüpload; de aparte PR-route verstuurt alleen de uitdrukkelijk voorgestelde kaartwijzigingen. Standaard verdwijnen gegevens na herladen. Alleen via de uitdrukkelijke knop **Bewaar op dit apparaat** wordt een lokale momentopname opgeslagen in IndexedDB, te verwijderen met **Wis lokale gegevens**. De site heeft geen toegang tot de live Microsoft 365-tenant. Een Entra-registratie is geen bewijs van een actieve gegevenskoppeling. Juridische verwijzingen zijn niet automatisch juridisch advies. DPIA-beoordelingen hebben een bewijsstatus en vragen lokale verificatie. Publicatie op een openbaar domein maakt de code openbaar, niet de lokaal ingelezen inhoud.

De pagina laadt geen externe JavaScript-bibliotheken, analytics of lettertypen. `emmaus-logo.svg` bevat het originele Emmauscollege-logo lokaal en vraagt niets op van een externe website. De CSP staat naast eigen bestanden alleen verbinding met de GitHub API toe voor bronimport en expliciet gekozen wijzigingsvoorstellen. Andere externe verbindingen vanuit JavaScript zijn niet toegestaan. Exports worden lokaal gegenereerd. PDF loopt via het afdrukvenster van de browser.

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
- De brongegevens worden apart uit de ingestelde GitHub-bron geladen; de gepubliceerde inventaris is daar openbaar.

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

De uitklapbare zijbalk bevat **Gegevens beheren**. De editor werkt voor dertien registers: toepassingen, AI-functies, Entra, technische onderdelen, kandidaten, controles, DPIA, AI-beheer, apparaten, licenties, werkacties, softwarecontroles en veelgestelde vragen. Per type verschijnen de juiste invulvelden. Originele Excelteksten, bronnummers, bronrijen en herkomst blijven bewaard.

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


## Dashboardweergaven

De bestaande Dashboardmaker gebruikt de acht bronregistergroepen en negen onderdelen.
De verdeling heeft vijf expliciete weergavekeuzes: dunne lijnen, staaf, ring,
tegels en tabel. Ring, staaf, tegels en tabel gebruiken de bestaande gedeelde
visualisatierenderers. De kruistabel heeft een matrix- en lijstweergave. De
keuze wordt in de browser bewaard naast de indeling; de bron-JSON verandert niet.
Op mobiel worden onderdelen in de gewone documentstroom onder elkaar geplaatst,
met een afzonderlijk scrollbaar dashboardvlak. De laadillustratie blijft in
haar eigen ruimte. De afzonderlijke Builder uit PR #358 is hier niet inbegrepen.
