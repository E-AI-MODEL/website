"""Browserproef voor verborgen LO-spelanalyse; vergelijkt ook de spelregels met main."""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"tools/lo-aanvalslab/index.html"
def assert_rules_unchanged(page,baseline):
    differences=[]
    for sport in range(4):
        for form in range(4):
            for scene in range(4):
                for seed in [1337,2730]:
                    values=[]
                    for browser_page in [baseline,page]:
                        browser_page.select_option("#sportSelect",str(sport))
                        browser_page.select_option("#formationSelect",str(form))
                        data=browser_page.evaluate("""({scene,seed})=>{
                          const lab=window.__loLabTest,ps=lab.scenario(scene),out=lab.run(ps,seed);
                          const fs=lab.getFrames();
                          return {result:out.result,duration:out.duration,passes:out.passes,
                            completed:out.completed,shots:out.shots,intercepts:out.intercepts,
                            trajectory:fs.map(f=>[f.time,
                             ...f.players.flatMap(p=>[p.x,p.y,p.vx,p.vy]),f.ball.x,f.ball.y])};
                        }""",{"scene":scene,"seed":seed})
                        values.append(data)
                    left,right=values
                    if {k:v for k,v in left.items() if k!="trajectory"}!={k:v for k,v in right.items() if k!="trajectory"}:
                        differences.append(f"Outcome mismatch {sport}/{form}/{scene}/{seed}: {left['result']} vs {right['result']}")
                    if len(left['trajectory'])!=len(right['trajectory']):
                        differences.append(f"Frames mismatch {sport}/{form}/{scene}/{seed}")
                    else:
                        for row_a,row_b in zip(left["trajectory"],right["trajectory"]):
                            if any(abs(a-b)>1e-7 for a,b in zip(row_a,row_b)):
                                differences.append(f"Player path mismatch {sport}/{form}/{scene}/{seed}")
                                break
                    if differences:break
                if differences:break
            if differences:break
        if differences:break
    assert not differences,differences
    return 4*4*4*2

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1366,"height":820},accept_downloads=True)
        baseline=browser.new_page(viewport={"width":1366,"height":820})
        failures=[]
        page.on("pageerror",lambda e:failures.append(str(e)))
        baseline.on("pageerror",lambda e:failures.append("baseline: "+str(e)))
        baseline_html=subprocess.run(
            ["git","show","origin/main:tools/lo-aanvalslab/index.html"],cwd=ROOT,
            check=True,text=True,capture_output=True).stdout
        baseline.set_content(baseline_html,wait_until="domcontentloaded")
        page.goto(HTML.as_uri(),wait_until="domcontentloaded")
        page.locator('[data-mode="free"]').click()
        baseline.locator('[data-mode="free"]').click()
        # Bedieningsdemo's zijn apart van de echte opstelling.
        original=page.evaluate("window.__loLabTest.getPlayers()")
        assert page.locator("#loHelp").is_hidden()
        page.locator("#loHelpOpen").click()
        assert page.locator("#loHelp").is_visible()
        help_state=page.evaluate("window.__loHelpTest.getState()")
        assert help_state["chapterCount"]==6 and help_state["stepCount"]==18,help_state
        assert page.locator("#loHelpTabs button").count()==6
        page.locator("#loHelpNext").click()
        assert page.locator("#loHelpStepTitle").inner_text()=="Verplaats een speler"
        page.locator("#loHelpTabs").get_by_role("button",name="Doelen en coach").click()
        assert page.locator("#loHelpStepTitle").inner_text()=="Kies een klein doel"
        page.locator("#loHelpReplay").click()
        page.keyboard.press("Escape")
        assert page.locator("#loHelp").is_hidden()
        assert page.evaluate("window.__loLabTest.getPlayers()")==original
        assert not page.locator("#loAnalysis").is_visible()
        page.locator("#loSecret").click()
        assert not page.locator("#loAnalysis").is_visible()
        page.locator("#loSecret").click()
        assert page.locator("#loAnalysis").is_visible()
        assert "nog geen aanval" in page.locator("#loAnalysisBody").inner_text()
        page.keyboard.press("Escape")
        assert not page.locator("#loAnalysis").is_visible()
        # Bedieningsmenu's moeten onafhankelijk, met één tik open en dicht gaan.
        assert page.locator("#prep").get_attribute("open") is not None
        page.locator("#prep > summary").click()
        assert page.locator("#prep").get_attribute("open") is None
        page.locator("#prep > summary").click()
        assert page.locator("#prep").get_attribute("open") is not None
        assert page.locator("#loCoachPanel").get_attribute("open") is None
        page.locator("#loCoachPanel > summary").click()
        assert page.locator("#loCoachPanel").get_attribute("open") is not None
        page.locator("#loCoachPanel > summary").click()
        assert page.locator("#loCoachPanel").get_attribute("open") is None
        # De doelen zijn optionele chips, met andere sporttaal voor elk spel.
        assert not page.locator("#loGoals").get_attribute("open")
        page.locator("#loGoals > summary").click()
        assert page.locator("#loGoalChips button").count()==8
        for sport,needle in ((0,"Aanspeellijn openen"),(1,"Aanspeelpunt maken"),
                             (2,"Op tijd instarten"),(3,"Passing lane openen")):
            page.select_option("#sportSelect",str(sport))
            assert page.locator("#loGoalChips").get_by_role("button",name=needle).count()==1,(sport,needle)
            assert page.locator("#loGoalCurrent").inner_text(),sport
        page.select_option("#sportSelect","0")
        page.locator("#loGoalRoles").get_by_role("button",name="Verdediging").click()
        assert page.locator("#loGoalChips").get_by_role("button",name="Rugdekking geven").count()==1
        assert page.evaluate("window.__loLabTest.getCoachState().role")=="d"
        page.locator("#loGoalRoles").get_by_role("button",name="Aanval").click()
        page.locator("#loGoalChips").get_by_role("button",name="Aanspeellijn openen").click()
        assert page.evaluate("window.__loLabTest.getCoachState().manual") is True
        assert page.locator("#tasktitle").inner_text()=="Aanspeellijn openen"
        page.locator("#loCoachAuto").click()
        assert page.evaluate("window.__loLabTest.getCoachState().manual") is False
        assert page.locator("#loCoachAuto").get_attribute("aria-pressed")=="true"
        count=assert_rules_unchanged(page,baseline)
        # De spelerpijlen komen uit echte 1,25 s-modeltrajecten, niet uit eigen doelen.
        for sport in range(4):
            page.select_option("#sportSelect",str(sport))
            page.select_option("#formationSelect","2")
            assert page.evaluate("window.__loLabTest.selectPreviewPlayer('a1')")
            page.wait_for_function("""()=>{
              const a=window.__loLabTest.getArrowPreview();
              return a.isCurrent && a.track.length>2
            }""",timeout=20000)
            preview=page.evaluate("""()=>{
              const lab=window.__loLabTest,p=lab.getArrowPreview(),ps=lab.getPlayers();
              const fs=lab.run(ps,1337+2*1609);const frames=lab.getFrames();
              return {preview:p,frames:frames.map(f=>({
                time:f.time,player:f.players.find(q=>q.id==='a1')
              }))};
            }""")
            assert page.locator("#traces [data-preview-arrow='a1']").count()==1,preview
            for sample in preview["preview"]["track"]:
                frame=min(preview["frames"],key=lambda q:abs(q["time"]-sample["t"]))
                assert abs(frame["time"]-sample["t"])<.001,(sport,sample,frame)
                assert abs(frame["player"]["x"]-sample["x"])<.0001,(sport,sample,frame)
                assert abs(frame["player"]["y"]-sample["y"])<.0001,(sport,sample,frame)
            ball=page.locator('[data-ball="true"]')
            assert ball.count()==1
            assert ball.get_attribute("data-ball-sport")==str(sport)
            detail_count=ball.locator("path,polygon,circle,ellipse").count()
            assert detail_count>=6,(sport,detail_count)
        # Dezelfde simulatie moet met volledige data klaar staan.
        page.select_option("#sportSelect","0")
        page.select_option("#formationSelect","2")
        page.evaluate("""()=>{
          const lab=window.__loLabTest;
          lab.run(lab.scenario(1),1337);
        }""")
        event_test=page.evaluate("""()=>{
          const es=window.__loLabTest.getEvents();
          const passes=es.filter(e=>e.kind==='pass'&&e.detail);
          return {count:es.length,passCount:passes.length,
           allScoresExact:passes.every(e=>
             Math.abs(Object.values(e.detail.scoreParts).reduce((a,b)=>a+b,0)-e.detail.score)<1e-7),
           allTimesExact:passes.every(e=>Math.abs(e.detail.distanceM/e.detail.durationS-e.detail.ballSpeedMps)<1e-8),
           allHaveAlternatives:passes.every(e=>e.detail.candidates&&e.detail.candidates.length)};
        }""")
        assert event_test["passCount"]>0,event_test
        assert event_test["allScoresExact"] and event_test["allTimesExact"] and event_test["allHaveAlternatives"],event_test
        # De coach verwijst naar werkelijke gebeurtenissen, zonder een overwinning te verzinnen.
        coach=page.evaluate("window.__loLabTest.coachPreview()")
        assert coach["observed"] and coach["challenge"],coach
        assert "model" in coach["observed"].lower() or "bereken" in coach["observed"].lower() or "pass" in coach["observed"].lower(),coach
        assert "Nieuwe uitdaging:" in coach["challenge"],coach
        prev=page.evaluate("window.__loLabTest.getCoachState().previous")
        again=page.evaluate("window.__loLabTest.coachPreview()")
        assert page.evaluate("window.__loLabTest.getCoachState().previous")==prev
        assert again["challenge"]==coach["challenge"]
        assert page.locator("#loCoachObserved").is_visible()
        if coach["moment"] is not None:
            assert page.locator("#loCoachMoment").is_visible()
        page.locator("#loSecret").click()
        page.locator("#loSecret").click()
        assert page.locator("#loAnalysis").is_visible()
        assert "Passes / aangenomen" in page.locator("#loAnalysisBody").inner_text()
        assert page.locator("#loMathScrub").is_visible()
        assert page.locator(".lo-math-event").count()==event_test["count"]
        page.locator("#loMathScrub").evaluate("""e=>{e.value=Math.round(e.max/2);e.dispatchEvent(new Event('input',{bubbles:true}))}""")
        assert "Dichtste verdediger" in page.locator("#loMathFrame").inner_text()
        first_pass=page.evaluate("""()=>window.__loLabTest.getEvents().findIndex(e=>e.kind==='pass')""")
        page.locator(f'.lo-math-event[data-event-index="{first_pass}"]').click()
        assert "Passscore" in page.locator("#loMathDecision").inner_text()
        assert "Waarom deze ontvanger?" in page.locator("#loMathDecision").inner_text()
        with page.expect_download() as download:
            page.locator("#loMathExport").click()
        dl=download.value
        assert dl.suggested_filename.endswith(".json"),dl.suggested_filename
        content=json.loads(Path(dl.path()).read_text())
        assert len(content["beelden"])>2
        assert content["uitkomst"]["passes"]>=1
        page.locator("#loAnalysisClose").click()
        assert not page.locator("#loAnalysis").is_visible()
        # Echte playback en pauze bij openen.
        page.locator('#primary').click()
        assert page.locator('#loAnalysis').is_hidden()
        page.locator('#loSecret').click()
        page.locator('#loSecret').click()
        assert page.locator('#loAnalysis').is_visible()
        held=page.evaluate('window.__loLabTest.getTime()')
        page.wait_for_timeout(190)
        still=page.evaluate('window.__loLabTest.getTime()')
        assert held==still,(held,still)
        page.locator('#loAnalysisClose').click()
        page.wait_for_timeout(180)
        resumed=page.evaluate('window.__loLabTest.getTime()')
        assert resumed>still,(held,still,resumed)
        # Hulp pauzeert een lokale aanval zonder de positie te wijzigen.
        page.locator("#loHelpOpen").click()
        assert page.evaluate("window.__loHelpTest.getState().wasPaused") is True
        paused=page.evaluate("window.__loLabTest.getTime()")
        page.wait_for_timeout(130)
        assert paused==page.evaluate("window.__loLabTest.getTime()")
        page.locator("#loHelpTry").click()
        assert page.locator("#loHelp").is_hidden()
        page.locator("#primary").click()
        # Compacte mobiele weergave, keyboardtoegang en twee tikken.
        for width,height in [(390,844),(320,690)]:
            page.set_viewport_size({"width":width,"height":height})
            page.locator("#loSecret").focus()
            page.keyboard.press("Enter");page.keyboard.press("Enter")
            assert page.locator("#loAnalysis").is_visible()
            dims=page.evaluate("""()=>({
              viewport:innerWidth,
              dialog:document.querySelector('.lo-analysis-sheet').getBoundingClientRect().width,
              body:document.getElementById('loAnalysisBody').scrollWidth,
              bodyClient:document.getElementById('loAnalysisBody').clientWidth
            })""")
            assert dims["dialog"]<=dims["viewport"]+1,dims
            assert dims["body"]<=dims["bodyClient"]+3,dims
            chips=page.evaluate("""()=>({
              viewport:innerWidth,
              goalWidth:document.querySelector('#loGoals').getBoundingClientRect().width,
              chipsScroll:document.querySelector('#loGoalChips').scrollWidth,
              chipsClient:document.querySelector('#loGoalChips').clientWidth
            })""")
            assert chips["goalWidth"]<=chips["viewport"]+1,chips
            assert chips["chipsScroll"]<=chips["chipsClient"]+2,chips
            page.keyboard.press("Escape")
            assert not page.locator("#loAnalysis").is_visible()
            page.locator("#loHelpOpen").click()
            mobile_help=page.evaluate("""()=>({
              viewport:innerWidth,
              sheet:document.querySelector('.lo-help-sheet').getBoundingClientRect().width,
              content:document.querySelector('.lo-help-content').clientWidth,
              scroll:document.querySelector('.lo-help-content').scrollWidth,
              demo:document.querySelector('#loHelpDemo').getBoundingClientRect().width
            })""")
            assert mobile_help["sheet"]<=mobile_help["viewport"]+1,mobile_help
            assert mobile_help["scroll"]<=mobile_help["content"]+2,mobile_help
            assert mobile_help["demo"]<=mobile_help["sheet"],mobile_help
            page.locator("#loHelpClose").click()
        assert not failures,failures
        print(json.dumps({"baseline_replays":count,"event_test":event_test,
                          "mobile_responsive":True,"modal_pause_resume":True,
                          "json_trace":True,"page_errors":failures},ensure_ascii=False))
        browser.close()
if __name__=="__main__":main()
