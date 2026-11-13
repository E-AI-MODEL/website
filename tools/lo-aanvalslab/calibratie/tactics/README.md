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
