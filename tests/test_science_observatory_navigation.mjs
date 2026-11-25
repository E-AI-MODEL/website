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

test('Leeuw: bronrecords, publicatieroute, zeven standen en onafhankelijke rekenwaarden', () => {
  const route = '/tools/science-observatory/labs/leeuw/';
  const html = load('content/science-observatory/labs/leeuw.html');
  const generated = JSON.parse(load('catalog/generated-tool-sources.json')).generated;
  assert.deepEqual(generated.find(item=>item.output==='tools/science-observatory/labs/leeuw/index.html'),
    {output:'tools/science-observatory/labs/leeuw/index.html',source:'content/science-observatory/labs/leeuw.html'});
  // The exact generated copy is checked on the final site-release, not the Git checkout.
  assert.ok(load('content/science-observatory/landing.html').includes(route));
  assert.ok(load('scripts/prepare_ui.py').includes(route));
  assert.ok(load('sitemap.xml').includes('https://eaimodel.nl' + route));
  assert.match(load('scripts/build_site.py'), /"wiskunde-b", "leeuw"\)/);
  const data = JSON.parse(html.match(/<script id="leo-data" type="application\/json">([^]*?)<\/script>/)[1]);
  assert.equal(data.stars.length, 9);
  assert.equal(new Set(data.stars.map(s=>s[0])).size, 9);
  assert.ok(data.paths.flat().every(id=>data.stars.some(s=>s[0]===id)));
  assert.equal((html.match(/class="nav-btn(?: active)?" data-mode=/g)||[]).length,7);
  const ctx = {window:{},document:{getElementById:()=>({textContent:JSON.stringify(data)})}};
  const script=html.match(/<script id="leo-model">([^]*?)<\/script>/)[1];
  new Function('window','document',script)(ctx.window,ctx.document);
  const m=ctx.window.LEO_MODEL;
  assert.ok(Math.abs(m.byId.get(49669).d-79.2989)<.001);
  assert.ok(Math.abs(m.byId.get(49583).d-1815.510)<.001);
  assert.ok(Math.abs(m.separation(m.byId.get(49669).r,m.byId.get(49583).r)-1736.502)<.01);
  for(const star of m.stars){
    assert.ok(Math.abs(m.norm(star.u)-1)<1e-10);
    assert.ok(star.lo < star.d && star.d < star.hi);
    assert.ok(Math.abs(m.norm(m.pos(star,0))-star.d)<1e-8);
    assert.ok(Math.abs(m.angle(star.r,m.pos(star,0)))<.000003);
    assert.equal(m.separation(star.r,star.r),0);
    assert.ok(m.norm(m.sub(m.pos(star,1000),star.r))>0);
  }
  assert.ok(Math.abs(m.flux(5,0)-.01)<1e-10);
  assert.ok(Math.abs(m.gmst(Date.UTC(2000,0,1,12))-280.46061837)<1e-8);
  const h=m.horizon({ra:0,dec:0},Date.UTC(2000,0,1,12),0,-280.46061837);
  assert.ok(Math.abs(h.alt-90)<1e-6);
});

test('Leeuw gebruikt vaste Melkweg-console en behoudt de projectiebediening', () => {
  const html=load('content/science-observatory/labs/leeuw.html');
  for(const id of ['app','navigation','stage','scene','quickRange','labDock','graphToggle','spin','chart','panelClose']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/height:100dvh/);
  assert.match(html,/position:fixed;inset:0/);
  assert.match(html,/function startIntro\(/);
  assert.match(html,/s\.blend=s\.anim\.from\+/);
  assert.match(html,/Math\.min\(2\.5,r\)/);
  assert.match(html,/line\(c,a,b,"#9ab9cf8c",\.65\)/);
});
