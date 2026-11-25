"""Release scenarios without production credentials or network writes."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from check_astronomy_baseline import BASELINE, check
from ci_pr_scope import SUITES, affected_suites, job_selection
from release_candidate import authorize, same_tree, validate_run, validated_manifest
from release_artifact import record


class Scenarios(unittest.TestCase):
    def test_url_anatomy_both_observatories_shared_js_and_combination(self):
        cases = [
            ("tools/eaigit/index.html", {"eaigit"}),
            ("tests/test_anatomie_picking.mjs", {"anatomy"}),
            ("content/science-observatory/labs/melkweg.html", {"galactic"}),
            ("content/science-observatory/labs/leeuw.html", {"stellar"}),
            ("assets/site-refresh.js", set(SUITES)),
        ]
        for path, selected in cases:
            with self.subTest(path=path):
                self.assertEqual(affected_suites([path]), selected)
        self.assertEqual(affected_suites([cases[0][0], cases[3][0]]), {"eaigit", "stellar"})
        for group in ("stellar", "galactic"):
            self.assertTrue(job_selection({group})["astronomy-validation"])

    def test_regression_blocks(self):
        b = json.loads(BASELINE.read_text())
        report = dict(copy.deepcopy(b), numerical_status="pass", failures=[],
                      observations=[{"id": k, "eai": v.copy()} for k, v in b["observations"].items()])
        check(report, b)
        report["observations"][0]["eai"]["rmse_kms"] += .01
        with self.assertRaises(ValueError):
            check(report, b)

    def test_missing_modified_and_wrong_origin(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            file = root / "index.html"
            file.write_text("getest")
            repo = "E-AI-MODEL/website"
            run = {"head_sha": "a"*40, "id": 17, "run_attempt": 1}
            tree = "b"*40
            manifest = dict(record(root, run["head_sha"]), schema=2,
                            provenance=dict(tree=tree, run="17", attempt="1", repository=repo))
            validated_manifest(root, manifest, repo, run, tree)
            with self.assertRaises(ValueError):
                validated_manifest(root, manifest, repo, {**run, "id": 18}, tree)
            file.write_text("ander bestand")
            with self.assertRaises(ValueError):
                validated_manifest(root, manifest, repo, run, tree)
            file.unlink()
            with self.assertRaises(ValueError):
                validated_manifest(root, manifest, repo, run, tree)

    def test_current_or_stale_tree(self):
        same_tree("a"*40, "a"*40)
        with self.assertRaises(ValueError):
            same_tree("a"*40, "b"*40)

    def test_no_owner_approval_and_pr_artifact(self):
        authorize("workflow_dispatch", "refs/heads/main", "owner", "owner", "owner")
        for event, actor, trigger in [("push", "owner", "owner"), ("workflow_dispatch", "member", "member"),
                                      ("workflow_dispatch", "owner", "member")]:
            with self.assertRaises(ValueError):
                authorize(event, "refs/heads/main", actor, trigger, "owner")
        with self.assertRaises(ValueError):
            validate_run({"event": "pull_request"}, "E-AI-MODEL/website", [])

    def test_missing_required_gate(self):
        repo = "E-AI-MODEL/website"
        r = dict(event="push", head_branch="main", status="completed", conclusion="success",
                 path=".github/workflows/validate-main.yml", repository={"full_name": repo},
                 head_repository={"full_name": repo})
        for jobs in ([], [{"name": "validation / static-checks", "conclusion": "failure"}]):
            with self.assertRaises(ValueError):
                validate_run(r, repo, jobs)
