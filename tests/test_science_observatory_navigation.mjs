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
  assert.match(html, /niet voor alle modellen/);
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

test('De publieke hoofdnavigatie heeft observatoria apart van hulpmiddelen', () => {
  const source = load('scripts/prepare_ui.py');
  assert.match(source, /\('Observatoria', \[/);
  assert.match(source, /\('Observatories', \[/);
  assert.match(source, /'Natuurkunde: 53 proeven'/);
  assert.match(source, /'Physics: 53 experiments \(Dutch\)'/);
  const observatoria = source.slice(source.indexOf("('Observatoria', ["), source.indexOf("('Tools', [", source.indexOf("('Observatoria', [")));
  assert.match(observatoria, /Anatomisch Observatorium/);
  assert.doesNotMatch(observatoria, /EAI Prompt Framework/);
  const tools = source.slice(source.indexOf("('Tools', [", source.indexOf("('Observatoria', [")), source.indexOf("('Over', [", source.indexOf("('Observatoria', [")));
  assert.match(tools, /EAI Prompt Framework/);
  assert.doesNotMatch(tools, /Anatomisch Observatorium/);
  assert.equal((source.match(/'\/tools\/anatomie\//g) || []).length, 2);
});
