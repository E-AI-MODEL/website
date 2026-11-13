"""Controleer zonder screenshots te gokken de mobiele bediening en spelfuncties.

Chromium gebruikt echte viewportmeting. WebKit volgt in de aparte browsertest.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).resolve().parents[1] / "index.html"
OUT = Path(__file__).resolve().parents[3] / "artifacts" / "lo-mobile"


def position(page, selector):
    return page.locator(selector).evaluate("""e => {
      const b=e.getBoundingClientRect();return {
        x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,right:b.right,
        scroll:e.scrollHeight,client:e.clientHeight};
    }""")


def run_view(page, width, height, sport="defend"):
    page.set_viewport_size({"width": width, "height": height})
    page.goto(HTML.as_uri(), wait_until="domcontentloaded")
    page.locator(f'[data-mode="{sport}"]').click()
    page.wait_for_function("document.querySelector('.app').dataset.mobilePanel==='player'")
    view = page.evaluate("""()=>({
      w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight,
      width:document.documentElement.scrollWidth
    })""")
    assert view["scroll"] <= height + 2, view
    assert view["width"] <= width + 2, view
    assert page.locator(".side").is_visible()
    assert not page.locator(".mobile-scrim").is_visible()
    assert not page.locator(".mobile-sheet-head").is_visible()
    field = position(page, ".fieldpane")
    pitch = position(page, "#pitch")
    side = position(page, ".side")
    assert 0 < field["y"] < 125, (field, view)
    assert field["bottom"] <= side["y"], (field, side)
    assert side["bottom"] <= height + 3, (side, view)
    assert side["height"] < height * .55, (side, view)
    assert pitch["height"] > 80, (pitch, view)
    assert pitch["right"] <= width + 2, (pitch, view)
    assert page.locator(".mobile-controls").is_visible()
    assert page.locator("#intents .intent").count() > 0
    # De gekozen speler en zijn opdracht staan zonder extra modal in beeld.
    assert page.locator("#prep .lo-slim-content").is_visible()
    assert page.locator("#selected").is_visible()
    if height > 500:
        assert page.locator(".mobile-task-preview").is_visible()
        assert page.locator("#loMobileTaskTitle").inner_text().strip()
    # Vier hoofdkeuzes meteen, overige functies met één knop bereikbaar.
    more = page.locator("#loMobileMore")
    assert more.is_visible()
    assert page.locator("#intents .intent").nth(4).is_hidden()
    more.click()
    assert more.get_attribute("aria-expanded") == "true"
    assert page.locator("#intents .intent").nth(4).is_visible()
    more.click()
    assert more.get_attribute("aria-expanded") == "false"
    assert page.locator("#intents .intent").nth(4).is_hidden()
    zone = page.locator("#zonePlans")
    assert zone.is_visible()
    assert zone.get_attribute("open") is None
    zone.locator("summary").click()
    assert zone.get_attribute("open") is not None
    zone.locator("summary").click()
    assert zone.get_attribute("open") is None
    page.screenshot(path=str(OUT / f"mobile-{width}x{height}-player.png"))
    # Het zichtbare deel van het speelveld verandert niet bij tabwissels.
    for kind, section in (("goal","#loGoals"),("coach","#loCoachPanel"),("player","#prep")):
        button=page.locator(f'[data-lo-mobile-panel="{kind}"]')
        button.click()
        assert button.get_attribute("aria-expanded") == "true"
        assert page.locator(section).is_visible()
        assert not page.locator(".mobile-scrim").is_visible()
        assert not page.locator(".mobile-sheet-head").is_visible()
        now=position(page,"#pitch")
        assert abs(now["y"]-pitch["y"]) <= 3, (kind,pitch,now)
        assert abs(now["height"]-pitch["height"]) <= 3, (kind,pitch,now)
        current=position(page,".side")
        assert current["y"] >= field["bottom"] and current["bottom"] <= height + 3, current
        assert current["scroll"] <= current["client"] + 4, (kind, current)
        page.screenshot(path=str(OUT / f"mobile-{width}x{height}-{kind}.png"))
    # Oefendoel is één korte keuzelijst; de achterliggende spelcode blijft dezelfde.
    page.locator('[data-lo-mobile-panel="goal"]').click()
    options=page.locator("#loMobileGoalSelect option")
    assert options.count() >= 3, options.count()
    selected=page.locator("#loMobileGoalSelect").input_value()
    other=next((options.nth(i).get_attribute("value") for i in range(options.count())
               if options.nth(i).get_attribute("value") != selected),None)
    assert other is not None
    page.locator("#loMobileGoalSelect").select_option(other)
    assert page.locator("#loMobileGoalSelect").input_value() == other
    assert page.locator(f'#loGoalChips [data-lo-goal-key="{other}"]').get_attribute("aria-pressed") == "true"
    page.locator('[data-lo-mobile-panel="player"]').click()
    assert page.locator(".side").is_visible()
    assert page.locator("#intents .intent").count() > 0
    print("MOBILE PASS",width,height,sport,field,pitch,side)


def run():
    OUT.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=2,
                              is_mobile=True,has_touch=True)
        errors=[]
        page.on("pageerror",lambda error: errors.append(str(error)))
        for width,height in [(390,844),(390,667),(375,667),(320,568),(844,390)]:
            run_view(page,width,height)
        assert not errors,errors
        browser.close()


if __name__ == "__main__":
    run()
