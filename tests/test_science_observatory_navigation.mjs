import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Startpagina groepeert onderzoeksruimtes in zes herkenbare onderwerpen', () => {
  const html = load('content/science-observatory/landing.html');
  for (const title of ['Natuurkunde', 'Wiskunde', 'Galactisch Observatorium', 'Anatomie van de mens', 'Hoe werkt AI?', 'Sport en bewegen']) {
    assert.ok(html.includes('<h3>' + title + '</h3>'), title);
  }
  assert.equal((html.match(/class="so-card"/g) || []).length, 6);
  assert.match(html, /\/tools\/melkweg-lab\//);
  assert.match(html, /\/tools\/science-observatory\/labs\/melkweg\//);
  assert.match(html, /\/tools\/anatomie\/labs\/hartslag\//);
  assert.match(html, /\/tools\/lo-aanvalslab\//);
  assert.doesNotMatch(html, /ABYSS|href="\/tools\/abyss\//);
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
  assert.match(html, /NATUURKUNDE · PROEFVERSIE/);
  assert.match(html, /href="\/tools\/science-observatory\/"/);
});

test('Nederlands en Engels tonen observatoria apart van ontwerptools', () => {
  const nl = load('nl/tools/index.html');
  const en = load('en/tools/index.html');
  const nav = load('assets/site-refresh.js');
  assert.match(nl, /id="observatoria"/);
  assert.match(nl, /id="ontwerpen"/);
  assert.match(en, /Interactive observatories/);
  assert.match(nav, /Natuurkundeproeven/);
  assert.match(nav, /Physics experiments/);
});

test('Websitegenerator gebruikt de bronbestanden en aparte observatoriarubriek', () => {
  const script = load('scripts/build_site.py');
  assert.match(script, /science_source \/ "labs" \/ \(slug \+ "\.html"\)/);
  assert.match(script, /observe_names = \{/);
  assert.match(script, /"observatoria", "Observatoria"/);
});

test('De publieke hoofdnavigatie heeft observatoria apart van hulpmiddelen', () => {
  const source = load('scripts/prepare_ui.py');
  assert.match(source, /\('Observatoria', \[/);
  assert.match(source, /\('Observatories', \[/);
  assert.match(source, /'Natuurkundeproeven'/);
  assert.match(source, /'Physics: 53 experiments \(Dutch\)'/);
  const observatoria = source.slice(source.indexOf("('Observatoria', ["), source.indexOf("('Tools', [", source.indexOf("('Observatoria', [")));
  assert.match(observatoria, /Anatomie van de mens/);
  assert.doesNotMatch(observatoria, /EAI Prompt Framework/);
  const tools = source.slice(source.indexOf("('Tools', [", source.indexOf("('Observatoria', [")), source.indexOf("('Over', [", source.indexOf("('Observatoria', [")));
  assert.match(tools, /EAI Prompt Framework/);
  assert.doesNotMatch(tools, /Anatomie van de mens/);
  assert.equal((source.match(/'\/tools\/anatomie\//g) || []).length, 2);
});
