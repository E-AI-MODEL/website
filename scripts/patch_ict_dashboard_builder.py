#!/usr/bin/env python3
"""Small, checked integration patch against the pinned original Dashboard Builder.

Upstream stays independent. The bridge is built with the upstream application,
so its data enter through the supported in-memory dataset store rather than
through DOM upload simulation or edits to minified bundles.
"""
from pathlib import Path
import shutil
import sys

upstream = Path(sys.argv[1]).resolve()
repo = Path(__file__).resolve().parent.parent
source = upstream / "src" / "main.js"
text = source.read_text(encoding="utf-8")
import_at = 'import { validateLayout, assertNoCollisions } from "./data/layout.js";'
start_at = "  syncGridGuidance();\n})();"
if text.count(import_at) != 1 or text.count(start_at) != 1:
    raise SystemExit("Upstream Dashboard Builder changed: integration anchors no longer match.")
text = text.replace(import_at, "import { mountEmmausBridge } from './ict-bridge.js';\n"\n    "import './ict-bridge.css';\n" + import_at, 1)
text = text.replace(
    start_at,
    "  syncGridGuidance();\n"
    "  mountEmmausBridge({ saveDataset, serializeLayout, replaceLayout, "
    "validateLayout, setStatus, getThemeId, rowHeight: ROW_HEIGHT });\n"
    "})();",
    1,
)
source.write_text(text, encoding="utf-8")
for name in ("ict-bridge.js", "ict-bridge.css"):
    shutil.copy2(repo / "tools" / "ict-scan" / "builder-src" / name, upstream / "src" / name)
print("Applied pinned Dashboard Builder bridge with source imports.")
