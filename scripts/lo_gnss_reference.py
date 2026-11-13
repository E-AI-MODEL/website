"""Lees échte 10 Hz positiegegevens van 6 U18-spelers in kleine partijvormen.

Controleert alleen snelheid/bewegingsspreiding. Geen labels voor rugdekking
of verdediging; deze steekproef valideert tactische beslissingen dus niet.
De bronbestanden staan bij Zhang et al. (2025), MIT-code, sample data.
"""
import csv, io, json, math, statistics, urllib.request
from datetime import datetime

BASE="https://raw.githubusercontent.com/latilongitude/GNSS_FootballTactical/main/Dataset_A_Positional_data"
IDS=range(1,7)

def timestamp(raw,idx):
    v=str(raw or "").strip()
    if not v:return None
    try:return datetime.fromisoformat(v.replace("Z","+00:00")).timestamp()
    except ValueError:pass
    try:
        number=float(v)
        # Catapult-export bewaart tijden als Excel-seriedagen. Zet om naar seconden.
        return number*86400 if 20000<number<90000 else number
    except ValueError:return None

def coords(row):
    fields={k.strip().lower():v for k,v in row.items() if k}
    for x,y in (("latitude","longitude"),("lat","lon")):
        if x in fields and y in fields:
            try:return float(fields[x]),float(fields[y])
            except ValueError:return None
    return None

def percentiles(a):
    a=sorted(a)
    return {p:round(a[int((len(a)-1)*p/100)],3) for p in (10,50,75,90)} if a else {}

def one_player(pid):
    url=f"{BASE}/U18_ID{pid}.csv"
    req=urllib.request.Request(url,headers={"User-Agent":"EAI-LO-open-science-audit/1.0"})
    with urllib.request.urlopen(req,timeout=45) as resp:
        content=resp.read(4_000_000).decode("utf-8-sig")
    rows=list(csv.DictReader(io.StringIO(content)))
    if not rows:raise ValueError(f"No GNSS rows for ID{pid}")
    print(f"GNSS ID{pid} headers: {list(rows[0])}; first: {rows[0]}; second: {rows[1] if len(rows)>1 else None}")
    series=[]
    for i,row in enumerate(rows):
        c=coords(row)
        if not c:continue
        fields={k.strip().lower():v for k,v in row.items() if k}
        t=timestamp(fields.get("timestamp") or fields.get("time"),i)
        if t is None:continue
        if series and t<=series[-1][0]:continue
        series.append((t,*c))
    if len(series)<30:raise ValueError(f"Only {len(series)} usable coordinates for ID{pid}")
    speeds=[]
    for i in range(5,len(series)):
        a,b=series[i-5],series[i]
        dt=b[0]-a[0]
        if not (.3<=dt<=1.5):continue
        mid=math.radians((a[1]+b[1])/2)
        dx=math.radians(b[2]-a[2])*math.cos(mid)*6_371_000
        dy=math.radians(b[1]-a[1])*6_371_000
        speed=math.hypot(dx,dy)/dt
        if math.isfinite(speed) and speed<20:speeds.append(speed)
    if len(speeds)<25:raise ValueError(f"Speed samples inadequate: {len(speeds)}")
    return {"player":pid,"rows":len(series),"speed_samples":len(speeds),"p_mps":percentiles(speeds),
            "method":"0.5 s 5-frame displacement, raw GNSS without role labels"}

def main():
    players=[one_player(i) for i in IDS]
    print("GNSS_REFERENCE_JSON_BEGIN")
    print(json.dumps({"source":"Zhang et al. 2025: GNSS_FootballTactical U18 sample",
      "players":players,
      "limits":"6 individual traces, not 6 independent matches; no ball or defence roles; displacement includes GNSS noise; not a tactical accuracy benchmark"},ensure_ascii=False,indent=2))
    print("GNSS_REFERENCE_JSON_END")

if __name__=="__main__":main()
