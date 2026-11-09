"""Aanpassingen aan de gepinde anatomieviewer: één informatiescherm en minder dubbele bediening."""
from pathlib import Path
import shutil


def replace_once(source: str, old: str, new: str, what: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Anatomie {what}: expected exactly one match, got {count}")
    return source.replace(old, new, 1)


def apply(source: Path) -> None:
    local = Path(__file__).resolve().parent.parent / "content" / "anatomie"
    shutil.copyfile(local / "guide.js", source / "src" / "ui" / "eaiGuide.js")
    shutil.copyfile(local / "depthSlider.js", source / "src" / "ui" / "depthSlider.js")

    selection = source / "src" / "viewer" / "selection.js"
    script = selection.read_text(encoding="utf-8")
    script = replace_once(
        script,
        "import { loadDefinitions } from '../data/anatomy.js';",
        "import { loadDefinitions } from '../data/anatomy.js';\n"
        "import { anatomyGuide } from '../ui/eaiGuide.js';\n"
        "import { setInert } from '../ui/focus.js';",
        "selection imports",
    )
    script = replace_once(
        script,
        """  showCallout(partId, partData.displayName, {
    isolate: id => isolatePart(id),
    hide: id => { hidePart(id); deselectPart(); },
    close: () => deselectPart()
  });""",
        """  showCallout(partId, partData.displayName, {
    close: () => deselectPart()
  });""",
        "single selection label",
    )
    script = replace_once(
        script,
        "  // Show footer actions\n  showFooterActions();",
        "  // All structure actions live inside the information panel.",
        "remove duplicate bottom bar",
    )
    script = replace_once(
        script,
        "  const name = info.name?.[lang] || info.name?.en || partData.displayName;",
        """  const guide = anatomyGuide(info.baseName || partData.id);
  const name = guide?.name || info.name?.[lang] || info.name?.en || partData.displayName;""",
        "exact curated name",
    )
    script = replace_once(
        script,
        """    ${relationMarkup(partData.id, lang)}
    <div class="structure-description" data-definition>${escapeHtml(translate('loading_definition', lang))}</div>""",
        """    ${guide ? `
      <section class="eai-fact"><h4>Functie</h4><p>${escapeHtml(guide.function)}</p></section>
      <section class="eai-fact"><h4>Ligging</h4><p>${escapeHtml(guide.location)}</p></section>
      <section class="eai-fact"><h4>Werking en verbindingen</h4><p>${escapeHtml(guide.mechanism)}</p></section>
    ` : `
      <p class="eai-no-guide">Voor deze afzonderlijke structuur is nog geen gecontroleerde Nederlandse functiebeschrijving beschikbaar. De oorspronkelijke Engelse tekst staat hieronder, voor zover aanwezig.</p>
    `}
    ${relationMarkup(partData.id, lang)}
    <div class="eai-details-actions" aria-label="Acties voor dit onderdeel">
      <button type="button" data-eai-action="isolate" title="De andere structuren tijdelijk verbergen">Toon alleen dit</button>
      <button type="button" data-eai-action="hide" title="Dit onderdeel verbergen">Verberg dit onderdeel</button>
      <button type="button" data-eai-action="restore" title="Alle verborgen onderdelen opnieuw tonen">Toon alles</button>
    </div>
    <details class="eai-original-source">
      <summary>Engelstalige bronbeschrijving</summary>
      <p>Deze brontekst is niet afzonderlijk op juistheid voor dit modelonderdeel gecontroleerd.</p>
      <div class="structure-description" data-definition>${escapeHtml(translate('loading_definition', lang))}</div>
    </details>""",
        "curated detail body",
    )
    script = replace_once(
        script,
        """  fillDefinition(partData, lang);
}""",
        """  structureInfo.querySelector('[data-eai-action="isolate"]')?.addEventListener('click', () => {
    isolatePart(partData.id);
  });
  structureInfo.querySelector('[data-eai-action="hide"]')?.addEventListener('click', () => {
    hidePart(partData.id);
    deselectPart();
  });
  structureInfo.querySelector('[data-eai-action="restore"]')?.addEventListener('click', () => {
    restoreAllParts();
    deselectPart();
  });
  const panel = document.getElementById('infoSidebar');
  if (panel) {
    document.getElementById('app')?.classList.add('info-open');
    panel.style.transform = 'translateX(0)';
    setInert(panel, false);
    document.getElementById('infoOpen')?.setAttribute('aria-expanded', 'true');
  }
  fillDefinition(partData, lang);
}""",
        "open the information on selection",
    )
    script = replace_once(
        script,
        "import { highlightMesh, clearHighlight, ghostAllExcept, clearGhost, isolatePart, hidePart } from './visibility.js';",
        "import { highlightMesh, clearHighlight, ghostAllExcept, clearGhost, isolatePart, hidePart, restoreAllParts } from './visibility.js';",
        "restore action import",
    )
    script = replace_once(
        script,
        """  if (structureInfo) structureInfo.classList.add('hidden');
}

function showFooterActions()""",
        """  if (structureInfo) structureInfo.classList.add('hidden');
  const panel = document.getElementById('infoSidebar');
  if (panel) {
    document.getElementById('app')?.classList.remove('info-open');
    panel.style.transform = 'translateX(100%)';
    setInert(panel, true);
    document.getElementById('infoOpen')?.setAttribute('aria-expanded', 'false');
  }
}

function showFooterActions()""",
        "hide info on deselection",
    )
    script = replace_once(
        script,
        "  target.innerHTML = `\n    ${escapeHtml(text)}",
        "  target.innerHTML = `\n    ${escapeHtml(text)}",
        "preserve source text rendering",
    ) if False else script
    selection.write_text(script, encoding="utf-8")

    callout = source / "src" / "ui" / "callout.js"
    content = callout.read_text(encoding="utf-8")
    content = replace_once(
        content,
        """      <div class="callout-actions">
        <button type="button" class="callout-btn" data-callout="isolate"></button>
        <button type="button" class="callout-btn" data-callout="hide"></button>
        <button type="button" class="callout-btn callout-close" data-callout="close" aria-label="Chiudi">&times;</button>
      </div>""",
        """      <button type="button" class="callout-btn callout-close" data-callout="close" aria-label="Sluit de selectie">&times;</button>""",
        "remove duplicate callout actions",
    )
    content = replace_once(
        content,
        """  root.querySelector('[data-callout="isolate"]').textContent = translate('isolate');
  root.querySelector('[data-callout="hide"]').textContent = translate('hide');""",
        "  // The label identifies the structure. Actions are in its information panel.",
        "callout text patch",
    )
    callout.write_text(content, encoding="utf-8")

    html = source / "index.html"
    markup = html.read_text(encoding="utf-8")
    markup = replace_once(
        markup,
        '<h2>Information</h2>',
        '<h2>Geselecteerd onderdeel</h2>',
        "information heading",
    )
    html.write_text(markup, encoding="utf-8")
