(function(){
'use strict';
const $=id=>document.getElementById(id);
const DATA='/topo/data/vo/';
const p=new URLSearchParams(location.search);
const NIVEAUS=[['onderbouw','Onderbouw','klas 1–3',[1,2,3]],['havo','Havo','klas 4–5',[4,5]],['vwo','Vwo','klas 4–6',[4,5,6]]];
const VORMEN=[['mix','Lekker afwisselen'],['shuffle','TOPO SHUFFLE!'],['point','Aanwijzen'],['choice','Kiezen'],['type','Typen'],['missing','Wat mist er?'],['zoom','Ingezoomd'],['quiz','Zonder kaart']];
const AANTAL=[['5','5'],['10','10'],['20','20'],['40','40'],['all','Alles']];
const HULP=[['help','Met hulp'],['none','Zonder hulp']];
const MANIER=[['normal','Gewoon oefenen'],['challenge','Extra uitdaging']];
const KAARTNAAM={wereld:'Wereldkaart',europa:'Europa',nederland:'Nederland','zuid-amerika':'Zuid-Amerika',brazilie:'Brazilië','mexico-vs':'Mexico – VS'};
let SETS=[],DOELEN={};
const state={niveau:p.get('niveau')||'onderbouw',leerjaar:p.get('leerjaar')||'alle',set:p.get('set')||'',mode:p.get('mode')||'mix',questions:p.get('questions')||'10',assist:p.get('assist')||'help',level:p.get('level')||'normal'};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
function setById(id){return SETS.find(s=>s.id===id)}
function visibleSets(){
 return SETS.filter(s=>s.niveau===state.niveau&&(state.leerjaar==='alle'||s.leerjaren.includes(+state.leerjaar)));
}
function vormBeschikbaar(s,v){
 if(!s)return false;
 if(!s.kaart)return v==='quiz';
 if(v==='mix'||v==='point'||v==='choice'||v==='type')return true;
 if(v==='quiz'||v==='shuffle')return Boolean(s.vragen);
 return s.vraagvormen.includes(v);
}
function pills(id,list,value,disabled){
 $(id).innerHTML=list.map(([v,l])=>{const off=disabled&&disabled(v);return '<button type="button" class="pill" data-group="'+id+'" data-value="'+v+'" aria-pressed="'+(value===v)+'"'+(off?' disabled aria-label="'+esc(l)+' (niet bij deze set)"':'')+'>'+esc(l)+'</button>'}).join('');
}
function spelUrl(){
 const q=new URLSearchParams({set:state.set,mode:state.mode,questions:state.questions});
 if(state.assist==='none')q.set('assist','none');if(state.level==='challenge')q.set('level','challenge');
 return '/topo/vo/spel/?'+q.toString();
}
function render(){
 const niv=NIVEAUS.find(n=>n[0]===state.niveau)||NIVEAUS[0];
 $('niveaus').innerHTML=NIVEAUS.map(n=>'<button class="zone" type="button" data-niveau="'+n[0]+'" aria-pressed="'+(n[0]===state.niveau)+'">'+n[1]+' <small>'+n[2]+'</small></button>').join('');
 pills('leerjaren',[['alle','Alle leerjaren'],...niv[3].map(j=>[String(j),'Klas '+j])],state.leerjaar);
 const list=visibleSets();
 if(!list.some(s=>s.id===state.set))state.set=list[0]?.id||'';
 $('sets').innerHTML=list.map(s=>'<button class="province set" type="button" data-set="'+s.id+'" aria-pressed="'+(s.id===state.set)+'"><span class="set-title">'+esc(s.titel)+'</span><span class="set-meta">'+(s.kaart?KAARTNAAM[s.kaart]+' · '+s.aantal+' plekken':s.aantal+' begrippen')+'</span>'+(s.id===state.set?'<span class="tick">✓</span>':'')+'</button>').join('')||'<p class="hint">Geen sets voor deze keuze.</p>';
 const s=setById(state.set);
 $('setNote').innerHTML=s?'<strong>Dit oefen je:</strong> '+s.doelen.map(c=>DOELEN[c]?'<span class="doel" title="'+esc(DOELEN[c].omschrijving)+'">'+esc(c)+' · '+esc(DOELEN[c].titel)+'</span>':'').join(' ')+(s.uitleg?'<br><small>'+esc(s.uitleg)+'</small>':''):'Kies een set.';
 if(s&&!vormBeschikbaar(s,state.mode))state.mode=s.kaart?'mix':'quiz';
 pills('vormen',VORMEN,state.mode,v=>!vormBeschikbaar(s,v));
 pills('aantal',AANTAL,state.questions);pills('hulp',HULP,state.assist);pills('manier',MANIER,state.level);
 $('vormNote').textContent=state.mode==='shuffle'?'Alles door elkaar: aanwijzen, kiezen, typen, ingezoomde plekken en vragen zonder kaart.':state.mode==='quiz'?'Vragen zonder kaart: feiten en begrippen bij deze set.':'Kies een vraagvorm, of laat de vragen afwisselen.';
 const vorm=VORMEN.find(v=>v[0]===state.mode)?.[1]||'';
 $('summary').innerHTML=s?esc(niv[1])+(state.leerjaar!=='alle'?' klas '+esc(state.leerjaar):'')+' · '+esc(s.titel)+'<small>'+esc(vorm)+' · '+(state.questions==='all'?'alle':state.questions)+' vragen'+(state.assist==='none'?' · zonder hulp':'')+(state.level==='challenge'?' · extra uitdaging':'')+'</small>':'Kies een set<small>Kies eerst een niveau en een set.</small>';
 $('go').href=s?spelUrl():'#';$('go').setAttribute('aria-disabled',String(!s));
 const q=new URLSearchParams({niveau:state.niveau,leerjaar:state.leerjaar,set:state.set,mode:state.mode,questions:state.questions,assist:state.assist,level:state.level});
 history.replaceState(null,'','?'+q.toString());
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.tab){
  document.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-selected',String(t===b)));
  document.querySelectorAll('.panel').forEach(pn=>pn.hidden=pn.id!=='panel-'+b.dataset.tab);return;
 }
 if(b.dataset.niveau){state.niveau=b.dataset.niveau;state.leerjaar='alle';state.set='';render();return}
 if(b.dataset.set){state.set=b.dataset.set;render();return}
 const g=b.dataset.group;
 if(g==='leerjaren')state.leerjaar=b.dataset.value;
 else if(g==='vormen')state.mode=b.dataset.value;
 else if(g==='aantal')state.questions=b.dataset.value;
 else if(g==='hulp')state.assist=b.dataset.value;
 else if(g==='manier')state.level=b.dataset.value;
 else return;
 render();
});
$('go').addEventListener('click',e=>{if($('go').getAttribute('aria-disabled')==='true'){e.preventDefault();$('notReady').hidden=false}});
$('closeModal').onclick=()=>{$('notReady').hidden=true};
$('copy').onclick=async()=>{
 const url=location.origin+spelUrl();
 try{await navigator.clipboard.writeText(url);$('copy').textContent='Gekopieerd!'}catch(err){window.prompt('Kopieer deze link:',url)}
 setTimeout(()=>{$('copy').textContent='Link voor de klas'},2200);
};
if(p.has('set'))$('privacyLayer').classList.add('hide');
$('openPrivacy').onclick=()=>$('privacyLayer').classList.remove('hide');
$('privacyOk').onclick=()=>$('privacyLayer').classList.add('hide');
function size(){document.documentElement.style.setProperty('--settings-h',Math.round(window.visualViewport?.height||window.innerHeight)+'px')}
window.visualViewport?.addEventListener('resize',size);window.addEventListener('resize',size);size();
Promise.all([fetch(DATA+'sets.json').then(r=>{if(!r.ok)throw Error('sets');return r.json()}),fetch(DATA+'doelen.json').then(r=>{if(!r.ok)throw Error('doelen');return r.json()})]).then(([sets,doelen])=>{
 SETS=sets.sets;for(const d of doelen.doelen)DOELEN[d.code]=d;
 const s=setById(state.set);if(s){state.niveau=s.niveau}
 render();
}).catch(err=>{console.error(err);$('sets').innerHTML='<p class="hint">De sets konden niet laden. Vernieuw de pagina.</p>'});
})();
