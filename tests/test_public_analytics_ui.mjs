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
  assert.match(html, /fetch\("\/statistieken\/data\.json"/);
  assert.match(html, /Nog geen bezoekersgegevens beschikbaar/);
  assert.match(html, /Bouncepercentage en handelingen binnen interactieve simulaties worden hier niet gemeten/);
});

test('dashboard labels comparison periods and summary periods separately', () => {
  assert.match(html, /Afgelopen 7 kalenderdagen/);
  assert.match(html, /Afgelopen 30 kalenderdagen/);
  assert.match(html, /Meest bekeken pagina's \(30 dagen\)/);
  assert.match(html, /Waar komt bezoek vandaan\? \(30 dagen\)/);
});
