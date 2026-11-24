/* Public editorial pages: open cards, same header and visual style as homepage. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const base='http://127.0.0.1:8794';
const server=spawn('python3',['-m','http.server','8794','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const results=[];
const hubs=['/nl/onderzoek/','/nl/onderwijs/','/nl/publicaties/','/nl/toepassingen/','/nl/tools/','/nl/over/','/en/education/','/en/research/','/en/applications/','/en/publications/','/en/about/'];
const articles=['/nl/blog/','/nl/blog/wat-ons-werk-ons-werk-maakt/','/nl/onderzoek/leermiddelen/','/en/research/teaching-tools/'];
try{
 let ready=false;
 for(let i=0;i<65;i++){
  try{ready=(await fetch(base+'/nl/onderzoek/')).ok;}catch{}
  if(ready)break;
  await new Promise(done=>setTimeout(done,100));
 }
 assert(ready,'Built editorial page not available');
 browser=await chromium.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 for(const width of [320,390,768,1440]){
  const phone=width<=768;
  const page=await browser.newPage({viewport:{width,height:900},isMobile:phone,hasTouch:phone});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  for(const path of [...hubs,...articles]){
   await page.goto(base+path,{waitUntil:'load'});
   assert.equal(await page.locator('body.eai-story-page').count(),1,path+': shared editorial style');
   assert.equal(await page.locator('main .eai-card-deck').count(),0,path+': no horizontal card deck');
   assert.equal(await page.locator('.eai-story-rail').count(),0,path+': no duplicate rail');
   assert.equal(await page.locator('link[href*="site-story-cards."]').count(),1,path+': stylesheet loaded');
   const m=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth-innerWidth,
    illustrations:document.querySelectorAll('main .eai-continuity-art').length,
    links:document.querySelectorAll('main a[href]').length
   }));
   assert(m.overflow<=3,path+' '+width+': horizontal overflow '+m.overflow);
   assert(m.links>0,path+': page links missing');
   if(['/nl/onderzoek/','/nl/onderwijs/','/nl/toepassingen/'].includes(path))
    assert(m.illustrations>=2,path+': illustrated choices missing');
   if(path==='/nl/tools/'){
    const figures=await page.locator('.eai-explore-choice .eai-continuity-art svg').all();
    assert.equal(figures.length,8,'Eight subject-specific illustrations required');
    const signatures=await Promise.all(figures.map(el=>el.evaluate(svg=>svg.innerHTML)));
    assert.equal(new Set(signatures).size,8,'No repeated generic art for different subjects');
   }
   if(width===1440){
    const sel=path==='/nl/onderzoek/'?'.knowledge-route':path==='/nl/onderwijs/'?'.education-choice-grid>a':path==='/nl/publicaties/'?'.publication-card':path==='/nl/toepassingen/'?'.case-card':null;
    if(sel){
     const cards=page.locator('main '+sel);
     if(await cards.count()>1){
      const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();
      assert(a&&b&&Math.abs(a.y-b.y)<42,path+': cards must share a desktop row');
      if(path==='/nl/onderzoek/'&&await cards.count()===3){
       const wide=await cards.nth(2).boundingBox();
       assert(wide.width>a.width*1.65,'Third research route spans both columns');
      }
     }
    }
   }
   if([390,1440].includes(width)&&['/nl/onderzoek/','/nl/onderwijs/','/nl/publicaties/','/nl/toepassingen/','/nl/tools/'].includes(path))
    await page.screenshot({path:'test-results/home-continuity-'+path.split('/')[2]+'-'+width+'.png',fullPage:true});
   results.push({path,width,...m});
  }
  await page.goto(base+'/nl/onderzoek/',{waitUntil:'load'});
  assert.equal(await page.locator('.eai-story-search-button').count(),0,'No duplicate search control on editorial pages');
  await page.locator('.eai-site-search-trigger').click();
  assert.equal(await page.locator('.eai-site-menu').getAttribute('open'),'');
  await page.waitForFunction(()=>document.querySelector('#eai-site-search-input')===document.activeElement,null,{timeout:4500});
  if(width>=1100)assert(await page.locator('.eai-site-primary').isVisible(),'Homepage header on desktop');
  if(width<=620){
   await page.goto(base+'/nl/onderwijs/',{waitUntil:'load'});
   const details=page.locator('main .eai-story-mobile-detail');
   assert.equal(await details.count(),1);
   assert.equal(await details.getAttribute('open'),null);
   await details.locator('summary').click();
   assert.equal(await details.getAttribute('open'),'');
  }
  assert.deepEqual(errors,[],'JavaScript errors at '+width);
  await page.close();
 }
 const fallback=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const nojs=await fallback.newPage();
 await nojs.goto(base+'/nl/publicaties/',{waitUntil:'load'});
 assert.equal(await nojs.locator('.eai-card-deck').count(),0);
 assert((await nojs.locator('main .card-grid a[href]').count())>=5);
 await nojs.goto(base+'/nl/tools/',{waitUntil:'load'});
 assert.equal(await nojs.locator('main .eai-explore-choice').count(),8);
 assert.equal(await nojs.locator('main a[href="/tools/abyss/"]').count(),1);
 await fallback.close();
 const protectedPage=await browser.newPage();
 await protectedPage.goto(base+'/tools/science-observatory/labs/natuurkunde/',{waitUntil:'domcontentloaded'});
 assert.equal(await protectedPage.locator('body.eai-story-page').count(),0);
 assert.equal(await protectedPage.locator('link[href*="site-story-cards."]').count(),0);
 await protectedPage.close();
 writeFileSync('test-results/eai-editorial-cards.json',JSON.stringify({results,noJS:true,protectedLabs:true},null,2));
 console.log('PASS: homepage layout, open cards, mobile navigation and protected labs');
}finally{
 if(browser)await browser.close();
 server.kill();
}
