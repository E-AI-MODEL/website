# Tactische onderbouwing Sport en bewegen

Deze map maakt onderscheid tussen **gemeten wedstrijdgegevens**, **onderzochte tactische patronen** en **ontwerpkeuzes voor het onderwijsmodel**. De positiecoördinaten in `tools/lo-aanvalslab/index.html` zijn nog **niet** op echte 4-tegen-3-wedstrijden gefit. Een slagingstest van de simulatie bewijst geen wedstrijdrealiteit.

| Sport | Open bron | Relevante gemeten situatie | Vertaling naar oefening | Grens |
|---|---|---|---|---|
| Voetbal | [Leser e.a. 2019](https://doi.org/10.26582/k.51.1.7), 279 gevolgde 3-tegen-2-aanvallen van jeugdspelers | Opstellingen, passrichting en verdedigingsafstand rond laatste pass en schot; gevaarlijk patroon via flank, terug naar midden | Laat de leerling kiezen tussen flank, terugleggen, afschermen en directe aanval. Niet vooraf een vrije schotbaan schenken | De ruwe 279 bewegingsreeksen zijn hier niet als open dataset beschikbaar; geen rechtstreeks afgeleide x/y-waarden |
| Voetbal | [Metrica Sports](https://github.com/metrica-sports/sample-data), [SkillCorner](https://github.com/SkillCorner/opendata), [StatsBomb Open Data](https://github.com/hudl/open-data) | Echte wedstrijden met bewegingen, balbezit en bij SkillCorner ook druk-/passvariabelen | Meet verdedigingsafstand, bereikbaarheid van aanspeellijnen, spelerbreedte en omschakeling | 11v11-profvoetbal is geen 3v2-schoolspel; StatsBomb 360 is geen doorlopende tracking; vergelijk niet zonder normalisatie |
| Hockey | [Mizawa e.a. 2022](https://doi.org/10.3389/fspor.2022.867743), 3-tegen-3 | Verdedigingsdruk langs de hele passbaan en tijd tussen ontvangen en spelen; hoge druk bij vertraagde pass | Vergelijk korte en lange balbezittijd én verdediger langs passlijn; niet alleen afstand tot ontvanger | Geen onafhankelijke numerieke fit van interceptiekans in het huidige model |
| Hockey | [Lord e.a. 2023](https://doi.org/10.5114/biolsport.2023.118018), [open eventdata](https://github.com/felicitylord/Hockey-Analysis) | Balverplaatsingen en kansen per veldzone | Laat flank, cirkelbezit en directe balverplaatsing verschillen in uitkomst | Notatie- en balgegevens, geen volledige positiegegevens van alle verdedigers |
| Handbal | [Montoliu e.a. 2024, Zenodo](https://doi.org/10.5281/zenodo.12065335) | 10 wedstrijden, posities van gevolgd team per seconde; balbezit gelabeld als gelijk, overtal, ondertal, georganiseerd, tegenaanval en uitkomst | Vergelijk echte aanvalspatronen per numerieke situatie; alleen bronpercentages uit daadwerkelijk gelezen CSV rapporteren | Niet alle tegenstanders getrackt; geen kalibratie van individuele dekking of schoolsituaties. Dataset CC BY 4.0; citeer auteurs |
| Basketbal | [Diniz e.a. 2022](https://doi.org/10.1177/17479541211021986) | 45 beginnende leerlingen, 3v3 versus 3v2 versus neutrale extra speler | Leerlingen laten onderzoeken hoe overtal de passkwaliteit en verdediging beïnvloedt | Groepsverschillen leveren geen exacte 3v2-scoringskans of spelerscoördinaten |
| Basketbal | [Bredt e.a. 2022](https://doi.org/10.1177/17479541211053638) | Onderzoek naar 4v3 en veldgrootte | Extra aanvaller moet vrijlopen; verdediger kiest baldruk versus hulpverdediging | Geen automatische validatie van de simulatie |

## Werkelijk uitgelezen brondata op 13 november 2026

De onderstaande waarden komen uit **daadwerkelijk uitgevoerde GitHub Actions**, niet uit een verzonnen rekentabel. De scripts staan in deze map. [Run en bronresultaten](https://github.com/E-AI-MODEL/website/actions/workflows/lo-tactics-source.yml).

**Handbal, Zenodo 12065335:** `analyze_open_tactics.py` las 730 balbezitten. Aanval bij gelijk aantal spelers: 119 doelpunten bij 281 bezitten (42,3%); bij aanvallend overtal: 13 bij 45 (28,9%); bij ondertal: 15 bij 33 (45,5%). Dit zijn beschrijvende resultaten uit volwassen wedstrijden. Vooral de kleinere groepen zijn gevoelig voor wedstrijdcontext; lees overtal **niet** als minder effectief of ondertal als beter. `aanval_per_broncontext` splitst deze groepen verder uit naar aanvalstype en georganiseerd spel; percentages verschijnen alleen bij minstens tien situaties.

**Voetbal, StatsBomb Open Data, wedstrijd 3788741:** `analyze_open_football.py` las 1059 passevents, waarvan 906 een 360-frame met zichtbare verdedigers en bruikbare coördinaten hebben. In die deelverzameling zijn 751 passes geslaagd en 155 niet geslaagd. De mediaan van de kortste afstand van een zichtbare verdediger tot de passbaan bedroeg 3,30 (geslaagd) en 1,39 (niet geslaagd), in **StatsBomb 120×80-coordinaateenheden**, niet in meters. Niet-geslaagde passes waren ook langer. Het 360-beeld dekt niet het volledige veld. Geen van deze afstanden is op zichzelf een kans of een voorgeschreven modeldrempel.

**Bestaande modelmeting:** alle 64 standaardscenario's zijn in Chromium doorgerekend met één vaste startwaarde. Bij 35 veranderde het resultaat, het aantal passes of een berekende aankomstmarge na een beperkte aanvallende/verdedigende wijziging. Bij de overige 29 liet déze beperkte set wijzigingen dat effect niet zien. Dat betekent niet dat de scenarios geen keuzes kennen; het laat zien dat de huidige toets nog niet overal een tactisch verschil aantoont. Verdeling: voetbal 10/16, hockey 9/16, handbal 9/16, basketbal 7/16.

Voor iedere nieuwe tactische regel moet duidelijk blijven: welke bron leverde de vorm of het patroon, welke modelwaarde is alleen een keuze van de maker, en welke afwijking kan een leerling zelf veroorzaken? Publiceer geen wetenschappelijk percentage als geschatte scorekans van het spel.

## Modelregels en bewijslast

- Het model registreert een **doelpoging**, geen gescoord doelpunt. Een simulatie met veel schoten is niet gelijk aan een makkelijke score.
- De bestaande `passRisk` gebruikt berekende balvlucht, aankomsttijd, verdedigersafstand en voorwaartse ruimte. Gewichten en drempels zijn **aannames van het oefenmodel** totdat een passende positie- en gebeurtenissample ze toetst.
- Een verdedigende positie is pas tactisch onderzocht wanneer een *tegenfeitelijke* wijziging is getest: zelfde beginsituatie, één speler of opdracht veranderd, en effect op balverlies, afspeelmarge en doelpoging gecontroleerd.
- Een sterk team mag vanaf een gunstige positie een voordeel hebben. De uitdaging is een **betekenisvolle keuze**, geen kunstmatig gelijke uitkomst.
- **Geen universeel doelsuccespercentage of willekeurige 1,5-secondegrens als wetenschappelijke norm.** De technische regel dat er in de standaardstart niet direct geschoten wordt is een didactische acceptatievoorwaarde.
- `analyze_open_tactics.py` kan de echte handbalbezitten uit Zenodo lezen, groeperen en herkomst/omvang melden. De resultaten mogen pas als gemeten waarden worden gepubliceerd nadat de download en berekening werkelijk zijn uitgevoerd.
- **OpenStax** levert leerboeken en natuurwetenschappelijke uitleg. Het is geen bron met wedstrijdtracking voor teamtactiek.

## Volgende inhoudelijke toets

Leg voor elk van de 64 sport-/format-/scenario-combinaties minstens vast: waar staan de baldrager, potentiële ontvangers en verdedigers; welke passlijn is afgedekt; welke keuze verandert de uitkomst; welke bron draagt de tactische hypothese. Vergelijk 3v2/4v3 niet met volwassen 11v11-resultaten alsof het één populatie is.

**Status 13 november 2026:** bronnen geïdentificeerd; de huidige startcoördinaten en berekende passdrempels zijn nog niet rechtstreeks op open trackingdata gekalibreerd. Dit document is een onderzoeksprotocol, geen validatieverklaring.
