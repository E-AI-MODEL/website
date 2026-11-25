"""Read-only branch inventory. Never delete or push anything.

For each fetched branch: determine whether its exact tip is reachable from
main and whether its own net file changes are present byte-for-byte in main.
Matching file states do not prove functional equivalence or preserve unique
commits; non-ancestor branches always require review.
"""
import argparse
import csv
import json
import os
from pathlib import Path
import subprocess
from collections import Counter


def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.PIPE)


def paths(*args):
    return set(p.decode("utf-8", errors="surrogateescape") for p in
               git("diff", "--name-only", "--no-renames", "-z", *args).split(b"\0") if p)


def paged(endpoint, field=None):
    pages = json.loads(subprocess.check_output(
        ["gh", "api", "--paginate", "--slurp", endpoint]))
    if not isinstance(pages, list):
        raise ValueError("Unexpected GitHub pagination response")
    result = []
    for page in pages:
        items = page[field] if field else page
        if not isinstance(items, list):
            raise ValueError("Unexpected GitHub page")
        result.extend(items)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    repo = os.environ["GITHUB_REPOSITORY"]
    api = f"repos/{repo}/"
    refs = {}
    for line in git("for-each-ref", "--format=%(refname:strip=3)%09%(objectname)",
                    "refs/remotes/origin/").decode().splitlines():
        name, sha = line.split("\t", 1)
        if name != "HEAD":
            refs[name] = sha
    baseline = refs["main"]
    # Use complete metadata snapshots; fail closed rather than treating a failed
    # request as no protected branches or no open pull requests.
    remote = {p["name"]: p for p in paged(api + "branches?per_page=100")}
    prs = paged(api + "pulls?state=open&per_page=100")
    protected_prs = {}
    for pr in prs:
        for side in ("head", "base"):
            ref = pr[side]
            if (ref.get("repo") or {}).get("full_name") == repo:
                protected_prs.setdefault(ref["ref"], set()).add(pr["number"])

    ancestors = set(git("rev-list", baseline).decode().splitlines())
    main_tree = git("rev-parse", baseline + "^{tree}").decode().strip()
    rows = []
    for name, sha in sorted(refs.items()):
        live = remote.get(name)
        row = {"branch": name, "sha": sha, "main_sha": baseline,
               "protected": bool(live and live["protected"]),
               "open_prs": sorted(protected_prs.get(name, [])),
               "snapshot_matches": bool(live and live["commit"]["sha"] == sha),
               "tip_in_main_history": sha in ancestors,
               "branch_only_commits": int(git("rev-list", "--count", f"{baseline}..{sha}")),
               "last_commit_date": git("show", "-s", "--format=%cI", sha).decode().strip(),
               "branch_changed_paths": None,
               "different_paths": None,
               "unresolved_paths": [],
               "classification": ""}
        if name == "main" or row["protected"] or row["open_prs"] or name == os.environ.get("GITHUB_REF_NAME"):
            row["classification"] = "retain_active_or_protected"
        elif not row["snapshot_matches"] or remote.get("main", {}).get("commit", {}).get("sha") != baseline:
            row["classification"] = "snapshot_changed_recheck"
        elif row["tip_in_main_history"]:
            row["classification"] = "ancestor_candidate"
        else:
            bases = subprocess.run(["git", "merge-base", "--all", baseline, sha],
                                   stdout=subprocess.PIPE, check=False).stdout.decode().splitlines()
            if len(bases) != 1:
                row["classification"] = "ambiguous_merge_base_review"
            else:
                changed = paths(bases[0], sha)
                different = changed & paths(baseline, sha)
                row["branch_changed_paths"] = len(changed)
                row["different_paths"] = len(different)
                row["unresolved_paths"] = sorted(different)
                if git("rev-parse", sha + "^{tree}").decode().strip() == main_tree:
                    row["classification"] = "same_tree_unique_history_review"
                elif not changed:
                    row["classification"] = "no_net_changes_unique_history_review"
                elif not different:
                    row["classification"] = "same_changed_paths_unique_history_review"
                else:
                    row["classification"] = "different_content_review"
        rows.append(row)

    unseen = sorted(set(remote) - set(refs))
    counts = dict(Counter(r["classification"] for r in rows))
    summary = {"main_sha": baseline, "fetched_branches": len(rows),
               "api_branches": len(remote), "open_prs": len(prs),
               "unfetched_branches": unseen, "counts": counts,
               "deletion_authorized": False,
               "limitations": ["File states include mode and blob identity via git diff, not behavior.",
                               "Unique history is not deemed disposable.",
                               "Recheck ancestry, current tip, protection, activity, open PR heads and bases before deletion.",
                               "This run has no write permission and cannot delete branches."]}
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (args.out / "branches.json").write_text(json.dumps(rows, indent=2) + "\n")
    with (args.out / "branches.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        for row in rows:
            writer.writerow({k: json.dumps(v, ensure_ascii=True) if isinstance(v, list) else v
                             for k, v in row.items()})
    (args.out / "ancestor-candidates.txt").write_text("".join(
        f"{r['branch']} {r['sha']}\n" for r in rows if r["classification"] == "ancestor_candidate"))
    output = ["# Branch audit", "", f"Baseline: {baseline}", "",
              "| Classification | Branches |", "|---|---:|"]
    output.extend(f"| {k} | {v} |" for k, v in sorted(counts.items()))
    output.extend(["", f"Unfetched branches: {len(unseen)}",
                   "No branch deleted. All non-ancestor branches require review."])
    print(json.dumps(summary, indent=2))
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write("\n".join(output) + "\n")


if __name__ == "__main__":
    main()
