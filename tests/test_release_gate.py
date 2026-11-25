import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_release_gate import ALWAYS, SCOPED, failures


from ci_pr_scope import SUITES, job_selection


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
