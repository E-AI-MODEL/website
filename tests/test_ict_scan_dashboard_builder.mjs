import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const load = path => readFileSync(join(root,path),'utf8');
const html = load('tools/ict-scan/index.html');
const js = load('tools/ict-scan/dashboard-composer.js');
const css = load('tools/ict-scan/dashboard-composer.css');

test('Builder uses the existing ICT-scan data instead of a second record store',()=>{
  assert.match(js,/state\[d\.store\]/);
  assert.match(js,/function filtered\(d\)/);
  assert.match(js,/window\.EmmausRecordCards/);
  assert.doesNotMatch(js,/fetch\(['"]https?:/);
});
test('Category filter, three visualization modes and dataset export are wired',()=>{
  for(const id of ['dsPrimary','dsCategoryFilter','dsBuilderData','dsImportFile','dsExport','dsCanvas'])
    assert.match(html,new RegExp('id="'+id+'"'));
  for(const fn of ['exportBuilderData','importDesign','movePart','resizePart','enableDrag'])assert.ok(js.includes('function '+fn));
  for(const mode of ["['line','Lijnen']","['bar','Staven']","['donut','Ring']"])assert.ok(js.includes(mode));
  assert.ok(html.includes('href="./dashboard-builder-app/"'));
});
test('Card sizing and keyboard-friendly move buttons have responsive styles',()=>{
  assert.match(css,/ds-component-actions/);
  assert.match(css,/ds-ring-layout/);
  assert.match(css,/@media\(max-width:610px\)/);
  assert.match(js,/aria-label','Verplaats/);
  assert.match(js,/config\.order/);
  assert.match(js,/SIZES\.includes/);
});
test('Original upstream Builder bundle is built from a pinned commit, not a remote iframe',()=>{
  const wf=load('.github/workflows/import-ict-dashboard-builder.yml');
  assert.match(wf,/0c72e80b6b2106c24dd643607157932ca25f7717/);
  assert.match(wf,/npm ci --ignore-scripts/);
  assert.match(wf,/npm run build/);
  assert.match(wf,/cp -a .*dist/);
  const builder='tools/ict-scan/dashboard-builder-app';
  if(existsSync(join(root,builder))){
    assert.ok(existsSync(join(root,builder,'index.html')));
    assert.ok(existsSync(join(root,builder,'LICENSE')));
  }
});
test('No school source data is added to the self-hosted Builder',()=>{
  const pipeline=load('scripts/build_site.py');
  assert.match(pipeline,/ict_builder = ict_scan_source \/ "dashboard-builder-app"/);
  assert.match(pipeline,/shutil\.copytree\(/);
  assert.match(pipeline,/Never copy the application data sources/);
});
