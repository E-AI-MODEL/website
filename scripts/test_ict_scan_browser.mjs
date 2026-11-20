import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const base='http://127.0.0.1:8797';
const manifest=JSON.parse(readFileSync('ict-scan/bronnen/manifest.json','utf8'));
const sources=new Map();
const listing=[];
for(const source of manifest.dataFiles){
 const path='ict-scan/bronnen/'+source.path;
 const content=readFileSync(path);
 const sha=source.sha;
 sources.set(sha,content);
 listing.push({type:'file',name:source.path,path,sha,size:content.length});
}
const manifestContent=readFileSync('ict-scan/bronnen/manifest.json');
const manifestSha='f'.repeat(40);
sources.set(manifestSha,manifestContent);
listing.push({type:'file',name:'manifest.json',path:'ict-scan/bronnen/manifest.json',sha:manifestSha,size:manifestContent.length});
const server=spawn('python3',['-m','http.server','8797','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const cors={
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET,OPTIONS',
 'access-control-allow-headers':'accept,x-github-api-version,authorization',
 'content-type':'application/json'
};
try {
 let ready=false;
 for(let n=0;n<60;n++){try{ready=(await fetch(base+'/tools/ict-scan/')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
 assert(ready,'De ICT-scan ontbreekt in de sitebuild');
 browser=await chromium.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
  const errors=[],network=[];
  page.on('request',r=>{if(r.url().includes('api.github.com'))network.push(r.method()+' '+r.url().slice(-100));});
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes("frame-ancestors' is ignored"))errors.push('console: '+m.text());});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('https://api.github.com/**',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
   let data;
   if(url.pathname.endsWith('/contents/ict-scan/bronnen'))data=listing;
   else if(url.pathname.includes('/git/blobs/')){
    const sha=url.pathname.split('/').pop();
    assert(sources.has(sha),'Onverwachte GitHub SHA: '+sha);
    data={encoding:'base64',content:sources.get(sha).toString('base64')};
   }else throw Error('Onverwachte GitHub-route '+url.pathname);
   await route.fulfill({status:200,headers:cors,body:JSON.stringify(data)});
  });
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(base))return route.continue();
   if(url.startsWith('https://api.github.com/'))return route.fallback();
   return route.abort();
  });
  await page.goto(base+'/tools/ict-scan/',{waitUntil:'load'});
  assert.equal(await page.title(),'404 Not Found');
  await page.locator('#unlockZero').dblclick({force:true});
  await page.locator('#workspace:not([hidden])').waitFor();
  try{await page.waitForFunction(()=>/geslaagd|niet gelukt/i.test(document.getElementById('githubSyncStatus')?.textContent||''),null,{timeout:15000});}
  catch(error){const state=await page.evaluate(()=>({status:document.getElementById('githubSyncStatus')?.textContent,view:document.getElementById('workspace')?.hidden,ready:typeof window.state==='object'?window.state.ready:null,button:document.getElementById('githubSyncStart')?.disabled}));throw Error('Synchronisatie voltooit niet: '+JSON.stringify({state,network,errors,reason:error.message}));}
  const message=await page.locator('#githubSyncStatus').textContent();
  assert.match(message,/geslaagd/i,'GitHub-sync mislukt: '+message);
  await page.waitForFunction(()=>document.getElementById('statusText')?.textContent.includes('61 toepassingen'));
  assert.equal(await page.locator('#kpiGrid .kpi').count(),4,'Vier statuscijfers ontbreken');
  assert.equal(await page.locator('#viewOverview .scene-tab').count(),3,'De lange overzichtspagina is niet verdeeld');
  const size=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,height:innerHeight,main:document.querySelector('.main-content').getBoundingClientRect().height,cardWidth:document.querySelector('.panel')?.getBoundingClientRect().width}));
  assert(size.scrollWidth<=size.clientWidth+1,'Horizontale overflow bij '+width+': '+JSON.stringify(size));
  assert(size.main<size.height,'Hoofdvenster groeit buiten de viewport bij '+width);
  await page.locator('#viewOverview .scene-tab').nth(1).click();
  assert.equal(await page.locator('#viewOverview .scene-panel:not([hidden])').count(),1);
  assert.equal(await page.locator('#relationshipExplorer .relation-spoke').count(),5,'Bronrelaties ontbreken');
  await page.screenshot({path:'test-results/ict-scan-'+width+'-relationships.png'});
  await page.locator('[data-view="devices"]').click();
  assert.equal(await page.locator('#viewDevices .scene-tab').count(),2,'Hardware heeft geen duidelijke schermindeling');
  assert.match(await page.locator('#deviceStats').textContent(),/161/);
  assert.match(await page.locator('#deviceCoverage').textContent(),/92 \/ 161/,'De bekende compliancewaarden ontbreken');
  assert.equal(await page.locator('#deviceRecords .device-record').count(),4);
  await page.screenshot({path:'test-results/ict-scan-'+width+'-hardware.png'});
  await page.locator('[data-view="privacy"]').click();
  assert.equal(await page.locator('#viewPrivacy .scene-tab').count(),3);
  assert.equal(await page.locator('#privacyDpia .dpia-evidence').count(),10,'DPIA-onderwerpen niet volledig');
  await page.screenshot({path:'test-results/ict-scan-'+width+'-privacy.png'});
  await page.locator('#viewPrivacy .scene-tab').nth(1).click();
  assert((await page.locator('#privacyControls .evidence-group').count())>=4,'Beheerpunten zijn niet gegroepeerd');
  await page.locator('[data-view="apps"]').click();
  assert.equal(await page.locator('#candidatePanel').isVisible(),false,'Kandidaten zijn niet gescheiden van basisregistraties');
  await page.locator('.app-register-tab').nth(1).click();
  assert.equal(await page.locator('#candidatePanel').isVisible(),true);
  assert(!/76\s+aanwijzingen/.test(await page.locator('#candidateInfo').textContent()),'Dezelfde 76 wordt dubbel getoond');
  await page.locator('[data-view="reports"]').click();
  assert.equal(await page.locator('#reportPicker [data-report]').count(),7);
  await page.locator('[data-report="devices"]').click();
  assert.match(await page.locator('#reportPreviewTitle').textContent(),/Apparaten/);
  await page.locator('[data-view="ai"]').click();
  await page.locator('#aiModeSchool').click();
  assert.equal(await page.locator('#aiSchoolPanels').isVisible(),true);
  assert.equal(await page.locator('#dpiaList').isVisible(),false,'DPIA wordt dubbel getoond binnen AI');

  for(const name of ['overview','apps','connections','devices','ai','privacy','findings','reports','sources']){
    await page.locator('[data-view="'+name+'"]').click();
    const result=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,heading:document.getElementById('sectionTitle')?.textContent}));
    assert(result.width<=result.viewport+1,'Horizontale overloop bij '+width+' in '+name+': '+JSON.stringify(result));
  }
  await page.locator('#railMore').click();
  const pop=await page.locator('#railDrawer').boundingBox();
  assert(pop&&pop.x>=0&&pop.x+pop.width<=width+1,'Functiemenu buiten viewport: '+JSON.stringify(pop));
  const field=await page.evaluate(()=>{const e=document.getElementById('githubRepo');const c=getComputedStyle(e);return {background:c.backgroundColor,color:c.color}});
  assert(!field.color.includes('255, 255, 255'),'Invoerveld heeft onleesbare witte letters: '+JSON.stringify(field));
  await page.screenshot({path:'test-results/ict-scan-'+width+'-menu.png'});
  await page.locator('#railDrawerClose').click();
  await page.locator('[data-view="sources"]').click();
  await page.locator('#githubSyncStart').click();
  await page.waitForFunction(()=>/geslaagd|niet gelukt/i.test(document.getElementById('githubSyncStatus')?.textContent||''),{timeout:45000});
  assert.match(await page.locator('#githubSyncStatus').textContent(),/geslaagd/i);
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join(' / '));
  await page.close();
 }
 console.log('ICT-scan: 61 toepassingen geladen, vaste schermen, menu en desktop/mobiele sync gecontroleerd');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
