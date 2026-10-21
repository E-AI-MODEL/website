"""Browser checks after build_site.py and prepare_ui.py.
Install: python -m pip install playwright; python -m playwright install chromium
Run: python scripts/home_model_smoke.py --root site-build
An existing Chrome executable can be selected with --browser /path/to/chrome.
"""
from __future__ import annotations
import argparse
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run(root: Path, output: Path, executable: str | None = None):
    output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root.resolve())))
    base = f'http://127.0.0.1:{server.server_port}'
    threading.Thread(target=server.serve_forever, daemon=True).start()
    results, errors = [], []
    paths = ['/', '/nl/', '/en/', '/nl/model/', '/en/model/', '/nl/tools/', '/nl/onderwijs/', '/nl/onderzoek/', '/nl/toepassingen/']
    try:
        with sync_playwright() as p:
            options = {'headless': True}
            if executable:
                options.update(executable_path=executable, args=['--no-sandbox', '--disable-dev-shm-usage'])
            browser = p.chromium.launch(**options)
            try:
                context = browser.new_context()
                page = context.new_page()
                page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
                page.on('pageerror', lambda e: errors.append(str(e)))
                for width in [1440, 1024, 768, 390, 320]:
                    page.set_viewport_size({'width': width, 'height': 900})
                    for path in paths:
                        page.goto(base + path, wait_until='load')
                        row = page.evaluate('''() => ({
                            path:location.pathname, width:innerWidth,
                            scroll:document.documentElement.scrollWidth,
                            client:document.documentElement.clientWidth,
                            version:document.body.dataset.uiVersion,
                            homeModel:document.body.dataset.homeModel || null,
                            menu:document.querySelectorAll('.eai-site-menu').length,
                            oldNav:document.querySelectorAll('.eai-links').length,
                            h1:getComputedStyle(document.querySelector('h1')).fontSize,
                            narrow:[...document.querySelectorAll('main p')].filter(e=>{
                                const b=e.getBoundingClientRect(); return b.width>0&&b.width<125;
                            }).map(e=>e.textContent.slice(0,60))
                        })''')
                        assert row['version'] and row['menu'] == 1 and row['oldNav'] == 0, row
                        assert row['scroll'] <= row['client'] + 1 and not row['narrow'], row
                        page.locator('.eai-site-menu>summary').click()
                        page.locator('.eai-site-group').first.locator('summary').click()
                        expected = '/en/model/' if path.startswith('/en/') else '/nl/model/'
                        assert page.locator('.eai-site-group').first.locator('a').first.get_attribute('href') == expected
                        box = page.locator('.eai-site-menu-panel').bounding_box()
                        assert box and box['x'] >= 0 and box['x'] + box['width'] <= width + 1, box
                        page.keyboard.press('Escape')
                        assert not page.locator('.eai-site-menu').evaluate('(e)=>e.open')
                        assert page.locator('.eai-site-menu>summary').evaluate('(e)=>e===document.activeElement')
                        if path in ['/', '/nl/', '/en/']:
                            first = page.locator('#eai-demo-output').text_content()
                            page.locator('[data-eai-demo="1"]').click()
                            assert page.locator('#eai-demo-output').text_content() != first
                            assert page.locator('[data-eai-demo="1"]').get_attribute('aria-pressed') == 'true'
                            page.locator('[data-eai-demo="0"]').click()
                            columns = page.locator('.hm-hero-grid').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
                            assert columns == (2 if width >= 1024 else 1)
                        if path.endswith('/model/'):
                            assert page.locator('.hm-model-step').count() == 4
                            page.locator('.hm-detail').first.locator('summary').click()
                            assert page.locator('.hm-detail').first.evaluate('(e)=>e.open')
                            page.locator('.hm-detail').first.locator('summary').click()
                            assert page.locator('.eai-site-language a[lang="en"]').get_attribute('href') == '/en/model/'
                            assert page.locator('.eai-site-language a[lang="nl"]').get_attribute('href') == '/nl/model/'
                        page.evaluate('window.scrollTo(0,0)')
                        if width in [1440, 390] and path in ['/', '/nl/model/']:
                            name = ('model' if '/model/' in path else 'home') + '-' + str(width)
                            page.screenshot(path=str(output / (name + '.png')), full_page=True)
                        results.append(row)
                nojs = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
                fallback = nojs.new_page()
                fallback.goto(base + '/')
                fallback.locator('.eai-site-menu>summary').click()
                fallback.locator('.eai-site-group').first.locator('summary').click()
                assert fallback.locator('.eai-site-group').first.locator('a').first.is_visible()
                assert fallback.locator('.hm-nojs-examples summary').count() == 3
                nojs.close()
                assert not errors, errors
                report = {'results': results, 'errors': errors, 'noJavaScriptMenu': True, 'exampleSwitch': True, 'modelLinks': True}
                (output / 'home-model-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
                print(f'PASS: {len(results)} page/viewport checks, menu keyboard, examples, model links and no-JS fallback.')
                return report
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('site-build'))
    parser.add_argument('--output', type=Path, default=Path('test-results/home-model'))
    parser.add_argument('--browser')
    args = parser.parse_args()
    run(args.root, args.output, args.browser)
