"""Retrieve the exact producer artifact inside one GitHub Actions run.

Do not guess the build attempt, use a different run, or fall back to stale
files. This helper is read-only with respect to GitHub and production.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
import zipfile

from release_candidate import select_job_artifact, validated_manifest

# Exact top-level workflow and reusable job names, not suffix matching.
WORKFLOWS = {
    ".github/workflows/site-check.yml": "",
    ".github/workflows/validate-main.yml": "validation / ",
    ".github/workflows/daily-full.yml": "website / ",
    ".github/workflows/eaispeak.yml": None,
}
UPLOADS = {
    "site": ("site-release", "build-check / build", "Bewaar de bouw voor alle testjobs in deze run"),
    "eaispeak": ("eaispeak-tested-build", "eaispeak-check / check-and-build", "Bewaar de geteste build"),
}


def producer_for(target, workflow):
    prefix, name, step = UPLOADS[target]
    # The REST API can return either the workflow path or path@ref.
    # Match only the exact allowlisted path, not a basename or suffix.
    if not isinstance(workflow, str):
        raise ValueError("Onbekende aanroepende workflow")
    path, separator, ref = workflow.partition("@")
    if path not in WORKFLOWS:
        raise ValueError("Onbekende aanroepende workflow")
    if separator and (not ref or ref.startswith("-") or "\x00" in ref
                      or subprocess.run(
                          ["git", "check-ref-format", "--allow-onelevel", ref],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                      ).returncode != 0):
        raise ValueError("Ongeldige workflow-ref")
    caller = WORKFLOWS[path]
    if caller is None:
        if target != "eaispeak":
            raise ValueError("Geen websitebouwer in zelfstandige EAIspeak-run")
        return prefix, ("check-and-build", step)
    return prefix, (caller + name, step)


def check_run(run, repo, run_id, attempt):
    if (run.get("id") != run_id or run.get("run_attempt") != attempt
            or run.get("repository", {}).get("full_name") != repo
            or run.get("event") not in ("pull_request", "push", "schedule", "workflow_dispatch")
            or not re.fullmatch(r"[0-9a-f]{40}", run.get("head_sha", ""))
            or not run.get("head_branch") or not run.get("head_repository")):
        raise ValueError("De GitHub-run komt niet overeen met deze testjob")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def api_request(path, token):
    # Never forward the GitHub credential to an artifact storage host.
    if not path.startswith("/repos/"):
        raise ValueError("Onverwacht GitHub API-pad")
    return build_opener(NoRedirect()).open(
        Request("https://api.github.com" + path, headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "EAI-CI-artifact/1",
        }), timeout=45)


def api_json(path, token):
    with api_request(path, token) as response:
        return json.load(response)


class InconsistentPages(ValueError):
    """The listing changed or was incomplete while GitHub served it."""


PAGE_BACKOFF = (1, 2, 4)


def page_snapshot(path, field, token):
    items = []
    expected = None
    seen = set()
    for page in range(1, 101):
        data = api_json(path + ("&" if "?" in path else "?") + f"per_page=100&page={page}", token)
        part = data[field]
        count = data["total_count"]
        if (not isinstance(part, list) or len(part) > 100
                or type(count) is not int or count < 0):
            raise ValueError("Ongeldige GitHub-paginering")
        if expected is None:
            expected = count
        elif expected != count:
            raise InconsistentPages("Onvolledige of dubbele GitHub-resultaten")
        for item in part:
            if type(item.get("id")) is not int or item["id"] < 1:
                raise ValueError("Ongeldige GitHub-resultaatidentiteit")
            if item["id"] in seen:
                raise InconsistentPages("Onvolledige of dubbele GitHub-resultaten")
            seen.add(item["id"])
        items.extend(part)
        if len(items) > expected:
            raise InconsistentPages("Onvolledige of dubbele GitHub-resultaten")
        if len(part) < 100 or len(items) == expected:
            if len(items) != expected:
                raise InconsistentPages("Onvolledige of dubbele GitHub-resultaten")
            return items
    raise ValueError("Te veel GitHub-resultaten")


def pages(path, field, token):
    # Concurrent uploads/job updates can make a listing inconsistent.
    # Restart the complete read; never combine pages from different reads.
    # Persistent inconsistency is still a hard failure.
    for delay in (*PAGE_BACKOFF, None):
        try:
            return page_snapshot(path, field, token)
        except InconsistentPages:
            if delay is None:
                raise
            print(f"GitHub-lijst {field} inconsistent; herlees alle pagina's")
            time.sleep(delay)



def download(path, token, archive):
    try:
        response = api_request(path, token)
    except HTTPError as exc:
        if exc.code not in (301, 302, 303, 307, 308):
            raise
        location = exc.headers.get("Location", "")
        exc.close()
        url = urlsplit(location)
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("Ongeldige artifact-downloadlocatie")
        # The signed redirect is used without any GitHub authorization header.
        response = urlopen(Request(location, headers={"User-Agent": "EAI-CI-artifact/1"}), timeout=120)
    with response, archive.open("wb") as out:
        shutil.copyfileobj(response, out)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def extract_archive(archive, root, allowed):
    seen = set()
    with zipfile.ZipFile(archive) as bundle:
        for item in bundle.infolist():
            path = PurePosixPath(item.filename)
            mode = stat.S_IFMT(item.external_attr >> 16)
            if (not path.parts or path.is_absolute() or ".." in path.parts
                    or "\\" in item.filename or path.parts[0] not in allowed
                    or path in seen or mode not in (0, stat.S_IFDIR, stat.S_IFREG)):
                raise ValueError("Onverwacht, dubbel of onveilig artifactpad")
            seen.add(path)
        bundle.extractall(root)


def verify_eaispeak(root, checkout, source):
    if {p.name for p in root.iterdir()} != {"tools", "build-sha.txt", "source-sha.txt", "SHA256SUMS"}:
        raise ValueError("Onverwachte inhoud van EAIspeak-pakket")
    if ((root / "build-sha.txt").read_text().strip() != checkout
            or (root / "source-sha.txt").read_text().strip() != source):
        raise ValueError("EAIspeak hoort niet bij deze checkout")
    if {p.name for p in (root / "tools").iterdir()} != {"eaispeak", "delf-live"}:
        raise ValueError("Onverwachte EAIspeak-publicatieroutes")
    expected = {}
    for line in (root / "SHA256SUMS").read_text().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (tools/[^\r\n]+)", line)
        if not match or match[2] in expected:
            raise ValueError("Ongeldige EAIspeak-bestandsinventaris")
        expected[match[2]] = match[1]
    actual = {p.relative_to(root).as_posix(): digest(p)
              for p in (root / "tools").rglob("*") if p.is_file()}
    if actual != expected or not all(actual.get(p) for p in (
            "tools/eaispeak/index.html", "tools/delf-live/index.html")):
        raise ValueError("EAIspeak-bestanden wijken af")


def retrieve(target, dest):
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["CI_ARTIFACT_TOKEN"]
    run_id = int(os.environ["GITHUB_RUN_ID"])
    attempt = int(os.environ["GITHUB_RUN_ATTEMPT"])
    checkout = os.environ["GITHUB_SHA"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) or run_id < 1 or attempt < 1:
        raise ValueError("Ongeldige run-identiteit")
    if (not re.fullmatch(r"[0-9a-f]{40}", checkout)
            or subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() != checkout):
        raise ValueError("Andere checkout dan de testjob")
    prefix = f"/repos/{repo}"
    run = api_json(f"{prefix}/actions/runs/{run_id}", token)
    check_run(run, repo, run_id, attempt)
    name, producer = producer_for(target, run["path"])

    def jobs_for(number):
        return pages(f"{prefix}/actions/runs/{run_id}/attempts/{number}/jobs", "jobs", token)

    artifact, origin = select_job_artifact(
        name, producer, run, jobs_for(attempt),
        pages(f"{prefix}/actions/runs/{run_id}/artifacts", "artifacts", token),
        jobs_for, run["head_branch"])
    with tempfile.TemporaryDirectory(dir=os.environ["RUNNER_TEMP"]) as temporary:
        archive = Path(temporary) / "artifact.zip"
        download(f"{prefix}/actions/artifacts/{artifact['id']}/zip", token, archive)
        if "sha256:" + digest(archive) != artifact["digest"]:
            raise ValueError("SHA-256 van het artifact wijkt af")
        extracted = Path(temporary) / "files"
        extracted.mkdir()
        if target == "site":
            extract_archive(archive, extracted, {"site-build", "release-manifest.json"})
            tree = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], text=True).strip()
            # PR jobs check out GitHub's merge commit, whereas the API
            # identifies the PR source SHA. Validate both at their own layer.
            validated_manifest(extracted / "site-build",
                               json.loads((extracted / "release-manifest.json").read_text()),
                               repo, {**run, "head_sha": checkout}, tree, origin)
            dest.mkdir(parents=True, exist_ok=True)
            for p in extracted.iterdir():
                if (dest / p.name).exists() or (dest / p.name).is_symlink():
                    raise ValueError("Bestaande bouwbestanden worden niet overschreven")
            for p in extracted.iterdir():
                shutil.move(str(p), dest / p.name)
            with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env:
                print(f"BUILD_ATTEMPT={origin}", file=env)
        else:
            extract_archive(archive, extracted, {"tools", "build-sha.txt", "source-sha.txt", "SHA256SUMS"})
            verify_eaispeak(extracted, checkout, run["head_sha"])
            if dest.exists() or dest.is_symlink():
                raise ValueError("EAIspeak-pakket bestaat al")
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(extracted), dest)
    print(f"Exact artifact {artifact['name']} (jobpoging {attempt}, bouwpoging {origin}) gecontroleerd")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("target", choices=tuple(UPLOADS))
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    retrieve(args.target, args.destination)
