import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';

const root=process.argv[2]||'site-build';
const engine=process.argv[3]==='webkit'?webkit:chromium;
const engineName=process.argv[3]==='webkit'?'webkit':'chromium';
const port=8898,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
mkdirSync('test-results',{recursive:true});
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(base+'/tools/science-observatory/labs/wiskunde-a/')).ok){ready=true;break;}}catch{}await pause(100);}
 assert.ok(ready,'Built mathematics observatory is served');
 browser=await engine.launch({headless:true});
 const sizes=[[320,568],[390,844],[844,390],[1440,900]];
 for(const slug of ['wiskunde-a','wiskunde-b']){
  for(const [width,height] of sizes){
   const compact=width<=810||height<=620;
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:width<500?2:1,isMobile:width<500,hasTouch:width<500});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(base+'/tools/science-observatory/labs/'+slug+'/',{waitUntil:'load'});
    await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await page.waitForTimeout(90);
    const geom=await page.evaluate(()=>({
      w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
      stage:document.getElementById('scene').getBoundingClientRect().toJSON(),
      dock:document.getElementById('deckDock').getBoundingClientRect().toJSON()
    }));
    assert.ok(geom.sw<=width+2,'Horizontal scroll '+slug+' '+width+': '+JSON.stringify(geom));
    assert.ok(geom.sh<=height+2,'Vertical scroll '+slug+' '+width+': '+JSON.stringify(geom));
    assert.ok(geom.stage.width>150&&geom.stage.height>100,'Usable graph stage '+slug+' '+width+': '+JSON.stringify(geom));
    assert.equal(await page.locator('#nav button').count(),6,'All six experiments remain available');
    if(compact){
     assert.ok(await page.locator('#deckDock').isVisible(),'Mobile dock visible');
     assert.ok(await page.locator('#modeSelect').isVisible(),'Native topic select visible');
     assert.ok(geom.dock.bottom<=height+2,'Mobile dock stays inside viewport '+width+': '+JSON.stringify(geom));
     await page.locator('[data-view="graph"]').click();
     await page.locator('.analytics').waitFor({state:'visible'});
     assert.ok(await page.locator('.analytics').isVisible(),'Graph opens in place');
     const graph=await page.locator('#plotCanvas').boundingBox();
     assert.ok(graph.width>145&&graph.height>90,'Graph has adequate dimensions '+JSON.stringify(graph));
     await page.locator('[data-view="params"]').click();
     await page.locator('.inspector').waitFor({state:'visible'});
     assert.ok(await page.locator('.inspector').isVisible(),'Settings are an in-viewport layer');
     const visible=await page.locator('#controls>.control:visible').count();
     assert.ok(visible>=1&&visible<=2,'At most two parameter cards visible: '+visible);
     if(await page.locator('#paramNext').isEnabled()){
      await page.locator('#paramNext').click();
      assert.match(await page.locator('#paramPageText').innerText(),/2 \/ /);
     }
     await page.locator('[data-view="learn"]').click();
     await page.locator('.phasebox').waitFor({state:'visible'});
     assert.ok(await page.locator('.phasebox').isVisible(),'Learning remains accessible');
     await page.locator('#phasetabs [data-phase="instruction"]').click();
     assert.ok(await page.locator('#phaseinner h4').isVisible(),'Instruction is on-screen');
     await page.locator('[data-view="info"]').click();
     await page.locator('#infoDesk').waitFor({state:'visible'});
     assert.ok(await page.locator('#infoDesk').isVisible(),'Sources and explanations available');
     await page.locator('#infoNext').click();
     assert.ok(await page.locator('#infoTitle').innerText(),'Next detail page');
     await page.locator('#modeSelect').selectOption('1');
     await page.waitForFunction(()=>document.querySelector('#modeSelect').value==='1'&&document.body.dataset.deckView==='scene');
     assert.equal(await page.locator('body').getAttribute('data-deck-view'),'scene','Changing topic returns to model');
     await page.locator('#modeSelect').selectOption('0');
    }
    await page.locator('#scene').waitFor({state:'visible'});
    const before=await page.evaluate(()=>JSON.parse(document.querySelector('#config').textContent).modules[0].id);
    assert.ok(before);
    assert.deepEqual(errors,[],'JavaScript errors '+slug+' '+width);
    await page.screenshot({path:'test-results/math-'+slug+'-'+width+'-'+engineName+'.png'});
   }finally{await page.close();}
  }
 }
 console.log('Adaptive math workspace checks passed in '+engineName);
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
