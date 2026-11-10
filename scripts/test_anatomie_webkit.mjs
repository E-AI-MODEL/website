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
  const mobileDrag=page.locator('#eaiDragMode');
  await mobileDrag.waitFor({state:'visible',timeout:6000});
  const initialTouch=await page.evaluate(()=>window.ZAnatomy.viewer.controls.touches.ONE);
  const twoFinger=await page.evaluate(()=>window.ZAnatomy.viewer.controls.touches.TWO);
  await mobileDrag.click();
  assert.equal(await mobileDrag.getAttribute('aria-pressed'),'true');
  assert.equal(await mobileDrag.innerText(),'Draaien');
  const movedTouch=await page.evaluate(()=>window.ZAnatomy.viewer.controls.touches.ONE);
  assert.notEqual(movedTouch,initialTouch,
    'Met Verplaatsen moet een vinger het model omhoog en omlaag slepen');
  assert.equal(await page.evaluate(()=>window.ZAnatomy.viewer.controls.touches.TWO),twoFinger,
    'De bestaande knijp- en tweevingsbeweging mag niet veranderen');
  await mobileDrag.click();
  assert.equal(await mobileDrag.getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>window.ZAnatomy.viewer.controls.touches.ONE),initialTouch,
    'Bij Draaien moet de eenvingerrotatie terugkomen');
  assert.deepEqual(errors,[],'JavaScript-fouten: '+errors.join('; '));
  assert.deepEqual(failed,[],'Netwerkfouten: '+failed.join('; '));
  // Het scherm bevat maar een stelsel: een diepteschuif zou betekenisloos zijn.
  assert.equal(await page.locator('#eaiExplore').count(),0,'Dubbele stelselkeuze op de viewer');
  assert.equal(await page.locator('#footerBar').count(),0,'Dubbele actiebalk onder het lichaam');
  assert.equal(await page.locator('#infoSidebar').count(),1,'Er is precies een informatiepaneel');
  assert(await page.locator('.depth-control').isHidden(),
    'Diepteschuif bij een enkel stelsel moet verborgen zijn');

  // Gebruik dezelfde zoek- en selectieroute als een bezoeker op iPhone.
  await page.locator('#searchOpen').click();
  await page.locator('#searchInput').fill('femur');
  const choice = page.locator('#searchResults .search-result-item[data-part^="Femur"]').first();
  await choice.waitFor({state:'visible',timeout:12000});
  assert.match(await choice.innerText(),/Dijbeen/,
    'De bestaande Nederlandse modelnaam moet ook in het zoekresultaat staan');
  await choice.click();
  await page.locator('#structureInfo .eai-fact').first().waitFor({state:'attached',timeout:15000});
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
  // Bedieningsproef met echte anatomische modellen: meerdere stelsels
  // vergelijken, daarna binnen één spierstelsel een onderdeel wegnemen.
  await page.locator('#systemsOpen').click();
  await page.locator('[data-system-checkbox="muscular"]').check();
  await page.waitForFunction(() => {
    const control = document.querySelector('.depth-control');
    return control && !control.hidden &&
      control.querySelector('#eaiFocusSystem') &&
      control.textContent.includes('Stelsels vergelijken');
  }, null, {timeout:35000});
  await page.locator('#systemsToggle').click();
  await page.locator('.depth-control [data-depth-step="1"]').click();
  assert.match(await page.locator('.depth-control .eai-step-value').innerText(),/Stap 1 van 4/,
    'Plus verhoogt de vergelijking niet');

  await page.locator('#systemsOpen').click();
  await page.locator('[data-system-checkbox="skeletal"]').uncheck();
  await page.locator('#systemsToggle').click();
  await page.waitForFunction(() => {
    const control = document.querySelector('.depth-control');
    return control && !control.hidden &&
      control.textContent.includes('Ontleden');
  }, null, {timeout:10000});

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
  const positions = await page.evaluate(() => ({
    stage: document.querySelector('#viewerContainer').getBoundingClientRect().toJSON(),
    control: document.querySelector('.depth-control').getBoundingClientRect().toJSON()
  }));
  assert(positions.control.top >= positions.stage.top - 2,
    'Ontleedbediening verdwijnt onder de bovenbalk op mobiel');
  assert(positions.control.bottom < positions.stage.bottom,
    'Ontleedbediening valt buiten het mobiele modelvenster');
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
  await page.locator('.depth-control [data-depth-step="1"]').click();
  assert.match(await page.locator('.depth-control .eai-step-value').innerText(),/1 weggenomen/,
    'Geselecteerde spier is niet weggenomen');
  await page.locator('.depth-control [data-depth-step="-1"]').click();
  assert.match(await page.locator('.depth-control .eai-step-value').innerText(),/0 weggenomen/,
    'Min herstelt de laatst weggenomen spier niet');
  mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/anatomie-webkit-mobile.png'});
  console.log('WebKit toont het skelet zonder laadspinner in '+elapsed+' ms, '+report.triangles+' driehoeken');
} finally {
  if (browser) await browser.close();
  server.kill();
}
