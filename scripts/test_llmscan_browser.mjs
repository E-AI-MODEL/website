// Browser regression for the independently hosted EAI LLMscan.
// Exercises actual search, dossier routing, comparison and research navigation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8799';
const server = spawn('python3', ['-m', 'http.server', '8799', '--bind', '127.0.0.1'], { stdio: 'ignore' });
let browser;
const pages = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base + '/nl/llmscan/')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'LLMscan page did not start');
  browser = await chromium.launch({ headless: true });

  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    pages.push(page);
    const errors = [];
    const broken = [];
    const oldHost = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(base) && response.status() >= 400) {
        broken.push(response.status() + ' ' + response.url());
      }
    });
    page.on('request', request => {
      if (request.url().startsWith('https://eai-llmscan.werkruimte-s-2100.chatgpt.site/')) {
        oldHost.push(request.url());
      }
    });
    await page.goto(base + '/nl/llmscan/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#registry .product-card').length >= 1);
    assert.match(await page.locator('#count').innerText(), /21 dossiers/);
    assert.equal(await page.locator('#registry .product-card').count(), 6);

    await page.locator('#search').fill('Khanmigo');
    await page.waitForFunction(() => document.querySelector('#count')?.textContent.includes('1 dossier'));
    assert(await page.locator('#registry .product-card').first().innerText().then(s => s.includes('Khanmigo')));
    await page.locator('#search').fill('');

    if (width === 1440) {
      await page.locator('#registry .product-card [data-select]').first().click();
      await page.locator('#registry .product-card [data-select]').nth(1).click();
      assert(!(await page.locator('#compare-open').isDisabled()), 'Comparison requires two selected applications');
      await page.locator('#compare-open').click();
      await page.waitForFunction(() => !document.getElementById('page-vergelijk')?.hidden);
      assert((await page.locator('#page-vergelijk table thead th').count()) >= 3, 'Two compared products should appear as columns');
    }

    await page.goto(base + '/nl/llmscan/#dossier/study-mode/overzicht', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('page-dossier')?.hidden);
    assert.match(await page.locator('#dossier-title').innerText(), /ChatGPT Study Mode/);

    await page.goto(base + '/nl/llmscan/onderzoek/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#research-count')?.textContent.includes('7 onderzoeken'));
    await page.locator('#show-tools').click();
    assert.match(await page.locator('#research-count').innerText(), /5 tooldossiers/);
    await page.locator('#research-filter').fill('Snorkl');
    assert.match(await page.locator('#research-count').innerText(), /1 tooldossier/);
    assert(await page.locator('#research-list').innerText().then(s => s.includes('Snorkl')));
    assert.deepEqual(errors, [], 'JavaScript errors in the LLMscan browser');
    assert.deepEqual(broken, [], 'Missing local resources in the independent LLMscan');
    assert.deepEqual(oldHost, [], 'Standalone LLMscan must not fetch imagery from the old Sites host');
    console.log('LLMscan interactive checks passed at ' + width + 'px');
  }
} finally {
  for (const page of pages) await page.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
}
