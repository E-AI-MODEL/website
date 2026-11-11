// Controls and geometry for the three learning modes on phone-sized screens.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';

const root=resolve(process.argv[2]||'site-build');
const port=8873,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<75;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const browserType=process.argv[3]==='webkit'?webkit:chromium;
 browser=await browserType.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#projectile',{waitUntil:'load'});
 await page.locator('#mobileAim').waitFor({state:'visible'});
 assert(await page.locator('#aimFire').isVisible(),'Mobiele schietknop is zichtbaar');
 assert.equal(await page.locator('#inquiryAction').isVisible(),false,'Dubbele schietknop is op mobiel verborgen');
 assert.equal(await page.locator('#inquiryTitle').innerText(),'Kun jij de bal op de mat laten landen?');
 assert(await page.locator('#aimFire').innerText().then(t=>t==='Gooi de bal'));
 assert(await page.locator('#aimFeedback').isHidden(),'Geen resultaat tonen voor de eerste worp');
 assert(!(await page.locator('.analysis-shell').isVisible()),'Grafieken en onderzoekstabs verschijnen niet voor de eerste poging');
 let v=await page.evaluate(()=>{
  const canvas=document.querySelector('#scene'),frame=projectileMobileFrame(state.p),g=sceneViewport(canvas);
  return {frame,g,play:mission.launched,scroll:document.documentElement.scrollWidth,screen:innerWidth,
    css: getComputedStyle(document.querySelector('#stage')).touchAction,
    aimBar:document.querySelector('#mobileAim').getBoundingClientRect().width
  };
 });
 assert(!v.play,'De simulatie wacht op de gebruiker');
 assert.equal(v.g.virtualWidth,560);
 assert.equal(v.g.virtualHeight,520);
 assert.equal(v.css,'none');
 assert(v.g.left>=-1 && v.g.top>=-1,'Scène is niet uit verhouding getrokken');
 assert(v.frame.targetX>100&&v.frame.targetX<520,'Doel zichtbaar in doelweergave');
 assert(v.scroll<=v.screen+1,'Geen horizontale pagina-overloop op iPhone');
 await page.locator('#scene').screenshot({path:'test-results/science-worp-390-start.png'});
 await page.locator('[data-aim-key="angle"][data-aim-delta="0.5"]').click();
 assert.equal(await page.locator('#aimAngleValue').textContent(),'45,5°');
 const touch=await page.evaluate(()=>{
  const canvas=document.querySelector('#scene'),f=projectileMobileFrame(state.p),g=sceneViewport(canvas),r=canvas.getBoundingClientRect();
  return {x:r.x+g.left+f.handle.x*g.scale,y:r.y+g.top+f.handle.y*g.scale};
 });
 await page.mouse.move(touch.x,touch.y);await page.mouse.down();
 await page.mouse.move(touch.x+20,touch.y+14,{steps:6});await page.mouse.up();
 const moved=await page.evaluate(()=>({angle:state.p.angle,v:state.p.v}));
 assert(Math.abs(moved.angle-45.5)>0.4||Math.abs(moved.v-18)>0.1,'De groene greep verandert de werkelijke instelling');
 await page.locator('#aimFire').click();
 await page.waitForTimeout(250);
 const visibleScene=await page.evaluate(()=>{const rect=document.querySelector('#stage').getBoundingClientRect();return{top:rect.top,bottom:rect.bottom,height:rect.height,viewport:innerHeight}});
 assert(visibleScene.top>=55&&visibleScene.bottom<=visibleScene.viewport-10,'Tijdens de worp blijft de hele tekening zichtbaar');
 await page.screenshot({path:'test-results/science-worp-vlucht-op-telefoon.png'});
 console.log('SHOT-START',JSON.stringify(await page.evaluate(()=>({playing:state.playing,launched:mission.launched,complete:mission.complete,t:state.t,p:state.p}))),errors);
 await page.waitForTimeout(3600);
 console.log('SHOT-AFTER',JSON.stringify(await page.evaluate(()=>({playing:state.playing,launched:mission.launched,complete:mission.complete,t:state.t,p:state.p,shots:mission.shots.length}))),errors);
 await page.waitForFunction(()=>mission.complete===true,null,{timeout:2500});
 assert.equal(await page.locator('#aimFire').textContent(),'Probeer opnieuw');
 assert.equal(await page.evaluate(()=>mission.shots.length),1,'De eerste landingsplek wordt bewaard');
 assert(await page.locator('#aimFeedback').isVisible(),'Leerling krijgt feedback bij de bediening');
 assert(await page.locator('.analysis-shell').isVisible(),'Verdieping is beschikbaar na een poging');
 await page.locator('#scene').screenshot({path:'test-results/science-worp-390-geland.png'});
 await page.locator('#aimFire').click();
 const reset=await page.evaluate(()=>({launched:mission.launched,complete:mission.complete,shots:mission.shots.length}));
 assert(!reset.launched&&!reset.complete&&reset.shots===1,'Nieuwe poging zet de bal klaar en bewaart het oude resultaat');
 await page.locator('#aimSpeed').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}))});
 const before=await page.evaluate(()=>projectileMobileFrame(state.p).scale);
 await page.locator('#mobileView').click();
 const after=await page.evaluate(()=>({scale:projectileMobileFrame(state.p).scale,view:mission.view}));
 assert(after.view==='overview'&&after.scale<before,'Hele baan zoomt fysisch correct uit');
 await page.locator('#scene').screenshot({path:'test-results/science-worp-390-overzicht.png'});
 await page.setViewportSize({width:320,height:720});
 await page.waitForTimeout(180);
 const small=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,controls:document.querySelector('.aim-row').getBoundingClientRect().right,offenders:[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName,id:el.id,cls:typeof el.className==='string'?el.className.slice(0,75):'',left:r.left,right:r.right,width:r.width}}).filter(o=>o.right>innerWidth+2||o.left< -2).sort((a,b)=>b.right-a.right).slice(0,18)}));
 console.log('MOBILE-320',JSON.stringify(small));
 await page.screenshot({path:'test-results/science-worp-320-diagnostic.png'});
 assert(small.scroll<=small.width+1,'Geen horizontale overloop op smalle telefoon');
 assert(small.controls<=small.width,'Fijnregelaars blijven binnen het scherm');
 await page.screenshot({path:'test-results/science-worp-320.png'});
 await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#interference',{waitUntil:'load'});
 await page.waitForFunction(()=>state.id==='interference');
 const wave=await page.evaluate(()=>({g:sceneViewport(document.querySelector('#scene')),mobileAimVisible:getComputedStyle(document.querySelector('#mobileAim')).display}));
 assert.equal(wave.g.virtualWidth,1000,'Andere proeven behouden hun eigen projectie');
 assert(await page.locator('.analysis-shell').isVisible(),'Golvengrafieken blijven zichtbaar');
 assert.equal(wave.mobileAimVisible,'none','Richtknoppen staan niet bij golven');
 await page.locator('#scene').screenshot({path:'test-results/science-interferentie-320.png'});
 assert.deepEqual(errors,[],'Geen JavaScript-fouten op telefoon');
 await page.setViewportSize({width:1280,height:850});
 await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#projectile',{waitUntil:'load'});
 assert(!(await page.locator('#mobileAim').isVisible()),'Mobiele bediening verdwijnt op desktop');
 const desktop=await page.evaluate(()=>sceneViewport(document.querySelector('#scene')));
 assert.equal(desktop.virtualWidth,1000,'Desktop houdt bestaande werkruimte');
 console.log('Mobiele projectie, fijnregeling, richten, schieten en weergave gecontroleerd.');
}finally{
 if(browser)await browser.close();
 server.kill();
}
