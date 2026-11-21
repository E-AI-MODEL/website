import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const profiles = require('../tools/ict-scan/assurance/profile.js');
const read = path => readFileSync(path, 'utf8');
const loadProfile = name => profiles.validate(JSON.parse(read('tools/ict-scan/assurance/profiles/' + name + '.json')));
const clone = value => structuredClone(value);
const storeNames = ['apps','ai','connections','checks','devices','parts','dpia','aiControls','policyDocs','signals','candidates','licenseReview','workActions','softwareReview','faqs'];
const source = read('tools/ict-scan/enhancements.js');
// Run the actual snapshot functions with an IndexedDB substitute. Rendering and
// browser persistence are outside this unit test's scope.
const snapshotCode = source.slice(source.indexOf("const snapshotStore="), source.indexOf('function enhancementEvents()'));

function database() {
  const values = new Map();
  const requests = [];
  const db = {
    objectStoreNames: {contains: () => true}, close() {},
    transaction() {
      const transaction = {objectStore() {return {
        get(key) {const request = {}; requests.push({method: 'get', key}); queueMicrotask(() => {request.result = values.has(key) ? clone(values.get(key)) : undefined; request.onsuccess?.();}); return request;},
        put(value, key) {const request = {}; requests.push({method: 'put', key}); queueMicrotask(() => {values.set(key, clone(value)); request.onsuccess?.(); transaction.oncomplete?.();}); return request;},
        delete(key) {const request = {}; requests.push({method: 'delete', key}); queueMicrotask(() => {values.delete(key); request.onsuccess?.(); transaction.oncomplete?.();}); return request;}
      };}};
      return transaction;
    }
  };
  return {values, requests, indexedDB: {open() {const request = {}; queueMicrotask(() => {request.result = db; request.onsuccess?.();}); return request;}}};
}

function setup(profile, shared) {
  const elements = new Map();
  const downloads = [];
  const state = {...Object.fromEntries(storeNames.map(name => [name, new Map()])), ready: false, sources: [], docs: [], metadata: null};
  const context = {
    state, Map, Set, Date, Promise, Blob, indexedDB: shared.indexedDB,
    AssuranceProfile: profiles, IctOrganisation: {profile, ready: Promise.resolve(profile)},
    array: map => [...map.values()], confirm: () => true,
    $(id) {if (!elements.has(id)) elements.set(id, {textContent: ''}); return elements.get(id);},
    toast() {}, buildDerived() {state.derived = [];}, renderAll() {}, selectView(view) {state.view = view;},
    download(name, blob) {downloads.push({name, blob});}
  };
  context.window = context;
  vm.createContext(context); vm.runInContext(snapshotCode, context, {filename: 'enhancements-snapshot-functions.js'});
  return {context, state, elements, profile, downloads,
    fill(name) {state.apps.set('APP-001', {id: 'APP-001', name}); state.ready = true; state.sources = [{name: 'inventory.json', kind: 'Inventory', rows: 1, info: 'Local copy'}];},
    key: 'profile:' + profiles.scopeKey(profile)};
}

test('Twee profielen op dezelfde origin bewaren en herstellen uitsluitend hun eigen momentopname', async () => {
  const shared = database(), a = setup(loadProfile('emmauscollege'), shared), b = setup(loadProfile('example-organisation'), shared);
  a.fill('Organisation A record'); await a.context.saveSnapshot();
  await b.context.restoreSnapshot();
  assert.equal(b.state.apps.size, 0); assert.equal(b.state.ready, false);
  b.fill('Organisation B record'); await b.context.saveSnapshot();
  const freshA = setup(a.profile, shared), freshB = setup(b.profile, shared);
  await freshA.context.restoreSnapshot(); await freshB.context.restoreSnapshot();
  assert.equal(freshA.state.apps.get('APP-001').name, 'Organisation A record');
  assert.equal(freshB.state.apps.get('APP-001').name, 'Organisation B record');
  assert.notEqual(a.key, b.key); assert.equal(shared.values.size, 2);
});

test('Een oude momentopname zonder profielbinding wordt niet automatisch geladen of verwijderd', async () => {
  const shared = database();
  const legacy = {date: '2026-11-20T12:00:00Z', maps: {apps: [{id: 'APP-001', name: 'Legacy organisation data'}]}, sources: [], docs: []};
  shared.values.set('latest', clone(legacy));
  for (const name of ['emmauscollege', 'example-organisation']) {
    const app = setup(loadProfile(name), shared); await app.context.restoreSnapshot();
    assert.equal(app.state.apps.size, 0); assert.equal(app.state.ready, false);
  }
  assert.deepEqual(shared.values.get('latest'), legacy);
  assert.ok(shared.requests.every(request => request.key !== 'latest'));
});

