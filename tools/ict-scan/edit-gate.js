/* The portal session is verified on the server. No GitHub credential reaches JS. */
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
function request(){
 if(pending)return pending;
 pending=(async()=>{
   try{
     const result=await exchange('status');
     if(result.unlocked && result.csrf){csrf=result.csrf;return true;}
   }catch(error){window.alert(error.message);return false;}
   csrf=null;
   if(window.confirm('Open EAI Beheer en kies “ICT-scan bewerken” om wijzigingen te maken.'))location.assign('https://eai-html-galerij.vis-c9d.workers.dev/');
   return false;
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
