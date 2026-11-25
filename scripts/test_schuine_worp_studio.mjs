import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const engine=process.argv[3]==='webkit'?webkit:chromium;
const port=8874,base='http://127.0.0.1:'+port;
const legacy='/tools/science-observatory/labs/schuine-worp/';
const target='/tools/science-observatory/labs/natuurkunde/#projectile';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
mkdirSync('test-results',{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let available=false;
 for(let i=0;i<80;i++){try{if((await fetch(base+legacy)).ok){available=true;break}}catch{}await sleep(120)}
 assert(available,'De oude URL blijft bereikbaar');
 const index=await fetch(base+'/assets/site-search-index.json');
 assert(index.ok,'De publieke zoekindex is aanwezig');
 const entries=await index.json();
 assert(!entries.some(x=>x.url===legacy),'De oude studio staat niet meer in de zoekresultaten');
 assert.equal(entries.filter(x=>x.url===target).length,1,'De proef heeft één zoekbestemming');
 browser=await engine.launch({headless:true});
 for(const viewport of [{width:390,height:844},{width:320,height:650},{width:1024,height:768},{width:1440,height:900},{width:1516,height:817}]){
  const mobile=viewport.width<720;
  const page=await browser.newPage({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+legacy,{waitUntil:'domcontentloaded'});
  await page.waitForURL(base+target);
  await page.waitForFunction(()=>document.querySelector('#labTitle')?.textContent==='Schuine worp'&&document.querySelector('#scene')?.width>0);
  assert.equal(await page.evaluate(()=>state.id),'projectile');
  assert.equal(await page.locator('.experiment-link').count(),53,'Alle natuurkundeproeven blijven beschikbaar');
  assert.equal(await page.locator('#field').count(),0,'Geen tweede studio');
  assert(await page.locator('#inquiryAction').isVisible(),'De proef is bedienbaar');
  if(mobile){
   assert(await page.locator('#quick-v').isVisible());
   await page.locator('#inquiryAction').click();
   await page.waitForFunction(()=>mission.complete===true,null,{timeout:14000});
   assert.equal(await page.evaluate(()=>mission.shots.length),1,'Een afgeronde worp levert een meetresultaat op');
  }
  await page.screenshot({path:'test-results/worp-studio-'+engine.name()+'-'+viewport.width+'-doorverwijzing.png'});
  assert.deepEqual(errors,[],'Geen runtime-fouten');
  await page.close();
 }
 const noJS=await browser.newPage({javaScriptEnabled:false});
 await noJS.goto(base+legacy,{waitUntil:'domcontentloaded'});
 await noJS.waitForURL(base+target);
 await noJS.close();
 console.log(engine.name()+': oude URL verwijst naar de enige publieke proef, ook zonder JavaScript');
}finally{if(browser)await browser.close();server.kill();}
