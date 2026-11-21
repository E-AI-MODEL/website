import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseArgs,gitBlobSha} from '../scripts/check_ict_assurance.mjs';

const REPO=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SCRIPT=resolve(REPO,'scripts/check_ict_assurance.mjs');
const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
const save=(file,data)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n');
function fixture(t){
  const root=mkdtempSync(resolve(tmpdir(),'ict-assurance-cli-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const profile=readJson(resolve(REPO,'tools/ict-scan/assurance/profiles/example-organisation.json'));
  mkdirSync(resolve(root,'inventory'));
  save(resolve(root,'profile.json'),profile);
  const documents={schema:'eai-school-ict-v1',metadata:{dataVersion:'fixture-1'}};
  for(const type of Object.keys(profile.source.registerFiles))documents[type]=[];
  documents.apps=[{id:'APP-001',name:'Fictieve toepassing',sources:['Fictieve bron / rij 1'],frameworkLinks:[{frameworkId:'AVG',article:'art. 30',status:'Onderbouwd',evidence:'Fictief vastgelegd besluit',reviewedBy:'Testbeoordelaar',reviewedAt:'2026-11-20',nextReviewAt:'2027-11-20'}]}];
  const source=resolve(root,'inventory/inventory.json'),manifest=resolve(root,'inventory/manifest.json');
  function update(){
    save(source,documents);
    const bytes=readFileSync(source);
    save(manifest,{schema:'eai-school-ict-manifest-v1',metadata:{dataVersion:'fixture-1'},dataFiles:[{path:'inventory.json',schema:'eai-school-ict-v1',sha:gitBlobSha(bytes),recordCounts:Object.fromEntries(Object.keys(profile.source.registerFiles).map(type=>[type,documents[type].length]))}]});
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
  assert.equal(output.status,0,output.stderr);
  const data=JSON.parse(output.stdout);
  assert.equal(data.execution.engineExecuted,true);
  assert.equal(data.overall.status,'attention');
  const manifest=readJson(resolve(REPO,'tools/ict-scan/bronnen/manifest.json'));
  const declared=manifest.dataFiles.reduce((sum,file)=>sum+Object.values(file.recordCounts).reduce((total,count)=>total+count,0),0);
  assert.ok(declared>0);assert.equal(data.checks.find(c=>c.id==='structure').coverage.records,declared);
  assert.equal(data.checks.find(c=>c.id==='drift').status,'not_run');
  assert.equal(data.checks.find(c=>c.id==='evaluation').coverage.executedCases,13);
  assert.equal(data.provenance.files.length,3);
  assert.match(data.context.sourceFingerprint,/^sha256:[a-f0-9]{64}$/);
  assert.match(data.provenance.rulesetHash,/^[a-f0-9]{64}$/);
  assert.match(data.provenance.corpusHash,/^[a-f0-9]{64}$/);
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
  corpus.cases[0].expect[0].status='fail';save(resolve(f.root,'broken-corpus.json'),corpus);
  const output=invoke(f.root,['--corpus','broken-corpus.json','--write-baseline','baseline.json']);
  assert.equal(output.status,1);assert.equal(output.result.execution.engineExecuted,true);
  assert.equal(output.result.checks.find(c=>c.id==='evaluation').status,'fail');
  assert.equal(output.result.baselineWrite.status,'not_written');assert.equal(existsSync(resolve(f.root,'baseline.json')),false);
});

test('Een lege inventaris blijft grijs en krijgt geen groene exit-uitleg',t=>{
  const f=fixture(t);f.documents.apps=[];f.update();
  const output=invoke(f.root);
  assert.equal(output.status,0);assert.equal(output.result.overall.status,'not_run');
  assert.equal(output.result.overall.color,'grey');assert.match(output.stderr,/geen nalevingsoordeel/);
  const write=invoke(f.root,['--write-baseline','empty-baseline.json']);
  assert.equal(write.status,2);assert.equal(write.result.execution.engineExecuted,true);
  assert.equal(write.result.baselineWrite.status,'not_written');assert.equal(existsSync(resolve(f.root,'empty-baseline.json')),false);
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
