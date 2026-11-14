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
  assert(await page.locator('#layerMenu').isVisible(),'Lagen staat direct bij het hart');
  assert.equal(await page.locator('#layerMenu').getAttribute('open'),null,'De laagkeuze start gesloten');
  assert.equal(await page.locator('#moreTools').getAttribute('open'),null,'Extra functies staan in één gesloten menu');
  assert.equal(await page.locator('#quickMeasurements').getAttribute('open'),null,'Grafieken nemen niet standaard ruimte in');
  assert(await page.locator('#miniTrace').isHidden(),'De compacte grafiek is op aanvraag zichtbaar');
  assert(await page.locator('#storyTitle').isVisible(),'De uitleg blijft in beeld');
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom');
  assert.equal((await state(page)).mode,'watch');
  assert(await page.locator('#guideStart').isVisible(),'Stapsgewijze uitleg is direct bereikbaar');
  assert(await page.locator('#exploreStart').isVisible(),'Vrij onderzoeken is direct bereikbaar');
  assert(await page.locator('#guideNavigation').isHidden(),'Stapknoppen zijn pas zichtbaar in de uitleg');
  assert(await page.locator('#storyStatus').isHidden(),'De snelle klepstanden staan niet in de gewone loop');
  assert.equal(await page.locator('#storySteps').count(),0,'Geen dubbele fasennavigatie');
  assert.equal(await page.locator('#storyProgress').count(),0,'Eén tijdlijn is voldoende');
  assert(!await page.locator('#layerMenu [data-layer]').first().isVisible(),'De keuze staat achter Lagen');
  await page.locator('#quickMeasurements > summary').click();
  assert((await page.locator('#miniTrace').boundingBox()).width>400,'Grafiek verschijnt wanneer geopend');
  await page.locator('#quickMeasurements > summary').click();
  const motion=await page.evaluate(()=>window.__EAI_HEART_LAB__.motion);
  assert.equal(motion.valveParts.length,4,'Alle vier echte klepmeshes beschikbaar');
  assert.equal(motion.flowRoutes,6,'Beide bloedroutes aanwezig');
  assert(Math.abs(motion.playbackSeconds-3.2)<.01,'Standaard 3,2 seconden per hartslag');
  assert.equal(initial.playing,true,'De doorlopende animatie start vanzelf zonder verminderde-bewegingsvoorkeur');
  await page.locator('#play').click();
  assert.equal((await state(page)).playing,false,'Pauzeknop stopt het hart');
  await setTime(page,.30);
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom',
    'De tekst moet tijdens de gewone hartslag leesbaar blijven');
  assert(await page.locator('#storyStatus').isHidden(),'Klepstanden zijn voor de uitleg per stap');
  let metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.av&&!metrics.sem&&metrics.pressure<20);
  const filling=await page.locator('#heartCanvas').screenshot();
  await setTime(page,.67);
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom',
    'De uitleg mag niet in 0,19 seconde verspringen');
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&!metrics.sem&&metrics.volume===130);
  await setTime(page,.8);
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom');
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.sem&&!metrics.av&&metrics.pressure>90);
  const pumping=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(filling,pumping,'Anatomisch hart moet mee bewegen met de fase');
  const progressed=await page.locator('#scrub').inputValue();
  assert(Math.abs(Number(progressed)-800)<=1,'De tijdlijn volgt de fase zonder tweede voortgangsbalk');

  // Bij vijf stopmomenten is er tijd om de uitleg rustig te lezen.
  const guide=await page.evaluate(()=>window.__EAI_HEART_LAB__.guide);
  assert.equal(guide.length,5,'Vijf verschillende leermomenten');
  await page.locator('#guideStart').click();
  let stepState=await state(page);
  assert.equal(stepState.mode,'steps');
  assert.equal(stepState.guideStep,0);
  assert.equal(stepState.playing,false);
  assert(Math.abs(stepState.t-guide[0].at)<.001);
  assert(await page.locator('#transport').isHidden(),'Tijdschuif maakt plaats voor stappen');
  assert(await page.locator('#storyStatus').isVisible());
  assert.match(await page.locator('#guidedFocus').textContent(),/Kleppen tussen boezems/);
  assert(await page.locator('#guidePrevious').isDisabled());
  const firstFrame=await page.locator('#heartCanvas').screenshot();
  for(let i=1;i<5;i++){
    await page.locator('#guideNext').click();
    stepState=await state(page);
    assert.equal(stepState.mode,'steps');
    assert.equal(stepState.guideStep,i);
    assert(!stepState.playing,'De leermodus speelt niet automatisch door');
    assert(Math.abs(stepState.t-guide[i].at)<.001,'De fase hoort bij de bronberekening');
    assert.equal(await page.locator('#storyTitle').textContent(),guide[i].title);
  }
  assert.match(await page.locator('#storyText').textContent(),/kamers ontspannen/i);
  assert.notDeepEqual(firstFrame,await page.locator('#heartCanvas').screenshot(),
    'De begeleide kleuren en anatomische beweging veranderen per fase');
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-stap-5.png',fullPage:true});
  await page.locator('#guideNext').click();
  assert.equal((await state(page)).guideStep,0,'De stapweergave kan opnieuw beginnen');
  await page.locator('#guideExit').click();
  assert.equal((await state(page)).mode,'watch');
  assert(await page.locator('#guideNavigation').isHidden());
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom');
  await page.locator('#exploreStart').click();
  assert.equal((await state(page)).mode,'explore');
  assert.equal((await state(page)).playing,false);
  assert.match(await page.locator('#storyText').textContent(),/Sleep om het hart te draaien/);
  await page.locator('#exploreStart').click();
  assert.equal((await state(page)).mode,'watch');
  assert.equal((await state(page)).playing,true);
  await page.locator('#play').click();

  // Bewijs dat afspelen doorloopt over de overgang 100% -> 0%.
  await setTime(page,.98);
  await page.locator('#play').click();
  await page.waitForTimeout(520);
  const wrapped=await state(page);
  assert(wrapped.playing&&wrapped.t<.35,'Hartslag moet vanzelf opnieuw beginnen');
  await page.locator('#play').click();

  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-desktop.png',fullPage:true});
  const initialIds=await page.evaluate(()=>window.__EAI_HEART_LAB__.visibleAtlasPartIds);
  assert.equal(initialIds.length,30,'Vier bloedruimtes van de 34 zijn geen zichtbaar oppervlak');
  const beforeLayers=await page.locator('#heartCanvas').screenshot();
  await page.locator('#layerMenu > summary').click();
  assert(await page.locator('[data-layer="wall"]').isVisible(),'Lagen kunnen direct worden gekozen');
  await page.locator('#stage').screenshot({path:'test-results/hartslaglab-'+engine+'-desktop-lagen.png'});
  assert.equal(await page.locator('#layerMenu .layer-switch').count(),7);
  for(const [layer,count,id] of [
    ['wall',3,'ra_wall'],['valve',4,'mitral'],['papillary',2,'pap_lv'],
    ['vessel',12,'ao'],['coronary',9,'lca']
  ]){
    const button=page.locator('[data-layer="'+layer+'"]');
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'false','Layerstatus volgt '+layer);
    const ids=await page.evaluate(()=>window.__EAI_HEART_LAB__.visibleAtlasPartIds);
    assert(!ids.includes(id),'Verborgen '+layer+' mag niet getekend worden');
    assert.equal(await page.evaluate(targetId=>window.__EAI_HEART_LAB__.hitTargets.some(p=>p.id===targetId),id),false,
      'Verborgen '+layer+' mag niet aanklikbaar blijven');
    assert.equal(initialIds.length-ids.length,count,'De atlaslaag moet het verwachte aantal meshes verbergen');
    await button.click();
  }
  const noWallButton=page.locator('[data-layer="wall"]');
  await noWallButton.click();
  assert.notDeepEqual(beforeLayers,await page.locator('#heartCanvas').screenshot(),
    'Lagen moeten het 3D-model echt veranderen');
  await page.locator('#resetLayers').click();
  assert.equal((await page.evaluate(()=>window.__EAI_HEART_LAB__.visibleAtlasPartIds)).length,30);
  await page.locator('[data-layer="flow"]').click();
  assert.equal((await state(page)).showFlow,false,'Stroomrichting kan uit');
  await page.locator('[data-layer="flow"]').click();
  await page.locator('#layerMenu > summary').click();
  await page.locator('#moreTools > summary').click();
  await page.locator('#heartOptions > summary').click();
  assert(await page.locator('#heartOptions').evaluate(el=>el.open),'Onderzoeksinstellingen zijn toegankelijk');
  assert(!await page.locator('#flowToggle').isVisible(),'Stroomrichting is geen dubbele instelling');
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
  // De laagkeuze blijft buiten de geavanceerde instellingen.
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
  assert(await mobile.locator('#storyTitle').isVisible(),'Leerling ziet het doel zonder tabblad');
  assert.equal(await mobile.locator('#storyTitle').textContent(),'Volg de bloedstroom');
  assert(await mobile.locator('#guideStart').isVisible(),'De uitleg per stap is direct bereikbaar');
  assert(await mobile.locator('#layerMenu').isVisible(),'Lagen is direct beschikbaar op mobiel');
  assert(!await mobile.locator('[data-layer="wall"]').isVisible(),'De lagen staan niet standaard in beeld');
  assert(await mobile.locator('#quickMeasurements > summary').isVisible(),'Druk en volume blijven opvraagbaar');
  assert(await mobile.locator('#miniTrace').isHidden(),'De grafiek staat niet standaard onder het hart');
  assert(!await mobile.locator('#moreTools > summary').isHidden(),'Extra functies blijven vindbaar');
  assert(await mobile.locator('#labels [data-part="ra"]').isHidden(),'Namen starten verborgen op mobiel');
  const layout=await mobile.evaluate(()=>{
    const heart=document.querySelector('#stage').getBoundingClientRect();
    const play=document.querySelector('#play').getBoundingClientRect();
    const text=document.querySelector('.phase-story').getBoundingClientRect();
    return {scroll:document.documentElement.scrollWidth,inner:innerWidth,
      stageHeight:heart.height,playBelow:play.top>=text.bottom-2,
      storyBelow:text.top>=heart.bottom-2};
  });
  assert(layout.scroll<=layout.inner+6,'Geen horizontale overflow op mobiel: '+JSON.stringify(layout));
  assert(layout.stageHeight>=350,'Hartmodel groot genoeg op telefoon');
  assert(layout.playBelow&&layout.storyBelow,'Het hart staat eerst, met uitleg en bediening eronder');
  await mobile.screenshot({path:'test-results/hartslaglab-'+engine+'-mobile.png',fullPage:true});
  await mobile.locator('#guideStart').click();
  assert.equal((await state(mobile)).mode,'steps','De leermodus werkt met aanraking');
  assert(await mobile.locator('#guideNext').isVisible(),'Volgende stap staat direct bij de tekst');
  await mobile.locator('#guideNext').click();
  assert.equal((await state(mobile)).guideStep,1);
  await mobile.locator('#guideExit').click();
  assert.equal((await state(mobile)).mode,'watch');
  await mobile.locator('#play').click();
  assert.equal((await state(mobile)).playing,false,'Pauzeren werkt met aanraking');
  await mobile.locator('#layerMenu > summary').click();
  assert(await mobile.locator('[data-layer="valve"]').isVisible(),'Mobiele lagen zijn bereikbaar');
  await mobile.locator('#stage').screenshot({path:'test-results/hartslaglab-'+engine+'-mobile-lagen.png'});
  await mobile.locator('[data-layer="valve"]').click();
  assert.equal((await state(mobile)).layers.valve,false,'Hartkleppen kunnen verborgen worden');
  await mobile.locator('[data-layer="valve"]').click();
  await mobile.locator('[data-layer="labels"]').click();
  assert.equal((await state(mobile)).showLabels,true);
  await mobile.waitForFunction(()=>document.querySelectorAll('#labelLeaders .leader-path:not([hidden])').length>=4);
  await mobile.locator('[data-layer="labels"]').click();
  await mobile.locator('#layerMenu > summary').click();
  await mobile.locator('#moreTools > summary').click();
  await mobile.locator('#heartOptions > summary').click();
  await mobile.locator('[data-heart-side="right"]').click();
  assert.equal((await state(mobile)).focusSide,'right');
  const right=await mobile.locator('#heartCanvas').screenshot();
  await mobile.locator('[data-heart-side="left"]').click();
  const left=await mobile.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(right,left,'Harthelften verschillen');
  await mobile.locator('[data-heart-side="both"]').click();
  assert.equal((await state(mobile)).focusSide,'both','Beide bloedroutes kunnen terugkomen');
  await setTime(mobile,0);
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
