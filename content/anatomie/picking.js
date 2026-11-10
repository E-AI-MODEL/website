// Een bijna onzichtbare laag mag geen anatomie eronder afvangen.
// Dit geldt voor de transparante fascia (3.5%) en tijdelijk vervaagde
// omringende structuren (12%). Ze blijven vindbaar via zoeken en stelsels.
const MIN_PICK_OPACITY = 0.15;

function receivesPointer(material) {
  return Boolean(material) &&
    material.visible !== false &&
    !(material.transparent && material.opacity < MIN_PICK_OPACITY);
}

export function isTouchableAnatomySurface(mesh) {
  if (!mesh || !mesh.isMesh) return false;

  // Een verborgen stelsel kan meshes hebben met visible=true onder
  // een verborgen modelroot. Raycasting ziet ze anders alsnog.
  for (let node = mesh; node; node = node.parent) {
    if (node.visible === false) return false;
  }

  const materials = mesh.material;
  if (Array.isArray(materials)) {
    return materials.some(receivesPointer);
  }
  return receivesPointer(materials);
}
