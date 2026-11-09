// Safari-achtige browsercontrole van het zelf gehoste anatomiemodel.
// WebKit op Linux is niet gelijk aan een fysieke iPhone, maar controleert
// wel dezelfde browserengine en het werkelijk verdwijnen van de spinner.
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8896';
const server = spawn('python3', ['-m','http.server','8896','--bind','127.0.0.1','--directory',root], {stdio:'ignore'});
let browser;
try {
  let ready = false;
  for (let i=0;i<120;i++) {
    try { ready=(await fetch(base+'/tools/anatomie/')).ok; } catch {}
    if (ready) break;
    await new Promise(done=>setTimeout(done,100));
  }
  assert(ready, 'De atlas staat niet in de sitebuild');
  browser = await webkit.launch({headless:true});
  const page = await browser.newPage({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true
  });
  page.setDefaultTimeout(65000);
  const errors=[], failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',request=>failed.push(request.url()+' '+request.failure()?.errorText));
  const started=Date.now();
  await page.goto(base+'/tools/anatomie/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    let count=0;
    window.ZAnatomy?.viewer?.scene?.traverse(n=>{if(n.isMesh&&n.visible)count++});
    return count>50 && window.__EAI_ANATOMY_UI_READY===true;
  },null,{timeout:65000});
  await page.locator('#loadingOverlay').waitFor({state:'hidden',timeout:8000});
  const report=await page.evaluate(()=>{
    const canvas=document.getElementById('threeCanvas');
    return {
      width:canvas.width,height:canvas.height,
      visible:canvas.getBoundingClientRect().width>100,
      triangles:window.ZAnatomy?.viewer?.renderer?.info.render.triangles || 0
    };
  });
  const elapsed=Date.now()-started;
  assert(report.visible && report.width>200 && report.height>100,'De WebKit-canvas is niet zichtbaar');
  assert(report.triangles>100, 'WebKit tekent geen anatomische driehoeken');
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join('; '));
  assert.deepEqual(failed,[],'Netwerkfouten: '+failed.join('; '));
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/anatomie-webkit-mobile.png'});
  console.log('WebKit toont het skelet zonder laadspinner in '+elapsed+' ms, '+report.triangles+' driehoeken');
} finally {
  if (browser) await browser.close();
  server.kill();
}
