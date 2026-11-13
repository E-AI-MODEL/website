# Verdediging in het LO Aanvalslab: datasets en meetplan

Status: **onderzoeks- en proefversie, 13 november 2026**. De nieuwe verdedigingsrollen zijn nog **niet** afgesteld of gevalideerd met de hieronder genoemde trackingdata. Een groene programmeertest is geen wedstrijdvalidatie.

## Wat is er nu onderzocht?

| Dataset | Beschikbare gegevens | Waarvoor bruikbaar | Grens |
| --- | --- | --- | --- |
| DFL / Sportec IDSSE, Bassek e.a. (2025) | 7 volledige Bundesliga-wedstrijden, 25 Hz, 1.002.644 trackingframes van spelers en bal, gesynchroniseerde gebeurtenissen, CC BY 4.0 | Druk op bal, positie tweede verdediger, onderlinge afstanden, rolwisselingen, passbescherming en reacties op balverplaatsing | Profvoetbal 11-tegen-11 is niet hetzelfde als LO 3-tegen-2 |
| SkillCorner Open Data | 10 wedstrijden A-League 2024/25, videotracking op 10 Hz, inclusief balposities, spelers en afgeleide gebeurtenissen | Externe toets op andere wedstrijden en dynamiek | Niet iedere speler is in beeld; sommige posities zijn geëxtrapoleerd |
| Metrica Sports Sample Data | 2 volledige wedstrijden met CSV-tracking en een derde in FIFA/EPTS-formaat | Al in het project; geschikt als herhaalbare controle met spelers en bal | Kleine verzameling onafhankelijke wedstrijden |
| GNSS Football Tactical, Zhang e.a. (2025) | Kleine-partij-vorm sample, 6 GNSS-spelers op 10 Hz en verwerkingscode | Controle van afstanden, veldschaling en kleine-partij-kenmerken | Demonstratiesample, niet volledig geannoteerde verdedigingsbeslissingen |
| PlayNet handbal, Mures e.a. (2023) | Circa 1 miljoen frames uit 5 wedstrijden; genormaliseerde posities en spelfasen | Teamspreiding en beweging tijdens verschillende spelfasen | De positievolgorde is mede op snelheid gesorteerd; niet zonder extra verwerking geschikt om één verdediger over langere tijd te volgen |
| Montoliu e.a. (2024), handbal | 84.691 UWB-posities over 10 wedstrijden, 1 Hz, labels voor aanval en verdediging | Bewegingssnelheden en spreiding | Te weinig temporele resolutie voor precieze reacties en onderscheppingen |
| Lord e.a., veldhockey | 131 interlands met balverplaatsing en gebeurtenissen | Spelrichting, balroutes en ruimtelijke aanvalspatronen | Geen volledige continue posities van alle verdedigers |

### Bronnen

- DFL/Sportec: https://doi.org/10.1038/s41597-025-04505-y en https://github.com/spoho-datascience/idsse-data ; stabiele spiegel: https://huggingface.co/datasets/pysport/idsse-data
- SkillCorner: https://skillcorner.github.io/opendata/
- Metrica: https://github.com/metrica-sports/sample-data/
- GNSS voorbeeld: https://github.com/latilongitude/gnss_footballtactical
- PlayNet: https://pmc.ncbi.nlm.nih.gov/articles/PMC10749262/
- Handbal UWB: https://pmc.ncbi.nlm.nih.gov/articles/PMC11609672/
- Veldhockey: https://pmc.ncbi.nlm.nih.gov/articles/PMC10108760/
- Spelvormen en collectief gedrag: https://pmc.ncbi.nlm.nih.gov/articles/PMC4769238/

## Wetenschappelijk onderzoek achter de ontwerpkeuzes

De volgende bronnen helpen bepalen **welke gedragingen** we moeten onderzoeken. Ze leveren niet vanzelf getallen voor het Aanvalslab.

- **Coito e.a. (2022)**: systematisch overzicht van 31 studies over tactische tracking in kleine partijvormen. De analyse benoemt onder meer balans, speelruimte, breedte, lengte en onderlinge afstand. Dit onderbouwt de **keuze van meetvariabelen**, niet de precieze streefwaarden. https://pubmed.ncbi.nlm.nih.gov/33030987/
- **Fernandes e.a. (2021)**: analyse van verdedigingsgedrag tijdens 32 WK-wedstrijden, met terugkerende patronen van druk op de bal, ondersteuning door de tweede en derde verdediger, en het bewaken van ruimte. Dit onderbouwt **gecoördineerde rollen** als ontwerpprincipe. Het is geen positioneel trackingbestand voor modelafstelling. https://pubmed.ncbi.nlm.nih.gov/34938248/
- **FIFA Training Centre (2026)**: concrete oefenvormen 2-tegen-2, 2-tegen-3 en 3-tegen-3 met druk zetten, rugdekking en aanspeellijnen beschermen. **Praktijkadvies**, geen gecontroleerde vergelijkingsstudie. https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/zonal-defending/developing-defensive-coordination-in-small-groups.php
- **Bundesliga-onderzoek naar verdedigingscompactheid (2023/24)**: gegevens uit 153 wedstrijden laten zien dat compactheid van de vijf verdedigers dicht bij de bal zwak samenhangt met succesvolle verdediging, terwijl compactheid van het hele team niet duidelijk onderscheid maakt. **Geen bewijs** dat alle verdedigers altijd dicht bij elkaar moeten staan. https://doi.org/10.1177/17479541231172695
- **Jeugdvoetbal in kleine partijen (2018)**: onderzoek naar taakvoorwaarden koppelt herkenbare verdedigingsacties aan passlijnen blokkeren, druk zetten, dekking en ruimte bezetten. De ontwerpprincipes zijn bruikbaar voor lesoefeningen, niet als rechtstreeks gemeten parameters. https://pmc.ncbi.nlm.nih.gov/articles/PMC5761879/

