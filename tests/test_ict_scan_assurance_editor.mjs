import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const profileJson = JSON.parse(read('tools/ict-scan/assurance/profiles/emmauscollege.json'));
const catalog = JSON.parse(read('tools/ict-scan/frameworks.json'));
const registerStores = ['apps', 'ai', 'connections', 'parts', 'candidates', 'checks', 'dpia', 'aiControls', 'devices', 'licenseReview', 'workActions', 'softwareReview', 'faqs', 'sourceRegister'];

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
  context.EmmausEditGate = {request: async () => true};
  vm.createContext(context);
  for (const path of ['tools/ict-scan/assurance/profile.js', 'tools/ict-scan/assurance/source-register.js', 'tools/ict-scan/assurance/engine.js', 'tools/ict-scan/assurance/adapter.js', 'tools/ict-scan/assurance/record-contract.js']) vm.runInContext(read(path), context, {filename: path});
  const profile = context.AssuranceProfile.validate(clone(profileJson));
  context.IctOrganisation = {profile, ready: Promise.resolve(profile)};
  state.sources = [remoteSource(profile)];
  vm.runInContext(read('tools/ict-scan/record-github.js'), context, {filename: 'record-github.js'});
  vm.runInContext(read('tools/ict-scan/record-taxonomy.js'), context, {filename: 'record-taxonomy.js'});
  vm.runInContext(read('tools/ict-scan/record-cards.js'), context, {filename: 'record-cards.js'});
  document.dispatch('ict-scan:opened');
  await new Promise(resolve => setImmediate(resolve));
  const cards = context.EmmausRecordCards, logic = context.EmmausCardGitLogic;
  return {
    document, state, context, profile, cards, logic,
    open(id = 'APP-001') {return cards.open('apps', id, true, 'manager');},
    set(name, value) {const input = document.getElementById('cardFormFields').querySelector('[name="' + name + '"]'); assert.ok(input, 'Input ontbreekt: ' + name); input.value = value;},
    save() {this.set('changeReason', 'Correctie op basis van vastgelegde brongegevens'); document.getElementById('cardForm').dispatch('submit', {preventDefault() {}});}
  };
}
function documents(profile, apps) {
  const files = {};
  for (const [type, file] of Object.entries(profile.source.registerFiles)) {(files[file] ??= {schema:'eai-school-ict-v1'})[type] = type === 'apps' ? clone(apps) : [];}
  return files;
}

test('Een naamwijziging bewaart onbekende objecten, lijsten en geneste bronmetadata', async () => {
  const record = {id: 'APP-001', name: 'Original name', sources: ['S-1'], extension: {custom: ['retained', 7]}, customList: ['one', {value: 2}], recordMeta: {external: {source: 'foreign-schema'}}};
  const app = await setup([record]); await app.open();
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
  await app.open(); app.set('name', 'Changed name'); app.save();
  assert.deepEqual(clone(app.cards.drafts()[0].after.frameworkLinks[0].extra), link.extra);
});

test('Concepten uit een vreemde of lokale bron worden na bronomschakeling niet publiceerbaar', async () => {
  for (const sources of [[{name: 'local.json'}], [remoteSource(profileJson, {repository: 'different-org/data'})]]) {
    const app = await setup(); app.state.sources = sources; await app.open(); app.set('description', 'Details from a different organisation'); app.save();
    const [draft] = app.cards.drafts(); assert.ok(draft); assert.equal(draft.sourceScope, null);
    app.state.sources = [remoteSource(app.profile)];
    app.logic.assertSourceMatches(app.profile, app.state.sources);
    const files = documents(app.profile, [{id: 'APP-001', name: 'Original name', description: 'Same old text', sources: ['S-1']}]);
    const before = JSON.stringify(files);
    assert.throws(() => app.logic.applyDrafts(files, [draft], 'reviewer', '2026-11-21T15:00:00Z', app.profile), /niet gekoppeld/);
    assert.equal(JSON.stringify(files), before);
    await app.open(); app.set('name', 'Another draft change'); app.save();
    assert.equal(app.cards.drafts()[0].sourceScope, null, 'Later bewerken mag bronbinding niet verhogen');
  }
});

