"""HTML-upload blijft bereikbaar; op mobiel staat hij rustiger onder Tools."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class UploadNavigationTests(unittest.TestCase):
    def test_shared_header_uses_gallery_link(self):
        source = (ROOT / "scripts/prepare_ui.py").read_text(encoding="utf-8")
        self.assertIn("upload_button", source)
        self.assertIn('href="/tools/html-galerij/"', source)
        self.assertIn("HTML uploaden", source)
        self.assertIn("Upload HTML", source)
        self.assertIn('class="eai-site-upload"', source)
        # Desktop retains the button. On mobile the central tools landing
        # exposes the HTML gallery without duplicating it in the menu.
        self.assertIn("('Kies een vakgebied of hulpmiddel', '/nl/tools/')", source)
        self.assertIn("('Explore and create', '/en/tools/')", source)
        for path in ('nl/tools/index.html', 'en/tools/index.html'):
            self.assertIn('href="/tools/html-galerij/"',
                          (ROOT / path).read_text(encoding='utf-8'), path)

    def test_small_screen_label_stays_accessible(self):
        css = (ROOT / "assets/site-redesign.css").read_text(encoding="utf-8")
        self.assertIn(".eai-site-upload:focus-visible", css)
        self.assertIn(".eai-site-upload{display:none!important}", css)
        source = (ROOT / "scripts/prepare_ui.py").read_text(encoding="utf-8")
        self.assertIn('aria-label="', source)

    def test_gallery_page_exists(self):
        self.assertTrue((ROOT / "tools/html-galerij/index.html").exists())

if __name__ == "__main__":
    unittest.main()
