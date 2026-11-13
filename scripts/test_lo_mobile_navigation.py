"""Controleer de bediening van het LO-spel op echte mobiele schermformaten."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "tools/lo-aanvalslab/index.html"
SHOTS = ROOT / "artifacts/lo-mobile"
SHOTS.mkdir(parents=True, exist_ok=True)

def check_phone(browser, width, height):
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1, is_mobile=True, has_touch=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(PAGE.as_uri(), wait_until="domcontentloaded")
    page.locator('#welcome [data-mode="attack"]').click()
    page.wait_for_function("window.__loMobileSheet && document.querySelector('.app').dataset.loSheet === 'closed'")
    assert page.locator("#pitch").is_visible()
    assert page.locator("#primary").is_visible()
    assert not page.locator(".shell > .side").is_visible()
    assert not page.locator('.mobile-task-preview').is_visible()
    assert page.locator("#pitch").get_attribute("viewBox") == "0 0 650 1000"
    assert page.locator("#loWorld").get_attribute("transform") == "matrix(0 -1 1 0 0 1000)"
    assert page.locator("#loQuickActions").is_visible()
    assert page.locator("#loQuickButtons button").count() == 3
    assert page.locator('[data-lo-mobile-panel]').count() == 3
    assert not page.locator("#loMobileControls").is_visible()
    assert page.locator("#loGameSettingsOpen").is_visible()
    assert not page.locator("#sportSelect").is_visible()
    page.locator("#loGameSettingsOpen").click()
    assert page.locator("#sportSelect").is_visible()
    assert page.locator("#formationSelect").is_visible()
    assert page.locator("#new").is_visible()
    page.locator("#loGameSettingsOpen").click()
    assert not page.locator("#sportSelect").is_visible()
    assert page.locator("#loMobileGoalTrigger").is_visible()
    assert not page.locator("#loMobileCoachTrigger").is_visible()
    dimensions = page.evaluate("""() => {
        const r = el => el.getBoundingClientRect();
        const pitch = r(document.querySelector('#pitch'));
        const action = r(document.querySelector('#primary'));
        const top = r(document.querySelector('.top'));
        return {scrollX: document.documentElement.scrollWidth - innerWidth,
                scrollY: document.documentElement.scrollHeight - innerHeight,
                pitchWidth: pitch.width, pitchHeight: pitch.height,
                buttonHeight: action.height, topHeight: top.height,
                buttonBottom: action.bottom};
    }""")
    assert dimensions["scrollX"] <= 2, dimensions
    assert dimensions["scrollY"] <= 2, dimensions
    assert dimensions["pitchWidth"] > 180 and dimensions["pitchHeight"] > 160, dimensions
    assert dimensions["buttonHeight"] >= 38, dimensions
    assert dimensions["buttonBottom"] <= height + 2, dimensions
    assert dimensions["topHeight"] <= 52, dimensions
    page.screenshot(path=str(SHOTS / f"{width}x{height}-veld.png"))

    # Meer opent de overige acties zonder dat er drie grote menu's nodig zijn.
    page.locator(".lo-quick-more").click()
    assert page.locator(".shell > .side").is_visible()
    assert page.locator("#intents .intent").count() >= 2
    assert page.locator("#loMobilePanelTitle").inner_text() == "Speleropdrachten"
    page.screenshot(path=str(SHOTS / f"{width}x{height}-actie.png"))
    page.locator("#intents .intent").first.click()
    assert not page.locator(".shell > .side").is_visible()
    # Een hoofdactie is direct bereikbaar, zonder een extra paneel.
    page.locator("#loQuickButtons .lo-quick-choice").first.click()
    assert page.locator("#loQuickActions").is_visible()

    page.locator("#loMobileGoalTrigger").click()
    assert page.locator("#loMobileGoalSelect").is_visible()
    page.locator("#loMobileClose").click()
    assert not page.locator(".shell > .side").is_visible()

    # Coach opent na het spel: niet als een extra permanent menu.
    assert not page.locator("#loCoachSummary").is_visible()
    if width == 390:
        # De getekende richting is verticaal, maar de spelcoordinaten veranderen niet.
        before = page.evaluate("""() => {
            const svg=document.querySelector('#pitch'),world=document.querySelector('#loWorld');
            const c=document.querySelector('#actors [data-id="a0"] circle');
            const pt=svg.createSVGPoint();
            pt.x=+c.getAttribute('cx'); pt.y=+c.getAttribute('cy');
            const screen=pt.matrixTransform(world.getScreenCTM());
            return {x:screen.x,y:screen.y,worldX:pt.x};
        }""")
        page.mouse.move(before["x"], before["y"])
        page.mouse.down()
        page.mouse.move(before["x"], before["y"] - 25, steps=5)
        page.mouse.up()
        after = page.evaluate("""() => +document.querySelector('#actors [data-id="a0"] circle').getAttribute('cx')""")
        assert after > before["worldX"] + 10, (before, after)
    page.locator("#primary").click()
    assert not page.locator("#loQuickActions").is_visible()
    if width == 390:
        # Tempo verschijnt pas tijdens het afspelen; dat is bewust zo ontworpen.
        page.locator("#playbackSpeed").select_option("2")
    if width == 390:
        page.wait_for_function("document.querySelector('.app').dataset.loPhase === 'done'", timeout=25000)
        assert page.locator("#loCoachSummary").is_visible()
        assert page.locator("#loMobileCoachTrigger").is_visible()
        assert not page.locator("#loMobileGoalTrigger").is_visible()
        # De enige afspeelknop mag niet in de verdwenen resetkolom belanden.
        button_box = page.locator("#primary").bounding_box()
        assert button_box and button_box["width"] >= 180, button_box
        assert page.locator("#primary").inner_text().strip().startswith("Speel opnieuw")
        page.locator("#loCoachSummaryOpen").click()
        assert page.locator(".shell > .side").is_visible()
        assert page.locator("#loMobilePanelTitle").inner_text() == "Coach en terugkijken"
        page.keyboard.press("Escape")
        assert not page.locator(".shell > .side").is_visible()
        page.screenshot(path=str(SHOTS / "390x844-coach.png"))
    assert not errors, errors
    page.close()

def check_desktop(browser):
    page = browser.new_page(viewport={"width": 1366, "height": 820})
    page.goto(PAGE.as_uri(), wait_until="domcontentloaded")
    page.locator('#welcome [data-mode="attack"]').click()
    assert not page.locator("#loMobileControls").is_visible()
    assert page.locator(".shell > .side").is_visible()
    assert not page.locator(".mobile-sheet-head").is_visible()
    page.close()

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            for width, height in ((320, 568), (375, 667), (390, 844), (430, 932), (768, 1024)):
                check_phone(browser, width, height)
            check_desktop(browser)
        finally:
            browser.close()
    print("LO portretveld en directe speleracties: vijf telefoonformaten en desktop gecontroleerd")

if __name__ == "__main__":
    main()
