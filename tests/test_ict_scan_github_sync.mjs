import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {File} from 'node:buffer';
import {createHash,webcrypto} from 'node:crypto';
import inventory from '../tools/ict-scan/inventory-index.js';
const blobSha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');

const source=readFileSync(resolve('tools/ict-scan/github-sync.js'),'utf8');
const maps=['apps','ai','connections','checks','devices','hardwareGroups','parts','dpia','aiControls','policyDocs','signals','candidates','licenseReview','workActions','softwareReview','faqs','sourceRegister'];
function setup({bad=false,unauthorized=false,cancelDuringImport=false,largeDirectory=false,withManifest=false,shaMismatch=false,badCounts=false,withSources=false,badSourceCounts=false,profile,alterField=false,unknownRegister=false}={}) {
  const fields={};
  for(const id of ['githubRepo','githubFolder','githubRef','githubToken','githubSyncStart','githubSyncCancel','githubSyncStatus','githubSyncSummary','githubReplace','topGithubSync']) {
    fields[id]={events:{},value:'',checked:false,hidden:false,disabled:false,textContent:'',dataset:{},addEventListener(event,handler){this.events[event]=handler;},focus(){}};
  }
  fields.githubRepo.value='E-AI-MODEL/private-data';
  fields.githubFolder.value='bronmap';
  fields.githubRef.value='main';
  fields.githubToken.value='test-token-not-real';
  fields.githubReplace.checked=true;
  let calls=[],renders=0;
  const state={sources:[],docs:[],derived:[],ready:false,view:'sources',sourceRegisterLoaded:false};
  for(const name of maps)state[name]=new Map();
  const content=Buffer.from(JSON.stringify({schema:'eai-school-ict-v1',apps:[{id:'APP-1',name:'Dummy software'}],...(withSources?{sourceRegister:[{id:'SRC-00001',name:'Exact source',extension:{keep:true}}]}:{})}));
  const sha=profile?blobSha(content):'a'.repeat(40);
  const manifestContent=Buffer.from(JSON.stringify({schema:'eai-school-ict-manifest-v1',metadata:{firstInventoryStarted:'2026-08-10',compiledBy:'Hans Visser'},dataFiles:[{path:'school.json',sha:shaMismatch?'c'.repeat(40):sha,recordCounts:{apps:badCounts?2:1,...(withSources?{sourceRegister:badSourceCounts?2:1}:{}),...(unknownRegister?{invented:0}:{})}}]}));
  const manifestSha=profile?blobSha(manifestContent):'b'.repeat(40);
  const context={window:profile?{IctOrganisation:{ready:Promise.resolve(profile)},IctInventoryIndex:inventory}:{},crypto:webcrypto,TextEncoder,Map,
    document:{getElementById:id=>fields[id],addEventListener(event,handler){this.events??={};this.events[event]=handler;}}, state,
    URL, AbortController, File, atob,
    Date, Error, Uint8Array, console,
    selectView(view){state.view=view;},
    renderAll(){renders++;},buildDerived(){state.derived=[];},toast(){},
    confirm(){return true;},
    async importOneFile(file) {
      if(bad)throw Error('Ongeldig bestand');
      if(cancelDuringImport)fields.githubSyncCancel.events.click();
      const payload=JSON.parse(await file.text());
      state.apps.set(payload.apps[0].id,profile?{...payload.apps[0],...(alterField?{name:'Aangepast'}:{})}:{...payload.apps[0],sources:[file.name]});
      if(payload.sourceRegister){for(const entry of payload.sourceRegister)state.sourceRegister.set(entry.id,entry);state.sourceRegisterLoaded=true;}
      state.sources.push({name:file.name,kind:'toepassingen',rows:1,info:'Herkomst van de registratie.'});
    },
    async fetch(url,options){
      calls.push({url,options});
      if(unauthorized)return {ok:false,status:404};
      const files=[{name:'school.json',type:'file',path:'bronmap/school.json',size:content.length,sha}];
      if(withManifest)files.push({name:'manifest.json',type:'file',path:'bronmap/manifest.json',size:manifestContent.length,sha:manifestSha});
      const data=url.includes('/commits/')?{sha:'d'.repeat(40)}:url.includes('/contents/')
        ?(largeDirectory?Array.from({length:1000},(_,i)=>({name:'item-'+i+'.txt',type:'file',path:'bronmap/item-'+i+'.txt',size:100,sha})):files)
        :{encoding:'base64',content:(url.endsWith(manifestSha)?manifestContent:content).toString('base64')};
      return {ok:true,async json(){return data;}};
    },
  };
  vm.runInNewContext(source,context,{filename:'github-sync.js'});
  return {fields,state,calls,events:context.document.events,get renders(){return renders;}};
}

