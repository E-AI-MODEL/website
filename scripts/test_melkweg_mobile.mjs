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
  if(width<850)await page.screenshot({path:`test-results/melkweg-lab-v11-start-${width}.png`});
  const metrics=await page.evaluate(()=>({
   viewport:innerHeight,document:document.documentElement.scrollHeight,
   horizontal:document.documentElement.scrollWidth-innerWidth,
   stage:document.querySelector('.stage').getBoundingClientRect().height,
   tabVisible:document.querySelector('.lab-tabs').getClientRects().length>0
  }));
  assert(metrics.horizontal<=1,'Horizontale overloop op '+width);
  if(width<850){
   assert(metrics.document<=metrics.viewport+1,'Hoofdpagina mag niet scrollen op '+width);
   assert(metrics.stage>=height-1,'Het sterrenbeeld vult het scherm niet op '+width);
   assert(!metrics.tabVisible,'Tabs horen niet op het beginscherm');
   assert(!(await page.locator('#pane-proef').isVisible()),'De oude kaart staat nog over het beeld');
   assert(!(await page.locator('#timeslider').isVisible()),'Tijdschuif moet eerst verborgen zijn');
   assert(!(await page.locator('#cameraMenuToggle').isVisible()),'Cameramenu moet verdwijnen');
   const layout=await page.evaluate(()=>{
    const box=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
    return {menu:box('#adventureMenuToggle'),planet:box('#solarEntry'),more:box('#toolsMenuToggle'),
     play:box('#play'),time:box('#timeToggle'),explore:box('#labDock')};
   });
   for(const [name,rect] of Object.entries(layout)){
    assert(rect.w<=52&&rect.h<=52,name+' is geen klein icoon op '+width);
    assert(rect.x>=0&&rect.x+rect.w<=width+1,name+' staat buiten beeld');
   }
   assert(layout.menu.x+layout.menu.w<layout.planet.x-8,'Bovenste iconen overlappen op '+width);
   assert(layout.play.y>height-75&&layout.explore.y>height-75,'Onderste iconen staan te hoog');
   await page.locator('#timeToggle').click();
   assert(await page.locator('#timeslider').isVisible(),'Tijdschuif verschijnt niet');
   await page.locator('#timeslider').evaluate(el=>{el.value='270';el.dispatchEvent(new Event('input',{bubbles:true}));});
   assert((await page.locator('#timevalue').textContent()).includes('270'),'Tijdlijn verandert niet');
   await page.locator('#timeToggle').click();
   assert(!(await page.locator('#timeslider').isVisible()),'Tijdschuif sluit niet');
   await page.waitForSelector('#astroCenterPin:visible',{timeout:5000});
   await page.locator('#astroCenterPin').click();
   assert(await page.locator('#astroInfo').isVisible(),'Tik op het midden toont geen uitleg');
   assert((await page.locator('#astroInfoText').textContent()).includes('Sagittarius'),'De uitleg is niet gekoppeld aan het midden');
   await page.locator('#astroInfoClose').click();
   assert(!(await page.locator('#astroInfo').isVisible()),'De uitleg sluit niet');
   const sun=page.locator('#astroSunPin');
   if(await sun.isVisible()){
    await sun.click();
    assert((await page.locator('#astroInfoTitle').textContent()).includes('zon'),'Zonkaart ontbreekt');
    await page.locator('#astroInfoGo').click();
    assert(await page.locator('#solarExplorer').isVisible(),'Zonkaart opent de planeten niet');
    await page.locator('#backGalaxy').click();
   }
   const canvas=page.locator('#universe');
   const before=await page.locator('#viewangle').textContent();
   const cr=await canvas.boundingBox();
   await page.mouse.move(cr.x+cr.width*.42,cr.y+cr.height*.37);
   await page.mouse.down();
   await page.mouse.move(cr.x+cr.width*.56,cr.y+cr.height*.47,{steps:8});
   await page.mouse.up();
   const after=await page.locator('#viewangle').textContent();
   assert.notEqual(after,before,'Slepen draait de Melkweg niet');
   assert(await page.evaluate(()=>document.body.classList.contains('stage-touched')),'Het sleephintje verdwijnt niet');
   await page.locator('#labDock').click();
   assert(await page.locator('#pane-proef').isVisible(),'Het ontdekpaneel opent niet');
   const tabs=page.getByRole('tab');
   assert.equal(await tabs.count(),3);
   await tabs.getByText('Verander').click();
   assert(await page.locator('#pane-speel').isVisible());
   await tabs.getByText('Ontdek meer').click();
   assert(await page.locator('#pane-meer').isVisible());
   await page.locator('#graphToggle').click();
   assert(await page.locator('#graphClose').isVisible(),'Grafiek kan niet open');
   assert(!(await page.locator('#pane-meer').isVisible()),'Grafiek moet sterrenbeeld vrijmaken');
   await page.locator('#graphClose').click();
   assert(!(await page.locator('#graphClose').isVisible()),'Grafiek kan niet dicht');
   await page.locator('#labDock').click();
   await page.locator('#labDock').click();
   assert(!(await page.locator('#pane-proef').isVisible()),'Paneel sluit niet');
   await page.locator('#toolsMenuToggle').click();
   assert(await page.locator('#resetView').isVisible(),'Herstellen ontbreekt in menu');
   await page.locator('#resetView').click();
   assert(!(await page.locator('#resetView').isVisible()),'Actiemenu sluit niet');
   await page.locator('#adventureMenuToggle').click();
   const options=page.locator('.navlist .nav-btn');
   assert.equal(await options.count(),6);
   const option=options.nth(3);
   const point=await option.boundingBox();
   assert(point,'Avonturenmenu is niet zichtbaar');
   assert(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.nav-btn'),{x:point.x+point.width/2,y:point.y+point.height/2}),'Avonturenmenu zit achter een ander vlak');
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
  await page.screenshot({path:`test-results/melkweg-lab-v11-${width}.png`});
  assert.deepEqual(errors,[],'JavaScript-fouten op '+width);
  await page.close();
 }
 console.log('Melkweg Lab V11: canvas, touch-pins, uitleg, tijd, menu, grafiek en planeten gecontroleerd op mobiel en desktop.');
}finally{if(browser)await browser.close();server.kill();}
