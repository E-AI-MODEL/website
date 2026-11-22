import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const engine=require('../tools/ict-scan/assurance/engine.js');
const sources=require('../tools/ict-scan/assurance/source-register.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const record=input=>input.records[0];
const link=input=>record(input).data.frameworkLinks[0];
const source=input=>input.records.find(r=>r.type==='sourceRegister').data;
const inspect=input=>engine.inspectReviewBinding(input,record(input),link(input));
const check=(input,id)=>engine.evaluate(input).checks.find(c=>c.id===id);
function confirm(input){link(input).reviewBinding=engine.createReviewBinding(input,record(input),link(input));return input;}
function fixture(){
  const input={
    context:{asOf:'2026-11-21',organisationId:'synthetic-organisation',scopeId:'synthetic-scope',sourceVersion:'fixture-1'},
    policy:{id:'test-policy',version:'1',reviewMaxAgeDays:365},
    reviewRules:{catalog:{version:'1',references:[{id:'TEST',title:'Synthetisch kader',articles:['4.2']}]},registerFiles:{assets:'assets.json',sourceRegister:'sources.json'}},
    records:[{type:'assets',id:'ASSET-1',data:{id:'ASSET-1',name:'Synthetische toepassing',sourceIds:['SRC-00001'],sources:['Bron / rij 1'],recordMeta:{referenceDate:'2026-11-20',row:1},custom:{nested:['a','b']},frameworkLinks:[{frameworkId:'TEST',article:'4.2',status:'Onderbouwd',evidence:'Bewijs 1',reviewedBy:'Reviewer',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'}]}}]
  };
  const data={id:'SRC-00001',name:'Synthetische bron',referenceKeys:['Bron / rij 1'],owner:'Bronhouder',version:'1',rightsStatus:'Toegestaan',rightsBasis:'Toestemming vastgelegd',allowedUse:'Interne inventariscontrole',scope:'Testorganisatie',retention:'Tot einde inventarisjaar',approvalStatus:'Goedgekeurd',approvedBy:'Reviewer',approvedAt:'2026-11-20',approvalEvidence:'TEST-BESLUIT-001',nextReviewAt:'2027-11-20'};
  data.approvalBinding=sources.createApprovalBinding(data,input.context);
  input.records.push({type:'sourceRegister',id:data.id,data});
  return confirm(input);
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function reverseKeys(value){if(Array.isArray(value))return value.map(reverseKeys);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reverseKeys(v)]));return value;}

test('Een expliciet bevestigde review bewaart een onafhankelijke, actuele inhoudskopie',()=>{
  const input=fixture(),binding=link(input).reviewBinding;
  assert.equal(engine.VERSION,'1.1.0');
  assert.equal(binding.schema,'assurance-review-binding-v1');
  assert.equal(inspect(input).status,'current');
  assert.equal(check(input,'review').status,'pass');
  assert.equal(check(input,'sources').status,'pass');
  assert.deepEqual(binding.basis.sourceIds,['SRC-00001']);
  assert.deepEqual(binding.basis.record.data.custom,{nested:['a','b']});
  assert.equal(binding.basis.record.data.frameworkLinks,undefined);
  assert.equal(binding.basis.link.reviewBinding,undefined);
  assert.equal(binding.basis.policy.requiredFields[0],'name');
  assert.notEqual(binding.basis.sources[0].data,source(input));
  const before=JSON.stringify(input);freeze(input);
  assert.deepEqual(engine.createReviewBinding(input,record(input),link(input)),binding);
  assert.equal(inspect(input).status,'current');
  assert.equal(JSON.stringify(input),before);
});

test('Bronkoppeling, onbekende inhoudsvelden en materiële recordmetadata wijzigen de reviewbasis',()=>{
  const changes=[
    value=>{value.data.name='Andere toepassing';},
    value=>{value.data.custom.nested[0]='ander';},
    value=>{value.data.recordMeta.row=2;},
    value=>{value.data.newUnknownField={auditTrail:'Dit is inhoud, geen top-level stempel'};},
    value=>{value.data.sources.push('Ontbrekende bron');}
  ];
  for(const change of changes){const input=fixture();change(record(input));assert.equal(inspect(input).status,'stale');assert.equal(check(input,'review').status,'attention');}
});

test('Alle linkinhoud blijft gebonden, ook toelichting, rol, status en nieuwe velden',()=>{
  const changes={article:'4.3',status:'Niet van toepassing',evidence:'Bewijs 2',reviewedBy:'Andere reviewer',reviewedAt:'2026-11-19',nextReviewAt:'2027-11-19',role:'Aanbieder',note:'Nieuwe toelichting',followUp:'Nieuwe actie',followUpOwner:'Eigenaar',followUpStatus:'Open',completionEvidence:'Verslag',newField:{answer:42}};
  for(const [field,value] of Object.entries(changes)){
    const input=fixture();link(input)[field]=value;
    const actual=inspect(input);assert.equal(actual.status,'stale',field);assert.ok(actual.findings.some(f=>f.part==='link'),field);
  }
});

test('Een gewijzigde bronversie, rechtenvoorwaarde of onbekend bronveld maakt de review verouderd',()=>{
  for(const [field,value] of [['version','2'],['rightsBasis','Nieuw gebruiksrecht'],['allowedUse','Andere toepassing'],['custom',{nested:{frameworkLinks:'Inhoud'}}]]){
    const input=fixture();source(input)[field]=value;
    assert.equal(inspect(input).status,'stale',field);
    assert.ok(inspect(input).findings.some(f=>f.part==='sources'),field);
  }
});

test('Niet gekoppelde bronnen veranderen de vastgelegde beoordeling niet',()=>{
  const input=fixture(),other=clone(source(input));other.id='SRC-00002';other.referenceKeys=['Andere bron'];other.approvalBinding=sources.createApprovalBinding(other,input.context);
  input.records.push({type:'sourceRegister',id:other.id,data:other});
  assert.equal(inspect(input).status,'current');other.version='2';
  assert.equal(inspect(input).status,'current');assert.equal(check(input,'sources').status,'attention');
});

test('Sleutelvolgorde en volgorde van registraties veranderen de reviewbasis niet',()=>{
  const input=reverseKeys(fixture());input.records.reverse();
  const target=input.records.find(r=>r.type==='assets'),assessment=target.data.frameworkLinks[0];
  assert.equal(engine.inspectReviewBinding(input,target,assessment).status,'current');
  assert.equal(check(input,'review').status,'pass');
});

test('De volgorde van inhoudelijke lijsten blijft betekenisvol',()=>{
  const input=fixture();record(input).data.custom.nested.reverse();
  assert.equal(inspect(input).status,'stale');
});

test('Alleen top-level publicatiestempels en andere beoordelingen blijven buiten de recordprojectie',()=>{
  const input=fixture();record(input).data.auditTrail=[{event:'publish',at:'2026-11-21'}];source(input).auditTrail=[{event:'publish'}];
  record(input).data.frameworkLinks.push({frameworkId:'TEST',article:'9',status:'Nog te beoordelen'});
  source(input).frameworkLinks=[{frameworkId:'TEST',article:'8',reviewBinding:{unused:'Geen recursieve snapshot'}}];
  assert.equal(inspect(input).status,'current');
  record(input).data.custom.auditTrail='Geneste inhoud verandert wel';
  assert.equal(inspect(input).status,'stale');
});

test('Dag, globale bestandsversie en globale inhoudshash maken de inhoudsvastlegging niet vanzelf verouderd',()=>{
  const input=fixture();input.context.asOf='2026-11-22';input.context.sourceVersion='later-commit';input.context.sourceFingerprint='sha256:'+'a'.repeat(64);
  assert.equal(inspect(input).status,'current');
  assert.equal(check(input,'review').status,'pass');
});

test('Organisatie en gegevensselectie moeten overeenkomen met de beoordeling',()=>{
  for(const field of ['organisationId','scopeId']){
    const input=fixture();input.context[field]='another';assert.equal(inspect(input).status,'stale');assert.ok(inspect(input).findings.some(f=>f.part===field));
  }
});

test('Werkelijke beleidswaarden, controleversies en catalogusinhoud zijn gebonden',()=>{
  for(const change of [
    input=>{input.policy.reviewMaxAgeDays=364;},
    input=>{input.reviewRules.catalog.references[0].title='Andere inhoud bij dezelfde versie';},
    input=>{input.reviewRules.registerFiles.assets='changed.json';},
    input=>{link(input).reviewBinding.basis.engineVersion='1.0.0';},
    input=>{link(input).reviewBinding.basis.sourceRegisterVersion='old';}
  ]){const input=fixture();change(input);assert.equal(inspect(input).status,'stale');}
});

test('Afwezige regels en een expliciet leeg regelobject zijn verschillende invoer',()=>{
  const input=fixture();delete input.reviewRules;confirm(input);assert.equal(inspect(input).status,'current');
  input.reviewRules={};assert.equal(inspect(input).status,'stale');
  input.reviewRules=null;assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_INPUT_INVALID');
});

test('Onderbouwd en niet van toepassing krijgen zonder inhoudsvastlegging aandacht',()=>{
  for(const status of ['Onderbouwd','Niet van toepassing']){
    const input=fixture();link(input).status=status;link(input).note='Gemotiveerde beslissing';delete link(input).reviewBinding;
    assert.equal(inspect(input).status,'missing');assert.equal(check(input,'review').status,'attention');
    assert.ok(check(input,'review').findings.some(f=>f.code==='REVIEW_BINDING_MISSING'));
    assert.equal(check(input,'review').coverage.bindings.missing,1);
  }
});

test('Een gemotiveerde actuele niet-toepasselijkheidsbeslissing blijft apart van geslaagde beoordelingen',()=>{
  const input=fixture();link(input).status='Niet van toepassing';link(input).note='Deze rol is hier niet aanwezig';confirm(input);
  assert.equal(inspect(input).status,'current');assert.equal(check(input,'review').status,'not_run');
});

test('Misvormde snapshots en onbekende schema’s falen zichtbaar',()=>{
  const malformed=[null,{},[],{schema:'future-schema',basis:{}},{schema:engine.REVIEW_BINDING_SCHEMA,basis:{}}];
  for(const value of malformed){const input=fixture();link(input).reviewBinding=value;assert.equal(inspect(input).status,'invalid');assert.equal(check(input,'review').status,'fail');}
  for(const change of [
    value=>{delete value.basis.policy.sourceFields;},
    value=>{value.extra='Niet onderdeel van schema';},
    value=>{value.basis.record.data.auditTrail=[];},
    value=>{value.basis.link.reviewBinding={};},
    value=>{value.basis.sourceIds=[];},
    value=>{value.basis.sources[0].id='ander';},
    value=>{value.basis.reviewRules.present='yes';}
  ]){const input=fixture();change(link(input).reviewBinding);assert.equal(inspect(input).status,'invalid');}
});

test('Geen automatische bevestiging na inhoudswijziging; herbevestigen is een expliciete nieuwe handeling',()=>{
  const input=fixture(),saved=clone(link(input).reviewBinding);record(input).data.name='Gewijzigd';
  for(let i=0;i<2;i++){assert.equal(check(input,'review').status,'attention');assert.deepEqual(link(input).reviewBinding,saved);}
  confirm(input);assert.notDeepEqual(link(input).reviewBinding,saved);assert.equal(check(input,'review').status,'pass');
});

test('Een actuele binding vervangt nooit de controles op bewijs en beoordelingsdatum',()=>{
  for(const [field,value,code] of [['evidence','','REVIEW_EVIDENCE_REQUIRED'],['reviewedAt','2026-11-22','REVIEW_DATE_FUTURE'],['nextReviewAt','2026-11-20','REVIEW_OVERDUE']]){
    const input=fixture();link(input)[field]=value;confirm(input);
    assert.equal(inspect(input).status,'current');assert.ok(check(input,'review').findings.some(f=>f.code===code));assert.notEqual(check(input,'review').status,'pass');
  }
});

test('Ontbrekende of onoplosbare bron-ID’s kunnen geen nieuwe inhoudsvastlegging krijgen',()=>{
  for(const change of [
    input=>{input.records=input.records.filter(r=>r.type!=='sourceRegister');},
    input=>{record(input).data.sourceIds=['SRC-00999'];},
    input=>{record(input).data.sources=['Niet geregistreerde exacte referentie'];},
    input=>{delete record(input).data.sourceIds;delete record(input).data.sources;}
  ]){
    const input=fixture();change(input);
    assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_SOURCE_UNRESOLVED');
    assert.equal(inspect(input).status,'stale');assert.notEqual(check(input,'sources').status,'pass');
  }
});

test('Ambigue aliassen worden niet gekozen als bronbewijs',()=>{
  const input=fixture(),other=clone(source(input));other.id='SRC-00002';other.approvalBinding=sources.createApprovalBinding(other,input.context);
  input.records.push({type:'sourceRegister',id:other.id,data:other});
  assert.equal(check(input,'sources').status,'fail');assert.equal(inspect(input).status,'stale');
  assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_SOURCE_UNRESOLVED');
});

test('Een onbekende gebruiksstatus blijft aandacht, ook bij een actuele reviewbinding',()=>{
  const input=fixture();source(input).rightsStatus='Onbekend';source(input).approvalStatus='Nog te beoordelen';delete source(input).approvalBinding;confirm(input);
  assert.equal(inspect(input).status,'current');assert.equal(check(input,'review').status,'pass');assert.equal(check(input,'sources').status,'attention');
  assert.ok(check(input,'sources').findings.some(f=>f.code==='SOURCE_RIGHTS_UNKNOWN'));
});

test('Geweigerde rechten en afgewezen goedkeuring worden niet door een reviewbinding gemaskeerd',()=>{
  for(const [field,value,code] of [['rightsStatus','Niet toegestaan','SOURCE_USE_DENIED'],['approvalStatus','Afgewezen','SOURCE_APPROVAL_REJECTED']]){
    const input=fixture();source(input)[field]=value;
    assert.equal(check(input,'sources').status,'fail');assert.ok(check(input,'sources').findings.some(f=>f.code===code));
    assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_SOURCE_UNRESOLVED');
  }
});

test('Een onbekende of dubbele te beoordelen registratie wordt geweigerd',()=>{
  const input=fixture(),detached=clone(record(input));detached.data.name='Nog niet in invoer';
  assert.throws(()=>engine.createReviewBinding(input,detached,link(input)),error=>error.code==='REVIEW_BINDING_RECORD_UNRESOLVED');
  input.records.push(clone(record(input)));assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_RECORD_UNRESOLVED');
});

test('De snapshot heeft vaste grenzen voor UTF-8-omvang, diepte en aantal waarden',()=>{
  for(const value of ['x'.repeat(engine.REVIEW_BINDING_LIMITS.maxBytes),'😀'.repeat(270000),Array(50001).fill(0),Array.from({length:34}).reduce(value=>({nested:value}),{})]){
    const input=fixture();record(input).data.extra=value;
    assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_LIMIT_EXCEEDED');
  }
  const input=fixture();link(input).reviewBinding.basis.record.data.extra='x'.repeat(engine.REVIEW_BINDING_LIMITS.maxBytes);
  assert.equal(inspect(input).status,'invalid');
  assert.equal(inspect(input).findings[0].cause,'REVIEW_BINDING_LIMIT_EXCEEDED');
});

test('Niet-JSON-waarden en kringverwijzingen kunnen niet in een binding verdwijnen',()=>{
  for(const value of [undefined,NaN,Infinity,()=>true,new Date('2026-11-21')]){
    const input=fixture();record(input).data.extra=value;assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_INPUT_INVALID');
  }
  const input=fixture();record(input).data.extra=record(input).data;assert.throws(()=>confirm(input));
});

test('Getters, symboolvelden en extra lijsteigenschappen worden niet als vaste JSON-inhoud behandeld',()=>{
  const input=fixture();let reads=0;
  Object.defineProperty(record(input).data,'computed',{enumerable:true,get(){reads++;return 'veranderlijk';}});
  assert.throws(()=>confirm(input),error=>error.code==='REVIEW_BINDING_INPUT_INVALID');assert.equal(reads,0);
  const symbolic=fixture();record(symbolic).data[Symbol('hidden')]='Onbedoeld weggelaten inhoud';
  assert.throws(()=>confirm(symbolic),error=>error.code==='REVIEW_BINDING_INPUT_INVALID');
  const listed=fixture();record(listed).data.custom.nested.extra='Geen JSON-lijstwaarde';
  assert.throws(()=>confirm(listed),error=>error.code==='REVIEW_BINDING_INPUT_INVALID');
  const accessor=fixture(),saved=clone(link(accessor).reviewBinding);let bindingReads=0;
  Object.defineProperty(link(accessor),'reviewBinding',{enumerable:true,get(){bindingReads++;return saved;}});
  assert.equal(inspect(accessor).status,'invalid');assert.equal(bindingReads,0);
});

test('Een ontbrekend inhoudsveld verschilt van null en een lege tekst',()=>{
  const input=fixture();record(input).data.optional=null;
  assert.equal(inspect(input).status,'stale');confirm(input);record(input).data.optional='';
  assert.equal(inspect(input).status,'stale');confirm(input);delete record(input).data.optional;
  assert.equal(inspect(input).status,'stale');
});

test('Een bronregistratie heeft geen eigen bronverwijzing nodig en vormt geen kring van snapshots',()=>{
  const input=fixture(),target=input.records[1],assessment={frameworkId:'TEST',article:'6',status:'Onderbouwd',evidence:'Controle bronregister',reviewedBy:'Reviewer',reviewedAt:'2026-11-20'};
  target.data.frameworkLinks=[assessment];assessment.reviewBinding=engine.createReviewBinding(input,target,assessment);
  assert.equal(engine.inspectReviewBinding(input,target,assessment).status,'current');
  assert.deepEqual(assessment.reviewBinding.basis.sourceIds,[]);
  assert.equal(assessment.reviewBinding.basis.record.data.frameworkLinks,undefined);
  assert.equal(inspect(input).status,'current');
  input.records=[target];assert.equal(check(input,'sources').status,'not_run');assert.equal(check(input,'sources').coverage.inventoryRecords,0);
});

test('Browser en Node gebruiken voor bindings exact dezelfde bron- en reviewcontroles',()=>{
  const ctx={};vm.createContext(ctx);
  vm.runInContext(readFileSync('tools/ict-scan/assurance/source-register.js','utf8'),ctx);
  vm.runInContext(readFileSync('tools/ict-scan/assurance/engine.js','utf8'),ctx);
  const input=fixture();
  assert.equal(JSON.stringify(ctx.AssuranceEngine.createReviewBinding(input,record(input),link(input))),JSON.stringify(engine.createReviewBinding(input,record(input),link(input))));
  assert.equal(JSON.stringify(ctx.AssuranceEngine.evaluate(input)),JSON.stringify(engine.evaluate(input)));
});

test('Ontbrekende bronmodule kan in de browser geen groene broncontrole opleveren',()=>{
  const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync('tools/ict-scan/assurance/engine.js','utf8'),ctx);
  const input=fixture(),output=ctx.AssuranceEngine.evaluate(input);
  assert.equal(output.checks.find(c=>c.id==='sources').status,'fail');
  assert.equal(output.overall.status,'fail');
});
