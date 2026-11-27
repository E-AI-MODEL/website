// Vaste-schermproef voor alle TOPO-pagina's (PO en VO): geen scroll, alles in beeld, kaart als hoofdvlak.
// Gebruik: node scripts/test_topo_fixed_screen.mjs   (server op 127.0.0.1:8765 of TOPO_BASE)
//          TOPO_ONLY=vo-choice,po-nl-point  draait alleen deze scenario's; TOPO_VP=360x640 alleen dit formaat.
//          TOPO_FONT="DejaVu Sans" test met een breder lettertype.
//          TOPO_SHOTS=1 bewaart van elk scenario een schermafbeelding (anders alleen bij fouten).
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.TOPO_BASE || 'http://127.0.0.1:8765';
const out = 'test-results/topo-fixed';
mkdirSync(out, {recursive: true});
const engine = process.env.TOPO_BROWSER === 'webkit' ? webkit : chromium;
const launch = process.env.TOPO_CHROME ? {executablePath: process.env.TOPO_CHROME, args: ['--no-sandbox']} : {};
const browser = await engine.launch({headless: true, ...launch});
const only = process.env.TOPO_ONLY ? new Set(process.env.TOPO_ONLY.split(',')) : null;

const VIEWPORTS = [
  {name: '360x640', width: 360, height: 640, phone: true},
  {name: 'iphone-se', width: 375, height: 667, phone: true},
  {name: 'iphone-14', width: 390, height: 844, phone: true},
  {name: 'pixel', width: 412, height: 915, phone: true},
  {name: 'liggend', width: 844, height: 390, phone: true, landscape: true},
  {name: 'tablet', width: 768, height: 1024},
  {name: 'desktop', width: 1280, height: 800},
];

const skip = async p => { await p.locator('#skip').click(); await p.locator('#next').waitFor({state: 'visible'}); };
const ready = p => p.waitForFunction(() => !document.getElementById('loading') || document.getElementById('loading').classList.contains('hide'), null, {timeout: 15000});
const toEnd = async p => { for (let i = 0; i < 40 && await p.locator('#end').isHidden(); i++) { await skip(p); await p.locator('#next').click(); } };
const privacy = async p => { const b = p.locator('#privacyOk'); if (await b.isVisible().catch(() => false)) await b.click(); };

