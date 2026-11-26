"""Maakt sets.json: kant-en-klare oefensets per leerjaar en doel, op basis van items/*.json."""
import json, glob, os, sys

D = sys.argv[1]
items, GROEP = [], {}
for f in sorted(glob.glob(os.path.join(D, "items", "*.json"))):
    g = os.path.splitext(os.path.basename(f))[0]
    for i in json.load(open(f, encoding="utf-8"))["items"]:
        items.append(i); GROEP[i["id"]] = g
by = {i["id"]: i for i in items}
# vragen per item (sets.py draait na vragen.py)
ALLE_VRAGEN = []
for f in sorted(glob.glob(os.path.join(D, "vragen", "*.json"))):
    if f.endswith("index.json"):
        continue
    ALLE_VRAGEN += json.load(open(f, encoding="utf-8"))["questions"]
os.makedirs(os.path.join(D, "vragen", "sets"), exist_ok=True)
for old in glob.glob(os.path.join(D, "vragen", "sets", "*.json")):
    os.remove(old)


def bundel(set_id, items_ids=(), begrip_ids=(), doelen=()):
    """Vragen bij de set: over een item of begrip uit de set én met minstens één doel van de set."""
    ids, bs, ds = set(items_ids), set(begrip_ids), set(doelen)
    qs = [q for q in ALLE_VRAGEN if ((q.get("itemId") in ids and not q.get("begripId")) or q.get("begripId") in bs)
          and ds & set(q.get("doelen", []))]
    if not qs:
        return None
    path = f"vragen/sets/{set_id}.json"
    json.dump({"version": 1, "set": set_id, "questions": qs}, open(os.path.join(D, path), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    return path
begrippen = json.load(open(os.path.join(D, "begrippen.json"), encoding="utf-8"))["begrippen"]

WATER = {"oceaan", "zee", "golf", "baai", "zeestraat"}
FYS = {"gebergte", "woestijn", "plateau", "vlakte", "bekken", "landengte", "toendra", "delta", "laagland", "berg"}
ALLE = ["point", "choice", "type", "missing", "zoom", "quiz"]


def onafh(i):
    return i["type"] != "land" or i.get("feiten", {}).get("onafhankelijk") or i.get("slo300")


SETS = []


# Zelfde families als in pagina/spel.js: 'wat mist er' en 'ingezoomd' werken alleen met minstens vier
# punten (plekken zonder vorm op de kaart) van dezelfde familie.
FAMILIE = {"stad": "plaats", "hoofdstad": "plaats", "grensstad": "plaats", "plaats": "plaats", "luchthaven": "plaats", "haven": "plaats",
           "favela": "plaats", "zee": "water", "oceaan": "water", "golf": "water", "baai": "water", "zeestraat": "water", "zeearm": "water",
           "lagune": "water", "fjord": "water", "meer": "water", "eiland": "eiland", "eilandengroep": "eiland", "gebergte": "reliëf",
           "plateau": "reliëf", "vlakte": "reliëf", "bekken": "reliëf", "laagland": "reliëf", "dal": "reliëf", "toendra": "reliëf",
           "berg": "top", "vulkaan": "top", "deelstaat": "gebied", "provincie": "gebied", "staat": "gebied", "landsdeel": "gebied",
           "regio": "gebied", "natuurgebied": "gebied", "polder": "gebied", "bioom": "gebied", "waterkering": "werk", "dijk": "werk",
           "stuwdam": "werk", "kustproject": "werk", "rivierproject": "werk"}


def speelbare_vormen(sel, vragen):
    punten = {}
    for i in sel:
        if not i.get("geo"):
            f = FAMILIE.get(i["type"], i["type"])
            punten[f] = punten.get(f, 0) + 1
    vormen = ["point", "choice", "type"]
    if any(n >= 4 for n in punten.values()):
        vormen += ["missing", "zoom"]
    if vragen:
        vormen += ["quiz"]
    return vormen


def S(id, titel, niveau, leerjaren, doelen, kaart, f, vraagvormen=None, uitleg=""):
    sel = [i for i in items if f(i)]
    sel.sort(key=lambda i: (i.get("moeilijkheid", 3), i["naam"]))
    zonder_kaart = [i["id"] for i in sel if kaart not in i.get("kaarten", [])]
    sel = [i for i in sel if kaart in i.get("kaarten", [])] if len(zonder_kaart) < len(sel) else sel
    vr = bundel(id, [i["id"] for i in sel], doelen=doelen)
    vraagvormen = [v for v in (vraagvormen or ALLE) if v in speelbare_vormen(sel, vr)]
    if vr and "quiz" not in vraagvormen:
        os.remove(os.path.join(D, vr)); vr = None
    SETS.append({"id": id, "titel": titel, "niveau": niveau, "leerjaren": leerjaren, "doelen": doelen, "kaart": kaart,
                 "vraagvormen": vraagvormen, "uitleg": uitleg, "aantal": len(sel), "items": [i["id"] for i in sel],
                 "bestanden": sorted({"items/" + GROEP[i["id"]] + ".json" for i in sel}), **({"vragen": vr} if vr else {}),
                 **({"niet_op_kaart": zonder_kaart} if zonder_kaart else {})})


def BEGRIP(id, titel, niveau, leerjaren, f, uitleg=""):
    sel = [b for b in begrippen if f(b)]
    doelen = sorted({d for b in sel for d in b["doelen"]})
    SETS.append({"id": id, "titel": titel, "niveau": niveau, "leerjaren": leerjaren, "doelen": doelen, "kaart": None,
                 "vraagvormen": ["quiz"], "uitleg": uitleg, "aantal": len(sel), "items": [], "begrippen": [b["id"] for b in sel],
                 "bestanden": [], "vragen": bundel(id, (), [b["id"] for b in sel], doelen)})


# ---------------- onderbouw
S("ob1-nl-basis", "Nederland: de basislijst", "onderbouw", [1], ["BASIS-TOPO"], "nederland",
  lambda i: i.get("slo_lijst") == "NEDERLAND", uitleg="De 100 Nederlandse namen van de SLO-basislijst.")
S("ob1-nl-provincies", "Provincies en provinciehoofdsteden", "onderbouw", [1], ["BASIS-TOPO", "KD25C"], "nederland",
  lambda i: i["type"] == "provincie" or i.get("feiten", {}).get("provinciehoofdstad"))
S("ob1-nl-water", "Water in Nederland", "onderbouw", [1], ["BASIS-TOPO", "KD25B"], "nederland",
  lambda i: i.get("land") == "NLD" and i.get("slo300") and i["type"] in ("rivier", "kanaal", "meer", "zee", "zeearm", "dijk"))
S("ob1-eu-basis", "Europa: de basislijst", "onderbouw", [1], ["BASIS-TOPO", "KD25A"], "europa",
  lambda i: i.get("slo_lijst") == "EUROPA")
S("ob1-eu-landen-hoofdsteden", "Europa: alle landen en hoofdsteden", "onderbouw", [1, 2], ["KD25A"], "europa",
  lambda i: i.get("werelddeel") == "Europa" and onafh(i) and (i["type"] == "land" or (i["type"] == "hoofdstad" and i.get("feiten", {}).get("officiele_hoofdstad", True))) and "europa" in i.get("kaarten", []))
S("ob2-wereld-basis", "Wereld: de basislijst", "onderbouw", [2], ["BASIS-TOPO", "KD25A"], "wereld",
  lambda i: i.get("slo_lijst") == "WERELD")
S("ob2-werelddelen-oceanen", "Werelddelen en oceanen", "onderbouw", [1, 2], ["BASIS-TOPO", "KD25A"], "wereld",
  lambda i: i["type"] in ("werelddeel", "oceaan"), vraagvormen=["point", "choice", "type"])
for wd, code in [("Afrika", "afrika"), ("Azië", "azie"), ("Noord-Amerika", "noord-amerika"), ("Zuid-Amerika", "zuid-amerika"), ("Oceanië", "oceanie")]:
    S(f"ob2-landen-{code}", f"{wd}: landen en hoofdsteden", "onderbouw", [2], ["KD25A"], "wereld",
      lambda i, wd=wd: i.get("werelddeel") == wd and onafh(i) and i["type"] in ("land", "hoofdstad") and (i["type"] == "land" or i.get("feiten", {}).get("officiele_hoofdstad", True)))
S("ob2-zeeen", "Zeeën, golven en zeestraten", "onderbouw", [2], ["KD25A"], "wereld",
  lambda i: i["type"] in WATER and i.get("moeilijkheid", 3) <= 2)
S("ob2-rivieren", "Grote rivieren van de wereld", "onderbouw", [2], ["KD25A", "KD25B"], "wereld",
  lambda i: i["type"] == "rivier" and i.get("land") != "NLD")
S("ob2-landschap", "Gebergten, woestijnen en hooglanden", "onderbouw", [2, 3], ["KD25A", "KD25B"], "wereld",
  lambda i: i["type"] in FYS and i.get("moeilijkheid", 3) <= 2)
S("ob3-megasteden", "Megasteden en wereldsteden", "onderbouw", [3], ["KD25A"], "wereld",
  lambda i: i.get("feiten", {}).get("megastad"), uitleg="Steden met een agglomeratie van 10 miljoen inwoners of meer (Natural Earth, POP_MAX).")
S("ob3-nl-inrichting", "Ruimtelijke inrichting van Nederland", "onderbouw", [3], ["KD25C"], "nederland",
  lambda i: i.get("land") == "NLD" and "KD25C" in i["doelen"] and i["type"] not in ("stad",))
S("ob3-platen", "Platen van de aarde", "onderbouw", [3], ["KD25B"], "wereld",
  lambda i: i["type"] == "plaat", vraagvormen=["point", "choice"])
S("ob3-wereld-verdieping", "Wereld: alle landen", "onderbouw", [3], ["KD25A"], "wereld",
  lambda i: i["type"] == "land" and onafh(i))

# ---------------- havo
S("h-b1-mexico-vs", "Grensgebied Mexico – Verenigde Staten", "havo", [4], ["H-B1"], "mexico-vs",
  lambda i: "H-B1" in i["doelen"], uitleg="Schoolexamenstof (SE). De syllabus noemt Mexico–VS als voorbeeld van een grensgebied tussen arm en rijk.")
S("h-b2-mondialisering", "Wereld en mondialisering", "havo", [4, 5], ["H-B2"], "wereld",
  lambda i: "H-B2" in i["doelen"] and (i["type"] in ("zeestraat", "kanaal", "kaap", "haven") or (i["type"] == "land" and i.get("moeilijkheid", 3) <= 1) or i.get("feiten", {}).get("megastad") or (i["type"] == "regio" and i.get("land") == "NLD")))
S("h-c2-aarde", "Aarde: platen, gebergten en landschapszones", "havo", [4, 5], ["H-C2"], "wereld",
  lambda i: "H-C2" in i["doelen"] and i.get("moeilijkheid", 3) <= 2)
S("h-d1-brazilie", "Brazilië", "havo", [4, 5], ["H-D1"], "brazilie",
  lambda i: "H-D1" in i["doelen"] and "brazilie" in i.get("kaarten", []) and (i.get("land") == "BRA" or i["type"] in ("rivier", "plateau", "bekken", "moerasgebied")) and (i["type"] != "stad" or (i.get("feiten", {}).get("inwoners_agglomeratie") or 0) >= 1_000_000))
S("h-d1-zuid-amerika", "Brazilië in Zuid-Amerika", "havo", [4], ["H-D1"], "zuid-amerika",
  lambda i: i["type"] in ("land", "hoofdstad") and "H-D1" in i["doelen"] and "zuid-amerika" in i.get("kaarten", []))
S("h-e1-water", "Water in Nederland: Rijn, Maas, IJsselmeergebied, Wadden en Delta", "havo", [4, 5], ["H-E1"], "nederland",
  lambda i: i.get("land") == "NLD" and "H-E1" in i["doelen"] and i["type"] not in ("stad", "provincie", "eiland"))
S("h-e2-steden", "Steden in Nederland", "havo", [5], ["H-E2"], "nederland",
  lambda i: i.get("land") == "NLD" and i["type"] == "stad")

# ---------------- vwo
S("v-a1-mentale-kaart", "Mentale kaart van de wereld (basislijst)", "vwo", [4], ["V-A1", "BASIS-TOPO"], "wereld",
  lambda i: i.get("slo300") and i.get("slo_lijst") != "NEDERLAND", uitleg="Herhaling van de basislijst: Europa en de wereld.")
S("v-b1-mondialisering", "Wereld en mondialisering", "vwo", [4, 5], ["V-B1"], "wereld",
  lambda i: "V-B1" in i["doelen"] and (i["type"] in ("zeestraat", "kanaal", "kaap", "haven") or (i["type"] == "land" and i.get("moeilijkheid", 3) <= 1) or i.get("feiten", {}).get("megastad") or (i["type"] == "regio" and i.get("land") == "NLD")))
S("v-c1-aarde", "De aarde als systeem", "vwo", [4, 5], ["V-C1"], "wereld",
  lambda i: "V-C1" in i["doelen"] and i.get("moeilijkheid", 3) <= 2)
S("v-d1-zuid-amerika", "Zuid-Amerika", "vwo", [4, 5, 6], ["V-D1"], "zuid-amerika",
  lambda i: "V-D1" in i["doelen"] and "zuid-amerika" in i.get("kaarten", []) and (i["type"] != "stad" or (i.get("feiten", {}).get("inwoners_agglomeratie") or 0) >= 2_000_000) and i["type"] not in ("deelstaat", "favela", "weg", "plaats"))
S("v-d1-brazilie", "Brazilië binnen Zuid-Amerika", "vwo", [5, 6], ["V-D1"], "brazilie",
  lambda i: "V-D1" in i["doelen"] and i.get("land") == "BRA" and i["type"] in ("regio", "deelstaat", "bioom", "hoofdstad", "stuwdam") or (i.get("land") == "BRA" and i["type"] == "stad" and (i.get("feiten", {}).get("inwoners_agglomeratie") or 0) >= 2_000_000))
S("v-e1-water-stad", "Leefomgeving Nederland: water en stad", "vwo", [4, 5, 6], ["V-E1"], "nederland",
  lambda i: i.get("land") == "NLD" and "V-E1" in i["doelen"] and i["type"] not in ("provincie", "eiland"))

# ---------------- begrippen (zonder kaart)
BEGRIP("ob-begrippen-kaart", "Begrippen: kaart en atlas", "onderbouw", [1, 2], lambda b: b["thema"] == "kaart")
BEGRIP("ob-begrippen-wereld", "Begrippen: bevolking, stad en klimaat", "onderbouw", [2, 3],
       lambda b: b["thema"] in ("bevolking", "stad", "klimaat") and any(d.startswith("KD") for d in b["doelen"]))
BEGRIP("ob-begrippen-nl", "Begrippen: water en inrichting van Nederland", "onderbouw", [3],
       lambda b: b["thema"] in ("water", "inrichting") and any(d.startswith("KD") for d in b["doelen"]))
BEGRIP("h-begrippen-wereld", "Begrippen: wereld, mondialisering en grens", "havo", [4, 5], lambda b: b["thema"] in ("mondialisering", "grens", "ontwikkeling", "bevolking", "stad") and any(d.startswith("H-B") for d in b["doelen"]))
BEGRIP("h-begrippen-aarde", "Begrippen: aarde en klimaat", "havo", [4, 5], lambda b: b["thema"] in ("aarde", "klimaat") and any(d.startswith("H-C") for d in b["doelen"]))
BEGRIP("h-begrippen-brazilie", "Begrippen: Brazilië", "havo", [4, 5], lambda b: any(d.startswith("H-D") for d in b["doelen"]))
BEGRIP("h-begrippen-leefomgeving", "Begrippen: water en stad in Nederland", "havo", [4, 5], lambda b: any(d.startswith("H-E") for d in b["doelen"]))
BEGRIP("v-begrippen-wereld", "Begrippen: mondialisering", "vwo", [4, 5], lambda b: any(d.startswith("V-B") for d in b["doelen"]))
BEGRIP("v-begrippen-aarde", "Begrippen: aarde als systeem", "vwo", [4, 5], lambda b: any(d.startswith("V-C") for d in b["doelen"]))
BEGRIP("v-begrippen-zuid-amerika", "Begrippen: Zuid-Amerika", "vwo", [5, 6], lambda b: any(d.startswith("V-D") for d in b["doelen"]))
BEGRIP("v-begrippen-leefomgeving", "Begrippen: leefomgeving Nederland", "vwo", [4, 5, 6], lambda b: any(d.startswith("V-E") for d in b["doelen"]))

# ---------------- examenmix
CE_H = {"H-B2", "H-C2", "H-D1", "H-E1"}
CE_V = {"V-B1", "V-C1", "V-D1", "V-E1"}
S("h-ce-mix", "Havo examenmix (CE-domeinen)", "havo", [5], sorted(CE_H), "wereld",
  lambda i: bool(CE_H & set(i["doelen"])) and i.get("moeilijkheid", 3) <= 1 and "wereld" in i.get("kaarten", []))
S("v-ce-mix", "Vwo examenmix (CE-domeinen)", "vwo", [6], sorted(CE_V), "wereld",
  lambda i: bool(CE_V & set(i["doelen"])) and i.get("moeilijkheid", 3) <= 1 and "wereld" in i.get("kaarten", []))

out = {"versie": "1.0.0", "toelichting": "Sets zijn voorstellen. De docent kan via doelen, kaart en items eigen sets samenstellen.",
       "vraagvormen": {"point": "aanwijzen op de kaart", "choice": "kies uit vier", "type": "naam typen", "missing": "welke ontbreekt?", "zoom": "inzoomen en kiezen", "quiz": "zonder kaart"},
       "sets": SETS}
json.dump(out, open(os.path.join(D, "sets.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for s in SETS:
    print(f"{s['id']:28} {s['aantal']:4}  {('niet op kaart: ' + str(len(s['niet_op_kaart']))) if s.get('niet_op_kaart') else ''}")
