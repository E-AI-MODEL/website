// Test echte wijzigingen door aanraken en verslepen, niet alleen klikbare knoppen.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(process.argv[2]||'site-build'), origin='http://127.0.0.1:8794';
const server=spawn('python3',['-m','http.server','8794','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for (let i=0;i<60;i++) {
    try {ready=(await fetch(origin+'/tools/melkweg-lab/')).ok;} catch {}
    if (ready) break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert(ready,'Melkweg Lab niet beschikbaar in de sitebuild');
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:760},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tools/melkweg-lab/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  const nav=async mode=>{await page.locator('#adventureMenuToggle').click();await page.locator('.nav-btn[data-mode="'+mode+'"]').click();};
  const gesture=async(y,from=.81,to=.19)=>{
    const b=await page.locator('#universe').boundingBox();
    assert(b&&b.height>200,'Sterrenkaart te klein');
    await page.mouse.move(b.x+b.width*from,b.y+b.height*y);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width*to,b.y+b.height*y,{steps:10});
    await page.mouse.up();
  };
  const discovered=async label=>{
    await page.waitForFunction(()=>{let n=document.querySelector('#quest-result');return n&&!n.hidden;});
    const result=await page.locator('#quest-result').innerText();
    assert(result.includes('Hé, kijk nou!'),label+': ontdekking ontbreekt');
  };
  // Massa en rotatiesnelheid veranderen rechtstreeks door slepen in de sterrenkaart.
  await nav('dynamics');
  await page.locator('#play').click(); // Stilzetten voor herkenbare vergelijking
  await gesture(.58);
  await discovered('Massa');
  // Sterrenkijker beïnvloedt het zichtbare sterrenveld.
  await nav('stars');
  await gesture(.70);
  await discovered('Sterrenkijker');
  // Parallax/afstand: pak de afstand op het beeld vast.
  await nav('gaia');
  await gesture(.58);
  await discovered('Afstand');
  // Onzichtbare knop uit versie 7 mag niet opnieuw terugkomen.
  assert.equal(await page.locator('.quest-action:visible').count(),0,'Proef wordt nog steeds door een automatische antwoordknop opgelost');
  // Grafiek moet echt zichtbaar worden, ook op een telefoon.
  await page.getByRole('tab',{name:'Ontdek meer'}).click();
  await page.locator('#graphToggle').click();
  assert(await page.locator('.analytics-main').isVisible(),'Grafiekknop doet niets op mobiel');
  await page.screenshot({path:'test-results/melkweg-experiment-grafiek.png'});
  await page.locator('#closeGraph').click();
  assert(!(await page.locator('.analytics-main').isVisible()),'Grafiek sluit niet');
  // Reset mag niet alleen de camera herstellen.
  await page.locator('#resetView').click();
  await nav('dynamics');
  assert.equal(await page.locator('#quest-result').isVisible(),true,'Vastgelegde ontdekkingen mogen bij reset niet verdwijnen');
  // Zwarte gat: ster langs de baan slepen.
  await nav('blackhole');
  const b=await page.locator('#universe').boundingBox();
  await page.mouse.move(b.x+b.width*.53+7,b.y+b.height*.555);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width*.65,b.y+b.height*.52,{steps:10});
  await page.mouse.up();
  await discovered('Zwarte gat');
  // Planeten zijn echte objecten, geen klik op een afbeelding zonder gevolg.
  await nav('atlas');
  await page.locator('#solarEntry').click();
  assert(await page.locator('#solarExplorer').isVisible());
  await page.locator('#planetChoices [data-planet="3"]').click();
  assert.equal(await page.locator('#planetDetail h2').innerText(),'Mars');
  await page.locator('#backGalaxy').click();
  assert(!(await page.locator('#solarExplorer').isVisible()));
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join('; '));
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/melkweg-experiment-eind.png'});
  console.log('Geslaagd: massa, sterrenkijker, afstand, zwart gat, grafiek, reset en planeetselectie.');
} finally {if(browser)await browser.close();server.kill();}
