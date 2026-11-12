import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const browserType=process.argv[3]==='webkit'?webkit:chromium;
const port=8874,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
mkdirSync('test-results',{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let available=false;
 for(let i=0;i<80;i++){try{const response=await fetch(base+'/tools/science-observatory/labs/schuine-worp/');if(response.ok){available=true;break}}catch{}await sleep(120)}
 assert(available,'De compacte studio moet in de publieke uitvoer staan');
 browser=await browserType.launch({headless:true});
 for(const viewport of [{width:390,height:844},{width:320,height:650},{width:1024,height:768},{width:1440,height:900},{width:1516,height:817}]){
  const mobile=viewport.width<800;
  const page=await browser.newPage({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/science-observatory/labs/schuine-worp/',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.__physicsStudio&&document.querySelector('#field').width>0);
  await page.waitForFunction(()=>{try{return window.__physicsStudio.camera().scale>0}catch{return false}});
  const geometry=await page.evaluate(()=>{
   const stage=document.querySelector('.stage').getBoundingClientRect();
   const panel=document.querySelector('.panel').getBoundingClientRect();
   const stats=document.querySelector('.stats').getBoundingClientRect();
   return {innerWidth,innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,stageH:stage.height,panelBottom:panel.bottom,statsTop:stats.top,scale:window.__physicsStudio.camera().scale};
  });
  assert(geometry.scrollW<=viewport.width+2,'Geen horizontale scroll: '+JSON.stringify(geometry));
  assert(geometry.scrollH<=viewport.height+2,'Geen verticale scroll: '+JSON.stringify(geometry));
  assert(geometry.stageH>175,'Het veld blijft groot genoeg: '+JSON.stringify(geometry));
  if(!mobile){
   const bottom=await page.evaluate(()=>{
    const r=document.querySelector('.stats').getBoundingClientRect();
    const note=document.querySelector('#measurementNote').getBoundingClientRect();
    return {statsTop:r.top,statsBottom:r.bottom,noteBottom:note.bottom,viewport:innerHeight};
   });
   assert(bottom.statsBottom<=viewport.height+1,'Meetbalk blijft in beeld: '+JSON.stringify(bottom));
   assert(bottom.noteBottom<=bottom.statsBottom-8,'Meetinformatie heeft ruimte onderaan: '+JSON.stringify(bottom));
  }
  assert(geometry.panelBottom<=viewport.height+2,'Instellingen blijven in beeld');
  if(mobile)assert(geometry.panelBottom<=geometry.statsTop+1,'Instellingen blijven boven de meetwaarden');
  assert(await page.locator('#fire').isVisible());
  assert(await page.locator('#edit-angle').isVisible(),'Directe waarde voor angle is zichtbaar');
  assert(await page.locator('#edit-speed').isVisible(),'Directe waarde voor speed is zichtbaar');
  assert(await page.locator('#edit-height').isVisible(),'Directe waarde voor height is zichtbaar');
  assert(await page.locator('#edit-target').isVisible(),'Directe waarde voor target is zichtbaar');
  assert((await page.locator('#statRange').innerText()).includes('—'),'Geen voorspelde waarden voor de eerste worp');
  await page.locator('#field').screenshot({path:'test-results/worp-studio-'+browserType.name()+'-'+viewport.width+'-begin.png'});
  await page.screenshot({path:'test-results/worp-studio-'+browserType.name()+'-'+viewport.width+'-volledig.png'});
  assert(!(await page.locator('#angle').isVisible()),'Schuifregelaar is standaard verborgen');
  await page.locator('.range-pop summary').first().click();
  assert(await page.locator('#angle').isVisible(),'Schuifregelaar is na uitklappen beschikbaar');
  await page.locator('.range-pop summary').first().click();
  await page.locator('#fire').click();
  await page.waitForFunction(()=>window.__physicsStudio.state.trials.length===1,null,{timeout:12000});
  const result=await page.evaluate(()=>{
   const s=window.__physicsStudio.state;
   return {t:s.trials[0],playing:s.playing,stats:document.querySelector('#statRange').innerText};
  });
  assert(Math.abs(result.t.range-324/9.81)<.001,'Het bereik volgt de baanformule');
  assert(Math.abs(result.t.peak-(324*.5)/(2*9.81))<.001,'Het hoogste punt volgt de baanformule');
  assert(!result.playing&&result.stats.includes('m'),'Meetwaarden verschijnen na de worp');
  assert((await page.locator('#status').innerText()).includes('voorbij'),'Terugkoppeling van de eerste worp klopt');
  await page.screenshot({path:'test-results/worp-studio-'+browserType.name()+'-'+viewport.width+'-na-worp.png'});
  if(!mobile){
   const bottom=await page.evaluate(()=>{
    const r=document.querySelector('.stats').getBoundingClientRect();
    const note=document.querySelector('#measurementNote').getBoundingClientRect();
    return {statsBottom:r.bottom,noteBottom:note.bottom};
   });
   assert(bottom.noteBottom<=bottom.statsBottom-8,'Volledige toelichting na de worp blijft in beeld: '+JSON.stringify(bottom));
  }
  await page.locator('#viewGraph').click();
  assert.equal(await page.locator('#viewGraph').getAttribute('aria-pressed'),'true');
  await page.locator('#field').screenshot({path:'test-results/worp-studio-'+browserType.name()+'-'+viewport.width+'-grafiek.png'});
  await page.locator('#viewField').click();
  await page.locator('[data-key="height"][data-delta=".5"]').click();
  const raised=await page.evaluate(()=>window.__physicsStudio.values(window.__physicsStudio.state));
  assert(raised.range>result.t.range&&raised.peak>result.t.peak,'Hogere start geeft een groter bereik en hogere top');
  await page.locator('#edit-target').fill('29');await page.locator('#edit-target').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>window.__physicsStudio.state.target),29,'Mat is via de regelaar te verplaatsen');
  await page.locator('[data-g="1.62"]').click();
  assert.equal(await page.locator('[data-g="1.62"]').getAttribute('aria-pressed'),'true');
  const moon=await page.evaluate(()=>window.__physicsStudio.values(window.__physicsStudio.state));
  assert(moon.range>result.t.range*5,'Zwaartekracht heeft effect op de baan');
  assert((await page.locator('#statRange').innerText()).includes('33,0'),'Oude meetwaarde blijft staan');
  if(!mobile){
   await page.locator('#forecast').click();
   assert.equal(await page.locator('#forecast').getAttribute('aria-pressed'),'true');
  }else{
   assert(!(await page.locator('#forecast').isVisible()),'Uitgebreide voorspelling blijft buiten de compacte telefoonbediening');
  }
  await page.locator('#reset').click();
  assert.equal(await page.locator('#statRange').innerText(),'—');
  assert.equal(await page.evaluate(()=>window.__physicsStudio.state.height),0);
  assert.equal(await page.evaluate(()=>window.__physicsStudio.state.target),24);
  const aim=await page.evaluate(()=>{
   const r=document.querySelector('#field').getBoundingClientRect(),s=window.__physicsStudio.state,c=window.__physicsStudio.camera();
   const radius=52+(s.speed-5)/30*100;
   return {x:r.left+c.ox+radius*Math.cos(s.angle*Math.PI/180),y:r.top+c.oy-9-radius*Math.sin(s.angle*Math.PI/180)};
  });
  await page.mouse.move(aim.x,aim.y);await page.mouse.down();await page.mouse.move(aim.x+15,aim.y+15,{steps:7});await page.mouse.up();
  const moved=await page.evaluate(()=>({angle:window.__physicsStudio.state.angle,speed:window.__physicsStudio.state.speed}));
  assert(moved.angle!==45||moved.speed!==18,'Richten verandert de werkelijke parameters');
  const mat=await page.evaluate(()=>{
   const r=document.querySelector('#field').getBoundingClientRect(),c=window.__physicsStudio.camera(),s=window.__physicsStudio.state;
   return {x:r.left+c.ox+s.target*c.scale,y:r.top+c.oy-8};
  });
  await page.mouse.move(mat.x,mat.y);await page.mouse.down();await page.mouse.move(mat.x+46,mat.y,{steps:9});await page.mouse.up();
  const target=await page.evaluate(()=>window.__physicsStudio.state.target);
  assert(Math.abs(target-24)>.5,'De landingsmat is versleepbaar');
  assert.deepEqual(errors,[],'Geen JavaScript-fouten');
  await page.close();
  console.log(browserType.name()+' '+viewport.width+'px: één scherm, experiment, data, grafiek en directe bediening geslaagd');
 }
}finally{if(browser)await browser.close();server.kill();}
