#!/usr/bin/env bash
# Haalt de open brondata op die build.py nodig heeft, in de map die je meegeeft (standaard ./bron).
set -euo pipefail
OUT="${1:-bron}"; mkdir -p "$OUT/wc"
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_50m_admin_0_countries ne_10m_admin_1_states_provinces ne_10m_populated_places ne_10m_rivers_lake_centerlines \
         ne_50m_lakes ne_10m_lakes ne_50m_geography_regions_polys ne_50m_geography_marine_polys ne_10m_geography_regions_elevation_points; do
  curl -sSfL -o "$OUT/$f.geojson" "$NE/$f.geojson"
done
TP=https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON
curl -sSfL -o "$OUT/plates.json" "$TP/PB2002_boundaries.json"
curl -sSfL -o "$OUT/platepolys.json" "$TP/PB2002_plates.json"
TGZ=$(curl -sSf https://registry.npmjs.org/world-countries/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['dist']['tarball'])")
curl -sSfL "$TGZ" | tar xz -C "$OUT/wc"
echo "Bronnen staan in $OUT"
