// Controleer de directe proefjes in de sterrenkaart, niet alleen de aanwezigheid van knoppen.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(process.argv[2]||'site-build'),origin='http://127.0.0.1:8794';
const server=spawn('python3',['-m','http.server','8794','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
try {
 let ready=false;
 for(let i=0;i<70;i++){try{ready=(await fetch(origin+'/tools/melkweg-lab/')).ok;}catch{}if(ready)break;await pause(100)}
 assert(ready,'Melkweg Lab ontbreekt in de websitebuild');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:760},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/tools/melkweg-lab/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,view:innerHeight,stage:document.querySelector('.stage').getBoundingClientRect().height}));
 assert(metrics.height<=metrics.view+1,'De hoofdpagina mag niet scrollen op mobiel');
 assert(metrics.stage>250,'Het sterrenbeeld moet groot blijven');
 assert((await page.locator('.inspector').boundingBox()).height<=125,'Het compacte onderste paneel is verdwenen');
 assert.equal(await page.locator('.quest-action').count(),0,'Een antwoordknop lost de proef nog op');

 async function mode(name){
  await page.locator('#adventureMenuToggle').click();
  await page.locator('.navlist [data-mode="'+name+'"]').click();
  await page.waitForTimeout(120);
 }
 async function drag(y,start=.81,end=.19){
  const b=await page.locator('#universe').boundingBox();
  const sy=b.y+b.height*y;
  await page.mouse.move(b.x+b.width*start,sy);
  await page.mouse.down();await page.mouse.move(b.x+b.width*end,sy,{steps:8});await page.mouse.up();
  await page.waitForTimeout(90);
 }
 async function value(id){
  await page.getByRole('tab',{name:'Verander'}).click();
  const v=Number(await page.locator('#'+id).inputValue());
  await page.getByRole('tab',{name:'Probeer'}).click();
  return v;
 }

 await mode('dynamics');
 await page.locator('#play').click();
 await drag(.58);
 assert((await value('haloMass'))<.5,'Slepen in de kaart verandert de massa niet');
 assert((await page.locator('#toast').innerText()).length>18,'Geen betekenisvolle ontdekfeedback na eigen handeling');
 await drag(.70,.19,.81);
 assert((await value('diskMass'))>=8.2,'De tweede massagreep heeft geen effect');

 await mode('stars');
 await drag(.70);
 assert((await value('limmag'))<=12.5,'Sterrenkijker verandert niet bij slepen');
 await drag(.70,.19,.81);
 assert((await value('limmag'))>=20,'Sterrenkijker kan niet sterker');

 await mode('gaia');
 await drag(.58);
 assert((await value('obDist'))<2.5,'De ster komt niet dichterbij');
 await drag(.58,.19,.81);
 assert((await value('obDist'))>17,'De ster gaat niet verder weg');
 await drag(.70,.19,.81);
 assert((await value('obVt'))>320,'Snelheid verandert niet in de kaart');

 await mode('structure');
 await drag(.70,.19,.81);
 assert((await value('pitch'))>=21,'De spiraalarmen kunnen niet veranderd worden');

 await mode('blackhole');
 await page.locator('#play').click();
 const before=Number(await page.locator('#timeslider').inputValue());
 const box=await page.locator('#universe').boundingBox();
 await page.mouse.move(box.x+box.width*.23,box.y+box.height*.45);
 await page.mouse.down();await page.mouse.move(box.x+box.width*.70,box.y+box.height*.37,{steps:12});await page.mouse.up();
 const after=Number(await page.locator('#timeslider').inputValue());
 assert(Math.abs(after-before)>.1,'Ster S2 is niet te verslepen');

 await page.getByRole('tab',{name:'Ontdek meer'}).click();
 await page.locator('#graphToggle').click();
 assert(await page.locator('.analytics-main').isVisible(),'Grafiekknop is op mobiel nog steeds dood');
 assert((await page.locator('.analytics').boundingBox()).height>180,'Grafiek is niet zichtbaar');
 await page.locator('#closeGraph').click();
 assert(!await page.locator('.analytics-main').isVisible(),'De grafiek sluit niet');

 await mode('atlas');
 await page.locator('#solarEntry').click();
 assert(await page.locator('#solarExplorer').isVisible(),'Planetenreis werkt niet');
 assert.equal(await page.locator('.planet-pick').count(),8);
 await page.locator('[data-planet="3"]').click();
 assert.equal(await page.locator('#planetDetail h2').innerText(),'Mars');
 await page.locator('[data-planet="2"]').click();
 const earthPos=await page.evaluate(()=>{
  const c=document.querySelector('#solarCanvas'),r=c.getBoundingClientRect();
  const w=r.width,h=r.height,cx=w<580?w*.48:w*.49,cy=h<550?h*.43:h*.52,rr=Math.max(78,Math.min((w-65)/2,(h-180)/1.09,310))*(.15+.85*Math.pow(2/7,1.04));
  const phase=-.67,ratio=h<490?.39:.53;
  return {x:r.x+cx+Math.cos(phase)*rr,y:r.y+cy+Math.sin(phase)*rr*ratio,cx:r.x+cx,cy:r.y+cy,rr,ratio};
 });
 const yearBefore=await page.locator('#solarYearLabel').innerText();
 await page.mouse.move(earthPos.x,earthPos.y);
 await page.mouse.down();
 await page.mouse.move(earthPos.cx-earthPos.rr*.3,earthPos.cy+earthPos.rr*earthPos.ratio*.8,{steps:16});
 await page.mouse.up();
 assert.notEqual(await page.locator('#solarYearLabel').innerText(),yearBefore,'Een planeet slepen verandert de tijd niet');
 await page.locator('#backGalaxy').click();
 assert(!await page.locator('#solarExplorer').isVisible());
 assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join('; '));
 mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/melkweg-lab-direct-touch.png'});
 console.log('Melkweg Lab: directe massa-, kijker-, afstand-, baan- en planeetproeven werken op mobiel.');
 await page.close();
} finally {if(browser)await browser.close();server.kill();}