### Directe gegevenscontrole, november 2026

Voor **GNSS Football Tactical** zijn de zes openbare U18-bestanden daadwerkelijk door het analyseprogramma gelezen en gecontroleerd. De data gebruiken Excel-datumwaarden; die worden eerst naar seconden omgerekend. De spelers zijn elk tientallen duizenden keren gevolgd, maar vertegenwoordigen slechts zes individuele meetreeksen. Een deel van de opname betreft stilstaan of rust. De bewegingssnelheden zijn daarmee hooguit een onafhankelijke plausibiliteitscontrole. Er zitten **geen verdedigingstaaklabels, balposities of tactische uitkomsten** in deze sample.

De code om de gegevens opnieuw op te halen en na te rekenen staat in `scripts/lo_gnss_reference.py`. Het broncommit is vastgezet op `f70b925c94e54c5be244917803f07da7c55101b4`. Rapportage en log komen uit de GitHub Actions-controle. Niet doen alsof deze zes personen een aparte steekproef van zes wedstrijden zijn.

## Uitgevoerde meetronde: 13 november 2026

De nieuwe verdediging is in 128 vaste spelsimulaties (vier sporten × vier spelverhoudingen × vier beginsituaties × twee seeds) vergeleken met de gepubliceerde versie. Alle resultaten, ook de ongunstige, staan in [`defence-benchmark-2026-11-13.json`](./defence-benchmark-2026-11-13.json). De broncode voor de herhaling staat in `scripts/benchmark_lo_defence.py`, `scripts/trace_lo_defence.py` en `scripts/lo_gnss_reference.py`.

De gekozen meetwaarde *abrupte koersomkering* vergelijkt twee opeenvolgende bewegingsvensters van een halve seconde, uitsluitend bij spelers die in beide vensters sneller dan 0,65 m/s bewegen. Het gaat om het aantal omkeringen per duizend meetmomenten, niet per duizend spelers of wedstrijden. Ook een echt verdedigende koerswijziging kan terecht zijn.

| Sport | Oud: koersomkeringen / 1.000 | Nieuw: koersomkeringen / 1.000 | Rugdekker doelzijde, nieuw | Specifiek 3v2: doelzijde, nieuw |
|---|---:|---:|---:|---:|
| Voetbal | 47,3 | 24,2 | 63% | 43% |
| Hockey | 29,0 | 14,9 | 53% | 64% |
| Handbal | 13,4 | 5,2 | 52% | 51% |
| Basketbal | 34,2 | 28,8 | 58% | 46% |

**Wat verbeterde:** tijdens een balvlucht worden druk en rugdekking niet om de fractie van een seconde opnieuw toegewezen. De verdedigende loopbanen hebben in de geteste voorbeelden minder plotselinge omkeringen. De mandekker blijft meer bij zijn aanvaller. Het model geeft maximaal één onderscheppingspoging tegelijk de voorrang.

**Wat niet vaststaat:** de percentages zijn uit de eigen simulatie afgeleid. Voor een goede rugdekker is 'aan de doelzijde' slechts één voorwaarde. In 3v2 mist het model dat nog in veel situaties. De afstand tussen rugdekker en bal blijft regelmatig groot, en ook het aantal doelpogingen beweegt niet in elke sport dezelfde richting. Deze metingen vormen geen bewijs dat de nieuwe variant echte spelsituaties goed voorspelt.

De zes openbare U18-GNSS-bestanden zijn daadwerkelijk ingelezen: samen 205.517 tijdregistraties, met afzonderlijke snelheidsberekeningen en koersomkeringen. De geobserveerde koersomkeringen per 1.000 actieve meetmomenten lopen bij deze zes spelers van 5,6 tot 18,2. Daarmee hebben we een onafhankelijke controle op de *orde van grootte van bewegen*, maar geen valide vergelijking van verdedigingsgedrag: de U18-traces bevatten geen balposities, teamrollen of labels voor druk, rugdekking en dekking. De zes spelers zijn ook geen onafhankelijke wedstrijdsteekproeven. Een modelcijfer dat toevallig binnen het GNSS-bereik valt, geldt niet als kalibratie.

