// Twee vaste camerastanden. De geselecteerde stand staat altijd zichtbaar.
import * as THREE from 'three';

export function initDragMode(viewer) {
  const container = document.getElementById('viewerContainer');
  const controls = viewer?.controls;
  const canvas = viewer?.canvas;
  if (!container || !controls || !canvas) return null;

  const originalLeft = controls.mouseButtons.LEFT;
  const originalTouch = controls.touches.ONE;
  const group = document.createElement('div');
  group.className = 'eai-camera-modes';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Model bedienen');
  group.innerHTML = `
    <button type="button" id="eaiRotateMode" class="eai-camera-mode"
      aria-label="Model draaien" aria-pressed="true">Draaien</button>
    <button type="button" id="eaiDragMode" class="eai-camera-mode"
      aria-label="Model verplaatsen" aria-pressed="false">Verplaatsen</button>
  `;
  container.appendChild(group);
  const overview = document.getElementById('resetBtn');
  if (overview) {
    overview.textContent = 'In beeld';
    overview.setAttribute('aria-label', 'Zichtbare onderdelen passend in beeld');
    overview.title = 'Toon de zichtbare anatomie in het huidige perspectief, zonder verborgen lagen terug te zetten';
  }
  const rotate = group.querySelector('#eaiRotateMode');
  const pan = group.querySelector('#eaiDragMode');

  const helpList = document.querySelector('#helpModal .help-section ul');
  if (helpList) {
    const help = document.createElement('li');
    help.textContent = 'Draaien of verplaatsen: kies de stand boven het model. Met twee vingers kun je altijd verschuiven en zoomen. Op desktop kun je ook rechts slepen of Shift + pijltjestoetsen gebruiken om te verplaatsen.';
    helpList.appendChild(help);
  }

  let moving = false;
  function setMoving(next) {
    moving = Boolean(next);
    controls.mouseButtons.LEFT = moving ? THREE.MOUSE.PAN : originalLeft;
    controls.touches.ONE = moving ? THREE.TOUCH.PAN : originalTouch;
    controls.enablePan = true;
    rotate.setAttribute('aria-pressed', String(!moving));
    pan.setAttribute('aria-pressed', String(moving));
    canvas.classList.toggle('eai-pan-mode', moving);
    canvas.classList.remove('eai-pan-dragging');
  }

  rotate.addEventListener('click', () => setMoving(false));
  pan.addEventListener('click', () => setMoving(true));
  canvas.addEventListener('pointerdown', event => {
    if (moving && (event.button === 0 || event.pointerType === 'touch')) {
      canvas.classList.add('eai-pan-dragging');
    }
  });
  for (const name of ['pointerup', 'pointercancel']) {
    document.addEventListener(name, () => canvas.classList.remove('eai-pan-dragging'));
  }
  setMoving(false);
  return group;
}
