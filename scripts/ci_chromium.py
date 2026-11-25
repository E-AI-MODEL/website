"""Expand the browser job matrix, or execute one group's original commands."""
import json
import os
import subprocess
import sys
from ci_pr_scope import REGISTRY

groups = REGISTRY["chromium"]
if __name__ == "__main__":
    if len(sys.argv) == 1:
        flags = json.loads(os.environ.get("SELECTION") or "null")
        matrix = [group for group in groups if flags is None or flags[group] == "true"]
        with open(os.environ["GITHUB_OUTPUT"], "a") as out:
            print("matrix=" + json.dumps(matrix), file=out)
    else:
        failures = []
        for command in groups[sys.argv[1]]:
            if subprocess.run(["node", *command]).returncode:
                failures.append(command[0])
        if failures:
            sys.exit("Mislukte proeven: " + ", ".join(failures))
