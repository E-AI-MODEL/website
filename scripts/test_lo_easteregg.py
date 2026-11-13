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
        # Vanaf het beginscherm naar uitleg of docentweergave.
        assert page.locator("#loWelcomeHelp").is_visible()
        assert page.locator("#loWelcomeTeacher").is_visible()
        page.locator("#loWelcomeHelp").click()
        assert page.locator("#loHelp").is_visible()
        assert page.locator("#loHelpStepTitle").inner_text()=="Kies een speler"
        page.locator("#loHelpClose").click()
        assert page.locator("#welcome").is_visible()
        page.locator("#loWelcomeTeacher").click()
        assert page.locator("#loTeacher").is_visible()
        state=page.evaluate("window.__loTeacherTest.getState()")
        assert state=={"open":True,"enabled":False,"formation":2,"practice":False},state
        assert "Waarnemen" in page.locator("#loTeacher").inner_text()
        assert "Kiezen" in page.locator("#loTeacher").inner_text()
        assert "zelf proberen" in page.locator("#loTeacher").inner_text().lower()
        assert "rugdekking" in page.locator("#loTeacherFocusTitle").inner_text().lower()
        page.locator('[data-lo-teacher-form="1"]').click()
        assert page.locator('[data-lo-teacher-form="1"]').get_attribute("aria-pressed")=="true"
        assert "aanspeellijn" in page.locator("#loTeacherFocusGoal").inner_text()
        page.locator('[data-lo-teacher-form="3"]').click()
        assert "ruimte" in page.locator("#loTeacherFocusGoal").inner_text()
        assert "onderlinge" in page.locator("#loTeacher").inner_text()
        page.locator('[data-lo-teacher-form="2"]').click()
        page.locator("#loTeacherTutorial").click()
        assert page.locator("#loTeacher").is_hidden()
        assert page.locator("#loHelp").is_visible()
        page.keyboard.press("Escape")
        page.locator("#loWelcomeTeacher").click()
        page.locator("#loTeacherStart").click()
        assert page.locator("#welcome").is_hidden()
        assert page.locator("#loTeacher").is_hidden()
        assert page.locator("#loTeacherBadge").is_visible()
        assert page.locator("#formationSelect").input_value()=="2"
        counts=page.evaluate("""()=>({
          a:window.__loLabTest.getPlayers().filter(p=>p.team==='a').length,
          d:window.__loLabTest.getPlayers().filter(p=>p.team==='d').length
        })""")
        assert counts=={"a":3,"d":2},counts
        page.locator("#loTeacherBadge").click()
        assert page.locator("#loTeacher").is_visible()
        page.locator("#loTeacherExit").click()
        assert page.locator("#loTeacherBadge").is_hidden()
        assert page.evaluate("window.__loTeacherTest.getState().enabled") is False
        # Een echte docentproef opent een bestaand spel met passend tactisch doel.
        page.reload(wait_until="domcontentloaded")
        page.locator("#loWelcomeTeacher").click()
        page.locator('[data-lo-teacher-form="2"]').click()
        page.locator("#loTeacherPractice").click()
        assert page.locator("#loTeacher").is_hidden()
        assert page.locator("#loTeacherPracticeTip").is_visible()
        assert page.evaluate("window.__loTeacherTest.getState().practice") is True
        assert page.evaluate("window.__loLabTest.getCoachState().goal")=="cover"
        assert page.evaluate("window.__loLabTest.getCoachState().role")=="d"
        assert page.locator("#formationSelect").input_value()=="2"
        assert page.evaluate("window.__loLabTest.getPlayers().length")==5
        page.locator("#primary").click()
        assert page.evaluate("window.__loLabTest.getFrames().length")>2
        page.reload(wait_until="domcontentloaded")
        page.locator("#loWelcomeHelp").click()
        page.locator("#loHelpTabs").get_by_role("button",name="Doelen en coach").click()
        assert "coach" in page.locator("#loHelpWhy").inner_text().lower()
        page.locator("#loHelpPractice").click()
        assert page.locator("#loHelp").is_hidden()
        assert page.locator("#welcome").is_hidden()
        assert page.locator("#loTeacherPracticeTip").is_visible()
        assert page.evaluate("window.__loTeacherTest.getState().practice") is True
        assert page.evaluate("window.__loLabTest.getCoachState().role")=="d"
        # De lesstart is alleen een weergavekeuze; andere speltests starten schoon.
        page.reload(wait_until="domcontentloaded")
        page.locator('[data-mode="free"]').click()
        baseline.locator('[data-mode="free"]').click()
        # Op smalle schermen blijven beide extra knoppen binnen het openingsvenster.
        for width,height in ((390,844),(320,690)):
            page.set_viewport_size({"width":width,"height":height})
            page.reload(wait_until="domcontentloaded")
            bounds=page.evaluate("""()=>({
              vw:innerWidth,vh:innerHeight,
              welcome:document.querySelector('.welcome').getBoundingClientRect().toJSON(),
              help:document.querySelector('#loWelcomeHelp').getBoundingClientRect().toJSON(),
              teacher:document.querySelector('#loWelcomeTeacher').getBoundingClientRect().toJSON()
            })""")
            assert bounds["welcome"]["width"]<=bounds["vw"]+2,bounds
            assert bounds["welcome"]["height"]<=bounds["vh"]+2,bounds
            assert bounds["help"]["right"]<=bounds["vw"]+2,bounds
            assert bounds["teacher"]["right"]<=bounds["vw"]+2,bounds
            page.locator("#loWelcomeTeacher").click()
            assert page.locator("#loTeacher").is_visible()
            modal=page.evaluate("""()=>({
              w:innerWidth,h:innerHeight,
              sheet:document.querySelector('.lo-teacher-sheet').getBoundingClientRect().toJSON()
            })""")
            assert modal["sheet"]["width"]<=modal["w"]+1,modal
            assert modal["sheet"]["height"]<=modal["h"]+1,modal
            page.locator('[data-lo-teacher-form="1"]').click()
            assert "aanspeellijn" in page.locator("#loTeacherFocusTitle").inner_text()
            page.keyboard.press("Escape")
            assert page.locator("#loTeacher").is_hidden()
        page.set_viewport_size({"width":1366,"height":820})
        page.reload(wait_until="domcontentloaded")
        page.locator('[data-mode="free"]').click()
        # Bedieningsdemo's zijn apart van de echte opstelling.
        original=page.evaluate("window.__loLabTest.getPlayers()")
        assert page.locator("#loHelp").is_hidden()
        page.locator("#loHelpOpen").click()
        assert page.locator("#loHelp").is_visible()
        help_state=page.evaluate("window.__loHelpTest.getState()")
        assert help_state["chapterCount"]==6 and help_state["stepCount"]==18,help_state
        assert page.locator("#loHelpTabs button").count()==6
        assert page.locator("#loHelpWhy").is_visible()
        assert page.locator("#loHelpPractice").is_visible()
        page.locator("#loHelpNext").click()
        assert page.locator("#loHelpStepTitle").inner_text()=="Verplaats een speler"
        page.locator("#loHelpTabs").get_by_role("button",name="Doelen en coach").click()
        assert page.locator("#loHelpStepTitle").inner_text()=="Kies een klein doel"
        page.locator("#loHelpReplay").click()
        page.keyboard.press("Escape")
        assert page.locator("#loHelp").is_hidden()
        assert page.evaluate("window.__loLabTest.getPlayers()")==original
        assert not page.locator("#loAnalysis").is_visible()
        # Pijltjestoetsen werken alleen wanneer het veld zelf focus heeft.
        before=page.evaluate("window.__loLabTest.getPlayers()")
        page.locator("#loHelpOpen").focus()
        page.keyboard.press("ArrowRight")
        assert page.evaluate("window.__loLabTest.getPlayers()")==before
        page.locator("#pitch").focus()
        page.keyboard.press("ArrowRight")
        moved=page.evaluate("window.__loLabTest.getPlayers()")
        assert moved[0]["x"]>before[0]["x"],(before[0],moved[0])
        page.locator("#reset").click()
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
        # Ook de drie verdedigende zonevormen gebruiken exact dezelfde berekende looplijn.
        page.select_option("#sportSelect","0")
        page.select_option("#formationSelect","2")
        for zone in ("zonecompact","zoneschuif","zonelijn"):
            assert page.evaluate("""(z)=>{
              const lab=window.__loLabTest;
              lab.setZonePlan(z);
              return lab.selectPreviewPlayer('d0');
            }""",zone)
            page.wait_for_function("""()=>{
              const a=window.__loLabTest.getArrowPreview();
              return a.isCurrent && a.player==='d0' && a.track.length>2;
            }""",timeout=20000)
            comparison=page.evaluate("""()=>{
              const lab=window.__loLabTest,p=lab.getArrowPreview();
              const ps=lab.getPlayers();
              lab.run(ps,1337+2*1609);
              const frames=lab.getFrames();
              return {track:p.track,frames:frames.map(f=>({
                time:f.time,player:f.players.find(q=>q.id==='d0')
              }))};
            }""")
            for sample in comparison["track"]:
                frame=min(comparison["frames"],key=lambda q:abs(q["time"]-sample["t"]))
                assert abs(frame["time"]-sample["t"])<.001,(zone,sample,frame)
                assert abs(frame["player"]["x"]-sample["x"])<.0001,(zone,sample,frame)
                assert abs(frame["player"]["y"]-sample["y"])<.0001,(zone,sample,frame)
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
        # De coachingreep verandert niet het verleden. Zonder nieuwe opdracht
        # moet het volledige model exact dezelfde speler- en balbanen behouden.
        coach_page=browser.new_page(viewport={"width":1200,"height":850})
        coach_page.on("pageerror",lambda e:failures.append("coach: "+str(e)))
        coach_page.goto(HTML.as_uri(),wait_until="domcontentloaded")
        coach_page.locator('[data-mode="free"]').click()
        coach_page.select_option("#formationSelect","2")
        coach_page.locator("#primary").click()
        coach_page.wait_for_timeout(250)
        coach_page.locator("#primary").click()
        assert coach_page.locator("#loCoachTransport").is_visible()
        baseline_frames=coach_page.evaluate("""()=>window.__loLabTest.getFrames().map(f=>[
          f.time,...f.players.flatMap(p=>[p.x,p.y,p.vx,p.vy]),f.ball.x,f.ball.y
        ])""")
        coach_page.locator("#loCoachEdit").click()
        assert coach_page.locator("#loMidCoach").is_visible()
        assert coach_page.locator("#loMidCoachSides button").count()==2
        coach_page.locator("#loMidApply").click()
        branch_frames=coach_page.evaluate("""()=>window.__loLabTest.getFrames().map(f=>[
          f.time,...f.players.flatMap(p=>[p.x,p.y,p.vx,p.vy]),f.ball.x,f.ball.y
        ])""")
        assert len(baseline_frames)==len(branch_frames),(len(baseline_frames),len(branch_frames))
        for before,after in zip(baseline_frames,branch_frames):
            assert len(before)==len(after)
            assert all(abs(a-b)<1e-7 for a,b in zip(before,after)),(before[0],before[:5],after[:5])
        coach_page.locator("#primary").click()
        assert coach_page.locator("#loCoachOriginal").is_visible()
        coach_page.locator("#loCoachOriginal").click()
        assert coach_page.locator("#loCoachVariant").is_visible()
        coach_page.locator("#loCoachVariant").click()
        coach_page.locator("#loCoachEdit").click()
        coach_page.locator("#loMidCoachSides").get_by_role("button",name="Verdedigers").click()
        assert coach_page.locator("#loMidCoachPlayers button").count()==2
        coach_page.locator("#loMidCoachPlayers").get_by_role("button",name="Verdediger 1").click()
        coach_page.locator("#loMidCoachActions button").last.click()
        assert coach_page.locator("#loMidCoachActions [aria-pressed=true]").count()==1
        coach_page.locator("#loMidApply").click()
        assert coach_page.evaluate("window.__loLabTest.getFrames().length")>2
        # Footers blijven binnen het document in plaats van over het veld.
        for width,height in ((1200,850),(390,844),(320,690)):
            coach_page.set_viewport_size({"width":width,"height":height})
            values=coach_page.evaluate("""()=>({
              vw:innerWidth,fh:document.querySelector('.lo-footer-links').getBoundingClientRect().toJSON(),
              field:document.querySelector('.fieldpane').getBoundingClientRect().toJSON(),
              below:document.querySelector('.lo-footer-links').compareDocumentPosition(document.querySelector('.fieldpane'))
            })""")
            assert values["fh"]["width"]<=values["vw"]+2,values
            assert values["fh"]["top"]>=values["field"]["bottom"]-2,values
        coach_page.close()
        assert not failures,failures
        print(json.dumps({"baseline_replays":count,"event_test":event_test,
                          "mobile_responsive":True,"modal_pause_resume":True,
                          "json_trace":True,"page_errors":failures},ensure_ascii=False))
        browser.close()
if __name__=="__main__":main()
