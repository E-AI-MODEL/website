#!/usr/bin/env node
/* Read-only source validation and the same deterministic engine as the browser.
   --write-baseline is the sole opt-in that records a comparison snapshot. */
import {readFileSync,writeFileSync,mkdirSync,statSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const engine=require('../tools/ict-scan/assurance/engine.js');
const profiles=require('../tools/ict-scan/assurance/profile.js');
const adapter=require('../tools/ict-scan/assurance/adapter.js');
const CODE_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ENGINE_PATH=resolve(CODE_ROOT,'tools/ict-scan/assurance/engine.js');
const DEFAULT_PROFILE='tools/ict-scan/assurance/profiles/emmauscollege.json';
const DEFAULT_CORPUS='tools/ict-scan/assurance/evaluation-corpus.json';
const DEFAULT_CATALOG='tools/ict-scan/frameworks.json';
const FLAGS=new Set(['root','profile','as-of','baseline','output','write-baseline','catalog','corpus','source-version']);
const NON_BLOCKING_SOURCE_CODES=new Set(['SOURCE_USE_DENIED','SOURCE_APPROVAL_REJECTED']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sha256=value=>createHash('sha256').update(value).digest('hex');
export const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
function fail(code,message,path) {const error=new Error(message);error.code=code;if(path)error.path=path;throw error;}
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function parseArgs(args) {
  const output={};
  for(let i=0;i<args.length;i++){
    const token=args[i];
    if(token==='--help'){output.help=true;continue;}
    if(!token.startsWith('--')||!FLAGS.has(token.slice(2)))fail('UNKNOWN_ARGUMENT','Onbekende optie: '+token);
    const name=token.slice(2),value=args[++i];
    if(!value||value.startsWith('--'))fail('MISSING_ARGUMENT','Een waarde ontbreekt voor --'+name+'.');
    if(Object.prototype.hasOwnProperty.call(output,name))fail('DUPLICATE_ARGUMENT','De optie --'+name+' is dubbel opgegeven.');
    output[name]=value;
  }
  if(output['as-of']&&!validDate(output['as-of']))fail('INVALID_AS_OF','--as-of moet een bestaande datum jjjj-mm-dd zijn.');
  return output;
}
function readJson(path,label) {
  let bytes;
  try {if(!statSync(path).isFile())throw Error();bytes=readFileSync(path);}catch(_){fail('SOURCE_UNREADABLE',label+' is niet leesbaar.',path);}
  try{return {bytes,data:JSON.parse(bytes.toString('utf8'))};}catch(_){fail('INVALID_JSON',label+' bevat geen geldige JSON.',path);}
}
function inSourceRoot(root,path) {
  let realRoot,realPath;
  try {realRoot=realpathSync(root);realPath=realpathSync(path);}catch(_){fail('SOURCE_UNREADABLE','Het bronbestand of de bronmap ontbreekt.',path);}
  const suffix=relative(realRoot,realPath);
  if(suffix==='..'||suffix.startsWith('..'+sep)||resolve(realRoot,suffix)!==realPath)fail('SOURCE_OUTSIDE_ROOT','Een bronbestand verwijst buiten de gekozen repositorymap.',path);
  return realPath;
}
function gitState(root) {
  try {
    const commit=execFileSync('git',['-C',root,'rev-parse','--verify','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000}).trim();
    const dirty=execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=normal'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000}).trim().length>0;
    return /^[a-f0-9]{40}$/i.test(commit)?{commit,dirty}:{commit:null,dirty:null};
  }catch(_){return {commit:null,dirty:null};}
}
export function validateSources(root,profile) {
  const folder=resolve(root,profile.source.sourceDir),manifestPath=resolve(folder,'manifest.json');
  inSourceRoot(root,manifestPath);
  const manifest=readJson(manifestPath,'Het bronmanifest');
  if(!object(manifest.data)||manifest.data.schema!=='eai-school-ict-manifest-v1'||!Array.isArray(manifest.data.dataFiles))fail('INVALID_MANIFEST','Het bronmanifest heeft een onbekende structuur.',manifestPath);
  const expected=[...new Set(Object.values(profile.source.registerFiles))].sort();
  const entries=manifest.data.dataFiles;
  if(entries.some(e=>!object(e)||typeof e.path!=='string')||new Set(entries.map(e=>e.path)).size!==entries.length)fail('INVALID_MANIFEST_FILES','Het manifest bevat een onvolledig of dubbel bestand.',manifestPath);
  const actual=entries.map(e=>e.path).sort();
  if(JSON.stringify(expected)!==JSON.stringify(actual))fail('MANIFEST_PROFILE_MISMATCH','De bestanden in het manifest komen niet overeen met het organisatieprofiel.',manifestPath);
  const documents={},files=[],inputPaths=[manifestPath];
  for(const name of expected){
    const entry=entries.find(e=>e.path===name),path=resolve(folder,name);
    inSourceRoot(root,path);
    const source=readJson(path,'Bronbestand '+name);
    inputPaths.push(path);
    const blob=gitBlobSha(source.bytes);
    if(typeof entry.sha!=='string'||!/^[a-f0-9]{40}$/i.test(entry.sha)||entry.sha.toLowerCase()!==blob)fail('MANIFEST_SHA_MISMATCH','De bytes van '+name+' komen niet overeen met de Git-blob-SHA in het manifest.',path);
    if(!object(source.data)||entry.schema!=='eai-school-ict-v1'||source.data.schema!==entry.schema)fail('SOURCE_SCHEMA_MISMATCH','De bronstructuur van '+name+' komt niet overeen met het manifest.',path);
    const registers=Object.keys(profile.source.registerFiles).filter(type=>profile.source.registerFiles[type]===name).sort();
    if(!object(entry.recordCounts)||JSON.stringify(Object.keys(entry.recordCounts).sort())!==JSON.stringify(registers))fail('MANIFEST_COUNTS_INCOMPLETE','Het manifest benoemt niet exact de registers uit '+name+'.',manifestPath);
    for(const type of registers){
      if(!Array.isArray(source.data[type]))fail('REGISTER_MISSING','Het register '+type+' ontbreekt in '+name+'.',path);
      if(!Number.isSafeInteger(entry.recordCounts[type])||entry.recordCounts[type]<0||entry.recordCounts[type]!==source.data[type].length)fail('MANIFEST_COUNT_MISMATCH','Het aantal registraties in '+type+' wijkt af van het manifest.',path);
      if(object(source.data.metadata?.counts)&&Object.prototype.hasOwnProperty.call(source.data.metadata.counts,type)&&source.data.metadata.counts[type]!==source.data[type].length)fail('SOURCE_COUNT_MISMATCH','De brontelling voor '+type+' wijkt af van de records.',path);
    }
    for(const type of profiles.REGISTERS)if(Array.isArray(source.data[type])&&!registers.includes(type))fail('UNMAPPED_REGISTER','Het register '+type+' staat in een ander bestand dan het profiel voorschrijft.',path);
    documents[name]=source.data;
    files.push({path:profile.source.sourceDir+'/'+name,bytes:source.bytes.length,gitBlobSha:blob,sha256:sha256(source.bytes),recordCounts:Object.fromEntries(registers.map(type=>[type,source.data[type].length]))});
  }
  return {documents,files,manifest:manifest.data,manifestPath,manifestSha256:sha256(manifest.bytes),inputPaths};
}
function protectOutput(path,inputPaths) {
  const identity=file=>existsSync(file)?realpathSync(file):resolve(file);
  if(inputPaths.some(file=>identity(file)===identity(path)))fail('OUTPUT_IS_INPUT','Een uitvoerbestand mag geen gebruikt bron- of configuratiebestand vervangen.',path);
}
function writeJson(path,value,exclusive=false) {
  mkdirSync(dirname(path),{recursive:true});
  try{writeFileSync(path,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:exclusive?'wx':'w'});}
  catch(error){fail(error.code==='EEXIST'?'BASELINE_EXISTS':'OUTPUT_WRITE_FAILED',error.code==='EEXIST'?'De eerdere stand bestaat al. Kies een nieuwe bestandsnaam.':'Het uitvoerbestand kon niet worden geschreven.',path);}
}
export function technicalGateFor(checks) {
  const failedChecks=[],nonBlockingRedChecks=[],businessFindings=[];
  for(const check of checks){
    const findings=Array.isArray(check.findings)?check.findings:[];
    const sourceRejections=check.id==='sources'?findings.filter(item=>item.severity==='fail'&&NON_BLOCKING_SOURCE_CODES.has(item.code)):[];
    businessFindings.push(...sourceRejections.map(item=>({...item,checkId:check.id})));
    if(check.status!=='fail')continue;
    // Only these two explicit source decisions are non-blocking. Category labels,
    // unknown codes/severities and additional technical failures never grant this exception.
    const sourceDecisionOnly=check.id==='sources'&&sourceRejections.length>0&&findings.every(item=>item.severity==='attention'||(item.severity==='fail'&&NON_BLOCKING_SOURCE_CODES.has(item.code)));
    if(sourceDecisionOnly)nonBlockingRedChecks.push(check.id);
    else failedChecks.push(check.id);
  }
  return {policy:'source-decisions-v1',status:failedChecks.length?'fail':'pass',failedChecks,nonBlockingRedChecks,businessFindings,operationalFailures:[],meaning:'Technische uitvoercontrole. Een rode bronafwijzing kan zichtbaar blijven; dit is geen goedkeuring van de bron of het gebruik.'};
}
function operationalFailure(result,code,message,path='') {
  const gate=result.execution.technicalGate;
  gate.status='fail';gate.operationalFailures.push({code,path,message});
}
function blocked(error,context,provenance) {
  const finding={code:error.code||'RUN_FAILED',path:error.path||'',message:error.code?error.message:'De broncontrole kon niet worden uitgevoerd.'};
  const result={schema:engine.RESULT_SCHEMA,rulesetVersion:engine.VERSION,context,
    scope:'De broninvoer is geblokkeerd. De controle-engine is niet uitgevoerd.',
    execution:{engineExecuted:false},overall:{status:'fail',color:'red',message:'Broncontrole geblokkeerd: '+finding.message,passed:0,attention:0,failed:1,notRun:4},
    checks:engine.CHECK_IDS.map((id,i)=>({id,title:i?'Niet uitgevoerd':'Bronbestanden en manifest',status:i?'not_run':'fail',color:i?'grey':'red',findings:i?[{code:'SOURCE_LOADING_BLOCKED',path:'',message:'De invoer kon niet worden gecontroleerd.'}]:[finding],coverage:{}})),provenance};
  result.execution.technicalGate=technicalGateFor(result.checks);
  operationalFailure(result,finding.code,finding.message,finding.path);
  return result;
}
export function run(options) {
  const root=resolve(options.root||CODE_ROOT);
  const asOf=options['as-of']||new Date().toISOString().slice(0,10);
  const context={asOf};
  const provenance={runner:'node-cli',clock:options['as-of']?'explicit':'current-utc',engineVersion:engine.VERSION,rulesetHash:sha256(readFileSync(ENGINE_PATH))};
  let outputPath=options.output?resolve(root,options.output):null,inputPaths=[ENGINE_PATH];
  let result,exitCode=0;
  try {
    if(!validDate(asOf))fail('INVALID_AS_OF','De controledatum is ongeldig.');
    const profilePath=options.profile?resolve(root,options.profile):resolve(CODE_ROOT,DEFAULT_PROFILE);
    const catalogPath=options.catalog?resolve(root,options.catalog):resolve(CODE_ROOT,DEFAULT_CATALOG);
    const corpusPath=options.corpus?resolve(root,options.corpus):resolve(CODE_ROOT,DEFAULT_CORPUS);
    inputPaths.push(profilePath,catalogPath,corpusPath);
    const rawProfile=readJson(profilePath,'Het organisatieprofiel');
    let profile;try{profile=profiles.validate(rawProfile.data);}catch(error){fail('PROFILE_INVALID',error.message,profilePath);}
    Object.assign(context,{organisationId:profile.organisation.id,scopeId:profiles.scopeKey(profile)});
    provenance.profileHash=sha256(rawProfile.bytes);provenance.profileVersion=profile.profileVersion;
    inputPaths.push(resolve(root,profile.source.sourceDir,'manifest.json'),...Object.values(profile.source.registerFiles).map(file=>resolve(root,profile.source.sourceDir,file)));
    const sources=validateSources(root,profile);inputPaths.push(...sources.inputPaths);
    const catalog=readJson(catalogPath,'Het kaderregister'),corpus=readJson(corpusPath,'Het evaluatiecorpus');
    provenance.catalogHash=sha256(catalog.bytes);provenance.corpusHash=sha256(corpus.bytes);
    provenance.adapterHash=sha256(readFileSync(resolve(CODE_ROOT,'tools/ict-scan/assurance/adapter.js')));
    provenance.profileValidatorHash=sha256(readFileSync(resolve(CODE_ROOT,'tools/ict-scan/assurance/profile.js')));
    provenance.sourceRegisterHash=sha256(readFileSync(resolve(CODE_ROOT,'tools/ict-scan/assurance/source-register.js')));
    provenance.manifestHash=sources.manifestSha256;provenance.files=sources.files;
    provenance.code=gitState(CODE_ROOT);provenance.source=gitState(root);
    provenance.synthetic=profile.synthetic;
    const rawSourceHash=sha256(engine.canonicalize(sources.files));
    provenance.rawSourceHash=rawSourceHash;
    context.sourceVersion=options['source-version']||sources.manifest.metadata?.dataVersion||'local-sha256:'+rawSourceHash;
    const input=adapter.fromDocuments(profile,sources.documents,catalog.data,context);
    input.context.sourceFingerprint='sha256:'+sha256(engine.canonicalize(input.records));
    input.evaluation=corpus.data;
    if(options.baseline){
      const baselinePath=resolve(root,options.baseline);inputPaths.push(baselinePath);
      input.baseline=readJson(baselinePath,'De eerdere stand').data;
      provenance.baselineHash=sha256(readFileSync(baselinePath));
    }
    if(outputPath)protectOutput(outputPath,inputPaths);
    const baselineOutput=options['write-baseline']?resolve(root,options['write-baseline']):null;
    if(baselineOutput){
      protectOutput(baselineOutput,inputPaths);
      if(outputPath&&resolve(outputPath)===baselineOutput)fail('OUTPUT_COLLISION','Rapport en eerdere stand moeten verschillende bestandsnamen hebben.');
      if(existsSync(baselineOutput))fail('BASELINE_EXISTS','De eerdere stand bestaat al. Kies een nieuwe bestandsnaam.',baselineOutput);
    }
    result={...engine.evaluate(input),execution:{engineExecuted:true},provenance};
    result.execution.technicalGate=technicalGateFor(result.checks);
    exitCode=result.execution.technicalGate.status==='fail'?1:0;
    if(baselineOutput){
      if(exitCode)result.baselineWrite={status:'not_written',reason:'Een technische controle is mislukt.'};
      else if(result.checks.find(check=>check.id==='structure').status!=='pass'){
        result.baselineWrite={status:'not_written',code:'BASELINE_EMPTY_DATASET',reason:'Er zijn geen geldige, niet-lege registraties voor een vergelijkingsstand.'};
        operationalFailure(result,result.baselineWrite.code,result.baselineWrite.reason,baselineOutput);
        exitCode=2;
      }
      else {
        try{
          writeJson(baselineOutput,engine.createBaseline(input),true);
          result.baselineWrite={status:'written',path:relative(root,baselineOutput)||baselineOutput,meaning:'Vergelijkingsstand; geen goedkeuring of nalevingsoordeel.'};
        }catch(error){result.baselineWrite={status:'not_written',code:error.code||'BASELINE_WRITE_FAILED',reason:error.message};operationalFailure(result,result.baselineWrite.code,error.message,baselineOutput);exitCode=2;}
      }
    }
  }catch(error){result=blocked(error,context,provenance);exitCode=2;}
  if(outputPath){
    try{protectOutput(outputPath,inputPaths);writeJson(outputPath,result);}
    catch(error){
      if(result.execution.engineExecuted){result.execution.outputError={code:error.code||'OUTPUT_WRITE_FAILED',message:error.message};operationalFailure(result,result.execution.outputError.code,error.message,outputPath);}
      else result=blocked(error,context,provenance);
      exitCode=2;outputPath=null;
    }
  }
  return {result,exitCode,outputPath};
}
const HELP=`Gebruik: node scripts/check_ict_assurance.mjs [opties]

  --profile BESTAND        Organisatieprofiel; standaard Emmauscollege.
  --root MAP               Lokale repositorymap met de bronbestanden.
  --as-of JJJJ-MM-DD        Expliciete controledatum; anders de huidige UTC-datum.
  --baseline BESTAND       Eerdere stand om mee te vergelijken.
  --output BESTAND         Bewaar het resultaat als JSON; anders alleen stdout.
  --write-baseline BESTAND  Maak expliciet een nieuwe vergelijkingsstand; nooit overschrijven.
  --catalog BESTAND        Expliciet kaderregister.
  --corpus BESTAND         Expliciet vast evaluatiecorpus.
  --source-version TEKST   Expliciete bronversie; standaard de versie in het manifest.

Exit 0: geen technische afkeuring; oranje of grijs blijft mogelijk.
Een rode bronafwijzing kan zichtbaar blijven: Niet toegestaan of Afgewezen is geen goedkeuring.
Alleen SOURCE_USE_DENIED en SOURCE_APPROVAL_REJECTED blokkeren op zichzelf de technische controle niet.
Exit 1: een technische controle of een vast testgeval is afgekeurd.
Exit 2: ongeldige argumenten, broninvoer, manifest of uitvoerpad.
execution.technicalGate vermeldt technische afkeuringen en vastgelegde bronafwijzingen.
Een succesvolle exit geeft geen bron- of gebruiksgoedkeuring en bewijst geen juridische naleving.
`;
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const options=parseArgs(process.argv.slice(2));
    if(options.help){process.stdout.write(HELP);}
    else {
      const output=run(options);
      if(!options['as-of'])process.stderr.write('Controledatum automatisch gekozen: '+output.result.context.asOf+' (UTC).\n');
      process.stdout.write(JSON.stringify(output.result,null,2)+'\n');
      process.stderr.write('Uitkomst: '+output.result.overall.status+'. Technische controle: '+output.result.execution.technicalGate.status+'. Exit '+output.exitCode+' is geen nalevingsoordeel.\n');
      process.stderr.write('Een rode bronafwijzing kan zichtbaar blijven; dit is geen goedkeuring van de bron of het gebruik.\n');
      process.exitCode=output.exitCode;
    }
  }catch(error){process.stderr.write((error.code||'ARGUMENT_ERROR')+': '+error.message+'\n');process.exitCode=2;}
}
