// Wissel tussen draaien en het model verslepen, zonder een tweede 3D-viewer.
// OrbitControls blijft eigenaar van muis-, aanraak- en camerabediening.
import * as THREE from 'three';

export function initDragMode(viewer) {
  const container = document.getElementById('viewerContainer');
  const controls = viewer?.controls;
  const canvas = viewer?.canvas;
  if (!container || !controls || !canvas) return null;

  const originalLeft = controls.mouseButtons.LEFT;
  const originalTouch = controls.touches.ONE;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'eaiDragMode';
  button.className = 'eai-drag-mode';
  button.setAttribute('aria-label', 'Model verplaatsen');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', 'threeCanvas');
  button.textContent = 'Verplaatsen';
  button.title = 'Verplaats het model omhoog, omlaag of opzij';
  container.appendChild(button);
  const helpList = document.querySelector('#helpModal .help-section ul');
  if (helpList) {
    const help = document.createElement('li');
    help.textContent = 'Verplaatsen: klik op de knop en sleep omhoog, omlaag of opzij. Met Draaien ga je terug.';
    helpList.appendChild(help);
  }

  let moving = false;

  function setMoving(next) {
    moving = Boolean(next);
    controls.mouseButtons.LEFT = moving ? THREE.MOUSE.PAN : originalLeft;
    controls.touches.ONE = moving ? THREE.TOUCH.PAN : originalTouch;
    controls.enablePan = true;
    button.setAttribute('aria-pressed', String(moving));
    button.textContent = moving ? 'Draaien' : 'Verplaatsen';
    button.title = moving
      ? 'Sleep het model; klik hier om weer te draaien'
      : 'Klik hier en sleep om het model te verplaatsen';
    canvas.classList.toggle('eai-pan-mode', moving);
    if (!moving) canvas.classList.remove('eai-pan-dragging');
  }

  button.addEventListener('click', () => setMoving(!moving));
  canvas.addEventListener('pointerdown', event => {
    if (moving && (event.button === 0 || event.pointerType === 'touch')) {
      canvas.classList.add('eai-pan-dragging');
    }
  });
  ['pointerup', 'pointercancel'].forEach(name => {
    document.addEventListener(name, () => canvas.classList.remove('eai-pan-dragging'));
  });
  setMoving(false);
  return button;
}
