#!/usr/bin/env python3
"""Build the self-hosted EAI Anatomy Atlas from a pinned, credited source.

Nothing is fetched by the visitor from another website. The GitHub Actions build
fetches the pinned upstream source, compiles it and copies every asset locally.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from anatomie_shell import refit_shell

SOURCE_URL = "https://github.com/nqwrc/3d-anatomy.git"
SOURCE_COMMIT = "8ca3b7421bcfbe88b85859eb1983d5cf79f21749"
BASE = "/tools/anatomie/"
SYSTEMS = (
    "skeletal", "muscular", "joints", "cardiovascular",
    "lymphatic", "nervous", "visceral",
)

def command(*args: str, cwd: Path) -> str:
    try:
        result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True)
    except subprocess.CalledProcessError as error:
        print(f"Build step failed: {' '.join(args)}", file=sys.stderr)
        print(error.stdout or "", file=sys.stderr)
        print(error.stderr or "", file=sys.stderr)
        raise
    return result.stdout.strip()

def patch_upstream(source: Path) -> None:
    index = source / "index.html"
    html = index.read_text(encoding="utf-8")
    changes = {
        "<html lang=\"en\">": "<html lang=\"nl\">",
        "<title>Z-Anatomy - 3D Anatomy Atlas</title>": "<title>AN / 01 | Anatomisch Observatorium | EAI</title>",
        "href=\"/favicon.svg\"": "href=\"/assets/eai-logo.svg\"",
        "<h1 class=\"logo\">Z-Anatomy</h1>": "<h1 class=\"logo\">AN / 01 <span class=\"eai-app-name\">Anatomisch Observatorium</span></h1>",
        "<div class=\"header-right\">": "<div class=\"header-right\"><a class=\"eai-back\" href=\"/tools/\">Alle tools</a>",
        "placeholder=\"Search an anatomical structure...\"": "placeholder=\"Zoek een anatomische structuur...\"",
        "<h2>Anatomical systems</h2>": "<h2>Lichaamsstelsels</h2>",
        "<h2>Information</h2>": "<h2>Informatie</h2>",
        "Loading 3D model...": "Anatomisch model laden...",
        "title=\"Front view\">Front</button>": "title=\"Vooraanzicht\">Voor</button>",
        "title=\"Side view\">Side</button>": "title=\"Zijaanzicht\">Zij</button>",
        "title=\"Back view\">Back</button>": "title=\"Achteraanzicht\">Achter</button>",
        "title=\"Top view\">Top</button>": "title=\"Bovenaanzicht\">Boven</button>",
        "title=\"Reset view\">Reset</button>": "title=\"Beginweergave\">Herstel</button>",
        "<p>Select an anatomical structure</p>": "<p>Kies een anatomische structuur</p>",
        "<span class=\"hint\">Click the 3D model to see its details</span>": "<span class=\"hint\">Klik op een lichaamsdeel voor de details</span>",
        "</div>\n      </section>\n\n      <!-- Sidebar - Info Panel -->": (
            '<div class="eai-attribution" aria-label="Modelbronnen">'
            '3D-modellen: BodyParts3D en Z-Anatomy'
            ' <a href="NOTICE.txt">Bronvermelding</a>'
            ' <a href="LICENSE.txt">Licentie</a></div>'
            '</div>\n      </section>\n\n      <!-- Sidebar - Info Panel -->'
        ),
    }
    for old, new in changes.items():
        if old not in html:
            raise RuntimeError(f"Upstream HTML changed, expected marker missing: {old[:90]!r}")
        html = html.replace(old, new, 1)
    index.write_text(html, encoding="utf-8")

    sidebar = source / "src" / "ui" / "sidebar.js"
    js = sidebar.read_text(encoding="utf-8")
    # Plain typographic codes instead of decorative emoji in the systems menu.
    replacement = """const SYSTEM_ICONS = {
      skeletal: '01', muscular: '02', joints: '03',
      cardiovascular: '04', lymphatic: '05', nervous: '06', visceral: '07'
    };"""
    js, count = re.subn(r"const SYSTEM_ICONS = \{.*?\};", replacement, js, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError("Cannot find the system icon map in upstream")
    # Dutch controls for the EAI edition. Anatomical structure names remain in
    # their available source languages; their identity is not rewritten.
    names = {
        "skeletal: 'Skeletal system'": "skeletal: 'Skelet'",
        "muscular: 'Muscular system'": "muscular: 'Spieren'",
        "joints: 'Joints'": "joints: 'Gewrichten'",
        "cardiovascular: 'Cardiovascular system'": "cardiovascular: 'Hart en bloedvaten'",
        "lymphatic: 'Lymphoid organs'": "lymphatic: 'Lymfestelsel'",
        "nervous: 'Nervous system & sense organs'": "nervous: 'Zenuwstelsel'",
        "visceral: 'Visceral systems'": "visceral: 'Organen'",
    }
    for original, translated in names.items():
        if original not in js:
            raise RuntimeError(f"Source system label changed: {original}")
        js = js.replace(original, translated, 1)
    sidebar.write_text(js, encoding="utf-8")

    # The detailed part lists stay closed until visitors request them.
    js = sidebar.read_text(encoding="utf-8")
    js = js.replace("const SYSTEM_LABELS = {", """const SYSTEM_LABELS = {
  nl: {
    skeletal: 'Skelet', muscular: 'Spieren', joints: 'Gewrichten',
    cardiovascular: 'Hart en bloedvaten', lymphatic: 'Lymfestelsel',
    nervous: 'Zenuwstelsel', visceral: 'Organen'
  },""", 1)
    js = js.replace("const icon = SYSTEM_ICONS[systemId] || '🔬';",
                    "const icon = SYSTEM_ICONS[systemId] || '00';", 1)
    old = """        <div class="system-group-content" style="display: ${isVisible ? 'block' : 'none'};"></div>"""
    new = """        <button type="button" class="eai-parts-toggle" data-system-expand="${systemId}" aria-expanded="false" aria-controls="parts-${systemId}">Bekijk onderdelen <span class="eai-chevron" aria-hidden="true">+</span></button>
        <div id="parts-${systemId}" class="system-group-content" style="display: none;"></div>"""
    if old not in js:
        raise RuntimeError("Source structure list markup changed")
    js = js.replace(old, new, 1)
    marker = "  // Add event listeners for system toggles"
    if marker not in js:
        raise RuntimeError("Systems event marker missing")
    addition = """  container.querySelectorAll('[data-system-expand]').forEach(button => {
    button.addEventListener('click', async () => {
      const group = button.closest('.system-group');
      const systemId = button.dataset.systemExpand;
      const content = group.querySelector('.system-group-content');
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      button.innerHTML = open
        ? 'Verberg onderdelen <span class="eai-chevron" aria-hidden="true">−</span>'
        : 'Bekijk onderdelen <span class="eai-chevron" aria-hidden="true">+</span>';
      if (open && content.children.length === 0) {
        await ensureSystemLoaded(systemId, group);
        if (content.children.length === 0) populateSystemStructures(systemId, content);
      }
      content.style.display = open ? 'block' : 'none';
    });
  });

"""
    js = js.replace(marker, addition + marker, 1)
    js = js.replace(
        "      content.style.display = 'block';\n\n      // Building the list here",
        "      content.style.display = group.querySelector('[data-system-expand]')?.getAttribute('aria-expanded') === 'true' ? 'block' : 'none';\n\n      // Building the list here", 1)
    # Wait for UI callbacks, not only the first rendered model, in browser tests.
    ready_marker = "  initDepthSlider();\n}"
    if ready_marker not in js:
        raise RuntimeError("Upstream readiness marker changed")
    js = js.replace(ready_marker, "  initDepthSlider();\n  window.__EAI_ANATOMY_UI_READY = true;\n}", 1)
    sidebar.write_text(js, encoding="utf-8")

    presets_file = source / "src" / "data" / "presets.js"
    presets_js = presets_file.read_text(encoding="utf-8")
    for original, translated in {
        "en: 'Skeleton, front'": "en: 'Skelet, vooraanzicht'",
        "en: 'Thigh muscles'": "en: 'Beenspieren'",
        "en: 'Heart and great vessels'": "en: 'Hart en bloedvaten'",
    }.items():
        if original not in presets_js:
            raise RuntimeError(f"Source preset changed: {original}")
        presets_js = presets_js.replace(original, translated, 1)
    presets_file.write_text(presets_js, encoding="utf-8")

    translations_file = source / "src" / "data" / "translations.js"
    translations_js = translations_file.read_text(encoding="utf-8")
    translations_js += """
// EAI edition: Dutch interface; anatomical terminology remains from the source.
Object.assign(translationsEn, {
  search_placeholder: 'Zoek een anatomische structuur...',
  systems: 'Lichaamsstelsels', info: 'Informatie', help: 'Hulp',
  front_view: 'Voor', side_view: 'Zij', back_view: 'Achter',
  top_view: 'Boven', reset: 'Herstel',
  depth: 'Diepte', select_structure: 'Kies een structuur',
  click_to_select: 'Klik op het 3D-model voor informatie',
  loading_model: 'Anatomisch model laden...',
  isolate: 'Isoleer', hide: 'Verberg', transparent: 'Transparant',
  show_all: 'Toon alles', loading_structure: 'Structuur laden...',
  no_results: 'Geen resultaten', retry: 'Opnieuw',
  name: 'Naam', system: 'Stelsel', region: 'Regio',
  description: 'Beschrijving', functions: 'Functies',
  origin: 'Oorsprong', insertion: 'Aanhechting',
  innervation: 'Innervatie', vascularization: 'Doorbloeding',
  clinical_notes: 'Klinische opmerkingen', parts: 'Onderdelen',
  help_title: 'Bediening', controls_title: 'Bediening',
  help_computer: 'Computer', help_touch: 'Aanraken',
  help_left_drag: 'Slepen', help_right_drag: 'Rechtermuisknop slepen',
  help_rotate: 'Draaien', help_wheel: 'Scrollen', help_zoom: 'Zoomen',
  help_pan: 'Verschuiven', help_double_click: 'Dubbelklikken',
  help_frame: 'In beeld brengen', help_select: 'Selecteren',
  close: 'Sluiten', help_credits: 'Bronnen en licenties',
  help_toolbar: 'Kijkrichtingen', help_panels: 'Panelen',
  action_isolate: 'Isoleer', action_hide: 'Verberg',
  action_transparent: 'Maak transparant', action_restore: 'Alles tonen',
  read_more: 'Lees meer op Wikipedia',
  no_definition: 'Voor deze structuur is geen beschrijving beschikbaar.'
});
"""
    translations_file.write_text(translations_js, encoding="utf-8")

    # Dutch search terms supplement the upstream English and Italian names.
    # They never replace original mesh identifiers or geometric data.
    dictionary = Path(__file__).resolve().parent.parent / "content" / "anatomie" / "synonyms.nl.json"
    dutch_terms = json.loads(dictionary.read_text(encoding="utf-8"))
    (source / "public" / "data" / "synonyms.nl.json").write_text(
        json.dumps(dutch_terms, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    search_file = source / "src" / "utils" / "dataLoader.js"
    search_js = search_file.read_text(encoding="utf-8")
    search_js = search_js.replace("let synonyms = {};", "let synonyms = {};\nlet dutchSynonyms = {};", 1)
    marker = "  // Z-Anatomy names a muscle"
    if marker not in search_js:
        raise RuntimeError("Upstream synonyms hook changed")
    search_js = search_js.replace(marker, """  try {
    const response = await fetch(asset('data/synonyms.nl.json'));
    dutchSynonyms = response.ok ? await response.json() : {};
  } catch {
    dutchSynonyms = {};
  }

""" + marker, 1)
    marker = "// One row per anatomical structure, not per mesh:"
    if marker not in search_js:
        raise RuntimeError("Upstream search index hook changed")
    search_js = search_js.replace(marker, """// Match a few checked Dutch names and frequent anatomical terms. Keep the
// original identifiers: the matching rows still point to the genuine GLBs.
function dutchTermsFor(base) {
  const found = [];
  Object.entries(dutchSynonyms).forEach(([english, names]) => {
    if (base === english || (english.length >= 5 && base.includes(english))) {
      found.push(...names);
    }
  });
  return [...new Set(found)];
}

""" + marker, 1)
    search_js = search_js.replace(
        "const italian = italianTermsFor(normalise(base));",
        "const italian = italianTermsFor(normalise(base));\n      const dutch = dutchTermsFor(normalise(base));", 1
    )
    search_js = search_js.replace(
        "label: base.replace(/^\\((.*)\\)$/, '$1'),",
        "label: dutchSynonyms[normalise(base)]?.[0] ? `${dutchSynonyms[normalise(base)][0]} (${base.replace(/^\\((.*)\\)$/, '$1')})` : base.replace(/^\\((.*)\\)$/, '$1'),", 1
    )
    search_js = search_js.replace(
        "terms: [normalise(base), ...italian.map(normalise)]",
        "terms: [normalise(base), ...italian.map(normalise), ...dutch.map(normalise)]", 1
    )
    if "dutch.map(normalise)" not in search_js or "const dutch = dutchTermsFor" not in search_js:
        raise RuntimeError("Dutch search patch incomplete")
    search_file.write_text(search_js, encoding="utf-8")

    # Only terms that were explicitly marked nonofficial can be displayed as
    # such. Missing source metadata is unknown, not an official certification.
    anatomy_file = source / "src" / "data" / "anatomy.js"
    anatomy_js = anatomy_file.read_text(encoding="utf-8")
    before = "official: entry.official !== false"
    if before not in anatomy_js:
        raise RuntimeError("Upstream terminology flag changed")
    anatomy_file.write_text(anatomy_js.replace(
        before, "official: entry.official === false ? false : null", 1
    ), encoding="utf-8")

    # Load the local, responsive shortcut interface after the original viewer.
    explore_source = Path(__file__).resolve().parent.parent / "content" / "anatomie" / "explore.js"
    shutil.copyfile(explore_source, source / "src" / "ui" / "eaiExplore.js")
    main_file = source / "src" / "main.js"
    main_js = main_file.read_text(encoding="utf-8")
    hook = "import { initUI } from './ui/sidebar.js';"
    if hook not in main_js:
        raise RuntimeError("Upstream viewer import changed")
    main_js = main_js.replace(hook, hook + "\nimport { initEAIExplore } from './ui/eaiExplore.js';", 1)
    hook = "      await initUI(viewer);"
    if hook not in main_js:
        raise RuntimeError("Upstream UI initialisation changed")
    main_js = main_js.replace(hook, hook + "\n      initEAIExplore(viewer);", 1)
    main_file.write_text(main_js, encoding="utf-8")

    # The runtime fetches JSON translations and replaces the JS fallback.
    # Patch that downloaded dictionary too, so the visible UI remains Dutch.
    runtime_en = source / "public" / "data" / "translations" / "en.json"
    runtime_dictionary = json.loads(runtime_en.read_text(encoding="utf-8"))
    runtime_dictionary.update({
        "search_placeholder": "Zoek een anatomische structuur...",
        "systems": "Lichaamsstelsels", "info": "Informatie",
        "front_view": "Voor", "side_view": "Zij",
        "back_view": "Achter", "top_view": "Boven",
        "reset": "Herstel", "depth": "Diepte",
        "help": "Hulp", "help_title": "Bediening",
        "loading_model": "Anatomisch model laden...",
        "select_structure": "Kies een anatomische structuur",
        "click_to_select": "Klik op een structuur voor informatie",
        "isolate": "Isoleer", "hide": "Verberg",
        "transparent": "Transparant", "show_all": "Alles tonen",
        "name": "Naam", "system": "Stelsel",
        "region": "Regio", "description": "Beschrijving",
        "no_results": "Geen resultaten", "retry": "Opnieuw",
        "action_isolate": "Isoleer", "action_hide": "Verberg",
        "action_restore": "Alles tonen"
    })
    runtime_dictionary.update({
        "system_skeletal": "Skelet", "system_muscular": "Spieren",
        "system_joints": "Gewrichten", "system_cardiovascular": "Hart en bloedvaten",
        "system_nervous": "Zenuwstelsel", "system_lymphatic": "Lymfestelsel",
        "system_visceral": "Organen", "system_respiratory": "Ademhalingsstelsel",
        "system_digestive": "Spijsverteringsstelsel",
        "system_urinary": "Urinewegen",
        "loading_system": "Stelsel laden: {system}",
        "loading_systems": "Stelsels laden...",
        "loading_structure": "Structuur laden...",
        "loading_definition": "Beschrijving ophalen...",
        "no_data_available": "Geen informatie beschikbaar over deze structuur",
        "structure_not_found": "Structuur niet gevonden",
        "error_loading_model": "Het 3D-model kon niet worden geladen",
        "error_loading_data": "De gegevens konden niet worden geladen",
        "latin_name": "Latijnse naam", "functions": "Functies",
        "origin": "Oorsprong", "insertion": "Aanhechting",
        "innervation": "Zenuwvoorziening", "vascularization": "Doorbloeding",
        "clinical_notes": "Klinische toelichting", "parts": "Onderdelen",
        "help_controls": "Bediening", "help_drag_left": "Slepen",
        "help_rotate": "Draaien", "help_wheel": "Muiswiel",
        "help_zoom": "Zoomen", "help_drag_right": "Rechts slepen",
        "help_pan": "Verschuiven", "help_double_click": "Dubbelklikken",
        "help_approach": "Structuur in beeld",
        "help_one_finger": "Eén vinger", "help_pinch": "Knijpen om te zoomen",
        "help_two_fingers": "Twee vingers", "help_tap": "Tikken",
        "view_front": "Vooraanzicht", "view_back": "Achteraanzicht",
        "view_left": "Linkerzijaanzicht", "view_right": "Rechterzijaanzicht",
        "view_top": "Bovenaanzicht", "view_bottom": "Onderaanzicht",
        "view_full": "Totaalbeeld",
        "action_transparent": "Maak transparant", "action_search": "Zoeken",
        "action_restore": "Alles tonen", "action_isolate": "Isoleer",
        "action_hide": "Verberg", "error": "Fout", "close": "Sluiten",
        "region_head": "Hoofd", "region_neck": "Hals",
        "region_thorax": "Borstkas", "region_abdomen": "Buik",
        "region_upper_limb": "Arm", "region_lower_limb": "Been",
        "side_left": "Links", "side_right": "Rechts",
        "help_touch": "Aanraken", "help_panels": "Panelen",
        "help_credits": "Bronnen en licenties",
        "help_frame": "Structuur in beeld brengen",
        "help_select": "Selecteren", "help_left_drag": "Links slepen",
        "help_right_drag": "Rechts slepen",
        "help_two_finger": "Met twee vingers verschuiven",
        "help_left_panel": "Links: lichaamsstelsels",
        "help_right_panel": "Rechts: informatie over de structuur",
        "help_bottom_bar": "Onder: acties bij selectie",
        "help_toolbar": "Kijkrichtingen", "controls_title": "Bediening",
        "no_definition": "Voor deze structuur is nog geen beschrijving beschikbaar.",
        "read_more": "Zoek meer op Wikipedia",
        "non_official": "Niet-officiële term",
        "non_official_hint": "Niet opgenomen in de oorspronkelijke Terminologia Anatomica",
        "part_of": "Onderdeel van", "contains": "Bevat",
        "opaque": "Niet transparant",
    })
    runtime_en.write_text(
        json.dumps(runtime_dictionary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


    atlas_html = index.read_text(encoding="utf-8")
    viewer_anchor = '<div id="viewerContainer" class="viewer-container">'
    if viewer_anchor not in atlas_html:
        raise RuntimeError("Viewer container missing")
    intro = ('<div class="eai-stage-intro" aria-hidden="true">'
             '<span class="eai-stage-kicker">ANATOMIE / 3D-ATLAS</span>'
             '<h2>Het menselijk lichaam</h2>'
             '<p>Draai het model. Kies een stelsel. '
             'Klik op een structuur om verder te kijken.</p></div>')
    atlas_html = atlas_html.replace(viewer_anchor, viewer_anchor + intro, 1)
    atlas_html = atlas_html.replace('>Alle tools</a>',
        '><span class="eai-back-full">Alle tools</span>'
        '<span class="eai-back-small">EAI</span></a>', 1)
    atlas_html = atlas_html.replace(
        '<meta name="description" content="Interactive 3D anatomy atlas built on Z-Anatomy">',
        '<meta name="description" content="Onderzoek het menselijk lichaam in een interactieve, zelfstandig gehoste 3D-atlas.">', 1
    )
    # Compact teaching entry-points, rendered over the 3D viewer.
    # Each button opens one of our locally hosted GLB models.
    explore_markup = """<nav class="eai-explore" id="eaiExplore" aria-label="Onderzoek een lichaamsstelsel">
      <span class="eai-explore-label">Begin met een stelsel</span>
      <div class="eai-explore-options">
        <button type="button" data-eai-system="skeletal" aria-pressed="true">Skelet</button>
        <button type="button" data-eai-system="muscular" aria-pressed="false">Spieren</button>
        <button type="button" data-eai-system="cardiovascular" aria-pressed="false">Hart en vaten</button>
        <button type="button" data-eai-system="nervous" aria-pressed="false">Zenuwen</button>
        <button type="button" data-eai-system="visceral" aria-pressed="false">Organen</button>
      </div>
      <span class="eai-sr-only" role="status" aria-live="polite" data-eai-explore-status></span>
    </nav>"""
    assert atlas_html.count('<canvas id="threeCanvas"') == 1
    atlas_html = atlas_html.replace('<canvas id="threeCanvas"', explore_markup + '\\n          <canvas id="threeCanvas"', 1)
    index.write_text(atlas_html, encoding="utf-8")

    style = source / "src" / "styles" / "main.css"
    with style.open("a", encoding="utf-8") as f:
        f.write("""
/* EAI Anatomy Observatory: quiet, legible 3D viewer. */
:root{
  --bg-primary:#07111e;--bg-secondary:#0b1828;--bg-tertiary:#142438;
  --bg-hover:#223b4e;--fg-primary:#eaf4ff;--fg-secondary:#adc2d6;
  --fg-muted:#87a0b8;--accent:#80dbe3;--accent-hover:#b2f1f4;
  --accent-dim:#173a49;--border:#284053;--border-hover:#52718a;
  --highlight:#ebc189;--highlight-glow:rgba(235,193,137,.35);
}
body{background:#07111e;color:var(--fg-primary)}
html,body{max-width:100%;overflow-x:hidden}
#app{position:relative;overflow:hidden;max-width:100%;width:100%;min-width:0}
.main-layout,.viewer-section,.viewer-container{min-width:0}
.header{background:#0b1828;border-bottom:1px solid #284053}
.header-left{display:flex;align-items:center;gap:12px}
.header-left .logo{font-size:13px;font-weight:750;letter-spacing:.11em;color:#98e7ed}
.eai-app-name{margin-left:7px;letter-spacing:.01em;font-size:12px;color:#e8f2fa;font-weight:600}
.eai-back{font-size:11px;white-space:nowrap;color:#bbd2e3;border:1px solid #2d5063;
  border-radius:5px;padding:6px 9px;text-decoration:none}
.eai-back:hover{color:white;border-color:#89c5d2}
.system-icon{font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;
  font-size:10px!important;letter-spacing:.03em}
.viewer-container{background:radial-gradient(ellipse at 50% 40%,#142b40 0%,#07111e 73%)}
.eai-attribution{position:absolute;z-index:15;left:14px;bottom:58px;pointer-events:auto;
  background:#0b1828dd;border:1px solid #284053;border-radius:5px;
  padding:5px 8px;color:#9db8cb;font:10px/1.5 ui-monospace,monospace}
.eai-attribution a{color:#b3e3e9;text-decoration:underline;text-underline-offset:2px;margin-left:8px}
@media(max-width:680px){
  .eai-app-name{display:none}.eai-back{padding:5px 7px}
  .eai-attribution{font-size:9px;max-width:80%;line-height:1.35}
  /* Keep controls usable and credits readable on narrow screens. */
  .viewer-controls{
    position:absolute!important;left:50%!important;bottom:49px!important;
    transform:translateX(-50%)!important;
    display:flex;flex-wrap:nowrap;gap:3px;padding:5px;
    width:max-content;max-width:calc(100% - 16px)
  }
  .viewer-controls .control-btn{padding:6px 8px;font-size:11px;white-space:nowrap}
  .eai-attribution{
    left:50%;bottom:7px;transform:translateX(-50%);
    max-width:calc(100% - 12px);width:max-content;white-space:nowrap;
    font-size:8px;line-height:1.2;padding:4px 6px;text-align:center
  }
}
""")

    layout_file = Path(__file__).resolve().parent.parent / "content" / "anatomie" / "layout.css"
    with style.open("a", encoding="utf-8") as f:
        f.write("\n" + layout_file.read_text(encoding="utf-8"))

def build(destination: Path) -> None:
    if not destination.as_posix().replace("\\", "/").endswith("tools/anatomie"):
        raise ValueError("Destination must end in tools/anatomie")
    with tempfile.TemporaryDirectory(prefix="eai-anatomie-") as tmp:
        source = Path(tmp) / "upstream"
        command("git", "clone", "--depth", "1", "--single-branch",
                "--branch", "master", SOURCE_URL, str(source), cwd=Path(tmp))
        actual = command("git", "rev-parse", "HEAD", cwd=source)
        if actual != SOURCE_COMMIT:
            raise RuntimeError(f"Upstream commit changed: expected {SOURCE_COMMIT}, got {actual}")
        for rel in ("LICENSE", "NOTICE", "public/models/License.txt", "package-lock.json"):
            if not (source / rel).is_file():
                raise RuntimeError(f"Required source file missing: {rel}")
        patch_upstream(source)
        refit_shell(source)
        command("npm", "ci", "--no-audit", "--no-fund", cwd=source)
        command("npm", "run", "lint", cwd=source)
        command("npm", "run", "build", "--", f"--base={BASE}", cwd=source)
        dist = source / "dist"
        index = dist / "index.html"
        if not index.is_file():
            raise RuntimeError("Vite did not generate an index.html")
        for system in SYSTEMS:
            file = dist / "models" / f"{system}.glb"
            if not file.is_file() or file.stat().st_size < 10000:
                raise RuntimeError(f"Missing or incomplete anatomical model: {system}")
            if file.open("rb").read(4) != b"glTF":
                raise RuntimeError(f"Invalid glTF header: {system}")
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(dist, destination)
        shutil.copyfile(source / "LICENSE", destination / "LICENSE.txt")
        shutil.copyfile(source / "NOTICE", destination / "NOTICE.txt")
        (destination / "UPSTREAM_COMMIT.txt").write_text(
            "Z-Anatomy derivative: nqwrc/3d-anatomy\n"
            f"Commit: {SOURCE_COMMIT}\n"
            "Original models: BodyParts3D / Z-Anatomy. See NOTICE.txt and LICENSE.txt.\n",
            encoding="utf-8",
        )
        print(f"Self-hosted anatomy atlas ready: {destination}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("site-build/tools/anatomie"))
    build(parser.parse_args().out)