// [naam, url, actie, kaartvraag]
const SCENARIOS = [
  ['po-home', '/topo/', privacy, false],
  ['po-north-point', '/topo/', async p => { await privacy(p); await p.locator('#start').click(); }, true],
  ['po-north-na', '/topo/', async p => { await privacy(p); await p.locator('#start').click(); await skip(p); }, true],
  ['po-north-spiek', '/topo/', async p => { await privacy(p); await p.locator('#start').click(); await p.locator('#showAnswer').click(); }, false],
  ['po-north-eind', '/topo/', async p => { await privacy(p); await p.locator('#start').click(); await toEnd(p); }, false],
  ['po-inst-gebied', '/topo/instellingen/', null, false],
  ['po-inst-oefenen', '/topo/instellingen/', p => p.locator('#tab-practice').click(), false],
  ['po-inst-spel', '/topo/instellingen/', p => p.locator('#tab-game').click(), false],
  ['po-nl-point', '/topo/nederland/?mode=point&questions=5', ready, true],
  ['po-nl-choice', '/topo/nederland/?mode=choice&questions=5', ready, true],
  ['po-nl-type', '/topo/nederland/?mode=type&questions=5', ready, true],
  ['po-nl-na', '/topo/nederland/?mode=choice&questions=5', async p => { await ready(p); await skip(p); }, true],
  ['po-nl-spiek', '/topo/nederland/?mode=choice&questions=5', async p => { await ready(p); await p.locator('#showAnswer').click(); }, false],
  ['po-nl-eind', '/topo/nederland/?mode=choice&questions=5', async p => { await ready(p); await toEnd(p); }, false],
  ['vo-start', '/topo/vo/', privacy, false],
  ['vo-start-sets', '/topo/vo/?niveau=onderbouw', async p => { await privacy(p); await p.locator('#tab-oefenen').click(); }, false],
  ['vo-start-spel', '/topo/vo/?set=ob1-nl-basis', p => p.locator('#tab-spel').click(), false],
  ['vo-point', '/topo/vo/spel/?set=ob1-nl-basis&mode=point&questions=5', ready, true],
  ['vo-point-na', '/topo/vo/spel/?set=ob1-nl-basis&mode=point&questions=5', async p => { await ready(p); await skip(p); }, true],
  ['vo-choice', '/topo/vo/spel/?set=ob2-landen-afrika&mode=choice&questions=5', ready, true],
  ['vo-choice-na', '/topo/vo/spel/?set=ob2-landen-afrika&mode=choice&questions=5', async p => { await ready(p); await skip(p); }, true],
  ['vo-type', '/topo/vo/spel/?set=h-b1-mexico-vs&mode=type&questions=5', ready, true],
  ['vo-missing', '/topo/vo/spel/?set=ob1-eu-basis&mode=missing&questions=5', ready, true],
  ['vo-quiz', '/topo/vo/spel/?set=h-begrippen-aarde&mode=quiz&questions=5', ready, false],
  ['vo-spiek', '/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=5', async p => { await ready(p); await p.locator('#showAnswer').click(); }, false],
  ['vo-eind', '/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=5', async p => { await ready(p); await toEnd(p); }, false],
  ['vo-kijk', '/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=5&kijk=1', ready, true],
  ['vo-spiek-begrippen', '/topo/vo/spel/?set=h-begrippen-aarde&mode=quiz&questions=5', async p => { await ready(p); await p.locator('#showAnswer').click(); }, false],
  ['vo-zeker', '/topo/vo/spel/?set=ob2-landen-afrika&mode=choice&questions=5&zeker=1', async p => { await ready(p); await p.locator('#answerOptions .option').first().click(); }, true],
  ['vo-kennen', '/topo/vo/spel/?set=ob1-nl-basis&mode=point&questions=kennen&level=adaptief', ready, true],
  ['vo-eind-zeker', '/topo/vo/spel/?set=ob2-landen-afrika&mode=choice&questions=10&zeker=1', async p => {
    await ready(p);
    for (let i = 0; i < 40 && await p.locator('#end').isHidden(); i++) {
      for (let k = 0; k < 4 && await p.locator('#next').isHidden(); k++) {
        const o = p.locator('#answerOptions .option:not(.bad)').first(); await o.click();
        if (await p.locator('#sure').isVisible()) await p.locator('#sure [data-sure="1"]').click();
      }
      await p.locator('#next').click();
    }
  }, false],
];

function measure() {
  const vw = innerWidth, vh = window.visualViewport?.height || innerHeight;
  const visible = n => { if (!n.getClientRects().length) return false; const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = n => n.id ? '#' + n.id : (n.textContent || n.getAttribute('aria-label') || n.className || n.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 24);
  const docScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - vh;
  const docWide = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
  const scrollers = [...document.querySelectorAll('body *')].filter(n => {
    if (!visible(n)) return false; const cs = getComputedStyle(n);
    return (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2) || (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2);
  }).map(n => name(n) + ' (' + (n.scrollHeight - n.clientHeight) + 'px)');
  const controls = [...document.querySelectorAll('button, a[href], input, select, [role=tab]')].filter(visible).filter(n => !n.closest('[aria-hidden="true"]'));
  const outside = controls.filter(n => { const r = n.getBoundingClientRect(); return r.top < -1 || r.left < -1 || r.bottom > vh + 1 || r.right > vw + 1; }).map(name);
  const small = controls.filter(n => n.matches('button, input, [role=tab]') && n.getBoundingClientRect().height < 44 && n.getBoundingClientRect().width < 44).map(n => name(n) + ' ' + Math.round(n.getBoundingClientRect().height) + 'px');
  // Afgesneden tekst: koppen en vraagtekst moeten helemaal in hun vak en in beeld staan.
  const clipped = [...document.querySelectorAll('h1, h2, #prompt, #sub, .feedback, #endText, .option, #review')].filter(visible).filter(n => {
    const r = n.getBoundingClientRect();
    if (r.bottom > vh + 1 || r.right > vw + 1) return true;
    const own = getComputedStyle(n);
    if ((own.overflowY !== 'visible' && n.scrollHeight > n.clientHeight + 3) || (own.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1) || own.webkitLineClamp !== 'none' && n.scrollHeight > n.clientHeight + 3) return true;
    for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); if (r.bottom > ar.bottom + 2 || r.top < ar.top - 2 || r.right > ar.right + 2) return true; }
    }
    return false;
  }).map(name);
  const svg = document.querySelector('#game:not(.hide) #map svg');
  let map = null;
  if (svg && visible(svg)) { const r = svg.getBoundingClientRect(); map = {w: Math.round(r.width), h: Math.round(r.height), area: r.width * r.height / (vw * vh), widthShare: r.width / vw}; }
  const tinyLabels = [...document.querySelectorAll('#map .map-text, #sheetLayer .map-text')].filter(visible).filter(n => n.style.display !== 'none').filter(n => n.getBoundingClientRect().height < 11).length;
  return {vw, vh, docScroll, docWide, scrollers, outside, small, clipped, map, tinyLabels};
}

