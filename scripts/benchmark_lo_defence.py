"""Meet verdedigingsgedrag van kandidaat en productie bij identieke scenarios.

Dit script levert simulatie-diagnostiek, GEEN empirische validatie.
Alle 128 combinaties blijven apart voor vergelijkbaarheid; gemiddelden worden
alleen over unieke spelsimulaties genomen, niet per frame als onafhankelijk geval.
"""
from __future__ import annotations
import json, math, statistics, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"tools/lo-aanvalslab/index.html"

JS = r"""({scene,seed})=>{
  const lab=window.__loLabTest,config=lab.getConfig();
  const initial=lab.scenario(scene),out=lab.run(initial,seed),fs=lab.getFrames();
  const e=lab.getEvents(),px=config.px;
  let roleChanges=0,earlyRoleChanges=0,reverseTurns=0,
      pressFrames=0,coverFrames=0,goalSideCover=0,simFrames=0,validFrames=0,
      totalActive=0,modelTurnChecks=0,unmarked=0,markCount=0,
      highPursuit=0,uniqueMarkErrors=0,pressureTime=0,goalSide=0;
  let previousLead='',previousChange=-9,previous=new Map(),markUps=0;
  const nearest=[],pressDistances=[],coverDistances=[],pressSwitchTimes=[];
  const sample=(v,p)=>{const a=v.slice().sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor(p*(a.length-1)))]:null;};
  for(let i=1;i<fs.length;i++){
    const f=fs[i],prev=fs[i-1],ds=f.players.filter(p=>p.team==='d'),
          owner=f.players.find(p=>p.id===f.holder);
    if(!ds.length)continue;
    const pressure=ds.filter(p=>p._defenceRole==='press');
    const covers=ds.filter(p=>p._defenceRole==='cover');
    const rolePresent=ds.some(p=>p._defenceRole);
    const cx=ds.reduce((n,p)=>n+p.x,0)/ds.length,cy=ds.reduce((n,p)=>n+p.y,0)/ds.length;
    validFrames++;
    if(owner){
      nearest.push(Math.min(...ds.map(p=>Math.hypot(p.x-f.ball.x,p.y-f.ball.y)/px)));
      highPursuit+=Number(ds.filter(p=>Math.hypot(p.x-f.ball.x,p.y-f.ball.y)<px*2.5).length>=3);
    }
    if(rolePresent&&ds.length>1&&owner&&f.time>.9){
      simFrames++;
      pressFrames+=pressure.length===1?1:0;
      coverFrames+=covers.length===1?1:0;
      if(covers.length===1){
        goalSideCover+=Number(covers[0].x>=f.ball.x-px*.25);
        coverDistances.push(Math.hypot(covers[0].x-f.ball.x,covers[0].y-f.ball.y)/px);
      }
      if(pressure.length===1){
        pressDistances.push(Math.hypot(pressure[0].x-f.ball.x,pressure[0].y-f.ball.y)/px);
        if(previousLead&&previousLead!==pressure[0].id){
          roleChanges++;
          pressSwitchTimes.push(f.time);
          if(f.time-previousChange<.6)earlyRoleChanges++;
          previousChange=f.time;
        }
        previousLead=pressure[0].id;
      }
      const marks=Object.values(f.runtime?.markMemory||{});
      uniqueMarkErrors+=marks.length-new Set(marks).size;
      markCount+=marks.length;
    }
    for(const p of ds){
      const old=prev.players.find(q=>q.id===p.id);
      if(!old)continue;
      const velocity=Math.hypot(p.vx,p.vy)/px,prior=Math.hypot(old.vx,old.vy)/px;
      if(velocity>.9&&prior>.9){
        modelTurnChecks++;
        const cos=(p.vx*old.vx+p.vy*old.vy)/(px*px*velocity*prior);
        if(cos<-.35)reverseTurns++;
      }
      totalActive+=.05;
    }
  }
  return {sport:config.name,scene,seed,summary:{result:out.result,passes:out.passes,
   attempts:out.shots,intercepts:out.intercepts,duration:out.duration},
   frames:fs.length,defenders:initial.filter(p=>p.team==='d').length,
   roleChanges,earlyRoleChanges,reverseTurns,modelTurnChecks,
   pressCoverage:simFrames?pressFrames/simFrames:null,
   coverCoverage:simFrames?coverFrames/simFrames:null,
   coverGoalSide:coverFrames?goalSideCover/coverFrames:null,
   closePileups:nearest.length?highPursuit/nearest.length:null,
   uniqueMarkErrors,
   pressureNearestP50:sample(nearest,.5),
   pressDistanceP50:sample(pressDistances,.5),
   coverDistanceP50:sample(coverDistances,.5),
   duration:out.duration,
   totalActive,
   trajectoryFingerprint:JSON.stringify(fs.filter((_,i)=>i%12===0).map(f=>[
     f.time,...f.players.filter(p=>p.team==='d').flatMap(p=>[+p.x.toFixed(2),+p.y.toFixed(2)])
   ]))}
};}"""

