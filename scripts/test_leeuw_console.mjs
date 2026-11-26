// Shared by the production browser test and the independent mobile WebKit test.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const path='/tools/science-observatory/labs/leeuw/';
const state=p=>p.evaluate(()=>window.LEO_STATE());
async function fixed(p,w,h,mobile){
  const m=await p.evaluate(()=>{
    const box=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
    return {height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,stage:box('#stage'),canvas:box('#scene'),head:box('.stage-head'),footer:box('.stage-footer'),console:box('#app'),nav:[...document.querySelectorAll('.nav-btn')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,hit:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.nav-btn')}})};
  });
  assert.ok(m.height<=h+1&&m.width<=w+1,'Geen scroll: '+JSON.stringify(m));
  assert.ok(m.console.h>=h-1&&m.console.h<=h+1,'Console moet viewport vullen');
  assert.ok(m.nav.every(n=>n.hit&&n.x>=0&&n.right<=w+1),'Zeven zichtbare en aanraakbare onderwerpen');
  assert.ok(m.canvas.y>=m.head.bottom-1&&m.canvas.bottom<=m.footer.y+1,'Model niet achter kop of bediening: '+JSON.stringify(m));
  assert.ok(m.canvas.h>200&&m.canvas.w>230,'Modelruimte te klein: '+JSON.stringify(m.canvas));
  if(mobile)assert.ok(m.stage.h>h*.78,'Model is niet dominant op mobiel');
}
export async function runLeeuwConsoleChecks(browser,base,engine='chromium'){
  mkdirSync('test-results',{recursive:true});
  for(const [w,h] of [[1440,900],[390,760],[320,640]]){
    const mobile=w<=850,ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:mobile && engine!=='firefox',hasTouch:mobile,deviceScaleFactor:1,reducedMotion:'no-preference'});
    const p=await ctx.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    const shot=name=>p.screenshot({path:'test-results/leeuw-'+engine+'-'+w+'-'+name+'.png'});
    const mode=async id=>{await p.locator('[data-mode="'+id+'"]').click();await p.waitForFunction(m=>window.LEO_STATE().mode===m,id)};
    const open=async()=>{if(mobile)await p.locator('#labDock').click()};
    const close=async()=>{if(mobile)await p.locator('#panelClose').click()};
    const range=async v=>p.locator('#quickRange').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},v);
    await p.goto(base+path+'#hemel',{waitUntil:'load'});
    await p.waitForFunction(()=>window.LEO_STATE?.().points===9);
    await p.waitForFunction(()=>{const c=document.querySelector('#scene').getBoundingClientRect(),f=document.querySelector('.stage-footer').getBoundingClientRect();return c.bottom<=f.top+1});
    await fixed(p,w,h,mobile);
    assert.equal(await p.locator('.nav-btn').count(),7);
    assert.equal(await p.locator('.inspector').isVisible(),!mobile);
    assert.equal(await p.locator('.analytics').isVisible(),!mobile);
    await shot('hemel');
    await mode('ruimte');
    await p.waitForFunction(()=>window.LEO_STATE().blend>.20&&window.LEO_STATE().blend<.80);
    const mid=await p.locator('#scene').evaluate(c=>c.toDataURL());
    await shot('overgang');
    await p.waitForFunction(()=>window.LEO_STATE().blend>.999&&window.LEO_STATE().animating);
    assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),mid,'Overgang verandert het echte beeld');
    const initial=(await state(p)).yaw;
    await p.waitForFunction(y=>Math.abs(window.LEO_STATE().yaw-y)>.025,initial);
    await p.locator('#spin').click();
    const paused=await state(p);await p.waitForTimeout(220);const after=await state(p);
    assert.equal(paused.yaw,after.yaw,'Pauze zet camera stil');assert.equal(after.animating,false);
    await fixed(p,w,h,mobile);await shot('ruimte');
    await p.locator('#side').click();await p.waitForFunction(()=>window.LEO_STATE().view==='side');
    const c=await p.locator('#scene').boundingBox(),yaw=(await state(p)).yaw;
    await p.mouse.move(c.x+c.width*.45,c.y+c.height*.7);
    await p.mouse.down();await p.mouse.move(c.x+c.width*.68,c.y+c.height*.65,{steps:8});await p.mouse.up();
    assert.notEqual((await state(p)).yaw,yaw,'Slepen draait de camera');
    await range(35);assert.ok(Math.abs((await state(p)).blend-.35)<.01,'Schuif bestuurt de werkelijke projectie');
    await p.locator('#near').click();await p.waitForFunction(()=>window.LEO_STATE().points===8&&window.LEO_STATE().blend>.999);
    await shot('nabij');await open();
    await p.locator('.star[data-id="49583"]').click();await p.waitForFunction(()=>window.LEO_STATE().view==='space'&&window.LEO_STATE().star===49583);
    await shot('metingen');await close();
    await mode('meten');await open();
    await p.locator('#pairA').selectOption('49669');await p.locator('#pairB').selectOption('49583');
    assert.ok(Math.abs((await state(p)).separation-1736.502)<.02);await close();
    await mode('parallax');const d0=(await state(p)).distance;await range(1);
    await p.waitForFunction(old=>window.LEO_STATE().distance<old,d0);
    if(mobile){await p.locator('#graphToggle').click();assert.equal(await p.locator('.analytics').isVisible(),true);assert.equal(await p.locator('#chart').isVisible(),true);await shot('grafiek');await p.locator('#graphClose').click();assert.equal(await p.locator('.analytics').isVisible(),false)}
    await mode('licht');await p.locator('#quickAction').click();assert.equal((await state(p)).light,'absolute');
    await mode('beweging');await p.locator('#spin').click();await p.waitForFunction(()=>window.LEO_STATE().years>300);await p.locator('#spin').click();await range(20000);assert.equal((await state(p)).years,20000);
    await mode('waarnemen');await open();await p.locator('#lat').fill('0');await p.locator('#lon').fill('0');assert.ok((await state(p)).points<=9);await close();
    await fixed(p,w,h,mobile);assert.deepEqual(errors,[],'Browserfouten op '+engine+'/'+w);
    await ctx.close();
  }

  // The public route is now a film. Verify the actual rendered scene, not just its text.
  for(const [w,h] of [[1440,900],[390,760],[320,640]]){
    const mobile=w<850,ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:mobile && engine!=='firefox',hasTouch:mobile,deviceScaleFactor:1,reducedMotion:'no-preference'});
    const p=await ctx.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await p.goto(base+path,{waitUntil:'load'});
    await p.waitForFunction(()=>window.LEO_VOYAGE_STATE?.().frame>3);
    assert.equal(await p.locator('#voyage').isVisible(),true);
    assert.equal(await p.locator('#app').isVisible(),false);
    assert.equal(await p.locator('.voyage-chapter').count(),5);
    const vs=()=>p.evaluate(()=>window.LEO_VOYAGE_STATE());
    const shot=async name=>{await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#voyageCopy')).opacity)>.98);await p.screenshot({path:'test-results/leeuw-'+engine+'-'+w+'-reis-'+name+'.png'})};
    const seek=async v=>{const before=(await vs()).frame;await p.locator('#voyageSeek').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},v);await p.waitForFunction(frame=>window.LEO_VOYAGE_STATE().frame>frame,before)};
    const visible=async()=>{
      const m=await p.evaluate(()=>{
        const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom,w:r.width,h:r.height}};
        const all=[...document.querySelectorAll('#voyage .voyage-button,#voyage .voyage-lab,#voyage .voyage-chapter')].filter(x=>!x.disabled);
        return {scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,canvas:box('#voyageCanvas'),copy:box('#voyageCopy'),foot:box('.voyage-footer'),top:box('.voyage-top'),hit:all.every(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})};
      });
      assert.ok(m.scrollWidth<=w+1&&m.scrollHeight<=h+1,'Reis mag niet scrollen');
      assert.ok(m.canvas.w>=w-1&&m.canvas.h>=h-1,'Canvas vult viewport');
      assert.ok(m.copy.b<=m.foot.y+1&&m.copy.y>=m.top.b-1&&m.hit,'Uitleg en bediening overlappen of zijn onbereikbaar: '+JSON.stringify(m));
    };
    // Keep the same visible control while playback advances.
    console.log('Leeuw '+engine+'/'+w+': controle afspelen en pauzeren');
    const initialControl=await p.evaluate(()=>{
      const button=document.querySelector('#voyagePlay');
      window.__leeuwPlayIcon=button.querySelector('svg');
      window.__leeuwPlayPath=window.__leeuwPlayIcon.querySelector('path');
      return window.LEO_VOYAGE_STATE().time;
    });
    await p.waitForFunction(t=>window.LEO_VOYAGE_STATE().time>t+.35,initialControl);
    assert.ok(await p.evaluate(()=>{
      const svg=document.querySelector('#voyagePlay svg');
      return svg===window.__leeuwPlayIcon&&svg.querySelector('path')===window.__leeuwPlayPath;
    }),'Afspelen mag het aanraakdoel niet vervangen');
    assert.equal(await p.locator('#voyagePlay').getAttribute('aria-label'),'Pauzeren');
    await p.locator('#voyagePlay').click();
    let first=await vs();assert.equal(first.playing,false);
    assert.equal(await p.locator('#voyagePlay').getAttribute('aria-label'),'Afspelen');
    await p.waitForTimeout(250);assert.equal((await vs()).time,first.time);
    await seek(9);await visible();assert.equal((await vs()).chapter,0);await shot('hemel');
    const earth=await p.locator('#voyageCanvas').evaluate(c=>c.toDataURL());
    await seek(31);await visible();const side=await vs();assert.equal(side.chapter,1);assert.ok(Math.hypot(...side.position)>100);
    assert.notEqual(await p.locator('#voyageCanvas').evaluate(c=>c.toDataURL()),earth,'Echte camera moet ander beeld tonen');
    await shot('opzij');
    await seek(48);await visible();assert.equal((await vs()).focus,49669);assert.ok((await vs()).projected>=1);assert.ok((await vs()).portrait>.99);assert.match(await p.locator('#voyageSceneLabel').textContent(),/ILLUSTRATIEF DETAILBEELD/);await shot('regulus');
    await seek(72);await visible();assert.equal((await vs()).focus,49583);assert.ok(Math.hypot(...(await vs()).position)>1000);await shot('eta');
    await seek(94);await visible();assert.equal((await vs()).chapter,4);assert.ok(Math.hypot(...(await vs()).position)<1);await shot('terug');
    await p.locator('.voyage-chapter').nth(1).click();assert.equal((await vs()).chapter,1);
    await p.locator('#voyageNext').click();assert.equal((await vs()).chapter,2);
    await p.locator('#voyagePlay').click();const before=(await vs()).time;await p.waitForFunction(t=>window.LEO_VOYAGE_STATE().time>t+.2,before);
    assert.equal(await p.locator('#voyagePlay').getAttribute('aria-label'),'Pauzeren');
    assert.ok(await p.evaluate(()=>document.querySelector('#voyagePlay path')===window.__leeuwPlayPath),'Ook hervatten behoudt het oorspronkelijke pictogram');
    console.log('Leeuw '+engine+'/'+w+': van ruimtereis naar onderzoeksconsole');
    await p.locator('#openLab').click();
    await p.waitForFunction(()=>!window.LEO_VOYAGE_STATE().visible&&window.LEO_STATE().mode==='hemel');
    assert.equal(await p.locator('#app').isVisible(),true);
    await p.locator('#returnVoyageTop').click();
    await p.waitForFunction(()=>window.LEO_VOYAGE_STATE().visible);
    assert.equal(await p.locator('#voyage').isVisible(),true);
    await p.locator('#voyageSources').click();await p.waitForFunction(()=>!window.LEO_VOYAGE_STATE().visible&&document.querySelector('#bronnen details').open);assert.equal(await p.locator('#bronnen').isVisible(),true);
    assert.deepEqual(errors,[],'Reis browserfouten op '+engine+'/'+w);
    await ctx.close();
  }
  const still=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const film=await still.newPage();await film.goto(base+path,{waitUntil:'load'});
  await film.waitForFunction(()=>window.LEO_VOYAGE_STATE?.().frame>0);
  const v=await film.evaluate(()=>window.LEO_VOYAGE_STATE());
  assert.equal(v.playing,false,'Verminderde beweging start zonder film');assert.equal(v.time,9);
  await film.locator('#voyageNext').click();assert.equal(await film.evaluate(()=>window.LEO_VOYAGE_STATE().chapter),1);assert.equal(await film.evaluate(()=>window.LEO_VOYAGE_STATE().time),31);
  await still.close();

  const reduced=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const p=await reduced.newPage();await p.goto(base+path+'#ruimte',{waitUntil:'load'});await p.waitForFunction(()=>window.LEO_STATE?.().points===9);
  const r=await state(p);assert.equal(r.blend,1);assert.equal(r.animating,false,'Respecteer verminderde beweging');await reduced.close();
  console.log('Leeuw '+engine+': vast scherm, zeven onderwerpen, 3D-overgang, rotatie, pauze, schuif, metingen, grafiek en verminderde beweging geslaagd.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(process.argv[2]||'site-build'),engine=process.argv[3]||'chromium',base='http://127.0.0.1:8797';
  const server=spawn('python3',['-m','http.server','8797','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
  let browser;
  try{
    let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+path,{method:'HEAD'})).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100))}
    assert.ok(ready,'Leeuw ontbreekt');
    browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});await runLeeuwConsoleChecks(browser,base,engine);
  }finally{if(browser)await browser.close();server.kill()}
}
