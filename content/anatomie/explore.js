// EAI Anatomisch Observatorium: snelle, echte onderzoeksingangen.
// Dezelfde lokale GLB-modellen en zichtbaarheidscode als de stelsellijst.
import { state } from '../state/store.js';
import { SYSTEM_IDS } from '../data/anatomy.js';
import { loadModel, unloadSystem } from '../viewer/loadModel.js';
import { showSystem } from '../viewer/visibility.js';
import { deselectPart } from '../viewer/selection.js';
import { setView } from '../viewer/camera.js';
import { resetDepthSlider } from './depthSlider.js';

const ROUTES = {
  skeletal: 'Skelet',
  muscular: 'Spieren',
  cardiovascular: 'Hart en bloedvaten',
  nervous: 'Zenuwstelsel',
  visceral: 'Organen'
};

export function initEAIExplore(viewer) {
  const root = document.getElementById('eaiExplore');
  if (!root || root.dataset.bound === 'true') return;
  root.dataset.bound = 'true';

  const buttons = [...root.querySelectorAll('[data-eai-system]')];
  const status = root.querySelector('[data-eai-explore-status]');
  let busy = false;

  async function activate(systemId) {
    if (busy || !Object.hasOwn(ROUTES, systemId)) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    buttons.forEach(button => { button.disabled = true; });
    if (status) status.textContent = ROUTES[systemId] + ' laden...';

    try {
      // Laad eerst de nieuwe geometrie. Een mislukte download laat het
      // bestaande onderzoek intact in plaats van het scherm leeg te maken.
      await loadModel(systemId, viewer);
      deselectPart();

      // Een onderzoeksroute toont een stelsel. De gewone stelsellijst blijft
      // beschikbaar om daarna weer meerdere stelsels te combineren.
      for (const loaded of [...state.loadedSystems]) {
        if (loaded === systemId) continue;
        unloadSystem(loaded);
        const old = document.querySelector('.system-group[data-system="' + loaded + '"]');
        const oldContent = old?.querySelector('.system-group-content');
        if (oldContent) oldContent.innerHTML = '';
      }

      showSystem(systemId);
      resetDepthSlider();

      document.querySelectorAll('[data-system-checkbox]').forEach(input => {
        input.checked = input.dataset.systemCheckbox === systemId;
      });
      document.querySelectorAll('.system-group-content').forEach(panel => {
        panel.style.display = 'none';
      });
      document.querySelectorAll('[data-system-expand]').forEach(button => {
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = 'Bekijk onderdelen <span class="eai-chevron" aria-hidden="true">+</span>';
      });

      await setView('front', viewer);
      buttons.forEach(button => {
        const selected = button.dataset.eaiSystem === systemId;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      if (status) status.textContent = ROUTES[systemId] + ' zichtbaar. Klik op een onderdeel of gebruik de zoekfunctie.';
    } catch (error) {
      console.error('[eai-explore] Kan onderzoeksroute niet laden', error);
      if (status) status.textContent = 'Laden mislukt. Probeer het opnieuw of kies een ander stelsel.';
    } finally {
      busy = false;
      root.setAttribute('aria-busy', 'false');
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => { void activate(button.dataset.eaiSystem); });
  });
  const systems = document.getElementById('systemsList');
  systems?.addEventListener('change', event => {
    if (!event.target.matches('[data-system-checkbox]')) return;
    buttons.forEach(button => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
    if (status) status.textContent = 'Stelsels gecombineerd. Kies een onderdeel in het lichaam.';
  });

  const initial = state.loadedSystems.length === 1 ? state.loadedSystems[0] : null;
  buttons.forEach(button => {
    const active = button.dataset.eaiSystem === initial;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
