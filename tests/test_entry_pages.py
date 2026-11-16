"""Guard direct public entry routes without changing standalone laboratories."""
import sys
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from prepare_ui import navigation


class PublicEntryPagesTests(unittest.TestCase):
    def source(self, path):
        doc = BeautifulSoup((ROOT / path).read_text(encoding="utf-8"), "html.parser")
        self.assertEqual(len(doc.select("main")), 1, path)
        self.assertEqual(len(doc.select("main h1")), 1, path)
        return doc

    def test_header_has_five_meaningful_destinations(self):
        for en, path, expected in (
            (False, "/nl/onderwijs/", ["/nl/model/", "/nl/onderwijs/", "/nl/onderzoek/", "/nl/publicaties/", "/nl/tools/"]),
            (True, "/en/education/", ["/en/model/", "/en/education/", "/en/research/", "/en/publications/", "/en/tools/"]),
        ):
            with self.subTest(language="en" if en else "nl"):
                doc = BeautifulSoup(navigation(BeautifulSoup("<html><head></head></html>", "html.parser"), path, en), "html.parser")
                primary = doc.select(".eai-site-primary > a[href]")
                self.assertEqual([link["href"] for link in primary], expected)
                self.assertEqual(len(doc.select(".eai-site-menu")), 1)
                self.assertEqual(len(doc.select(".eai-site-group")), 6)
                self.assertIsNotNone(doc.select_one("#eai-site-search-input"))

    def test_dutch_direct_destinations_are_real(self):
        expected = {
            "nl/onderwijs/index.html": ["/werkvormen/", "/taalwerkvormen/"],
            "nl/onderzoek/index.html": ["/nl/onderzoek/zhang-genai-taal/", "/bronnen/"],
            "nl/publicaties/index.html": ["/nl/onderzoek/zhang-genai-taal/", "/nl/blog/"],
            "nl/tools/index.html": ["/tools/science-observatory/", "/nl/llmscan/", "/tools/prompt-framework/", "/tools/wihtml/"],
            "nl/toepassingen/index.html": ["/toepassingen/onderwijs-ai/", "/toepassingen/onderwijsregio-rotterdam/", "/toepassingen/saga-legal-ai/"],
        }
        for path, targets in expected.items():
            with self.subTest(path=path):
                doc = self.source(path)
                hrefs = {a.get("href") for a in doc.select("main a[href]")}
                self.assertTrue(set(targets) <= hrefs, path)
                self.assertFalse(doc.select(".education-route-visual, .case-map"), "Do not show an extra decorative decision diagram")
                for target in targets:
                    self.assertTrue((ROOT / target.strip("/") / "index.html").exists(), target)

    def test_english_entry_pages_link_to_working_destinations(self):
        for path in ("en/education/index.html", "en/research/index.html", "en/publications/index.html", "en/applications/index.html", "en/tools/index.html"):
            with self.subTest(path=path):
                doc = self.source(path)
                self.assertEqual(len(doc.select(".eai-entry-feature")), 1)
                anchors = doc.select(".eai-entry-feature a[href]")
                self.assertGreaterEqual(len(anchors), 1)
                for anchor in anchors:
                    target = anchor["href"]
                    self.assertTrue(target.startswith("/"), target)
                    self.assertTrue((ROOT / target.strip("/") / "index.html").exists(), target)

    def test_dutch_research_does_not_repeat_wayfinding(self):
        doc = self.source("nl/onderzoek/index.html")
        self.assertFalse(doc.select(".knowledge-depth"))
        self.assertEqual(len(doc.select(".knowledge-routes .knowledge-route")), 3)
        self.assertEqual(len(doc.select(".eai-entry-feature")), 1)

    def test_no_lab_page_is_changed_by_this_scope(self):
        for path in ("tools/science-observatory/labs/natuurkunde/index.html", "tools/anatomie/index.html", "tools/eaigame/index.html"):
            self.assertTrue((ROOT / path).is_file(), path)


if __name__ == "__main__":
    unittest.main()
