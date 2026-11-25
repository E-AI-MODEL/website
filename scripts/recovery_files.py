"""Package only the reviewed transfer paths of a manual recovery."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import os
import subprocess


def hashes(root):
    paths = sorted(root.rglob("*"))
    if any(p.is_symlink() for p in paths):
        raise ValueError("Symbolische link in de herstelbestanden")
    result = {}
    for p in paths:
        if p.is_file():
            with p.open("rb") as f:
                result[p.relative_to(root).as_posix()] = hashlib.file_digest(f, "sha256").hexdigest()
    if not result:
        raise ValueError("Geen herstelbestanden")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["create", "verify"])
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()
    dest = Path("recovery-files")
    if args.operation == "create":
        dest.mkdir()
        for name in args.paths:
            source = Path(name)
            if source.is_absolute() or ".." in source.parts or source.is_symlink():
                raise ValueError(name)
            target = dest / source
            target.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir():
                shutil.copytree(source, target, symlinks=True)
            else:
                shutil.copy2(source, target)
    expected = {"files": hashes(dest), "commit": os.environ["GITHUB_SHA"],
                "run": os.environ["GITHUB_RUN_ID"], "attempt": os.environ["GITHUB_RUN_ATTEMPT"]}
    manifest = Path("recovery-manifest.json")
    if args.operation == "create":
        manifest.write_text(json.dumps(expected, indent=2))
    elif json.loads(manifest.read_text()) != expected:
        raise ValueError("Herstelbestanden komen niet overeen")
    else:
        repo = os.environ["GITHUB_REPOSITORY"]
        current = subprocess.check_output(["gh", "api", f"repos/{repo}/commits/main", "--jq", ".sha"], text=True).strip()
        if current != expected["commit"]:
            raise ValueError("Er is een nieuwere hoofdversie")


if __name__ == "__main__":
    main()
