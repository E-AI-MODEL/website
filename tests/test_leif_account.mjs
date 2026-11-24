import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../leif/multitenant/edge-admin-console.ts',import.meta.url),'utf8');
const uid='00000000-0000-4000-8000-000000000001',tid='00000000-0000-4000-8000-000000000002';
const jwt='synthetic.'+'a'.repeat(120),tenant={id:tid,slug:'leif',name:'LEIF'};
function server({role='manager',auth=true,updateError=null}={}){
 let handler,item=null;const calls=[];
 const context=vm.createContext({Response,Request,crypto,TextEncoder,console,
  Deno:{env:{get:k=>({SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-secret',SUPABASE_ANON_KEY:'public-key'})[k]},serve:f=>handler=f},
  fetch:async(url,options={})=>{
   const body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});
   let value;
   if(url.includes('/auth/v1/user')){
    if(!auth)return Response.json({error:'invalid'},{status:401});
    if(options.method==='PUT'){
     if(updateError)return Response.json({code:updateError},{status:422});
     value={id:uid,email:'current@example.invalid',new_email:body.email||''};
    }else value={id:uid,email:'current@example.invalid'};
   }else if(url.includes('leif_admin_memberships?'))value=role?[{tenant_id:tid,role}]:[];
   else if(url.includes('leif_tenants?'))value=[tenant];
   else if(url.includes('leif_site_texts')){
    if(options.method==='POST'||options.method==='PATCH'){item={...(item||{}),...body};value=[item]}
    else if(url.includes('published_text=not.is.null'))value=item?[{field_key:item.field_key,published_text:item.published_text}]:[];
    else value=item?[item]:[];
   }else throw Error('Unexpected fetch '+url);
   return Response.json(value);
  }});
 vm.runInContext(source,context);
 const parse=vm.runInContext('(text)=>JSON.parse(text)',context);
 return {calls,run:async(input,token=jwt)=>{
  const request=new Request('https://synthetic.invalid/console',{method:'POST',headers:{'content-type':'application/json',origin:'https://eaimodel.nl',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(input)});
  request.json=async()=>parse(JSON.stringify(input));
  const response=await handler(request);return {status:response.status,data:await response.json()};
 }};
}
const account={action:'update_account',tenant_id:tid,email:'new@example.invalid',password:'synthetic-password-123'};
test('alleen een geldige LEIF-manager kan eigen inloggegevens wijzigen',async()=>{
 for(const options of [{auth:false},{role:null},{role:'editor'}]){
  const api=server(options),result=await api.run(account);
  assert([401,403].includes(result.status));assert(!api.calls.some(c=>c.options.method==='PUT'));
 }
 const api=server();assert.equal((await api.run(account,null)).status,401);assert.equal(api.calls.length,0);
});
test('wijzig dezelfde Auth-identiteit, behoud rollen en gebruik gewone e-mailbevestiging',async()=>{
 const api=server(),result=await api.run({...account,user_id:'another-user',role:'manager'});
 assert.equal(result.status,200);assert.equal(result.data.pending_email,account.email);
 const put=api.calls.find(c=>c.options.method==='PUT');
 assert(put.url.includes('/auth/v1/user?redirect_to='));assert(!put.url.includes('/admin/'));
 assert.equal(put.options.headers.Authorization,'Bearer '+jwt);assert.equal(put.options.headers.apikey,'public-key');
 assert.deepEqual(put.body,{email:account.email,password:account.password});
 assert(!api.calls.some(c=>c.url.includes('/rest/')&&c.options.method!=='GET'));
 assert(!JSON.stringify(result.data).includes(account.password));
});
test('verkeerde invoer en geweigerd wachtwoord leveren geen succesmelding op',async()=>{
 for(const patch of [{password:'kort'},{email:'geen-adres'},{tenant_id:uid}]){
  const api=server();assert.notEqual((await api.run({...account,...patch})).status,200);assert(!api.calls.some(c=>c.options.method==='PUT'));
 }
 const api=server({updateError:'weak_password'}),result=await api.run(account);
 assert.equal(result.status,400);assert.equal(result.data.error,'weak_password');
});
test('opslaan voor iedereen publiceert atomair en overleeft een nieuwe publieke aanvraag',async()=>{
 const api=server(),field='0123456789abcdef';
 const saved=await api.run({action:'site_apply',tenant_id:tid,page:'start',field_key:field,original:'Oud',text:'Nieuwe vaste tekst',revision:0});
 assert.equal(saved.status,200);assert.equal(saved.data.item.published_text,'Nieuwe vaste tekst');assert.equal(saved.data.item.revision,1);
 const fresh=await api.run({action:'site_public',page:'start'},null);
 assert.deepEqual(fresh.data.items,[{field_key:field,published_text:'Nieuwe vaste tekst'}]);
 const conflict=await api.run({action:'site_apply',tenant_id:tid,page:'start',field_key:field,text:'Overschrijven',revision:0});
 assert.equal(conflict.status,409);
 assert.equal((await api.run({action:'site_public',page:'start'},null)).data.items[0].published_text,'Nieuwe vaste tekst');
});
