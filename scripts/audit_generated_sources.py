"""Read-only proof: test removal of identical generated tool copies in a temporary worktree.

This compares the generator output, not a complete release or GitHub Pages build.
Anatomy and ICT scan are excluded from the removal experiment. Never delete
tracked files in the caller's checkout or use this report to authorize a release.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def excluded(path):
    return any("ict-scan" in part.lower() or "ictscan" in part.lower()
               for part in Path(path).parts)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def tracked():
    return [p for p in git("ls-files", "-z").split("\0") if p and not excluded(p)]


def duplicates(paths):
    sources = defaultdict(list)
    for path in paths:
        file = ROOT / path
        if path.startswith("content/") and file.is_file() and not file.is_symlink():
            sources[digest(file)].append(path)
    pairs = []
    for path in paths:
        file = ROOT / path
        if not path.startswith("tools/") or not file.is_file() or file.is_symlink():
            continue
        matches = sources.get(digest(file), [])
        if matches:
            pairs.append({"copy": path, "sources": sorted(matches),
                          "sha256": digest(file), "bytes": file.stat().st_size})
    return pairs


def inventory(root):
    return {p.relative_to(root).as_posix(): digest(p)
            for p in root.rglob("*") if p.is_file()
            and not excluded(p.relative_to(root).as_posix())}


def references(pairs, paths):
    """Exact path mentions are leads, not proof of use or non-use."""
    candidates = {p["copy"]: [] for p in pairs}
    for name in paths:
        if not name.startswith(("scripts/", "tests/", ".github/", "catalog/")):
            continue
        file = ROOT / name
        if file.suffix not in {".py", ".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".sh"}:
            continue
        if not file.is_file() or file.stat().st_size > 5_000_000:
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except UnicodeError:
            continue
        for path, found in candidates.items():
            if path in content:
                found.append(name)
    return candidates


def generate(work, output):
    subprocess.run([sys.executable, "scripts/build_site.py",
                    "--sources", "content/legacy", "--out", str(output)],
                   cwd=work, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    paths = tracked()
    pairs = duplicates(paths)
    candidates = [p for p in pairs if not p["copy"].startswith("tools/anatomie/")]
    if not candidates:
        raise SystemExit("No duplicate candidates: inventory needs review")
    report = {"commit": git("rev-parse", "HEAD"), "pairs": pairs,
              "candidate_count": len(candidates),
              "candidate_bytes": sum(p["bytes"] for p in candidates),
              "source_reference_leads": references(pairs, paths),
              "anatomy_excluded": True, "ict_scan_excluded": True,
              "scope": "build_site.py only, before anatomy build and prepare_ui",
              "pages_proven": False, "release_tests_proven": False,
              "deletion_authorized": False}
    try:
        with tempfile.TemporaryDirectory(prefix="eai-source-proof-") as tmp:
            base = Path(tmp)
            work = base / "checkout"
            git("worktree", "add", "--detach", str(work), "HEAD")
            try:
                generate(work, base / "before")
                before = inventory(base / "before")
                for pair in candidates:
                    candidate = work / pair["copy"]
                    if digest(candidate) != pair["sha256"]:
                        raise RuntimeError("Candidate changed: " + pair["copy"])
                    if not any(digest(work / src) == pair["sha256"] for src in pair["sources"]):
                        raise RuntimeError("Canonical candidate missing: " + pair["copy"])
                    candidate.unlink()
                generate(work, base / "after")
                after = inventory(base / "after")
                report.update({
                    "before_count": len(before), "after_count": len(after),
                    "missing": sorted(before.keys() - after.keys()),
                    "added": sorted(after.keys() - before.keys()),
                    "changed": sorted(p for p in before.keys() & after.keys()
                                      if before[p] != after[p]),
                    "candidate_outputs": [
                        {"path": p["copy"], "before": before.get(p["copy"]),
                         "after": after.get(p["copy"])}
                        for p in candidates],
                })
                report["generator_outputs_equal"] = not any(
                    report[k] for k in ("missing", "added", "changed"))
            finally:
                git("worktree", "remove", "--force", str(work))
    except Exception as exc:
        report["error_type"] = type(exc).__name__
        raise
    finally:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                               encoding="utf-8")
        print("Identical copies:", len(pairs))
        print("Temporary removal candidates:", len(candidates))
        print("Generator outputs equal:", report.get("generator_outputs_equal", "not established"))
        print("Differences:", {k: len(report.get(k, [])) for k in ("missing", "added", "changed")})
        print("No tracked files removed from the original checkout; no publication.")


if __name__ == "__main__":
    main()
