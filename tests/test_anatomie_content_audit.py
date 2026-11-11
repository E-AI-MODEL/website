"""Regressies voor de anatomische gegevens, los van de 3D-renderer."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("anatomie_audit", ROOT / "scripts/audit_anatomie_content.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AnatomyContentAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows, cls.summary = MODULE.audit()

    def test_all_model_parts_and_unique_names_are_counted(self):
        self.assertEqual(self.summary["modelonderdelen"], 2827)
        self.assertEqual(self.summary["unieke_structuren"], 1643)
        self.assertEqual(set(self.summary["stelsels"]), {
            "skeletal", "joints", "muscular", "cardiovascular",
            "lymphatic", "nervous", "visceral",
        })

    def test_dutch_names_reference_real_model_keys(self):
        names = MODULE.load_sources(ROOT)[3]
        models = {row["structuur"].lower() for row in self.rows}
        for key in ("aortic arch", "left ventricle", "optic nerve (ii)",
                    "articular capsules of metatarsophalangeal joints"):
            self.assertIn(key, models)
            self.assertIn(key, names)
        self.assertGreaterEqual(self.summary["nederlandse_namen_uniek"], 200)

    def test_known_upstream_metadata_error_is_flagged_not_silently_rewritten(self):
        errors = [r for r in self.rows if "verkeerde_koppeling" in r["controle"]]
        self.assertTrue(errors, "Bekende verwisseling in bronlexicon moet zichtbaar blijven")
        self.assertTrue(all(r["structuur"] ==
            "Articular capsules of metatarsophalangeal joints" for r in errors))

    def test_narrative_and_questions_exist_for_checked_3d_parts(self):
        guide = (ROOT / "content/anatomie/guide.js").read_text(encoding="utf-8")
        detail = (ROOT / "content/anatomie/eaiDetail.js").read_text(encoding="utf-8")
        self.assertIn("Onderzoek in het 3D-model", detail)
        self.assertIn("guide.question", detail)
        self.assertIn("Waarom is de spierwand van de linkerkamer dikker", guide)
        self.assertGreaterEqual(self.summary["nederlandse_uitleg_uniek"], 35)


if __name__ == "__main__":
    unittest.main()
