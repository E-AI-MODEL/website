import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const profileJson = JSON.parse(read('tools/ict-scan/assurance/profiles/emmauscollege.json'));
const catalog = JSON.parse(read('tools/ict-scan/frameworks.json'));
const registers = ['apps', 'ai', 'connections', 'parts', 'candidates', 'checks', 'dpia', 'aiControls', 'devices', 'licenseReview', 'workActions', 'softwareReview', 'faqs'];

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

function setup({token = 'synthetic-secret-for-security-tests', message = 'Registratie bijwerken', fetchResponse, record} = {}) {
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
  for (const path of ['tools/ict-scan/assurance/profile.js', 'tools/ict-scan/assurance/record-contract.js']) vm.runInContext(read(path), context, {filename: path});
  const profile = context.AssuranceProfile.validate(clone(profileJson));
  context.IctOrganisation = {profile, ready: Promise.resolve(profile)};
  state.sources = [{name: profile.source.registerFiles.apps, githubRemote: {repository: profile.source.repository, ref: profile.source.baseRef, path: profile.source.sourceDir + '/' + profile.source.registerFiles.apps, sha: 'a'.repeat(40)}}];
  const draft = {type: 'apps', id: original.id, before: clone(original), after: {...clone(original), description: 'Gecorrigeerde omschrijving'}, changed: ['description'], reason: 'Correctie na broncontrole', sourceScope: context.AssuranceProfile.scopeKey(profile)};
  context.EmmausRecordCards = {
    drafts: () => [clone(draft)],
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
