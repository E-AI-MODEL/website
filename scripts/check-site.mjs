import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const paths = ['index.html'];
for (const language of ['en', 'nl']) {
  const visit = folder => {
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      const next = join(folder, item.name);
      if (item.isDirectory()) visit(next);
      else if (item.name === 'index.html') paths.push(next.slice(root.length + 1));
    }
  };
  visit(join(root, language));
}
let errors = 0;
for (const path of paths) {
  const html = readFileSync(join(root, path), 'utf8');
  const fail = message => { console.error(path + ': ' + message); errors++; };
  if (!/<html\s+lang="(?:en|nl)"/i.test(html)) fail('missing language declaration');
  if (!/<title>[^<]+<\/title>/.test(html)) fail('missing document title');
  if (!/<link\s+rel="canonical"/.test(html)) fail('missing canonical');
  if (!/class="eai-lang"/.test(html)) fail('missing NL/EN selector');
  if ((html.match(/<h1\b/gi) || []).length !== 1) fail('expected exactly one H1');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]);
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) fail('duplicate id: ' + id);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    const url = match[1];
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    const pathname = url.split(/[?#]/)[0];
    const localFile = pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
    if (!existsSync(resolve(root, localFile))) fail('broken URL: ' + url);
  }
}
console.log('Checked ' + paths.length + ' bilingual pages. Errors: ' + errors);
if (errors) process.exit(1);
