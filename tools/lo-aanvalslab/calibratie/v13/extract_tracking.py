#!/usr/bin/env python3
"""Reproduceerbare metingen van openbare trackingdata, alleen samenvattingen bewaren.

NIET: fit op leerlinggedrag, voorspellende validatie of rechten op ruwe data.
De bronbestanden blijven buiten de repository.
"""
import csv, io, json, math, os, re, statistics, time, urllib.request, zipfile
from collections import defaultdict, deque
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'tracking_metrics.json'
USER_AGENT='LO-Aanvalslab-calibration/13 (educational aggregate research)'

def fetch(url, timeout=100):
    error=None
    for i in range(2):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':USER_AGENT})
            with urllib.request.urlopen(req,timeout=timeout) as res:
                return res.read()
        except Exception as e:
            error=e
            time.sleep(2)
    raise RuntimeError(f'{url}: {error}')

def stat(v):
    v=sorted(x for x in v if math.isfinite(x))
    if not v:return {'n':0}
    def pct(q):
        k=q*(len(v)-1); i=int(k);a=k-i
        return round(v[i]*(1-a)+v[min(i+1,len(v)-1)]*a,3)
    return {'n':len(v),'p10':pct(.1),'p50':pct(.5),'p75':pct(.75),'p90':pct(.9),'mean':round(statistics.fmean(v),3)}

def soccer():
    # Anonieme x/y per frame, per team. Originele veldmaat 105 x 68 m, 25 Hz.
    urlbase='https://raw.githubusercontent.com/metrica-sports/sample-data/master/data'
    summary=[]; speeds=[]; pressing=[]; ball_owner=[]
    for game in (1,2):
        tracks={}
        for team in ('Home','Away'):
            url=f'{urlbase}/Sample_Game_{game}/Sample_Game_{game}_RawTrackingData_{team}_Team.csv'
            txt=fetch(url).decode('utf-8-sig','replace')
            rows=csv.reader(io.StringIO(txt));next(rows);next(rows);head=next(rows)
            pairs=[(i,head[i]) for i in range(3,len(head)-1,2) if head[i] and head[i].startswith('Player')]
            ballcol=next((i for i,v in enumerate(head) if v=='Ball'),None)
            entries=[];prev={};count=0
            for row in rows:
                if len(row)<max(4,ballcol or 0)+2:continue
                try: period=int(row[0]);frame=int(row[1]);t=float(row[2]);
                except:continue
                objs={}
                for i,p in pairs:
                    try:
                        x=float(row[i]);y=float(row[i+1])
                        if -.025<=x<=1.025 and -.025<=y<=1.025:objs[p]=(x*105,y*68)
                    except:pass
                b=None
                if ballcol is not None:
                    try:b=(float(row[ballcol])*105,float(row[ballcol+1])*68)
                    except:pass
                entries.append((period,frame,t,objs,b));count+=1
                # 0.4-0.6 second displacements suppress short term tracking noise.
                if len(entries)>15:
                    po,pf,pt,pobj,_=entries[-16]
                    dt=t-pt
                    if po==period and .40<dt<.7:
                        for p,xy in objs.items():
                            if p in pobj:
                                v=math.dist(xy,pobj[p])/dt
                                if .08<=v<10:speeds.append(v)
            tracks[team]=entries
            summary.append({'game':game,'team':team,'frames':count,'players':len(pairs),'ball_column':ballcol is not None,'sampled_seconds':round(entries[-1][2]-entries[0][2],1) if entries else 0})
        # Compare aligned ball coordinates with nearest opposition for defensive proximity
        home,away=tracks['Home'],tracks['Away']; n=min(len(home),len(away))
        for k in range(0,n,10):
            hp,hf,ht,hs,hb=home[k]; ap,af,at,aa,ab=away[k]
            if hp!=ap or hf!=af:continue
            ball=hb or ab
            if not ball or not all(math.isfinite(z) for z in ball):continue
            near_home=min((math.dist(ball,z) for z in hs.values()),default=1e9)
            near_away=min((math.dist(ball,z) for z in aa.values()),default=1e9)
            closest=min(near_home,near_away)
            if closest<=2.5:
                other=near_away if near_home<near_away else near_home
                if other<40:pressing.append(other)
                ball_owner.append(closest)
    return {'source':'https://github.com/metrica-sports/sample-data','sampling_hz':25,
            'files':summary,'outfield_speed_0_6s_mps':stat(speeds),
            'nearest_opponent_to_ball_m_if_possession_proxy':stat(pressing),
            'ball_nearest_player_m':stat(ball_owner),
            'limits':['Snelheden inclusief alle loopfases en keepers; geen maximale sprintsnelheden.',
                      'Bezit afgeleid van balafstand <2.5m, niet gevalideerd met events.',
                      'Volwassen volledig veld en 11 tegen 11: geen directe LO 3 tegen 2 schatting.']}

