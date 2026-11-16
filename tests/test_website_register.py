"""Regression tests for the website inventory and catalogue audit."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from check_website_register import check, extract_physics, extract_math, extract_taal, extract_llmscan


class WebsiteRegisterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.register = json.loads((ROOT / "catalog/website-register.json").read_text(encoding="utf-8"))
        cls.taxonomy = json.loads((ROOT / "catalog/taxonomie.json").read_text(encoding="utf-8"))

    def test_complete_register_matches_sources(self):
        self.assertEqual([], check(ROOT, self.register, self.taxonomy))

    def test_all_known_catalogues_have_expected_numbers(self):
        self.assertEqual(53, len(extract_physics(ROOT)))
        self.assertEqual(6, len(extract_math(ROOT, "a")))
        self.assertEqual(6, len(extract_math(ROOT, "b")))
        self.assertEqual(15, len(extract_taal(ROOT)))
        self.assertEqual(51, len(extract_llmscan(ROOT)))

    def test_missing_page_is_rejected(self):
        altered = copy.deepcopy(self.register)
        altered["pages"] = [p for p in altered["pages"] if p["url"] != "/tools/eaigame/"]
        problems = check(ROOT, altered, self.taxonomy)
        self.assertTrue(any("Pagina-inventaris wijkt af" in p for p in problems))

    def test_missing_embedded_item_is_rejected(self):
        altered = copy.deepcopy(self.register)
        altered["embedded_items"] = [
            p for p in altered["embedded_items"]
            if p["id"] != "anchor:/tools/science-observatory/labs/natuurkunde/#lever"
        ]
        problems = check(ROOT, altered, self.taxonomy)
        self.assertTrue(any("Natuurkunde: register en bron komen niet overeen" in p for p in problems))

    def test_duplicate_item_is_rejected(self):
        altered = copy.deepcopy(self.register)
        altered["embedded_items"].append(copy.deepcopy(altered["embedded_items"][0]))
        problems = check(ROOT, altered, self.taxonomy)
        self.assertTrue(any("Onderdeel: dubbele identificatie" in p for p in problems))

    def test_no_frontend_label_is_forced_by_taxonomy(self):
        self.assertFalse(self.register["rules"]["display_kind_by_default"])
        self.assertTrue(self.register["rules"]["technical_type_is_not_frontend_label"])
        self.assertTrue(self.register["rules"]["no_url_changes"])


if __name__ == "__main__":
    unittest.main()
