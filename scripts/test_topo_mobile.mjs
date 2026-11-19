import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base='http://127.0.0.1:8765';
mkdirSync('test-results/topo',{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[];
async function scenario(label,url,adjust){
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',error=>failures.push(label+': pageerror '+error.message));
 try{
  await page.goto(base+url,{waitUntil:'domcontentloaded'});
  await adjust(page);
  const map=page.locator('#map svg');
  await map.waitFor({timeout:12000});
  const provinceCount=await page.locator('.province-shape').count();
  if(label==='nederland')assert.equal(provinceCount,12,'Landelijke kaart mist een provincie');
  else assert.ok((await page.locator('#map .map-art').count())>0,'Noordelijke kaart ontbreekt');
  for(let step=0;step<9;step++){
   const form=page.locator('#typeForm');
   if(await form.count())break;
   if(!(await page.locator('#skip').isVisible()))throw new Error('Geen typevraag binnen de ronde');
   await page.locator('#skip').click();
   await page.locator('#next').click();
  }
  assert.ok(await page.locator('#typeForm').count(),'Geen typevraag gevonden');
  await page.locator('#typedAnswer').focus();
  await page.setViewportSize({width:390,height:430});
  await page.waitForTimeout(150);
  const result=await page.evaluate(()=>{
   const rect=id=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width}};
   return {keyboard:document.body.classList.contains('keyboard-open'),q:rect('prompt'),input:rect('typedAnswer'),check:document.querySelector('.type-submit').getBoundingClientRect().toJSON(),map:rect('map'),height:window.visualViewport?.height||window.innerHeight};
  });
  console.log(label+' '+JSON.stringify(result));
  assert.ok(result.keyboard,'Keyboard state ontbreekt');
  assert.ok(result.input.bottom<=result.height+7,'Typveld wordt afgesneden');
  assert.ok(result.check.bottom<=result.height+7,'CHECK wordt afgesneden');
  assert.ok(result.map.height>=75,'Kaart is te klein met toetsenbord');
  await page.screenshot({path:'test-results/topo/'+label+'-keyboard.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#typedAnswer').fill('Denktest');
  await page.screenshot({path:'test-results/topo/'+label+'-normal.png',fullPage:true});
 }finally{await page.close();}
}
try{
 await scenario('noord','/topo/',async page=>{
  if(await page.locator('#privacyLayer').isVisible())await page.locator('#privacyOk').click();
  await page.locator('#start').click();
 });
 await scenario('nederland','/topo/nederland/?prov=Groningen%2CFriesland%2CDrenthe%2COverijssel%2CFlevoland%2CGelderland%2CUtrecht%2CNoord-Holland%2CZuid-Holland%2CZeeland%2CNoord-Brabant%2CLimburg&topics=provinces%2Ccities%2Ccapitals',async page=>{await page.locator('#loading').waitFor({state:'hidden',timeout:12000});});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(base+'/topo/instellingen/');
 await page.locator('[data-zone=all]').click();
 assert.equal(await page.locator('.province[aria-pressed=true]').count(),12,'Niet alle provincies geselecteerd');
 assert.equal(await page.locator('#go').textContent(),'SPELEN! ↗');
 await page.locator('#go').click();
 await page.waitForURL(/topo\/nederland\//);
 console.log('settings to national gameplay OK');
 await page.close();
 if(failures.length)throw Error(failures.join('\n'));
 console.log('TOPO MOBILE PASS');
}catch(error){console.error('TOPO MOBILE FAIL: '+error.stack);process.exitCode=1}
finally{await browser.close()}
