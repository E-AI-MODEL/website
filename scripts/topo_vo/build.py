"""Bouwt de TOPO VO-databank uit Natural Earth, world-countries, PB2002 en curated.py.

Gebruik: python3 build.py <brondir> topo/data/vo   (eerst: bash scripts/topo_vo/bronnen_ophalen.sh <brondir>)
Schrijft items/*.json, sets.json en kaarten/_raw/*.geojson (ruwe geometrie voor mapshaper).
"""
import json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from shapely.geometry import shape, mapping, Point
from shapely.ops import linemerge, unary_union

sys.path.insert(0, os.path.dirname(__file__))
import curated as C

SRC, OUT = sys.argv[1], sys.argv[2]
RAW = os.path.join(OUT, "kaarten", "_raw")
os.makedirs(RAW, exist_ok=True)
os.makedirs(os.path.join(OUT, "items"), exist_ok=True)


def load(name):
    with open(os.path.join(SRC, name + ".geojson"), encoding="utf-8") as f:
        return json.load(f)["features"]


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm(s):
    return slug(s).replace("-", "")


def nice(s):
    s = (s or "").strip()
    return s[:1].upper() + s[1:] if s else s


def rnd(c, nd=3):
    return [round(c[0], nd), round(c[1], nd)]


ITEMS = {}
GEO = defaultdict(list)  # kaartnaam -> features


def add(item):
    base = item["id"]
    i, n = base, 2
    while i in ITEMS:
        i = f"{base}-{n}"; n += 1
    item["id"] = i
    item.setdefault("alt", [])
    item.setdefault("doelen", [])
    item.setdefault("feiten", {})
    ITEMS[i] = item
    return item


def geo(kaart, key, geom, props=None):
    p = {"id": key}
    if props: p.update(props)
    GEO[kaart].append({"type": "Feature", "properties": p, "geometry": mapping(geom) if not isinstance(geom, dict) else geom})


# ------------------------------------------------------------------ landen
wc = json.load(open(os.path.join(SRC, "wc/package/countries.json"), encoding="utf-8"))
ne_c = load("ne_50m_admin_0_countries")
ne_by = {}
for f in ne_c:
    p = f["properties"]
    for k in (p.get("ADM0_A3"), p.get("ISO_A3"), p.get("ISO_A3_EH")):
        if k and k != "-99":
            ne_by.setdefault(k, f)
KEEP_TERR = {"GRL", "CUW", "ABW", "SXM", "HKG", "TWN", "PRI", "GUF", "ESH", "PSE", "UNK", "FLK", "NCL", "MAC", "BES"}
LAND = {}
for c in wc:
    iso = c["cca3"]
    if not (c.get("independent") or c.get("unMember") or iso in KEEP_TERR):
        continue
    naam = C.LANDNAAM_FIX.get(iso) or c["translations"].get("nld", {}).get("common") or c["name"]["common"]
    f = ne_by.get(iso) or (ne_by.get("KOS") if iso == "UNK" else None)
    p = f["properties"] if f else {}
    alt = sorted({x for x in [p.get("NAME_NL"), c["translations"].get("nld", {}).get("official")] if x and x != naam})
    if f and p.get("LABEL_X") is not None:
        coord = [p["LABEL_X"], p["LABEL_Y"]]
    elif f:
        coord = list(shape(f["geometry"]).representative_point().coords[0])
    else:
        coord = c.get("latlng", [0, 0])[::-1]
    cont = C.CONTINENT_NL.get(p.get("CONTINENT")) if p else None
    if not cont:
        cont = {"Africa": "Afrika", "Asia": "Azië", "Europe": "Europa", "Oceania": "Oceanië", "Antarctic": "Antarctica"}.get(c["region"])
        if c["region"] == "Americas":
            cont = "Zuid-Amerika" if c.get("subregion") == "South America" else "Noord-Amerika"
    sub = C.SUBREGIO_NL.get(c.get("subregion") or p.get("SUBREGION"), c.get("subregion"))
    item = add({"id": "land-" + iso.lower(), "naam": naam, "alt": alt, "type": "land", "land": iso,
                "werelddeel": cont, "subregio": sub, "coord": rnd(coord, 2), "punt": "ne" if f else "benadering",
                "feiten": {"onafhankelijk": bool(c.get("independent")), "vn_lid": bool(c.get("unMember")),
                           "oppervlakte_km2": c.get("area"), "inwoners_ne": p.get("POP_EST")},
                "_rank": p.get("MIN_LABEL", p.get("scalerank", 5)) if p else 6})
    if iso == "GUF":
        item["coord"] = [-53.1, 3.9]
    if f:
        item["geo"] = {"kaart": "wereld-landen", "key": iso}
        geo("landen50", iso, f["geometry"], {"naam": naam})
    LAND[iso] = item

# ------------------------------------------------------------------ hoofdsteden en steden
pp = load("ne_10m_populated_places")
wc_cap = {c["cca3"]: [x.lower() for x in c.get("capital", [])] for c in wc}
CITY_KEYS = set()


def iso_of(p):
    a = p.get("ADM0_A3") or ""
    alias = {"SDS": "SSD", "KOS": "UNK", "SAH": "ESH", "PSX": "PSE"}
    return alias.get(a, a)


