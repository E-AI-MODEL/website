"""Maakt begrippen.json en vragen/*.json uit de items. Deterministisch (vaste seed).

Vraagformaat volgt topo/data/shuffle-vragen.json (id, kind, category, name, question, answer,
options, hint, note, shuffleMode, check) met extra velden: doelen, leerjaren, itemId, sjabloon.
"""
import json, glob, os, random, sys
from collections import defaultdict
from shapely.geometry import shape, Point

sys.path.insert(0, os.path.dirname(__file__))
from begrippen_bron import B

D = sys.argv[1]
SRC = sys.argv[2]
rng = random.Random(20261126)
items = [i for f in sorted(glob.glob(os.path.join(D, "items", "*.json"))) for i in json.load(open(f, encoding="utf-8"))["items"]]
by = {i["id"]: i for i in items}
naam_idx = defaultdict(list)
for i in items:
    for n in [i["naam"]] + i.get("alt", []):
        naam_idx[n.lower()].append(i)


def leerjaren(doelen):
    lj = {}
    if any(d.startswith("KD") or d == "BASIS-TOPO" for d in doelen):
        lj["onderbouw"] = sorted({2 if d in ("KD25A", "KD25B") else 3 if d == "KD25C" else 1 for d in doelen if d.startswith("KD") or d == "BASIS-TOPO"})
    if any(d.startswith("H-") for d in doelen): lj["havo"] = [4, 5]
    if any(d.startswith("V-") for d in doelen): lj["vwo"] = [4, 5, 6]
    return lj


# ---------------------------------------------------------------- begrippen
begrippen = []
seen = set()
for term, uitleg, doelen, voorbeelden, thema in B:
    bid = "begrip-" + "".join(c if c.isalnum() else "-" for c in term.lower()).strip("-").replace("--", "-")
    assert bid not in seen, bid
    seen.add(bid)
    refs = []
    for v in voorbeelden:
        c = naam_idx.get(v.lower(), [])
        c.sort(key=lambda x: (not x.get("slo300"), x.get("moeilijkheid", 3)))
        if c:
            refs.append(c[0]["id"])
        else:
            print("voorbeeld niet gevonden:", term, v, file=sys.stderr)
    begrippen.append({"id": bid, "term": term, "uitleg": uitleg, "thema": thema, "doelen": doelen, "leerjaren": leerjaren(doelen),
                      **({"voorbeelden": refs} if refs else {})})
