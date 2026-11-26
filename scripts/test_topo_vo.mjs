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

async function layout(page, label) {
  const s = await page.evaluate(() => {
    const r = q => { const n = document.querySelector(q); if (!n) return null; const b = n.getBoundingClientRect(); return {top: b.top, bottom: b.bottom, height: b.height}; };
    return {vh: window.visualViewport?.height || innerHeight, body: document.body.scrollHeight, card: r('.question-card'), links: r('.small-links'),
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
    await page.locator('#typedAnswer').fill(answer);
    await page.locator('.type-submit').click();
  }
  await page.locator('#next').waitFor({state: 'visible', timeout: 4000});
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
        assert.equal(await page.locator('#score').textContent(), '★ ' + (i + 1), set + '/' + mode + ': ster ontbreekt na goed antwoord');
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

  // 4. Startpagina: niveau, set en vraagvorm leiden naar de juiste spellink.
  {
    const page = await browser.newPage(phone);
    page.on('pageerror', e => failures.push('start: ' + e.message));
    try {
      await page.goto(base + '/topo/vo/');
      await page.locator('#privacyOk').click();
      await page.locator('[data-niveau="vwo"]').click();
      await page.locator('#tab-oefenen').click();
      await page.locator('[data-set="v-d1-zuid-amerika"]').click();
      assert.match(await page.locator('#setNote').textContent(), /V-D1/);
      await page.locator('#tab-spel').click();
      await page.locator('[data-group="vormen"][data-value="missing"]').click();
      await page.locator('[data-group="aantal"][data-value="5"]').click();
      const href = await page.getAttribute('#go', 'href');
      assert.equal(href, '/topo/vo/spel/?set=v-d1-zuid-amerika&mode=missing&questions=5');
      const fit = await page.evaluate(() => ({body: document.body.scrollHeight, vh: innerHeight, go: document.getElementById('go').getBoundingClientRect().bottom}));
      assert.ok(fit.body <= fit.vh + 4 && fit.go <= fit.vh, 'Startpagina past niet op een telefoon');
      await page.locator('#tab-niveau').click(); await page.locator('[data-niveau="onderbouw"]').click(); await page.locator('#tab-oefenen').click();
      await page.locator('[data-set="ob-begrippen-kaart"]').click(); await page.locator('#tab-spel').click();
      assert.ok(await page.locator('[data-group="vormen"][data-value="point"]').isDisabled(), 'Kaartvorm hoort uit bij een begrippenset');
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
