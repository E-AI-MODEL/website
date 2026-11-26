import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ci_pr_scope import SUITES, affected_suites, job_selection, select_validated_main

class CiPrScopeTests(unittest.TestCase):
    def test_eaispeak_changes_do_not_run_other_apps(self):
        self.assertEqual(affected_suites(["tools/delf-live/index.html", "tools/eaispeak/index.html", ".github/workflows/eaispeak.yml", "tests/test_eaispeak_visibility.py"]), {"eaispeak"})

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
        source = build.split("      - name: Check local-only ICT scan publishing\n", 1)[1].split("      - name:", 1)[0]
        output = build.split("      - name: Controleer verborgen lokale ICT-scan\n", 1)[1].split("      - name:", 1)[0]
        self.assertNotIn("if:", source)
        self.assertNotIn("if:", output)
        self.assertIn("test_ict_scan_publish.py", source)
        self.assertEqual(build.count("test_ict_scan_publish.py"), 1)
        self.assertIn("test ! -e site-build/tools/ict-scan/bronnen", output)
        self.assertIn("test -s site-build/tools/ict-scan/index.html", output)
        self.assertIn("test_ict_scan_github_sync.mjs", output)
        self.assertEqual(build.count("test_ict_scan_github_sync.mjs"), 1)
        self.assertIn("site-build/sitemap.xml", output)
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

    def test_specific_workflow_changes_do_not_select_archive(self):
        cases = [
            (["scripts/test_leeuw_console.mjs", ".github/workflows/leeuw-console.yml"], {"stellar"}),
            ([".github/workflows/verify-live-cloudflare.yml", "scripts/verify_live_cloudflare.py",
              "tests/test_live_cloudflare.py"], set()),
            ([".github/workflows/anatomie-webkit.yml"], {"anatomy", "heart"}),
            ([".github/workflows/ict-scan-webkit.yml"], {"ictscan"}),
            ([".github/workflows/topo-mobile-verify.yml"], {"topo"}),
            (["docs/ci-audit/notes.md"], set()),
        ]
        for paths, expected in cases:
            with self.subTest(paths=paths):
                selected = affected_suites(paths)
                self.assertEqual(selected, expected)
                self.assertFalse(job_selection(selected)["audit-archive"])

    def test_shared_gate_and_unknown_paths_still_require_every_suite(self):
        for path in (".github/workflows/site-check.yml", ".github/workflows/validate-main.yml",
                     ".github/workflows/daily-full.yml", "scripts/ci_pr_scope.py",
                     "scripts/ci_suites.json", "scripts/check_release_gate.py",
                     ".github/actions/checked-build/action.yml", "scripts/build_site.py"):
            with self.subTest(path=path):
                self.assertEqual(affected_suites([path]), set(SUITES))

    def test_cloudflare_path_exceptions_have_their_own_checks(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/verify-live-cloudflare.yml").read_text()
        central = (root / ".github/workflows/site-check.yml").read_text()
        self.assertIn("pull_request:", workflow)
        for path in (".github/workflows/verify-live-cloudflare.yml",
                     "scripts/verify_live_cloudflare.py", "tests/test_live_cloudflare.py"):
            self.assertIn(path, workflow)
        self.assertIn("run: python3 scripts/verify_live_cloudflare.py", workflow)
        self.assertIn("test_live_cloudflare.py", central)
        self.assertNotIn("continue-on-error", workflow)


class TrustedMainScopeTests(unittest.TestCase):
    repo = "E-AI-MODEL/website"
    repo_id = 21
    head = "a" * 40
    main_base = "b" * 40
    previous = "c" * 40

    def run_record(self, **changes):
        identity = {"id": self.repo_id, "full_name": self.repo}
        return dict(id=17, run_attempt=2, head_sha=self.previous,
                    path=".github/workflows/validate-main.yml", event="push",
                    head_branch="main", status="completed", conclusion="success",
                    repository=identity, head_repository=identity) | changes

    def gate(self, run, **changes):
        return dict(name="validation / static-checks", run_id=run["id"],
                    run_attempt=run["run_attempt"], head_sha=run["head_sha"],
                    status="completed", conclusion="success",
                    steps=[dict(name="Controleer alle verplichte resultaten",
                                status="completed", conclusion="success")]) | changes

    def ancestor(self, old, new):
        return old == new or (old, new) in (
            (self.main_base, self.head), (self.previous, self.main_base),
            (self.previous, self.head))

    def select(self, runs=None, jobs=None, refresh=None, ancestor=None, **kwargs):
        run = self.run_record()
        options = dict(repo=self.repo, repo_id=self.repo_id, current_run_id=99,
                       head=self.head, main_base=self.main_base,
                       jobs_for_run=lambda r: [self.gate(r)] if jobs is None else jobs,
                       refresh_run=refresh or (lambda run_id: run),
                       ancestor=ancestor or self.ancestor)
        options.update(kwargs)
        return select_validated_main([run] if runs is None else runs, **options)

    def test_trusted_main_can_precede_publication(self):
        run = self.run_record()
        self.assertEqual(self.select(), run)
        self.assertEqual(self.select(main_base=self.head), run)

    def test_reject_pr_other_repository_untrusted_workflow_and_current_run(self):
        for changes in (
            {"event": "pull_request"}, {"head_branch": "feature"},
            {"path": ".github/workflows/site-check.yml"},
            {"path": ".github/workflows/validate-main.yml@feature"},
            {"head_repository": {"id": 999, "full_name": self.repo}},
            {"repository": {"id": self.repo_id, "full_name": "other/site"}},
            {"conclusion": "failure"}, {"status": "in_progress"},
            {"id": 99}, {"head_sha": self.head}, {"head_sha": "invalid"},
            {"run_attempt": 0}, {"head_sha": "d" * 40},
        ):
            with self.subTest(changes=changes):
                self.assertIsNone(self.select(runs=[self.run_record(**changes)]))

    def test_only_ancestors_of_actual_main_base_are_trusted(self):
        pr_commit = "d" * 40
        run = self.run_record(head_sha=pr_commit)
        self.assertIsNone(self.select(runs=[run], ancestor=lambda old, new:
            self.ancestor(old, new) or (old, new) == (pr_commit, self.head)))

    def test_missing_failed_duplicate_or_mismatched_gate_rejects_baseline(self):
        run = self.run_record()
        good = self.gate(run)
        for jobs in ([], [good, good], [self.gate(run, conclusion="failure")],
                     [self.gate(run, head_sha=self.head)],
                     [self.gate(run, run_attempt=1)], [self.gate(run, run_id=18)],
                     [self.gate(run, steps=[])],
                     [self.gate(run, steps=[dict(name="Controleer alle verplichte resultaten",
                                                status="completed", conclusion="skipped")])]):
            with self.subTest(jobs=jobs):
                self.assertIsNone(self.select(jobs=jobs))

    def test_recheck_rejects_changed_run(self):
        self.assertIsNone(self.select(refresh=lambda run_id: self.run_record(run_attempt=3)))
        self.assertIsNone(self.select(refresh=lambda run_id: self.run_record(status="in_progress")))

    def test_earlier_validated_ancestor_covers_unvalidated_main_changes(self):
        latest = self.run_record(id=18, head_sha=self.main_base, conclusion="failure")
        self.assertEqual(self.select(runs=[latest, self.run_record()]), self.run_record())

if __name__ == "__main__":
    unittest.main()
