// EAI: stelsels transparant maken, geen fictieve anatomische doorsnede.
// De enkele laag van een stelsel (zoals het zenuwstelsel) heeft geen schuif nodig.
import { state, subscribe } from '../state/store.js';
import { getSystemVisibilityState, setSystemTransparency } from '../viewer/visibility.js';

const ORDER = ['muscular','lymphatic','cardiovascular','visceral','joints','nervous','skeletal'];
const NAMES = { muscular:'Spieren',lymphatic:'Lymfe',cardiovascular:'Hart en vaten',
  visceral:'Organen',joints:'Gewrichten',nervous:'Zenuwen',skeletal:'Skelet' };
let slider = null;
let wrapper = null;
let label = null;
let active = [];
let applying = false;

function visibleLayers() {
  return ORDER.filter(id =>
    state.loadedSystems.includes(id) && getSystemVisibilityState(id).visible
  );
}

function sync() {
  if (!wrapper) return;
  if (applying) return;
  active = visibleLayers();
  const useful = active.length >= 2;
  wrapper.hidden = !useful;
  if (!useful) {
    if (slider) slider.value = '0';
    if (label) label.textContent = 'Kies meer stelsels om lagen te vergelijken';
  } else {
    updateLabel(Number(slider.value));
  }
}

function updateLabel(value) {
  if (!label || !active.length) return;
  if (value <= 0) {
    label.textContent = 'Alle gekozen stelsels zijn zichtbaar';
    return;
  }
  const progress = (value / 100) * Math.max(0,active.length - 1);
  const whole = Math.min(Math.floor(progress),active.length - 1);
  const faded = active.slice(0,Math.max(whole,1)).map(id=>NAMES[id]).join(', ');
  label.textContent = faded + ' transparanter; ' + NAMES[active.at(-1)] + ' blijft zichtbaar';
}

function applyDepth(value) {
  if (!slider || active.length < 2) return;
  applying = true;
  try {
    // Leave the final system fully visible. No slider position may erase
    // the entire scene. Opacities below 0.2 are too ambiguous on phones.
    const progress = value / 100 * (active.length - 1);
    active.forEach((id,index) => {
      const opacity = index === active.length - 1
        ? 1
        : Math.max(.20, Math.min(1, 1 - (progress - index)));
      setSystemTransparency(id, opacity);
    });
    updateLabel(value);
  } finally {
    applying = false;
  }
}
export function initDepthSlider() {
  const container = document.getElementById('viewerContainer');
  if (!container || slider) return;
  wrapper = document.createElement('section');
  wrapper.className = 'depth-control eai-layer-control';
  wrapper.hidden = true;
  wrapper.innerHTML = `
    <label class="depth-label" for="depthSlider">Stelsels vergelijken</label>
    <input type="range" id="depthSlider" class="depth-slider" min="0" max="100"
           step="5" value="0" aria-describedby="eaiLayerHint">
    <span class="eai-layer-caption" id="eaiLayerHint" role="status" aria-live="polite"></span>
  `;
  container.appendChild(wrapper);
  slider = wrapper.querySelector('#depthSlider');
  label = wrapper.querySelector('#eaiLayerHint');
  slider.addEventListener('input', event => applyDepth(Number(event.target.value)));
  subscribe('systemShown', resetDepthSlider);
  subscribe('systemHidden', resetDepthSlider);
  subscribe('allPartsRestored', resetDepthSlider);
  sync();
  return wrapper;
}
export function resetDepthSlider() {
  if (!slider) return;
  if (!applying) {
    // Restore previous layers before resetting the value.
    const old = active;
    applying = true;
    try { old.forEach(id => setSystemTransparency(id, 1)); }
    finally { applying = false; }
  }
  slider.value = '0';
  sync();
}
