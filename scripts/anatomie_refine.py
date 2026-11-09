"""Refine the pinned anatomy atlas without external viewer dependencies."""
from __future__ import annotations
import re
import shutil
from pathlib import Path

def one(s: str, before: str, after: str, label: str) -> str:
    count = s.count(before)
    if count != 1:
        raise RuntimeError(f"Anatomy refinement {label}: {count} matches (expected 1)")
    return s.replace(before, after, 1)

def refine_anatomy(source: Path) -> None:
    root = Path(__file__).resolve().parent.parent / "content" / "anatomie"
    shutil.copyfile(root / "guide.js", source / "src" / "data" / "eaiGuide.js")
    shutil.copyfile(root / "eaiDetail.js", source / "src" / "ui" / "eaiDetail.js")
    shutil.copyfile(root / "depth.js", source / "src" / "ui" / "depthSlider.js")

    # The original build may already omit the old shortcut menu.
    main = source / "src" / "main.js"
    js = main.read_text(encoding="utf-8")
    js = js.replace("import { initEAIExplore } from './ui/eaiExplore.js';\\n", "")
    js = js.replace("      initEAIExplore(viewer);\\n", "")
    main.write_text(js, encoding="utf-8")

    html_file = source / "index.html"
    html = html_file.read_text(encoding="utf-8")
    start = html.find('<nav class="eai-explore"')
    end = html.find('</nav>', start) if start >= 0 else -1
    if start >= 0 and end >= 0:
        html = html[:start] + html[end + len('</nav>'):]
    html = html.replace(r'\n          <canvas id="threeCanvas"', '<canvas id="threeCanvas"', 1)
    html, n = re.subn(
        r'<!-- Bottom bar - Actions for selected structure -->[\s\S]*?</footer>',
        '', html, count=1
    )
    if n != 1:
        raise RuntimeError("Duplicate footer bar missing")
    html_file.write_text(html, encoding="utf-8")

    selection = source / "src" / "viewer" / "selection.js"
    js = selection.read_text(encoding="utf-8")
    js = one(js,
        "import { highlightMesh, clearHighlight, ghostAllExcept, clearGhost, isolatePart, hidePart } from './visibility.js';",
        "import { highlightMesh, clearHighlight, ghostAllExcept, clearGhost } from './visibility.js';\n"
        "import { refineAnatomyInfo, openAnatomyInfo, closeAnatomyInfo } from '../ui/eaiDetail.js';",
        "selection imports")
    js = one(js,
        """  showCallout(partId, partData.displayName, {
    isolate: id => isolatePart(id),
    hide: id => { hidePart(id); deselectPart(); },
    close: () => deselectPart()
  });""",
        """  showCallout(partId, partData.displayName, {
    close: () => deselectPart()
  });""", "duplicate callout actions")
    js = one(js,
        """  // Show info panel
  showInfoPanel(partData);

  // Show footer actions
  showFooterActions();""",
        """  // Selecting a structure opens its anatomical details.
  showInfoPanel(partData);
  refineAnatomyInfo(partData, deselectPart);
  openAnatomyInfo();""", "information-first selection")
    js = one(js,
        "  hideInfoPanel();\n  hideFooterActions();",
        "  hideInfoPanel();\n  closeAnatomyInfo();\n  hideFooterActions();", "deselect")
    # Some pinned versions no longer include a separate footer helper.
    js = re.sub(r"function showFooterActions\(\) \{[\s\S]*?\n\}\n\n", "", js, count=1)
    selection.write_text(js, encoding="utf-8")

    callout = source / "src" / "ui" / "callout.js"
    js = callout.read_text(encoding="utf-8")
    js = one(js, "import { state, translate } from '../state/store.js';",
        "import { state } from '../state/store.js';", "callout import")
    js = one(js,
        """      <div class="callout-actions">
        <button type="button" class="callout-btn" data-callout="isolate"></button>
        <button type="button" class="callout-btn" data-callout="hide"></button>
        <button type="button" class="callout-btn callout-close" data-callout="close" aria-label="Chiudi">&times;</button>
      </div>""",
        """      <button type="button" class="callout-btn callout-close" data-callout="close" aria-label="Selectie sluiten">&times;</button>""",
        "callout markup")
    js = one(js,
        """  root.querySelector('[data-callout="isolate"]').textContent = translate('isolate');
  root.querySelector('[data-callout="hide"]').textContent = translate('hide');
""",
        "", "callout duplicate labels")
    callout.write_text(js, encoding="utf-8")

    sidebar = source / "src" / "ui" / "sidebar.js"
    js = sidebar.read_text(encoding="utf-8")
    js = one(js, "import { PRESETS, applyPreset } from '../data/presets.js';",
        "import { mountVisibilityReset } from './eaiDetail.js';", "sidebar import")
    js, n = re.subn(r'const SYSTEM_ICONS = \{[\s\S]*?\};\n\n', '', js, count=1)
    if n != 1:
        raise RuntimeError("System icons section changed")
    start = js.index("  const presets = " + chr(96))
    end = js.index("  container.innerHTML = presets + SYSTEM_IDS.map(", start)
    js = js[:start] + js[end:].replace(
        "  container.innerHTML = presets + SYSTEM_IDS.map(",
        "  container.innerHTML = SYSTEM_IDS.map(", 1)
    js = one(js, "    const icon = SYSTEM_ICONS[systemId] || '00';\n",
        "", "system icon variable")
    icon_fragment = '          <span class="system-icon">' + chr(36) + '{icon}</span>\n'
    js = one(js, icon_fragment, '', "system emoji markup")
    start = js.index("  container.querySelectorAll('[data-preset]').forEach(chip => {")
    end = js.index("  // Systems loaded before this ran", start)
    js = js[:start] + js[end:]
    js = one(js, "  initSystemsSidebar();\n  initToolbar(viewer);",
        "  initSystemsSidebar();\n  mountVisibilityReset();\n  initToolbar(viewer);",
        "single restore action")
    js = one(js, "  apply('info', false);",
        "  apply('info', Boolean(state.selectedPart));",
        "restore selected part")
    sidebar.write_text(js, encoding="utf-8")
