from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
WORKFLOWS=ROOT/".github/workflows"

class EAIspeakPublishTests(unittest.TestCase):
    def test_single_source_and_legacy_redirect(self):
        self.assertTrue((ROOT/"tools/eaispeak/index.html").is_file())
        self.assertFalse((ROOT/"tools/delf-live/index.html").exists())
        self.assertIn('redirect("/tools/eaispeak/")',(ROOT/"scripts/build_site.py").read_text())
        self.assertFalse((WORKFLOWS/"deploy-delf-preview.yml").exists())

    def test_publish_consumes_verified_artifact_without_rebuilding(self):
        ui=(WORKFLOWS/"verify-ui.yml").read_text()
        deploy=(WORKFLOWS/"deploy-theory7.yml").read_text()
        self.assertIn("name: eaispeak-tested-build",ui)
        self.assertIn('test "$(cat "$bundle/build-sha.txt")" = "$GITHUB_SHA"',ui)
        self.assertIn('sha256sum -c "$bundle/SHA256SUMS"',ui)
        self.assertLess(ui.index("Voeg EAIspeak exact"),ui.index("scripts/release_artifact.py create"))
        self.assertIn("scripts/release_artifact.py verify",deploy)
        self.assertIn("scripts/verify_eaispeak_live.py",deploy)
        self.assertIn("site-build/tools/eaispeak/ /tools/eaispeak/",deploy)
        self.assertNotIn("npm install",deploy)
        self.assertNotIn("npm run build",deploy)

    def test_required_gate_preserves_eaispeak_validation(self):
        gate=(WORKFLOWS/"site-check.yml").read_text()
        self.assertIn("eaispeak-check:",gate)
        self.assertIn("uses: ./.github/workflows/eaispeak.yml",gate)
        self.assertIn("eaigit-check, eaispeak-check]",gate)
