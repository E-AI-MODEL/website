"""Eenkaart-per-swipe blijft beperkt tot publieke tekstpagina's."""
from pathlib import Path
import sys
import unittest
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from prepare_ui import ASSETS, STORY_PATHS


class EditorialCardUiTests(unittest.TestCase):
    def test_only_editorial_routes_are_opted_in(self):
        expected = {
            "/nl/onderwijs/", "/en/education/",
            "/nl/onderzoek/", "/en/research/",
            "/nl/publicaties/", "/en/publications/",
            "/nl/toepassingen/", "/en/applications/",
            "/nl/tools/", "/en/tools/",
            "/nl/over/", "/en/about/",
        }
        self.assertEqual(STORY_PATHS, expected)
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

    def test_prepared_pages_link_assets_without_changing_routes(self):
        out = ROOT / "site-build"
        if not (out / "nl/onderzoek/index.html").exists():
            self.skipTest("Run this check after build_site.py and prepare_ui.py")
        for route in STORY_PATHS:
            page = out / route.lstrip("/") / "index.html"
            self.assertTrue(page.exists(), route)
            soup = BeautifulSoup(page.read_text(encoding="utf-8"), "html.parser")
            self.assertIn("eai-story-page", soup.body.get("class", []), route)
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
