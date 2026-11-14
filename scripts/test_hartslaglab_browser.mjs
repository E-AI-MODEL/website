// Browsercontrole: doorlopende anatomische hartslag, faseverhaal en mobiele bediening.
// node scripts/test_hartslaglab_browser.mjs site-build chromium|webkit
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';

const root=resolve(process.argv[2]||'site-build');
const engine=process.argv[3]==='webkit'?'webkit':'chromium';
const port=8897,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const errors=[];
let browser;
const state=p=>p.evaluate(()=>window.__EAI_HEART_LAB__.state);
const setTime=(p,t)=>p.evaluate(t=>window.__EAI_HEART_LAB__.setTime(t),t);

try {
  let ready=false;
  for(let i=0;i<100;i++){
    try {ready=(await fetch(base+'/tools/anatomie/labs/hartslag/')).ok;}catch{}
    if(ready)break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert(ready,'Hartslaglab ontbreekt in de sitebuild');
  browser=await (engine==='webkit'?webkit:chromium).launch({
    headless:true,args:engine==='chromium'?['--use-gl=angle','--use-angle=swiftshader']:[]
  });
  const page=await browser.newPage({viewport:{width:1400,height:920},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__EAI_HEART_LAB__?.state.atlasRich===true,{timeout:40000});
  const initial=await state(page);
  assert(initial.cutaway&&initial.anatomyView&&initial.atlasPartCount===34,'Het echte hart opent vanbinnen');
  assert.equal(initial.focusSide,'both','De rode en blauwe bloedsomloop horen samen in beeld');
  assert(initial.showFlow,'Bloedstroom hoort standaard zichtbaar te zijn');
  assert(await page.locator('#atlasLoading').isHidden(),'Het laadscherm mag de anatomie niet bedekken');
  assert(await page.locator('#play').isEnabled(),'De animatie start alleen als de rijke atlas geladen is');
  assert.equal(await page.locator('#heartOptions').getAttribute('open'),null,'Extra bediening staat dicht');
  assert.equal(await page.locator('#explainMore').getAttribute('open'),null,'Extra uitleg staat dicht');
  assert.equal(await page.locator('#discovery').getAttribute('open'),null,'De vraag onderbreekt de animatie niet');
  assert.equal(await page.locator('#measurements').count(),0);
  assert.equal(await page.locator('.measurements').getAttribute('open'),null);
  assert((await page.locator('#miniTrace').boundingBox()).width>400,'De lopende grafiek staat naast de animatie');
  assert.equal(await page.locator('#storySteps span').count(),5,'De vijf fasen blijven overzichtelijk');
  assert(await page.locator('#storyTitle').isVisible(),'De faseuitleg is direct bereikbaar');
  const motion=await page.evaluate(()=>window.__EAI_HEART_LAB__.motion);
  assert.equal(motion.valveParts.length,4,'Alle vier echte klepmeshes beschikbaar');
  assert.equal(motion.flowRoutes,6,'Beide bloedroutes aanwezig');
  assert(Math.abs(motion.playbackSeconds-3.2)<.01,'Standaard 3,2 seconden per hartslag');
  assert.equal(initial.playing,true,'De doorlopende animatie start vanzelf zonder verminderde-bewegingsvoorkeur');
  await page.locator('#play').click();
  assert.equal((await state(page)).playing,false,'Pauzeknop stopt het hart');
  await setTime(page,.30);
  assert.match(await page.locator('#storyTitle').textContent(),/vullen/i);
  assert.match(await page.locator('#storyRoute').textContent(),/Boezems/);
  assert.match(await page.locator('#storyAV').textContent(),/open/);
  assert.match(await page.locator('#storySL').textContent(),/dicht/);
  let metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.av&&!metrics.sem&&metrics.pressure<20);
  const filling=await page.locator('#heartCanvas').screenshot();
  await setTime(page,.67);
  assert.match(await page.locator('#storyTitle').textContent(),/druk/i);
  assert.match(await page.locator('#storyRoute').textContent(),/druk stijgt/i);
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&!metrics.sem&&metrics.volume===130);
  await setTime(page,.8);
  assert.match(await page.locator('#storyTitle').textContent(),/uitgepompt/i);
  assert.match(await page.locator('#storyRoute').textContent(),/longen/i);
  assert.match(await page.locator('#storySL').textContent(),/open/);
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.sem&&!metrics.av&&metrics.pressure>90);
  const pumping=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(filling,pumping,'Anatomisch hart moet mee bewegen met de fase');
  const progressed=await page.locator('#storyProgress').evaluate(el=>parseFloat(el.style.width));
  assert(progressed>78&&progressed<83,'Voortgangsbalk volgt exact dezelfde hartfase');

  // Bewijs dat afspelen doorloopt over de overgang 100% -> 0%.
  await setTime(page,.98);
  await page.locator('#play').click();
  await page.waitForTimeout(520);
  const wrapped=await state(page);
  assert(wrapped.playing&&wrapped.t<.35,'Hartslag moet vanzelf opnieuw beginnen');
  await page.locator('#play').click();

  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-desktop.png',fullPage:true});
  await page.locator('#heartOptions summary').click();
  assert(await page.locator('#heartOptions').evaluate(el=>el.open),'Opties zijn opengeklapt');
  assert(await page.locator('#flowToggle').isVisible(),'Stroomrichtingen kunnen uitgeschakeld worden');
  const insideFrame=await page.locator('#heartCanvas').screenshot();
  await page.locator('#sectionToggle').click();
  assert.equal((await state(page)).cutaway,false,'Buitenaanzicht blijft beschikbaar');
  const outsideFrame=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(insideFrame,outsideFrame,'Binnenkant en buitenkant zijn andere beelden');
  await page.locator('#sectionToggle').click();
  assert((await state(page)).anatomyView,'Het binnenaanzicht blijft echte anatomie');
  const targets=await page.evaluate(()=>window.__EAI_HEART_LAB__.hitTargets);
  assert(targets.some(x=>x.id==='mitral'&&x.type==='valve'),'Echte kleppen zijn selecteerbaar');
  const target=targets.find(x=>x.id==='mitral'&&x.visible)||targets.find(x=>x.type==='valve'&&x.visible);
  assert(target,'Ten minste één bronklep bereikbaar');
  const box=await page.locator('#heartCanvas').boundingBox();
  await page.mouse.click(box.x+target.x,box.y+target.y);
  assert.equal((await state(page)).selected,target.id,'Selectie hoort de bronmesh te gebruiken');
  assert(await page.locator('#partInfo').isVisible(),'Informatie bij selectie moet verschijnen');
  await page.locator('#flowToggle').click();
  assert.equal((await state(page)).showFlow,false);
  await page.locator('#flowToggle').click();
  // Bij openen van opties scrolt de pagina; meet opnieuw waar het canvas staat.
  await page.locator('#heartCanvas').scrollIntoViewIfNeeded();
  const dragBox=await page.locator('#heartCanvas').boundingBox();
  const before=await state(page);
  await page.mouse.move(dragBox.x+dragBox.width*.48,dragBox.y+dragBox.height*.52);
  await page.mouse.down();
  await page.mouse.move(dragBox.x+dragBox.width*.76,dragBox.y+dragBox.height*.52,{steps:8});
  await page.mouse.up();
  assert(Math.abs((await state(page)).yaw-before.yaw)>.1,'Het hart is draaibaar');
  await page.locator('#resetCamera').click();
  assert(Math.abs((await state(page)).yaw+.2)<.005);

  await page.locator('#explainMore summary').click();
  await page.locator('#tabSourcesBtn').click();
  assert.equal(await page.locator('.source-links a').count(),4,'Bronnen blijven beschikbaar');

  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:engine==='webkit',hasTouch:true
  });
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.__EAI_HEART_LAB__?.state.atlasRich===true,{timeout:40000});
  const m0=await state(mobile);
  assert(m0.cutaway&&m0.anatomyView&&m0.focusSide==='both','Mobiel begint met beide harthelften');
  assert(await mobile.locator('#atlasLoading').isHidden());
  assert(await mobile.locator('#play').isVisible(),'Start en pauze direct bereikbaar');
  assert(await mobile.locator('#storyTitle').isVisible(),'Leerling ziet de hartfase zonder tabblad');
  assert(!await mobile.locator('#flowToggle').isVisible(),'De optionele knoppen blijven ingeklapt');
  assert(await mobile.locator('#miniTrace').isVisible(),'Druk en volume blijven zichtbaar');
  assert(await mobile.locator('#labels [data-part="ra"]').isHidden(),'Namen starten verborgen op mobiel');
  const layout=await mobile.evaluate(()=>{
    const heart=document.querySelector('#stage').getBoundingClientRect();
    const play=document.querySelector('#play').getBoundingClientRect();
    const text=document.querySelector('.phase-story').getBoundingClientRect();
    return {scroll:document.documentElement.scrollWidth,inner:innerWidth,
      stageHeight:heart.height,playAbove:play.bottom<=heart.top+2,
      storyBelow:text.top>=heart.bottom-2};
  });
  assert(layout.scroll<=layout.inner+6,'Geen horizontale overflow op mobiel: '+JSON.stringify(layout));
  assert(layout.stageHeight>=350,'Hartmodel groot genoeg op telefoon');
  assert(layout.playAbove&&layout.storyBelow,'Afspelen boven het hart, uitleg er direct onder');
  await mobile.screenshot({path:'test-results/hartslaglab-'+engine+'-mobile.png',fullPage:true});
  await mobile.locator('#play').click();
  assert.equal((await state(mobile)).playing,false,'Pauzeren werkt met aanraking');
  await mobile.locator('#heartOptions summary').click();
  assert(await mobile.locator('#flowToggle').isVisible());
  await mobile.locator('#labelsToggle').click();
  assert.equal((await state(mobile)).showLabels,true);
  await mobile.waitForFunction(()=>document.querySelectorAll('#labelLeaders .leader-path:not([hidden])').length>=4);
  await mobile.locator('#labelsToggle').click();
  await mobile.locator('[data-heart-side="right"]').click();
  assert.equal((await state(mobile)).focusSide,'right');
  const right=await mobile.locator('#heartCanvas').screenshot();
  await mobile.locator('[data-heart-side="left"]').click();
  const left=await mobile.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(right,left,'Harthelften verschillen');
  await mobile.locator('[data-heart-side="both"]').click();
  assert.equal((await state(mobile)).focusSide,'both','Beide bloedroutes kunnen terugkomen');
  await mobile.locator('#nextPhase').click();
  const next=(await state(mobile)).t;
  assert(next>=.52&&next<.53,'Fasebediening blijft beschikbaar');
  await mobile.locator('#heartOptions summary').click();

  await mobile.locator('#discovery summary').click();
  await mobile.locator('[data-guess="av"]').click();
  await mobile.locator('#discoveryAction').click();
  assert.equal((await state(mobile)).anatomyView,true,'Onderzoek behoudt echte anatomie');
  const guided=await mobile.evaluate(()=>window.__EAI_HEART_LAB__.motion);
  assert(guided.playbackSeconds>=7.5,'Begeleide klepbeweging is vertraagd');
  await mobile.waitForFunction(()=>window.__EAI_HEART_LAB__.state.studyStage==='compare',{timeout:20000});
  await mobile.locator('#discoveryAction').click();
  assert.match(await mobile.locator('#discoveryFeedback').textContent(),/AV-kleppen sluiten eerst/);
  assert.deepEqual(errors,[],'Browserfouten: '+errors.join(' | '));
  console.log('Hartslaglab '+engine+': doorlopende anatomie, hartcyclus, kleurstromen, mobiliteit en rustige UX geslaagd.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
