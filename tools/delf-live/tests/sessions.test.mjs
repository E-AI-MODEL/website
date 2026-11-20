import {test} from 'node:test';
import assert from 'node:assert/strict';

const saved=new Map();
globalThis.localStorage={
  getItem:key=>saved.get(key)??null,
  setItem:(key,value)=>saved.set(key,String(value)),
  removeItem:key=>saved.delete(key)
};
const events=[];
globalThis.window={dispatchEvent:event=>events.push(event.type)};
if(!globalThis.CustomEvent){
  globalThis.CustomEvent=class CustomEvent {
    constructor(type,options){this.type=type;this.detail=options?.detail;}
  };
}
const {
  listSessions,getActiveSession,selectSession,storeSession,
  deleteSession,exportSessionData,importSessionData
}=await import('../src/session-store.js');

test('DELF blijft de vaste standaardsessie',()=>{
  assert.equal(getActiveSession().id,'delf');
  assert.match(getActiveSession().speech,/Madame Klatten/);
  assert.match(getActiveSession().opening,/Onze rector kan er vanmiddag helaas niet bij zijn/);
  assert.throws(()=>deleteSession('delf'),/niet worden verwijderd/);
});

test('nieuwe sessie heeft eigen vaste speech en kan worden heropend',()=>{
  const entry={
    name:'Proefrede',opening:'Goedemiddag iedereen',reply:'Ik neem het over',
    interrupt:'Zullen we nu beginnen',speech:'Bonjour, merci pour votre présence',
    handback:'Het woord is weer aan jou',closing:'Dank voor deze middag'
  };
  const created=storeSession(entry);
  assert.ok(created.id.startsWith('sessie-'));
  assert.equal(getActiveSession().speech,entry.speech);
  assert.ok(events.includes('cloud-session-change'));
  selectSession('delf');
  assert.match(getActiveSession().speech,/Madame Klatten/);
  selectSession(created.id);
  assert.equal(getActiveSession().interrupt,entry.interrupt);
  const revised=storeSession({...entry,name:'Bijgestelde rede'},created.id);
  assert.equal(revised.id,created.id);
  assert.equal(getActiveSession().name,'Bijgestelde rede');
});

test('sessies zijn uitwisselbaar en kunnen niet stilzwijgend overschrijven',()=>{
  const json=exportSessionData();
  assert.equal(JSON.parse(json).format,'eai-cloud-studio/v1');
  assert.ok(!JSON.parse(json).session.id);
  const imported=importSessionData(json);
  assert.notEqual(imported.id,'delf');
  assert.equal(imported.name,'Bijgestelde rede');
  assert.throws(()=>importSessionData('{}'),/geen exportbestand/);
  assert.throws(()=>storeSession({name:'Onvolledig'}),/alle tekstvelden/);
  deleteSession(imported.id);
  assert.equal(getActiveSession().id,'delf');
  assert.ok(!listSessions().some(s=>s.id===imported.id));
});
