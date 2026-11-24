"""One fail-closed decision from the actual GitHub job results."""
import json
import os

ALWAYS = ("scope", "source-checks", "build-check", "ui-check", "register-check")
SCOPED = {"ict-check": "ictscan", "ict-webkit": "ictscan",
          "topo-check": "topo", "anatomy-webkit": "anatomy", "eaigit-check": "eaigit"}


def failures(needs, skip_topo=False):
    errors = []
    if not isinstance(needs, dict):
        return ["Missing or invalid job results"]
    outputs = needs.get("scope", {}).get("outputs", {})
    for flag in set(SCOPED.values()):
        if outputs.get(flag) not in ("true", "false"):
            errors.append(f"Missing or invalid scope: {flag}")
    for job in ALWAYS:
        if needs.get(job, {}).get("result") != "success":
            errors.append(f"{job}: required success, got {needs.get(job, {}).get('result')}")
    for job, flag in SCOPED.items():
        required = outputs.get(flag) == "true" and not (job == "topo-check" and skip_topo)
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