json.dump({"versie": "1.0.0", "toelichting": "Uitleg in eigen woorden, bedoeld als oefenmateriaal; geen officiële definities.",
           "aantal": len(begrippen), "begrippen": begrippen}, open(os.path.join(D, "begrippen.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- vragen
Q = defaultdict(list)


def vraag(sjabloon, cat, item, question, answer, wrong, doelen, hint="", note=""):
    wrong = [w for w in dict.fromkeys(wrong) if w != answer][:3]
    if len(wrong) < 3:
        return None
    opts = [answer] + wrong
    rng.shuffle(opts)
    n = len(Q[sjabloon]) + 1
    Q[sjabloon].append({"id": f"{sjabloon}-{n}", "kind": "fact", "category": cat, "name": item["naam"] if item else answer,
                        "question": question, "answer": answer, "options": opts, "hint": hint, "note": note,
                        "shuffleMode": "quiz", "check": {"type": "databank", "sjabloon": sjabloon},
                        "doelen": sorted(set(doelen)), "leerjaren": leerjaren(doelen), **({"itemId": item["id"]} if item else {})})
    return Q[sjabloon][-1]


def pick(pool, k, excl=()):
    pool = [p for p in pool if p not in excl]
    return rng.sample(pool, min(k, len(pool)))


landen = {i["land"]: i for i in items if i["type"] == "land"}
hoofd = [i for i in items if i["type"] == "hoofdstad" and i.get("feiten", {}).get("officiele_hoofdstad", True) and i.get("land") in landen]
cap_of = defaultdict(list)
for h in hoofd:
    cap_of[h["land"]].append(h)

# 1/2 hoofdsteden
for iso, caps in cap_of.items():
    l = landen[iso]
    if len(caps) != 1 or not (l.get("feiten", {}).get("onafhankelijk") or l.get("slo300")):
        continue
    h = caps[0]
    same = [x["naam"] for x in hoofd if x.get("werelddeel") == l.get("werelddeel") and x["land"] != iso]
    d = ["KD25A"] + (["BASIS-TOPO"] if l.get("slo300") and h.get("slo300") else [])
    vraag("hoofdstad-van-land", "hoofdsteden", l, f"Wat is de hoofdstad van {l['naam']}?", h["naam"], pick(same, 3), d,
          hint=f"{l['naam']} ligt in {l.get('subregio') or l.get('werelddeel')}.")
    samel = [x["naam"] for x in landen.values() if x.get("werelddeel") == l.get("werelddeel") and x["land"] != iso and x.get("feiten", {}).get("onafhankelijk")]
    vraag("land-van-hoofdstad", "hoofdsteden", h, f"{h['naam']} is de hoofdstad van welk land?", l["naam"], pick(samel, 3), d)

# 3 werelddeel van land
WD = ["Afrika", "Azië", "Europa", "Noord-Amerika", "Zuid-Amerika", "Oceanië"]
for l in landen.values():
    if l.get("werelddeel") in WD and l.get("feiten", {}).get("onafhankelijk") and l.get("moeilijkheid", 3) <= 2:
        vraag("werelddeel-van-land", "werelddelen", l, f"In welk werelddeel ligt {l['naam']}?", l["werelddeel"],
              pick([w for w in WD if w != l["werelddeel"]], 3), ["KD25A"])

# 4 land van stad
for s in items:
    if s["type"] == "stad" and s.get("land") in landen and s.get("land") != "NLD" and (s.get("slo300") or s.get("moeilijkheid", 3) <= 2):
        l = landen[s["land"]]
        buren = [x["naam"] for x in landen.values() if x.get("subregio") == l.get("subregio") and x["land"] != l["land"] and x.get("feiten", {}).get("onafhankelijk")]
        if len(buren) < 3:
            buren += [x["naam"] for x in landen.values() if x.get("werelddeel") == l.get("werelddeel") and x["land"] != l["land"] and x.get("feiten", {}).get("onafhankelijk")]
        d = [x for x in s["doelen"] if x in ("KD25A", "BASIS-TOPO", "H-B2", "V-B1", "H-D1", "V-D1")]
        vraag("land-van-stad", "steden", s, f"In welk land ligt {s['naam']}?", l["naam"], pick(buren, 3), d or ["KD25A"])

# 5/6 Nederland
prov = [i for i in items if i["type"] == "provincie"]
pn = [p["naam"] for p in prov]
for s in items:
    if s.get("land") == "NLD" and s["type"] in ("stad", "hoofdstad") and s.get("feiten", {}).get("provincie"):
        vraag("provincie-van-stad", "nederland", s, f"In welke provincie ligt {s['naam']}?", s["feiten"]["provincie"],
              pick(pn, 3, excl=[s["feiten"]["provincie"]]), ["BASIS-TOPO", "KD25C"])
phs = {s["feiten"]["provincie"]: s for s in items if s.get("land") == "NLD" and s.get("feiten", {}).get("provinciehoofdstad")}
for p in prov:
    h = phs.get(p["naam"])
    if h:
        vraag("provinciehoofdstad", "nederland", p, f"Wat is de hoofdstad van de provincie {p['naam']}?", h["naam"],
              pick([x["naam"] for x in phs.values()], 3, excl=[h["naam"]]), ["BASIS-TOPO", "KD25C"])

# 7/8 Brazilië
staten = [i for i in items if i["type"] == "deelstaat" and i.get("land") == "BRA"]
REG = ["Noord", "Noordoost", "Centraal-West", "Zuidoost", "Zuid"]
for st in staten:
    r = st.get("feiten", {}).get("regio")
    if r:
        vraag("regio-van-deelstaat", "brazilie", st, f"In welke regio van Brazilië ligt de deelstaat {st['naam']}?", r,
              pick([x for x in REG if x != r], 3), ["H-D1", "V-D1"])
afk = {st["feiten"]["afkorting"]: st["naam"] for st in staten}
for s in items:
    if s.get("land") == "BRA" and s["type"] in ("stad", "hoofdstad") and s.get("feiten", {}).get("deelstaat") and (s.get("feiten", {}).get("inwoners_agglomeratie") or 0) >= 500_000:
        a = afk.get(s["feiten"]["deelstaat"])
        if a:
            vraag("deelstaat-van-stad", "brazilie", s, f"In welke deelstaat ligt {s['naam']}?", a, pick(list(afk.values()), 3, excl=[a]), ["H-D1", "V-D1"])
        r = s["feiten"].get("regio")
        if r:
            vraag("regio-van-stad", "brazilie", s, f"In welke regio van Brazilië ligt {s['naam']}?", r, pick([x for x in REG if x != r], 3), ["H-D1", "V-D1"])

# 9 tweelingsteden
grens = [i for i in items if i["type"] == "grensstad"]
for g in grens:
    t = by.get(g.get("feiten", {}).get("tweelingstad"))
    if t:
        other = [x["naam"] for x in grens if x["land"] == t["land"] and x["id"] != t["id"]]
        vraag("tweelingstad", "grens", g, f"Welke stad ligt tegenover {g['naam']}, aan de andere kant van de grens?", t["naam"],
              pick(other, 3), ["H-B1"], note="Tweelingsteden zijn sterk verbonden door pendel, handel en maquiladora's.")

# 10 soort plek
SOORT = {"rivier", "gebergte", "woestijn", "zee", "meer", "eiland", "eilandengroep", "schiereiland", "plateau", "vlakte",
         "zeestraat", "golf", "oceaan", "kanaal", "berg", "vulkaan", "delta", "regio", "bioom", "stuwdam", "waterkering", "polder"}
for i in items:
    if i["type"] in SOORT and (i.get("slo300") or i.get("moeilijkheid", 3) <= 1 or i.get("land") in ("NLD", "BRA")):
        d = [x for x in i["doelen"] if not x.startswith("V-D2") and not x.startswith("H-D2")] or ["KD25A"]
        vraag("soort-plek", "soort", i, f"Wat voor soort plek is {i['naam']}?", i["type"], pick(sorted(SOORT - {i["type"]}), 3), d)

# 11 hoogste berg
BEKEND = {"Mount Everest", "K2", "Aconcagua", "Denali", "Kilimanjaro", "Mont Blanc", "Elbroes", "Mount Kosciuszko", "Vinsonmassief",
          "Mount Whitney", "Fuji", "Chimborazo", "Cotopaxi", "Huascarán", "Ojos del Salado", "Pico de Orizaba", "Pico da Neblina",
          "Matterhorn", "Zugspitze", "Vesuvius", "Vaalserberg"}
bergen = [i for i in items if i["type"] in ("berg", "vulkaan") and i.get("feiten", {}).get("hoogte_m") and i["naam"] in BEKEND]
for _ in range(40):
    s = rng.sample(bergen, 4)
    hs = sorted(s, key=lambda x: -x["feiten"]["hoogte_m"])
    if hs[0]["feiten"]["hoogte_m"] - hs[1]["feiten"]["hoogte_m"] < 300:
        continue
    vraag("hoogste-berg", "aarde", hs[0], "Welke berg is het hoogst?", hs[0]["naam"], [x["naam"] for x in hs[1:]], ["H-C2", "V-C1"],
          note=f"{hs[0]['naam']}: {hs[0]['feiten']['hoogte_m']} m.")

# 12 grootste stad
steden = [i for i in items if i["type"] in ("stad", "hoofdstad") and (i.get("feiten", {}).get("inwoners_agglomeratie") or 0) >= 2_000_000]
per_wd = defaultdict(list)
for s in steden:
    per_wd[s.get("werelddeel")].append(s)
for wd, lst in per_wd.items():
    if not wd or len(lst) < 8:
        continue
    for _ in range(25):
        s = rng.sample(lst, 4)
        ps = sorted(s, key=lambda x: -x["feiten"]["inwoners_agglomeratie"])
        if ps[0]["feiten"]["inwoners_agglomeratie"] < 1.3 * ps[1]["feiten"]["inwoners_agglomeratie"]:
            continue
        vraag("grootste-stad", "steden", ps[0], f"Welke van deze steden in {wd} heeft de meeste inwoners (agglomeratie)?", ps[0]["naam"],
              [x["naam"] for x in ps[1:]], ["KD25A", "H-B2", "V-B1"], note="Bron: Natural Earth (POP_MAX), afgerond.")

# 13 noordelijkst (Nederland, SLO-steden)
nl_st = [i for i in items if i.get("land") == "NLD" and i["type"] in ("stad", "hoofdstad") and i.get("slo300")]
for _ in range(60):
    s = rng.sample(nl_st, 4)
    ss = sorted(s, key=lambda x: -x["coord"][1])
    if ss[0]["coord"][1] - ss[1]["coord"][1] < 0.15:
        continue
    vraag("noordelijkst-nl", "nederland", ss[0], "Welke stad ligt het noordelijkst?", ss[0]["naam"], [x["naam"] for x in ss[1:]], ["BASIS-TOPO", "KD24C"])

# 14 plaat onder land/stad
platen = []
for f in json.load(open(os.path.join(SRC, "platepolys.json"), encoding="utf-8"))["features"]:
    g = shape(f["geometry"])
    if not g.is_valid: g = g.buffer(0)
    platen.append((f["properties"]["PlateName"], g))
import curated as C
pl_names = list(C.PLATEN.values())
for i in items:
    if i["type"] in ("hoofdstad", "stad") and (i.get("slo300") or i.get("moeilijkheid", 3) == 1) and i.get("land") != "NLD":
        pt = Point(i["coord"])
        hit = [(n, g) for n, g in platen if g.contains(pt)]
        if len(hit) == 1 and hit[0][0] in C.PLATEN and hit[0][1].boundary.distance(pt) > 2.5:
            hit = [hit[0][0]]
            a = C.PLATEN[hit[0]]
            vraag("plaat-onder", "aarde", i, f"Op welke plaat ligt {i['naam']}?", a, pick(pl_names, 3, excl=[a]), ["H-C2", "V-C1", "KD25B"],
                  note="Gebaseerd op het plaatmodel PB2002 (Bird, 2003). Alleen plaatsen die ruim van een plaatgrens af liggen.")

# 15/16 begrippen
per_thema = defaultdict(list)
for b in begrippen:
    per_thema[b["thema"]].append(b)
for b in begrippen:
    pool = [x["term"] for x in per_thema[b["thema"]] if x["id"] != b["id"]]
    if len(pool) < 3:
        pool += [x["term"] for x in begrippen if x["id"] != b["id"]]
    q = vraag("begrip-bij-uitleg", "begrippen", None, f"Welk begrip past bij deze uitleg? {b['uitleg']}", b["term"], pick(pool, 3), b["doelen"])
    if q: q["begripId"] = b["id"]
    for ref in b.get("voorbeelden", [])[:2]:
        it = by[ref]
        q = vraag("voorbeeld-van-begrip", "begrippen", it, f"{it['naam']} is een voorbeeld van…", b["term"], pick(pool, 3), b["doelen"])
        if q: q["begripId"] = b["id"]

os.makedirs(os.path.join(D, "vragen"), exist_ok=True)
index = []
for sj, lst in sorted(Q.items()):
    json.dump({"version": 1, "sjabloon": sj, "policy": "Gegenereerd uit de TOPO VO-databank; antwoorden volgen uit de itemgegevens.",
               "questions": lst}, open(os.path.join(D, "vragen", sj + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    index.append({"sjabloon": sj, "bestand": f"vragen/{sj}.json", "aantal": len(lst)})
json.dump({"versie": "1.0.0", "sjablonen": index, "totaal": sum(x["aantal"] for x in index)},
          open(os.path.join(D, "vragen", "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("begrippen", len(begrippen), "vragen", {x["sjabloon"]: x["aantal"] for x in index}, sum(x["aantal"] for x in index))