def summarize(rows):
    result={}
    for sport in ("Voetbal","Hockey","Handbal","Basketbal"):
        subset=[r for r in rows if r["sport"]==sport]
        def quant(key):
            vals=[r[key] for r in subset if r.get(key) is not None]
            return round(statistics.mean(vals),4) if vals else None
        result[sport]={
            "scenarios":len(subset),
            "press_coverage":quant("pressCoverage"),
            "cover_coverage":quant("coverCoverage"),
            "cover_goal_side":quant("coverGoalSide"),
            "pileup_frequency":quant("closePileups"),
            "early_press_switches":sum(r["earlyRoleChanges"] for r in subset),
            "total_press_switches":sum(r["roleChanges"] for r in subset),
            "reverse_turns":sum(r["reverseTurns"] for r in subset),
            "turn_checks":sum(r["modelTurnChecks"] for r in subset),
            "median_nearest_ball_m":quant("pressureNearestP50"),
            "median_press_ball_m":quant("pressDistanceP50"),
            "median_cover_ball_m":quant("coverDistanceP50"),
            "unique_mark_errors":sum(r["uniqueMarkErrors"] for r in subset),
            "shot_outcomes":sum(r["summary"]["attempts"] for r in subset),
            "intercepts":sum(r["summary"]["intercepts"] for r in subset)
        }
        result[sport]["turns_per_1000_checks"]=round(
            1000*result[sport]["reverse_turns"]/max(1,result[sport]["turn_checks"]),3)
    return result

def main():
    main_html=subprocess.run(
        ["git","show","origin/main:tools/lo-aanvalslab/index.html"],
        check=True, cwd=ROOT,capture_output=True,text=True).stdout
    failures=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        baseline=browser.new_page(viewport={"width":1280,"height":830})
        candidate=browser.new_page(viewport={"width":1280,"height":830})
        baseline.on("pageerror",lambda e:failures.append("prod:"+str(e)))
        candidate.on("pageerror",lambda e:failures.append("candidate:"+str(e)))
        baseline.set_content(main_html,wait_until="domcontentloaded")
        candidate.goto(HTML.as_uri(),wait_until="domcontentloaded")
        baseline.locator('[data-mode="free"]').click()
        candidate.locator('[data-mode="free"]').click()
        old,new=[],[]
        for sport in range(4):
            for form in range(4):
                for page in (baseline,candidate):
                    page.select_option("#sportSelect",str(sport))
                    page.select_option("#formationSelect",str(form))
                for scene in range(4):
                    for seed in (1337,2730):
                        old.append(baseline.evaluate(JS,{"scene":scene,"seed":seed}))
                        new.append(candidate.evaluate(JS,{"scene":scene,"seed":seed}))
        browser.close()
    assert not failures,failures
    assert len(old)==len(new)==128
    results={"source":"GitHub Actions replay; candidates are deterministic models, not independently observed matches",
             "n":128,
             "baseline":summarize(old),
             "candidate":summarize(new),
             "changed":sum(a["trajectoryFingerprint"]!=b["trajectoryFingerprint"] for a,b in zip(old,new))}
    print("DEFENCE_BENCHMARK_JSON_BEGIN")
    print(json.dumps(results,ensure_ascii=False,sort_keys=True,indent=2))
    print("DEFENCE_BENCHMARK_JSON_END")
    artifact=ROOT/"defence_benchmark_results.json"
    artifact.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    assert all(r["unique_mark_errors"]==0 for r in results["candidate"].values())
    assert results["changed"]>60

if __name__=="__main__":main()
