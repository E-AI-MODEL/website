# WiHTML op eaimodel.nl

WiHTML heeft een eigen GitHub-repository: https://github.com/E-AI-MODEL/wihtml

De website publiceert een uitlegpagina, een bibliotheek en twee werk-/voorbeeldroutes:

- `/tools/wihtml/`: uitleg, startkeuzes en voorbeelden voor docenten;
- `/tools/wihtml/bibliotheek/`: filterbare verzameling voorbeeldlessen met een knop om een eigen kopie te openen;
- `/tools/wihtml/studio/`: de zelfstandige editor;
- `/tools/wihtml/voorbeeld/`: de complete oorspronkelijke Docentstudio-v9-les, met uitgewerkte interactieve lesinhoud en alle oorspronkelijke docenttools.
- `/tools/wihtml/voorbeeld-lesinhoud.json`: downloadbaar inhoudsbestand als voorbeeld.

De studio staat als gecontroleerde bronkopie in `content/wihtml/studio.html`. Tijdens de sitebuild kopieert `scripts/build_site.py` deze bron **ongewijzigd** naar de uiteindelijke website. De GitHub Action controleert de kopie en links. De editor draait volledig in de browser en verstuurt geen lesbestanden, HTML-sjablonen of stemgegevens naar GitHub.

## Waarom de studio niet rechtstreeks uit GitHub laadt

GitHub is geschikt voor versiebeheer, broncode, beoordeling en de bouw van een website. Het is geen opslagdienst voor klassikale antwoorden en geen uitvoerende server voor iedere bezoeker. Een lokale kopie voorkomt afhankelijkheid van GitHub tijdens de les en zorgt dat iedere docent dezelfde goedgekeurde versie gebruikt.

## Bijwerken vanuit wihtml

Bronversie waarmee deze route is opgebouwd:

- Repository: `E-AI-MODEL/wihtml`
- Ontwikkelbranch: `feat/visual-lesson-studio`
- Bronbestand: `index.html`
- Bronblob-SHA: `8211ebe9264f5f00452c1612868550e9a7cebb2f`
- Git-commit voor studio-implementatie: staat op de ontwikkelbranch; verifieer de exacte commit bij een volgende synchronisatie

Voor een volgende versie: controleer eerst dat de browsertests in `wihtml` geslaagd zijn. Werk daarna de bronkopie bij met een **volledige commit-SHA**:

```sh
python scripts/update_wihtml.py --commit <volledige-commit-sha> --write
python scripts/build_site.py --sources content/legacy --out site-build
python -m unittest discover -s tests -p test_wihtml_publish.py -v
```

Werk de commit en blob-SHA hierboven bij. Review de verschillen voordat je de websitebranch laat mergen. De publicatieworkflow zet alleen wijzigingen op `main` online.

## Gegevens en toegang

Er is geen account en geen externe opslag. De docent downloadt de les als JSON voor later bewerken en als HTML voor presenteren. Twee stemrondes worden lokaal in de browser opgeslagen; het betreft groepsaantallen. Bij wissen van browsergegevens of werken op een ander apparaat kunnen de aantallen verdwijnen. Laat docenten geen persoonsgegevens opnemen in sjablonen die zij publiek delen.

De editor biedt geen server-side AI-generatie of automatische wiskundecontrole. De bibliotheek bevat nu een kleine, door ons beheerde verzameling voorbeelden. Docenten kunnen hun eigen kopie maken, maar nog geen lessen publiek uploaden.

## Compleet voorbeeld en generator

De volledige oorspronkelijke v9-les is als eigen bestand aanwezig in `content/wihtml/verdubbelen-halveren-v9.html` en wordt byte-voor-byte gepubliceerd. De algemene generator heeft inmiddels een uitgebreide docenttoolbox. De algemene generator heeft negen configureerbare lesonderdelen: tekst, meerkeuze, begripsvragen in groepen, foutenanalyse, grafiekonderzoek met vier experimenten, stapsgewijze uitwerking, onderzoekstabel, zelfstandig oefenen met hulp en oplossingen, en verklaren en vergelijken.

De docent kan voor de import een lesroute, vlakverdeling en docenttools kiezen. WiHTML ondersteunt ook JSON zonder dia-indeling: losse `inhoud`, `vragen` en `opgaven` worden omgezet naar lesonderdelen. Een gekozen route ordent de onderdelen zonder ze te verwijderen. Een vlakverdeling kan voor de hele les of per dia gelden; functiekeuzes worden in het zelfstandige lesbestand opgeslagen. De docent kan een nieuwe les beginnen met een eigen ID voor stemrondes. De volledige v9-voorbeeldles blijft beschikbaar voor lesinteracties die specifiek voor die les zijn gebouwd. Niet elk gespecialiseerd rekeninstrument uit v9 is één-op-één overgenomen.

