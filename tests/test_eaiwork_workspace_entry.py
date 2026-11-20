"""EAIwork public entry must remain informational, not a fake login."""
import unittest
from pathlib import Path

class EAIworkWorkspaceEntryTest(unittest.TestCase):
    def test_entry_is_public_information_only(self):
        page = Path("work/index.html").read_text(encoding="utf-8")
        self.assertIn('name="robots" content="noindex,nofollow"', page)
        self.assertIn('href="/tools/eaiwork/"', page)
        self.assertIn("afzonderlijk beveiligde server", page)
        self.assertNotIn("localStorage", page)
        self.assertNotIn("Authorization: Bearer", page)
        self.assertNotIn("<form", page)

    def test_generator_includes_entry(self):
        generator = Path("scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('write(out, "work/index.html"', generator)

if __name__ == "__main__":
    unittest.main()
