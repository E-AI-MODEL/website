'use strict';
/* Shared browser/Node profile validation. No network, storage or tenant defaults. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (typeof window === 'object' ? window : globalThis).AssuranceProfile = api;
})(function () {
  const SCHEMA = 'eai-ict-assurance-profile-v1';
  const LEGACY_REGISTERS = Object.freeze([
    'apps', 'ai', 'connections', 'parts', 'additionalCandidates', 'checks',
    'dpia', 'aiControls', 'devices', 'licenseReview', 'workActions',
    'softwareReview', 'faqs'
  ]);
  const REGISTERS = Object.freeze([...LEGACY_REGISTERS, 'sourceRegister']);
  const fail = message => { throw new TypeError('Ongeldig organisatieprofiel: ' + message); };
  const object = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' moet een object zijn.');
  };
  function keys(value, required, label, optional = []) {
    object(value, label);
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) fail(label + '.' + key + ' ontbreekt.');
    }
    for (const key of Object.keys(value)) {
      if (!required.includes(key) && !optional.includes(key)) fail(label + '.' + key + ' is niet ondersteund.');
    }
  }
  function text(value, label, max = 240) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
      fail(label + ' moet een ingevulde tekst zonder randspaties of stuurtekens zijn.');
    }
  }
  function version(value, label) {
    text(value, label, 40);
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) fail(label + ' moet major.minor.patch gebruiken.');
  }
  function identifier(value, label) {
    text(value, label, 100);
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)) fail(label + ' bevat een ongeldig ID.');
  }
  function path(value, label, jsonFile = false) {
    text(value, label);
    const parts = value.split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || !/^[A-Za-z0-9][A-Za-z0-9._ ()-]*$/.test(part)) || value.includes('..')) {
      fail(label + ' moet een veilig relatief pad zijn.');
    }
    if (jsonFile && !/\.json$/.test(value)) fail(label + ' moet naar een JSON-bestand verwijzen.');
  }
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  }
  function validate(input) {
    keys(input, ['schema', 'profileVersion', 'organisation', 'source', 'policy', 'synthetic'], 'profiel');
    if (input.schema !== SCHEMA) fail('onbekende schemaversie.');
    version(input.profileVersion, 'profileVersion');
    if (typeof input.synthetic !== 'boolean') fail('synthetic moet true of false zijn.');

    keys(input.organisation, ['id', 'name', 'locale'], 'organisation');
    identifier(input.organisation.id, 'organisation.id');
    text(input.organisation.name, 'organisation.name', 160);
    text(input.organisation.locale, 'organisation.locale', 40);
    try {
      if (Intl.getCanonicalLocales(input.organisation.locale).length !== 1) fail('organisation.locale is ongeldig.');
    } catch (_) { fail('organisation.locale is ongeldig.'); }

    keys(input.source, ['repository', 'baseRef', 'sourceDir', 'scopeId', 'registerFiles'], 'source', ['configurationFiles']);
    text(input.source.repository, 'source.repository', 200);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(input.source.repository) || input.source.repository.includes('..')) {
      fail('source.repository moet eigenaar/repository gebruiken.');
    }
    text(input.source.baseRef, 'source.baseRef', 120);
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(input.source.baseRef) || input.source.baseRef.includes('..') || input.source.baseRef.includes('//') || input.source.baseRef.endsWith('/') || input.source.baseRef.endsWith('.') || input.source.baseRef.split('/').some(part => part.startsWith('.') || part.endsWith('.lock'))) {
      fail('source.baseRef moet een geldige branch- of tagnaam zijn.');
    }
    path(input.source.sourceDir, 'source.sourceDir');
    identifier(input.source.scopeId, 'source.scopeId');
    keys(input.source.registerFiles, LEGACY_REGISTERS, 'source.registerFiles', ['sourceRegister']);
    for (const type of Object.keys(input.source.registerFiles)) path(input.source.registerFiles[type], 'source.registerFiles.' + type, true);
    if (Object.prototype.hasOwnProperty.call(input.source, 'configurationFiles')) {
      const files = input.source.configurationFiles;
      keys(files, ['profile', 'catalog', 'engine', 'sourceRegister'], 'source.configurationFiles');
      for (const [type, file] of Object.entries(files)) {
        const label = 'source.configurationFiles.' + type;
        path(file, label, type === 'profile' || type === 'catalog');
        if (['engine', 'sourceRegister'].includes(type) && !/\.js$/.test(file)) fail(label + ' moet naar een JavaScript-bestand verwijzen.');
      }
      if (new Set(Object.values(files)).size !== 4) fail('source.configurationFiles moet vier verschillende bestanden aanwijzen.');
    }

    keys(input.policy, ['id', 'version', 'reviewMaxAgeDays', 'basis', 'description'], 'policy');
    identifier(input.policy.id, 'policy.id');
    version(input.policy.version, 'policy.version');
    if (!Number.isSafeInteger(input.policy.reviewMaxAgeDays) || input.policy.reviewMaxAgeDays < 1 || input.policy.reviewMaxAgeDays > 36525) {
      fail('policy.reviewMaxAgeDays moet een geheel aantal dagen tussen 1 en 36525 zijn.');
    }
    if (!['project-default', 'organisation-policy'].includes(input.policy.basis)) fail('policy.basis is onbekend.');
    text(input.policy.description, 'policy.description', 1000);
    return freeze(JSON.parse(JSON.stringify(input)));
  }
  function scopeKey(input) {
    const profile = validate(input);
    return [profile.organisation.id, profile.source.repository, profile.source.baseRef, profile.source.sourceDir, profile.source.scopeId].join('|');
  }
  return Object.freeze({ SCHEMA, REGISTERS, LEGACY_REGISTERS, validate, scopeKey });
});
