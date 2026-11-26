"""Same-run artifact recovery, including GitHub's carried job records."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ci_build_artifact import (check_run, digest, extract_archive, pages, producer_for,
                               verify_eaispeak)
from release_candidate import select_job_artifact


class CiBuildArtifactTests(unittest.TestCase):
    def setUp(self):
        self.repo = "E-AI-MODEL/website"
        self.run = dict(id=17, run_attempt=3, head_sha="a"*40, head_branch="feature",
                        event="pull_request", path=".github/workflows/site-check.yml",
                        repository={"id": 21, "full_name": self.repo},
                        head_repository={"id": 21, "full_name": self.repo})

    def records(self, target, origin=1, current=3, minute="36", workflow=None):
        workflow = workflow or self.run["path"]
        prefix, producer = producer_for(target, workflow)
        def job(attempt):
            return dict(name=producer[0], run_id=17, run_attempt=attempt, head_sha="a"*40,
                        status="completed", conclusion="success",
                        started_at=f"2026-11-25T21:{minute}:00Z",
                        completed_at=f"2026-11-25T21:{minute}:40Z",
                        steps=[dict(name=producer[1], status="completed", conclusion="success",
                                    started_at=f"2026-11-25T21:{minute}:31Z",
                                    completed_at=f"2026-11-25T21:{minute}:35Z")])
        artifact = dict(id=101, name=f"{prefix}-17-{origin}", expired=False,
                        created_at=f"2026-11-25T21:{minute}:34Z", digest="sha256:"+"c"*64,
                        workflow_run=dict(id=17, head_sha="a"*40, head_branch="feature",
                                          repository_id=21, head_repository_id=21))
        return prefix, producer, job(current), job(origin), artifact

    def test_same_run_carried_build_in_all_supported_callers(self):
        for workflow in (".github/workflows/site-check.yml",
                         ".github/workflows/validate-main.yml",
                         ".github/workflows/daily-full.yml",
                         ".github/workflows/eaispeak.yml"):
            for target in ("site", "eaispeak"):
                if workflow.endswith("/eaispeak.yml") and target == "site":
                    continue
                with self.subTest(workflow=workflow, target=target):
                    prefix, producer, job, original, artifact = self.records(target, workflow=workflow)
                    self.assertEqual(select_job_artifact(
                        prefix, producer, self.run, [job], [artifact],
                        lambda attempt: [original], "feature"), (artifact, 1))

    def test_workflow_path_ref_suffixes_keep_exact_producer_allowlist(self):
        from ci_build_artifact import WORKFLOWS
        for path in WORKFLOWS:
            for target in ("site", "eaispeak"):
                if path.endswith("/eaispeak.yml") and target == "site":
                    continue
                expected = producer_for(target, path)
                for ref in ("main", "feature/topic", "refs/heads/main",
                            "refs/pull/415/merge", "refs/tags/v2", "a"*40):
                    with self.subTest(path=path, target=target, ref=ref):
                        self.assertEqual(producer_for(target, path+"@"+ref), expected)

    def test_workflow_path_rejects_unknown_paths_and_invalid_refs(self):
        path = ".github/workflows/site-check.yml"
        for invalid in (None, "", "other/"+path+"@main",
                        ".github/workflows/untrusted.yml@main",
                        path+".bak@main", path+"@", path+"@-main",
                        path+"@refs/heads/../main", path+"@refs//heads/main",
                        path+"@main.lock", path+"@main @{bad}",
                        path+"@main\n", path+"@\x00"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                producer_for("site", invalid)
        with self.assertRaises(ValueError):
            producer_for("site", ".github/workflows/eaispeak.yml@main")

    def test_reject_stale_wrong_repo_wrong_branch_and_duplicate_upload(self):
        prefix, producer, job, original, a = self.records("eaispeak")
        def select(artifacts, jobs=None, earlier=None):
            return select_job_artifact(prefix, producer, self.run,
                                       [job] if jobs is None else jobs, artifacts,
                                       lambda _: [original] if earlier is None else earlier, "feature")
        for invalid in ([], [{**a, "expired": True}], [a, {**a, "id": 102}],
                        [{**a, "workflow_run": {**a["workflow_run"], "head_branch": "main"}}],
                        [{**a, "workflow_run": {**a["workflow_run"], "repository_id": 99}}],
                        [{**a, "workflow_run": {**a["workflow_run"], "id": 18}}],
                        [{**a, "created_at": "2026-11-25T21:30:34Z"}]):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                select(invalid)
        with self.assertRaises(ValueError):
            select([a], jobs=[{**job, "conclusion": "failure"}])
        with self.assertRaises(ValueError):
            select([a], earlier=[{**original, "completed_at": "2026-11-25T21:36:41Z"}])

    def test_checkout_and_run_identity_are_not_interchangeable(self):
        check_run(self.run, self.repo, 17, 3)
        for changed in ({"id": 18}, {"run_attempt": 2}, {"event": "pull_request_target"},
                        {"repository": {"full_name": "other/repo"}}):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                check_run({**self.run, **changed}, self.repo, 17, 3)
        with self.assertRaises(ValueError):
            producer_for("site", ".github/workflows/untrusted.yml")
        with self.assertRaises(ValueError):
            producer_for("site", ".github/workflows/eaispeak.yml")

    def test_carried_producer_steps_are_refreshed_before_selection(self):
        from unittest.mock import Mock
        for target in ("site", "eaispeak"):
            with self.subTest(target=target):
                prefix, producer, latest, original, artifact = self.records(target)
                latest["id"] = 202
                original["id"] = 201
                empty = {**latest, "steps": []}
                original_empty = {**original, "steps": []}
                fetch = Mock(side_effect=[[empty], [latest], [original_empty], [original]])
                with patch("release_candidate.time.sleep") as sleep:
                    self.assertEqual(select_job_artifact(
                        prefix, producer, self.run, [empty], [artifact], fetch, "feature"),
                        (artifact, 1))
                self.assertEqual([c.args for c in fetch.call_args_list], [(3,), (3,), (1,), (1,)])
                self.assertEqual([c.args for c in sleep.call_args_list], [(1,), (2,), (1,)])

    def test_missing_steps_fail_closed_after_bounded_refreshes(self):
        from unittest.mock import Mock
        from release_candidate import STEP_BACKOFF
        prefix, producer, latest, original, artifact = self.records("site")
        latest = {**latest, "id": 202, "steps": []}
        fetch = Mock(return_value=[latest])
        with patch("release_candidate.time.sleep") as sleep:
            with self.assertRaisesRegex(ValueError, "geslaagde uploadstap ontbreekt"):
                select_job_artifact(prefix, producer, self.run, [latest], [artifact], fetch, "feature")
        self.assertEqual(fetch.call_count, len(STEP_BACKOFF))
        self.assertEqual([c.args[0] for c in sleep.call_args_list], list(STEP_BACKOFF))
        self.assertLessEqual(sum(STEP_BACKOFF), 30)

    def test_retry_never_accepts_a_different_job_or_failed_upload(self):
        from unittest.mock import Mock
        prefix, producer, latest, original, artifact = self.records("site")
        latest["id"] = 202
        empty = {**latest, "steps": []}
        failed = {**latest, "steps": [{**latest["steps"][0], "conclusion": "failure"}]}
        for replacement in ([{**latest, "id": 999}], [{**latest, "head_sha": "b"*40}],
                            [{**latest, "completed_at": "2026-11-25T21:36:41Z"}],
                            [failed], [latest, latest], []):
            fetch = Mock(return_value=replacement)
            with self.subTest(replacement=replacement), patch("release_candidate.time.sleep") as sleep:
                with self.assertRaises(ValueError):
                    select_job_artifact(prefix, producer, self.run, [empty], [artifact], fetch, "feature")
                fetch.assert_called_once_with(3)
                sleep.assert_called_once_with(1)
        for invalid in (failed, {**latest, "steps": [{"name": "not the upload"}]},
                        {**latest, "conclusion": "failure"}, {**latest, "steps": None}):
            fetch = Mock()
            with self.subTest(invalid=invalid), patch("release_candidate.time.sleep") as sleep:
                with self.assertRaises(ValueError):
                    select_job_artifact(prefix, producer, self.run, [invalid], [artifact], fetch, "feature")
                fetch.assert_not_called()
                sleep.assert_not_called()

    def test_pages_fail_closed_on_missing_and_duplicate_data(self):
        from ci_build_artifact import PAGE_BACKOFF
        for listing in ({"total_count": 2, "jobs": [{"id": 1}]},
                        {"total_count": 2, "jobs": [{"id": 1}, {"id": 1}]}):
            with self.subTest(listing=listing), \
                    patch("ci_build_artifact.api_json", return_value=listing) as api, \
                    patch("ci_build_artifact.time.sleep") as sleep:
                with self.assertRaises(ValueError):
                    pages("/repos/example/site/jobs", "jobs", "fixture-token")
                self.assertEqual(api.call_count, len(PAGE_BACKOFF)+1)
                self.assertEqual([c.args[0] for c in sleep.call_args_list], list(PAGE_BACKOFF))

    def test_inconsistent_artifact_listing_is_reread_without_combining_snapshots(self):
        first = [{"id": 10}]
        final = [{"id": 11}, {"id": 12}]
        with patch("ci_build_artifact.api_json", side_effect=[
                {"total_count": 2, "artifacts": first},
                {"total_count": 2, "artifacts": final}]) as api, \
                patch("ci_build_artifact.time.sleep") as sleep:
            self.assertEqual(pages("/repos/example/site/artifacts", "artifacts", "fixture-token"), final)
        self.assertEqual(api.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_paginated_listing_restarts_when_total_count_changes(self):
        old = [{"id": i} for i in range(1, 101)]
        new = [{"id": i} for i in range(2, 102)]
        with patch("ci_build_artifact.api_json", side_effect=[
                {"total_count": 101, "jobs": old},
                {"total_count": 102, "jobs": [{"id": 101}, {"id": 102}]},
                {"total_count": 101, "jobs": new},
                {"total_count": 101, "jobs": [{"id": 102}]}]) as api, \
                patch("ci_build_artifact.time.sleep") as sleep:
            self.assertEqual(pages("/repos/example/site/jobs", "jobs", "fixture-token"),
                             new+[{"id": 102}])
        self.assertEqual([c.args[0].split("page=")[-1] for c in api.call_args_list],
                         ["1", "2", "1", "2"])
        sleep.assert_called_once_with(1)

    def test_malformed_listing_is_not_retried(self):
        for listing in ({"total_count": -1, "jobs": []},
                        {"total_count": 1, "jobs": [{"id": 0}]},
                        {"total_count": 1, "jobs": "invalid"}):
            with self.subTest(listing=listing), \
                    patch("ci_build_artifact.api_json", return_value=listing) as api, \
                    patch("ci_build_artifact.time.sleep") as sleep:
                with self.assertRaises(ValueError):
                    pages("/repos/example/site/jobs", "jobs", "fixture-token")
                api.assert_called_once()
                sleep.assert_not_called()

    def test_archive_rejects_unsafe_paths_and_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for member in ("../index.html", "/site-build/index.html", "other/index.html", "site-build/../x"):
                archive = root / "bad.zip"
                with zipfile.ZipFile(archive, "w") as out:
                    out.writestr(member, "bad")
                with self.subTest(member=member), self.assertRaises(ValueError):
                    extract_archive(archive, root / "output", {"site-build"})
            with zipfile.ZipFile(archive, "w") as out:
                info = zipfile.ZipInfo("site-build/link")
                info.create_system = 3
                info.external_attr = 0o120777 << 16
                out.writestr(info, "/etc/passwd")
            with self.assertRaises(ValueError):
                extract_archive(archive, root / "output", {"site-build"})

    def test_eaispeak_exact_inventory_and_both_source_identifiers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("tools/eaispeak/index.html", "tools/delf-live/index.html"):
                path = root / name
                path.parent.mkdir(parents=True)
                path.write_text("tested")
            (root / "build-sha.txt").write_text("b"*40+"\n")
            (root / "source-sha.txt").write_text("a"*40+"\n")
            (root / "SHA256SUMS").write_text("".join(
                f"{digest(p)}  {p.relative_to(root).as_posix()}\n"
                for p in sorted((root / "tools").rglob("*.html"))))
            verify_eaispeak(root, "b"*40, "a"*40)
            with self.assertRaises(ValueError):
                verify_eaispeak(root, "a"*40, "a"*40)
            (root / "tools/eaispeak/extra.js").write_text("unlisted")
            with self.assertRaises(ValueError):
                verify_eaispeak(root, "b"*40, "a"*40)


    def test_retrieve_site_after_partial_retry_uses_merge_commit_and_exact_zip(self):
        import os
        import shutil
        from ci_build_artifact import retrieve
        from release_artifact import record
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site = root / "fixture" / "site-build"
            site.mkdir(parents=True)
            (site / "index.html").write_text("tested merge tree")
            checkout = "b"*40
            tree = "d"*40
            manifest = dict(record(site, checkout), schema=2,
                            provenance=dict(tree=tree, run="17", attempt="1", repository=self.repo))
            archive = root / "site.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.write(site / "index.html", "site-build/index.html")
                bundle.writestr("release-manifest.json", json.dumps(manifest))
            prefix, producer, latest, original, artifact = self.records("site")
            artifact["digest"] = "sha256:" + digest(archive)
            # Exercise the documented API shape in the full retrieval path.
            self.run["path"] += "@refs/pull/415/merge"
            envfile = root / "github-env"
            env = dict(GITHUB_REPOSITORY=self.repo, CI_ARTIFACT_TOKEN="fixture",
                       GITHUB_RUN_ID="17", GITHUB_RUN_ATTEMPT="3", GITHUB_SHA=checkout,
                       RUNNER_TEMP=str(root), GITHUB_ENV=str(envfile))
            def records(path, field, token):
                if field == "artifacts":
                    return [artifact]
                if "/attempts/3/" in path:
                    return [latest]
                if "/attempts/1/" in path:
                    return [original]
                self.fail("Unexpected producer lookup")
            def download(path, token, dest):
                self.assertTrue(path.endswith("/101/zip"))
                shutil.copyfile(archive, dest)
            with patch.dict(os.environ, env), \
                    patch("ci_build_artifact.api_json", return_value=self.run), \
                    patch("ci_build_artifact.pages", side_effect=records), \
                    patch("ci_build_artifact.download", side_effect=download), \
                    patch("ci_build_artifact.subprocess.check_output", side_effect=[checkout+"\n", tree+"\n"]):
                retrieve("site", root / "output")
            self.assertEqual((root / "output/site-build/index.html").read_text(), "tested merge tree")
            self.assertEqual(envfile.read_text(), "BUILD_ATTEMPT=1\n")
            artifact["digest"] = "sha256:" + "0"*64
            with patch.dict(os.environ, env), \
                    patch("ci_build_artifact.api_json", return_value=self.run), \
                    patch("ci_build_artifact.pages", side_effect=records), \
                    patch("ci_build_artifact.download", side_effect=download), \
                    patch("ci_build_artifact.subprocess.check_output", return_value=checkout+"\n"):
                with self.assertRaisesRegex(ValueError, "SHA-256"):
                    retrieve("site", root / "invalid")
            self.assertFalse((root / "invalid").exists())

    def test_existing_build_consumers_use_read_only_recovery_and_no_new_attempt_guess(self):
        root = Path(__file__).resolve().parents[1]
        action = (root / ".github/actions/checked-build/action.yml").read_text()
        self.assertIn("scripts/ci_build_artifact.py site .", action)
        self.assertIn("scripts/release_artifact.py verify", action)
        self.assertNotIn("site-release-", action)
        for file in (root / ".github/workflows").glob("*.yml"):
            source = file.read_text()
            if "uses: ./.github/actions/checked-build" in source:
                self.assertIn("  actions: read", source, file.name)
            if file.name in ("build-site.yml", "eaispeak.yml"):
                self.assertIn("scripts/ci_build_artifact.py eaispeak", source)
                self.assertIn("  actions: read", source)
                self.assertNotIn("uses: actions/download-artifact@v4", source)

if __name__ == "__main__":
    unittest.main()
