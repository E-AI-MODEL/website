/* LEIF: gepubliceerde algemene websiteteksten; persoonlijke antwoorden blijven buiten beeld. */
(()=>{
'use strict';
const pages={'/leif/':'start','/leif/mijn/':'mijn','/leif/continue/':'vervolg','/leif/verhaal/':'verhaal','/leif/beheer/':'beheer'};
const page=pages[location.pathname.replace(/index\.html$/,'').replace(/\/?$/,'/')];
if(!page)return;
const api='https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/leif-admin-console';
const editing=new URLSearchParams(location.search).get('leif_voorbeeld')==='1'&&window.parent!==window;
const exclude='script,style,svg,textarea,select,option,input,code,pre,[contenteditable],[data-leif-locked],#protected-text,#answerReadout,#testerAnswers,#participants,#testerList,#testerDetail,#codePanel,#testerInvite,.reader,.report-page,.reportlist,.personal,.quote-list,.answer-piece,.narrative-copy,.readonly,.readout,.text-answer,.question textarea,.exercise textarea,#welcome,[aria-live],.save-status,.error,.status,.meta#identity';
const registered=new WeakMap(),known=new Map(),published=new Map(),preview=new Map();
let scheduled=false, editEnabled=editing;
const tidy=s=>String(s||'').replace(/\s+/g,' ').trim();
function hash(str){
 let a=2166136261,b=0x811c9dc5;
 for(const c of str){let n=c.charCodeAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^n,2246822519)}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
function locationOf(node){
 let e=node.parentElement;
 if(!e)return '';
 const elements=[];
 while(e&&e!==document.body){
  if(e.id){elements.unshift('#'+e.id);break}
  let index=1,other=e.previousElementSibling;
  while(other){if(other.tagName===e.tagName)index++;other=other.previousElementSibling}
  elements.unshift(e.tagName.toLowerCase()+':'+index);
  e=e.parentElement;
 }
 return elements.join('/')+':'+[...node.parentElement.childNodes].filter(n=>n.nodeType===3).indexOf(node);
}
function inspect(node){
 if(node.nodeType!==Node.TEXT_NODE||!node.parentElement||node.parentElement.closest(exclude))return null;
 const raw=node.nodeValue||'',original=tidy(raw);
 if(original.length<3||original.length>6000||!/[A-Za-zÀ-ÿ]/.test(original))return null;
 if(!node.parentElement.closest('h1,h2,h3,h4,p,span,small,button,a,label,strong,summary,li,dt,dd'))return null;
 if(registered.has(node))return registered.get(node);
 const key=hash(page+'|'+locationOf(node)+'|'+original);
 const field={key,page,node,original,raw};
 registered.set(node,field);known.set(key,field);
 return field;
}
function apply(field){
 const value=preview.has(field.key)?preview.get(field.key):published.get(field.key);
 if(value===undefined)return;
 const prefix=(field.raw.match(/^\s*/)||[''])[0],suffix=(field.raw.match(/\s*$/)||[''])[0];
 const target=prefix+value+suffix;
 if(field.node.nodeValue!==target)field.node.nodeValue=target;
}
function scan(){
 scheduled=false;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let node;while((node=walker.nextNode())){const f=inspect(node);if(f)apply(f)}
 if(editing)post({event:'catalog',fields:[...known.values()].map(({key,original})=>({key,original}))});
}
function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(scan)}}
function post(message){window.parent.postMessage({...message,source:'leif-tekst',page},location.origin)}
if(editing){
 // Het voorbeeld mag nooit formulieren versturen, opslag veranderen of antwoorden schrijven.
 document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation()},true);
 document.addEventListener('click',e=>{
  if(!editEnabled)return;
  const element=e.target instanceof Element?e.target:null;
  if(!element)return;
  let field=null,walk=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),node;
  while((node=walk.nextNode())){field=inspect(node);if(field)break}
  if(!field){for(const n of element.childNodes){field=inspect(n);if(field)break}}
  e.preventDefault();e.stopImmediatePropagation();
  if(field)post({event:'selected',key:field.key,original:field.original,text:preview.get(field.key)??published.get(field.key)??field.original});
 },true);
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==window.parent||e.data?.source!=='leif-editor')return;
  if(e.data.action==='edit')editEnabled=!!e.data.enabled;
  if(e.data.action==='preview'&&typeof e.data.key==='string'&&typeof e.data.text==='string'){
   preview.set(e.data.key,e.data.text);queue();
  }
 });
}
function init(){
 const observer=new MutationObserver(queue);
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 queue();
 fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',credentials:'omit',body:JSON.stringify({action:'site_public',page})})
 .then(r=>r.ok?r.json():null).then(data=>{
  if(!Array.isArray(data?.items))return;
  for(const row of data.items)if(typeof row.field_key==='string'&&typeof row.published_text==='string')published.set(row.field_key,row.published_text);
  queue();
 }).catch(()=>{});
 if(editing)post({event:'ready'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.LeifTekst={page,refresh:queue};
})();