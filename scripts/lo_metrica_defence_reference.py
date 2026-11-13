"""Open Metrica tracking: twee dichtstbijzijnde verdedigers rond de bal.

Bezit en doelzijde zijn proxies, geen handmatig gelabelde tactische acties.
De twee volwassen wedstrijden vormen geen validatie van LO 3v2 of andere sporten.
Download alleen tijdens de meting; sla alleen geaggregeerde tellingen op.
"""
import csv, io, json, math, statistics, urllib.request
from collections import defaultdict

BASE = "https://raw.githubusercontent.com/metrica-sports/sample-data/master/data"
HEADERS = {"User-Agent": "LO-aanvalslab-independent-shape-research/1.0"}

def stats(values):
    v=sorted(float(x) for x in values if math.isfinite(x))
    if not v:return {"n":0}
    return {"n":len(v),
            "p10":round(v[int((len(v)-1)*.1)],3),
            "p50":round(v[int((len(v)-1)*.5)],3),
            "p75":round(v[int((len(v)-1)*.75)],3),
            "p90":round(v[int((len(v)-1)*.9)],3)}

def stream(game,team):
    url=f"{BASE}/Sample_Game_{game}/Sample_Game_{game}_RawTrackingData_{team}_Team.csv"
    req=urllib.request.Request(url,headers=HEADERS)
    resp=urllib.request.urlopen(req,timeout=150)
    reader=csv.reader(io.TextIOWrapper(resp,encoding="utf-8-sig",errors="replace"))
    next(reader);next(reader);head=next(reader)
    pairs=[(i,head[i]) for i in range(3,len(head)-1,2)
           if head[i] and head[i].startswith("Player")]
    ball_idx=next((i for i,v in enumerate(head) if v=="Ball"),None)
    if ball_idx is None:raise ValueError(f"No Ball column: {url}")
    return resp,reader,pairs,ball_idx

def unpack(row,pairs,bi):
    try:period=int(row[0]);frame=int(row[1])
    except (IndexError,ValueError):return None
    players=[]
    for col,name in pairs:
        try:
            x=float(row[col])*105;y=float(row[col+1])*68
            if -2.6<=x<=107.6 and -1.7<=y<=69.7:players.append((name,x,y))
        except (IndexError,ValueError):continue
    try:
        bx=float(row[bi])*105;by=float(row[bi+1])*68
        if not all(math.isfinite(x) for x in (bx,by)):return None
        ball=(bx,by)
    except (IndexError,ValueError):return None
    return period,frame,players,ball

def match(game):
    resp_h,hr,hpairs,hbi=stream(game,"Home")
    resp_a,ar,apairs,abi=stream(game,"Away")
    out=defaultdict(list);frames=valid=used=0
    try:
        for hrow,arow in zip(hr,ar):
            frames+=1
            if frames%25:continue  # Eén steekproef per seconde; minder correlatie
            h=unpack(hrow,hpairs,hbi);a=unpack(arow,apairs,abi)
            if not h or not a or h[:2]!=a[:2]:continue
            hp,ap=h[2],a[2];ball=h[3]
            if len(hp)<9 or len(ap)<9:continue
            valid+=1
            home_near=min(math.dist(ball,p[1:]) for p in hp)
            away_near=min(math.dist(ball,p[1:]) for p in ap)
            if min(home_near,away_near)>2.5 or abs(home_near-away_near)<.75:continue
            attackers,defenders=(hp,ap) if home_near<away_near else (ap,hp)
            centre_delta=statistics.fmean(p[1] for p in defenders)-statistics.fmean(p[1] for p in attackers)
            if abs(centre_delta)<4:continue
            orientation=1 if centre_delta>0 else -1
            closest=sorted(defenders,key=lambda p:math.dist(ball,p[1:]))
            press,support=closest[:2]
            pressure_dist=math.dist(ball,press[1:])
            support_dist=math.dist(ball,support[1:])
            pair_dist=math.dist(press[1:],support[1:])
            out["pressure_m"].append(pressure_dist)
            out["second_nearest_m"].append(support_dist)
            out["two_defenders_distance_m"].append(pair_dist)
            out["second_nearest_goalside"].append(int((support[1]-ball[0])*orientation>.25))
            out["second_nearest_goalside_and_close"].append(int(
              (support[1]-ball[0])*orientation>.25 and pair_dist<=8))
            out["n_defenders"].append(len(defenders))
            used+=1
    finally:
        resp_h.close();resp_a.close()
    return {
      "match":game,"frames_scanned":frames,"seconds_with_both_teams":valid,"usable_possession_proxy_seconds":used,
      "closest_defender_to_ball_m":stats(out["pressure_m"]),
      "second_defender_to_ball_m":stats(out["second_nearest_m"]),
      "distance_first_second_m":stats(out["two_defenders_distance_m"]),
      "second_nearest_goalside_fraction":round(statistics.fmean(out["second_nearest_goalside"]),4) if used else None,
      "second_goalside_and_within_8m_fraction":round(statistics.fmean(out["second_nearest_goalside_and_close"]),4) if used else None
    }

def main():
    games=[match(1),match(2)]
    results={"source":"https://github.com/metrica-sports/sample-data",
      "matches":games,
      "method":"All-player ball tracking, one frame per second, ownership proxy distance<2.5m and 0.75m margin; defending goal orientation estimated from team centroids with >=4m separation; closest and second-closest defenders to ball",
      "limits":[
        "Closest and second closest defender are NOT ground-truth press and cover roles",
        "Team goal orientation estimated, not verified with pitch direction and lineup labels",
        "Only 2 adult 11v11 matches, includes goalkeepers and tracking occlusions",
        "One-second samples are correlated within matches, not independent possessions",
        "These are distribution checks, not a validated target for 3v2 or other sports"
      ]}
    print("METRICA_DEFENCE_REFERENCE_BEGIN")
    print(json.dumps(results,ensure_ascii=False,indent=2))
    print("METRICA_DEFENCE_REFERENCE_END")

if __name__=="__main__":main()
