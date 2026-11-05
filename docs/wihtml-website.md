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
- Ontwikkelbranch: `feat/lessengenerator-eai-design`
- Bronbestand: `index.html`
- Bronblob-SHA: `782f62f9db11c584e6eba69ea7b5cea8f567df04`
- Git-commit voor studio-implementatie: `72b14b62c9e666197382b8c63ac84999e06c2087`

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

De volledige oorspronkelijke v9-les is als eigen bestand aanwezig in `content/wihtml/verdubbelen-halveren-v9.html` en wordt byte-voor-byte gepubliceerd. De algemene generator heeft inmiddels een uitgebreide docenttoolbox. De algemene generator heeft zeven configureerbare lesonderdelen: tekst, meerkeuze, exponentieel grafiekonderzoek, stapsgewijze uitwerking, onderzoekstabel, zelfstandig oefenen met hints en oplossingen, en verklaren en vergelijken.

De docent kan voor de import een lesroute, vlakverdeling en docenttools kiezen. WiHTML ondersteunt ook JSON zonder dia-indeling: losse `inhoud`, `vragen` en `opgaven` worden omgezet naar lesonderdelen. Een gekozen route ordent de onderdelen zonder ze te verwijderen. Een vlakverdeling kan voor de hele les of per dia gelden; functiekeuzes worden in het zelfstandige lesbestand opgeslagen. De docent kan een nieuwe les beginnen met een eigen ID voor stemrondes. De volledige v9-voorbeeldles blijft beschikbaar voor lesinteracties die specifiek voor die les zijn gebouwd. Niet elk gespecialiseerd rekeninstrument uit v9 is één-op-één overgenomen.
