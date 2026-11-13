"""Check ABYSS source fidelity, mobile menus and the public route."""
from pathlib import Path
from html.parser import HTMLParser
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "abyss" / "ABYSS.html"
PUBLIC = ROOT / "site-build" / "tools" / "abyss" / "index.html"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.hrefs.extend(value for key, value in attrs if key == "href")


class AbyssPublishTests(unittest.TestCase):
    def test_standalone_source_is_published_verbatim(self):
        self.assertTrue(SOURCE.is_file())
        self.assertTrue(PUBLIC.is_file())
        self.assertEqual(SOURCE.read_bytes(), PUBLIC.read_bytes())

    def test_mobile_menu_has_five_real_controls(self):
        html = SOURCE.read_text(encoding="utf-8")
        for panel in ("modules", "chart", "settings", "measurements", "learning"):
            self.assertIn('data-panel="' + panel + '"', html)
        self.assertIn('function bindMobilePanels()', html)
        self.assertIn('data-mobile-panel=', html)
        self.assertIn('id="mobileDock"', html)
        self.assertIn('function updateChart()', html)
        self.assertIn('id="sea3d"', html)
        self.assertIn('role="status"', html)

    def test_abyss_is_available_but_absent_from_main_overviews(self):
        self.assertTrue(PUBLIC.is_file(), "Bestaande ABYSS-route blijft bereikbaar")
        for rel in ("nl/tools/index.html", "tools/index.html"):
            page = ROOT / "site-build" / rel
            self.assertTrue(page.is_file())
            html = page.read_text(encoding="utf-8")
            self.assertIn("<main", html)
            main = "<main" + html.split("<main", 1)[1].split("</main>", 1)[0] + "</main>"
            links = Links()
            links.feed(main)
            self.assertNotIn("/tools/abyss/", links.hrefs)

    def test_source_explains_actual_data_vs_demo(self):
        html = SOURCE.read_text(encoding="utf-8")
        self.assertIn("schematisch", html)
        self.assertIn("USGS", html)
        self.assertIn("GEBCO", html)
        self.assertIn("Mapzen", html)


if __name__ == "__main__":
    unittest.main()
