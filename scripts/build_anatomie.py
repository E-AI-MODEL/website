#!/usr/bin/env python3
"""Build the self-hosted EAI Anatomy Atlas from a pinned, credited source.

Nothing is fetched by the visitor from another website. The GitHub Actions build
fetches the pinned upstream source, compiles it and copies every asset locally.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

SOURCE_URL = "https://github.com/nqwrc/3d-anatomy.git"
SOURCE_COMMIT = "8ca3b7421bcfbe88b85859eb1983d5cf79f21749"
BASE = "/tools/anatomie/"
SYSTEMS = (
    "skeletal", "muscular", "joints", "cardiovascular",
    "lymphatic", "nervous", "visceral",
)

def command(*args: str, cwd: Path) -> str:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True)
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
    sidebar.write_text(js, encoding="utf-8")

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
