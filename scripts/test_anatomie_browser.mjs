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
    await page.screenshot({path:'test-results/anatomie-start-'+width+'.png'});
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
