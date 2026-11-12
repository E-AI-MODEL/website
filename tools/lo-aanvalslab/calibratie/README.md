# LO Aanvalslab: meetbasis v12 (12 november 2026)

De spelomgeving is een didactisch 2-tegen-1 / 3-tegen-2 / 4-tegen-3 / 4-tegen-4-model. Deze map maakt zichtbaar welke parameters tegen echte observaties zijn gehouden. **Dit is geen validatie met een onafhankelijke wedstrijdtestset.** De uitkomsten mogen niet als voorspelde winstkansen of individuele leerlingprestaties worden gelezen.

## Voetbal: beperkte empirische passlengte-afstelling

- **Oorspronkelijke dataset:** [Metrica Sports/sample-data](https://github.com/metrica-sports/sample-data), de officiële bestanden `Sample_Game_1_RawEventsData.csv` en `Sample_Game_2_RawEventsData.csv`.
- **Waarnemingen:** 84 handmatig geselecteerde `PASS`-records uit verspreide eerste-helftpassages van de twee wedstrijden. De broncoordinates zijn `[0,1]` op 105 × 68 m; voor de statistiek zijn ook enkele eventpunten vlak buiten de lijn behouden.
- **Berekening:** voor elke pass `sqrt(((endX-startX)*105)^2 + ((endY-startY)*68)^2)` m. Mediaan 14,60 m; middelste 50% van 9,94 tot 21,12 m.
- **Omgerekende vergelijking:** mediaan als aandeel van de lange zijde = 14,60/105 = 0,1391. Op een oefenveld van 44,5 m is dat 6,19 m. Deze normalisatie is een *ontwerpkeuze*, geen empirische norm voor schoolvoetbal.
- **Werkelijke toepassing:** in de passkwaliteit wordt een kleine afstandsafwijking van 6,19 m meegewogen, met coëfficiënt 0,4 en een maximum van 21 punten. De interceptieberekening en passsnelheid worden hierdoor niet uit deze eventgegevens afgeleid.
- **3 tegen 2:** [Leser e.a., 279 jeugdspelsituaties, DOI 10.26582/k.51.1.7](https://doi.org/10.26582/k.51.1.7) ondersteunt het geven van een bescheiden tactische voorkeur aan een teruggelegde pass vanaf de flank richting centrum. De gerapporteerde doelpercentages worden **niet** als simulatiewaarschijnlijkheid gebruikt.

`metrica_pass_excerpt.csv` bevat de beperkte coördinatensteekproef; `measure_excerpt.py` berekent de statistieken; `metrica_excerpt_metrics.json` is de vastgelegde uitvoer. De volledige dataset blijft bij de oorspronkelijke uitgever. Metrica vraagt bronvermelding bij publiek gebruik; deze bron is in de HTML en hier vermeld.

## Basketbal: kort spelscenario tegen gepubliceerd 3-tegen-3-kengetal

- **Bron:** [Willberg e.a. (2022), DOI 10.1177/17479541211067989](https://doi.org/10.1177/17479541211067989): 84 wedstrijden, 90 atleten; bij 3-tegen-3 gemiddeld 5,4 s balbezit en 1,4 passes.
- **Vooraf:** met de vier standaard-3-tegen-2-opstellingen, vaste startwaarde 1337, gemiddeld 2,94 s en 1,00 passes.
- **Na aanpassing:** een later schotmoment (`shotX` van 660 naar 785 tekenpixels) geeft in dezelfde vier tests gemiddeld 4,95 s en 1,50 passes.
- **Beperking:** 3-tegen-2 is niet hetzelfde als 3-tegen-3 en vier modelscenario's zijn geen representatieve wedstrijdsteekproef. Voor 4-tegen-4 wijken de passaantallen sterker af. De publicatie is een referentiewaarde, geen rauwe NBA-timingdataset die al door de code is verwerkt.

## Handbal: onderbouwde richting, geen numerieke schatting van reactietijden

- **Bron:** [Lefèvre e.a. (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10431627/): bij georganiseerde verdediging 558,8 ± 53,9 m/10 min tegenover 870,3 ± 145,7 m/10 min in aanval.
- **Aanpassing:** spelers die dekking, passlijnen of een zone bewaken bewegen bij handbal gerichter en langzamer (`coverPace = 0,82`); een speler die daadwerkelijk druk zet houdt zijn oorspronkelijke maximale versnelling.
- **Beperking:** de 0,82 is een conservatieve ontwerpafstelling en **niet** door regressie uit deze publicatie geschat. Een korte balbezitsimulatie is niet rechtstreeks vergelijkbaar met een fasegemiddelde over tien minuten. De beschikbare [Montoliu e.a.-dataset](https://zenodo.org/records/12065335) bevat 1 Hz-posities, maar is nog niet doorgerekend als bron voor modelcoëfficiënten.

## Hockey: veldrichting gesteund door onderzoek, geen trackingfit

- **Bron:** [Lord e.a. (2022), 131 FIH-wedstrijden](https://pmc.ncbi.nlm.nih.gov/articles/PMC10108760/): grotere cirkelbetrokkenheid en directe balbeweging naar doel vanuit de diepe aanval hangen samen met schotkansen.
- **Aanpassing:** een beperkte voorkeur (+9 in de heuristische passkwaliteit) voor een veilige bal naar de doelzone. **Geen** empirisch afgeleide pass- of onderscheppingskans.
- **Beperking:** brondata betreffen veldzones in plaats van complete 2D-spelertrajecten. De factor is handmatig gekozen, niet op de 131 wedstrijden gefit.

## Technische controle

De ontwikkelproef rekent 2.304 simulaties (4 sporten × 4 teamgroottes × 4 starts × 6 verdedigingsopdrachten × 6 startwaarden). Daarnaast: 384 bewegingsproeven, gericht onderscheppen/blokkeren, drie schermformaten en een lokale test van twee gescheiden online spelers. Deze tests bewaken codegedrag, **niet** de nauwkeurigheid tegenover echte wedstrijden.

**Nog nodig voor echte kalibratie per sport:** volledige tracking- en eventbestanden verwerken, pass- en drukmomenten labelen, meetfouten en selectiebias controleren, coëfficiënten op een trainingsdeel schatten en op andere wedstrijden uit dezelfde sport toetsen. Voor LO-gebruik blijft extra vergelijking met leerlingen van belang.