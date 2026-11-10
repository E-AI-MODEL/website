// Test the published, self-hosted anatomical 3D model in a real browser.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8798';
const server = spawn('python3', ['-m', 'http.server', '8798', '--bind', '127.0.0.1', '--directory', root], {stdio:'ignore'});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base + '/tools/anatomie/')).ok; } catch {}
    if (ready) break;
    await new Promise(ok => setTimeout(ok, 100));
  }
  assert(ready, 'De anatomische atlas ontbreekt in de sitebuild');
  browser = await chromium.launch({
    headless:true,
    args:['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
  });
  mkdirSync('test-results', {recursive:true});
  for (const [width,height] of [[1440,900],[390,780]]) {
    const page = await browser.newPage({
      viewport:{width,height},
      deviceScaleFactor:1,
      isMobile:width<600,
      hasTouch:width<600
    });
    const errors = [], remote = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', request => {
      // Draco creates blob: workers in this same document. These are local,
      // in-memory scripts, not external network requests.
      const url=request.url();
      if (!url.startsWith(base) && !url.startsWith('blob:'+base+'/')) {
        remote.push(url);
      }
    });
    const loadStarted = Date.now();
    await page.goto(base + '/tools/anatomie/', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => {
      const app = window.ZAnatomy;
      let count = 0;
      app?.viewer?.scene?.traverse(node => { if (node.isMesh && node.visible) count++; });
      return count > 50;
    }, null, {timeout:60000});
    await page.waitForFunction(
      () => window.__EAI_ANATOMY_UI_READY === true
        && document.querySelectorAll('#systemsList [data-system-checkbox]').length === 7,
      null, {timeout:30000}
    );
    // Een scene met meshes is niet genoeg: de bezoeker moet echt beeld zien.
    // De vorige regressie bleef op de laadspinner hangen ondanks een geslaagde build.
    await page.locator('#loadingOverlay').waitFor({state:'hidden',timeout:7000});
    const startupMs = Date.now() - loadStarted;
    console.log('[anatomie] '+width+' px: skelet zichtbaar in '+startupMs+' ms');
    assert(startupMs < 55000, 'Starten van het skelet duurt te lang ('+startupMs+' ms)');
    await page.waitForTimeout(150);
    const scene = await page.evaluate(() => {
      const viewer=window.ZAnatomy.viewer,canvas=document.querySelector('#threeCanvas');
      let meshes=0;
      viewer.scene.traverse(node => {if(node.isMesh)meshes++;});
      return {
        meshes, triangles:viewer.renderer.info.render.triangles,
        width:canvas.width,height:canvas.height,
        canvasVisible:canvas.getBoundingClientRect().width>100,
        overflow:document.documentElement.scrollWidth-innerWidth,
        camera:viewer.camera.position.toArray(),
        loaded:!!document.querySelector('#systemsList [data-system="skeletal"]')
      };
    });
    assert(scene.meshes > 50, 'Het skelet bevat geen herkenbare 3D-meshes');
    assert(scene.triangles > 100, 'De anatomische weergave tekent geen driehoeken');
    assert(scene.width > 200 && scene.height > 100 && scene.canvasVisible, 'Het 3D-canvas is leeg');
    assert(scene.overflow <= 3, 'Horizontale overloop bij '+width);
    assert(scene.loaded, 'Het skelet ontbreekt in de stelsellijst');
    // Geen zwevende lagenkaart of keuze tussen draaien en verplaatsen.
    assert.equal(await page.locator('#eaiDragMode, #eaiRotateMode, .eai-camera-modes, .depth-control').count(), 0,
      'Modelbediening mag niet als extra panelen over de anatomie liggen');
    if (width === 1440) {
      // Rechtermuis verschuift de camera EN het draaipunt zonder de zoom te veranderen.
      const beforePan = await page.evaluate(() => {
        const {camera,controls} = window.ZAnatomy.viewer;
        return {target:controls.target.toArray(), position:camera.position.toArray(),
          distance:camera.position.distanceTo(controls.target)};
      });
      const canvasBox = await page.locator('#threeCanvas').boundingBox();
      await page.mouse.move(canvasBox.x+canvasBox.width*.48, canvasBox.y+canvasBox.height*.44);
      await page.mouse.down({button:'right'});
      await page.mouse.move(canvasBox.x+canvasBox.width*.48,
        canvasBox.y+canvasBox.height*.44+105,{steps:14});
      await page.mouse.up({button:'right'});
      await page.waitForTimeout(450);
      const afterPan = await page.evaluate(() => {
        const {camera,controls} = window.ZAnatomy.viewer;
        return {target:controls.target.toArray(),position:camera.position.toArray(),
          distance:camera.position.distanceTo(controls.target)};
      });
      assert(Math.abs(afterPan.target[1]-beforePan.target[1])>.035,
        'Rechtermuisknop moet het lichaam kunnen verschuiven');
      assert(Math.abs(afterPan.position[1]-beforePan.position[1])>.035,
        'Bij verplaatsen moet de camera meeschuiven');
      assert(Math.abs(afterPan.distance-beforePan.distance)<.04,
        'Verplaatsen mag de zoomafstand niet wijzigen');
      await page.locator('#frontViewBtn').click();
      await page.waitForTimeout(650);
      const beforeKeyboard = await page.evaluate(() => window.ZAnatomy.viewer.controls.target.y);
      await page.locator('#threeCanvas').focus();
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await page.waitForTimeout(150);
      const afterKeyboard = await page.evaluate(() => window.ZAnatomy.viewer.controls.target.y);
      assert(afterKeyboard < beforeKeyboard-.015,
        'Shift met pijl omhoog moet het model verplaatsen');
      await page.locator('#frontViewBtn').click();
      await page.waitForTimeout(650);
    }
    // De standaardzoom gebruikt voortaan de plaats onder de muis. De
    // verandering van het draaipunt is een echte camerameting, geen UI-label.
    const zoomControls = await page.evaluate(() => {
      const c = window.ZAnatomy.viewer.controls;
      return {zoomToCursor:c.zoomToCursor,pan:c.enablePan,zoom:c.enableZoom,
        twoFingerGesture:c.touches.TWO};
    });
    assert.equal(zoomControls.zoomToCursor, true,
      'Scrollen en knijpen moeten naar de aangewezen plek zoomen');
    assert(zoomControls.pan && zoomControls.zoom,
      'Verslepen en zoomen mogen niet uitgeschakeld worden');
    assert.equal(typeof zoomControls.twoFingerGesture,'number',
      'De bestaande tweevingsbediening moet ingesteld blijven');

    if (width === 390) {
      // Twee echte, gelijktijdige aanraakpunten via Chromium's invoersysteem.
      // Geen controle van alleen een OrbitControls-instelling.
      const session = await page.context().newCDPSession(page);
      const area = await page.locator('#threeCanvas').boundingBox();
      const x = Math.round(area.x + area.width * .53);
      const y = Math.round(area.y + area.height * .47);
      const state = () => page.evaluate(() => {
        const {camera,controls} = window.ZAnatomy.viewer;
        return {target:controls.target.toArray(),
          distance:camera.position.distanceTo(controls.target)};
      });
      const start = await state();
      const send = (type,points) => session.send('Input.dispatchTouchEvent',{
        type,touchPoints:points.map(([id,px,py])=>({id,x:px,y:py}))
      });
      await send('touchStart',[[1,x-36,y],[2,x+36,y]]);
      for(let i=1;i<=12;i++){
        await send('touchMove',[[1,x-36,y+i*6],[2,x+36,y+i*6]]);
        await page.waitForTimeout(12);
      }
      await send('touchEnd',[]);
      await page.waitForTimeout(350);
      const moved = await state();
      const delta = Math.hypot(...moved.target.map((n,i)=>n-start.target[i]));
      assert(delta > .035, 'Twee vingers moeten het lichaam echt kunnen verschuiven');
      assert(Math.abs(moved.distance-start.distance)<.055,
        'Twee vingers parallel bewegen mag niet in- of uitzoomen');

      const beforePinch = await state();
      await send('touchStart',[[3,x-34,y],[4,x+34,y]]);
      for(let i=1;i<=10;i++){
        await send('touchMove',[[3,x-34-i*5,y],[4,x+34+i*5,y]]);
        await page.waitForTimeout(12);
      }
      await send('touchEnd',[]);
      await page.waitForTimeout(350);
      const afterPinch = await state();
      assert(Math.abs(afterPinch.distance-beforePinch.distance)>.04,
        'Knijpen met twee vingers moet de zoomafstand echt veranderen');
      await session.detach();
      await page.locator('#frontViewBtn').click();
      await page.waitForTimeout(650);
    }

    if (width === 1440) {
      const beforeZoom=await page.evaluate(() => {
        const {camera,controls}=window.ZAnatomy.viewer;
        return {position:camera.position.toArray(),target:controls.target.toArray(),
          distance:camera.position.distanceTo(controls.target)};
      });
      const wheelCanvas=await page.locator('#threeCanvas').boundingBox();
      await page.mouse.move(wheelCanvas.x+wheelCanvas.width*.61,
        wheelCanvas.y+wheelCanvas.height*.47);
      await page.mouse.wheel(0,-440);
      await page.waitForTimeout(450);
      const zoomed=await page.evaluate(() => {
        const {camera,controls}=window.ZAnatomy.viewer;
        return {position:camera.position.toArray(),target:controls.target.toArray(),
          distance:camera.position.distanceTo(controls.target)};
      });
      assert(zoomed.distance < beforeZoom.distance*.95,
        'De muiswielbeweging brengt de camera niet dichter bij het model');
      assert(Math.hypot(...zoomed.target.map((v,i)=>v-beforeZoom.target[i]))>.002,
        'Zoomen houdt nog steeds hetzelfde vaste draaipunt');
      assert(zoomed.target[0]>beforeZoom.target[0]+.001,
        'Het draaipunt volgt niet de rechts van het midden aangewezen plek');

      await page.locator('#frontViewBtn').click();
      await page.waitForTimeout(850);
      const restored=await page.evaluate(() => {
        const {camera,controls}=window.ZAnatomy.viewer;
        return {target:controls.target.toArray(),
          distance:camera.position.distanceTo(controls.target)};
      });
      assert(restored.distance>zoomed.distance*1.1,
        'Voor moet de anatomie weer op een normale afstand tonen');
      assert(Math.hypot(...restored.target.map((v,i)=>v-beforeZoom.target[i]))<.08,
        'Voor moet de standaardfocus herstellen na zoomen naar de muis');
    }
    const shell = await page.evaluate(() => ({
      viewerWidth: document.querySelector('#viewerContainer').getBoundingClientRect().width,
      viewportWidth: innerWidth,
      hasLegacyLanguageMenu: !!document.querySelector('#langSelect'),
      systemsClosed: document.querySelector('#systemsOpen')?.getAttribute('aria-expanded'),
      helpHidden: document.querySelector('#helpModal')?.classList.contains('hidden')
    }));
    assert(shell.viewerWidth >= shell.viewportWidth - 4, '3D-model gebruikt niet de volle schermbreedte');
    assert(!shell.hasLegacyLanguageMenu, 'Oude EN/IT-taalkeuze is nog zichtbaar');
    assert.equal(shell.systemsClosed, 'false', 'Stelselpaneel staat niet standaard gesloten');
    assert(shell.helpHidden, 'Hulptekst staat ongevraagd open');
    const layout = await page.evaluate(() => {
      const box=el => {const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {
        viewport:innerWidth,
        stage:box(document.querySelector('#viewerContainer')),
        controls:[...document.querySelectorAll('#viewerControls .control-btn')].map(box),
        attribution:box(document.querySelector('.eai-attribution'))
      };
    });
    assert.equal(layout.controls.length, 5, 'Vijf cameraknoppen moeten beschikbaar zijn');
    if(width<=720) for(const [i,c] of layout.controls.entries()) {
      assert(c.width>=42 && c.height>=42, 'Cameraknop '+i+' heeft een te klein aanraakvlak');
    }
    for(const [i,c] of layout.controls.entries()){
      assert(c.width>20&&c.height>=25, 'Cameraknop '+i+' is te klein');
      assert(c.left>=layout.stage.left-2&&c.right<=layout.stage.right+2,
        'Cameraknop '+i+' valt buiten het modelvenster');
      assert(c.bottom<=layout.stage.bottom+2, 'Cameraknop '+i+' valt onder het modelvenster');
      const x=Math.min(c.right,layout.attribution.right)-Math.max(c.left,layout.attribution.left);
      const y=Math.min(c.bottom,layout.attribution.bottom)-Math.max(c.top,layout.attribution.top);
      assert(x<=0||y<=0, 'Bronvermelding bedekt cameraknop '+i);
    }
    assert((await page.title()).includes('Anatomisch Observatorium'));
    assert.equal(await page.locator('#resetBtn').innerText(),'In beeld',
      'De cameraknop moet duidelijk van Onderdelen herstellen verschillen');
    await page.screenshot({path:'test-results/anatomie-start-'+width+'.png'});
    assert.equal(await page.locator('#eaiExplore').count(),0,'Dubbele stelselkeuze mag niet bestaan');
    assert.equal(await page.locator('.depth-control').count(),0,
      'De lagenkaart mag niet meer worden aangemaakt');
    if(width<600) await page.locator('#searchOpen').click();
    await page.locator('#searchInput').fill('dijbeen');
    await page.locator('#searchResults .search-result-item').first().waitFor({state:'visible'});
    const femurRow=page.locator('#searchResults .search-result-item[data-part^="Femur"]').first();
    await femurRow.waitFor({state:'visible'});
    const cameraBeforeSearch=await page.evaluate(() => window.ZAnatomy.viewer.controls.target.toArray());
    await femurRow.click();
    await page.locator('#structureInfo .eai-fact').first().waitFor({state:'attached',timeout:15000});
    await page.waitForTimeout(720);
    const cameraAfterSearch=await page.evaluate(() => window.ZAnatomy.viewer.controls.target.toArray());
    assert(Math.hypot(...cameraAfterSearch.map((x,i)=>x-cameraBeforeSearch[i]))>.12,
      'Een zoekresultaat moet de camera naar het gekozen bot verplaatsen');
    assert.equal(await page.locator('#app.info-open').count(),0,
      'De toelichting mag niet automatisch openen bij selectie');
    assert(await page.locator('.callout-layer.is-visible .callout').isVisible(),
      'Het naamlabel met de verbindingslijn blijft zichtbaar');
    await page.screenshot({path:'test-results/anatomie-naamlabel-'+width+'.png'});
    await page.locator('.callout-more').click();
    await page.locator('#infoSidebar').waitFor({state:'visible',timeout:7000});
    // Een zichtbare drawer kan nog bezig zijn met zijn CSS-overgang.
    // Controleer de echte positie ná de animatie, niet op een vaste frame.
    try {
      await page.waitForFunction(() => {
        const rect=document.getElementById('infoSidebar')?.getBoundingClientRect();
        return rect && rect.left>=-2 && rect.right<=innerWidth+2
          && rect.top>=-2 && rect.bottom<=innerHeight+2;
      },null,{timeout:7000});
    } catch (error) {
      const position = await page.evaluate(() => ({
        viewport:{width:innerWidth,height:innerHeight},
        sidebar:document.getElementById('infoSidebar')?.getBoundingClientRect().toJSON(),
        style:getComputedStyle(document.getElementById('infoSidebar')).transform
      }));
      console.log('INFO_PANEEL_BUITEN_BEELD',JSON.stringify(position));
      throw error;
    }
    const infoSize=await page.locator('#infoSidebar').boundingBox();
    console.log('INFO_PANEEL_POSITIE',JSON.stringify({viewport:width+'x'+height,rect:infoSize}));
    assert(infoSize && (width>720 ? infoSize.width<=345 : infoSize.height<=height*.40),
      'De uitleg moet compact blijven op desktop en telefoon');
    assert(infoSize.x>=-2 && infoSize.x + infoSize.width <= width+2,
      'Het informatiepaneel moet volledig binnen de schermbreedte staan');
    assert(infoSize.y>=-2 && infoSize.y + infoSize.height <= height+2,
      'Het informatiepaneel moet volledig binnen de schermhoogte staan');
    await page.screenshot({path:'test-results/anatomie-uitleg-'+width+'.png'});
    if(width===1440){
      const rect=await page.locator('#threeCanvas').boundingBox();
      const cameraBefore=await page.evaluate(()=>window.ZAnatomy.viewer.camera.position.toArray());
      await page.mouse.move(rect.x+rect.width*.42,rect.y+rect.height*.44);
      await page.mouse.down();
      await page.mouse.move(rect.x+rect.width*.54,rect.y+rect.height*.42,{steps:12});
      await page.mouse.up();
      await page.waitForTimeout(250);
      const cameraAfter=await page.evaluate(()=>window.ZAnatomy.viewer.camera.position.toArray());
      assert(cameraAfter.some((n,i)=>Math.abs(n-cameraBefore[i])>.005),
        'Het 3D-model moet blijven draaien terwijl uitleg openstaat');
      assert(await page.locator('#app.info-open').count(),'Draaien mag de uitleg niet sluiten');
    }
    const explanation=await page.locator('#structureInfo').textContent();
    assert(/functie/i.test(explanation),'Specifieke anatomische functie ontbreekt: '+explanation.slice(0,180));
    assert(explanation.includes('Dijbeen'),'Nederlandse naam ontbreekt');
    assert.equal(await page.locator('.callout [data-callout="isolate"]').count(),0,
      'Dubbele zwevende actiemenu\'s mogen niet bestaan');
    assert.equal(await page.locator('#footerBar').isVisible(),false,
      'Dubbele onderste actiebalk moet verdwenen zijn');
    await page.locator('#infoToggle').click();
    assert.equal(await page.locator('#app.info-open').count(),0);
    assert(await page.locator('.callout-layer.is-visible .callout').isVisible(),
      'Inklappen van de uitleg mag de selectie niet wissen');
    await page.locator('body').press('Escape');

    if (width === 1440) {
      const rect = await page.locator('#threeCanvas').boundingBox();
      assert(rect, 'Canvas ontbreekt');
      await page.mouse.move(rect.x+rect.width*.45, rect.y+rect.height*.52);
      await page.mouse.down();
      await page.mouse.move(rect.x+rect.width*.60, rect.y+rect.height*.49,{steps:12});
      await page.mouse.up();
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => window.ZAnatomy.viewer.camera.position.toArray());
      assert(after.some((n,i)=>Math.abs(n-scene.camera[i])>.005),'Slepen draait de anatomie niet');
      await page.locator('#systemsOpen').click();
      await page.waitForFunction(
        () => document.querySelector('#app')?.classList.contains('systems-open')
          && getComputedStyle(document.querySelector('#systemsSidebar')).visibility === 'visible',
        null, {timeout:7000}
      );
      const cb = page.locator('[data-system-checkbox="visceral"]');
      await cb.waitFor({state:'attached'});
      await cb.check();
      await page.waitForFunction(initial => {
        let count=0;
        window.ZAnatomy.viewer.scene.traverse(n=>{if(n.isMesh)count++});
        return count>initial+20;
      }, scene.meshes, {timeout:45000});
      await page.screenshot({path:'test-results/anatomie-met-organen.png'});
      // In beeld mag nooit het ontleden of verbergen ongedaan maken.
      await page.locator('#systemsOpen').click();
      // Op desktop is het zoekveld zichtbaar; de zoekknop is alleen mobiel.
      await page.locator('#searchInput').fill('dijbeen');
      const hideRow=page.locator('#searchResults .search-result-item[data-part^="Femur"]').first();
      await hideRow.waitFor({state:'visible',timeout:10000});
      const hideId=await hideRow.getAttribute('data-part');
      await hideRow.click();
      await page.locator('.callout-more').click();
      const hideButton=page.locator('#structureInfo .eai-detail-actions button')
        .filter({hasText:'Verberg dit onderdeel'});
      await hideButton.waitFor({state:'visible'});
      await hideButton.click();
      const isHidden=async()=>page.evaluate(id=>{
        let count=0, hidden=0;
        window.ZAnatomy.viewer.scene.traverse(mesh=>{
          if(!mesh.isMesh) return;
          let owner=mesh;
          while(owner && !owner.userData?.partId) owner=owner.parent;
          if(owner?.userData?.partId!==id) return;
          count++;
          if(mesh.visible===false) hidden++;
        });
        // De viewer verbergt de eigen meshes, niet de bovenliggende
        // groep. Anders verdwijnen ook andere anatomische onderdelen.
        return count>0 && hidden===count;
      },hideId);
      assert(await isHidden(),'Verbergen van een bot moet het uit de weergave halen');
      await page.locator('#resetBtn').click();
      await page.waitForTimeout(750);
      assert(await isHidden(),'In beeld mag een weggehaald bot niet herstellen');
    }
    assert.deepEqual(errors, [], 'JavaScript-fouten: '+errors.join('; '));
    assert.deepEqual(remote, [], 'Er worden nog externe assets geladen: '+remote.join('; '));
    await page.close();
  }
  console.log('Anatomische WebGL-weergave, origineel skelet, draaien, organen, mobiel en lokale assets gecontroleerd.');
} finally {
  if(browser) await browser.close();
  server.kill();
}
