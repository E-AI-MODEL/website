import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html', import.meta.url), 'utf8');
const embedded = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const modelScript = embedded.find(s => s.includes('function renderExperiment('));
const definitionScript = embedded.find(s => s.includes('const labSpecs ='));
assert.ok(modelScript && definitionScript, 'De modellen en definities staan in de gepubliceerde HTML');
const render = runInNewContext(modelScript + '\nrenderExperiment');
const specs = runInNewContext(definitionScript + '\nlabSpecs');
const calls = [];
const graphics = new Proxy({}, { get(_object, method) { return (...args) => calls.push([method,...args]); } });

function sample(id, change = {}, time = 0, motion = null) {
  const spec = specs.find(s => s[0] === id);
  assert.ok(spec, 'Onbekende proef: ' + id);
  const defaults = Object.fromEntries(spec[3].map(v => [v[0], v[5]]));
  calls.length = 0;
  const result = render(id, {...defaults, ...change}, time, graphics, motion);
  return {result, graphicsCalls:[...calls]};
}
function readout(result, label) {
  const value = result.readouts.find(row => row[0] === label)?.[1];
  assert.ok(value !== undefined, 'Meetwaarde ontbreekt: ' + label);
  return String(value);
}
function quantity(result,label) {
  const raw = readout(result,label);
  const match = raw.match(/-?\d[\d.,]*/);
  assert.ok(match, 'Geen getal voor ' + label + ': ' + raw);
  return Number(match[0].replaceAll('.','').replace(',','.'));
}
function near(actual, expected, tolerance = 0.025) {
  assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' hoort ongeveer ' + expected + ' te zijn');
}

test('53 onderwerpen hebben getoonde waarden en eindige of niet-gedefinieerde grafiekwaarden', () => {
  assert.equal(specs.length,53);
  for (const spec of specs) {
    const {result} = sample(spec[0]);
    assert.ok(result.readouts.length >= 3, spec[0]);
    for (const fraction of [0,.2,.5,.8,1]) {
      const value = result.fn(fraction);
      assert.equal(typeof value, 'number', spec[0]);
      assert.ok(Number.isFinite(value) || Number.isNaN(value), spec[0]);
    }
  }
});
test('hefboom draait volgens het netto moment zonder tegenkracht automatisch aan te passen', () => {
  const balanced = sample('lever').result;
  near(quantity(balanced,'Moment linksom'),18);
  near(quantity(balanced,'Moment rechtsom'),18);
  near(quantity(balanced,'Netto moment'),0);
  const leftHeavy = sample('lever',{F:9,F2:6,arm1:3,arm2:2}).result;
  near(quantity(leftHeavy,'Moment linksom'),27);
  near(quantity(leftHeavy,'Moment rechtsom'),12);
  near(quantity(leftHeavy,'Netto moment'),-15);
  const rightHeavy = sample('lever',{F:9,F2:6,arm1:1,arm2:4}).result;
  near(quantity(rightHeavy,'Netto moment'),15);
  const {result,graphicsCalls} = sample('lever',{F:9,F2:6,arm1:3,arm2:2},0,{angle:-.2,omega:0});
  near(quantity(result,'Netto moment'),-15*Math.cos(.2),.03);
  near(quantity(result,'Hellingshoek'),-.2*180/Math.PI,.06);
  const bar = graphicsCalls.find(call=>call[0]==='line'&&call[6]===11);
  assert.ok(bar,'De balk wordt zichtbaar getekend');
  assert.ok(bar[2]>bar[4],'Bij een negatieve hoek ligt het linkereinde lager');
  const physics = runInNewContext(modelScript + '\nleverPhysics');
  near(physics({F:9,F2:6,arm1:3,arm2:2,I:12}).alpha,-1.25,.00001);
  near(physics({F:9,F2:6,arm1:2,arm2:3,I:12}).alpha,0,.00001);
});

