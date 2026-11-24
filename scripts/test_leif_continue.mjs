import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';

const source=resolve(process.argv[2]||'site-build','leif/continue/index.html');
const html=readFileSync(source,'utf8');
const siteCopy=readFileSync(resolve(process.argv[2]||'site-build','leif/tekstbeheer.js'),'utf8');
const ids=['zichtbaar','observeren','onzichtbaar','sterk','raak','reactie','behoefte','geschiedenis','geleerd','licht','zorggeven','zorgontvangen','zorgvragen','zorggrens','vertrouwen','afstand','vragen','keuzes','denkenhelpt','denkenweg','eigenweg','behouden','veranderen'];
const answers=Object.fromEntries(ids.map(x=>[x,'Demo antwoord '+x]));
answers.observeren='Ik kijk en luister eerst';answers.reactie='Het verschilt per situatie';
answers.zorgvragen='Ik los het liever zelf op';answers.keuzes='Ik analyseer eerst';
let sent=false,saveCount=0;
const server=createServer((req,res)=>{
 if(req.url?.startsWith('/leif/tekstvelden.js')){
  res.writeHead(200,{'content-type':'application/javascript;charset=utf-8'});
  res.end(readFileSync(resolve(process.argv[2]||'site-build','leif/tekstvelden.js'),'utf8'));return;
 }
 if(req.url?.startsWith('/leif/tekstbeheer.js')){
  res.writeHead(200,{'content-type':'application/javascript;charset=utf-8'});
  res.end(siteCopy);return;
 }
 res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(html);
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const port=server.address().port;
const origin='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage(), errors=[];
const demoCode='synthetic-'+('a'.repeat(39));
await context.addInitScript(code=>{sessionStorage.setItem('leifContinueToken',code)},demoCode);
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/functions/v1/leif-demo-session',async route=>{
 const req=route.request(),headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','content-type':'application/json'};
 if(req.method()==='OPTIONS'){await route.fulfill({status:200,headers,body:JSON.stringify({ok:true})});return;}
 const body=req.postDataJSON();
 let data={ok:true};
 if(body.action==='load')data={ok:true,status:sent?'submitted':'draft',answers};
 if(body.action==='save'){Object.assign(answers,body.patch);saveCount++;data={ok:true,status:sent?'submitted':'draft',updated_at:new Date().toISOString()};}
 if(body.action==='submit'){sent=true;data={ok:true,status:'submitted'};}
 await route.fulfill({status:200,headers,body:JSON.stringify(data)});
});
try{
 await page.goto(origin+'/leif/continue/');
 await page.locator('#welcomePhase').waitFor({state:'visible',timeout:10000});
 await page.locator('#beginContinue').click();
 await page.locator('#editor').waitFor({state:'visible',timeout:10000});
 assert.equal(await page.locator('#total').innerText(),'23');
 assert.match(await page.locator('#question h2').innerText(),/zit diezelfde kant je in de weg/);
 await page.locator('#question textarea').fill('Een aanvullend demoantwoord.');
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Op server opgeslagen',{timeout:10000});
 assert.ok(saveCount>=1,'no server write');
 assert.equal(answers.schuur,'Een aanvullend demoantwoord.');
 mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/leif-continue-desktop.png',fullPage:true});
 await page.reload();
 await page.locator('#welcomePhase').waitFor({state:'visible',timeout:10000});
 await page.locator('#beginContinue').click();
 await page.locator('#editor').waitFor({state:'visible',timeout:10000});
 assert.equal(await page.locator('#total').innerText(),'24');
 assert.match(await page.locator('#question h2').innerText(),/Welk gevoel laat je niet gemakkelijk zien/);
 await page.locator('#viewReport').click();
 await page.locator('#report').waitFor({state:'visible'});
 assert.equal(await page.locator('#report .missing').count(),8);
 page.once('dialog',async d=>d.accept());
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#sentMessage')?.textContent?.includes('afgerond'),{timeout:8000});
 assert.ok(sent,'submit action not received');
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 await mobile.route('**/functions/v1/leif-demo-session',async route=>{
  const req=route.request(),headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','content-type':'application/json'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:200,headers,body:JSON.stringify({ok:true})});return;}
  await route.fulfill({status:200,headers,body:JSON.stringify({ok:true,status:'draft',answers})});
 });
 const mobilePage=await mobile.newPage();
 await mobilePage.addInitScript(code=>{sessionStorage.setItem('leifContinueToken',code)},demoCode);
 await mobilePage.goto(origin+'/leif/continue/');
 await mobilePage.locator('#welcomePhase').waitFor({state:'visible',timeout:10000});
 await mobilePage.locator('#beginContinue').click();
 await mobilePage.locator('#editor').waitFor({state:'visible',timeout:10000});
 assert.equal(await mobilePage.locator('#total').innerText(),'24');
 await mobilePage.screenshot({path:'test-results/leif-continue-mobile.png',fullPage:true});
 const overflow=await mobilePage.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 assert.ok(!overflow,'mobile horizontal overflow');
 await mobile.close();
 assert.deepEqual(errors,[],'page errors');
 console.log('LEIF continuation checks passed: 23 restored, 1 saved, reload, 8 open, submit, mobile.');
}finally{await context.close();await browser.close();await new Promise(ok=>server.close(ok));}
