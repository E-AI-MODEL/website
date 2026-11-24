import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {File} from 'node:buffer';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const sources = require('../tools/ict-scan/assurance/source-register.js');
const profiles = require('../tools/ict-scan/assurance/profile.js');
const adapter = require('../tools/ict-scan/assurance/adapter.js');
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const clone = value => JSON.parse(JSON.stringify(value));
const profile = profiles.validate(json('tools/ict-scan/assurance/profiles/emmauscollege.json'));
const catalog = json('tools/ict-scan/frameworks.json');
const context = {asOf:'2026-11-21',organisationId:profile.organisation.id,scopeId:profiles.scopeKey(profile),sourceVersion:'test-version'};
const documents = Object.fromEntries([...new Set(Object.values(profile.source.registerFiles))].map(file => [file,json(profile.source.sourceDir+'/'+file)]));
const seed = documents['2026-bronnenregister.json'].sourceRegister;
const liveManifest=json(profile.source.sourceDir+'/manifest.json');
const liveContext={...context,asOf:liveManifest.metadata.evidenceCutoff};
const manifestRecords=liveManifest.dataFiles.reduce((sum,item)=>sum+Object.values(item.recordCounts).reduce((n,x)=>n+x,0),0);
function complete(overrides={}) {
  return {id:'SRC-00001',name:'Synthetische bron',referenceKeys:['Exacte bronref'],owner:'Bronhouder',version:'1',
    rightsStatus:'Toegestaan',rightsBasis:'Toestemming vastgelegd',allowedUse:'Interne inventariscontrole',
    scope:'Testorganisatie',retention:'Tot einde inventarisjaar',approvalStatus:'Goedgekeurd',approvedBy:'Reviewer',
    approvedAt:'2026-11-20',approvalEvidence:'TEST-BESLUIT-001',nextReviewAt:'2027-11-20',...overrides};
}
function approved(overrides={}) {const source=complete(overrides);source.approvalBinding=sources.createApprovalBinding(source,context);return source;}
const wrap = source => ({type:'sourceRegister',id:source.id,data:source});
const target = data => ({type:'apps',id:'APP-001',data:{id:'APP-001',name:'Test',...data}});
const codes = findings => findings.map(item=>item.code);

test('Bronregister bewaart eerdere verwijzingen en zeven aanvullende, nog niet goedgekeurde bronidentiteiten', () => {
  const expected=new Set();
  for(const [type,file] of Object.entries(profile.source.registerFiles)){
    if(type==='sourceRegister')continue;
    for(const row of documents[file][type])for(const field of ['sources','sourceRefs'])for(const ref of row[field]||[])expected.add(ref);
  }
  const actual=seed.flatMap(row=>row.referenceKeys);
  assert.equal(seed.length,liveManifest.dataFiles.find(x=>x.path==='2026-bronnenregister.json').recordCounts.sourceRegister);
  assert.ok(seed.length>=63);
  assert.equal(new Set(actual).size,actual.length,'Bronalias is nooit dubbel toegewezen');
  for(const ref of expected)assert.ok(actual.includes(ref),'Ontbrekende oorspronkelijke bronverwijzing: '+ref);
  assert.ok(actual.length>=expected.size,'Supplementaire verwijzingen naar bestanden en relatiebewijzen blijven traceerbaar');
  const grouped=seed.filter(row=>row.provenance?.file);
  assert.equal(grouped.length,2);assert.equal(grouped.reduce((sum,row)=>sum+row.referenceKeys.length,0),419);
  const originalFiles=new Set(Object.entries(profile.source.registerFiles).filter(([type])=>type!=='sourceRegister').flatMap(([type,file])=>documents[file][type].flatMap(row=>(row.provenance||[]).map(item=>item.file))));
  for(const row of grouped){assert.ok(originalFiles.has(row.provenance.file));assert.equal(row.name,row.provenance.file);assert.ok(row.referenceKeys.every(ref=>ref===row.provenance.file||ref.startsWith(row.provenance.file+' / ')));}
  for(const row of seed){
    if(Number(row.id.split('-').at(-1))<=63){assert.equal(row.owner,'');assert.equal(row.version,'');}
    assert.equal(row.approvedAt,'');
    assert.equal(row.rightsStatus,'Onbekend');assert.equal(row.approvalStatus,'Nog te beoordelen');
    assert.equal(Object.hasOwn(row,'approvalBinding'),false);
    const findings=sources.validate(row,liveContext);assert.ok(findings.length>0);assert.ok(findings.every(item=>item.severity==='attention'));
  }
});

