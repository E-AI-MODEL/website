import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const root=process.argv[2]||'site-build',engine=process.argv[3]==='webkit'?webkit:chromium;
const port=8891,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
mkdirSync('test-results',{recursive:true});
try{
 let ok=false;
 for(let i=0;i<100;i++){try{if((await fetch(base+'/tools/science-observatory/labs/natuurkunde/')).ok){ok=true;break}}catch{}await pause(120)}
 assert(ok,'Built physics page must be served');
 browser=await engine.launch({headless:true});
 for(const width of [320,390,768,1024,1440]){
  const height=width<500?740:width<1100?768:900;
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:width<500?2:1,isMobile:width<500,hasTouch:width<500});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#projectile',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#scene').width>0 && document.querySelector('#labTitle').textContent.includes('Schuine'));
  const geometry=await page.evaluate(()=>{
   const rect=sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
   return {w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,lab:rect('#labSection'),scene:rect('#stage'),head:rect('.lab-head'),quick:rect('#mobileQuick'),side:rect('#inspector')};
  });
  assert(geometry.scrollW<=width+2,'No horizontal page overflow '+width+': '+JSON.stringify(geometry));
  assert(geometry.scrollH<=height+2,'No vertical page overflow '+width+': '+JSON.stringify(geometry));
  assert(geometry.scene.width>150 && geometry.scene.height>100,'Scene stays usable '+width+': '+JSON.stringify(geometry));
  assert.equal(await page.locator('.experiment-link').count(),53,'All 53 labs are available');
  if(width<=720){
   assert(await page.locator('#mobileQuick').isVisible(),'Quick controls visible on phone');
   assert(await page.locator('#quick-v').isVisible(),'Projectile speed can be typed on phone');
   assert(await page.locator('#inquiryAction').isVisible(),'Throw button stays in main view');
   assert(!(await page.locator('#mobileAim').isVisible()),'Duplicate large control group removed');
   await page.locator('#quick-v').fill('21.5');await page.locator('#quick-v').dispatchEvent('change');
   await page.locator('#quickMore').click();
   assert(await page.locator('#inspector').evaluate(el=>el.classList.contains('open')),'All settings open as drawer');
   assert(await page.locator('#num-angle').isVisible(),'Detailed numeric settings are available');
   await page.locator('#num-angle').fill('32.5');await page.locator('#num-angle').dispatchEvent('change');
   assert.equal(await page.locator('#num-angle').inputValue(),'32.5');
   await page.locator('#closeMobileSettings').click();
   await page.locator('[data-bottom="graph"]').click();
   assert(await page.locator('.analysis-shell').evaluate(el=>el.classList.contains('compact-open')),'Graph opens inside fixed workspace');
   await page.locator('[data-bottom="graph"]').click();
   assert(!(await page.locator('.analysis-shell').evaluate(el=>el.classList.contains('compact-open'))),'Graph closes without scrolling');
   await page.locator('#openExplorer').click();
   assert(await page.locator('#explorer').evaluate(el=>el.classList.contains('open')),'Experiment list opens');
   const wheatstoneGroup=page.locator('.group-set').filter({has:page.locator('[data-open="wheatstone"]')}).locator('.group-header');
   if(await wheatstoneGroup.getAttribute('aria-expanded')==='false')await wheatstoneGroup.click();
   await page.locator('[data-open="wheatstone"]').click();
   await page.waitForFunction(()=>document.querySelector('#labTitle').textContent.toLowerCase().includes('wheatstone'));
   await page.waitForFunction(()=>!document.querySelector('#explorer').classList.contains('open'));
   await page.waitForTimeout(270);
  }else{
   assert.equal(await page.locator('#controls>.precision-control').count(),Math.min(2,await page.locator('#controls .precision-control').count()),'Directe knoppen blijven beperkt tot maximaal twee');
   const extra=page.locator('#controls>.more-controls');
   if(await extra.count()){
    assert(!(await extra.evaluate(el=>el.open)),'Extra instellingen starten dichtgeklapt');
    await extra.locator('summary').click();
    assert(await extra.evaluate(el=>el.open),'Extra instellingen zijn uitklapbaar');
    assert(await extra.locator('input[type=number]').first().isVisible(),'Extra instelwaarde blijft bereikbaar');
    await extra.locator('summary').click();
   }
   const inputs=page.locator('.precision-control-row input[type="number"]');
   assert(await inputs.count()>=2,'Number inputs replace bulky sliders');
   assert(await page.locator('input[type=range]').first().isHidden(),'Range is collapsed by default');
   await page.locator('.precision-control-row details summary').first().click();
   assert(await page.locator('.precision-control-row input[type=range]').first().isVisible(),'Slider remains available on request');
   await page.locator('#num-v').fill('20.5');await page.locator('#num-v').dispatchEvent('change');
   assert.equal(await page.locator('#num-v').inputValue(),'20.5');
   if(width===1024){await page.locator('#toggleExplorer').click();assert(await page.locator('#explorer').evaluate(el=>el.classList.contains('open')),'Catalogue opens at tablet width');await page.locator('#closeExplorer').click();}
   if(width===1440){
    const expand=page.locator('#graphExpand'),initial=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    await expand.click();
    const larger=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    assert(larger>initial+35,'Uitklapknop maakt grafiek groter');
    await expand.click();
    const restored=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    assert(Math.abs(restored-initial)<3,'Uitklapknop herstelt de oorspronkelijke ruimte');
    const divider=page.locator('#sceneDivider'), before=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height),rect=await divider.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width/2,rect.y-75,{steps:6});
    await page.mouse.up();
    const after=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    assert(after>before+30,'Leerling kan de grafiek met de scheidingslijn groter maken: '+before+' -> '+after);
   }
   await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#wheatstone',{waitUntil:'load'});
   await page.waitForFunction(()=>document.querySelector('#labTitle').textContent.toLowerCase().includes('wheatstone'));
   assert.equal(await page.locator('[data-bottom="graph"]').getAttribute('aria-selected'),'true','Nieuwe proef start met grafiek');
   const plot=page.locator('#plot'),r=await plot.boundingBox();
   await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);
   const probe=await page.evaluate(()=>state.graphProbe);
   assert(probe!==null&&probe>.1&&probe<.9,'Muis beweegt het meetpunt over de grafiek');
   assert((await page.locator('#graphDomain').innerText()).includes(':'),'Grafiek toont de waarde onder de muis');
   await plot.focus();await page.keyboard.press('ArrowRight');
   const shifted=await page.evaluate(()=>state.graphProbe);
   assert(shifted>probe,'Ook met pijltjestoetsen is de grafiek afleesbaar');
  }
  assert.equal(await page.locator('#num-R3').count(),0,'Hidden Wheatstone resistance remains unknown');
  assert(await page.locator('#num-R4').count()===1,'Other circuit settings remain editable');
  if(width<=720)assert(await page.locator('#quick-R4').isVisible(),'Balancing resistor appears in the direct mobile controls');
  const actionGeometry=await page.evaluate(()=>{const a=document.querySelector('#inquiryAction').getBoundingClientRect(),r=document.querySelector('#inquiryBar').getBoundingClientRect();return{actionLeft:a.left,actionRight:a.right,barLeft:r.left,barRight:r.right}});
  assert(actionGeometry.actionLeft>=actionGeometry.barLeft-1&&actionGeometry.actionRight<=actionGeometry.barRight+1,'Research action is not clipped: '+JSON.stringify(actionGeometry));
  if(width<=720)assert(!(await page.locator('#explorer').evaluate(el=>el.classList.contains('open'))),'The experiment chooser closes after selection');
  await page.screenshot({path:'test-results/physics-fixed-'+engine.name()+'-'+width+'.png'});
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#interference',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#labTitle').textContent.toLowerCase().includes('interferentie'));
  assert(await page.locator('#scene').isVisible());
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#pendulum',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#scene').width>0);
  assert.deepEqual(errors,[],'No browser script errors '+width);
  console.log(engine.name()+' '+width+'px: viewport, controls, data and switching labs OK');
  await page.close();
 }
}finally{if(browser)await browser.close();server.kill();}
