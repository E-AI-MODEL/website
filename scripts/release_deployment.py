"""Mark a delivery successful only after all live checks in the locked job."""
import json
import os
import sys
from release_candidate import api


def main(operation):
    repo = os.environ["GITHUB_REPOSITORY"]
    endpoint = f"repos/{repo}/deployments"
    env = "theory7-" + os.environ["TARGET"]
    if operation == "finish":
        state = "success" if os.environ["RESULT"] == "success" else "failure"
        api(f"{endpoint}/{int(os.environ['ID'])}/statuses", "-f", "state=" + state)
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
    import subprocess
    deployment = json.loads(subprocess.check_output(["gh", "api", endpoint, "--input", "-"], input=data.encode()))
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        print(f"id={deployment['id']}", file=out)


if __name__ == "__main__":
    main(sys.argv[1])
