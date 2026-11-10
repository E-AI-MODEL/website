// Directe 3D-bediening zonder draaistand of verplaatsknop.
// Een vinger draait, twee vingers verschuiven en knijpen zoomt in/uit.
import * as THREE from 'three';

export function initDragMode(viewer) {
  const controls = viewer?.controls;
  const canvas = viewer?.canvas;
  if (!controls || !canvas) return null;

  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.zoomToCursor = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  // Voorkom dat Safari de pagina verschuift of zoomt in plaats van het model.
  canvas.style.touchAction = 'none';

  const help = document.querySelector('#helpModal .help-section ul');
  if (help && !help.querySelector('[data-eai-touch-help]')) {
    const item = document.createElement('li');
    item.dataset.eaiTouchHelp = 'true';
    item.textContent = 'Een vinger draait. Met twee vingers verschuif je het lichaam; knijpen zoomt. Op de computer draai je door links te slepen en verplaats je met de rechtermuisknop.';
    help.appendChild(item);
  }
  return controls;
}
