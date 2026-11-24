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
const expectedSourceRecords=manifest.dataFiles.reduce((total,file)=>total+(file.recordCounts.sourceRegister||0),0);
const expectedInventoryRecords=expectedRecords-expectedSourceRecords;
const corpus=readJson(resolve(root,'tools/ict-scan/assurance/evaluation-corpus.json'));
const headerSource=readFileSync(resolve(root,'tools/ict-scan/.htaccess'),'utf8');
const responseHeaders=Object.fromEntries([...headerSource.matchAll(/^\s*Header\s+(?:always\s+)?set\s+([\w-]+)\s+"([^"]*)"\s*$/gm)].map(match=>[match[1].toLowerCase(),match[2]]));
assert.equal(responseHeaders['x-frame-options'],'DENY');
assert.match(responseHeaders['content-security-policy'],/frame-ancestors\s+'none'/);
const fixturePrefix='/__assurance_guard_only';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const externalRequests=[],pageErrors=[],completedSteps=[];
let browser,context,page,server,origin;
const summary={passed:false,expectedRecords,expectedInventoryRecords,expectedSourceRecords,expectedEvaluationCases:corpus.cases.length,completedSteps,externalRequests,pageErrors,headerFixture:{source:'tools/ict-scan/.htaccess',headers:responseHeaders,productionResponseVerified:false}};
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
      stamp?.textContent.startsWith(expected+' gecontroleerde registerrecords') &&
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
async function openCard(target,type,id){
  await target.locator('#cardTypeFilter').selectOption(type);
  await target.locator('#cardSearch').fill(id);
  const item=target.locator('#cardBrowserList .card-browser-item').filter({hasText:id});
  assert.equal(await item.count(),1,'Er moet precies één kaart zijn voor '+id);
  await item.click();
  assert.equal(await target.locator('#cardRecordId').innerText(),id);
}
async function saveCard(target){
  await target.locator('#cardSaveDraft').click();
  await target.locator('#cardForm').waitFor({state:'hidden',timeout:10000});
  assert.match(await target.locator('#cardFeedback').innerText(),/Concept bewaard/);
}
async function draft(target,type,id){
  return target.evaluate(({type,id})=>window.EmmausRecordCards.drafts().find(item=>item.type===type&&item.id===id),{type,id});
}
async function inspectSyntheticBindings(target,sourceId,recordId){
  return target.evaluate(({sourceId,recordId})=>{
    const profile=window.IctOrganisation.profile;
    const registers=Object.fromEntries(Object.keys(profile.source.registerFiles).map(type=>[type,[]]));
    for(const item of window.EmmausRecordCards.drafts())registers[item.type].push(item.after);
    // Read the actual UI-created drafts. No approval or review binding is
    // constructed or altered by the test's inspection code.
    const input=window.AssuranceAdapter.fromRegisters(profile,registers,window.EmmausRecordCards.catalog(),{asOf:new Date().toISOString().slice(0,10)});
    const source=input.records.find(item=>item.type==='sourceRegister'&&item.id===sourceId);
    const record=input.records.find(item=>item.type==='apps'&&item.id===recordId);
    const link=record?.data.frameworkLinks?.[0];
    return {approval:window.AssuranceSourceRegister.inspectApprovalBinding(source.data,input.context),
      review:link?window.AssuranceEngine.inspectReviewBinding(input,record,link):null};
  },{sourceId,recordId});
}
async function exerciseBoundApprovals(target){
  const sourceId='SRC-99001',recordId='APP-99002';
  const reference='Uitsluitend synthetische bron voor de lokale browserproef';
  const setup=await target.evaluate(()=>{
    const date=new Date(),asOf=date.toISOString().slice(0,10);
    date.setUTCDate(date.getUTCDate()+30);
    return {asOf,nextReviewAt:date.toISOString().slice(0,10),files:window.IctOrganisation.profile.source.registerFiles};
  });
  const sourceDocument={schema:'eai-school-ict-v1',sourceRegister:[{id:sourceId,name:'Synthetische bron, nog in te vullen',referenceKeys:[]}]};
  const inventoryDocument={schema:'eai-school-ict-v1',apps:[{id:recordId,name:'Fictieve toepassing voor bevestigingsproef',description:'Oorspronkelijke synthetische inhoud',sources:[reference],sourceIds:[]}]};
  // Matching configured filenames exercise the importer's ordinary source-name
  // normalization. Every approval field is completed in the real card form.
  await target.locator('#fileInput').setInputFiles([
    {name:setup.files.sourceRegister,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sourceDocument))},
    {name:setup.files.apps,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(inventoryDocument))}
  ]);
  await waitForChecks(target,expectedRecords+3);
  await target.setViewportSize({width:1440,height:960});
  await target.locator('#railMore').click();
  await target.locator('#railDrawer').waitFor({state:'visible'});
  assert.equal(await target.locator('#railMore').getAttribute('aria-expanded'),'true');
  await target.locator('#cardOpen').click();
  await target.locator('#cardEditor').waitFor({state:'visible'});
  await target.locator('#cardTypeFilter').selectOption('sourceRegister');
  await target.locator('#cardNew').click();
  await target.locator('#cardGatePassword').fill('Emmauscollege');
  await target.locator('.card-edit-gate [data-unlock]').click();
  assert.equal(await target.locator('#cardRecordId').innerText(),'SRC-99002','Een nieuwe bronkaart moet een geldig bron-ID met minimaal vijf cijfers krijgen');
  assert.equal(await target.locator('#cardFormFields [data-field="owner"]').inputValue(),'');
  assert.equal(await target.locator('#cardFormFields [name="confirmSourceApproval"]').isChecked(),false);
  await target.locator('#cardCancelEdit').click();
  assert.equal(await draft(target,'sourceRegister','SRC-99002'),undefined);
  await openCard(target,'sourceRegister',sourceId);
  await target.locator('#cardEditButton').click();
  for(const [field,value] of Object.entries({
    name:'Synthetische bron voor bevestigingsproef',owner:'Fictieve bronhouder',version:'browser-1',
    rightsBasis:'Zelfgemaakt synthetisch testmateriaal',allowedUse:'Uitsluitend deze lokale browserproef',
    scope:'Fictieve toepassing '+recordId,retention:'Verwijderen na de browserproef',
    approvedBy:'Fictieve bronbeoordelaar',approvedAt:setup.asOf,
    approvalEvidence:'Synthetisch toestemmingsbewijs voor browserproef',nextReviewAt:setup.nextReviewAt
  }))await target.locator('#cardFormFields [data-field="'+field+'"]').fill(value);
  await target.locator('#cardFormFields [data-field="rightsStatus"]').selectOption('Toegestaan');
  await target.locator('#cardFormFields [data-field="approvalStatus"]').selectOption('Goedgekeurd');
  await target.locator('#cardFormFields [name="referenceKeys"]').fill(reference);
  await target.locator('#cardFormFields [name="changeReason"]').fill('Synthetische bron volledig invullen en expliciet goedkeuren.');
  const sourceConfirmation=target.locator('#cardFormFields [name="confirmSourceApproval"]');
  assert.equal(await sourceConfirmation.isChecked(),false);
  await target.locator('#cardSaveDraft').click();
  await target.locator('#cardFeedback').filter({hasText:/Bevestig de gewijzigde brongoedkeuring/}).waitFor();
  assert.equal(await target.locator('#cardForm').isVisible(),true);
  assert.equal(await draft(target,'sourceRegister',sourceId),undefined,'Zonder bevestiging mag geen goedgekeurd bronconcept ontstaan');
  await sourceConfirmation.check();
  await saveCard(target);
  const approvedSource=await draft(target,'sourceRegister',sourceId);
  assert.ok(approvedSource.after.approvalBinding,'De echte bronbevestiging moet een binding vastleggen');
  assert.equal((await inspectSyntheticBindings(target,sourceId,recordId)).approval.status,'current');
  await target.locator('#cardReadView [data-target="overview"]').click();
  assert.match(await target.locator('#cardTabPaneloverview').innerText(),/Goedkeuring bevestigd voor deze bronversie/);
  await target.screenshot({path:resolve(output,'approved-source.png')});
  finishStep('Bron via formulier ingevuld en uitsluitend na expliciete bevestiging goedgekeurd',{sourceId,screenshot:'approved-source.png'});

  await openCard(target,'apps',recordId);
  await target.locator('#cardEditButton').click();
  await target.getByRole('button',{name:'+ Bron koppelen',exact:true}).click();
  await target.locator('#cardSourceRows [data-part="sourceId"]').selectOption(sourceId);
  await target.getByRole('button',{name:'+ Toetsing',exact:true}).click();
  const review=target.locator('#cardFrameworkRows [data-group="framework"]');
  assert.equal(await review.count(),1);
  await review.locator('[data-part="frameworkId"]').selectOption('EN18286');
  await review.locator('[data-part="article"]').fill('8.4');
  await review.locator('[data-part="status"]').selectOption('Onderbouwd');
  await review.locator('[data-part="evidence"]').fill(sourceId+' / synthetisch bewijs voor browserproef');
  await review.locator('[data-part="note"]').fill('Alleen fictieve gegevens; geen oordeel over een echte organisatie.');
  await review.locator('[data-part="role"]').selectOption('Gebruiksverantwoordelijke');
  await review.locator('[data-part="reviewedBy"]').fill('Fictieve normbeoordelaar');
  await review.locator('[data-part="reviewedAt"]').fill(setup.asOf);
  await review.locator('[data-part="nextReviewAt"]').fill(setup.nextReviewAt);
  await review.locator('[data-part="followUpStatus"]').selectOption('Niet van toepassing');
  await target.locator('#cardFormFields [name="changeReason"]').fill('Synthetische beoordeling met een exact gekoppelde, goedgekeurde bron.');
  const reviewConfirmation=review.locator('[data-part="confirmReviewBinding"]');
  assert.equal(await reviewConfirmation.isChecked(),false);
  await target.locator('#cardSaveDraft').click();
  await target.locator('#cardFeedback').filter({hasText:/Bevestig de gewijzigde beoordeling/}).waitFor();
  assert.equal(await draft(target,'apps',recordId),undefined,'Zonder bevestiging mag geen afgerond beoordelingsconcept ontstaan');
  await reviewConfirmation.check();
  await saveCard(target);
  const reviewedRecord=await draft(target,'apps',recordId);
  const originalReviewBinding=reviewedRecord.after.frameworkLinks[0].reviewBinding;
  assert.ok(originalReviewBinding);
  assert.deepEqual(reviewedRecord.after.sourceIds,[sourceId]);
  assert.deepEqual(originalReviewBinding.basis.sourceIds,[sourceId]);
  const confirmed=await inspectSyntheticBindings(target,sourceId,recordId);
  assert.equal(confirmed.approval.status,'current');
  assert.equal(confirmed.review.status,'current');
  await target.locator('#cardReadView [data-target="links"]').click();
  assert.match(await target.locator('#cardTabPanellinks').innerText(),/Bevestigd voor deze gegevens/);
  finishStep('Normbeoordeling via formulier bevestigd voor exacte inhoud en gekoppelde bron',{recordId,sourceId});

  await openCard(target,'sourceRegister',sourceId);
  await target.locator('#cardEditButton').click();
  assert.equal(await target.locator('[name="confirmSourceApproval"]').isChecked(),false);
  await target.locator('#cardFormFields [data-field="version"]').fill('browser-2');
  await target.locator('#cardFormFields [name="changeReason"]').fill('Bronversie gewijzigd zonder de eerdere goedkeuring te vernieuwen.');
  await saveCard(target);
  const changedSource=await draft(target,'sourceRegister',sourceId);
  assert.deepEqual(changedSource.after.approvalBinding,approvedSource.after.approvalBinding,'Een broncorrectie mag niet stil opnieuw goedkeuren');
  await target.locator('#cardReadView [data-target="overview"]').click();
  assert.match(await target.locator('#cardTabPaneloverview').innerText(),/Brongegevens gewijzigd: opnieuw goedkeuren/);
  const sourceChanged=await inspectSyntheticBindings(target,sourceId,recordId);
  assert.equal(sourceChanged.approval.status,'stale');
  assert.equal(sourceChanged.review.status,'stale');
  assert.ok(sourceChanged.review.findings.some(item=>item.part==='sources'));
  await openCard(target,'apps',recordId);
  await target.locator('#cardReadView [data-target="links"]').click();
  assert.match(await target.locator('#cardTabPanellinks').innerText(),/Gegevens of beoordeling gewijzigd: opnieuw beoordelen/);
  assert.deepEqual((await draft(target,'apps',recordId)).after.frameworkLinks[0].reviewBinding,originalReviewBinding);
  finishStep('Gewijzigde bron maakt bestaande bron- en normbevestiging verouderd zonder herbinding');

  // Restore precisely the reviewed source content through the same form, then
  // change only the inventory content. This isolates the two stale conditions.
  await openCard(target,'sourceRegister',sourceId);
  await target.locator('#cardEditButton').click();
  assert.equal(await target.locator('[name="confirmSourceApproval"]').isChecked(),false);
  await target.locator('#cardFormFields [data-field="version"]').fill('browser-1');
  await target.locator('#cardFormFields [name="changeReason"]').fill('De oorspronkelijke synthetische bronversie herstellen voor een afzonderlijke inhoudsproef.');
  await saveCard(target);
  assert.deepEqual((await draft(target,'sourceRegister',sourceId)).after.approvalBinding,approvedSource.after.approvalBinding);
  const restored=await inspectSyntheticBindings(target,sourceId,recordId);
  assert.equal(restored.approval.status,'current');
  assert.equal(restored.review.status,'current');
  await openCard(target,'apps',recordId);
  await target.locator('#cardEditButton').click();
  assert.equal(await target.locator('[data-part="confirmReviewBinding"]').isChecked(),false);
  await target.locator('#cardFormFields [data-field="description"]').fill('Gewijzigde synthetische inhoud die nog niet opnieuw is beoordeeld');
  await target.locator('#cardFormFields [name="changeReason"]').fill('Alleen de inhoud aanpassen met behoud van de oorspronkelijke beoordeling.');
  await saveCard(target);
  const changedRecord=await draft(target,'apps',recordId);
  assert.deepEqual(changedRecord.after.frameworkLinks[0].reviewBinding,originalReviewBinding,'Een inhoudscorrectie mag de beoordeling niet stil opnieuw binden');
  const contentChanged=await inspectSyntheticBindings(target,sourceId,recordId);
  assert.equal(contentChanged.approval.status,'current');
  assert.equal(contentChanged.review.status,'stale');
  assert.ok(contentChanged.review.findings.some(item=>item.part==='record'));
  assert.ok(!contentChanged.review.findings.some(item=>item.part==='sources'),'De inhoudsproef moet een ongewijzigde bron gebruiken');
  await target.locator('#cardReadView [data-target="links"]').click();
  assert.match(await target.locator('#cardTabPanellinks').innerText(),/Gegevens of beoordeling gewijzigd: opnieuw beoordelen/);
  await target.screenshot({path:resolve(output,'stale-review.png')});
  summary.boundApprovals={sourceId,recordId,explicitSourceApprovalRequired:true,explicitReviewConfirmationRequired:true,
    sourceChange:{approval:sourceChanged.approval.status,review:sourceChanged.review.status},
    contentChange:{approval:contentChanged.approval.status,review:contentChanged.review.status},originalBindingsPreserved:true,
    screenshots:{approvedSource:'approved-source.png',staleReview:'stale-review.png'}};
  finishStep('Gewijzigde inhoud toont de oorspronkelijke beoordeling als verouderd en behoudt de bronbevestiging',{screenshot:'stale-review.png'});
  await target.locator('#cardEditorClose').click();
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
  assert.equal(initial.checks.find(check=>check.id==='structure').coverage.inventoryRecords,expectedInventoryRecords);
  assert.equal(initial.checks.find(check=>check.id==='structure').coverage.sourceRegisterRecords,expectedSourceRecords);
  assert.ok(expectedSourceRecords>0,'Het manifest moet het verplichte bronregister bevatten');
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

  await exerciseBoundApprovals(page);

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
