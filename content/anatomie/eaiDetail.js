// Eén informatiepaneel per geselecteerde structuur. Modelacties staan
// na de anatomische informatie, niet in meerdere zwevende menu's.
import { anatomyGuide } from '../data/eaiGuide.js';
import { anatomyTeaching } from '../data/eaiTeaching.js';
import { anatomySourceStatus } from '../data/eaiSources.js';
import { anatomyName } from '../data/eaiNames.js';
import { scheduleSelectionClearance } from './cameraUX.js';
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
  const baseName = info.baseName || partData.id;
  const sourceStatus = anatomySourceStatus(baseName);
  const sourceGuide = anatomyGuide(baseName);
  // Toon afzonderlijke functieclaims alleen wanneer een inhoudelijke
  // bron over deze structuur is gekoppeld. De overige tekst blijft bewaard
  // voor redactie, maar wordt niet als gecontroleerde uitleg gepubliceerd.
  const guide = sourceStatus.hasSpecific ? sourceGuide : null;
  const lesson = guide ? null : anatomyTeaching(baseName, info);
  const title = panel.querySelector('.structure-title h3');
  const preferredName = guide?.name || anatomyName(baseName, info);

  if (preferredName && title) {
    const localName = preferredName + (
      info.side === 'left' ? ' (links)' : info.side === 'right' ? ' (rechts)' : ''
    );
    title.textContent = localName;
    const latin = panel.querySelector('.structure-latin');
    if (latin && preferredName === 'Naam van onderdeel onbekend') {
      latin.textContent = 'De naam in het bronmodel is niet betrouwbaar vast te stellen';
    }
    // De bron verwisselt hier het middenvoetsgewricht met het schoudergewricht.
    // Laat een verkeerde Latijnse naam niet als gecontroleerde informatie zien.
    if (latin && baseName === 'Articular capsules of metatarsophalangeal joints') {
      latin.textContent = 'Latijnse bronvermelding wordt gecontroleerd';
    }
    if (latin && preferredName.trim().toLowerCase() === latin.textContent.trim().toLowerCase()) {
      latin.remove();
    }
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
    if (guide.question) textBlock(facts, 'Onderzoek in het 3D-model', guide.question);
  } else if (lesson) {
    textBlock(facts, 'Wat voor onderdeel is dit?', lesson.kind);
    textBlock(facts, 'Hoe werkt dit soort onderdeel?', lesson.explanation);
    textBlock(facts, 'Onderzoek in het 3D-model', lesson.question);
    const note = document.createElement('p');
    note.className = 'eai-facts-unverified';
    note.textContent = 'Dit is algemene uitleg over het type onderdeel. De specifieke werking van dit onderdeel is nog niet afzonderlijk beoordeeld.';
    facts.appendChild(note);
    if (sourceGuide) {
      const pending = document.createElement('p');
      pending.className = 'eai-facts-unverified';
      pending.textContent = 'De afzonderlijke uitleg over deze structuur wordt nog met vakbronnen vergeleken. Tot die tijd zie je hier alleen de algemene uitleg.';
      facts.appendChild(pending);
    }
  } else {
    const notice = document.createElement('p');
    notice.className = 'eai-facts-unverified';
    notice.textContent = 'De naam van dit onderdeel is nog niet betrouwbaar uit de bron af te leiden. De oorspronkelijke bronbeschrijving kun je desgewenst uitklappen.';
    facts.appendChild(notice);
  }

  const header = panel.querySelector('.structure-header');
  header?.insertAdjacentElement('afterend', facts);

  // Het glTF-model geeft ook echte ouder- en kindrelaties. Die zijn
  // modelstructuur, niet zonder meer een medische functionele verbinding.
  const relations = panel.querySelector('.structure-relations');
  if (relations) {
    const section = document.createElement('section');
    section.className = 'eai-model-relations';
    const heading = document.createElement('h4');
    heading.textContent = 'Relaties in het 3D-model';
    const note = document.createElement('p');
    note.textContent = 'Toont de indeling van de modelonderdelen. Selecteer een naam om dat onderdeel te bekijken.';
    section.append(heading, note, relations);
    const definitionTarget = panel.querySelector('[data-definition]');
    definitionTarget?.before(section);
  }

  // Bronbeschrijvingen zijn niet noodzakelijk juist voor elk specifiek
  // onderdeel. Maak ze raadpleegbaar, maar niet de primaire uitleg.
  const definition = panel.querySelector('[data-definition]');
  if (definition) {
    const source = document.createElement('details');
    source.className = 'eai-source-description';
    source.open = false;
    const summary = document.createElement('summary');
    summary.textContent = 'Anatomische beschrijving uit de bron (Engels)';
    const explanation = document.createElement('p');
    explanation.className = 'eai-source-note';
    explanation.textContent = 'Overgenomen uit de meegeleverde atlasgegevens. Deze beschrijving kan algemener zijn dan het gekozen onderdeel.';
    definition.replaceWith(source);
    source.append(summary, explanation, definition);
  }

  // Bronnen zijn per onderwerp gekoppeld. Het zijn geen automatische
  // keurmerken voor de juistheid van alle teksten en 3D-geometrie.
  const teachingSource = guide
    ? sourceStatus.specific
    : anatomySourceStatus(baseName, lesson?.type).general;
  const provenance = document.createElement('details');
  provenance.className = 'eai-source-description';
  const provenanceTitle = document.createElement('summary');
  provenanceTitle.textContent = 'Herkomst en bronnen';
  provenance.appendChild(provenanceTitle);
  const explanation = document.createElement('p');
  explanation.className = 'eai-source-note';
  explanation.textContent = guide
    ? 'De gekoppelde vakbron behandelt deze anatomische structuur. De Nederlandse tekst blijft eigen redactie; de bron beoordeelt de gekozen 3D-geometrie niet.'
    : 'Dit is algemene informatie over een type structuur. De genoemde bron bewijst niet de werking van dit afzonderlijke onderdeel.';
  provenance.appendChild(explanation);
  const addSource = (source, label) => {
    if (!source) return;
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label + ': ' + source.label;
    provenance.appendChild(link);
  };
  addSource(teachingSource, 'Vakbron');
  const nameNotice = document.createElement('p');
  nameNotice.className = 'eai-source-note';
  nameNotice.textContent = 'Nederlandse namen zijn voor leerlingen vertaald. Ze zijn nog niet allemaal vergeleken met de internationale nomenclatuur.';
  provenance.appendChild(nameNotice);
  addSource(sourceStatus.terminology, 'Internationale terminologie ter vergelijking');
  addSource(sourceStatus.model, '3D-gegevens');
  const sourceDescription = panel.querySelector('.eai-source-description');
  if (sourceDescription) sourceDescription.after(provenance);
  else facts.after(provenance);

  // Alleen bij herkenbare hartstructuren: geen lablink bij andere organen
  // of bloedvaten die toevallig in hun uitleg het hart noemen.
  const heartParts = /^(heart|left atrium|right atrium|left ventricle|right ventricle|interventricular septum|interatrial septum|mitral valve|tricuspid valve|aortic valve|pulmonary valve|papillary muscle|myocardium|cardiac muscle)(?:\\b|$)/i;
  if (heartParts.test(String(baseName).trim())) {
    const lab = document.createElement('a');
    lab.className = 'eai-heart-lab-action';
    lab.href = '/tools/anatomie/labs/hartslag/';
    lab.textContent = 'Onderzoek het kloppende hart';
    lab.setAttribute('aria-label', 'Open het interactieve Hartslaglab');
    const labSection = document.createElement('section');
    labSection.className = 'eai-heart-lab';
    const labHint = document.createElement('p');
    labHint.textContent = 'Bekijk hoe hartkamers en kleppen bewegen en hoe het bloed stroomt.';
    labSection.append(labHint, lab);
    facts.after(labSection);
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

  // Een nieuw geselecteerd onderdeel vervangt de uitleg in hetzelfde paneel.
  // De bezoeker begint bij de nieuwe titel, zonder de viewer te verplaatsen.
  const scrollArea = document.querySelector('#infoSidebar .sidebar-content');
  if (scrollArea) scrollArea.scrollTop = 0;
}

export function openAnatomyInfo() {
  const app = document.getElementById('app');
  // Een selectie geeft eerst alleen het verankerde naamlabel. Een al geopend
  // paneel blijft open en toont de tekst van de nieuwe structuur.
  if (app?.classList.contains('systems-open')) {
    document.getElementById('systemsToggle')?.click();
  }
  const header = document.querySelector('.header');
  header?.classList.remove('search-open');
  document.getElementById('searchOpen')?.setAttribute('aria-expanded', 'false');
  app?.classList.add('has-selection');
  if (app?.classList.contains('info-open')) scheduleSelectionClearance();
}

export function toggleAnatomyInfo() {
  const app = document.getElementById('app');
  if (!app?.classList.contains('has-selection')) return;
  // De bestaande drawerbediening blijft eigenaar van focus, inert en Escape.
  document.getElementById('infoOpen')?.click();
  if (app.classList.contains('info-open')) scheduleSelectionClearance();
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
