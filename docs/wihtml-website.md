# WiHTML op eaimodel.nl

WiHTML heeft een eigen GitHub-repository: https://github.com/E-AI-MODEL/wihtml

De website publiceert drie routes:

- `/tools/wihtml/`: introductie met uitleg voor docenten;
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

De editor biedt geen server-side AI-generatie, automatische wiskundecontrole of gemeenschappelijke lesbibliotheek. Dat zijn afzonderlijke uitbreidingen, met extra beveiliging en opslagafspraken.

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
