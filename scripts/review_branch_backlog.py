"""Read-only recovery triage. Compare exact file states, not branch age.

No merge, push, branch deletion or execution of old application code.
A historical blob match proves only that the same file state existed at
the same path on an ancestor of main, not that the branch was deployed
or that its complete feature remains usable.
"""
import argparse
import csv
import json
import os
import subprocess
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.PIPE)

def paged(endpoint):
    pages = json.loads(subprocess.check_output(
        ["gh", "api", "--paginate", "--slurp", endpoint]))
    if not isinstance(pages, list) or not pages or not all(isinstance(p, list) for p in pages):
        raise ValueError("Incomplete API response")
    return [row for page in pages for row in page]

def tree(sha):
    result = {}
    for entry in git("ls-tree", "-r", "-z", sha).split(b"\0"):
        if not entry:
            continue
        meta, path = entry.split(b"\t", 1)
        result[path.decode("utf-8", "surrogateescape")] = meta.decode("ascii")
    return result

@lru_cache(maxsize=64)
def cached_tree(sha):
    return tree(sha)

def area(path):
    p = path.casefold()
    if "ict-scan" in p or "ictscan" in p or "ict_scan" in p:
        return "ICT (excluded from edits)"
    if "eaispeak" in p or "delf-" in p:
        return "EAIspeak"
    if p.startswith("topo/") or "topo_" in p or "topo-" in p:
        return "TOPO"
    if p.startswith("leif/") or "/leif" in p or "test_leif" in p:
        return "LEIF"
    if "eaigit" in p or "projecthulp" in p:
        return "EAIgit"
    if "eaigame" in p:
        return "EAIgame"
    if "anatomie" in p or "hartslag" in p or "hart_" in p:
        return "Anatomie"
    if "lo-aanval" in p or "lo_" in p or "lo-" in p or "/sport" in p:
        return "Sport/LO"
    if "science-observatory" in p or "schuine_worp" in p or "schuine-worp" in p or "wiskunde-" in p or "astronomy" in p or "melkweg" in p:
        return "Science/Heelal"
    if "llmscan" in p or "llm-observatorium" in p or "llm_" in p:
        return "LLM"
    if "wihtml" in p:
        return "WiHTML"
    if "html-gallery" in p or "html-galerij" in p:
        return "HTML-galerij"
    if p.startswith((".github/", "scripts/", "tests/", "docs/ci-audit/")):
        return "Shared tests/CI"
    return "Website/content"

