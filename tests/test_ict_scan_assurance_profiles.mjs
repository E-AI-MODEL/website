import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root = 'tools/ict-scan/assurance/';
const source = readFileSync(root + 'profile.js', 'utf8');
const context = {module: {exports: {}}, Intl};
vm.runInNewContext(source, context, {filename: 'profile.js'});
const api = context.module.exports;
const read = name => JSON.parse(readFileSync(root + 'profiles/' + name + '.json', 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));

test('Organisatieprofielen benoemen hun eigen bron en de herkomst van de termijn', () => {
  for (const name of ['emmauscollege', 'example-organisation']) {
    const profile = api.validate(read(name));
    assert.equal(profile.organisation.id, name);
    assert.equal(profile.policy.basis, 'project-default');
    assert.equal(profile.policy.reviewMaxAgeDays, 365);
    assert.equal(Object.keys(profile.source.registerFiles).length, 14);
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.source.registerFiles));
  }
});

test('Emmauscollege-profiel verwijst voor elk register naar het echte bronbestand', () => {
  const profile = api.validate(read('emmauscollege'));
  for (const [register, filename] of Object.entries(profile.source.registerFiles)) {
    const data = JSON.parse(readFileSync(profile.source.sourceDir + '/' + filename, 'utf8'));
    assert.ok(Array.isArray(data[register]), register + ' ontbreekt in ' + filename);
  }
});

test('Het tweede profiel bevat uitsluitend een eigen fictieve configuratie', () => {
  const profile = api.validate(read('example-organisation'));
  assert.equal(profile.synthetic, true);
  assert.equal(profile.source.repository, 'example-org/example-inventory');
  assert.equal(profile.source.sourceDir, 'inventory');
  assert.equal(profile.organisation.locale, 'en-GB');
  assert.doesNotMatch(JSON.stringify(profile), /Emmaus|E-AI-MODEL|2026-applicatielandschap|Hans Visser/i);
  assert.ok(Object.entries(profile.source.registerFiles).every(([type,file]) => file === (type === 'sourceRegister' ? 'source-register.json' : 'inventory.json')));
});

test('Publicatieconfiguratie is expliciet; oudere profielen blijven leesbaar zonder impliciete paden', () => {
  const current = api.validate(read('emmauscollege'));
  assert.deepEqual(Object.keys(current.source.configurationFiles).sort(), ['catalog','engine','profile','sourceRegister']);
  for (const path of Object.values(current.source.configurationFiles)) assert.ok(readFileSync(path,'utf8').length > 0);
  assert.deepEqual(JSON.parse(readFileSync(current.source.configurationFiles.profile,'utf8')),copy(current));
  const original = read('emmauscollege');delete original.source.configurationFiles;
  assert.equal(Object.hasOwn(api.validate(original).source,'configurationFiles'),false);
});

test('Configuratiepaden zijn volledig, uniek en veilig relatief aan de ingestelde repository', () => {
  for (const value of ['../outside.json','/absolute.json','https://example.org/profile.json','config/%2e%2e/profile.json','config/profile.json?path=other','config/profile.json#other','config\\profile.json','config/profile.js']) {
    const profile = read('emmauscollege');profile.source.configurationFiles.profile = value;
    assert.throws(() => api.validate(profile),/configurationFiles/);
  }
  for (const mutate of [
    files => {delete files.catalog;},
    files => {files.extra = 'extra.json';},
    files => {files.catalog = files.profile;},
    files => {files.engine = 'engine.json';},
    files => {files.sourceRegister = null;}
  ]) {
    const profile = read('emmauscollege');mutate(profile.source.configurationFiles);
    assert.throws(() => api.validate(profile),/configurationFiles/);
  }
});

test('Een eerder profiel met dertien registers blijft leesbaar zonder stil bronregister toe te voegen', () => {
  const original = read('emmauscollege');
  delete original.source.registerFiles.sourceRegister;
  const profile = api.validate(original);
  assert.equal(Object.keys(profile.source.registerFiles).length, 13);
  assert.equal(Object.hasOwn(profile.source.registerFiles, 'sourceRegister'), false);
  assert.ok(api.REGISTERS.includes('sourceRegister'));
});