const report = [];
const onlyVp = process.env.TOPO_VP ? new Set(process.env.TOPO_VP.split(',')) : null;
async function runScreen(vp, id, url, act, mapQuestion) {
    const page = await browser.newPage({viewport: {width: vp.width, height: vp.height}, isMobile: Boolean(vp.phone), hasTouch: Boolean(vp.phone), deviceScaleFactor: 1});
    // TOPO_FONT="DejaVu Sans" test met een breder lettertype (zoals in de CI-container).
    if (process.env.TOPO_FONT) await page.addInitScript(f => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*{font-family:"' + f + '",sans-serif!important}'; document.head.appendChild(st); }), process.env.TOPO_FONT);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(base + url, {waitUntil: 'domcontentloaded'});
      await page.waitForTimeout(350);
      if (act) await act(page);
      await page.waitForTimeout(450);
      const m = await page.evaluate(measure);
      const fails = [];
      if (m.docScroll > 1) fails.push('pagina scrolt ' + m.docScroll + 'px');
      if (m.docWide > 1) fails.push('pagina is ' + m.docWide + 'px te breed');
      if (m.scrollers.length) fails.push('scrollvlak: ' + m.scrollers.join(', '));
      if (m.outside.length) fails.push('buiten beeld: ' + m.outside.slice(0, 5).join(' | '));
      if (m.small.length) fails.push('te klein (<44px): ' + m.small.slice(0, 5).join(' | '));
      if (m.clipped.length) fails.push('tekst afgesneden: ' + m.clipped.join(' | '));
      if (m.tinyLabels) fails.push(m.tinyLabels + ' kaartlabels kleiner dan 11px');
      if (mapQuestion) {
        if (!m.map) fails.push('geen kaart zichtbaar');
        else if (vp.landscape && m.map.widthShare < 0.5) fails.push('kaart ' + Math.round(m.map.widthShare * 100) + '% van de breedte (min 50%)');
        else if (vp.phone && !vp.landscape && m.map.area < 0.55) fails.push('kaart ' + Math.round(m.map.area * 100) + '% van het scherm (min 55%)');
        else if (!vp.phone && m.map.area < 0.4) fails.push('kaart ' + Math.round(m.map.area * 100) + '% van het scherm (min 40%)');
      }
      // Rust: een scherm dat niets doet, mag niet blijven herberekenen (geen meet-lus).
      // Kort nawerken mag (WebKit legt soms later uit); pas als ook een tweede periode druk is, is het een lus.
      const window8 = () => page.evaluate(() => new Promise(done => { let n = 0; const o = new MutationObserver(l => { n += l.length; }); o.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true}); setTimeout(() => { o.disconnect(); done(n); }, 800); }));
      let busy = await window8();
      if (busy > 12) busy = await window8();
      if (busy > 12) fails.push('scherm blijft herberekenen (' + busy + ' wijzigingen in 0,8 s)');
      if (errors.length) fails.push('scriptfout: ' + errors[0]);
      report.push({vp: vp.name, id, fails, map: m.map});
      if (fails.length || process.env.TOPO_SHOTS) await page.screenshot({path: `${out}/${vp.name}-${id}.png`});
    } catch (e) {
      report.push({vp: vp.name, id, fails: ['scenario faalde: ' + e.message.split('\n').slice(0, 3).join(' ')]});
    } finally {
      await page.close();
    }
}
// Een paar schermen tegelijk: sneller, en elk scherm heeft zijn eigen pagina.
const jobs = [];
for (const vp of VIEWPORTS) {
  if (onlyVp && !onlyVp.has(vp.name)) continue;
  for (const [id, url, act, mapQuestion] of SCENARIOS) if (!only || only.has(id)) jobs.push(() => runScreen(vp, id, url, act, mapQuestion));
}
const workers = Math.max(1, Number(process.env.TOPO_PARALLEL || 3));
await Promise.all(Array.from({length: workers}, async () => { while (jobs.length) await jobs.shift()(); }));
report.sort((a, b) => VIEWPORTS.findIndex(v => v.name === a.vp) - VIEWPORTS.findIndex(v => v.name === b.vp));

