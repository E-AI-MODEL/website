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