def write_csv(path, rows):
    if not rows:
        path.write_text("")
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        for row in rows:
            w.writerow({k: json.dumps(v, ensure_ascii=True) if isinstance(v, (list, dict)) else v
                        for k, v in row.items()})

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    repo = os.environ["GITHUB_REPOSITORY"]
    api = "repos/" + repo + "/"
    refs = {}
    for line in git("for-each-ref", "--format=%(refname:strip=3)%09%(objectname)",
                    "refs/remotes/origin/").decode().splitlines():
        name, sha = line.split("\t", 1)
        if name != "HEAD":
            refs[name] = sha
    baseline = refs["main"]
    remote = {b["name"]: b for b in paged(api + "branches?per_page=100")}
    if set(refs) != set(remote) or any(remote[n]["commit"]["sha"] != s for n, s in refs.items()):
        raise RuntimeError("Branch snapshot changed. Refresh before drawing conclusions.")
    prs = paged(api + "pulls?state=all&per_page=100")
    open_prs = [p for p in prs if p["state"] == "open"]
    by_head = defaultdict(list)
    protected = set()
    for p in prs:
        if (p["head"].get("repo") or {}).get("full_name") == repo:
            by_head[p["head"]["ref"]].append(p)
        if p["state"] == "open":
            for side in ("head", "base"):
                if (p[side].get("repo") or {}).get("full_name") == repo:
                    protected.add(p[side]["ref"])
    main_now = tree(baseline)
    history = git("rev-list", baseline).decode().splitlines()
    ancestor_set = set(history)
    observed = defaultdict(set)
    for commit in history:
        for path, identity in tree(commit).items():
            observed[path].add(identity)
    rows = []
    details = []
    for n, sha in sorted(refs.items()):
        tip_prs = [p for p in by_head.get(n, []) if p["head"]["sha"] == sha]
        associated = [{"number": p["number"], "state": p["state"],
                       "merged_at": p.get("merged_at"), "title": p["title"],
                       "exact_head": p["head"]["sha"] == sha}
                      for p in by_head.get(n, [])]
        row = {"branch": n, "sha": sha, "main_sha": baseline,
               "protected_or_open": bool(remote[n]["protected"] or n in protected or n == "main"),
               "prs": associated, "ancestor": sha in ancestor_set,
               "branch_only_commits": int(git("rev-list", "--count", baseline+".."+sha)),
               "base": None, "changed": 0, "already_exact": 0, "historical_only": 0,
               "unseen_clean": 0, "unseen_overlap": 0, "unseen_deletions": 0,
               "areas": [], "review": ""}
        if sha in ancestor_set:
            row["review"] = "ancestor"
            rows.append(row)
            continue
        bases = git("merge-base", "--all", baseline, sha).decode().splitlines()
        if len(bases) != 1:
            row["review"] = "ambiguous_base"
            rows.append(row)
            continue
        row["base"] = bases[0]
        old = cached_tree(bases[0])
        current = tree(sha)
        for path in sorted(set(old) | set(current)):
            before, tip = old.get(path), current.get(path)
            if before == tip:
                continue
            main_state = main_now.get(path)
            if tip == main_state:
                category = "already_exact"
            elif tip is not None and tip in observed.get(path, ()):
                category = "historical_only"
            elif tip is None:
                category = "unseen_deletions"
            elif main_state == before:
                category = "unseen_clean"
            else:
                category = "unseen_overlap"
            row[category] += 1
            row["changed"] += 1
            section = area(path)
            if section not in row["areas"]:
                row["areas"].append(section)
            details.append({"branch": n, "sha": sha, "path": path, "area": section,
                            "category": category, "base_state": before, "branch_state": tip,
                            "main_state": main_state,
                            "main_unchanged_from_base": main_state == before,
                            "open_prs": [p["number"] for p in tip_prs if p["state"] == "open"]})
        if "ICT (excluded from edits)" in row["areas"] or "ict" in n.casefold():
            row["review"] = "ICT_retain"
        elif n == os.environ.get("GITHUB_REF_NAME"):
            row["review"] = "audit_retain"
        elif row["changed"] == row["already_exact"]:
            row["review"] = "net_already_present_unique_history"
        elif row["changed"] == row["already_exact"] + row["historical_only"]:
            row["review"] = "all_noncurrent_states_seen_in_main_history"
        elif row["unseen_overlap"] or row["unseen_deletions"]:
            row["review"] = "inspect_conflict_or_deletion"
        elif row["unseen_clean"]:
            row["review"] = "inspect_potential_recovery"
        else:
            row["review"] = "manual_review"
        rows.append(row)

    # Deduplicate *file-state candidates*, not whole branches. One exact blob
    # at a path may occur on many branches. Never infer functional equivalence.
    unique = {}
    for d in details:
        if not d["category"].startswith("unseen_") or d["area"] == "ICT (excluded from edits)":
            continue
        key = (d["path"], d["branch_state"])
        item = unique.setdefault(key, {"path": d["path"], "state": d["branch_state"],
                                       "area": d["area"], "branches": [], "open_prs": [],
                                       "categories": []})
        item["branches"].append(d["branch"])
        item["open_prs"] = sorted(set(item["open_prs"] + d["open_prs"]))
        item["categories"] = sorted(set(item["categories"] + [d["category"]]))
    unique_rows = sorted(unique.values(), key=lambda x: (not bool(x["open_prs"]), x["area"], x["path"], str(x["state"])))
    pr_rows = []
    by_name = {r["branch"]: r for r in rows}
    for p in open_prs:
        r = by_name.get(p["head"]["ref"], {})
        same_head = r.get("sha") == p["head"]["sha"] and (p["head"].get("repo") or {}).get("full_name") == repo
        pr_rows.append({"number": p["number"], "title": p["title"], "head": p["head"]["sha"],
                        "url": p["html_url"], "draft": p["draft"],
                        "snapshot_matches": same_head, "review": r.get("review") if same_head else "external_or_changed",
                        "changed": r.get("changed") if same_head else None,
                        "already_exact": r.get("already_exact") if same_head else None,
                        "historical_only": r.get("historical_only") if same_head else None,
                        "unseen_clean": r.get("unseen_clean") if same_head else None,
                        "unseen_overlap": r.get("unseen_overlap") if same_head else None,
                        "unseen_deletions": r.get("unseen_deletions") if same_head else None,
                        "areas": r.get("areas", []) if same_head else []})
    summary = {"main_sha": baseline, "main_ancestors_examined": len(history),
               "branches": len(rows), "open_prs": len(pr_rows),
               "review_counts": dict(Counter(r["review"] for r in rows)),
               "path_states": dict(Counter(d["category"] for d in details)),
               "unique_unseen_file_states": len(unique_rows),
               "unique_unseen_by_area": dict(Counter(d["area"] for d in unique_rows)),
               "limitations": ["Historical path/blob matches are not proof of intentional replacement or successful publication.",
                               "Unseen file versions can be older alternatives, not necessarily useful or missing functionality.",
                               "No deletion or merge was performed. Branch history must be preserved separately if pruning."]}
    for filename, data in (("summary.json", summary), ("branches.json", rows),
                           ("path-states.json", details), ("open-prs.json", pr_rows)):
        (out / filename).write_text(json.dumps(data, indent=2, ensure_ascii=True)+"\n")
    for filename, data in (("branches.csv", rows), ("path-states.csv", details),
                           ("unique-file-candidates.csv", unique_rows), ("open-prs.csv", pr_rows)):
        write_csv(out / filename, data)
    print(json.dumps(summary, indent=2))
    print("OPEN PR TRIAGE: "+json.dumps(pr_rows, ensure_ascii=True))
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write("# Recovery triage\n\nMain: "+baseline+"\n\n")
        f.write("| Branch review | Count |\n|---|---:|\n")
        for k, v in sorted(summary["review_counts"].items()):
            f.write(f"| {k} | {v} |\n")
        f.write("\nNo source changes or branch deletions. Exact file-state evidence, not a functionality verdict.\n")

if __name__ == "__main__":
    main()
