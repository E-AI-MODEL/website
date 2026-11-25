// Read-only rendering checks of EVERY generated page, not only the index routes.
import {chromium, webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {inspectIsolatedPage,waitForArchivePage} from './audit_archive_browser_session.mjs';
const root=resolve('site-build'), base='http://127.0.0.1:8784';
const inventory=JSON.parse(readFileSync('audit-results/inventory.json','utf8'));
const server=spawn('python3',['-m','http.server','8784','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
mkdirSync('audit-results/screenshots',{recursive:true});
let browser;
const reports=[], external=[];
try {
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const [engine,width] of [[chromium,1440],[webkit,390]]){
  browser=await engine.launch({headless:true});
  for(const item of inventory.pages){
   const entry={path:item.path,engine:engine.name(),width};
   await inspectIsolatedPage(browser,{viewport:{width,height:900}},entry,async page=>{
    await page.goto(base+'/'+item.path,{waitUntil:'domcontentloaded',timeout:12000});
    Object.assign(entry,await waitForArchivePage(page,item.path,base));
    await page.waitForTimeout(60);
    entry.finalUrl=page.url();
    Object.assign(entry,await page.evaluate(()=>({
     horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
     viewportWidth:document.documentElement.clientWidth,
     documentWidth:document.documentElement.scrollWidth,
     overflowingElements:document.documentElement.scrollWidth>document.documentElement.clientWidth+2
      ?[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,className:String(e.getAttribute('class')||''),r:e.getBoundingClientRect()})).filter(e=>e.r.width>0&&e.r.right>document.documentElement.clientWidth+2).sort((a,b)=>b.r.right-a.r.right).slice(0,10).map(e=>({tag:e.tag,id:e.id,className:e.className,right:Math.round(e.r.right),width:Math.round(e.r.width)}))
      :[],
     h1:document.querySelector('h1')?.textContent,
     menu:!!document.querySelector('.eai-site-menu'),
     oldHeaders:document.querySelectorAll('header.site-header,header.eai-site-nav').length,
     narrowText:[...document.querySelectorAll('main p')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.width<125&&e.textContent.length>60}).map(e=>e.textContent.slice(0,130)),
     visibleButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.textContent.trim()).slice(0,30),
     textLength:(document.querySelector('main')||document.body).innerText.length
    })));
    if(await page.locator('.eai-site-menu>summary').count()){
     await page.locator('.eai-site-menu>summary').click();
     const rect=await page.locator('.eai-site-menu-panel').boundingBox();
     entry.menuWithinViewport=!!rect&&rect.x>=0&&rect.x+rect.width<=width+1;
     await page.keyboard.press('Escape');
    }
    const article=/^(publicaties|eai-blog)\/.+\/index\.html$/.test(item.path);
    const tool=/^(tools|eai-tools-modules)\/.+\/index\.html$/.test(item.path);
    if(article||tool||entry.horizontalOverflow||entry.narrowText.length){
     entry.screenshot='screenshots/'+item.path.replaceAll('/','_')+'-'+engine.name()+'.png';
     await page.screenshot({path:'audit-results/'+entry.screenshot,fullPage:true,timeout:12000});
    }
   },base);
   reports.push(entry);
  }
  await browser.close();browser=null;
 }
 browser=await chromium.launch({headless:true});
 const urls=JSON.parse(readFileSync('audit-results/external-tools.json','utf8'));
 for(const url of urls){
  const entry={url,interactionTested:false};
  await inspectIsolatedPage(browser,{viewport:{width:390,height:844}},entry,async page=>{
   const resp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForTimeout(1500);
   entry.status=resp?.status();entry.finalUrl=page.url();
   Object.assign(entry,await page.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,18000),overflow:document.documentElement.scrollWidth>innerWidth+2,buttons:[...document.querySelectorAll('button,input[type=submit]')].map(e=>({text:e.textContent?.trim()||e.value,id:e.id,disabled:e.disabled})).slice(0,70),inputs:[...document.querySelectorAll('input,textarea,select')].map(e=>({tag:e.tagName,type:e.type,id:e.id,name:e.name,placeholder:e.getAttribute('placeholder')})).slice(0,50)})));
   const name=new URL(url).hostname.replaceAll('.','_');
   entry.screenshot='screenshots/external-'+name+'.png';await page.screenshot({path:'audit-results/'+entry.screenshot,fullPage:true,timeout:15000});
  });
  external.push(entry);
 }
} finally {
 if(browser)await browser.close();server.kill();
 writeFileSync('audit-results/browser.json',JSON.stringify({reports,external,limits:['Local browser tests block outside embeds and do not grade the claims.','External pages were rendered; form outputs require separate task-based checks.']},null,2));
 const failed=reports.filter(x=>x.failure||x.jsErrors?.length||x.horizontalOverflow||x.menuWithinViewport===false);
 writeFileSync('audit-results/render-failures.json',JSON.stringify(failed,null,2));
 console.log(JSON.stringify({renders:reports.length,overflow:reports.filter(x=>x.horizontalOverflow).length,errors:reports.filter(x=>x.jsErrors?.length||x.failure).length,external:external.length,localFailures:failed.length}));
 // External access controls are neither proof of a broken tool nor approval.
 if(failed.length){console.error('Local rendering checks failed: '+failed.map(x=>x.engine+': '+x.path).join(', '));console.error(JSON.stringify(failed.map(x=>({path:x.path,engine:x.engine,finalUrl:x.finalUrl,viewportWidth:x.viewportWidth,documentWidth:x.documentWidth,overflowingElements:x.overflowingElements,failure:x.failure,jsErrors:x.jsErrors,jsErrorDetails:x.jsErrorDetails,heartAtlas:x.heartAtlas,menuWithinViewport:x.menuWithinViewport})),null,2));process.exitCode=1;}
}
