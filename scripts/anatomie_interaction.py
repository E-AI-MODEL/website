"""Vereenvoudig Anatomisch Observatorium zonder externe runtimeafhankelijkheden."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent

def exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Anatomie {label}: verwacht 1 bronanker, gevonden {count}")
    return text.replace(old, new, 1)

def improve_anatomy(source: Path) -> None:
    shutil.copyfile(ROOT / "content/anatomie/depthSlider.js", source / "src/ui/depthSlider.js")
    shutil.copyfile(ROOT / "content/anatomie/guide.js", source / "src/data/eaiGuide.js")

    callout_file = source / "src/ui/callout.js"
    callout = callout_file.read_text(encoding="utf-8")
    callout = exact(callout,
        """        <button type="button" class="callout-btn" data-callout="isolate"></button>
        <button type="button" class="callout-btn" data-callout="hide"></button>""",
        """        <button type="button" class="callout-btn" data-callout="info">Informatie</button>""",
        "calloutknoppen")
    callout = exact(callout,
        "  root.querySelector('[data-callout=\"isolate\"]').textContent = translate('isolate');\n"
        "  root.querySelector('[data-callout=\"hide\"]').textContent = translate('hide');\n",
        "", "calloutlabels")
    callout = exact(callout, 'aria-label="Chiudi"', 'aria-label="Sluiten"', "callout sluiten")
    callout = exact(callout,
        "import { state, translate } from '../state/store.js';",
        "import { state } from '../state/store.js';",
        "ongebruikte calloutvertaling")
    callout_file.write_text(callout, encoding="utf-8")

    select_file = source / "src/viewer/selection.js"
    js = select_file.read_text(encoding="utf-8")
    js = exact(js, "import { loadDefinitions } from '../data/anatomy.js';",
      "import { loadDefinitions } from '../data/anatomy.js';\nimport { anatomyGuide } from '../data/eaiGuide.js';",
      "informatie-import")
    js = exact(js,
        """  showCallout(partId, partData.displayName, {
    isolate: id => isolatePart(id),
    hide: id => { hidePart(id); deselectPart(); },
    close: () => deselectPart()
  });""",
        """  const guide = anatomyGuide(info?.baseName || partId);
  showCallout(partId, guide?.name || partData.displayName, {
    info: () => {
      const app = document.getElementById('app');
      if (app && !app.classList.contains('info-open')) document.getElementById('infoOpen')?.click();
    },
    close: () => deselectPart()
  });""", "enkele calloutactie")
    js = exact(js,
        """  // Show info panel
  showInfoPanel(partData);

  // Show footer actions
  showFooterActions();""",
        """  showInfoPanel(partData);
  const app = document.getElementById('app');
  if (app && !app.classList.contains('info-open')) document.getElementById('infoOpen')?.click();""",
        "informatie direct tonen")
    js = exact(js,
        """  setSelectedPart(null);
  hideInfoPanel();
  hideFooterActions();""",
        """  setSelectedPart(null);
  hideInfoPanel();
  const app = document.getElementById('app');
  if (app?.classList.contains('info-open')) document.getElementById('infoOpen')?.click();""",
        "informatie sluiten")
    js = exact(js,
        """  const name = info.name?.[lang] || info.name?.en || partData.displayName;""",
        """  const guide = anatomyGuide(info.baseName || partData.id);
  const name = guide?.name || info.name?.[lang] || info.name?.en || partData.displayName;""",
        "specifieke titel")
    js = exact(js,
        """    ${relationMarkup(partData.id, lang)}
    <div class="structure-description" data-definition>${escapeHtml(translate('loading_definition', lang))}</div>""",
        """    ${guide ? '<div class="eai-guide">' +
      '<section><h4>Functie</h4><p>' + escapeHtml(guide.function) + '</p></section>' +
      '<section><h4>Ligging en verbindingen</h4><p>' + escapeHtml(guide.location) + '</p></section>' +
      '<section><h4>Werking</h4><p>' + escapeHtml(guide.mechanism) + '</p></section>' +
      '</div>' : '<p class="eai-info-gap">Voor dit onderdeel is nog geen gecontroleerde Nederlandse functieomschrijving beschikbaar.</p>'}
    ${relationMarkup(partData.id, lang)}
    <details class="eai-original-description" ${guide ? '' : 'open'}>
      <summary>Oorspronkelijke bronbeschrijving (Engels)</summary>
      <div class="structure-description" data-definition>${escapeHtml(translate('loading_definition', lang))}</div>
    </details>""",
        "uitleg en duidelijke bronstatus")
    js = exact(js,
        "import { highlightMesh, clearHighlight, ghostAllExcept, clearGhost, isolatePart, hidePart } from './visibility.js';",
        "import { highlightMesh, clearHighlight, ghostAllExcept, clearGhost } from './visibility.js';",
        "verwijder ongebruikte acties")
    js = exact(js,
        """function showFooterActions() {
  const footer = document.getElementById('footerBar');
  if (footer) footer.style.display = 'flex';
}

function hideFooterActions() {
  const footer = document.getElementById('footerBar');
  if (footer) footer.style.display = 'none';
}

""",
        "", "dubbele actiebar")
    select_file.write_text(js, encoding="utf-8")

    html_file = source / "index.html"
    html = html_file.read_text(encoding="utf-8")
    start = html.index('    <!-- Bottom bar - Actions for selected structure -->')
    end = html.index('    <!-- Help Modal -->', start)
    html = html[:start] + html[end:]
    html = exact(html, "<h2>Information</h2>", "<h2>Over dit onderdeel</h2>", "informatie-heading")
    html_file.write_text(html, encoding="utf-8")
