import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const profileJson = JSON.parse(read('tools/ict-scan/assurance/profiles/emmauscollege.json'));
const catalog = JSON.parse(read('tools/ict-scan/frameworks.json'));
const registerStores = ['apps', 'ai', 'connections', 'parts', 'candidates', 'checks', 'dpia', 'aiControls', 'devices', 'licenseReview', 'workActions', 'softwareReview', 'faqs'];

// Small DOM substitute for data roundtrips through the real form handlers.
// It does not claim browser layout, focus or accessibility coverage.
function documentStub() {
  function matches(node, selector) {
    if (selector === '[data-field]') return Boolean(node.dataset?.field);
    if (selector === '[name^="recordMeta."]') return Boolean(node.name?.startsWith('recordMeta.'));
    const named = selector.match(/^\[name="(.+)"\]$/);
    if (named) return node.name === named[1];
    const part = selector.match(/^\[data-part="(.+)"\]$/);
    return part ? node.dataset?.part === part[1] : false;
  }
  class Element {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.dataset = {}; this.events = {};
      this.name = ''; this.value = ''; this.id = ''; this.hidden = false;
      this.attributes = {}; this.parentElement = null;
      const classes = new Set();
      this.classList = {add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle(x, enabled) {if (enabled ?? !classes.has(x)) classes.add(x); else classes.delete(x);}};
    }
    append(...nodes) {for (const value of nodes) {const node = typeof value === 'object' ? value : {textContent: String(value), children: []}; node.parentElement = this; this.children.push(node);}}
    replaceChildren(...nodes) {for (const node of this.children) node.parentElement = null; this.children = []; this.append(...nodes);}
    addEventListener(name, handler) {(this.events[name] ??= []).push(handler);}
    dispatch(name, event = {}) {for (const handler of this.events[name] || []) handler(event);}
    setAttribute(name, value) {this.attributes[name] = String(value);}
    focus() {doc.activeElement = this;}
    remove() {if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this); this.parentElement = null;}
    querySelectorAll(selector) {const results = []; const visit = node => {for (const child of node.children || []) {if (matches(child, selector)) results.push(child); visit(child);}}; visit(this); return results;}
    querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  }
  const body = new Element('body');
  function byId(node, id) {if (node.id === id) return node; for (const child of node.children || []) {const found = byId(child, id); if (found) return found;} return null;}
  const doc = {
    body, activeElement: body, events: {},
    createElement: tag => new Element(tag),
    createTextNode: text => ({textContent: String(text), children: []}),
    getElementById(id) {const existing = byId(body, id); if (existing) return existing; const item = new Element('div'); item.id = id; body.append(item); return item;},
    addEventListener(name, handler) {(this.events[name] ??= []).push(handler);},
    dispatch(name, event = {}) {for (const handler of this.events[name] || []) handler(event);}
  };
  return doc;
}

function remoteSource(profile, overrides = {}) {
  return {name: 'inventory.json', githubRemote: {repository: profile.source.repository, ref: profile.source.baseRef, path: profile.source.sourceDir + '/' + profile.source.registerFiles.apps, sha: 'a'.repeat(40), ...overrides}};
}
async function setup(records = [{id: 'APP-001', name: 'Original name', description: 'Same old text', sources: ['S-1']}]) {
  const document = documentStub();
  const state = Object.fromEntries(registerStores.map(type => [type, new Map()]));
  state.apps = new Map(records.map(record => [record.id, clone(record)])); state.ready = true;
  const context = {document, state, Map, Set, Intl, TextEncoder, TextDecoder, Uint8Array, atob, btoa, console, URL, crypto: webcrypto,
    renderSources() {}, confirm: () => true,
    fetch: async () => ({ok: true, json: async () => clone(catalog)})};
  context.window = context;
  vm.createContext(context);
  for (const path of ['tools/ict-scan/assurance/profile.js', 'tools/ict-scan/assurance/record-contract.js']) vm.runInContext(read(path), context, {filename: path});
  const profile = context.AssuranceProfile.validate(clone(profileJson));
  context.IctOrganisation = {profile, ready: Promise.resolve(profile)};
  state.sources = [remoteSource(profile)];
  vm.runInContext(read('tools/ict-scan/record-github.js'), context, {filename: 'record-github.js'});
  vm.runInContext(read('tools/ict-scan/record-cards.js'), context, {filename: 'record-cards.js'});
  document.dispatch('ict-scan:opened');
  await new Promise(resolve => setImmediate(resolve));
  const cards = context.EmmausRecordCards, logic = context.EmmausCardGitLogic;
  return {
    document, state, context, profile, cards, logic,
    open(id = 'APP-001') {cards.open('apps', id, true, 'manager');},
    set(name, value) {const input = document.getElementById('cardFormFields').querySelector('[name="' + name + '"]'); assert.ok(input, 'Input ontbreekt: ' + name); input.value = value;},
    save() {this.set('changeReason', 'Correctie op basis van vastgelegde brongegevens'); document.getElementById('cardForm').dispatch('submit', {preventDefault() {}});}
  };
}
function documents(profile, apps) {
  const files = {};
  for (const [type, file] of Object.entries(profile.source.registerFiles)) {(files[file] ??= {})[type] = type === 'apps' ? clone(apps) : [];}
  return files;
}

