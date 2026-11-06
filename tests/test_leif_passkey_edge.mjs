import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../leif/multitenant/edge-passkey.ts',import.meta.url),'utf8');
const origin='https://eaimodel.nl';
function makeHandler(){
 let handler,authorized=true;
 const calls=[];
 const fetch=async(url,options={})=>{
  calls.push({url:String(url),authorization:options.headers?.Authorization||''});
  if(String(url).endsWith('/functions/v1/leif-admin-console')){
   return new Response(JSON.stringify({ok:true,tenants:authorized?
    [{slug:'leif',role:'manager'}]:[{slug:'leif',role:'viewer'}]}),
    {status:200,headers:{'Content-Type':'application/json'}});
  }
  if(String(url).endsWith('/passkeys/authentication/options')||
     String(url).endsWith('/passkeys/registration/options')){
   return new Response(JSON.stringify({challenge_id:'challenge-123456789',options:{challenge:'dGVzdA'}}),
    {status:200,headers:{'Content-Type':'application/json'}});
  }
  if(String(url).endsWith('/passkeys/authentication/verify')){
   return new Response(JSON.stringify({access_token:'a-test-token',refresh_token:'a-refresh-token'}),
    {status:200,headers:{'Content-Type':'application/json'}});
  }
  if(String(url).endsWith('/passkeys/registration/verify')){
   return new Response(JSON.stringify({id:'registered-key'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw Error('Unexpected network request: '+url);
 };
 vm.runInNewContext(source,{
  Deno:{env:{get:(k)=>({'SUPABASE_URL':'https://example.supabase.co','SUPABASE_ANON_KEY':'public-test-key'})[k]||''},
   serve:(fn)=>{handler=fn}},
  Response,fetch
 },{timeout:2000});
 async function request(action,token,siteOrigin=origin,extra={}){
  const headers={'Content-Type':'application/json','Origin':siteOrigin};
  if(token)headers.Authorization='Bearer '+token;
  const response=await handler(new Request('https://example.supabase.co/functions/v1/leif-passkey',{
   method:'POST',headers,body:JSON.stringify({action,...extra})
  }));
  return {status:response.status,data:await response.json()};
 }
 return {request,calls,setAuthorized:(v)=>{authorized=v}};
}
test('passkey: weigert niet-toegestane herkomst en ongeauthenticeerde registratie',async()=>{
 const x=makeHandler();
 assert.equal((await x.request('passkey_signin_start',null,'https://outside.example')).status,403);
 assert.equal((await x.request('passkey_register_start')).status,401);
 assert.equal(x.calls.length,0);
});
test('passkey: registratie vereist op de server een geldige LEIF-managerrol',async()=>{
 const x=makeHandler();
 x.setAuthorized(false);
 assert.equal((await x.request('passkey_register_start','fake-user-token')).status,403);
 x.setAuthorized(true);
 const result=await x.request('passkey_register_start','fake-user-token');
 assert.equal(result.status,200);
 assert.equal(result.data.challenge_id,'challenge-123456789');
 assert(x.calls.some(c=>c.url.includes('/auth/v1/passkeys/registration/options')));
});
test('passkey: zonder managerrol wordt geen inlogsessie teruggegeven',async()=>{
 const x=makeHandler();
 const start=await x.request('passkey_signin_start');
 assert.equal(start.status,200);
 const options={challenge_id:'challenge-123456789',credential:{id:'test-passkey'}};
 x.setAuthorized(false);
 const denied=await x.request('passkey_signin_finish',null,origin,options);
 assert.equal(denied.status,403);
 assert.equal(denied.data.access_token,undefined);
 x.setAuthorized(true);
 const granted=await x.request('passkey_signin_finish',null,origin,options);
 assert.equal(granted.status,200);
 assert.equal(granted.data.access_token,'a-test-token');
});
