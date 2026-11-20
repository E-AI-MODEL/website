"""Static checks for the hidden, local-only ICT scan."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "ict-scan"

class ICTScanTests(unittest.TestCase):
    def test_files_exist(self):
        for filename in ("index.html", "style.css", "monitor.css", "app.js", "enhancements.js", "github-sync.js", "rail-drawer.js", "visual-explorer.js", "visual-explorer.css", "record-cards.js", "record-github.js", "record-cards.css", "frameworks.json", "answer-engine.js", "answer-engine.css", "scene-navigation.js", "scene-navigation.css", "emmaus-logo.svg", "README.md"):
            self.assertTrue((TOOL / filename).is_file(), filename)

    def test_secret_not_security_and_litespeed_404_middle_zero(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        js = (TOOL / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="unlockZero"', html)
        self.assertNotIn('id="unlockFour"', html)
        self.assertIn('<title>404 Not Found</title>', html)
        self.assertIn('Proudly powered by LiteSpeed Web Server', html)
        self.assertIn('The resource requested could not be found on this server!', html)
        self.assertNotIn('class="mock-header"', html)
        self.assertIn("zero.addEventListener('dblclick'", js)
        self.assertIn("e.pointerType!=='touch'", js)
        self.assertNotIn("$('unlockFour')", js)
        css = (TOOL / 'monitor.css').read_text(encoding='utf-8')
        self.assertIn('#notFound.litespeed-404', css)
        self.assertIn('background: #000', css)
        self.assertIn('background: #474747', css)
        self.assertNotIn('id="gateInput"', html)
        self.assertNotIn('id="gateForm"', html)
        self.assertNotIn("gateForm", js)
        self.assertNotIn("gateInput", js)
        self.assertIn("document.dispatchEvent(new Event('ict-scan:opened'))", js)
        enhancements = (TOOL / "enhancements.js").read_text(encoding="utf-8")
        self.assertIn("document.addEventListener('ict-scan:opened',async()=>{await restoreSnapshot();document.dispatchEvent(new Event('ict-scan:local-restored'));})", enhancements)
        self.assertNotIn("gateForm", enhancements)
        self.assertIn('noindex,nofollow', html)
        self.assertIn("connect-src 'self' https://api.github.com", html)
        self.assertNotIn('analytics.js', html)
        self.assertNotIn('cloudflareinsights', html)

    def test_no_remote_scripts(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        self.assertRegex(html, r'src="\./app\.js')
        self.assertRegex(html, r'src="\./enhancements\.js')
        self.assertRegex(html, r'src="\./github-sync\.js')
        self.assertRegex(html, r'src="\./rail-drawer\.js')
        self.assertRegex(html, r'src="\./visual-explorer\.js')
        self.assertRegex(html, r'href="\./visual-explorer\.css')
        self.assertRegex(html, r'src="\./record-cards\.js')
        self.assertRegex(html, r'src="\./record-github\.js')
        self.assertRegex(html, r'src="\./answer-engine\.js')
        self.assertRegex(html, r'href="\./answer-engine\.css')
        self.assertRegex(html, r'href="\./record-cards\.css')
        self.assertRegex(html, r'href="\./monitor\.css')
        self.assertRegex(html, r'src="\./emmaus-logo\.svg')
        self.assertNotIn('<script src="http', html)
        self.assertNotIn('https://cdn.', html)
        self.assertIn('src="./scene-navigation.js', html)
        self.assertIn('href="./scene-navigation.css', html)
        self.assertIn('PDF-inhoud is niet beoordeeld', (TOOL / 'app.js').read_text(encoding='utf-8'))

    def test_github_sync_is_read_only_and_credentials_not_persisted(self):
        html = (TOOL / 'index.html').read_text(encoding='utf-8')
        js = (TOOL / 'github-sync.js').read_text(encoding='utf-8')
        self.assertIn('id="githubSyncStart"', html)
        self.assertIn('id="githubRepo"', html)
        self.assertIn('id="githubFolder"', html)
        self.assertIn('id="githubToken" type="password"', html)
        self.assertIn('https://api.github.com', js)
        self.assertIn("method:'GET'", js)
        self.assertNotIn("method:'POST'", js)
        self.assertNotIn("method:'PUT'", js)
        self.assertNotIn("localStorage", js)
        self.assertNotIn("sessionStorage", js)
        self.assertIn("githubToken').value=''", js)
        self.assertIn('await importOneFile(file)', js)
        self.assertIn('restoreState(backup)', js)

    def test_routes_copied_by_builder(self):
        builder = (ROOT / 'scripts' / 'build_site.py').read_text(encoding='utf-8')
        self.assertIn('ict_scan_source = repo_root / "tools" / "ict-scan"', builder)
        self.assertNotIn('"/tools/ict-scan/"', builder.split('urls.extend(')[-1])

    def test_expandable_sidebar_keeps_primary_navigation(self):
        html = (TOOL / 'index.html').read_text(encoding='utf-8')
        js = (TOOL / 'rail-drawer.js').read_text(encoding='utf-8')
        css = (TOOL / 'monitor.css').read_text(encoding='utf-8')
        for label in ('overview', 'apps', 'connections', 'ai', 'privacy', 'findings', 'reports', 'sources'):
            self.assertIn(f'data-view="{label}"', html)
        self.assertIn('id="railMore"', html)
        self.assertIn('id="railDrawer"', html)
        self.assertIn('id="railScrim"', html)
        self.assertNotIn('class="work-tabs"', html)
        for control in ('globalSearch', 'topImport', 'topGithubSync', 'topReports', 'topPdf', 'drawerExcel', 'drawerJson'):
            self.assertEqual(html.count(f'id="{control}"'), 1, control)
        self.assertIn("event.key==='Escape'", js)
        self.assertIn("event.key!=='/'", js)
        self.assertIn("openDrawer(true)", js)
        self.assertIn('.icon-rail .rail-more', css)
        self.assertIn('@media(max-width:720px)', css)

    def test_school_style_fixed_viewport_and_reports(self):
        css = (TOOL / 'monitor.css').read_text(encoding='utf-8')
        js = (TOOL / 'enhancements.js').read_text(encoding='utf-8')
        self.assertIn('height:100dvh', css.replace(' ', ''))
        self.assertIn('overflow:auto', css.replace(' ', ''))
        self.assertIn('function renderReports()', js)
        for report in ('schoolbreed','koppelingen','ai','privacy','controles'):
            self.assertIn(report, js)
        self.assertIn('indexedDB', js)
        self.assertIn('snapshotWrite', js)

if __name__ == '__main__':
    unittest.main()