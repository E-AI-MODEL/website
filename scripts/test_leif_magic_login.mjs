import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]||'site-build');
const origin='http://127.0.0.1:8772';
const server=spawn('python3',['-m','http.server','8772','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const tokens={access:'eyJ'+('a'.repeat(148)),refresh:'test-refresh-'+('z'.repeat(32))};
const membership={id:'00000000-0000-4000-8000-000000000001',slug:'leif',name:'LEIF',role:'manager'};
try{
 let ready=false;
 for(let i=0;i<60;i++){try{ready=(await fetch(origin+'/leif/')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,110))}
 assert(ready,'LEIF testsite niet bereikbaar');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 let manager=true;
 await page.route('**/functions/v1/leif-admin-console',async route=>{
  const request=route.request(),headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type,authorization','content-type':'application/json'};
  if(request.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
  const input=JSON.parse(request.postData()||'{}');
  requests.push({action:input.action,email:input.email,hasPassword:typeof input.password==='string',auth:request.headers().authorization});
  let data={ok:true},status=200;
  if(input.action==='login'){
   if(input.email!=='vis@emmauscollege.nl'||input.password!=='test-admin-password'){
    data={error:'invalid_credentials'};status=401;
   }else if(!manager){
    data={error:'no_admin_access'};status=403;
   }else data={ok:true,access_token:tokens.access,refresh_token:tokens.refresh,tenants:[membership],user_email:input.email};
  }
  else if(input.action==='session')data={ok:true,tenants:manager?[membership]:[],user_email:'test@example.invalid'};
  else if(input.action==='refresh')data={ok:true,access_token:tokens.access,refresh_token:tokens.refresh,tenants:[membership],user_email:'test@example.invalid'};
  else if(input.action==='list')data={ok:true,participants:[]};
  else if(input.action==='list_testers')data={ok:true,testers:[]};
  else if(input.action==='site_public')data={ok:true,items:[]};
  return route.fulfill({status,headers,body:JSON.stringify(data)});
 });
 await page.goto(origin+'/leif/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#accessPassword').count(),1,'Een gemeenschappelijk toegangsscherm');
 assert.equal(await page.locator('#adminEmail').count(),0,'Geen vrij e-mailveld');
 assert.equal(await page.locator('#adminPassword:visible').count(),0,'Beheerwachtwoord aanvankelijk verborgen');
 await page.locator('#accessPassword').fill('VIS');
 await page.locator('#leifSignIn').click();
 assert.equal(await page.locator('#adminPassword:visible').count(),1,'VIS toont beheerwachtwoord');
 assert.equal(await page.locator('#accessPassword:visible').count(),0,'Toegangscodeveld verdwijnt na VIS');
 assert.equal(requests.filter(x=>x.action==='request_magic_link').length,0,'Geen e-mailaanvraag');
 assert.equal(requests.filter(x=>x.action==='login').length,0,'Geen aanmelding zonder wachtwoord');
 await page.locator('#adminPassword').fill('incorrect');
 await page.locator('#leifSignIn').click();
 await page.locator('#accessError:visible').waitFor({timeout:10000});
 assert.match(await page.locator('#accessError').innerText(),/Inloggen mislukt/);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('leif-admin-session-v1')),null);
 await page.locator('#adminPassword').fill('test-admin-password');
 await page.locator('#leifSignIn').click();
 await page.waitForURL('**/leif/beheer/',{timeout:10000});
 assert.equal(await page.locator('#workspace:visible').count(),1,'Geldige beheerder opent workspace');
 assert.equal(requests.filter(x=>x.action==='request_magic_link').length,0,'Nooit een e-mailverzoek');
 assert(requests.some(x=>x.action==='login'&&x.email==='vis@emmauscollege.nl'&&x.hasPassword));
 await page.evaluate(()=>sessionStorage.removeItem('leif-admin-session-v1'));
 manager=false;
 await page.goto(origin+'/leif/?beheer=1',{waitUntil:'domcontentloaded'});
 await page.locator('#leifSignIn').click();
 await page.locator('#adminPassword').fill('test-admin-password');
 await page.locator('#leifSignIn').click();
 await page.locator('#accessError:visible').waitFor({timeout:10000});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('leif-admin-session-v1')),null,'Zonder managerrechten geen sessie');
 assert.equal(errors.length,0,'Geen JavaScript-fouten: '+errors.join('; '));
 console.log('LEIF VIS: direct wachtwoord, geen e-mail, managercontrole en foutafhandeling.');
}finally{if(browser)await browser.close();server.kill()}
