from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class EAIspeakPublishTests(unittest.TestCase):
    def test_single_source_and_legacy_redirect(self):
        self.assertTrue((ROOT/"tools/eaispeak/index.html").is_file())
        self.assertFalse((ROOT/"tools/delf-live/index.html").exists())
        builder=(ROOT/"scripts/build_site.py").read_text()
        self.assertIn('("tools", "eaispeak"), ("tools", "delf-live")',builder)
        build=(ROOT/".github/workflows/eaispeak.yml").read_text()
        self.assertIn("url=/tools/eaispeak/",build)
        general=(ROOT/".github/workflows/deploy-theory7.yml").read_text()
        self.assertIn("--exclude-glob 'tools/eaispeak/**'",general)
        self.assertIn("--exclude-glob 'tools/delf-live/**'",general)
        self.assertFalse((ROOT/".github/workflows/deploy-delf-preview.yml").exists())
    def test_publish_consumes_verified_artifact_without_rebuilding(self):
        workflow=(ROOT/".github/workflows/deploy-eaispeak.yml").read_text()
        self.assertIn("workflow_dispatch:",workflow)
        self.assertIn("actions/download-artifact@v4",workflow)
        self.assertIn("sha256sum -c SHA256SUMS",workflow)
        self.assertIn("run['conclusion']=='success'",workflow)
        self.assertNotIn("npm install",workflow)
        self.assertNotIn("npm run build",workflow)
        self.assertNotIn("  push:",workflow.split("permissions:")[0])
