"""Regressions for site publishing ownership and production upload serialization."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

SHARED_THEORY7_UPLOADS = (
    "deploy-theory7.yml",
    "deploy-delf-preview.yml",
    "deploy-zhang-review-rapid.yml",
    "deploy-analytics-dashboard.yml",
    "deploy-eaiwork-theory7.yml",
    "deploy-leif-quick.yml",
    "deploy-lo-quick.yml",
    "deploy-sport-opstellingen-quick.yml",
    "deploy-vakinhoud-quick.yml",
)

class PublicationOwnershipTests(unittest.TestCase):
    def test_shared_site_uploads_have_one_uncancelled_queue(self):
        for workflow in SHARED_THEORY7_UPLOADS:
            with self.subTest(workflow=workflow):
                source = (WORKFLOWS / workflow).read_text(encoding="utf-8")
                self.assertRegex(
                    source,
                    r"(?m)^concurrency:\s*\n\s+group:\s*theory7-production\s*\n\s+cancel-in-progress:\s*false",
                )

    def test_topo_keeps_its_independent_queue(self):
        source = (WORKFLOWS / "deploy-topo-theory7.yml").read_text(encoding="utf-8")
        self.assertIn("group: topo-production", source)
        self.assertNotIn("group: theory7-production", source)
        general = (WORKFLOWS / "deploy-theory7.yml").read_text(encoding="utf-8")
        self.assertIn("- 'topo/**'", general)

    def test_public_data_keeps_its_own_publication(self):
        source = (WORKFLOWS / "publish-public-analytics.yml").read_text(encoding="utf-8")
        self.assertIn("group: eai-public-analytics", source)

if __name__ == "__main__":
    unittest.main()
