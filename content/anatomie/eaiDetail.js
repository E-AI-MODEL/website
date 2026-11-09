// Eén informatiepaneel per geselecteerde structuur. Modelacties staan
// na de anatomische informatie, niet in meerdere zwevende menu's.
import { anatomyGuide } from '../data/eaiGuide.js';
import { isolatePart, hidePart, restoreAllParts } from '../viewer/visibility.js';

const textBlock = (parent, heading, description) => {
  const section = document.createElement('section');
  section.className = 'eai-fact';
  const title = document.createElement('h4');
  title.textContent = heading;
  const paragraph = document.createElement('p');
  paragraph.textContent = description;
  section.append(title, paragraph);
  parent.appendChild(section);
};

function modelButton(label, title, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.addEventListener('click', handler);
  return button;
}

export function refineAnatomyInfo(partData, deselectPart) {
  const panel = document.getElementById('structureInfo');
  if (!panel) return;

  const info = partData.info || {};
  const guide = anatomyGuide(info.baseName || partData.id);
  const title = panel.querySelector('.structure-title h3');

  if (guide?.name && title) {
    const localName = guide.name + (
      info.side === 'left' ? ' (links)' : info.side === 'right' ? ' (rechts)' : ''
    );
    title.textContent = localName;
    // Hetzelfde onderdeel krijgt in de 3D-callout dezelfde Nederlandse naam.
    const anchoredName = document.querySelector('.callout-name');
    if (anchoredName) anchoredName.textContent = localName;
  }

  const facts = document.createElement('div');
  facts.className = 'eai-facts';
  if (guide) {
    textBlock(facts, 'Functie', guide.function);
    textBlock(facts, 'Ligging en verbindingen', guide.location);
    textBlock(facts, 'Werking', guide.mechanism);
  } else {
    const notice = document.createElement('p');
    notice.className = 'eai-facts-unverified';
    notice.textContent = 'Voor dit onderdeel ontbreekt nog een specifieke Nederlandstalige functieomschrijving. De oorspronkelijke bronbeschrijving staat hieronder, indien beschikbaar.';
    facts.appendChild(notice);
  }

  const header = panel.querySelector('.structure-header');
  header?.insertAdjacentElement('afterend', facts);

  // Bronbeschrijvingen zijn niet noodzakelijk juist voor elk specifiek
  // onderdeel. Maak ze raadpleegbaar, maar niet de primaire uitleg.
  const definition = panel.querySelector('[data-definition]');
  if (definition) {
    const source = document.createElement('details');
    source.className = 'eai-source-description';
    source.open = !guide;
    const summary = document.createElement('summary');
    summary.textContent = 'Oorspronkelijke bronbeschrijving (Engels)';
    definition.replaceWith(source);
    source.append(summary, definition);
  }

  const actions = document.createElement('div');
  actions.className = 'eai-detail-actions';
  const heading = document.createElement('h4');
  heading.textContent = 'Onderdeel bekijken';
  actions.appendChild(heading);
  actions.appendChild(modelButton(
    'Toon alleen dit',
    'Verberg de andere structuren om dit onderdeel afzonderlijk te bekijken',
    () => isolatePart(partData.id)
  ));
  actions.appendChild(modelButton(
    'Verberg dit onderdeel',
    'Verwijder uitsluitend dit onderdeel uit de 3D-weergave',
    () => { hidePart(partData.id); deselectPart(); }
  ));
  panel.appendChild(actions);
}

export function openAnatomyInfo() {
  const app = document.getElementById('app');
  if (app && !app.classList.contains('info-open')) {
    document.getElementById('infoOpen')?.click();
  }
  app?.classList.add('has-selection');
}

export function closeAnatomyInfo() {
  const app = document.getElementById('app');
  if (app?.classList.contains('info-open')) {
    document.getElementById('infoOpen')?.click();
  }
  app?.classList.remove('has-selection');
}

export function mountVisibilityReset() {
  const container = document.getElementById('systemsList');
  if (!container || document.getElementById('eai-show-all')) return;
  const button = modelButton(
    'Alle onderdelen weer tonen',
    'Herstel verborgen structuren en maak transparante delen weer zichtbaar',
    () => {
      restoreAllParts();
      const depth = document.getElementById('depthSlider');
      if (depth) {
        depth.value = '0';
        depth.dispatchEvent(new Event('input', { bubbles:true }));
      }
    }
  );
  button.id = 'eai-show-all';
  button.className = 'eai-show-all';
  container.before(button);
}
