import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ci_pr_scope import SUITES, affected_suites

class CiPrScopeTests(unittest.TestCase):
    def test_new_delf_page_does_not_run_other_apps(self):
        self.assertEqual(affected_suites(["tools/delf-live/index.html"]), set())

    def test_eaigit_changes_run_eaigit(self):
        self.assertEqual(affected_suites(["tools/eaigit/index.html", "assets/eaigit/wizard.mjs"]), {"eaigit"})

    def test_own_science_changes_run_physics(self):
        self.assertEqual(affected_suites(["content/science-observatory/labs/natuurkunde.html"]), {"physics"})

    def test_anatomy_change_runs_anatomy(self):
        self.assertEqual(affected_suites(["scripts/build_anatomie.py"]), {"anatomy", "heart"})

    def test_combined_changes_union(self):
        self.assertEqual(affected_suites(["leif/index.html", "tools/eaigame/index.html"]), {"leif", "eaigame"})

    def test_shared_styles_fail_open_to_all(self):
        self.assertEqual(affected_suites(["assets/site-refresh.js"]), set(SUITES))

    def test_ci_definition_fail_open_to_all(self):
        self.assertEqual(affected_suites([".github/workflows/verify-ui.yml"]), set(SUITES))

    def test_unknown_test_file_fail_open_to_all(self):
        self.assertEqual(affected_suites(["tests/test_unlisted_feature.py"]), set(SUITES))

    def test_no_diff_fail_open_to_all(self):
        self.assertEqual(affected_suites([]), set(SUITES))

    def test_topo_and_docs_are_independent(self):
        self.assertEqual(affected_suites(["topo/instellingen/index.html", "docs/notes.md"]), {"topo"})

    def test_ict_and_eaigit_are_independent(self):
        self.assertEqual(affected_suites(["tools/ict-scan/app.js", "tests/test_ict_scan_export.mjs"]), {"ictscan"})
        self.assertEqual(affected_suites(["assets/eaigit/wizard.mjs", "tests/test_eaigit_github_checks.mjs"]), {"eaigit"})
        self.assertEqual(affected_suites(["tools/ict-scan/app.js", "scripts/test_topo_mobile.mjs"]), {"ictscan", "topo"})

    def test_eaigit_workflow_runs_own_browser_suite(self):
        self.assertEqual(affected_suites([
            ".github/workflows/projecthulp-browser.yml",
            "assets/eaigit/github-checks.mjs",
            "tests/test_eaigit_github_checks.mjs",
            "tools/eaigit/index.html",
        ]), {"eaigit"})

    def test_ict_build_checks_keep_publication_protection_unconditional(self):
        root = Path(__file__).resolve().parents[1]
        build = (root / ".github/workflows/build-site.yml").read_text(encoding="utf-8")
        for name in ("Check local-only ICT scan publishing", "Controleer verborgen lokale ICT-scan"):
            step = build.split("      - name: " + name + "\n", 1)[1].split("      - name:", 1)[0]
            self.assertNotIn("if:", step)
            self.assertIn("test_ict_scan_publish.py", step)
        for name in ("Test ICT scan Excel reports and AI categorization", "Controleer de brondata en JSON-import van Applicatielandschap 2026"):
            step = build.split("      - name: " + name + "\n", 1)[1].split("      - name:", 1)[0]
            self.assertIn("steps.scope.outputs.ictscan == 'true'", step)

    def test_observatoria_en_gedeelde_bronnen(self):
        for slug, group in (("melkweg", "galactic"), ("leeuw", "stellar")):
            self.assertEqual(affected_suites([f"content/science-observatory/labs/{slug}.html"]), {group})
        self.assertEqual(affected_suites(["assets/site-ui.css"]), set(SUITES))
        self.assertEqual(affected_suites(["scripts/test_hartslaglab_cycle.mjs"]), {"heart"})

    def test_reject_path_escape(self):
        self.assertEqual(affected_suites(["../tools/anatomie/index.html"]), set(SUITES))

if __name__ == "__main__":
    unittest.main()
