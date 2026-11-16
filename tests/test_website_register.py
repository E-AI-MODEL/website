"""Regression tests for the website inventory and catalogue audit."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from check_website_register import (check, extract_physics, extract_math, extract_taal, extract_llmscan,
                                    extract_glossary, extract_wihtml, extract_abyss,
                                    extract_gravity, extract_sport_modes, extract_process_modes)


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
        self.assertEqual(30, len(extract_glossary(ROOT, "nl")))
        self.assertEqual(30, len(extract_glossary(ROOT, "en")))
        self.assertEqual(2, len(extract_wihtml(ROOT)))

    def test_more_embedded_catalogues_are_covered(self):
        self.assertEqual(6, len(extract_abyss(ROOT)))
        self.assertEqual(6, len(extract_gravity(ROOT)))
        self.assertEqual(4, len(extract_sport_modes(ROOT)))
        self.assertEqual(2, len(extract_process_modes(ROOT)))

    def test_missing_ocean_item_is_rejected(self):
        altered = copy.deepcopy(self.register)
        altered["embedded_items"] = [
            item for item in altered["embedded_items"] if item["id"] != "abyss:0"
        ]
        problems = check(ROOT, altered, self.taxonomy)
        self.assertTrue(any("Oceaan: onderdelen wijken af" in p for p in problems))

    def test_missing_sport_mode_is_rejected(self):
        altered = copy.deepcopy(self.register)
        altered["embedded_items"] = [
            item for item in altered["embedded_items"] if item["id"] != "sport-mode:online"
        ]
        problems = check(ROOT, altered, self.taxonomy)
        self.assertTrue(any("Sportkeuzes: onderdelen wijken af" in p for p in problems))

    def test_melkweg_two_versions_same_topics(self):
        melkweg = [
            item for item in self.register["embedded_items"]
            if item.get("topic_id", "").startswith("melkweg:")
        ]
        self.assertEqual(12, len(melkweg))
        self.assertEqual(6, len({x["topic_id"] for x in melkweg}))
        self.assertEqual(2, len(self.register["collections"][0]["variants"]))

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

    def test_missing_collection_member_is_rejected(self):
        altered = copy.deepcopy(self.register)
        altered["collections"][0]["members"].append("page:/geen-bestaande-pagina/")
        problems = check(ROOT, altered, self.taxonomy)
        self.assertTrue(any("Verzameling verwijst naar ontbrekende pagina" in p for p in problems))

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
