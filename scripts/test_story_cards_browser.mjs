/* Real-browser checks for the editorial one-card-per-swipe system. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8794';
const server = spawn('python3', ['-m', 'http.server', '8794', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
let browser;
const report = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 65; attempt++) {
    try { ready = (await fetch(base + '/nl/onderzoek/')).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert(ready, 'The built editorial pages must be available');
  browser = await chromium.launch({ headless: true });
  mkdirSync('test-results', { recursive: true });

  for (const width of [320, 390, 768, 1440]) {
    const mobile = width <= 768;
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    for (const path of [
      '/nl/onderzoek/', '/nl/onderwijs/', '/nl/publicaties/',
      '/nl/toepassingen/', '/nl/tools/', '/nl/over/',
      '/en/education/', '/en/about/',
    ]) {
      await page.goto(base + path, { waitUntil: 'load' });
      const track = page.locator('main .eai-card-deck').first();
      await track.waitFor({ timeout: 13000 });
      if (path === '/nl/onderwijs/' || path === '/nl/onderzoek/') {
        const detail = page.locator('main .eai-story-mobile-detail');
        if (width <= 620) {
          assert.equal(await detail.count(), 1, path + ': the detailed hero must be available');
          assert.equal(await detail.getAttribute('open'), null, 'Mobile detail should begin collapsed');
          await detail.locator('summary').click();
          assert.equal(await detail.getAttribute('open'), '', 'Reader can open the detailed explanation');
          await detail.locator('summary').click();
        } else {
          assert.equal(await detail.count(), 0, path + ': desktop keeps the original diagram');
        }
      }
      const data = await track.evaluate(el => {
        const cards = [...el.children];
        const a = cards[0].getBoundingClientRect(), b = cards[1].getBoundingClientRect();
        const viewport = el.getBoundingClientRect();
        return {
          slides: cards.length,
          secondOffscreen: b.left >= viewport.right - 3,
          snap: getComputedStyle(el).scrollSnapType,
          links: cards.reduce((sum, card) => sum + (card.matches('a[href]') ? 1 : card.querySelectorAll('a[href]').length), 0),
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          left: a.left,
        };
      });
      assert(data.slides >= 2, path + ': at least two cards must be selectable');
      assert(data.secondOffscreen, path + ' (' + width + '): only one card must be fully visible');
      assert.match(data.snap, /mandatory/, path + ': cards must snap after a swipe');
      assert(!data.horizontalOverflow, path + ' (' + width + '): horizontal page overflow');
      const bar = page.locator('.eai-card-deck-tools').first();
      const next = bar.locator('button.eai-card-deck-next');
      assert.equal(await bar.locator('output').innerText(), '1 / ' + data.slides);
      assert.equal(await bar.locator('button.eai-card-deck-previous').isDisabled(), true);
      await next.click();
      await page.waitForFunction(() => document.querySelector('.eai-card-deck-tools output')?.textContent?.startsWith('2 /'), null, { timeout: 5500 });
      const position = await track.evaluate(el => el.scrollLeft);
      assert(position > 0, path + ': next card must physically scroll the deck');
      report.push({ path, width, cards: data.slides, position, links: data.links });
    }
    await page.goto(base + '/nl/onderzoek/', { waitUntil: 'load' });
    await page.locator('.eai-story-search-button').click();
    assert.equal(await page.locator('.eai-site-menu').getAttribute('open'), '');
    assert.equal(await page.locator('#eai-site-search-input').evaluate(el => el === document.activeElement), true);
    const rail = await page.locator('.eai-story-rail').evaluate(el => getComputedStyle(el).display);
    assert.equal(rail !== 'none', width === 1440, 'Desktop receives the labelled navigation rail');
    assert.deepEqual(errors, [], 'Unexpected browser errors at ' + width);
    if (width === 390 || width === 1440) {
      await page.goto(base + '/nl/publicaties/', { waitUntil: 'load' });
      await page.screenshot({ path: 'test-results/eai-editorial-' + width + '.png', fullPage: false });
    }
    await page.close();
  }
  const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await fallback.newPage();
  await page.goto(base + '/nl/publicaties/', { waitUntil: 'load' });
  assert.equal(await page.locator('.eai-card-deck').count(), 0, 'Without JavaScript original grids stay intact');
  assert((await page.locator('main .card-grid a[href]').count()) >= 5, 'Articles stay available without JavaScript');
  await fallback.close();

  const protectedPage = await browser.newPage();
  await protectedPage.goto(base + '/tools/science-observatory/labs/natuurkunde/', { waitUntil: 'domcontentloaded' });
  assert.equal(await protectedPage.locator('body.eai-story-page').count(), 0, 'Physics lab must remain untouched');
  assert.equal(await protectedPage.locator('link[href*="site-story-cards"]').count(), 0, 'No editorial CSS in physics');
  assert.equal(await protectedPage.locator('script[src*="site-story-cards"]').count(), 0, 'No editorial JS in physics');
  await protectedPage.close();

  writeFileSync('test-results/eai-editorial-cards.json', JSON.stringify({ report, noJavaScript: true, protectedPhysics: true }, null, 2));
  console.log('PASS: editorial cards, single slide, responsive layout, buttons, search, non-JS and protected physics');
} finally {
  if (browser) await browser.close();
  server.kill();
}