test('Een naamwijziging bewaart onbekende objecten, lijsten en geneste bronmetadata', async () => {
  const record = {id: 'APP-001', name: 'Original name', sources: ['S-1'], extension: {custom: ['retained', 7]}, customList: ['one', {value: 2}], recordMeta: {external: {source: 'foreign-schema'}}};
  const app = await setup([record]); app.open();
  const form = app.document.getElementById('cardFormFields');
  assert.equal(form.querySelector('[name="extension"]'), null);
  assert.equal(form.querySelector('[name="customList"]'), null);
  app.set('name', 'Changed name'); app.save();
  const [draft] = app.cards.drafts(); assert.ok(draft);
  assert.deepEqual(clone(draft.after.extension), record.extension);
  assert.deepEqual(clone(draft.after.customList), record.customList);
  assert.deepEqual(clone(draft.after.recordMeta.external), record.recordMeta.external);
  assert.equal(draft.changed.includes('extension'), false);
  assert.equal(app.state.apps.get(record.id).name, record.name);
});

test('Een ongewijzigde normverwijzing bewaart onbekende gestructureerde uitbreidingen', async () => {
  const link = {frameworkId: 'AVG', article: 'art. 28', status: 'In onderzoek', evidence: 'DOC-1', extra: {clauseVersion: 3, observations: ['keep']}};
  const app = await setup([{id: 'APP-001', name: 'Original name', sources: ['S-1'], frameworkLinks: [link]}]);
  app.open(); app.set('name', 'Changed name'); app.save();
  assert.deepEqual(clone(app.cards.drafts()[0].after.frameworkLinks[0].extra), link.extra);
});

test('Concepten uit een vreemde of lokale bron worden na bronomschakeling niet publiceerbaar', async () => {
  for (const sources of [[{name: 'local.json'}], [remoteSource(profileJson, {repository: 'different-org/data'})]]) {
    const app = await setup(); app.state.sources = sources; app.open(); app.set('description', 'Details from a different organisation'); app.save();
    const [draft] = app.cards.drafts(); assert.ok(draft); assert.equal(draft.sourceScope, null);
    app.state.sources = [remoteSource(app.profile)];
    app.logic.assertSourceMatches(app.profile, app.state.sources);
    const files = documents(app.profile, [{id: 'APP-001', name: 'Original name', description: 'Same old text', sources: ['S-1']}]);
    const before = JSON.stringify(files);
    assert.throws(() => app.logic.applyDrafts(files, [draft], 'reviewer', '2026-11-21T15:00:00Z', app.profile), /niet gekoppeld/);
    assert.equal(JSON.stringify(files), before);
    app.open(); app.set('name', 'Another draft change'); app.save();
    assert.equal(app.cards.drafts()[0].sourceScope, null, 'Later bewerken mag bronbinding niet verhogen');
  }
});

test('Een bronwissel tijdens de eerste bewerking verhoogt de bronbinding niet', async () => {
  const original = {id: 'APP-001', name: 'Original name', description: 'Text from source B', sources: ['B']};
  const app = await setup([original]);
  app.state.sources = [remoteSource(app.profile, {repository: 'different-org/data'})];
  app.open(); app.set('name', 'Name edited while source B was open');
  app.state.sources = [remoteSource(app.profile)];
  app.state.apps.set(original.id, {id: original.id, name: original.name, description: 'Text from source A', sources: ['A']});
  app.save();
  const [draft] = app.cards.drafts(); assert.ok(draft);
  assert.equal(draft.sourceScope, null);
  assert.equal(draft.before.description, original.description);
  const files = documents(app.profile, [...app.state.apps.values()]);
  assert.throws(() => app.logic.applyDrafts(files, [draft], 'reviewer', '2026-11-21T15:00:00Z', app.profile), /niet gekoppeld/);
});

