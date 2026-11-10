// Safari-achtige browsercontrole van het zelf gehoste anatomiemodel.
// WebKit op Linux is niet gelijk aan een fysieke iPhone, maar controleert
// wel dezelfde browserengine en het werkelijk verdwijnen van de spinner.
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8896';
const server = spawn('python3', ['-m','http.server','8896','--bind','127.0.0.1','--directory',root], {stdio:'ignore'});
let browser;
try {
  let ready = false;
  for (let i=0;i<120;i++) {
    try { ready=(await fetch(base+'/tools/anatomie/')).ok; } catch {}
    if (ready) break;
    await new Promise(done=>setTimeout(done,100));
  }
  assert(ready, 'De atlas staat niet in de sitebuild');
  browser = await webkit.launch({headless:true});
  const page = await browser.newPage({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true
  });
  page.setDefaultTimeout(65000);
  const errors=[], failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',request=>failed.push(request.url()+' '+request.failure()?.errorText));
  const started=Date.now();
  await page.goto(base+'/tools/anatomie/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    let count=0;
    window.ZAnatomy?.viewer?.scene?.traverse(n=>{if(n.isMesh&&n.visible)count++});
    return count>50 && window.__EAI_ANATOMY_UI_READY===true;
  },null,{timeout:65000});
  await page.locator('#loadingOverlay').waitFor({state:'hidden',timeout:8000});
  const report=await page.evaluate(()=>{
    const canvas=document.getElementById('threeCanvas');
    return {
      width:canvas.width,height:canvas.height,
      visible:canvas.getBoundingClientRect().width>100,
      triangles:window.ZAnatomy?.viewer?.renderer?.info.render.triangles || 0
    };
  });
  const elapsed=Date.now()-started;
  assert(report.visible && report.width>200 && report.height>100,'De WebKit-canvas is niet zichtbaar');
  assert(report.triangles>100, 'WebKit tekent geen anatomische driehoeken');
  const touchControls=await page.evaluate(() => {
    const controls=window.ZAnatomy.viewer.controls;
    return {zoomToCursor:controls.zoomToCursor,
      twoFingerGesture:controls.touches.TWO,zoomEnabled:controls.enableZoom,
      panEnabled:controls.enablePan,rotateEnabled:controls.enableRotate};
  });
  assert.equal(touchControls.zoomToCursor,true,
    'Zoomen met twee vingers moet naar het midden van het knijpgebaar volgen');
  assert.equal(typeof touchControls.twoFingerGesture,'number',
    'De tweevingerbediening van OrbitControls ontbreekt');
  assert(touchControls.zoomEnabled && touchControls.panEnabled && touchControls.rotateEnabled,
    'Op mobiel moeten zoomen, verschuiven en draaien beschikbaar blijven');
  const directTouch = await page.evaluate(() => {
    const c=window.ZAnatomy.viewer.controls;
    return {one:c.touches.ONE,two:c.touches.TWO,
      pan:c.enablePan,zoom:c.enableZoom,rotate:c.enableRotate,
      touchAction:getComputedStyle(document.querySelector('#threeCanvas')).touchAction};
  });
  assert.notEqual(directTouch.one,directTouch.two,
    'Een vinger draait en twee vingers verplaatsen of zoomen');
  assert(directTouch.pan && directTouch.zoom && directTouch.rotate);
  assert.equal(directTouch.touchAction,'none',
    'Safari mag de pagina niet scrollen bij een gebaar op het model');
  assert.equal(await page.locator('#eaiDragMode, #eaiRotateMode, .eai-camera-modes').count(),0,
    'De extra draaistand- en verplaatsknoppen moeten weg');
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join('; '));
  assert.deepEqual(failed,[],'Netwerkfouten: '+failed.join('; '));
  // Het scherm bevat maar een stelsel: een diepteschuif zou betekenisloos zijn.
  assert.equal(await page.locator('#eaiExplore').count(),0,'Dubbele stelselkeuze op de viewer');
  assert.equal(await page.locator('#footerBar').count(),0,'Dubbele actiebalk onder het lichaam');
  assert.equal(await page.locator('#infoSidebar').count(),1,'Er is precies een informatiepaneel');
  assert.equal(await page.locator('.depth-control').count(),0,
    'Er mag nergens een zwevende lagenkaart zijn');

  // Gebruik dezelfde zoek- en selectieroute als een bezoeker op iPhone.
  await page.locator('#searchOpen').click();
  await page.locator('#searchInput').fill('femur');
  const choice = page.locator('#searchResults .search-result-item[data-part^="Femur"]').first();
  await choice.waitFor({state:'visible',timeout:12000});
  assert.match(await choice.innerText(),/Dijbeen/,
    'De bestaande Nederlandse modelnaam moet ook in het zoekresultaat staan');
  const beforeSearch=await page.evaluate(()=>window.ZAnatomy.viewer.controls.target.toArray());
  await choice.click();
  await page.locator('#structureInfo .eai-fact').first().waitFor({state:'attached',timeout:15000});
  await page.waitForTimeout(750);
  const afterSearch=await page.evaluate(()=>window.ZAnatomy.viewer.controls.target.toArray());
  assert(Math.hypot(...afterSearch.map((x,i)=>x-beforeSearch[i]))>.12,
    'Op mobiel moet zoeken het gekozen bot ook in beeld brengen');
  assert(!(await page.locator('#app').evaluate(el=>el.classList.contains('info-open'))),
    'Een selectie moet eerst alleen het naamlabel tonen');
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/anatomie-naamlabel-mobiel.png'});
  await page.locator('.callout-more').click();
  await page.locator('#infoSidebar').waitFor({state:'visible',timeout:5000});
  await page.waitForTimeout(330);
  const sheetBounds = await page.locator('#infoSidebar').boundingBox();
  assert(sheetBounds && sheetBounds.y + sheetBounds.height <= 846,
    'Het hele onderpaneel moet binnen het mobiele scherm staan');
  await page.screenshot({path:'test-results/anatomie-uitleg-mobiel.png'});
  assert.equal(await page.locator('.callout-more').getAttribute('aria-expanded'),'true',
    'De knop bij het onderdeel moet tonen dat de uitleg open is');
  const mobilePanel = await page.evaluate(() => {
    const panel = document.getElementById('infoSidebar').getBoundingClientRect();
    const canvas = document.getElementById('threeCanvas');
    return {height:panel.height,viewport:window.innerHeight,canvasActive:getComputedStyle(canvas).pointerEvents !== 'none'};
  });
  assert(mobilePanel.height < mobilePanel.viewport * .40,
    'Informatiepaneel bedekt te veel van het lichaam op mobiel');
  const safety=await page.evaluate(() => ({
    selected:document.querySelector('#structureInfo .structure-title')?.textContent,
    callout:document.querySelector('.callout-layer.is-visible .callout')?.getBoundingClientRect().toJSON(),
    sheet:document.getElementById('infoSidebar').getBoundingClientRect().toJSON()
  }));
  assert(safety.callout && safety.callout.bottom < safety.sheet.top + 12,
    'Het naamlabel mag niet achter het informatiepaneel verdwijnen');
  assert(mobilePanel.canvasActive,'Het 3D-model moet met geopende uitleg bestuurbaar blijven');
  assert.match(await page.locator('#structureInfo').innerText(),/Dijbeen|femur/i,
    'De gekozen structuur heeft geen anatomische toelichting');
  assert.equal(await page.locator('[data-callout="isolate"]').count(),0,
    'Contextuele acties staan dubbel in het model');
  const detailDebug = await page.evaluate(() => ({
    classes: [...document.querySelectorAll('#structureInfo > *')].map(el => el.className),
    excerpt: document.getElementById('structureInfo')?.innerText.slice(-320)
  }));
  console.log('DETAIL_PANEL_DEBUG', JSON.stringify(detailDebug), 'PAGE_ERRORS', JSON.stringify(errors));
  assert.equal(await page.locator('#structureInfo .eai-detail-actions').count(),1,
    'De selectie heeft niet exact een contextmenu');
  await page.locator('#infoToggle').click();
  await page.locator('#infoSidebar').waitFor({state:'hidden',timeout:5000});
  assert(!(await page.locator('#app').evaluate(el=>el.classList.contains('info-open'))),
    'Het informatiepaneel blijft in de geopende toestand staan');
  assert(await page.locator('.callout-layer.is-visible .callout').isVisible(),
    'Sluiten van de uitleg mag de selectie en naamlabel niet wissen');
  assert.equal(await page.locator('.callout-more').getAttribute('aria-expanded'),'false',
    'Informatieknop moet terug naar ingeklapte stand');
  // Ook zonder handmatig geschreven uitleg moet een bestaande Nederlandse
  // zoekterm de juiste structuur en originele anatomische bron openen.
  await page.locator('#searchOpen').click();
  await page.locator('#searchInput').fill('kuitbeen');
  const fibula = page.locator('#searchResults .search-result-item[data-part^="Fibula"]').first();
  await fibula.waitFor({state:'visible',timeout:12000});
  assert.match(await fibula.innerText(),/Kuitbeen/, 'Ook de zoeklijst moet de bekende Nederlandse naam tonen');
  await fibula.click();
  await page.waitForFunction(
    () => document.querySelector('#structureInfo .structure-title h3')?.textContent?.includes('Kuitbeen'),
    null, {timeout:15000}
  );
  assert.equal(await page.locator('#structureInfo .eai-facts-unverified').count(),1,
    'Nog niet beschreven anatomische onderdelen mogen geen verzonnen functie tonen');
  // De nieuwe selectie opent geen groot paneel. De gebruiker opent de uitleg zelf.
  assert(await page.locator('#infoSidebar').isHidden(), 'Na een nieuwe selectie blijft de uitleg gesloten');
  await page.locator('#infoOpen').click();
  await page.locator('#infoSidebar').waitFor({state:'visible',timeout:6000});
  assert.equal(await page.locator('.callout-more').getAttribute('aria-expanded'),'true');
  // Ook met open uitleg een ander onderdeel kiezen: de tekst volgt de selectie.
  await page.locator('#searchOpen').click();
  await page.locator('#searchInput').fill('scheenbeen');
  const tibia = page.locator('#searchResults .search-result-item[data-part^="Tibia"]').first();
  await tibia.waitFor({state:'visible',timeout:12000});
  await tibia.click();
  await page.waitForFunction(() => document.querySelector('#structureInfo .structure-title h3')?.textContent?.includes('Scheenbeen'),null,{timeout:10000});
  assert(await page.locator('#app').evaluate(el=>el.classList.contains('info-open')),
    'De uitleg moet open blijven bij een volgende selectie');
  assert(await page.locator('.callout-layer.is-visible .callout').isVisible(),
    'Ook de nieuwe selectie houdt zijn naamlabel');
  assert.equal(await page.locator('#structureInfo .eai-source-description').count(),1,
    'De bestaande Engelstalige beschrijving moet bij onbekende uitleg toegankelijk blijven');
  await page.locator('#infoToggle').click();
  await page.locator('#infoSidebar').waitFor({state:'hidden',timeout:5000});
  // De stelsels blijven via het bestaande filter te kiezen, zonder extra
  // lagenpaneel over het model.
  await page.locator('#systemsOpen').click();
  await page.locator('[data-system-checkbox="muscular"]').check();
  await page.waitForFunction(() => {
    let count=0;
    window.ZAnatomy.viewer.scene.traverse(n => {if(n.isMesh && n.userData.eaiMuscleMesh)count++});
    return count>130;
  }, null, {timeout:40000});
  assert.equal(await page.locator('.depth-control').count(),0,
    'Ook bij meerdere stelsels mag geen lagenkaart verschijnen');
  await page.locator('[data-system-checkbox="skeletal"]').uncheck();
  await page.locator('#systemsToggle').click();
  assert.equal(await page.locator('[data-system-checkbox="muscular"]').isChecked(),true);
  assert.equal(await page.locator('[data-system-checkbox="skeletal"]').isChecked(),false);
  assert.equal(await page.locator('#app.systems-open').count(),0,
    'De stelselkeuze moet afsluitbaar blijven');

  const muscleReport = await page.evaluate(() => {
    const total = {red:0,notRed:0,transparent:0,neutral:0,covered:0,neutralExamples:[]};
    window.ZAnatomy?.viewer?.scene?.traverse(node => {
      if (!node.isMesh || !node.visible) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (node.userData.eaiMuscleMesh) {
        total.red++;
        if (!materials.every(mat => mat?.color && mat.color.r > mat.color.g * 1.28 &&
          mat.color.r > mat.color.b * 1.18)) total.notRed++;
        if (materials.some(mat => mat.transparent || mat.opacity < .99)) total.transparent++;
      } else if (node.userData.baseMaterial && node.parent) {
        total.neutral++;
        if (materials.some(mat => mat.transparent && mat.opacity < .08)) total.covered++;
        if (total.neutralExamples.length < 14) total.neutralExamples.push({
          name: node.name, partId: node.userData.partId || node.parent?.userData?.partId || '',
          system: node.userData.system || node.parent?.userData?.system || '',
          mat: materials.map(mat => ({name:mat.name,opacity:mat.opacity,transparent:mat.transparent}))
        });
      }
    });
    return total;
  });
  console.log('SPIERKLEUREN', JSON.stringify(muscleReport));
  assert(muscleReport.red > 130, 'Te weinig echte spieren zichtbaar bij alleen Spieren');
  assert.equal(muscleReport.notRed, 0, 'Een spier heeft nog geen rode materiaalweergave');
  assert.equal(muscleReport.transparent, 0, 'De spierweefsels moeten duidelijk en dekkend zijn');
  // De eerdere controles zoomen op botten. Toon voor deze overzichtsfoto
  // eerst het volledige spierstelsel, anders staat alleen een kuit in beeld.
  // Sluit een eerder geopend stelselmenu en een oude botselectie.
  // De overzichtsfoto toont zo het echte, onbelemmerde spiermodel.
  if (await page.locator('#app').evaluate(el => el.classList.contains('systems-open'))) {
    await page.locator('#systemsToggle').click();
  }
  await page.waitForFunction(() => !document.querySelector('#app')?.classList.contains('systems-open'), null, {timeout:4000});
  const calloutClose = page.locator('[data-callout="close"]').first();
  if (await calloutClose.isVisible()) await calloutClose.click();
  await page.locator('#frontViewBtn').click();
  await page.waitForTimeout(750);
  const viewBar = await page.locator('.viewer-controls').boundingBox();
  const canvasArea = await page.locator('#viewerContainer').boundingBox();
  assert(viewBar && canvasArea && viewBar.width<canvasArea.width*.85,
    'Kijkrichtingen zijn op telefoon niet compact genoeg');
  assert(viewBar.y>=canvasArea.y && viewBar.y+viewBar.height<=canvasArea.y+canvasArea.height+2,
    'De compacte kijkrichtingen moeten binnen het modelvenster blijven');
  assert.equal(await page.locator('.depth-control,.eai-camera-modes').count(),0,
    'Grote bediening mag de anatomie niet meer bedekken');
  const drawerOpen = await page.locator('#app').evaluate(el=>el.classList.contains('systems-open'));
  assert.equal(drawerOpen, false, 'Stelsellijst mag het model op de screenshot niet afdekken');
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/anatomie-spieren-rood.png'});
  assert(muscleReport.covered > 15, 'Fascia krijgt nog geen terughoudende weergave');
    await page.locator('#searchOpen').click();
  await page.locator('#searchInput').fill('grote bilspier');
  const gluteus = page.locator('#searchResults .search-result-item[data-part^="Gluteus maximus muscle"]').first();
  await gluteus.waitFor({state:'visible',timeout:10000});
  await gluteus.click();
  await page.locator('.callout-more').click();
  await page.locator('#structureInfo .eai-detail-actions').waitFor({state:'visible',timeout:10000});
  await page.locator('#infoToggle').click();
  await page.locator('#infoSidebar').waitFor({state:'hidden',timeout:5000});
  assert.equal(await page.locator('.depth-control').count(),0,
    'Ook bij een geselecteerde spier mag geen lagenkaart verschijnen');
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/anatomie-webkit-mobile.png'});
  console.log('WebKit toont het skelet zonder laadspinner in '+elapsed+' ms, '+report.triangles+' driehoeken');
} finally {
  if (browser) await browser.close();
  server.kill();
}
