// Browserproef voor de openbare LLM-HTML, inclusief echte tokeninvoer.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8793';
const server=spawn('python3',['-m','http.server','8793','--bind','127.0.0.1','--directory',process.argv[2]||'site-build'],{stdio:'ignore'});
const probe=()=>new Promise(resolve=>{const req=get(base+'/tools/llm-observatorium/',res=>{res.resume();resolve(res.statusCode===200)});req.on('error',()=>resolve(false));req.setTimeout(1500,()=>{req.destroy();resolve(false)})});
mkdirSync('test-results',{recursive:true});
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){
  ready=await probe();
  if(ready)break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(ready,'De openbare LLM-route ontbreekt');
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:820}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/llm-observatorium/',{waitUntil:'load'});
  await page.locator('#universe').waitFor({state:'visible'});
  await page.locator('#modelStory').waitFor({state:'visible'});
  assert.equal(await page.locator('#aiGuide').isVisible(),false,'De animatie opent direct');
  if(width<800)assert.equal(await page.locator('.mobile-dock').isVisible(),false,'Geen technisch menu boven de animatie');
  await page.locator('#guideReturn').click();
  await page.locator('#aiGuide').waitFor({state:'visible'});
  assert.match(await page.locator('#aiGuideTitle').innerText(),/Van jouw vraag naar een antwoord/);
  assert.equal(await page.locator('#guideSteps button').count(),9,'De doorlopende route heeft negen stappen');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-begin.png'});
  const introLayout=await page.evaluate(()=>({
    vw:innerWidth,vh:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
    header:document.querySelector('.ai-guide-head').getBoundingClientRect().toJSON(),
    visual:document.querySelector('#guideVisual').getBoundingClientRect().toJSON(),
    footer:document.querySelector('.ai-guide-bottom').getBoundingClientRect().toJSON()
  }));
  assert(introLayout.sw<=introLayout.vw+2&&introLayout.sh<=introLayout.vh+2,'Geen paginaschuif: '+JSON.stringify(introLayout));
  assert(introLayout.visual.width>130&&introLayout.visual.height>90,'Zichtbaar demonstratievlak: '+JSON.stringify(introLayout));
  assert(introLayout.footer.bottom<=introLayout.vh+2,'Onderste bediening binnen scherm');
  await page.locator('#guidePrompt').fill('Waarom is de lucht blauw?');
  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/valt uiteen/);
  assert(await page.locator('#guideVisual button').count()>0,'Echte tokens zijn selecteerbaar');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-tokens.png'});

  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/getallen/);
  assert.equal(await page.locator('.ai-learn-number').count(),4,'Vier voorbeeldgetallen zichtbaar');
  assert(await page.locator('.ai-learn-source').innerText().then(t=>t.toLowerCase().includes('tokennummer')));
  await page.screenshot({path:'test-results/llm-guide-'+width+'-getallen.png'});

  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/volgorde/);
  const orderBefore=await page.locator('.ai-learn-orderpiece strong').allInnerTexts();
  await page.locator('.ai-guide-cta').click();
  const orderAfter=await page.locator('.ai-learn-orderpiece strong').allInnerTexts();
  assert.notDeepEqual(orderBefore,orderAfter,'Tokenposities zijn echt te wisselen');

  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/eerdere tekst/);
  assert(await page.locator('.ai-learn-bar').count()>0,'Attention toont berekende gewichten');
  const attentionSum=await page.locator('.ai-learn-bar strong').allInnerTexts();
  assert(Math.abs(attentionSum.reduce((sum,value)=>sum+parseFloat(value),0)-100)<.2,'Attention-gewichten sommeren tot 100%');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-attention.png'});

  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/rekennetwerken/);
  assert.equal(await page.locator('.ai-learn-expert.chosen').count(),4,'Vier voorbeeldexperts zijn geselecteerd');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-experts.png'});

  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/laag/);
  assert.equal(await page.locator('.ai-learn-layer-row').count(),3,'De berekening binnen een laag wordt getoond');
  const layerBefore=await page.locator('.ai-learn-layer-row').last().innerText();
  await page.locator('#guideLayerRange').evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}))});
  const layerAfter=await page.locator('.ai-learn-layer-row').last().innerText();
  assert.notEqual(layerBefore,layerAfter,'Een nieuwe voorbeeldlaag verandert de berekende getallen');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-lagen.png'});

  await page.locator('#guideNext').click();
  assert(await page.locator('#guideTemperature').isVisible(),'Variatie kan worden ingesteld');
  const probsBefore=await page.locator('.ai-guide-bar strong').allInnerTexts();
  await page.locator('#guideTemperature').evaluate(el=>{el.value='1.7';el.dispatchEvent(new Event('input',{bubbles:true}))});
  const probsAfter=await page.locator('.ai-guide-bar strong').allInnerTexts();
  assert.notDeepEqual(probsBefore,probsAfter,'Een echte kansberekening reageert op de slider');
  await page.locator('.ai-guide-cta').click();
  assert(await page.locator('#guideVisual').innerText().then(t=>t.includes('Gekozen in dit voorbeeld')));
  await page.screenshot({path:'test-results/llm-guide-'+width+'-kansen.png'});

  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/antwoord/);
  const firstCount=await page.locator('.ai-learn-piece').count();
  await page.locator('.ai-learn-answer-actions .ai-guide-cta').first().click();
  assert.equal(await page.locator('.ai-learn-piece').count(),firstCount+1,'Per klik verschijnt een echt getokeniseerd stukje');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-antwoord.png'});
  await page.locator('#guideTechnical').click();
  assert.equal(await page.locator('#aiGuide').isVisible(),false,'De bestaande technische werkruimte kan open');
  assert.equal(await page.locator('#guideReturn').isVisible(),true,'De uitleg blijft bereikbaar');
  assert.equal(await page.locator('#modelStory').isVisible(),false,'Bekijk de techniek opent werkelijk het 3D-model');
  await page.locator('#storyBack3d').click();

  // De opbouw is een automatische, pauzeerbare uitleg. Het oude 3D-model is optioneel.
  await page.locator('#modelStory').waitFor({state:'visible'});
  const started=await page.evaluate(()=>({
    mode:state.mode,view:document.querySelector('#app').dataset.storyView,
    playing:storyState.playing,phase:storyState.phase
  }));
  assert.equal(started.mode,0);
  assert.equal(started.view,'animation','De eerste technische weergave opent met de animatie');
  assert.equal(started.playing,true,'De uitleg begint vanzelf');
  if(width>800){
   assert.equal(await page.locator('#inspectorPanel').isVisible(),false,'Geen technische regelaars over de uitleg');
   assert.equal(await page.locator('#graphPanel').isVisible(),false,'Geen tweede grafiek onder de uitleg');
  }
  await page.screenshot({path:'test-results/llm-story-'+width+'-vraag.png'});
  await page.evaluate(()=>storyAdvance(STORY_PHASES[0].duration+.08));
  assert.equal(await page.evaluate(()=>storyState.phase),1,'De animatie gaat zonder tik vanzelf naar de volgende stap');
  await page.evaluate(()=>storyRestart());
  await page.locator('#storyPause').click();
  assert.equal(await page.evaluate(()=>storyState.playing),false,'Pauze stopt de animatie');
  await page.evaluate(()=>{storySetPhase(1);storyPaint(.8)});
  assert(await page.locator('#vTokens .v-token').count()>0,'De tekst wordt zichtbaar in stukjes verdeeld');
  await page.screenshot({path:'test-results/llm-story-'+width+'-stukjes.png'});
  await page.evaluate(()=>{storySetPhase(2);storyPaint(.55)});
  assert.equal(await page.locator('#vSteps rect').count(),36,'Het gekozen gpt-oss-120b toont zijn 36 lagen');
  assert(await page.locator('#vSteps rect[fill="#75bba9"]').count()>0,'Lagen lichten achtereenvolgens op');
  await page.screenshot({path:'test-results/llm-story-'+width+'-lagen.png'});
  await page.evaluate(()=>{storySetPhase(3);storyPaint(.8)});
  assert.equal(await page.locator('#vScores .v-score').count(),4,'Het kansvoorbeeld toont vier balken');
  await page.screenshot({path:'test-results/llm-story-'+width+'-kansen.png'});
  await page.evaluate(()=>{storySetPhase(4);storyPaint(.85)});
  assert.match((await page.locator('#vAnswer span').allTextContents()).join(' '),/De lucht lijkt blauw/);
  await page.screenshot({path:'test-results/llm-story-'+width+'-antwoord.png'});
  const sceneGeometry=await page.evaluate(()=>({
    viewportWidth:innerWidth,viewportHeight:innerHeight,
    stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),
    heading:document.querySelector('.story-copy').getBoundingClientRect().toJSON(),
    board:document.querySelector('#storyBoard').getBoundingClientRect().toJSON(),
    bottom:document.querySelector('.story-bottom').getBoundingClientRect().toJSON(),
    scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight
  }));
  assert(sceneGeometry.board.width>190&&sceneGeometry.board.height>80,'De animatie moet zichtbaar zijn: '+JSON.stringify(sceneGeometry));
  assert(sceneGeometry.bottom.bottom<=sceneGeometry.stage.bottom+2,'Bediening blijft binnen de werkruimte: '+JSON.stringify(sceneGeometry));
  assert(sceneGeometry.scrollWidth<=width+2&&sceneGeometry.scrollHeight<=820+2,'Geen paginaschuif: '+JSON.stringify(sceneGeometry));
  await page.locator('#story3d').click();
  if(width<800){
   assert.equal(await page.locator('.mobile-dock').isVisible(),true,'De technische bediening keert terug');
   await page.locator('.mobile-dock [data-panel="graph"]').click();
   const graph=await page.locator('#graphPanel').boundingBox();
   assert(graph&&graph.y>=47&&graph.height>=300,'Grafiek opent als eigen scherm');
   await page.locator('.mobile-dock [data-panel="graph"]').click();
  }
  assert.equal(await page.locator('#modelStory').isVisible(),false,'Het oude 3D-model kan worden geopend');
  if(width>800){
   assert.equal(await page.locator('#inspectorPanel').isVisible(),true,'De technische regelaars keren terug bij 3D');
   assert.equal(await page.locator('#graphPanel').isVisible(),true,'De technische grafiek keert terug bij 3D');
  }
  await page.locator('#storyBack3d').click();
  assert.equal(await page.locator('#modelStory').isVisible(),true,'Animatie is terug te openen');
  await page.locator('#storyReplay').click();
  assert.equal(await page.evaluate(()=>storyState.phase),0,'Opnieuw begint bij de vraag');

  await page.locator('#guideReturn').click();
  assert.equal(await page.locator('#aiGuide').isVisible(),true,'Je kunt de uitleg opnieuw openen');
  await page.locator('#guideTechnical').click();

  const modesCount=await page.locator('#modes .mode-btn').count();
  assert.equal(modesCount,7,'Zeven onderzoeksmodules; JS-fouten: '+errors.join(' | '));
  // De lagen staan in een volgorde, niet op concentrische ringen.
  const layout=await page.evaluate(()=>({
    first:world.experts[0],last:world.experts[(cfg.layers-1)*cfg.experts],
    maxY:Math.max(...world.experts.map(p=>Math.abs(p.y))),
    maxZ:Math.max(...world.experts.map(p=>Math.abs(p.z))),
    layers:cfg.layers,expertsPerLayer:cfg.experts,expertCount:world.experts.length
  }));
  assert(layout.last.x>layout.first.x,'Lagen moeten oplopend geplaatst zijn');
  assert(layout.maxY<1.7&&layout.maxZ<2,'Experts moeten in compacte roosters staan');
  assert.equal(layout.expertCount,layout.layers*layout.expertsPerLayer,'Alle experts blijven behouden');
  for(let mode=0;mode<7;mode++){
    await page.evaluate(m=>setMode(m),mode);
    await page.waitForTimeout(120);
    if([0,1,2,3,4,5].includes(mode))await page.screenshot({path:'test-results/llm-'+width+'-modus-'+mode+'.png'});
    assert.equal(await page.evaluate(()=>state.playing),false,'Geen automatische beweging in modus '+mode);
    const isPlayerVisible=await page.locator('#playBtn').isVisible();
    assert.equal(isPlayerVisible,false,'Geen nutteloze afspeelbalk in modus '+mode);
  }
  await page.evaluate(()=>setMode(0));
  if(width<800)await page.locator('#story3d').click();
  assert.equal(errors.length,0,'Fouten bij omschakelen tussen zeven visualisaties: '+errors.join(' | '));

  if(width<800)await page.locator('.mobile-dock [data-panel="modules"]').click();
  await page.locator('#modes [data-mode="1"]').click();
  if(width<800)await page.locator('.mobile-dock [data-panel="settings"]').click();
  await page.locator('#promptText').fill('Hallo, wereld! Waarom?');
  await page.waitForFunction(()=>state.tokenStatus!=='example',{timeout:20000});
  const tokenState=await page.evaluate(()=>({
   status:state.tokenStatus,
   ids:state.promptWords.map(x=>x.id),
   count:state.promptWords.length,
   text:state.input,
   routeCount:chooseRoute(state.layer).length
  }));
  assert.equal(tokenState.status,'real','De externe tokenizer moet echte token-ID’s teruggeven');
  assert(tokenState.ids.every(Number.isInteger),'Token-ID ontbreekt');
  assert(tokenState.count>=3,'De invoer moet meerdere tokens bevatten');
  assert.equal(tokenState.routeCount,4,'De voorbeeldrouter blijft bereikbaar');
  if(width<800)await page.locator('.mobile-dock [data-panel="settings"]').click();
  assert.equal(await page.locator('#layerTokenRow button').count(),tokenState.count);
  await page.locator('#layerTokenRow button').last().click();
  assert.equal(await page.locator('#layerTokenRow button.selected').count(),1);
  assert(await page.locator('#layerTokenStatus').innerText().then(t=>t.includes('Token-ID')));
  assert.equal(await page.locator('#layerExpertList button').count(),4);
  await page.locator('#layerExpertList button').last().click();
  assert.equal(await page.locator('#layerExpertList button.selected').count(),1);
  await page.locator('#layerNext').click();
  assert.equal(await page.locator('#layerAttentionBadge').innerText(),'VOLLEDIG');
  assert.equal(await page.locator('#layerAttentionTrack').evaluate(el=>el.style.getPropertyValue('--reach')),'100.0000%');
  await page.locator('#layerPrev').click();
  assert.equal(await page.locator('#layerAttentionBadge').innerText(),'LOKAAL');
  const localWidth=await page.locator('#layerAttentionTrack').evaluate(el=>parseFloat(el.style.getPropertyValue('--reach')));
  assert(localWidth>0&&localWidth<4,'Een venster van 128 posities in 4096 moet een smalle strook zijn');
  assert.equal(await page.locator('#journeyPanel').isVisible(),false,'Grote player mag niet terugkomen');
  // Elke module moet ook op een stilstaande camera zichtbaar bewegen.
  const motion=await page.evaluate(()=>{
   const checks=[];
   for(let mode=0;mode<7;mode++){
    setMode(mode);state.playing=false;
    state.time=0;state.dirty=true;
    if(mode===1)state.journey=0;
    drawScene();
    const before=canvas.toDataURL('image/png');
    state.time=75;state.dirty=true;
    if(mode===1)state.journey=.75;
    drawScene();
    const after=canvas.toDataURL('image/png');
    checks.push({mode,framesDiffer:before!==after,follow:state.follow,cameraX:cam.ox,cameraY:cam.oy});
   }
   return checks;
  });
  for(const item of motion){
    if([0,2,3,4,5].includes(item.mode))assert.equal(item.framesDiffer,false,'Statische uitleg verandert niet door een verborgen tijdwaarde, modus '+item.mode);
    assert.equal(item.follow,false,'Modus '+item.mode+' volgt nog een springende camera');
    assert.equal(item.cameraX,0,'Camera mag niet springen op de X-as');
    assert.equal(item.cameraY,0,'Camera mag niet springen op de Y-as');
  }
  await page.evaluate(()=>{setMode(1);selectLayer(3);});
  const stopped=await page.evaluate(()=>({time:state.time,journey:state.journey,layer:state.layer,playing:state.playing}));
  await page.waitForTimeout(350);
  const unchanged=await page.evaluate(()=>({time:state.time,journey:state.journey,layer:state.layer,playing:state.playing}));
  assert.deepEqual(unchanged,stopped,'Laagselectie moet stilstaan totdat de gebruiker iets wijzigt');
  assert.equal(stopped.playing,false,'Tokenreis mag niet vanzelf afspelen');
  assert.equal(stopped.layer,3,'Een gekozen laag moet geselecteerd blijven');
  assert.equal(errors.length,0,'JavaScript fouten: '+errors.join(' | '));
  await page.close();
 }

 for(const [width,height] of [[320,568],[844,390]]){
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(base+'/tools/llm-observatorium/',{waitUntil:'load'});
   await page.locator('#modelStory').waitFor({state:'visible'});
   await page.locator('#guideReturn').click();
   await page.locator('#aiGuide').waitFor({state:'visible'});
   for(let step=0;step<9;step++){
    const geometry=await page.evaluate(()=>({
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
      visual:document.querySelector('#guideVisual').getBoundingClientRect().toJSON(),
      visualScroll:document.querySelector('#guideVisual').scrollHeight,
      visualClient:document.querySelector('#guideVisual').clientHeight,
      aside:document.querySelector('.ai-guide-aside').getBoundingClientRect().toJSON(),
      asideScroll:document.querySelector('.ai-guide-aside').scrollHeight,
      asideClient:document.querySelector('.ai-guide-aside').clientHeight,
      button:document.querySelector('#guideNext').getBoundingClientRect().toJSON()
    }));
    assert(geometry.scrollWidth<=width+2&&geometry.scrollHeight<=height+2,
      'Geen paginascroll '+width+' stap '+step+': '+JSON.stringify(geometry));
    assert(geometry.visual.width>125&&geometry.visual.height>80,
      'Visualisatie niet bruikbaar '+width+' stap '+step+': '+JSON.stringify(geometry));
    assert(geometry.visualScroll<=geometry.visualClient+3||await page.locator('#guideVisual').evaluate(el=>getComputedStyle(el).overflowY==='auto'),
      'Visualisatie moet bereikbaar blijven via eigen scrollruimte: '+JSON.stringify(geometry));
    assert(geometry.asideScroll<=geometry.asideClient+3||await page.locator('.ai-guide-aside').evaluate(el=>getComputedStyle(el).overflowY==='auto'),
      'Uitleg moet bereikbaar blijven via eigen scrollruimte: '+JSON.stringify(geometry));
    assert(geometry.aside.height>55&&geometry.aside.bottom<=height-40,
      'Uitleg binnen venster '+width+' stap '+step+': '+JSON.stringify(geometry));
    assert(geometry.button.right<=width+2&&geometry.button.bottom<=height+2,
      'Volgende knop zichtbaar '+width+' stap '+step+': '+JSON.stringify(geometry));
    await page.screenshot({path:'test-results/llm-guide-'+width+'-stap-'+(step+1)+'.png'});
    if(step<8)await page.locator('#guideNext').click();
   }
   await page.locator('#guideTechnical').click();
   assert.equal(await page.locator('#modelStory').isVisible(),false,'Techniek opent de onderzoeksruimte');
   await page.locator('#storyBack3d').click();
   await page.locator('#modelStory').waitFor({state:'visible'});
   const storyFits=await page.evaluate(()=>({
     stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),
     board:document.querySelector('#storyBoard').getBoundingClientRect().toJSON(),
     bottom:document.querySelector('.story-bottom').getBoundingClientRect().toJSON(),
     scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight
   }));
   assert(storyFits.board.width>175&&storyFits.board.height>55,'Animatie zichtbaar op '+width+': '+JSON.stringify(storyFits));
   assert(storyFits.bottom.bottom<=storyFits.stage.bottom+2,'Animatiebediening niet afgesneden: '+JSON.stringify(storyFits));
   assert(storyFits.scrollWidth<=width+2&&storyFits.scrollHeight<=height+2,'Geen scroll in animatie op '+width);
   for(let part=0;part<5;part++){
     await page.evaluate(n=>{storySetPhase(n);storyPaint(.6)},part);
     await page.screenshot({path:'test-results/llm-story-'+width+'-stap-'+(part+1)+'.png'});
   }
   await page.locator('#storyPause').click();
   if(width===320){
    await page.locator('#aiGuide').waitFor({state:'hidden'});
    for(let i=0;i<7;i++){
     await page.evaluate(index=>setMode(index),i);
     await page.waitForTimeout(90);
     const view=await page.evaluate(()=>({
      label:document.querySelector('#modeTitle').textContent,
      desc:document.querySelector('#modeDesc').textContent,
      shown:document.querySelector('#modeDesc').clientHeight,
      full:document.querySelector('#modeDesc').scrollHeight,
      titleBottom:document.querySelector('.stage-title').getBoundingClientRect().bottom,
      hintTop:document.querySelector('#statusHint').getBoundingClientRect().top,
      hintHeight:document.querySelector('#statusHint').getBoundingClientRect().height,
      caption:document.querySelector('.scene-caption').getBoundingClientRect().toJSON()
     }));
     assert.ok(view.desc.length>28,'Onderwerp '+i+' moet een zinvolle uitleg hebben');
     assert.ok(view.full<=view.shown+3,'Mobiele uitleg is afgesneden: '+JSON.stringify(view));
     if(view.hintHeight>0)assert.ok(view.titleBottom<=view.hintTop+3,'Titel en uitleg mogen niet over elkaar vallen: '+JSON.stringify(view));
     if(i===0||i===2||i===5)await page.screenshot({path:'test-results/llm-technical-'+width+'-modus-'+i+'.png'});
    }
   }
   assert.deepEqual(errors,[],'Geen JavaScript-fout bij kleine en liggende weergave');
  }finally{await page.close();}
 }

 // Minder beweging: alle vijf stappen zijn tegelijk als stilstaand overzicht te lezen.
 {
  const reduced=await browser.newPage({viewport:{width:390,height:820},reducedMotion:'reduce'});
  try{
   await reduced.goto(base+'/tools/llm-observatorium/',{waitUntil:'load'});
   await reduced.locator('#modelStory').waitFor({state:'visible'});
   assert.equal(await reduced.evaluate(()=>storyState.playing),false);
   assert.equal(await reduced.locator('.story-summary-row').count(),5);
   await reduced.screenshot({path:'test-results/llm-story-390-minder-beweging.png'});
  }finally{await reduced.close()}
 }
 console.log('LLM_BROWSER_OK widths=390,1280 modes=7 tokenizer=real layer_inspector=active');
}finally{
 if(browser)await browser.close();
 server.kill();
}
