import { chromium } from 'playwright';
import { get as httpGet } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]||'site-build'), origin='http://127.0.0.1:8786';
const server=spawn('python3',['-m','http.server','8786','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const code='a'.repeat(48);
const doc={revision:0,questionnaire_version:'leif-2026-11-v1',answers:{},exercises:{},report:{},personal_texts:{},position:{screen:'questions',question_index:0},updated_at:new Date().toISOString()};
const errors=[],requests=[];
let browser;
try{
 let ready=false;
 for(let i=0;i<60;i++){
  ready=await new Promise(done=>{const r=httpGet(origin+'/leif/mijn/',res=>{res.resume();done(res.statusCode===200)});r.on('error',()=>done(false))});
  if(ready)break;
  await new Promise(done=>setTimeout(done,100));
 }
 assert(ready,'LEIF-site is niet bereikbaar');
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(code=>{if(location.pathname==='/leif/mijn/')sessionStorage.setItem('leif-personal-access-code-v1',code)},code);
 await page.route('**/functions/v1/leif-personal-session',async route=>{
  const req=route.request(),headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','content-type':'application/json'};
  if(req.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
  const body=JSON.parse(req.postData()||'{}');
  requests.push(body);
  let result={ok:true};
  if(body.action==='load')result={ok:true,participant:{id:'00000000-0000-4000-8000-000000000001',name:'Kars'},document:structuredClone(doc)};
  if(body.action==='save'){
   assert.equal(body.expected_revision,doc.revision,'Opgeslagen revisie wijkt af');
   Object.assign(doc,body.changes);
   doc.revision++;
   result={ok:true,revision:doc.revision,updated_at:new Date().toISOString()};
  }
  return route.fulfill({status:200,headers,body:JSON.stringify(result)});
 });
 await page.goto(origin+'/leif/mijn/',{waitUntil:'domcontentloaded'});
 await page.locator('#workspace:visible').waitFor({timeout:10000});
 const input=page.locator('.question textarea');
 await input.waitFor({timeout:10000});
 const before=await input.evaluate(t=>t.getBoundingClientRect().height);
 const longAnswer=Array.from({length:32},(_,i)=>'Regel '+(i+1)+': Dit is een langere persoonlijke gedachte.').join('\n');
 await input.fill(longAnswer);
 await page.waitForTimeout(150);
 const after=await input.evaluate(t=>({height:t.getBoundingClientRect().height,clientHeight:t.clientHeight,scrollHeight:t.scrollHeight,scrollTop:t.scrollTop,overflow:getComputedStyle(t).overflowY,resize:getComputedStyle(t).resize}));
 assert(after.height>before+180,'Antwoordvak wordt niet hoger');
 assert(after.clientHeight>=after.scrollHeight-3,'Antwoordvak houdt een interne scroller over');
 assert.equal(after.scrollTop,0);
 assert.equal(after.overflow,'hidden');
 assert.equal(after.resize,'none');
 assert.equal(await input.inputValue(),longAnswer);
 await page.getByRole('button',{name:'Oefeningen',exact:true}).click();
 const exercise=page.locator('.exercise textarea').first();
 await exercise.fill(longAnswer);
 const exerciseData=await exercise.evaluate(t=>({clientHeight:t.clientHeight,scrollHeight:t.scrollHeight,overflow:getComputedStyle(t).overflowY}));
 assert(exerciseData.clientHeight>=exerciseData.scrollHeight-3,'Oefening heeft nog een interne scroller');
 assert.equal(exerciseData.overflow,'hidden');
 await page.waitForTimeout(1250);
 assert(requests.some(x=>x.action==='save'),'Opslag wordt niet meer aangeroepen');
 assert.equal(doc.answers.zichtbaar,longAnswer,'Antwoord is niet opgeslagen');
 assert.equal(doc.exercises.denken_voelen,longAnswer,'Oefening is niet opgeslagen');
 mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/leif-mobile-vraagtekst.png',fullPage:true});
 assert.equal(errors.length,0,'Browserfouten: '+errors.join('; '));
 console.log('LEIF mobiel: de tekstvakken groeien mee en bewaren de inhoud zonder interne scroller.');
}finally{if(browser)await browser.close();server.kill()}
