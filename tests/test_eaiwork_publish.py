"""Tests for the public, non-executing EAIwork dashboard demonstration."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class EAIworkPublishTests(unittest.TestCase):
    def test_product_demo_is_versioned_and_explicitly_synthetic(self):
        html = (ROOT / "content/eaiwork-dashboard/index.html").read_text(encoding="utf-8")
        self.assertIn('Source: E-AI-MODEL/EAIwork-/prototypes/dashboard/index.html', html)
        for part in ("Contracten en registratie", "Worker Builder", "Menselijke besluiten",
                     "Voorbeeldopdrachten", "Geen live uitvoering"):
            self.assertIn(part, html)
        self.assertNotIn('src="https://', html)
        self.assertNotIn("localStorage.setItem(", html)

    def test_generator_preserves_canonical_route_and_tool_link(self):
        source = (ROOT / "scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('write(out, "tools/eaiwork/index.html",', source)
        self.assertIn('href="/tools/eaiwork/"', source)
        self.assertIn('"/tools/eaiwork/"', source)

if __name__ == "__main__":
    unittest.main()
