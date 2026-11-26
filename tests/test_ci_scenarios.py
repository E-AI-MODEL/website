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
from release_candidate import authorize, match_trigger, same_tree, validate_run, validated_manifest, select_release_artifact
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


class RetryArtifactScenarios(unittest.TestCase):
    """Replay the observed attempt-1 build / attempt-3 green validation shape."""
    repo = "E-AI-MODEL/website"
    workflow_run = {"id": 17, "run_attempt": 3, "head_sha": "a"*40,
           "repository": {"id": 21}, "head_repository": {"id": 21}}

    def producer(self, attempt=3, target="site", minute="36"):
        name, step = (("validation / build-check / build", "Bewaar de bouw voor alle testjobs in deze run")
                      if target == "site" else ("topo-package", "Run actions/upload-artifact@v4"))
        def time(second):
            return f"2026-11-25T21:{minute}:{second:02d}Z"
        return dict(name=name, run_id=17, run_attempt=attempt, head_sha=self.workflow_run["head_sha"],
                    status="completed", conclusion="success", started_at=time(1), completed_at=time(38),
                    steps=[dict(name=step, status="completed", conclusion="success",
                                started_at=time(31), completed_at=time(35))])

    def artifact(self, attempt=1, target="site", minute="36"):
        return dict(id=100+attempt, name=f"{target}-release-17-{attempt}", expired=False,
                    created_at=f"2026-11-25T21:{minute}:34Z", digest="sha256:"+"c"*64,
                    workflow_run=dict(id=17, head_sha=self.workflow_run["head_sha"], head_branch="main",
                                      repository_id=21, head_repository_id=21))

    def select(self, artifacts, jobs=None, earlier=None, target="site"):
        return select_release_artifact(
            target, self.workflow_run, [self.producer(target=target)] if jobs is None else jobs,
            artifacts, lambda attempt: [self.producer(attempt, target=target)]
            if earlier is None else earlier(attempt))

    def test_reuses_the_original_successful_build_after_failed_job_reruns(self):
        a = self.artifact()
        requested = []
        def earlier(attempt):
            requested.append(attempt)
            return [self.producer(attempt)]
        self.assertEqual(self.select([a], earlier=earlier), (a, 1))
        self.assertEqual(requested, [1])
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "index.html").write_text("getest")
            tree = "b"*40
            manifest = dict(record(root, self.workflow_run["head_sha"]), schema=2,
                            provenance=dict(tree=tree, run="17", attempt="1", repository=self.repo))
            validated_manifest(root, manifest, self.repo, self.workflow_run, tree, 1)
            for wrong in (0, 2, 3, 4):
                with self.subTest(attempt=wrong), self.assertRaises(ValueError):
                    validated_manifest(root, manifest, self.repo, self.workflow_run, tree, wrong)
            (root / "index.html").write_text("gewijzigd")
            with self.assertRaises(ValueError):
                validated_manifest(root, manifest, self.repo, self.workflow_run, tree, 1)

    def test_current_attempt_for_topo_and_rebuilt_site(self):
        for target in ("site", "topo"):
            with self.subTest(target=target):
                a = self.artifact(3, target, "48")
                jobs = [self.producer(3, target, "48")]
                self.assertEqual(self.select([self.artifact(1, target), a], jobs=jobs,
                                            earlier=lambda _: self.fail("No earlier lookup"), target=target),
                                 (a, 3))

    def test_fractional_seconds_and_offset_timestamps_from_github(self):
        job = self.producer()
        a = self.artifact()
        a["created_at"] = "2026-11-25T13:36:34.125-08:00"
        job["steps"][0]["started_at"] = "2026-11-25T13:36:31.000-08:00"
        job["steps"][0]["completed_at"] = "2026-11-25T13:36:35.000-08:00"
        self.assertEqual(self.select([a], jobs=[job]), (a, 1))
        for invalid in ("2026-11-25T21:36:34", "not-a-timestamp"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.select([{**a, "created_at": invalid}])

    def test_missing_rebuilt_artifact_never_falls_back_to_stale_build(self):
        with self.assertRaises(ValueError):
            self.select([self.artifact()], jobs=[self.producer(3, minute="48")])

    def test_expired_duplicate_wrong_run_future_or_wrong_origin_rejected(self):
        a = self.artifact()
        for artifacts in ([], [{**a, "expired": True}], [a, {**a, "id": 999}],
                          [{**a, "workflow_run": {**a["workflow_run"], "id": 18}}],
                          [{**a, "workflow_run": {**a["workflow_run"], "head_sha": "b"*40}}],
                          [{**a, "workflow_run": {**a["workflow_run"], "repository_id": 22}}],
                          [self.artifact(4)], [{**a, "digest": "invalid"}]):
            with self.subTest(artifacts=artifacts), self.assertRaises(ValueError):
                self.select(artifacts)
        with self.assertRaises(ValueError):
            self.select([a], earlier=lambda attempt: [self.producer(attempt, minute="35")])

    def test_failed_or_missing_producer_or_upload_cannot_authorize_artifact(self):
        job = self.producer()
        failed_upload = {**job, "steps": [{**job["steps"][0], "conclusion": "failure"}]}
        for jobs in ([], [job, job], [{**job, "conclusion": "failure"}],
                     [failed_upload], [{**job, "head_sha": "b"*40}]):
            with self.subTest(jobs=jobs), self.assertRaises(ValueError):
                self.select([self.artifact()], jobs=jobs)


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
