import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Science Observatory toont vijf verschillende onderzoeksruimtes', () => {
  const html = load('content/science-observatory/landing.html');
  const cards = [...html.matchAll(/<a class="so-card(?: so-featured)?" href="([^"]+)"/g)];
  assert.equal(cards.length, 5);
  assert.equal(new Set(cards.map(m => m[1])).size, 5);
  assert.match(cards[0][1], /\/labs\/natuurkunde\/$/);
  assert.match(html, /data-so-filter="nf"/);
  assert.match(html, /data-so-filter="wa"/);
  assert.match(html, /data-so-filter="wb"/);
  assert.match(html, /Niet alle modellen/);
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
  assert.match(nav, /Natuurkunde · 53 proeven/);
  assert.match(nav, /Physics · 53 experiments/);
});

test('Websitegenerator gebruikt de bronbestanden en aparte observatoriarubriek', () => {
  const script = load('scripts/build_site.py');
  assert.match(script, /science_source \/ "labs" \/ \(slug \+ "\.html"\)/);
  assert.match(script, /observe_names = \{/);
  assert.match(script, /"observatoria", "Observatoria"/);
});