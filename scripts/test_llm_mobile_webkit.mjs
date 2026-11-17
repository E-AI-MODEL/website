// Test de beeldopbouw met WebKit, de browserengine achter Safari.
// Geen test van een fysiek iOS-apparaat of echte modelactivaties.
import { webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:8794';
const server=spawn('python3',['-m','http.server','8794','--bind','127.0.0.1','--directory',process.argv[2]||'site-build'],{stdio:'ignore'});
const probe=()=>new Promise(resolve=>{
 const req=get(base+'/tools/llm-observatorium/',res=>{res.resume();resolve(res.statusCode===200)});
 req.on('error',()=>resolve(false));
 req.setTimeout(1200,()=>{req.destroy();resolve(false)});
});
mkdirSync('test-results',{recursive:true});
let browser;
try {
 let ready=false;
 for(let i=0;i<80;i++){if(await probe()){ready=true;break;}await new Promise(r=>setTimeout(r,120));}
 assert(ready,'De geteste HTML-route ontbreekt');
 browser=await webkit.launch({headless:true});
 for(const [width,height] of [[320,568],[390,844],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(base+'/tools/llm-observatorium/',{waitUntil:'load'});
   await page.locator('#modelStory').waitFor({state:'visible'});
   assert.equal(await page.locator('#aiGuide').isVisible(),false,'Het beeld opent direct');
   assert.equal(await page.locator('#storyTimeline .story-time-item').count(),9,'Dezelfde negen fasen als in de leerroute');
   for(let step=0;step<9;step++){
    await page.evaluate(n=>{storyState.playing=false;storySetPhase(n);storyPaint(.6)},step);
    const g=await page.evaluate(()=>({
     viewport:{width:innerWidth,height:innerHeight},
     page:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
     heading:document.querySelector('.story-copy').getBoundingClientRect().toJSON(),
     board:document.querySelector('#storyBoard').getBoundingClientRect().toJSON(),
     bottom:document.querySelector('.story-bottom').getBoundingClientRect().toJSON()
    }));
    assert(g.page.width<=width+2&&g.page.height<=height+2,'Geen paginaschuif: '+JSON.stringify(g));
    assert(g.board.height>80&&g.board.width>200,'Het beeld moet zichtbaar blijven: '+JSON.stringify(g));
    assert(g.heading.bottom<=g.board.top+2,'Kop en beeld overlappen: '+JSON.stringify(g));
    assert(g.board.bottom<=g.bottom.top+2,'Beeld en bediening overlappen: '+JSON.stringify(g));
    assert(g.bottom.bottom<=height+2,'Bediening valt buiten het scherm: '+JSON.stringify(g));
    await page.screenshot({path:'test-results/llm-webkit-'+width+'-'+height+'-stap-'+(step+1)+'.png'});
   }
   // Ook de volledige negenstapsroute moet in Safari op een klein scherm werken.
   await page.locator('#guideReturn').click();
   assert.equal(await page.locator('#guideSteps button').count(),9,'Negen lesstappen ook in WebKit');
   for(let step=0;step<9;step++){
    await page.evaluate(i=>guideSetStep(i),step);
    assert(await page.locator('#guideHeading').isVisible(),'Titel van de stap zichtbaar');
    const g=await page.evaluate(()=>({
     docWidth:document.documentElement.scrollWidth,
     docHeight:document.documentElement.scrollHeight,
     visual:document.querySelector('#guideVisual').getBoundingClientRect().toJSON(),
     aside:document.querySelector('.ai-guide-aside').getBoundingClientRect().toJSON()
    }));
    assert(g.docWidth<=width+2&&g.docHeight<=height+2,'Geen pagina-overloop in lesstap '+step+': '+JSON.stringify(g));
    assert(g.visual.width>100&&g.visual.height>50&&g.aside.height>40,
     'Zichtbaar lesmateriaal in WebKit stap '+step+': '+JSON.stringify(g));
   }
   // Een echte opgeslagen modelmeting moet ook op kleine iPhones te openen zijn.
   await page.evaluate(()=>guideSetStep(4));
   await page.locator('.ai-trace-toggle').click();
   await page.locator('.ai-trace-token-steps').waitFor({state:'visible'});
   assert.equal(await page.locator('.ai-trace-token-step').count(),4,
    'Vier direct selecteerbare voorspellingen op mobiel');
   await page.locator('.ai-trace-head-btn').last().click();
   assert.match(await page.locator('.ai-trace-help').last().innerText(),/laatste laag/);
   await page.locator('.ai-trace-token-step').last().click();
   assert.match(await page.locator('.ai-trace-selected').innerText(),/little/);
   const traceScreen=await page.evaluate(()=>({
    pageWidth:document.documentElement.scrollWidth,
    pageHeight:document.documentElement.scrollHeight,
    viewerWidth:document.querySelector('.ai-trace-content').getBoundingClientRect().width,
    toggleWidth:document.querySelector('.ai-trace-toggle').getBoundingClientRect().width
   }));
   assert(traceScreen.pageWidth<=width+2&&traceScreen.pageHeight<=height+2,
    'Geen paginaschuif na echte meting: '+JSON.stringify(traceScreen));
   assert(traceScreen.viewerWidth>120&&traceScreen.toggleWidth>120,
    'De echte meetwaarden blijven bruikbaar op mobiel');
   await page.screenshot({path:'test-results/llm-webkit-'+width+'-'+height+'-echte-meting.png'});
   await page.evaluate(()=>guideSetVisible(false));
   await page.locator('#story3d').click();
   assert.equal(await page.locator('#modelStory').isVisible(),false,'3D blijft bereikbaar');
   if(width>800&&height<560){
    const technicalStage=await page.locator('#stage').boundingBox();
    assert(technicalStage&&technicalStage.height>200,
     'Liggend moet het model genoeg hoogte krijgen: '+JSON.stringify(technicalStage));
   }
   if(width<=800){
    for(const panel of ['graph','settings','learn']){
     await page.locator('.mobile-dock [data-panel="'+panel+'"]').click();
     const el=panel==='graph'?'#graphPanel':'#inspectorPanel';
     const box=await page.locator(el).boundingBox();
     const position=await page.locator(el).evaluate(node=>getComputedStyle(node).position);
     assert.equal(position,'fixed','Mobiel paneel moet vast aan het scherm zitten: '+panel);
     assert(box&&box.x>=-2&&box.width<=width+2&&box.y>=45&&box.y+box.height<=height-56,
      'Een paneel bedekt de mobiele bediening: '+panel+' '+JSON.stringify(box));
     await page.locator('.mobile-dock [data-panel="'+panel+'"]').click();
    }
   }
   if(width<=800){
    const back=await page.locator('#storyBack3d').boundingBox();
    assert(back&&back.y>=47&&back.y+back.height<=height-60,
     'De animatieknop moet tussen boven- en ondermenu passen: '+JSON.stringify(back));
    assert.equal(await page.locator('#storyBack3d').evaluate(e=>getComputedStyle(e).position),'fixed');
   }
   await page.locator('#storyBack3d').click();
   assert.equal(await page.locator('#modelStory').isVisible(),true,'Terug naar het verhaal');
   assert.deepEqual(errors,[],'JavaScript-fouten bij WebKit: '+errors.join(' / '));
  }finally{await page.close();}
 }
 console.log('LLM_WEBKIT_OK: 320x568, 390x844, 844x390, negen leerstappen en mobiele panelen');
}finally{
 if(browser)await browser.close();
 server.kill();
}
