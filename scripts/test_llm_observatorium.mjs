// Browserproef voor de openbare LLM-HTML, inclusief echte tokeninvoer.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8793';
const server=spawn('python3',['-m','http.server','8793','--bind','127.0.0.1','--directory',process.argv[2]||'site-build'],{stdio:'ignore'});
mkdirSync('test-results',{recursive:true});
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{ready=(await fetch(base+'/tools/llm-observatorium/')).ok}catch{}
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
  await page.locator('#aiGuide').waitFor({state:'visible'});
  assert.match(await page.locator('#aiGuideTitle').innerText(),/Van jouw vraag naar een antwoord/);
  assert.equal(await page.locator('#guideSteps button').count(),5);
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
  assert.match(await page.locator('#guideHeading').innerText(),/stukjes/);
  assert(await page.locator('#guideVisual button').count()>0,'Tokenstukken zijn zichtbaar');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-tokens.png'});
  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/eerdere tekst/);
  assert(await page.locator('#guideVisual .is-before').count()>0,'Eerdere context wordt getoond');
  await page.locator('#guideNext').click();
  assert(await page.locator('#guideTemperature').isVisible(),'Variatie is daadwerkelijk instelbaar');
  const probsBefore=await page.locator('.ai-guide-bar strong').allInnerTexts();
  await page.locator('#guideTemperature').fill('1.7');
  const probsAfter=await page.locator('.ai-guide-bar strong').allInnerTexts();
  assert.notDeepEqual(probsBefore,probsAfter,'Rekenvoorbeeld reageert op slider');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-kansen.png'});
  await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideHeading').innerText(),/antwoord/);
  const answerBefore=await page.locator('.ai-guide-answer').innerText();
  await page.locator('.ai-guide-cta').click();
  assert.notEqual(await page.locator('.ai-guide-answer').innerText(),answerBefore,'Antwoord groeit door gerichte klik');
  await page.screenshot({path:'test-results/llm-guide-'+width+'-antwoord.png'});
  await page.locator('#guideTechnical').click();
  assert.equal(await page.locator('#aiGuide').isVisible(),false,'De bestaande technische werkruimte kan open');
  assert.equal(await page.locator('#guideReturn').isVisible(),true,'De uitleg blijft bereikbaar');
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
 console.log('LLM_BROWSER_OK widths=390,1280 modes=7 tokenizer=real layer_inspector=active');
}finally{
 if(browser)await browser.close();
 server.kill();
}
