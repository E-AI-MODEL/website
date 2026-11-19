import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base='http://127.0.0.1:8765';
mkdirSync('test-results/topo',{recursive:true});
const engine=process.env.TOPO_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
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
 // TOPO SHUFFLE must mix water, provinces, facts and close-up map tasks.
 const sh=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 sh.on('pageerror',error=>failures.push('shuffle: '+error.message));
 await sh.goto(base+'/topo/instellingen/',{waitUntil:'domcontentloaded'});
 await sh.locator('[data-tab=practice]').click();
 await sh.locator('[data-group=types][data-value=shuffle]').click();
 assert.equal(await sh.locator('.province[aria-pressed=true]').count(),12,'Shuffle must select the whole country');
 assert.match(await sh.locator('#go').textContent(),/TOPO SHUFFLE/);
 await sh.locator('#go').click();
 await sh.waitForURL(/topo\/nederland\/.*mode=shuffle/);
 await sh.locator('#loading').waitFor({state:'hidden',timeout:12000});
 let waters=0,brain=0,zoomed=0,provinces=0,noMap=0;
 const initialPrompts=new Set();
 for(let step=0;step<45;step++){
  if(await sh.locator('#end').isVisible())break;
  const kind=(await sh.locator('#kind').textContent()).trim();
  const prompt=(await sh.locator('#prompt').textContent()).trim();
  if(kind!=='NOG EENS!'){
   initialPrompts.add(prompt);
   if(kind==='WATEREN')waters++;
   if(kind==='ZONDER KAART')brain++;
   if(kind==='INGEZOOMD'){
    zoomed++;
    const svg=sh.locator('#map svg');assert.equal(await svg.count(),1,'Zoom needs a map');
    const view=await svg.getAttribute('viewBox');
    assert.ok(Number(view.split(' ')[2])<=440,'Zoom must actually be close');
    if(zoomed===1)await sh.screenshot({path:'test-results/topo/shuffle-zoom.png',fullPage:true});
   }
   if(/provincie/i.test(prompt))provinces++;
  }
  if(kind==='WATEREN'||kind==='ZONDER KAART'){
   noMap++;
   assert.equal(await sh.locator('.game-board').evaluate(e=>getComputedStyle(e).display),'none','Fact question must hide the map');
   assert.equal(await sh.locator('#answerOptions button.option').count(),4,'Fact question needs four choices');
   if(noMap===1)await sh.screenshot({path:'test-results/topo/shuffle-nomap.png',fullPage:true});
  }
  await sh.locator('#skip').click();
  await sh.locator('#next').click();
 }
 assert.ok(await sh.locator('#end').isVisible(),'Shuffle round does not finish');
 assert.equal(waters,2,'Shuffle must include two water questions');
 assert.ok(brain>=1,'Shuffle must include a question without the map');
 assert.ok(zoomed>=1,'Shuffle must include a zoom challenge');
 assert.ok(provinces>=1,'Shuffle must include a province question');
 console.log('TOPO SHUFFLE PASS '+JSON.stringify({waters,brain,zoomed,provinces,uniqueQuestions:initialPrompts.size}));
 await sh.close();

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
 console.log('TOPO MOBILE PASS '+(process.env.TOPO_BROWSER||'chromium'));
}catch(error){console.error('TOPO MOBILE FAIL: '+error.stack);process.exitCode=1}
finally{await browser.close()}
