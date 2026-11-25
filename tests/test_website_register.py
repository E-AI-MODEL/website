"""Regression tests for the website inventory and catalogue audit."""
from __future__ import annotations

import copy
import json
import sys
import unittest
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from check_website_register import (check, generated_sources, extract_physics, extract_math, extract_taal, extract_llmscan,
                                    extract_glossary, extract_wihtml, extract_abyss,
                                    extract_gravity, extract_sport_modes, extract_process_modes,
                                    extract_game, extract_studio, extract_wihtml_slide_types,
                                    extract_eaiwork_views, extract_eaimesh_focus)


class WebsiteRegisterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.register = json.loads((ROOT / "catalog/website-register.json").read_text(encoding="utf-8"))
        cls.taxonomy = json.loads((ROOT / "catalog/taxonomie.json").read_text(encoding="utf-8"))

    def test_complete_register_matches_sources(self):
        self.assertEqual([], check(ROOT, self.register, self.taxonomy))

    def test_generated_sources_require_existing_canonical_files_and_no_git_copy(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "catalog").mkdir()
            (root / "content").mkdir()
            (root / "tools").mkdir()
            manifest = root / "catalog/generated-tool-sources.json"
            mapping = {"output": "tools/index.html", "source": "content/source.html"}
            manifest.write_text(json.dumps({"generated": [mapping]}))
            errors = []
            generated_sources(root, errors)
            self.assertTrue(any("bron ontbreekt" in error for error in errors))
            (root / mapping["source"]).write_text("source")
            errors = []
            self.assertEqual(generated_sources(root, errors), {mapping["output"]: mapping["source"]})
            self.assertEqual(errors, [])
            (root / mapping["output"]).write_text("duplicate")
            errors = []
            generated_sources(root, errors)
            self.assertTrue(any("uitvoerkopie" in error for error in errors))
            (root / mapping["output"]).unlink()
            manifest.write_text(json.dumps({"generated": [mapping, mapping]}))
            errors = []
            generated_sources(root, errors)
            self.assertTrue(any("dubbel uitvoerbestand" in error for error in errors))

    def test_generated_public_page_requires_the_mapped_source(self):
        changed = copy.deepcopy(self.register)
        page = next(p for p in changed["pages"] if p.get("generated_from"))
        page["generated_from"] = "content/not-the-source.html"
        self.assertTrue(any("gegenereerde bron wijkt af" in e for e in check(ROOT, changed, self.taxonomy)))

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

    def test_fixed_catalogues_inside_applications(self):
        areas, questions, levels = extract_game(ROOT)
        self.assertEqual(6, len(areas))
        self.assertEqual(300, questions)
        self.assertEqual(["vmbo", "havo", "vwo"], levels)
        self.assertEqual([40, 3, 8], [
            len(x) for x in extract_studio(ROOT).values()
        ])
        self.assertEqual(10, len(extract_wihtml_slide_types(ROOT)))
        self.assertEqual(15, len(extract_eaiwork_views(ROOT)))
        self.assertEqual(7, len(extract_eaimesh_focus(ROOT)))

    def test_removed_eaistudio_component_is_detected(self):
        changed = copy.deepcopy(self.register)
        changed["embedded_items"] = [
            i for i in changed["embedded_items"]
            if i["id"] != "eaistudio-component:terminal-stream"
        ]
        errors = check(ROOT, changed, self.taxonomy)
        self.assertTrue(any("EAIstudio: bibliotheek wijkt af" in e for e in errors))

    def test_wrong_game_question_count_is_detected(self):
        changed = copy.deepcopy(self.register)
        for page in changed["pages"]:
            if page["url"] == "/tools/eaigame/":
                page["question_bank"]["count"] = 299
        errors = check(ROOT, changed, self.taxonomy)
        self.assertTrue(any("EAIgame: vragenbank" in e for e in errors))

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

    def test_model_pages_are_in_sitemap(self):
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://eaimodel.nl/nl/model/", sitemap)
        self.assertIn("https://eaimodel.nl/en/model/", sitemap)
        for route in ("/nl/model/", "/en/model/"):
            page = next(p for p in self.register["pages"] if p["url"] == route)
            self.assertTrue(page["in_committed_sitemap"])

    def test_sitemap_registration_matches_file(self):
        problems = check(ROOT, self.register, self.taxonomy)
        self.assertFalse(any(p.startswith("Sitemap:") for p in problems))

    def test_sitemap_mismatch_is_detected(self):
        changed = copy.deepcopy(self.register)
        model = next(p for p in changed["pages"] if p["url"] == "/nl/model/")
        model["in_committed_sitemap"] = False
        problems = check(ROOT, changed, self.taxonomy)
        self.assertTrue(any("Sitemap: vermelding verschilt" in p for p in problems))

    def test_no_frontend_label_is_forced_by_taxonomy(self):
        self.assertFalse(self.register["rules"]["display_kind_by_default"])
        self.assertTrue(self.register["rules"]["technical_type_is_not_frontend_label"])
        self.assertTrue(self.register["rules"]["no_url_changes"])


if __name__ == "__main__":
    unittest.main()