test('Een vreemd profiel in de opgeslagen payload wordt vóór gegevenswijziging geweigerd', async () => {
  const shared = database(), app = setup(loadProfile('emmauscollege'), shared);
  app.fill('Saved data'); await app.context.saveSnapshot();
  const saved = shared.values.get(app.key); saved.organisationId = 'different-organisation';
  const fresh = setup(app.profile, shared); await fresh.context.restoreSnapshot();
  assert.equal(fresh.state.apps.size, 0); assert.equal(fresh.state.ready, false);
  assert.match(fresh.elements.get('saveStatus').textContent, /niet geladen/);
});

test('Een late fout in een momentopname verandert geen eerder aanwezig register', async () => {
  const shared = database(), app = setup(loadProfile('emmauscollege'), shared);
  app.fill('Saved data'); await app.context.saveSnapshot();
  shared.values.get(app.key).maps.faqs = null;
  const fresh = setup(app.profile, shared);
  fresh.state.apps.set('APP-OLD', {id: 'APP-OLD', name: 'Keep this pending input'});
  await fresh.context.restoreSnapshot();
  assert.equal(fresh.state.apps.size, 1);
  assert.equal(fresh.state.apps.get('APP-OLD').name, 'Keep this pending input');
  assert.equal(fresh.state.apps.has('APP-001'), false);
});

test('Wissen verwijdert alleen de momentopname van het actieve profiel', async () => {
  const shared = database(), a = setup(loadProfile('emmauscollege'), shared), b = setup(loadProfile('example-organisation'), shared);
  a.fill('Organisation A record'); b.fill('Organisation B record');
  await a.context.saveSnapshot(); await b.context.saveSnapshot();
  await a.context.clearSnapshot();
  assert.equal(shared.values.has(a.key), false); assert.equal(shared.values.has(b.key), true);
  assert.equal(a.state.apps.size, 0); assert.equal(a.state.ready, false);
  const freshB = setup(b.profile, shared); await freshB.context.restoreSnapshot();
  assert.equal(freshB.state.apps.get('APP-001').name, 'Organisation B record');
});

test('Een gewijzigd bronpad of een andere branch krijgt geen opgeslagen stand van de vorige bron', async () => {
  const shared = database(), a = setup(loadProfile('emmauscollege'), shared);
  a.fill('Original source'); await a.context.saveSnapshot();
  for (const field of ['sourceDir', 'baseRef']) {
    const changed = clone(a.profile); changed.source[field] = 'another-source';
    const fresh = setup(profiles.validate(changed), shared); await fresh.context.restoreSnapshot();
    assert.equal(fresh.state.apps.size, 0); assert.equal(fresh.state.ready, false);
  }
});

test('De oude lokale kopie kan expliciet worden gedownload zonder haar aan het actieve profiel toe te wijzen', async () => {
  const shared = database();
  const legacy = {date: '2026-11-20T12:00:00Z', maps: {apps: [{id: 'APP-001', name: 'Legacy organisation data', original: {nested: ['keep']}}]}, sources: [{name: 'old.xlsx'}], docs: [{name: 'Original document'}], metadata: {institution: 'Original organisation'}};
  shared.values.set('latest', clone(legacy));
  const app = setup(loadProfile('example-organisation'), shared);
  app.fill('Current organisation record'); const before = clone([...app.state.apps.values()]);
  await app.context.downloadLegacySnapshot();
  assert.equal(app.downloads.length, 1);
  assert.equal(app.downloads[0].name, 'oude-lokale-kopie.json');
  assert.deepEqual(JSON.parse(await app.downloads[0].blob.text()), legacy);
  assert.deepEqual([...app.state.apps.values()], before);
  assert.equal(shared.values.has(app.key), false);
  assert.deepEqual(shared.values.get('latest'), legacy);
});

test('De downloadactie voor een ontbrekende oudere kopie maakt geen leeg archief', async () => {
  const app = setup(loadProfile('emmauscollege'), database());
  await app.context.downloadLegacySnapshot();
  assert.equal(app.downloads.length, 0);
  assert.match(app.elements.get('saveStatus').textContent, /geen oudere lokale kopie/);
});