def city_item(p, geom, extra_doelen=(), force=False):
    iso = iso_of(p)
    naam = nice(p.get("NAME_NL") or p.get("NAME"))
    key = (norm(naam), iso)
    if key in CITY_KEYS:
        return None
    CITY_KEYS.add(key)
    pop = p.get("POP_MAX") or 0
    fc = p.get("FEATURECLA", "")
    in_wc = norm(p.get("NAME") or "") in {norm(x) for x in wc_cap.get(iso, [])}
    cap = fc == "Admin-0 capital" or (fc == "Admin-0 capital alt" and in_wc)
    alt = sorted({x for x in [p.get("NAME"), p.get("NAMEASCII")] if x and x != naam})
    it = add({"id": f"stad-{iso.lower()}-{slug(naam)}", "naam": naam, "alt": alt, "type": "hoofdstad" if cap else "stad",
              "land": iso, "werelddeel": LAND.get(iso, {}).get("werelddeel"), "subregio": LAND.get(iso, {}).get("subregio"),
              "coord": rnd(geom["coordinates"], 3), "punt": "ne",
              "feiten": {"inwoners_agglomeratie": pop, "land": LAND.get(iso, {}).get("naam")},
              "doelen": list(extra_doelen)})
    if cap:
        names = {(p.get("NAME") or "").lower(), (p.get("NAMEASCII") or "").lower(), (p.get("NAME_EN") or "").lower()}
        it["feiten"]["hoofdstad_van"] = LAND.get(iso, {}).get("naam")
        it["feiten"]["officiele_hoofdstad"] = in_wc or len(wc_cap.get(iso, [])) <= 1
    if fc == "Admin-0 capital alt" and not cap:
        it["feiten"]["bestuursfunctie"] = "tweede of vroegere bestuursstad, geen officiële hoofdstad"
    if iso == "ISR" and cap:
        it["feiten"]["status"] = "De status als hoofdstad wordt internationaal betwist."
    if pop >= 10_000_000:
        it["feiten"]["megastad"] = True
    return it


SA = {"ARG", "BOL", "BRA", "CHL", "COL", "ECU", "GUY", "PRY", "PER", "SUR", "URY", "VEN", "GUF", "FLK"}
for f in sorted(pp, key=lambda f: -(f["properties"].get("POP_MAX") or 0)):
    p = f["properties"]; iso = iso_of(p)
    if iso == "NLD":
        continue
    cont = LAND.get(iso, {}).get("werelddeel")
    pop = p.get("POP_MAX") or 0
    cap = p.get("FEATURECLA", "").startswith("Admin-0 capital") and iso in LAND
    ok = cap or pop >= 1_000_000 \
        or (cont == "Europa" and pop >= 400_000) or (iso in SA and pop >= 500_000) or (iso == "BRA" and pop >= 250_000)
    if not ok:
        continue
    d = []
    if iso == "BRA": d += ["H-D1", "V-D1"]
    elif iso in SA: d += ["V-D1"]
    city_item(p, f["geometry"], d)

# ------------------------------------------------------------------ fysische gebieden
TYPE_REG = {"Range/mtn": "gebergte", "Desert": "woestijn", "Plateau": "plateau", "Plain": "vlakte", "Basin": "bekken",
            "Island": "eiland", "Island group": "eilandengroep", "Peninsula": "schiereiland", "Delta": "delta",
            "Isthmus": "landengte", "Geoarea": "regio", "Lowland": "laagland", "Tundra": "toendra", "Wetlands": "moerasgebied",
            "Continent": "werelddeel", "Valley": "dal", "Coast": "kust", "Foothills": "heuvelland", "Gorge": "kloof", "Lake": "meer"}
REGION_NL = {"South America": "Zuid-Amerika", "North America": "Noord-Amerika", "Europe": "Europa", "Asia": "Azië",
             "Africa": "Afrika", "Oceania": "Oceanië", "Antarctica": "Antarctica"}
for f in load("ne_50m_geography_regions_polys"):
    p = f["properties"]
    cla = p["FEATURECLA"]
    reg = p.get("REGION")
    if reg == "Antarctica" and cla != "Continent":
        continue
    if cla in ("Coast", "Gorge", "Foothills") or p["SCALERANK"] > 4:
        continue
    t = TYPE_REG.get(cla)
    if cla == "Pen/cape":
        t = "kaap" if (p.get("NAME_NL") or "").lower().startswith("kaap") else "schiereiland"
    if not t:
        continue
    naam = nice(p.get("NAME_NL") or p["NAME"].title())
    naam = {"Islandia": "IJsland (eiland)"}.get(naam, naam)
    g = shape(f["geometry"])
    d = []
    if t in ("gebergte", "plateau", "vlakte", "bekken", "landengte", "toendra", "delta", "laagland", "dal"):
        d += ["H-C2", "V-C1"]
    if t in ("woestijn", "toendra"):
        d += ["H-C2", "V-C1", "KD25B"]
    if reg == "South America":
        d += ["V-D1"]
    it = add({"id": f"{slug(t)}-{slug(naam)}", "naam": naam, "alt": [p["NAME"].title()] if p["NAME"].title() != naam else [],
              "type": t, "werelddeel": REGION_NL.get(reg), "coord": rnd(g.representative_point().coords[0], 2), "punt": "ne",
              "doelen": d, "_rank": p["SCALERANK"]})
    it["geo"] = {"kaart": "wereld-gebieden", "key": it["id"]}
    geo("gebieden", it["id"], g, {"naam": naam, "type": t})

MAR = {"ocean": "oceaan", "sea": "zee", "bay": "baai", "gulf": "golf", "strait": "zeestraat", "channel": "zeestraat",
       "sound": "zeestraat", "lagoon": "lagune", "fjord": "fjord", "inlet": "zeearm", "river": None, "reef": None, "generic": None}