## Herstel van de interactieve HTML-export

De vorige export liet te weinig van de oorspronkelijke Docentstudio v9 zien. De nieuwe versie heeft weer aanklikbare antwoordkaarten, drie begripsvragen op een dia, vier grafiekexperimenten, een live formule en waardentabel, herhaalde stemming en vergelijking, foutenanalyse en uitwerkingen per opgave. De presentatie heeft een eigen digibordweergave met navigatie en docenttools.

De WiHTML-browsertest downloadt de HTML uit de editor, opent die opnieuw in Chromium en voert de genoemde handelingen uit. Bij de GitHub Actions-run worden ook screenshots en de gedownloade HTML bewaard. Dit test de technische functies, niet de leskwaliteit op ieder denkbaar scherm.

## Visuele lesbewerking

De docent krijgt nu een grote bewerkbare dia in plaats van een lang formulier. Titel, vraag, antwoord, tabel, oefeningen en uitwerkingen zijn op het voorbeeld te veranderen. Boven de dia kan de docent een werkvorm, vlakverdeling of kopie van het lesdeel kiezen. Dia's zijn in het overzicht te verslepen. Een aparte knop opent de geselecteerde dia in de volledige interactieve presentatie.

De keuze voor een sjabloon begint bij instellingen voor achtergrondkleur, tekstkleur, accent, lettertype en witruimte. Alleen de uitgebreide instellingen tonen de HTML en CSS. Het opgebouwde lesbestand blijft hetzelfde JSON-formaat en de zelfstandige HTML-export gebruikt de bestaande presentatieruntime.

Tijdens het werken wordt een lokaal concept bewaard in de browser. Dit is geen account of cloudopslag. De docent kan het concept na herladen herstellen en blijft verantwoordelijk voor het downloaden van een eigen lesbestand om op een ander apparaat door te gaan.

Dit ontwerp sluit aan bij de eerder gebruikte rustige opbouw van LEIF en het naast elkaar zien van invoer en resultaat in het EAI Prompt Framework. De preview in de editor is geschikt om inhoud te bewerken. De knop 'Bekijk deze dia' dient voor het testen van het daadwerkelijke 16:9-presentatiegedrag.

Chromium-tests controleren directe bewerking, export, mobiel gedrag en herstel van lokaal concept. Die controles zijn nog geen gebruikersonderzoek onder wiskundedocenten.

## Landingpagina, bibliotheek en startkeuze (november 2026)

De uitleg staat in `content/wihtml/landing.html`. De bibliotheekpagina staat in `content/wihtml/library.html`. De sitebouw publiceert ook twee bewerkbare voorbeeldlessen uit `content/wihtml/bibliotheek/` als JSON. De eerder gepubliceerde voorbeeld-JSON over groeifactoren blijft bestaan, net als de complete interactieve v9-les.

De studio toont bij een gewone opening eerst een keuze: lege les (één dia), een voorgestelde lesopbouw, eigen JSON importeren, naar de bibliotheek gaan of een lokaal concept herstellen. Een gekozen bibliotheekles wordt op basis van een vaste lijst aan toegestane paden geladen via `?lesson=groeifactor`, `?lesson=lineair` of `?lesson=kansen`. Met `&preview=1` start na het laden de interactieve presentatie. Dit maakt een eigen kopie, zonder het bibliotheekbestand te wijzigen.

Een eerder opgeslagen lokaal concept wordt niet stilzwijgend vervangen zodra iemand een bibliotheeklink opent. De docent krijgt eerst de keuze tussen dat concept herstellen en het gekozen voorbeeld openen. De startkeuze wordt niet getoond in een zelfstandig geëxporteerde HTML-presentatie. Na het kiezen van een nieuwe les of import werkt de bestaande editor en presentatieruntime zoals voorheen.

De broncode bewaart geen publiek ingezonden lessen. Meer voorbeelden worden voorlopig als beoordeelde JSON-bestanden toegevoegd. Voor publiek inzenden zijn later aparte afspraken over inhoud, rechten, privacy en controle nodig.

## Begeleide lesmaker (november 2026)

De Docentstudio toont na de keuze voor een nieuwe les, een bestaand concept of een bibliotheekvoorbeeld een begeleide reeks schermen. De bestaande lesgegevens blijven de enige bron. De publicatie en de zelfstandige HTML-export gebruiken dezelfde gegevens als voorheen.

