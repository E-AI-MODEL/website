import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const profileJson = JSON.parse(read('tools/ict-scan/assurance/profiles/emmauscollege.json'));
const catalog = JSON.parse(read('tools/ict-scan/frameworks.json'));
const registers = ['apps', 'ai', 'connections', 'parts', 'candidates', 'checks', 'dpia', 'aiControls', 'devices', 'licenseReview', 'workActions', 'softwareReview', 'faqs', 'sourceRegister'];

// This DOM substitute detects use of HTML-parsing sinks. It is not a browser
// sandbox, a layout test or an external penetration test.
function dom() {
  const elements = new Map();
  const created = [];
  class Element {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.dataset = {}; this.events = {};
      this.attributes = {}; this.value = ''; this.hidden = false; this.checked = false;
      this._text = ''; this.parentElement = null;
      const classes = new Set();
      this.classList = {add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle(x, enabled) {if (enabled ?? !classes.has(x)) classes.add(x); else classes.delete(x);}};
      created.push(this);
    }
    set innerHTML(_) {throw Error('HTML parsing sink used');}
    set outerHTML(_) {throw Error('HTML parsing sink used');}
    insertAdjacentHTML() {throw Error('HTML parsing sink used');}
    set textContent(value) {this._text = String(value ?? ''); this.children = [];}
    get textContent() {return this._text + this.children.map(child => child.textContent ?? '').join('');}
    append(...values) {for (const value of values) {const child = typeof value === 'object' ? value : {textContent: String(value), children: []}; child.parentElement = this; this.children.push(child);}}
    replaceChildren(...values) {this._text = ''; this.children = []; this.append(...values);}
    setAttribute(name, value) {this.attributes[name] = String(value);}
    addEventListener(name, handler) {(this.events[name] ??= []).push(handler);}
    dispatch(name, event = {}) {for (const handler of this.events[name] || []) handler(event);}
    focus() {document.activeElement = this;}
    remove() {if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this);}
    querySelectorAll() {return [];}
    querySelector() {return null;}
  }
  const document = {
    events: {}, created,
    createElement: tag => new Element(tag),
    createTextNode: text => ({textContent: String(text), children: []}),
    getElementById(id) {if (!elements.has(id)) {const node = new Element('div'); node.id = id; elements.set(id, node);} return elements.get(id);},
    addEventListener(name, handler) {(this.events[name] ??= []).push(handler);},
    dispatch(name, event = {}) {for (const handler of this.events[name] || []) handler(event);}
  };
  document.body = new Element('body'); document.activeElement = document.body;
  return document;
}

