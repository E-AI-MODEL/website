"""Controleer het speelveld en de bediening op telefoonformaten.

Run: python tools/lo-aanvalslab/tests/test_mobile_layout_browser.py
Playwright + Chromium vereist. De tests raken geen online spelkamer.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).resolve().parents[1] / "index.html"


def geometry(page):
    return page.evaluate("""() => {
      const b=(selector)=>{
        const r=document.querySelector(selector).getBoundingClientRect();
        return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right};
      };
      return {width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,
        bodyScroll:document.body.scrollHeight,app:b('.app'),field:b('.fieldpane'),
        pitch:b('#pitch'),tools:b('.mobile-controls'),footer:b('.lo-footer-links')};
    }""")


def test_mobile(page, width, height):
    page.set_viewport_size({"width": width, "height": height})
    page.goto(HTML.as_uri(), wait_until="domcontentloaded")
    page.wait_for_selector(".choice[data-mode='defend']")
    # Instapscherm: bij 390 breed twee kaarten naast elkaar, zonder horizontale scroll.
    if width <= 460 and height > 650:
        welcome = page.evaluate("""() => {
          const a=document.querySelectorAll('.choice');
          return {top0:a[0].getBoundingClientRect().top,top1:a[1].getBoundingClientRect().top,
            overflow:document.documentElement.scrollWidth>innerWidth+2}
        }""")
        assert abs(welcome["top0"]-welcome["top1"]) <= 2, welcome
        assert not welcome["overflow"], welcome
    page.locator(".choice[data-mode='defend']").click()
    g = geometry(page)
    print("MOBIEL", width, height, json.dumps(g, ensure_ascii=False))
    assert g["app"]["h"] <= height + 2, g
    assert g["scrollHeight"] <= height + 3, g
    assert g["bodyScroll"] <= height + 3, g
    assert g["field"]["y"] >= 0 and g["field"]["y"] < 115, g
    assert g["pitch"]["w"] > 150 and g["pitch"]["h"] > 70, g
    assert g["pitch"]["right"] <= width + 3, g
    assert g["tools"]["h"] >= 38, g
    assert g["tools"]["bottom"] < height + 3, g
    if height > 500:
        assert page.locator(".mobile-task-preview").is_visible()
        assert page.locator("#loMobileTaskTitle").inner_text() == page.locator("#tasktitle").inner_text()

    # De drie panelen gebruiken een eigen compact venster; niet de hele pagina.
    for button, section in [
        ("goal", "#loGoals"),
        ("player", "#prep"),
        ("coach", "#loCoachPanel"),
    ]:
        trigger=page.locator(f'[data-lo-mobile-panel="{button}"]')
        trigger.click()
        assert trigger.get_attribute("aria-expanded") == "true"
        assert page.locator(".side").is_visible()
        assert page.locator(section).is_visible()
        panel=page.locator(".side").bounding_box()
        assert panel["y"] >= height * (.1 if height <= 500 else .2), panel
        assert panel["y"] + panel["height"] <= height + 3, panel
        page.locator("#loMobileClose").click()
        assert not page.locator(".side").is_visible()
        assert trigger.get_attribute("aria-expanded") == "false"

    # Eigenlijke speleropdrachten blijven beschikbaar.
    page.locator('[data-lo-mobile-panel="player"]').click()
    page.locator("#prep").evaluate("(el)=>el.open=true")
    assert page.locator("#intents .intent").count() > 0
    page.locator("#loMobileScrim").click(position={"x": 8, "y": 8})
    assert not page.locator(".side").is_visible()

    # Geen onbedoelde horizontale breedte nadat het venster gesloten is.
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+3")


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844},
                                device_scale_factor=2, is_mobile=True, has_touch=True)
        errors=[]
        page.on("pageerror", lambda error: errors.append(str(error)))
        for width, height in [(390,844),(375,667),(320,568),(844,390)]:
            test_mobile(page,width,height)
        assert not errors, errors
        browser.close()


if __name__ == "__main__":
    main()
