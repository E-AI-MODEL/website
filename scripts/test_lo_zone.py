"""Controleer drie zonevormen tegen de echte LO-browsercode.

Run: python tools/lo-aanvalslab/tests/zone_movement_browser.py
Vereist: pip install playwright; playwright install chromium
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"tools/lo-aanvalslab/index.html"
def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1366,"height":768})
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(HTML.as_uri(),wait_until="domcontentloaded")
        page.locator('[data-mode="defend"]').click()
        assert page.locator("#zonePlans").is_visible()
        all_values=["zonecompact","zoneschuif","zonelijn"]
        for key in all_values:
            page.locator(f'[data-zone-plan="{key}"]').click()
            state=page.evaluate("""() => ({
                intents:window.__loLabTest.getPlayers().filter(p=>p.team==='d').map(p=>p.intent),
                active:[...document.querySelectorAll('[data-zone-plan].active')].map(e=>e.dataset.zonePlan)
            })""")
            assert set(state["intents"])=={key},state
            assert state["active"]==[key],state
        page.locator("#intents .intent").filter(has_text="Druk op bal").click()
        assert page.locator('[data-zone-plan].active').count()==0
        observed=page.evaluate("""() => {
            const lab=window.__loLabTest;
            const variants=['zonecompact','zoneschuif','zonelijn'];
            let runs=0,invalid=0,different=0,unresponsive=0,maxStep=0,maxPlayer=0;
            let results={},byZone={},byFormation={};
            for(let sport=0;sport<4;sport++){
              document.getElementById('sportSelect').value=String(sport);
              document.getElementById('sportSelect').dispatchEvent(new Event('change'));
              for(let form=0;form<4;form++){
                lab.setFormation(form);
                for(let scenario=0;scenario<4;scenario++){
                  const base=lab.scenario(scenario);
                  const trajectories=[];
                  for(const variant of variants){
                   for(const seed of [1337,7890]){
                    const ps=structuredClone(base);
                    ps.filter(p=>p.team==='d').forEach(p=>p.intent=variant);
                    const out=lab.run(ps,seed),frames=lab.getFrames();
                    runs++;
                    results[out.result]=(results[out.result]||0)+1;
                    const z=byZone[variant]||{shot:0,intercept:0,other:0,shotBlocked:0}; z[out.result]=(z[out.result]||0)+1;byZone[variant]=z;
                    const fm=form+' / '+variant;const ct=byFormation[fm]||{shot:0,intercept:0,other:0,shotBlocked:0};ct[out.result]=(ct[out.result]||0)+1;byFormation[fm]=ct;
                    if(!frames.length||frames.some(f=>!f.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))invalid++;
                    for(let i=1;i<frames.length;i++){
                     const a=frames[i-1],b=frames[i],px=[20,21,22,31][sport];
                     const step=Math.hypot(b.ball.x-a.ball.x,b.ball.y-a.ball.y)/px;
                     maxStep=Math.max(maxStep,step);
                     if(step>1.08)invalid++;
                     for(const player of b.players){
                      const speed=Math.hypot(player.vx,player.vy)/(px*Math.max(.05,player.speed));
                      maxPlayer=Math.max(maxPlayer,speed);
                      if(speed>1.03)invalid++;
                     }
                    }
                    if(seed===1337){
                     const moment=frames[Math.min(23,frames.length-1)];
                     trajectories.push(moment.players.filter(p=>p.team==='d').map(p=>[Math.round(p.x),Math.round(p.y)]).flat().join(','));
                    }
                   }
                  }
                  if(new Set(trajectories).size>1)different++;else unresponsive++;
                }
              }
            }
            return {runs,invalid,different,unresponsive,maxStep,maxPlayer,results,byZone,byFormation};
        }""")
        print("SIMULATIE",json.dumps(observed,ensure_ascii=False,indent=2))
        assert observed["runs"]==384,observed
        assert observed["invalid"]==0,observed
        assert observed["different"]>=48,observed
        # Oude online plans blijven geldig; nieuwe vormen blijven behouden.
        state=page.evaluate("""() => {
          window.__loOnline.open('d',2);
          window.__loLabTest.setZonePlan('zoneschuif');
          return window.__loOnline.getPlan().map(p=>p.intent);
        }""")
        assert state==["zoneschuif"]*4,state
        page.set_viewport_size({"width":390,"height":844})
        page.reload()
        page.locator('[data-mode="defend"]').click()
        # De bediening opent pas op aanvraag, als een klein paneel boven de actiebalk.
        assert not page.locator(".side").is_visible()
        # In het portretontwerp zijn de extra speleropties bereikbaar via Meer.
        page.locator(".lo-quick-more").click()
        assert page.locator("#prep").get_attribute("open") is not None
        assert not page.locator(".mobile-scrim").is_visible()
        assert page.locator(".side").is_visible()
        panel=page.locator(".side").bounding_box()
        assert not page.locator(".mobile-controls").is_visible()
        assert panel["height"] <= 0.48 * 844 + 3,panel
        assert panel["y"] + panel["height"] <= 844 + 1,panel
        assert page.locator("#zonePlans").is_visible()
        assert page.locator("#pitch").is_visible()
        assert page.locator("#zonePlans").evaluate("(e) => e.getBoundingClientRect().width > 180")
        assert not errors,errors
        browser.close()
if __name__=="__main__":
    run()
