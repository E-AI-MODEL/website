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
    shutil.copyfile(root / "dragMode.js", source / "src" / "ui" / "dragMode.js")
    shutil.copyfile(root / "cameraUX.js", source / "src" / "ui" / "cameraUX.js")

    # Remove the blue studio lighting and improve material contrast without
    # adding heavy postprocessing to a mobile 3D viewer.
    scene = source / "src" / "viewer" / "createScene.js"
    rendering = scene.read_text(encoding="utf-8")
    # OrbitControls ondersteunt een verplaatsbaar draaipunt tijdens zoomen.
    # Scrollen volgt de muis, knijpen het midden tussen twee vingers.
    # Dubbelklikken blijft een anatomisch onderdeel expliciet centreren.
    rendering = one(rendering,
        "  controls.enableZoom = true;",
        "  controls.enableZoom = true;\n"
        "  controls.zoomToCursor = true;",
        "zoom naar aanwijzer")
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
    # Shift + pijltjes verschuift het lichaam zonder de kijkrichting te wijzigen.
    rendering = one(rendering,
        "    const step = event.shiftKey ? 0.25 : 0.08;",
        """    if (event.shiftKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const distance = camera.position.distanceTo(controls.target);
      const worldStep = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.08;
      const x = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
      const y = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      const shift = new THREE.Vector3(x, 0, 0).applyQuaternion(camera.quaternion)
        .multiplyScalar(worldStep).add(
          new THREE.Vector3(0, y, 0).applyQuaternion(camera.quaternion).multiplyScalar(worldStep)
        );
      camera.position.add(shift);
      controls.target.add(shift);
      controls.update();
      invalidate();
      return;
    }
    const step = 0.08;""", "keyboard verplaatsen")
    scene.write_text(rendering, encoding="utf-8")

    # Beeld passend maken herstelt uitsluitend de camera. Weggenomen lagen
    # blijven weg; daarvoor bestaat een afzonderlijke knop 'Alles tonen'.
    camera_path = source / "src" / "viewer" / "camera.js"
    camera_source = camera_path.read_text(encoding="utf-8")
    camera_source = one(camera_source,
        "import { state, setAnimating, setCurrentView, notify } from '../state/store.js';",
        "import { state, setAnimating, setCurrentView } from '../state/store.js';",
        "verwijder ongebruikte resetmelding")
    camera_source = one(camera_source,
        """export function resetView(viewer, animate = true) {
  return setView('front', viewer, animate).then(() => {
    // Show all parts
    showAllParts();
    notify('viewReset', true);
  });
}""",
        """export function resetView(viewer, animate = true) {
  const model = getModelBounds(viewer.scene);
  if (!model) return Promise.resolve();
  const { camera, controls } = viewer;
  // Het actuele perspectief blijft behouden, ook na ontleden of isoleren.
  const direction = camera.position.clone().sub(controls.target).normalize();
  const targetPosition = model.center.clone().addScaledVector(direction, model.maxDim * 1.65);
  if (animate) return animateCamera(camera, controls, targetPosition, model.center);
  camera.position.copy(targetPosition);
  controls.target.copy(model.center);
  controls.update();
  return Promise.resolve();
}""",
        "reset zonder anatomische lagen terugzetten")
    camera_path.write_text(camera_source, encoding="utf-8")

    loader = source / "src" / "viewer" / "loadModel.js"
    meshes = loader.read_text(encoding="utf-8")
    meshes = one(meshes, "function setupMesh(mesh, systemId, viewer) {",
        """// Shared GLB materials are adjusted once. Every mesh retains the same
// material identity, so highlight and opacity restoration continue to work.
const adjustedMaterials = new WeakSet();
const redMuscleMaterials = new WeakMap();
const translucentFasciaMaterials = new WeakMap();

function isMusclePart(partId) {
  // Het spierstelsel bevat ook pezen, slijmbeurzen en bindweefsel.
  // Die worden anatomisch niet als spierweefsel ingekleurd.
  return !/fasci|aponeuros|septum|septa|retinacul|pannicul|sheath|fibrous|bursa|tendon|tendin|ligament|synovial|capsule|linea alba|raphe|iliotibial tract|iliopectineal arch|tarsus/i.test(partId);
}
function adjustMaterial(material) {
  if (!material || adjustedMaterials.has(material)) return;
  adjustedMaterials.add(material);
  if (material.color) {
    const c = material.color;
    // Neutrale kleurcorrectie voor niet-spierweefsels.
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
function muscleMaterial(original) {
  let material = redMuscleMaterials.get(original);
  if (material) return material;
  material = original.clone();
  const c = material.color;
  if (c) {
    // Echte rode bronmaterialen behouden hun kleurvariatie.
    // Bleke en blauwige bronmaterialen van spiervolumes worden spierrood.
    const alreadyRed = c.r > c.g * 1.3 && c.r > c.b * 1.17 && c.r > 0.22;
    if (alreadyRed) c.lerp(new THREE.Color(0xba493b), 0.16);
    else c.set(0xb64236);
  }
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  if (typeof material.roughness === 'number') material.roughness = 0.76;
  if (typeof material.metalness === 'number') material.metalness = 0;
  material.needsUpdate = true;
  redMuscleMaterials.set(original, material);
  return material;
}
function fasciaMaterial(original) {
  let material = translucentFasciaMaterials.get(original);
  if (material) return material;
  adjustMaterial(original);
  material = original.clone();
  material.transparent = true;
  material.opacity = 0.035;
  material.depthWrite = false;
  material.needsUpdate = true;
  translucentFasciaMaterials.set(original, material);
  return material;
}
function anatomicalMaterial(original, systemId, partId) {
  if (systemId === 'muscular') {
    // Toon alle echte spieren rood. Bijbehorende fascie, pezen en slijmbeurzen
    // blijven beschikbaar in het 3D-model maar bedekken de spieren niet.
    return isMusclePart(partId) ? muscleMaterial(original) : fasciaMaterial(original);
  }
  adjustMaterial(original);
  return original;
}
function setupMesh(mesh, systemId, viewer) {""",
        "preserve anatomical colors without pale blue")
    meshes = one(meshes,
        """  if (mesh.material) {
    mesh.userData.baseMaterial = mesh.material;
  }""",
        """  if (mesh.material) {
    const partId = findAncestorPartId(mesh) || '';
    mesh.userData.eaiMuscleMesh = systemId === 'muscular' && isMusclePart(partId);
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(mat => anatomicalMaterial(mat, systemId, partId))
      : anatomicalMaterial(mesh.material, systemId, partId);
    mesh.userData.baseMaterial = mesh.material;
  }""",
        "shared material refinement")
    loader.write_text(meshes, encoding="utf-8")

    # A compare step at 100% must restore the original material, not force
    # all anatomical materials to opacity=1. Otherwise transparent fascia
    # becomes opaque after switching from Compare to one muscular system.
    visibility = source / "src" / "viewer" / "visibility.js"
    visibility_js = visibility.read_text(encoding="utf-8")
    visibility_js = one(visibility_js,
        """  ownMeshesOf(partId).forEach(mesh => {
    if (opacity >= 1 && !mesh.userData.ownsMaterial) return;

    ownMaterials(mesh).forEach(mat => {""",
        """  ownMeshesOf(partId).forEach(mesh => {
    if (opacity >= 1) {
      releaseMaterial(mesh, partId);
      return;
    }

    ownMaterials(mesh).forEach(mat => {""",
        "restore source material when comparison ends")
    visibility.write_text(visibility_js, encoding="utf-8")


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
    js = one(js,
        "import { initUI } from './ui/sidebar.js';",
        "import { initUI } from './ui/sidebar.js';\n"
        "import { initDragMode } from './ui/dragMode.js';",
        "import drag mode")
    js = one(js,
        "      await initUI(viewer);",
        "      await initUI(viewer);\n      initDragMode(viewer);",
        "mount drag mode")

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
        "import { refineAnatomyInfo, openAnatomyInfo, closeAnatomyInfo, toggleAnatomyInfo } from '../ui/eaiDetail.js';",
        "selection imports")
    js = one(js,
        "import { focusOnMesh } from './camera.js';",
        "import { focusOnMesh } from './camera.js';\n"
        "import { centerOrbitOnSelection, cancelOrbitCentering } from '../ui/cameraUX.js';",
        "selectie gebruikt draai- en focuspunt")
    js = one(js,
        """  if (structure) {
    selectPart(structure.userData.partId, viewer);
  } else {
    // Clicked on background - deselect""",
        """  if (structure) {
    selectPart(structure.userData.partId, viewer);
    centerOrbitOnSelection(structure, viewer);
  } else {
    // Clicked on background - deselect""",
        "muisklik brengt draaipunt naar structuur")
    js = one(js,
        "    focusOnMesh(structure, viewer, true);",
        "    cancelOrbitCentering();\n    focusOnMesh(structure, viewer, true);",
        "dubbelklik onderbreekt selectie-animatie")
    js = one(js,
        """  showCallout(partId, partData.displayName, {
    isolate: id => isolatePart(id),
    hide: id => { hidePart(id); deselectPart(); },
    close: () => deselectPart()
  });""",
        """  showCallout(partId, partData.displayName, {
    info: () => toggleAnatomyInfo(),
    close: () => deselectPart()
  });""", "duplicate callout actions")
    js = one(js,
        """  const structure = pickAt({ clientX: touch.clientX, clientY: touch.clientY }, viewer);
  if (structure) {
    selectPart(structure.userData.partId, viewer);
  } else {""",
        """  const structure = pickAt({ clientX: touch.clientX, clientY: touch.clientY }, viewer);
  if (structure) {
    selectPart(structure.userData.partId, viewer);
    centerOrbitOnSelection(structure, viewer);
  } else {""",
        "tik brengt draaipunt naar onderdeel")
    js = one(js,
        """  // Show info panel
  showInfoPanel(partData);

  // Show footer actions
  showFooterActions();""",
        """  // Selecting a structure updates the details without opening the panel.
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
        """      <span class="callout-name"></span>
      <div class="callout-actions">
        <button type="button" class="callout-btn" data-callout="isolate"></button>
        <button type="button" class="callout-btn" data-callout="hide"></button>
        <button type="button" class="callout-btn callout-close" data-callout="close" aria-label="Chiudi">&times;</button>
      </div>""",
        """      <span class="callout-copy">
        <span class="callout-name"></span>
        <button type="button" class="callout-more" data-callout="info"
                aria-controls="infoSidebar" aria-expanded="false">Meer informatie</button>
      </span>
      <button type="button" class="callout-btn callout-close" data-callout="close" aria-label="Selectie sluiten">&times;</button>""",
        "callout markup")
    js = one(js,
        """  root.querySelector('[data-callout="isolate"]').textContent = translate('isolate');
  root.querySelector('[data-callout="hide"]').textContent = translate('hide');
""",
        "", "callout duplicate labels")
    # Het label blijft bij de structuur, maar schuift niet onder een geopend
    # informatiepaneel. De lijn blijft aan dezelfde 3D-structuur verbonden.
    js = one(js,
        """  labelX = Math.min(Math.max(labelX, EDGE_PADDING), width - box.width - EDGE_PADDING);
  labelY = Math.min(Math.max(labelY, EDGE_PADDING), height - box.height - EDGE_PADDING);""",
        """  let maxX = width - box.width - EDGE_PADDING;
  let maxY = height - box.height - EDGE_PADDING;
  const panel = document.getElementById('infoSidebar');
  const app = document.getElementById('app');
  if (panel && app?.classList.contains('info-open')) {
    const panelBox = panel.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    if (window.matchMedia('(max-width:720px)').matches) {
      maxY = Math.min(maxY, panelBox.top - canvasBox.top - box.height - EDGE_PADDING);
    } else {
      maxX = Math.min(maxX, panelBox.left - canvasBox.left - box.width - EDGE_PADDING);
    }
  }
  labelX = Math.min(Math.max(labelX, EDGE_PADDING), Math.max(EDGE_PADDING, maxX));
  labelY = Math.min(Math.max(labelY, EDGE_PADDING), Math.max(EDGE_PADDING, maxY));""",
        "label stays away from panel")
    js = one(js,
        "  computeAnchor(partId);\n  root.classList.remove('is-hidden');",
        "  root.querySelector('.callout-more')?.setAttribute('aria-expanded', String(Boolean(document.getElementById('app')?.classList.contains('info-open'))));\n"
        "  computeAnchor(partId);\n  root.classList.remove('is-hidden');",
        "callout expanded state")

    callout.write_text(js, encoding="utf-8")

    sidebar = source / "src" / "ui" / "sidebar.js"
    js = sidebar.read_text(encoding="utf-8")
    js = one(js,
        "import { setView, resetView } from '../viewer/camera.js';",
        "import { setView, resetView } from '../viewer/camera.js';\n"
        "import { focusSearchResult } from './cameraUX.js';",
        "zoekfocus import")
    js = one(js,
        "  selectPartById(partId, state.viewer);\n}",
        "  selectPartById(partId, state.viewer);\n"
        "  await focusSearchResult(partId);\n}",
        "zoekresultaat in beeld")
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
    # De informatieknop op het label en de knop bovenaan openen dezelfde
    # compacte uitleg; de toegankelijke status blijft op beide gelijk.
    js = one(js,
        "    trigger?.setAttribute('aria-expanded', String(open));",
        "    trigger?.setAttribute('aria-expanded', String(open));\n"
        "    if (name === 'info') document.querySelector('.callout-more')?.setAttribute('aria-expanded', String(open));",
        "sync anchored more-info button")
    js = one(js, "  apply('info', false);",
        "  apply('info', false);",
        "info starts closed")
    sidebar.write_text(js, encoding="utf-8")
