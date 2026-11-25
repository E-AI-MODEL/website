"""One-time, user-authorized cleanup of the 66 candidates in the prior audit.

Never remove a non-ancestor, changed ref, protected/default branch, branch
used by open PRs, active workflows or configured main workflows. Preserve
ICT-related refs. Use an atomic Git push with an explicit expected old SHA
for every deletion, rather than unconditional REST ref deletion.
"""
import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlencode

REPO = "E-AI-MODEL/website"
AUDIT_HEAD = "a4ab778f7ce382f74e5c85796e7ecf1aa5631366"
AUDIT_MAIN = "173de878692981ddef2e8e6a0b6360d711d768ec"
AUDIT_RUN = 45652888678
OUT = Path("cleanup-evidence")
OUT.mkdir(exist_ok=True)


def call(*args):
    return subprocess.check_output(args, text=True)


def git(*args):
    return call("git", *args)


def api(path):
    return json.loads(call("gh", "api", "repos/" + REPO + ("/" + path if path else "")))


def pages(path, key=None):
    result = json.loads(call("gh", "api", "--paginate", "--slurp",
                             "repos/" + REPO + "/" + path))
    if not isinstance(result, list) or not result:
        raise ValueError("Incomplete API page response")
    rows = []
    for page in result:
        items = page[key] if key else page
        if not isinstance(items, list):
            raise ValueError("Invalid API page")
        rows.extend(items)
    if key and any(p.get("total_count", 0) > len(rows) for p in result):
        raise ValueError("Truncated workflow run response")
    return rows


def refs():
    return {ref.removeprefix("refs/heads/"): sha
            for sha, ref in (line.split("\t") for line in
                             git("ls-remote", "--heads", "origin").splitlines())}


def save(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + "\n")


def snapshot(candidates):
    remote = {b["name"]: b for b in pages("branches?per_page=100")}
    prs = pages("pulls?state=open&per_page=100")
    used = {p[side]["ref"] for p in prs for side in ("head", "base")
            if (p[side].get("repo") or {}).get("full_name") == REPO}
    active = set()
    for status in ("queued", "in_progress", "requested", "waiting", "pending"):
        try:
            runs = pages("actions/runs?" + urlencode(
                {"status": status, "per_page": 100}), "workflow_runs")
            active.update(r["head_branch"] for r in runs if r.get("head_branch"))
        except ValueError:
            # GitHub's repository-wide pending count can disagree with the
            # returned rows. Do not treat missing details as inactivity.
            # Query each candidate separately; retain any uncertain branch.
            for n in candidates:
                if n in active:
                    continue
                try:
                    runs = pages("actions/runs?" + urlencode(
                        {"status": status, "branch": n, "per_page": 100}),
                        "workflow_runs")
                    if runs:
                        active.add(n)
                except (ValueError, subprocess.CalledProcessError, KeyError):
                    active.add(n)
    live = refs()
    if set(remote) != set(live) or any(
            b["commit"]["sha"] != live[n] for n, b in remote.items()):
        raise RuntimeError("Branches changed during the safety snapshot; stop")
    return remote, used, active, live


def ancestor(sha, main):
    p = subprocess.run(["git", "merge-base", "--is-ancestor", sha, main])
    if p.returncode not in (0, 1):
        raise RuntimeError("Ancestry check failed")
    return p.returncode == 0


