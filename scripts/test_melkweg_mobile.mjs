// Mobiele regressietest voor Melkweg Lab. Draait op de echte sitebuild.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root=resolve(process.argv[2]||'site-build'),origin='http://127.0.0.1:8793';
const server=spawn('python3',['-m','http.server','8793','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  try{ready=(await fetch(origin+'/tools/melkweg-lab/')).ok;}catch{}
  if(ready)break;
  await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,'Melkweg Lab ontbreekt in de sitebuild');
 browser=await chromium.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 for(const [width,height] of [[390,760],[320,640],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<850,hasTouch:width<850,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tools/melkweg-lab/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:10000});
  const metrics=await page.evaluate(()=>({
   viewport:innerHeight,document:document.documentElement.scrollHeight,
   horizontal:document.documentElement.scrollWidth-innerWidth,
   stage:document.querySelector('.stage').getBoundingClientRect().height,
   tabVisible:getComputedStyle(document.querySelector('.lab-tabs')).display!=='none'
  }));
  assert(metrics.horizontal<=1,'Horizontale overloop op '+width);
  if(width<850){
   assert(metrics.document<=metrics.viewport+1,'Hoofdpagina scrolt nog bij '+width);
   assert(metrics.stage>200,'Melkweg te klein op '+width);
   assert(metrics.tabVisible,'Mobiele tabs niet zichtbaar');
   const compact=await page.locator('.inspector').evaluate(el=>el.getBoundingClientRect().height);
   assert(compact<=125,'Ontdekpaneel is te groot bij '+width);
   assert.equal(await page.locator('#labExpand').getAttribute('aria-expanded'),'false');
   await page.locator('#labExpand').click();
   const expanded=await page.locator('.inspector').evaluate(el=>el.getBoundingClientRect().height);
   assert(expanded>compact+40,'Ontdekpaneel klapt niet open bij '+width);
   assert.equal(await page.locator('#labExpand').getAttribute('aria-expanded'),'true');
   await page.locator('#labExpand').click();
   assert.equal(await page.locator('#labExpand').getAttribute('aria-expanded'),'false');
   const tabs=page.getByRole('tab');
   assert.equal(await tabs.count(),3);
   await tabs.getByText('Verander').click();
   assert(await page.locator('#pane-speel').isVisible());
   assert.equal(await page.locator('#labExpand').getAttribute('aria-expanded'),'true');
   await tabs.getByText('Ontdek meer').click();
   assert(await page.locator('#pane-meer').isVisible());
   await tabs.getByText('Probeer').click();
   await page.locator('#adventureMenuToggle').click();
   const options=page.locator('.navlist .nav-btn');
   assert.equal(await options.count(),6);
   const option=options.nth(3);
   const box=await option.boundingBox();
   assert(box,'Avonturenmenu verdwenen');
   const hit=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.nav-btn'),{x:box.x+box.width/2,y:box.y+box.height/2});
   assert(hit,'Avonturenmenu ligt achter ander vlak');
   await option.click();
   assert.equal(await page.locator('#adventureMenuToggle').getAttribute('aria-expanded'),'false');
   await page.locator('#adventureMenuToggle').click();
   await options.first().click();

   // The visual, not an answer button, must drive experiments.
   const pickMode=async mode=>{
     await page.locator('#adventureMenuToggle').click();
     await page.locator('.navlist [data-mode="'+mode+'"]').click();
   };
   const dragSky=async (ratioY,from=.81,to=.19)=>{
     const r=await page.locator('#universe').boundingBox();
     const y=r.y+r.height*ratioY;
     await page.mouse.move(r.x+r.width*from,y);
     await page.mouse.down();
     await page.mouse.move(r.x+r.width*to,y,{steps:8});
     await page.mouse.up();
   };
   await pickMode('dynamics');
   await page.locator('#play').click(); // pause so the comparison is steady
   assert(Number(await page.locator('#haloMass').inputValue())>1);
   await dragSky(.58);
   assert(Number(await page.locator('#haloMass').inputValue())<.5,'Dragging the sky must lower invisible mass');
   assert.equal(await page.locator('#quest-result').evaluate(el=>el.hidden),false,'A touch experiment must complete the quest');
   await page.locator('#resetView').click();
   assert(Math.abs(Number(await page.locator('#haloMass').inputValue())-1.12)<.01,'Reset must restore model values');

   await pickMode('stars');
   await dragSky(.70);
   assert(Number(await page.locator('#limmag').inputValue())<=12.5,'Telescope reacts to touching the visual');
   await dragSky(.70,.19,.81);
   assert(Number(await page.locator('#limmag').inputValue())>=20,'Telescope can be made stronger');

   await pickMode('gaia');
   await dragSky(.58);
   assert(Number(await page.locator('#obDist').inputValue())<=2.5,'Moving the sky marker brings the star closer');
   await dragSky(.58,.19,.81);
   assert(Number(await page.locator('#obDist').inputValue())>=17,'Moving the sky marker pushes it farther away');

   await pickMode('structure');
   const stage=await page.locator('#universe').boundingBox();
   const halo=page.locator('[data-layer="stellarHalo"]');
   assert(await halo.isChecked());
   await page.mouse.click(stage.x+stage.width*.79,stage.y+stage.height*.53);
   assert.equal(await halo.isChecked(),false,'Tapping the distant stars should change the visual and the control');

   await pickMode('blackhole');
   await page.locator('#play').click();
   const orbit=await page.locator('#universe').boundingBox();
   const beforeOrbit=await page.locator('#timevalue').innerText();
   await page.mouse.move(orbit.x+orbit.width*.20,orbit.y+orbit.height*.38);
   await page.mouse.down();
   await page.mouse.move(orbit.x+orbit.width*.77,orbit.y+orbit.height*.55,{steps:9});
   await page.mouse.up();
   assert.notEqual(await page.locator('#timevalue').innerText(),beforeOrbit,'Dragging S2 must change its orbit time');

   await page.getByRole('tab',{name:'Ontdek meer'}).click();
   await page.locator('#graphToggle').click();
   assert(await page.locator('.analytics-main').isVisible(),'Graph button must open a visible graph on mobile');
   await page.locator('#closeGraph').click();
   assert(!(await page.locator('.analytics-main').isVisible()),'Graph close button must work');

   await pickMode('atlas');
   await page.locator('#solarEntry').click();
   assert(await page.locator('#solarExplorer').isVisible(),'Planeten niet geopend');
   assert.equal(await page.locator('#planetChoices .planet-pick').count(),8);
   await page.locator('#planetChoices .planet-pick').nth(3).click();
   assert((await page.locator('#planetDetail').textContent()).includes('Mars'));
   await page.locator('#backGalaxy').click();
   assert(!(await page.locator('#solarExplorer').isVisible()));
  }
  await page.screenshot({path:`test-results/melkweg-lab-v8-${width}.png`});
  assert.deepEqual(errors,[],'JavaScript-fouten op '+width);
  await page.close();
 }
 console.log('Melkweg Lab: mobiel 320/390 en desktop 1440, menu/tabs/planeten en overflow werken.');
}finally{if(browser)await browser.close();server.kill();}
