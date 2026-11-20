import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {File} from 'node:buffer';

const source=readFileSync(resolve('tools/ict-scan/github-sync.js'),'utf8');
const maps=['apps','ai','connections','checks','devices','parts','dpia','aiControls','policyDocs','signals'];
function setup({bad=false,unauthorized=false}={}) {
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
  const state={sources:[],docs:[],derived:[],ready:false,view:'sources'};
  for(const name of maps)state[name]=new Map();
  const content=Buffer.from(JSON.stringify({apps:[{id:'APP-1',name:'Dummy software'}]}));
  const sha='a'.repeat(40);
  const context={
    document:{getElementById:id=>fields[id]}, state,
    URL, AbortController, File, atob,
    Date, Error, Uint8Array, console,
    selectView(view){state.view=view;},
    renderAll(){renders++;},buildDerived(){state.derived=[];},toast(){},
    confirm(){return true;},
    async importOneFile(file) {
      if(bad)throw Error('Ongeldig bestand');
      const payload=JSON.parse(await file.text());
      state.apps.set(payload.apps[0].id,{...payload.apps[0],sources:[file.name]});
      state.sources.push({name:file.name,kind:'toepassingen',rows:1,info:'Herkomst van de registratie.'});
    },
    async fetch(url,options){
      calls.push({url,options});
      if(unauthorized)return {ok:false,status:404};
      const data=url.includes('/contents/')
        ?[{name:'school.json',type:'file',path:'bronmap/school.json',size:content.length,sha}]
        :{encoding:'base64',content:content.toString('base64')};
      return {ok:true,async json(){return data;}};
    },
  };
  vm.runInNewContext(source,context,{filename:'github-sync.js'});
  return {fields,state,calls,get renders(){return renders;}};
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

test('Ongewijzigde bron wordt niet dubbel ingelezen',async()=>{
  const x=setup();
  await x.fields.githubSyncStart.events.click();
  await x.fields.githubSyncStart.events.click();
  assert.equal(x.state.apps.size,1);
  assert.equal(x.state.sources.length,1);
  assert.match(x.fields.githubSyncStatus.textContent,/geen nieuwe versies/i);
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