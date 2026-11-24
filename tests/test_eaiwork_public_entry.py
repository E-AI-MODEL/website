"""Public EAIwork entry is only an informational route, not a fake account."""
import json
import unittest
from pathlib import Path

class EAIworkPublicEntryTests(unittest.TestCase):
    def test_informational_without_browser_secrets(self):
        html = Path("work/index.html").read_text(encoding="utf-8")
        self.assertIn('href="/tools/eaiwork/"', html)
        self.assertIn('name="robots" content="noindex,nofollow"', html)
        self.assertIn("afzonderlijk beveiligde server", html)
        self.assertNotIn("<form", html.lower())
        self.assertNotIn("localStorage", html)
        self.assertNotIn("Authorization: Bearer", html)
        self.assertNotIn("api.eaimodel.nl", html)

    def test_build_includes_route_and_inventory(self):
        src = Path("scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('write(out, "work/index.html"', src)
        register = json.loads(Path("catalog/website-register.json").read_text(encoding="utf-8"))
        pages = [p for p in register["pages"] if p["url"] == "/work/"]
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["file"], "work/index.html")
        self.assertFalse(pages[0]["in_committed_sitemap"])
        self.assertEqual(pages[0]["search_scope"], "niet_indexeren")

if __name__ == "__main__":
    unittest.main()
