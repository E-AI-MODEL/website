"""Regressions for site publishing ownership and production upload serialization."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

SHARED_THEORY7_UPLOADS = (
    "deploy-theory7.yml",
    "deploy-eaispeak.yml",
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

    def test_build_job_never_pushes_generated_pages_to_main(self):
        source = (WORKFLOWS / "build-site.yml").read_text(encoding="utf-8")
        self.assertNotIn("git push origin HEAD:main", source)
        self.assertNotIn("rm -rf assets publicaties tools", source)
        self.assertIn("contents: read", source)
        deploy = (WORKFLOWS / "deploy-theory7.yml").read_text(encoding="utf-8")
        self.assertIn("python scripts/build_site.py", deploy)
        self.assertIn("mirror -R", deploy)

    def test_manual_recovery_publishers_do_not_compete_automatically(self):
        for workflow in (
            "deploy-eaispeak.yml",
            "deploy-zhang-review-rapid.yml",
            "deploy-analytics-dashboard.yml",
            "deploy-eaiwork-theory7.yml",
            "deploy-leif-quick.yml",
            "deploy-lo-quick.yml",
            "deploy-sport-opstellingen-quick.yml",
            "deploy-vakinhoud-quick.yml",
        ):
            with self.subTest(workflow=workflow):
                source = (WORKFLOWS / workflow).read_text(encoding="utf-8")
                self.assertIn("workflow_dispatch:", source)
                events = source.split("on:", 1)[1].split("permissions:", 1)[0]
                self.assertNotIn("  push:", events)

    def test_topo_keeps_its_independent_queue(self):
        source = (WORKFLOWS / "deploy-topo-theory7.yml").read_text(encoding="utf-8")
        self.assertIn("group: topo-production", source)
        self.assertNotIn("group: theory7-production", source)
        general = (WORKFLOWS / "deploy-theory7.yml").read_text(encoding="utf-8")
        self.assertIn("- 'topo/**'", general)

    def test_quick_recovery_uploads_are_manual_only(self):
        for workflow in (
            "deploy-analytics-dashboard.yml",
            "deploy-eaiwork-theory7.yml",
            "deploy-leif-quick.yml",
            "deploy-lo-quick.yml",
            "deploy-sport-opstellingen-quick.yml",
        ):
            with self.subTest(workflow=workflow):
                source = (WORKFLOWS / workflow).read_text(encoding="utf-8")
                events = source.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
                self.assertIn("  workflow_dispatch:", events)
                self.assertNotIn("  push:", events)

    def test_main_site_release_is_still_automatic(self):
        source = (WORKFLOWS / "deploy-theory7.yml").read_text(encoding="utf-8")
        events = source.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertIn("  push:", events)
        self.assertIn("branches: [main]", events)

    def test_public_data_keeps_its_own_publication(self):
        source = (WORKFLOWS / "publish-public-analytics.yml").read_text(encoding="utf-8")
        self.assertIn("group: eai-public-analytics", source)

if __name__ == "__main__":
    unittest.main()
