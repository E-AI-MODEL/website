# EAIgit: productafspraken en toetsbare gebruikersroutes

Status: productafspraken voor `/tools/eaigit/` en de twee ondersteunende pagina's. Dit document is geen bewijs dat een functie werkt; de tests en browserproeven moeten dat afzonderlijk aantonen.

## Wat EAIgit is

EAIgit helpt mensen hun project te begrijpen, onderzoeken, verbeteren, delen en controleren. De eerste route werkt zonder AI-model, zonder GitHub-account en zonder server waar een ZIP naartoe wordt gestuurd. Een openbare GitHub-repository kan met de publieke GitHub API worden onderzocht; daarvoor is wel netwerktoegang nodig.

De gebruiker kiest een doel. EAIgit bepaalt welke bronnen nodig zijn, onderzoekt de ontvangen gegevens, noemt alleen controleerbare bevindingen en kiest daarop volgende handelingen. Bij elke handeling kan iemand vragen *waarom*, *hoe*, *hoe controleer ik het* en *wat als het niet lukt*. Zonder verplicht een prompt te kopiëren.

## Gebruikersroutes

| Route | Wat zelfstandig gebeurt | Wat nog menselijk werk is |
| --- | --- | --- |
| Ik begin met een ZIP | Lokale inventarisatie, bestandstypen, enkele statische inhouds- en verwijzingscontroles | Privégegevens beoordelen, GitHub-account aanmaken, delen of uploaden |
| Mijn project staat op GitHub | Openbare repository- en bestandslijst onderzoeken, beperkte statische inhoudscontrole | Uitgevoerde tests beoordelen, wijzigingen doorvoeren |
| ZIP en GitHub | Bestanden en waar mogelijk inhoud vergelijken, ontbrekende en afwijkende bestanden onderscheiden | Bepalen welke versie klopt en wat mag worden overschreven |
| Controleren of verbeteren | Bestaande code en verwijzingen onderzoeken, problemen en onbekende uitkomsten tonen | De werkelijke functie reproduceren, een gerichte reparatie goedkeuren en testen |
| Website publiceren | Bestandsstructuur en mogelijke publicatievoorwaarden onderzoeken | Hosting kiezen, publiceren, openbare URL en gebruikersfunctie testen |
| Nog geen bron | Uitleg en een volgende zoek- of voorbereidingshandeling aanbieden | ZIP/repository kiezen; geen schijnanalyse doen |

Onderzoeken of herstellen mag **niet verplicht eerst via een nieuwe GitHub-repository lopen**. Extra hulp is beschikbaar zonder de bestaande wizardroute te verlaten.

## Twee manieren van begeleiden

- **Met uitleg**: één handeling in gewone taal, waarom die nodig is, een concreet controlepunt, en hulp bij vastlopen. Geen vooraf vereist technisch vocabulaire.
- **Ik ken GitHub al**: dezelfde werkelijke gegevens en beperkingen, maar compactere technische instructies. Niet alleen een cosmetische schakelaar. Overzicht en navigatie per stap zijn beschikbaar.

De keuze bepaalt hoeveel uitleg iemand krijgt, niet wat het systeem als bewezen presenteert. Niemand krijgt minder veiligheidscontroles vanwege een ervaren modus.

## Bewijs en status

EAIgit maakt onderscheid tussen:

- **Onderzocht**: de aangegeven bron is echt lokaal of via de openbare API gelezen.
- **Beperkt**: slechts een deel is leesbaar of onderzocht.
- **Niet onderzocht**: er is nog geen bruikbare bron of vergelijking.
- **Voorgesteld**: EAIgit heeft een vervolgstap gemaakt; die stap is niet uitgevoerd.
- **Toestemming nodig**: schrijven of publiceren mag nog niet plaatsvinden.
- **Niet getest**: de echte gebruikersfunctie, testuitvoering of live website is niet gecontroleerd.

Dit zijn beschrijvingen van wat EAIgit daadwerkelijk deed, geen vervanging van de strengere EAI Work-bewijsstatussen `unknown → assumption → claim → observed → checked → proven`. Een groen CI-resultaat zonder relevante functietest bewijst de functie niet. Handmatig afvinken is geen uitgevoerde test en geen onafhankelijk bewijs.

Een advies of statisch bestandsonderzoek mag nooit worden gepresenteerd als: project werkt, publicatie geslaagd, of alle bestanden veilig. EAIgit verzint geen ontbrekende brongegevens, uitvoer of toestemming.

## Waar EAI Work werkelijk wordt gebruikt

