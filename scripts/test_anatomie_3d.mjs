// Browsercontrole van de zelfgehoste Anatomische Atlas met echte 3D-geometrie.
// Gebruik: node scripts/test_anatomie_3d.mjs site-build
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || 'site-build');
const origin = 'http://127.0.0.1:8798';
const server = spawn('python3', ['-m', 'http.server', '8798', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
let browser;
const screenshots = resolve('test-results');
mkdirSync(screenshots, { recursive: true });

function meshCount() {
  const viewer = window.ZAnatomy?.viewer;
  if (!viewer) return 0;
  let n = 0;
  viewer.scene.traverse(node => { if (node.isMesh && node.visible) n++; });
  return n;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(origin + '/tools/anatomie/')).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 120));
  }
  assert(ready, 'De anatomische route ontbreekt in de gebouwde website');
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });

  for (const width of [1280, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 780 : 900 },
      deviceScaleFactor: 1,
      isMobile: width === 390,
      hasTouch: width === 390
    });
    const page = await context.newPage();
    const errors = [], blocked = [], modelResponses = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const req = route.request().url();
      if (req.startsWith(origin) || req.startsWith('blob:') || req.startsWith('data:')) return route.continue();
      blocked.push(req);
      return route.abort();
    });
    page.on('response', response => {
      if (response.url().includes('/models/') && response.url().endsWith('.glb'))
        modelResponses.push({ url: response.url(), status: response.status() });
    });
    const response = await page.goto(origin + '/tools/anatomie/', { waitUntil: 'domcontentloaded' });
    assert(response?.ok(), 'Het observatorium geeft een HTTP-fout');
    await page.locator('#threeCanvas').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const scene = window.ZAnatomy?.viewer?.scene;
      if (!scene) return false;
      let meshes = 0;
      scene.traverse(n => { if (n.isMesh && n.visible) meshes++; });
      return meshes > 20;
    }, null, { timeout: 40000 });
    await page.waitForTimeout(450);
    let state = await page.evaluate(() => {
      const v = window.ZAnatomy.viewer;
      let meshes = 0, tris = 0;
      v.scene.traverse(n => {
        if (n.isMesh && n.visible) {
          meshes++;
          const geom = n.geometry;
          if (geom) tris += (geom.index?.count || geom.attributes.position?.count || 0) / 3;
        }
      });
      return {
        meshes, triangles: Math.round(tris),
        renderer: !!v.renderer, context: !!v.renderer?.getContext(),
        canvasWidth: v.canvas.width, canvasHeight: v.canvas.height,
        cameraX: v.camera.position.x, cameraZ: v.camera.position.z
      };
    });
    assert(state.context && state.renderer, 'Geen echte WebGL-scène');
    assert(state.meshes > 20 && state.triangles > 2000, 'Model is niet opgebouwd uit anatomische 3D-meshes');
    assert(state.canvasWidth > 300 && state.canvasHeight > 300, '3D-canvas is te klein');

    await page.evaluate(() => document.querySelector('#backViewBtn')?.click());
    await page.waitForTimeout(650);
    const newCamera = await page.evaluate(() => window.ZAnatomy.viewer.camera.position.z);
    assert(Math.abs(newCamera - state.cameraZ) > 0.05, 'Achteraanzicht verandert de camera niet');
    await page.evaluate(() => document.querySelector('#frontViewBtn')?.click());
    await page.waitForTimeout(600);

    // De gebruiker moet ook een tweede, apart gedownload lichaamssysteem openen.
    if (await page.locator('#systemsOpen').isVisible()) {
      await page.locator('#systemsOpen').click();
    }
    await page.evaluate(() => {
      const c = document.querySelector('[data-system-checkbox="visceral"]');
      if (!c) throw new Error('Schakelaar voor organen ontbreekt');
      if (!c.checked) c.click();
    });
    await page.waitForFunction(() => window.ZAnatomy?.viewer?.scene?.children?.some(n =>
      n.type === 'Group' && n.children?.some(c => c.isMesh || c.children?.length)), null, { timeout: 20000 });
    await page.waitForFunction(() => {
      // Organs are lazy-loaded: check their response through the browser, below.
      const input = document.querySelector('[data-system-checkbox="visceral"]');
      return input?.checked && !input?.disabled;
    }, null, { timeout: 20000 });
    for (let i=0; i<65 && !modelResponses.some(r=>r.url.endsWith('/models/visceral.glb') && r.status===200); i++)
      await page.waitForTimeout(300);
    assert(modelResponses.some(r => r.url.endsWith('/models/skeletal.glb') && r.status === 200),
      'Het skeletmodel werd niet lokaal opgehaald');
    assert(modelResponses.some(r => r.url.endsWith('/models/visceral.glb') && r.status === 200),
      'Het orgaanmodel werd niet lokaal opgehaald');
    assert.deepEqual(blocked, [], 'De website vraagt toch externe bestanden op');
    assert.deepEqual(errors, [], 'JavaScript-fouten: ' + errors.join(' | '));
    await page.screenshot({ path: resolve(screenshots, 'anatomie-' + width + '.png') });
    console.log('ANATOMIE_3D_OK', { width, ...state, requestedModels: modelResponses.length });
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
