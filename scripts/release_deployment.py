"""Mark a delivery successful only after all live checks in the locked job."""
import json
import os
import subprocess
import sys
import time
from release_candidate import api


def latest_state(endpoint):
    statuses = api(endpoint + "?per_page=1")
    if not isinstance(statuses, list):
        raise ValueError("Invalid deployment status response")
    if not statuses:
        return None
    state = statuses[0].get("state") if isinstance(statuses[0], dict) else None
    if state not in ("error", "failure", "inactive", "in_progress", "queued", "pending", "success"):
        raise ValueError("Invalid deployment state")
    return state


def record_status(endpoint, state):
    """Confirm the persisted state even if the POST response is empty or broken."""
    if state not in ("success", "failure"):
        raise ValueError("Invalid final deployment state")
    transient = (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, ValueError)
    payload = json.dumps({"state": state}).encode()
    for attempt in range(4):
        try:
            if latest_state(endpoint) == state:
                print(f"GitHub bevestigt publicatiestatus: {state}")
                return
        except transient as error:
            print(f"Status uitlezen mislukt ({type(error).__name__})", file=sys.stderr)
        else:
            try:
                subprocess.run(["gh", "api", endpoint, "--method", "POST", "--input", "-", "--silent"],
                               input=payload, check=True, timeout=30)
            except transient as error:
                print(f"Status schrijven niet bevestigd ({type(error).__name__}); controleer opslag", file=sys.stderr)
            try:
                if latest_state(endpoint) == state:
                    print(f"GitHub bevestigt publicatiestatus: {state}")
                    return
            except transient as error:
                print(f"Status teruglezen mislukt ({type(error).__name__})", file=sys.stderr)
        if attempt < 3:
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GitHub bevestigt de publicatiestatus {state} niet; controleer de bestaande deployment. "
                       "De overdracht wordt hier niet opnieuw gestart.")


def main(operation):
    repo = os.environ["GITHUB_REPOSITORY"]
    endpoint = f"repos/{repo}/deployments"
    env = "theory7-" + os.environ["TARGET"]
    if operation == "finish":
        state = "success" if os.environ["RESULT"] == "success" else "failure"
        record_status(f"{endpoint}/{int(os.environ['ID'])}/statuses", state)
        return
    previous = api(f"{endpoint}?environment={env}&per_page=1")
    tree = os.environ["TREE"]
    if previous and previous[0].get("payload") == {"tree": tree}:
        statuses = api(f"{endpoint}/{previous[0]['id']}/statuses?per_page=1")
        if statuses and statuses[0]["state"] == "success":
            print("Deze bronboom is al gepubliceerd en live gecontroleerd.")
            return
    data = json.dumps(dict(ref=os.environ["COMMIT"], environment=env, auto_merge=False,
                           required_contexts=[], payload={"tree": tree}))
    deployment = json.loads(subprocess.check_output(["gh", "api", endpoint, "--input", "-"], input=data.encode()))
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        print(f"id={deployment['id']}", file=out)


if __name__ == "__main__":
    main(sys.argv[1])
