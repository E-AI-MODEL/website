import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const engine=require('../tools/ict-scan/assurance/engine.js');
const sources=require('../tools/ict-scan/assurance/source-register.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const result=(input,id)=>engine.evaluate(input).checks.find(c=>c.id===id);
const hasCode=(check,code)=>check.findings.some(f=>f.code===code);
const goodLink=()=>({frameworkId:'FRAMEWORK',article:'4.2',status:'Onderbouwd',evidence:'Bronbewijs / besluit 17',reviewedBy:'Beoordelaar',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'});
function dataset() {
  const input={
    records:[{type:'assets',id:'A-01',data:{id:'A-01',name:'Fictieve toepassing',sources:['Broninventaris / rij 2'],recordMeta:{referenceDate:'2026-11-20'},frameworkLinks:[goodLink()]}}],
    context:{asOf:'2026-11-21',organisationId:'example-org',scopeId:'example-inventory',sourceVersion:'fixture-1'},
    policy:{id:'test-policy',version:'1',reviewMaxAgeDays:365}
  };
  const source={id:'SRC-00001',name:'Synthetische bron',referenceKeys:['Broninventaris / rij 2'],owner:'Bronhouder',version:'1',rightsStatus:'Toegestaan',rightsBasis:'Toestemming vastgelegd',allowedUse:'Interne inventariscontrole',scope:'Testorganisatie',retention:'Tot einde inventarisjaar',approvalStatus:'Goedgekeurd',approvedBy:'Reviewer',approvedAt:'2026-11-20',approvalEvidence:'TEST-BESLUIT-001',nextReviewAt:'2027-11-20'};
  source.approvalBinding=sources.createApprovalBinding(source,input.context);
  input.records.push({type:'sourceRegister',id:source.id,data:source});
  confirmReview(input);
  return input;
}
function confirmReview(input){const record=input.records[0],link=record.data.frameworkLinks[0];link.reviewBinding=engine.createReviewBinding(input,record,link);}
function suite() {
  return {id:'behaviour-fixtures',version:'1',cases:[
    {id:'valid-structure',input:dataset(),expect:[{checkId:'structure',status:'pass'}]},
    {id:'empty-data',input:{...dataset(),records:[]},expect:[{checkId:'structure',status:'not_run',code:'EMPTY_DATASET'}]}
  ]};
}
function complete() {
  const input=dataset();input.baseline=engine.createBaseline(input);input.evaluation=suite();return input;
}
function freeze(value) {
  if (value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}

test('Alle vijf controles zijn uitgevoerd voordat het totaal groen wordt',()=>{
  const output=engine.evaluate(complete());
  assert.equal(output.overall.status,'pass');
  assert.equal(output.overall.color,'green');
  assert.deepEqual(output.checks.map(c=>c.id),['structure','sources','review','drift','evaluation']);
  assert.ok(output.checks.every(c=>c.status==='pass'));
  assert.equal(output.checks[1].coverage.referenceContentsVerified,false);
  assert.equal(output.checks[2].coverage.wholeDatasetLegallyAssessed,false);
  assert.equal(output.checks[3].coverage.performanceDriftMeasured,false);
  assert.match(output.scope,/Geen zelfstandig feitenonderzoek/);
});

test('Leeg of ontbrekend invoerbestand kan nooit een groene stand opleveren',()=>{
  const empty={...dataset(),records:[]};
  const output=engine.evaluate(empty);
  assert.equal(output.overall.status,'not_run');
  assert.ok(output.checks.every(c=>c.status==='not_run'));
  assert.equal(engine.evaluate({...empty,evaluation:suite()}).overall.status,'not_run');
  for (const input of [undefined,null,{},[],{records:null}]) assert.equal(engine.evaluate(input).overall.status,'fail');
  assert.throws(()=>engine.createBaseline(empty),/niet-lege/);
});

test('Controledatum en scope zijn verplicht en gebruiken geen systeemklok',()=>{
  for (const context of [{}, {...dataset().context,asOf:'2026-02-30'}, {...dataset().context,asOf:'2026-11-21T00:00:00Z'}, {...dataset().context,organisationId:''}, {...dataset().context,scopeId:''}]) {
    const output=engine.evaluate({...dataset(),context});
    assert.equal(output.checks[0].status,'fail');
    assert.equal(output.checks[2].status,'not_run');
  }
  const ctx={Date:class extends Date {constructor(...args){if(!args.length)throw Error('System clock forbidden');super(...args);}static now(){throw Error('System clock forbidden');}}};
  vm.createContext(ctx);vm.runInContext(readFileSync('tools/ict-scan/assurance/source-register.js','utf8'),ctx);vm.runInContext(readFileSync('tools/ict-scan/assurance/engine.js','utf8'),ctx);
  assert.equal(ctx.AssuranceEngine.evaluate(dataset()).checks[0].status,'pass');
});

test('Browser en Node gebruiken dezelfde engine en leveren dezelfde uitkomst',()=>{
  const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync('tools/ict-scan/assurance/source-register.js','utf8'),ctx);vm.runInContext(readFileSync('tools/ict-scan/assurance/engine.js','utf8'),ctx);
  assert.equal(typeof ctx.AssuranceEngine.evaluate,'function');
  assert.equal(JSON.stringify(ctx.AssuranceEngine.evaluate(complete())),JSON.stringify(engine.evaluate(complete())));
});

test('Gelijke input geeft dezelfde uitvoer en oorspronkelijke gegevens blijven intact',()=>{
  const input=freeze(complete()),before=JSON.stringify(input);
  const first=engine.evaluate(input),second=engine.evaluate(input);
  assert.deepEqual(first,second);
  assert.equal(JSON.stringify(input),before);
  const baseline=engine.createBaseline(input);baseline.records[0].data.name='Gewijzigd in kopie';
  assert.equal(input.records[0].data.name,'Fictieve toepassing');
});

test('Dubbele IDs, ontbrekende namen en verschillende interne IDs falen',()=>{
  const duplicate=dataset();duplicate.records.push(clone(duplicate.records[0]));
  assert.ok(hasCode(result(duplicate,'structure'),'DUPLICATE_ID'));
  const blank=dataset();blank.records[0].data.name='';
  assert.ok(hasCode(result(blank,'structure'),'REQUIRED_FIELD_MISSING'));
  const mismatch=dataset();mismatch.records[0].data.id='A-02';
  assert.ok(hasCode(result(mismatch,'structure'),'RECORD_ID_MISMATCH'));
  const distinct=dataset();distinct.records.push({...clone(distinct.records[0]),type:'services'});
  assert.equal(result(distinct,'structure').status,'pass');
});

test('Onjuiste lijstvelden en niet-JSON-waarden worden geweigerd',()=>{
  for (const value of ['bron',null,{},[42]]) {
    const input=dataset();input.records[0].data.sources=value;
    assert.equal(result(input,'structure').status,'fail');
  }
  for (const value of [undefined,Infinity,()=>true,new Date('2026-11-21'),Symbol('x')]) {
    const input=dataset();input.records[0].data.extra=value;
    assert.ok(hasCode(result(input,'structure'),'NON_JSON_DATA'));
  }
  const circular=dataset();circular.records[0].data.self=circular.records[0].data;
  assert.ok(hasCode(result(circular,'structure'),'NON_JSON_DATA'));
});

test('Relaties vereisen bestaande doelen en een bewijsverwijzing bij bevestiging',()=>{
  const input=dataset();input.records[0].data.relations=[{targetType:'assets',targetId:'A-02',relationType:'uses',status:'Bevestigd',evidence:''}];
  const missing=result(input,'structure');
  assert.ok(hasCode(missing,'DANGLING_RELATION'));
  assert.ok(hasCode(missing,'CONFIRMED_RELATION_WITHOUT_EVIDENCE'));
  input.records.push({type:'assets',id:'A-02',data:{id:'A-02',name:'Tweede toepassing',sources:['Broninventaris / rij 3']}});
  input.records[0].data.relations[0].evidence='Bevestigd koppeldocument';
  assert.equal(result(input,'structure').status,'pass');
  input.records[0].data.relations.push(clone(input.records[0].data.relations[0]));
  assert.ok(hasCode(result(input,'structure'),'DUPLICATE_RELATION'));
});

test('Bronverwijzing en bronversie ontbreken zichtbaar zonder waarheid te claimen',()=>{
  const input=dataset();delete input.records[0].data.sources;delete input.context.sourceVersion;
  const output=result(input,'sources');
  assert.equal(output.status,'attention');
  assert.ok(hasCode(output,'SOURCE_REFERENCE_MISSING'));
  assert.ok(hasCode(output,'SOURCE_VERSION_MISSING'));
  input.records[0].data.sourceRefs=['Onbekend','?'];
  assert.equal(result(input,'sources').status,'attention');
});

test('Ongeldige en toekomstige brondata falen; schrikkeldag wordt juist behandeld',()=>{
  const input=dataset();input.records[0].data.recordMeta.referenceDate='2026-02-29';
  assert.ok(hasCode(result(input,'sources'),'SOURCE_DATE_INVALID'));
  input.records[0].data.recordMeta.referenceDate='2028-02-29';
  assert.ok(hasCode(result(input,'sources'),'SOURCE_DATE_FUTURE'));
  input.context.asOf='2028-03-01';
  input.records[1].data.nextReviewAt='2029-03-01';
  input.records[1].data.approvalBinding=sources.createApprovalBinding(input.records[1].data,input.context);
  assert.equal(result(input,'sources').status,'pass');
});

test('Een registratie zonder normbeoordeling krijgt geen groene beoordelingsstatus',()=>{
  const input=dataset();delete input.records[0].data.frameworkLinks;
  const output=result(input,'review');
  assert.equal(output.status,'not_run');
  assert.ok(hasCode(output,'NO_ASSESSMENTS'));
  assert.equal(output.coverage.inventoryRecordsWithoutAssessments,1);
  assert.equal(output.coverage.sourceRegisterRecords,1);
});

test('Onderbouwde beoordelingen vereisen bewijs, beoordelaar en beoordelingsdatum',()=>{
  for (const [field,code] of [['evidence','REVIEW_EVIDENCE_REQUIRED'],['reviewedBy','REVIEWER_REQUIRED'],['reviewedAt','REVIEW_DATE_REQUIRED']]) {
    const input=dataset();input.records[0].data.frameworkLinks[0][field]='';
    const output=result(input,'review');
    assert.equal(output.status,'fail');assert.ok(hasCode(output,code));
  }
  const pending=dataset();pending.records[0].data.frameworkLinks[0]={frameworkId:'FRAMEWORK',article:'4.2',status:'Nog te beoordelen'};
  assert.equal(result(pending,'review').status,'attention');
});

test('Verplichte rollen en toegestane kaders komen uit het controlebeleid',()=>{
  const input=dataset();input.policy.roleRequiredFrameworkIds=['FRAMEWORK'];
  assert.ok(hasCode(result(input,'review'),'REVIEW_ROLE_REQUIRED'));
  input.records[0].data.frameworkLinks[0].role='Aanbieder';
  input.policy.allowedRoles=['Aanbieder','Gebruiksverantwoordelijke'];
  confirmReview(input);
  assert.equal(result(input,'review').status,'pass');
  input.policy.knownFrameworkIds=['OTHER'];
  assert.ok(hasCode(result(input,'structure'),'UNKNOWN_FRAMEWORK'));
});

test('Niet van toepassing heeft een onderbouwing, persoon en datum nodig',()=>{
  const input=dataset(),link=input.records[0].data.frameworkLinks[0];link.status='Niet van toepassing';
  confirmReview(input);
  assert.equal(result(input,'review').status,'not_run');
  link.evidence='';
  assert.ok(hasCode(result(input,'review'),'NOT_APPLICABLE_WITHOUT_REASON'));
  link.note='Deze bepaling geldt alleen voor een rol die hier niet voorkomt.';link.reviewedBy='';
  assert.ok(hasCode(result(input,'review'),'NOT_APPLICABLE_UNREVIEWED'));
});

test('Beoordelingsdatums onderscheiden ongeldig, toekomstig, verlopen en vandaag',()=>{
  const input=dataset(),link=input.records[0].data.frameworkLinks[0];
  link.reviewedAt='2026-02-30';assert.ok(hasCode(result(input,'review'),'REVIEW_DATE_INVALID'));
  link.reviewedAt='2026-11-22';assert.ok(hasCode(result(input,'review'),'REVIEW_DATE_FUTURE'));
  link.reviewedAt='2025-11-20';assert.ok(hasCode(result(input,'review'),'REVIEW_STALE'));
  link.reviewedAt='2026-11-20';link.nextReviewAt='2026-11-19';assert.ok(hasCode(result(input,'review'),'REVIEW_DATE_ORDER'));
  link.nextReviewAt='2026-11-20';assert.ok(hasCode(result(input,'review'),'REVIEW_OVERDUE'));
  link.nextReviewAt='2026-11-21';confirmReview(input);assert.equal(result(input,'review').status,'pass');
});

test('Open opvolging en afgeronde acties zonder bewijs blijven zichtbaar',()=>{
  const input=dataset(),link=input.records[0].data.frameworkLinks[0];
  link.followUp='Controleer de contractversie';link.followUpStatus='Open';
  let output=result(input,'review');
  assert.equal(output.status,'attention');assert.ok(hasCode(output,'ACTION_OWNER_MISSING'));assert.ok(hasCode(output,'ACTION_OPEN'));
  link.followUpOwner='Contractbeheer';link.followUpStatus='Afgerond';
  output=result(input,'review');assert.equal(output.status,'fail');assert.ok(hasCode(output,'CLOSED_ACTION_WITHOUT_EVIDENCE'));
  link.completionEvidence='Verslag controle 2026-11-20';confirmReview(input);assert.equal(result(input,'review').status,'pass');
});

test('Drift zonder eerdere stand is niet uitgevoerd, niet geslaagd',()=>{
  const output=engine.evaluate(dataset());
  assert.equal(output.checks[3].status,'not_run');
  assert.ok(hasCode(output.checks[3],'NO_BASELINE'));
  assert.equal(output.overall.status,'attention');
});

test('Een ongewijzigde stand slaagt; aangepaste inhoud, toevoegingen en verwijderingen worden geteld',()=>{
  const input=dataset();input.baseline=engine.createBaseline(input);
  assert.equal(result(input,'drift').status,'pass');
  input.records[0].data.name='Aangepaste fictieve toepassing';
  input.records.push({type:'assets',id:'A-02',data:{id:'A-02',name:'Toegevoegde toepassing',sources:['Bron 2']}});
  let output=result(input,'drift');
  assert.equal(output.status,'attention');assert.equal(output.coverage.added,1);assert.equal(output.coverage.changed,1);
  assert.deepEqual(output.findings.find(f=>f.code==='RECORD_DRIFT').changed[0].fields,['name']);
  input.records.shift();output=result(input,'drift');assert.equal(output.coverage.removed,1);
  assert.equal(output.coverage.performanceDriftMeasured,false);
});

test('Drift ziet verschil tussen ontbrekend veld, null en lege tekst; volgorde van objectvelden telt niet',()=>{
  const input=dataset();input.baseline=engine.createBaseline(input);input.records[0].data.optional=null;
  assert.equal(result(input,'drift').coverage.changed,1);
  input.baseline=engine.createBaseline(input);input.records[0].data.optional='';
  assert.equal(result(input,'drift').coverage.changed,1);
  input.baseline=engine.createBaseline(input);input.records[0].data=Object.fromEntries(Object.entries(input.records[0].data).reverse());
  assert.equal(result(input,'drift').status,'pass');
});

test('Andere organisatie, selectie, regels of beleidsinstellingen maken een baseline ongeschikt',()=>{
  for (const field of ['organisationId','scopeId','policyId','policyVersion']) {
    const input=dataset();input.baseline=engine.createBaseline(input);input.baseline.context[field]='other';
    const output=result(input,'drift');assert.equal(output.status,'fail');assert.ok(hasCode(output,'BASELINE_SCOPE_MISMATCH'));
  }
  const input=dataset();input.baseline=engine.createBaseline(input);input.policy.reviewMaxAgeDays=30;
  assert.ok(hasCode(result(input,'drift'),'BASELINE_POLICY_MISMATCH'));
  input.policy.reviewMaxAgeDays=365;input.baseline.context.asOf='2027-01-01';
  assert.ok(hasCode(result(input,'drift'),'BASELINE_DATE_INVALID'));
  const prior=dataset();prior.baseline=engine.createBaseline(prior);prior.baseline.context.rulesetVersion='1.0.0';
  assert.equal(result(prior,'drift').status,'attention');assert.ok(hasCode(result(prior,'drift'),'BASELINE_RULESET_MISMATCH'));
});

test('Bronwijzigingen worden ook gemeld wanneer de genormaliseerde registratie gelijk bleef',()=>{
  const input=dataset();input.context.sourceFingerprint='a'.repeat(64);input.baseline=engine.createBaseline(input);
  input.context.sourceVersion='fixture-2';input.context.sourceFingerprint='b'.repeat(64);
  const output=result(input,'drift');assert.equal(output.status,'attention');
  assert.ok(hasCode(output,'SOURCE_VERSION_CHANGED'));assert.ok(hasCode(output,'SOURCE_FINGERPRINT_CHANGED'));
  assert.equal(output.coverage.changed,0);
});

test('Evaluatie voert de vastgelegde cases uit en faalt op een verkeerde verwachting',()=>{
  const input=dataset();input.evaluation=suite();
  let output=result(input,'evaluation');assert.equal(output.status,'pass');assert.equal(output.coverage.executedCases,2);
  input.evaluation.cases[1].expect[0].status='pass';
  output=result(input,'evaluation');assert.equal(output.status,'fail');assert.equal(output.coverage.failedCases,1);assert.ok(hasCode(output,'EVALUATION_MISMATCH'));
  assert.equal(engine.evaluate(input).overall.status,'fail');
});

test('Ontbrekende, lege, dubbele en geneste testgevallen kunnen niet groen worden',()=>{
  const input=dataset();assert.equal(result(input,'evaluation').status,'not_run');
  for (const evaluation of [{id:'x',version:'1',cases:[]},{passed:true},{id:'x',version:'1',cases:[suite().cases[0],suite().cases[0]]}]) {
    assert.equal(result({...input,evaluation},'evaluation').status,'fail');
  }
  input.evaluation=suite();input.evaluation.cases[0].input.evaluation=suite();
  assert.ok(hasCode(result(input,'evaluation'),'INVALID_EVALUATION_CASE'));
});

test('Een grote hoeveelheid geslaagde checks maskeert geen fout',()=>{
  const input=complete();input.records[0].data.frameworkLinks[0].evidence='';
  const output=engine.evaluate(input);assert.equal(output.overall.status,'fail');assert.equal(output.overall.color,'red');
  assert.ok(output.overall.passed>=2);
});

test('Onbekende beleidsvelden en ongeldige termijnen vallen niet stilzwijgend terug op een default',()=>{
  for (const policy of [{reviewMaxAgeDays:-1},{reviewMaxAgeDays:0.1},{reviewMaxAgeDays:'365'},{reviewMaxAgeDay:365},{sourceFields:[]},{supportedReviewStatus:'Unlisted'}]) {
    const output=result({...dataset(),policy},'structure');assert.equal(output.status,'fail');assert.ok(hasCode(output,'INVALID_POLICY'));
  }
});

test('Canonieke JSON bewaart waarden en is onafhankelijk van sleutelvolgorde',()=>{
  assert.equal(engine.canonicalize({z:0,a:{d:false,b:null}}),'{'+'"a":{"b":null,"d":false},"z":0}');
  assert.notEqual(engine.canonicalize({a:0}),engine.canonicalize({a:'0'}));
  assert.throws(()=>engine.canonicalize([,1]),/ontbrekende waarde/);
});

test('Het gepubliceerde synthetische evaluatiecorpus voert 31 vaste cases uit',()=>{
  const corpus=JSON.parse(readFileSync('tools/ict-scan/assurance/evaluation-corpus.json','utf8'));
  assert.equal(corpus.synthetic,true);
  assert.equal(corpus.version,'1.1.0');
  assert.equal(corpus.cases.length,31);
  const output=result({...dataset(),evaluation:corpus},'evaluation');
  assert.equal(output.status,'pass');
  assert.equal(output.coverage.executedCases,31);
  assert.equal(output.coverage.passedCases,31);
  assert.equal(output.coverage.assertions,35);
  assert.equal(output.coverage.failedCases,0);
});
