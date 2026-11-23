import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const browserType=process.argv[3]==='webkit'?webkit:chromium;
const base='http://127.0.0.1:8797';
const manifest=JSON.parse(readFileSync('tools/ict-scan/bronnen/manifest.json','utf8'));
const sources=new Map();
const listing=[];
for(const source of manifest.dataFiles){
 const path='tools/ict-scan/bronnen/'+source.path;
 const content=readFileSync(path);
 const sha=source.sha;
 sources.set(sha,content);
 listing.push({type:'file',name:source.path,path,sha,size:content.length});
}
const manifestContent=readFileSync('tools/ict-scan/bronnen/manifest.json');
const manifestSha='f'.repeat(40);
sources.set(manifestSha,manifestContent);
listing.push({type:'file',name:'manifest.json',path:'tools/ict-scan/bronnen/manifest.json',sha:manifestSha,size:manifestContent.length});
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
 browser=await browserType.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
  const errors=[],network=[];
  let initialSyncDelayed=false;
  const secondaryMobile=new Set(['connections','devices','privacy','findings','reports']);
  const navigate=async view=>{
    if(width<700&&secondaryMobile.has(view)){
      await page.locator('#railMore').click();
      await page.locator('[data-drawer-view="'+view+'"]').click();
    }else{
      await page.locator('.rail-button[data-view="'+view+'"]').click();
    }
  };
  page.on('request',r=>{if(r.url().includes('api.github.com'))network.push(r.method()+' '+r.url().slice(-100));});
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes("frame-ancestors' is ignored"))errors.push('console: '+m.text());});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('https://api.github.com/**',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
   let data;
   if(url.pathname.endsWith('/contents/tools/ict-scan/bronnen')&&width<700&&!initialSyncDelayed){
     initialSyncDelayed=true;
     await new Promise(done=>setTimeout(done,1100));
   }
   if(url.pathname.endsWith('/contents/tools/ict-scan/bronnen'))data=listing;
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
  if(width<700){
    await page.locator('#emptyState:not([hidden])').waitFor();
    const geometry=await page.evaluate(()=>{
      const icon=document.querySelector('#emptyState .empty-illustration').getBoundingClientRect();
      const title=document.querySelector('#emptyState h2').getBoundingClientRect();
      return {iconBottom:icon.bottom,titleTop:title.top};
    });
    assert(geometry.iconBottom+8<=geometry.titleTop,'Laadillustratie overlapt de titel: '+JSON.stringify(geometry));
  }
  try{await page.waitForFunction(()=>/geslaagd|niet gelukt/i.test(document.getElementById('githubSyncStatus')?.textContent||''),null,{timeout:15000});}
  catch(error){const state=await page.evaluate(()=>({status:document.getElementById('githubSyncStatus')?.textContent,view:document.getElementById('workspace')?.hidden,ready:typeof window.state==='object'?window.state.ready:null,button:document.getElementById('githubSyncStart')?.disabled}));throw Error('Synchronisatie voltooit niet: '+JSON.stringify({state,network,errors,reason:error.message}));}
  const message=await page.locator('#githubSyncStatus').textContent();
  assert.match(message,/geslaagd/i,'GitHub-sync mislukt: '+message);
  await page.waitForFunction(()=>document.getElementById('statusText')?.textContent.includes('61 toepassingen'));
  await page.locator('#viewStudio:not([hidden])').waitFor();
  assert.equal(await page.locator('#sectionTitle').textContent(),'Applicatielandschap');
  assert.equal(await page.locator('#evidencePath').textContent(),'Overzicht samenstellen');
  if(width<700){
    const dock=await page.locator('.sidebar.icon-rail').boundingBox();
    assert(dock&&dock.x>=-1&&dock.width>=width-2&&dock.x+dock.width<=width+1,'Mobiele navigatie is geen volledige balk: '+JSON.stringify(dock));
    for(const view of ['studio','overview','apps','ai','sources']){
      assert(await page.locator('.rail-button[data-view="'+view+'"]').isVisible(),'Primair onderdeel niet bereikbaar: '+view);
    }
    assert.equal(await page.locator('.rail-button[data-view="connections"]').isVisible(),false,'Secundaire onderdelen horen onder Meer');
    await navigate('connections');
    assert.equal(await page.locator('#sectionTitle').textContent(),'Entra-registraties en toegang');
    await navigate('studio');
    assert.equal(await page.locator('#sectionTitle').textContent(),'Applicatielandschap');
  }
  assert.equal(await page.locator('#viewStudio .ds-panel-head h2').textContent(),'Dashboard instellen');
  assert.equal(await page.locator('.rail-button[data-view="studio"] .rail-label').textContent(),'Dashboard');
  assert.equal(await page.locator('#dsDataOptions .ds-option').count(),8,'Gegevenskeuze moet alle acht beschikbare bronsoorten bevatten');
  assert.equal(await page.locator('#dsDataOptions .ds-option-description').count(),8,'Een gegevensgroep moet direct vertellen waarvoor die dient');
  assert.equal(await page.locator('#dsPartOptions .ds-option-description').count(),9,'Elk dashboardonderdeel moet zijn werking uitleggen');
  assert.equal(await page.locator('#dsPartOptions .ds-part').count(),9,'Er ontbreken vrij kiesbare dashboardonderdelen');
  assert.equal(await page.locator('#dsCanvas .ds-component').count(),5,'Het startdashboard moet direct bruikbaar zijn');
  const assertNoComponentOverlap=async where=>{
    const result=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('#dsCanvas .ds-component')];
      return nodes.map(el=>{
        const rect=el.getBoundingClientRect(),body=el.querySelector('.ds-component-body');
        const children=body?[...body.children].filter(x=>getComputedStyle(x).display!=='none').map(x=>({name:x.className?.baseVal||x.className||x.tagName,bottom:x.getBoundingClientRect().bottom})):[];
        return {name:el.dataset.component,top:rect.top,bottom:rect.bottom,height:rect.height,children};
      });
    });
    for(let i=0;i<result.length;i++){
      const part=result[i];
      if(i)assert(part.top>=result[i-1].bottom-1,'Overlappende dashboardonderdelen '+where+': '+JSON.stringify([result[i-1],part]));
      for(const child of part.children)assert(child.bottom<=part.bottom+2,'Dashboardinhoud loopt buiten '+part.name+' ('+where+'): '+JSON.stringify({part,child}));
    }
  };
  if(width<700)await assertNoComponentOverlap('start');
  assert.match(await page.locator('#dsCanvas .ds-numbers').textContent(),/61/);
  assert.match(await page.locator('#dsCanvas .ds-numbers').textContent(),/93/);
  await page.waitForFunction(()=>{
    const view=document.getElementById('viewStudio'),parts=[...document.querySelectorAll('#dsCanvas .ds-component')];
    return view&&!view.hidden&&Number(getComputedStyle(view).opacity)>.98
      &&parts.every(p=>Number(getComputedStyle(p).opacity)>.98);
  });
  await page.screenshot({path:'test-results/ict-scan-'+width+'-composer-default.png'});
  const distributionMode=page.locator('#dsCanvas [data-component="distribution"] select.ds-chart-mode');
  assert.deepEqual(await distributionMode.locator('option').allTextContents(),['Lijnen','Staaf','Ring','Tegels','Tabel']);
  for(const [mode,selector] of [['bars','.viz-bar'],['donut','.viz-donut-ring'],['treemap','.viz-treemap'],['table','.viz-data-table'],['lines',width<700?'.ds-mobile-line-row':'.ds-figure-row']]){
    await distributionMode.selectOption(mode);
    assert(await page.locator('#dsCanvas [data-component="distribution"] '+selector).count()>0,'Visualisatie '+mode+' ontbreekt');
    if(width<700)await assertNoComponentOverlap('verdelen '+mode);
  }
  if(width<700){await page.locator('#dsToggleControls').click();assert.equal(await page.locator('#viewStudio.ds-controls-open').count(),1);}
  await page.locator('#dsBlank').click();
  assert.equal(await page.locator('#dsCanvas .ds-component').count(),0,'Leeg beginnen moet echt een leeg werkvlak tonen');
  await page.locator('#dsPartOptions button').first().click();
  assert.equal(await page.locator('#dsCanvas .ds-numbers').count(),1,'Een klik moet het gekozen onderdeel meteen plaatsen');
  await page.locator('#dsSuggest').click();
  assert((await page.locator('#dsCanvas .ds-component').count())>=4,'Automatische samenstelling moet meerdere bruikbare onderdelen kiezen');
  if(width<700)await page.locator('#dsCloseControls').click();
  await page.locator('#dsLayout').selectOption('editorial');
  assert.equal(await page.locator('#dsCanvas').getAttribute('data-layout'),'editorial');
  await page.locator('#dsPrimary').selectOption('ai');
  assert.match(await page.locator('#dsCanvas .ds-distribution .ds-inline-label').textContent(),/AI-functies/);
  await page.locator('#dsPrimary').selectOption('apps');
  const chart=page.locator('#dsCanvas .ds-distribution');
  const activeLine=width<700?chart.locator('.ds-mobile-line-row:not(:disabled)'):chart.locator('svg .ds-figure-row[role="button"]');
  assert((await activeLine.count())>0,'De lijnvisual moet bedienbaar zijn');
  await activeLine.first().click();
  assert.match(await page.locator('#dsCanvas .ds-distribution .ds-inline-link').textContent(),/wissen/);
  await page.locator('#dsCanvas .ds-distribution .ds-inline-link').click();
  if(width<700)await page.locator('#dsToggleControls').click();
  await page.locator('[data-ds-preset="technology"]').click();
  assert.equal(await page.locator('#dsCanvas .ds-hardware').count(),1,'Hardware moet als afzonderlijk onderdeel te kiezen zijn');
  assert.match(await page.locator('#dsCanvas .ds-hardware').textContent(),/161/);
  if(width<700)await page.locator('#dsCloseControls').click();
  const matrixMode=page.locator('#dsCanvas [data-component="matrix"] select.ds-chart-mode');
  assert.deepEqual(await matrixMode.locator('option').allTextContents(),['Matrix','Tabel']);
  await matrixMode.selectOption('table');
  assert((await page.locator('#dsCanvas [data-component="matrix"] .ds-matrix-list tbody tr').count())>0,'Matrix tabelweergave is leeg');
  if(width<700)await assertNoComponentOverlap('matrix als tabel');
  await matrixMode.selectOption('matrix');
  assert((await page.locator('#dsCanvas [data-component="matrix"] .ds-matrix:not(.ds-matrix-list)').count())===1);
  if(width<700)await assertNoComponentOverlap('matrix');
  await page.locator('#dsSave').click();
  const savedVisuals=await page.evaluate(()=>JSON.parse(localStorage.getItem('emmaus-ict-dashboard-studio-v1')||'{}').visuals);
  assert.deepEqual(savedVisuals,{distribution:'lines',matrix:'matrix'},'Visualisatiekeuzes ontbreken bij bewaren');
  assert.match(await page.evaluate(()=>localStorage.getItem('emmaus-ict-dashboard-studio-v1')),/"layout":"editorial"/);
  if(width<700&&await page.locator('#viewStudio.ds-controls-open').count())await page.locator('#dsCloseControls').click();
  await page.waitForFunction(()=>{
    const parts=[...document.querySelectorAll('#dsCanvas .ds-component')];
    return parts.length>0&&parts.every(p=>Number(getComputedStyle(p).opacity)>.98);
  });
  await page.screenshot({path:'test-results/ict-scan-'+width+'-composer-technology.png'});
  await navigate('overview');

  assert.equal(await page.locator('#kpiGrid .kpi').count(),4,'Vier statuscijfers ontbreken');
  assert.equal(await page.locator('#viewOverview .scene-tab').count(),4,'Schoolbreed, relaties, broncontrole en toepassingen moeten afzonderlijk toegankelijk zijn');
  const size=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,height:innerHeight,main:document.querySelector('.main-content').getBoundingClientRect().height,cardWidth:document.querySelector('.panel')?.getBoundingClientRect().width}));
  assert(size.scrollWidth<=size.clientWidth+1,'Horizontale overflow bij '+width+': '+JSON.stringify(size));
  assert(size.main<size.height,'Hoofdvenster groeit buiten de viewport bij '+width);
  await page.locator('#viewOverview .scene-tab').nth(1).click();
  assert.equal(await page.locator('#viewOverview .scene-panel:not([hidden])').count(),1);
  assert.equal(await page.locator('#relationshipExplorer .relation-spoke').count(),4,'FG-informatie mag niet standaard zichtbaar zijn');
  assert.equal(await page.locator('.rail-button[data-view="privacy"]').isVisible(),false,'FG-modus moet standaard uit staan');
  await page.screenshot({path:'test-results/ict-scan-'+width+'-relationships.png'});
  await navigate('devices');
  assert.equal(await page.locator('#viewDevices .scene-tab').count(),2,'Hardware heeft geen duidelijke schermindeling');
  assert.match(await page.locator('#deviceStats').textContent(),/161/);
  assert.match(await page.locator('#deviceCoverage').textContent(),/92 \/ 161/,'De bekende compliancewaarden ontbreken');
  assert.equal(await page.locator('#deviceRecords .device-record').count(),4);
  await page.screenshot({path:'test-results/ict-scan-'+width+'-hardware.png'});
  // FG is an optional view, not an access role and never a DPIA approval workflow.
  await page.locator('#railMore').click();
  assert.equal(await page.locator('#roleModeFG').isChecked(),false,'FG moet standaard uit staan');
  await page.locator('#roleModeFG').check();
  assert.equal(await page.locator('#roleModeFG').isChecked(),true);
  await page.locator('#railDrawerClose').click();
  assert.equal(await page.locator('#relationshipExplorer .relation-spoke').count(),4,'FG-modus mag geen DPIA-koppelingen verzinnen op basis van naamgelijkenis');
  await navigate('privacy');
  assert.equal(await page.locator('#viewPrivacy .scene-tab').count(),2);
  assert.equal(await page.locator('#viewPrivacy .privacy-governance-panel').count(),0,'AI-beheer mag niet onder FG staan');
  assert.equal(await page.locator('#privacyDpia .dpia-evidence').count(),10,'DPIA-bronvermeldingen niet volledig');
  assert.match(await page.locator('.fg-role-boundary').textContent(),/geen DPIA|Geen DPIA/i);
  assert.match(await page.locator('#privacySummary').textContent(),/Niet aangeleverd/);
  await page.screenshot({path:'test-results/ict-scan-'+width+'-privacy.png'});
  await navigate('apps');
  assert.equal(await page.locator('#candidatePanel').isVisible(),false,'Kandidaten zijn niet gescheiden van basisregistraties');
  // One compact inspector, not nested Excel/JSON/read-card duplicates.
  await page.locator('#appsList .item-card-direct .item-summary').first().click();
  await page.locator('#cardEditor').waitFor({state:'visible'});
  assert.equal(await page.locator('#cardEditor').evaluate(el=>el.classList.contains('card-context-mode')),true);
  assert.equal(await page.locator('#cardBrowserList').isVisible(),false,'Extra registerlijst mag een gekozen kaart niet verdringen');
  assert.equal(await page.locator('#cardReadView .card-read-tab').count(),3,'Overzicht, gegevens en relaties zonder openbare herkomsttab');
  assert.equal(await page.locator('#cardReadView .card-tab-panel:not([hidden])').count(),1);
  assert.equal(await page.locator('#cardJsonPanel').isVisible(),false,'JSON is technische broninformatie, geen tweede kaart');
  await page.waitForFunction(()=>{const r=document.getElementById('cardEditor')?.getBoundingClientRect();return !!r&&r.left>=-1&&r.right<=innerWidth+1;},null,{timeout:4500});
  const panelBounds=await page.locator('#cardEditor').boundingBox();
  assert(panelBounds&&panelBounds.x>=0&&panelBounds.x+panelBounds.width<=width+1,'Detailpaneel loopt buiten scherm');
  if(width>700)assert(panelBounds.width<700,'Detailpaneel moet compact zijn');
  await page.screenshot({path:'test-results/ict-scan-'+width+'-single-record.png'});
  await page.locator('#cardReadView .card-read-tab[data-target="details"]').click();
  assert.equal(await page.locator('#cardReadView [data-card-tab="details"]').isVisible(),true);
  assert.equal(await page.locator('#cardReadView .card-read-tab[data-target="source"]').count(),0);
  await page.locator('#cardReadView .card-read-tab[data-target="overview"]').click();
  assert.equal(await page.locator('#cardJsonPanel').isVisible(),false);
  await page.locator('#cardEditButton').click();
  await page.locator('#cardGatePassword').fill('Emmauscollege');
  await page.locator('.card-edit-gate [data-unlock]').click();
  assert.equal(await page.locator('#cardForm').isVisible(),true,'Bewerken hoort in dezelfde kaart');
  await page.locator('#cardCancelEdit').click();
  await page.locator('#cardEditorClose').click();
  assert.equal(await page.locator('#cardEditor').isVisible(),false);
  await page.locator('.app-register-tab').nth(1).click();
  assert.equal(await page.locator('#candidatePanel').isVisible(),true);
  assert(!/76\s+aanwijzingen/.test(await page.locator('#candidateInfo').textContent()),'Dezelfde 76 wordt dubbel getoond');
  await navigate('reports');
  assert.equal(await page.locator('#reportPicker [data-report]').count(),7);
  await page.locator('[data-report="devices"]').click();
  assert.match(await page.locator('#reportPreviewTitle').textContent(),/Apparaten/);
  await navigate('ai');
  await page.locator('#aiModeSchool').click();
  await page.locator('#viewAiScene1').waitFor({state:'visible'});
  assert((await page.locator('#aiList .item-card-direct').count())>0,'AI in de school mag geen lege introductie tonen');
  assert.equal(await page.locator('#dpiaList').isVisible(),false,'DPIA wordt dubbel getoond binnen AI');
  await page.locator('#viewAi .scene-tab').nth(2).click();
  assert.equal(await page.locator('#viewAi .scene-tab').count(),3,'AI-beheer moet onder AI staan');
  assert((await page.locator('#privacyControls .evidence-group').count())>=4,'Beheerpunten zijn niet gegroepeerd');
  await page.locator('#viewAiScene2').waitFor({state:'visible'});
  await page.locator('#railMore').click();
  await page.locator('#roleModeAI').uncheck();
  assert.equal(await page.locator('.rail-button[data-view="ai"]').isVisible(),false);
  assert.equal(await page.locator('#kpiGrid .kpi').count(),3);
  await page.locator('#roleModeAI').check();
  assert.equal(await page.locator('.rail-button[data-view="ai"]').isVisible(),true);
  await page.locator('#roleModeFG').uncheck();
  assert.equal(await page.locator('.rail-button[data-view="privacy"]').isVisible(),false);
  assert.equal(await page.locator('#reportPicker [data-report="privacy"]').isVisible(),false);
  await page.locator('#roleModeFG').check();
  await page.locator('#railDrawerClose').click();
  assert.match(await page.evaluate(()=>localStorage.getItem('emmaus-ict-scan-visible-roles-v1')),/"fg":true/);

  for(const name of ['studio','overview','apps','connections','devices','ai','privacy','findings','reports','sources']){
    await navigate(name);
    const result=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,heading:document.getElementById('sectionTitle')?.textContent}));
    assert(result.width<=result.viewport+1,'Horizontale overloop bij '+width+' in '+name+': '+JSON.stringify(result));
  }
  await page.locator('#railMore').click();
  const pop=await page.locator('#railDrawer').boundingBox();
  assert(pop&&pop.x>=0&&pop.x+pop.width<=width+1,'Functiemenu buiten viewport: '+JSON.stringify(pop));
  const field=await page.evaluate(()=>{const e=document.getElementById('githubRepo');const c=getComputedStyle(e);return {background:c.backgroundColor,color:c.color}});
  assert(!field.color.includes('255, 255, 255'),'Invoerveld heeft onleesbare witte letters: '+JSON.stringify(field));
  await page.waitForFunction(()=>{
    const menu=document.getElementById('railDrawer');
    return menu&&!menu.hidden&&Number(getComputedStyle(menu).opacity)>.98;
  });
  await page.screenshot({path:'test-results/ict-scan-'+width+'-menu.png'});
  await page.locator('#railDrawerClose').click();
  await navigate('sources');
  await page.locator('#githubSyncStart').click();
  await page.waitForFunction(()=>/geslaagd|niet gelukt/i.test(document.getElementById('githubSyncStatus')?.textContent||''),{timeout:45000});
  assert.match(await page.locator('#githubSyncStatus').textContent(),/geslaagd/i);
  if(width===390){
    await page.setViewportSize({width:320,height:740});
    await navigate('studio');
    if(width<700)await assertNoComponentOverlap('320px');
    const scrollEnd=await page.evaluate(()=>{
      const scroll=document.getElementById('dsCanvasScroll');
      scroll.style.scrollBehavior='auto'; // Deterministic measurement; scrolling is normally smooth.
      scroll.scrollTop=scroll.scrollHeight;
      const content=scroll.getBoundingClientRect(),items=[...document.querySelectorAll('#dsCanvas .ds-component')];
      return {last:items.at(-1)?.getBoundingClientRect().bottom,containerBottom:content.bottom,
        scrollTop:scroll.scrollTop,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight};
    });
    assert(scrollEnd.scrollTop>0,'Dashboardvlak scrolt niet: '+JSON.stringify(scrollEnd));
    assert(scrollEnd.last<=scrollEnd.containerBottom+3,'Laatste onderdeel valt buiten scrollruimte: '+JSON.stringify(scrollEnd));
    const dock=await page.locator('.sidebar.icon-rail').boundingBox();
    assert(dock&&dock.width>=319,'Dock is op een smalle telefoon afgesneden: '+JSON.stringify(dock));
    await page.locator('#railMore').click();
    const menu=await page.locator('#railDrawer').boundingBox();
    assert(menu&&menu.x>=0&&menu.x+menu.width<=321,'Menu valt buiten 320px viewport: '+JSON.stringify(menu));
    await page.locator('[data-drawer-view="findings"]').click();
    assert.equal(await page.locator('#sectionTitle').textContent(),'Wat moet nog worden gecontroleerd?');
  }
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join(' / '));
  await page.close();
 }
 console.log('ICT-scan '+browserType.name()+': 61 toepassingen geladen, vaste schermen, menu, grafieken en desktop/mobiele sync gecontroleerd');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
