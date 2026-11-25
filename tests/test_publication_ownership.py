"""Regressions for site publishing ownership and production upload serialization."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

SHARED_THEORY7_UPLOADS = (
    "deploy-theory7.yml",
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
                    r"(?m)^\s*concurrency:\s*\n\s+group:\s*theory7-production\s*\n\s+cancel-in-progress:\s*false",
                )

    def test_build_job_never_pushes_generated_pages_to_main(self):
        source = (WORKFLOWS / "build-site.yml").read_text(encoding="utf-8")
        self.assertNotIn("git push origin HEAD:main", source)
        self.assertNotIn("rm -rf assets publicaties tools", source)
        self.assertIn("contents: read", source)
        deploy = (WORKFLOWS / "deploy-theory7.yml").read_text(encoding="utf-8")
        validate = (WORKFLOWS / "validate-main.yml").read_text()
        self.assertIn("uses: ./.github/workflows/site-check.yml", validate)
        self.assertIn("scripts/release_candidate.py", deploy)
        self.assertNotIn("uses: ./.github/workflows/site-check.yml", deploy)
        self.assertNotIn("python scripts/build_site.py", deploy)
        ui = (WORKFLOWS / "build-site.yml").read_text(encoding="utf-8")
        self.assertIn("scripts/release_artifact.py create", ui)
        self.assertIn("include-hidden-files: true", ui)
        self.assertIn("mirror -R", deploy)

    def test_anatomy_is_checked_before_preparation_and_manifest_on_every_run(self):
        build = (WORKFLOWS / "build-site.yml").read_text()
        ui = (WORKFLOWS / "verify-ui.yml").read_text()
        self.assertLess(build.index("python scripts/build_anatomie.py"), build.index("test_anatomie_publish.py"))
        self.assertLess(build.index("test_anatomie_publish.py"), build.index("python scripts/prepare_ui.py"))
        self.assertLess(build.index("python scripts/prepare_ui.py"), build.index("scripts/release_artifact.py create"))
        self.assertIn("scripts/release_artifact.py verify", ui)
        self.assertIn("uses: ./.github/actions/checked-build", ui)
        self.assertNotIn("scripts/build_site.py", ui)

    def test_manual_recovery_publishers_do_not_compete_automatically(self):
        for workflow in (
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
        self.assertIn("--exclude-glob topo/", general)

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

    def test_main_validation_is_automatic_and_publication_requires_the_owner(self):
        source = (WORKFLOWS / "deploy-theory7.yml").read_text(encoding="utf-8")
        events = source.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertNotIn("  push:", events)
        self.assertIn("github.actor == github.repository_owner", source)
        self.assertIn("github.triggering_actor == github.repository_owner", source)
        self.assertIn("  push:", (WORKFLOWS / "validate-main.yml").read_text())

    def test_release_gate_and_topo_browser_cannot_be_bypassed(self):
        gate = (WORKFLOWS / "site-check.yml").read_text(encoding="utf-8")
        self.assertIn("  static-checks:", gate)
        self.assertIn("name: static-checks", gate)
        self.assertIn("always()", gate)
        self.assertIn("scripts/check_release_gate.py", gate)
        topo = (WORKFLOWS / "deploy-topo-theory7.yml").read_text(encoding="utf-8")
        self.assertIn("scripts/release_candidate.py", topo)
        self.assertIn("uses: ./.github/workflows/topo-mobile-verify.yml", gate)
        self.assertFalse((WORKFLOWS / "deploy-delf-preview.yml").exists())
        self.assertIn("eaispeak-check", gate)
        self.assertIn("eaispeak_artifact", gate)

    def test_public_data_keeps_its_own_publication(self):
        source = (WORKFLOWS / "publish-public-analytics.yml").read_text(encoding="utf-8")
        self.assertIn("group: eai-public-analytics", source)

if __name__ == "__main__":
    unittest.main()