def handball():
    data=fetch('https://zenodo.org/records/12065335/files/HandballDataset.zip?download=1')
    zp=zipfile.ZipFile(io.BytesIO(data));names=zp.namelist()
    def readcsv(name):
        member=next(z for z in names if z.lower().endswith(name.lower()))
        dat=zp.read(member).decode('utf-8-sig','replace')
        return list(csv.DictReader(io.StringIO(dat)))
    pos=readcsv('positions.csv');poss=readcsv('possessions.csv')
    # Cache possession labels by (game,period), avoid player-ID switches on possession changes.
    phases=defaultdict(list)
    for p in poss:
        try:
            g=int(p['game']);period=int(p['period'])
            start=float(p['time_start']);end=float(p['time_end'])
            phase=p['game_phases'].strip().upper()
            if end>start:phases[(g,period)].append((start,end,phase))
        except (KeyError,ValueError):continue
    for v in phases.values():v.sort()
    coord=defaultdict(list)
    for p in pos:
        try:
            g=int(p['game']);period=int(p['period']);t=int(float(p['time']))
            coord[(g,period,t,p['player'])].append((float(p['x']),float(p['y'])))
        except (KeyError,ValueError):continue
    def findphase(g,period,t):
        for a,b,phase in phases[(g,period)]:
            if a<=t and t+1<=b:return phase,(a,b)
        return None,None
    perphase=defaultdict(list); examples=0
    for (g,period,t,player),item in coord.items():
        other=coord.get((g,period,t+1,player))
        if not other or len(item)!=1 or len(other)!=1:continue
        phase,interval=findphase(g,period,t)
        if phase not in ('DEF','AT'):continue
        v=math.dist(item[0],other[0])
        if .04<=v<=8:
            perphase[phase].append(v);examples+=1
    return {'source':'https://zenodo.org/records/12065335','rows':len(pos),'possessions':len(poss),
            'units':'m/s; 1-second displacement',
            'defence_mps':stat(perphase['DEF']),'attack_mps':stat(perphase['AT']),
            'limits':['Alleen één damesamateurteam; overige verdedigers niet gevolgd.',
                      'IDs wisselen per balbezit; alleen opeenvolgende metingen binnen één bezit meegenomen.',
                      '1 Hz onderschat pieksnelheid/versnelling; contact- en reactietijden NIET afleidbaar.']}

