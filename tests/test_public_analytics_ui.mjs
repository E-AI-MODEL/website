import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('statistieken/index.html', 'utf8');

test('public dashboard is real HTML with a working JavaScript program', () => {
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /body class="eai-refresh"/);
  assert.match(html, /id="visits"/);
  assert.match(html, /id="views"/);
  assert.match(html, /id="chart-content"/);
  assert.match(html, /data-days="7"/);
  assert.match(html, /data-days="30"/);
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(inlineScripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(inlineScripts[0][1]));
});

test('public page never contains an API secret, account token, or fake count', () => {
  assert.doesNotMatch(html, /CLOUDFLARE_ANALYTICS_TOKEN|Authorization:\s*Bearer|CLOUDFLARE_ACCOUNT_ID/);
  assert.match(html, /fetch\(demo\?"\/statistieken\/demo\.json":"\/statistieken\/data\.json"/);
  assert.match(html, /Boolean\(data\.demo\)!==demo/);
  assert.match(html, /id="demo-note"/);
  assert.match(html, /id="page-select"/);
  assert.match(html, /id="unique"/);
  assert.match(html, /id="bounce"/);
  assert.match(html, /id="clicks"/);
  assert.doesNotMatch(html, /<div class="kpi">[^<]*<span[^>]*>[^<]*<\/span><strong[^>]*>[^<]*<\/strong><small>/);
  assert.doesNotMatch(html, /Cloudflare: geen unieke personen|Gemiddelde, afgerond|id="unique-note"|id="bounce-note"|id="clicks-note"/);
  assert.match(html, /<section class="overview"/);
  assert.match(html, /<div class="insight-frame"/);
  assert.match(html, /<details class="details">/);
  assert.match(html, /assets\/eai-logo\.svg/);
  assert.match(html, /id="visits">—<\/strong><\/div>/);
  assert.match(html, /Nog geen bezoekersgegevens beschikbaar/);
  assert.match(html, /Cloudflare levert paginaweergaven en bezoeken/);
  assert.match(html, /statistieken\/collect\.php/);
  assert.match(html, /site-analytics\.js/);
  assert.match(html, /id="analytics-optout"/);
  assert.match(html, /function mergeCollected\(extra\)/);
});

test('dashboard keeps the same compact KPI grid on mobile and desktop', () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
  assert.match(css, /\.kpis\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /\.kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.kpi\{min-height:111px/);
  assert.doesNotMatch(css, /\.kpi small/);
  assert.match(css, /--accent:#e8583a/);
});

test('dashboard labels comparison periods and summary periods separately', () => {
  assert.match(html, /Afgelopen 7 kalenderdagen/);
  assert.match(html, /Afgelopen 30 kalenderdagen/);
  assert.match(html, /Meest bekeken pagina's \(30 dagen\)/);
  assert.ok(html.includes("Waar komt bezoek vandaan? (30 dagen)"));
});

test('demo mode stays isolated and its fictitious values add up', () => {
  const demo = JSON.parse(fs.readFileSync('statistieken/demo.json', 'utf8'));
  assert.equal(demo.schema, 1);
  assert.equal(demo.demo, true);
  assert.equal(demo.visits, 500);
  assert.equal(demo.unique_visitors, 143);
  assert.equal(demo.daily.length, 30);
  assert.equal(demo.daily.reduce((n, x) => n + x.visits, 0), 500);
  assert.equal(demo.daily.reduce((n, x) => n + x.views, 0), demo.views);
  assert.equal(demo.pages.reduce((n, x) => n + x.views, 0), demo.views);
  assert.equal(demo.pages.reduce((n, x) => n + x.clicks, 0), demo.clicks);
  assert.equal(demo.click_targets.reduce((n, x) => n + x.clicks, 0), demo.clicks);
  assert.equal(demo.period_metrics["30"].unique_visitors, 143);
  assert.equal(demo.period_metrics["30"].clicks, demo.clicks);
  assert.equal(demo.source, "Voorbeeld");
  assert.match(html, /<strong>Voorbeeld<\/strong>/);
  assert.doesNotMatch(html, /fictieve bezoekers|fictieve getallen|gegevens zijn verzonnen/i);
  assert.ok(html.includes('new URLSearchParams(window.location.search).get("demo")==="1"'));
  assert.doesNotMatch(html, /CLOUDFLARE_ANALYTICS_TOKEN|Authorization:\s*Bearer/);
});
