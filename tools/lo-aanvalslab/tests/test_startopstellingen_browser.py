"""Controleer of LO-startopstellingen tactische keuzes blijven vragen.

Run: python tools/lo-aanvalslab/tests/test_startopstellingen_browser.py
Vereist: Playwright + Chromium. Test de echte HTML-engine; geen wedstrijdvalidatie.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = ROOT / "tools" / "lo-aanvalslab" / "index.html"

def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(HTML.as_uri(), wait_until="domcontentloaded")
        result = page.evaluate("""() => {
          const lab=window.__loLabTest;
          const out={runs:0,failures:[],bySport:{},byFormation:{},outcomes:{},changedByChoice:0,tacticallyChanged:0,bySportChoice:{}};
          const names=['Voetbal','Hockey','Handbal','Basketbal'];
          const counts=[[4,4],[2,1],[3,2],[4,3]];
          for(let sport=0;sport<4;sport++){
            const sel=document.getElementById('sportSelect');
            sel.value=String(sport);sel.dispatchEvent(new Event('change'));
            const config=lab.getConfig();
            for(let form=0;form<4;form++){
              lab.setFormation(form);
              for(let scene=0;scene<4;scene++){
                const players=lab.scenario(scene);
                const attackers=players.filter(p=>p.team==='a');
                const defenders=players.filter(p=>p.team==='d');
                const key=names[sport]+' / '+counts[form].join(' tegen ');
                if(attackers.length!==counts[form][0]||defenders.length!==counts[form][1])
                  out.failures.push(key+' '+scene+': fout aantal spelers');
                // Een start die direct in de schotzone ligt vraagt geen aanval.
                if(attackers.some(p=>p.x>=config.shotX))
                  out.failures.push(key+' '+scene+': aanvaller direct in schotzone');
                // De vrije aanvaller in overtal mag niet zonder tegenspeler
                // ver voor de overige spelers vlak bij het doel beginnen.
                if(form===3){
                  const last=attackers.find(p=>p.id==='a3');
                  const near=Math.min(...defenders.map(p=>Math.hypot(p.x-last.x,p.y-last.y)));
                  if(near>160)out.failures.push(key+' '+scene+': vierde aanvaller ongedekt bij aftrap ('+Math.round(near)+')');
                  if(last.x>config.shotX-3*config.px)
                    out.failures.push(key+' '+scene+': vierde aanvaller te dicht bij doel');
                }
                const a=lab.run(players,1337+scene);
                const frames=lab.getFrames(), firstEvents=lab.getEvents();
                const changed=structuredClone(players);
                changed.find(p=>p.id==='a1').y=Math.max(95,Math.min(555,changed.find(p=>p.id==='a1').y+85));
                const b=lab.run(changed,1337+scene);
                const changedFrames=lab.getFrames(), changedEvents=lab.getEvents();
                const morePressure=structuredClone(players);
                morePressure.find(p=>p.id==='d0').intent='druk';
                const defended=lab.run(morePressure,1337+scene);
                const defendedEvents=lab.getEvents();
                const firstPass=(items)=>items.find(e=>e.kind==='pass');
                const firstRisk=(items)=>firstPass(items)?.detail?.minArrivalMarginS;
                const changeInRisk=(a,b)=>Number.isFinite(firstRisk(a))&&Number.isFinite(firstRisk(b))&&Math.abs(firstRisk(a)-firstRisk(b))>.04;
                const differentOutcome=a.result!==b.result||a.result!==defended.result;
                const differentPass=a.passes!==b.passes||a.passes!==defended.passes;
                if(differentOutcome||differentPass||changeInRisk(firstEvents,changedEvents)||changeInRisk(firstEvents,defendedEvents)){
                  out.tacticallyChanged++;
                  out.bySportChoice[names[sport]]=(out.bySportChoice[names[sport]]||0)+1;
                }
                if(!frames.length||!changedFrames.length)out.failures.push(key+' '+scene+': geen spelbeelden');
                else if(frames[0].players.find(p=>p.id==='a1').y!==changedFrames[0].players.find(p=>p.id==='a1').y)
                  out.changedByChoice++;
                if(a.shots>0&&a.duration<1.5)
                  out.failures.push(key+' '+scene+': schot zonder opbouw binnen 1,5s');
                out.outcomes[a.result]=(out.outcomes[a.result]||0)+1;
                out.bySport[names[sport]]??={runs:0,shot:0,intercept:0,other:0,shotBlocked:0};
                out.byFormation[key]??={runs:0,shot:0,intercept:0,other:0,shotBlocked:0};
                out.bySport[names[sport]].runs++;
                out.byFormation[key].runs++;
                out.bySport[names[sport]][a.result]++;
                out.byFormation[key][a.result]++;
                out.runs++;
              }
            }
          }
          return out;
        }""")
        print("STARTOPSTELLINGEN", json.dumps(result, ensure_ascii=False, indent=2))
        assert not errors, errors
        assert result["runs"] == 64, result
        assert result["changedByChoice"] == 64, result
        assert result["tacticallyChanged"] > 0, result
        assert not result["failures"], result["failures"]
        browser.close()

if __name__ == "__main__":
    run()