De twee beschikbare Metrica-wedstrijden zijn inmiddels ook opnieuw uitgelezen, met zowel het aanvallende als het verdedigende team en de bal. Van 286.162 frames konden 4.504 steekproefmomenten (ongeveer één per seconde) worden gebruikt met een voldoende duidelijke proxy voor balbezit en de oriëntatie van beide teams. Daarbij stond de op één na dichtstbijzijnde verdediger in wedstrijd 1 in 71,2% en in wedstrijd 2 in 70,2% van deze momenten aan de vermoedelijke doelzijde. Zijn mediane afstand tot de bal was respectievelijk 10,54 en 9,70 meter. De gemeten speler is níét automatisch de tactische rugdekker. Ook de doelrichting is met teamcentra geschat, niet handmatig gecontroleerd. De duizenden opeenvolgende momenten zijn afkomstig uit slechts twee onafhankelijke wedstrijden.

Dit ondersteunt het meten van doelzijdige positie en onderlinge afstand met echte trackinggegevens, maar het rechtvaardigt **niet** om de percentages of afstanden als vaste normen in het kleine LO-spel over te nemen. De analyse is reproduceerbaar via `scripts/lo_metrica_defence_reference.py`; de aggregaten, bron en beperkingen zijn toegevoegd aan `defence-benchmark-2026-11-13.json`. Een echte toets op rolkeuzes vraagt een bron met betrouwbaar gemarkeerde drukzetters en rugdekkers, of onafhankelijke beoordeling van afzonderlijke situaties.

**Releasebesluit: nog niet publiceren.** De code- en browsertests zijn geslaagd, maar de nieuwe kandidaat is nog niet gecontroleerd op daadwerkelijke verdedigingsrollen met onafhankelijke tracking uit volledige wedstrijden of door een LO-vakdocent op een geblindeerde reeks. De brondata van DFL/Sportec en SkillCorner zijn geïnventariseerd, maar niet met deze kandidaat doorlopen voor tactische kalibratie. Dit blijft een aparte conceptversie, zonder wijziging van de openbare spelregels.

## Controleerbare vragen

Deze metingen horen vóór een release te worden uitgevoerd op **onafhankelijke spelsituaties**, niet op een willekeurige verdeling van opeenvolgende frames uit één wedstrijd.

1. **Wie zet druk?** Meet hoe vaak de eerste verdediger wisselt en hoe die wissel samenhangt met balbezit, snelheid en dreiging. Onverklaarbare wissels om de paar frames moeten afnemen.
2. **Wie geeft rugdekking?** Meet per situatie of minstens één tweede verdediger de ruimte richting doel bewaakt en bereikbaar blijft. Leg afstand, hoek en dekking van gevaarlijke routes vast.
3. **Wie bewaakt welke pass?** Meet hoeveel verdedigers dezelfde ontvanger najagen en hoeveel aanspeelbare tegenstanders ongedekt blijven.
4. **Hoe compact blijft het team?** Meet centroid, breedte, diepte, onderlinge afstanden en afstand tot eigen doel, voor en na een pass of dribbel.
5. **Bewegen verdedigers onnodig heen en weer?** Meet abrupte richtingsomkeringen bij voldoende loopsnelheid, liefst uitgesplitst naar werkelijk balverlies of een plotselinge pass.
6. **Wat gebeurt er in kleine partijvormen?** Test 2-tegen-1, 3-tegen-2, 4-tegen-3 en 4-tegen-4 apart. Een statistiek uit profvoetbal is niet vanzelf een passende norm voor leerlingen.
7. **Sportspecifieke herijking:** voetbaldata mogen niet als rechtstreeks bewijs dienen voor handbal, hockey of basketbal.

## Testopzet

- Gebruik DFL/Sportec om basisverdelingen en plausibele bereiken voor druk, rugdekking, dekking en rolwisselingen te schatten. Bewaar wedstrijden apart voor toetsing.
- Controleer of dezelfde uitspraken ook standhouden in de onafhankelijke SkillCorner-wedstrijden. Corrigeer voor ontbrekende of geëxtrapoleerde spelerposities.
- Gebruik kleine-partij-onderzoek voor de spelprincipes en de aanpassing van aantallen en speelveld; neem profafstanden niet letterlijk over.
- Gebruik Metrica als reproduceerbare onafhankelijke controle, niet als voldoende dataset voor alle claims.
- Vergelijk de oude en nieuwe simulatie bij identieke beginsituaties en seeds. Rapporteer niet alleen verschillen in doelpogingen, maar ook rolwisselingen, ongewenste richtingsomkeringen en dekking.
- Laat minimaal één LO-docent de visuele uitkomsten beoordelen zonder te weten welke versie het is. De docentbeoordeling vervangt geen trackingvalidatie.

## Stopregel

Niet publiceren als de nieuwe code bij relevante praktijksituaties nog steeds doelloos zwalkt, twee of meer verdedigers voortdurend dezelfde bal najagen, de spelberekeningen instabiel worden, of de verwijzing naar wetenschappelijk bewijs verder gaat dan de feitelijke metingen.

De nieuwe drempels in de modelcode zijn voorlopig **ontwerpwaarden**. Vermeld ze niet als empirisch gevonden coëfficiënten. Leg per parameter later bron, steekproef, onzekerheid en testresultaat vast.
