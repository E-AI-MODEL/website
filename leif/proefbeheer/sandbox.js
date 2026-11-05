/* LEIF testomgeving. Alleen fictieve browsergegevens, geen netwerktoegang. */
(function(){
'use strict';
const STORE='leif-proefgegevens-v1';
const TENANT={id:'11111111-1111-4111-8111-111111111111',slug:'proef',name:'LEIF testomgeving',role:'manager'};
function date(){return new Date().toISOString()}
function uid(){return crypto.randomUUID()}
function code(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('')}
function error(status,message){const e=new Error(message);e.status=status;return e}
function record(name,answers={}){
 const id=uid(),created_at=date();
 return {person:{id,tenant_id:TENANT.id,display_name:name,access_code:code(),state:'active',created_at,expires_at:null},
 doc:{participant_id:id,questionnaire_version:1,answers,exercises:{},report:null,position:{screen:'start',question_index:0},
 personal_texts:{draft:{},published:{},published_at:null},revision:0,updated_at:created_at}};
}
function seed(){
 const first=record('Noor (fictief)',{zichtbaar:'Ik kijk eerst rustig rond voordat ik iets zeg.',onzichtbaar:'Dat ik soms onzeker ben over nieuwe dingen.'});
 const second=record('Sam (fictief)',{zichtbaar:'Mensen zien dat ik snel beslissingen neem.'});
 return {format:'leif-proefgegevens',version:1,people:[first.person,second.person],documents:{[first.person.id]:first.doc,[second.person.id]:second.doc}};
}
function valid(v){
 return !!v&&v.format==='leif-proefgegevens'&&v.version===1&&Array.isArray(v.people)&&v.documents&&typeof v.documents==='object'&&!Array.isArray(v.documents)&&v.people.length<=250&&v.people.every(p=>p&&typeof p.id==='string'&&typeof p.display_name==='string'&&typeof p.access_code==='string'&&/^[a-f0-9]{48}$/.test(p.access_code)&&v.documents[p.id]&&typeof v.documents[p.id].revision==='number');
}
function save(v){localStorage.setItem(STORE,JSON.stringify(v))}
function read(){
 let v;
 try{v=JSON.parse(localStorage.getItem(STORE)||'null')}catch{}
 if(!valid(v)){v=seed();save(v)}
 return v;
}
function participant(state,id){
 const p=state.people.find(p=>p.id===id&&p.tenant_id===TENANT.id);
 if(!p)throw error(404,'not_found');
 return p;
}
function document(state,id){
 const doc=state.documents[id];
 if(!doc)throw error(404,'document_not_found');
 return doc;
}
function updateDoc(state,id,change){
 const d=document(state,id);
 if(!Number.isSafeInteger(change.revision)||change.revision!==d.revision)throw error(409,'revision_conflict');
 Object.assign(d,change.fields);
 d.revision+=1;d.updated_at=date();save(state);
 return d;
}
function adminSession(){
 return {ok:true,access_token:'proefomgeving-alleen-lokaal',refresh_token:'proefomgeving-alleen-lokaal',expires_in:86400,user_email:'Testbeheerder',tenants:[TENANT]};
}
async function admin(action,input={}){
 const state=read();
 if(action==='login'||action==='refresh')return adminSession();
 if(action==='list')return {ok:true,participants:state.people.map(({access_code,...p})=>p),role:'manager'};
 if(action==='invite'){
  const name=String(input.name||'').trim();
  if(!name||name.length>120)throw error(400,'invalid_name');
  const item=record(name);
  state.people.unshift(item.person);state.documents[item.person.id]=item.doc;save(state);
  return {ok:true,participant:item.person.id,code:item.person.access_code};
 }
 const p=participant(state,input.participant_id);
 const d=document(state,p.id);
 if(action==='get'){
  const {access_code,...publicPerson}=p;
  return {ok:true,participant:publicPerson,document:structuredClone(d)};
 }
 if(action==='rename'){
  const name=String(input.name||'').trim();
  if(!name||name.length>120)throw error(400,'invalid_name');
  p.display_name=name;save(state);return {ok:true,name};
 }
 if(action==='rotate'){p.access_code=code();p.state='active';save(state);return {ok:true,code:p.access_code}}
 if(action==='revoke'){p.state='revoked';save(state);return {ok:true,revoked:true}}
 if(action==='save_draft'){
  const values=input.draft;
  if(!values||typeof values!=='object'||Object.values(values).some(x=>typeof x!=='string'||x.length>45000))throw error(400,'invalid_text');
  const texts={...d.personal_texts,draft:{...values},draft_saved_at:date()};
  const out=updateDoc(state,p.id,{revision:input.revision,fields:{personal_texts:texts}});
  return {ok:true,revision:out.revision,personal_texts:structuredClone(texts)};
 }
 if(action==='publish_story'){
  const draft=d.personal_texts.draft||{};
  if(!Object.values(draft).some(x=>typeof x==='string'&&x.trim()))throw error(400,'no_draft');
  const texts={...d.personal_texts,published:{...draft},published_at:date()};
  const out=updateDoc(state,p.id,{revision:input.revision,fields:{personal_texts:texts}});
  return {ok:true,revision:out.revision,personal_texts:structuredClone(texts)};
 }
 if(action==='unpublish_story'){
  const texts={...d.personal_texts,published:{},published_at:null};
  const out=updateDoc(state,p.id,{revision:input.revision,fields:{personal_texts:texts}});
  return {ok:true,revision:out.revision,personal_texts:structuredClone(texts)};
 }
 throw error(400,'invalid_action');
}
async function personal(action,accessCode,input={}){
 const state=read();
 const p=state.people.find(p=>p.access_code===String(accessCode||'').toLowerCase()&&p.state==='active');
 if(!p)throw error(404,'access_denied');
 const doc=document(state,p.id);
 if(action==='load'){
  return {ok:true,participant:{id:p.id,name:p.display_name},
   document:{...structuredClone(doc),personal_texts:{...(doc.personal_texts.published||{})}}};
 }
 if(action==='save'){
  const changes=input.changes;
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(k=>!['answers','exercises','report','position'].includes(k)))throw error(400,'invalid_save');
  const updated=updateDoc(state,p.id,{revision:input.expected_revision,fields:structuredClone(changes)});
  return {ok:true,revision:updated.revision,updated_at:updated.updated_at};
 }
 throw error(400,'invalid_action');
}
function openAsParticipant(id){
 const state=read();
 const p=participant(state,id);
 if(p.state!=='active'){alert('De toegang van deze testdeelnemer is ingetrokken. Maak eerst een nieuwe code.');return}
 sessionStorage.setItem('leif-proef-open-code',p.access_code);
 location.assign('/leif/proefbeheer/mijn/');
}
function exportData(){
 const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});
 const u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download='leif-testgegevens.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2500);
}
async function importData(file){
 if(!file||file.size>2e6)throw error(400,'invalid_file');
 let data;try{data=JSON.parse(await file.text())}catch{throw error(400,'invalid_json')}
 if(!valid(data))throw error(400,'invalid_data');
 save(data);location.reload();
}
function resetData(){save(seed());location.reload()}
window.LeifProef={admin,personal,openAsParticipant,exportData,importData,resetData};
})();