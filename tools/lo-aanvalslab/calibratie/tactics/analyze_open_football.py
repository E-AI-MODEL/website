"""Meet passlijnruimte met echte StatsBomb 360-snapshots.

Geen doorlopende tracking: alleen zichtbare spelers bij een balgebeurtenis.
Resultaten in StatsBomb 120x80-coordinaateenheden, niet in veldmeters.
"""
import argparse
import json
import math
import statistics
import urllib.request
from pathlib import Path

MATCH = 3788741
BASE = "https://raw.githubusercontent.com/hudl/open-data/master/data"


def segment_distance(point, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    norm = dx*dx+dy*dy
    fraction = min(1., max(0., ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/norm)) if norm else 0.
    return math.hypot(point[0]-a[0]-fraction*dx,point[1]-a[1]-fraction*dy)


def summarize(values):
    values = sorted(values)
    if not values:
        return None
    return {"n": len(values), "mediaan": round(statistics.median(values),2),
            "p10": round(values[round(.1*(len(values)-1))],2),
            "p90": round(values[round(.9*(len(values)-1))],2)}


def analyze(events, frames):
    indexed = {f.get("event_uuid"): f for f in frames if f.get("event_uuid")}
    results = {"complete": [], "not_complete": []}
    total = missing = no_defenders = no_coordinates = 0
    for event in events:
        if event.get("type",{}).get("name") != "Pass":
            continue
        total += 1
        freeze = indexed.get(event.get("id"))
        if not freeze:
            missing += 1
            continue
        a = event.get("location")
        b = event.get("pass",{}).get("end_location")
        if not (isinstance(a,list) and len(a)>=2 and isinstance(b,list) and len(b)>=2):
            no_coordinates += 1
            continue
        opponents = [p["location"] for p in freeze.get("freeze_frame",[])
                     if p.get("teammate") is False and len(p.get("location",[]))>=2]
        if not opponents:
            no_defenders += 1
            continue
        line_gap = min(segment_distance(p,a,b) for p in opponents)
        holder_gap = min(math.hypot(p[0]-a[0],p[1]-a[1]) for p in opponents)
        length = math.hypot(a[0]-b[0],a[1]-b[1])
        result = "not_complete" if event.get("pass",{}).get("outcome") else "complete"
        results[result].append((line_gap, holder_gap, length))
    return {
        "bron": "StatsBomb Open Data / Hudl",
        "wedstrijd": MATCH,
        "totaal_passevents": total,
        "zonder_360_frame": missing,
        "zonder_zichtbare_verdediger": no_defenders,
        "zonder_coordinaten": no_coordinates,
        "aantal_passevents_met_bruikbaar_beeld": sum(map(len,results.values())),
        "per_resultaat": {
            key: {"passbaan_120x80_eenheden": summarize([r[0] for r in rows]),
                  "afstand_tot_passer_120x80_eenheden": summarize([r[1] for r in rows]),
                  "passlengte_120x80_eenheden": summarize([r[2] for r in rows])}
            for key,rows in results.items()
        },
        "bewijslimiet": "360 toont gedeeltelijk zichtveld, geen doorlopende tracking of schoolsimulatie-kansen."
    }


def get_json(url):
    request = urllib.request.Request(url,headers={"User-Agent":"EAI-open-tactics/1.0"})
    with urllib.request.urlopen(request,timeout=45) as response:
        data = response.read(35*1024*1024+1)
    if len(data)>35*1024*1024:
        raise ValueError("Bronbestand groter dan 35 MB")
    return json.loads(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", type=Path)
    parser.add_argument("--frames", type=Path)
    args = parser.parse_args()
    if bool(args.events) != bool(args.frames):
        parser.error("Geef beide lokale bestanden op of laat beide weg")
    events = json.loads(args.events.read_text()) if args.events else get_json(f"{BASE}/events/{MATCH}.json")
    frames = json.loads(args.frames.read_text()) if args.frames else get_json(f"{BASE}/three-sixty/{MATCH}.json")
    print(json.dumps(analyze(events,frames),ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