De route volgt de werkelijke dia's van de les. Eerst vult de docent de lesnaam, het niveau en het doel in. Daarna komt elke dia afzonderlijk in beeld, met directe bewerking. In **Studio** volgt per dia een apart scherm voor de leerlingactiviteit, docentrol, lesfase en vlakverdeling. In **Snel** slaat de route die verdiepende schermen over. Na de dia's volgen de vormgeving, in Studio ook de docenttools, een controle en het resultaat met een knop om de volledige interactieve HTML te downloaden.

De knoppen **Vorige**, **Akkoord, volgende** en **Alle stappen** werken in beide modi. De bestaande editorfuncties, lesroutes, lokaal bewaren, JSON-import, bibliotheek en offline HTML-export blijven beschikbaar. Uitgebreide velden zijn in Studio bereikbaar in een aparte dialoog, niet als lang formulier onder de dia. Een zelfstandige export opent uitsluitend in de presentatieweergave en toont nooit het bewerkscherm.

De code staat in `content/wihtml/studio.html`. De uitgeschreven stroom wordt getest in `scripts/ui_smoke.mjs`, en de publicatietests controleren de aanwezigheid van alle stappen. Voor productie blijft een eigen UI- en toegankelijkheidscontrole verstandig.

## Rustige lesroute

De landingspagina heeft één duidelijke ingang voor een nieuwe les. De link `?start=nieuw` opent meteen de eerste vraag, zonder nogmaals een startscherm. De bibliotheek, JSON-import en het herstellen van een eerder concept blijven bereikbaar via afzonderlijke links. De docent hoeft geen account te maken.

De begeleide lesmaker stelt kleine vragen op aparte schermen. Eerst de naam van de les, dan het niveau, het leerdoel en de opbouw. Een routekeuze op een nog lege les maakt passende startdia's. Op een bestaande les herschikt dezelfde keuze de dia's zonder inhoud te verwijderen.

Vervolgens werk je iedere dia af: werkvorm kiezen, inhoud direct op de dia aanpassen en beschrijven wat leerlingen eerst zelfstandig doen. In **Studio** komen nog twee eigen schermen per dia bij: de hulp en handelingen van de docent, en de lesfase en vlakverdeling. De uitgebreide velden zijn te openen zonder de lesmaker te verlaten. Dia's kopiëren, verplaatsen en verwijderen zitten achter 'Dia beheren', zodat ze bereikbaar blijven zonder steeds zichtbaar te zijn.

De laatste schermen gaan over vormgeving, de docenttools (Studio), controle en het resultaat. Op het resultaatscherm staat de zelfstandige interactieve HTML-presentatie direct als afgeschermde voorvertoning. De knop Download HTML gebruikt precies dezelfde generatiecode. Voor verder bewerken kan de docent een JSON-lesbestand downloaden.

De browser bewaart de laatst gebruikte stap bij de lokale les. Na het herstellen van een concept wordt die stap heropend wanneer de lesidentificatie overeenkomt. Er is geen cloudopslag. De combinatie van JavaScript, JSON en een HTML-sjabloon blijft in de eigen browser.

De regressietest doorloopt de landingspagina, afzonderlijke stappen, beide modi, een gekozen lesroute, de werkende voorvertoning, de offline export, import en herstel. Die test bewijst technische werking; docenten moeten de begrijpelijkheid en didactische ondersteuning nog in gebruik beoordelen.

## Visuele en gegevenscontrole (5 november 2026)

De Playwright-screenshots van de hele route lieten dubbele vraagkoppen, te veel mobiele bovenbediening, een slecht leesbare diatitel op het donkere bord en een zwevende balk over het HTML-resultaat zien. Dit is in de PR verbeterd. De browsertest controleert nu ook het kleurcontrast van de donkere titel en dat de balk het eindscherm niet bedekt. De afbeeldingen worden bij iedere browsertest als GitHub Actions-artifact opgeslagen.

De docent krijgt bij het vervangen van een geopende les door een nieuwe les of een JSON-import een bevestigingsvraag. Annuleren laat de huidige les ongewijzigd. Een snelle paginaverversing bewaart de laatst ingevoerde lesgegevens en de stap samen.

De screenshots zijn een technische en visuele controle van enkele vastgelegde schermgroottes. De gebruikservaring, wiskundige inhoud en werking op een fysiek digibord zijn daarmee niet definitief gevalideerd.
