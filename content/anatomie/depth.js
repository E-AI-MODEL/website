// Deze modellen zijn losse stelsels, geen echte anatomische doorsneden.
// Geef alleen een lagenregeling als twee of meer stelsels getoond worden.
import { state, translate } from '../state/store.js';
import { showSystem, hideSystem, setSystemTransparency } from '../viewer/visibility.js';

const ORDER = ['muscular','lymphatic','cardiovascular','nervous','visceral','joints','skeletal'];
const LABELS = {
  muscular:'Spieren', lymphatic:'Lymfestelsel',
  cardiovascular:'Hart en bloedvaten', nervous:'Zenuwen',
  visceral:'Organen', joints:'Gewrichten', skeletal:'Skelet'
};
let slider = null;
let wrapper = null;
let status = null;

function selectedSystems() {
  return ORDER.filter(id => {
    const checkbox = document.querySelector('[data-system-checkbox="' + id + '"]');
    return state.loadedSystems.includes(id) && checkbox?.checked;
  });
}

function syncAvailability() {
  if (!wrapper || !slider) return;
  const selected = selectedSystems();
  const available = selected.length >= 2;
  wrapper.hidden = !available;
  if (!available) {
    slider.value = '0';
    if (status) status.textContent = 'Kies minimaal twee stelsels om lagen te bekijken.';
  } else if (status && Number(slider.value) === 0) {
    status.textContent = 'Alle gekozen stelsels zichtbaar.';
  }
}

function applyDepth(value) {
  const active = selectedSystems();
  if (active.length < 2) {
    syncAvailability();
    return;
  }
  // Stop vóór de laatste laag, zodat nooit het hele lichaam verdwijnt.
  const progress = Math.max(0, Math.min(100, value)) / 100 * (active.length - 1);
  const visible = [];
  active.forEach((systemId, index) => {
    const opacity = Math.max(0, Math.min(1, 1 - (progress - index)));
    if (index < active.length - 1 && opacity < 0.14) {
      hideSystem(systemId);
    } else {
      showSystem(systemId);
      setSystemTransparency(systemId, Math.max(0.2, opacity));
      visible.push(LABELS[systemId]);
    }
  });
  if (status) status.textContent = 'Zichtbaar: ' + visible.join(', ') + '.';
  slider.setAttribute('aria-valuetext', visible.join(', ') + ' zichtbaar');
}

export function initDepthSlider() {
  const container = document.getElementById('viewerContainer');
  if (!container || slider) return wrapper;
  wrapper = document.createElement('div');
  wrapper.className = 'depth-control';
  wrapper.innerHTML = '<label class="depth-label" for="depthSlider">Lagen</label>' +
    '<input type="range" id="depthSlider" class="depth-slider" min="0" max="100" value="0" step="1" orient="vertical" aria-label="Lagen van de gekozen stelsels">' +
    '<span class="eai-depth-status" role="status" aria-live="polite">Alle gekozen stelsels zichtbaar.</span>';
  container.appendChild(wrapper);
  slider = wrapper.querySelector('#depthSlider');
  status = wrapper.querySelector('.eai-depth-status');
  slider.addEventListener('input', event => applyDepth(Number(event.target.value)));
  document.getElementById('systemsList')?.addEventListener('change', event => {
    if (!event.target.matches('[data-system-checkbox]')) return;
    // Het laden van het nieuwe GLB loopt na de checkboxwijziging.
    syncAvailability();
  });
  syncAvailability();
  return wrapper;
}

export function resetDepthSlider() {
  if (!slider) return;
  slider.value = '0';
  syncAvailability();
  // Alleen nog ingeschakelde stelsels worden hersteld.
  if (!wrapper.hidden) applyDepth(0);
}
