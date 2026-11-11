// Echte browsercontrole van het Hartslaglab in Chromium of WebKit.
// node scripts/test_hartslaglab_browser.mjs site-build chromium
// node scripts/test_hartslaglab_browser.mjs site-build webkit
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const root=resolve(process.argv[2]||'site-build');
const engine=process.argv[3]==='webkit'?'webkit':'chromium';
const port=8897,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const errors=[];
let browser;
try {
  let ready=false;
  for(let i=0;i<90;i++){
    try{ready=(await fetch(base+'/tools/anatomie/labs/hartslag/')).ok;}catch{}
    if(ready)break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert(ready,'De onderliggende Hartslaglab-route ontbreekt in de sitebuild');
  browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--use-gl=angle','--use-angle=swiftshader']:[]});
  const page=await browser.newPage({viewport:{width:1400,height:920},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__EAI_HEART_LAB__?.rendererReady===true,{timeout:25000});
  assert.match(await page.title(),/Hartslaglab/);
  assert.equal(await page.locator('#heartCanvas').count(),1);
  assert.equal(await page.locator('#timeline button').count(),5);
  await page.evaluate(()=>window.__EAI_HEART_LAB__.setTime(.30));
  await page.waitForTimeout(100);
  const filling=await page.locator('#heartCanvas').screenshot();
  let metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.av&&!metrics.sem&&metrics.volume>60&&metrics.pressure<20);
  await page.evaluate(()=>window.__EAI_HEART_LAB__.setTime(.67));
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&!metrics.sem&&metrics.volume===130&&metrics.pressure>15);
  await page.evaluate(()=>window.__EAI_HEART_LAB__.setTime(.80));
  await page.waitForTimeout(100);
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&metrics.sem&&metrics.pressure>90&&metrics.volume<130);
  const pumping=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(filling,pumping,'3D-model moet daadwerkelijk bewegen tussen vulling en uitpompen');
  assert.equal(await page.locator('#sectionToggle').getAttribute('aria-pressed'),'true');
  const cutawayFrame=await page.locator('#heartCanvas').screenshot();
  await page.locator('#sectionToggle').click();
  assert.equal(await page.locator('#sectionToggle').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>window.__EAI_HEART_LAB__.state.cutaway),false);
  await page.waitForTimeout(90);
  const outsideFrame=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(cutawayFrame,outsideFrame,'Een echte doorsnede moet anders zijn dan de buitenkant');
  await page.locator('#sectionToggle').click();
  assert.equal(await page.evaluate(()=>window.__EAI_HEART_LAB__.state.cutaway),true);
  const label=await page.locator('#phaseTitle').textContent();
  assert.match(label,/Bloed wordt uitgepompt/);
  await page.locator('#tabExploreBtn').click();
  await page.locator('input[name=prediction][value=av]').check();
  await page.locator('#checkPrediction').click();
  assert.match(await page.locator('#predictionFeedback').textContent(),/Dat klopt/);
  assert.equal(await page.locator('#tabExploreBtn').getAttribute('aria-selected'),'true');
  await page.locator('#tabSourcesBtn').click();
  assert.equal(await page.locator('.source-links a').count(),3);
  const before=await page.evaluate(()=>window.__EAI_HEART_LAB__.state.yaw);
  const box=await page.locator('#heartCanvas').boundingBox();
  assert(box&&box.width>450&&box.height>300);
  await page.mouse.move(box.x+box.width*.48,box.y+box.height*.52);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.75,box.y+box.height*.52,{steps:6});
  await page.mouse.up();
  const after=await page.evaluate(()=>window.__EAI_HEART_LAB__.state.yaw);
  assert(Math.abs(after-before)>.10,'Slepen moet het WebGL-hart echt draaien');
  await page.locator('#resetCamera').click();
  assert(Math.abs((await page.evaluate(()=>window.__EAI_HEART_LAB__.state.yaw))+.2)<.005);
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-desktop.png',fullPage:true});
  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:engine==='webkit',hasTouch:true
  });
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.__EAI_HEART_LAB__?.rendererReady===true,{timeout:35000});
  const size=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,canvas:document.getElementById('heartCanvas').getBoundingClientRect().width}));
  assert(size.scroll<=size.inner+6,'Mobiele pagina mag niet horizontaal overlopen: '+JSON.stringify(size));
  assert(size.canvas>280,'Hartmodel moet groot genoeg blijven op mobiel');
  assert.equal(await mobile.locator('#sectionToggle').count(),1,'Doorsnedeknop moet ook op mobiel beschikbaar zijn');
  await mobile.evaluate(()=>window.__EAI_HEART_LAB__.setTime(0));
  await mobile.locator('#nextPhase').click();
  const t=await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.t);
  assert(t>.5&&t<.53,'Fasebediening moet op mobiel werken');
  await mobile.screenshot({path:'test-results/hartslaglab-'+engine+'-mobile.png',fullPage:true});
  const atlasHref=await mobile.locator('.back-link').getAttribute('href');
  assert.equal(atlasHref,'/tools/anatomie/');
  assert.deepEqual(errors,[],'Browserfouten: '+errors.join(' | '));
  console.log('Hartslaglab '+engine+': bewegende WebGL-frames, kleppen, grafieken, onderzoek, camera en mobiel gecontroleerd.');
}finally {
  await browser?.close();
  server.kill('SIGTERM');
}
