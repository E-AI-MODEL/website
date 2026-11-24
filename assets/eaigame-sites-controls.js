/* EAIgame Sites: extra bediening, zonder extra schermvullende UI. */
(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const KEY='eaigame-voorkeuren-v1',DEFAULT={contrast:false,rust:false,groot:false};
function load(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(KEY))}}catch{return {...DEFAULT}}}
let pref=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(pref))}catch{}}
function apply(){
 document.body.classList.toggle('eaigame-contrast',!!pref.contrast);
 document.body.classList.toggle('eaigame-rust',!!pref.rust);
 document.body.classList.toggle('eaigame-groot',!!pref.groot);
 $$('[data-game-pref]').forEach(b=>b.setAttribute('aria-pressed',String(!!pref[b.dataset.gamePref])));
}
const host=$('.sidebar');if(!host)return;
const panel=document.createElement('details');panel.id='extra-opts';panel.className='eaigame-extra';
panel.innerHTML='<summary>Meer spelopties</summary><div class="eaigame-extra-buttons"></div>';
host.appendChild(panel);const controls=panel.querySelector('.eaigame-extra-buttons');
for(const [id,label] of [['contrast','Meer contrast'],['rust','Rustiger bord'],['groot','Grotere tekst'],['volledig','Volledig scherm'],['oefenen','Oefenen zonder worp'],['afdrukken','Bord afdrukken']]){
 const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.dataset.option=id;
 if(Object.hasOwn(DEFAULT,id))b.dataset.gamePref=id;
 controls.appendChild(b);
}
controls.addEventListener('click',async event=>{
 const b=event.target.closest('[data-option]');if(!b)return;const action=b.dataset.option;
 if(Object.hasOwn(DEFAULT,action)){pref[action]=!pref[action];save();apply();return}
 if(action==='afdrukken'){window.print();return}
 if(action==='volledig'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{alert('Volledig scherm is hier niet beschikbaar.')}return}
 if(action==='oefenen'){
  if(state.phase!=='ready'&&state.phase!=='landed'){alert('Rond eerst de lopende vraag af.');return}
  showInfo('OEFENEN ZONDER WORP','<h2>Kies een kenniswijk</h2><p class="muted">Een vraag zonder dobbelsteen. De pion blijft staan.</p><div id="eaigame-oefenopties" class="eaigame-oefenopties"></div>');
  const root=$('#eaigame-oefenopties');if(!root)return;
  for(const [key,name] of [['natuur','Natuur'],['wereld','Wereld'],['taal','Taal'],['rekenen','Rekenen']]){
   const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent=name;
   btn.addEventListener('click',()=>{$('#infoDialog').close();ask(key)});
   root.appendChild(btn);
  }
 }
});
apply();
})();