// Interactie: slepen en knijpen bewegen de kaart en geven nooit een antwoord; knoppen zoomen; terug-knop herstelt.
async function interaction(id, url, prep) {
  if (only && !only.has('interactie')) return;
  const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const fails = [];
  try {
    await page.goto(base + url, {waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(300);
    await prep(page);
    await page.waitForTimeout(400);
    const vb = () => page.evaluate(() => document.querySelector('#map svg').getAttribute('viewBox').split(' ').map(Number));
    const box = await page.locator('#map').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const home = await vb();
    // Slepen met de vinger (pointer-events zoals een telefoon ze stuurt).
    await page.evaluate(([x, y]) => {
      const t = document.elementFromPoint(x, y), o = {bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true};
      t.dispatchEvent(new PointerEvent('pointerdown', {...o, clientX: x, clientY: y}));
      for (let i = 1; i <= 8; i++) t.dispatchEvent(new PointerEvent('pointermove', {...o, clientX: x + i * 12, clientY: y + i * 6}));
      t.dispatchEvent(new PointerEvent('pointerup', {...o, clientX: x + 96, clientY: y + 48}));
      t.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: x + 96, clientY: y + 48}));
    }, [cx, cy]);
    await page.waitForTimeout(250);
    const dragged = await vb();
    if (Math.abs(dragged[0] - home[0]) < 1 && Math.abs(dragged[1] - home[1]) < 1) fails.push('slepen verschuift de kaart niet');
    if (Math.abs(dragged[2] - home[2]) > 0.5) fails.push('slepen verandert de zoom');
    if (await page.locator('#next').isVisible() || await page.locator('#feedback').isVisible()) fails.push('slepen gaf een antwoord');
    // Knijpen: twee vingers uit elkaar = inzoomen.
    await page.evaluate(([x, y]) => {
      const t = document.elementFromPoint(x, y), o = id => ({bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch'});
      t.dispatchEvent(new PointerEvent('pointerdown', {...o(1), clientX: x - 30, clientY: y}));
      t.dispatchEvent(new PointerEvent('pointerdown', {...o(2), clientX: x + 30, clientY: y}));
      for (let i = 1; i <= 6; i++) { t.dispatchEvent(new PointerEvent('pointermove', {...o(1), clientX: x - 30 - i * 12, clientY: y})); t.dispatchEvent(new PointerEvent('pointermove', {...o(2), clientX: x + 30 + i * 12, clientY: y})); }
      t.dispatchEvent(new PointerEvent('pointerup', {...o(1), clientX: x - 102, clientY: y}));
      t.dispatchEvent(new PointerEvent('pointerup', {...o(2), clientX: x + 102, clientY: y}));
    }, [cx, cy]);
    await page.waitForTimeout(250);
    const pinched = await vb();
    if (!(pinched[2] < dragged[2] * 0.6)) fails.push('knijpen zoomt niet in (' + Math.round(dragged[2]) + ' → ' + Math.round(pinched[2]) + ')');
    if (await page.locator('#next').isVisible()) fails.push('knijpen gaf een antwoord');
    const homeBtn = page.locator('.game-board .vast-zoom-home');
    if (!(await homeBtn.isVisible())) fails.push('terug-knop verschijnt niet na zoomen');
    else { await homeBtn.click(); await page.waitForTimeout(200); const back = await vb(); if (back.some((v, i) => Math.abs(v - home[i]) > 0.5)) fails.push('terug-knop herstelt de kaart niet'); }
    await page.locator('.game-board .vast-zoom-in').click(); await page.waitForTimeout(200);
    const zin = await vb();
    if (!(zin[2] < home[2] * 0.8)) fails.push('+ zoomt niet in');
    // − mag uitgeschakeld raken zodra de hele kaart in beeld is.
    for (let k = 0; k < 2; k++) { const out = page.locator('.game-board .vast-zoom-out'); if (await out.isEnabled()) await out.click(); }
    await page.waitForTimeout(200);
    const zout = await vb();
    if (!(zout[2] > zin[2])) fails.push('− zoomt niet uit');
    // Stippen blijven even groot op het scherm (VO tekent ze opnieuw).
    if (url.includes('/vo/')) {
      await page.waitForTimeout(200);
      const dot = await page.evaluate(() => { const d = document.querySelector('#map .city-dot, #map .capital-dot'); return d ? d.getBoundingClientRect().width : null; });
      if (dot !== null && (dot < 6 || dot > 14)) fails.push('stip na zoomen ' + Math.round(dot) + 'px (verwacht ±9px)');
    }
    // Spiekkaart: + zoomt, geen scrollvlak.
    if (await page.locator('#showAnswer').isVisible()) {
      await page.locator('#showAnswer').click(); await page.waitForTimeout(300);
      const svb = () => page.evaluate(() => document.querySelector('#sheetMap svg').getAttribute('viewBox').split(' ').map(Number));
      const s0 = await svb();
      await page.locator('#sheetMap .vast-zoom-in').click(); await page.waitForTimeout(200);
      const s1 = await svb();
      if (!(s1[2] < s0[2] * 0.8)) fails.push('spiekkaart + zoomt niet in');
      await page.locator('#closeSheet').click();
    }
  } catch (e) { fails.push('scenario faalde: ' + e.message.split('\n').slice(0, 3).join(' ')); }
  if (errors.length) fails.push('scriptfout: ' + errors[0]);
  report.push({vp: 'interactie', id, fails});
  await page.close();
}
// Afdrukken: de spiekkaart van Noord-Nederland komt helemaal op papier, met de antwoordenlijst.
if (!only || only.has('interactie')) {
  const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
  const fails = [];
  try {
    await page.goto(base + '/topo/', {waitUntil: 'domcontentloaded'});
    await privacy(page);
    await page.locator('#openSheet').click();
    await page.waitForTimeout(300);
    // Eerst inzoomen: de afdruk moet toch de hele kaart tonen, en daarna je eigen beeld terugzetten.
    await page.locator('#sheetMap .vast-zoom-in').click(); await page.locator('#sheetMap .vast-zoom-in').click();
    await page.waitForTimeout(200);
    const zoomed = await page.evaluate(() => document.querySelector('#sheetMap svg').getAttribute('viewBox'));
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    const printed = await page.evaluate(() => { const s = document.querySelector('#sheetMap svg'); return [s.getAttribute('viewBox'), s.dataset.full]; });
    if (printed[0] !== printed[1]) fails.push('afdruk toont alleen het ingezoomde stuk (' + printed[0] + ')');
    await page.emulateMedia({media: 'print'});
    const pr = await page.evaluate(() => {
      const tags = document.getElementById('answerTags'), modal = document.querySelector('#sheetLayer .modal'), svg = document.querySelector('#sheetMap svg');
      const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
      return {tags: tags.getClientRects().length > 0 && tags.getBoundingClientRect().height > 20, clipped: modal.scrollHeight > modal.clientHeight + 2,
        ratio: Math.abs(r.width / r.height - vb.width / vb.height) < 0.05, zoom: [...document.querySelectorAll('#sheetLayer .vast-zoom')].some(z => z.getClientRects().length)};
    });
    if (!pr.tags) fails.push('antwoordenlijst ontbreekt bij afdrukken');
    if (pr.clipped) fails.push('spiekkaart wordt afgesneden bij afdrukken');
    if (!pr.ratio) fails.push('kaart wordt bijgesneden bij afdrukken');
    if (pr.zoom) fails.push('zoomknoppen staan op de afdruk');
    await page.emulateMedia({media: 'screen'});
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    const after = await page.evaluate(() => document.querySelector('#sheetMap svg').getAttribute('viewBox'));
    if (after !== zoomed) fails.push('na afdrukken staat het eigen beeld niet terug');
  } catch (e) { fails.push('scenario faalde: ' + e.message.split('\n')[0]); }
  report.push({vp: 'interactie', id: 'afdrukken', fails});
  await page.close();
}
// Draaien: Noord-Nederland (aanwijzen) houdt na liggend → staand alle plekken onder de spelbalk vandaan.
if (!only || only.has('interactie')) {
  const page = await browser.newPage({viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
  const fails = [];
  try {
    await page.goto(base + '/topo/', {waitUntil: 'domcontentloaded'});
    await privacy(page);
    await page.locator('#start').click();
    await page.waitForTimeout(400);
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const hud = document.querySelector('#game .game-top').getBoundingClientRect(), svg = document.querySelector('#map svg');
      // hoogste klikbare plek op de kaart
      let top = Infinity;
      for (const n of svg.querySelectorAll('[data-place]')) { const b = n.getBoundingClientRect(); if (b.height) top = Math.min(top, b.top); }
      return {hudBottom: hud.bottom, top, vb: svg.getAttribute('viewBox')};
    });
    if (!(r.top >= r.hudBottom - 1)) fails.push('na draaien ligt een plek onder de spelbalk (' + Math.round(r.top) + ' < ' + Math.round(r.hudBottom) + ')');
    if (r.vb === '0 0 1240 900') fails.push('na draaien naar staand is geen ruimte onder de spelbalk gemaakt');
    await page.setViewportSize({width: 844, height: 390});
    await page.waitForTimeout(700);
    const extra = await page.evaluate(() => { const vb = document.querySelector('#map svg').getAttribute('viewBox').split(' ').map(Number); return vb; });
    if (extra.join(' ') !== '0 0 1240 900') fails.push('liggend staat er nog ruimte voor een spelbalk boven de kaart (' + extra.join(' ') + ')');
  } catch (e) { fails.push('scenario faalde: ' + e.message.split('\n')[0]); }
  report.push({vp: 'interactie', id: 'draaien-noord', fails});
  await page.close();
}
const ready2 = p => p.waitForFunction(() => document.getElementById('loading')?.classList.contains('hide'), null, {timeout: 15000});
await interaction('po-north', '/topo/', async p => { await privacy(p); await p.locator('#start').click(); });
await interaction('po-nl', '/topo/nederland/?mode=point&questions=5', ready2);
await interaction('vo-point', '/topo/vo/spel/?set=ob2-landen-afrika&mode=point&questions=5', ready2);
await interaction('vo-choice', '/topo/vo/spel/?set=ob1-nl-basis&mode=choice&questions=5', ready2);

await browser.close();
const failed = report.filter(r => r.fails.length);
for (const r of failed) console.log(`✗ ${r.vp} ${r.id}: ${r.fails.join('; ')}`);
console.log(`TOPO vast scherm: ${report.length - failed.length}/${report.length} in orde`);
if (failed.length && !process.env.TOPO_REPORT_ONLY) process.exit(1);
