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
const changedFlowProjection=async(p,previous)=>{
  assert(typeof previous==='string'&&previous.trim().length>0,
    'Een zichtbare bloedstroombaan is nodig voordat de camera beweegt');
  const changed=await p.waitForFunction(previous=>{
    const current=document.querySelector('#flowOverlay path')?.getAttribute('d');
    return typeof current==='string'&&current.trim().length>0&&current!==previous?current:false;
  },previous,{timeout:6000,polling:'raf'});
  try{return await changed.jsonValue();}
  finally{await changed.dispose();}
};

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
  await page.waitForFunction(()=>window.__EAI_HEART_LAB__?.state.atlasRich===true,undefined,{timeout:40000});
  const initial=await state(page);
  assert(initial.cutaway&&initial.anatomyView&&initial.atlasPartCount===34,'Het echte hart opent vanbinnen');
  assert.equal(initial.focusSide,'both','De rode en blauwe bloedsomloop horen samen in beeld');
  assert(initial.showFlow,'Bloedstroom hoort standaard zichtbaar te zijn');
  assert.equal(initial.layers.outer,true,'De doorzichtige buitenkant staat standaard aan');
  assert.equal(initial.layers.vesselSection,false,'De doorkijk in grote bloedvaten start uit');
  assert.equal(initial.layers.wall,true,'De opengewerkte hartwand blijft beschikbaar');
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
  assert.equal(motion.flowRoutes,11,'Beide bloedroutes en veneuze vertakkingen aanwezig');
  const paths=await page.evaluate(()=>window.__EAI_HEART_LAB__.flowPreview);
  assert.equal(paths.length,11);
  assert.equal(paths.filter(p=>p.channel==='return').length,6);
  assert.equal(paths.filter(p=>p.channel==='av').length,2);
  assert.equal(paths.filter(p=>p.channel==='sem').length,3);
  assert(paths.every(p=>p.points>=60),'De bronroutes moeten vloeiende lijnen hebben');
  assert(paths.every(p=>p.source==='bodyparts3d-centrelines'),
    'Alle rijke stroombanen volgen de gemeten bronmiddenlijnen, niet de bounding-box-middelpunten');
  assert(paths.find(p=>p.ids[0]==='svc').waypoints>=6,
    'De holle ader volgt meerdere punten in de echte vaatvorm');
  assert(paths.find(p=>p.ids.includes('ao_desc')).waypoints>=15,
    'De grote lichaamsslagader volgt aorta, boog en dalende aorta als doorlopende route');
  assert(Math.abs(motion.playbackSeconds-3.2)<.01,'Standaard 3,2 seconden per hartslag');
  assert.equal(initial.playing,true,'De doorlopende animatie start vanzelf zonder verminderde-bewegingsvoorkeur');
  await page.locator('#play').click();
  assert.equal((await state(page)).playing,false,'Pauzeknop stopt het hart');
  await setTime(page,.30);
  assert.equal(await page.locator('#flowOverlay path').count(),44,
    'Elf routes krijgen elk een rustige stroomstrook, bloedkleur, puls en richtingspijl');
  assert.equal(await page.locator('#flowOverlay .blood-track').count(),11);
  assert.equal(await page.locator('#flowOverlay .blood-pulse').count(),11);
  const fillingPulse=page.locator('#flowOverlay .blood-pulse[data-flow-channel="av"]').first();
  assert(Number(await fillingPulse.evaluate(el=>el.style.opacity))>.5,
    'Bij open AV-kleppen loopt de geanimeerde bloedpuls door');
  assert.equal(await page.locator('#flowOverlay').isHidden(),false);
  const fillingFlow=await page.evaluate(()=>window.__EAI_HEART_LAB__.flowPreview);
  assert.equal(fillingFlow.filter(p=>p.active).length,8,
    'Tijdens het vullen lopen zes aanvoerroutes en twee AV-routes');
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom',
    'De tekst moet tijdens de gewone hartslag leesbaar blijven');
  assert(await page.locator('#storyStatus').isHidden(),'Klepstanden zijn voor de uitleg per stap');
  let metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.av&&!metrics.sem&&metrics.pressure<20);
  const filling=await page.locator('#heartCanvas').screenshot();
  await setTime(page,.67);
  const pressureFlow=await page.evaluate(()=>window.__EAI_HEART_LAB__.flowPreview);
  assert.equal(pressureFlow.filter(p=>p.active).length,6,
    'Met gesloten kleppen lopen er geen stroomdeeltjes door AV- of slagaderkleppen');
  assert.equal(await fillingPulse.evaluate(el=>el.style.opacity),'0',
    'Bij gesloten AV-kleppen blijft de puls echt uit');
  assert.equal(await page.locator('#storyTitle').textContent(),'Volg de bloedstroom',
    'De uitleg mag niet in 0,19 seconde verspringen');
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&!metrics.sem&&metrics.volume===130);
  await setTime(page,.8);
  const ejectionFlow=await page.evaluate(()=>window.__EAI_HEART_LAB__.flowPreview);
  assert.equal(ejectionFlow.filter(p=>p.active).length,9,
    'Tijdens het uitpompen zijn de uitgaande slagaderroutes zichtbaar');
  assert(Number(await page.locator('#flowOverlay .blood-pulse[data-flow-channel="sem"]').first().evaluate(el=>el.style.opacity))>.5,
    'Het uitpompen toont duidelijk de bewegende stroom door de open slagaderkleppen');
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
  const beforeWrap=await state(page);
  assert(!beforeWrap.playing&&beforeWrap.t>.97,'De cyclusproef begint gepauzeerd aan het einde');
  // Observeer de overgang per beeld, ook wanneer software-WebGL traag is.
  // Bewaar de waarneming in de pagina; een latere protocolrespons mag haar
  // niet vervangen door een momentopname uit een volgende fase.
  await page.evaluate(()=>{
    const observation={previous:window.__EAI_HEART_LAB__.state.t,started:null,transition:null,frame:0};
    window.__EAI_HEART_WRAP_OBSERVATION__=observation;
    document.getElementById('play').addEventListener('click',()=>{
      const started=window.__EAI_HEART_LAB__.state;
      observation.started={t:started.t,playing:started.playing};
    },{once:true});
    const sample=()=>{
      const current=window.__EAI_HEART_LAB__.state;
      if(current.playing&&observation.previous>.95&&current.t<.35){
        observation.transition={from:observation.previous,to:current.t,playing:current.playing,started:observation.started};
        return;
      }
      observation.previous=current.t;
      observation.frame=requestAnimationFrame(sample);
    };
    observation.frame=requestAnimationFrame(sample);
  });
  let wrapped;
  try{
    await page.locator('#play').click();
    const transition=await page.waitForFunction(
      ()=>window.__EAI_HEART_WRAP_OBSERVATION__.transition,
      undefined,{timeout:10000,polling:'raf'}
    );
    wrapped=await transition.jsonValue();
    await transition.dispose();
  }catch(error){
    console.error('Hartslag cyclusproef:',await page.evaluate(()=>({
      state:window.__EAI_HEART_LAB__.state,
      observation:window.__EAI_HEART_WRAP_OBSERVATION__
    })));
    throw error;
  }finally{
    await page.evaluate(()=>{
      cancelAnimationFrame(window.__EAI_HEART_WRAP_OBSERVATION__.frame);
      delete window.__EAI_HEART_WRAP_OBSERVATION__;
    });
  }
  assert(wrapped.started?.playing&&Math.abs(wrapped.started.t-.98)<.001,
    'Afspelen moet vanaf de ingestelde eindfase beginnen');
  assert(wrapped.playing&&wrapped.from>.95&&wrapped.to<.35,
    'Hartslag moet tijdens afspelen van het cyclus-einde naar het begin gaan');
  console.log('Hartslag cyclusovergang:',JSON.stringify(wrapped));
  await page.locator('#play').click();

  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-desktop.png',fullPage:true});
  const initialIds=await page.evaluate(()=>window.__EAI_HEART_LAB__.visibleAtlasPartIds);
  assert.equal(initialIds.length,30,'Vier bloedruimtes van de 34 zijn geen zichtbaar oppervlak');
  const beforeLayers=await page.locator('#heartCanvas').screenshot();
  await page.locator('#layerMenu > summary').click();
  assert(await page.locator('[data-layer="wall"]').isVisible(),'Lagen kunnen direct worden gekozen');
  await page.locator('#stage').screenshot({path:'test-results/hartslaglab-'+engine+'-desktop-lagen.png'});
  assert.equal(await page.locator('#layerMenu .layer-switch').count(),9);
  assert.equal(await page.locator('[data-layer="outer"] .layer-state').textContent(),'Aan');
  const exterior=page.locator('[data-layer="outer"]');
  await exterior.click();
  assert.equal((await state(page)).layers.outer,false);
  assert.equal((await state(page)).layers.wall,true,
    'De opengewerkte hartwand mag niet verdwijnen met de buitenlaag');
  const withoutExterior=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(beforeLayers,withoutExterior,
    'De buitenlaag moet echte beeldpunten veranderen');
  await exterior.click();
  assert.equal((await state(page)).layers.outer,true);
  await page.locator('#heartCanvas').screenshot({path:'test-results/hartslaglab-'+engine+'-met-buitenlaag.png'});
  const vesselSection=page.locator('[data-layer="vesselSection"]');
  const wholeVessels=await page.locator('#heartCanvas').screenshot();
  await vesselSection.click();
  assert.equal((await state(page)).layers.vesselSection,true,'Opengewerkte grote bloedvaten staan aan');
  assert.equal(await vesselSection.getAttribute('aria-pressed'),'true');
  assert.equal((await state(page)).showFlow,true,'De stromingsroutes blijven zichtbaar bij doorkijk');
  await page.locator('#heartCanvas').screenshot({path:'test-results/hartslaglab-'+engine+'-doorkijk-bloedvaten.png'});
  assert.notDeepEqual(wholeVessels,await page.locator('#heartCanvas').screenshot(),
    'De doorkijk moet de getekende bronvaten werkelijk veranderen');
  await vesselSection.click();
  assert.equal((await state(page)).layers.vesselSection,false,'De volledige vaatwand blijft terug te zetten');
  for(const [layer,count,id] of [
    ['wall',3,'ra_wall'],['valve',4,'mitral'],['papillary',2,'pap_lv'],
    ['vessel',12,'ao'],['coronary',9,'lca']
  ]){
    const button=page.locator('[data-layer="'+layer+'"]');
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'false','Layerstatus volgt '+layer);
    const ids=await page.evaluate(()=>window.__EAI_HEART_LAB__.visibleAtlasPartIds);
    assert(!ids.includes(id),'Verborgen '+layer+' mag niet getekend worden');
    const stillSelectable=await page.evaluate(targetId=>
      window.__EAI_HEART_LAB__.hitTargets.some(p=>p.id===targetId),id);
    assert.equal(stillSelectable,layer==='wall',
      layer==='wall'?'De wand blijft via de zichtbare Buitenlaag selecteerbaar':
        'Verborgen '+layer+' mag niet aanklikbaar blijven');
    assert.equal(initialIds.length-ids.length,count,'De atlaslaag moet het verwachte aantal meshes verbergen');
    await button.click();
  }
  const noWallButton=page.locator('[data-layer="wall"]');
  await noWallButton.click();
  assert.notDeepEqual(beforeLayers,await page.locator('#heartCanvas').screenshot(),
    'Lagen moeten het 3D-model echt veranderen');
  await exterior.click();
  assert.equal(await page.evaluate(()=>window.__EAI_HEART_LAB__.hitTargets.some(p=>p.id==='ra_wall')),false,
    'Zonder beide wandlagen hoort de wand niet aanklikbaar te zijn');
  await exterior.click();
  await page.locator('#resetLayers').click();
  assert.equal((await page.evaluate(()=>window.__EAI_HEART_LAB__.visibleAtlasPartIds)).length,30);
  assert.equal((await state(page)).layers.outer,true,'Herstellen zet de buitenlaag weer aan');
  assert.equal((await state(page)).layers.vesselSection,false,'Herstellen sluit de kijkopening in de bloedvaten');
  await page.locator('[data-layer="flow"]').click();
  assert.equal((await state(page)).showFlow,false,'Stroomrichting kan uit');
  assert(await page.locator('#flowOverlay').isHidden(),'Ook de bloedstroombanen moeten verdwijnen');
  await page.locator('[data-layer="flow"]').click();
  assert(await page.locator('#flowOverlay').isVisible(),'De stroomweergave komt terug');
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
  await page.locator('#layerMenu > summary').click();
  await exterior.click();
  assert.notDeepEqual(outsideFrame,await page.locator('#heartCanvas').screenshot(),
    'Zonder Buitenlaag moet de gesloten orgaanwand verdwijnen');
  assert.equal(await page.evaluate(()=>window.__EAI_HEART_LAB__.hitTargets.some(p=>p.id==='ra_wall')),false,
    'Een uitgezette buitenwand mag van buiten niet aanklikbaar blijven');
  await exterior.click();
  await page.locator('#layerMenu > summary').click();
  await page.locator('#sectionToggle').click();
  assert((await state(page)).anatomyView,'Het binnenaanzicht blijft echte anatomie');
  // De instellingen staan nu onder het hart. Scroll vóór de aanraakproef
  // terug naar het canvas; een schermcoördinaat buiten beeld is geen 3D-selectie.
  await page.locator('#heartCanvas').scrollIntoViewIfNeeded();
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
  const projectedBefore=await page.locator('#flowOverlay path').first().getAttribute('d');
  await page.mouse.move(dragBox.x+dragBox.width*.76,dragBox.y+dragBox.height*.52,{steps:8});
  await page.mouse.up();
  assert(Math.abs((await state(page)).yaw-before.yaw)>.1,'Het hart is draaibaar');
  const projectedAfter=await changedFlowProjection(page,projectedBefore);
  assert.notEqual(projectedAfter,projectedBefore,
    'De bloedstroombanen draaien mee met het echte 3D-hart');
  const panBefore=(await state(page)).pan;
  const flowBeforePan=await page.locator('#flowOverlay path').first().getAttribute('d');
  await page.mouse.move(dragBox.x+dragBox.width*.48,dragBox.y+dragBox.height*.5);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(dragBox.x+dragBox.width*.64,dragBox.y+dragBox.height*.57,{steps:6});
  await page.mouse.up();
  await page.keyboard.up('Shift');
  assert(Math.hypot(...(await state(page)).pan.map((v,i)=>v-panBefore[i]))>.05,
    'Shift-slepen verplaatst het hart in plaats van te draaien');
  // WebKit kan langer dan 80 ms nodig hebben om de nieuwe cameraprojectie te tekenen.
  // Wacht op echte bijwerking van de lijn; een stilgevallen renderer blijft falen.
  const flowAfterPan=await changedFlowProjection(page,flowBeforePan);
  assert.notEqual(flowAfterPan,flowBeforePan,
    'Ook bij verschuiven blijven de routes aan het hart gekoppeld');
  await page.locator('#resetCamera').click();
  assert(Math.abs((await state(page)).yaw+.2)<.005);
  assert(Math.hypot(...(await state(page)).pan)<.001,'Startaanzicht herstelt ook de verschuiving');

  await page.locator('#explainMore summary').click();
  await page.locator('#tabSourcesBtn').click();
  assert.equal(await page.locator('.source-links a').count(),4,'Bronnen blijven beschikbaar');
  // De desktopproef is klaar; laat die renderer niet doorwerken tijdens mobiel.
  await page.close();

  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:engine==='webkit',hasTouch:true
  });
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.__EAI_HEART_LAB__?.state.atlasRich===true,undefined,{timeout:40000});
  const m0=await state(mobile);
  assert(m0.cutaway&&m0.anatomyView&&m0.focusSide==='both','Mobiel begint met beide harthelften');
  assert(await mobile.locator('#atlasLoading').isHidden());
  assert(await mobile.locator('#play').isVisible(),'Start en pauze direct bereikbaar');
  assert(await mobile.locator('#storyTitle').isVisible(),'Leerling ziet het doel zonder tabblad');
  assert.equal(await mobile.locator('#storyTitle').textContent(),'Volg de bloedstroom');
  assert(await mobile.locator('#guideStart').isVisible(),'De uitleg per stap is direct bereikbaar');
  const pinch=await mobile.evaluate(()=>{
    const canvas=document.querySelector('#heartCanvas');
    const sample=()=>window.__EAI_HEART_LAB__.state;
    const send=(name,id,x,y)=>canvas.dispatchEvent(new PointerEvent(name,{
      pointerId:id,pointerType:'touch',isPrimary:id===71,buttons:1,
      clientX:x,clientY:y,bubbles:true,cancelable:true
    }));
    const before=sample();
    send('pointerdown',71,105,240);
    send('pointerdown',72,225,240);
    send('pointermove',71,92,248);
    send('pointermove',72,258,252);
    const after=sample();
    send('pointerup',71,92,248);
    send('pointerup',72,258,252);
    return {before,after};
  });
  assert(pinch.after.zoom<pinch.before.zoom-.08,'Uit elkaar bewegen van vingers zoomt in');
  assert(Math.hypot(...pinch.after.pan.map((v,i)=>v-pinch.before.pan[i]))>.01,
    'Twee vingers kunnen het hart verschuiven');
  assert(Math.abs(pinch.after.yaw-pinch.before.yaw)<.001,
    'Een pinch mag het hart niet onbedoeld draaien');
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
  assert(await mobile.locator('[data-layer="outer"]').isVisible(),'Buitenlaag staat in het mobiele lagenmenu');
  await mobile.locator('[data-layer="vesselSection"]').click();
  assert.equal((await state(mobile)).layers.vesselSection,true,'Doorkijk bloedvaten werkt ook in het mobiele lagenmenu');
  await mobile.locator('[data-layer="vesselSection"]').click();
  await mobile.locator('#stage').screenshot({path:'test-results/hartslaglab-'+engine+'-mobile-lagen.png'});
  await mobile.locator('#play').scrollIntoViewIfNeeded();
  await mobile.locator('[data-layer="outer"]').click();
  assert.equal((await state(mobile)).layers.outer,false);
  await mobile.locator('[data-layer="outer"]').click();
  assert.equal((await state(mobile)).layers.outer,true);
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
  const studyWaitStarted=performance.now();
  let finishedStudy;
  try{
    // De oude aanroep gebruikte effectief de standaard van Playwright 1.56.1:
    // 30 seconden. Bewaar die grens nu expliciet op de juiste parameter.
    const completed=await mobile.waitForFunction(()=>{
      const current=window.__EAI_HEART_LAB__.state;
      return current.studyStage==='compare'?{
        t:current.t,playing:current.playing,studyStage:current.studyStage
      }:false;
    },undefined,{timeout:30000,polling:'raf'});
    try{finishedStudy=await completed.jsonValue();}
    finally{await completed.dispose();}
  }catch(error){
    console.error('Begeleide hartbeweging:',JSON.stringify({
      waitMs:Math.round(performance.now()-studyWaitStarted),state:await state(mobile)
    }));
    throw error;
  }
  assert.equal(finishedStudy.studyStage,'compare');
  assert.equal(finishedStudy.playing,false,'De begeleide beweging pauzeert op het eindpunt');
  assert(Math.abs(finishedStudy.t-.90)<1e-6,'De beweging stopt op het afgesproken vergelijkingspunt');
  console.log('Begeleide hartbeweging afgerond:',JSON.stringify({
    waitMs:Math.round(performance.now()-studyWaitStarted),...finishedStudy
  }));
  await mobile.locator('#discoveryAction').click();
  assert.match(await mobile.locator('#discoveryFeedback').textContent(),/AV-kleppen sluiten eerst/);
  assert.deepEqual(errors,[],'Browserfouten: '+errors.join(' | '));
  console.log('Hartslaglab '+engine+': doorlopende anatomie, hartcyclus, kleurstromen, mobiliteit en rustige UX geslaagd.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