test('Een gelijktijdige bronwijziging blijft zichtbaar tegenover de oorspronkelijke bewerkbasis', async () => {
  const original = {id: 'APP-001', name: 'Original name', description: 'Old description', sources: ['S-1']};
  const app = await setup([original]); app.open(); app.set('description', 'My pending change');
  app.state.apps.set(original.id, {...original, description: 'Another committed change'});
  app.save(); const [draft] = app.cards.drafts(); assert.ok(draft);
  assert.equal(draft.before.description, original.description);
  const files = documents(app.profile, [...app.state.apps.values()]);
  const before = JSON.stringify(files);
  assert.throws(() => app.logic.applyDrafts(files, [draft], 'reviewer', '2026-11-21T15:00:00Z', app.profile), /sinds jouw laatste bronversie gewijzigd/);
  assert.equal(JSON.stringify(files), before);
});

test('Een latere ongeldige normbeoordeling maakt een hele wijzigingsbatch ongewijzigd', async () => {
  const records = [{id: 'APP-001', name: 'First', description: 'Original', sources: ['S-1']}, {id: 'APP-002', name: 'Second', sources: ['S-2']}];
  const app = await setup(records); const files = documents(app.profile, records); const before = JSON.stringify(files);
  const sourceScope = app.logic.sourceScope(app.profile, app.state.sources);
  const drafts = records.map((record, index) => ({type: 'apps', id: record.id, sourceScope, before: clone(record),
    after: index ? {...record, frameworkLinks: [{frameworkId: 'EN18286', article: '8.4', status: 'Onderbouwd', evidence: ''}]} : {...record, description: 'Valid first change'},
    changed: index ? ['frameworkLinks'] : ['description'], reason: 'Whole-batch validation scenario'}));
  assert.throws(() => app.logic.applyDrafts(files, drafts, 'reviewer', '2026-11-21T15:00:00Z', app.profile), /zonder bewijs/);
  assert.equal(JSON.stringify(files), before);
});

test('Een geldige wijziging blijft gebonden aan haar bron en bewaart originele velden', async () => {
  const record = {id: 'APP-001', name: 'Original name', description: 'Old description', sources: ['S-1'], sourceFields: {original: 'Keep'}, extension: {value: 2}};
  const app = await setup([record]); app.open(); app.set('description', 'Corrected description'); app.save();
  const [draft] = app.cards.drafts(); assert.equal(draft.sourceScope, app.context.AssuranceProfile.scopeKey(app.profile));
  const files = documents(app.profile, [record]);
  app.logic.applyDrafts(files, [draft], 'reviewer', '2026-11-21T15:00:00Z', app.profile);
  const stored = files[app.profile.source.registerFiles.apps].apps[0];
  assert.equal(stored.description, 'Corrected description');
  assert.deepEqual(clone(stored.sourceFields), record.sourceFields);
  assert.deepEqual(clone(stored.extension), record.extension);
  assert.equal(stored.auditTrail[0].actor, 'reviewer');
});

test('Een nieuwe kaartwijziging tijdens publicatie blijft na voltooiing bewaard', async () => {
  const app = await setup([{id: 'APP-001', name: 'First', sources: ['S-1']}, {id: 'APP-002', name: 'Second', sources: ['S-2']}]);
  app.open('APP-001'); app.set('name', 'First submitted change'); app.save();
  const submitted = app.cards.drafts();
  app.open('APP-002'); app.set('name', 'Second change made during publication'); app.save();
  const newer = clone(app.cards.drafts().find(draft => draft.id === 'APP-002'));
  const result = app.cards.clearPublished(submitted);
  assert.equal(result.cleared, 1); assert.equal(result.remaining, 1);
  assert.deepEqual(clone(app.cards.drafts()), [newer]);
});

test('Een nieuwere versie van hetzelfde concept houdt haar originele bewerkbasis', async () => {
  const app = await setup(); app.open(); app.set('description', 'First submitted change'); app.save();
  const submitted = app.cards.drafts();
  app.open(); app.set('description', 'Later change of the same record'); app.save();
  const newer = clone(app.cards.drafts()[0]);
  const result = app.cards.clearPublished(submitted);
  assert.equal(result.cleared, 0); assert.equal(result.remaining, 1);
  assert.deepEqual(clone(app.cards.drafts()[0]), newer);
  assert.deepEqual(newer.before, clone(submitted[0].before));
});

