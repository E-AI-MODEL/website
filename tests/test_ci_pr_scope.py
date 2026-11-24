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
        self.assertEqual(affected_suites(["content/science-observatory/labs/natuurkunde.html"]), {"physics", "melkweg"})

    def test_anatomy_change_runs_anatomy(self):
        self.assertEqual(affected_suites(["scripts/build_anatomie.py"]), {"anatomy"})

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

    def test_reject_path_escape(self):
        self.assertEqual(affected_suites(["../tools/anatomie/index.html"]), set(SUITES))

if __name__ == "__main__":
    unittest.main()