MARG = {}
for f in load("ne_50m_geography_marine_polys"):
    p = f["properties"]
    t = MAR.get((p.get("featurecla") or "").lower())
    sr = p.get("scalerank") if p.get("scalerank") is not None else 9
    if not t or sr > 4:
        continue
    naam = nice(p.get("name_nl") or p.get("name"))
    if not naam:
        continue
    e = MARG.setdefault(naam, {"t": t, "g": [], "alt": set(), "sr": sr})
    e["g"].append(shape(f["geometry"]).buffer(0)); e["sr"] = min(e["sr"], sr)
    if p.get("name") and p["name"].title() != naam:
        e["alt"].add(p["name"].title())
for naam, e in MARG.items():
    g = unary_union(e["g"])
    t = e["t"]
    it = add({"id": f"{t}-{slug(naam)}", "naam": naam, "alt": sorted(e["alt"]), "type": t,
              "coord": rnd(max(getattr(g, "geoms", [g]), key=lambda x: x.area).representative_point().coords[0], 2),
              "punt": "ne", "_rank": e["sr"]})
    it["geo"] = {"kaart": "wereld-zeeen", "key": it["id"]}
    geo("zeeen", it["id"], g, {"naam": naam, "type": t})

for f in load("ne_50m_lakes"):
    p = f["properties"]
    if (p.get("scalerank") if p.get("scalerank") is not None else 9) > 1 or not p.get("name"):
        continue
    WL = {"IJsselmeer", "Bodensee", "Dead Sea", "Lago Titicaca", "Itaipú Reservoir", "Lago Gatun", "Lago de Maracaibo",
          "Lake Balaton", "Lake Geneva", "Lago di Garda", "Lake Nasser", "Lake Kariba", "Lake Volta", "Lake Mead", "Aral Sea", "North Aral Sea"}
    if shape(f["geometry"]).area < 0.25 and p["name"] not in WL:
        continue
    naam = nice(p.get("name_nl") or p["name"])
    if naam.lower() in p["name"].lower() and len(naam) < len(p["name"]) and "meer" not in naam.lower():
        naam = p["name"]
    naam = {"Lake Itaipú Reservoir": "Itaipu-stuwmeer", "Itaipudam": "Itaipu-stuwmeer", "Itaipú Reservoir": "Itaipu-stuwmeer",
            "North Aral Sea": "Noordelijk Aralmeer", "South Aral Sea": "Zuidelijk Aralmeer"}.get(naam, naam)
    g = shape(f["geometry"])
    it = add({"id": f"meer-{slug(naam)}", "naam": naam, "alt": [p["name"]] if p["name"] != naam else [], "type": "meer",
              "coord": rnd(g.representative_point().coords[0], 2), "punt": "ne", "_rank": p.get("scalerank", 2)})
    it["geo"] = {"kaart": "meren", "key": it["id"]}
    geo("meren", it["id"], g, {"naam": naam})

for f in load("ne_10m_geography_regions_elevation_points"):
    p = f["properties"]
    if (p.get("scalerank") if p.get("scalerank") is not None else 9) > 3 or not p.get("name") or not p.get("elevation"):
        continue
    naam = nice(p.get("name_nl") or p["name"])
    add({"id": f"berg-{slug(naam)}", "naam": naam, "alt": [p["name"]] if p["name"] != naam else [], "type": ("bergpas" if naam.lower().endswith("pas") else "berg") if p["elevation"] > 0 else "laagste punt",
         "coord": rnd(f["geometry"]["coordinates"], 3), "punt": "ne", "feiten": {"hoogte_m": p["elevation"]},
         "doelen": ["H-C2", "V-C1"], "_rank": p.get("scalerank", 3)})

# ------------------------------------------------------------------ rivieren (lijnen)
BBOX = {"Negro": (-70, -5, -58, 3), "Colorado": (-120, 30, -105, 42), "Don": (37, 46, 45, 55), "Po": (6, 44, 13, 46),
        "Orange": (15, -31, 30, -26), "Ural": (50, 45, 62, 56), "Jordan": (35, 29, 36.5, 34), "Columbia": (-125, 43, -114, 53),
        "Magdalena": (-76, 2, -73, 11.5), "Mackenzie": (-140, 58, -110, 70), "Maas": (3, 49, 7, 52.2), "Schelde": (2.5, 49.8, 4.6, 51.6),
        "Murray": (138, -38, 150, -33), "Uruguay": (-60, -35, -50, -26), "Paraguay": (-62, -28, -54, -15),
        "Grande": (-110, 25, -95, 38), "Lena": (100, 50, 135, 74), "Ob": (60, 48, 90, 68), "Lek": (4.5, 51.85, 5.4, 52.0),
        "Waal": (4.3, 51.7, 6.1, 51.95), "Nederrijn": (5.3, 51.9, 6.1, 52.0), "IJssel": (5.8, 51.9, 6.3, 52.6),
        "Rhine": (4, 46, 10, 52.2), "Niger": (-12, 4, 10, 18), "Congo": (12, -10, 33, 6), "Amur": (115, 42, 142, 55)}
rv = load("ne_10m_rivers_lake_centerlines")
by_name = defaultdict(list)
for f in rv:
    by_name[(f["properties"].get("name") or "").strip()].append(f)