test('Voltooide publicatie wist geen onbewaarde invoer of de oorspronkelijke vergelijkingsbasis', async () => {
  const app = await setup(); app.open(); app.set('description', 'First submitted change'); app.save();
  const submitted = app.cards.drafts();
  app.open(); app.set('description', 'Typing while publication completes');
  app.cards.clearPublished(submitted);
  const input = app.document.getElementById('cardFormFields').querySelector('[name="description"]');
  assert.equal(input.value, 'Typing while publication completes');
  app.save();
  const [newer] = app.cards.drafts();
  assert.equal(newer.after.description, 'Typing while publication completes');
  assert.deepEqual(clone(newer.before), clone(submitted[0].before));
  assert.equal(newer.sourceScope, submitted[0].sourceScope);
});

test('De publicatiecallback behoudt een tijdens de API-aanvraag gemaakt concept', async () => {
  const original = [{id: 'APP-001', name: 'First', sources: ['S-1']}, {id: 'APP-002', name: 'Second', sources: ['S-2']}];
  const app = await setup(original); app.open('APP-001'); app.set('name', 'Submitted change'); app.save();
  const files = documents(app.profile, original), base = 'https://api.github.com/repos/' + app.profile.source.repository;
  for (const value of Object.values(files)) value.schema = 'eai-school-ict-v1';
  const names = Object.keys(files), shas = Object.fromEntries(names.map((name, index) => [name, String(index + 1).repeat(40)]));
  files['manifest.json'] = {schema: 'eai-school-ict-manifest-v1', metadata: {}, dataFiles: names.map(path => ({path, sha: shas[path], recordCounts: Object.fromEntries(Object.entries(files[path]).filter(([, value]) => Array.isArray(value)).map(([type, value]) => [type, value.length]))}))};
  shas['manifest.json'] = '9'.repeat(40);
  const writes = [];
  let resolveUser, userStarted, prCreated;
  const requested = new Promise(resolve => {userStarted = resolve;});
  const completed = new Promise(resolve => {prCreated = resolve;});
  app.context.fetch = async (url, options) => {
    const method = options.method;
    if (url === 'https://api.github.com/user') {userStarted(); return new Promise(resolve => {resolveUser = () => resolve({ok: true, json: async () => ({login: 'test-reviewer'})});});}
    if (url === base + '/git/ref/heads/main') return {ok: true, json: async () => ({object: {sha: 'b'.repeat(40)}})};
    if (method === 'GET' && url.startsWith(base + '/contents/')) {
      const path = new URL(url).pathname.split('/contents/')[1].slice(app.profile.source.sourceDir.length + 1);
      assert.ok(files[path], path);
      return {ok: true, json: async () => ({sha: shas[path], encoding: 'base64', content: Buffer.from(JSON.stringify(files[path])).toString('base64')})};
    }
    if (method === 'POST' && url === base + '/git/refs') return {ok: true, json: async () => ({})};
    if (method === 'PUT') {writes.push({url, payload: JSON.parse(options.body)}); return {ok: true, json: async () => ({content: {sha: 'e'.repeat(40)}})};}
    if (method === 'POST' && url === base + '/pulls') {prCreated(); return {ok: true, json: async () => ({html_url: 'https://github.com/' + app.profile.source.repository + '/pull/123', number: 123})};}
    throw Error('Onverwacht API-verzoek in lokale test: ' + method + ' ' + url);
  };
  app.document.getElementById('cardGithubToken').value = 'synthetic-token-for-local-test';
  app.document.getElementById('cardCommitMessage').value = 'Local publication regression';
  app.document.getElementById('cardConfirmPublic').checked = true;
  app.document.getElementById('cardCreatePR').dispatch('click');
  await requested;
  app.open('APP-002'); app.set('name', 'New unsent change'); app.save();
  const unsent = clone(app.cards.drafts().find(draft => draft.id === 'APP-002'));
  resolveUser();
  let timeout;
  try {await Promise.race([completed, new Promise((_, reject) => {timeout = setTimeout(() => reject(Error('Publicatiecallback niet bereikt')), 1500);})]);}
  finally {clearTimeout(timeout);}
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(clone(app.cards.drafts()), [unsent]);
  const dataWrite = writes.find(write => write.url.endsWith(app.profile.source.registerFiles.apps));
  const published = JSON.parse(Buffer.from(dataWrite.payload.content, 'base64').toString('utf8'));
  assert.equal(published.apps.find(record => record.id === 'APP-001').name, 'Submitted change');
  assert.equal(published.apps.find(record => record.id === 'APP-002').name, 'Second');
  assert.equal(app.document.getElementById('cardGithubToken').value, '');
});
