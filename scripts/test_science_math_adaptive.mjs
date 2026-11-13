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
     assert.ok(await page.locator('#deckDock').isVisible(),'Actiebalk zichtbaar');
     assert.equal(await page.locator('#deckDock button').count(),4,'Vier concrete handelingen');
     assert.ok(await page.locator('#modeSelect').isVisible(),'Onderwerp kiezen');
     assert.ok(geom.dock.bottom<=height+2,'Actiebalk binnen scherm '+width+': '+JSON.stringify(geom));
     assert.ok(await page.locator('#graphAction').isVisible(),'Een tweede weergave is bereikbaar vanuit het model');
     const ctxLabel=await page.locator('[data-view="scene"] .action-word').innerText();
     assert.ok(ctxLabel&&ctxLabel!=='Onderzoek','De eerste handeling noemt de wiskundige taak');
     await page.locator('#graphAction').click();
     await page.locator('.analytics').waitFor({state:'visible'});
     const graph=await page.locator('#plotCanvas').boundingBox();
     assert.ok(graph.width>145&&graph.height>90,'Tweede weergave is zichtbaar: '+JSON.stringify(graph));
     await page.locator('#graphReturn').click();
     await page.locator('#scene').waitFor({state:'visible'});
     await page.locator('[data-view="params"]').click();
     await page.locator('.inspector').waitFor({state:'visible'});
     const visible=await page.locator('#controls>.control:visible').count();
     assert.ok(visible>=1&&visible<=2,'Maximaal twee instellingen zichtbaar: '+visible);
     if(await page.locator('#paramNext').isEnabled()){
      await page.locator('#paramNext').click();
      assert.match(await page.locator('#paramPageText').innerText(),/2 \/ /);
      await page.locator('#paramPrev').click();
     }
     await page.locator('[data-view="calc"]').click();
     await page.locator('#actionResult').waitFor({state:'visible'});
     const beforeResult=await page.locator('#resultNumber').innerText();
     assert.ok(Number.isFinite(Number(beforeResult.replace(',','.').trim())),'De berekening toont een getal: '+beforeResult);
     assert.ok(await page.locator('#resultSteps p').count()>=2,'De stappen zijn zichtbaar');
     await page.locator('#saveComparison').click();
     await page.locator('[data-view="params"]').click();
     await page.locator('.inspector').waitFor({state:'visible'});
     await page.locator('#controls>.control:visible input[type=range]').first().evaluate(el=>{
       const next=Math.min(Number(el.max),Number(el.value)+Number(el.step)*2);
       el.value=String(next);el.dispatchEvent(new Event('input',{bubbles:true}));
     });
     await page.locator('[data-view="calc"]').click();
     await page.waitForFunction(()=>document.body.dataset.deckView==='calc');
     assert.ok((await page.locator('#comparisonResult').innerText()).includes('Verschil'),'Bewaarde waarde is vergeleken met de nieuwe');
     await page.locator('#showInfoFromCalc').click();
     await page.locator('#infoDesk').waitFor({state:'visible'});
     await page.locator('#infoNext').click();
     assert.ok(await page.locator('#infoTitle').innerText(),'Concrete modelinformatie');
     await page.locator('#infoReturn').click();
     await page.locator('#actionResult').waitFor({state:'visible'});
     await page.locator('[data-view="practice"]').click();
     await page.locator('.phasebox').waitFor({state:'visible'});
     assert.ok(await page.locator('#practiceAnswer').isVisible(),'Een echte berekeningsopgave');
     await page.locator('#practiceAnswer').fill('geen getal');
     await page.locator('#checkPractice').click();
     assert.match(await page.locator('#phaseFeedback').innerText(),/Voer een getal in/);
     await page.locator('#modeSelect').selectOption('1');
     await page.waitForFunction(()=>document.querySelector('#modeSelect').value==='1'&&document.body.dataset.deckView==='scene');
     assert.ok(await page.locator('[data-view="scene"] .action-word').innerText(),'Handeling verandert mee bij onderwerp');
     await page.locator('#modeSelect').selectOption('0');
     if(width===390){
      const expectedFirst=slug==='wiskunde-a'?['p','sigma','success','noise','sa','delta']:['x','start','left','center','dt','u'];
      for(let mode=0;mode<6;mode++){
       await page.locator('#modeSelect').selectOption(String(mode));
       await page.waitForFunction(n=>document.querySelector('#modeSelect').value===String(n)&&document.body.dataset.deckView==='scene',mode);
       await page.locator('[data-view="params"]').click();
       await page.locator('.inspector').waitFor({state:'visible'});
       const first=await page.locator('#controls>.control:visible input[data-param]').first().getAttribute('data-param');
       assert.equal(first,expectedFirst[mode],'De genoemde instelling staat vooraan '+slug+' '+mode);
       await page.locator('[data-view="calc"]').click();
       await page.locator('#actionResult').waitFor({state:'visible'});
       const shown=(await page.locator('#resultNumber').innerText()).split(' ')[0].replaceAll('.','').replace(',','.');
       const expected=Number(shown);assert.ok(Number.isFinite(expected), 'Een berekening bij '+slug+' '+mode);
       if(mode===0)await page.screenshot({path:'test-results/math-'+slug+'-calc-'+engineName+'.png'});
       await page.locator('[data-view="practice"]').click();
       await page.locator('#practiceAnswer').waitFor({state:'visible'});
       await page.locator('#practiceAnswer').fill(String(expected));
       await page.locator('#checkPractice').click();
       assert.match(await page.locator('#phaseFeedback').innerText(),/berekening klopt/i,'Uitkomst is controleerbaar '+slug+' '+mode);
       if(mode===0)await page.screenshot({path:'test-results/math-'+slug+'-practice-'+engineName+'.png'});
      }
      await page.locator('#modeSelect').selectOption('0');
      await page.waitForFunction(()=>document.body.dataset.deckView==='scene');
     }
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
