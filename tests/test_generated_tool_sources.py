"""Check the exact release artifact before it is signed and reused."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class GeneratedToolSources(unittest.TestCase):
    def test_all_twenty_canonical_sources_are_published_byte_for_byte(self):
        entries = json.loads((ROOT / "catalog/generated-tool-sources.json").read_text())["generated"]
        self.assertEqual(len(entries), 20)
        self.assertEqual(len({p["output"] for p in entries}), len(entries))
        self.assertNotIn("tools/science-observatory/labs/schuine-worp/index.html",
                         {p["output"] for p in entries})
        for item in entries:
            with self.subTest(path=item["output"]):
                source = ROOT / item["source"]
                copy = ROOT / item["output"]
                output = ROOT / "site-build" / item["output"]
                self.assertTrue(item["source"].startswith("content/"))
                self.assertTrue(item["output"].startswith("tools/"))
                self.assertTrue(source.is_file() and source.stat().st_size > 0, "Missing canonical source")
                self.assertFalse(copy.exists(), "Generated copy has returned to the repository")
                self.assertTrue(output.is_file(), "Missing public output")
                self.assertEqual(output.read_bytes(), source.read_bytes(),
                                 "Generated public file differs from its canonical source")

if __name__ == "__main__":
    unittest.main()