RIVER_ID = {}
for ne_name, nl, alt in C.RIVIEREN:
    cands = by_name.get(ne_name, [])
    if ne_name == "Paraguay" and not cands:
        cands = by_name.get("Paraguai", [])
    if ne_name == "Rio Grande":
        cands = cands + by_name.get("Grande", [])
    if ne_name == "Irrawaddy":
        cands = by_name.get("Ayeyarwady", [])
    if ne_name == "Rhine":
        cands = cands + by_name.get("Rhein", [])
    bb = BBOX.get(ne_name) or BBOX.get(ne_name.split()[-1])
    geoms = []
    for f in cands:
        g = shape(f["geometry"])
        if bb:
            c = g.centroid
            if not (bb[0] <= c.x <= bb[2] and bb[1] <= c.y <= bb[3]):
                continue
        geoms.append(g)
    if not geoms:
        print("RIVIER ONTBREEKT:", ne_name, file=sys.stderr)
        continue
    parts = []
    for g in geoms:
        parts += list(getattr(g, "geoms", [g]))
    m = linemerge(parts) if len(parts) > 1 else parts[0]
    longest = max(getattr(m, "geoms", [m]), key=lambda g: g.length)
    mid = longest.interpolate(0.5, normalized=True)
    d = list(C.RIVIER_DOELEN.get(nl, []))
    it = add({"id": f"rivier-{slug(nl)}", "naam": nl, "alt": alt, "type": "rivier", "coord": rnd(mid.coords[0], 3),
              "punt": "ne", "doelen": d + ["KD25A"], "_rank": 1})
    it["geo"] = {"kaart": "rivieren", "key": it["id"]}
    geo("rivieren", it["id"], m, {"naam": nl})
    RIVER_ID[ne_name] = it["id"]


# ------------------------------------------------------------------ gedetailleerd water Nederland
from shapely.geometry import box, LineString
from shapely.ops import split
NLBOX = box(3.0, 50.6, 7.4, 53.7)
NLW = {}
# Natural Earth noemt de Waal (Pannerdensche Kop - Gorinchem) 'Rhine' en de Merwede 'Waal'.
# Hier krijgen de Nederlandse rivierdelen hun eigen naam.
NL_DELEN = {"Rhine": [("Waal", box(4.95, 51.75, 6.06, 51.95)), ("Rijn", box(6.05, 51.80, 7.40, 51.95))],
            "Waal": [("Merwede", NLBOX)], "Nederrijn": [("Neder-Rijn", NLBOX)], "Ems": [("Eems", NLBOX)],
            "Maas": [("Maas", NLBOX)], "Lek": [("Lek", NLBOX)], "IJssel": [("IJssel", NLBOX)], "Schelde": [("Schelde", NLBOX)]}
for f in load("ne_10m_rivers_lake_centerlines"):
    n = (f["properties"].get("name") or "").strip()
    for nl, clip in NL_DELEN.get(n, []):
        g = shape(f["geometry"]).intersection(clip)
        if not g.is_empty:
            NLW.setdefault(nl, []).append(g)
NLW_GEOM = {}
for nl, gs in NLW.items():
    NLW_GEOM[f"nlw-{slug(nl)}"] = unary_union(gs)
    geo("nl_water", f"nlw-{slug(nl)}", NLW_GEOM[f"nlw-{slug(nl)}"], {"naam": nl, "soort": "rivier"})
# Meren in Nederland: de Natural Earth-vlakken zijn te grof (het IJsselmeer bedekt dan Flevoland).
# Net als in de PO-versie komt het waterdetail van PDOK; de meren zijn punten.


def punt_op_vorm(g, ref=None):
    """Een punt dat zeker op de lijn of in het vlak ligt (zo dicht mogelijk bij ref)."""
    if ref is not None and g.geom_type in ("LineString", "MultiLineString"):
        from shapely.ops import nearest_points
        return rnd(nearest_points(g, Point(ref))[0].coords[0], 3)
    if g.geom_type in ("LineString", "MultiLineString"):
        longest = max(getattr(g, "geoms", [g]), key=lambda x: x.length)
        return rnd(longest.interpolate(0.5, normalized=True).coords[0], 3)
    return rnd(g.representative_point().coords[0], 3)
NLW_REF = {"IJssel": "nlw-ijssel", "Lek": "nlw-lek", "Maas": "nlw-maas", "Waal": "nlw-waal", "Neder-Rijn": "nlw-neder-rijn"}

# ------------------------------------------------------------------ Nederland
prov = json.load(open(os.path.join(OUT, "..", "provincies-2026.geojson"), encoding="utf-8"))["features"]
PROV_NAAM = {}
for f in prov:
    p = f["properties"]
    naam = p["statnaam"]
    slonaam = {"Groningen": "Groningen (prov.)", "Utrecht": "Utrecht (prov.)", "Fryslân": "Fryslân (Friesland)"}.get(naam, naam)
    g = shape(f["geometry"])
    it = add({"id": f"provincie-{slug(naam)}", "naam": naam, "alt": ["Friesland"] if naam == "Fryslân" else [],
              "type": "provincie", "land": "NLD", "werelddeel": "Europa", "coord": rnd(g.representative_point().coords[0], 3),
              "punt": "berekend", "geo": {"kaart": "../provincies-2026", "key": p["statcode"]},
              "doelen": ["KD25C"], "_slonaam": slonaam, "_slolijst": "NEDERLAND"})
    PROV_NAAM[naam] = it["id"]
NL_RIVER_NE = {"IJssel": "IJssel", "Lek": "Lek", "Maas": "Maas", "Waal": "Waal", "Nederrijn": "Nederrijn"}
for naam, t, lon, lat, ex in C.NL:
    d = []
    if t in ("rivier", "kanaal", "meer", "zee", "zeearm", "dijk", "eiland"):
        d += ["KD25B", "H-E1", "V-E1"] if t != "eiland" else ["H-E1", "V-E1"]
    if t in ("stad", "regio", "luchthaven", "polder"):
        d += ["KD25C"]
    if t == "stad":
        d += ["H-E2", "V-E1", "V-E2"]
    it = add({"id": f"nl-{slug(t)}-{slug(naam)}", "naam": naam, "alt": ex.get("alt", []), "type": t, "land": "NLD",
              "werelddeel": "Europa", "coord": [lon, lat], "punt": "benadering", "doelen": d,
              "feiten": {k: v for k, v in ex.items() if k in ("provincie", "hoogte_m", "provinciehoofdstad", "hoofdstad", "regeringszetel")},
              "_slonaam": ex.get("slonaam", naam), "_slolijst": "NEDERLAND"})
    if ex.get("rivierref") and ex["rivierref"] in RIVER_ID:
        it["geo"] = {"kaart": "rivieren", "key": RIVER_ID[ex["rivierref"]]}
        ITEMS[RIVER_ID[ex["rivierref"]]]["_dubbel_nl"] = it["id"]
