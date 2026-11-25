"""Select suites for every changed path, including unpublished main changes."""
import argparse
from fnmatch import fnmatchcase
import json
from pathlib import Path
import subprocess

REGISTRY = json.loads(Path(__file__).with_name("ci_suites.json").read_text())
SUITES = tuple(REGISTRY["groups"])


def affected_suites(paths):
    selected = set()
    if not paths:
        return set(SUITES)
    for path in paths:
        if not path or path.startswith("/") or ".." in Path(path).parts:
            return set(SUITES)
        matches = [groups for pattern, groups in REGISTRY["paths"].items()
                   if fnmatchcase(path, pattern)]
        if not matches:
            return set(SUITES)
        for groups in matches:
            selected.update(groups)
    return selected


def job_selection(selected):
    return {job: any(group in selected and job in jobs
                     for group, jobs in REGISTRY["groups"].items())
            for jobs in REGISTRY["groups"].values() for job in jobs}


def changes_since(base):
    """A missing publication record or divergent history requires every suite."""
    if not base or subprocess.run(["git", "merge-base", "--is-ancestor", base, "HEAD"]).returncode:
        return []
    data = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", "-z", base, "HEAD"])
    return [p.decode("utf-8", "surrogateescape") for p in data.split(b"\0") if p]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--published")
    parser.add_argument("changed_files", nargs="*")
    args = parser.parse_args()
    paths = args.changed_files if args.published is None else changes_since(args.published)
    selected = set(SUITES) if args.all else affected_suites(paths)
    flags = {suite: str(suite in selected).lower() for suite in SUITES}
    with open(args.output, "a", encoding="utf-8") as out:
        for key, value in flags.items():
            print(f"{key}={value}", file=out)
        print("jobs=" + json.dumps(job_selection(selected), separators=(",", ":")), file=out)
        print("selection=" + json.dumps(flags, separators=(",", ":")), file=out)
    print("Geselecteerd:", ", ".join(sorted(selected)) or "algemene controles")


if __name__ == "__main__":
    main()
