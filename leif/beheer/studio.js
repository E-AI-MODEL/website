(()=>{'use strict';
const $=id=>document.getElementById(id);
const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const typeNames={text:'Tekst',heading:'Kop',spotify:'Spotify'};
let participant=null,tenantId='',blocks=[],activeId=null,dirty=false,busy=false,published=[],revision=0;
const current=()=>blocks.find(b=>b.id===activeId);
const songInfo=url=>{const m=String(url||'').match(/^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]{22})(?:\?[^#\s]*)?$/);return m?{type:m[1],id:m[2]}:null};
const safeCopy=value=>JSON.parse(JSON.stringify(value));
function notice(message,error=false){const e=$('studioStatus');e.textContent=message;e.classList.toggle('error',error)}
function freshId(){return 'b'+Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>n.toString(16).padStart(2,'0')).join('')}
function canLeave(){if(busy){notice('Bewaren is nog bezig. Rond dit eerst af.',true);return false}return !dirty||confirm('Je hebt nog niet opgeslagen persoonlijke onderdelen. Wil je deze wijzigingen verliezen?')}
function loaded({participant:person,document:doc,tenant_id}){
 participant=person;tenantId=tenant_id;revision=doc.revision;
 const state=doc.personal_texts||{};
 blocks=safeCopy(Array.isArray(state.blocks_draft)?state.blocks_draft:(Array.isArray(state.blocks_published)?state.blocks_published:[]));
 published=safeCopy(Array.isArray(state.blocks_published)?state.blocks_published:[]);
 activeId=blocks[0]?.id||null;dirty=false;busy=false;
 $('studioOwner').textContent=person.display_name||'Deelnemer';
 notice('');render();
}
function markDirty(){dirty=true;notice('Nog niet opgeslagen');renderList();renderPreview()}
function add(type){
 if(!participant||blocks.length>=24){notice('Maximaal 24 onderdelen per deelnemer.',true);return}
 const block={id:freshId(),type,title:type==='spotify'?'Mijn muziek':type==='heading'?'Tussenkop':'Nieuw onderdeel',text:'',visible:true};
 if(type==='spotify')block.spotify_url='';
 blocks.push(block);activeId=block.id;markDirty();renderEditor();
}
function move(id,dir){const i=blocks.findIndex(b=>b.id===id),target=i+dir;if(i<0||target<0||target>=blocks.length)return;
 [blocks[i],blocks[target]]=[blocks[target],blocks[i]];markDirty()}
function remove(id){const part=blocks.find(b=>b.id===id);if(!part||!confirm('Onderdeel "'+part.title+'" uit dit concept verwijderen?'))return;
 blocks=blocks.filter(b=>b.id!==id);if(activeId===id)activeId=blocks[0]?.id||null;markDirty();renderEditor()}
function mini(label,description,action){const b=mk('button','studio-mini',label);b.type='button';b.title=description;b.setAttribute('aria-label',description);b.onclick=action;return b}
function renderList(){
 const list=$('studioBlockList');list.replaceChildren();
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i],item=mk('div','studio-item');item.dataset.active=String(block.id===activeId);
  const name=mk('button','studio-item-name',(block.visible?'':'◌  ')+(block.title||typeNames[block.type]));name.type='button';
  name.onclick=()=>{activeId=block.id;renderList();renderEditor()};
  const actions=mk('div','studio-actions');
  actions.append(mini('↑','Omhoog',()=>move(block.id,-1)),mini('↓','Omlaag',()=>move(block.id,1)),
   mini(block.visible?'◉':'○',block.visible?'Verbergen':'Tonen',()=>{block.visible=!block.visible;markDirty()}),
   mini('×','Verwijderen',()=>remove(block.id)));
  item.append(name,actions);list.append(item);
 }
 $('studioCount').textContent=blocks.length+' / 24';
}
function renderEditor(){
 const area=$('studioEditor');area.replaceChildren();const b=current();
 if(!participant){area.append(mk('p','studio-muted','Kies een deelnemer.'));return}
 if(!b){area.append(mk('p','studio-muted','Voeg links een onderdeel toe.'));return}
 const titleLabel=mk('label',null,'Titel'),title=mk('input');title.maxLength=120;title.value=b.title;
 title.oninput=()=>{b.title=title.value;markDirty()};area.append(titleLabel,title);
 {
  const textLabel=mk('label',null,b.type==='spotify'?'Toelichting (optioneel)':'Tekst');
  const content=mk('textarea');content.maxLength=12000;content.rows=8;content.value=b.text;
  content.oninput=()=>{b.text=content.value;markDirty()};area.append(textLabel,content);
 }
 if(b.type==='spotify'){
  const label=mk('label',null,'Spotify-link');const input=mk('input');input.type='url';input.placeholder='https://open.spotify.com/track/...';input.value=b.spotify_url||'';
  input.oninput=()=>{b.spotify_url=input.value.trim();markDirty();$('studioLinkHint').textContent=songInfo(b.spotify_url)?'Spotify-link herkend.':'Plak een track, album of afspeellijst.'};
  area.append(label,input);
  const hint=mk('p','studio-muted',songInfo(b.spotify_url)?'Spotify-link herkend.':'Plak een track, album of afspeellijst.');hint.id='studioLinkHint';area.append(hint);
 }
 const checkLabel=mk('label','studio-check');const visible=mk('input');visible.type='checkbox';visible.checked=b.visible;
 visible.onchange=()=>{b.visible=visible.checked;markDirty()};
 checkLabel.append(visible,mk('span',null,'Zichtbaar na publicatie'));area.append(checkLabel);
}
function renderPreview(){
 const stage=$('studioPreview');stage.replaceChildren();
 $('studioPreviewBadge').textContent=participant?'Concept voor '+(participant.display_name||'deelnemer'):'Nog geen deelnemer';
 const visible=blocks.filter(b=>b.visible);
 if(!visible.length){stage.append(mk('p','studio-muted','Geen zichtbare onderdelen in dit concept.'));return}
 for(const block of visible){
  const card=mk('article','studio-stage-card');card.append(mk('h4',null,block.title||typeNames[block.type]));
  if(block.text)card.append(mk('p',null,block.text));
  if(block.type==='spotify'){
   const info=songInfo(block.spotify_url);
   card.append(mk('div','studio-music',info?'♫  Spotify '+(info.type==='track'?'nummer':info.type==='album'?'album':'afspeellijst')+' · speler laadt pas na een klik':'♫  Nog geen geldige Spotify-link'));
  }
  stage.append(card);
 }
}
function render(){renderList();renderEditor();renderPreview()}
function updateDocument(result){revision=result.revision;published=safeCopy(result.personal_texts?.blocks_published||[]);
 const selection=window.LeifBeheer?.getSelection?.();if(selection?.documentState){selection.documentState.revision=result.revision;selection.documentState.personal_texts=result.personal_texts;}
}
async function operation(action,payload={}){
 if(!participant||busy)return false;
 const snapshot=action==='save_blocks'?JSON.stringify(payload.blocks):null;
 busy=true;const controls=$('blocksTab').querySelectorAll('button,input,textarea');controls.forEach(b=>b.disabled=true);notice('Opslaan...');
 try{
  const result=await window.LeifBeheer.request(participant.legacy?'legacy_'+action:action,{tenant_id:tenantId,...(participant.legacy?{tester_id:participant.id}:{participant_id:participant.id}),revision,...payload});
  updateDocument(result);
  if(action==='save_blocks')dirty=JSON.stringify(blocks)!==snapshot;
  notice(dirty?'Nieuwere wijzigingen zijn nog niet opgeslagen.':action==='save_blocks'?'Concept bewaard.':action==='publish_blocks'?'Onderdelen gepubliceerd voor deze deelnemer.':'Publicatie van onderdelen ingetrokken.');
  return true;
 }catch(error){
  notice(error.status===409?'Dit dossier is intussen gewijzigd. Kopieer je wijzigingen voordat je opnieuw laadt.':'Bewaren is niet gelukt. Je wijzigingen staan nog op het scherm.',true);
  return false;
 }finally{busy=false;controls.forEach(b=>b.disabled=false)}
}
async function save(){
 if(blocks.some(b=>b.type==='spotify'&&!songInfo(b.spotify_url))){notice('Controleer de Spotify-links. Gebruik een link naar een nummer, album of afspeellijst.',true);return false}
 if(blocks.length>24){notice('Er kunnen maximaal 24 onderdelen worden opgeslagen.',true);return false}
 return operation('save_blocks',{blocks:safeCopy(blocks)});
}
async function publish(){
 if(dirty&&!(await save()))return;
 if(!confirm('Publiceer de zichtbare onderdelen alleen voor '+(participant?.display_name||'deze deelnemer')+'?'))return;
 const ok=await operation('publish_blocks');if(ok)renderPreview();
}
async function unpublish(){
 if(!confirm('Alle gepubliceerde losse onderdelen voor deze deelnemer verbergen? Het concept blijft bewaard.'))return;
 await operation('unpublish_blocks');
}
document.querySelectorAll('[data-studio-add]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.studioAdd)));
$('studioSave').onclick=save;$('studioPublish').onclick=publish;$('studioUnpublish').onclick=unpublish;
window.LeifStudio={load:loaded,canLeave,render};
const selection=window.LeifBeheer?.getSelection?.();
if(selection?.selected&&selection.documentState)loaded({participant:selection.selected,document:selection.documentState,tenant_id:selection.tenant_id});
})();