function setup({token = 'synthetic-secret-for-security-tests', message = 'Registratie bijwerken', fetchResponse, record, rawProfile = profileJson} = {}) {
  const document = dom(), calls = [], feedback = [];
  let resolveFeedback;
  const feedbackReceived = new Promise(resolve => {resolveFeedback = resolve;});
  const state = Object.fromEntries(registers.map(name => [name, new Map()]));
  state.ready = true;
  const original = record || {id: 'APP-001', name: 'Testregistratie', description: 'Oorspronkelijke omschrijving', sources: []};
  state.apps.set(original.id, clone(original));
  const context = {
    document, state, URL, Intl, Map, Set, TextEncoder, TextDecoder, Uint8Array, atob, btoa, crypto: webcrypto,
    renderSources() {}, confirm: () => true,
    fetch: async (url, options) => {
      calls.push({url: String(url), options});
      if (fetchResponse) return fetchResponse(String(url), options);
      throw Error('Unexpected request in security test');
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const path of ['tools/ict-scan/assurance/profile.js', 'tools/ict-scan/assurance/source-register.js', 'tools/ict-scan/assurance/engine.js', 'tools/ict-scan/assurance/adapter.js', 'tools/ict-scan/assurance/record-contract.js']) vm.runInContext(read(path), context, {filename: path});
  const profile = context.AssuranceProfile.validate(clone(rawProfile));
  context.IctOrganisation = {profile, ready: Promise.resolve(profile)};
  state.sources = [{name: profile.source.registerFiles.apps, githubRemote: {repository: profile.source.repository, ref: profile.source.baseRef, path: profile.source.sourceDir + '/' + profile.source.registerFiles.apps, sha: 'a'.repeat(40)}}];
  const draft = {type: 'apps', id: original.id, before: clone(original), after: {...clone(original), description: 'Gecorrigeerde omschrijving'}, changed: ['description'], reason: 'Correctie na broncontrole', sourceScope: context.AssuranceProfile.scopeKey(profile)};
  context.EmmausRecordCards = {
    drafts: () => [clone(draft)],
    catalog: () => clone(catalog),
    feedback(message, error) {feedback.push({message, error}); resolveFeedback();},
    clearPublished() {throw Error('No successful publication expected in this test');}
  };
  document.getElementById('cardGithubToken').value = token;
  document.getElementById('cardCommitMessage').value = message;
  document.getElementById('cardConfirmPublic').checked = true;
  vm.runInContext(read('tools/ict-scan/record-github.js'), context, {filename: 'record-github.js'});
  return {
    context, document, calls, feedback, profile, draft, logic: context.EmmausCardGitLogic,
    async publishUntilFeedback() {
      let timer;
      document.getElementById('cardCreatePR').dispatch('click');
      try {await Promise.race([feedbackReceived, new Promise((_, reject) => {timer = setTimeout(() => reject(Error('No publication feedback')), 1000);})]);}
      finally {clearTimeout(timer);}
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

async function publicationFixture({rawProfile = profileJson, changeConfiguration, omitConfiguration} = {}) {
  const resources = new Map(), writes = [];
  const baseSha = 'b'.repeat(40);
  let app, finish;
  const done = new Promise(resolve => {finish = resolve;});
  app = setup({rawProfile, fetchResponse: async (url, options) => {
    const method = options.method, base = 'https://api.github.com/repos/' + app.profile.source.repository;
    const reply = data => ({ok:true, json:async () => data});
    if (url === 'https://api.github.com/user') return reply({login:'test-reviewer'});
    if (url === base + '/git/ref/heads/' + encodeURIComponent(app.profile.source.baseRef)) return reply({object:{sha:baseSha}});
    if (method === 'GET' && url.startsWith(base + '/contents/')) {
      assert.equal(new URL(url).searchParams.get('ref'), baseSha);
      const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
      const resource = resources.get(path);
      if (!resource) return {ok:false, status:404, json:async () => ({message:'Not Found'})};
      return reply({type:'file', sha:resource.sha, encoding:'base64', content:Buffer.from(resource.text).toString('base64')});
    }
    writes.push({url, method, body:JSON.parse(options.body)});
    if (method === 'POST' && url === base + '/git/refs') return reply({});
    if (method === 'PUT' && url.startsWith(base + '/contents/')) return reply({content:{sha:'e'.repeat(40)}});
    if (method === 'POST' && url === base + '/pulls') return reply({html_url:'https://github.com/' + app.profile.source.repository + '/pull/123', number:123});
    throw Error('Onverwacht verzoek: ' + method + ' ' + url);
  }});
  const files = {};
  for (const [type, filename] of Object.entries(app.profile.source.registerFiles)) (files[filename] ??= {schema:'eai-school-ict-v1'})[type] = type === 'apps' ? [clone(app.draft.before)] : [];
  const dataFiles = [];
  for (const [filename, data] of Object.entries(files)) {
    const sha = String(dataFiles.length + 1).repeat(40);
    resources.set(app.profile.source.sourceDir + '/' + filename, {sha, text:JSON.stringify(data)});
    dataFiles.push({path:filename, sha, recordCounts:Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([type,value]) => [type,value.length]))});
  }
  resources.set(app.profile.source.sourceDir + '/manifest.json', {sha:'9'.repeat(40), text:JSON.stringify({schema:'eai-school-ict-manifest-v1', metadata:{}, dataFiles})});
  const configuration = {profile:clone(app.profile), catalog:clone(catalog), engine:read('tools/ict-scan/assurance/engine.js'), sourceRegister:read('tools/ict-scan/assurance/source-register.js')};
  changeConfiguration?.(configuration);
  for (const [type, path] of Object.entries(app.profile.source.configurationFiles || {})) {
    if (type !== omitConfiguration) resources.set(path, {sha:'a'.repeat(40), text:typeof configuration[type] === 'string' ? configuration[type] : JSON.stringify(configuration[type])});
  }
  const priorFeedback = app.context.EmmausRecordCards.feedback;
  app.context.EmmausRecordCards.feedback = (...args) => {priorFeedback(...args);finish();};
  let cleared = 0;
  app.context.EmmausRecordCards.clearPublished = submitted => {cleared = submitted.length;finish();return {remaining:0};};
  app.document.getElementById('cardCreatePR').dispatch('click');
  let timer;
  try {await Promise.race([done, new Promise((_,reject) => {timer = setTimeout(() => reject(Error('Publicatie niet afgerond')),1500);})]);}
  finally {clearTimeout(timer);}
  await new Promise(resolve => setImmediate(resolve));
  return {...app, writes, cleared, configuration, baseSha};
}

test('De echte publiceerroute controleert expliciete configuratiepaden op dezelfde basis vóór alle schrijfacties', async () => {
  const rawProfile = JSON.parse(read('tools/ict-scan/assurance/profiles/example-organisation.json'));
  rawProfile.source.configurationFiles.profile = 'configuration/chosen organisation.json';
  const app = await publicationFixture({rawProfile, changeConfiguration: configuration => {
    configuration.catalog = Object.fromEntries(Object.entries(configuration.catalog).reverse());
    configuration.profile = Object.fromEntries(Object.entries(configuration.profile).reverse());
    configuration.engine += '\nglobalThis.remoteScriptExecuted = true;\n';
  }});
  assert.equal(app.feedback.length,0);
  assert.equal(app.cleared,1);
  assert.equal(app.context.remoteScriptExecuted,undefined,'Remote JavaScript wordt uitsluitend gelezen.');
  const firstWrite = app.calls.findIndex(call => call.options.method !== 'GET');
  for (const path of Object.values(app.profile.source.configurationFiles)) {
    const index = app.calls.findIndex(call => decodeURIComponent(new URL(call.url).pathname).endsWith('/contents/' + path));
    assert.ok(index >= 0 && index < firstWrite,path);
  }
  assert.ok(app.calls.every(call => call.url === 'https://api.github.com/user' || call.url.startsWith('https://api.github.com/repos/example-org/example-inventory/')));
  const branch = app.writes.find(write => write.url.endsWith('/git/refs'));
  assert.equal(branch.body.sha,app.baseSha);
  assert.ok(app.writes.some(write => write.url.endsWith('/pulls')));
  const dataWrite = app.writes.find(write => write.method === 'PUT' && write.url.endsWith('/' + app.profile.source.registerFiles.apps));
  const published = JSON.parse(Buffer.from(dataWrite.body.content,'base64').toString('utf8'));
  assert.equal(published.apps[0].description,app.draft.after.description);
  assert.equal(published.apps[0].reviewBinding,undefined);
});

test('Een inmiddels gewijzigde GitHub-catalogus stopt de echte publiceerroute vóór branch, PUT en PR', async () => {
  const app = await publicationFixture({changeConfiguration: configuration => {configuration.catalog.references[0].name += ' gewijzigd';}});
  assert.equal(app.writes.length,0);assert.equal(app.cleared,0);
  assert.match(app.feedback[0].message,/toetsingskaders op GitHub verschillen/);
});

test('Gewijzigd beleid, registermapping en profielscope stoppen publicatie zonder remote configuratie over te nemen', async () => {
  for (const change of [
    profile => {profile.policy.reviewMaxAgeDays += 1;},
    profile => {profile.source.registerFiles.apps = 'changed-apps.json';},
    profile => {profile.source.repository = 'other-owner/other-repository';profile.source.baseRef = 'other-branch';profile.source.configurationFiles.catalog = 'other/catalog.json';}
  ]) {
    const app = await publicationFixture({changeConfiguration: configuration => change(configuration.profile)});
    assert.equal(app.writes.length,0);assert.equal(app.cleared,0);
    assert.match(app.feedback[0].message,/organisatieprofiel op GitHub verschilt/);
    assert.ok(app.calls.every(call => call.url === 'https://api.github.com/user' || call.url.startsWith('https://api.github.com/repos/' + app.profile.source.repository + '/')));
    assert.ok(!app.calls.some(call => call.url.includes('other/catalog.json') || call.url.includes('changed-apps.json')));
  }
});

test('Een ontbrekende configuratiemapping of ontbrekend configuratiebestand laat geen schrijfactie toe', async () => {
  const legacy = clone(profileJson);delete legacy.source.configurationFiles;
  const older = await publicationFixture({rawProfile:legacy});
  assert.equal(older.calls.length,0);assert.equal(older.writes.length,0);
  assert.match(older.feedback[0].message,/Publiceren is nog niet ingericht/);
  const missing = await publicationFixture({omitConfiguration:'catalog'});
  assert.equal(missing.writes.length,0);assert.equal(missing.cleared,0);
  assert.match(missing.feedback[0].message,/Configuratie.*niet leesbaar.*bronrepository moet/);
});

test('Gewijzigde of onduidelijke moduleversies blokkeren vóór publicatie en remote code wordt niet uitgevoerd', async () => {
  for (const type of ['engine','sourceRegister']) {
    for (const duplicate of [false,true]) {
      const app = await publicationFixture({changeConfiguration: configuration => {
        configuration[type] = duplicate ? configuration[type] + '\nconst VERSION = "999.0.0";\n' : configuration[type].replace(/const VERSION = '[^']+';/,'const VERSION = "999.0.0";');
        configuration[type] += '\nglobalThis.remoteScriptExecuted = true;\n';
      }});
      assert.equal(app.writes.length,0);assert.equal(app.cleared,0);
      assert.equal(app.context.remoteScriptExecuted,undefined);
      assert.match(app.feedback[0].message,/controleversie|niet eenduidig/);
    }
  }
});

test('GitHub-verzoeken blijven binnen de ingestelde repository en de gebruikerscontrole', () => {
  const {logic, profile} = setup();
  const base = 'https://api.github.com/repos/' + profile.source.repository;
  assert.equal(logic.apiTarget('/git/ref/heads/main', profile), base + '/git/ref/heads/main');
  assert.equal(logic.apiTarget(base + '/contents/tools/ict-scan/bronnen?ref=main', profile), base + '/contents/tools/ict-scan/bronnen?ref=main');
  assert.equal(logic.apiTarget('https://api.github.com/user', profile), 'https://api.github.com/user');
  for (const url of [
    'https://attacker.invalid/repos/' + profile.source.repository + '/git/refs',
    'https://api.github.com.attacker.invalid/repos/' + profile.source.repository + '/git/refs',
    'https://api.github.com/repos/other-owner/other-repository/git/refs',
    base + '-other/git/refs',
    base + '/../other-repository/git/refs',
    base + '/%2e%2e/other-repository/git/refs',
    'https://user:password@api.github.com/user',
    'https://api.github.com/user#token',
    'https://api.github.com/user/keys',
    'https://api.github.com:8443/user'
  ]) assert.throws(() => logic.apiTarget(url, profile), /buiten de ingestelde repository/, url);
});

test('Bekende sleuteltypen en de exact ingevoerde sleutel worden uit inhoud geweerd', () => {
  const {logic} = setup();
  for (const token of ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'].map(prefix => prefix + 'A'.repeat(24)).concat(['github_pat_' + 'B'.repeat(24), 'sk-proj-' + 'C'.repeat(24)])) {
    assert.throws(() => logic.assertNoSecrets({description: 'Verborgen sleutel: ' + token}), /toegangssleutel/);
  }
  const nonstandard = 'synthetic-other-token-format-123456';
  assert.throws(() => logic.assertNoSecrets({reason: 'Plakfout ' + nonstandard}, nonstandard), /toegangssleutel/);
  assert.doesNotThrow(() => logic.assertNoSecrets({description: 'Normaal bronkenmerk', sourceSha: 'a'.repeat(64)}, nonstandard));
});

test('Een sleutel in het commitbericht wordt geblokkeerd voordat een netwerkverzoek start', async () => {
  const token = 'synthetic-unique-secret-for-commit';
  const app = setup({token, message: 'Correctie ' + token});
  await app.publishUntilFeedback();
  assert.equal(app.calls.length, 0);
  assert.match(app.feedback[0].message, /toegangssleutel/);
  assert.ok(!app.feedback[0].message.includes(token));
  assert.equal(app.document.getElementById('cardGithubToken').value, '');
});

test('API-fouten tonen geen ingevoerde sleutel en verzoeken volgen geen redirects', async () => {
  const token = 'synthetic-secret-returned-by-api';
  const app = setup({token, fetchResponse: async url => url === 'https://api.github.com/user'
    ? {ok: false, status: 401, json: async () => ({message: 'Request failed for ' + token})}
    : {ok: true, status: 200, json: async () => ({object: {sha: 'b'.repeat(40)}})}});
  await app.publishUntilFeedback();
  assert.ok(app.calls.length >= 1);
  for (const {url, options} of app.calls) {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
  }
  assert.ok(!JSON.stringify(app.feedback).includes(token));
  assert.match(app.feedback[0].message, /afgeschermd/);
  assert.equal(app.document.getElementById('cardGithubToken').value, '');
});

test('Lange API-fouten maskeren de sleutel voordat de tekst wordt ingekort', async () => {
  const token = 'synthetic-tail-token-not-a-known-prefix';
  const app = setup({token, fetchResponse: async url => url === 'https://api.github.com/user'
    ? {ok: false, status: 401, json: async () => ({message: 'x'.repeat(210) + token})}
    : {ok: true, status: 200, json: async () => ({object: {sha: 'b'.repeat(40)}})}});
  await app.publishUntilFeedback();
  assert.ok(!JSON.stringify(app.feedback).includes(token.slice(0, 10)), 'Ook een afgekapt sleutelfragment mag niet in de foutmelding staan.');
  assert.equal(app.document.getElementById('cardGithubToken').value, '');
});

test('Kaartnamen, bewijs en foutmeldingen worden als tekst weergegeven', async () => {
  const payload = '<img src=x onerror="globalThis.injected=true"><script>injected=true</script>';
  const app = setup({record: {id: 'APP-001', name: payload, description: payload, sources: [payload], frameworkLinks: [{frameworkId: 'IBP', article: '1', status: 'In onderzoek', evidence: payload}]}, fetchResponse: async () => ({ok: true, json: async () => clone(catalog)})});
  vm.runInContext(read('tools/ict-scan/record-taxonomy.js'), app.context, {filename: 'record-taxonomy.js'});
  vm.runInContext(read('tools/ict-scan/record-cards.js'), app.context, {filename: 'record-cards.js'});
  app.document.dispatch('ict-scan:opened');
  await new Promise(resolve => setImmediate(resolve));
  app.context.EmmausRecordCards.open('apps', 'APP-001', false, 'manager');
  app.context.EmmausRecordCards.feedback(payload, true);
  assert.equal(app.document.getElementById('cardFeedback').textContent, payload);
  assert.ok(app.document.created.some(node => node.textContent.includes(payload)));
  assert.ok(!app.document.created.some(node => ['img', 'script', 'iframe', 'svg'].includes(node.tagName)));
  assert.equal(app.context.injected, undefined);
});
