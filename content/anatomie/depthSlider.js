// Ontleden bij een enkel geschikt stelsel; stelsels vergelijken bij meerdere.
// Ontleden verbergt echte modelstructuren, maar claimt geen klinische laagindeling.
import { state, subscribe } from '../state/store.js';
import {
  getSystemVisibilityState, setSystemTransparency, setPartTransparency,
  getPartVisibility, setPartVisibility
} from '../viewer/visibility.js';
import { deselectPart } from '../viewer/selection.js';

const ORDER = ['muscular','lymphatic','cardiovascular','visceral','joints','nervous','skeletal'];
const LABELS = {
  muscular:'Spieren', lymphatic:'Lymfestelsel', cardiovascular:'Hart en bloedvaten',
  visceral:'Organen', joints:'Gewrichten', nervous:'Zenuwstelsel', skeletal:'Skelet'
};
const PEELABLE = new Set(['muscular','visceral','cardiovascular','lymphatic']);
const QUIET_REPRODUCTIVE = [
  'Corpus cavernosum of penis','Corpus spongiosum of penis',
  'Glans penis','Testis.l','Testis.r','Epididymis.l','Epididymis.r'
];
const OPACITIES = [1, .82, .62, .42, .24];

let wrapper = null;
let shownSystems = [];
let mode = null;
let focusSystem = 'skeletal';
let compareStep = 0;
let peeled = [];
let adjusting = false;
let statusText = '';

function visibleSystems() {
  return ORDER.filter(id => state.loadedSystems.includes(id) &&
    getSystemVisibilityState(id).visible);
}

function restorePeel() {
  const toRestore = peeled.splice(0);
  toRestore.reverse().forEach(id => setPartVisibility(id, true));
}

function applyComparison() {
  if (adjusting || shownSystems.length < 2) return;
  adjusting = true;
  try {
    const opacity = OPACITIES[compareStep];
    shownSystems.forEach(id => setSystemTransparency(id, id === focusSystem ? 1 : opacity));
    // Only quiet in a comparison with another focus. Choosing Organs as focus
    // restores the original anatomical display; no structures are omitted.
    if (focusSystem !== 'visceral' && shownSystems.includes('visceral')) {
      QUIET_REPRODUCTIVE.forEach(id => {
        if (state.partsData?.[id]) setPartTransparency(id, Math.min(.16, opacity));
      });
    }
  } finally {
    adjusting = false;
  }
}

function render() {
  if (!wrapper) return;
  wrapper.hidden = !mode;
  if (!mode) return;

  if (mode === 'compare') {
    wrapper.innerHTML = '<span class="depth-label">Stelsels vergelijken</span>' +
      '<label class="eai-layer-focus" for="eaiFocusSystem">Blijft duidelijk zichtbaar</label>' +
      '<select id="eaiFocusSystem" aria-label="Stelsel vooraan"></select>' +
      '<div class="eai-step-row">' +
      '<button type="button" data-depth-step="-1" aria-label="Andere stelsels duidelijker maken">−</button>' +
      '<strong class="eai-step-value" aria-live="polite">Stap ' + compareStep + ' van 4</strong>' +
      '<button type="button" data-depth-step="1" aria-label="Andere stelsels transparanter maken">+</button>' +
      '</div><p id="eaiDepthStatus" class="eai-depth-status" role="status">' +
      (compareStep === 0 ? 'Andere stelsels blijven zichtbaar.' :
      'Andere stelsels op ' + Math.round(OPACITIES[compareStep] * 100) + '% zichtbaarheid.') +
      '</p>';
    const select = wrapper.querySelector('#eaiFocusSystem');
    shownSystems.forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = LABELS[id];
      select.appendChild(option);
    });
    select.value = focusSystem;
  } else {
    wrapper.innerHTML = '<span class="depth-label">Onderdeel voor onderdeel ontleden</span>' +
      '<div class="eai-step-row">' +
      '<button type="button" data-depth-step="-1" aria-label="Laatst verwijderde onderdeel terugzetten"' +
      (peeled.length ? '' : ' disabled') + '>−</button>' +
      '<strong class="eai-step-value" aria-live="polite">' + peeled.length + ' weggenomen</strong>' +
      '<button type="button" data-depth-step="1" aria-label="Gekozen onderdeel wegnemen">+</button>' +
      '</div><p id="eaiDepthStatus" class="eai-depth-status" role="status">' +
      (statusText || 'Kies een onderdeel in het model. Met + haal je dat weg en zie je wat erachter ligt.') +
      '</p>';
  }
}

function sync() {
  if (!wrapper || adjusting) return;
  const next = visibleSystems();
  const nextMode = next.length > 1 ? 'compare' :
    next.length === 1 && PEELABLE.has(next[0]) ? 'peel' : null;
  if (nextMode !== mode || next.join('|') !== shownSystems.join('|')) {
    if (peeled.length) restorePeel();
    compareStep = 0;
    statusText = '';
  }
  shownSystems = next;
  mode = nextMode;
  if (mode === 'compare') {
    if (!shownSystems.includes(focusSystem)) {
      focusSystem = shownSystems.includes('skeletal') ? 'skeletal' : shownSystems.at(-1);
    }
    applyComparison();
  }
  render();
}

export function initDepthSlider() {
  const container = document.getElementById('viewerContainer');
  if (!container || wrapper) return wrapper;
  wrapper = document.createElement('div');
  wrapper.className = 'depth-control eai-layer-control';
  wrapper.hidden = true;
  container.appendChild(wrapper);
  wrapper.addEventListener('click', event => {
    const button = event.target.closest('[data-depth-step]');
    if (!button) return;
    const direction = Number(button.dataset.depthStep);
    if (mode === 'compare') {
      compareStep = Math.max(0, Math.min(OPACITIES.length - 1, compareStep + direction));
      applyComparison();
      render();
      return;
    }
    if (mode !== 'peel') return;
    if (direction < 0) {
      const id = peeled.pop();
      if (id) setPartVisibility(id, true);
      statusText = id ? 'Onderdeel teruggezet. Tik op een ander onderdeel om verder te gaan.' : '';
    } else {
      const id = state.selectedPart?.id;
      if (!id || state.partsData?.[id]?.system !== shownSystems[0] ||
        !getPartVisibility(id).visible) {
        statusText = 'Tik eerst op een zichtbaar onderdeel van dit stelsel.';
      } else {
        // Clearing selection also restores the ghosted surrounding structures.
        deselectPart();
        setPartVisibility(id, false);
        peeled.push(id);
        statusText = 'Onderdeel weggenomen. Daarachter kun je verder selecteren.';
      }
    }
    render();
  });
  wrapper.addEventListener('change', event => {
    if (event.target.id !== 'eaiFocusSystem') return;
    focusSystem = event.target.value;
    applyComparison();
    render();
  });

  subscribe('systemShown', resetDepthSlider);
  subscribe('systemHidden', resetDepthSlider);
  subscribe('allPartsRestored', () => {
    peeled = [];
    compareStep = 0;
    statusText = '';
    sync();
  });
  sync();
  return wrapper;
}

// Used by the existing systems toggle. Restore only the changes made here.
export function resetDepthSlider() {
  if (!wrapper || adjusting) return;
  adjusting = true;
  try {
    restorePeel();
    shownSystems.forEach(id => setSystemTransparency(id, 1));
    compareStep = 0;
    statusText = '';
  } finally {
    adjusting = false;
  }
  sync();
}