test('beweging, hydrostatica en optica gebruiken referentiewaarden', () => {
  near(quantity(sample('acceleration',{v0:3,a:2},2).result,'Positie'),10);
  near(quantity(sample('projectile',{v:20,angle:45,g:10}).result,'Bereik'),40);
  near(quantity(sample('projectile',{v:20,angle:45,g:10}).result,'Max. hoogte'),10);
  near(quantity(sample('hydro',{rho:1000,g:9.81,depth:10}).result,'Overdruk'),98100,.5);
  near(quantity(sample('refraction',{n1:1,n2:1.5,angle:30}).result,'Brekingshoek'),Math.asin(1/3)*180/Math.PI,.06);
  near(quantity(sample('double',{d:.2,lambda:550,L:2}).result,'Streepafstand'),5.5);
  near(quantity(sample('single',{a:.1,lambda:550,L:2}).result,'Breedte hoofdmaximum'),22);
});
test('elektriciteit, magnetisme en atoomfysica gebruiken referentiewaarden', () => {
  near(quantity(sample('resistors',{R1:10,R2:20,mode:1}).result,'Vervangingsweerstand'),20/3);
  near(quantity(sample('bohr',{n1:3,n2:2}).result,'Energieverschil'),13.6*(1/4-1/9));
  assert.equal(readout(sample('bohr',{n1:3,n2:2}).result,'Proces'),'Emissie');
  near(quantity(sample('photo',{f:1,W:2.3,U:0}).result,'Max. kinetische energie'),4.135667696-2.3);
  near(quantity(sample('lorentz',{v:10,B:2,angle:90}).result,'Lorentzkracht'),20);
  near(quantity(sample('magnetwire',{I:10,r:5}).result,'Veld op meetafstand'),40);
  near(quantity(sample('dilation',{beta:.6,tau:10}).result,'Lorentzfactor γ'),1.25);
  near(quantity(sample('bragg',{d:.3,lambda:.3,order:1}).result,'Bragghoek'),30);
});
test('een drijvend voorwerp ondervindt precies zijn gewicht aan opwaartse kracht', () => {
  const floating = sample('buoyant',{rho:1000,V:10,m:4}).result;
  near(quantity(floating,'Opwaartse kracht'),39.24);
  near(quantity(floating,'Ondergedompeld deel bij drijven'),40);
  const body = sample('buoyant',{rho:1000,V:10,m:4}).graphicsCalls.find(x=>x[0]==='rect' && x[3]===130 && x[4]===113);
  assert.ok(body, 'Het drijvende voorwerp moet zichtbaar zijn');
  near((body[2]+113-230)/113,.4,.015);
  assert.equal(readout(floating,'Drijfgedrag'),'Drijft');
  near(floating.fn(1),39.24);
  const sinking = sample('buoyant',{rho:500,V:10,m:8}).result;
  near(quantity(sinking,'Opwaartse kracht'),49.05);
  assert.equal(readout(sinking,'Drijfgedrag'),'Zinkt');
});
test('in het midden tussen twee gelijke bronnen bepaalt het faseverschil de intensiteit', () => {
  near(quantity(sample('interference',{distance:2.5,lambda:1.5,phase:0}).result,
    'Relatieve intensiteit midden tussen bronnen'),1,.01);
  near(quantity(sample('interference',{distance:2.5,lambda:1.5,phase:180}).result,
    'Relatieve intensiteit midden tussen bronnen'),0,.01);
});
test('de ingestelde veeramplitude verandert de positie van het getekende gewicht', () => {
  const position = A => {
    const {graphicsCalls} = sample('spring',{m:2,k:30,A},0);
    const body = graphicsCalls.find(x=>x[0]==='rect' && x[3]===110 && x[4]===90);
    assert.ok(body,'Veergewicht niet getekend');
    return body[2];
  };
  assert.ok(position(.8)-position(.2)>50);
});
