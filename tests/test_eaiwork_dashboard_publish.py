"""Public EAIwork dashboard must stay a clearly labelled browser demonstration."""
import unittest
from pathlib import Path

class EAIworkPublicDashboardTest(unittest.TestCase):
    def test_source_exists_and_explains_local_backend(self):
        source = Path("content/eaiwork-dashboard.html").read_text(encoding="utf-8")
        self.assertIn("EAIwork | Dashboard productdemonstratie", source)
        self.assertIn("ops-connect", source)
        self.assertIn("registratie:registration", source)
        self.assertIn(".app{display:block;min-height:100vh;min-height:100dvh}", source)
        self.assertIn("eigen lokale EAIwork-server", source)
        self.assertNotIn("ghp_", source)

    def test_generator_exposes_route(self):
        generator = Path("scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('write(out, "tools/eaiwork/index.html"', generator)
        self.assertIn('href="/tools/eaiwork/"', generator)

if __name__ == "__main__":
    unittest.main()
