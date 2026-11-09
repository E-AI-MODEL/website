// Eén regeling om overlappende stelsels transparanter te maken.
// Geen fictieve anatomische doorsnede: de GLB-data bevatten geen huidlagen.
import { state, subscribe } from '../state/store.js';
import { getSystemVisibilityState, setSystemTransparency } from '../viewer/visibility.js';

const ORDER = ['muscular','lymphatic','cardiovascular','visceral','joints','nervous','skeletal'];
const LABEL = { muscular:'spieren', lymphatic:'lymfestelsel', cardiovascular:'hart en bloedvaten',
  visceral:'organen', joints:'gewrichten', nervous:'zenuwstelsel', skeletal:'skelet' };

let wrapper = null;
let slider = null;
let status = null;
let loadedVisible = [];
let updating = false;

function shown() {
  return ORDER.filter(id => state.loadedSystems.includes(id) && getSystemVisibilityState(id).visible);
}
function updateStatus(value) {
  if (!status) return;
  if (value === 0) {
    status.textContent = 'Alle gekozen stelsels zichtbaar';
    return;
  }
  const active = loadedVisible;
  const n = Math.max(0,Math.min(active.length-2,Math.floor(value / 100 * (active.length-1))));
  const fading = active.slice(0,n+1).map(id => LABEL[id]).join(', ');
  status.textContent = fading + ' transparanter. ' + LABEL[active.at(-1)] + ' blijft zichtbaar.';
}
function sync() {
  if (!wrapper || updating) return;
  loadedVisible = shown();
  wrapper.hidden = loadedVisible.length < 2;
  if (wrapper.hidden) {
    slider.value = '0';
    if (status) status.textContent = '';
  } else {
    updateStatus(Number(slider.value));
  }
}
function apply(value) {
  if (loadedVisible.length < 2) return;
  updating = true;
  try {
    const progress = value / 100 * (loadedVisible.length - 1);
    loadedVisible.forEach((id,index) => {
      // Een stelsel blijft zichtbaar; de laatste laag blijft volledig intact.
      const opacity = index === loadedVisible.length-1 ? 1
        : Math.max(0.24, Math.min(1, 1 - (progress-index)));
      setSystemTransparency(id, opacity);
    });
    updateStatus(value);
  } finally { updating = false; }
}

export function initDepthSlider() {
  const container = document.getElementById('viewerContainer');
  if (!container || slider) return wrapper;
  wrapper = document.createElement('div');
  wrapper.className = 'depth-control eai-layer-control';
  wrapper.hidden = true;
  wrapper.innerHTML = `<label class="depth-label" for="depthSlider">Stelsels vergelijken</label>
    <input type="range" id="depthSlider" class="depth-slider" min="0" max="100"
      value="0" step="5" aria-describedby="eaiDepthStatus">
    <span id="eaiDepthStatus" class="eai-depth-status" role="status" aria-live="polite"></span>`;
  container.appendChild(wrapper);
  slider = wrapper.querySelector('#depthSlider');
  status = wrapper.querySelector('#eaiDepthStatus');
  slider.addEventListener('input', () => apply(Number(slider.value)));
  subscribe('systemShown', resetDepthSlider);
  subscribe('systemHidden', resetDepthSlider);
  subscribe('allPartsRestored', resetDepthSlider);
  sync();
  return wrapper;
}

export function resetDepthSlider() {
  if (!slider) return;
  if (!updating) {
    const wasVisible = loadedVisible;
    updating = true;
    try { wasVisible.forEach(id => setSystemTransparency(id, 1)); }
    finally { updating = false; }
  }
  slider.value = '0';
  sync();
}
