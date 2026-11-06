import { chromium } from 'playwright';
import { get as httpGet } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'site-build'),origin='http://127.0.0.1:8788';
const server=spawn('python3',['-m','http.server','8788','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const errors=[];let browser;
try{
 let online=false;
 for(let i=0;i<60;i++){
  online=await new Promise(ok=>{const r=httpGet(origin+'/leif/mijn/',res=>{res.resume();ok(res.statusCode===200)});r.on('error',()=>ok(false))});
  if(online)break;await new Promise(r=>setTimeout(r,100));
 }
 assert(online,'LEIF previewserver niet bereikbaar');
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 const code='k'.repeat(48);
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 const writes=[];
 await page.addInitScript(code=>{if(location.pathname==='/leif/mijn/')sessionStorage.setItem('leif-personal-access-code-v1',code)},code);
 await page.route('**/functions/v1/leif-personal-session',async route=>{
  const body=JSON.parse(route.request().postData()||'{}');writes.push(body.action);
  const data=body.action==='load'?{ok:true,participant:{id:'00000000-0000-4000-8000-000000000001',name:'Kars'},document:{revision:8,answers:{zichtbaar:'Eerste antwoord'},exercises:{},report:null,personal_texts:{},position:{screen:'questions',question_index:14}}}:{ok:true,revision:9,updated_at:new Date().toISOString()};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify(data)});
 });
 await page.goto(origin+'/leif/mijn/',{waitUntil:'domcontentloaded'});
 await page.locator('#workspace:visible').waitFor({timeout:10000});
 await page.locator('.arrival-hero:visible').waitFor({timeout:10000});
 assert.equal(await page.locator('#tabs').isVisible(),false,'De tabbladen verdringen de opening');
 assert.equal(await page.locator('#demoLabel').count(),0,'De oude proefwaarschuwing staat nog in het document');
 assert.match(await page.locator('.arrival-hero h2').innerText(),/Wat wil je van jezelf begrijpen/);
 assert.deepEqual(writes,['load'],'De landingspagina mag de voortgang niet veranderen');
 assert.equal(await page.locator('.arrival-hero .arrival-actions .btn').first().innerText(),'Verder met mijn vragen');
 mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/leif-landing-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Verder met mijn vragen'}).click();
 await page.locator('.question:visible').waitFor({timeout:10000});
 assert.match(await page.locator('.question h2').innerText(),/Waaraan merk jij dat iemand echt voor jou zorgt/,'De opgeslagen vraagpositie is verloren');
 assert.equal(await page.locator('#tabs').isVisible(),true);
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.addInitScript(code=>{if(location.pathname==='/leif/mijn/')sessionStorage.setItem('leif-personal-access-code-v1',code)},code);
 await mobile.route('**/functions/v1/leif-personal-session',async route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,participant:{id:'00000000-0000-4000-8000-000000000001',name:'Kars'},document:{revision:8,answers:{zichtbaar:'Eerste antwoord'},exercises:{},report:null,personal_texts:{},position:{screen:'questions',question_index:14}}})}));
 await mobile.goto(origin+'/leif/mijn/',{waitUntil:'domcontentloaded'});
 await mobile.locator('.arrival-hero:visible').waitFor({timeout:10000});
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'De mobiele startpagina loopt buiten het scherm');
 await mobile.screenshot({path:'test-results/leif-landing-mobile.png',fullPage:true});
 const legacy=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 legacy.on('pageerror',e=>errors.push(e.message));
 await legacy.route('**/functions/v1/leif-demo-session',async route=>{
  const action=JSON.parse(route.request().postData()||'{}').action;
  const data=action==='load'?{ok:true,status:'draft',answers:{zichtbaar:'Eerste proefantwoord'},answer_sources:{},source_note:'',updated_at:new Date().toISOString(),personal_texts:{blocks:[]}}:{ok:true};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify(data)});
 });
 await legacy.goto(origin+'/leif/continue/#code='+code,{waitUntil:'domcontentloaded'});
 await legacy.locator('#welcomePhase:visible').waitFor({timeout:10000});
 assert.equal(await legacy.locator('#editor').isVisible(),false,'De oude route slaat de introductie over');
 assert.match(await legacy.locator('#continueWelcomeHeading').innerText(),/Wat wil je van jezelf begrijpen/);
 assert(await legacy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'De oude introductie is mobiel te breed');
 await legacy.screenshot({path:'test-results/leif-landing-oud-mobiel.png',fullPage:true});
 await legacy.getByRole('button',{name:'Verder met mijn vragen'}).click();
 assert.equal(await legacy.locator('#editor').isVisible(),true);
 await legacy.locator('#question h2').waitFor({timeout:10000});
 assert.match(await legacy.locator('#question h2').innerText(),/Hoe ben je in een groep/);
 assert.equal(errors.length,0,errors.join('; '));
 console.log('LEIF: warme start op beide deelnemerroutes, geen proefbanner, eerdere vraag blijft bewaard.');
}finally{if(browser)await browser.close();server.kill();}
