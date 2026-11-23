/* UI-only editing threshold. This does not protect repositories or source data. */
(function(){
'use strict';
let unlocked=false;
function request(){
 if(unlocked)return Promise.resolve(true);
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');
  dialog.className='card-edit-gate';
  dialog.setAttribute('aria-labelledby','cardEditGateTitle');
  dialog.innerHTML='<form method="dialog" class="card-edit-gate-form"><p class="card-gate-eyebrow">BEWERKMODUS</p><h2 id="cardEditGateTitle">Bewerken ontgrendelen</h2><p>Vul het wachtwoord in om gegevenskaarten te bewerken. Dit beschermt alleen de bediening, niet de brongegevens.</p><label for="cardGatePassword">Wachtwoord</label><input id="cardGatePassword" type="password" autocomplete="off" required><p class="card-gate-error" role="alert" hidden>Het wachtwoord klopt niet.</p><div class="card-gate-actions"><button type="button" data-cancel>Annuleren</button><button type="submit" data-unlock>Ontgrendelen</button></div></form>';
  document.body.append(dialog);
  const input=dialog.querySelector('input'),error=dialog.querySelector('.card-gate-error');
  let finished=false;
  const complete=ok=>{if(finished)return;finished=true;if(ok)unlocked=true;dialog.close();dialog.remove();resolve(ok)};
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>complete(false));
  dialog.addEventListener('cancel',e=>{e.preventDefault();complete(false)});
  dialog.querySelector('form').addEventListener('submit',e=>{
   e.preventDefault();
   if(input.value==='Emmauscollege'){complete(true);return}
   error.hidden=false;input.value='';input.focus();
  });
  dialog.showModal();input.focus();
 });
}
window.EmmausEditGate=Object.freeze({request});
})();