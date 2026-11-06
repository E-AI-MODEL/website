import { chromium } from 'playwright';
import { get as httpGet } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync,readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'site-build'),base='http://127.0.0.1:8769';
const server=spawn('python3',['-m','http.server','8769','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
try {
 let ready=false;
 for(let i=0;i<60;i++){try{ready=await new Promise(resolve=>{const r=httpGet(base+'/leif/',response=>{response.resume();resolve(response.statusCode===200)});r.on('error',()=>resolve(false))})}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100))}
 assert(ready,'Previewserver niet bereikbaar');
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1180,height:850}});
 const errors=[],store=new Map();let changedSource=false;
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(()=>{
  if(window===window.top&&location.pathname==='/leif/beheer/')
   sessionStorage.setItem('leif-admin-session-v1',JSON.stringify({refresh_token:'proef-refresh'}));
 });
 await page.route('**/*',async route=>{
  const req=route.request(),url=req.url();
  if(changedSource&&new URL(url).origin===base&&new URL(url).pathname==='/leif/')return route.fulfill({contentType:'text/html',body:readFileSync(resolve(root,'leif/index.html'),'utf8').replace('Welkom bij LEIF','Nieuwe standaard uit de bron')});
  if(url.startsWith(base))return route.continue();
  if(url==='https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/leif-admin-console'){
   const headers={'access-control-allow-origin':base,'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
   const input=JSON.parse(req.postData()||'{}'),pageName=input.page||'start',key=pageName+':'+input.field_key;
   let response={ok:true};
   if(input.action==='refresh')response={ok:true,access_token:'voorbeeldtoken',refresh_token:'proef-refresh',user_email:'Voorbeeldbeheerder',tenants:[{id:'00000000-0000-4000-8000-000000000001',slug:'leif',name:'LEIF',role:'manager'}]};
   else if(input.action==='list')response={ok:true,participants:[],role:'manager'};
   else if(input.action==='list_testers')response={ok:true,testers:[]};
   else if(input.action==='site_list')response={ok:true,items:[...store.values()].filter(x=>x.page===pageName)};
   else if(input.action==='site_public')response={ok:true,items:[...store.values()].filter(x=>x.page===pageName&&x.published_text!==null).map(x=>({field_key:x.field_key,published_text:x.published_text}))};
   else if(input.action==='site_history')response={ok:true,items:[]};
   else if(['site_save','site_apply','site_publish','site_unpublish','site_restore'].includes(input.action)){
    const prev=store.get(key);
    assert.equal(input.revision,prev?.revision||0,'Revisie moet kloppen');
    const item={page:pageName,field_key:input.field_key,original_text:prev?.original_text||input.original,
      draft_text:['site_save','site_apply'].includes(input.action)?input.text:prev?.draft_text,
      published_text:input.action==='site_apply'?input.text:input.action==='site_publish'?prev?.draft_text:input.action==='site_unpublish'?null:prev?.published_text??null,
      revision:(prev?.revision||0)+1,published_at:['site_apply','site_publish'].includes(input.action)?new Date().toISOString():null};
    store.set(key,item);response={ok:true,item};
   }
   return route.fulfill({status:200,headers,body:JSON.stringify(response)});
  }
  return route.abort();
 });
 await page.goto(base+'/leif/beheer/',{waitUntil:'load'});
 await page.locator('#workspace:visible').waitFor({timeout:10000});
 await page.locator('#showSiteEditor').click();
 const frame=page.frameLocator('#sitePreview');
 await frame.locator('#accessHeading').waitFor({timeout:10000});
 assert.equal(await frame.locator('#accessHeading').innerText(),'Welkom bij LEIF');
 await frame.locator('#accessHeading').click();
 await page.locator('#siteEditForm:visible').waitFor({timeout:10000});
 assert.equal(await page.locator('#siteEditInput').inputValue(),'Welkom bij LEIF');
 await page.locator('#siteEditInput').fill('Welkom in LEIF');
 await page.locator('#siteSave').click();
 await page.getByText('Concept bewaard.',{exact:true}).waitFor({timeout:10000});
 assert.equal(store.size,1,'Eerste concept opgeslagen');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#sitePublish').click();
 await page.getByText('Tekst gepubliceerd.',{exact:true}).waitFor({timeout:10000});
 assert.equal([...store.values()][0].published_text,'Welkom in LEIF');
 await page.locator('#siteRefresh').click();
 await frame.locator('#accessHeading').getByText('Welkom in LEIF').waitFor({timeout:10000});
 await frame.locator('#accessHeading').click();
 await page.locator('#siteEditInput').fill('Dit blijft de vaste tekst');
 await page.locator('#siteApply').click();
 await page.getByText('Opgeslagen. Deze tekst geldt nu voor iedereen.',{exact:true}).waitFor({timeout:10000});
 changedSource=true;
 await page.locator('#siteRefresh').click();
 await frame.locator('#accessHeading').getByText('Dit blijft de vaste tekst').waitFor({timeout:10000});
 await page.locator('#sitePage').selectOption('mijn');
 await frame.getByRole('heading',{name:'Wat wil je van jezelf begrijpen?'}).waitFor({timeout:10000});
 await page.locator('#siteMode').click();
 await frame.getByRole('button',{name:'Begin met mijn vragen',exact:true}).click();
 await frame.getByText('Welke indruk krijgen mensen vaak van jou?').waitFor({timeout:10000});
 assert.equal(errors.length,0,'Geen JavaScript-fouten: '+errors.join(' ; '));
 mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/leif-editor-proef.png',fullPage:true});
 console.log('LEIF tekstbeheer: concept, publicatie, pagina en vragen getest zonder deelnemersgegevens.');
}finally{if(browser)await browser.close();server.kill()}