test('Validatie gebruikt geen impliciete terugval naar de Emmauscollege-bron', () => {
  for (const key of ['repository', 'baseRef', 'sourceDir', 'scopeId', 'registerFiles']) {
    const profile = read('example-organisation');
    delete profile.source[key];
    assert.throws(() => api.validate(profile), /ontbreekt/);
  }
  assert.throws(() => api.validate(null), /object/);
  const wrong = read('emmauscollege');
  wrong.schema = 'future-schema';
  assert.throws(() => api.validate(wrong), /schemaversie/);
});

test('Paden kunnen niet buiten de aangegeven bronmap wijzen', () => {
  for (const value of ['../private', '/absolute', 'https://example.org/data', 'nested//data', 'nested/../data', '%2e%2e/data', 'nested\\data', 'data/']) {
    const profile = read('emmauscollege');
    profile.source.sourceDir = value;
    assert.throws(() => api.validate(profile), /relatief pad/);
  }
  for (const value of ['../other.json', '/other.json', 'https://example.org/data.json', '%2e%2e/data.json', 'data.yaml']) {
    const profile = read('emmauscollege');
    profile.source.registerFiles.apps = value;
    assert.throws(() => api.validate(profile), /relatief pad|JSON-bestand/);
  }
});

test('Verkeerde refs, policywaarden en onvolledige registers worden geweigerd', () => {
  for (const value of ['main..other', 'heads//main', 'main.lock', 'refs/.hidden', 'https://example.org/main', 'main\n']) {
    const profile = read('emmauscollege');
    profile.source.baseRef = value;
    assert.throws(() => api.validate(profile), /baseRef/);
  }
  for (const value of [0, -1, 0.5, 36526, '365', null, Infinity]) {
    const profile = read('emmauscollege');
    profile.policy.reviewMaxAgeDays = value;
    assert.throws(() => api.validate(profile), /reviewMaxAgeDays/);
  }
  const incomplete = read('emmauscollege');
  delete incomplete.source.registerFiles.faqs;
  assert.throws(() => api.validate(incomplete), /faqs ontbreekt/);
  const extra = read('emmauscollege');
  extra.source.registerFiles.other = 'data.json';
  assert.throws(() => api.validate(extra), /other is niet ondersteund/);
});

test('Invoerwijzigingen kunnen een gevalideerd profiel niet achteraf wijzigen', () => {
  const input = read('emmauscollege');
  const profile = api.validate(input);
  const original = JSON.stringify(profile);
  input.source.repository = 'different-owner/different-repo';
  input.source.registerFiles.apps = 'different.json';
  input.policy.reviewMaxAgeDays = 1;
  assert.equal(JSON.stringify(profile), original);
  assert.throws(() => {profile.source.repository = 'different-owner/different-repo';}, TypeError);
});

test('Bronidentiteit onderscheidt organisatie, repository, ref, map en toepassingsbereik', () => {
  const original = read('emmauscollege');
  const key = api.scopeKey(original);
  for (const [group, field, value] of [
    ['organisation', 'id', 'different-organisation'],
    ['source', 'repository', 'different-owner/different-repo'],
    ['source', 'baseRef', 'test-branch'],
    ['source', 'sourceDir', 'different/data'],
    ['source', 'scopeId', 'different-inventory']
  ]) {
    const changed = copy(original);
    changed[group][field] = value;
    assert.notEqual(api.scopeKey(changed), key, group + '.' + field);
  }
  assert.equal(api.scopeKey(copy(original)), key);
});

test('Onbekende velden en toegangssleutels horen niet in een organisatieprofiel', () => {
  const profile = read('emmauscollege');
  profile.token = 'not-a-real-token';
  assert.throws(() => api.validate(profile), /token is niet ondersteund/);
  const wrongLocale = read('emmauscollege');
  wrongLocale.organisation.locale = 'not_a_locale';
  assert.throws(() => api.validate(wrongLocale), /locale/);
});

test('Dezelfde validator is zonder Node-module beschikbaar voor de browser', () => {
  const browser = {window: {}, Intl};
  vm.runInNewContext(source, browser, {filename: 'profile.js'});
  const profile = browser.window.AssuranceProfile.validate(read('example-organisation'));
  assert.equal(profile.organisation.id, 'example-organisation');
  assert.equal(browser.window.AssuranceProfile.scopeKey(profile), api.scopeKey(profile));
});
