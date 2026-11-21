#!/usr/bin/env python3
"""Patch the pinned upstream source before Vite builds the original Builder.

Use stable, checked anchors and refuse new upstream revisions until reviewed.
The integration keeps the school data in browser memory only.
"""
from pathlib import Path
import shutil
import sys

upstream = Path(sys.argv[1]).resolve()
repo = Path(__file__).resolve().parent.parent
source = upstream / "src" / "main.js"
text = source.read_text(encoding="utf-8")

replacements = (
    (
        'import { validateLayout, assertNoCollisions } from "./data/layout.js";',
        "import { mountEmmausBridge } from './ict-bridge.js';\n"
        "import './ict-bridge.css';\n"
        'import { validateLayout, assertNoCollisions } from "./data/layout.js";',
    ),
    (
        "  syncGridGuidance();\n})();",
        "  syncGridGuidance();\n"
        "  mountEmmausBridge({ saveDataset, serializeLayout, replaceLayout, "
        "validateLayout, setStatus, getThemeId, rowHeight: ROW_HEIGHT });\n"
        "})();",
    ),
    (
        'const STORAGE_KEY = "dashboard-builder:layout:v1";',
        'const STORAGE_KEY = new URLSearchParams(location.search).get("emmaus")==="1" '
        '? "dashboard-builder:emmaus:layout:v1" : "dashboard-builder:layout:v1";',
    ),
    (
        "    raw = localStorage.getItem(STORAGE_KEY);",
        '    raw = new URLSearchParams(location.search).get("emmaus")==="1" '
        '? null : localStorage.getItem(STORAGE_KEY);',
    ),
    (
        "    loadLayout(starterLayout());",
        '    loadLayout(new URLSearchParams(location.search).get("emmaus")==="1" '
        '? {app:"dashboard-builder",version:5,rowHeight:ROW_HEIGHT,defaultDataset:{kind:"samples"},'
        'pages:[{id:"page-1",name:"Overzicht"}],currentPageId:"page-1",theme:getThemeId(),'
        'filters:[],parameters:[],savedViews:[],tiles:[]} : starterLayout());',
    ),
)
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit("Upstream code differs at integration anchor: " + old[:90])
    text = text.replace(old, new, 1)

source.write_text(text, encoding="utf-8")
for name in ("ict-bridge.js", "ict-bridge.css"):
    shutil.copy2(repo / "tools" / "ict-scan" / "builder-src" / name, upstream / "src" / name)
print("Pinned Dashboard Builder source patched successfully.")
