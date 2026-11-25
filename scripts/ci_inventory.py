"""Inventory GitHub workflow commands and their contexts at two exact Git refs.

The comparison is lexical, not a proof that two browser or source tests have
equivalent semantics. Preserve each condition, input and test object for review.
"""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
import shlex
import subprocess

import yaml


def git(*args):
    return subprocess.check_output(["git", *args], text=True)


def read(ref, path):
    return git("show", f"{ref}:{path}")


def test_keys(command):
    """Index individual explicit test invocations without dropping arguments."""
    result = []
    for line in command.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            tokens = shlex.split(line)
        except ValueError:
            continue
        if tokens[:2] == ["node", "--test"]:
            paths = [t for t in tokens[2:] if t.startswith(("tests/", "scripts/"))]
            # Split a plain list of files, but retain all options otherwise.
            if paths and len(paths) == len(tokens) - 2:
                result.extend(f"node --test {path}" for path in paths)
                continue
        if (re.match(r"^(?:python3?|node|php|bash|npm|npx)\s", line)
                and re.search(r"(?:tests/|scripts/test_|test_[\w.-]+|--test|unittest|pytest|npm test)", line)):
            result.append(line)
    return result


def inventory(ref):
    commit = git("rev-parse", "--verify", ref).strip()
    paths = git("ls-tree", "-r", "--name-only", commit, "--",
                ".github/workflows", ".github/actions").splitlines()
    rows = []
    workflows = {}
    for path in paths:
        if not path.endswith((".yml", ".yaml")):
            continue
        if not path.startswith(".github/workflows/") and Path(path).name not in ("action.yml", "action.yaml"):
            continue
        data = yaml.load(read(commit, path), Loader=yaml.BaseLoader) or {}
        trigger = data.get("on", {})
        jobs = data.get("jobs")
        if jobs is None:
            jobs = {"composite": {"steps": data.get("runs", {}).get("steps", [])}}
        workflows[path] = {
            "on": trigger, "permissions": data.get("permissions"),
            "concurrency": data.get("concurrency"), "defaults": data.get("defaults"),
            "jobs": {name: {k: v for k, v in job.items() if k != "steps"}
                     for name, job in jobs.items()}
        }
        for name, job in jobs.items():
            context = {"workflow": path, "job": name, "trigger": trigger,
                       "job_if": job.get("if"), "needs": job.get("needs"),
                       "runner": job.get("runs-on"), "container": job.get("container"),
                       "matrix": job.get("strategy"), "job_env": job.get("env"),
                       "defaults": job.get("defaults", data.get("defaults"))}
            if "uses" in job:
                rows.append({**context, "step": "reusable workflow",
                             "uses": job["uses"], "with": job.get("with")})
            for index, step in enumerate(job.get("steps", [])):
                if "run" not in step and "uses" not in step:
                    continue
                rows.append({**context, "index": index,
                             "step": step.get("name", step.get("id", str(index))),
                             **{k: step[k] for k in ("run", "uses", "if", "with", "env",
                                 "shell", "working-directory", "continue-on-error") if k in step}})
    try:
        registry = json.loads(read(commit, "scripts/ci_suites.json"))
    except subprocess.CalledProcessError:
        registry = {}
    for group, commands in registry.get("chromium", {}).items():
        for args in commands:
            rows.append({"workflow": ".github/workflows/verify-ui.yml",
                         "job": f"applications ({group})",
                         "step": "registry command",
                         "if": f"selection.{group} == true",
                         "run": shlex.join(["node", *args]),
                         "runner": "ubuntu-24.04", "test_object": "site-build"})
    return {"commit": commit, "workflows": workflows, "rows": rows, "registry": registry}


def index_tests(data):
    out = defaultdict(list)
    for row in data["rows"]:
        for command in test_keys(row.get("run", "")):
            out[command].append(row)
    return dict(sorted(out.items()))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--before", required=True)
    p.add_argument("--after", default="HEAD")
    p.add_argument("--output", required=True, type=Path)
    a = p.parse_args()
    before, after = inventory(a.before), inventory(a.after)
    old, new = index_tests(before), index_tests(after)
    old_runs = {r["run"] for r in before["rows"] if "run" in r}
    new_runs = {r["run"] for r in after["rows"] if "run" in r}
    report = {
        "before": before, "after": after,
        "test_locations_before": old, "test_locations_after": new,
        "removed_test_keys": sorted(set(old) - set(new)),
        "added_test_keys": sorted(set(new) - set(old)),
        "removed_run_blocks": sorted(old_runs - new_runs),
        "added_run_blocks": sorted(new_runs - old_runs),
        "note": "Lexical inventory; assess scope, runtime, inline scripts and artifacts separately.",
    }
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Before: {len(before['workflows'])} definitions, {len(before['rows'])} run/uses rows")
    print(f"After:  {len(after['workflows'])} definitions, {len(after['rows'])} run/uses rows")
    print("Removed explicit test keys:", report["removed_test_keys"])
    print("Added explicit test keys:", report["added_test_keys"])


if __name__ == "__main__":
    main()
