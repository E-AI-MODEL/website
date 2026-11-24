import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../leif/beheersessie.js',import.meta.url),'utf8'),key='leif-admin-session-v1';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
function client(local=storage(),session=storage(),fetcher=async()=>({ok:true})){
 const calls=[],context=vm.createContext({localStorage:local,sessionStorage:session,navigator:{},window:{addEventListener(){}},fetch:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push(body.action);const result=await fetcher(body,options);
  return {ok:!result.status||result.status<400,status:result.status||200,json:async()=>result};
 }});
 vm.runInContext(source,context);return {api:context.window.LeifAdminSession,calls,local,session};
}
test('open tabblad verhuist naar blijvende opslag en blijft in een nieuwe browserpagina bruikbaar',async()=>{
 const local=storage(),session=storage();session.setItem(key,JSON.stringify({access_token:'old',refresh_token:'refresh',expires_at:Date.now()+3600000}));
 const first=client(local,session,async()=>({ok:true,tenants:[{role:'manager'}],user_email:'test@example.invalid'}));
 await first.api.resume();assert.equal(session.getItem(key),null);assert(local.getItem(key));
 const next=client(local,storage());assert.equal(next.api.read().refresh_token,'refresh');
 next.api.clear();assert.equal(first.api.read(),null,'Uitloggen elders herstelt geen oud token uit het geheugen');
});
test('gelijktijdige aanvragen vernieuwen maar één keer',async()=>{
 const c=client(undefined,undefined,async(body)=>body.action==='refresh'?{access_token:'new',refresh_token:'next',expires_in:3600}:{ok:true});
 c.api.save({access_token:'expired',refresh_token:'old',expires_at:1});
 await Promise.all([c.api.request('list'),c.api.request('list_testers')]);
 assert.equal(c.calls.filter(x=>x==='refresh').length,1);assert.equal(c.api.read().refresh_token,'next');
});
test('verbindingsfout bewaart de sessie, geweigerde sessie ruimt beide opslagen op',async()=>{
 const offline=client(undefined,undefined,async()=>{throw Error('offline')});offline.api.save({refresh_token:'keep'});
 await assert.rejects(offline.api.resume());assert.equal(offline.api.read().refresh_token,'keep');
 const rejected=client(undefined,undefined,async()=>({status:401,error:'invalid_credentials'}));rejected.api.save({refresh_token:'expired'});
 await assert.rejects(rejected.api.resume());assert.equal(rejected.api.read(),null);
});
test('een 401 vernieuwt tokens en herhaalt de actie, expliciet uitloggen wist alles',async()=>{
 const c=client(undefined,undefined,async(body,options)=>body.action==='refresh'?{access_token:'new',refresh_token:'next',expires_in:3600}:options.headers.Authorization==='Bearer old'?{status:401,error:'expired'}:{ok:true});
 c.api.save({access_token:'old',refresh_token:'old-refresh',expires_at:Date.now()+3600000});
 await c.api.request('list');assert.deepEqual(c.calls,['list','refresh','list']);
 await c.api.logout();assert.equal(c.api.read(),null);
});
