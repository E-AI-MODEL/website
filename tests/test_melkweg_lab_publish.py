"""Controleer dat het Melkweg Lab na een volledige sitebuild bereikbaar blijft."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "melkweg-lab" / "index.html"
PUBLISHED = ROOT / "site-build" / "tools" / "melkweg-lab" / "index.html"
CATALOG = ROOT / "site-build" / "tools" / "science-observatory" / "index.html"
ENTRY_PAGES = (
    ROOT / "site-build" / "tools" / "index.html",
    ROOT / "site-build" / "nl" / "tools" / "index.html",
    CATALOG,
)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        for name, value in attrs:
            if name == "href":
                self.hrefs.append(value)


class MelkwegLabPublicationTests(unittest.TestCase):
    def test_standalone_html_is_preserved_exactly(self):
        self.assertTrue(SOURCE.is_file())
        self.assertTrue(PUBLISHED.is_file(), "De sitebuild moet het Melkweg Lab publiceren")
        self.assertEqual(SOURCE.read_bytes(), PUBLISHED.read_bytes())

    def test_all_three_entry_pages_link_to_lab(self):
        for page in ENTRY_PAGES:
            with self.subTest(page=page):
                self.assertTrue(page.is_file(), str(page))
                links = Links()
                links.feed(page.read_text(encoding="utf-8"))
                self.assertIn("/tools/melkweg-lab/", links.hrefs)

    def test_main_observatory_is_not_replaced(self):
        source = ROOT / "content" / "science-observatory" / "labs" / "melkweg.html"
        target = ROOT / "site-build" / "tools" / "science-observatory" / "labs" / "melkweg" / "index.html"
        self.assertTrue(source.is_file())
        self.assertTrue(target.is_file())
        self.assertEqual(source.read_bytes(), target.read_bytes())

    def test_child_friendly_navigation_and_planets_exist(self):
        html = SOURCE.read_text(encoding="utf-8")
        for marker in (
            "✦ Planeten",
            "role=\"tablist\"",
            "data-labtab=\"speel\"",
            "selectLabTab(activeLabTab)",
            "V7: mobiele bediening is een observatorium",
            "Waar zijn wij?",
            "Jouw avontuur",
            "solarExplorer",
            "planet-pick",
            "prefers-reduced-motion",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, html)
        self.assertEqual(html.count('id="solarEntry"'), 1, "Er moet één planetenknop zijn")
        self.assertNotIn('class="solar-entry">✦ Reis naar de planeten', html)
        self.assertIn('if(!state.running && state.cam.elev>20)', html)
        # V9 tekent de Melkweg beeldvullend en toont knoppen pas op aanvraag.
        self.assertIn('V9: het model is het scherm', html)
        self.assertIn('id="labDock"', html)
        self.assertIn('id="labBackdrop"', html)
        self.assertIn('id="cameraMenuToggle"', html)
        self.assertIn('id="toolsMenuToggle"', html)
        self.assertIn('body.lab-sheet-open .inspector', html)
        self.assertIn('position:absolute;inset:0;width:100%;height:100%', html)
        self.assertIn("document.body.classList.toggle('lab-sheet-open',expanded)", html)
        self.assertIn("selectLabTab(activeLabTab)", html)
        self.assertNotIn('id="labExpand"', html)


if __name__ == "__main__":
    unittest.main()
