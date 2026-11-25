"""Read GitHub's validation record before making any production files available."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

from release_artifact import record


def validate_run(run, repo, jobs):
    expected = {"event": "push", "head_branch": "main", "status": "completed",
                "conclusion": "success", "path": ".github/workflows/validate-main.yml"}
    if any(run.get(k) != v for k, v in expected.items()):
        raise ValueError("Geen geslaagde hoofdversie uit de validatieworkflow")
    if any(run[k]["full_name"] != repo for k in ("repository", "head_repository")):
        raise ValueError("Andere repository")
    gates = [j for j in jobs if j["name"].split(" / ")[-1] == "static-checks"]
    if len(gates) != 1 or gates[0]["conclusion"] != "success":
        raise ValueError("Verplichte testuitslag ontbreekt")


def validated_manifest(root, manifest, repo, run, tree):
    expected = dict(record(root, run["head_sha"]), schema=2, provenance={
        "tree": tree, "run": str(run["id"]), "attempt": str(run["run_attempt"]), "repository": repo,
    })
    if manifest != expected:
        raise ValueError("Bestanden of herkomst wijken af")


def same_tree(tested, current):
    if not re.fullmatch("[0-9a-f]{40}", tested) or tested != current:
        raise ValueError("De bronboom is gewijzigd. Valideer de nieuwe hoofdversie.")


def api(path, *args):
    raw = subprocess.check_output(["gh", "api", path, *args])
    return json.loads(raw) if raw else None


def authorize(event, ref, actor, triggering_actor, owner):
    if (not owner or event != "workflow_dispatch" or ref != "refs/heads/main"
            or actor != owner or triggering_actor != owner):
        raise ValueError("Expliciete toestemming van de eigenaar op main ontbreekt")


def retrieve(run_id, target):
    authorize(os.environ["GITHUB_EVENT_NAME"], os.environ["GITHUB_REF"],
              os.environ["GITHUB_ACTOR"], os.environ["GITHUB_TRIGGERING_ACTOR"],
              os.environ["GITHUB_REPOSITORY_OWNER"])
    if not re.fullmatch("[1-9][0-9]*", run_id) or target not in ("site", "topo"):
        raise ValueError("Ongeldig runnummer of publicatiedoel")
    repo = os.environ["GITHUB_REPOSITORY"]
    prefix = f"repos/{repo}"
    run = api(f"{prefix}/actions/runs/{run_id}")
    attempt = run["run_attempt"]
    pages = api(f"{prefix}/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100", "--paginate", "--slurp")
    jobs = [job for page in pages for job in page["jobs"]]
    validate_run(run, repo, jobs)
    if target == "topo" and not all(any("topo-check / verify (" + browser + ")" in j["name"]
                                       and j["conclusion"] == "success" for j in jobs)
                                   for browser in ("chromium", "webkit")):
        raise ValueError("TOPO mist een geslaagde browserproef")
    tree = api(f"{prefix}/git/commits/{run['head_sha']}")["tree"]["sha"]
    current = api(f"{prefix}/commits/main")["commit"]["tree"]["sha"]
    same_tree(tree, current)
    # Local upload and verification code must also belong to this source tree.
    same_tree(tree, subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], text=True).strip())
    name = f"{target}-release-{run_id}-{attempt}"
    pages = api(f"{prefix}/actions/runs/{run_id}/artifacts?per_page=100", "--paginate", "--slurp")
    artifacts = [a for page in pages for a in page["artifacts"] if a["name"] == name and not a["expired"]]
    if len(artifacts) != 1:
        raise ValueError("Het gevalideerde artifact ontbreekt of is verlopen")
    artifact = artifacts[0]
    archive = Path(os.environ["RUNNER_TEMP"]) / "candidate.zip"
    with archive.open("wb") as out:
        subprocess.run(["gh", "api", f"{prefix}/actions/artifacts/{artifact['id']}/zip"], stdout=out, check=True)
    with archive.open("rb") as stream:
        if "sha256:" + hashlib.file_digest(stream, "sha256").hexdigest() != artifact["digest"]:
            raise ValueError("SHA-256 van het archief wijkt af")
    folder = "site-build" if target == "site" else "topo"
    dest = Path("candidate")
    dest.mkdir(exist_ok=False)
    with zipfile.ZipFile(archive) as contents:
        for item in contents.infolist():
            path = Path(item.filename)
            if (path.is_absolute() or ".." in path.parts or not path.parts or
                    path.parts[0] not in (folder, "release-manifest.json")):
                raise ValueError("Onverwacht pad in het archief")
        contents.extractall(dest)
    validated_manifest(dest / folder, json.loads((dest / "release-manifest.json").read_text()), repo, run, tree)
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        print(f"tree={tree}\ncommit={run['head_sha']}", file=out)


if __name__ == "__main__":
    retrieve(*sys.argv[1:])
