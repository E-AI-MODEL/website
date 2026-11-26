// Controleert de TOPO VO-databank (topo/data/vo): verwijzingen, doelen, kaarten, SLO-lijst, sets, begrippen en vragen.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = process.argv[2] || 'topo/data/vo';
const json = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// ---- doelen
const doelen = json('doelen.json');
const codes = new Set(doelen.doelen.map(d => d.code));
assert.equal(codes.size, doelen.doelen.length, 'Dubbele doelcodes');
for (const d of doelen.doelen) {
  assert.ok(d.titel && d.omschrijving, `Doel ${d.code} mist titel of omschrijving`);
  assert.ok(doelen.bronnen[d.bron], `Doel ${d.code} verwijst naar onbekende bron ${d.bron}`);
}
const NIVEAUS = {onderbouw: [1, 2, 3], havo: [4, 5], vwo: [4, 5, 6]};

// ---- kaarten
const kaartBestand = {
  'wereld-landen': 'kaarten/wereld-landen.geojson', 'wereld-gebieden': 'kaarten/wereld-gebieden.geojson',
  'wereld-zeeen': 'kaarten/wereld-zeeen.geojson', 'meren': 'kaarten/meren.geojson', 'rivieren': 'kaarten/rivieren.geojson',
  'platen': 'kaarten/platen.geojson', 'brazilie-deelstaten': 'kaarten/brazilie-deelstaten.geojson',
  'brazilie-regios': 'kaarten/brazilie-regios.geojson', 'mexico-vs-staten': 'kaarten/mexico-vs-staten.geojson',
  'nederland-water': 'kaarten/nederland-water.geojson', '../provincies-2026': '../provincies-2026.geojson'};
const keys = {};
for (const [k, f] of Object.entries(kaartBestand)) {
  assert.ok(existsSync(join(ROOT, f)), `Kaartbestand ontbreekt: ${f}`);
  const g = json(f);
  keys[k] = new Set(g.features.map(x => k === '../provincies-2026' ? x.properties.statcode : x.properties.id));
  assert.ok(keys[k].size > 0, `Lege kaart: ${f}`);
}
for (const f of ['europa-landen', 'zuid-amerika-landen', 'plaatgrenzen']) assert.ok(existsSync(join(ROOT, `kaarten/${f}.geojson`)), f);
const SPEELKAART = {wereld: [-180, -90, 180, 90], europa: [-25, 34, 62, 72], nederland: [3.2, 50.7, 7.3, 53.6],
  'zuid-amerika': [-82, -56, -34, 13.5], brazilie: [-75, -34.5, -34, 6], 'mexico-vs': [-125, 24, -93, 42]};

// ---- items
const items = [];
for (const f of readdirSync(join(ROOT, 'items')).filter(f => f.endsWith('.json'))) {
  const d = json(`items/${f}`);
  assert.equal(d.items.length, d.aantal, `${f}: aantal klopt niet`);
  items.push(...d.items);
}
const byId = new Map();
for (const it of items) {
  assert.ok(!byId.has(it.id), `Dubbele id ${it.id}`);
  byId.set(it.id, it);
  assert.ok(it.naam && it.type, `${it.id}: naam of type ontbreekt`);
  const [lon, lat] = it.coord;
  assert.ok(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90, `${it.id}: coördinaat buiten bereik`);
  for (const c of it.doelen || []) assert.ok(codes.has(c), `${it.id}: onbekend doel ${c}`);
  assert.ok((it.doelen || []).length > 0, `${it.id}: geen doelen`);
  for (const [n, lj] of Object.entries(it.leerjaren || {})) {
    assert.ok(NIVEAUS[n], `${it.id}: onbekend niveau ${n}`);
    for (const j of lj) assert.ok(NIVEAUS[n].includes(j), `${it.id}: leerjaar ${j} past niet bij ${n}`);
  }
  assert.ok([1, 2, 3].includes(it.moeilijkheid), `${it.id}: moeilijkheid ontbreekt`);
  if (it.geo) {
    assert.ok(keys[it.geo.kaart], `${it.id}: onbekende kaart ${it.geo.kaart}`);
    assert.ok(keys[it.geo.kaart].has(it.geo.key), `${it.id}: vorm ${it.geo.key} ontbreekt in ${it.geo.kaart}`);
  }
  for (const k of it.kaarten || []) {
    const b = SPEELKAART[k];
    assert.ok(b, `${it.id}: onbekende speelkaart ${k}`);
    assert.ok(lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3], `${it.id}: ligt niet binnen kaart ${k}`);
  }
}
for (const it of items) {
  const twin = it.feiten?.tweelingstad;
  if (twin) {
    assert.ok(byId.has(twin), `${it.id}: tweelingstad ${twin} bestaat niet`);
    assert.equal(byId.get(twin).feiten.tweelingstad, it.id, `${it.id}: tweelingstad is niet wederzijds`);
  }
}

