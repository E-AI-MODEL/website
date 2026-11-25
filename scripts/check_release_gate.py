"""One fail-closed decision from the actual GitHub job results."""
import json
import os

from ci_pr_scope import REGISTRY, SUITES, job_selection

ALWAYS = tuple(REGISTRY["always"])
SCOPED = tuple(job_selection(set()))


def failures(needs, skip_topo=False):
    errors = []
    if not isinstance(needs, dict):
        return ["Missing or invalid job results"]
    if set(needs) != set(ALWAYS) | set(SCOPED):
        return ["Job results differ from the registered required and scoped jobs"]
    outputs = needs.get("scope", {}).get("outputs", {})
    try:
        flags = json.loads(outputs["selection"])
        if set(flags) != set(SUITES) or any(v not in ("true", "false") for v in flags.values()):
            return ["Incomplete scope"]
        selected = {group for group, value in flags.items() if value == "true"}
        jobs = job_selection(selected)
        if json.loads(outputs["jobs"]) != jobs:
            return ["Inconsistent job selection"]
    except (KeyError, TypeError, ValueError, AttributeError):
        return ["Missing or invalid scope"]
    for job in ALWAYS:
        if needs.get(job, {}).get("result") != "success":
            errors.append(f"{job}: required success, got {needs.get(job, {}).get('result')}")
    for job in SCOPED:
        required = jobs[job] and not (job == "topo-check" and skip_topo)
        result = needs.get(job, {}).get("result")
        expected = "success" if required else "skipped"
        if result != expected:
            errors.append(f"{job}: expected {expected}, got {result}")
    return errors


def main():
    needs = json.loads(os.environ["RELEASE_RESULTS"])
    skip = os.environ.get("SKIP_TOPO", "false")
    if skip not in ("true", "false"):
        raise SystemExit("Invalid skip_topo")
    errors = failures(needs, skip == "true")
    if errors:
        raise SystemExit("\n".join(errors))
    print("All required checks passed; all other checks were explicitly out of scope.")


if __name__ == "__main__":
    main()
