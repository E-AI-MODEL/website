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
   assert(metrics.stage>=height-1,'Sterrenbeeld vult het scherm niet op '+width);
   assert(!metrics.tabVisible,'Tabs horen niet over het sterrenbeeld te liggen');
   const compact=await page.locator('.inspector').evaluate(el=>el.getBoundingClientRect().height);
   assert(compact<=52,'Er staat nog een groot vast paneel op '+width);
   assert(!(await page.locator('#pane-proef').isVisible()),'Ontdekkaart vervuilt de startweergave');
   assert.equal(await page.locator('#labDock').getAttribute('aria-expanded'),'false');
   await page.locator('#labDock').click();
   const expanded=await page.locator('.inspector').evaluate(el=>el.getBoundingClientRect().height);
   assert(expanded>compact+150,'Onderpaneel gaat niet open bij '+width);
   assert(await page.locator('#pane-proef').isVisible());
   assert.equal(await page.locator('#labDock').getAttribute('aria-expanded'),'true');
   const tabs=page.getByRole('tab');
   assert.equal(await tabs.count(),3);
   await tabs.getByText('Verander').click();
   assert(await page.locator('#pane-speel').isVisible());
   await tabs.getByText('Ontdek meer').click();
   assert(await page.locator('#pane-meer').isVisible());
   await tabs.getByText('Probeer').click();
   await page.locator('#labDock').click();
   assert.equal(await page.locator('#labDock').getAttribute('aria-expanded'),'false');
   assert(!(await page.locator('#pane-proef').isVisible()));
   await page.locator('#cameraMenuToggle').click();
   assert.equal(await page.locator('#cameraMenuToggle').getAttribute('aria-expanded'),'true');
   await page.locator('.camera-controls [data-cam="edge"]').click();
   assert.equal(await page.locator('#cameraMenuToggle').getAttribute('aria-expanded'),'false');
   await page.locator('#toolsMenuToggle').click();
   assert.equal(await page.locator('#toolsMenuToggle').getAttribute('aria-expanded'),'true');
   await page.locator('#resetView').click();
   assert.equal(await page.locator('#toolsMenuToggle').getAttribute('aria-expanded'),'false');
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
   await page.locator('#solarEntry').click();
   assert(await page.locator('#solarExplorer').isVisible(),'Planeten niet geopend');
   assert.equal(await page.locator('#planetChoices .planet-pick').count(),8);
   await page.locator('#planetChoices .planet-pick').nth(3).click();
   assert((await page.locator('#planetDetail').textContent()).includes('Mars'));
   await page.locator('#backGalaxy').click();
   assert(!(await page.locator('#solarExplorer').isVisible()));
  }
  await page.screenshot({path:`test-results/melkweg-lab-v9-${width}.png`});
  assert.deepEqual(errors,[],'JavaScript-fouten op '+width);
  await page.close();
 }
 console.log('Melkweg Lab V9: schermvullend op 320/390, panelen, camera, menu, tabs en planeten reageren.');
}finally{if(browser)await browser.close();server.kill();}
