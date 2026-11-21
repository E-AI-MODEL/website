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
# Keep the normal standalone workspace intact. The connected instance starts
# empty until the real school registers arrive; never flash sample charts.
storage_at = 'const STORAGE_KEY = "dashboard-builder:layout:v1";'
storage_new = ('const STORAGE_KEY = new URLSearchParams(location.search).get("emmaus")==="1" '
               '? "dashboard-builder:emmaus:layout:v1" : "dashboard-builder:layout:v1";')
empty_at = "    raw = localStorage.getItem(STORAGE_KEY);"
empty_new = '    raw = new URLSearchParams(location.search).get("emmaus")==="1" ? null : localStorage.getItem(STORAGE_KEY);'
starter_at = '    loadLayout(starterLayout());'
starter_new = ('    loadLayout(new URLSearchParams(location.search).get("emmaus")==="1" '
               '? {app:"dashboard-builder",version:5,rowHeight:ROW_HEIGHT,defaultDataset:{kind:"samples"},'
               'pages:[{id:"page-1",name:"Overzicht"}],currentPageId:"page-1",theme:getThemeId(),'
               'filters:[],parameters:[],savedViews:[],tiles:[]} : starterLayout());')
for old, new in ((storage_at,storage_new),(empty_at,empty_new),(starter_at,starter_new)):
    if text.count(old)!=1:
        raise SystemExit("Upstream startup code changed; refusing to patch: "+old)
    text=text.replace(old,new,1)
source.write_text(text, encoding="utf-8")
for name in ("ict-bridge.js", "ict-bridge.css"):
    shutil.copy2(repo / "tools" / "ict-scan" / "builder-src" / name, upstream / "src" / name)
print("Applied pinned Dashboard Builder bridge with source imports.")