for it in ITEMS.values():
    if it.get("land") == "NLD" and it["naam"] in NLW_REF:
        it["geo"] = {"kaart": "nederland-water", "key": NLW_REF[it["naam"]]}
        it["coord"], it["punt"] = punt_op_vorm(NLW_GEOM[NLW_REF[it["naam"]]], it["coord"]), "berekend"
for naam, t, lon, lat, ex in C.NL_EXTRA:
    add({"id": f"nl-{slug(t)}-{slug(naam)}", "naam": naam, "alt": ex.get("alt", []), "type": t, "land": "NLD",
         "werelddeel": "Europa", "coord": [lon, lat], "punt": "benadering", "doelen": ex["doelen"],
         "feiten": {"toelichting": ex["toelichting"]} if ex.get("toelichting") else {}})

for rid in [k for k, v in ITEMS.items() if v.get("_dubbel_nl")]:
    ITEMS[ITEMS[rid]["_dubbel_nl"]]["doelen"] = sorted(set(ITEMS[ITEMS[rid]["_dubbel_nl"]]["doelen"]) | set(ITEMS[rid]["doelen"]) - {"KD25A"})
    del ITEMS[rid]

for it in ITEMS.values():
    if it.get("land") == "NLD" and it["naam"] in NLW_REF:
        it["geo"] = {"kaart": "nederland-water", "key": NLW_REF[it["naam"]]}
        it["coord"], it["punt"] = punt_op_vorm(NLW_GEOM[NLW_REF[it["naam"]]], it["coord"]), "berekend"

# ------------------------------------------------------------------ handmatige aanvullingen
for naam, t, lon, lat, ex in C.MANUAL:
    it = add({"id": f"{slug(t)}-{slug(naam)}", "naam": naam, "alt": ex.get("alt", []), "type": t, "land": ex.get("land"),
              "coord": [lon, lat], "punt": "benadering", "doelen": ex.get("doelen", []),
              "feiten": {k: ex[k] for k in ("toelichting", "hoogte_m") if k in ex}, **({"_rank": 1} if t in ("berg", "vulkaan") else {})})
    if ex.get("slo"):
        it["_slolijst"] = ex["slo"]; it["_slonaam"] = naam

# ------------------------------------------------------------------ Brazilië
adm1 = load("ne_10m_admin_1_states_provinces")
st2reg = {s: r for r, v in C.BRAZILIE_REGIO.items() for s in v["staten"]}
for r, v in C.BRAZILIE_REGIO.items():
    add({"id": f"bra-regio-{slug(r)}", "naam": r, "alt": [v["pt"]], "type": "regio", "land": "BRA", "werelddeel": "Zuid-Amerika",
         "coord": v["punt"], "punt": "benadering", "doelen": ["H-D1", "V-D1"],
         "feiten": {"deelstaten": v["staten"]}, "geo": {"kaart": "brazilie-regios", "key": f"bra-regio-{slug(r)}"}})
reg_geoms = defaultdict(list)
for f in adm1:
    p = f["properties"]
    if p.get("adm0_a3") == "BRA":
        code = (p.get("iso_3166_2") or "").split("-")[-1]
        g = shape(f["geometry"])
        naam = p.get("name_nl") or p["name"]
        if code == "DF":
            naam = "Federaal District"
        it = add({"id": f"bra-deelstaat-{code.lower()}", "naam": naam, "alt": [p["name"]] if p["name"] != naam else [],
                  "type": "deelstaat", "land": "BRA", "werelddeel": "Zuid-Amerika", "coord": rnd(g.representative_point().coords[0], 2),
                  "punt": "berekend", "doelen": ["H-D1", "V-D1"],
                  "feiten": {"afkorting": code, "regio": st2reg.get(code), "type_bron": p.get("type_en")},
                  "geo": {"kaart": "brazilie-deelstaten", "key": code}})
        geo("bra_staten", code, g, {"naam": naam, "regio": st2reg.get(code)})
        reg_geoms[st2reg.get(code)].append(g)
    if p.get("adm0_a3") in ("MEX", "USA") and p["name"] in C.GRENSSTATEN[p["adm0_a3"]]:
        iso = p["adm0_a3"]
        naam = C.STAAT_NL.get(p["name"], p.get("name_nl") or p["name"])
        g = shape(f["geometry"])
        key = f"{iso}-{slug(p['name'])}"
        it = add({"id": f"grensstaat-{key.lower()}", "naam": naam, "alt": [p["name"]] if p["name"] != naam else [],
                  "type": "deelstaat", "land": iso, "werelddeel": "Noord-Amerika", "coord": rnd(g.representative_point().coords[0], 2),
                  "punt": "berekend", "doelen": ["H-B1"], "geo": {"kaart": "mexico-vs-staten", "key": key}})
        geo("mx_us_staten", key, g, {"naam": naam, "land": iso})
for r, gs in reg_geoms.items():
    geo("bra_regios", f"bra-regio-{slug(r)}", unary_union(gs), {"naam": r})