test('GitHub-bron wordt alleen gelezen, verwerkt en de token gewist',async()=>{
  const x=setup();
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.sources.length,1);
  assert.match(x.fields.githubSyncStatus.textContent,/geslaagd/i);
  assert.equal(x.fields.githubToken.value,'');
  assert.equal(x.calls.length,2);
  assert.ok(x.calls.every(c=>c.options.method==='GET'));
  assert.ok(x.calls.every(c=>c.options.headers.Authorization==='Bearer test-token-not-real'));
  assert.equal(x.state.sources[0].githubRemote.repository,'E-AI-MODEL/private-data');
  assert.equal(x.state.view,'overview');
  assert.ok(x.renders>0);
});

test('Dezelfde GitHub-versie wordt opnieuw verwerkt en vervangt lokale toevoegingen',async()=>{
  const x=setup();
  await x.fields.githubSyncStart.events.click();
  x.state.apps.set('APP-LOCAL',{id:'APP-LOCAL',name:'Lokaal toegevoegd'});
  x.state.sources.push({name:'lokaal.json',kind:'toepassingen',rows:1});
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.apps.has('APP-LOCAL'),false);
  assert.equal(x.state.sources.length,1);
  assert.equal(x.calls.length,4);
  assert.match(x.fields.githubSyncStatus.textContent,/geslaagd/i);
});

test('Ongeldige GitHub-map wordt zonder netwerkverzoek geweigerd',async()=>{
  const x=setup();
  x.fields.githubFolder.value='../geheim';
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.calls.length,0);
  assert.match(x.fields.githubSyncStatus.textContent,/niet gelukt/i);
  assert.equal(x.fields.githubToken.value,'');
});

test('Fout tijdens import herstelt de vorige gegevens',async()=>{
  const x=setup({bad:true});
  x.state.apps.set('APP-old',{id:'APP-old',name:'Bestaande app',sources:['oud']});
  x.state.sources.push({name:'oud',rows:1});
  x.state.ready=true;
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.apps.get('APP-old').name,'Bestaande app');
  assert.equal(x.state.sources.length,1);
  assert.equal(x.fields.githubToken.value,'');
  assert.match(x.fields.githubSyncStatus.textContent,/niet gelukt/i);
});

test('Privé-repo zonder toegang geeft een leesbare fout zonder data te wijzigen',async()=>{
  const x=setup({unauthorized:true});
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,0);
  assert.equal(x.fields.githubToken.value,'');
  assert.match(x.fields.githubSyncStatus.textContent,/token/i);
});
test('Een mogelijk afgekapt GitHub-mappenoverzicht wordt afgewezen',async()=>{
  const x=setup({largeDirectory:true});
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.calls.length,1);
  assert.equal(x.state.apps.size,0);
  assert.match(x.fields.githubSyncStatus.textContent,/1\.000/);
  assert.match(x.fields.githubSyncStatus.textContent,/niet gelukt/);
});

test('Annuleren tijdens import herstelt de bestaande inventaris',async()=>{
  const x=setup({cancelDuringImport:true});
  x.state.apps.set('APP-old',{id:'APP-old',name:'Bestaande app',sources:['oud']});
  x.state.sources.push({name:'oud',rows:1});
  x.state.ready=true;
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.apps.get('APP-old').name,'Bestaande app');
  assert.equal(x.state.sources.length,1);
  assert.match(x.fields.githubSyncStatus.textContent,/afgebroken/i);
  assert.equal(x.fields.githubToken.value,'');
});

test('Manifestcontrole accepteert overeenkomstige GitHub-SHA en aantallen',async()=>{
  const x=setup({withManifest:true});
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.sources.length,1);
  assert.match(x.fields.githubSyncStatus.textContent,/manifest\.json/i);
  assert.match(x.fields.githubSyncStatus.textContent,/geslaagd/i);
  assert.equal(x.state.metadata.firstInventoryStarted,'2026-08-10');
});

test('Manifest met verkeerde SHA blokkeert synchronisatie zonder data te vervangen',async()=>{
  const x=setup({withManifest:true,shaMismatch:true});
  x.state.apps.set('APP-old',{id:'APP-old',name:'Vorige registratie'});
  x.state.ready=true;
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.apps.get('APP-old').name,'Vorige registratie');
  assert.match(x.fields.githubSyncStatus.textContent,/wijkt af van het manifest/);
});

test('Manifest met onjuiste aantallen herstelt vorige gegevens',async()=>{
  const x=setup({withManifest:true,badCounts:true});
  x.state.apps.set('APP-old',{id:'APP-old',name:'Vorige registratie'});
  x.state.sources.push({name:'oud.json'});
  x.state.ready=true;
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.apps.get('APP-old').name,'Vorige registratie');
  assert.equal(x.state.sources.length,1);
  assert.match(x.fields.githubSyncStatus.textContent,/ingelezen, 2 verwacht/);
});

