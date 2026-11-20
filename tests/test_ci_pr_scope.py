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

    def test_eaigit_pr_339_does_not_run_anatomy_or_other_tools(self):
        changed = [
            ".github/workflows/projecthulp-browser.yml",
            "assets/eaigit/github-checks.mjs",
            "assets/eaigit/wizard.css",
            "assets/eaigit/wizard.mjs",
            "tests/test_eaigit_github_checks.mjs",
            "tools/eaigit/index.html",
        ]
        self.assertEqual(affected_suites(changed), {"eaigit"})

    def test_ict_scan_changes_run_own_suite(self):
        self.assertEqual(affected_suites(["tools/ict-scan/app.js", "tests/test_ict_scan_export.mjs"]), {"ictscan"})

    def test_delf_publication_workflow_only_runs_publishing_suite(self):
        self.assertEqual(affected_suites([".github/workflows/deploy-delf-preview.yml"]), {"publishing"})

    def test_main_runs_full_test_selection(self):
        self.assertEqual(affected_suites([]), set(SUITES))

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
        self.assertEqual(affected_suites(["topo/instellingen/index.html", "docs/notes.md"]), set())

    def test_project_workflows_keep_their_own_tests(self):
        root = Path(__file__).resolve().parents[1] / ".github" / "workflows"
        site = (root / "site-check.yml").read_text(encoding="utf-8")
        build = (root / "build-site.yml").read_text(encoding="utf-8")
        ui = (root / "verify-ui.yml").read_text(encoding="utf-8")
        self.assertIn("if: ${{ steps.scope.outputs.eaigit == 'true' }}", site)
        self.assertIn("if: ${{ steps.scope.outputs.publishing == 'true' }}", site)
        self.assertIn("if: ${{ steps.scope.outputs.physics == 'true' }}", site)
        self.assertIn("if: ${{ steps.scope.outputs.leif == 'true' }}", site)
        self.assertGreaterEqual(build.count("if: ${{ steps.scope.outputs.ictscan == 'true' }}"), 4)
        self.assertIn("if: ${{ steps.scope.outputs.ictscan == 'true' }}", ui)
        for workflow in (site, build, ui):
            self.assertIn("python3 scripts/ci_pr_scope.py --all", workflow)

    def test_delf_manual_publish_shares_theory7_queue(self):
        workflow = (Path(__file__).resolve().parents[1] / ".github" / "workflows" / "deploy-delf-preview.yml").read_text(encoding="utf-8")
        self.assertIn("  workflow_dispatch:", workflow)
        self.assertNotIn("  push:", workflow.split("on:", 1)[1].split("permissions:", 1)[0])
        self.assertIn("group: theory7-production", workflow)

    def test_reject_path_escape(self):
        self.assertEqual(affected_suites(["../tools/anatomie/index.html"]), set(SUITES))

if __name__ == "__main__":
    unittest.main()