# deelstaat bij Braziliaanse steden
staat_shapes = [(f["properties"]["iso_3166_2"].split("-")[-1], shape(f["geometry"])) for f in adm1 if f["properties"].get("adm0_a3") == "BRA"]
for it in ITEMS.values():
    if it.get("land") == "BRA" and it["type"] in ("stad", "hoofdstad"):
        pt = Point(it["coord"])
        for code, g in staat_shapes:
            if g.contains(pt):
                it["feiten"]["deelstaat"] = code; it["feiten"]["regio"] = st2reg.get(code); break
for naam, t, lon, lat, ex in C.BRAZILIE:
    add({"id": f"bra-{slug(t)}-{slug(naam)}", "naam": naam, "alt": ex.get("alt", []), "type": t, "land": "BRA",
         "werelddeel": "Zuid-Amerika", "coord": [lon, lat], "punt": "benadering", "doelen": ex["doelen"],
         "feiten": {"toelichting": ex["toelichting"]} if ex.get("toelichting") else {}})

# ------------------------------------------------------------------ Mexico - VS
for a, ia, alo, ala, b, ib, blo, bla in C.GRENSPAREN:
    ida = add({"id": f"grens-{slug(a)}", "naam": a, "type": "grensstad", "land": ia, "werelddeel": "Noord-Amerika",
               "coord": [alo, ala], "punt": "benadering", "doelen": ["H-B1"]})["id"]
    idb = add({"id": f"grens-{slug(b)}", "naam": b, "type": "grensstad", "land": ib, "werelddeel": "Noord-Amerika",
               "coord": [blo, bla], "punt": "benadering", "doelen": ["H-B1"]})["id"]
    ITEMS[ida]["feiten"]["tweelingstad"] = idb
    ITEMS[idb]["feiten"]["tweelingstad"] = ida
for naam, t, lon, lat, ex in C.MEXICO_VS_EXTRA:
    ex_id = f"{slug(t)}-{slug(naam)}"
    if ex_id in ITEMS:
        ITEMS[ex_id]["doelen"] += ["H-B1"]; continue
    add({"id": ex_id, "naam": naam, "alt": ex.get("alt", []), "type": t, "land": ex.get("land"), "werelddeel": "Noord-Amerika",
         "coord": [lon, lat], "punt": "benadering", "doelen": ["H-B1"],
         "feiten": {"toelichting": ex["toelichting"]} if ex.get("toelichting") else {}})

# ------------------------------------------------------------------ platen
for f in json.load(open(os.path.join(SRC, "platepolys.json"), encoding="utf-8"))["features"]:
    pn = f["properties"]["PlateName"]
    g = shape(f["geometry"])
    if not g.is_valid:
        g = g.buffer(0)
    key = f"plaat-{slug(pn)}"
    geo("platen", key, g, {"naam": C.PLATEN.get(pn, pn + " (microplaat)"), "groot": pn in C.PLATEN})
    if pn in C.PLATEN:
        add({"id": key, "naam": C.PLATEN[pn], "alt": [pn + " Plate"], "type": "plaat", "coord": rnd(g.representative_point().coords[0], 1),
             "punt": "berekend", "doelen": ["H-C2", "V-C1", "KD25B"], "geo": {"kaart": "platen", "key": key}, "_rank": 1})
for f in json.load(open(os.path.join(SRC, "plates.json"), encoding="utf-8"))["features"]:
    GEO["plaatgrenzen"].append({"type": "Feature", "properties": {"id": f["properties"]["Name"]}, "geometry": f["geometry"]})

# ------------------------------------------------------------------ dubbelingen samenvoegen
import math
def km(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0] - a[0])
    return 6371 * math.acos(max(-1, min(1, math.sin(la1) * math.sin(la2) + math.cos(la1) * math.cos(la2) * math.cos(dl))))
TG = {"hoofdstad": "stad", "grensstad": "stad", "zee": "water", "meer": "water", "zeearm": "water", "zeestraat": "straat",
      "staat": "gebied", "regio": "gebied", "landsdeel": "gebied"}
groups_d = defaultdict(list)
for it in ITEMS.values():
    groups_d[(norm(it["naam"]), TG.get(it["type"], it["type"]))].append(it)
removed = 0
REMAP = {}
for (_, tg), lst in groups_d.items():
    if len(lst) < 2:
        continue
    lim = 60 if tg == "stad" else 1500
    lst.sort(key=lambda x: (x.get("land") != "NLD", "_slolijst" not in x, "geo" not in x))
    keep = lst[0]
    for o in lst[1:]:
        if o["id"] not in ITEMS or km(keep["coord"], o["coord"]) > lim:
            continue
        keep["alt"] = sorted((set(keep["alt"]) | set(o["alt"]) | ({o["naam"]} if o["naam"] != keep["naam"] else set())))
        keep["doelen"] = sorted(set(keep["doelen"]) | set(o["doelen"]))
        for k, v in o.get("feiten", {}).items():
            keep["feiten"].setdefault(k, v)
        if "geo" not in keep and "geo" in o and not (keep.get("land") == "NLD" and o["geo"]["kaart"] == "meren"):
            keep["geo"] = o["geo"]
        if o.get("punt") == "ne" and keep.get("punt") == "benadering" and keep.get("land") != "NLD":
            keep["coord"], keep["punt"] = o["coord"], "ne"
        for k in ("_slolijst", "_slonaam", "_rank"):
            if k in o and k not in keep:
                keep[k] = o[k]
        if "geo" in o and o["geo"]["kaart"] == "wereld-gebieden" and keep.get("geo", {}).get("kaart") == "wereld-gebieden" and keep["geo"]["key"] != o["geo"]["key"]:
            for ft in GEO["gebieden"]:
                if ft["properties"]["id"] == o["geo"]["key"]:
                    ft["properties"]["id"] = keep["geo"]["key"]
        if o["type"] == "grensstad":
            keep["type"] = "grensstad"
        REMAP[o["id"]] = keep["id"]
        del ITEMS[o["id"]]; removed += 1
