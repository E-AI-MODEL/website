"""Select suites against a trusted, successfully validated main ancestor."""
import argparse
from fnmatch import fnmatchcase
import json
import os
from pathlib import Path
import re
import subprocess

from ci_build_artifact import api_json, pages

REGISTRY = json.loads(Path(__file__).with_name("ci_suites.json").read_text())
SUITES = tuple(REGISTRY["groups"])


def groups_for_path(path):
    if not path or path.startswith("/") or ".." in Path(path).parts:
        return None
    matches = [groups for pattern, groups in REGISTRY["paths"].items()
               if fnmatchcase(path, pattern)]
    return {group for groups in matches for group in groups} if matches else None


def affected_suites(paths):
    selected = set()
    if not paths:
        return set(SUITES)
    for path in paths:
        groups = groups_for_path(path)
        if groups is None:
            return set(SUITES)
        selected.update(groups)
    return selected


def job_selection(selected):
    return {job: any(group in selected and job in jobs
                     for group, jobs in REGISTRY["groups"].items())
            for jobs in REGISTRY["groups"].values() for job in jobs}


def commit_sha(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None


def positive_int(value):
    return type(value) is int and value > 0


def is_ancestor(base, head):
    if not commit_sha(base) or not commit_sha(head):
        return False
    return subprocess.run(
        ["git", "merge-base", "--is-ancestor", base, head],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode == 0


def trusted_main_run(run, repo, repo_id, current_run_id, head):
    if not isinstance(run, dict):
        return False
    workflow = ".github/workflows/validate-main.yml"
    return (
        positive_int(run.get("id")) and run["id"] != current_run_id
        and positive_int(run.get("run_attempt"))
        and commit_sha(run.get("head_sha")) and run["head_sha"] != head
        and run.get("path") in (workflow, workflow + "@main", workflow + "@refs/heads/main")
        and run.get("event") == "push" and run.get("head_branch") == "main"
        and run.get("status") == "completed" and run.get("conclusion") == "success"
        and all(isinstance(run.get(key), dict) and run[key].get("id") == repo_id
                and run[key].get("full_name") == repo
                for key in ("repository", "head_repository"))
    )


def trusted_gate(run, jobs):
    matches = [job for job in jobs if job.get("name") == "validation / static-checks"]
    if len(matches) != 1:
        return False
    gate = matches[0]
    if (gate.get("run_id") != run["id"] or gate.get("run_attempt") != run["run_attempt"]
            or gate.get("head_sha") != run["head_sha"]
            or gate.get("status") != "completed" or gate.get("conclusion") != "success"):
        return False
    steps = [step for step in gate.get("steps", [])
             if step.get("name") == "Controleer alle verplichte resultaten"]
    return (len(steps) == 1 and steps[0].get("status") == "completed"
            and steps[0].get("conclusion") == "success")


def select_validated_main(runs, repo, repo_id, current_run_id, head, main_base,
                          jobs_for_run, refresh_run, ancestor=is_ancestor):
    """Only earlier successful main push runs, never a PR's own evidence."""
    if (not positive_int(repo_id) or not positive_int(current_run_id)
            or not commit_sha(head) or not commit_sha(main_base)
            or not ancestor(main_base, head)):
        return None
    for run in runs:
        if not trusted_main_run(run, repo, repo_id, current_run_id, head):
            continue
        if not ancestor(run["head_sha"], main_base):
            continue
        if not trusted_gate(run, jobs_for_run(run)):
            continue
        current = refresh_run(run["id"])
        if (not trusted_main_run(current, repo, repo_id, current_run_id, head)
                or any(current.get(key) != run[key]
                       for key in ("id", "head_sha", "run_attempt"))):
            continue
        return run
    return None


def validated_main_baseline():
    event = os.environ.get("GITHUB_EVENT_NAME")
    if event not in ("pull_request", "push"):
        print("Volledige selectie: dagelijkse of handmatige controle.")
        return ""
    if event == "push" and os.environ.get("GITHUB_REF") != "refs/heads/main":
        print("Volledige selectie: geen push naar main.")
        return ""
    try:
        repo = os.environ["GITHUB_REPOSITORY"]
        repo_id = int(os.environ["GITHUB_REPOSITORY_ID"])
        current_run_id = int(os.environ["GITHUB_RUN_ID"])
        head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        if head != os.environ["GITHUB_SHA"]:
            raise ValueError("HEAD wijkt af van GitHub SHA")
        main_base = os.environ["CI_MAIN_BASE"] if event == "pull_request" else head
        token = os.environ["CI_ARTIFACT_TOKEN"]
        prefix = "/repos/" + repo
        runs = api_json(
            prefix + "/actions/workflows/validate-main.yml/runs"
            "?branch=main&event=push&status=success&per_page=30", token,
        )["workflow_runs"]
        if not isinstance(runs, list):
            raise ValueError("Ongeldige validatielijst")

        def jobs_for_run(run):
            return pages(
                f"{prefix}/actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs",
                "jobs", token,
            )

        candidate = select_validated_main(
            runs, repo, repo_id, current_run_id, head, main_base,
            jobs_for_run, lambda run_id: api_json(f"{prefix}/actions/runs/{run_id}", token),
        )
        if candidate is not None:
            print(f"Vertrouwde main-validatie: run {candidate['id']}, "
                  f"poging {candidate['run_attempt']}, commit {candidate['head_sha']}")
            return candidate["head_sha"]
    except (OSError, ValueError, KeyError, TypeError, AttributeError,
            subprocess.SubprocessError) as exc:
        print(f"Volledige selectie: validatiebasis niet verifieerbaar ({type(exc).__name__}).")
        return ""
    print("Volledige selectie: geen geschikte geslaagde main-validatie gevonden.")
    return ""


def changes_since(base):
    """A missing trusted ancestor or divergent history requires every suite."""
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    if not is_ancestor(base, head):
        return []
    data = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", "-z", base, head])
    return [p.decode("utf-8", "surrogateescape") for p in data.split(b"\0") if p]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--all", action="store_true")
    baseline = parser.add_mutually_exclusive_group()
    baseline.add_argument("--published")
    baseline.add_argument("--validated-main", action="store_true")
    parser.add_argument("--include-topo", action="store_true")
    parser.add_argument("changed_files", nargs="*")
    args = parser.parse_args()
    base = validated_main_baseline() if args.validated_main and not args.all else args.published
    paths = (changes_since(base) if args.validated_main or args.published is not None
             else args.changed_files)
    selected = set(SUITES) if args.all else affected_suites(paths)
    if args.all or not paths:
        print("Volledige selectie: expliciet gevraagd of geen verifieerbaar verschil.")
    else:
        unknown = [path for path in paths if groups_for_path(path) is None]
        if unknown:
            print("Volledige selectie: gedeelde of onbekende paden:", json.dumps(unknown))
        else:
            print("Gerichte selectie voor", len(paths), "gewijzigde paden:", json.dumps(paths))
    if args.include_topo:
        selected.add("topo")
    flags = {suite: str(suite in selected).lower() for suite in SUITES}
    with open(args.output, "a", encoding="utf-8") as out:
        for key, value in flags.items():
            print(f"{key}={value}", file=out)
        print("jobs=" + json.dumps(job_selection(selected), separators=(",", ":")), file=out)
        print("selection=" + json.dumps(flags, separators=(",", ":")), file=out)
    print("Geselecteerd:", ", ".join(sorted(selected)) or "algemene controles")


if __name__ == "__main__":
    main()
