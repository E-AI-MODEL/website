// Fascia kan zichtbaar blijven zonder het weefsel erachter af te vangen.
// De normale fascia is 3,5% dekkend; een tijdelijk vervaagd onderdeel is
// 12% dekkend en moet gewoon opnieuw geselecteerd kunnen worden.
const MIN_PICK_OPACITY = 0.10;

function receivesPointer(material) {
  if (!material || material.visible === false) return false;
  // Bij opacity=0 of een bijna onzichtbaar materiaal wordt de onderliggende
  // anatomie geselecteerd. Matten van 12% (ghost) blijven selecteerbaar.
  if (material.transparent && material.opacity < MIN_PICK_OPACITY) return false;
  return true;
}

export function isTouchableAnatomySurface(mesh) {
  if (!mesh?.isMesh) return false;

  // Ook een verborgen voorouder maakt het onderdeel onzichtbaar.
  for (let node = mesh; node; node = node.parent) {
    if (node.visible === false) return false;
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some(receivesPointer);
}
