/* LEIF beheer: teksten selecteren, concept bewaren en bewust publiceren. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const pageUrl={start:'/leif/?leif_voorbeeld=1',kei:'/leif/?leif_voorbeeld=1&deel=kei',mijn:'/leif/mijn/?leif_voorbeeld=1',vervolg:'/leif/continue/?leif_voorbeeld=1',verhaal:'/leif/verhaal/?leif_voorbeeld=1',beheer:'/leif/beheer/?leif_voorbeeld=1'};
const contentPage=name=>name==='kei'?'start':name;
const host=window.LeifBeheer;
const store=new Map();
let current=null,seen=[],inFlight=false,selecting=true,activeChoice='start';
const preview=$('sitePreview'),list=$('siteFieldList'),form=$('siteEditForm'),editor=$('siteEditInput'),status=$('siteEditStatus');
const make=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;return e};
const page=()=>contentPage($('sitePage').value);
const tell=msg=>{status.textContent=msg};
function request(action,extra={}){
 const tenant=host.getTenant();
 if(!tenant||!host.canManage()||tenant.slug!=='leif')throw Error('not_manager');
 return host.request(action,{tenant_id:tenant.id,page:page(),...extra});
}
function dirty(){return !!current&&editor.value!==(store.get(current.key)?.draft_text??current.original)}
function confirmLeave(){return !dirty()||confirm('Deze tekst is nog niet bewaard. Wil je de wijziging laten vervallen?')}
function state(){return current?store.get(current.key):null}
function previewUpdate(key,txt){
 if(typeof txt!=='string')return;
 preview.contentWindow?.postMessage({source:'leif-editor',action:'preview',key,text:txt},location.origin);
}
function renderCatalog(){
 list.replaceChildren();
 const unique=new Map(seen.map(f=>[f.key,f]));
 for(const field of unique.values()){
  const saved=store.get(field.key);
  const button=make('button',(saved?.draft_text??field.original).slice(0,105));
  button.type='button';button.setAttribute('aria-current',String(current?.key===field.key));
  button.title=saved?.published_text!=null?'Gepubliceerd':'Concept of standaardtekst';
  button.onclick=()=>select(field);
  list.append(button);
 }
 if(!unique.size)list.append(make('p','Kies een tekst in het voorbeeld, of open een ander onderdeel.'));
}
function select(field){
 if(current?.key!==field.key&&!confirmLeave())return;
 current={key:field.key,original:field.original};
 const saved=state();
 $('siteOriginal').textContent=saved?.original_text??field.original;
 editor.value=saved?.draft_text??field.original;
 form.hidden=false;
 tell(saved?'Versie '+saved.revision+(saved.published_at?' · gepubliceerd':''):'Dit is nog de oorspronkelijke tekst.');
 renderCatalog();
 $('siteHistory').replaceChildren();
 if(saved)loadHistory();
}
async function loadCatalog(){
 if(!host.getTenant())return;
 try{
  const result=await request('site_list');
  store.clear();for(const item of result.items||[])store.set(item.field_key,item);
  renderCatalog();
 }catch{tell('De opgeslagen teksten konden niet worden geladen.')}
}
async function loadHistory(){
 if(!current||!state())return;
 const key=current.key;
 try{
  const result=await request('site_history',{field_key:key});
  if(!current||current.key!==key)return;
  const box=$('siteHistory');box.replaceChildren();
  for(const version of result.items||[]){
   const row=make('div','Versie '+version.revision+' · '+new Date(version.changed_at).toLocaleString('nl-NL'));
   const button=make('button','Neem dit concept terug');button.type='button';button.className='btn secondary compact';
   button.onclick=async()=>{if(confirm('De tekst van deze versie als nieuw concept bewaren? De huidige publicatie blijft zichtbaar.'))await change('site_restore',{history_id:version.id})};
   row.append(button);box.append(row);
  }
 }catch{tell('De eerdere versies konden niet worden geladen.')}
}
async function change(action,extra={}){
 if(!current||inFlight)return;
 if(action!=='site_save'&&dirty()){tell('Bewaar eerst het aangepaste concept.');return}
 const key=current.key,original=current.original,existing=state();
 inFlight=true;
 for(const id of ['siteSave','sitePublish','siteUnpublish'])$(id).disabled=true;
 tell(action==='site_save'?'Concept bewaren...':'Wijziging verwerken...');
 try{
  const result=await request(action,{field_key:key,revision:existing?.revision||0,original,...extra});
  if(!result.ok||!result.item)throw Error('invalid_result');
  store.set(key,result.item);editor.value=result.item.draft_text;
  if(action==='site_publish')previewUpdate(key,result.item.published_text);
  if(action==='site_unpublish')previewUpdate(key,original);
  if(action==='site_save'||action==='site_restore')previewUpdate(key,result.item.draft_text);
  tell(action==='site_save'?'Concept bewaard.':action==='site_publish'?'Tekst gepubliceerd.':action==='site_unpublish'?'Publicatie teruggenomen.':'Eerdere versie als concept bewaard.');
  renderCatalog();await loadHistory();
 }catch(e){tell(e.status===409?'Deze tekst is ergens anders gewijzigd. Laad de pagina opnieuw voordat je verdergaat.':'De wijziging kon niet worden bewaard.')}
 finally{inFlight=false;for(const id of ['siteSave','sitePublish','siteUnpublish'])$(id).disabled=false}
}
function choosePage(){
 if(!confirmLeave()){$('sitePage').value=activeChoice;return false}
 activeChoice=$('sitePage').value;
 selecting=true;$('siteMode').textContent='Door pagina bladeren';$('siteMode').setAttribute('aria-pressed','true');
 current=null;seen=[];store.clear();form.hidden=true;list.replaceChildren();
 preview.src=pageUrl[$('sitePage').value];
 tell('Kies een tekst in het voorbeeld.');
 loadCatalog();return true;
}
$('showSiteEditor').onclick=()=>{
 if(!host.canManage()||host.getTenant()?.slug!=='leif'){tell('Alleen de LEIF-beheerder kan teksten aanpassen.');return}
 $('peopleWorkspace').hidden=true;$('siteEditor').hidden=false;
 $('showSiteEditor').setAttribute('aria-pressed','true');$('showPeople').setAttribute('aria-pressed','false');
 if(!preview.getAttribute('src'))choosePage();else loadCatalog();
};
$('showPeople').onclick=()=>{
 if(!confirmLeave())return;
 $('siteEditor').hidden=true;$('peopleWorkspace').hidden=false;
 $('showSiteEditor').setAttribute('aria-pressed','false');$('showPeople').setAttribute('aria-pressed','true');
};
$('sitePage').onchange=()=>choosePage();
$('siteRefresh').onclick=()=>choosePage();
$('siteMode').onclick=()=>{
 selecting=!selecting;
 $('siteMode').textContent=selecting?'Door pagina bladeren':'Tekst selecteren';
 $('siteMode').setAttribute('aria-pressed',String(selecting));
 preview.contentWindow?.postMessage({source:'leif-editor',action:'edit',enabled:selecting},location.origin);
 tell(selecting?'Klik op de tekst die je wilt aanpassen.':'Je kunt nu door de voorbeeldpagina bladeren. Klik nogmaals om tekst te kiezen.');
};
$('siteSave').onclick=()=>change('site_save',{text:editor.value});
$('sitePublish').onclick=()=>{if(confirm('Deze tekst zichtbaar maken op LEIF?'))change('site_publish')};
$('siteUnpublish').onclick=()=>{if(confirm('De oorspronkelijke tekst weer zichtbaar maken?'))change('site_unpublish')};
editor.oninput=()=>{if(current)previewUpdate(current.key,editor.value)};
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==preview.contentWindow||e.data?.source!=='leif-tekst')return;
 if(e.data.page!==page())return;
 if(e.data.event==='catalog'){
  seen=e.data.fields?.filter(f=>typeof f.key==='string'&&/^[0-9a-f]{16}$/.test(f.key)&&typeof f.original==='string')||[];
  renderCatalog();
 }
 if(e.data.event==='selected'&&typeof e.data.key==='string')select({key:e.data.key,original:e.data.original});
});
window.addEventListener('beforeunload',e=>{if(!$('siteEditor').hidden&&dirty()){e.preventDefault();e.returnValue=''}});
})();