print("samengevoegd:", removed, file=sys.stderr)
for oid in list(ITEMS):
    m_ = re.match(r"^(.*)-(\d+)$", oid)
    if m_ and m_.group(1) not in ITEMS:
        it = ITEMS.pop(oid); it["id"] = m_.group(1); ITEMS[it["id"]] = it
        REMAP[oid] = it["id"]
        for k, v in list(REMAP.items()):
            if v == oid: REMAP[k] = it["id"]
for it in ITEMS.values():
    t = it.get("feiten", {}).get("tweelingstad")
    while t in REMAP:
        t = REMAP[t]
    if t:
        it["feiten"]["tweelingstad"] = t

ALT_EXTRA = {"land-sdn": ["Sudan"], "zee-caraibische-zee": ["Caribische Zee"], "oceaan-grote-oceaan": ["Stille Oceaan", "Pacifische Oceaan"],
             "land-usa": ["Amerika (land)", "VS"], "land-gbr": ["VK"]}
for it in ITEMS.values():
    if it["type"] == "hoofdstad" and it["naam"].endswith(" D.C."):
        it["alt"].append(it["naam"][:-5])
for k, v in ALT_EXTRA.items():
    if k in ITEMS:
        ITEMS[k]["alt"] = sorted(set(ITEMS[k]["alt"]) | set(v))

# ------------------------------------------------------------------ SLO-basislijst koppelen
SLO = json.load(open(os.path.join(os.path.dirname(__file__), "slo300.json"), encoding="utf-8"))
HINT = {"prov.": ["provincie"], "stad": ["stad", "hoofdstad"], "land": ["land"], "rep.": ["land"]}
PREF = ["land", "werelddeel", "oceaan", "provincie", "hoofdstad", "stad", "rivier", "zee", "gebergte", "meer", "eiland",
        "eilandengroep", "regio", "woestijn", "schiereiland", "zeestraat", "kanaal", "golf", "staat", "landsdeel"]
idx = defaultdict(list)
for it in ITEMS.values():
    for n in [it["naam"]] + it["alt"] + ([it["_slonaam"]] if it.get("_slonaam") else []):
        idx[norm(n)].append(it)
unmatched = []
for lijst, names in SLO.items():
    for sn in names:
        m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", sn)
        keys, hint = [{"Grote (of Stille) Oceaan": "Grote Oceaan"}.get(sn, sn)], None
        if m and keys[0] == sn:
            keys = [m.group(1), m.group(2).lstrip("-"), sn]
            hint = HINT.get(m.group(2))
        cands = []
        for k in keys:
            cands += idx.get(norm(k), [])
        cands = [c for c in cands if not (lijst != "NEDERLAND" and c.get("land") == "NLD" and c["type"] not in ("land",))
                 or c.get("_slonaam") == sn]
        exact = [c for c in cands if c.get("_slonaam") == sn and c.get("_slolijst") == lijst]
        if exact:
            cands = exact
        if hint:
            cands = [c for c in cands if c["type"] in hint] or cands
        if lijst == "NEDERLAND":
            cands = [c for c in cands if c.get("land") == "NLD" or c["type"] in ("zee", "rivier")] or cands
        if lijst == "EUROPA":
            cands = [c for c in cands if c.get("werelddeel") in ("Europa", None) or c["type"] in ("zee", "meer", "rivier", "werelddeel")] or cands
        if not cands:
            unmatched.append((lijst, sn)); continue
        cands.sort(key=lambda c: (PREF.index(c["type"]) if c["type"] in PREF else 99, c.get("_rank", 5)))
        best = cands[0]
        best["slo300"] = True
        best.setdefault("slo_lijst", lijst)
        best["slo_naam"] = sn
        if not m or m.group(2) in ("Bombay", "Calcutta", "Peking", "Wolga", "Friesland"):
            nieuwe = m.group(1) if m else sn
            if norm(nieuwe) != norm(best["naam"]) or nieuwe != best["naam"]:
                best["alt"] = sorted((set(best["alt"]) | {best["naam"]} | ({m.group(2)} if m else set())) - {nieuwe})
                best["naam"] = nieuwe
print("SLO niet gevonden:", unmatched, file=sys.stderr)

# NL-rivierdubbels: NL-item draagt de SLO-markering, wereldrivier verwijst ernaar
# ------------------------------------------------------------------ doelen, leerjaren, moeilijkheid, kaarten
EU = (-25, 34, 62, 72); NLB = (3.2, 50.7, 7.3, 53.6); SAB = (-82, -56, -34, 13.5); MXB = (-118.5, 24, -96, 34.5); BRB = (-74.5, -34, -34, 5.5)
inb = lambda c, b: b[0] <= c[0] <= b[2] and b[1] <= c[1] <= b[3]
WERELD_TYPES = {"land", "hoofdstad", "werelddeel", "oceaan", "zee", "rivier", "gebergte", "woestijn", "plateau", "vlakte", "bekken",
                "eiland", "eilandengroep", "schiereiland", "kaap", "zeestraat", "kanaal", "golf", "baai", "meer", "berg", "vulkaan", "bergpas", "plaat",
                "regio", "landengte", "delta", "laagland", "toendra", "moerasgebied", "dal", "staat", "landsdeel", "stad", "lagune", "fjord", "zeearm"}