// ---- SLO-basislijst
const slo = items.filter(i => i.slo300);
const perLijst = {};
for (const i of slo) perLijst[i.slo_lijst] = (perLijst[i.slo_lijst] || 0) + 1;
assert.deepEqual(perLijst, {NEDERLAND: 100, EUROPA: 100, WERELD: 99}, 'SLO-basislijst onvolledig');
assert.equal(new Set(slo.map(i => i.slo_lijst + '|' + i.slo_naam)).size, slo.length, 'SLO-naam dubbel gekoppeld');
for (const i of slo) assert.ok(i.doelen.includes('BASIS-TOPO'), `${i.id}: SLO-item zonder BASIS-TOPO`);

// ---- begrippen
const begr = json('begrippen.json');
const begrIds = new Set(begr.begrippen.map(b => b.id));

// ---- sets
const sets = json('sets.json');
const setIds = new Set();
const itemGroep = new Map();
for (const f of readdirSync(join(ROOT, 'items')).filter(f => f.endsWith('.json')))
  for (const it of json(`items/${f}`).items) itemGroep.set(it.id, `items/${f}`);
for (const s of sets.sets) {
  assert.ok(!setIds.has(s.id), `Dubbele set ${s.id}`); setIds.add(s.id);
  assert.ok(NIVEAUS[s.niveau], `${s.id}: onbekend niveau`);
  for (const j of s.leerjaren) assert.ok(NIVEAUS[s.niveau].includes(j), `${s.id}: leerjaar ${j}`);
  for (const d of s.doelen) assert.ok(codes.has(d), `${s.id}: onbekend doel ${d}`);
  for (const v of s.vraagvormen) assert.ok(sets.vraagvormen[v], `${s.id}: onbekende vraagvorm ${v}`);
  if (s.kaart === null) {
    assert.deepEqual(s.vraagvormen, ['quiz'], `${s.id}: set zonder kaart mag alleen quizvragen hebben`);
    assert.ok(s.begrippen.length >= 4 && s.begrippen.every(b => begrIds.has(b)), `${s.id}: begrippen ongeldig`);
    assert.equal(s.begrippen.length, s.aantal, `${s.id}: aantal klopt niet`);
  } else {
    assert.ok(SPEELKAART[s.kaart], `${s.id}: onbekende kaart`);
    assert.equal(s.items.length, s.aantal, `${s.id}: aantal klopt niet`);
    assert.ok(s.aantal >= 4, `${s.id}: te weinig items om te oefenen`);
    for (const id of s.items) {
      assert.ok(byId.has(id), `${s.id}: item ${id} bestaat niet`);
      assert.ok(s.bestanden.includes(itemGroep.get(id)), `${s.id}: bestand voor ${id} ontbreekt in bestanden`);
    }
    const opKaart = s.items.filter(id => byId.get(id).kaarten.includes(s.kaart)).length;
    assert.equal(opKaart, s.items.length, `${s.id}: niet alle items passen op kaart ${s.kaart}`);
  }
  if (s.vragen) {
    const qs = json(s.vragen).questions;
    assert.ok(qs.length > 0, `${s.id}: lege vragenbundel`);
    const mag = new Set(s.items), magB = new Set(s.begrippen || []);
    for (const q of qs) {
      assert.ok(q.begripId ? magB.has(q.begripId) : mag.has(q.itemId), `${s.id}: vraag ${q.id} hoort niet bij de set`);
      assert.ok(q.options.includes(q.answer) && q.options.length === 4, `${s.id}: vraag ${q.id} ongeldig`);
    }
  }
}
assert.equal(begrIds.size, begr.begrippen.length, 'Dubbele begrippen');
for (const b of begr.begrippen) {
  for (const d of b.doelen) assert.ok(codes.has(d), `${b.id}: onbekend doel ${d}`);
  for (const r of b.voorbeelden || []) assert.ok(byId.has(r), `${b.id}: voorbeeld ${r} bestaat niet`);
}

