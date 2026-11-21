/* Real Chromium exercise of the local UI. No production site or live API is used.
   Run after installing playwright@1.62.1 and its Chromium browser. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.ASSURANCE_BROWSER_OUTPUT||resolve(root,'artifacts/ict-assurance-browser'));
mkdirSync(output,{recursive:true});
const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const manifest=readJson(resolve(root,'tools/ict-scan/bronnen/manifest.json'));
const sourceFiles=manifest.dataFiles.map(file=>resolve(root,'tools/ict-scan/bronnen',file.path));
const expectedRecords=manifest.dataFiles.reduce((total,file)=>total+Object.values(file.recordCounts).reduce((sum,count)=>sum+count,0),0);
const corpus=readJson(resolve(root,'tools/ict-scan/assurance/evaluation-corpus.json'));
const headerSource=readFileSync(resolve(root,'tools/ict-scan/.htaccess'),'utf8');
const responseHeaders=Object.fromEntries([...headerSource.matchAll(/^\s*Header\s+(?:always\s+)?set\s+([\w-]+)\s+"([^"]*)"\s*$/gm)].map(match=>[match[1].toLowerCase(),match[2]]));
assert.equal(responseHeaders['x-frame-options'],'DENY');
assert.match(responseHeaders['content-security-policy'],/frame-ancestors\s+'none'/);
const fixturePrefix='/__assurance_guard_only';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const externalRequests=[],pageErrors=[],completedSteps=[];
let browser,context,page,server,origin;
const summary={passed:false,expectedRecords,expectedEvaluationCases:corpus.cases.length,completedSteps,externalRequests,pageErrors,headerFixture:{source:'tools/ict-scan/.htaccess',headers:responseHeaders,productionResponseVerified:false}};
const finishStep=(name,details={})=>{completedSteps.push({name,...details});process.stdout.write('Geslaagd: '+name+'\n');};
function serve(request,response){
  try {
    let pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(pathname==='/__assurance_embed'||pathname==='/__assurance_guard_embed'){
      const guardOnly=pathname==='/__assurance_guard_embed';
      response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      response.end('<!doctype html><html lang="nl"><title>Lokale iframeproef</title><body><iframe id="dashboardFrame" name="dashboardFrame" title="Dashboard in testframe" style="width:100%;height:850px;border:0" src="'+(guardOnly?fixturePrefix:'')+'/tools/ict-scan/"></iframe></body></html>');return;
    }
    const guardOnly=pathname.startsWith(fixturePrefix+'/');
    if(guardOnly)pathname=pathname.slice(fixturePrefix.length);
    let path=resolve(root,'.'+pathname);
    if(path!==root&&!path.startsWith(root+sep)){response.writeHead(403);response.end();return;}
    if(statSync(path).isDirectory())path=resolve(path,'index.html');
    const headers={'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'};
    if(!guardOnly&&pathname.startsWith('/tools/ict-scan/'))Object.assign(headers,responseHeaders);
    response.writeHead(200,headers);response.end(readFileSync(path));
  }catch(_){response.writeHead(404,{'content-type':'text/plain; charset=utf-8'});response.end('Not found');}
}
async function waitForChecks(target,count){
  await target.waitForFunction(expected=>{
    const summary=document.getElementById('assuranceSummary');
    const stamp=document.getElementById('assuranceStamp');
    return document.querySelectorAll('#assuranceChecks .assurance-check').length===5 &&
      stamp?.textContent.startsWith(expected+' registraties') &&
      summary?.dataset.status!=='not_run' && !document.getElementById('assuranceExport').disabled;
  },count,{timeout:20000});
}
async function downloadJson(target,selector,name){
  const pending=target.waitForEvent('download');
  await target.locator(selector).click();
  const download=await pending,path=resolve(output,name);
  await download.saveAs(path);return readJson(path);
}
async function assertFits(target,label){
  const dimensions=await target.evaluate(()=>{
    const width=window.innerWidth;
    return {width,documentWidth:document.documentElement.scrollWidth,regions:['#main','#viewFindings .scene-frame','#assurancePanel'].map(selector=>{
      const node=document.querySelector(selector),box=node.getBoundingClientRect();
      return {selector,left:box.left,right:box.right,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth};
    })};
  });
  assert.ok(dimensions.documentWidth<=dimensions.width+2,label+': de pagina loopt horizontaal over');
  for(const region of dimensions.regions){
    assert.ok(region.left>=-2&&region.right<=dimensions.width+2,label+': buiten beeld '+region.selector);
    assert.ok(region.scrollWidth<=region.clientWidth+2,label+': horizontale inhoud buiten '+region.selector);
  }
  return dimensions;
}
try {
  const dependencyRoot=process.env.ASSURANCE_PLAYWRIGHT_ROOT;
  const require=dependencyRoot?createRequire(resolve(dependencyRoot,'package.json')):createRequire(import.meta.url);
  const packageInfo=require('playwright/package.json');
  assert.equal(packageInfo.version,'1.62.1','De gebruikersproef vereist exact playwright@1.62.1.');
  const {chromium}=require('playwright');
  server=createServer(serve);
  await new Promise((resolveListen,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolveListen();});});
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  summary.browserVersion=browser.version();summary.playwrightVersion=packageInfo.version;
  context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true,reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin||url.protocol==='blob:'||url.protocol==='data:'){await route.continue();return;}
    externalRequests.push({method:request.method(),url:request.url(),action:'aborted'});
    await route.abort('blockedbyclient');
  });
  page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  const response=await page.goto(origin+'/tools/ict-scan/',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  assert.equal(response.headers()['x-frame-options'],'DENY');
  assert.match(response.headers()['content-security-policy'],/frame-ancestors\s+'none'/);
  assert.equal(await page.locator('#workspace').isVisible(),false);
  await page.locator('#unlockZero').dblclick();
  await page.locator('#workspace').waitFor({state:'visible'});
  finishStep('Dashboard geopend via de bestaande ingang');

  // The ordinary file input invokes the production import handlers and render path.
  await page.locator('#fileInput').setInputFiles(sourceFiles);
  await page.locator('#sections [data-view="findings"]').click();
  await page.locator('#assurancePanel').waitFor({state:'visible'});
  await waitForChecks(page,expectedRecords);
  assert.equal(await page.locator('#assuranceChecks .assurance-check').count(),5);
  const initial=await downloadJson(page,'#assuranceExport','initial-report.json');
  assert.equal(initial.checks.find(check=>check.id==='structure').coverage.records,expectedRecords);
  assert.equal(initial.checks.find(check=>check.id==='structure').status,'pass');
  assert.equal(initial.checks.find(check=>check.id==='drift').status,'not_run');
  assert.equal(initial.checks.find(check=>check.id==='evaluation').status,'pass');
  assert.equal(initial.checks.find(check=>check.id==='evaluation').coverage.executedCases,corpus.cases.length);
  assert.equal(initial.provenance.execution,'browser-worker');
  assert.equal(initial.provenance.modelCalls,0);
  summary.desktop=await assertFits(page,'Desktop 1440');
  await page.screenshot({path:resolve(output,'desktop.png')});
  finishStep('Echte bronbestanden via de UI gecontroleerd',{records:expectedRecords,checks:5,evaluationCases:corpus.cases.length,drift:'not_run'});

  const comparison=page.locator('details.assurance-details').filter({has:page.locator('#assuranceBaselineInput')});
  await comparison.locator('summary').click();
  await page.locator('#assuranceSaveBaseline').click();
  await page.locator('#assuranceChecks [aria-controls="assuranceFinding-drift"][data-status="pass"]').waitFor();
  const retained=await downloadJson(page,'#assuranceExportBaseline','retained-baseline.json');
  assert.equal(retained.schema,'assurance-baseline-v1');
  assert.equal(retained.records.length,expectedRecords);
  const unchanged=await downloadJson(page,'#assuranceExport','unchanged-report.json');
  assert.equal(unchanged.checks.find(check=>check.id==='drift').status,'pass');
  finishStep('Vergelijkingsstand expliciet gekozen en ongewijzigde data vergeleken');

  const extra={schema:'eai-school-ict-v1',apps:[{id:'APP-99001',name:'Synthetische registratie voor browserproef',sources:['Synthetische browserproef / extra registratie']}]};
  assert.ok(!retained.records.some(record=>record.type==='apps'&&record.id==='APP-99001'));
  await page.locator('#fileInput').setInputFiles({name:'synthetic-extra.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(extra))});
  await waitForChecks(page,expectedRecords+1);
  const changed=await downloadJson(page,'#assuranceExport','changed-report.json');
  const drift=changed.checks.find(check=>check.id==='drift');
  assert.equal(drift.status,'attention');assert.equal(drift.coverage.added,1);
  assert.ok(drift.findings.some(finding=>finding.code==='RECORD_DRIFT'));
  assert.notEqual(changed.provenance.inputFingerprint,initial.provenance.inputFingerprint);
  finishStep('Extra registratie via import verandert de driftuitslag',{records:expectedRecords+1,added:1,drift:'attention'});

  await page.locator('#assuranceBaselineInput').setInputFiles({name:'invalid-baseline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'unsupported-baseline',context:{organisationId:'emmauscollege'}}))});
  await page.locator('#assuranceSummary[data-status="fail"]').waitFor();
  assert.equal(await page.locator('#assuranceExport').isEnabled(),false);
  assert.equal(await page.locator('#assuranceSaveBaseline').isEnabled(),false);
  assert.equal(await page.locator('#assuranceChecks .assurance-check').count(),0);
  assert.match(await page.locator('#assuranceFindings').innerText(),/vergelijkingsbestand|organisatie|bron/i);
  finishStep('Ongeldig vergelijkingsbestand toont een fout en wist de oude lampjes');

  await page.locator('#assuranceRun').click();
  await waitForChecks(page,expectedRecords+1);
  assert.equal(await page.locator('#assuranceChecks [aria-controls="assuranceFinding-drift"]').getAttribute('data-status'),'attention');
  if(await page.locator('#assuranceDetails').evaluate(node=>node.open))await page.locator('#assuranceDetails > summary').click();
  if(await comparison.evaluate(node=>node.open))await comparison.locator('summary').click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('#assuranceTitle').scrollIntoViewIfNeeded();
  summary.mobile=await assertFits(page,'Mobiel 390');
  await page.screenshot({path:resolve(output,'mobile.png')});
  finishStep('Controleweergave past binnen een scherm van 390 pixels');

  const embedded=await context.newPage();
  embedded.on('pageerror',error=>pageErrors.push(error.message));
  const denied=embedded.waitForEvent('console',{predicate:message=>/Refused to (frame|display)|frame-ancestors|X-Frame-Options/i.test(message.text()),timeout:10000});
  await embedded.goto(origin+'/__assurance_embed',{waitUntil:'domcontentloaded'});
  summary.frameDenial=(await denied).text();
  // A denied frame need not expose a queryable Playwright Frame. Observe the
  // parent element after Chromium's explicit refusal instead of waiting for it.
  const embeddedDashboardLoaded=await embedded.locator('#dashboardFrame').evaluate(element=>{
    try{return Boolean(element.contentDocument?.getElementById('unlockZero'));}catch(_){return false;}
  });
  assert.equal(embeddedDashboardLoaded,false);
  finishStep('Browser weigert inbedding met de bedoelde responseheaders');

  // A separate test-only route deliberately omits response headers. This verifies
  // the publisher's own iframe guard without altering application state or tokens.
  await embedded.goto(origin+'/__assurance_guard_embed',{waitUntil:'domcontentloaded'});
  const frame=embedded.frameLocator('#dashboardFrame');
  await frame.locator('#unlockZero').dblclick();
  await frame.locator('#workspace').waitFor({state:'visible'});
  const writesBefore=externalRequests.filter(request=>!['GET','HEAD'].includes(request.method)).length;
  await frame.locator('#cardCreatePR').dispatchEvent('click');
  await frame.locator('#cardFeedback').filter({hasText:'Open het dashboard rechtstreeks'}).waitFor({state:'attached'});
  assert.match(await frame.locator('#cardFeedback').textContent(),/Open het dashboard rechtstreeks/);
  assert.equal(externalRequests.filter(request=>!['GET','HEAD'].includes(request.method)).length,writesBefore);
  finishStep('Publicatiehandler weigert een iframe vóór een GitHub-schrijfverzoek');

  assert.equal(externalRequests.filter(request=>!['GET','HEAD'].includes(request.method)).length,0);
  assert.ok(externalRequests.every(request=>new URL(request.url).hostname==='api.github.com'),'Er werd een onverwachte externe dienst aangesproken.');
  assert.deepEqual(pageErrors,[],'De browser meldde een onverwachte JavaScript-fout.');
  summary.passed=true;
}catch(error){
  summary.error=String(error.stack||error);
  if(page)try{await page.screenshot({path:resolve(output,'failure.png')});}catch(_){}
  process.stderr.write(summary.error+'\n');process.exitCode=1;
}finally{
  writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  if(browser)await browser.close();
  if(server){server.closeAllConnections();await new Promise(resolveClose=>server.close(resolveClose));}
}
