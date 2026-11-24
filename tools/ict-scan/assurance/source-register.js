'use strict';
/* Exact source resolution and declared-use checks. No network or inferred rights. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (typeof window === 'object' ? window : globalThis).AssuranceSourceRegister = api;
})(function () {
  const SCHEMA = 'eai-ict-source-register-v1';
  const VERSION = '1.0.0';
  const APPROVAL_SCHEMA = 'eai-ict-source-approval-v1';
  const MAX_BYTES = 1024 * 1024, MAX_DEPTH = 32, MAX_VALUES = 50000;
  const FIELDS = Object.freeze(['id', 'name', 'referenceKeys', 'owner', 'version', 'contentSha256',
    'rightsStatus', 'rightsBasis', 'allowedUse', 'scope', 'retention', 'approvalStatus',
    'approvedBy', 'approvedAt', 'approvalEvidence', 'nextReviewAt']);
  const RIGHTS_STATUSES = Object.freeze(['Onbekend', 'Toegestaan', 'Beperkt', 'Niet toegestaan']);
  const APPROVAL_STATUSES = Object.freeze(['Nog te beoordelen', 'Goedgekeurd', 'Afgewezen']);
  const LABELS = Object.freeze({owner:'bronhouder', rightsBasis:'grondslag voor gebruik', allowedUse:'toegestaan gebruik',
    scope:'toepassingsgebied', retention:'bewaarafspraak', approvedBy:'goedgekeurd door', approvalEvidence:'bewijs van goedkeuring',
    approvedAt:'goedgekeurd op', nextReviewAt:'opnieuw beoordelen op'});
  const SOURCE_ID = /^SRC-\d{5,}$/;
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const own = (value, field) => Object.prototype.hasOwnProperty.call(value, field);
  const filled = value => typeof value === 'string' && !!value.trim() && !/^(?:onbekend|unknown|\?|nog te bepalen|nog te beoordelen|niet vastgesteld)$/i.test(value.trim());
  const clone = value => JSON.parse(JSON.stringify(value));
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function finding(code, field, message, severity, sourceId) {
    return {code, field, message, severity, ...(['SOURCE_USE_DENIED', 'SOURCE_APPROVAL_REJECTED', 'SOURCE_USE_RESTRICTED'].includes(code) ? {category: 'business'} : {}), ...(typeof sourceId === 'string' ? {sourceId} : {})};
  }
  function sorted(findings) {
    return findings.sort((a, b) => compare(a.field, b.field) || compare(a.code, b.code)
      || compare(a.sourceId || '', b.sourceId || '') || compare(a.message, b.message));
  }
  function canonical(value) {
    const parts = [], active = new Set();
    let bytes = 0, values = 0;
    const token = text => {
      for (const character of text) {const code = character.codePointAt(0); bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;}
      if (bytes > MAX_BYTES) throw Error('De bron of goedkeuring is groter dan 1 MiB.');
      parts.push(text);
    };
    function visit(item, depth) {
      if (++values > MAX_VALUES || depth > MAX_DEPTH) throw Error('De bron of goedkeuring is te groot of te diep opgebouwd.');
      if (typeof item === 'string' && item.length > MAX_BYTES) throw Error('De bron of goedkeuring is groter dan 1 MiB.');
      if (item === null || typeof item === 'boolean' || typeof item === 'string') {token(JSON.stringify(item)); return;}
      if (typeof item === 'number' && Number.isFinite(item)) {token(JSON.stringify(item)); return;}
      if (!item || typeof item !== 'object' || active.has(item)) throw Error('De bron of goedkeuring bevat geen geldige JSON-waarden.');
      if (Object.getOwnPropertySymbols(item).length) throw Error('Symbolen zijn geen JSON-velden.');
      active.add(item);
      if (Array.isArray(item)) {
        if (Object.keys(item).length !== item.length) throw Error('De bron bevat een ongeldige lijst.');
        token('[');
        for (let i = 0; i < item.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(i));
          if (!descriptor || !own(descriptor, 'value')) throw Error('De bron bevat een ongeldige lijst.');
          if (i) token(','); visit(descriptor.value, depth + 1);
        }
        token(']');
      } else {
        const prototype = Object.getPrototypeOf(item);
        if (prototype !== null && (Object.getPrototypeOf(prototype) !== null || Object.prototype.toString.call(item) !== '[object Object]')) throw Error('Alleen gewone JSON-objecten worden ondersteund.');
        const keys = Object.keys(item).sort(compare);
        token('{');
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i], descriptor = Object.getOwnPropertyDescriptor(item, key);
          if (!descriptor || !own(descriptor, 'value')) throw Error('Een bronveld mag geen getter of setter zijn.');
          if (i) token(','); token(JSON.stringify(key)); token(':'); visit(descriptor.value, depth + 1);
        }
        token('}');
      }
      active.delete(item);
    }
    visit(value, 0);
    return parts.join('');
  }
  function projection(source) {
    if (!object(source)) throw Error('De bronregistratie moet een object zijn.');
    const projected = Object.create(null);
    for (const key of Object.keys(source)) {
      if (['approvalBinding', 'auditTrail', 'frameworkLinks'].includes(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!descriptor || !own(descriptor, 'value')) throw Error('Een bronveld mag geen getter of setter zijn.');
      projected[key] = descriptor.value;
    }
    if (Object.getOwnPropertySymbols(source).length) throw Error('Symbolen zijn geen JSON-velden.');
    return JSON.parse(canonical(projected));
  }
  function contextValid(options) {
    return object(options) && date(options.asOf) && ['organisationId', 'scopeId'].every(key =>
      typeof options[key] === 'string' && options[key] === options[key].trim() && options[key].length > 0 && options[key].length <= 1000 && !/[\u0000-\u001f\u007f]/.test(options[key]));
  }
  function inspectApprovalBinding(source, options = {}) {
    const issue = (status, code, field, message, severity) => ({status, findings: [finding(code, field, message, severity, source?.id)]});
    if (!contextValid(options)) return issue('invalid', 'SOURCE_APPROVAL_CONTEXT_INVALID', 'approvalBinding', 'Organisatie, bronbereik en controledatum moeten expliciet vaststaan.', 'fail');
    if (!object(source)) return issue('invalid', 'SOURCE_APPROVAL_BINDING_INVALID', 'approvalBinding', 'De bronregistratie moet een object zijn.', 'fail');
    if (!own(source, 'approvalBinding')) return issue('missing', 'SOURCE_APPROVAL_BINDING_MISSING', 'approvalBinding', 'De goedkeuring is nog niet gekoppeld aan deze exacte brongegevens.', 'attention');
    try {
      const descriptor = Object.getOwnPropertyDescriptor(source, 'approvalBinding');
      if (!descriptor || !own(descriptor, 'value')) throw Error('De goedkeuring heeft een ongeldig veld.');
      const binding = descriptor.value;
      if (!object(binding) || binding.schema !== APPROVAL_SCHEMA || Object.keys(binding).sort(compare).join('|') !== ['organisationId', 'schema', 'scopeId', 'source'].join('|') || !object(binding.source)) throw Error('De bronkoppeling heeft een ongeldige structuur.');
      canonical(binding);
      if (!['organisationId', 'scopeId'].every(key => typeof binding[key] === 'string' && binding[key].trim() === binding[key] && binding[key].length > 0 && binding[key].length <= 1000 && !/[\u0000-\u001f\u007f]/.test(binding[key]))) throw Error('De organisatie of het bronbereik ontbreekt in de goedkeuring.');
      if (['approvalBinding', 'auditTrail', 'frameworkLinks'].some(key => own(binding.source, key))) throw Error('De vastgelegde bron bevat uitgesloten beheervelden.');
      const current = projection(source);
      if (binding.organisationId !== options.organisationId || binding.scopeId !== options.scopeId || canonical(binding.source) !== canonical(current)) {
        return issue('stale', 'SOURCE_APPROVAL_BINDING_STALE', 'approvalBinding', 'De brongegevens, organisatie of het bronbereik zijn gewijzigd sinds de goedkeuring.', 'attention');
      }
      return {status: 'current', findings: []};
    } catch (error) {
      return issue('invalid', 'SOURCE_APPROVAL_BINDING_INVALID', 'approvalBinding', 'De vastgelegde goedkeuring is ongeldig: ' + error.message, 'fail');
    }
  }
  function validateDetails(source, options = {}) {
    const asOf = object(options) ? options.asOf : undefined;
    const findings = [];
    const add = (code, field, message, severity = 'attention') => findings.push(finding(code, field, message, severity, source?.id));
    if (!date(asOf)) add('SOURCE_AS_OF_INVALID', 'asOf', 'De controledatum moet een geldige datum zijn in jjjj-mm-dd.', 'fail');
    if (!object(source)) {
      add('SOURCE_RECORD_INVALID', 'sourceRegister', 'De bronregistratie moet een object zijn.', 'fail');
      return sorted(findings);
    }
    try { projection(source); } catch (error) {add('SOURCE_JSON_INVALID', 'sourceRegister', error.message, 'fail'); return sorted(findings);}
    if (typeof source.id !== 'string' || !SOURCE_ID.test(source.id)) add('SOURCE_ID_INVALID', 'id', 'Gebruik een bron-ID zoals SRC-00001.', 'fail');
    if (!filled(source.name)) add('SOURCE_NAME_MISSING', 'name', 'De naam van de bron ontbreekt.', 'fail');
    for (const field of FIELDS.filter(key => key !== 'referenceKeys')) {
      if (own(source, field) && typeof source[field] !== 'string') add('SOURCE_FIELD_INVALID', field, 'Dit bronveld moet tekst zijn.', 'fail');
    }
    if (!Array.isArray(source.referenceKeys)) add('SOURCE_ALIASES_INVALID', 'referenceKeys', 'Bronverwijzingen moeten een lijst van exacte teksten zijn.', 'fail');
    else {
      const seen = new Set();
      for (const reference of source.referenceKeys) {
        if (typeof reference !== 'string' || !reference.trim()) add('SOURCE_ALIAS_INVALID', 'referenceKeys', 'Een bronverwijzing is geen ingevulde tekst.', 'fail');
        else if (seen.has(reference)) add('SOURCE_ALIAS_DUPLICATE', 'referenceKeys', 'Dezelfde bronverwijzing staat meer dan eenmaal in deze bronregistratie: ' + reference, 'fail');
        else seen.add(reference);
      }
    }
    for (const field of ['owner', 'rightsBasis', 'allowedUse', 'scope', 'retention', 'approvedBy', 'approvalEvidence']) {
      if (!filled(source[field])) add('SOURCE_DETAIL_MISSING', field, 'Brongegeven ontbreekt: ' + LABELS[field] + '.');
    }
    if (!filled(source.version) && !filled(source.contentSha256)) add('SOURCE_VERSION_MISSING', 'version', 'Leg de bronversie of een SHA-256 van de inhoud vast.');
    if (source.contentSha256 !== undefined && source.contentSha256 !== '' && (typeof source.contentSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(source.contentSha256))) {
      add('SOURCE_HASH_INVALID', 'contentSha256', 'De inhoudshash moet een SHA-256 met 64 hexadecimale tekens zijn.', 'fail');
    }
    if (!source.rightsStatus || source.rightsStatus === 'Onbekend') add('SOURCE_RIGHTS_UNKNOWN', 'rightsStatus', 'Het recht om deze bron voor dit gebruik te benutten is niet vastgelegd.');
    else if (!RIGHTS_STATUSES.includes(source.rightsStatus)) add('SOURCE_RIGHTS_INVALID', 'rightsStatus', 'De rechtenstatus is ongeldig.', 'fail');
    else if (source.rightsStatus === 'Niet toegestaan') add('SOURCE_USE_DENIED', 'rightsStatus', 'Het vastgelegde gebruik van deze bron is niet toegestaan.', 'fail');
    else if (source.rightsStatus === 'Beperkt') add('SOURCE_USE_RESTRICTED', 'rightsStatus', 'De bron heeft gebruiksbeperkingen; controleer het voorgenomen gebruik tegen de vastgelegde voorwaarden.');

    if (!source.approvalStatus || source.approvalStatus === 'Nog te beoordelen') add('SOURCE_APPROVAL_MISSING', 'approvalStatus', 'De bron is nog niet goedgekeurd voor het vastgelegde gebruik.');
    else if (!APPROVAL_STATUSES.includes(source.approvalStatus)) add('SOURCE_APPROVAL_INVALID', 'approvalStatus', 'De goedkeuringsstatus is ongeldig.', 'fail');
    else if (source.approvalStatus === 'Afgewezen') add('SOURCE_APPROVAL_REJECTED', 'approvalStatus', 'De bron is afgewezen voor het vastgelegde gebruik.', 'fail');

    for (const field of ['approvedAt', 'nextReviewAt']) {
      if (source[field] === undefined || source[field] === '') add('SOURCE_DATE_MISSING', field, 'Brondatum ontbreekt: ' + LABELS[field] + '.');
      else if (!date(source[field])) add('SOURCE_DATE_INVALID', field, 'Gebruik een bestaande kalenderdatum in jjjj-mm-dd.', 'fail');
    }
    if (date(source.approvedAt) && date(asOf) && source.approvedAt > asOf) add('SOURCE_APPROVAL_FUTURE', 'approvedAt', 'De goedkeuringsdatum ligt na de controledatum.', 'fail');
    if (date(source.nextReviewAt) && date(asOf) && source.nextReviewAt < asOf) add('SOURCE_REVIEW_OVERDUE', 'nextReviewAt', 'De volgende bronbeoordeling is verlopen.');
    if (date(source.approvedAt) && date(source.nextReviewAt) && source.nextReviewAt < source.approvedAt) add('SOURCE_DATE_ORDER_INVALID', 'nextReviewAt', 'De volgende beoordeling ligt vóór de goedkeuringsdatum.', 'fail');
    return sorted(findings);
  }

  function createApprovalBinding(source, options = {}) {
    if (!contextValid(options)) throw Error('Organisatie, bronbereik en controledatum moeten expliciet vaststaan.');
    const findings = validateDetails(source, options);
    if (source?.approvalStatus !== 'Goedgekeurd' || findings.some(item => item.code !== 'SOURCE_USE_RESTRICTED')) {
      throw Error('Brongoedkeuring kan niet worden vastgelegd: ' + (findings.map(item => item.message).join(' ') || 'Kies eerst de status Goedgekeurd.'));
    }
    const binding = {schema: APPROVAL_SCHEMA, organisationId: options.organisationId, scopeId: options.scopeId, source: projection(source)};
    return JSON.parse(canonical(binding));
  }
  function validate(source, options = {}) {
    const findings = validateDetails(source, options);
    if (source?.approvalStatus === 'Goedgekeurd' || (object(source) && own(source, 'approvalBinding'))) findings.push(...inspectApprovalBinding(source, options).findings);
    return sorted(findings);
  }

  function resolve(records, record, policy = {}) {
    policy = object(policy) ? policy : {};
    const findings = [], byId = new Map(), byAlias = new Map();
    const add = (code, field, message, severity = 'attention', id) => findings.push(finding(code, field, message, severity, id));
    const result = sources => ({status: findings.some(item => item.severity === 'fail') ? 'fail' : findings.length ? 'attention' : 'pass', sources, findings: sorted(findings)});
    if (!Array.isArray(records)) {
      add('SOURCE_REGISTER_INVALID', 'sourceRegister', 'Het bronregister kan niet worden gelezen.', 'fail');
      return result([]);
    }
    for (const entry of records) {
      if (entry?.type !== 'sourceRegister') continue;
      const source = entry.data;
      if (!object(source) || typeof source.id !== 'string' || !SOURCE_ID.test(source.id) || entry.id !== source.id) {
        add('SOURCE_RECORD_INVALID', 'sourceRegister', 'Een bronregistratie heeft geen geldige, overeenkomende ID.', 'fail', entry?.id);
        continue;
      }
      if (!byId.has(source.id)) byId.set(source.id, []);
      byId.get(source.id).push(source);
      if (!Array.isArray(source.referenceKeys)) {
        add('SOURCE_ALIASES_INVALID', 'sourceRegister.referenceKeys', 'Bronverwijzingen moeten een lijst van exacte teksten zijn.', 'fail', source.id);
        continue;
      }
      for (const alias of source.referenceKeys) {
        if (typeof alias !== 'string' || !alias.trim()) {
          add('SOURCE_ALIAS_INVALID', 'sourceRegister.referenceKeys', 'Een bronverwijzing is geen ingevulde tekst.', 'fail', source.id);
          continue;
        }
        if (!byAlias.has(alias)) byAlias.set(alias, []);
        byAlias.get(alias).push(source);
      }
    }
    for (const [id, entries] of byId) if (entries.length > 1) add('SOURCE_ID_DUPLICATE', 'sourceRegister.id', 'Deze bron-ID komt meer dan eenmaal voor: ' + id, 'fail', id);
    for (const [alias, entries] of byAlias) if (entries.length > 1) add('SOURCE_ALIAS_AMBIGUOUS', 'sourceRegister.referenceKeys', 'Deze exacte bronverwijzing is meer dan eenmaal toegewezen: ' + alias, 'fail');

    const data = object(record) && own(record, 'data') && typeof record.type === 'string' ? record.data : record;
    if (!object(data)) {
      add('SOURCE_TARGET_INVALID', 'record', 'De te controleren registratie moet een object zijn.', 'fail');
      return result([]);
    }
    const linked = new Map();
    let references = 0;
    if (own(data, 'sourceIds')) {
      if (!Array.isArray(data.sourceIds)) add('SOURCE_IDS_INVALID', 'sourceIds', 'Bron-ID’s moeten een lijst zijn.', 'fail');
      else for (const id of data.sourceIds) {
        references++;
        if (typeof id !== 'string' || !SOURCE_ID.test(id)) {add('SOURCE_ID_REFERENCE_INVALID', 'sourceIds', 'Een opgegeven bron-ID is ongeldig.', 'fail'); continue;}
        const matches = byId.get(id) || [];
        if (!matches.length) add('SOURCE_ID_UNRESOLVED', 'sourceIds', 'Deze bron-ID ontbreekt in het bronregister: ' + id, 'attention', id);
        else if (matches.length === 1) linked.set(id, matches[0]);
      }
    }
    for (const field of ['sources', 'sourceRefs']) {
      if (!own(data, field) || data[field] === '') continue;
      const values = typeof data[field] === 'string' ? [data[field]] : data[field];
      if (!Array.isArray(values)) {add('SOURCE_REFERENCES_INVALID', field, 'Bronverwijzingen moeten tekst of een lijst van teksten zijn.', 'fail'); continue;}
      for (const value of values) {
        references++;
        if (typeof value !== 'string' || !value.trim()) {add('SOURCE_REFERENCE_INVALID', field, 'Een bronverwijzing is geen ingevulde tekst.', 'fail'); continue;}
        const matches = byAlias.get(value) || [];
        if (!matches.length) add('SOURCE_REFERENCE_UNRESOLVED', field, 'Deze exacte bronverwijzing ontbreekt in het bronregister: ' + value);
        else if (matches.length === 1 && byId.get(matches[0].id)?.length === 1) linked.set(matches[0].id, matches[0]);
      }
    }
    if (!references) add('SOURCE_REFERENCE_MISSING', 'sourceIds', 'Deze registratie verwijst nog niet naar een bron.');
    const sources = [...linked.values()].sort((a, b) => compare(a.id, b.id));
    for (const source of sources) findings.push(...validate(source, policy));
    if (!sources.length && !date(policy.asOf)) add('SOURCE_AS_OF_INVALID', 'asOf', 'De controledatum moet een geldige datum zijn in jjjj-mm-dd.', 'fail');
    return result(sources.map(clone));
  }
  return Object.freeze({SCHEMA, VERSION, APPROVAL_SCHEMA, DOCUMENT_SCHEMA: 'eai-school-ict-v1', RECORD_TYPE: 'sourceRegister',
    FIELDS, RIGHTS_STATUSES, APPROVAL_STATUSES, createApprovalBinding, inspectApprovalBinding, validate, resolve});
});
