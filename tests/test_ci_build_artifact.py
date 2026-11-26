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

    def test_pages_fail_closed_on_missing_and_duplicate_data(self):
        with patch("ci_build_artifact.api_json", return_value={"total_count": 2, "jobs": [{"id": 1}]}):
            with self.assertRaises(ValueError):
                pages("/repos/example/site/jobs", "jobs", "fixture-token")
        with patch("ci_build_artifact.api_json", return_value={"total_count": 2, "jobs": [{"id": 1}, {"id": 1}]}):
            with self.assertRaises(ValueError):
                pages("/repos/example/site/jobs", "jobs", "fixture-token")

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


if __name__ == "__main__":
    unittest.main()
