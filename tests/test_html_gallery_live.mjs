// No production credentials, no real file IDs. All attempted mutations must be denied.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const BASE='https://eai-html-galerij.vis-c9d.workers.dev';
const id=Date.now().toString().padStart(13,'0')+'-'+randomUUID();
async function check(path,method,status,body){
 const r=await fetch(BASE+path,{method,body,headers:{Origin:BASE},redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,status,method+' '+path);
 if(status===401)assert.match(await r.text(),/Aanmelden vereist/);
 else assert.match(await r.text(),/Inloggen bij EAI Beheer/);
 console.log(method+' '+path.replace(id,'<synthetic-id>')+' → '+status);
}
await check('/auth/login','GET',200);
for(const path of ['/api/uploads','/api/admin/overview','/api/admin/files','/api/admin/deploy','/api/admin/audit','/view/'+id,'/admin-client.js'])await check(path,'GET',401);
await check('/api/uploads','POST',401,new FormData());
await check('/api/admin/uploads/'+id,'DELETE',401);
await check('/api/admin/files/'+id+'/restore','POST',401);
// Do not call global revoke-sessions endpoint against production, even anonymously.
console.log('Production anonymous access checks passed.');
