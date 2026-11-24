#!/usr/bin/env python3
"""Select affected browser suites. Unknown changes always run every suite.

This script does not replace the general site build, security tests, link checks
or complete checks after merges to main.
"""
from __future__ import annotations

import argparse
from pathlib import Path

SUITES = (
    "anatomy", "eaigit", "eaigame", "physics", "eaiwork",
    "llm", "melkweg", "leif", "home", "ictscan", "topo",
)

# Changes to these standalone areas do not affect shared site components.
AREAS = (
    ("tools/delf-live/", ()),
    ("assets/delf-", ()),
    ("scripts/test_delf_", ()),
    ("tools/anatomie/", ("anatomy",)),
    ("content/anatomie/", ("anatomy",)),
    ("scripts/build_anatomie.py", ("anatomy",)),
    ("scripts/extract_hart_", ("anatomy",)),
    ("scripts/test_anatomie", ("anatomy",)),
    ("scripts/test_hartslaglab", ("anatomy",)),
    ("tests/test_anatomie", ("anatomy",)),
    ("tools/eaigit/", ("eaigit",)),
    ("tools/projecthulp/", ("eaigit",)),
    ("assets/eaigit/", ("eaigit",)),
    ("assets/projecthulp/", ("eaigit",)),
    ("scripts/test_projecthulp_browser.mjs", ("eaigit",)),
    ("tools/eaigame/", ("eaigame",)),
    ("assets/eaigame", ("eaigame",)),
    ("scripts/test_eaigame", ("eaigame",)),
    ("tools/science-observatory/", ("physics", "melkweg")),
    ("content/science-observatory/", ("physics", "melkweg")),
    ("scripts/test_science_", ("physics",)),
    ("scripts/test_schuine_worp", ("physics",)),
    ("content/eaiwork-dashboard.html", ("eaiwork",)),
    ("tools/eaiwork/", ("eaiwork",)),
    ("scripts/test_eaiwork_mobile.mjs", ("eaiwork",)),
    ("tools/llm-observatorium/", ("llm",)),
    ("scripts/test_llm_observatorium.mjs", ("llm",)),
    ("tools/melkweg-lab/", ("melkweg",)),
    ("scripts/test_melkweg", ("melkweg",)),
    ("leif/", ("leif",)),
    ("scripts/test_leif_", ("leif",)),
    ("topo/", ("topo",)),
    ("scripts/test_topo_mobile.mjs", ("topo",)),
    ("scripts/validate_topo_content.mjs", ("topo",)),
    ("tools/ict-scan/", ("ictscan",)),
    ("scripts/test_ict_scan_browser.mjs", ("ictscan",)),
    ("scripts/check_ict_assurance.mjs", ("ictscan",)),
    ("tests/test_ict_scan_", ("ictscan",)),
    ("tests/verify_ict_assurance_browser.mjs", ("ictscan",)),
    ("tests/test_eaigit_", ("eaigit",)),
    ("tests/test_projecthulp", ("eaigit",)),
    ("tests/test_static_audit.mjs", ("eaigit",)),
    ("tests/test_audit_advice.mjs", ("eaigit",)),
    ("scripts/anatomie_", ("anatomy",)),
    ("scripts/audit_anatomie", ("anatomy",)),
    ("scripts/audit_hart_glb", ("anatomy",)),
    ("docs/", ()),
    ("README.md", ()),
)

def affected_suites(paths: list[str]) -> set[str]:
    """Fail open for tests: missing/unknown paths require all suites."""
    if not paths:
        return set(SUITES)
    selected: set[str] = set()
    for path in paths:
        path = path.strip()
        if not path or path.startswith("/") or ".." in Path(path).parts:
            return set(SUITES)
        matching = [suites for prefix, suites in AREAS if path.startswith(prefix)]
        if not matching:
            return set(SUITES)
        for suites in matching:
            selected.update(suites)
    return selected

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("changed_files", nargs="*")
    args = parser.parse_args()
    selected = set(SUITES) if args.all else affected_suites(args.changed_files)
    with open(args.output, "a", encoding="utf-8") as out:
        for suite in SUITES:
            out.write(f"{suite}={'true' if suite in selected else 'false'}\n")
    print("Browserproeven:", ", ".join(sorted(selected)) or "alleen algemene checks")

if __name__ == "__main__":
    main()