test('Een bronwissel tijdens de eerste bewerking verhoogt de bronbinding niet', async () => {
  const original = {id: 'APP-001', name: 'Original name', description: 'Text from source B', sources: ['B']};
  const app = await setup([original]);
  app.state.sources = [remoteSource(app.profile, {repository: 'different-org/data'})];
  await app.open(); app.set('name', 'Name edited while source B was open');
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
  const app = await setup([original]); await app.open(); app.set('description', 'My pending change');
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
  const app = await setup([record]); await app.open(); app.set('description', 'Corrected description'); app.save();
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
  await app.open('APP-001'); app.set('name', 'First submitted change'); app.save();
  const submitted = app.cards.drafts();
  await app.open('APP-002'); app.set('name', 'Second change made during publication'); app.save();
  const newer = clone(app.cards.drafts().find(draft => draft.id === 'APP-002'));
  const result = app.cards.clearPublished(submitted);
  assert.equal(result.cleared, 1); assert.equal(result.remaining, 1);
  assert.deepEqual(clone(app.cards.drafts()), [newer]);
});

test('Een nieuwere versie van hetzelfde concept houdt haar originele bewerkbasis', async () => {
  const app = await setup(); await app.open(); app.set('description', 'First submitted change'); app.save();
  const submitted = app.cards.drafts();
  await app.open(); app.set('description', 'Later change of the same record'); app.save();
  const newer = clone(app.cards.drafts()[0]);
  const result = app.cards.clearPublished(submitted);
  assert.equal(result.cleared, 0); assert.equal(result.remaining, 1);
  assert.deepEqual(clone(app.cards.drafts()[0]), newer);
  assert.deepEqual(newer.before, clone(submitted[0].before));
});

