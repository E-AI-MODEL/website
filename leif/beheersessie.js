/* Gedeelde beheersessie. Alleen sessietokens worden bewaard, nooit wachtwoorden. */
(()=>{
'use strict';
const key='leif-admin-session-v1';
const endpoint='https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/leif-admin-console';
let memory=null,refreshing=null;
function read(){
 let available=false;
 for(const storage of [localStorage,sessionStorage]){
  try{const raw=storage.getItem(key);available=true;const value=JSON.parse(raw||'null');if(value?.refresh_token)return value}catch{}
 }
 return available?null:memory;
}
function save(value){
 memory={...value};
 if(value.expires_in&&!value.expires_at)memory.expires_at=Date.now()+Number(value.expires_in)*1000;
 try{localStorage.setItem(key,JSON.stringify(memory));sessionStorage.removeItem(key)}
 catch{try{sessionStorage.setItem(key,JSON.stringify(memory))}catch{}}
 return memory;
}
function clear(){memory=null;for(const storage of [localStorage,sessionStorage])try{storage.removeItem(key)}catch{}}
async function post(action,extra={},token){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},credentials:'omit',cache:'no-store',body:JSON.stringify({action,...extra})});
 const data=await response.json().catch(()=>({error:'server_unavailable'}));
 if(!response.ok){const error=new Error(data.error||'server_unavailable');error.status=response.status;throw error}
 return data;
}
async function refresh(failedToken){
 if(refreshing)return refreshing;
 const run=async()=>{
  const value=read();
  if(!value?.refresh_token){const error=new Error('not_authenticated');error.status=401;throw error}
  if(value.access_token&&(failedToken?value.access_token!==failedToken:value.expires_at>Date.now()+60000))return save(value);
  try{return save(await post('refresh',{refresh_token:value.refresh_token}))}
  catch(error){if(error.status===401||error.status===403)clear();throw error}
 };
 refreshing=(navigator.locks?navigator.locks.request('leif-admin-refresh',run):run()).finally(()=>refreshing=null);
 return refreshing;
}
async function request(action,extra={}){
 if(['login','request_magic_link','site_public'].includes(action))return post(action,extra);
 let value=read();
 if(!value?.access_token||!value.expires_at||value.expires_at<=Date.now()+60000)value=await refresh();
 try{return await post(action,extra,value.access_token)}catch(error){
  if(error.status!==401)throw error;
  const renewed=await refresh(value.access_token);
  return post(action,extra,renewed.access_token);
 }
}
async function resume(){
 const value=read();if(!value)return null;
 // Neem de nog open sessie uit de vorige versie over voordat een netwerkverzoek begint.
 save(value);
 const data=await request('session');
 return save({...read(),...data});
}
async function logout(){try{await request('logout')}finally{clear()}}
window.addEventListener('storage',event=>{if(event.key===key)memory=null});
window.LeifAdminSession={read,save,clear,request,resume,refresh,logout};
})();
