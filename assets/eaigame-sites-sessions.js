/* EAIgame: meerdere lokale spellen, spelbestanden en antwoorden exporteren. */
(function(){
'use strict';
const $=s=>document.querySelector(s),SLOTS='eaigame-spellen-v1',ANSWERS='eaigame-antwoorden-v1';
function read(key){try{const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:[]}catch{return []}}
function saveSlots(slots){try{localStorage.setItem(SLOTS,JSON.stringify(slots));return true}catch{return false}}
function exportFile(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function tell(value){const x=$('#toast');if(x){x.textContent=value;x.classList.add('visible');setTimeout(()=>x.classList.remove('visible'),2200)}}
const root=$('#extra-opts .eaigame-extra-buttons');if(!root)return;
const actions=[['answers','Antwoorden downloaden'],['save','Spel bewaren'],['open','Bewaard spel openen'],['export','Spelbestand downloaden'],['import','Spelbestand openen']];
for(const [key,title] of actions){
 const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.sessionAction=key;b.textContent=title;root.appendChild(b);
}
const input=document.createElement('input');input.type='file';input.id='eaigame-import-game';input.accept='.json,application/json';input.hidden=true;root.appendChild(input);
root.addEventListener('click',e=>{
 const action=e.target.closest('[data-session-action]')?.dataset.sessionAction;if(!action)return;
 if(action==='answers'){exportFile('eaigame-antwoorden.json',{product:'EAIgame',type:'answer-log',exportedAt:new Date().toISOString(),entries:read(ANSWERS)});return}
 if(action==='save'){
  if(state.phase==='moving'){tell('Rond eerst de worp af.');return}
  const slots=read(SLOTS);const date=new Intl.DateTimeFormat('nl-NL',{dateStyle:'short',timeStyle:'short'}).format(new Date());
  slots.unshift({name:'Expeditie '+date,created:new Date().toISOString(),game:structuredClone(state)});slots.splice(5);
  tell(saveSlots(slots)?'Spel in deze browser bewaard.':'Bewaren niet gelukt.');return;
 }
 if(action==='open'){
  showInfo('BEWAARDE SPELLEN','<h2>Verder spelen</h2><p class="muted">Maximaal vijf spellen in deze browser. Kies een spel om verder te gaan.</p><div id="eaigame-saved-games"></div>');
  const box=$('#eaigame-saved-games');const slots=read(SLOTS);
  if(!slots.length){box.textContent='Er zijn nog geen bewaarde spellen.';return}
  for(const slot of slots){
   if(!validState(slot.game))continue;
   const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=slot.name;
   b.addEventListener('click',()=>{if(!confirm('Huidig spel vervangen?'))return;state=structuredClone(slot.game);save();location.reload()});
   box.appendChild(b);
  }
  return;
 }
 if(action==='export'){exportFile('eaigame-spelbestand.json',{product:'EAIgame',format:1,exportedAt:new Date().toISOString(),game:state});return}
 if(action==='import')input.click();
});
input.addEventListener('change',async()=>{
 const file=input.files?.[0];input.value='';if(!file)return;
 try{
  if(file.size>200000)throw Error('Bestand is te groot.');
  const parsed=JSON.parse(await file.text());
  if(parsed.product!=='EAIgame'||parsed.format!==1||!validState(parsed.game))throw Error('Geen geldig EAIgame-spelbestand.');
  if(!confirm('Huidige spel vervangen door dit bestand?'))return;
  state=parsed.game;save();location.reload();
 }catch(err){tell('Import niet gelukt: '+err.message)}
});
})();