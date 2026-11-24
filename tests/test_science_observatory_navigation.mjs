import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Vakinhoud toont de afgesproken namen en een publieke Melkweg-ingang', () => {
  const html = load('content/science-observatory/landing.html');
  for (const title of ['Natuurkunde', 'Wiskunde', 'De Melkweg', 'Het lichaam in 3D', 'Hoe werkt een taalmodel?', 'Sport en bewegen', 'Oceanografie']) {
    assert.ok(html.includes('<h3>' + title + '</h3>'), title);
  }
  assert.equal((html.match(/class="so-card"/g) || []).length, 7);
  assert.match(html, /\/tools\/melkweg-lab\//);
  assert.match(html, /\/tools\/science-observatory\/labs\/melkweg\//);
  assert.match(html, /\/tools\/anatomie\/labs\/hartslag\//);
  assert.match(html, /\/tools\/lo-aanvalslab\//);
  assert.match(html, /href="\/tools\/abyss\//);
  assert.doesNotMatch(html, /53 proeven|NF \/ 01|Nieuwe proefversie/);
  assert.match(html, /niet alle natuurkundige modellen/i);
});

test('Toegankelijke Melkwegversie geeft vragen en feedback zonder 3D-model te vervangen', () => {
  const html = load('content/melkweg-lab/index.html');
  assert.match(html, /const GUIDE=\{/);
  assert.match(html, /data-guide-choice/);
  assert.match(html, /guideAttempts/);
  assert.match(html, /function guideHTML/);
  assert.match(html, /Dat klopt met dit model/);
  assert.match(html, /function modeSet/);
  assert.match(html, /function camSet/);
});

test('Natuurkunde is een herkenbare zelfstandige proefversie', () => {
  const html = load('content/science-observatory/labs/natuurkunde.html');
  const match = html.match(/window\.CATALOG=(\[[^\n]+\]);<\/script>/);
  assert.ok(match, 'catalogus moet als JSON worden ingebed');
  const catalog = JSON.parse(match[1]);
  assert.equal(catalog.length, 53);
  assert.equal(new Set(catalog.map(m => m.url)).size, 53);
  for (const id of ['labSection', 'experimentTree', 'stage', 'plot', 'comparisonRows', 'controls']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /Natuurkunde in 53 onderwerpen/);
  assert.match(html, /href="\/tools\/science-observatory\/"/);
});

test('Nederlands en Engels tonen observatoria apart van ontwerptools', () => {
  const nl = load('nl/tools/index.html');
  const en = load('en/tools/index.html');
  const nav = load('assets/site-refresh.js');
  assert.match(nl, /href="#vak-natuurkunde"/);
  assert.match(nl, /href="#vak-oceanografie"/);
  assert.match(nl, /href="\/tools\/abyss\/"/);
  assert.match(en, /href="#vak-oceanografie"/);
  assert.match(en, /href="#vak-lessen-en-presentaties"/);
  assert.match(nav, /\['Zelf aan de slag'/);
  assert.match(nav, /\['Explore & create'/);
  assert.doesNotMatch(nav, /Galactisch Observatorium|LLM Observatorium/);
});

test('Websitegenerator gebruikt de bronbestanden en aparte observatoriarubriek', () => {
  const script = load('scripts/build_site.py');
  assert.match(script, /science_source \/ "labs" \/ \(slug \+ "\.html"\)/);
  assert.match(script, /observe_names = \{/);
  assert.match(script, /"observatoria", "Observatoria"/);
});

test('Compact hoofdmenu behoudt de volledige proefcatalogus in zoeken', () => {
  const source = load('scripts/prepare_ui.py');
  assert.match(source, /'Zelf aan de slag'/);
  assert.match(source, /'Explore & create'/);
  assert.match(source, /'Artikelen'/);
  assert.match(source, /'Natuurkunde'/);
  assert.match(source, /maths\.append\(/);
  assert.match(source, /Wiskunde ' \+ variant.upper/);
  assert.match(source, /'Menselijk lichaam'/);
  assert.match(source, /\/tools\/melkweg-lab\/#/);
  assert.match(source, /populate_physics_topics/);
  assert.match(source, /'LLMscan'/);
  assert.match(source, /site_search_records/);
  const script = load('assets/site-navigation.js');
  assert.match(script, /site-search-index\.json/);
  assert.match(script, /aria-label/);
  assert.match(script, /resultLink/);
  const mathA = load('content/science-observatory/labs/wiskunde-a.html');
  const mathB = load('content/science-observatory/labs/wiskunde-b.html');
  const galaxy = load('content/science-observatory/labs/melkweg.html');
  for (const model of [mathA, mathB]) {
    assert.match(model, /M\.findIndex\(m=>m\.id===location\.hash\.slice\(1\)\)/);
    assert.match(model, /history\.replaceState/);
  }
  assert.match(galaxy, /modeSet\(MODE\[location\.hash\.slice\(1\)\]/);
});