def basketball():
    # SportVU 2015/16: een gecomprimeerd volledig wedstrijdlog, 25 Hz.
    import py7zr
    url='https://raw.githubusercontent.com/sealneaward/nba-movement-data/master/data/01.01.2016.CHA.at.TOR.7z'
    archive=fetch(url)
    from tempfile import TemporaryDirectory
    rows=[];speeds=[];ballclose=[];files=[]
    with TemporaryDirectory() as tmp:
        inp=Path(tmp)/'sportvu.7z';inp.write_bytes(archive)
        with py7zr.SevenZipFile(inp,'r') as z:
            z.extractall(path=tmp)
        eventfiles=list(Path(tmp).rglob('*.json'));files=[x.name for x in eventfiles]
        prev={};cnt=0
        for file in eventfiles:
            try:obj=json.loads(file.read_text())
            except:continue
            eventblocks=obj.get('events',[]) if isinstance(obj,dict) else (obj if isinstance(obj,list) else [])
            for event in eventblocks:
                for m in event.get('moments',[]):
                    try:
                        quarter=int(m[0]);t=float(m[2]);obj=m[5];b=obj[0];participants=obj[1:]
                    except:continue
                    if not isinstance(participants,list):continue
                    cur={}
                    for p in participants:
                        try:cur[(quarter,int(p[0]),int(p[1]))]=(float(p[2])*.3048,float(p[3])*.3048)
                        except:pass
                    if len(cur)<7:continue
                    cnt+=1
                    for key,xy in cur.items():
                        history=prev.get(key)
                        if history:
                            pt,pq=history
                            dt=pt-t
                            if .35<dt<.65:
                                v=math.dist(xy,pq)/dt
                                if .05<=v<=10:speeds.append(v)
                        prev[key]=(t,xy)
                    try:
                        ballxy=(float(b[2])*.3048,float(b[3])*.3048)
                        ballclose.append(min(math.dist(z,ballxy) for z in cur.values()))
                    except:pass
    return {'source':'https://github.com/sealneaward/nba-movement-data','game':'2016-01-01 CHA@TOR',
            'event_files':len(files),'valid_frames':cnt,'sample_frame_speed_mps':stat(speeds),
            'ball_to_nearest_player_m':stat(ballclose),
            'limits':['Één professionele wedstrijd uit 2015/16; 5 tegen 5 geen 3 tegen 2.',
                      'Snelheid omvat aanval én verdediging (geen betrouwbare bezitclassificatie).',
                      'Dubbeltellingen rond moment-overlappen mogelijk; geen directe interceptiekans.']}

def hockey():
    # Hockey: veldzone-events, geen spelerdraadjes. Analyseer semantisch verantwoord.
    import openpyxl
    pre='https://raw.githubusercontent.com/felicitylord/Hockey-Analysis/main/Raw%20Data/'
    from urllib.parse import quote
    files=['W01 Argentina v Belgium.xlsx','W02 NZ v Netherlands.xlsx','W03 NZ v Belgium.xlsx']
    previews=[]
    for name in files:
        blob=fetch(pre+quote(name))
        book=openpyxl.load_workbook(io.BytesIO(blob),read_only=True,data_only=True)
        sheets=[]
        for sheet in book.worksheets:
            rows=list(sheet.iter_rows(min_row=1,max_row=9,values_only=True))
            sheets.append({'name':sheet.title,'rows':sheet.max_row,'columns':sheet.max_column,'head':[[str(c)[:50] if c is not None else '' for c in rr[:14]] for rr in rows[:6]]})
        previews.append({'file':name,'sheets':sheets});book.close()
    return {'source':'https://github.com/felicitylord/Hockey-Analysis',
            'sample_file_schema':previews,
            'limits':['Zone-events betreffen de bal en spelsituatie, geen ruwe 2D-trajecten van verdedigers.',
                      'Daarom geen afstelling van reactietijd of fysieke onderscheppingsafstand mogelijk.']}

def main():
    summary={'version':'13','method':'separate sport tracking and source limits','generated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sports':{}}
    for name,fn in [('soccer',soccer),('handball',handball),('basketball',basketball),('hockey',hockey)]:
        try:
            x=fn();summary['sports'][name]={'status':'measured',**x}
            print(name,'OK',json.dumps({k:v for k,v in x.items() if k!='sample_file_schema'},ensure_ascii=False)[:1200],flush=True)
        except Exception as e:
            summary['sports'][name]={'status':'unavailable','reason':str(e)}
            print(name,'FAILED',repr(e),flush=True)
        OUT.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    return not any(x.get('status')=='measured' for x in summary['sports'].values())

if __name__=='__main__':raise SystemExit(main())