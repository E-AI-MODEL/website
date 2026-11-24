import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const profileHash=createHash('sha256').update(readFileSync('tools/ict-scan/assurance/profile.js')).digest('hex').slice(0,16);
const browserType=process.argv[3]==='webkit'?webkit:chromium;
const fixedOnly=process.argv.includes('--fixed-only');
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
const manifestSha=createHash('sha1').update('blob '+manifestContent.length+'\0').update(manifestContent).digest('hex');
sources.set(manifestSha,manifestContent);
listing.push({type:'file',name:'manifest.json',path:'tools/ict-scan/bronnen/manifest.json',sha:manifestSha,size:manifestContent.length});
const {default:inventory}=await import('../tools/ict-scan/inventory-index.js');
const {default:taxonomy}=await import('../tools/ict-scan/record-taxonomy.js');
const fixture=manifest.dataFiles.map(f=>JSON.parse(readFileSync('tools/ict-scan/bronnen/'+f.path,'utf8')));
const fixtureState=Object.fromEntries(Object.entries(inventory.STORES).map(([type,store])=>[store,fixture.flatMap(f=>f[type]||[])]));
const expectedIndex=inventory.build(fixtureState);
const edgeCount=expectedIndex.edges.length,nodeCount=expectedIndex.nodes.size;
const countStatus=status=>expectedIndex.edges.filter(e=>e.status===status).length;
const server=spawn('python3',['-m','http.server','8797','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const cors={
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET,POST,PUT,OPTIONS',
 'access-control-allow-headers':'accept,x-github-api-version,authorization,content-type',
 'content-type':'application/json'
};
try {
 let ready=false;
 for(let n=0;n<60;n++){try{ready=(await fetch(base+'/tools/ict-scan/')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
 assert(ready,'De ICT-scan ontbreekt in de sitebuild');
 browser=await browserType.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 const fixedScreenFailures=[];
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
  const errors=[],network=[],designWrites=[];
  let initialSyncDelayed=false;
  const secondaryViews=new Set(['studio','connections','devices','privacy','reports','sources']);
  const navigate=async view=>{
    if(secondaryViews.has(view)){
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
   const method=route.request().method();
   if(url.pathname.endsWith('/git/ref/heads/main'))data={object:{sha:'d'.repeat(40)}};
   else if(url.pathname.endsWith('/contents/tools/ict-scan/dashboard-layouts/layouts.json')&&method==='GET'){
     assert.equal(url.searchParams.get('ref'),'d'.repeat(40));
     const bytes=readFileSync('tools/ict-scan/dashboard-layouts/layouts.json');
     const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
     data={type:'file',encoding:'base64',content:bytes.toString('base64'),size:bytes.length,sha};
   }else if(method!=='GET'){
     const payload=route.request().postDataJSON();
     assert.equal(route.request().headers().authorization,'Bearer browser-test-design-token');
     if(url.pathname.endsWith('/git/refs')&&method==='POST'){
       assert.match(payload.ref,/^refs\/heads\/applicatielandschap\/ontwerp-/);assert.equal(payload.sha,'d'.repeat(40));data={ref:payload.ref};
     }else if(url.pathname.endsWith('/contents/tools/ict-scan/dashboard-layouts/layouts.json')&&method==='PUT'){
       assert.match(payload.branch,/^applicatielandschap\/ontwerp-/);
       const file=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));
       assert.equal(file.schema,'eai-ict-dashboard-designs-v1');
       for(const item of Object.values(file.designs))assert.deepEqual(Object.keys(item).sort(),['components','content','format','layout','primary','title','variant','version','visuals']);
       assert(!JSON.stringify(file).includes('APP-034'));assert(!JSON.stringify(file).includes('browser-test-design-token'));
       data={content:{sha:'e'.repeat(40)}};
     }else if(url.pathname.endsWith('/pulls')&&method==='POST'){
       assert.equal(payload.base,'main');assert.match(payload.head,/^applicatielandschap\/ontwerp-/);data={number:9999,html_url:'https://github.com/E-AI-MODEL/website/pull/9999'};
     }else throw Error('Onverwachte schrijfroute '+url.pathname);
     designWrites.push({method,path:url.pathname});
   }
   if(data!==undefined){await route.fulfill({status:200,headers:cors,body:JSON.stringify(data)});return;}
   if(url.pathname.endsWith('/contents/tools/ict-scan/bronnen')&&width<700&&!initialSyncDelayed){
     initialSyncDelayed=true;
     await new Promise(done=>setTimeout(done,1100));
   }
   if(url.pathname.endsWith('/commits/main'))data={sha:'d'.repeat(40)};
   else if(url.pathname.endsWith('/contents/tools/ict-scan/bronnen')){assert.equal(url.searchParams.get('ref'),'d'.repeat(40));data=listing;}
   else if(url.pathname.includes('/git/blobs/')){
    const sha=url.pathname.split('/').pop();
    assert(sources.has(sha),'Onverwachte GitHub SHA: '+sha);
    data={encoding:'base64',content:sources.get(sha).toString('base64')};
   }else if(url.pathname.includes('/contents/tools/ict-scan/docs/')){
    assert.equal(url.searchParams.get('ref'),'d'.repeat(40));
    const path=url.pathname.split('/contents/')[1];
    const bytes=readFileSync(path);const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    data={type:'file',encoding:'base64',content:bytes.toString('base64'),size:bytes.length,sha};
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
  assert.equal(await page.locator('script[src^="./assurance/profile.js"]').getAttribute('src'),'./assurance/profile.js?v='+profileHash,'De browser moet de juiste, versienummergebonden validator laden');
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
  assert.equal(await page.locator('#globalSearch').isVisible(),true,'Zoekfunctie moet direct zichtbaar zijn');
  assert.equal(await page.locator('#githubLiveStatus').textContent(),'GitHub · gesynchroniseerd');
  assert.match(await page.locator('#githubLiveStatus').getAttribute('title'),new RegExp(String(nodeCount)));
  assert.equal(await page.locator('#githubLiveStatus').getAttribute('data-mode'),'success');
  assert.equal(await page.locator('#sections .rail-button:visible').count(),4);
  assert.match(message,/geslaagd/i,'GitHub-sync mislukt: '+message);
  await page.waitForFunction(()=>document.getElementById('statusText')?.textContent==='Brongegevens ingelezen');
  await page.locator('#viewOverview:not([hidden])').waitFor();
  // Test actual opening-view geometry, not just body overflow:hidden.
  const assertFixedStarts=async viewport=>{
    await page.setViewportSize(viewport);
    for(const name of ['overview','apps','connections','devices','ai','privacy','findings','reports','sources']){
      try{
      await navigate(name);
      await page.evaluate(n=>window.EmmausScenes.show(n,0,false),name);
      const id='view'+name[0].toUpperCase()+name.slice(1);
      await page.locator('#'+id+'Scene0:not([hidden])').waitFor({state:'visible'});
      await page.locator('#'+id).evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
      const geometry=await page.evaluate(id=>{
        const panel=document.getElementById(id+'Scene0'),frame=panel.parentElement;
        const r=panel.getBoundingClientRect(),f=frame.getBoundingClientRect();
        const blocks=[...panel.children].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const b=el.getBoundingClientRect();return {name:el.id||el.className,bottom:b.bottom,top:b.top};});
        return {frame:frame.clientHeight,frameScroll:frame.scrollHeight,frameOverflow:getComputedStyle(frame).overflowY,panel:panel.clientHeight,panelScroll:panel.scrollHeight,top:r.top,bottom:r.bottom,frameBottom:f.bottom,blocks};
      },id);
      await page.screenshot({path:'test-results/ict-scan-fixed-'+viewport.width+'-'+name+'.png',animations:'disabled'});
      assert(geometry.frame>70,'Geen bruikbare schermruimte bij '+name+' '+JSON.stringify(viewport));
      assert.equal(geometry.frameOverflow,'hidden','Startscherm scrolt als geheel: '+name);
      assert(geometry.panelScroll<=geometry.panel+3&&geometry.frameScroll<=geometry.frame+3,'Startscherm past niet: '+name+' '+JSON.stringify({viewport,geometry}));
      assert(geometry.blocks.every(b=>b.bottom<=geometry.bottom+3&&b.top>=geometry.top-3),'Een startblok is afgesneden: '+name+' '+JSON.stringify({viewport,geometry}));
      if(name==='overview'){
        const actions=await page.locator('#viewOverviewScene0 #overviewQuickActions button').evaluateAll(els=>els.map(e=>({bottom:e.getBoundingClientRect().bottom,height:e.getBoundingClientRect().height})));
        assert(actions.length===6&&actions.every(e=>e.bottom<=geometry.bottom+3&&e.height>=30),'Hoofdacties niet direct bereikbaar');
      }
      if(name==='apps'){
        const list=page.locator('#appsList');
        if(await list.isVisible()){
          await list.evaluate(el=>{el.scrollTop=el.scrollHeight;});
          const reach=await list.evaluate(el=>{const last=el.lastElementChild;return !last||last.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+4;});
          assert(reach,'Laatste applicatie niet bereikbaar in eigen lijst');
          await list.evaluate(el=>{el.scrollTop=0;});
        }
      }
      if(name==='ai')assert.equal(await page.locator('#aiProgress .ai-group-toggle').count(),3);
      const requiredRegions={apps:'#appsList',connections:'#connectionChart',devices:'#viewDevicesScene0>.two-col',ai:'#aiProgress>.ai-progress-grid',privacy:'#privacyDpia',findings:'#assuranceDetailArea',reports:'#reportPicker',sources:'#githubSyncDetailArea'};
      if(requiredRegions[name]){
        const region=page.locator(requiredRegions[name]);
        if(await region.isVisible()){
          const box=await region.boundingBox();
          assert(box&&box.height>=44&&box.y+box.height<=geometry.bottom+3,'Onbruikbaar of afgesneden detailvlak: '+name+' '+JSON.stringify({viewport,box,geometry}));
        }else assert(name==='apps'&&await page.locator('#candidatePanel').isVisible(),'Detailvlak ontbreekt: '+name);
      }
      if(name==='privacy'){
        const list=page.locator('#privacyDpia');
        const result=await list.evaluate(el=>{
          const last=el.lastElementChild;el.scrollTop=el.scrollHeight;
          const visible=!!last&&last.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+4;
          el.scrollTop=0;return {visible,count:el.querySelectorAll('.dpia-evidence').length};
        });
        assert(result.visible&&result.count===expectedIndex.count('dpia'),'DPIA-lijst niet volledig bereikbaar: '+JSON.stringify(result));
      }
      if(name==='sources'){
        for(const selector of ['#githubSyncStart','#sourcesImport']){
          const button=page.locator(selector),box=await button.boundingBox();
          assert(box&&box.height>=30&&box.y+box.height<=geometry.bottom+3,'Bronactie buiten scherm: '+selector);
          await button.click({trial:true});
        }
      }
      console.log('Vast scherm '+browserType.name()+' '+viewport.width+'x'+viewport.height+' '+name+' OK');
      }catch(error){
        const diagnostic=browserType.name()+' '+viewport.width+'x'+viewport.height+' '+name+': '+error.message;
        fixedScreenFailures.push(diagnostic);console.error(diagnostic);
      }
    }
    await navigate('studio');
    const studio=await page.locator('#viewStudio').boundingBox();
    if(!studio||studio.y+studio.height>viewport.height+3)fixedScreenFailures.push(browserType.name()+' '+viewport.width+'x'+viewport.height+' Dashboardbouwer valt buiten beeld');
  };

  if(fixedOnly){
    // A separate layout run must not be blocked by a later copy or feature test.
    await page.locator('#railMore').click();
    await page.locator('#roleModeFG').check();
    await page.locator('#railDrawerClose').click();
  await assertFixedStarts(width===1440?{width:1280,height:720}:{width:320,height:740});
  await assertFixedStarts({width,height:900});
    assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join(' / '));
    await page.close();
    continue;
  }
  assert.equal(await page.locator('#sectionTitle').textContent(),'ICT-overzicht');
  assert.match(await page.locator('#evidencePath').textContent(),/^Overzicht/);
  assert.equal(await page.locator('#overviewQuickActions button').count(),6,'De zes gebruikerstaken ontbreken');
  await page.locator('#overviewQuickActions button').filter({hasText:'Applicatie zoeken'}).click();
  assert.equal(await page.locator('#sectionTitle').textContent(),'Applicaties en diensten');
  assert.equal(await page.locator('#appsSearch').evaluate(el=>el===document.activeElement),true,'Zoeken opent direct het zoekveld');
  await navigate('overview');
  await page.locator('#overviewQuickActions button').filter({hasText:'Controles bekijken'}).click();
  await page.locator('#viewFindingsScene1:not([hidden])').waitFor();
  assert.equal(await page.locator('#sectionTitle').textContent(),'Controles');
  await navigate('overview');
  await page.locator('#overviewQuickActions button').filter({hasText:'Rapport maken'}).click();
  await page.locator('#reportPicker:visible').waitFor();
  assert.equal(await page.locator('#sectionTitle').textContent(),'Rapporten');
  if(width===1440){
    await page.evaluate(()=>{window.print=()=>{};});
    const reports=await page.evaluate(()=>Object.keys(window.IctPrintReports.titles));
    assert.equal(reports.length,9);
    for(const scope of reports){
      const model=await page.evaluate(scope=>indexedReport(scope),scope);
      assert(model.sections.length>1);
      assert(model.kpis.length>0);
      await page.evaluate(scope=>printIndexedReport(scope),scope);
      assert.equal(await page.locator('#printReport .report-cover h1').count(),1);
      assert.equal(await page.locator('#printReport .report-chapter').count(),model.sections.length);
      assert.equal(await page.locator('#printReport script').count(),0);
      // Do not export the actual school register as a public CI artifact.
      if(browserType===chromium&&['ict','privacy','aiGovernance'].includes(scope)){
        await page.evaluate(scope=>{
          const synthetic=IctInventoryIndex.build({
            apps:[{id:'TEST-APP',name:'Voorbeeldapplicatie',kind:'Applicatie',area:'Onderwijs',description:'Fictieve applicatie voor de PDF-proef.',local:'Onbekend',data:'Fictieve gegevens'}],
            ai:[{id:'TEST-AI',name:'Voorbeeldfunctie',product:'Voorbeeldapplicatie',domain:'Onderwijs',local:'Onbekend',action:'Fictieve functie'}],
            checks:[{id:'TEST-CHECK',name:'Voorbeeldcontrole',category:'Toegang',explanation:'Controleer de fictieve rolverdeling.',status:'Open'}],
            dpia:[{id:'TEST-DPIA',name:'Voorbeeldonderzoek',assessment:'Nog niet beoordeeld',evidence:'Niet vastgesteld'}],
            workActions:[{id:'TEST-WORK',name:'Voorbeeldactie',action:'Controleer de fictieve instellingen.',status:'Open'}]
          });
          const example=IctPrintReports.build(synthetic,{scope,taxonomy:IctScanTaxonomy,date:'24-11-2026',sourceLabel:'SYNTHETISCHE TESTGEGEVENS'});
          document.getElementById('printReport').innerHTML=IctPrintReports.render(example);
          return document.querySelector('#printReport .print-logo').decode().catch(()=>{});
        },scope);
        const pdf=await page.pdf({path:'test-results/ict-scan-report-'+scope+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
        assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
        assert(pdf.length>5000,'PDF is onverwacht klein');
      }
    }
    await page.evaluate(()=>{document.getElementById('printReport').replaceChildren();});
  }
  await navigate('overview');
  await page.locator('#overviewQuickActions button').filter({hasText:'Registratie bewerken'}).click();
  await page.locator('#cardEditor').waitFor({state:'visible'});
  assert.equal(await page.locator('#cardBrowserList [data-tree-register]').count(),Object.keys(inventory.STORES).length,'Mappen voor alle registers ontbreken');
  assert((await page.locator('#cardReadView .card-directory-folder').count())>0,'Register moet als mappen kunnen worden doorlopen');
  assert.equal(await page.locator('#cardPendingPanel').isVisible(),false,'Leeg wijzigingenpaneel hoort niet in de verkenner');
  await page.locator('#cardReadView .card-directory-folder').first().click();
  assert((await page.locator('#cardReadView .card-directory-file').count())>0,'Mapinhoud ontbreekt');
  await page.locator('#cardReadView .card-directory-file').first().click();
  assert.match(await page.locator('#cardRecordId').textContent(),/^APP-/);
  await page.locator('#cardSearch').fill('WRK-014');
  await page.locator('#cardBrowserList [data-record-id="WRK-014"]').click();
  assert.equal(await page.locator('#cardRecordId').textContent(),'WRK-014','Zoeken over alle registers mislukt');
  await page.locator('#cardSearch').clear();
  await page.locator('#cardBrowserList [data-tree-register="apps"]').click();
  if(width===1440)await page.screenshot({path:'test-results/ict-scan-register-explorer.png'});
  await page.locator('#cardEditorClose').click();
  // Exercise the real reader against the exact repository blobs, with no remote school data.
  await page.evaluate(()=>window.EmmausDocs.open('AIACT'));
  await page.locator('#docDialog').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('docReaderStatus').textContent.includes('Volledige bronmomentopname'));
  assert.match(await page.locator('#docReaderTitle').textContent(),/AI-verordening/);
  assert((await page.locator('#docArticleJump option').count())>100,'Artikelnavigatie ontbreekt');
  await page.locator('#docArticleSearch').fill('AI-geletterdheid');
  assert((await page.locator('.doc-law-section:visible').count())>0,'Zoeken in wetstekst levert geen resultaat');
  await page.locator('#docDialogClose').click();
  await page.evaluate(()=>window.EmmausDocs.open('IBP'));
  await page.waitForFunction(()=>document.getElementById('docReaderStatus').textContent.includes('geen herpublicatie'));
  assert.equal(await page.locator('#docLocalChoice').isVisible(),true);
  await page.locator('#docDialogClose').click();
  if(width<700){
    const dock=await page.locator('.sidebar.icon-rail').boundingBox();
    assert(dock&&dock.x>=-1&&dock.width>=width-2&&dock.x+dock.width<=width+1,'Mobiele navigatie is geen volledige balk: '+JSON.stringify(dock));
    for(const view of ['overview','apps','ai','findings']){
      assert(await page.locator('.rail-button[data-view="'+view+'"]').isVisible(),'Primair onderdeel niet bereikbaar: '+view);
    }
    assert.equal(await page.locator('.rail-button[data-view="connections"]').isVisible(),false,'Secundaire onderdelen horen onder Meer');
    await navigate('connections');
    assert.equal(await page.locator('#sectionTitle').textContent(),'Koppelingen vanuit Entra');
    await navigate('studio');
    assert.equal(await page.locator('#sectionTitle').textContent(),'Dashboard op maat');
  }
  await navigate('studio');
  await page.locator('#viewStudio:not([hidden])').waitFor();
  assert.equal(await page.locator('#viewStudio .ds-panel-head h2').textContent(),'Gegevens en grafieken');
  assert.equal(await page.locator('.rail-button[data-view="studio"] .rail-label').textContent(),'Op maat');
  assert.equal(await page.locator('#dsDataOptions .ds-option').count(),Object.keys(inventory.STORES).length,'Gegevenskeuze moet alle registers bevatten');
  assert.equal(await page.locator('#dsDataOptions .ds-option-description').count(),Object.keys(inventory.STORES).length,'Een gegevensgroep moet direct vertellen waarvoor die dient');
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
  assert.match(await page.locator('#dsCanvas .ds-numbers').textContent(),/69/);
  assert.match(await page.locator('#dsCanvas .ds-numbers').textContent(),/93/);
  const coverage=page.locator('#dsCanvas .ds-coverage');
  await coverage.locator('.ds-coverage-settings summary').click();
  const fields=coverage.locator('.ds-coverage-option input');
  const originalFields=await coverage.locator('.ds-coverage-row').count();
  await fields.first().uncheck();
  assert.equal(await coverage.locator('.ds-coverage-row').count(),originalFields-1);
  await fields.first().check();
  await coverage.locator('.ds-coverage-settings summary').click();
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
  assert.equal(await page.locator('#viewStudio .ds-panel').isVisible(),false,'De bewerkvelden horen standaard gesloten te zijn');
  await page.locator('#dsToggleControls').click();assert.equal(await page.locator('#viewStudio.ds-controls-open').count(),1);
  await page.locator('#dsBlank').click();
  assert.equal(await page.locator('#dsCanvas .ds-component').count(),0,'Leeg beginnen moet echt een leeg werkvlak tonen');
  await page.locator('#dsPartOptions button').first().click();
  assert.equal(await page.locator('#dsCanvas .ds-numbers').count(),1,'Een klik moet het gekozen onderdeel meteen plaatsen');
  await page.locator('#dsSuggest').click();
  assert((await page.locator('#dsCanvas .ds-component').count())>=4,'Automatische samenstelling moet meerdere bruikbare onderdelen kiezen');
  await page.locator('#dsLayout').selectOption('editorial');
  await page.locator('#dsCloseControls').click();
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
  await page.locator('#dsToggleControls').click();
  await page.locator('[data-ds-preset="technology"]').click();
  assert.equal(await page.locator('#dsCanvas .ds-hardware').count(),1,'Hardware moet als afzonderlijk onderdeel te kiezen zijn');
  assert.match(await page.locator('#dsCanvas .ds-hardware').textContent(),/161/);
  await page.locator('#dsCloseControls').click();
  const matrixMode=page.locator('#dsCanvas [data-component="matrix"] select.ds-chart-mode');
  assert.deepEqual(await matrixMode.locator('option').allTextContents(),['Matrix','Tabel']);
  await matrixMode.selectOption('table');
  assert((await page.locator('#dsCanvas [data-component="matrix"] .ds-matrix-list tbody tr').count())>0,'Matrix tabelweergave is leeg');
  if(width<700)await assertNoComponentOverlap('matrix als tabel');
  await matrixMode.selectOption('matrix');
  assert((await page.locator('#dsCanvas [data-component="matrix"] .ds-matrix:not(.ds-matrix-list)').count())===1);
  if(width<700)await assertNoComponentOverlap('matrix');
  await page.locator('#dsToggleControls').click();
  await page.locator('#dsSave').click();
  await page.locator('#dsCloseControls').click();
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
  // Primary counts and denominators must describe their own source population.
  const sourceRows=type=>expectedIndex.records(type).filter(r=>expectedIndex.get(type,r.id)?.derived===false);
  const appRecords=sourceRows('apps'),appIds=new Set(appRecords.map(r=>r.id));
  const candidates=sourceRows('additionalCandidates'),aiRecords=sourceRows('ai'),entra=sourceRows('connections');
  const aiParents=new Set(aiRecords.filter(r=>appIds.has(r.parentId)).map(r=>r.parentId));
  const direct=entra.filter(r=>appIds.has(r.matchedId)).length;
  const metric=key=>page.locator('#overviewCounts [data-count-metric="'+key+'"]');
  assert.equal(await page.locator('#kpiGrid .kpi-value').count(),0,'Het startscherm mag geen hoofdcijfers tonen');
  assert.equal(await page.locator('#overviewCountsPanel').isVisible(),false,'De tellingen horen bij cijfers en verdeling');
  await page.locator('#viewOverview .scene-tab').nth(2).click();
  await page.locator('#viewOverviewScene2:not([hidden])').waitFor({state:'visible'});
  const number=n=>n.toLocaleString('nl-NL');
  assert.equal(await metric('software').locator('.kpi-value').textContent(),number(appRecords.length+candidates.length));
  assert.match(await metric('software').locator('.kpi-desc').textContent(),new RegExp(number(appRecords.length)+' applicatieregistraties'));
  assert.match(await metric('software').locator('.kpi-desc').textContent(),new RegExp(number(candidates.length)+' overige vermeldingen'));
  assert.match(await metric('software').locator('.evidence-kpi-context').textContent(),/Overlap mogelijk/);
  assert.equal(await metric('ai').locator('.kpi-value').textContent(),number(aiRecords.length));
  assert.match(await metric('ai').locator('.kpi-desc').textContent(),new RegExp(number(aiParents.size)+' van '+number(appRecords.length)));
  assert.equal(await metric('entra').locator('.kpi-value').textContent(),number(entra.length));
  assert.match(await metric('entra').locator('.kpi-desc').textContent(),new RegExp(number(direct)+' mogelijke directe appmatches'));
  assert.equal(await metric('hardware').locator('.kpi-value').textContent(),number(sourceRows('hardwareGroups').length));
  const measure=sourceRows('devices').find(r=>/entra apparaatrecords/i.test(r.name));
  if(measure){
    const detail=await metric('hardware').locator('.kpi-desc').textContent();
    assert(detail.includes(measure.quantity+' Entra-apparaatrecords'));
    assert(detail.includes(measure.measurementDate));
  }
  assert.match(await metric('hardware').locator('.evidence-kpi-context').textContent(),/Schoolbreed aantal fysieke apparaten niet vastgesteld/);
  assert.match(await page.locator('#overviewRegisterCount').textContent(),new RegExp(number([...expectedIndex.nodes.values()].filter(n=>!n.derived).length)+' records'));
  // Overview is school-wide even if the distribution tab has an app filter.
  await page.evaluate(()=>{state.overviewArea=[...state.apps.values()][0].area;renderOverview();});
  assert.equal(await metric('software').locator('.kpi-value').textContent(),number(appRecords.length+candidates.length));
  await page.evaluate(()=>{state.overviewArea='';renderOverview();});
  if(width===1440)await page.screenshot({path:'test-results/ict-scan-overview-populations.png'});
  await page.locator('#viewOverview .scene-tab').first().click();
  await page.locator('#viewOverviewScene0:not([hidden])').waitFor({state:'visible'});
  if(width===1440){await page.locator('#viewOverviewScene0').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:'test-results/ict-scan-overview-categories.png'});}
  assert.equal(await page.locator('#viewOverview .scene-tab').count(),4,'Schoolbreed, relaties, broncontrole en toepassingen moeten afzonderlijk toegankelijk zijn');
  const size=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,height:innerHeight,main:document.querySelector('.main-content').getBoundingClientRect().height,cardWidth:document.querySelector('.panel')?.getBoundingClientRect().width}));
  assert(size.scrollWidth<=size.clientWidth+1,'Horizontale overflow bij '+width+': '+JSON.stringify(size));
  assert(size.main<size.height,'Hoofdvenster groeit buiten de viewport bij '+width);
  await page.locator('#viewOverview .scene-tab').nth(1).click();
  await page.locator('#viewOverviewScene1:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('#viewOverview .scene-tab.active').textContent(),'Koppelingen');
  assert.equal(await page.locator('#viewOverview .scene-panel:not([hidden])').count(),1);
  assert.equal(await page.locator('#relationshipExplorer .relation-spoke').count(),4,'FG-informatie mag niet standaard zichtbaar zijn');
  // Alle verbanden komen uit een enkele index, inclusief licenties en acties.
  await page.locator('#relationAtlasOpen').click();
  const atlas=page.locator('#relationAtlasDialog');
  await atlas.waitFor({state:'visible'});
  assert.match(await atlas.locator('#relationAtlasStats').textContent(),new RegExp(String(nodeCount)));
  assert.match(await atlas.locator('#relationAtlasStats').textContent(),new RegExp(String(edgeCount)));
  assert.equal(await atlas.locator('.ra-link-row').count(),edgeCount,'Niet alle bronverbanden staan in de lijst');
  assert((await atlas.locator('.ra-mobile-group').count())>=8,'De categorieën zijn niet volledig opgebouwd');
  if(width===1440){
    await atlas.locator('select[aria-label="Netwerkweergave"]').selectOption('network');
    const endpoints=new Set(expectedIndex.edges.flatMap(e=>[JSON.stringify([e.fromType,e.fromId]),JSON.stringify([e.toType,e.toId])]));
    assert.equal(await atlas.locator('.ra-network-node').count(),endpoints.size);
    assert.equal(await atlas.locator('.ra-network-edge').count(),edgeCount);
    const layout=await atlas.locator('.ra-network-node circle').evaluateAll(nodes=>nodes.map(c=>({x:+c.getAttribute('cx'),y:+c.getAttribute('cy'),r:+c.getAttribute('r')})));
    assert(layout.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x-p.r>=0&&p.x+p.r<=1000&&p.y-p.r>=0&&p.y+p.r<=600),'Knooppunten buiten diagram');
    const border=layout.filter(p=>p.x<=30||p.x>=970||p.y<=30||p.y>=570);
    assert(border.length<layout.length*.2,'Netwerk drukt te veel knooppunten tegen de randen');
    assert((await atlas.locator('.ra-network-node').evaluateAll(ns=>new Set(ns.map(n=>n.dataset.component)).size))>1,'Losse componenten zijn niet apart ingedeeld');
    await atlas.locator('.ra-network-node').first().focus();
    assert((await atlas.locator('.ra-network-edge.is-connected').count())>0,'Directe lijnen lichten niet op');
    await atlas.locator('select[aria-label="Netwerkweergave"]').focus();

    await page.screenshot({path:'test-results/ict-scan-1440-network.png'});
    await atlas.locator('select[aria-label="Netwerkweergave"]').selectOption('groups');
  }
  const assertAtlasLayout=async w=>{
    const mobile=w<=650;
    assert.equal(await atlas.locator('.ra-mobile-graph').isVisible(),mobile,'Onjuiste mobiele atlasweergave bij '+w);
    assert.equal(await atlas.locator('.ra-graph-scroll').isVisible(),!mobile,'Onjuiste netwerkweergave bij '+w);
    const geometry=await atlas.locator('.ra-shell').evaluate(shell=>({scrollWidth:shell.scrollWidth,clientWidth:shell.clientWidth,scrollHeight:shell.scrollHeight,clientHeight:shell.clientHeight}));
    assert(geometry.scrollWidth<=geometry.clientWidth+2,'Horizontale overloop in de atlas bij '+w+': '+JSON.stringify(geometry));
    if(!mobile){
      const chart=await atlas.locator('.ra-graph').boundingBox();
      const frame=await atlas.locator('.ra-graph-wrap').boundingBox();
      assert(chart&&frame&&chart.width>0&&chart.height>0,'Geen meetbaar netwerkdiagram');
      assert(chart.y>=frame.y-2&&chart.y+chart.height<=frame.y+frame.height+2&&chart.x>=frame.x-2&&chart.x+chart.width<=frame.x+frame.width+2,'Netwerkdiagram valt buiten kader bij '+w+': '+JSON.stringify({chart,frame}));
    }
    const reachable=await atlas.locator('.ra-shell').evaluate(shell=>{
      shell.scrollTop=shell.scrollHeight;
      const last=shell.querySelector('.ra-link-row:last-child');
      return {last:last.getBoundingClientRect().bottom,bottom:shell.getBoundingClientRect().bottom,scrollTop:shell.scrollTop};
    });
    assert(reachable.scrollTop>0&&reachable.last<=reachable.bottom+3,'Laatste verband niet bereikbaar bij '+w+': '+JSON.stringify(reachable));
    await atlas.locator('.ra-shell').evaluate(shell=>{shell.scrollTop=0;});
  };
  await assertAtlasLayout(width);
  if(width===1440){
    for(const w of [1024,680,320]){
      await page.setViewportSize({width:w,height:740});
      await assertAtlasLayout(w);
      await page.screenshot({path:'test-results/ict-scan-atlas-'+w+'.png'});
    }
    await page.setViewportSize({width,height:900});
  }
  await page.screenshot({path:'test-results/ict-scan-'+width+'-relatieatlas.png'});
  const readAtlasCsv=async()=>{
    const pending=page.waitForEvent('download');
    await atlas.getByRole('button',{name:'CSV downloaden',exact:true}).click();
    const download=await pending;
    assert.equal(download.suggestedFilename(),'ict-scan-verbanden.csv','De atlasexport heeft geen herkenbare bestandsnaam');
    const raw=readFileSync(await download.path(),'utf8');
    assert(raw.startsWith('\ufeff'),'Excel-compatibele BOM ontbreekt');
    // Quoted fields may contain delimiters, escaped quotes and line breaks.
    const field=/"((?:[^"]|"")*)"(;|\r\n|$)/gy;
    const records=[];let row=[];const body=raw.slice(1);
    while(field.lastIndex<body.length){
      const pos=field.lastIndex,match=field.exec(body);
      assert(match&&field.lastIndex>pos,'Ongeldige CSV op teken '+pos);
      row.push(match[1].replace(/""/g,'"'));
      if(match[2]!==';'){records.push(row);row=[];}
    }
    assert.equal(row.length,0,'Onvolledige CSV-regel');
    assert.deepEqual(records.shift(),['Van (ID)','Van (naam)','Van (onderdeel)','Naar (ID)','Naar (naam)','Naar (onderdeel)','Soort verband','Status','Bron','Toelichting']);
    assert(records.every(r=>r.length===10&&r.slice(0,8).every(Boolean)),'CSV bevat onvolledige verbanden');
    return records;
  };
  const safeValue=v=>/^[\s]*[=+\-@\t\r]/.test(v)?"'"+v:v;
  const expectedRows=edges=>edges.map(e=>JSON.stringify([e.fromId,e.toId,e.status,safeValue(e.evidence||''),safeValue(e.note||'')])).sort();
  const actualRows=rows=>rows.map(r=>JSON.stringify([r[0],r[3],r[7],r[8],r[9]])).sort();
  const records=await readAtlasCsv();
  assert.equal(records.length,edgeCount);
  assert.deepEqual(actualRows(records),expectedRows(expectedIndex.edges),'CSV wijkt af van de volledige index');
  assert.equal(records.filter(r=>r[7]==='Geregistreerd').length,countStatus('Geregistreerd'));
  assert.equal(records.filter(r=>r[7]==='Vermoedelijk').length,countStatus('Vermoedelijk'));
  assert.equal(await atlas.locator('.ra-link-proof').count(),edgeCount);
  const proof=atlas.locator('.ra-link-proof').first();
  await proof.locator('summary').click();
  assert(await proof.locator('p').nth(1).isVisible(),'Broninformatie niet zichtbaar');
  assert.match(await proof.locator('p').nth(1).textContent(),/^Bron: .+/);
  assert.match(await proof.locator('p').nth(2).textContent(),/^Status: (Geregistreerd|Vermoedelijk)$/);
  await proof.locator('summary').click();
  await atlas.locator('.ra-shell').evaluate(shell=>{shell.scrollTop=0;});
  await atlas.locator('select[aria-label="Filter status van het verband"]').selectOption('Vermoedelijk');
  assert.equal(await atlas.locator('.ra-link-row').count(),countStatus('Vermoedelijk'),'Vermoedelijke verbanden onjuist geteld');
  assert.deepEqual(actualRows(await readAtlasCsv()),expectedRows(expectedIndex.edges.filter(e=>e.status==='Vermoedelijk')),'Gefilterde CSV bevat verkeerde verbanden');
  await atlas.locator('select[aria-label="Filter status van het verband"]').selectOption('Geregistreerd');
  assert.equal(await atlas.locator('.ra-link-row').count(),countStatus('Geregistreerd'),'Geregistreerde verbanden onjuist geteld');
  await atlas.locator('button.ra-reset').click();
  await atlas.locator('select[aria-label="Filter onderdeel"]').selectOption('licenseReview');
  assert.equal(await atlas.locator('.ra-link-row').count(),26,'Licentierelaties ontbreken');
  await atlas.locator('button.ra-reset').click();
  await atlas.locator('input.ra-search').fill('APP-034');
  assert(await atlas.locator('.ra-match-button').count()>0,'Zoeken in alle registraties werkt niet');
  await atlas.locator('.ra-match-button').first().click();
  const selectedEdges=expectedIndex.edges.filter(e=>(e.fromType==='apps'&&e.fromId==='APP-034')||(e.toType==='apps'&&e.toId==='APP-034'));
  assert(selectedEdges.length>0,'Zoekfixture bevat geen verbanden');
  assert.equal(await atlas.locator('.ra-link-row').count(),selectedEdges.length,'Gerichte verbanden niet volledig');
  assert.match(await atlas.locator('.ra-detail').textContent(),/APP-034/);
  assert.match(await atlas.locator('.ra-sources').textContent(),/Bronverwijzingen/);
  console.log('Relatieatlas '+browserType.name()+' '+width+'px: '+nodeCount+' registraties, '+edgeCount+' verbanden, CSV-inhoud, bronstatus, filters, zoekfunctie en bereikbaarheid gecontroleerd');
  await atlas.locator('button.ra-close').click();
  await atlas.waitFor({state:'hidden'});
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
  const fgBoundary=await page.locator('.fg-role-boundary').textContent();
  assert.match(fgBoundary,/geen DPIA/i);
  assert.match(fgBoundary,/bevoegd gezag beslist/i);
  assert.match(fgBoundary,/onafhankelijk toezicht/i);
  assert.match(fgBoundary,/goedkeuring/i);
  assert.match(await page.locator('#privacySummary').textContent(),/Niet aangeleverd/);
  await page.screenshot({path:'test-results/ict-scan-'+width+'-privacy.png'});
  await navigate('apps');
  assert.equal(await page.locator('#registerPicker option').count(),Object.keys(inventory.STORES).length);
  await page.locator('#registerPicker').selectOption('hardwareGroups');
  await page.locator('#registerOpen').click();
  assert.equal(await page.locator('#cardTypeFilter').inputValue(),'hardwareGroups');
  assert.equal(await page.locator('#cardBrowserList .card-browser-item').count(),expectedIndex.count('hardwareGroups'));
  await page.locator('#cardEditorClose').click();
  await page.locator('#globalSearch').fill('WRK-014');
  await page.locator('#globalSearch').press('Enter');
  await page.locator('#globalResults [data-result-id="WRK-014"]').click();
  assert.equal(await page.locator('#cardRecordId').textContent(),'WRK-014');
  await page.locator('#cardEditorClose').click();
  assert.equal(await page.locator('#candidatePanel').isVisible(),false,'Kandidaten zijn niet gescheiden van basisregistraties');
  // One compact inspector, not nested Excel/JSON/read-card duplicates.
  // A visible button is not sufficient: its own row and scroll viewport
  // must actually contain the hit target. Never force the click.
  const listGeometry=await page.locator('#appsList').evaluate(el=>{
    const card=el.querySelector('.item-card-direct'),button=card.querySelector('.item-summary');
    const r=card.getBoundingClientRect(),b=button.getBoundingClientRect(),v=el.getBoundingClientRect();
    return {row:r.height,button:b.height,viewport:v.height,rows:[...el.children].length,scrollHeight:el.scrollHeight};
  });
  assert(listGeometry.row>=listGeometry.button&&listGeometry.row>=57&&listGeometry.viewport>=57,
    'Registerrij wordt samengedrukt: '+JSON.stringify(listGeometry));
  await page.screenshot({path:'test-results/ict-scan-'+width+'-register-fixed.png',animations:'disabled'});
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
  // Bronkaart: lege metadata is zichtbaar onbekend, zonder de JSON-waarden aan te vullen.
  await page.locator('#railMore').click();
  await page.locator('#cardOpen').click();
  await page.locator('#cardTypeFilter').selectOption('sourceRegister');
  await page.locator('#cardBrowserList .card-browser-item').first().click();
  const sourceOverview=await page.evaluate(()=>{
    const panel=document.querySelector('#cardReadView [data-card-tab="overview"]');
    const values=Object.fromEntries([...panel.querySelectorAll('dt')].map(node=>[node.textContent,node.nextElementSibling?.textContent]));
    return {values,original:JSON.parse(document.getElementById('cardJson').textContent)};
  });
  assert.equal(sourceOverview.values['Verantwoordelijke'],'Onbekend');
  assert.equal(sourceOverview.values['Bronversie'],'Onbekend');
  assert.equal(sourceOverview.values['Gebruiksrecht'],'Onbekend');
  assert.equal(sourceOverview.values['Goedkeuring'],'Nog te beoordelen');
  assert.equal(sourceOverview.original.owner,'');
  assert.equal(sourceOverview.original.version,'');
  await page.locator('#cardReadView .card-read-tab[data-target="details"]').click();
  const sourceDetails=await page.locator('#cardReadView [data-card-tab="details"]').textContent();
  assert.match(sourceDetails,/Grondslag voor gebruik\s*Onbekend/);
  assert.match(sourceDetails,/Bewijs van goedkeuring\s*Onbekend/);
  await page.locator('#cardEditorClose').click();
  await page.locator('.app-register-tab').nth(1).click();
  assert.equal(await page.locator('#candidatePanel').isVisible(),true);
  assert(!/76\s+aanwijzingen/.test(await page.locator('#candidateInfo').textContent()),'Dezelfde 76 wordt dubbel getoond');
  await navigate('reports');
  assert.equal(await page.locator('#reportPicker [data-report]').count(),9);
  await page.locator('[data-report="devices"]').click();
  assert.match(await page.locator('#reportPreviewTitle').textContent(),/Apparaten/);
  await navigate('ai');
  await page.locator('#viewAiTab0').click();
  await page.locator('#viewAiScene0:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('#aiModeKlas').isVisible(),false,'Schoolbrede stand mag niet als klasselectie verschijnen');
  const progress=expectedIndex.aiProgress();
  assert.equal(await page.locator('#aiProgress .ai-progress-group').count(),3);
  assert.match(await page.locator('#aiProgress [data-ai-inspect="unknown"] .ai-measure-number').textContent(),new RegExp(progress.unknownCount+' / '+progress.featureCount));
  assert.match(await page.locator('#aiProgress [data-ai-inspect="risk"] .ai-measure-number').textContent(),new RegExp(progress.possibleHighRisk.length+' / '+progress.featureCount));
  for(const [group,rows] of Object.entries(progress.groups)){
    const panel=page.locator('#aiProgress [data-progress="'+group+'"]');
    assert.equal(await panel.locator('[data-record-id]').count(),rows.length);
    if(rows.length>3){assert.equal(await panel.locator('details').getAttribute('open'),null);}
  }
  if(width===1440)await page.screenshot({path:'test-results/ict-scan-ai-overview.png',animations:'disabled'});
  await page.locator('#aiProgress [data-ai-inspect="unknown"]').click();
  await page.locator('#viewAiScene2:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('#aiModeAll').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#aiStatusFilter').inputValue(),'unknown');
  assert.equal(await page.locator('#aiList .item-card-direct').count(),progress.unknownCount);
  await page.locator('#aiClearFilters').click();
  assert.equal(await page.locator('#aiList .item-card-direct').count(),progress.featureCount);
  await page.locator('#viewAiTab0').click();
  await page.locator('#viewAiScene0:not([hidden])').waitFor({state:'visible'});
  await page.locator('#aiProgress [data-ai-inspect="risk"]').click();
  await page.locator('#viewAiScene2:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('#aiList .item-card-direct').count(),progress.possibleHighRisk.length);
  await page.locator('#aiModeSchool').click();
  assert.equal(await page.locator('#aiStatusFilter').inputValue(),'');
  assert((await page.locator('#aiList .item-card-direct').count())>0,'AI in de school mag geen lege introductie tonen');
  assert.equal(await page.locator('#dpiaList').isVisible(),false,'DPIA wordt dubbel getoond binnen AI');
  await page.locator('#aiModeKlas').click();
  const schoolProducts=await page.locator('#aiFilterProduct option').allTextContents();
  assert(schoolProducts.length>1,'Toepassingsfilter ontbreekt');
  const product=await page.locator('#aiFilterProduct option').nth(1).getAttribute('value');
  await page.locator('#aiFilterProduct').selectOption(product);
  assert((await page.locator('#aiList .item-card-direct').count())>0);
  assert.match(await page.locator('#aiList .item-sub').first().textContent(),new RegExp(product.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await page.locator('#aiClearFilters').click();
  const classFunctions=expectedIndex.records('ai').filter(taxonomy.isClassroomAi);
  for(const phase of taxonomy.PHASES){
    await page.locator('#aiFilterPhase').selectOption(phase);
    const expected=classFunctions.filter(row=>taxonomy.phases(row).includes(phase));
    assert.equal(await page.locator('#aiList .item-card-direct').count(),expected.length,'Onjuiste functiepopulatie bij '+phase);
  }
  await page.locator('#aiClearFilters').click();
  assert.equal(await page.locator('#aiList .item-card-direct').count(),classFunctions.length);
  if(width===1440)await page.screenshot({path:'test-results/ict-scan-ai-functions.png',animations:'disabled'});
  await page.locator('#viewAi .scene-tab').nth(1).click();
  await page.locator('#viewAiScene1:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('#aiClassPanels').isVisible(),true);
  await page.locator('#viewAi .scene-tab').nth(3).click();
  await page.locator('#viewAiScene3:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('#viewAi .scene-tab').count(),4,'AI-beheer moet onder AI staan');
  assert((await page.locator('#privacyControls .evidence-group').count())>=4,'Beheerpunten zijn niet gegroepeerd');
  assert.equal(await page.locator('#privacyControls .evidence-group[open]').count(),0,'Beheermappen openen alleen op verzoek');
  const control=expectedIndex.records('aiControls')[0];
  await page.locator('#aiControlSearch').fill(control.id);
  assert.equal(await page.locator('#privacyControls .evidence-row:not([hidden])').count(),1);
  assert.equal(await page.locator('#privacyControls .evidence-group[open]:not([hidden])').count(),1);
  assert.equal(await page.locator('#privacyControls .evidence-row:not([hidden]) [data-card-id]').getAttribute('data-card-id'),control.id);
  await page.locator('#aiControlSearch').fill(' '+control.id.toLowerCase()+' ');
  assert.equal(await page.locator('#privacyControls .evidence-row:not([hidden])').count(),1);
  await page.locator('#aiControlSearch').fill('B-999999');
  assert.equal(await page.locator('#privacyControls .evidence-row:not([hidden])').count(),0);
  assert.equal(await page.locator('#aiControlEmpty').isVisible(),true);
  await page.locator('#aiControlSearch').fill('Teams Classwork');
  assert.equal(await page.locator('#privacyControls .evidence-row:not([hidden])').count(),expectedIndex.records('aiControls').filter(row=>inventory.matchesRecord(row,'Teams Classwork',{exactId:true,excludeMetadata:true})).length);
  await page.locator('#aiControlClear').click();
  assert.equal(await page.locator('#privacyControls .evidence-row:not([hidden])').count(),expectedIndex.records('aiControls').length);
  if(width===1440)await page.screenshot({path:'test-results/ict-scan-ai-management.png',animations:'disabled'});
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
  // Check the final screen state after the normal interactions.
  await assertFixedStarts(width===1440?{width:1280,height:720}:{width:320,height:740});
  await assertFixedStarts({width,height:900});
  await navigate('sources');
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
    await page.locator('#railDrawerClose').click();
    await navigate('findings');
    assert.equal(await page.locator('#sectionTitle').textContent(),'Controles');
  }
  // The shared design is the same native layout schema, not a second data source.
  if(width>=700){
    await navigate('studio');
    await page.locator('#dsToggleControls').click();
    await page.locator('[data-ds-preset="school"]').click();
    const sourceBefore=await page.evaluate(()=>JSON.stringify([...state.apps.values()]));
    await page.locator('#dsSharedLoad').click();
    await page.waitForFunction(()=>document.getElementById('dsSharedStatus').textContent.includes('Gedeeld ontwerp geopend'));
    assert.equal(await page.evaluate(()=>JSON.stringify([...state.apps.values()])),sourceBefore);
    await page.locator('#dsLayout').selectOption('editorial');
    await page.locator('#dsSharedPublish').click();
    await page.locator('#dsSharedDialog').waitFor({state:'visible'});
    assert.equal(designWrites.length,0,'Openen van de pop-up mag niets schrijven');
    await page.locator('#dsSharedReason').fill('Browserproef gedeelde indeling');
    await page.locator('#dsSharedToken').fill('browser-test-design-token');
    await page.locator('#dsSharedSubmit').click();
    await page.waitForFunction(()=>document.getElementById('dsSharedFeedback').textContent.includes('bevestig'));
    assert.equal(designWrites.length,0,'Zonder toestemming wordt niets geschreven');
    await page.locator('#dsSharedToken').fill('browser-test-design-token');
    await page.locator('#dsSharedConsent').check();
    await page.locator('#dsSharedSubmit').click();
    await page.waitForFunction(()=>document.getElementById('dsSharedFeedback').textContent.includes('PR #9999'));
    assert.equal(designWrites.length,3,'Uitsluitend een branch, layoutbestand en pull request');
    assert.equal(await page.locator('#dsSharedToken').inputValue(),'');
    await page.locator('#dsSharedClose').click();
    assert.equal(await page.evaluate(()=>JSON.stringify([...state.apps.values()])),sourceBefore);
    await page.locator('#dsLayout').selectOption('balanced');
    await page.locator('#dsCloseControls').click();
  }
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join(' / '));
  await page.close();
 }
 assert.deepEqual(fixedScreenFailures,[],'Afwijkingen vaste schermen:\n'+fixedScreenFailures.join('\n'));
 console.log('ICT-scan '+browserType.name()+': 69 toepassingen geladen, vaste schermen, menu, grafieken en desktop/mobiele sync gecontroleerd');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
