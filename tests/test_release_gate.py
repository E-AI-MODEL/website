import json
import re
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_release_gate import ALWAYS, SCOPED, failures


from ci_pr_scope import REGISTRY, SUITES, job_selection


class ReleaseGateTests(unittest.TestCase):
    def result(self, flags=(), skip_topo=False):
        output = {flag: str(flag in flags).lower() for flag in set(SUITES)}
        needs = {job: {"result": "success"} for job in ALWAYS}
        needs["scope"]["outputs"] = {"selection": json.dumps(output), "jobs": json.dumps(job_selection(flags))}
        for job, required in job_selection(flags).items():
            selected = required and not (skip_topo and job == "topo-check")
            needs[job] = {"result": "success" if selected else "skipped"}
        return needs

    def test_all_selected(self):
        self.assertEqual(failures(self.result(set(SUITES))), [])

    def test_only_ict(self):
        self.assertEqual(failures(self.result({"ictscan"})), [])

    def test_production_topo_independent(self):
        self.assertEqual(failures(self.result(set(SUITES), True), True), [])

    def test_failure_cancel_skip_missing_all_block(self):
        for job in (*ALWAYS, *SCOPED):
            for result in ("failure", "cancelled", "skipped", None):
                with self.subTest(job=job, result=result):
                    needs = self.result(set(SUITES))
                    if result is None:
                        del needs[job]
                    else:
                        needs[job]["result"] = result
                    self.assertTrue(failures(needs))

    def test_missing_scope_blocks(self):
        needs = self.result()
        del needs["scope"]["outputs"]["selection"]
        self.assertTrue(failures(needs))

    def test_unselected_unexpected_failure_blocks(self):
        needs = self.result()
        needs["topo-check"]["result"] = "failure"
        self.assertTrue(failures(needs))

    def test_unregistered_job_blocks(self):
        needs = self.result()
        needs["unknown-job"] = {"result": "success"}
        self.assertTrue(failures(needs))

    def test_gate_needs_exactly_match_registry(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/site-check.yml").read_text()
        gate = workflow.split("  static-checks:", 1)[1]
        match = re.search(r"(?m)^    needs: \[([^\n]+)\]$", gate)
        self.assertIsNotNone(match)
        jobs = [name.strip() for name in match.group(1).split(",")]
        self.assertEqual(len(jobs), len(set(jobs)))
        self.assertEqual(set(jobs), set(ALWAYS) | set(SCOPED))
        self.assertFalse(set(ALWAYS) & set(SCOPED))

    def test_consolidated_browser_jobs_keep_exact_commands_and_scope(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/site-check.yml").read_text()
        fixed = (root / ".github/workflows/science-fixed-workspace.yml").read_text()
        llm = (root / ".github/workflows/llm-observatorium-ui.yml").read_text()
        build = (root / ".github/workflows/build-site.yml").read_text()
        self.assertIn("test_eaiwork_dashboard_publish.py", build)
        self.assertIn(["scripts/test_eaiwork_mobile.mjs", "site-build"], REGISTRY["chromium"]["eaiwork"])
        self.assertIn(["scripts/test_schuine_worp_studio.mjs", "site-build", "chromium"], REGISTRY["chromium"]["physics"])
        self.assertIn("node scripts/test_science_mobile_aim.mjs site-build webkit", fixed)
        self.assertIn("science-*.png", fixed)
        self.assertIn("science-fixed-workspace", REGISTRY["groups"]["physics"])
        self.assertIn("science-studio-webkit", REGISTRY["groups"]["physics"])
        self.assertIn(["scripts/test_llm_observatorium.mjs", "site-build"], REGISTRY["chromium"]["llm"])
        self.assertIn("node scripts/test_llm_mobile_webkit.mjs site-build", llm)
        self.assertIn("test_llm_learning_math.mjs", llm)
        self.assertIn("test_llm_real_trace.py", llm)
        self.assertIn("skip_duplicate_chromium: true", workflow)
        for job in ("check-eaiwork-dashboard", "science-webkit", "schuine-worp-studio"):
            self.assertNotIn(job, SCOPED)
            self.assertNotIn(f"  {job}:\n", workflow)
            standalone = root / ".github/workflows" / (job + ".yml")
            self.assertIn("workflow_dispatch:", standalone.read_text())

    def test_heavy_browser_jobs_use_the_pinned_runtime_and_keep_evidence(self):
        root = Path(__file__).resolve().parents[1]
        cases = {
            "anatomie-webkit": ("test_anatomie_webkit.mjs", "test_hartslaglab_browser.mjs",
                                "audit_anatomie_content.py", "anatomie-*.png", "hartslaglab-*.png"),
            "audit-archive": ("audit_archive.py", "audit_archive_session_test.mjs",
                              "audit_archive_ui.mjs", "audit_archive_functional.mjs", "audit-results/"),
            "check-own-exports": ("check_own_exports.mjs", "check_own_verifier.mjs", "own-export-results/"),
            "llm-observatorium-ui": ("test_llm_learning_math.mjs", "test_llm_real_trace.py",
                                    "test_llm_observatorium.mjs", "test_llm_mobile_webkit.mjs", "llm-*.png"),
            "science-fixed-workspace": ("test_science_math_adaptive.mjs site-build chromium",
                                        "test_science_math_adaptive.mjs site-build webkit",
                                        "test_science_fixed_workspace.mjs site-build chromium",
                                        "test_science_fixed_workspace.mjs site-build webkit",
                                        "test_science_mobile_aim.mjs", "test_schuine_worp_studio.mjs",
                                        "science-*.png"),
            "science-studio-webkit": ("test_schuine_worp_studio.mjs site-build webkit", "worp-studio-*.png"),
        }
        for name, required in cases.items():
            with self.subTest(workflow=name):
                source = (root / ".github/workflows" / (name + ".yml")).read_text()
                self.assertIn("image: mcr.microsoft.com/playwright:v1.56.1-noble", source)
                self.assertIn("options: --shm-size=1g", source)
                self.assertEqual(source.count("uses: ./.github/actions/browser-runtime"), 1)
                self.assertIn("binding: node", source)
                self.assertIn("uses: ./.github/actions/checked-build", source)
                self.assertIn("workflow_dispatch:", source)
                self.assertIn("actions: read", source)
                self.assertIn("if: always()", source)
                self.assertIn("github.run_attempt", source)
                self.assertNotIn("playwright install", source)
                self.assertNotIn("~/.cache/ms-playwright", source)
                self.assertNotIn("continue-on-error", source)
                for item in required:
                    self.assertIn(item, source)

    def test_lo_consolidation_retains_every_independent_probe(self):
        root = Path(__file__).resolve().parents[1]
        combined = (root / ".github/workflows/lo-aanvalslab.yml").read_text()
        self.assertEqual(combined.count("uses: ./.github/actions/browser-runtime"), 1)
        self.assertIn("mcr.microsoft.com/playwright/python:v1.65.2-noble", combined)
        self.assertIn("binding: python", combined)
        runtime = (root / ".github/actions/browser-runtime/action.yml").read_text()
        self.assertIn("python -m pip install --disable-pip-version-check playwright==1.65.2", runtime)
        self.assertNotIn("playwright install --with-deps", combined)
        self.assertIn("fetch-depth: 0", combined)
        for command in (
            "python scripts/test_lo_calm_mobile.py",
            "test_lo_evidence_publish.py",
            "python scripts/test_lo_easteregg.py",
            "python scripts/test_lo_v13_simulations.py",
            "python scripts/test_lo_zone.py",
            "'zonecompact','zoneschuif','zonelijn'",
        ):
            self.assertEqual(combined.count(command), 1, command)
        self.assertGreaterEqual(combined.count("!cancelled()"), 6)
        self.assertNotIn("continue-on-error", combined)
        self.assertEqual(set(REGISTRY["groups"]["lo"]), {"lo-aanvalslab", "lo-tactics-source"})
        self.assertTrue(job_selection({"lo"})["lo-aanvalslab"])
        self.assertTrue(job_selection({"lo"})["lo-tactics-source"])
        self.assertIn("assert results['runs']==64", (root / "scripts/test_lo_v13_simulations.py").read_text())
        for name in ("lo-calm-mobile", "lo-easteregg-verify", "lo-v13-verify", "lo-zone-verify"):
            self.assertNotIn(name, SCOPED)
            self.assertIn("workflow_dispatch:", (root / ".github/workflows" / (name + ".yml")).read_text())

    def test_shared_source_tests_still_run_under_the_central_gate(self):
        root = Path(__file__).resolve().parents[1]
        gate = (root / ".github/workflows/site-check.yml").read_text()
        build = (root / ".github/workflows/build-site.yml").read_text()
        ui = (root / ".github/workflows/verify-ui.yml").read_text()
        self.assertIn("central_validation: true", gate)
        self.assertIn("source-checks", ALWAYS)
        self.assertIn("ui-check", ALWAYS)
        self.assertIn("test-html-gallery-auth", ALWAYS)
        for test in (
            "test_projecthulp.mjs", "test_eaigit_help.mjs", "test_eaigit_single_file.mjs",
            "test_science_physics_models.mjs", "test_science_physics_round3.mjs",
            "test_science_physics_insights.mjs", "test_science_physics_evidence.mjs",
            "test_science_physics_reference_48.mjs", "test_science_physics_visual_fidelity.mjs",
            "test_science_physical_graphs.mjs", "test_science_graph_animation_alignment.mjs",
            "test_science_inquiry_variants.mjs", "test_leif_kei.mjs", "test_leif_multitenant.mjs",
            "test_ci_pr_scope.py",
        ):
            self.assertIn(test, gate)
            self.assertIn(test, build)
        for test in ("test_dashboard_cards.py", "test_story_cards.py"):
            self.assertIn(test, ui)
        # These are different test objects before and after site preparation.
        for test in ("test_tool_launch.py", "test_llm_observatorium_source.py"):
            self.assertIn(test, build)
        self.assertIn("test_tool_launch.py", ui)
        self.assertIn("test_llm_observatorium_source.py", (root / ".github/workflows/llm-observatorium-ui.yml").read_text())
        for test in ("test_html_galerij_admin.mjs", "test_eai_site_admin.mjs", "test_html_gallery_sqlite.mjs"):
            self.assertIn(test, (root / ".github/workflows/test-html-gallery-auth.yml").read_text())
        self.assertIn("test_eaigame.mjs", (root / ".github/workflows/eaigame.yml").read_text())
