"""Dashboardkaarten blijven op publieke overzichtspagina's en vervangen geen labs."""
from pathlib import Path
import sys
import unittest

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from prepare_ui import ASSETS, DASH_CARD_PATHS

INDEXES = {
    "/nl/tools/", "/en/tools/",
    "/nl/onderwijs/", "/en/education/",
    "/nl/onderzoek/", "/en/research/",
    "/nl/toepassingen/", "/en/applications/",
    "/nl/publicaties/", "/en/publications/",
}
LABS = (
    "/tools/science-observatory/labs/natuurkunde/",
    "/tools/science-observatory/labs/wiskunde-a/",
    "/tools/anatomie/", "/tools/eaigame/",
    "/tools/lo-aanvalslab/", "/tools/eaigit/",
)

class DashboardCardsTests(unittest.TestCase):
    def test_scope_and_source_assets(self):
        self.assertEqual(DASH_CARD_PATHS, INDEXES)
        self.assertFalse(set(LABS) & DASH_CARD_PATHS)
        for asset in ("site-dashboard-cards.css", "site-dashboard-cards.js"):
            self.assertIn(asset, ASSETS)
            self.assertGreater((ROOT / "assets" / asset).stat().st_size, 1000)

    def test_home_has_real_routes_and_preserves_original_reading(self):
        root = BeautifulSoup((ROOT / "content/home-model/home-nl.html").read_text(encoding="utf-8"), "html.parser")
        self.assertEqual(len(root.select("main")), 1)
        self.assertEqual(len(root.select("main h1")), 1)
        self.assertEqual(len(root.select(".eai-landing-route")), 4)
        self.assertEqual(len(root.select(".eai-dash-card-art")), 4)
        self.assertEqual(len(root.select(".eai-dash-step")), 4)
        self.assertEqual(len(root.select(".eai-dash-table > a")), 4)
        self.assertEqual(len(root.select(".eai-reading-feature")), 1)
        self.assertEqual(len(root.select(".eai-reading-list a")), 2)
        self.assertFalse(root.select('.eai-dash-rail'), 'Only one shared site navigation')
        self.assertFalse(root.select('[data-dash-filter], .eai-dash-route-controls'), 'Four links need no filters')
        for target in ("/nl/model/", "/nl/onderwijs/", "/nl/onderzoek/", "/nl/tools/"):
            self.assertEqual(len(root.select(f'.eai-landing-route[href="{target}"]')), 1)
        for anchor in ("model", "leren-en-toetsen", "schoolafspraken", "ai-playground", "eai-blog",
                       "dagelijks-werk", "toepassing-kiezen", "ai-begrijpen", "verhaal", "verder-lezen"):
            self.assertIsNotNone(root.find(id=anchor), anchor)
        self.assertEqual(root.find(id="eh-home-title").get_text(" ", strip=True), "Wat ons werk ons werk maakt")
        self.assertIsNone(root.select_one("#eai-dash-search"))
        self.assertIsNotNone(root.select_one(".eai-dash-hero-more > summary"))
        area = root.select_one(".eai-dash-workspace")
        self.assertIsNotNone(area)
        self.assertEqual([node.name for node in area.find_all(recursive=False)], ["section", "section", "aside"])
        self.assertEqual(len(root.select(".eai-dash-step[aria-pressed='true']")), 1)
        self.assertIn("/tools/eaigit/", [a["href"] for a in root.select(".eai-dash-table > a")])

    def test_dashboard_is_not_fake_analytics(self):
        page = (ROOT / "content/home-model/home-nl.html").read_text(encoding="utf-8")
        for absent in ("bezoekers vandaag", "bounce rate", "57 projects", "laatst bekeken", "100% score"):
            self.assertNotIn(absent, page.lower())
        self.assertIn("Vier vragen", page)
        self.assertIn("vier", page.lower())

    def test_prepared_pages_have_correct_scope_and_hashed_assets(self):
        build = ROOT / "site-build"
        if not (build / "nl/index.html").is_file():
            self.skipTest("Pas na sitebuild en prepare_ui")
        for page in ("index.html", "nl/index.html", "en/index.html"):
            home = BeautifulSoup((build / page).read_text(encoding="utf-8"), "html.parser")
            self.assertIn("eai-dash-page", home.body.get("class", []))
            self.assertIsNotNone(home.select_one('link[href*="site-dashboard-cards."]'), page)
            self.assertIsNotNone(home.select_one('script[src*="site-dashboard-cards."]'), page)
            self.assertEqual(len(home.select("main.eai-dashboard-home .eai-landing-route")), 4)
            self.assertEqual(len(home.select("header.eai-masthead")), 1, page)
        for route in INDEXES:
            p = build / route.strip("/") / "index.html"
            if not p.is_file():
                continue
            page = BeautifulSoup(p.read_text(encoding="utf-8"), "html.parser")
            self.assertIn("eai-card-index", page.body.get("class", []), route)
            self.assertIsNotNone(page.select_one('link[href*="site-dashboard-cards."]'), route)
            self.assertIsNone(page.select_one('script[src*="site-dashboard-cards."]'), route)
        for route in LABS:
            p = build / route.strip("/") / "index.html"
            if not p.is_file():
                continue
            page = BeautifulSoup(p.read_text(encoding="utf-8"), "html.parser")
            self.assertNotIn("eai-dash-page", page.body.get("class", []), route)
            self.assertNotIn("eai-card-index", page.body.get("class", []), route)
            self.assertIsNone(page.select_one('link[href*="site-dashboard-cards."]'), route)

if __name__ == "__main__":
    unittest.main()
