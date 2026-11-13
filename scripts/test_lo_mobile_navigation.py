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
    assert page.locator('.mobile-task-preview').is_visible()
    assert page.locator('[data-lo-mobile-panel]').count() == 3
    dimensions = page.evaluate("""() => {
        const r = el => el.getBoundingClientRect();
        const pitch = r(document.querySelector('#pitch'));
        const action = r(document.querySelector('#primary'));
        const menu = r(document.querySelector('.mobile-controls'));
        return {scrollX: document.documentElement.scrollWidth - innerWidth,
                scrollY: document.documentElement.scrollHeight - innerHeight,
                pitchWidth: pitch.width, pitchHeight: pitch.height,
                buttonHeight: action.height, menuHeight: menu.height,
                buttonBottom: action.bottom, menuTop: menu.top};
    }""")
    assert dimensions["scrollX"] <= 2, dimensions
    assert dimensions["scrollY"] <= 2, dimensions
    assert dimensions["pitchWidth"] > 180 and dimensions["pitchHeight"] > 95, dimensions
    assert dimensions["buttonHeight"] >= 38, dimensions
    assert dimensions["buttonBottom"] < dimensions["menuTop"], dimensions
    page.screenshot(path=str(SHOTS / f"{width}x{height}-veld.png"))

    page.locator('[data-lo-mobile-panel="player"]').click()
    assert page.locator(".shell > .side").is_visible()
    assert page.locator("#intents .intent").count() >= 2
    assert page.locator("#loMobilePanelTitle").inner_text() == "Speleropdrachten"
    page.screenshot(path=str(SHOTS / f"{width}x{height}-actie.png"))
    page.locator("#intents .intent").first.click()
    assert not page.locator(".shell > .side").is_visible()

    page.locator('[data-lo-mobile-panel="goal"]').click()
    assert page.locator("#loMobileGoalSelect").is_visible()
    page.locator("#loMobileClose").click()
    assert not page.locator(".shell > .side").is_visible()

    page.locator('[data-lo-mobile-panel="coach"]').click()
    assert page.locator("#loCoachPanel").is_visible()
    assert page.locator("#loMobilePanelTitle").inner_text() == "Coach en terugkijken"
    page.keyboard.press("Escape")
    assert not page.locator(".shell > .side").is_visible()
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
    print("LO mobiele actiebalk: vijf telefoonformaten en desktop gecontroleerd")

if __name__ == "__main__":
    main()
