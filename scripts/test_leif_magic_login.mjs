import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]||'site-build');
const origin='http://127.0.0.1:8772';
const server=spawn('python3',['-m','http.server','8772','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const tokens={access_token:'eyJ'+('a'.repeat(148)),refresh_token:'test-refresh-'+('z'.repeat(32))};
const membership={id:'00000000-0000-4000-8000-000000000001',slug:'leif',name:'LEIF',role:'manager'};
try{
 let ready=false;
 for(let i=0;i<60;i++){try{ready=(await fetch(origin+'/leif/')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,110))}
 assert(ready,'LEIF testsite niet bereikbaar');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[],requests=[],dialogs=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});
 let manager=true;
 await page.addInitScript(()=>{
  Object.defineProperty(window,'PublicKeyCredential',{configurable:true,value:function PublicKeyCredential(){}});
  const fake={id:'test-credential',type:'public-key',
   toJSON:()=>({id:'test-credential',type:'public-key',rawId:'dGVzdA',
    response:{clientDataJSON:'dGVzdA',authenticatorData:'dGVzdA',signature:'dGVzdA',attestationObject:'dGVzdA'}})};
  Object.defineProperty(navigator,'credentials',{configurable:true,value:{
   get:async()=>fake,create:async()=>fake
  }});
 });
 const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS',
  'access-control-allow-headers':'content-type,authorization','content-type':'application/json'};
 await page.route('**/functions/v1/leif-passkey',async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
  const input=JSON.parse(req.postData()||'{}');
  requests.push({action:input.action,auth:req.headers().authorization});
  let data={ok:true},status=200;
  if(input.action==='passkey_signin_start')data={ok:true,challenge_id:'challenge-0123456789',
   options:{challenge:'dGVzdA',allowCredentials:[],userVerification:'required'}};
  else if(input.action==='passkey_signin_finish'){
   if(!manager){status=403;data={error:'no_admin_access'}}
   else data={ok:true,...tokens};
  }else if(input.action==='passkey_register_start'){
   assert.equal(req.headers().authorization,'Bearer '+tokens.access_token);
   data={ok:true,challenge_id:'challenge-0123456789',
    options:{challenge:'dGVzdA',user:{id:'dXNlcg',name:'manager@example.invalid',displayName:'Manager'},
     rp:{name:'LEIF'},pubKeyCredParams:[{alg:-7,type:'public-key'}]}};
  }else if(input.action==='passkey_register_finish'){
   assert.equal(req.headers().authorization,'Bearer '+tokens.access_token);
  }else{status=400;data={error:'invalid_action'}}
  return route.fulfill({status,headers,body:JSON.stringify(data)});
 });
 await page.route('**/functions/v1/leif-admin-console',async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
  const input=JSON.parse(req.postData()||'{}');
  requests.push({action:input.action});
  let data={ok:true};
  if(input.action==='refresh')data={ok:true,...tokens,tenants:[membership],user_email:'manager@example.invalid'};
  else if(input.action==='list')data={ok:true,participants:[]};
  else if(input.action==='list_testers')data={ok:true,testers:[]};
  else if(input.action==='site_public')data={ok:true,items:[]};
  return route.fulfill({status:200,headers,body:JSON.stringify(data)});
 });
 await page.goto(origin+'/leif/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#accessPassword').count(),1);
 await page.locator('#accessPassword').fill('VIS');
 await page.locator('#leifSignIn').click();
 try{
  await page.waitForURL('**/leif/beheer/',{timeout:10000});
 }catch(e){
  const visibleError=await page.locator('#accessError').innerText().catch(()=>'?');
  const visibleNotice=await page.locator('#accessNotice').innerText().catch(()=>'?');
  throw new Error('LEIF-aanmelding bleef op '+page.url()+
   '; fout: '+visibleError+'; melding: '+visibleNotice+
   '; aanvragen: '+JSON.stringify(requests)+'; browserfouten: '+JSON.stringify(errors),{cause:e});
 }
 assert.equal(await page.locator('#workspace:visible').count(),1,'Beheer opent met geldige passkey');
 assert(requests.some(r=>r.action==='passkey_signin_start'),'Passkey start ontbreekt');
 assert(requests.some(r=>r.action==='passkey_signin_finish'),'Passkey verificatie ontbreekt');
 assert(!requests.some(r=>r.action==='request_magic_link'),'VIS mag geen e-mail versturen');
 await page.locator('#setupPasskey:visible').click();
 for(let i=0;i<60&&!requests.some(r=>r.action==='passkey_register_finish');i++)await new Promise(ok=>setTimeout(ok,50));
 assert(requests.some(r=>r.action==='passkey_register_start'),'Registratie start ontbreekt');
 assert(requests.some(r=>r.action==='passkey_register_finish'),'Registratie verificatie ontbreekt');
 assert(dialogs.some(t=>t.includes('Face ID is gekoppeld')));
 await page.evaluate(()=>sessionStorage.removeItem('leif-admin-session-v1'));
 manager=false;
 await page.goto(origin+'/leif/?beheer=1',{waitUntil:'domcontentloaded'});
 await page.locator('#leifSignIn').click();
 await page.locator('#accessError:visible').waitFor({timeout:10000});
 assert.match(await page.locator('#accessError').innerText(),/geen toegang/);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('leif-admin-session-v1')),null);
 assert.equal(errors.length,0,'Geen JavaScript-fouten: '+errors.join('; '));
 console.log('LEIF VIS: WebAuthn-aanmelding, registratie vanuit beheersessie, managercontrole, geen e-mail.');
}finally{if(browser)await browser.close();server.kill()}
