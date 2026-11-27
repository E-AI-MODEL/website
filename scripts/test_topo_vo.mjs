// Browserproef voor Let's go TOPO! VO: alle vraagvormen, leerstrategie, mobiele lay-out en alle sets.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';

const base = process.env.TOPO_BASE || 'http://127.0.0.1:8765';
const out = 'test-results/topo-vo';
mkdirSync(out, {recursive: true});
const engine = process.env.TOPO_BROWSER === 'webkit' ? webkit : chromium;
const launch = process.env.TOPO_CHROME ? {executablePath: process.env.TOPO_CHROME, args: ['--no-sandbox']} : {};
const browser = await engine.launch({headless: true, ...launch});
const sets = JSON.parse(readFileSync('topo/data/vo/sets.json', 'utf8')).sets;
const failures = [];
const phone = {viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true};

async function open(url, opts = phone) {
  const page = await browser.newPage(opts);
  page.on('pageerror', e => failures.push(url + ': ' + e.message));
  await page.goto(base + url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide') ||
    /OEPS|Geen vragen/.test(document.getElementById('loading').textContent), null, {timeout: 15000});
  assert.ok(await page.locator('#loading').evaluate(n => n.classList.contains('hide')), url + ': spel startte niet');
  return page;
}
const hook = (page, fn) => page.evaluate(f => window.__topoVo[f](), fn);
const exact = text => new RegExp('^\\s*' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
const optionFor = (page, text) => page.locator('#answerOptions .option').filter({hasText: exact(text)}).first();

// Keuzes staan op bladzijden als ze niet op één scherm passen: blader tot het element zichtbaar is.
async function reveal(page, selector) {
  const el = page.locator(selector).first();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (await el.isVisible()) return el;
  for (const pager of await page.locator('.panel:not([hidden]) .vast-pager').all()) {
    if (!(await pager.isVisible())) continue;
    while (await pager.locator('.vast-pager-prev').isEnabled()) await pager.locator('.vast-pager-prev').click();
    for (let i = 0; i < 20 && !(await el.isVisible()) && await pager.locator('.vast-pager-next').isEnabled(); i++) await pager.locator('.vast-pager-next').click();
    if (await el.isVisible()) return el;
  }
  return el;
}
const pick = async (page, selector) => (await reveal(page, selector)).click();
// Sets staan op bladzijden als ze niet op één scherm passen: blader tot de set zichtbaar is.
async function pickSet(page, id) {
  const set = page.locator(`[data-set="${id}"]`);
  const pager = page.locator('#sets + .vast-pager');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (!(await set.isVisible()) && await pager.isVisible()) {
    while (await pager.locator('.vast-pager-prev').isEnabled()) await pager.locator('.vast-pager-prev').click();
    for (let i = 0; i < 20 && !(await set.isVisible()) && await pager.locator('.vast-pager-next').isEnabled(); i++) await pager.locator('.vast-pager-next').click();
  }
  await set.click();
}
async function layout(page, label) {
  const s = await page.evaluate(() => {
    const r = q => { const n = document.querySelector(q); if (!n) return null; const b = n.getBoundingClientRect(); return {top: b.top, bottom: b.bottom, height: b.height}; };
    // Vast scherm: na een antwoord neemt VERDER! de plek van de hulpknoppen in.
    const next = r('#next');
    return {vh: window.visualViewport?.height || innerHeight, body: document.body.scrollHeight, card: r('.question-card'), links: next && next.height ? next : r('.small-links'),
      map: r('.game-board'), mode: document.querySelector('.game-grid').dataset.mode,
      options: [...document.querySelectorAll('#answerOptions .option')].map(n => n.getBoundingClientRect().bottom)};
  });
  assert.ok(s.card.bottom <= s.vh - 4, label + ': vraagkaart afgesneden');
  assert.ok(s.links.bottom <= s.card.bottom - 2, label + ': hulpknoppen afgesneden');
  assert.ok(s.body <= s.vh + 8, label + ': pagina scrolt');
  if (s.mode !== 'quiz') assert.ok(s.map.height >= 135 && s.map.bottom <= s.vh + 3, label + ': kaart te klein of afgesneden');
  for (const b of s.options) assert.ok(b <= s.links.top + 2, label + ': antwoordknop valt weg');
  return s;
}
async function answerCorrect(page) {
  const mode = await hook(page, 'mode');
  const answer = await hook(page, 'answer');
  if (mode === 'point') {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const p = await hook(page, 'targetScreen');
    await page.mouse.click(p.x, p.y);
  } else if (mode === 'choice' || mode === 'zoom' || mode === 'quiz') {
    await optionFor(page, answer).click();
  } else {
    // Enter verstuurt het formulier, net als op een telefoontoetsenbord; de CHECK-knop wordt apart getest.
    await page.locator('#typedAnswer').fill(answer);
    await page.locator('#typedAnswer').press('Enter');
  }
  await page.locator('#next').waitFor({state: 'visible', timeout: 6000});
  return mode;
}

try {
  // 1. Alle vraagvormen meteen goed: sterren en eindscherm.
  for (const [set, mode] of [['ob1-nl-basis', 'point'], ['ob2-landen-afrika', 'point'], ['ob2-rivieren', 'point'], ['h-c2-aarde', 'point'],
    ['h-d1-brazilie', 'choice'], ['h-b1-mexico-vs', 'type'], ['ob1-eu-basis', 'missing'], ['ob1-nl-basis', 'zoom'],
    ['v-d1-zuid-amerika', 'shuffle'], ['h-begrippen-aarde', 'quiz'], ['ob1-eu-landen-hoofdsteden', 'quiz']]) {
    const page = await open(`/topo/vo/spel/?set=${set}&mode=${mode}&questions=5&test=1`);
    try {
      await layout(page, set + '/' + mode);
      const seen = new Set();
      for (let i = 0; i < 5; i++) {
        seen.add(await answerCorrect(page));
        const score = await page.locator('#score').textContent();
        if (score !== '★ ' + (i + 1)) console.log('TOPO VO DIAGNOSE', set, mode, i, JSON.stringify(await hook(page, 'state')));
        assert.equal(score, '★ ' + (i + 1), set + '/' + mode + ': ster ontbreekt na goed antwoord');
        if (i === 0) { await layout(page, set + '/' + mode + ' na antwoord'); await page.screenshot({path: `${out}/${set}-${mode}.png`}); }
        await page.locator('#next').click();
      }
      await page.locator('#end').waitFor({state: 'visible'});
      assert.match(await page.locator('#endText').textContent(), /^5 van 5 meteen goed/);
      assert.ok(await page.locator('#retry').evaluate(n => n.classList.contains('hide')), 'Fouten oefenen hoort verborgen bij alles goed');
      console.log('TOPO VO ' + set + '/' + mode + ' OK: ' + [...seen].join(','));
    } finally { await page.close(); }
  }

  // 2. Leerstrategie: fout komt terug, geen ster, hint verraadt niets, spiekkaart telt als hulp, fouten oefenen.
  {
    const page = await open('/topo/vo/spel/?set=ob1-eu-landen-hoofdsteden&mode=choice&questions=5&test=1');
    try {
      const before = await hook(page, 'queueLength');
      const answer = await hook(page, 'answer');
      await page.locator('#help').click();
      const hint = await page.locator('#sub').textContent();
      assert.ok(!hint.toLowerCase().includes(answer.toLowerCase()), 'Hint noemt het antwoord: ' + hint);
      const wrongBtn = page.locator('#answerOptions .option').filter({hasNotText: exact(answer)}).first();
      await wrongBtn.click();
      assert.ok(await wrongBtn.evaluate(n => n.classList.contains('bad')));
      assert.equal(await hook(page, 'queueLength'), before + 1, 'Foute plek komt niet terug in de ronde');
      await optionFor(page, answer).click();
      assert.equal(await page.locator('#score').textContent(), '★ 0', 'Ster na hulp of fout');
      await page.locator('#next').click();
      await page.locator('#showAnswer').click();
      assert.ok(await page.locator('#sheetCanvas svg .map-text.place').count() > 5, 'Spiekkaart zonder namen');
      await page.screenshot({path: `${out}/spiekkaart.png`});
      await page.locator('#closeSheet').click();
      let guard = 0;
      while (await page.locator('#end').isHidden() && guard++ < 20) { await answerCorrect(page); await page.locator('#next').click(); }
      assert.ok(await page.locator('#end').isVisible(), 'Eindscherm ontbreekt');
      assert.ok(await page.locator('#review span').count() >= 2, 'Overzicht "Deze nog eens" ontbreekt');
      assert.ok(await page.locator('#retry').isVisible(), 'Fouten oefenen ontbreekt');
      await page.locator('#retry').click();
      assert.ok(await page.locator('#game').isVisible(), 'Fouten oefenen start geen ronde');
      assert.ok((await hook(page, 'queueLength')) >= 2 && (await hook(page, 'queueLength')) <= 3, 'Herhaalronde heeft niet alleen de fouten');
      console.log('TOPO VO leerstrategie OK');
    } finally { await page.close(); }
  }

  // 3. Typen: spelling bijna goed geeft een herkansing, alternatieve naam telt goed.
  {
    const page = await open('/topo/vo/spel/?set=ob2-wereld-basis&mode=type&questions=40&test=1');
    try {
      let answer = await hook(page, 'answer');
      for (let i = 0; i < 25 && answer.length < 7; i++) { await page.locator('#skip').click(); await page.locator('#next').click(); answer = await hook(page, 'answer'); }
      const typo = answer.slice(0, -2) + answer.slice(-1);
      await page.locator('#typedAnswer').fill(typo);
      await page.locator('.type-submit').click();
      assert.match(await page.locator('#feedback').textContent(), /Bijna/, 'Geen spellinghint bij bijna goed');
      assert.ok(await page.locator('#next').isHidden(), 'Spellingfout telde als eindantwoord');
      await page.locator('#typedAnswer').fill(answer);
      await page.locator('.type-submit').click();
      await page.locator('#next').waitFor({state: 'visible'});
      const voor = await page.locator('#next').boundingBox();
      await page.waitForTimeout(400);
      const na = await page.locator('#next').boundingBox();
      assert.ok(Math.abs(voor.y - na.y) < 2, 'VERDER! verspringt na een goed antwoord');
      // Toetsenbord op een telefoon: invoer en CHECK blijven zichtbaar.
      await page.locator('#next').click();
      await page.locator('#typedAnswer').focus();
      await page.setViewportSize({width: 390, height: 430});
      await page.waitForTimeout(200);
      const k = await page.evaluate(() => ({kb: document.body.classList.contains('keyboard-open'), input: document.getElementById('typedAnswer').getBoundingClientRect().bottom,
        check: document.querySelector('.type-submit').getBoundingClientRect().bottom, map: document.getElementById('map').getBoundingClientRect().height, vh: window.visualViewport?.height || innerHeight}));
      assert.ok(k.kb && k.input <= k.vh + 7 && k.check <= k.vh + 7 && k.map >= 60, 'Toetsenbordlay-out klopt niet: ' + JSON.stringify(k));
      await page.screenshot({path: `${out}/toetsenbord.png`});
      console.log('TOPO VO typen en toetsenbord OK');
    } finally { await page.close(); }
  }

  // 3b. Zonder hulp: geen hints en geen spiekkaart.
  {
    const page = await open('/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=5&assist=none&test=1');
    try {
      assert.ok(await page.locator('#help').isHidden() && await page.locator('#showAnswer').isHidden(), 'Hulp of spiekkaart zichtbaar zonder hulp');
      console.log('TOPO VO zonder hulp OK');
    } finally { await page.close(); }
  }

  // 4a. Extra leerstrategieën: kijkronde, zeker of gok, ruimtelijke foutfeedback, tot ik het ken, meebewegend, herhaallink.
  {
    const answerWith = async (page, ok) => {
      const mode = await hook(page, 'mode'), ans = await hook(page, 'answer');
      if (mode === 'type') { await page.locator('#typedAnswer').fill(ok ? ans : 'xqzw'); await page.locator('#typedAnswer').press('Enter'); }
      else if (ok) await optionFor(page, ans).click();
      else await page.locator('#answerOptions .option').filter({hasNotText: exact(ans)}).first().click();
    };
    // Kijkronde: eerst bekijken (geen sterren, meteen VERDER!), daarna zelf ophalen.
    let page = await open('/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=5&kijk=1&test=1');
    try {
      assert.equal(await page.locator('#kind').textContent(), 'KIJKRONDE');
      assert.match(await page.locator('#progressText').textContent(), /^KIJK 1\/5$/);
      assert.ok(await page.locator('#next').isVisible(), 'Kijkronde: VERDER! hoort er meteen te staan');
      assert.ok(await page.locator('#map .target-area, #map .city-focus').count() > 0, 'Kijkronde: plek niet uitgelicht');
      for (let i = 0; i < 5; i++) await page.locator('#next').click();
      assert.notEqual(await page.locator('#kind').textContent(), 'KIJKRONDE');
      assert.equal(await page.locator('#progressText').textContent(), '1/5');
      assert.match(await page.locator('#feedback').textContent(), /Nu jij/);
      for (let i = 0; i < 5; i++) { await answerCorrect(page); await page.locator('#next').click(); }
      await page.locator('#end').waitFor({state: 'visible'});
      assert.match(await page.locator('#endText').textContent(), /^5 van 5 meteen goed/);
    } finally { await page.close(); }
    // Zeker of gok: eerst zekerheid kiezen, dan pas feedback; eindscherm laat zien waar je zeker fout zat.
    page = await open('/topo/vo/spel/?set=ob2-landen-afrika&mode=choice&questions=5&zeker=1&test=1');
    try {
      await answerWith(page, false);
      assert.ok(await page.locator('#sure').isVisible(), 'Zekerheidsknoppen ontbreken');
      assert.ok(!(await page.locator('#feedback').isVisible()), 'Feedback hoort pas na de zekerheid');
      assert.equal(await page.locator('#answerOptions .option.chosen').count(), 1);
      await page.locator('#sure [data-sure="1"]').click();
      assert.match(await page.locator('#feedback').textContent(), /Je was zeker, maar/);
      await answerWith(page, true);
      assert.ok(!(await page.locator('#sure').isVisible()), 'Tweede poging vraagt geen zekerheid');
      await page.locator('#next').click();
      for (let i = 0; i < 12 && await page.locator('#end').isHidden(); i++) {
        await answerWith(page, true);
        if (await page.locator('#sure').isVisible()) await page.locator('#sure [data-sure="0"]').click();
        await page.locator('#next').waitFor({state: 'visible'});
        await page.locator('#next').click();
      }
      await page.locator('#end').waitFor({state: 'visible'});
      assert.match(await page.locator('#helpSummary').textContent(), /ZEKER MAAR FOUT 1/);
      assert.match(await page.locator('#endNote').textContent(), /Zeker maar fout: /);
      const later = await hook(page, 'later');
      assert.match(later, /items=/, 'Herhaallink ontbreekt');
      await page.screenshot({path: `${out}/strategie-zeker-eind.png`});
      // Herhaallink: precies de gemiste plekken.
      const ids = new URL(later).searchParams.get('items').split(',');
      const again = await open(new URL(later).pathname + new URL(later).search + '&test=1');
      try {
        const queue = await again.evaluate(() => window.__topoVo.queueLength());
        assert.equal(queue, ids.length, 'Herhaallink laadt niet precies de gemiste plekken');
        assert.ok(ids.includes((await hook(again, 'task')).id), 'Herhaallink start met een andere plek');
      } finally { await again.close(); }
    } finally { await page.close(); }
    // Ruimtelijke foutfeedback: afstand en richting, na de tweede misser een lijn naar de goede plek.
    page = await open('/topo/vo/spel/?set=ob2-landen-afrika&mode=point&questions=5&test=1');
    try {
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const box = await page.locator('#map').boundingBox(), t = await hook(page, 'targetScreen');
      // Buiten de spelbalk, de zoomknoppen en de melding onderaan.
      const wx = t.x > box.x + box.width / 2 ? box.x + 30 : box.x + box.width - 70, wy = box.y + box.height * 0.42;
      await page.mouse.click(wx, wy);
      assert.match(await page.locator('#feedback').textContent(), /\d+ km verder naar het (noord|oost|zuid|west)/);
      assert.equal(await page.locator('#map .tap-mark').count(), 1, 'Tikplek niet gemarkeerd');
      await page.mouse.click(wx, wy - 4);
      await page.locator('#next').waitFor({state: 'visible'});
      assert.match(await page.locator('#feedback').textContent(), /Je tikte zo’n \d+ km ernaast/);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      assert.equal(await page.locator('#map .tap-line').count(), 1, 'Lijn naar de goede plek ontbreekt');
      await page.screenshot({path: `${out}/strategie-afstand.png`});
    } finally { await page.close(); }
    // Tot ik het ken: elke plek twee keer zelf goed; een overgeslagen plek komt terug tot hij ook twee keer goed is.
    page = await open('/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=kennen&test=1');
    try {
      let n = 0;
      for (; n < 60 && await page.locator('#end').isHidden(); n++) {
        if (n === 2) { await page.locator('#skip').click(); } else await answerWith(page, true);
        await page.locator('#next').waitFor({state: 'visible'});
        await page.locator('#next').click();
      }
      assert.equal(n, 21, 'Tot ik het ken: verwacht 10 + 9 + 2 vragen (overgeslagen plek nog twee keer), kreeg ' + n);
      assert.match(await page.locator('#endText').textContent(), /^Je kent ze alle 10!/);
      assert.match(await page.locator('#review').textContent(), /Deze waren lastig:/);
    } finally { await page.close(); }
    // Meebewegend: drie keer zelf goed maakt het moeilijker (kiezen wordt typen), twee keer vastlopen geeft meer hulp.
    page = await open('/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=10&level=adaptief&test=1');
    try {
      for (let i = 0; i < 3; i++) { await answerWith(page, true); await page.locator('#next').waitFor({state: 'visible'}); if (i === 2) assert.match(await page.locator('#feedback').textContent(), /iets moeilijker/); await page.locator('#next').click(); }
      assert.equal((await hook(page, 'state')).steun, 0);
      assert.equal(await hook(page, 'mode'), 'type', 'Meer uitdaging: kiezen hoort typen te worden');
      for (let i = 0; i < 2; i++) { await page.locator('#skip').click(); await page.locator('#next').click(); }
      assert.equal((await hook(page, 'state')).steun, 1);
      for (let i = 0; i < 2; i++) { await page.locator('#skip').click(); await page.locator('#next').click(); }
      assert.equal((await hook(page, 'state')).steun, 2);
      if (await hook(page, 'mode') === 'choice') assert.equal(await page.locator('#answerOptions .option').count(), 3, 'Meer hulp: drie keuzes');
    } finally { await page.close(); }
    console.log('TOPO VO extra leerstrategieën OK');
  }

  // 4. Startpagina: niveau, set en vraagvorm leiden naar de juiste spellink.
  {
    const page = await browser.newPage(phone);
    page.on('pageerror', e => failures.push('start: ' + e.message));
    try {
      await page.goto(base + '/topo/vo/');
      await page.locator('#privacyOk').click();
      await page.locator('[data-niveau="vwo"]').click();
      await page.locator('#tab-oefenen').click();
      await pickSet(page, 'v-d1-zuid-amerika');
      assert.match(await page.locator('#setNote').textContent(), /V-D1/);
      await page.locator('#tab-spel').click();
      await pick(page, '[data-group="vormen"][data-value="missing"]');
      await pick(page, '[data-group="aantal"][data-value="5"]');
      const href = await page.getAttribute('#go', 'href');
      assert.equal(href, '/topo/vo/spel/?set=v-d1-zuid-amerika&mode=missing&questions=5');
      // Leerstrategieën komen in de spellink (en dus ook in de link voor de klas).
      await pick(page, '[data-group="aantal"][data-value="kennen"]');
      await pick(page, '[data-group="manier"][data-value="adaptief"]');
      await pick(page, '[data-group="slim"][data-value="kijk"]');
      await pick(page, '[data-group="slim"][data-value="zeker"]');
      assert.equal(await page.getAttribute('#go', 'href'), '/topo/vo/spel/?set=v-d1-zuid-amerika&mode=missing&questions=kennen&level=adaptief&kijk=1&zeker=1');
      assert.match(await page.locator('#summary').textContent(), /tot je het kent · meebewegend · eerst kijken · zeker of gok/);
      await pick(page, '[data-group="aantal"][data-value="5"]'); await pick(page, '[data-group="manier"][data-value="normal"]');
      await pick(page, '[data-group="slim"][data-value="kijk"]'); await pick(page, '[data-group="slim"][data-value="zeker"]');
      assert.equal(await page.getAttribute('#go', 'href'), '/topo/vo/spel/?set=v-d1-zuid-amerika&mode=missing&questions=5');
      const fit = await page.evaluate(() => ({body: document.body.scrollHeight, vh: innerHeight, go: document.getElementById('go').getBoundingClientRect().bottom}));
      assert.ok(fit.body <= fit.vh + 4 && fit.go <= fit.vh, 'Startpagina past niet op een telefoon');
      await page.locator('#tab-niveau').click(); await page.locator('[data-niveau="onderbouw"]').click(); await page.locator('#tab-oefenen').click();
      await pickSet(page, 'ob-begrippen-kaart'); await page.locator('#tab-spel').click();
      assert.ok(await (await reveal(page, '[data-group="vormen"][data-value="point"]')).isDisabled(), 'Kaartvorm hoort uit bij een begrippenset');
      await page.locator('#tab-oefenen').click(); await pickSet(page, 'ob3-wereld-verdieping'); await page.locator('#tab-spel').click();
      assert.ok(await (await reveal(page, '[data-group="vormen"][data-value="missing"]')).isDisabled(), "'Wat mist er' hoort uit bij een set met alleen landen");
      await page.screenshot({path: `${out}/start.png`});
      console.log('TOPO VO startpagina OK');
    } finally { await page.close(); }
  }

  // 5. Elke set laadt en toont een vraag zonder fouten.
  for (const s of sets) {
    const page = await open(`/topo/vo/spel/?set=${s.id}&questions=5&test=1${s.kaart ? '' : '&mode=quiz'}`);
    try {
      const prompt = (await page.locator('#prompt').textContent()).trim();
      assert.ok(prompt.length > 3, s.id + ': geen vraag');
      await layout(page, s.id);
    } finally { await page.close(); }
  }
  console.log('TOPO VO alle ' + sets.length + ' sets laden OK');
} finally {
  await browser.close();
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('TOPO VO BROWSER PASS');
