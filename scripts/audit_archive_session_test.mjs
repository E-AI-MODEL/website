// Run real browsers against synthetic documents. A genuine page error must
// be retained, and neither asynchronous work nor storage may cross entries.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium,webkit} from 'playwright';
import {inspectIsolatedPage,waitForArchivePage,openArchivePage} from './audit_archive_browser_session.mjs';

let badGuestRedirect=false,badResearchRedirect=false;
const server=createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if(req.url==='/first/'){
    res.end('<!doctype html><html><body><script>localStorage.setItem("audit-fixture","first");setTimeout(()=>{document.body.dataset.done="yes";throw Error("first-page-error");},120);setTimeout(()=>{throw Error("later-first-page-error");},1000);</script></body></html>');
  }else if(req.url==='/second/'){
    res.end('<!doctype html><html><body>Second page</body></html>');
  }else if(req.url==='/tools/anatomie/labs/hartslag/'){
    res.end('<!doctype html><html><body><div id="atlasLoading">Loading</div><script>window.__EAI_HEART_LAB__={state:{atlasReady:false,atlasRich:false,atlasError:null}};setTimeout(()=>{window.__EAI_HEART_LAB__.state={atlasReady:true,atlasRich:true,atlasError:null,atlasPartCount:34};document.getElementById("atlasLoading").hidden=true;},200);</script></body></html>');
  }else if(req.url==='/tools/anatomie/labs/hartslag/?broken=1'){
    res.end('<!doctype html><html><body><div id="atlasLoading">Loading</div><script>window.__EAI_HEART_LAB__={state:{atlasReady:false,atlasRich:false,atlasError:"fixture model failed",atlasPartCount:0}};</script></body></html>');
  }else if(/^\/leif\/(continue|verhaal|mijn|beheer)\/index\.html$/.test(req.url)){
    const destination=badGuestRedirect?'/second/':req.url.includes('/beheer/')?'/leif/?beheer=1':'/leif/';
    // A deliberately late redirect would outlive the old fixed 60 ms wait.
    res.end('<!doctype html><html><body>Redirecting<script>setTimeout(()=>location.replace('+JSON.stringify(destination)+'),250)</script></body></html>');
  }else if(req.url==='/verdieping/index.html'){
    res.end('<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/kennis/"></head><body>Redirecting</body></html>');
  }else if(req.url==='/kennis/'||req.url==='/kennis/index.html'){
    const destination=badResearchRedirect?'/second/':'/nl/onderzoek/';
    res.end('<!doctype html><html><body>Redirecting<script>setTimeout(()=>location.replace('+JSON.stringify(destination)+'),250)</script></body></html>');
  }else if(req.url==='/nl/onderzoek/'||req.url==='/nl/onderzoek/index.html'){
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/research-layout.css"></head><body><main><section class="knowledge-routes"><a id="researchLink" href="/second/">Research destination</a></section></main></body></html>');
  }else if(req.url==='/research-layout.css'){
    res.setHeader('Content-Type','text/css');
    setTimeout(()=>res.end('body{margin:0} .knowledge-routes{display:block;width:100%;max-width:100%} #researchLink{display:block;width:100%;max-width:100%}'),350);
  }else if(req.url==='/leif/'||req.url==='/leif/?beheer=1'){
    const admin=req.url.includes('beheer=1');
    res.end('<!doctype html><html><body><section id="accessGate"><form id="accessForm" '+(admin?'hidden':'')+'><input type="password"></form><form id="adminLoginForm" '+(admin?'':'hidden')+'><input type="email"></form></section><main id="appRoot" hidden>Private content</main></body></html>');
  }else{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port, options={viewport:{width:390,height:900}};
try{
  for(const engine of [chromium,webkit]){
    const browser=await engine.launch({headless:true});
    try{
      const first=await inspectIsolatedPage(browser,options,{path:'/first/'},async page=>{
        await page.goto(base+'/first/');
        await page.waitForFunction(()=>document.body.dataset.done==='yes');
        await page.waitForTimeout(80);
      },base);
      assert.equal(first.failure,undefined);
      assert(first.jsErrors.some(message=>message.includes('first-page-error')),engine.name()+' must retain the real first-page error');
      assert(first.jsErrorDetails.every(detail=>detail.pageUrl===base+'/first/'));
      const second=await inspectIsolatedPage(browser,options,{path:'/second/'},async page=>{
        await page.goto(base+'/second/');
        assert.equal(await page.evaluate(()=>localStorage.getItem('audit-fixture')),null);
        await page.waitForTimeout(1100);
      },base);
      assert.equal(second.failure,undefined);
      assert.deepEqual(second.jsErrors,[]);
      const heart=await inspectIsolatedPage(browser,options,{},async page=>{
        await page.goto(base+'/tools/anatomie/labs/hartslag/',{waitUntil:'domcontentloaded'});
        const result=await waitForArchivePage(page,'tools/anatomie/labs/hartslag/index.html',base);
        assert.equal(result.heartAtlas.atlasPartCount,34);
        assert.equal(result.heartAtlas.atlasRich,true);
      },base);
      assert.equal(heart.failure,undefined);
      assert.deepEqual(heart.jsErrors,[]);
      const broken=await inspectIsolatedPage(browser,options,{},async page=>{
        await page.goto(base+'/tools/anatomie/labs/hartslag/?broken=1');
        await waitForArchivePage(page,'tools/anatomie/labs/hartslag/index.html',base);
      },base);
      assert.match(broken.failure,/fixture model failed/);
      for(const route of ['continue','verhaal','mijn','beheer']){
        const target=route==='beheer'?'/leif/?beheer=1':'/leif/';
        const guest=await inspectIsolatedPage(browser,options,{},async page=>{
          const result=await openArchivePage(page,'leif/'+route+'/index.html',base);
          assert.equal(result.guestRedirect,base+target);
          assert.equal(await page.locator('#appRoot').isVisible(),false);
          assert.equal(await page.locator(route==='beheer'?'#adminLoginForm':'#accessForm').isVisible(),true);
          // Exercise the same post-navigation measurement the real audit uses.
          assert.equal(await page.evaluate(()=>document.documentElement.clientWidth),390);
        },base);
        assert.equal(guest.failure,undefined,engine.name()+' '+route+' guest redirect: '+guest.failure);
        assert.deepEqual(guest.jsErrors,[]);
      }
      badGuestRedirect=true;
      try{
        const wrong=await inspectIsolatedPage(browser,options,{},async page=>{
          await openArchivePage(page,'leif/continue/index.html',base,1500);
        },base);
        assert.match(wrong.failure,/Timeout|timeout/,engine.name()+' must reject a wrong redirect');
      }finally{badGuestRedirect=false;}
      for(const route of ['verdieping/index.html','kennis/index.html','nl/onderzoek/index.html']){
        const research=await inspectIsolatedPage(browser,options,{},async page=>{
          const result=await openArchivePage(page,route,base);
          assert.equal(new URL(result.researchDestination).pathname.replace(/index\.html$/,''),'/nl/onderzoek/');
          const ready=await page.evaluate(()=>({
            ready:document.readyState,fonts:document.fonts.status,
            width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
            style:getComputedStyle(document.querySelector('#researchLink')).display
          }));
          assert.equal(ready.ready,'complete');assert.equal(ready.fonts,'loaded');
          assert.equal(ready.style,'block','Destination stylesheet must be loaded');
          assert.equal(ready.width,ready.viewport);
          // Genuine overflow must remain measurable, not be hidden or ignored.
          await page.locator('#researchLink').evaluate(el=>{el.style.maxWidth='none';el.style.width='420px'});
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2));
        },base);
        assert.equal(research.failure,undefined,engine.name()+' '+route+': '+research.failure);
        assert.deepEqual(research.jsErrors,[]);
      }
      badResearchRedirect=true;
      try{
        const wrong=await inspectIsolatedPage(browser,options,{},async page=>{
          await openArchivePage(page,'verdieping/index.html',base,1500);
        },base);
        assert.match(wrong.failure,/Timeout|timeout/,engine.name()+' must reject a wrong research redirect');
      }finally{badResearchRedirect=false;}
      assert.equal(browser.contexts().length,0);
      console.log(engine.name()+': isolated documents, genuine errors retained, atlas readiness, failed model and four protected LEIF redirects and the loaded research aliases verified');
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
