"""Record and verify the exact built files for a particular Git commit."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def inventory(root):
    if not root.is_dir() or root.is_symlink():
        raise ValueError("Invalid site build directory")
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symlink in release: {path}")
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError(f"Not a regular file: {path}")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        files[path.relative_to(root).as_posix()] = {"sha256": digest, "bytes": path.stat().st_size}
    if "index.html" not in files or not files["index.html"]["bytes"]:
        raise ValueError("Missing website entry")
    return files


def record(root, commit):
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Invalid Git commit SHA")
    return {"schema": 1, "commit": commit, "files": inventory(root)}


def verify(root, commit, manifest):
    if manifest != record(root, commit):
        raise ValueError("Build files or Git commit do not match the tested release")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("create", "verify"))
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    if args.operation == "create":
        args.manifest.write_text(json.dumps(record(args.root, args.commit), indent=2) + "\n", encoding="utf-8")
    else:
        verify(args.root, args.commit, json.loads(args.manifest.read_text(encoding="utf-8")))
    print(f"Release {args.operation}: {args.commit}")


if __name__ == "__main__":
    main()
