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
from release_candidate import authorize, match_trigger, same_tree, validate_run, validated_manifest
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

    def test_automatic_publication_only_from_successful_main_validation(self):
        repo = "E-AI-MODEL/website"
        source = dict(name="Valideer de publicatieversie", id=17, run_attempt=1,
                      head_sha="a"*40, event="push", head_branch="main",
                      status="completed", conclusion="success",
                      head_repository={"full_name": repo})
        delivery = dict(action="completed", repository={"full_name": repo}, workflow_run=source)
        def check(data, ref="refs/heads/main", run_id="17"):
            return authorize("workflow_run", ref, "merge-user", "merge-user", "owner",
                             data, repo, run_id)
        self.assertEqual(check(delivery), source)
        match_trigger(source, source)
        for key, wrong in (("name", "Other workflow"), ("event", "pull_request"),
                           ("head_branch", "feature"), ("status", "in_progress"),
                           ("conclusion", "failure"), ("id", 18),
                           ("head_repository", {"full_name": "other/website"}),
                           ("run_attempt", 0), ("head_sha", "not-a-sha")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                check({**delivery, "workflow_run": {**source, key: wrong}})
        for wrong in ({**delivery, "action": "requested"},
                      {**delivery, "repository": {"full_name": "other/website"}}):
            with self.assertRaises(ValueError):
                check(wrong)
        with self.assertRaises(ValueError):
            check(delivery, "refs/heads/feature")
        with self.assertRaises(ValueError):
            check(delivery, run_id="18")
        for key, wrong in (("id", 18), ("head_sha", "b"*40), ("run_attempt", 2)):
            with self.subTest(key=key), self.assertRaises(ValueError):
                match_trigger(source, {**source, key: wrong})

    def test_missing_required_gate(self):
        repo = "E-AI-MODEL/website"
        r = dict(event="push", head_branch="main", status="completed", conclusion="success",
                 path=".github/workflows/validate-main.yml", repository={"full_name": repo},
                 head_repository={"full_name": repo})
        for jobs in ([], [{"name": "validation / static-checks", "conclusion": "failure"}]):
            with self.assertRaises(ValueError):
                validate_run(r, repo, jobs)


class DeploymentStatusScenarios(unittest.TestCase):
    endpoint = "repos/example/website/deployments/17/statuses"

    def test_accepted_post_with_broken_response_is_not_repeated(self):
        import subprocess
        from unittest.mock import patch
        import release_deployment as d
        error = subprocess.CalledProcessError(1, ["gh", "api"])
        with patch.object(d, "latest_state", side_effect=["pending", "success"]), \
                patch.object(d.subprocess, "run", side_effect=error) as post, \
                patch.object(d.time, "sleep") as sleep:
            d.record_status(self.endpoint, "success")
            post.assert_called_once()
            self.assertEqual(json.loads(post.call_args.kwargs["input"]), {"state": "success"})
            self.assertIn("--silent", post.call_args.args[0])
            sleep.assert_not_called()

    def test_existing_success_is_idempotent(self):
        from unittest.mock import patch
        import release_deployment as d
        with patch.object(d, "latest_state", return_value="success"), patch.object(d.subprocess, "run") as post:
            d.record_status(self.endpoint, "success")
            post.assert_not_called()

    def test_transient_write_failure_retries(self):
        import subprocess
        from unittest.mock import patch
        import release_deployment as d
        error = subprocess.CalledProcessError(1, ["gh", "api"])
        with patch.object(d, "latest_state", side_effect=["pending", "pending", "pending", "success"]), \
                patch.object(d.subprocess, "run", side_effect=[error, None]) as post, \
                patch.object(d.time, "sleep") as sleep:
            d.record_status(self.endpoint, "success")
            self.assertEqual(post.call_count, 2)
            sleep.assert_called_once_with(1)

    def test_unreadable_status_is_not_assumed_success(self):
        from unittest.mock import patch
        import release_deployment as d
        with patch.object(d, "latest_state", side_effect=ValueError("bad JSON")), \
                patch.object(d.subprocess, "run") as post, patch.object(d.time, "sleep"):
            with self.assertRaises(RuntimeError):
                d.record_status(self.endpoint, "success")
            post.assert_not_called()

    def test_unconfirmed_write_remains_a_failure(self):
        from unittest.mock import patch
        import release_deployment as d
        with patch.object(d, "latest_state", return_value="pending"), \
                patch.object(d.subprocess, "run") as post, patch.object(d.time, "sleep"):
            with self.assertRaises(RuntimeError):
                d.record_status(self.endpoint, "success")
            self.assertEqual(post.call_count, 4)

    def test_failed_live_check_never_records_success(self):
        from unittest.mock import patch
        import release_deployment as d
        with patch.dict(d.os.environ, {"GITHUB_REPOSITORY": "example/website", "TARGET": "site",
                                       "ID": "17", "RESULT": "failure"}), \
                patch.object(d, "record_status") as status:
            d.main("finish")
            status.assert_called_once_with(self.endpoint, "failure")

    def test_malformed_read_is_rejected(self):
        from unittest.mock import patch
        import release_deployment as d
        for payload in (None, {}, [{"state": "nonsense"}], [None]):
            with self.subTest(payload=payload), patch.object(d, "api", return_value=payload):
                with self.assertRaises(ValueError):
                    d.latest_state(self.endpoint)
