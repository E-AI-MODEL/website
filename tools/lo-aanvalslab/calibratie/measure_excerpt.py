"""Bereken voorlopige passafstand-statistiek op een kleine Metrica-selectie.

Gebruik: python3 measure_excerpt.py
De geselecteerde PASS-events zijn niet representatief voor volledige wedstrijden.
"""
import csv, json, math, statistics
from pathlib import Path
P=Path(__file__).resolve().parent
rows=list(csv.DictReader((P/"metrica_pass_excerpt.csv").open()))
lengths=[math.hypot((float(r["x1"])-float(r["x0"]))*105,
                    (float(r["y1"])-float(r["y0"]))*68) for r in rows]
def quantile(v,q):
    v=sorted(v)
    pos=q*(len(v)-1); i=int(pos); f=pos-i
    return v[i]*(1-f)+v[min(i+1,len(v)-1)]*f
data={
 "source":"https://github.com/metrica-sports/sample-data",
 "record_type":"PASS events, beperkte handselectie uit twee wedstrijden",
 "sample_size":len(rows),
 "event_pass_distance_m":{"p25":round(quantile(lengths,.25),2),
                          "median":round(statistics.median(lengths),2),
                          "p75":round(quantile(lengths,.75),2)},
 "small_field_44_5m_reference":{"median_m":round(statistics.median(lengths)*44.5/105,2)},
 "caveats":["PASS-eventlocaties zijn geen gemeten balsnelheid",
             "Niet representatief voor een LO-partijspel",
             "Geen directe label voor passsucces"]}
print(json.dumps(data,ensure_ascii=False,indent=2))