for it in ITEMS.values():
    d = set(it["doelen"])
    c = it["coord"]
    if it.get("slo300"):
        d.add("BASIS-TOPO")
    if it.get("land") != "NLD" and it["type"] in WERELD_TYPES:
        d.add("KD25A")
    if it.get("feiten", {}).get("megastad") or it.get("feiten", {}).get("wereldstad"):
        d |= {"H-B2", "V-B1"}
    if it["type"] == "land" and it.get("_rank", 9) <= 3:
        d |= {"H-B2", "V-B1"}
    if it.get("werelddeel") == "Zuid-Amerika" or (it["type"] in ("land", "hoofdstad") and it.get("land") in SA):
        d.add("V-D1")
        if it["type"] in ("land", "hoofdstad", "rivier", "gebergte", "plateau", "bekken"):
            d.add("H-D1")
    if it["type"] in ("oceaan", "zee") and inb(c, (-100, -60, 30, 70)):
        d.add("H-C2")
    it["doelen"] = sorted(d)
    # moeilijkheid 1 (basis) - 3 (verdieping)
    pop = it["feiten"].get("inwoners_agglomeratie") or 0
    if it.get("slo300"):
        m = 1
    elif it["type"] in ("stad", "hoofdstad"):
        m = 1 if pop >= 10_000_000 else 2 if (pop >= 3_000_000 or it["type"] == "hoofdstad") else 3
    elif it.get("_rank") is not None:
        m = 1 if it["_rank"] <= 1 else 2 if it["_rank"] <= 3 else 3
    else:
        m = 2
    it["moeilijkheid"] = m
    # leerjaren per niveau (voorstel)
    lj = {}
    onder = []
    if it.get("slo300"):
        onder = [1] if it.get("slo_lijst") in ("NEDERLAND", "EUROPA") else [2]
    elif any(x.startswith("KD25") for x in d):
        onder = [2] if m == 1 else [3]
        if "KD25C" in d and it.get("land") == "NLD":
            onder = [3]
    if onder:
        lj["onderbouw"] = onder
    if any(x.startswith("H-") for x in d):
        lj["havo"] = [4, 5]
    if any(x.startswith("V-") for x in d):
        lj["vwo"] = [4, 5, 6]
    it["leerjaren"] = lj
    # kaarten
    k = []
    if not (it.get("land") == "NLD" and it["type"] != "land"):
        k.append("wereld")
    if inb(c, EU): k.append("europa")
    if inb(c, NLB): k.append("nederland")
    if inb(c, SAB): k.append("zuid-amerika")
    if it.get("land") == "BRA" or (inb(c, BRB) and it["type"] in ("rivier", "plateau", "bekken", "gebergte", "moerasgebied")): k.append("brazilie")
    if "H-B1" in d or (inb(c, MXB) and it["type"] in ("stad", "grensstad", "deelstaat", "rivier", "woestijn", "golf")): k.append("mexico-vs")
    it["kaarten"] = k

# ------------------------------------------------------------------ wegschrijven
def bestand(it):
    if it.get("land") == "NLD": return "nederland"
    if it.get("land") == "BRA" or it["id"].startswith("bra-"): return "brazilie"
    if "H-B1" in it["doelen"]: return "mexico-vs"
    if it["type"] == "plaat": return "platen"
    if it["type"] in ("land",): return "landen"
    if it["type"] in ("stad", "hoofdstad"): return "steden"
    if it["type"] in ("oceaan", "zee", "rivier", "meer", "zeestraat", "kanaal", "golf", "baai", "lagune", "fjord", "zeearm"): return "wateren"
    return "fysisch"


dup = defaultdict(list)
for it in ITEMS.values():
    dup[(it["naam"], TG.get(it["type"], it["type"]))].append(it)
for lst in dup.values():
    if len(lst) > 1:
        lst.sort(key=lambda x: (not x.get("slo300"), x.get("moeilijkheid", 3), -(x["feiten"].get("inwoners_agglomeratie") or 0)))
        for o in lst[1:]:
            ctx = LAND.get(o.get("land"), {}).get("naam") or o.get("werelddeel") or o.get("subregio") or f"{o['coord'][1]:.0f}°, {o['coord'][0]:.0f}°"
            o["alt"] = sorted(set(o["alt"]) | {o["naam"]})
            o["naam"] = f"{o['naam']} ({ctx})"

groups = defaultdict(list)
ORDER = ["id", "naam", "alt", "type", "land", "werelddeel", "subregio", "coord", "punt", "geo", "kaarten", "slo300", "slo_lijst",
         "slo_naam", "doelen", "leerjaren", "moeilijkheid", "feiten"]
for it in ITEMS.values():
    clean = {k: it[k] for k in ORDER if k in it and it[k] not in (None, [], {})}
    clean["feiten"] = {k: v for k, v in it.get("feiten", {}).items() if v not in (None, "", [])}
    if not clean["feiten"]: clean.pop("feiten")
    groups[bestand(it)].append(clean)
for g, lst in groups.items():
    lst.sort(key=lambda x: (x.get("moeilijkheid", 9), x["naam"]))
    with open(os.path.join(OUT, "items", g + ".json"), "w", encoding="utf-8") as f:
        json.dump({"versie": "1.0.0", "groep": g, "aantal": len(lst), "items": lst}, f, ensure_ascii=False, separators=(",", ":"))
for k, feats in GEO.items():
    with open(os.path.join(RAW, k + ".geojson"), "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False)
print("items:", len(ITEMS), {g: len(v) for g, v in groups.items()}, file=sys.stderr)
print("types:", Counter(i["type"] for i in ITEMS.values()).most_common(), file=sys.stderr)
print("slo300:", sum(1 for i in ITEMS.values() if i.get("slo300")), file=sys.stderr)