EAIgit gebruikt de opbouw van `MissionPlan v1`: expliciete taken, afhankelijkheden en fases. Het lokale werkplan wordt gecontroleerd op ongeldige verwijzingen en cirkels. De contractproef in `scripts/test_projecthulp_eaiwork.mjs` haalt de echte EAI Work-broncode op en valideert vijf EAIgit-browserplannen met `validateMissionPlan` en `inspectMissionPlan`.

De browser **start op dit moment geen EAI Work-Operations-server, Worker Registry of EAIwork-workers**. In de aparte EAI Work-contractproef lopen wel twee echte lokale tekstadapters; de andere taken zijn in die proef niet uitgevoerd. EAIgit heeft zelf al zelfstandige ZIP-, repository- en statische controles in `assets/projecthulp/`, via een browserworker. De gedeelde taakcontracten mogen niet worden voorgesteld als reeds uitgevoerde EAI Work-workers.

Een productregel die voorschrijft dat schrijven apart akkoord vereist, is **niet** een citaat of toestemming van de gebruiker. Daarom blijven schrijf- en publicatievoorstellen buiten het uitvoerbare lokale werkplan, in `pendingDecisions`. EAIgit schrijft of publiceert niets.

## Schermen en navigatie

- **Wizard**: `/tools/eaigit/` is altijd het beginpunt, met alleen het EAIgit-logo en navigatie naar Uitleg en Opdrachten.
- **Uitleg**: `/tools/eaigit/hulp/` geeft uitleg passend bij een concrete handeling. Van daar terug naar de wizard.
- **Opdrachten**: `/tools/eaigit/prompts/` biedt **optionele** AI-opdrachten, bereikbaar vanuit een specifieke stap of via een korte taakkeuze. Geen algemene projectvelden als verplichte start, geen tweede EAI-model-logo. Zonder AI blijft de wizard bruikbaar.
- Op telefoon en desktop moet de gebruiker altijd bij een vorige stap kunnen terugkomen, hulp kunnen openen en het onderscheid tussen uitgevoerde controle en vervolgstap kunnen zien.
- Geen loze introducties zoals 'vul deze gegevens één keer in' als die invoer niet nodig is om verder te kunnen.

## Proeven voordat publicatie wordt vrijgegeven

De tests moeten minimaal aantonen:

1. Zonder ZIP of repository geen 'bestanden onderzocht' of 'project werkt'.
2. Een ZIP met gevoelige bestandsnamen blijft lokaal en krijgt de juiste waarschuwing.
3. Een repository met alleen een ZIP wordt niet als volwaardig uitgepakt project beschouwd.
4. Een niet-bestaande lokale verwijzing krijgt een herleidbare bevinding.
5. Een oefenapp toont een echte controleopdracht voor de gebruiker, niet een verzonnen geslaagde functietest.
6. Repareren en onderzoeken werkt zonder vooraf een GitHub-account te eisen.
7. Een nieuw aangemaakte repository heeft een geldige link nodig voordat de uploadinstructie verdergaat.
8. Ervaren modus geeft andere, preciezere instructies, zonder de bewijslast te verlagen.
9. De mobiele prompts bevatten precies één EAIgit-logo en hebben geen horizontale overloop.
10. Browsercontroles gebruiken geen AI-model en doen geen uploads of externe schrijftaken.
11. De lokale taakplannen slagen voor de echte EAI Work-structuurcontrole; niets wordt als goedgekeurd of uitgevoerd voorgesteld voordat dat aantoonbaar is.

**Vrijgave:** eerst de relevante tests en visuele gebruikersroutes op de ontwikkelbranch. Daarna merge en de daadwerkelijke gepubliceerde pagina's afzonderlijk controleren. Een succesvolle bouwcontrole alleen is niet voldoende.

## Bestanden

- `tools/eaigit/index.html`, `assets/eaigit/wizard.mjs`, `assets/eaigit/journey.mjs`: gebruikersroute
- `assets/projecthulp/`: onafhankelijke browseranalyse
- `assets/eaigit/work-plan.mjs`: lokaal taakplan, status en voorstellen
- `tools/eaigit/hulp/index.html`: uitleg
- `tools/eaigit/prompts/index.html`, `assets/eaigit/prompts-page.mjs`: extra AI-opdrachten
- `tests/test_eaigit_help.mjs`, `scripts/test_projecthulp_browser.mjs`: logische en browserproeven
- `scripts/test_projecthulp_eaiwork.mjs`: werkelijke EAI Work-contracttoets
