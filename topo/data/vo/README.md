# Let's go TOPO! VO – databank aardrijkskunde havo/vwo klas 1–6

De databank achter **Let's go TOPO! voor VO** (`/topo/vo/`, spel op `/topo/vo/spel/`): doelen, topografie met Nederlandse namen, kaartgeometrie, oefensets, begrippen en vragen. Alles is statische JSON/GeoJSON, zonder account of opslag, net als de PO-versie. Het spel laadt per set alleen de bestanden die de set nodig heeft (`bestanden`, `vragen` in `sets.json`).

## Wat erin zit

| Bestand | Inhoud |
|---|---|
| `doelen.json` | 27 doelen: basistopografie, kerndoelen onderbouw (KD24C, KD25A–C), havo A1–E2, vwo A1–E2, met CE/SE en bron |
| `items/*.json` | 1962 plekken in 8 groepen: landen, steden, wateren, fysisch, platen, nederland, brazilie, mexico-vs |
| `kaarten/*.geojson` | 13 kaartlagen (wereld, Europa, Zuid-Amerika, Brazilië, Mexico–VS, rivieren, zeeën, gebieden, meren, platen, NL-water) |
| `sets.json` | 45 oefensets per niveau en leerjaar (34 met kaart, 11 begrippensets zonder kaart) |
| `begrippen.json` | 143 begrippen in eigen woorden, gekoppeld aan doelen en voorbeeldplekken |
| `vragen/*.json` | 1515 meerkeuzevragen in 17 sjablonen, in hetzelfde formaat als `../shuffle-vragen.json`; `vragen/sets/` bevat per set alleen de eigen vragen |
| `taalbank-vo.json` | 50 spelzinnen voor VO, in dezelfde groepen als `../taalbank.json` |

De volledige SLO-basislijst (100 Nederland, 100 Europa, 99 wereld) is gekoppeld via `slo300: true`, `slo_lijst` en `slo_naam`. Bij die items is de SLO-spelling de hoofdnaam (bijv. Mumbai, alt Bombay).

## Item

```json
{
  "id": "stad-bra-manaus",
  "naam": "Manaus",
  "alt": [],
  "type": "stad",
  "land": "BRA",
  "werelddeel": "Zuid-Amerika",
  "coord": [-60.025, -3.1],
  "punt": "ne",
  "geo": {"kaart": "brazilie-deelstaten", "key": "AM"},
  "kaarten": ["wereld", "zuid-amerika", "brazilie"],
  "doelen": ["H-D1", "KD25A", "V-D1"],
  "leerjaren": {"onderbouw": [3], "havo": [4, 5], "vwo": [4, 5, 6]},
  "moeilijkheid": 2,
  "feiten": {"inwoners_agglomeratie": 1753179, "deelstaat": "AM", "regio": "Noord"}
}
```

- `coord` is [lengte, breedte]. `punt`: `ne` (Natural Earth), `berekend` (punt binnen een vlak) of `benadering` (handmatig, ± 1–3 km voor steden; voor gebieden een representatief punt).
- `geo` verwijst naar een vorm in een kaartlaag (`properties.id`; bij `../provincies-2026` is dat `statcode`). Items zonder `geo` zijn punten.
- `kaarten` zegt op welke speelkaarten het item past. Nederlandse items staan niet op de wereldkaart.
- `moeilijkheid` 1 = basis, 3 = verdieping. `leerjaren` is een **voorstel**.

## Vragen

Elke vraag heeft vier opties, met `answer` altijd bij de opties. Extra velden ten opzichte van de huidige TOPO zijn `doelen`, `leerjaren`, `itemId` (of `begripId`) en `check.sjabloon`. De antwoorden volgen uit de itemgegevens, bijvoorbeeld hoofdstad, provincie, deelstaat, tweelingstad, plaat of hoogte. Vragen over platen gaan alleen over plaatsen die ruim van een plaatgrens af liggen.

## Opnieuw bouwen

```bash
bash scripts/topo_vo/bronnen_ophalen.sh /tmp/bron    # vaste commits/versie, met integriteitscontrole
pip install shapely && npm i -g mapshaper
python3 scripts/topo_vo/build.py /tmp/bron topo/data/vo
bash scripts/topo_vo/kaarten.sh topo/data/vo
python3 scripts/topo_vo/vragen.py topo/data/vo /tmp/bron
python3 scripts/topo_vo/sets.py topo/data/vo        # na vragen.py: maakt de vragenbundels per set
python3 scripts/topo_vo/maak_paginas.py             # topo/vo/index.html en topo/vo/spel/index.html
node scripts/validate_topo_vo_data.mjs
node scripts/test_topo_vo.mjs                       # browserproef, met een server op 127.0.0.1:8765
```

Handmatige gegevens (Nederland, Brazilië, Mexico–VS, rivierenamen, extra toppen) staan in `scripts/topo_vo/curated.py` en de begrippen in `begrippen_bron.py`. De bouw is deterministisch: twee keer bouwen geeft identieke bestanden.

De pagina's worden gemaakt uit `scripts/topo_vo/pagina/*.js` en de stijlen van de PO-pagina's (letterlijk overgenomen). Pas nooit de gegenereerde HTML aan; CI controleert met `maak_paginas.py --check` dat die bij de bronnen past.

Nederlandse rivieren: Natural Earth noemt de Waal 'Rhine' en de Merwede 'Waal'. `build.py` corrigeert dat in `kaarten/nederland-water.geojson`. Nederlandse meren zijn punten; het waterdetail komt, net als in de PO-versie, van PDOK.

## Let op

- **Kerndoelen**: opgeleverd in november 2025, maar nog niet wettelijk vastgelegd.
- **Inwonertallen** komen uit Natural Earth (`POP_MAX`, agglomeratie). Gebruik ze om te vergelijken, niet als actuele statistiek.
- **Namen**: Nederlandse namen komen uit Natural Earth en world-countries. Waar die ontbraken staat de Engelse naam, bijvoorbeeld bij kleinere meren en toppen.
- **Topolijsten** verschillen per methode. Alleen de SLO-basislijst is landelijk gedeeld.
- **Betwiste status**: Jeruzalem staat als hoofdstad met de opmerking dat die status internationaal betwist wordt.

## Bronnen en licenties

- Natural Earth (publiek domein): landen, steden, gebieden, wateren, rivieren, toppen. <https://www.naturalearthdata.com>
- world-countries 5.1.0 (mledoze/countries), **ODbL 1.0**: Nederlandse landnamen, hoofdsteden en oppervlakte. Een afgeleide databank moet onder ODbL blijven en de bron vermelden.
- PB2002 plaatmodel (Bird 2003), via fraxen/tectonicplates, **ODC-By 1.0**: vermeld Hugo Ahlenius, Nordpil en Peter Bird.
- SLO, *Topografie in het basisonderwijs*: basislijst topografie.
- CvTE, syllabi aardrijkskunde havo en vwo 2027; SLO, kerndoelen voortgezet onderwijs 2025. Doelen staan in eigen woorden samengevat.
