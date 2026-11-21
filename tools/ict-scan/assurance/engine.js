'use strict';
/* Deterministic checks on supplied records. No network, model or system clock.
   A successful check says nothing about legal conformity or real-world truth. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AssuranceEngine = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  const VERSION = '1.0.0';
  const RESULT_SCHEMA = 'assurance-result-v1';
  const BASELINE_SCHEMA = 'assurance-baseline-v1';
  const CHECK_IDS = ['structure', 'sources', 'review', 'drift', 'evaluation'];
  const COLORS = {pass:'green', attention:'orange', fail:'red', not_run:'grey'};
  const TITLES = {structure:'Structuur en verwijzingen', sources:'Bronverwijzingen', review:'Vastgelegde beoordelingen', drift:'Verschil met eerdere stand', evaluation:'Vaste testgevallen'};
  const DEFAULT_POLICY = Object.freeze({
    id:'assurance-default', version:'1', reviewMaxAgeDays:365,
    requiredFields:Object.freeze(['name']), sourceFields:Object.freeze(['sources','sourceRefs']),
    reviewStatuses:Object.freeze(['Nog te beoordelen','In onderzoek','Onderbouwd','Niet van toepassing']),
    supportedReviewStatus:'Onderbouwd', notApplicableReviewStatus:'Niet van toepassing',
    relationStatuses:Object.freeze(['Vermoedelijk','Geregistreerd','Bevestigd','Historisch']),
    confirmedRelationStatus:'Bevestigd',
    followUpStatuses:Object.freeze(['Open','In uitvoering','Afgerond','Niet van toepassing']),
    completedFollowUpStatus:'Afgerond', notApplicableFollowUpStatus:'Niet van toepassing',
    knownFrameworkIds:Object.freeze([]), knownRelationTypes:Object.freeze([]),
    roleRequiredFrameworkIds:Object.freeze([]), allowedRoles:Object.freeze([]),
    unknownValues:Object.freeze(['?','onbekend','unknown','n.t.b.','nog te beoordelen','niet vastgesteld'])
  });
  const hasOwn = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const pointer = value => String(value).replace(/~/g,'~0').replace(/\//g,'~1');
  const key = record => JSON.stringify([record.type,record.id]);
  const copy = value => JSON.parse(JSON.stringify(value));
  const finding = (code,path,message,extra={}) => ({code,path,message,...extra});
  function check(id,status,findings=[],coverage={}) {
    return {id,title:TITLES[id],status,color:COLORS[status],findings,coverage};
  }
  function skipped(id,code,message) {
    return check(id,'not_run',[finding(code,'',message)]);
  }
  function dateDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const stamp=Date.parse(value+'T00:00:00.000Z');
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,10)!==value) return null;
    return stamp / 86400000;
  }
  function canonicalize(value) {
    const seen=new Set();
    function visit(item,depth) {
      if (depth>64) throw Error('Gegevens zijn te diep genest.');
      if (item===null || typeof item==='boolean' || typeof item==='string') return JSON.stringify(item);
      if (typeof item==='number' && Number.isFinite(item)) return JSON.stringify(item);
      if ((!object(item) && !Array.isArray(item)) || (object(item) && Object.prototype.toString.call(item)!=='[object Object]')) throw Error('Alleen JSON-waarden zijn toegestaan.');
      if (seen.has(item)) throw Error('Een circulaire verwijzing is niet toegestaan.');
      seen.add(item);
      let result;
      if (Array.isArray(item)) {
        const parts=[];
        for (let i=0;i<item.length;i++) {
          if (!hasOwn(item,i)) throw Error('Een lijst bevat een ontbrekende waarde.');
          parts.push(visit(item[i],depth+1));
        }
        result='['+parts.join(',')+']';
      } else {
        result='{'+Object.keys(item).sort().map(k=>JSON.stringify(k)+':'+visit(item[k],depth+1)).join(',')+'}';
      }
      seen.delete(item);
      return result;
    }
    return visit(value,0);
  }
  function policyFor(input) {
    if (input!==undefined && !object(input)) throw Error('Het controlebeleid moet een object zijn.');
    const policy={...DEFAULT_POLICY,...(input||{})};
    for (const key of Object.keys(input||{})) if (!hasOwn(DEFAULT_POLICY,key)) throw Error('Onbekend beleidsveld: '+key);
    for (const name of ['id','version','supportedReviewStatus','notApplicableReviewStatus','confirmedRelationStatus','completedFollowUpStatus','notApplicableFollowUpStatus']) {
      if (!text(policy[name])) throw Error('Ongeldige beleidswaarde: '+name);
    }
    if (!Number.isInteger(policy.reviewMaxAgeDays) || policy.reviewMaxAgeDays<0 || policy.reviewMaxAgeDays>36525) throw Error('reviewMaxAgeDays moet een geheel aantal dagen van 0 tot 36525 zijn.');
    for (const name of ['requiredFields','sourceFields','reviewStatuses','relationStatuses','followUpStatuses','knownFrameworkIds','knownRelationTypes','roleRequiredFrameworkIds','allowedRoles','unknownValues']) {
      if (!Array.isArray(policy[name]) || policy[name].some(v=>!text(v)) || new Set(policy[name]).size!==policy[name].length) throw Error('Ongeldige beleidslijst: '+name);
    }
    if (!policy.requiredFields.length || !policy.sourceFields.length) throw Error('Het beleid moet verplichte velden en bronvelden benoemen.');
    for (const [name,list] of [['supportedReviewStatus','reviewStatuses'],['notApplicableReviewStatus','reviewStatuses'],['confirmedRelationStatus','relationStatuses'],['completedFollowUpStatus','followUpStatuses'],['notApplicableFollowUpStatus','followUpStatuses']]) {
      if (!policy[list].includes(policy[name])) throw Error(name+' ontbreekt in '+list+'.');
    }
    if (policy.supportedReviewStatus===policy.notApplicableReviewStatus || policy.completedFollowUpStatus===policy.notApplicableFollowUpStatus) throw Error('Afgerond en niet van toepassing moeten verschillende statussen zijn.');
    return policy;
  }
  function known(value,policy) {
    return text(value) && !policy.unknownValues.some(v=>v.trim().toLowerCase()===value.trim().toLowerCase());
  }
  function inspectStructure(input,policy,policyError) {
    const findings=[];
    if (policyError) findings.push(finding('INVALID_POLICY','/policy',policyError));
    if (!object(input)) return check('structure','fail',[finding('INVALID_INPUT','','De invoer moet een object zijn.')]);
    if (!object(input.context)) findings.push(finding('CONTEXT_REQUIRED','/context','De context van deze controle ontbreekt.'));
    else {
      if (dateDay(input.context.asOf)===null) findings.push(finding('INVALID_AS_OF','/context/asOf','Geef de controledatum expliciet op als geldige datum jjjj-mm-dd.'));
      for (const field of ['organisationId','scopeId']) if (!text(input.context[field])) findings.push(finding('CONTEXT_FIELD_REQUIRED','/context/'+field,'Organisatie en gegevensbereik moeten expliciet zijn vastgelegd.'));
      if (hasOwn(input.context,'sourceVersion') && typeof input.context.sourceVersion!=='string') findings.push(finding('INVALID_SOURCE_VERSION','/context/sourceVersion','De bronversie moet een tekst zijn.'));
      if (hasOwn(input.context,'sourceFingerprint') && !/^(sha256:)?[a-f0-9]{64}$/i.test(input.context.sourceFingerprint||'')) findings.push(finding('INVALID_SOURCE_FINGERPRINT','/context/sourceFingerprint','De bronvingerafdruk moet een SHA-256 zijn.'));
    }
    if (!Array.isArray(input.records)) return check('structure','fail',findings.concat(finding('RECORDS_REQUIRED','/records','De invoer moet een lijst registraties bevatten.')));
    if (!input.records.length) findings.push(finding('EMPTY_DATASET','/records','Er zijn geen registraties om te controleren.'));
    const ids=new Set();
    input.records.forEach((r,i)=>{
      const path='/records/'+i;
      if (!object(r) || !text(r.type) || !text(r.id) || !object(r.data)) {
        findings.push(finding('INVALID_RECORD',path,'Elke registratie vereist type, id en een gegevensobject.')); return;
      }
      if (ids.has(key(r))) findings.push(finding('DUPLICATE_ID',path+'/id','Een ID komt meer dan één keer voor in hetzelfde register.',{recordType:r.type,recordId:r.id}));
      ids.add(key(r));
      if (hasOwn(r.data,'id') && r.data.id!==r.id) findings.push(finding('RECORD_ID_MISMATCH',path+'/data/id','Het ID in de gegevens verschilt van het registratie-ID.'));
      try {canonicalize(r.data);} catch (error) {findings.push(finding('NON_JSON_DATA',path+'/data',error.message)); return;}
      for (const field of policy.requiredFields) if (!known(r.data[field],policy)) findings.push(finding('REQUIRED_FIELD_MISSING',path+'/data/'+pointer(field),'Een verplicht veld ontbreekt of is niet vastgesteld.',{field,recordType:r.type,recordId:r.id}));
      for (const field of ['relations','frameworkLinks',...policy.sourceFields]) {
        if (!hasOwn(r.data,field)) continue;
        const value=r.data[field];
        if (!Array.isArray(value)) findings.push(finding('INVALID_LIST',path+'/data/'+pointer(field),'Dit veld moet een lijst zijn.'));
        else if (policy.sourceFields.includes(field) && value.some(v=>typeof v!=='string')) findings.push(finding('INVALID_SOURCE_REFERENCE',path+'/data/'+pointer(field),'Bronverwijzingen moeten teksten zijn.'));
      }
      if (hasOwn(r.data,'recordMeta') && !object(r.data.recordMeta)) findings.push(finding('INVALID_RECORD_METADATA',path+'/data/recordMeta','De bronmetadata moet een object zijn.'));
    });
    input.records.forEach((r,i)=>{
      if (!object(r) || !object(r.data)) return;
      if (Array.isArray(r.data.relations)) {
        const seen=new Set();
        r.data.relations.forEach((rel,j)=>{
          const path='/records/'+i+'/data/relations/'+j;
          if (!object(rel) || !text(rel.targetType) || !text(rel.targetId) || !text(rel.relationType)) {findings.push(finding('INVALID_RELATION',path,'Een verband mist het doelregister, doel-ID of relatietype.'));return;}
          if (!ids.has(JSON.stringify([rel.targetType,rel.targetId]))) findings.push(finding('DANGLING_RELATION',path,'Het verband verwijst naar een ontbrekende registratie.'));
          if (rel.targetType===r.type && rel.targetId===r.id) findings.push(finding('SELF_RELATION',path,'Een registratie verwijst naar zichzelf.'));
          const relKey=JSON.stringify([rel.targetType,rel.targetId,rel.relationType]);
          if (seen.has(relKey)) findings.push(finding('DUPLICATE_RELATION',path,'Dit verband is meer dan één keer vastgelegd.'));
          seen.add(relKey);
          if (!policy.relationStatuses.includes(rel.status)) findings.push(finding('INVALID_RELATION_STATUS',path+'/status','De status van dit verband is onbekend.'));
          if (policy.knownRelationTypes.length && !policy.knownRelationTypes.includes(rel.relationType)) findings.push(finding('UNKNOWN_RELATION_TYPE',path+'/relationType','Dit relatietype staat niet in het controlebeleid.'));
          if (rel.status===policy.confirmedRelationStatus && !known(rel.evidence,policy)) findings.push(finding('CONFIRMED_RELATION_WITHOUT_EVIDENCE',path+'/evidence','Een bevestigd verband mist een bewijsverwijzing.'));
        });
      }
      if (Array.isArray(r.data.frameworkLinks)) r.data.frameworkLinks.forEach((link,j)=>{
        const path='/records/'+i+'/data/frameworkLinks/'+j;
        if (!object(link) || !text(link.frameworkId) || !text(link.article)) {findings.push(finding('INVALID_FRAMEWORK_LINK',path,'Een beoordeling vereist een kader en een concrete bepaling.'));return;}
        if (policy.knownFrameworkIds.length && !policy.knownFrameworkIds.includes(link.frameworkId)) findings.push(finding('UNKNOWN_FRAMEWORK',path+'/frameworkId','Dit kader staat niet in het controlebeleid.'));
        for (const field of ['status','evidence','note','role','reviewedBy','reviewedAt','nextReviewAt','followUp','followUpOwner','followUpStatus','completionEvidence']) {
          if (hasOwn(link,field) && typeof link[field]!=='string') findings.push(finding('INVALID_REVIEW_FIELD',path+'/'+field,'Een beoordelingsveld moet tekst bevatten.'));
        }
      });
    });
    const emptyOnly=findings.length===1 && findings[0].code==='EMPTY_DATASET';
    return check('structure',emptyOnly?'not_run':findings.length?'fail':'pass',findings,{records:input.records.length,uniqueRecords:ids.size});
  }
  function inspectSources(input,policy) {
    const findings=[];let referenced=0,dated=0;
    if (!known(input.context.sourceVersion,policy)) findings.push(finding('SOURCE_VERSION_MISSING','/context/sourceVersion','De gebruikte bronversie is niet vastgelegd.'));
    for (const [i,r] of input.records.entries()) {
      const path='/records/'+i+'/data';
      const refs=policy.sourceFields.flatMap(field=>r.data[field]||[]).filter(v=>known(v,policy));
      if (refs.length) referenced++;
      else findings.push(finding('SOURCE_REFERENCE_MISSING',path,'De registratie mist een bronverwijzing.',{recordType:r.type,recordId:r.id}));
      const value=r.data.recordMeta?.referenceDate;
      if (value!==undefined && value!=='') {
        const day=dateDay(value);
        if (day===null) findings.push(finding('SOURCE_DATE_INVALID',path+'/recordMeta/referenceDate','De bronpeildatum is geen geldige datum.'));
        else if (day>dateDay(input.context.asOf)) findings.push(finding('SOURCE_DATE_FUTURE',path+'/recordMeta/referenceDate','De bronpeildatum ligt na de controledatum.'));
        else dated++;
      }
    }
    const fail=findings.some(f=>['SOURCE_DATE_INVALID','SOURCE_DATE_FUTURE'].includes(f.code));
    return check('sources',fail?'fail':findings.length?'attention':'pass',findings,{records:input.records.length,recordsWithReferences:referenced,recordsWithReferenceDate:dated,referenceContentsVerified:false});
  }
  function inspectReviews(input,policy) {
    const findings=[];let links=0,assessed=0,notApplicable=0,withLinks=0,fail=false;
    const add=(code,path,message,severity='attention')=>{findings.push(finding(code,path,message));if(severity==='fail')fail=true;};
    const asOf=dateDay(input.context.asOf);
    input.records.forEach((r,i)=>{
      const rows=r.data.frameworkLinks||[];if(rows.length)withLinks++;
      rows.forEach((link,j)=>{
        links++;const path='/records/'+i+'/data/frameworkLinks/'+j;
        if (!text(link.status)) add('REVIEW_STATUS_MISSING',path+'/status','De beoordeling heeft nog geen status.');
        else if (!policy.reviewStatuses.includes(link.status)) add('REVIEW_STATUS_INVALID',path+'/status','De beoordelingsstatus is onbekend.','fail');
        else if (link.status===policy.supportedReviewStatus) {
          assessed++;
          if (!known(link.evidence,policy)) add('REVIEW_EVIDENCE_REQUIRED',path+'/evidence','Een onderbouwde beoordeling mist een bewijsverwijzing.','fail');
          if (!known(link.reviewedBy,policy)) add('REVIEWER_REQUIRED',path+'/reviewedBy','Een onderbouwde beoordeling mist de beoordelaar.','fail');
          if (!text(link.reviewedAt)) add('REVIEW_DATE_REQUIRED',path+'/reviewedAt','Een onderbouwde beoordeling mist de beoordelingsdatum.','fail');
          if (policy.roleRequiredFrameworkIds.includes(link.frameworkId) && (!known(link.role,policy) || link.role===policy.notApplicableReviewStatus)) add('REVIEW_ROLE_REQUIRED',path+'/role','De toepasselijke rol is niet vastgelegd.','fail');
        } else if (link.status===policy.notApplicableReviewStatus) {
          notApplicable++;
          if (!known(link.evidence,policy) && !known(link.note,policy)) add('NOT_APPLICABLE_WITHOUT_REASON',path,'Licht toe waarom de bepaling niet van toepassing is.');
          if (!known(link.reviewedBy,policy) || !text(link.reviewedAt)) add('NOT_APPLICABLE_UNREVIEWED',path,'Leg beoordelaar en datum van de toepasselijkheidsbeslissing vast.');
        } else add('REVIEW_PENDING',path+'/status','Deze beoordeling is nog niet afgerond.');
        if (text(link.role) && policy.allowedRoles.length && !policy.allowedRoles.includes(link.role)) add('REVIEW_ROLE_INVALID',path+'/role','De rol staat niet in het controlebeleid.','fail');
        const dates={};
        for (const field of ['reviewedAt','nextReviewAt']) {
          if (!text(link[field])) continue;
          dates[field]=dateDay(link[field]);
          if (dates[field]===null) add('REVIEW_DATE_INVALID',path+'/'+field,'De datum is ongeldig.','fail');
        }
        if (dates.reviewedAt!==undefined && dates.reviewedAt!==null) {
          if (dates.reviewedAt>asOf) add('REVIEW_DATE_FUTURE',path+'/reviewedAt','De beoordeling is gedateerd na de controledatum.','fail');
          else if (asOf-dates.reviewedAt>policy.reviewMaxAgeDays) add('REVIEW_STALE',path+'/reviewedAt','De beoordeling is ouder dan de vastgelegde controletermijn.');
        }
        if (dates.nextReviewAt!==undefined && dates.nextReviewAt!==null) {
          if (dates.reviewedAt!==undefined && dates.reviewedAt!==null && dates.nextReviewAt<dates.reviewedAt) add('REVIEW_DATE_ORDER',path+'/nextReviewAt','De vervolgdatum ligt vóór de beoordelingsdatum.','fail');
          else if (dates.nextReviewAt<asOf) add('REVIEW_OVERDUE',path+'/nextReviewAt','De geplande herbeoordeling is verlopen.');
        }
        if (text(link.followUpStatus) && !policy.followUpStatuses.includes(link.followUpStatus)) add('ACTION_STATUS_INVALID',path+'/followUpStatus','De opvolgingsstatus is onbekend.','fail');
        if (known(link.followUp,policy)) {
          if (!known(link.followUpOwner,policy)) add('ACTION_OWNER_MISSING',path+'/followUpOwner','Voor de vervolgactie is geen verantwoordelijke vastgelegd.');
          if (!text(link.followUpStatus)) add('ACTION_STATUS_MISSING',path+'/followUpStatus','Voor de vervolgactie is geen status vastgelegd.');
        } else if (text(link.followUpStatus) && link.followUpStatus!==policy.notApplicableFollowUpStatus) add('ACTION_DESCRIPTION_MISSING',path+'/followUp','De opvolgingsstatus heeft geen beschreven actie.');
        if (link.followUpStatus===policy.completedFollowUpStatus && !known(link.completionEvidence,policy)) add('CLOSED_ACTION_WITHOUT_EVIDENCE',path+'/completionEvidence','Een afgeronde vervolgactie mist bewijs van afronding.','fail');
        if (text(link.followUpStatus) && policy.followUpStatuses.includes(link.followUpStatus) && ![policy.completedFollowUpStatus,policy.notApplicableFollowUpStatus].includes(link.followUpStatus)) add('ACTION_OPEN',path+'/followUpStatus','Een vervolgactie staat nog open.');
      });
    });
    const coverage={records:input.records.length,recordsWithAssessments:withLinks,recordsWithoutAssessments:input.records.length-withLinks,assessments:links,supportedAssessments:assessed,notApplicableAssessments:notApplicable,assessmentMetadataOnly:true,wholeDatasetLegallyAssessed:false};
    if (!links) return check('review','not_run',[finding('NO_ASSESSMENTS','/records','Er zijn geen normbeoordelingen vastgelegd. Er is geen inhoudelijk nalevingsoordeel uitgevoerd.')],coverage);
    if (fail) return check('review','fail',findings,coverage);
    if (findings.length) return check('review','attention',findings,coverage);
    if (links===notApplicable) return check('review','not_run',[finding('ALL_ASSESSMENTS_NOT_APPLICABLE','/records','Alle vastgelegde beoordelingen zijn gemotiveerd niet van toepassing.')],coverage);
    return check('review','pass',[],coverage);
  }
  function inspectDrift(input,policy) {
    const baseline=input.baseline;
    if (baseline===undefined || baseline===null) return skipped('drift','NO_BASELINE','Er is geen eerdere stand om mee te vergelijken.');
    if (!object(baseline) || baseline.schema!==BASELINE_SCHEMA || !object(baseline.context)) return check('drift','fail',[finding('INVALID_BASELINE','/baseline','De eerdere stand heeft geen geldige structuur of versie.')]);
    const mismatches=[];
    for (const field of ['organisationId','scopeId']) if (baseline.context[field]!==input.context[field]) mismatches.push(field);
    if (baseline.context.policyId!==policy.id) mismatches.push('policyId');
    if (baseline.context.policyVersion!==policy.version) mismatches.push('policyVersion');
    if (baseline.context.rulesetVersion!==VERSION) mismatches.push('rulesetVersion');
    if (mismatches.length) return check('drift','fail',[finding('BASELINE_SCOPE_MISMATCH','/baseline/context','De eerdere stand hoort bij een andere organisatie, gegevensselectie of controleversie.',{fields:mismatches})]);
    try {
      if (!object(baseline.controlPolicy) || canonicalize(baseline.controlPolicy)!==canonicalize(policy)) return check('drift','fail',[finding('BASELINE_POLICY_MISMATCH','/baseline/controlPolicy','Het controlebeleid verschilt van het beleid bij de eerdere stand.')]);
    } catch (_) {return check('drift','fail',[finding('BASELINE_POLICY_MISMATCH','/baseline/controlPolicy','Het controlebeleid bij de eerdere stand is ongeldig.')]);}
    if (dateDay(baseline.context.asOf)===null || dateDay(baseline.context.asOf)>dateDay(input.context.asOf)) return check('drift','fail',[finding('BASELINE_DATE_INVALID','/baseline/context/asOf','De eerdere stand heeft geen geldige eerdere controledatum.')]);
    const validation=inspectStructure({records:baseline.records,context:baseline.context},policy);
    if (validation.status!=='pass') return check('drift','fail',[finding('BASELINE_RECORDS_INVALID','/baseline/records','De eerdere stand bevat ongeldige of ontbrekende registraties.',{causes:validation.findings.map(f=>f.code)})]);
    const previous=new Map(baseline.records.map(r=>[key(r),r]));
    const current=new Map(input.records.map(r=>[key(r),r]));
    const added=[],removed=[],changed=[];
    for (const [k,r] of current) {
      if (!previous.has(k)) added.push({type:r.type,id:r.id});
      else {
        const before=previous.get(k).data;
        const fields=[...new Set([...Object.keys(before),...Object.keys(r.data)])].sort().filter(field=>{
          if (hasOwn(before,field)!==hasOwn(r.data,field)) return true;
          return canonicalize(before[field])!==canonicalize(r.data[field]);
        });
        if (fields.length) changed.push({type:r.type,id:r.id,fields});
      }
    }
    for (const [k,r] of previous) if (!current.has(k)) removed.push({type:r.type,id:r.id});
    const sort=(a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0;
    added.sort(sort);removed.sort(sort);changed.sort(sort);
    const findings=[];
    if (added.length || removed.length || changed.length) findings.push(finding('RECORD_DRIFT','/records','De registraties verschillen van de bewaarde stand. Beoordeel of de wijziging bedoeld is.',{added,removed,changed}));
    if ((baseline.context.sourceFingerprint||'')!==(input.context.sourceFingerprint||'')) findings.push(finding('SOURCE_FINGERPRINT_CHANGED','/context/sourceFingerprint','De bronvingerafdruk is veranderd of ontbreekt aan één kant van de vergelijking.'));
    if ((baseline.context.sourceVersion||'')!==(input.context.sourceVersion||'')) findings.push(finding('SOURCE_VERSION_CHANGED','/context/sourceVersion','De opgegeven bronversie is veranderd.'));
    return check('drift',findings.length?'attention':'pass',findings,{previousRecords:previous.size,currentRecords:current.size,added:added.length,removed:removed.length,changed:changed.length,baselineAsOf:baseline.context.asOf,comparison:'record-content-and-source-identity',performanceDriftMeasured:false});
  }
  function core(input) {
    let policy,error;
    try {policy=policyFor(object(input)?input.policy:undefined);} catch(e) {policy={...DEFAULT_POLICY};error=e.message;}
    const structure=inspectStructure(input,policy,error);
    const checks=[structure];
    if (structure.status!=='pass') {
      for (const id of ['sources','review','drift']) checks.push(skipped(id,'STRUCTURE_BLOCKED','Deze controle is niet uitgevoerd omdat de invoer ongeldig of leeg is.'));
    } else checks.push(inspectSources(input,policy),inspectReviews(input,policy),inspectDrift(input,policy));
    return {policy,checks};
  }
  function inspectEvaluation(suite) {
    if (suite===undefined || suite===null) return skipped('evaluation','NO_EVALUATION','Er is geen vaste verzameling testgevallen uitgevoerd.');
    if (!object(suite) || !text(suite.id) || !text(suite.version) || !Array.isArray(suite.cases) || !suite.cases.length || suite.cases.length>200) return check('evaluation','fail',[finding('INVALID_EVALUATION','/evaluation','Een evaluatie vereist een ID, versie en 1 tot 200 vaste testgevallen.')]);
    const findings=[],caseResults=[],ids=new Set();let assertions=0;
    for (let i=0;i<suite.cases.length;i++) {
      const item=suite.cases[i],path='/evaluation/cases/'+i;
      if (!object(item) || !text(item.id) || ids.has(item.id) || !object(item.input) || hasOwn(item.input,'evaluation') || !Array.isArray(item.expect) || !item.expect.length) {
        findings.push(finding('INVALID_EVALUATION_CASE',path,'Een testgeval is onvolledig, dubbel of bevat een geneste evaluatie.'));continue;
      }
      ids.add(item.id);
      if (item.expect.some(e=>!object(e) || !CHECK_IDS.slice(0,4).includes(e.checkId) || !hasOwn(COLORS,e.status) || (hasOwn(e,'code')&&!text(e.code)))) {
        findings.push(finding('INVALID_EXPECTATION',path+'/expect','Een verwachte uitkomst bevat een onbekende controle, status of meldcode.'));continue;
      }
      const actual=core(item.input).checks;
      const results=item.expect.map(e=>{
        const result=actual.find(c=>c.id===e.checkId);
        const matched=result.status===e.status && (!e.code || result.findings.some(f=>f.code===e.code));
        assertions++;
        return {checkId:e.checkId,expected:e.status,actual:result.status,...(e.code?{code:e.code,actualCodes:result.findings.map(f=>f.code)}:{}),matched};
      });
      const passed=results.every(e=>e.matched);
      caseResults.push({id:item.id,status:passed?'pass':'fail',assertions:results});
      if (!passed) findings.push(finding('EVALUATION_MISMATCH',path,'De uitgevoerde controle wijkt af van de vastgelegde verwachte uitkomst.',{caseId:item.id}));
    }
    return {...check('evaluation',findings.length?'fail':'pass',findings,{suiteId:suite.id,suiteVersion:suite.version,cases:suite.cases.length,executedCases:caseResults.length,assertions,passedCases:caseResults.filter(c=>c.status==='pass').length,failedCases:caseResults.filter(c=>c.status==='fail').length,kind:'deterministic-check-behaviour'}),caseResults};
  }
  function aggregate(checks) {
    const status=checks.some(c=>c.status==='fail')?'fail':checks[0].status==='not_run'?'not_run':checks.some(c=>c.status==='attention')?'attention':checks.every(c=>c.status==='pass')?'pass':checks.every(c=>c.status==='not_run')?'not_run':'attention';
    const messages={fail:'Een of meer controles zijn afgekeurd.',attention:'Er zijn aandachtspunten of nog niet uitgevoerde controles.',pass:'Alle benoemde controles zijn uitgevoerd en geslaagd.',not_run:'De controles zijn niet uitgevoerd.'};
    return {status,color:COLORS[status],message:messages[status],passed:checks.filter(c=>c.status==='pass').length,attention:checks.filter(c=>c.status==='attention').length,failed:checks.filter(c=>c.status==='fail').length,notRun:checks.filter(c=>c.status==='not_run').length};
  }
  function evaluate(input) {
    const {policy,checks}=core(input);
    checks.push(inspectEvaluation(object(input)?input.evaluation:undefined));
    const context=object(input?.context)?input.context:{};
    return {
      schema:RESULT_SCHEMA,rulesetVersion:VERSION,
      context:{asOf:typeof context.asOf==='string'?context.asOf:null,organisationId:typeof context.organisationId==='string'?context.organisationId:null,scopeId:typeof context.scopeId==='string'?context.scopeId:null,sourceVersion:typeof context.sourceVersion==='string'?context.sourceVersion:null,...(typeof context.sourceFingerprint==='string'?{sourceFingerprint:context.sourceFingerprint}:{}),policyId:policy.id,policyVersion:policy.version},
      scope:'Technische controles op aangeleverde registraties, vastgelegde beoordelingsmetadata en vaste testgevallen. Geen zelfstandig feitenonderzoek, juridisch nalevingsoordeel of meting van modelprestaties.',
      overall:aggregate(checks),checks
    };
  }
  function createBaseline(input) {
    const {policy,checks}=core(input);
    if (checks[0].status!=='pass') throw Error('Een eerdere stand kan alleen worden gemaakt van geldige, niet-lege registraties.');
    return {schema:BASELINE_SCHEMA,context:{asOf:input.context.asOf,organisationId:input.context.organisationId,scopeId:input.context.scopeId,sourceVersion:input.context.sourceVersion||'',...(input.context.sourceFingerprint?{sourceFingerprint:input.context.sourceFingerprint}:{}),policyId:policy.id,policyVersion:policy.version,rulesetVersion:VERSION},controlPolicy:copy(policy),records:copy(input.records)};
  }
  return Object.freeze({VERSION,RESULT_SCHEMA,BASELINE_SCHEMA,CHECK_IDS:Object.freeze(CHECK_IDS),DEFAULT_POLICY,evaluate,createBaseline,canonicalize});
});
