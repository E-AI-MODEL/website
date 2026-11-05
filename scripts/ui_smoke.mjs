// Run after prepare_ui.py. Usage: node scripts/ui_smoke.mjs [site-build]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8765';
const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
const pages = ['/', '/nl/tools/', '/nl/onderwijs/', '/nl/onderzoek/', '/nl/toepassingen/', '/en/', '/en/about/', '/onderwijsin/', '/tools/wihtml/', '/tools/wihtml/bibliotheek/'];
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
  const expectedHomeCases = ['schoolafspraken', 'dagelijks-werk', 'leren-en-toetsen', 'toepassing-kiezen', 'ai-begrijpen'];
  const homeChoices = page.locator('[data-eh-explorer] .eh-choice');
  assert.equal(await homeChoices.count(), expectedHomeCases.length, 'Five homepage entry points');
  for (let i = 0; i < expectedHomeCases.length; i++) {
    await homeChoices.nth(i).click();
    assert.equal(await page.locator('[data-eh-explorer]').getAttribute('data-active-case'), expectedHomeCases[i]);
  }
  await page.goto(base + '/nl/tools/', { waitUntil: 'load' });
  assert.equal(await page.locator('.eai-site-language a[lang="en"]').getAttribute('href'), '/en/tools/');
  assert.equal(await page.locator('.eai-site-language a[lang="nl"]').getAttribute('href'), '/nl/tools/');
  // WiHTML: de docent volgt één scherm tegelijk, van lesgegevens tot de volledige HTML.
  const wiContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const wiPage = await wiContext.newPage();
  const wiErrors = [];
  wiPage.on('pageerror', error => wiErrors.push(error.message));
  await wiPage.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await wiPage.goto(base + '/tools/wihtml/bibliotheek/', { waitUntil: 'load' });
  assert.equal(await wiPage.locator('.wi-card').count(), 4, 'Bibliotheek bevat vier voorbeelden');
  await wiPage.locator('#wi-level').selectOption('3h');
  assert.equal(await wiPage.locator('.wi-card:visible').count(), 1, 'Leerjaarfilter werkt');
  await wiPage.locator('#wi-level').selectOption('all');
  await wiPage.locator('#wi-topic').selectOption('kansen');
  assert.equal(await wiPage.locator('.wi-card:visible').count(), 1, 'Onderwerpfilter werkt');
  await wiPage.goto(base + '/tools/wihtml/studio/', { waitUntil: 'load' });
  await wiPage.locator('#startDialog').waitFor({ state: 'visible' });
  await wiPage.locator('#startNew').click();
  assert(await wiPage.locator('#guideFlow').isVisible(), 'Begeleide lesmaker is zichtbaar');
  assert(await wiPage.locator('#guideInfo').isVisible(), 'Lesgegevens komen eerst');
  assert.equal(await wiPage.locator('#modeQuick').getAttribute('aria-pressed'), 'true', 'Snel is standaard');
  assert.equal(await wiPage.locator('.rail').isVisible(), false, 'Lang lesoverzicht is verborgen');
  await wiPage.locator('#guideTitle').fill('Mijn eerste begeleide les');
  await wiPage.locator('#guideLevel').fill('3 havo');
  await wiPage.locator('#guideGoal').fill('Ik kan de stappen uitleggen.');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideSlide').isVisible(), 'De volgende stap toont alleen een dia');
  const firstTitle = wiPage.locator('#designCanvas [data-design-edit="title"]').first();
  await firstTitle.fill('Eigen eerste dia');
  await wiPage.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('wihtml:docentstudio:concept:v1') || '{}');
    return saved.lesson?.slides?.[0]?.title === 'Eigen eerste dia' &&
           saved.lesson?.title === 'Mijn eerste begeleide les';
  });
  await wiPage.reload({ waitUntil: 'load' });
  await wiPage.locator('#startDialog').waitFor({ state: 'visible' });
  assert(await wiPage.locator('#startRestore').isVisible(), 'Lokaal concept kan worden hersteld');
  wiPage.once('dialog', dialog => dialog.accept());
  await wiPage.locator('#startRestore').click();
  assert(await wiPage.locator('#guideInfo').isVisible(), 'Herstel begint bij lesgegevens');
  assert.equal(await wiPage.locator('#guideTitle').inputValue(), 'Mijn eerste begeleide les');
  await wiPage.locator('#guideNext').click();
  assert.equal(await wiPage.locator('#designCanvas [data-design-edit="title"]').first().innerText(), 'Eigen eerste dia');
  await wiPage.locator('#guideAddSlide').click();
  await wiPage.locator('#quickInsertDialog').waitFor({ state: 'visible' });
  await wiPage.locator('#quickInsertDialog [data-quick-type="question"]').click();
  assert.equal(await wiPage.locator('#items .slide-item').count(), 2, 'Toevoegen maakt een tweede dia');
  assert.equal(await wiPage.locator('#designType').inputValue(), 'question', 'Gekozen werkvorm is actief');
  assert(await wiPage.locator('#guideSlide').isVisible(), 'Nieuwe dia wordt direct getoond');
  await wiPage.locator('#modeStudio').click();
  assert.equal(await wiPage.locator('#modeStudio').getAttribute('aria-pressed'), 'true', 'Studio actief');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideNotes').isVisible(), 'Studio vraagt daarna naar leerling en docent');
  await wiPage.locator('#guideStudent').fill('Leerlingen bespreken eerst hun antwoord.');
  await wiPage.locator('#guideTeacher').fill('De docent toont de uitwerking na het stemmen.');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideDesign').isVisible(), 'Vormgeving is een eigen scherm');
  await wiPage.locator('[data-guide-theme="board"]').click();
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideTools').isVisible(), 'Studio toont tools als aparte stap');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideReview').isVisible(), 'Een aparte controle voor het resultaat');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideResult').isVisible(), 'Eindscherm voor de HTML-les');
  assert(await wiPage.locator('#guideResult').innerText().then(t => t.includes('Je HTML-les is klaar')));
  await wiPage.locator('#guidePrevious').click();
  assert(await wiPage.locator('#guideReview').isVisible(), 'Vorige stap werkt');
  await wiPage.locator('#guideNext').click();
  await wiPage.locator('#guideResultPreview').click();
  await wiPage.locator('#viewer.show').waitFor({ state: 'visible' });
  await wiPage.locator('#close').click();
  const [exported] = await Promise.all([wiPage.waitForEvent('download'), wiPage.locator('#guideDownloadHTML').click()]);
  assert(exported.suggestedFilename().endsWith('.html'), 'WiHTML downloadt zelfstandige HTML');
  const exportFile = resolve('test-results/wihtml-library-export.html');
  await exported.saveAs(exportFile);
  const exportPage = await wiContext.newPage();
  await exportPage.goto('file://' + exportFile, { waitUntil: 'load' });
  await exportPage.locator('#viewer.show').waitFor({ state: 'visible' });
  assert.equal(await exportPage.locator('#startDialog').evaluate(el => el.open), false, 'Export opent geen bewerkdialoog');
  assert.equal(await exportPage.locator('#guideFlow').isVisible(), false, 'Export toont geen lesmaker');
  await exportPage.close();
  await wiPage.goto(base + '/tools/wihtml/studio/?lesson=lineair', { waitUntil: 'load' });
  await wiPage.locator('#startDialog').waitFor({ state: 'visible' });
  await wiPage.locator('#startSelectedLesson').click();
  await wiPage.waitForFunction(() => document.getElementById('title')?.value?.startsWith('Lineaire verbanden'));
  assert.equal(await wiPage.locator('#items .slide-item').count(), 5, 'Bibliotheekles heeft vijf dia’s');
  assert(await wiPage.locator('#guideInfo').isVisible(), 'Bibliotheekles opent ook bij de eerste stap');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#designCanvas').isVisible(), 'Bibliotheekdia kan worden bewerkt');
  await wiPage.setViewportSize({ width: 390, height: 844 });
  const wiMobile = await wiPage.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  assert(wiMobile.scroll <= wiMobile.width + 1, 'Lesmaker scrollt mobiel niet horizontaal buiten beeld');
  assert.deepEqual(wiErrors, [], 'WiHTML heeft geen browserfouten');
  await wiContext.close();
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
  writeFileSync('test-results/ui-report.json', JSON.stringify({ results, noJavaScriptMenu: true, homeQuestions: true, languageLinks: true, errors }, null, 2));
  console.log(`PASS: ${results.length} page/viewport checks, native no-JS menu, keyboard, homepage questions and language links.`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
