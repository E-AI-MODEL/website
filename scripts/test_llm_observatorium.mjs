// Browserproef voor de openbare LLM-HTML, inclusief echte tokeninvoer.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8793';
const server=spawn('python3',['-m','http.server','8793','--bind','127.0.0.1','--directory',process.argv[2]||'site-build'],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{ready=(await fetch(base+'/tools/llm-observatorium/')).ok}catch{}
  if(ready)break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(ready,'De openbare LLM-route ontbreekt');
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:820}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/llm-observatorium/',{waitUntil:'load'});
  await page.locator('#universe').waitFor({state:'visible'});
  const modesCount=await page.locator('#modes .mode-btn').count();
  assert.equal(modesCount,7,'Zeven onderzoeksmodules; JS-fouten: '+errors.join(' | '));
  if(width<800)await page.locator('.mobile-dock [data-panel="modules"]').click();
  await page.locator('#modes [data-mode="1"]').click();
  if(width<800)await page.locator('.mobile-dock [data-panel="settings"]').click();
  await page.locator('#promptText').fill('Hallo, wereld! Waarom?');
  await page.waitForFunction(()=>state.tokenStatus!=='example',{timeout:20000});
  const tokenState=await page.evaluate(()=>({
   status:state.tokenStatus,
   ids:state.promptWords.map(x=>x.id),
   count:state.promptWords.length,
   text:state.input,
   routeCount:chooseRoute(state.layer).length
  }));
  assert.equal(tokenState.status,'real','De externe tokenizer moet echte token-ID’s teruggeven');
  assert(tokenState.ids.every(Number.isInteger),'Token-ID ontbreekt');
  assert(tokenState.count>=3,'De invoer moet meerdere tokens bevatten');
  assert.equal(tokenState.routeCount,4,'De voorbeeldrouter blijft bereikbaar');
  assert.equal(await page.locator('#tokenChips button').count(),tokenState.count);
  await page.locator('#tokenChips button').last().click();
  assert(await page.locator('#tokenId').innerText().then(t=>t.includes('Token-ID')));
  assert.equal(errors.length,0,'JavaScript fouten: '+errors.join(' | '));
  await page.close();
 }
 console.log('LLM_BROWSER_OK widths=390,1280 modes=7 tokenizer=real token_ids=valid');
}finally{
 if(browser)await browser.close();
 server.kill();
}
