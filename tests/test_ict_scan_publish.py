"""Static checks for the hidden, local-only ICT scan."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "ict-scan"

class ICTScanTests(unittest.TestCase):
    def test_files_exist(self):
        for filename in ("index.html", "style.css", "app.js", "README.md"):
            self.assertTrue((TOOL / filename).is_file(), filename)

    def test_secret_not_security_and_404_first_digit(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        js = (TOOL / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="unlockFour"', html)
        self.assertIn('id="gateInput"', html)
        self.assertIn("==='Emmauscollege'", js)
        self.assertIn('noindex,nofollow', html)
        self.assertIn("connect-src 'none'", html)
        self.assertNotIn('analytics.js', html)
        self.assertNotIn('cloudflareinsights', html)

    def test_no_remote_scripts(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="./app.js"', html)
        self.assertNotIn('<script src="http', html)
        self.assertNotIn('https://cdn.', html)
        self.assertIn('PDF-inhoud is niet beoordeeld', (TOOL / 'app.js').read_text(encoding='utf-8'))

    def test_routes_copied_by_builder(self):
        builder = (ROOT / 'scripts' / 'build_site.py').read_text(encoding='utf-8')
        self.assertIn('tools/ict-scan', builder)
        self.assertNotIn('"/tools/ict-scan/"', builder.split('urls.extend(')[-1])

if __name__ == '__main__':
    unittest.main()