// ---- vragen
const vi = json('vragen/index.json');
let totaal = 0;
const qids = new Set();
for (const s of vi.sjablonen) {
  const qs = json(s.bestand).questions;
  assert.equal(qs.length, s.aantal, `${s.bestand}: aantal klopt niet`);
  for (const q of qs) {
    assert.ok(!qids.has(q.id), `Dubbele vraag ${q.id}`); qids.add(q.id);
    assert.equal(q.options.length, 4, `${q.id}: geen vier opties`);
    assert.equal(new Set(q.options).size, 4, `${q.id}: dubbele opties`);
    assert.ok(q.options.includes(q.answer), `${q.id}: antwoord staat niet bij de opties`);
    if (q.itemId) assert.ok(byId.has(q.itemId), `${q.id}: item ${q.itemId} bestaat niet`);
    if (q.begripId) assert.ok(begrIds.has(q.begripId), `${q.id}: begrip ${q.begripId} bestaat niet`);
    for (const d of q.doelen) assert.ok(codes.has(d), `${q.id}: onbekend doel ${d}`);
  }
  totaal += qs.length;
}
assert.equal(totaal, vi.totaal, 'Totaal aantal vragen klopt niet');

// ---- inhoudelijke steekproeven (bekende feiten, niet uit het geheugen van de generator)
const vind = (naam, type) => items.find(i => (i.naam === naam || (i.alt || []).includes(naam)) && (!type || i.type === type));
const near = (it, lon, lat, tol = 0.5) => Math.abs(it.coord[0] - lon) <= tol && Math.abs(it.coord[1] - lat) <= tol;
assert.ok(near(vind('Amsterdam', 'stad'), 4.9, 52.37, 0.05), 'Amsterdam ligt verkeerd');
assert.ok(near(vind('Brasilia', 'hoofdstad'), -47.9, -15.8), 'Brasilia ligt verkeerd');
assert.equal(vind('Lagos').type, 'stad', 'Lagos is geen hoofdstad van Nigeria');
assert.equal(vind('Abuja').type, 'hoofdstad');
assert.equal(vind('Manaus').feiten.deelstaat, 'AM');
assert.equal(vind('Manaus').feiten.regio, 'Noord');
assert.equal(vind('Ciudad Juárez').feiten.tweelingstad, vind('El Paso').id);
for (const [stad, prov] of [['Zwolle', 'Overijssel'], ['Assen', 'Drenthe'], ["'s-Hertogenbosch", 'Noord-Brabant'], ['Lelystad', 'Flevoland']])
  assert.equal(vind(stad, 'stad').feiten.provincie, prov, `${stad} hoort bij ${prov}`);
assert.equal(items.filter(i => i.feiten?.provinciehoofdstad).length, 12, 'Niet alle provinciehoofdsteden gemarkeerd');

console.log(`TOPO VO OK: ${items.length} items, ${slo.length} SLO-namen, ${sets.sets.length} sets, ${begr.begrippen.length} begrippen, ${totaal} vragen`);
