#!/usr/bin/env bash
# Vereenvoudigt de ruwe geometrie (kaarten/_raw) tot de kaartbestanden. Vereist mapshaper en python3 met shapely.
set -euo pipefail
K="$1/kaarten"
MS="${MAPSHAPER:-mapshaper}"
cd "$K"
run() { "$MS" -i "_raw/$1.geojson" $2 -o format=geojson precision="$3" "$4.geojson" >/dev/null 2>&1; }
run landen50     "-simplify 6% keep-shapes -filter-fields id,naam"                               0.01  wereld-landen
run landen50     "-clip bbox=-25,34,62,72 -simplify 25% keep-shapes -filter-fields id,naam"      0.005 europa-landen
run landen50     "-clip bbox=-92,-56,-30,15 -simplify 25% keep-shapes -filter-fields id,naam"    0.005 zuid-amerika-landen
run bra_staten   "-simplify 4% keep-shapes"                                                     0.005 brazilie-deelstaten
run bra_regios   "-simplify 4% keep-shapes"                                                     0.005 brazilie-regios
run mx_us_staten "-simplify 10% keep-shapes"                                                    0.005 mexico-vs-staten
run rivieren     "-simplify 8%"                                                                 0.005 rivieren
run gebieden     "-simplify 3.5% keep-shapes"                                                   0.01  wereld-gebieden
run zeeen        "-simplify 8% keep-shapes"                                                     0.01  wereld-zeeen
run meren        "-simplify 15% keep-shapes"                                                    0.005 meren
run platen       "-simplify 10% keep-shapes -filter-fields id,naam,groot"                       0.01  platen
run plaatgrenzen "-simplify 15%"                                                                0.01  plaatgrenzen
python3 -I - <<'PY'
import json
from shapely.geometry import shape, mapping
from shapely import set_precision
d = json.load(open("_raw/nl_water.geojson"))
out = [{"type": "Feature", "properties": f["properties"],
        "geometry": mapping(set_precision(shape(f["geometry"]).simplify(0.0006, preserve_topology=True), 0.0001))} for f in d["features"]]
json.dump({"type": "FeatureCollection", "features": out}, open("nederland-water.geojson", "w"), ensure_ascii=False, separators=(",", ":"))
PY
rm -rf _raw
ls -1 *.geojson | wc -l
