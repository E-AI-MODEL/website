import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base='http://127.0.0.1:8765';
mkdirSync('test-results/topo',{recursive:true});
const engine=process.env.TOPO_BROWSER==='webkit'?webkit:chromium;
const launch=process.env.TOPO_CHROME?{executablePath:process.env.TOPO_CHROME,args:['--no-sandbox']}:{};
const browser=await engine.launch({headless:true,...launch});
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
  if(label==='nederland'){
   assert.equal(provinceCount,12,'Landelijke kaart mist een provincie');
   const images=page.locator('.pdok-detail image');
   assert.equal(await images.count(),2,'PDOK-kaartdetails ontbreken');
   const sources=await images.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')||''));
   assert.ok(sources.every(url=>url.includes('service.pdok.nl')&&url.includes('BBOX=')),'PDOK-bron of projectie ontbreekt');
   assert.equal(await page.locator('.province-shape').count(),12,'De klikbare provinciegrenzen moeten blijven');
  }
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
 // Every answer layout must fit a fixed phone screen, including the fourth choice.
 async function assertFixedMode(name,mode,topics){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',error=>failures.push(name+': '+error.message));
  try{
   await page.goto(base+'/topo/nederland/?mode='+mode+'&topics='+topics+'&questions=8',{waitUntil:'domcontentloaded'});
   await page.locator('#loading').waitFor({state:'hidden',timeout:12000});
   if(mode==='missing')assert.equal(await page.locator('#kind').textContent(),'WAT MIST ER?');
   const sizes=await page.evaluate(()=>{
    const get=s=>{const node=document.querySelector(s);if(!node)return null;const rect=node.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:rect.height,left:rect.left,right:rect.right,width:rect.width}};
    return {viewport:window.visualViewport?.height||window.innerHeight,bodyHeight:document.body.scrollHeight,
     box:get('.question-card'),map:get('.game-board'),mapArt:get('#map svg'),links:get('.small-links'),
     answers:[...document.querySelectorAll('#answerOptions .option')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}}),
     check:get('.type-submit'),input:get('.typed'),next:get('#next'),mode:document.querySelector('.game-grid').dataset.mode,
     viewBox:document.querySelector('#map svg')?.getAttribute('viewBox')};
   });
   console.log('TOPO FIXED '+name+' '+JSON.stringify(sizes));
   assert.equal(sizes.mode,mode);
   assert.ok(sizes.box.bottom<=sizes.viewport-6,'Question card clipped '+name);
   assert.ok(sizes.links.bottom<=sizes.box.bottom-3,'Help links clipped '+name);
   assert.ok(sizes.map.height>=135,'Map was squeezed '+name);
   assert.ok(sizes.map.bottom<=sizes.viewport+3,'Map clipped '+name);
   assert.ok(sizes.bodyHeight<=sizes.viewport+8,'Page scrolls '+name);
   if(mode==='choice'){
    assert.equal(sizes.answers.length,4);
    assert.ok(sizes.answers[0].height>=37,'Answer buttons too small');
    for(const item of sizes.answers)assert.ok(item.bottom<=sizes.links.top+2,'Answer button cut off '+name);
   }
   if(mode==='type'||mode==='missing'){
    assert.ok(sizes.input.bottom<=sizes.links.top+2,'Input clipped');
    assert.ok(sizes.check.bottom<=sizes.links.top+2,'CHECK clipped');
   }
   if(mode==='point'){
    assert.ok(parseFloat(sizes.viewBox.split(' ')[2])<1000,'Map is still zoomed too far out');
   }
   if(mode==='choice'){
    // Wrong answer must not push the fourth answer or help row offscreen.
    const options=page.locator('#answerOptions button.option');
    await options.nth(0).click();
    const after=await page.evaluate(()=>{
      const q=document.querySelector('.question-card').getBoundingClientRect();
      const links=document.querySelector('.small-links').getBoundingClientRect(),next=document.getElementById('next').getBoundingClientRect();
      const l=next.height?next:links;
      const choices=[...document.querySelectorAll('#answerOptions .option')].map(x=>x.getBoundingClientRect());
      return {questionBottom:q.bottom,linksBottom:l.bottom,optionBottom:choices.at(-1).bottom,
        minChoiceHeight:Math.min(...choices.map(x=>x.height)),viewport:window.visualViewport?.height||window.innerHeight};
    });
    assert.ok(after.linksBottom<=after.questionBottom-3,'Help links or VERDER cut off after feedback');
    assert.ok(after.optionBottom<after.linksBottom,'Fourth answer cut off after feedback');
    assert.ok(after.minChoiceHeight>=32,'Choices too small after feedback');
    await page.screenshot({path:'test-results/topo/fixed-choice-feedback.png',fullPage:true});
   }
   await page.screenshot({path:'test-results/topo/fixed-'+name+'.png',fullPage:true});
  }finally{await page.close();}
 }
 await assertFixedMode('point','point','cities,capitals');
 await assertFixedMode('choice','choice','cities,capitals');
 await assertFixedMode('type','type','cities,capitals');
 await assertFixedMode('missing','missing','cities');

 // Regression: northern game must show full feedback and the help actions on iPhone
 // even after a wrong map tap or a multiline hint. The map must still fit on screen.
 async function checkNorthFeedback(height){
  const page=await browser.newPage({viewport:{width:390,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',error=>failures.push('north-feedback-'+height+': '+error.message));
  try{
   await page.goto(base+'/topo/',{waitUntil:'domcontentloaded'});
   if(await page.locator('#privacyLayer').isVisible())await page.locator('#privacyOk').click();
   await page.locator('#start').click();
   assert.equal(await page.locator('#kind').textContent(),'AANWIJZEN');
   async function check(stage){
    const sizes=await page.evaluate(()=>{
     const rect=selector=>{const element=document.querySelector(selector);const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
     const question=document.querySelector('.question-card');
     return {viewport:window.visualViewport?.height||window.innerHeight,
      card:rect('.question-card'),prompt:rect('#prompt'),feedback:rect('#feedback'),
      links:rect('.small-links'),map:rect('.game-board'),next:rect('#next'),
      cardOverflow:question.scrollHeight-question.clientHeight,
      feedbackOverflow:document.getElementById('feedback').scrollHeight-document.getElementById('feedback').clientHeight,
      bodyHeight:document.body.scrollHeight};
    });
    console.log('TOPO NORTH '+height+' '+stage+' '+JSON.stringify(sizes));
    assert.ok(sizes.cardOverflow<=3,'North card scrolls and hides content: '+stage);
     assert.ok(sizes.prompt.bottom<=sizes.card.bottom-3,'North question text clipped: '+stage);
    // Vast scherm: hulpknoppen of VERDER! staan altijd helemaal in de vraagkaart.
    const actions=sizes.next.height?sizes.next:sizes.links;
    assert.ok(actions.height>=44,'North actions missing: '+stage);
    assert.ok(actions.bottom<=sizes.card.bottom-3,'North help actions clipped: '+stage);
    assert.ok(sizes.map.bottom<=sizes.viewport+3,'North map clipped: '+stage);
    assert.ok(sizes.map.height>=120,'North map collapsed: '+stage);
    assert.ok(sizes.bodyHeight<=sizes.viewport+8,'North page scrolls: '+stage);
    if(stage!=='initial'){
     // Feedback zweeft over de kaart: helemaal zichtbaar en nooit over de vraagkaart of de knoppen.
     assert.ok(sizes.feedback.height>0,'North feedback missing: '+stage);
     assert.ok(sizes.feedback.top>=sizes.map.top-1&&sizes.feedback.bottom<=sizes.map.bottom+1,'North feedback outside the map: '+stage);
     assert.ok(sizes.feedback.bottom<=sizes.card.top+1,'North feedback covers the question: '+stage);
     assert.ok(sizes.feedbackOverflow<=2,'North feedback clipped: '+stage);
    }
   }
   await check('initial');
   const target=await page.evaluate(()=>game.queue[game.idx]);
   const wrong=await page.evaluate(()=>db.find(item=>item.id!==game.queue[game.idx].id&&item.kind===game.queue[game.idx].kind)?.id);
   assert.ok(wrong,'Could not find wrong marker');
   await page.evaluate(id=>document.querySelector('#map [data-place="'+id+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:190,clientY:400})),wrong);
   assert.equal(await page.locator('#feedback').isVisible(),true);
   await check('wrong-answer');
   await page.screenshot({path:'test-results/topo/north-'+height+'-wrong.png',fullPage:true});
   await page.locator('#help').click();
   await check('multiline-hint');
   await page.screenshot({path:'test-results/topo/north-'+height+'-hint.png',fullPage:true});
   await page.evaluate(id=>document.querySelector('#map [data-place="'+id+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:190,clientY:400})),target.id);
   assert.equal(await page.locator('#next').isVisible(),true);
   await check('correct-answer');
  }finally{await page.close();}
 }
 await checkNorthFeedback(844);
 await checkNorthFeedback(650);
 // Fixed settings page: tabs, footer and the play action must remain visible.
 const settings=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await settings.goto(base+'/topo/instellingen/');
 for(const tab of ['area','practice','game']){
  await settings.locator('[data-tab='+tab+']').click();
  const position=await settings.evaluate(()=>{
   const rect=s=>document.querySelector(s).getBoundingClientRect();
   return {height:window.visualViewport?.height||window.innerHeight,bodyHeight:document.body.scrollHeight,
     footer:rect('.bottom').bottom,button:rect('#go').bottom};
  });
  assert.ok(position.footer<position.height+3,'Settings footer clipped '+tab);
  assert.ok(position.button<position.height+3,'Settings play button clipped '+tab);
  assert.ok(position.bodyHeight<=position.height+8,'Settings page scrolls '+tab);
  if(tab==='area')await settings.screenshot({path:'test-results/topo/fixed-settings.png',fullPage:true});
 }
 await settings.close();

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
 console.log('TOPO SHUFFLE initial counts '+JSON.stringify({waters,brain,zoomed,provinces,uniqueQuestions:initialPrompts.size}));
 assert.ok(waters>=2,'Shuffle must include at least two water questions');
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