test('Bronregister wordt geladen en de nieuwe manifesttelling wordt gecontroleerd',async()=>{
  const x=setup({withManifest:true,withSources:true});
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.sourceRegisterLoaded,true);
  assert.equal(x.state.sourceRegister.size,1);
  assert.deepEqual(x.state.sourceRegister.get('SRC-00001').extension,{keep:true});
  assert.match(x.fields.githubSyncStatus.textContent,/geslaagd/i);
});

test('Een verkeerde bronregistertelling herstelt ook bronregels en hun laadstatus',async()=>{
  const x=setup({withManifest:true,withSources:true,badSourceCounts:true});
  const original={id:'SRC-00999',name:'Vorige bron',extension:{keep:['oud']}};
  x.state.sourceRegister.set(original.id,original);x.state.sourceRegisterLoaded=true;
  x.state.apps.set('APP-OLD',{id:'APP-OLD',name:'Vorige app'});x.state.ready=true;
  await x.fields.githubSyncStart.events.click();
  assert.deepEqual([...x.state.sourceRegister.values()],[original]);
  assert.equal(x.state.sourceRegisterLoaded,true);
  assert.equal(x.state.apps.get('APP-OLD').name,'Vorige app');
  assert.match(x.fields.githubSyncStatus.textContent,/sourceRegister.*ingelezen, 2 verwacht/);
});

test('Annuleren na bronimport herstelt ook een eerdere bronregistratie',async()=>{
  const x=setup({withSources:true,cancelDuringImport:true});
  const original={id:'SRC-00999',name:'Vorige bron'};
  x.state.sourceRegister.set(original.id,original);x.state.sourceRegisterLoaded=true;
  await x.fields.githubSyncStart.events.click();
  assert.deepEqual([...x.state.sourceRegister.values()],[original]);
  assert.equal(x.state.sourceRegisterLoaded,true);
  assert.match(x.fields.githubSyncStatus.textContent,/afgebroken/);
});

test('Vervangen uit een oudere externe bron laat geen vorige bron-goedkeuring achter',async()=>{
  const x=setup();
  x.state.sourceRegister.set('SRC-00999',{id:'SRC-00999',approvalStatus:'Goedgekeurd'});x.state.sourceRegisterLoaded=true;
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.sourceRegister.size,0);assert.equal(x.state.sourceRegisterLoaded,false);
});

test('Het verplichte bronbestand of register wordt vóór wijziging van de inventaris geëist',async()=>{
  for(const file of ['missing.json','school.json']){
    const profile={source:{repository:'E-AI-MODEL/private-data',baseRef:'main',sourceDir:'bronmap',registerFiles:{apps:'school.json',sourceRegister:file}}};
    const x=setup({profile});x.state.apps.set('APP-OLD',{id:'APP-OLD',name:'Vorige app'});x.state.ready=true;
    await x.fields.githubSyncStart.events.click();
    assert.equal(x.state.apps.size,1);assert.equal(x.state.apps.get('APP-OLD').name,'Vorige app');
    assert.match(x.fields.githubSyncStatus.textContent,/Verplicht.*ontbreekt/);
  }
});

test('GitHub wordt bij opening opnieuw gelezen ondanks een lokale momentopname',async()=>{
  const profile={source:{repository:'E-AI-MODEL/private-data',baseRef:'main',sourceDir:'bronmap',registerFiles:{apps:'school.json',sourceRegister:'school.json'}}};
  const x=setup({profile,withManifest:true,withSources:true});
  x.state.ready=true;x.state.sourceMode='snapshot';x.state.apps.set('LOCAL',{id:'LOCAL',name:'Oud'});
  x.fields.githubReplace.checked=false;
  await x.events['ict-scan:local-restored']();
  assert.equal(x.state.apps.has('LOCAL'),false,x.fields.githubSyncStatus.textContent);
  assert.equal(x.state.githubVerification.records,2);
  assert.equal(x.state.githubVerification.registers,2);
  assert.equal(x.state.githubVerification.commit,'d'.repeat(40));
  assert.ok(x.calls.some(c=>c.url.includes('ref='+'d'.repeat(40))));
});
test('Gelijke aantallen volstaan niet: ontbrekende of gewijzigde JSON-velden blokkeren de officiële bron',async()=>{
  const profile={source:{repository:'E-AI-MODEL/private-data',baseRef:'main',sourceDir:'bronmap',registerFiles:{apps:'school.json',sourceRegister:'school.json'}}};
  const x=setup({profile,withManifest:true,withSources:true,alterField:true});
  x.state.apps.set('OLD',{id:'OLD',name:'Vorige bron'});x.state.ready=true;
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.get('OLD').name,'Vorige bron');
  assert.equal(x.state.githubVerification,undefined);
  assert.match(x.fields.githubSyncStatus.textContent,/velden ontbreken/);
});
test('Onbekend manifestregister mag niet ongemerkt worden overgeslagen',async()=>{
  const x=setup({withManifest:true,unknownRegister:true});
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,0);assert.match(x.fields.githubSyncStatus.textContent,/Onbekend register/);
});
