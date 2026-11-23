import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {parseArgs,gitBlobSha,technicalGateFor} from '../scripts/check_ict_assurance.mjs';

const REPO=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SCRIPT=resolve(REPO,'scripts/check_ict_assurance.mjs');
const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
const save=(file,data)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n');
const require=createRequire(import.meta.url),engine=require('../tools/ict-scan/assurance/engine.js'),adapter=require('../tools/ict-scan/assurance/adapter.js'),profiles=require('../tools/ict-scan/assurance/profile.js'),sourceRegister=require('../tools/ict-scan/assurance/source-register.js');
const catalog=readJson(resolve(REPO,'tools/ict-scan/frameworks.json'));
function fixture(t){
  const root=mkdtempSync(resolve(tmpdir(),'ict-assurance-cli-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const profile=readJson(resolve(REPO,'tools/ict-scan/assurance/profiles/example-organisation.json'));
  mkdirSync(resolve(root,'inventory'));
  save(resolve(root,'profile.json'),profile);
  const documents={schema:'eai-school-ict-v1',metadata:{dataVersion:'fixture-1'}};
  for(const type of Object.keys(profile.source.registerFiles))documents[type]=[];
  documents.apps=[{id:'APP-001',name:'Fictieve toepassing',sources:['Fictieve bron / rij 1'],frameworkLinks:[{frameworkId:'AVG',article:'art. 30',status:'Onderbouwd',evidence:'Fictief vastgelegd besluit',reviewedBy:'Testbeoordelaar',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'}]}];
  const context={asOf:'2026-11-21',organisationId:profile.organisation.id,scopeId:profiles.scopeKey(profile)};
  documents.sourceRegister=[{id:'SRC-00001',name:'Fictieve bron',referenceKeys:['Fictieve bron / rij 1'],owner:'Fictieve bronhouder',version:'1',rightsStatus:'Toegestaan',rightsBasis:'Fictieve toestemming',allowedUse:'Uitsluitend deze test',scope:'Fictieve testomgeving',retention:'Tot einde van de test',approvalStatus:'Goedgekeurd',approvedBy:'Testbeoordelaar',approvedAt:'2026-11-20',approvalEvidence:'Fictief besluit',nextReviewAt:'2027-11-20'}];
  documents.sourceRegister[0].approvalBinding=sourceRegister.createApprovalBinding(documents.sourceRegister[0],context);
  const input=adapter.fromRegisters(profile,documents,catalog,context),record=input.records.find(item=>item.type==='apps');
  documents.apps[0].frameworkLinks[0].reviewBinding=engine.createReviewBinding(input,record,documents.apps[0].frameworkLinks[0]);
  const source=resolve(root,'inventory/inventory.json'),manifest=resolve(root,'inventory/manifest.json');
  function update(){
    const dataFiles=[];
    for(const name of new Set(Object.values(profile.source.registerFiles))){
      const types=Object.keys(profile.source.registerFiles).filter(type=>profile.source.registerFiles[type]===name);
      const file=resolve(root,'inventory',name);
      save(file,{schema:documents.schema,metadata:documents.metadata,...Object.fromEntries(types.map(type=>[type,documents[type]]))});
      dataFiles.push({path:name,schema:'eai-school-ict-v1',sha:gitBlobSha(readFileSync(file)),recordCounts:Object.fromEntries(types.map(type=>[type,documents[type].length]))});
    }
    save(manifest,{schema:'eai-school-ict-manifest-v1',metadata:{dataVersion:'fixture-1'},dataFiles});
  }
  update();
  return {root,profile,documents,source,manifest,update};
}
function invoke(root,args=[]){
  const output=spawnSync(process.execPath,[SCRIPT,'--root',root,'--profile','profile.json','--as-of','2026-11-21',...args],{cwd:REPO,encoding:'utf8',timeout:15000});
  assert.equal(output.error,undefined,output.error?.message);
  return {...output,result:output.stdout.trim()?JSON.parse(output.stdout):null};
}

test('CLI controleert de echte manifestbytes zonder een baseline te verzinnen',()=>{
  const output=spawnSync(process.execPath,[SCRIPT,'--as-of','2026-11-21'],{cwd:REPO,encoding:'utf8',timeout:15000});
  assert.equal(output.status,0,output.stderr+'\n'+(output.stdout?JSON.stringify(JSON.parse(output.stdout).checks?.filter(x=>x.status==='fail'),null,2):''));
  const data=JSON.parse(output.stdout);
  assert.equal(data.execution.engineExecuted,true);
  assert.equal(data.execution.technicalGate.status,'pass');
  assert.deepEqual(data.execution.technicalGate.failedChecks,[]);
  assert.equal(data.overall.status,'attention');
  const manifest=readJson(resolve(REPO,'tools/ict-scan/bronnen/manifest.json'));
  const declared=manifest.dataFiles.reduce((sum,file)=>sum+Object.values(file.recordCounts).reduce((total,count)=>total+count,0),0);
  assert.ok(declared>0);assert.equal(data.checks.find(c=>c.id==='structure').coverage.records,declared);
  assert.equal(data.checks.find(c=>c.id==='drift').status,'not_run');
  assert.equal(data.checks.find(c=>c.id==='evaluation').coverage.executedCases,31);
  assert.equal(data.provenance.files.length,4);
  assert.match(data.context.sourceFingerprint,/^sha256:[a-f0-9]{64}$/);
  assert.match(data.provenance.rulesetHash,/^[a-f0-9]{64}$/);
  assert.match(data.provenance.corpusHash,/^[a-f0-9]{64}$/);
  assert.match(data.provenance.sourceRegisterHash,/^[a-f0-9]{64}$/);
  assert.equal(data.baselineWrite,undefined);
});

test('Een tweede organisatie draait volledig met lokale bestanden',t=>{
  const f=fixture(t),output=invoke(f.root,['--output','result.json']);
  assert.equal(output.status,0,output.stderr);
  assert.equal(output.result.context.organisationId,'example-organisation');
  assert.equal(output.result.provenance.synthetic,true);
  assert.equal(output.result.checks.find(c=>c.id==='structure').status,'pass');
  assert.equal(output.result.checks.find(c=>c.id==='drift').status,'not_run');
  assert.equal(output.result.overall.status,'attention');
  assert.deepEqual(readJson(resolve(f.root,'result.json')),output.result);
  assert.equal(output.result.provenance.source.commit,null);
});

test('Een manifest-SHA die niet bij de bytes hoort blokkeert de engine',t=>{
  const f=fixture(t);writeFileSync(f.source,readFileSync(f.source,'utf8')+' ');
  const output=invoke(f.root,['--output','failure.json']);
  assert.equal(output.status,2);
  assert.equal(output.result.execution.engineExecuted,false);
  assert.equal(output.result.execution.technicalGate.status,'fail');
  assert.deepEqual(output.result.execution.technicalGate.failedChecks,['structure']);
  assert.equal(output.result.overall.status,'fail');
  assert.equal(output.result.checks[0].findings[0].code,'MANIFEST_SHA_MISMATCH');
  assert.equal(readJson(resolve(f.root,'failure.json')).overall.color,'red');
});

test('Onjuiste telling, extra bronbestanden en ontbrekende registers worden geweigerd',t=>{
  const f=fixture(t);
  let manifest=readJson(f.manifest);manifest.dataFiles[0].recordCounts.apps=99;save(f.manifest,manifest);
  assert.equal(invoke(f.root).result.checks[0].findings[0].code,'MANIFEST_COUNT_MISMATCH');
  f.update();manifest=readJson(f.manifest);manifest.dataFiles.push({...manifest.dataFiles[0],path:'unmapped.json'});save(f.manifest,manifest);
  assert.equal(invoke(f.root).result.checks[0].findings[0].code,'MANIFEST_PROFILE_MISMATCH');
  f.update();manifest=readJson(f.manifest);delete manifest.dataFiles[0].recordCounts.apps;save(f.manifest,manifest);
  assert.equal(invoke(f.root).result.checks[0].findings[0].code,'MANIFEST_COUNTS_INCOMPLETE');
});

test('Bewaren van een vergelijkingsstand is expliciet en overschrijft geen bestaand bestand',t=>{
  const f=fixture(t),path=resolve(f.root,'baseline.json');
  const first=invoke(f.root,['--write-baseline','baseline.json']);
  assert.equal(first.status,0,first.stderr);assert.equal(first.result.baselineWrite.status,'written');
  assert.equal(first.result.checks.find(c=>c.id==='drift').status,'not_run');
  assert.equal(first.result.overall.status,'attention');
  const original=readFileSync(path,'utf8');
  const second=invoke(f.root,['--baseline','baseline.json']);
  assert.equal(second.status,0,second.stderr);assert.equal(second.result.checks.find(c=>c.id==='drift').status,'pass');
  assert.equal(second.result.overall.status,'pass');
  const third=invoke(f.root,['--write-baseline','baseline.json']);
  assert.equal(third.status,2);assert.equal(third.result.checks[0].findings[0].code,'BASELINE_EXISTS');
  assert.equal(readFileSync(path,'utf8'),original);
});

test('Een verkeerde evaluatieverwachting geeft exit 1 en maakt geen baseline',t=>{
  const f=fixture(t),corpus=readJson(resolve(REPO,'tools/ict-scan/assurance/evaluation-corpus.json'));
  f.documents.sourceRegister[0].approvalStatus='Afgewezen';f.update();
  corpus.cases[0].expect[0].status='fail';save(resolve(f.root,'broken-corpus.json'),corpus);
  const output=invoke(f.root,['--corpus','broken-corpus.json','--write-baseline','baseline.json']);
  assert.equal(output.status,1);assert.equal(output.result.execution.engineExecuted,true);
  assert.equal(output.result.checks.find(c=>c.id==='evaluation').status,'fail');
  assert.deepEqual(output.result.execution.technicalGate.failedChecks,['evaluation']);
  assert.deepEqual(output.result.execution.technicalGate.nonBlockingRedChecks,['sources']);
  assert.equal(output.result.baselineWrite.status,'not_written');assert.equal(existsSync(resolve(f.root,'baseline.json')),false);
});

test('Een lege inventaris met leeg bronregister blijft grijs en krijgt geen groene exit-uitleg',t=>{
  const f=fixture(t);f.documents.apps=[];f.documents.sourceRegister=[];f.update();
  const output=invoke(f.root);
  assert.equal(output.status,0);assert.equal(output.result.overall.status,'not_run');
  assert.equal(output.result.overall.color,'grey');assert.match(output.stderr,/geen nalevingsoordeel/);
  const write=invoke(f.root,['--write-baseline','empty-baseline.json']);
  assert.equal(write.status,2);assert.equal(write.result.execution.engineExecuted,true);
  assert.equal(write.result.execution.technicalGate.status,'fail');
  assert.equal(write.result.execution.technicalGate.operationalFailures[0].code,'BASELINE_EMPTY_DATASET');
  assert.equal(write.result.baselineWrite.status,'not_written');assert.equal(existsSync(resolve(f.root,'empty-baseline.json')),false);
});

test('Een bronregister zonder inventaris geeft geen groene dekking',t=>{
  const f=fixture(t);f.documents.apps=[];f.update();const output=invoke(f.root);
  assert.equal(output.status,0,output.stderr);
  assert.equal(output.result.overall.status,'attention');
  const coverage=output.result.checks.find(c=>c.id==='sources');
  assert.equal(coverage.status,'not_run');assert.equal(coverage.coverage.inventoryRecords,0);assert.equal(coverage.coverage.sourceRegisterRecords,1);
});

test('Correct vastgelegde bronafwijzingen blijven rood bij technische exit 0',t=>{
  for(const [field,value,code] of [['rightsStatus','Niet toegestaan','SOURCE_USE_DENIED'],['approvalStatus','Afgewezen','SOURCE_APPROVAL_REJECTED']]){
    const f=fixture(t);f.documents.sourceRegister[0][field]=value;f.update();
    const output=invoke(f.root,['--output','denied.json','--write-baseline','denied-baseline.json']);
    assert.equal(output.status,0,output.stderr);assert.equal(output.result.overall.status,'fail');assert.equal(output.result.overall.color,'red');
    const sourceCheck=output.result.checks.find(c=>c.id==='sources');assert.equal(sourceCheck.status,'fail');assert.equal(sourceCheck.color,'red');
    assert.ok(sourceCheck.findings.some(item=>item.code===code&&item.severity==='fail'));
    const gate=output.result.execution.technicalGate;
    assert.equal(gate.status,'pass');assert.deepEqual(gate.failedChecks,[]);assert.deepEqual(gate.nonBlockingRedChecks,['sources']);
    assert.ok(gate.businessFindings.some(item=>item.code===code&&item.checkId==='sources'));
    assert.equal(output.result.baselineWrite.status,'written');assert.match(output.result.baselineWrite.meaning,/geen goedkeuring/);
    assert.equal(readJson(resolve(f.root,'denied.json')).overall.color,'red');
    assert.match(output.stderr,/rode bronafwijzing kan zichtbaar blijven/);assert.match(output.stderr,/geen goedkeuring/);
  }
});

test('Een bronafwijzing met een ongeldige datum blijft technisch afgekeurd',t=>{
  const f=fixture(t);f.documents.sourceRegister[0].approvalStatus='Afgewezen';f.documents.sourceRegister[0].approvedAt='2026-02-30';f.update();
  const output=invoke(f.root,['--write-baseline','invalid-baseline.json']);
  assert.equal(output.status,1);assert.equal(output.result.overall.color,'red');
  assert.equal(output.result.execution.technicalGate.status,'fail');assert.deepEqual(output.result.execution.technicalGate.failedChecks,['sources']);
  assert.deepEqual(output.result.execution.technicalGate.nonBlockingRedChecks,[]);
  assert.ok(output.result.execution.technicalGate.businessFindings.some(item=>item.code==='SOURCE_APPROVAL_REJECTED'));
  assert.ok(output.result.checks.find(c=>c.id==='sources').findings.some(item=>item.code==='SOURCE_DATE_INVALID'));
  assert.equal(output.result.baselineWrite.status,'not_written');assert.equal(existsSync(resolve(f.root,'invalid-baseline.json')),false);
});

test('Een misvormde bron- of reviewbinding blijft blokkerend naast een bronafwijzing',t=>{
  for(const target of ['source','review']){
    const f=fixture(t);f.documents.sourceRegister[0].approvalStatus='Afgewezen';
    if(target==='source')f.documents.sourceRegister[0].approvalBinding={schema:'invalid'};
    else f.documents.apps[0].frameworkLinks[0].reviewBinding={schema:'invalid'};
    f.update();const output=invoke(f.root);
    assert.equal(output.status,1,output.stderr);assert.equal(output.result.overall.color,'red');
    const expected=target==='source'?'sources':'review';assert.deepEqual(output.result.execution.technicalGate.failedChecks,[expected]);
    const expectedCode=target==='source'?'SOURCE_APPROVAL_BINDING_INVALID':'REVIEW_BINDING_INVALID';
    assert.ok(output.result.checks.find(check=>check.id===expected).findings.some(item=>item.code===expectedCode));
  }
});

test('De uitzondering geldt alleen voor twee exacte broncodes met de juiste ernst',()=>{
  const denial={code:'SOURCE_USE_DENIED',severity:'fail',category:'business',path:'/source',message:'Afwijzing'};
  const output=findings=>technicalGateFor([{id:'sources',status:'fail',findings}]);
  assert.equal(output([denial,{code:'SOURCE_APPROVAL_BINDING_STALE',severity:'attention'}]).status,'pass');
  for(const findings of [[],[{...denial,severity:undefined}],[{...denial,code:'UNKNOWN_BUSINESS_FAIL'}],[denial,{code:'SOURCE_DATE_INVALID',severity:'fail',category:'business'}],[denial,{code:'UNKNOWN_SEVERITY',severity:'warning'}],[{code:'ATTENTION_ONLY',severity:'attention'}]]){
    assert.equal(output(findings).status,'fail');assert.deepEqual(output(findings).failedChecks,['sources']);
  }
  for(const id of ['structure','review','drift','evaluation']){
    const gate=technicalGateFor([{id,status:'fail',findings:[denial]}]);assert.equal(gate.status,'fail');assert.deepEqual(gate.failedChecks,[id]);
  }
});

test('CLI-help legt uit dat een rode bronafwijzing geen goedkeuring wordt',()=>{
  const output=spawnSync(process.execPath,[SCRIPT,'--help'],{cwd:REPO,encoding:'utf8',timeout:15000});
  assert.equal(output.status,0);assert.match(output.stdout,/rode bronafwijzing kan zichtbaar blijven/);assert.match(output.stdout,/geen goedkeuring/);assert.match(output.stdout,/execution\.technicalGate/);
});

test('Een rapport kan geen input overschrijven, ook niet na een mislukte broncontrole',t=>{
  const f=fixture(t);writeFileSync(f.source,readFileSync(f.source,'utf8')+' ');
  const original=readFileSync(f.source,'utf8');
  const output=invoke(f.root,['--output','inventory/inventory.json']);
  assert.equal(output.status,2);assert.equal(output.result.checks[0].findings[0].code,'OUTPUT_IS_INPUT');
  assert.equal(readFileSync(f.source,'utf8'),original);
});

test('Datum, dubbele opties en onbekende opties worden vóór uitvoering geweigerd',()=>{
  for(const args of [['--as-of','2026-02-30'],['--no-check'],['--output'],['--profile','a','--profile','b']])assert.throws(()=>parseArgs(args));
  assert.deepEqual(parseArgs(['--as-of','2024-02-29']),{'as-of':'2024-02-29'});
});

test('Git-blob-SHA bindt ook de lengte en exacte bytes van de bron',()=>{
  const bytes=Buffer.from('één\n');
  const expected=createHash('sha1').update(Buffer.from('blob 6\0')).update(bytes).digest('hex');
  assert.equal(bytes.length,6);assert.equal(gitBlobSha(bytes),expected);
  assert.notEqual(gitBlobSha(bytes),gitBlobSha(Buffer.from('één')));
});

test('Een impliciete controledatum wordt expliciet als huidige UTC-datum gemeld',t=>{
  const f=fixture(t);
  const output=spawnSync(process.execPath,[SCRIPT,'--root',f.root,'--profile','profile.json'],{cwd:REPO,encoding:'utf8',timeout:15000});
  const result=JSON.parse(output.stdout);
  assert.equal(result.provenance.clock,'current-utc');
  assert.match(output.stderr,/automatisch gekozen: \d{4}-\d{2}-\d{2} \(UTC\)/);
});
