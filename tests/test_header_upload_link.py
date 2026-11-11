"""Uploadshortcut moet in de hoofdheader zitten, ook op mobiel."""
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
        # De upload staat eenmaal als eigen actie in de kop, niet ook in Tools.
        self.assertNotIn("('HTML uploaden', '/tools/html-galerij/')", source)
        self.assertNotIn("('Upload HTML', '/tools/html-galerij/')", source)

    def test_small_screen_label_stays_accessible(self):
        css = (ROOT / "assets/site-redesign.css").read_text(encoding="utf-8")
        self.assertIn(".eai-site-upload:focus-visible", css)
        self.assertIn(".eai-site-upload span{display:none}", css)
        source = (ROOT / "scripts/prepare_ui.py").read_text(encoding="utf-8")
        self.assertIn('aria-label="', source)

    def test_gallery_page_exists(self):
        self.assertTrue((ROOT / "tools/html-galerij/index.html").exists())

if __name__ == "__main__":
    unittest.main()
