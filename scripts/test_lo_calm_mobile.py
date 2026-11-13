"""Controleer de nieuwe rustige LO-bediening in echte Chromium-vensters."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/"tools/lo-aanvalslab/index.html"
SHOTS=ROOT/"artifacts/lo-calm-mobile"
SHOTS.mkdir(parents=True,exist_ok=True)

def phone(browser,width,height):
    page=browser.new_page(viewport={"width":width,"height":height},device_scale_factor=1,is_mobile=True,has_touch=True)
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.goto(PAGE.as_uri(),wait_until="domcontentloaded")
    page.locator('#welcome [data-mode="attack"]').click()
    page.wait_for_function("window.__loCalmUI?.getState().active===true")
    assert page.locator("#pitch").is_visible()
    assert page.locator("#loCalmSettings").is_visible()
    assert page.locator("#loCalmQuick").is_visible()
    assert not page.locator("#loMobileControls").is_visible()
    assert not page.locator(".shell>.side").is_visible()
    assert page.locator("#loCalmTask").is_visible()
    assert page.locator("#loCalmAnalysis").is_visible()
    assert page.locator("#loCalmSources").is_visible()
    assert not page.locator("#sportSelect").is_visible()

    geometry=page.evaluate("""() => {
      const box=s=>document.querySelector(s).getBoundingClientRect();
      const pitch=box('#pitch'),play=box('#primary'),settings=box('#loCalmSettings>summary');
      const accordions=[...document.querySelectorAll('#loCalmPanels>.lo-calm-details>summary')].map(e=>e.getBoundingClientRect().height);
      return {horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
              pitchWidth:pitch.width,pitchHeight:pitch.height,playHeight:play.height,
              settingsHeight:settings.height,accordionHeights:accordions};
    }""")
    assert geometry["horizontalOverflow"]<=2,geometry
    assert geometry["pitchHeight"]>=180 or height<620,geometry
    assert geometry["playHeight"]>=44,geometry
    assert geometry["settingsHeight"]>=44,geometry
    assert all(h>=44 for h in geometry["accordionHeights"]),geometry
    page.screenshot(path=str(SHOTS/f"{width}x{height}-rust.png"),full_page=True)

    page.locator("#loCalmSettings>summary").click()
    assert page.locator("#sportSelect").is_visible()
    assert page.locator("#formationSelect").is_visible()
    assert page.locator("#new").is_visible()
    page.locator("#loCalmSettings>summary").click()
    assert not page.locator("#sportSelect").is_visible()

    assert page.locator("#loCalmQuickButtons button").count()==3
    page.locator("#loCalmQuickButtons button").first.click()
    assert page.locator("#loCalmQuickButtons button.active").count()==1
    page.locator("#loCalmQuickButtons button").last.click()
    assert page.locator("#loCalmTask").get_attribute("open") is not None
    assert page.locator("#intents .intent").count()>=3
    assert page.locator("#loMobileGoalSelect").is_visible()
    page.screenshot(path=str(SHOTS/f"{width}x{height}-opdracht.png"),full_page=True)

    page.locator("#loCalmTask>summary").click()
    page.locator("#loCalmSources>summary").click()
    assert page.locator('.lo-calm-body .lo-evidence-link').is_visible()
    page.locator("#loCalmSources>summary").click()

    if width==390:
        page.locator("#playbackSpeed").select_option("2")
        page.locator("#primary").click()
        page.wait_for_function("!document.querySelector('#after').classList.contains('hide')",timeout=27000)
        assert not page.locator("#loCalmQuick").is_visible()
        assert "Bekijk" in page.locator("#loCalmAnalysisLabel").inner_text()
        page.locator("#loCalmAnalysis>summary").click()
        assert page.locator("#loCoachPanel").is_visible()
        assert page.locator("#after").is_visible()
        page.screenshot(path=str(SHOTS/"390x844-analyse.png"),full_page=True)
    assert not errors,errors
    page.close()

def desktop(browser):
    page=browser.new_page(viewport={"width":1366,"height":820})
    page.goto(PAGE.as_uri(),wait_until="domcontentloaded")
    page.locator('#welcome [data-mode="attack"]').click()
    assert not page.locator("#loCalmSettings").is_visible()
    assert page.locator("#sportSelect").is_visible()
    assert page.locator(".shell>.side").is_visible()
    assert page.locator("#prep").is_visible()
    page.close()

def mode_switch(browser):
    page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    page.goto(PAGE.as_uri(),wait_until="domcontentloaded")
    page.locator('#welcome [data-mode="defend"]').click()
    page.locator("#loCalmTask>summary").click()
    assert page.locator("#zonePlans").is_visible()
    page.locator("#loCalmSettings>summary").click()
    page.locator("#sportSelect").select_option("1")
    assert "Hockey" in page.locator("#loCalmSettingsLabel").inner_text()
    assert "Hockey" in page.locator("#loCalmSportTitle").inner_text()
    page.close()

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        try:
            for dims in [(320,568),(375,667),(390,844),(430,932)]:
                phone(browser,*dims)
            mode_switch(browser)
            desktop(browser)
        finally:
            browser.close()
    print("Rustige mobiele LO-bediening: vier telefoonformaten, verdediging en desktop gecontroleerd")

if __name__=="__main__":
    main()
