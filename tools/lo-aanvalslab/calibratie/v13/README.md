# LO Aanvalslab v13: toetsing aan openbare wedstrijddata

Peildatum: 12 november 2026. v12 blijft als meetbare uitgangssituatie bewaard.

**Status:** beperkte afstelling van veldbewegingen en balpositie, géén validatie van doelkans, interceptiekans of prestaties van leerlingen. De bronbestanden zijn niet meegekopieerd. Het script `extract_tracking.py` haalt ze op bij de uitgevers, telt de metingen en schrijft `tracking_metrics.json`. In die JSON staat ook wat onvoldoende is gemeten.

| Sport | Verwerkt | Werkelijke meting | Gevolg voor model | Niet bewezen |
|---|---|---|---|---|
| Voetbal | Metrica Sports, twee volledige wedstrijden, vier team-trackingbestanden, 25 Hz | 6.096.429 snelheidsberekeningen op 0,6 s: gemiddelde 1,773 m/s, P90 3,669 m/s. In een benaderd balbezit: tegenstander dichtst bij de bal, mediaan 4,884 m | Verdedigers bewegen minder voortdurend op topsnelheid (`defencePace=.92`); de bal ligt dichter bij de baldrager maar blijft zichtbaar (`carryMeters=.70`) | Volledig 11-tegen-11-veld is geen schoolpartijtje 2-tegen-1. Bezit is een afstandsbenadering en geen gebeurtenislabel. |
| Handbal | Montoliu e.a., 10 wedstrijden van één vrouwenteam, 1 Hz, 84.690 posities | Verdediging gemiddelde 1,139 m/s (n=40.257); aanval 1,467 m/s (n=36.607). Verhouding 0,776 | `coverPace=.78` volgt deze verhouding. `defencePace=.66` gekozen na simulatieproeven, zodat de 4-tegen-4-verhouding van 0,969 richting 0,824 gaat | 1 Hz kan geen maximale sprint, reactietijd, interceptie of blok bepalen. Geen tracking van álle tegenstanders. |
| Basketbal | Één SportVU-competitiewedstrijd, 2015-2016, 57.036 unieke beelden, 25 Hz | 557.939 verplaatsingswaarden: gemiddeld 1,887 m/s, P90 3,921 m/s. Mediaan afstand bal tot dichtstbijzijnde speler 0,468 m | Kleine verlaging verdedigende verplaatsing (`defencePace=.96`); zichtbare balpositie dichter bij speler (`carryMeters=.55`) | 5-tegen-5-profbasketbal verschilt van 3-tegen-2 bij LO. Snelheden niet zuiver op verdedigende fase gescheiden. |
| Veldhockey | 74 open wedstrijdwerkboeken, 234.806 gecodeerde rijen/segmenten, waaronder 66.611 rijen in categorie `Passing` | Herkomst en tactische gebeurteniscategorieën gecontroleerd | Geen nieuwe fysieke verdedigingsparameter geclaimd. De bestaande richtingvoorkeur voor veilige passes naar de cirkel blijft literatuurgeïnformeerd | Geen volledige XY-posities van verdedigers: reactietijd, dekkingsafstand en onderscheppingskans blijven oefenmodel-aannames. |

## Vergelijking bij 4 tegen 4

Deze modelgemiddelden zijn lokaal met Chromium berekend, telkens vier startopstellingen met een vaste startwaarde. Het zijn **geen** werkelijke wedstrijdresultaten.

| Sport | v12 verdedigingssnelheid | v13 verdedigingssnelheid | v12 verhouding verdedigen/aanvallen | v13 verhouding |
|---|---:|---:|---:|---:|
| Voetbal | 2,108 m/s | 1,911 m/s | 1,223 | 1,065 |
| Hockey | 2,102 m/s | 2,102 m/s | 1,131 | 1,131 |
| Handbal | 1,885 m/s | 1,500 m/s | 0,969 | 0,824 |
| Basketbal | 2,037 m/s | 1,988 m/s | 1,523 | 1,404 |

Een kort oefenspel van enkele seconden is niet hetzelfde als het gemiddelde van een volledige wedstrijd. De afstelling is daarom beperkt. De handbalfactor `.66` is **niet** uit de ruwe data geschat. Hij is gekozen na variantenproeven op ons model en moet bij onafhankelijk beoordeelde spelsituaties nog worden getoetst. De hockeyberekeningen zijn op dit onderdeel niet empirisch aangepast.

## Technische controles

- Lokale Chromium-test met 384 combinaties van sport, teamgrootte, startopstelling en verdedigingsopdracht: geen snelheids-, versnellings- of balpositiesprongen buiten de grenzen.
- Gerichte proeven: een verdediger op de schotbaan blokkeert een schot, buiten de baan niet. De berekeningen zijn deterministisch.
- Online dua-modus getest in twee gescheiden browservensters met eigen rol, aparte kamers en identieke uitslag. Server/API-schema blijft ongewijzigd.
- Snelheid van modelspelers vóór/na wijziging afzonderlijk gemeten met `measure_model.py`.

## Bronnen en gebruik

1. [Metrica Sports, sample-data](https://github.com/metrica-sports/sample-data), twee geanonimiseerde voetbalwedstrijden. Bij publiek gebruik bron vermelden.
2. [Montoliu e.a., Handball Dataset](https://doi.org/10.5281/zenodo.12065335), 10 wedstrijden, CC BY 4.0.
3. [SportVU, gearchiveerde NBA-bewegingsdata](https://github.com/sealneaward/nba-movement-data), seizoen 2015-2016. Controleer de oorspronkelijke rechten vóór herpublicatie van ruwe gegevens.
4. [Lord e.a., Hockey Analysis](https://github.com/felicitylord/Hockey-Analysis), 74 geannoteerde wedstrijden en [wetenschappelijke analyse](https://pmc.ncbi.nlm.nih.gov/articles/PMC10108760/).
5. [Leser e.a.](https://doi.org/10.26582/k.51.1.7), geanalyseerde jeugdpartijtjes 3 tegen 2 (tactisch patroon, geen numerieke simulatie-fit).
6. [Willberg e.a.](https://doi.org/10.1177/17479541211067989), 3-tegen-3-basketbaltempo (alleen vergelijkingswaarde).

Geen ruwe wedstrijdbestanden zijn in de website opgenomen. Bronvermelding is subtiel via **Meetbasis en bronnen** onderaan.

## Wat nog ontbreekt

Een afzonderlijke, onafhankelijk gelabelde set echte **2-tegen-1- en 3-tegen-2-situaties** met vergelijkbare leeftijd en veldgrootte, plus de exacte bal- en spelerspositie bij een onderschepping. Daarmee kunnen we later een echte voorspelfout meten. Zonder die gegevens blijven de aanvallen onderwijsvoorbeelden en geen wedstrijdvoorspellingen.