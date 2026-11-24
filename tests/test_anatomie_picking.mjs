import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTouchableAnatomySurface } from '../content/anatomie/picking.js';

const surface = (opacity, options = {}) => ({
  isMesh: true,
  visible: options.visible ?? true,
  parent: options.parent ?? null,
  material: {
    transparent: options.transparent ?? opacity < 1,
    opacity,
    visible: options.materialVisible ?? true
  }
});

test('fascia van 3,5% vangt klikken op de borstspier niet af', () => {
  assert.equal(isTouchableAnatomySurface(surface(0.035)), false);
  assert.equal(isTouchableAnatomySurface(surface(0)), false);
  assert.equal(isTouchableAnatomySurface(surface(1)), true);
});

test('tijdelijk vervaagde spieren van 12% blijven aanklikbaar', () => {
  assert.equal(isTouchableAnatomySurface(surface(0.12)), true);
  assert.equal(isTouchableAnatomySurface(surface(0.30)), true);
});

test('een verborgen stelsel en onzichtbare materialen ontvangen geen klik', () => {
  assert.equal(isTouchableAnatomySurface(surface(1, { visible:false })), false);
  assert.equal(isTouchableAnatomySurface(surface(1, { parent:{visible:false} })), false);
  assert.equal(isTouchableAnatomySurface(surface(1, { materialVisible:false })), false);
});

test('ook meervoudige materialen geven een aanklikbare structuur door', () => {
  const onlyFascia = surface(0.035);
  onlyFascia.material = [
    { transparent:true, opacity:0.035 },
    { transparent:true, opacity:0.07 }
  ];
  assert.equal(isTouchableAnatomySurface(onlyFascia),false);
  onlyFascia.material.push({ transparent:false, opacity:1 });
  assert.equal(isTouchableAnatomySurface(onlyFascia),true);
});

test('een raycast met fascia voor de grote borstspier selecteert de spier', () => {
  const hits = [
    { object: surface(0.035), name: 'Pectoral fascia' },
    { object: surface(1), name: 'Pectoralis major muscle' }
  ];
  const firstClickable = hits.find(hit => isTouchableAnatomySurface(hit.object));
  assert.equal(firstClickable?.name, 'Pectoralis major muscle');
});
