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
test('Category filters, chart modes and connected original Builder are wired',()=>{
  for(const id of ['dsPrimary','dsCategoryFilter','dsFullBuilder','builderSurface','builderFrame','builderWriteback','builderWriteSubmit','dsImportFile','dsExport','dsCanvas'])
    assert.match(html,new RegExp('id="'+id+'"'));
  for(const fn of ['importDesign','movePart','resizePart','enableDrag'])assert.ok(js.includes('function '+fn));
  for(const mode of ["['line','Lijnen']","['bar','Staven']","['donut','Ring']"])assert.ok(js.includes(mode));
  assert.ok(html.includes('frame-src \'self\''));
  assert.ok(html.includes('type="button" id="dsFullBuilder"'));
  assert.ok(!html.includes('id="dsBuilderData"'));
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
    const entry=load('tools/ict-scan/dashboard-builder-app/index.html');
    assert.match(entry,/Content-Security-Policy/);
    assert.match(entry,/frame-ancestors 'self'/);
    const asset=entry.match(/src="\.\/assets\/(index-[^"]+\.js)"/)?.[1];
    assert.ok(asset,'The original Vite app bundle is not linked');
    assert.match(load(builder+'/assets/'+asset),/emmaus-ict-builder-v1/,'The compiled upstream app must contain our source-backed bridge');

  }
});
test('No school source data is added to the self-hosted Builder',()=>{
  const pipeline=load('scripts/build_site.py');
  assert.match(pipeline,/ict_builder = ict_scan_source \/ "dashboard-builder-app"/);
  assert.match(pipeline,/shutil\.copytree\(/);
  assert.match(pipeline,/Never copy the application data sources/);
});

test('Direct handshake never uses manual file upload or crosses origins',()=>{
  const parent=load('tools/ict-scan/dashboard-bridge.js');
  const child=load('tools/ict-scan/builder-src/ict-bridge.js');
  assert.match(parent,/event\.origin!==location\.origin/);
  assert.match(child,/event\.origin!==location\.origin/);
  assert.match(parent,/event\.source!==frame\.contentWindow/);
  assert.match(child,/event\.source!==window\.parent/);
  assert.match(child,/saveDataset\(/);
  assert.doesNotMatch(child,/persistDataset\(/);
  assert.match(parent,/EmmausRecordCards/);
  assert.match(parent,/source-data/);
  assert.match(child,/writeback-request/);
  assert.match(parent,/builderWriteback/);
});
test('Card source changes also trigger a separate confirmation popup',()=>{
  const js=load('tools/ict-scan/record-github.js');
  const css=load('tools/ict-scan/record-cards.css');
  assert.match(js,/confirmChangePopup/);
  assert.match(js,/if\(!await confirmChangePopup\(drafts\)\)/);
  assert.match(css,/card-publish-review::backdrop/);
});
test('Writeback is a reviewed GitHub PR and never sends source data',()=>{
  const parent=load('tools/ict-scan/dashboard-bridge.js');
  assert.match(parent,/builderWriteConsent/);
  assert.match(parent,/builderWriteToken/);
  assert.match(parent,/POST','\/pulls'/);
  assert.match(parent,/POST','\/git\/refs'/);
  assert.match(parent,/const SOURCE='tools\/ict-scan\/dashboard-layouts\/'/);
  assert.doesNotMatch(parent,/sourceRecords:/);
  assert.match(parent,/pending=checkLayout/);
  assert.match(parent,/original=copy\(pending\)/);
  const data=JSON.parse(load('tools/ict-scan/dashboard-layouts/apps.json'));
  assert.equal(data.schema,'eai-ict-dashboard-layout-v1');
  assert.equal(data.source,'apps');
  assert.equal(data.tiles.length,3);
  assert.equal(JSON.stringify(data).includes('records":['),false);
});
test('Upstream is patched and rebuilt from source rather than by tampering with the minified bundle',()=>{
  const script=load('scripts/patch_ict_dashboard_builder.py');
  const workflow=load('.github/workflows/import-ict-dashboard-builder.yml');
  assert.match(script,/mountEmmausBridge/);
  assert.match(script,/ict-bridge\.js/);
  assert.match(script,/ict-bridge\.css/);
  assert.match(script,/starterLayout/);
  assert.match(workflow,/patch_ict_dashboard_builder\.py/);
  assert.match(workflow,/builder-src/);
  const pipeline=load('scripts/build_site.py');
  assert.match(pipeline,/dashboard-bridge\.js/);
  assert.match(pipeline,/dashboard-layouts/);
});