def main():
    if (os.environ["GITHUB_REPOSITORY"] != REPO
            or os.environ["GITHUB_REF"] != "refs/heads/audit/generated-source-ownership"
            or os.environ["GITHUB_RUN_ATTEMPT"] != "1"
            or os.environ["GITHUB_ACTOR"] != "E-AI-MODEL"):
        raise RuntimeError("Unexpected cleanup context")
    save("result.json", {"status": "preflight_started", "deleted": {}, "audit_run": AUDIT_RUN})
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    if event.get("before") != "b5d98c2bb8eecdca261f9fe9fb74846610524602":
        raise RuntimeError("Not the authorized one-time update")
    run = api(f"actions/runs/{AUDIT_RUN}")
    if (run["head_sha"] != AUDIT_HEAD or run["conclusion"] != "success"
            or run["path"] != ".github/workflows/audit-branch-backlog.yml"
            or run["run_attempt"] != 1):
        raise RuntimeError("Prior audit identity differs")
    summary = json.loads(Path("prior-audit/summary.json").read_text())
    rows = json.loads(Path("prior-audit/branches.json").read_text())
    if (summary["main_sha"] != AUDIT_MAIN or summary["unfetched_branches"]
            or summary["counts"]["ancestor_candidate"] != 66
            or len(rows) != summary["fetched_branches"]
            or summary["fetched_branches"] != summary["api_branches"]):
        raise RuntimeError("Prior audit incomplete or different")
    candidates = {}
    for row in rows:
        if row["classification"] != "ancestor_candidate":
            continue
        n, sha = row["branch"], row["sha"]
        if (n in candidates or not re.fullmatch(r"[0-9a-f]{40}", sha)
                or row["main_sha"] != AUDIT_MAIN or not row["snapshot_matches"]
                or not row["tip_in_main_history"] or row["branch_only_commits"] != 0
                or row["protected"] or row["open_prs"]):
            raise RuntimeError("Invalid candidate in audit")
        git("check-ref-format", "refs/heads/" + n)
        candidates[n] = sha
    if len(candidates) != 66:
        raise RuntimeError("Unexpected candidate count")
    git("fetch", "--no-tags", "--filter=blob:none", "origin",
        "+refs/heads/main:refs/remotes/origin/main")
    main_sha = git("rev-parse", "refs/remotes/origin/main").strip()
    if not ancestor(AUDIT_MAIN, main_sha):
        raise RuntimeError("Main no longer contains the audited history")
    if api("")["default_branch"] != "main":
        raise RuntimeError("Unexpected default branch")

    # Read current main's configured workflows once. Preserve named source refs.
    workflow_paths = git("ls-tree", "-r", "--name-only", main_sha,
                         ".github/workflows", ".github/actions").splitlines()
    configured = "\n".join(git("show", f"{main_sha}:{p}") for p in workflow_paths)
    report = {"audit_run": AUDIT_RUN, "main": main_sha, "candidates": candidates,
              "deleted": {}, "skipped": {}, "status": "preflight"}
    save("result.json", report)
    remote, used, active, live = snapshot(candidates)
    if live.get("main") != main_sha:
        raise RuntimeError("Main changed during preflight")
    eligible = {}
    for n, sha in sorted(candidates.items()):
        reason = None
        if n in {"main", "master", "develop", "development", "gh-pages",
                 "production", "staging", "audit/generated-source-ownership"}:
            reason = "retained long-lived ref"
        elif "ict" in n.casefold():
            reason = "ICT-related ref excluded"
        elif n not in live:
            reason = "already absent"
        elif live[n] != sha:
            reason = "tip changed since audit"
        elif remote[n]["protected"] or n in used or n in active:
            reason = "protected, open PR or active run"
        elif n in configured:
            reason = "named in current main workflow/action"
        elif not ancestor(sha, main_sha):
            reason = "not reachable from current main"
        if reason:
            report["skipped"][n] = reason
        else:
            eligible[n] = sha
    report["eligible"] = eligible
    save("result.json", report)

    # Refresh all safety inputs immediately before mutating. A changed ref
    # after this check is rejected by the explicit force-with-lease.
    remote, used, active, live = snapshot(candidates)
    if live.get("main") != main_sha:
        raise RuntimeError("Main changed before cleanup")
    for n, sha in list(eligible.items()):
        if (live.get(n) != sha or remote[n]["protected"]
                or n in used or n in active):
            report["skipped"][n] = "changed during final preflight"
            del eligible[n]
    report["eligible"] = eligible
    save("result.json", report)
    (OUT / "restore-refs.txt").write_text(
        "".join(f"{sha} refs/heads/{n}\n" for n, sha in eligible.items()))
    if eligible:
        leases = [f"--force-with-lease=refs/heads/{n}:{sha}"
                  for n, sha in eligible.items()]
        deletions = [f":refs/heads/{n}" for n in eligible]
        result = subprocess.run(["git", "push", "--atomic", *leases, "origin",
                                 *deletions], text=True, capture_output=True)
        (OUT / "push.log").write_text(result.stdout + result.stderr)
        after = refs()
        report["deleted"] = {n: sha for n, sha in eligible.items()
                             if n not in after}
        report["status"] = "verified" if result.returncode == 0 and len(
            report["deleted"]) == len(eligible) else "push_or_verification_failed"
        save("result.json", report)
        if report["status"] != "verified":
            raise RuntimeError("Atomic push or post-delete verification failed")
    else:
        report["status"] = "nothing_to_delete"
        save("result.json", report)
    print(json.dumps({"status": report["status"], "main": main_sha,
                      "candidate_count": len(candidates),
                      "deleted": len(report["deleted"]),
                      "skipped": report["skipped"]}, indent=2))
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write(f"Deleted and verified: {len(report['deleted'])} / 66\n\n")
        f.write("No unique commits deleted. Exact restoration refs in the artifact.\n")


if __name__ == "__main__":
    main()
