// Echte browsercontrole van het Hartslaglab in Chromium of WebKit.
// node scripts/test_hartslaglab_browser.mjs site-build chromium
// node scripts/test_hartslaglab_browser.mjs site-build webkit
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
try {
  let ready=false;
  for(let i=0;i<90;i++){
    try{ready=(await fetch(base+'/tools/anatomie/labs/hartslag/')).ok;}catch{}
    if(ready)break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert(ready,'De onderliggende Hartslaglab-route ontbreekt in de sitebuild');
  browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--use-gl=angle','--use-angle=swiftshader']:[]});
  const page=await browser.newPage({viewport:{width:1400,height:920},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__EAI_HEART_LAB__?.rendererReady===true,{timeout:25000})
    .catch(async err=>{
      const debug=await page.evaluate(()=>({
        api:typeof window.__EAI_HEART_LAB__,state:window.__EAI_HEART_LAB__?.state,
        missing:[...['heartCanvas','flowLegend','miniTrace','discoveryAction']].filter(id=>!document.getElementById(id)),
        webgl:!!document.getElementById('heartCanvas')?.getContext('webgl')
      }));
      throw new Error('Hartslaglab start niet: '+err.message+'; fouten: '+errors.join(' | ')+'; status: '+JSON.stringify(debug));
    });
  assert.match(await page.title(),/Hartslaglab/);
  assert.equal(await page.locator('#heartCanvas').count(),1);
  assert.equal(await page.locator('#timeline button').count(),5);
  assert(await page.locator('#flowToggle').isHidden(),
    'De bloedstroomknop heeft op de anatomische buitenkant geen functie');
  assert.equal(await page.locator('#play').textContent(),'Start','De leerling voorspelt voordat het hart gaat bewegen');
  const compact=page.locator('#miniTrace');
  assert(await compact.isVisible(),'De grafiek moet direct bij het hart staan');
  assert((await compact.boundingBox()).width>400,'De compacte grafiek moet leesbaar zijn op desktop');
  await page.evaluate(()=>window.__EAI_HEART_LAB__.setTime(.30));
  await page.waitForTimeout(100);
  const filling=await page.locator('#heartCanvas').screenshot();
  let metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(metrics.av&&!metrics.sem&&metrics.volume>60&&metrics.pressure<20);
  await page.evaluate(()=>window.__EAI_HEART_LAB__.setTime(.67));
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&!metrics.sem&&metrics.volume===130&&metrics.pressure>15);
  await page.evaluate(()=>window.__EAI_HEART_LAB__.setTime(.80));
  await page.waitForTimeout(100);
  metrics=await page.evaluate(()=>window.__EAI_HEART_LAB__.metrics);
  assert(!metrics.av&&metrics.sem&&metrics.pressure>90&&metrics.volume<130);
  const pumping=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(filling,pumping,'3D-model moet daadwerkelijk bewegen tussen vulling en uitpompen');
  assert.equal(await page.locator('#sectionToggle').getAttribute('aria-pressed'),'false');
  const atlas=await page.evaluate(()=>window.__EAI_HEART_LAB__.state);
  assert(atlas.atlasReady&&atlas.atlasPartCount>=20,'Het echte atlasmodel moet geladen zijn');
  const outsideFrame=await page.locator('#heartCanvas').screenshot();
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-desktop-atlas.png',fullPage:true});
  await page.locator('#sectionToggle').click();
  assert.equal(await page.locator('#sectionToggle').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>window.__EAI_HEART_LAB__.state.cutaway),true);
  assert(await page.locator('#flowToggle').isVisible(),
    'Binnen de doorsnede moet je bloedstroom kunnen aan- en uitzetten');
  await page.locator('#flowToggle').click();
  assert.equal(await page.locator('#flowToggle').getAttribute('aria-pressed'),'false');
  assert(await page.locator('#flowLegend').isHidden());
  await page.locator('#flowToggle').click();
  await page.waitForTimeout(90);
  const cutawayFrame=await page.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(cutawayFrame,outsideFrame,'De bewegende doorsnede moet afwijken van de echte anatomische buitenkant');
  const label=await page.locator('#phaseTitle').textContent();
  assert.match(label,/Bloed wordt uitgepompt/);
  await page.locator('#tabExploreBtn').click();
  await page.locator('input[name=prediction][value=av]').check();
  await page.locator('#checkPrediction').click();
  assert.match(await page.locator('#predictionFeedback').textContent(),/Dat klopt/);
  assert.equal(await page.locator('#tabExploreBtn').getAttribute('aria-selected'),'true');
  await page.locator('#tabSourcesBtn').click();
  assert.equal(await page.locator('.source-links a').count(),3);
  const before=await page.evaluate(()=>window.__EAI_HEART_LAB__.state.yaw);
  const box=await page.locator('#heartCanvas').boundingBox();
  assert(box&&box.width>450&&box.height>300);
  await page.mouse.move(box.x+box.width*.48,box.y+box.height*.52);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.75,box.y+box.height*.52,{steps:6});
  await page.mouse.up();
  const after=await page.evaluate(()=>window.__EAI_HEART_LAB__.state.yaw);
  assert(Math.abs(after-before)>.10,'Slepen moet het WebGL-hart echt draaien');
  await page.locator('#resetCamera').click();
  assert(Math.abs((await page.evaluate(()=>window.__EAI_HEART_LAB__.state.yaw))+.2)<.005);
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/hartslaglab-'+engine+'-desktop.png',fullPage:true});
  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:engine==='webkit',hasTouch:true
  });
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.__EAI_HEART_LAB__?.rendererReady===true,{timeout:35000});
  assert(await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.atlasReady),
    'Het echte hartmodel moet ook op mobiele WebKit laden');
  const size=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,canvas:document.getElementById('heartCanvas').getBoundingClientRect().width}));
  assert(size.scroll<=size.inner+6,'Mobiele pagina mag niet horizontaal overlopen: '+JSON.stringify(size));
  assert(size.canvas>280,'Hartmodel moet groot genoeg blijven op mobiel');
  // Een compact scherm toont geen zes overlappende labels voor het hart.
  assert.equal(await mobile.locator('#labelsToggle').getAttribute('aria-pressed'),'false',
    'Namen moeten op mobiel standaard uit staan');
  assert(await mobile.locator('#labels [data-part="ra"]').isHidden(),
    'Hartlabels mogen de aanvankelijke 3D-weergave niet bedekken');
  await mobile.locator('#labelsToggle').click();
  assert.equal(await mobile.locator('#labelsToggle').getAttribute('aria-pressed'),'true');
  await mobile.waitForFunction(()=>document.querySelectorAll('#labelLeaders .leader-path:not([hidden])').length>=4);
  const labelLines=await mobile.evaluate(()=>{
    const svg=document.getElementById('labelLeaders');
    const lines=[...svg.querySelectorAll('.leader-path:not([hidden])')];
    return {visible:!svg.hidden,shown:lines.length,
      strokes:lines.map(line=>parseFloat(getComputedStyle(line).strokeWidth))};
  });
  assert(labelLines.visible&&labelLines.shown>=4,'Een naam hoort met een aanwijslijn aan het model');
  assert(labelLines.strokes.every(v=>v<=1.1),'Aanwijslijnen mogen niet dik zijn');
  await mobile.locator('#labelsToggle').click();
  assert.equal(await mobile.locator('#labelsToggle').getAttribute('aria-pressed'),'false');
  const layout=await mobile.evaluate(()=>{
    const stage=document.getElementById('stage').getBoundingClientRect();
    const hint=document.getElementById('partInfo').getBoundingClientRect();
    const timeline=document.getElementById('timeline');
    const controls=[...timeline.querySelectorAll('button')];
    return {stageHeight:stage.height,hintBelow:hint.top>=stage.bottom-1,
      timelineScrollable:timeline.scrollWidth>timeline.clientWidth+20,
      phaseWidths:controls.map(x=>x.clientWidth),
      textFits:controls.every(x=>x.scrollWidth<=x.clientWidth+4),
      hasHorizontalOverflow:document.documentElement.scrollWidth>innerWidth+6};
  });
  assert(layout.stageHeight>=400,'Het 3D-model moet op mobiel voldoende hoog blijven');
  assert(layout.hintBelow,'Uitleg mag niet over de hartkamers liggen');
  assert(layout.timelineScrollable,'Fasen moeten horizontaal te verkennen zijn');
  assert(layout.phaseWidths.every(x=>x>=115),'Fasen mogen niet tot afgekorte knoppen krimpen');
  assert(layout.textFits,'Faseteksten moeten volledig leesbaar zijn');
  assert(!layout.hasHorizontalOverflow,'Alleen de fasebalk mag horizontaal scrollen');
  const settingsLayout=await mobile.evaluate(()=>{
    const container=document.querySelector('.view-actions').getBoundingClientRect();
    const all=[...document.querySelectorAll('.view-actions button')];
    const buttons=all.filter(b=>!b.hidden);
    const rects=buttons.map(b=>b.getBoundingClientRect());
    return {count:buttons.length,allCount:all.length,
      visible:rects.every(r=>r.left>=container.left-2&&r.right<=container.right+2&&r.width>85),
      fullLabels:buttons.every(b=>b.scrollWidth<=b.clientWidth+5)};
  });
  assert.equal(settingsLayout.allCount,4);
  assert.equal(settingsLayout.count,3,'Bloedstroom is verborgen op het buitenaanzicht');
  assert(settingsLayout.visible,'Weergaveknoppen mogen op telefoon niet buiten beeld vallen');
  assert(settingsLayout.fullLabels,'Knopteksten moeten leesbaar blijven op telefoon');


  assert.equal(await mobile.locator('#sectionToggle').count(),1,'Doorsnedeknop moet ook op mobiel beschikbaar zijn');
  assert(await mobile.locator('#miniTrace').isVisible(),'De grafiek moet op mobiel direct onder het hart staan');
  const mobileView=await mobile.evaluate(()=>{
    const heart=document.querySelector('#stage').getBoundingClientRect();
    const trace=document.querySelector('#miniTrace').getBoundingClientRect();
    const q=document.querySelector('#discovery').getBoundingClientRect();
    return {questionBefore:q.bottom<=heart.top+1,traceBelow:trace.top>=heart.bottom,traceHeight:trace.height};
  });
  assert(mobileView.questionBefore,'De leerling moet de vraag voor de animatie zien');
  assert(mobileView.traceBelow&&mobileView.traceHeight>=50,'De meetgrafiek hoort direct onder het hart');
  await mobile.locator('[data-guess="av"]').click();
  assert.equal(await mobile.locator('[data-guess="av"]').getAttribute('aria-pressed'),'true');
  await mobile.locator('#discoveryAction').click();
  await mobile.waitForFunction(()=>window.__EAI_HEART_LAB__?.state.studyStage==='compare',{timeout:10000});
  assert.equal(await mobile.locator('#sectionToggle').getAttribute('aria-pressed'),'true');
  assert(await mobile.locator('#flowToggle').isVisible());
  assert(await mobile.locator('#heartSideControls').isVisible());
  await mobile.locator('[data-heart-side="right"]').click();
  assert.equal(await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.focusSide),'right');
  const rightHalf=await mobile.locator('#heartCanvas').screenshot();
  await mobile.locator('[data-heart-side="left"]').click();
  assert.equal(await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.focusSide),'left');
  assert.equal(await mobile.locator('#detailToggle').getAttribute('aria-pressed'),'false');
  const simpleHalf=await mobile.locator('#heartCanvas').screenshot();
  await mobile.locator('#detailToggle').click();
  assert.equal(await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.showDetails),true);
  const detailedHalf=await mobile.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(simpleHalf,detailedHalf,'Peesdraden en klepdetails moeten zichtbaar veranderen');
  await mobile.locator('#detailToggle').click();
  const leftHalf=await mobile.locator('#heartCanvas').screenshot();
  assert.notDeepEqual(rightHalf,leftHalf,'De rechter- en linkerharthelft moeten zichtbaar verschillen');
  await mobile.locator('#discoveryAction').click();
  assert.match(await mobile.locator('#discoveryFeedback').textContent(),/De AV-kleppen sluiten eerst/);
  assert.equal(await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.studyStage),'done');
  await mobile.evaluate(()=>window.__EAI_HEART_LAB__.setTime(0));
  await mobile.locator('#nextPhase').click();
  const t=await mobile.evaluate(()=>window.__EAI_HEART_LAB__.state.t);
  assert(t>.5&&t<.53,'Fasebediening moet op mobiel werken');
  await mobile.screenshot({path:'test-results/hartslaglab-'+engine+'-mobile.png',fullPage:true});
  const atlasHref=await mobile.locator('.back-link').getAttribute('href');
  assert.equal(atlasHref,'/tools/anatomie/');
  assert.deepEqual(errors,[],'Browserfouten: '+errors.join(' | '));
  console.log('Hartslaglab '+engine+': bewegende WebGL-frames, kleppen, grafieken, onderzoek, camera en mobiel gecontroleerd.');
}finally {
  await browser?.close();
  server.kill('SIGTERM');
}
