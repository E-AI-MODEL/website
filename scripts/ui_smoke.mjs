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
  // WiHTML: van de rustige landingspagina via elke keuze naar een echte offline HTML-les.
  const wiContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const wiPage = await wiContext.newPage();
  const wiErrors = [];
  wiPage.on('pageerror', error => wiErrors.push(error.message));
  await wiPage.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await wiPage.goto(base + '/tools/wihtml/', { waitUntil: 'load' });
  assert.equal(await wiPage.locator('.wi-landing-start a.button').count(), 1, 'Eén duidelijke startknop');
  await wiPage.locator('.wi-landing-start a.button').click();
  await wiPage.locator('#guideFlow').waitFor({state:'visible'});
  assert.equal(await wiPage.locator('#startDialog').evaluate(el => el.open), false, 'Landingspagina opent rechtstreeks de nieuwe les');
  assert.equal(new URL(wiPage.url()).searchParams.has('start'),false,'Een verversing maakt niet opnieuw een lege les');
  assert.equal(await wiPage.locator('#modeQuick').getAttribute('aria-pressed'), 'true', 'Snel is standaard');
  assert.equal(await wiPage.locator('.rail').isVisible(), false, 'Lange editor blijft uit beeld');
  assert(await wiPage.locator('[data-guide-info="title"]').isVisible(), 'Eerst alleen lesnaam');
  assert.equal(await wiPage.locator('[data-guide-info="level"]').isVisible(), false, 'Niveau komt later');
  await wiPage.locator('#guideTitle').fill('Mijn eerste begeleide les');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-info="level"]').isVisible(), 'Niveau heeft eigen scherm');
  await wiPage.locator('#guideLevel').fill('3 havo');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-info="goal"]').isVisible(), 'Leerdoel heeft eigen scherm');
  await wiPage.locator('#guideGoal').fill('Ik kan mijn aanpak uitleggen.');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-info="route"]').isVisible(), 'Lesopbouw heeft eigen scherm');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideWorkform').isVisible(), 'Werkvorm heeft eigen scherm');
  await wiPage.locator('#guideType').selectOption('question');
  assert.equal(await wiPage.locator('#designType').inputValue(), 'question', 'Werkvorm wijzigt de echte les');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideSlide').isVisible(), 'Daarna pas dia bewerken');
  assert.equal(await wiPage.locator('.design-toolbar').isVisible(), false, 'Technische werkbalk blijft uit beeld');
  const firstTitle = wiPage.locator('#designCanvas [data-design-edit="title"]').first();
  await firstTitle.fill('Eigen eerste dia');
  await wiPage.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('wihtml:docentstudio:concept:v1') || '{}');
    return saved.lesson?.slides?.[0]?.title === 'Eigen eerste dia' &&
      saved.lesson?.title === 'Mijn eerste begeleide les';
  });
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-notes="student"]').isVisible(), 'Leerlingactiviteit is ook in Snel zichtbaar');
  await wiPage.locator('#guideStudent').fill('Leerlingen bespreken eerst hun antwoord.');
  await wiPage.locator('#modeStudio').click();
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-notes="teacher"]').isVisible(), 'Docentrol heeft eigen Studio-scherm');
  await wiPage.locator('#guideTeacher').fill('Toon pas na bespreking de uitwerking.');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-notes="layout"]').isVisible(), 'Lesfase en indeling komen later');
  await wiPage.locator('#guidePhase').fill('Onderzoeken');
  await wiPage.locator('#guideLayout').selectOption('equal');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideDesign').isVisible(), 'Vormgeving komt na de lesinhoud');
  await wiPage.locator('[data-guide-theme="board"]').click();
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideTools').isVisible(), 'Docenttools in een eigen Studio-scherm');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideReview').isVisible(), 'Lescontrole is een aparte stap');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideResult').isVisible(), 'Eindscherm verschijnt');
  assert(await wiPage.locator('#guideResult').innerText().then(t=>t.includes('Je HTML-les is klaar')));
  const liveViewer = wiPage.frameLocator('#guideResultFrame').locator('#viewer.show');
  await liveViewer.waitFor({state:'visible',timeout:15000});
  assert(await wiPage.locator('#guideResultFrame').isVisible(), 'De werkende HTML is direct ingebed');
  await wiPage.locator('#guidePrevious').click();
  assert(await wiPage.locator('#guideReview').isVisible(), 'Teruggaan kan zonder gegevensverlies');
  await wiPage.locator('#guideNext').click();
  const [exported] = await Promise.all([wiPage.waitForEvent('download'),wiPage.locator('#guideDownloadHTML').click()]);
  assert(exported.suggestedFilename().endsWith('.html'), 'Zelfstandige HTML wordt gedownload');
  const exportFile=resolve('test-results/wihtml-library-export.html');
  await exported.saveAs(exportFile);
  const exportPage=await wiContext.newPage();
  await exportPage.goto('file://'+exportFile,{waitUntil:'load'});
  await exportPage.locator('#viewer.show').waitFor({state:'visible'});
  assert.equal(await exportPage.locator('#guideFlow').isVisible(),false,'Offline HTML opent alleen als presentatie');
  assert.equal(await exportPage.locator('#startDialog').evaluate(el=>el.open),false,'Startscherm ontbreekt bij presenteren');
  await exportPage.close();
  await wiPage.locator('#guideOtherLesson').click();
  assert(await wiPage.locator('#startBackToLesson').isVisible(), 'Een les kan worden gewisseld');
  await wiPage.locator('#startBackToLesson').click();
  assert(await wiPage.locator('#guideResult').isVisible(), 'Teruggaan bewaart het eindscherm');
  await wiPage.locator('#guideOtherLesson').click();
  await wiPage.locator('#startNew').click();
  assert(await wiPage.locator('[data-guide-info="title"]').isVisible(), 'Nieuwe les begint weer bij eerste vraag');
  assert.equal(await wiPage.locator('#items .slide-item').count(),1,'Nieuwe les bevat één dia');
  await wiPage.locator('#guideTitle').fill('Tweede les');
  await wiPage.locator('#guideNext').click();
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-info="goal"]').isVisible(), 'We staan bij het leerdoel');
  await wiPage.waitForFunction(() => {
    const draft=JSON.parse(localStorage.getItem('wihtml:docentstudio:concept:v1')||'null');
    return draft?.guidePage?.kind==='goal' && draft?.lesson?.title==='Tweede les';
  });
  await wiPage.reload({waitUntil:'load'});
  await wiPage.locator('#startDialog').waitFor({state:'visible'});
  wiPage.once('dialog', dialog=>dialog.accept());
  await wiPage.locator('#startRestore').click();
  assert(await wiPage.locator('[data-guide-info="goal"]').isVisible(), 'Concept hervat op de laatst gebruikte stap');
  assert.equal(await wiPage.locator('#guideTitle').inputValue(),'Tweede les','Lesinhoud bleef behouden');
  await wiPage.locator('#guideOtherLesson').click();
  await wiPage.locator('#startImport').click();
  await wiPage.locator('#import').setInputFiles(resolve('site-build/tools/wihtml/bibliotheek/lineaire-verbanden.json'));
  await wiPage.waitForFunction(() => document.getElementById('title')?.value?.startsWith('Lineaire verbanden'));
  assert.equal(await wiPage.locator('#startDialog').evaluate(el=>el.open),false,'Import sluit startkeuzes');
  assert.equal(await wiPage.locator('#items .slide-item').count(),5,'Alle vijf dia’s blijven bewerkbaar');
  assert(await wiPage.locator('[data-guide-info="title"]').isVisible(),'Import opent bij lesgegevens');
  await wiPage.setViewportSize({width:390,height:844});
  await wiPage.locator('#guideNext').click();
  const wiMobile=await wiPage.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
  assert(wiMobile.scroll<=wiMobile.width+1,'Geen horizontaal scrollen op mobiel');
  assert.deepEqual(wiErrors,[],'WiHTML heeft geen browserfouten');
  const routePage=await wiContext.newPage();
  await routePage.goto(base+'/tools/wihtml/studio/?start=nieuw',{waitUntil:'load'});
  for(let n=0;n<3;n++)await routePage.locator('#guideNext').click();
  await routePage.locator('#guideRoute').selectOption('discover');
  await routePage.locator('#guideNext').click();
  assert.equal(await routePage.locator('#items .slide-item').count(),4,'Onderzoekende route maakt vier startdia’s');
  assert.equal(await routePage.locator('#guideType').inputValue(),'question','Eerste dia is de voorspelling');
  await routePage.close();
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
