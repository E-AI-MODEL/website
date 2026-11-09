"""Refine the pinned anatomy atlas without external viewer dependencies."""
from __future__ import annotations
import re
import shutil
import json
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
    shutil.copyfile(root / "depthSlider.js", source / "src" / "ui" / "depthSlider.js")

    # Remove the blue studio lighting and improve material contrast without
    # adding heavy postprocessing to a mobile 3D viewer.
    scene = source / "src" / "viewer" / "createScene.js"
    rendering = scene.read_text(encoding="utf-8")
    rendering = one(rendering, "renderer.toneMappingExposure = 1.0;",
        "renderer.toneMappingExposure = 0.95;", "neutral exposure")
    rendering = one(rendering,
        "new THREE.AmbientLight(0xffffff, 0.6)",
        "new THREE.AmbientLight(0xfff6ec, 0.49)", "lower ambient wash")
    rendering = one(rendering,
        "new THREE.DirectionalLight(0xffffff, 1.0)",
        "new THREE.DirectionalLight(0xfff9f0, 1.35)", "key contrast")
    rendering = one(rendering,
        "new THREE.DirectionalLight(0x88aaff, 0.4)",
        "new THREE.DirectionalLight(0xf0e2d1, 0.35)", "remove blue fill light")
    rendering = one(rendering,
        "new THREE.DirectionalLight(0xffffee, 0.3)",
        "new THREE.DirectionalLight(0xffffff, 0.4)", "neutral edge light")
    rendering = one(rendering,
        "new THREE.HemisphereLight(0x88ccff, 0x332211, 0.3)",
        "new THREE.HemisphereLight(0xf5eadb, 0x39322e, 0.29)", "remove blue ambient")
    scene.write_text(rendering, encoding="utf-8")

    loader = source / "src" / "viewer" / "loadModel.js"
    meshes = loader.read_text(encoding="utf-8")
    meshes = one(meshes, "function setupMesh(mesh, systemId, viewer) {",
        """// Shared GLB materials are adjusted once. Every mesh retains the same
// material identity, so highlight and opacity restoration continue to work.
const adjustedMaterials = new WeakSet();
function adjustMaterial(material) {
  if (!material || adjustedMaterials.has(material)) return;
  adjustedMaterials.add(material);
  if (material.color) {
    const c = material.color;
    // Convert only washed-out cyan tissue, fascia and surface materials.
    // Keep saturated dark-blue veins, red arteries and nerve colors intact.
    if (c.b > 0.14 && c.g > c.r * 1.08 && c.b > c.r * 1.18 &&
        c.g > c.b * 0.58 && (c.r + c.g + c.b) > 0.55) {
      c.lerp(new THREE.Color(0xc7bbaa), 0.91);
    }
  }
  if (typeof material.roughness === 'number') {
    material.roughness = Math.min(0.79, Math.max(0.49, material.roughness));
  }
  if (typeof material.metalness === 'number') {
    material.metalness = Math.min(material.metalness, 0.06);
  }
  material.needsUpdate = true;
}
function setupMesh(mesh, systemId, viewer) {""",
        "preserve anatomical colors without pale blue")
    meshes = one(meshes,
        """  if (mesh.material) {
    mesh.userData.baseMaterial = mesh.material;
  }""",
        """  if (mesh.material) {
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(adjustMaterial);
    mesh.userData.baseMaterial = mesh.material;
  }""",
        "shared material refinement")
    loader.write_text(meshes, encoding="utf-8")

    # Gebruik de bestaande Nederlandse zoektermen ook als getoonde namen.
    # Alleen exacte structuurbenamingen krijgen een label, nooit een op basis
    # van een los woord afgeleide anatomische functie.
    synonyms = json.loads((root / "synonyms.nl.json").read_text(encoding="utf-8"))
    names = {
        key.strip().lower(): values[0].strip()[0].upper() + values[0].strip()[1:]
        for key, values in synonyms.items()
        if isinstance(values, list) and values and isinstance(values[0], str)
        and values[0].strip()
    }
    (source / "src" / "data" / "eaiNames.js").write_text(
        "// Exacte Nederlandse namen uit de gecontroleerde zoekwoorden.\n"
        + "const NAMES = " + json.dumps(names, ensure_ascii=False, sort_keys=True)
        + ";\nexport function dutchName(base) {\n"
        + "  const key = String(base || '').replace(/\\.[lr]$/, '').trim().toLowerCase();\n"
        + "  return Object.prototype.hasOwnProperty.call(NAMES, key) ? NAMES[key] : null;\n"
        + "}\n"
        + "export function anatomyName(base, info) {\n"
        + "  return dutchName(base) || info?.latinName || String(base || '');\n"
        + "}\n",
        encoding="utf-8"
    )

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
        "import { mountVisibilityReset } from './eaiDetail.js';\n"
        "import { anatomyName } from '../data/eaiNames.js';", "sidebar import")
    # Dezelfde bestaande zoekwoorden verschijnen nu ook in de stelsellijst
    # en in de zoekresultaten, naast het detailpaneel.
    js = one(js,
        "label: (info.name?.[lang] || info.name?.en || base).replace(",
        "label: (anatomyName(base, info)).replace(",
        "Dutch label in systems list")
    js = one(js,
        "escapeHtml(row.label)",
        "escapeHtml(anatomyName(row.base, getStructureInfo(target)))",
        "Dutch label in search results")
    js, n = re.subn(r'const SYSTEM_ICONS = \{[\s\S]*?\};\n\n', '', js, count=1)
    if n != 1:
        raise RuntimeError("System icons section changed")
    start = js.index("  const presets = " + chr(96))
    end = js.index("  container.innerHTML = presets + SYSTEM_IDS.map(", start)
    js = js[:start] + js[end:].replace(
        "  container.innerHTML = presets + SYSTEM_IDS.map(",
        "  container.innerHTML = SYSTEM_IDS.map(", 1)
    js, count = re.subn(r"(?m)^    const icon = SYSTEM_ICONS\[systemId\] \|\| '[^']+';\n", "", js, count=1)
    if count != 1:
        raise RuntimeError("Expected exactly one obsolete system icon declaration")
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
