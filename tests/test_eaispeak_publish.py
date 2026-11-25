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
        build=(WORKFLOWS/"build-site.yml").read_text()
        ui=(WORKFLOWS/"verify-ui.yml").read_text()
        candidate=(ROOT/"scripts/release_candidate.py").read_text()
        deploy=(WORKFLOWS/"deploy-theory7.yml").read_text()
        self.assertIn("name: eaispeak-tested-build-",build)
        self.assertIn('test "$(cat "$bundle/build-sha.txt")" = "$GITHUB_SHA"',build)
        self.assertIn('sha256sum -c "$bundle/SHA256SUMS"',build)
        self.assertLess(build.index('sha256sum -c "$bundle/SHA256SUMS"'),build.index("scripts/release_artifact.py create"))
        self.assertIn("scripts/release_artifact.py verify",ui)
        self.assertIn("scripts/release_candidate.py",deploy)
        self.assertIn("validated_manifest",candidate)
        self.assertIn("scripts/verify_eaispeak_live.py",deploy)
        self.assertIn("site-build/tools/eaispeak/ /tools/eaispeak/",deploy)
        self.assertNotIn("npm install",deploy)
        self.assertNotIn("npm run build",deploy)

    def test_required_gate_preserves_eaispeak_validation(self):
        gate=(WORKFLOWS/"site-check.yml").read_text()
        self.assertIn("eaispeak-check:",gate)
        self.assertIn("uses: ./.github/workflows/eaispeak.yml",gate)
        self.assertIn("eaispeak-check",gate.split("  static-checks:",1)[1].split("if:",1)[0])

    def test_public_links_depend_on_tested_eaispeak_bundle(self):
        from sys import path
        path.insert(0,str(ROOT/"scripts"))
        from check_release_gate import ALWAYS
        self.assertIn("eaispeak-check",ALWAYS)
        gate=(WORKFLOWS/"site-check.yml").read_text()
        self.assertIn("  build-check:\n    needs: [scope, eaispeak-check]",gate)
        self.assertIn("  ui-check:\n    needs: [scope, build-check]",gate)
        self.assertIn("eaispeak_artifact: true",gate)
        build=(WORKFLOWS/"build-site.yml").read_text()
        self.assertLess(build.index("name: eaispeak-tested-build"),build.index("python scripts/build_site.py --sources"))
        self.assertIn('cp -a "$bundle/tools/eaispeak/." tools/eaispeak/dist/',build)
        self.assertLess(build.index("python scripts/prepare_ui.py"),build.index('cp -a "$bundle/tools/eaispeak/." site-build/tools/eaispeak/'))
        ui=(WORKFLOWS/"verify-ui.yml").read_text()
        self.assertIn("uses: ./.github/actions/checked-build",ui)
        self.assertNotIn("scripts/build_site.py",ui)
