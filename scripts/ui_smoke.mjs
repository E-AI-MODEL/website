// Run after prepare_ui.py. Usage: node scripts/ui_smoke.mjs [site-build]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8765';
const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
const pages = ['/', '/nl/tools/', '/nl/onderwijs/', '/nl/onderzoek/', '/nl/toepassingen/', '/en/', '/en/about/', '/onderwijsin/'];
let browser;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { ready = (await fetch(base)).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert(ready, 'Preview server did not start');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  mkdirSync('test-results', { recursive: true });
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: 'load' });
      const result = await page.evaluate(() => ({
        path: location.pathname, viewport: innerWidth,
        scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
        version: document.body.dataset.uiVersion,
        menuCount: document.querySelectorAll('.eai-site-menu').length,
        oldNavCount: document.querySelectorAll('.eai-links').length,
        h1Size: getComputedStyle(document.querySelector('h1')).fontSize,
        narrowParagraphs: [...document.querySelectorAll('main p')].filter(p => {
          const box = p.getBoundingClientRect(); return box.width > 0 && box.width < 125;
        }).map(p => p.textContent.slice(0, 80))
      }));
      assert(result.version, `${path}: missing UI revision`);
      assert(result.scroll <= result.client + 1, `${path}: horizontal overflow at ${width}`);
      assert.equal(result.menuCount, 1);
      assert.equal(result.oldNavCount, 0);
      assert.deepEqual(result.narrowParagraphs, [], `${path}: cramped text at ${width}`);
      await page.locator('.eai-site-menu>summary').click();
      const panel = await page.locator('.eai-site-menu-panel').boundingBox();
      assert(panel && panel.x >= 0 && panel.x + panel.width <= width, 'Menu offscreen');
      await page.locator('.eai-site-group').nth(1).locator('summary').click();
      await page.locator('.eai-site-group').nth(3).locator('summary').click();
      assert.equal(await page.locator('.eai-site-group[open]').count(), 1, 'Only one theme may be open');
      assert.equal(await page.locator('.eai-site-group').nth(3).locator('a:visible').count(), 3);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.eai-site-menu').getAttribute('open'), null);
      assert(await page.locator('.eai-site-menu>summary').evaluate(e => e === document.activeElement));
      await page.locator('.eai-site-menu>summary').click();
      assert.equal(await page.locator('.eai-site-group[open]').count(), 0, 'Reopening resets themes');
      await page.keyboard.press('Escape');
      if (width === 1440 || width === 390) {
        await page.screenshot({ path: `test-results/${path.replaceAll('/', '_') || 'home'}-${width}.png`, fullPage: true });
      }
      results.push(result);
    }
  }
  await page.goto(base + '/', { waitUntil: 'load' });
  const before = await page.locator('#eai-demo-output').textContent();
  await page.locator('[data-eai-demo="1"]').click();
  assert.notEqual(await page.locator('#eai-demo-output').textContent(), before);
  await page.goto(base + '/nl/tools/', { waitUntil: 'load' });
  assert.equal(await page.locator('.eai-site-language a[lang="en"]').getAttribute('href'), '/en/tools/');
  assert.equal(await page.locator('.eai-site-language a[lang="nl"]').getAttribute('href'), '/nl/tools/');
  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallback = await noJS.newPage();
  await fallback.goto(base + '/', { waitUntil: 'load' });
  await fallback.locator('.eai-site-menu>summary').click();
  await fallback.locator('.eai-site-group').nth(1).locator('summary').click();
  await fallback.locator('.eai-site-group').nth(3).locator('summary').click();
  assert.equal(await fallback.locator('.eai-site-group[open]').count(), 1, 'Native accordion must be exclusive');
  assert.equal(await fallback.locator('.eai-site-group').nth(3).locator('a:visible').count(), 3);
  await noJS.close();
  assert.deepEqual(errors, []);
  writeFileSync('test-results/ui-report.json', JSON.stringify({ results, noJavaScriptMenu: true, demo: true, languageLinks: true, errors }, null, 2));
  console.log(`PASS: ${results.length} page/viewport checks, native no-JS menu, keyboard, demo and language links.`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
