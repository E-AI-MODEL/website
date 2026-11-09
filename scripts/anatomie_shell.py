"""Native EAI interface around the real, locally hosted anatomical meshes.

Keeps all 3D data, selectable structures, source attribution, viewer actions and
keyboard/mobile behaviour. This changes only the presentation and controls.
"""
from __future__ import annotations

import re
from pathlib import Path


def require_replace(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"Expected one {label}, got {count}")
    return source.replace(before, after, 1)


def refit_shell(source: Path) -> None:
    html_file = source / "index.html"
    html = html_file.read_text(encoding="utf-8")

    header = """<header class="header">
      <div class="header-left">
        <a class="eai-brand" href="/nl/tools/" aria-label="EAI, naar alle tools">EAI</a>
        <span class="eai-brand-divider" aria-hidden="true">/</span>
        <h1 class="logo">Anatomisch observatorium</h1>
      </div>
      <div class="header-center">
        <div class="search-container">
          <label class="eai-screenreader" for="searchInput">Zoek een anatomische structuur</label>
          <input type="search" id="searchInput" class="search-input"
                 placeholder="Zoek bot, spier of orgaan…" autocomplete="off">
          <div id="searchResults" class="search-results"></div>
        </div>
      </div>
      <div class="header-right">
        <button id="systemsOpen" class="eai-header-button drawer-open" type="button"
                aria-label="Lichaamsstelsels kiezen" aria-controls="systemsSidebar"
                aria-expanded="false" title="Lichaamsstelsels kiezen">
          <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17"
               fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="2" fill="var(--bg-secondary)"/>
            <circle cx="13" cy="10" r="2" fill="var(--bg-secondary)"/>
          </svg>
          <span>Stelsels</span>
        </button>
        <button id="searchOpen" class="eai-icon-button drawer-open" type="button"
                aria-label="Zoeken" aria-expanded="false" title="Zoeken">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 5 5"/>
          </svg>
        </button>
        <button id="infoOpen" class="eai-icon-button" type="button"
                aria-label="Informatie bij gekozen structuur" title="Informatie bij gekozen structuur">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>
          </svg>
        </button>
        <button id="helpBtn" class="eai-icon-button" type="button"
                aria-label="Uitleg bediening" title="Uitleg bediening">?</button>
        <a class="eai-back" href="/nl/tools/">Alle tools</a>
      </div>
    </header>"""
    html, count = re.subn(
        r'<header class="header">[\s\S]*?</header>', header, html, count=1
    )
    if count != 1:
        raise RuntimeError("Expected upstream page header")
    html = require_replace(
        html,
        'aria-label="3D anatomy viewer. Arrow keys orbit, plus and minus zoom."',
        'aria-label="Interactief driedimensionaal menselijk lichaam. Slepen om te draaien, scrollen om te zoomen, klikken om een onderdeel te kiezen."',
        "3D viewer accessible name",
    )
    help_section = """<!-- Hulp is pas zichtbaar nadat de bezoeker op ? klikt. -->
    <div class="modal hidden" id="helpModal" role="dialog" aria-labelledby="helpTitle" aria-modal="true">
      <div class="modal-overlay"></div>
      <div class="modal-content eai-help-modal">
        <div class="modal-header">
          <h3 id="helpTitle">Zo werkt de atlas</h3>
          <button class="modal-close" id="helpClose" aria-label="Sluiten">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>Draaien</strong> met de muis of één vinger.</p>
          <p><strong>Zoomen</strong> door te scrollen of twee vingers uit elkaar te bewegen.</p>
          <p><strong>Onderzoeken</strong> door een lichaamsdeel aan te klikken of via zoeken te vinden.</p>
          <p><strong>Stelsels</strong> open je via de knop bovenaan. Daar kun je botten, organen, spieren en andere stelsels tonen.</p>
          <p class="eai-help-note">De modellen zijn bedoeld voor onderwijs en onderzoek, niet voor medische diagnose.
            Anatomische benamingen uit de oorspronkelijke bron kunnen Engelstalig zijn.</p>
          <p class="eai-help-sources"><a href="/tools/anatomie/NOTICE.txt">Alle modelbronnen</a>
            <a href="/tools/anatomie/LICENSE.txt">Licentievoorwaarden</a></p>
        </div>
      </div>
    </div>"""
    html, count = re.subn(
        r'<!-- Help Modal -->[\s\S]*?(?=\n  </div>\s*\n\s*<script type="module" src="/src/main.js")',
        help_section, html, count=1
    )
    if count != 1:
        raise RuntimeError("Expected upstream help dialog")
    html = html.replace(
        '><span class="eai-back-full">Alle tools</span><span class="eai-back-small">EAI</span></a>',
        '>Alle tools</a>'
    )
    # Compact details panel and source footer. Do not delete required credits.
    html = html.replace(
        '3D-modellen: BodyParts3D en Z-Anatomy',
        'Modellen: BodyParts3D · Z-Anatomy',
        1
    )
    html = html.replace(
        'aria-label="Close systems"',
        'aria-label="Stelsels sluiten"'
    ).replace(
        'aria-label="Close information"',
        'aria-label="Informatie sluiten"'
    )
    html = html.replace(
        '<h2>Het menselijk lichaam</h2>',
        '<h2>Menselijke anatomie</h2>'
    ).replace(
        '<p>Draai het model. Kies een stelsel. Klik op een structuur om verder te kijken.</p>',
        '<p>Draai, zoom en onderzoek ieder onderdeel zelf.</p>'
    )
    html_file.write_text(html, encoding="utf-8")

    # Reuse the existing source's focus, drawer-close and keyboard handling, but
    # treat the systems panel as a drawer at all widths, not a desktop column.
    sidebar_file = source / "src" / "ui" / "sidebar.js"
    js = sidebar_file.read_text(encoding="utf-8")
    js = require_replace(
        js,
        "const drawerQuery = window.matchMedia('(max-width: 1024px)');",
        "const drawerQuery = window.matchMedia('(min-width: 0px)');",
        "drawer width",
    )
    sidebar_file.write_text(js, encoding="utf-8")
