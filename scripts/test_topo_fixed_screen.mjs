// Vaste-schermproef voor alle TOPO-pagina's (PO en VO): geen scroll, alles in beeld, kaart als hoofdvlak.
// Gebruik: node scripts/test_topo_fixed_screen.mjs   (server op 127.0.0.1:8765 of TOPO_BASE)
//          TOPO_ONLY=vo-choice,po-nl-point  draait alleen deze scenario's; TOPO_VP=360x640 alleen dit formaat.
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
for (const vp of VIEWPORTS) {
  if (onlyVp && !onlyVp.has(vp.name)) continue;
  for (const [id, url, act, mapQuestion] of SCENARIOS) {
    if (only && !only.has(id)) continue;
    const page = await browser.newPage({viewport: {width: vp.width, height: vp.height}, isMobile: Boolean(vp.phone), hasTouch: Boolean(vp.phone), deviceScaleFactor: 1});
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
      if (errors.length) fails.push('scriptfout: ' + errors[0]);
      report.push({vp: vp.name, id, fails, map: m.map});
      if (fails.length || process.env.TOPO_SHOTS) await page.screenshot({path: `${out}/${vp.name}-${id}.png`});
    } catch (e) {
      report.push({vp: vp.name, id, fails: ['scenario faalde: ' + e.message.split('\n')[0]]});
    } finally {
      await page.close();
    }
  }
}
await browser.close();
const failed = report.filter(r => r.fails.length);
for (const r of failed) console.log(`✗ ${r.vp} ${r.id}: ${r.fails.join('; ')}`);
console.log(`TOPO vast scherm: ${report.length - failed.length}/${report.length} in orde`);
if (failed.length && !process.env.TOPO_REPORT_ONLY) process.exit(1);
