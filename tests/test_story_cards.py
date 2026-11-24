"""Homepage-stijl blijft beperkt tot publieke pagina's en artikelen."""
from pathlib import Path
import sys
import unittest
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from prepare_ui import ASSETS, STORY_PATHS
from home_continuity import ROUTES, HUBS


class EditorialCardUiTests(unittest.TestCase):
    def test_only_editorial_routes_are_opted_in(self):
        expected = {
            "/nl/onderwijs/", "/en/education/",
            "/nl/onderzoek/", "/en/research/",
            "/nl/publicaties/", "/en/publications/",
            "/nl/toepassingen/", "/en/applications/",
            "/nl/tools/", "/en/tools/",
            "/nl/over/", "/en/about/",
            "/nl/blog/", "/nl/blog/wat-ons-werk-ons-werk-maakt/",
            "/nl/onderzoek/leermiddelen/", "/en/research/teaching-tools/",
            "/nl/onderzoek/zhang-genai-taal/", "/en/research/zhang-genai-language/",
        }
        self.assertEqual(STORY_PATHS, expected)
        self.assertEqual(ROUTES, expected)
        self.assertEqual(len(HUBS), 12)
        self.assertFalse(any("/labs/" in path or path.startswith("/tools/") for path in STORY_PATHS))
        self.assertFalse(any(path in STORY_PATHS for path in (
            "/tools/science-observatory/labs/natuurkunde/",
            "/tools/science-observatory/labs/wiskunde-a/",
            "/tools/science-observatory/labs/wiskunde-b/",
            "/tools/anatomie/",
            "/tools/sport-en-bewegen/",
            "/nl/model-monitor/",
            "/tools/eaigame/",
        )))

    def test_assets_are_source_controlled(self):
        for name in ("site-story-cards.css", "site-story-cards.js"):
            self.assertIn(name, ASSETS)
            self.assertGreater((ROOT / "assets" / name).stat().st_size, 1000)

    def test_research_page_has_one_choice_list(self):
        soup = BeautifulSoup((ROOT / "nl/onderzoek/index.html").read_text(encoding="utf-8"), "html.parser")
        self.assertFalse(soup.select(".knowledge-depth"), "The same three choices should not appear in hero and cards")
        cards = soup.select(".knowledge-routes .knowledge-route")
        self.assertEqual(len(cards), 3)
        self.assertNotIn("5 min", cards[0].get_text(" ", strip=True))
        self.assertNotIn("20 min", cards[1].get_text(" ", strip=True))
        self.assertTrue(all(card.select_one("a[href]") for card in cards))

    def test_distinct_visuals_per_subject_in_prepared_tools(self):
        page = ROOT / "site-build/nl/tools/index.html"
        if not page.exists():
            self.skipTest("Run after site build")
        soup = BeautifulSoup(page.read_text(encoding="utf-8"), "html.parser")
        svgs = soup.select(".eai-explore-choice .eai-continuity-art svg")
        self.assertEqual(len(svgs), 8)
        self.assertEqual(len({str(svg) for svg in svgs}), 8)

    def test_prepared_pages_link_assets_without_changing_routes(self):
        out = ROOT / "site-build"
        if not (out / "nl/onderzoek/index.html").exists():
            self.skipTest("Run this check after build_site.py and prepare_ui.py")
        for route in STORY_PATHS:
            page = out / route.lstrip("/") / "index.html"
            self.assertTrue(page.exists(), route)
            soup = BeautifulSoup(page.read_text(encoding="utf-8"), "html.parser")
            self.assertIn("eai-story-page", soup.body.get("class", []), route)
            self.assertEqual(soup.body.get('data-eai-story-layout'), 'homepage-continuity-v1', route)
            self.assertFalse(soup.select_one('.eai-card-deck'), route)
            if route in HUBS:
                self.assertTrue(soup.select_one('.eai-continuity-art') or soup.select_one('.eai-continuity-aside'), route)
            self.assertTrue(soup.select_one('link[href*="site-story-cards."]'), route)
            self.assertTrue(soup.select_one('script[src*="site-story-cards."]'), route)
        for route in (
            "/tools/science-observatory/labs/natuurkunde/",
            "/tools/science-observatory/labs/wiskunde-a/",
            "/tools/science-observatory/labs/wiskunde-b/",
            "/tools/anatomie/",
            "/tools/sport-en-bewegen/",
        ):
            page = out / route.lstrip("/") / "index.html"
            if not page.exists():
                continue
            soup = BeautifulSoup(page.read_text(encoding="utf-8"), "html.parser")
            self.assertNotIn("eai-story-page", soup.body.get("class", []), route)
            self.assertFalse(soup.select_one('link[href*="site-story-cards."]'), route)
            self.assertFalse(soup.select_one('script[src*="site-story-cards."]'), route)


if __name__ == "__main__":
    unittest.main()
