import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const origin='http://127.0.0.1:8794';
const server=spawn('python3',['-m','http.server','8794','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function goMode(page,mode){
 await page.evaluate(mode=>document.querySelector('[data-mode="'+mode+'"]').click(),mode);
 await sleep(80);
}
async function dragSky(page,initialX,finalX,relativeY){
 const box=await page.locator('#universe').boundingBox();
 assert(box&&box.height>200,'Melkweg canvas ontbreekt');
 await page.mouse.move(box.x+box.width*initialX,box.y+box.height*relativeY);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width*finalX,box.y+box.height*relativeY,{steps:12});
 await page.mouse.up();
 await sleep(70);
}
async function numeric(page,id){return Number(await page.locator('#'+id).inputValue());}
try{
 let ready=false;
 for(let i=0;i<70;i++){try{ready=(await fetch(origin+'/tools/melkweg-lab/')).ok;}catch{}if(ready)break;await sleep(100);}
 assert(ready,'Melkweg Lab ontbreekt');
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[390,760],[320,640],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<850,isMobile:width<850});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tools/melkweg-lab/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:12000});
  assert.equal(await page.locator('#labExpand').count(),1,'Compacte bediening verdween');

  await goMode(page,'dynamics');
  await dragSky(page,.82,.19,.58);
  assert(await numeric(page,'haloMass')<.5,'Onzichtbare massa verandert niet door slepen');
  await dragSky(page,.19,.81,.70);
  assert(await numeric(page,'diskMass')>8.1,'Sterrenmassa verandert niet door slepen');

  await goMode(page,'stars');
  await dragSky(page,.81,.19,.70);
  assert(await numeric(page,'limmag')<13,'Sterrenkijker geeft geen zwak beeld');
  await dragSky(page,.19,.81,.70);
  assert(await numeric(page,'limmag')>19,'Sterrenkijker geeft geen sterk beeld');
  // Pak ook de getekende kijker vast, niet uitsluitend de balk.
  const canvas=await page.locator('#universe').boundingBox();
  await page.mouse.move(canvas.x+canvas.width*.56,canvas.y+canvas.height*.40);
  await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width*.12,canvas.y+canvas.height*.40,{steps:9});
  await page.mouse.up();
  assert(await numeric(page,'limmag')<13,'Getekende kijker reageert niet op slepen');

  await goMode(page,'gaia');
  await dragSky(page,.82,.19,.58);
  assert(await numeric(page,'obDist')<3,'Sterafstand verandert niet');
  await dragSky(page,.19,.81,.58);
  assert(await numeric(page,'obDist')>17,'Sterafstand ver weg verandert niet');
  await dragSky(page,.19,.81,.70);
  assert(await numeric(page,'obVt')>320,'Snelheid reageert niet');

  await goMode(page,'structure');
  await dragSky(page,.19,.81,.70);
  assert(await numeric(page,'pitch')>20,'Spiraalvorm reageert niet');

  await goMode(page,'blackhole');
  const bh=await page.locator('#universe').boundingBox();
  // Gebruik de werkelijke getekende S2-baan: van dichtbij het zwarte gat
  // naar de verre kant van de ellips, op elk formaat.
  const scale=Math.min(bh.width*.36,bh.height*.43)/1600;
  const startX=bh.x+bh.width*.53+1035*(1-.88)*.92*scale;
  const startY=bh.y+bh.height*.555-1035*(1-.88)*.39*.64*scale;
  const farX=bh.x+bh.width*.53-1035*(1+.88)*.92*scale;
  const farY=bh.y+bh.height*.555+1035*(1+.88)*.39*.64*scale;
  await page.mouse.move(startX,startY);
  await page.mouse.down();
  await page.mouse.move(farX,farY,{steps:12});
  await page.mouse.up();
  const after=Number(await page.locator('#timeslider').inputValue());
  assert(Math.abs(after-8)<1.25,'S2 komt na slepen niet op de verre baanpositie: '+after);
  await page.getByRole('tab',{name:'Ontdek meer'}).click();
  await page.locator('#graphToggle').click();
  assert(await page.locator('.analytics-main').isVisible(),'Grafiekknop toont niets');
  if(width<850) await page.locator('#closeGraph').click();
  else await page.locator('#graphToggle').click();
  assert(!await page.locator('.analytics-main').isVisible(),'Grafiek sluit niet');
  await page.locator('#resetView').click();
  assert(Number(await page.locator('#timeslider').inputValue())===0,'Herstelknop herstelt tijd niet');

  await goMode(page,'atlas');
  await page.locator('#solarEntry').click();
  assert(await page.locator('#solarExplorer').isVisible(),'Planetenknop reageert niet');
  assert.equal(await page.locator('#planetChoices .planet-pick').count(),8);
  await page.locator('#planetChoices [data-planet="2"]').click();
  const solarBox=await page.locator('#solarCanvas').boundingBox();
  const w=solarBox.width,h=solarBox.height,cx=w<580?w*.48:w*.49,cy=h<550?h*.43:h*.52;
  const maxR=Math.max(78,Math.min((w-65)/2,(h-180)/1.09,310));
  const rr=maxR*(.15+.85*Math.pow(2/7,1.04)),ratio=h<490?.39:.53,angle=-.67;
  const x=cx+Math.cos(angle)*rr,y=cy+Math.sin(angle)*rr*ratio;
  const oldTime=await page.locator('#solarYearLabel').innerText();
  await page.mouse.move(solarBox.x+x,solarBox.y+y);
  await page.mouse.down();
  await page.mouse.move(solarBox.x+cx-rr*.3,solarBox.y+cy+rr*ratio*.8,{steps:15});
  await page.mouse.up();
  const newTime=await page.locator('#solarYearLabel').innerText();
  assert.notEqual(oldTime,newTime,'Een planeet slepen verandert de tijd niet');
  await page.locator('#backGalaxy').click();
  assert(!await page.locator('#solarExplorer').isVisible());
  assert.deepEqual(errors,[],'JavaScript-fouten op '+width+': '+errors.join('; '));
  await page.close();
 }
 console.log('Melkweg Lab: slepen van massa, sterrenkijker, afstand, S2 en planeet; grafiek en herstel werken op 320/390/1440.');
}finally{if(browser)await browser.close();server.kill();}
