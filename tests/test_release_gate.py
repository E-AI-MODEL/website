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
