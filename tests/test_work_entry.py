"""The EAIwork entry is public information, never a fake login or backend."""
import unittest
from pathlib import Path

class WorkEntryTest(unittest.TestCase):
    def test_public_entry_has_no_fake_execution(self):
        page = Path("work/index.html").read_text(encoding="utf-8")
        self.assertIn('href="/tools/eaiwork/"', page)
        self.assertIn('name="robots" content="noindex,nofollow"', page)
        self.assertIn("afzonderlijk beveiligde server", page)
        self.assertNotIn("<form", page.lower())
        self.assertNotIn("localStorage", page)
        self.assertNotIn("api.eaimodel.nl", page)
    def test_build_copies_entry(self):
        source = Path("scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('write(out, "work/index.html"', source)
        self.assertIn('work_entry = repo_root / "work" / "index.html"', source)

if __name__ == "__main__":
    unittest.main()
