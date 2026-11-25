"""Protect generator-owned tool paths after removing committed output copies."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class GeneratedToolSources(unittest.TestCase):
    def test_canonical_sources_build_all_removed_public_paths(self):
        paths = json.loads((ROOT / "catalog/generated-tool-sources.json").read_text())["generated"]
        self.assertEqual(len(paths), len({p["output"] for p in paths}))
        self.assertGreaterEqual(len(paths), 21)
        for item in paths:
            with self.subTest(path=item["output"]):
                source = ROOT / item["source"]
                copy = ROOT / item["output"]
                output = ROOT / "site-build" / item["output"]
                self.assertTrue(item["source"].startswith("content/"))
                self.assertTrue(item["output"].startswith("tools/"))
                self.assertTrue(source.is_file() and source.stat().st_size > 0, "Missing canonical source")
                self.assertFalse(copy.exists(), "Generated copy has returned to the repository")
                self.assertTrue(output.is_file() and output.stat().st_size > 0, "Missing public output")
                if output.suffix != ".html":
                    self.assertEqual(output.read_bytes(), source.read_bytes(), "Generated static asset differs")


if __name__ == "__main__":
    unittest.main()
