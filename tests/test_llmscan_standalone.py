from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1] / "nl" / "llmscan"

class LLMScanStandaloneTests(unittest.TestCase):
    def test_original_catalogue_is_complete(self):
        content = (ROOT / "catalogue.js").read_text(encoding="utf-8")
        prefix = "window.__LLMSCAN_SEED="
        self.assertIn(prefix, content)
        seed = json.loads(content.split(prefix, 1)[1].rsplit(";", 1)[0])
        products = seed["products"]
        self.assertEqual(len(products), 51)
        self.assertEqual(sum(p["layer"] == "Taalmodel" for p in products), 30)
        self.assertEqual(len({p["id"] for p in products}), 51)
        self.assertTrue(all(p.get("analysis") and p.get("source") for p in products))

    def test_original_app_no_longer_iframed(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        js = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertNotIn("<iframe", html.lower())
        self.assertIn('<script src="catalogue.js"></script>', html)
        self.assertIn('<script src="app.js"></script>', html)
        self.assertIn("window.__LLMSCAN_SEED", js)
        self.assertIn("function render()", js)
        self.assertIn('href="onderzoek/"', html)

    def test_all_original_images_are_local(self):
        catalogue = (ROOT / "catalogue.js").read_text(encoding="utf-8")
        seed = json.loads(catalogue.split("window.__LLMSCAN_SEED=", 1)[1].rsplit(";", 1)[0])
        assets = {"icon.svg", "logo.svg", "classroom-hero.png"}
        assets.update(seed.get("provider_assets", {}).values())
        assets.update(visual["path"] for visual in seed.get("catalogue_visuals", {}).values() if visual.get("path"))
        for path in sorted(assets):
            with self.subTest(path=path):
                file = ROOT / path
                self.assertTrue(file.is_file(), f"Missing original image: {path}")
                self.assertGreater(file.stat().st_size, 32, f"Empty image: {path}")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertNotIn("eai-llmscan.werkruimte-s-2100.chatgpt.site/", html)
        self.assertNotIn("eai-llmscan.werkruimte-s-2100.chatgpt.site/", app)

    def test_research_and_tools_are_distinct_records(self):
        content = (ROOT / "updates.js").read_text(encoding="utf-8")
        updates = json.loads(content.split("window.__LLMSCAN_UPDATES=", 1)[1].rsplit(";", 1)[0])
        self.assertEqual(len(updates["studies"]), 7)
        self.assertEqual(len(updates["edu"]), 5)
        self.assertEqual(len({s["url"] for s in updates["studies"]}), 7)
        self.assertEqual(len({t["name"] for t in updates["edu"]}), 5)
        self.assertTrue(all(s["summary"] and s["type"] for s in updates["studies"]))
        research_page = (ROOT / "onderzoek" / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="../updates.js"', research_page)
        self.assertIn("aria-pressed", research_page)
        self.assertIn("research-filter", research_page)

if __name__ == "__main__":
    unittest.main()