test('Voltooide publicatie wist geen onbewaarde invoer of de oorspronkelijke vergelijkingsbasis', async () => {
  const app = await setup(); await app.open(); app.set('description', 'First submitted change'); app.save();
  const submitted = app.cards.drafts();
  await app.open(); app.set('description', 'Typing while publication completes');
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
  const app = await setup(original); await app.open('APP-001'); app.set('name', 'Submitted change'); app.save();
  const files = documents(app.profile, original), base = 'https://api.github.com/repos/' + app.profile.source.repository;
  const configuration = Object.fromEntries(Object.entries(app.profile.source.configurationFiles).map(([type,path]) => [path,
    type === 'profile' ? JSON.stringify(app.profile) : type === 'catalog' ? JSON.stringify(catalog) : read('tools/ict-scan/assurance/' + (type === 'engine' ? 'engine.js' : 'source-register.js'))]));
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
      const repoPath = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
      if (configuration[repoPath]) return {ok:true, json:async () => ({sha:'a'.repeat(40),encoding:'base64',content:Buffer.from(configuration[repoPath]).toString('base64')})};
      const path = repoPath.slice(app.profile.source.sourceDir.length + 1);
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
  await app.open('APP-002'); app.set('name', 'New unsent change'); app.save();
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

function approvedSource(app, overrides = {}) {
  const source = {id:'SRC-00001',name:'Fictieve bron',referenceKeys:['S-1'],owner:'Fictieve bronhouder',version:'1',rightsStatus:'Toegestaan',rightsBasis:'Fictieve toestemming',allowedUse:'Deze regressietest',scope:'Testomgeving',retention:'Tot einde van de test',approvalStatus:'Goedgekeurd',approvedBy:'Testbeoordelaar',approvedAt:'2026-11-20',approvalEvidence:'Testbesluit',nextReviewAt:'2027-11-20',...overrides};
  const context = {asOf:'2026-11-21',organisationId:app.profile.organisation.id,scopeId:app.context.AssuranceProfile.scopeKey(app.profile)};
  source.approvalBinding = app.context.AssuranceSourceRegister.createApprovalBinding(source, context);
  return source;
}
function filesWithSources(app, apps = [...app.state.apps.values()]) {
  const files = documents(app.profile, apps);
  files[app.profile.source.registerFiles.sourceRegister].sourceRegister = clone([...app.state.sourceRegister.values()]);
  return files;
}
function bindReviewDraft(app, files) {
  const before = clone(files[app.profile.source.registerFiles.apps].apps[0]);
  const link = {frameworkId:'AVG',article:'art. 30',status:'Onderbouwd',evidence:'Fictief vastgesteld besluit',reviewedBy:'Testbeoordelaar',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'};
  const after = {...clone(before),frameworkLinks:[link]}, proposed = clone(files);
  proposed[app.profile.source.registerFiles.apps].apps[0] = after;
  const input = app.context.AssuranceAdapter.fromDocuments(app.profile, proposed, catalog, {asOf:'2026-11-21',sourceVersion:''});
  const record = input.records.find(item => item.type === 'apps' && item.id === after.id);
  link.reviewBinding = app.context.AssuranceEngine.createReviewBinding(input, record, link);
  return {type:'apps',id:after.id,before,after,changed:['frameworkLinks'],reason:'Expliciete beoordeling voor deze bronversie',sourceScope:app.context.AssuranceProfile.scopeKey(app.profile)};
}
function currentBinding(app, files, id = 'APP-001') {
  const input = app.context.AssuranceAdapter.fromDocuments(app.profile, files, catalog, {asOf:'2026-11-21',sourceVersion:''});
  const record = input.records.find(item => item.type === 'apps' && item.id === id);
  return app.context.AssuranceEngine.inspectReviewBinding(input, record, record.data.frameworkLinks[0]);
}

test('Een normbeoordeling vraagt expliciete bevestiging en gewone inhoudsbewerking bindt niet opnieuw', async () => {
  const original = {id:'APP-001',name:'Fictieve toepassing',description:'Oorspronkelijke inhoud',sources:['S-1'],frameworkLinks:[{frameworkId:'AVG',article:'art. 30',status:'In onderzoek',evidence:'Fictief bewijs'}]};
  const app = await setup([original]); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  await app.open();
  let row = app.document.getElementById('cardFrameworkRows').children[0];
  for (const [field, value] of Object.entries({status:'Onderbouwd',reviewedBy:'Testbeoordelaar',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'})) row.querySelector('[data-part="'+field+'"]').value = value;
  assert.equal(row.querySelector('[data-part="confirmReviewBinding"]').checked, false);
  app.save();
  assert.equal(app.cards.drafts().length, 0);
  assert.match(app.document.getElementById('cardFeedback').textContent, /Bevestig de gewijzigde beoordeling/);
  row.querySelector('[data-part="confirmReviewBinding"]').checked = true;
  app.save();
  const first = clone(app.cards.drafts()[0]); assert.ok(first.after.frameworkLinks[0].reviewBinding);
  const files = filesWithSources(app); files[app.profile.source.registerFiles.apps].apps[0] = clone(first.after);
  assert.equal(currentBinding(app, files).status, 'current');
  await app.open(); row = app.document.getElementById('cardFrameworkRows').children[0];
  assert.equal(row.querySelector('[data-part="confirmReviewBinding"]').checked, false);
  app.set('description', 'Inhoud gewijzigd zonder nieuw oordeel'); app.save();
  const changed = clone(app.cards.drafts()[0]);
  assert.deepEqual(changed.after.frameworkLinks[0].reviewBinding, first.after.frameworkLinks[0].reviewBinding);
  files[app.profile.source.registerFiles.apps].apps[0] = changed.after;
  assert.equal(currentBinding(app, files).status, 'stale');
});

test('Een nieuwe review past niet stil op remote inhoud die buiten de gewijzigde velden veranderde', async () => {
  const app = await setup(); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  const files = filesWithSources(app), draft = bindReviewDraft(app, files);
  files[app.profile.source.registerFiles.apps].apps[0].extension = {changedAfterReview:true};
  const before = JSON.stringify(files);
  assert.throws(() => app.logic.applyDrafts(files, [draft], 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog), /nieuwe beoordeling.*actuele gegevens/);
  assert.equal(JSON.stringify(files), before);
});

test('Een nieuwe review wordt geweigerd na een remote bronaanvulling', async () => {
  const app = await setup(); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  const files = filesWithSources(app), draft = bindReviewDraft(app, files);
  files[app.profile.source.registerFiles.apps].apps[0].sources.push('Een later toegevoegde bron');
  const before = JSON.stringify(files);
  assert.throws(() => app.logic.applyDrafts(files, [draft], 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog), /nieuwe beoordeling.*actuele gegevens/);
  assert.equal(JSON.stringify(files), before);
});

test('Bindingscontrole gebruikt de finale bronwijziging in dezelfde batch, ongeacht volgorde', async () => {
  const app = await setup(); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  const original = filesWithSources(app), review = bindReviewDraft(app, original);
  const change = {type:'sourceRegister',id:source.id,before:clone(source),after:{...clone(source),version:'2'},changed:['version'],reason:'Bronversie vernieuwd na de lokale beoordeling',sourceScope:review.sourceScope};
  for (const batch of [[review,change],[change,review]]) {
    const files = clone(original), before = JSON.stringify(files);
    assert.throws(() => app.logic.applyDrafts(files, batch, 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog), /nieuwe beoordeling.*actuele gegevens/);
    assert.equal(JSON.stringify(files), before);
  }
});

test('Een reeds verouderde review blijft bewaard bij een gewone gegevenscorrectie', async () => {
  const app = await setup(); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  const files = filesWithSources(app), reviewed = bindReviewDraft(app, files);
  app.logic.applyDrafts(files, [reviewed], 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog);
  assert.equal(currentBinding(app, files).status, 'current');
  const before = clone(files[app.profile.source.registerFiles.apps].apps[0]);
  const edit = {type:'apps',id:before.id,before,after:{...clone(before),description:'Nieuwe inhoud'},changed:['description'],reason:'Gegevens gecorrigeerd zonder nieuwe beoordeling',sourceScope:reviewed.sourceScope};
  app.logic.applyDrafts(files, [edit], 'publisher', '2026-11-21T16:00:00Z', app.profile, catalog);
  assert.equal(currentBinding(app, files).status, 'stale');
  assert.deepEqual(clone(files[app.profile.source.registerFiles.apps].apps[0].frameworkLinks[0].reviewBinding), clone(before.frameworkLinks[0].reviewBinding));
});

test('Een nieuw bronbesluit wordt pas na samenvoegen gecontroleerd en een auditstempel maakt het niet ongeldig', async () => {
  const app = await setup(), approved = approvedSource(app);
  const original = {...clone(approved),approvalStatus:'Nog te beoordelen'}; delete original.approvalBinding;
  app.state.sourceRegister.set(original.id, original);
  const draft = {type:'sourceRegister',id:approved.id,before:clone(original),after:clone(approved),changed:['approvalStatus','approvalBinding'],reason:'Brongebruik expliciet goedgekeurd voor deze gegevens',sourceScope:app.context.AssuranceProfile.scopeKey(app.profile)};
  const valid = filesWithSources(app);
  app.logic.applyDrafts(valid, [draft], 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog);
  const written = valid[app.profile.source.registerFiles.sourceRegister].sourceRegister[0];
  assert.equal(written.auditTrail[0].actor, 'publisher');
  const context = {asOf:'2026-11-21',organisationId:app.profile.organisation.id,scopeId:draft.sourceScope};
  assert.equal(app.context.AssuranceSourceRegister.inspectApprovalBinding(written, context).status, 'current');
  const conflicted = filesWithSources(app); conflicted[app.profile.source.registerFiles.sourceRegister].sourceRegister[0].allowedUse = 'Remote gewijzigd gebruik';
  const snapshot = JSON.stringify(conflicted);
  assert.throws(() => app.logic.applyDrafts(conflicted, [draft], 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog), /nieuwe brongoedkeuring.*actuele gegevens/);
  assert.equal(JSON.stringify(conflicted), snapshot);
});

test('Gewijzigde regels of catalogusinhoud maken een nieuwe lokale review onbruikbaar', async () => {
  const app = await setup(); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  const files = filesWithSources(app), draft = bindReviewDraft(app, files), changedCatalog = clone(catalog);
  changedCatalog.references[0].name += ' gewijzigde uitleg';
  assert.throws(() => app.logic.applyDrafts(files, [draft], 'publisher', '2026-11-21T15:00:00Z', app.profile, changedCatalog), /nieuwe beoordeling.*actuele gegevens/);
});

test('Een verdubbelde oude review omzeilt de bindingscontrole niet', async () => {
  const link = {frameworkId:'AVG',article:'art. 30',status:'Onderbouwd',evidence:'Fictief bewijs',reviewedBy:'Testbeoordelaar',reviewedAt:'2026-11-20'};
  const record = {id:'APP-001',name:'Fictief',sources:['S-1'],frameworkLinks:[link]};
  const app = await setup([record]); const source = approvedSource(app); app.state.sourceRegister.set(source.id, source);
  const files = filesWithSources(app), draft = {type:'apps',id:record.id,before:clone(record),after:{...clone(record),frameworkLinks:[clone(link),clone(link)]},changed:['frameworkLinks'],reason:'Dubbele oude review vereist alsnog een nieuwe binding',sourceScope:app.context.AssuranceProfile.scopeKey(app.profile)};
  const before = JSON.stringify(files);
  assert.throws(() => app.logic.applyDrafts(files, [draft], 'publisher', '2026-11-21T15:00:00Z', app.profile, catalog), /nieuwe beoordeling.*actuele gegevens/);
  assert.equal(JSON.stringify(files), before);
});

test('Een bronkaart toont provenance als object of lijst zonder de brongegevens te wijzigen', async () => {
  const seed=JSON.parse(read('tools/ict-scan/bronnen/2026-bronnenregister.json')).sourceRegister;
  const grouped=seed.find(source=>source.provenance?.file);
  assert.ok(grouped,'De gegroepeerde bronfixture ontbreekt');
  for(const provenance of [clone(grouped.provenance),[{file:grouped.provenance.file,sheet:'Tabblad',row:0}]]){
    const app=await setup(),source={...clone(grouped),provenance};
    app.state.sourceRegister.set(source.id,source);
    assert.doesNotThrow(()=>app.cards.open('sourceRegister',source.id,false,'manager'));
    const visible=node=>[node.textContent||'',...(node.children||[]).flatMap(child=>visible(child))];
    assert.ok(visible(app.document.body).join('\n').includes(grouped.provenance.file));
    assert.deepEqual(app.state.sourceRegister.get(source.id),source);
    await await app.cards.open('sourceRegister',source.id,true,'manager');
    assert.deepEqual(app.state.sourceRegister.get(source.id),source);
  }
});

test('Een gewone naamwijziging bewaart exacte bronaliassen met spaties, tabs en regeleinden', async () => {
  const app=await setup(),source=approvedSource(app,{referenceKeys:[' Exacte bronref ','\tTweede bron\t','Verwijzing\nmet regeleinde']});
  source.approvalStatus='Nog te beoordelen';delete source.approvalBinding;
  app.state.sourceRegister.set(source.id,source);
  await app.cards.open('sourceRegister',source.id,true,'manager');app.set('name','Alleen de naam is gewijzigd');app.save();
  const draft=app.cards.drafts()[0];assert.ok(draft);
  assert.deepEqual(clone(draft.after.referenceKeys),source.referenceKeys);
  assert.equal(draft.changed.includes('referenceKeys'),false);
});

test('Expliciete aliasinvoer bewaart randspaties en tabs en weigert een regel met alleen spaties', async () => {
  const app=await setup(),source=approvedSource(app);source.approvalStatus='Nog te beoordelen';delete source.approvalBinding;
  app.state.sourceRegister.set(source.id,source);await app.cards.open('sourceRegister',source.id,true,'manager');
  app.set('referenceKeys',' Eerste bron \n\tTweede bron\t');app.save();
  assert.deepEqual(clone(app.cards.drafts()[0].after.referenceKeys),[' Eerste bron ','\tTweede bron\t']);
  const accepted=clone(app.cards.drafts()[0]);
  await app.cards.open('sourceRegister',source.id,true,'manager');app.set('referenceKeys',' \t ');app.save();
  assert.deepEqual(clone(app.cards.drafts()[0]),accepted);
  assert.match(app.document.getElementById('cardFeedback').textContent,/alleen spaties/);
});

test('Een bevestigde normreview bewaart een onbekend null-veld en blijft geldig na remote samenvoegen', async () => {
  const original={id:'APP-001',name:'Fictief',description:'Inhoud',sources:['S-1'],extension:null,frameworkLinks:[{frameworkId:'AVG',article:'art. 30',status:'In onderzoek',evidence:'Fictief bewijs'}]};
  const app=await setup([original]),source=approvedSource(app);app.state.sourceRegister.set(source.id,source);await app.open();
  const row=app.document.getElementById('cardFrameworkRows').children[0];
  for(const [field,value] of Object.entries({status:'Onderbouwd',reviewedBy:'Testbeoordelaar',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'}))row.querySelector('[data-part="'+field+'"]').value=value;
  row.querySelector('[data-part="confirmReviewBinding"]').checked=true;app.save();
  const draft=app.cards.drafts()[0];assert.ok(draft);assert.ok(Object.hasOwn(draft.after,'extension'));assert.equal(draft.after.extension,null);
  assert.equal(draft.changed.includes('extension'),false);
  const files=filesWithSources(app);
  assert.doesNotThrow(()=>app.logic.applyDrafts(files,[draft],'publisher','2026-11-21T15:00:00Z',app.profile,catalog));
  assert.equal(currentBinding(app,files).status,'current');
  assert.equal(files[app.profile.source.registerFiles.apps].apps[0].extension,null);
});