test('Manifest bindt alle vier bronbestanden inclusief M365-, hardware- en bronaanvullingen', () => {
  const manifest=json(profile.source.sourceDir+'/manifest.json');
  assert.equal(manifest.dataFiles.length,4);
  for(const {path:file,sha:known} of manifest.dataFiles){
    const bytes=readFileSync(profile.source.sourceDir+'/'+file);
    const hash=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(hash,known,file);
    assert.equal(manifest.dataFiles.find(item=>item.path===file)?.sha,hash,'manifest SHA '+file);
  }
  const item=manifest.dataFiles.find(row=>row.path==='2026-bronnenregister.json'),bytes=readFileSync(profile.source.sourceDir+'/'+item.path);
  assert.equal(item.recordCounts.sourceRegister,seed.length);
  assert.equal(item.sha,createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'));
});

test('Volledige bron met expliciete goedkeuring kan zonder bevindingen worden gevalideerd', () => {
  const source=approved({extension:{nested:['bewaar',3]}}),before=clone(source);
  assert.deepEqual(sources.validate(source,context),[]);
  assert.equal(sources.inspectApprovalBinding(source,context).status,'current');
  assert.deepEqual(source,before);
  assert.equal(sources.inspectApprovalBinding(source,{...context,asOf:'2026-11-22'}).status,'current');
});

test('Toegestane beperkte bron kan expliciet worden goedgekeurd en blijft oranje', () => {
  const source=approved({rightsStatus:'Beperkt'});
  assert.equal(sources.inspectApprovalBinding(source,context).status,'current');
  assert.deepEqual(codes(sources.validate(source,context)),['SOURCE_USE_RESTRICTED']);
  assert.equal(sources.validate(source,context)[0].category,'business');
});

test('Niet toegestaan en Afgewezen zijn inhoudelijke rode bevindingen en kunnen geen goedkeuring krijgen', () => {
  for(const [change,code] of [[{rightsStatus:'Niet toegestaan'},'SOURCE_USE_DENIED'],[{approvalStatus:'Afgewezen'},'SOURCE_APPROVAL_REJECTED']]){
    const source=complete(change),finding=sources.validate(source,context).find(item=>item.code===code);
    assert.equal(finding.severity,'fail');assert.equal(finding.category,'business');
    assert.throws(()=>sources.createApprovalBinding(source,context),/kan niet/);
  }
});

test('Ontbrekende gegevens en ongebonden goedkeuring worden nooit stil groen', () => {
  const source=complete({owner:'',rightsBasis:'',allowedUse:'',scope:'',retention:'',version:'',approvedBy:'',approvalEvidence:''});
  const findings=sources.validate(source,context);
  assert.ok(findings.some(item=>item.code==='SOURCE_APPROVAL_BINDING_MISSING'));
  for(const field of ['owner','rightsBasis','allowedUse','scope','retention','version','approvedBy','approvalEvidence'])assert.ok(findings.some(item=>item.field===field),field);
  assert.ok(findings.every(item=>item.severity==='attention'));
  assert.throws(()=>sources.createApprovalBinding(source,context),/kan niet/);
});

test('Kalenderfouten, toekomstig goedkeuren en verlopen bronbeoordeling hebben vaste uitkomsten', () => {
  for(const approvedAt of ['2026-02-30','21-11-2026',null,7])assert.ok(sources.validate(complete({approvedAt}),context).some(item=>item.code==='SOURCE_DATE_INVALID'&&item.severity==='fail'));
  assert.ok(codes(sources.validate(complete({approvedAt:'2026-11-22'}),context)).includes('SOURCE_APPROVAL_FUTURE'));
  const source=approved({nextReviewAt:'2026-11-21'});
  assert.ok(sources.validate(source,{...context,asOf:'2026-11-22'}).some(item=>item.code==='SOURCE_REVIEW_OVERDUE'&&item.severity==='attention'));
  assert.ok(codes(sources.validate(complete({approvedAt:'2026-11-20',nextReviewAt:'2026-11-19'}),context)).includes('SOURCE_DATE_ORDER_INVALID'));
});

test('Versie of echte SHA-256 is nodig; ongeldige typen, enums en hashes zijn rood', () => {
  const source=approved({version:'',contentSha256:'a'.repeat(64)});
  assert.deepEqual(sources.validate(source,context),[]);
  for(const changes of [{owner:7},{referenceKeys:'Exacte bronref'},{contentSha256:'sha256'},{rightsStatus:'waarschijnlijk'},{approvalStatus:'ja'}]){
    assert.ok(sources.validate(complete(changes),context).some(item=>item.severity==='fail'));
  }
});

test('Verwijzingen worden exact opgelost via ID, sources en sourceRefs en blijven in het origineel staan', () => {
  const source=approved(),record=target({sourceIds:[source.id],sources:['Exacte bronref'],sourceRefs:['Exacte bronref']});
  const before=clone(record),result=sources.resolve([wrap(source)],record,context);
  assert.equal(result.status,'pass');assert.equal(result.sources.length,1);assert.deepEqual(record,before);
  result.sources[0].owner='Mutatie buiten de module';assert.equal(source.owner,'Bronhouder');
  for(const ref of ['exacte bronref',' Exacte bronref','Exacte bronref ']){
    const unresolved=sources.resolve([wrap(source)],target({sources:[ref]}),context);
    assert.equal(unresolved.status,'attention');assert.equal(unresolved.sources.length,0);
    assert.ok(codes(unresolved.findings).includes('SOURCE_REFERENCE_UNRESOLVED'));
  }
});

test('Dubbele ID of alias blokkeert resolutie ook zonder verwijzing op het doelrecord', () => {
  const a=approved(),sameId=approved({name:'Andere bron'}),alias=approved({id:'SRC-00002'});
  for(const [records,code] of [[[wrap(a),wrap(sameId)],'SOURCE_ID_DUPLICATE'],[[wrap(a),wrap(alias)],'SOURCE_ALIAS_AMBIGUOUS']]){
    const result=sources.resolve(records,target({}),context);
    assert.equal(result.status,'fail');assert.ok(codes(result.findings).includes(code));
    assert.equal(sources.resolve(records,target({sources:['Exacte bronref']}),context).sources.length,0);
  }
});

test('Onbekende en ongeldige bron-ID’s blijven zichtbaar en volgorde verandert de uitkomst niet', () => {
  const a=approved(),b=approved({id:'SRC-00002',referenceKeys:['Tweede bron']});
  const record=target({sources:['Tweede bron','Exacte bronref']});
  assert.deepEqual(sources.resolve([wrap(a),wrap(b)],record,context),sources.resolve([wrap(b),wrap(a)],record,context));
  assert.deepEqual(sources.resolve([wrap(a),wrap(b)],record,context).sources.map(row=>row.id),['SRC-00001','SRC-00002']);
  assert.ok(codes(sources.resolve([wrap(a)],target({sourceIds:['SRC-99999']}),context).findings).includes('SOURCE_ID_UNRESOLVED'));
  assert.equal(sources.resolve([wrap(a)],target({sourceIds:'SRC-00001'}),context).status,'fail');
  assert.equal(sources.resolve([wrap(a)],target({}),context).status,'attention');
});

test('Wijzigingen in alle brongegevens, ook onbekende velden, maken de goedkeuring verouderd', () => {
  const original=approved({extension:{nested:{keep:'waarde'}}});
  for(const changes of [{owner:'Andere bronhouder'},{version:'2'},{allowedUse:'Ander gebruik'},{approvedBy:'Andere beoordelaar'},{approvalEvidence:'Ander besluit'},{referenceKeys:['Nieuwe exacte ref']},{extension:{nested:{keep:'gewijzigd'}}}]){
    const source={...clone(original),...changes};
    assert.equal(sources.inspectApprovalBinding(source,context).status,'stale');
    assert.ok(codes(sources.validate(source,context)).includes('SOURCE_APPROVAL_BINDING_STALE'));
  }
});

test('Alleen top-level auditTrail en frameworkLinks veranderen de bron-goedkeuring niet', () => {
  const source=approved({extension:{auditTrail:['origineel']}});
  source.auditTrail=[{action:'saved'}];source.frameworkLinks=[{frameworkId:'TEST'}];
  assert.equal(sources.inspectApprovalBinding(source,context).status,'current');
  source.extension.auditTrail.push('inhoudswijziging');
  assert.equal(sources.inspectApprovalBinding(source,context).status,'stale');
});

test('Goedkeuring is gebonden aan organisatie en scope; ontbrekende context geeft nooit current', () => {
  const source=approved();
  for(const field of ['organisationId','scopeId']){
    assert.equal(sources.inspectApprovalBinding(source,{...context,[field]:'andere'}).status,'stale');
    const missing={...context};delete missing[field];
    assert.equal(sources.inspectApprovalBinding(source,missing).status,'invalid');
    assert.throws(()=>sources.createApprovalBinding(complete(),missing),/expliciet/);
  }
  assert.equal(sources.inspectApprovalBinding(source,{}).status,'invalid');
  assert.ok(sources.validate(complete(),null).some(item=>item.severity==='fail'));
});

test('Malformed approval, te grote gegevens en te diepe of niet-JSON waarden worden geweigerd', () => {
  const source=approved();
  for(const binding of [null,[],{...source.approvalBinding,schema:'future'}, {...source.approvalBinding,extra:true}]){
    assert.equal(sources.inspectApprovalBinding({...source,approvalBinding:binding},context).status,'invalid');
  }
  for(const value of [Infinity,undefined,new Date('2026-01-01'),()=>true]){
    assert.throws(()=>sources.createApprovalBinding(complete({extension:value}),context),/kan niet/);
  }
  const deep={};let at=deep;for(let i=0;i<33;i++){at.next={};at=at.next;}
  const cyclic={};cyclic.self=cyclic;
  for(const extension of [deep,cyclic,{text:'x'.repeat(1024*1024)},{list:Array.from({length:50001},()=>0)}]){
    assert.throws(()=>sources.createApprovalBinding(complete({extension}),context),/kan niet/);
  }
});

test('Veldvolgorde verandert de goedkeuring niet en JSON-prototypen blijven data', () => {
  const extra=JSON.parse('{"__proto__":{"safe":true},"constructor":"tekst"}');
  const source=approved({extension:extra});
  const reordered=Object.fromEntries(Object.entries(source).reverse());
  assert.equal(sources.inspectApprovalBinding(reordered,context).status,'current');
  assert.equal(Object.prototype.safe,undefined);
});

test('Browser en Node delen dezelfde pure bronmodule zonder netwerk', () => {
  const browser={window:{},Date};
  vm.runInNewContext(read('tools/ict-scan/assurance/source-register.js'),browser);
  const source=complete();source.approvalBinding=browser.window.AssuranceSourceRegister.createApprovalBinding(source,context);
  assert.deepEqual(clone(browser.window.AssuranceSourceRegister.validate(source,context)),[]);
  assert.deepEqual(clone(source.approvalBinding),sources.createApprovalBinding(complete(),context));
});

function dashboard() {
  const app=read('tools/ict-scan/app.js'),context={window:{},document:{getElementById:()=>({})},Map,Set,Date,Blob,File,TextDecoder};
  vm.createContext(context);
  vm.runInContext(app.slice(0,app.lastIndexOf("$('reportDate').textContent="))+'\nglobalThis.api={state,importOneFile,exportJson,buildDerived};',context);
  const downloads=[];context.download=(name,blob)=>downloads.push({name,blob});context.toast=()=>{};
  return {...context.api,downloads,async load(file,data){await context.api.importOneFile(new File([JSON.stringify(data)],file));}};
}

test('Native import en ruwe documenten leveren exact dezelfde canonical records en reviewregels', async () => {
  const app=dashboard();
  for(const [file,data] of Object.entries(documents))await app.load(file,data);
  const imported=adapter.fromState(profile,app.state,catalog,context),raw=adapter.fromDocuments(profile,documents,catalog,context);
  assert.equal(imported.records.length,manifestRecords);assert.deepEqual(imported,raw);
  assert.equal(app.state.sourceRegisterLoaded,true);
  assert.equal(app.state.sourceRegister.size,seed.length);
  assert.equal(Object.hasOwn(app.state.sourceRegister.get(seed[0].id),'sources'),false);
  assert.deepEqual(imported.reviewRules.registerFiles,profile.source.registerFiles);
  imported.reviewRules.catalog.references[0].label='Gewijzigde kopie';assert.notEqual(catalog.references[0].label,'Gewijzigde kopie');
});

test('Native record zonder sources blijft onbekend, wordt niet aangevuld en laat buildDerived werken', async () => {
  const app=dashboard();
  await app.load('records.json',{schema:'eai-school-ict-v1',apps:[{id:'APP-1',name:'Onbekende toepassing'}],connections:[{id:'ENT-1',name:'Onbekende koppeling'}],ai:[{id:'AI-1',name:'Functie'}]});
  assert.doesNotThrow(()=>app.buildDerived());
  assert.ok(app.state.derived.length>0);
  assert.equal(Object.hasOwn(app.state.apps.get('APP-1'),'sources'),false);
  assert.equal(Object.hasOwn(app.state.connections.get('ENT-1'),'sources'),false);
  assert.equal(app.state.sources[0].name,'records.json');
});

test('Native import neemt intrekking, lege velden, sourceIds en onbekende JSON exact over', async () => {
  const app=dashboard(),before=approved({extension:{keep:['origineel']}});
  await app.load('source.json',{schema:'eai-school-ict-v1',sourceRegister:[before]});
  const changed={...clone(before),rightsStatus:'Niet toegestaan',approvalStatus:'Afgewezen',rightsBasis:'',extension:{keep:['nieuw',false]}};
  await app.load('source.json',{schema:'eai-school-ict-v1',sourceRegister:[changed],apps:[{id:'APP-1',name:'Test',sourceIds:[changed.id],extension:{keep:null}}]});
  assert.deepEqual(clone(app.state.sourceRegister.get(changed.id)),changed);
  assert.deepEqual(clone(app.state.apps.get('APP-1').sourceIds),[changed.id]);
  assert.deepEqual(clone(app.state.apps.get('APP-1').extension),{keep:null});
});

test('Een late dubbele bron-ID maakt native import atomisch en behoudt de vorige registratie', async () => {
  const app=dashboard();await app.load('old.json',{schema:'eai-school-ict-v1',apps:[{id:'APP-1',name:'Bewaren'}],sourceRegister:[complete()]});
  const old=clone([...app.state.apps.values()]),oldSources=clone([...app.state.sourceRegister.values()]),oldMeta=clone(app.state.metadata),oldFiles=app.state.sources.length;
  await assert.rejects(app.load('bad.json',{schema:'eai-school-ict-v1',metadata:{bad:true},apps:[{id:'APP-2',name:'Mag niet worden opgeslagen'}],sourceRegister:[complete(),complete()]}),/Dubbele ID/);
  assert.deepEqual(clone([...app.state.apps.values()]),old);assert.deepEqual(clone([...app.state.sourceRegister.values()]),oldSources);
  assert.deepEqual(clone(app.state.metadata),oldMeta);assert.equal(app.state.sources.length,oldFiles);
});

test('Bronregister ontbreekt niet stil bij een verplicht profiel; een expliciet lege lijst is herkenbaar', async () => {
  const app=dashboard(),partial={...documents};delete partial['2026-bronnenregister.json'];
  assert.throws(()=>adapter.fromDocuments(profile,partial,catalog,context),/bronstructuur/);
  for(const [file,data] of Object.entries(partial))await app.load(file,data);
  assert.throws(()=>adapter.fromState(profile,app.state,catalog,context),/nog niet ingelezen/);
  await app.load('2026-bronnenregister.json',{schema:'eai-school-ict-v1',sourceRegister:[]});
  assert.equal(app.state.sourceRegisterLoaded,true);
  assert.doesNotThrow(()=>adapter.fromState(profile,app.state,catalog,context));
  const legacy=clone(profile);delete legacy.source.registerFiles.sourceRegister;
  assert.doesNotThrow(()=>adapter.fromDocuments(legacy,partial,catalog,context));
});

test('JSON-export bewaart bronregels inclusief goedkeuring en onbekende velden', async () => {
  const app=dashboard(),source=approved({extension:{nested:[1,'exact']}});
  await app.load('source.json',{schema:'eai-school-ict-v1',sourceRegister:[source]});app.buildDerived();app.exportJson();
  const exported=JSON.parse(await app.downloads[0].blob.text());
  assert.deepEqual(exported.sourceRegister,[source]);
  const restored=dashboard();await restored.load('export.json',exported);
  assert.deepEqual(clone([...restored.state.sourceRegister.values()]),[source]);
  const empty=dashboard();empty.buildDerived();empty.exportJson();
  assert.equal(Object.hasOwn(JSON.parse(await empty.downloads[0].blob.text()),'sourceRegister'),false);
});

test('Een volledige JSON-export onder een nieuwe bestandsnaam behoudt alle geregistreerde regels', async () => {
  const app=dashboard();
  for(const [file,data] of Object.entries(documents))await app.load(file,data);
  const before=adapter.fromState(profile,app.state,catalog,context);
  app.buildDerived();app.exportJson();
  const exported=JSON.parse(await app.downloads[0].blob.text());
  const restored=dashboard();await restored.load('nieuwe-exportnaam.json',exported);
  const after=adapter.fromState(profile,restored.state,catalog,context);
  assert.deepEqual(after.records,before.records);
  for(const [type,file] of Object.entries(profile.source.registerFiles)){
    assert.deepEqual(exported[type],documents[file][type],type);
  }
});
