// Houd de gekozen structuur zichtbaar bij zoeken en een geopend informatiepaneel.
// Verplaats camera en draaipunt samen. De kijkrichting en zoomafstand blijven gelijk.
import * as THREE from 'three';
import { state } from '../state/store.js';
import { getMeshRegistry } from '../viewer/loadModel.js';
import { focusOnMesh } from '../viewer/camera.js';

let clearanceTimer = null;

function boundsOnScreen(mesh, viewer) {
  const rect = viewer.canvas.getBoundingClientRect();
  const box = new THREE.Box3().setFromObject(mesh);
  if (box.isEmpty() || !rect.width || !rect.height) return null;

  viewer.camera.updateMatrixWorld();
  const xs = [box.min.x, box.max.x], ys = [box.min.y, box.max.y], zs = [box.min.z, box.max.z];
  const screen = [];
  for (const x of xs) for (const y of ys) for (const z of zs) {
    const p = new THREE.Vector3(x,y,z).project(viewer.camera);
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      screen.push({
        x: rect.left + (p.x + 1) * rect.width / 2,
        y: rect.top + (1 - p.y) * rect.height / 2
      });
    }
  }
  if (!screen.length) return null;
  return {
    box,rect,
    left:Math.min(...screen.map(p=>p.x)),right:Math.max(...screen.map(p=>p.x)),
    top:Math.min(...screen.map(p=>p.y)),bottom:Math.max(...screen.map(p=>p.y))
  };
}

export function keepSelectedVisible() {
  const viewer = state.viewer, id = state.selectedPart?.id;
  const panel = document.getElementById('infoSidebar');
  const app = document.getElementById('app');
  if (!viewer || !id || !panel || !app?.classList.contains('info-open')) return false;
  const mesh = getMeshRegistry().get(id);
  if (!mesh) return false;
  const projected = boundsOnScreen(mesh, viewer);
  if (!projected) return false;

  const panelRect = panel.getBoundingClientRect();
  const rect = projected.rect;
  const margin = 24;
  const mobile = matchMedia('(max-width:720px)').matches;
  const safe = {
    left:rect.left+margin,
    right:mobile ? rect.right-margin : Math.min(rect.right-margin,panelRect.left-margin),
    top:rect.top+margin,
    bottom:mobile ? Math.min(rect.bottom-margin,panelRect.top-margin) : rect.bottom-margin
  };
  if (safe.right<=safe.left+90 || safe.bottom<=safe.top+90) return false;

  // Alleen ingrijpen als de geselecteerde structuur onder een paneel verdwijnt.
  let dx = 0, dy = 0;
  if (projected.right>safe.right) dx=Math.min(0,safe.right-projected.right);
  if (projected.bottom>safe.bottom) dy=Math.min(0,safe.bottom-projected.bottom);
  if (projected.left<safe.left && !dx) dx=Math.max(0,safe.left-projected.left);
  if (projected.top<safe.top && !dy) dy=Math.max(0,safe.top-projected.top);

  // Grote structuren passen niet altijd helemaal binnen de vrije ruimte.
  // Beperk de verschuiving, zodat het model niet plots uit beeld springt.
  const maxX=rect.width*.28, maxY=rect.height*.29;
  dx=THREE.MathUtils.clamp(dx,-maxX,maxX);
  dy=THREE.MathUtils.clamp(dy,-maxY,maxY);
  if (Math.abs(dx)<2 && Math.abs(dy)<2) return false;

  const {camera,controls}=viewer;
  const center=projected.box.getCenter(new THREE.Vector3());
  const depth=center.sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
  if (depth<=0.02) return false;
  const worldPerPixel = 2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/rect.height;
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const displacement = right.multiplyScalar(-dx*worldPerPixel).add(up.multiplyScalar(dy*worldPerPixel));
  camera.position.add(displacement);
  controls.target.add(displacement);
  controls.update();
  viewer.render();
  return true;
}

export function scheduleSelectionClearance() {
  clearTimeout(clearanceTimer);
  // De CSS-uitschuifanimatie duurt nog even na het openen.
  clearanceTimer=setTimeout(keepSelectedVisible,380);
}

export async function focusSearchResult(partId) {
  const viewer=state.viewer;
  const mesh=getMeshRegistry().get(partId);
  if (!viewer || !mesh) return false;
  await focusOnMesh(mesh,viewer,true,2.8);
  if (document.getElementById('app')?.classList.contains('info-open')) {
    keepSelectedVisible();
  }
  return true;
}
