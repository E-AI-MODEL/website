"""Bepaal of een PR de volledige 3D-anatomietests nodig heeft.

Niet-anatomische PR's houden de statische atlasbuild en linkcontrole in de
normale UI-check. Onbekende of niet te vergelijken Git-diffs mogen nooit
stilzwijgend als 'niet relevant' worden beoordeeld.
"""
from __future__ import annotations

import sys

PREFIXES = (
    "content/anatomie/",
    "tools/anatomie/",
    "scripts/anatomie_",
    "scripts/build_anatomie.py",
    "scripts/extract_hart",
    "scripts/test_anatomie",
    "scripts/test_hartslaglab",
    "tests/test_anatomie",
    "assets/site",
    "scripts/build_site.py",
    "scripts/prepare_ui.py",
    "scripts/verify_ui.py",
    "scripts/anatomie_ci_scope.py",
    ".github/workflows/verify-ui.yml",
    ".github/workflows/deploy-theory7.yml",
)


def must_test_anatomy(changed_paths: list[str]) -> bool:
    return any(path.startswith(PREFIXES) for path in changed_paths)


def main() -> int:
    # -z is on purpose: filenames can contain whitespace and newlines.
    paths = [
        chunk.decode("utf-8", errors="surrogateescape")
        for chunk in sys.stdin.buffer.read().split(b"\0") if chunk
    ]
    print("true" if must_test_anatomy(paths) else "false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
