// Run after prepare_ui.py. Usage: node scripts/ui_smoke.mjs [site-build]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2] || 'site-build');
const base = 'http://127.0.0.1:8765';
const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
const pages = ['/', '/nl/blog/', '/nl/blog/wat-ons-werk-ons-werk-maakt/', '/nl/tools/', '/nl/onderwijs/', '/nl/onderzoek/', '/nl/toepassingen/', '/en/', '/en/about/', '/onderwijsin/', '/tools/wihtml/', '/tools/wihtml/bibliotheek/'];
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
      const visibleWidth = await page.evaluate(() => window.visualViewport?.width ?? document.documentElement.clientWidth);
      assert(panel && panel.x >= 0 && panel.x + panel.width <= visibleWidth + 1, `Menu offscreen: ${JSON.stringify({panel, visibleWidth})}`);
      await page.locator('.eai-site-group').nth(1).locator(':scope > summary').click();
      await page.locator('.eai-site-group').nth(3).locator(':scope > summary').click();
      assert.equal(await page.locator('.eai-site-group[open]').count(), 1, 'Only one theme may be open');
      // Compact thematic menu; the full experiment/workform catalog lives in search.
      assert.equal(await page.locator('.eai-site-topic').count(), 0, 'No duplicate model catalogue');
      assert.equal(await page.locator('.eai-site-group').nth(3).locator('a[href="/nl/publicaties/"],a[href="/en/publications/"]').count(), 1);
      await page.locator('.eai-site-group').nth(4).locator(':scope > summary').click();
      assert.equal(await page.locator('.eai-site-group').nth(4).locator('a[href="/nl/tools/"], a[href="/en/tools/"]').count(), 1, 'One entry to the eight subject choices');
      for (const deep of ['/tools/science-observatory/', '/tools/anatomie/', '/tools/eaistudio/', '/tools/wihtml/']) {
        assert.equal(await page.locator('.eai-site-menu-panel a[href="'+deep+'"]').count(), 0, 'Application links live in the subject overview: '+deep);
      }
      assert((await page.locator('.eai-site-menu-panel a[href]').count()) <= 28, 'Keep menu short');
      if (width === 390 && path === '/') {
        assert(!(await page.locator('.eai-site-search').isVisible()), 'Search is not forced into the menu');
        await page.locator('.eai-site-search-trigger').click();
        const search = page.locator('#eai-site-search-input');
        assert(await search.isVisible(), 'Search button reveals search');
        assert(await search.evaluate(el => document.activeElement === el), 'Search is focused');
        await search.fill('hefboom');
        await page.locator('#eai-site-search-results a[href="/tools/science-observatory/labs/natuurkunde/#lever"]').waitFor();
        assert.equal(await page.locator('.eai-site-search-results').count(), 1);
        await search.fill('hartslag');
        await page.locator('#eai-site-search-results a[href="/tools/anatomie/labs/hartslag/"]').waitFor();
        await search.fill('binomiale');
        const binomial = page.locator('#eai-site-search-results a[href="/tools/science-observatory/labs/wiskunde-a/#binom"]');
        await binomial.waitFor();
        assert.match(await binomial.locator('.eai-site-search-hit-description').innerText(), /Verander n, p en k/, 'Zoekresultaat beschrijft wat de proef laat veranderen');
        await search.fill('keuzes verantwoorden');
        const choices = page.locator('#eai-site-search-results a[href="/werkvormen/justification-mapping/"]');
        await choices.waitFor();
        assert.match(await choices.locator('.eai-site-search-hit-description').innerText(), /AI-bijdrage/, 'Zoekresultaat laat de inhoud van de werkvorm zien');
        await search.fill('EAImesh');
        await page.locator('#eai-site-search-results a[href="/tools/eaimesh/"]').waitFor();
        await search.fill('taakdichtheid');
        await page.locator('#eai-site-search-results a[href="/nl/begrippen/#task-density"]').waitFor();
        await search.fill('');
        assert(await page.locator('.eai-site-menu-sections').isVisible(), 'Empty search restores navigation');
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.eai-site-menu').getAttribute('open'), null);
      const expectedFocus = width === 390 && path === '/' ? '.eai-site-search-trigger' : '.eai-site-menu>summary';
      const activeFocus = await page.evaluate(() => ({ tag:document.activeElement?.tagName, label:document.activeElement?.getAttribute('aria-label'), className:document.activeElement?.getAttribute('class'), menuOpen:document.querySelector('.eai-site-menu')?.open, searchHidden:document.querySelector('.eai-site-search')?.hidden }));
      assert(await page.locator(expectedFocus).evaluate(e => e === document.activeElement), `Focus expected ${expectedFocus} at ${path}/${width}: ${JSON.stringify(activeFocus)}`);
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
  // The homepage is editorial now: four direct routes, no exploratory panels.
  const homeRoutes = page.locator('.eai-landing-route');
  assert.equal(await homeRoutes.count(), 4, 'Four clear homepage routes');
  for (const target of ['/nl/model/', '/nl/onderwijs/', '/nl/onderzoek/', '/nl/tools/']) {
    assert.equal(await homeRoutes.locator('a[href="'+target+'"]').count(), 0, 'Routes themselves are anchors, not nested links');
    assert.equal(await page.locator('.eai-landing-route[href="'+target+'"]').count(), 1, target);
  }
  assert.equal(await page.locator('.eai-site-primary a').count(), 5, 'Five desktop links plus the complete menu');
  assert.equal(await page.locator('#eai-blog .eai-reading-feature').count(), 1, 'Blog entry');
  assert.equal(await page.locator('.eh-case-output').count(), 0, 'Old homepage explorer is removed');
  const firstPageText = await page.locator('main').innerText();
  const emojiRanges = new RegExp('[' + String.fromCodePoint(0x1F300) + '-' + String.fromCodePoint(0x1FAFF) + String.fromCodePoint(0x2600) + '-' + String.fromCodePoint(0x27BF) + ']', 'u');
  assert(!emojiRanges.test(firstPageText), 'No emoji in homepage');
  // EAI article diagrams are semantic and usable on small and large screens.
  await page.goto(base + '/nl/blog/wat-ons-werk-ons-werk-maakt/', { waitUntil: 'load' });
  assert.equal(await page.locator('.eai-story-example').count(), 3, 'Three professional examples');
  assert.equal(await page.locator('.eai-story-phase-grid li').count(), 4, 'Four learning moments');
  assert.equal(await page.locator('.eai-story-mail-card').count(), 2, 'Two contrasting mails');
  assert.equal(await page.locator('.eai-story-questions li').count(), 4, 'Four team questions');
  const articleGlyphs = await page.locator('main').innerText();
  assert(!emojiRanges.test(articleGlyphs), 'No emoji in article');
  await page.setViewportSize({ width: 390, height: 844 });
  const storyMeasurements = await page.evaluate(() => {
    const body = document.querySelector('.eai-story-body').getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    return { viewport, scrollWidth:document.documentElement.scrollWidth, left:body.left, right:body.right };
  });
  assert(storyMeasurements.left >= 15 && storyMeasurements.right <= storyMeasurements.viewport - 15, 'Article needs readable side margins on mobile');
  assert(storyMeasurements.scrollWidth <= storyMeasurements.viewport + 1, 'Article must not scroll horizontally');

  await page.goto(base + '/nl/tools/', { waitUntil: 'load' });
  assert.equal(await page.locator('.eai-site-language a[lang="en"]').getAttribute('href'), '/en/tools/');
  assert.equal(await page.locator('.eai-site-language a[lang="nl"]').getAttribute('href'), '/nl/tools/');
  assert.equal(await page.locator('.eai-explore-choice').count(), 8, 'Eight direct subject choices');
  await page.locator('.eai-explore-choice[href="#vak-natuurkunde"]').click();
  assert(await page.locator('#vak-natuurkunde').isVisible(), 'Natuurkunde has its own view');
  assert.equal(await page.locator('#vak-natuurkunde .eai-explore-physics-group a[href^="/tools/science-observatory/labs/natuurkunde/#"]').count(), 53, 'The 53 subjects remain directly accessible');
  assert(!(await page.locator('.eai-explore-choices').isVisible()), 'The overview steps aside for the selected subject');
  await page.locator('#vak-natuurkunde .eai-explore-back').click();
  assert(await page.locator('.eai-explore-choices').isVisible(), 'Back returns to all subjects');
  await page.locator('.eai-explore-choice[href="#vak-oceanografie"]').click();
  assert(await page.locator('#vak-oceanografie a[href="/tools/abyss/"]').isVisible(), 'Oceanography has a working direct entry');
  // Leeuw: zelfstandige observatoriumroute, zonder externe scripts, ook op telefoon.
  for (const width of [1440, 390, 320]) {
    const leo = await context.newPage();
    await leo.setViewportSize({width,height:900});
    const leoErrors=[];
    leo.on('pageerror',e=>leoErrors.push(e.message));
    await leo.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await leo.goto(base+'/tools/science-observatory/labs/leeuw/',{waitUntil:'load'});
    await leo.waitForFunction(()=>window.LEO_STATE?.().points===9);
    assert.equal(await leo.locator('.nav-btn').count(),7);
    assert(await leo.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Leo horizontal overflow '+width);
    await leo.locator('#space').click();
    await leo.waitForFunction(()=>window.LEO_STATE().mode==='ruimte');
    await leo.locator('#near').click();
    await leo.waitForFunction(()=>window.LEO_STATE().points===8);
    await leo.locator('.star[data-id="49583"]').click();
    await leo.waitForFunction(()=>window.LEO_STATE().view==='space'&&window.LEO_STATE().star===49583);
    await leo.locator('[data-mode="meten"]').click();
    await leo.locator('#pairA').selectOption('49669');
    await leo.locator('#pairB').selectOption('49583');
    assert.ok(Math.abs(await leo.evaluate(()=>window.LEO_STATE().separation)-1736.502)<.02);
    await leo.locator('[data-mode="parallax"]').click();
    const d0=await leo.evaluate(()=>window.LEO_STATE().distance);
    await leo.locator('#sigma').focus();
    await leo.keyboard.press('ArrowRight');
    await leo.waitForFunction(old=>window.LEO_STATE().distance<old,d0);
    await leo.locator('[data-mode="licht"]').click();
    await leo.locator('#light').selectOption('absolute');
    assert.equal(await leo.evaluate(()=>window.LEO_STATE().light),'absolute');
    await leo.locator('[data-mode="beweging"]').click();
    await leo.locator('#future').click();
    assert.equal(await leo.evaluate(()=>window.LEO_STATE().years),20000);
    await leo.locator('[data-mode="waarnemen"]').click();
    await leo.locator('#lat').fill('0');
    await leo.locator('#lon').fill('0');
    assert.ok((await leo.evaluate(()=>window.LEO_STATE().points))<=9);
    await leo.goto(base+'/tools/science-observatory/labs/leeuw/#ruimte');
    await leo.waitForFunction(()=>window.LEO_STATE?.().mode==='ruimte');
    assert.deepEqual(leoErrors,[]);
    await leo.screenshot({path:'test-results/leeuw-'+width+'.png',fullPage:true});
    await leo.close();
  }
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
  await wiPage.screenshot({path:'test-results/wihtml-stap-naam.png'});
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
  await wiPage.locator('#wiWorkformGallery [data-wi-pick="question"]').click();
  assert.equal(await wiPage.locator('#designType').inputValue(), 'question', 'Werkvorm wijzigt de echte les');
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('#guideSlide').isVisible(), 'Daarna pas dia bewerken');
  await wiPage.screenshot({path:'test-results/wihtml-stap-dia.png'});
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
  await wiPage.screenshot({path:'test-results/wihtml-stap-leerling.png'});
  await wiPage.locator('#guideStudent').fill('Leerlingen bespreken eerst hun antwoord.');
  await wiPage.locator('#modeStudio').click();
  await wiPage.locator('#guideNext').click();
  assert(await wiPage.locator('[data-guide-notes="teacher"]').isVisible(), 'Docentrol heeft eigen Studio-scherm');
  await wiPage.screenshot({path:'test-results/wihtml-stap-docent.png'});
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
  const boardTitleColor=await wiPage.frameLocator('#guideResultFrame').locator('.wi-board h2').first().evaluate(el=>getComputedStyle(el).color);
  assert.equal(boardTitleColor,'rgb(244, 247, 244)','Donker bord toont de diatitel met voldoende lichtcontrast');
  const footerPosition=await wiPage.locator('.wi-guide-foot').evaluate(el=>getComputedStyle(el).position);
  assert.equal(footerPosition,'static','Het eindscherm heeft geen zwevende knoppenbalk over de HTML-les');
  assert(await wiPage.locator('#guideResultFrame').isVisible(), 'De werkende HTML is direct ingebed');
  await wiPage.screenshot({path:'test-results/wihtml-eindscherm.png',fullPage:true});
  await liveViewer.screenshot({path:'test-results/wihtml-live-presentatie.png'});
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
  wiPage.once('dialog',dialog=>dialog.dismiss());
  await wiPage.locator('#startNew').click();
  assert(await wiPage.locator('#guideResult').isVisible(),'Annuleren bewaart de huidige les');
  wiPage.once('dialog',dialog=>dialog.accept());
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
  const jsonLessonPath=resolve('site-build/tools/wihtml/bibliotheek/lineaire-verbanden.json');
  let blockedImports=0;
  const firstDeniedImport=wiPage.waitForEvent('dialog').then(async dialog=>{blockedImports++;await dialog.dismiss()});
  await wiPage.locator('#designImport').evaluate(button=>button.click());
  await Promise.all([firstDeniedImport,wiPage.locator('#import').setInputFiles(jsonLessonPath)]);
  await wiPage.waitForFunction(()=>document.getElementById('import').value==='');
  assert.equal(blockedImports,1,'JSON via ontwerpknop vraagt toestemming');
  assert.equal(await wiPage.locator('#title').inputValue(),'Tweede les','Annuleren vanuit ontwerpknop bewaart de les');
  assert(await wiPage.locator('[data-guide-info="goal"]').isVisible(),'Annuleren behoudt de huidige stap');
  const secondDeniedImport=wiPage.waitForEvent('dialog').then(async dialog=>{blockedImports++;await dialog.dismiss()});
  await Promise.all([secondDeniedImport,wiPage.locator('#import').setInputFiles(jsonLessonPath)]);
  await wiPage.waitForFunction(()=>document.getElementById('import').value==='');
  assert.equal(blockedImports,2,'Rechtstreekse bestandsinvoer vraagt ook toestemming');
  assert.equal(await wiPage.locator('#title').inputValue(),'Tweede les','Annuleren via bestandsinvoer bewaart inhoud');
  await wiPage.locator('#guideOtherLesson').click();
  await wiPage.locator('#startImport').click();
  wiPage.once('dialog',dialog=>dialog.accept());
  await wiPage.locator('#import').setInputFiles(resolve('site-build/tools/wihtml/bibliotheek/lineaire-verbanden.json'));
  await wiPage.waitForFunction(() => document.getElementById('title')?.value?.startsWith('Lineaire verbanden'));
  assert.equal(await wiPage.locator('#startDialog').evaluate(el=>el.open),false,'Import sluit startkeuzes');
  assert.equal(await wiPage.locator('#items .slide-item').count(),5,'Alle vijf dia’s blijven bewerkbaar');
  assert(await wiPage.locator('[data-guide-info="title"]').isVisible(),'Import opent bij lesgegevens');
  await wiPage.setViewportSize({width:390,height:844});
  await wiPage.locator('#guideNext').click();
  const wiMobile=await wiPage.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
  assert(wiMobile.scroll<=wiMobile.width+1,'Geen horizontaal scrollen op mobiel');
  await wiPage.screenshot({path:'test-results/wihtml-mobiel.png'});
  assert.deepEqual(wiErrors,[],'WiHTML heeft geen browserfouten');
  const routeContext=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const routePage=await routeContext.newPage();
  await routePage.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await routePage.goto(base+'/tools/wihtml/studio/?start=nieuw',{waitUntil:'load'});
  assert.equal(await routePage.locator('#newWithDraftDialog').evaluate(el=>el.open),false,'Zonder vorig concept geen extra startscherm');
  await routePage.locator('#guideTitle').fill('Onderzoekende les');
  await routePage.reload({waitUntil:'load'});
  await routePage.locator('#startDialog').waitFor({state:'visible'});
  routePage.once('dialog', dialog=>dialog.accept());
  await routePage.locator('#startRestore').click();
  assert.equal(await routePage.locator('#guideTitle').inputValue(),'Onderzoekende les','Snel verversen bewaart invoer');
  for(let n=0;n<3;n++)await routePage.locator('#guideNext').click();
  await routePage.locator('#guideRoute').selectOption('discover');
  await routePage.locator('#guideNext').click();
  assert.equal(await routePage.locator('#items .slide-item').count(),4,'Onderzoekende route maakt vier startdia’s');
  assert.equal(await routePage.locator('#guideType').inputValue(),'question','Eerste dia is de voorspelling');
  await routePage.goto(base+'/tools/wihtml/studio/?start=nieuw',{waitUntil:'load'});
  await routePage.locator('#newWithDraftDialog').waitFor({state:'visible'});
  assert.equal(await routePage.evaluate(()=>JSON.parse(localStorage.getItem('wihtml:docentstudio:concept:v1')).lesson.title),'Onderzoekende les','De directe start laat het oude concept intact');
  await routePage.reload({waitUntil:'load'});
  await routePage.locator('#startDialog').waitFor({state:'visible'});
  assert.equal(await routePage.evaluate(()=>JSON.parse(localStorage.getItem('wihtml:docentstudio:concept:v1')).lesson.title),'Onderzoekende les','Verversen vanuit de keuze behoudt het oude concept');
  await routePage.goto(base+'/tools/wihtml/studio/?start=nieuw',{waitUntil:'load'});
  await routePage.locator('#newWithDraftDialog').waitFor({state:'visible'});
  await routePage.locator('#newWithDraftRestore').click();
  assert.equal(await routePage.locator('#title').inputValue(),'Onderzoekende les','Bestaand concept kan worden hervat vanuit de landingspagina');
  assert.equal(await routePage.locator('#items .slide-item').count(),4,'Hervatten behoudt alle dia’s');
  await routePage.goto(base+'/tools/wihtml/studio/?start=nieuw',{waitUntil:'load'});
  await routePage.locator('#newWithDraftDialog').waitFor({state:'visible'});
  await routePage.locator('#newWithDraftStart').click();
  assert(await routePage.locator('[data-guide-info="title"]').isVisible(),'Bewust opnieuw beginnen opent stap één');
  assert.equal(await routePage.locator('#items .slide-item').count(),1,'Bewust opnieuw beginnen start met één dia');
  assert.equal(await routePage.locator('#newWithDraftDialog').evaluate(el=>el.open),false,'Keuze sluit na nieuwe start');
  await routeContext.close();
  await wiContext.close();
  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallback = await noJS.newPage();
  await fallback.goto(base + '/', { waitUntil: 'load' });
  await fallback.locator('.eai-site-menu>summary').click();
  await fallback.locator('.eai-site-group').nth(1).locator(':scope > summary').click();
  await fallback.locator('.eai-site-group').nth(4).locator(':scope > summary').click();
  assert.equal(await fallback.locator('.eai-site-group[open]').count(), 1, 'Native accordion must be exclusive');
  const fallbackTools = fallback.locator('.eai-site-group').nth(4);
  assert.equal(await fallbackTools.locator('a[href="/nl/tools/"]').count(), 1, 'No-JS navigation goes through one subject overview');
  await fallbackTools.locator('a[href="/nl/tools/"]').click();
  assert.equal(await fallback.locator('main .eai-explore-choice').count(), 8, 'Eight subject choices are plain links, even without scripts');
  assert.equal(await fallback.locator('main a[href="/tools/eaistudio/"]').count(), 1, 'EAIstudio remains available without JavaScript');
  assert.equal(await fallback.locator('main a[href="/tools/science-observatory/"]').count(), 1, 'Subject catalogue remains available without JavaScript');
  assert.equal(await fallback.locator('main a[href="/tools/abyss/"]').count(), 1, 'Oceanography remains available without JavaScript');
  await noJS.close();
  assert.deepEqual(errors, []);
  writeFileSync('test-results/ui-report.json', JSON.stringify({ results, noJavaScriptMenu: true, homeRoutes: true, languageLinks: true, errors }, null, 2));
  console.log(`PASS: ${results.length} page/viewport checks, native no-JS menu, keyboard, homepage questions and language links.`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
