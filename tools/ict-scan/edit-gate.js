/* The password is verified on the server. No GitHub credential reaches JS. */
(function(){
'use strict';
let csrf=null,pending=null;
async function exchange(action,payload={}){
 const headers={'Content-Type':'application/json'};
 if(csrf)headers['X-ICT-CSRF']=csrf;
 let response,body;
 try{
  response=await fetch('./edit-api.php',{method:'POST',headers,credentials:'same-origin',redirect:'error',cache:'no-store',body:JSON.stringify({action,...payload})});
  body=await response.json();
 }catch(_){throw Error('Opslaan op GitHub is niet beschikbaar op deze website.');}
 if(!response.ok){
  if(response.status===401)csrf=null;
  throw Error(String(body?.error||'Bewerkservice tijdelijk niet beschikbaar.'));
 }
 return body;
}
async function promptPassword(statusError){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');
  dialog.className='card-edit-gate';dialog.setAttribute('aria-labelledby','cardEditGateTitle');
  dialog.innerHTML='<form method="dialog" class="card-edit-gate-form"><p class="card-gate-eyebrow">BEWERKMODUS</p><h2 id="cardEditGateTitle">Bewerken ontgrendelen</h2><p>Vul eenmaal je bewerkwachtwoord in. Opslaan gaat via de server naar GitHub. Voeg geen persoonsgegevens of toegangssleutels toe.</p><label for="cardGatePassword">Wachtwoord</label><input id="cardGatePassword" type="password" autocomplete="current-password" required><p class="card-gate-error" role="alert" hidden></p><div class="card-gate-actions"><button type="button" data-cancel>Annuleren</button><button type="submit" data-unlock>Ontgrendelen</button></div></form>';
  document.body.append(dialog);
  const input=dialog.querySelector('input'),error=dialog.querySelector('.card-gate-error'),button=dialog.querySelector('[data-unlock]');
  let finished=false;
  const complete=ok=>{if(finished)return;finished=true;input.value='';dialog.close();dialog.remove();resolve(ok);};
  if(statusError){error.hidden=false;error.textContent=statusError;}
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>complete(false));
  dialog.addEventListener('cancel',e=>{e.preventDefault();complete(false);});
  dialog.querySelector('form').addEventListener('submit',async e=>{
   e.preventDefault();if(button.disabled)return;
   const password=input.value;input.value='';button.disabled=true;error.hidden=true;
   try{
    const result=await exchange('login',{password});
    if(!result.unlocked||typeof result.csrf!=='string'||!result.csrf)throw Error('Aanmelden mislukt.');
    if(finished)return;
    csrf=result.csrf;complete(true);
   }catch(failure){if(!finished){error.textContent=failure.message;error.hidden=false;input.focus();}}
   finally{button.disabled=false;}
  });
  dialog.showModal();input.focus();
 });
}
function request(){
 if(pending)return pending;
 pending=(async()=>{
  let statusError='';
  try{
   const status=await exchange('status');
   if(status.unlocked&&typeof status.csrf==='string'&&status.csrf){csrf=status.csrf;return true;}
  }catch(e){statusError=e.message;}
  csrf=null;return promptPassword(statusError);
 })().finally(()=>{pending=null;});
 return pending;
}
async function githubRequest(url,method,payload){
 if(!csrf)throw Error('Bewerksessie verlopen. Ontgrendel opnieuw.');
 const result=await exchange('github',{url,method,...(payload===undefined?{}:{payload})});
 return result.data;
}
async function lock(){try{if(csrf)await exchange('logout');}finally{csrf=null;}}
window.EmmausEditGate=Object.freeze({request,githubRequest,lock});
})();
