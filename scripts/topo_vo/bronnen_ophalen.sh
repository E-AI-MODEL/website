#!/usr/bin/env bash
# Haalt de open brondata op die build.py nodig heeft, in de map die je meegeeft (standaard ./bron).
# Alle bronnen staan vast op een commit of versie, zodat een herbouw dezelfde databank oplevert.
set -euo pipefail
OUT="${1:-bron}"; mkdir -p "$OUT/wc"
NE_COMMIT=ca96624a56bd078437bca8184e78163e5039ad19      # nvkelso/natural-earth-vector
PLATEN_COMMIT=339b0c56563c118307b1f4542703047f5f698fae  # fraxen/tectonicplates (PB2002)
WC_VERSIE=5.1.0                                         # world-countries (mledoze/countries), ODbL
WC_INTEGRITY=sha512-CXR6EBvTbArDlDDIWU3gfKb7Qk0ck2WNZ234b/A0vuecPzIfzzxH+O6Ejnvg1sT8XuiZjVlzOH0h08ZtaO7g0w==

NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/$NE_COMMIT/geojson
for f in ne_50m_admin_0_countries ne_10m_admin_1_states_provinces ne_10m_populated_places ne_10m_rivers_lake_centerlines \
         ne_50m_lakes ne_10m_lakes ne_50m_geography_regions_polys ne_50m_geography_marine_polys ne_10m_geography_regions_elevation_points; do
  curl -sSfL -o "$OUT/$f.geojson" "$NE/$f.geojson"
done
TP=https://raw.githubusercontent.com/fraxen/tectonicplates/$PLATEN_COMMIT/GeoJSON
curl -sSfL -o "$OUT/plates.json" "$TP/PB2002_boundaries.json"
curl -sSfL -o "$OUT/platepolys.json" "$TP/PB2002_plates.json"
curl -sSfL -o "$OUT/wc.tgz" "https://registry.npmjs.org/world-countries/-/world-countries-$WC_VERSIE.tgz"
python3 - "$OUT/wc.tgz" "$WC_INTEGRITY" <<'PY'
import base64, hashlib, sys
path, expected = sys.argv[1], sys.argv[2]
alg, value = expected.split("-", 1)
digest = base64.b64encode(hashlib.new(alg, open(path, "rb").read()).digest()).decode()
if digest != value:
    raise SystemExit("world-countries: integriteit klopt niet")
PY
tar xzf "$OUT/wc.tgz" -C "$OUT/wc"
echo "Bronnen staan in $OUT"
