import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const landing=read('leif/index.html');
const admin=read('leif/beheer/index.html');
const personal=read('leif/continue/index.html');
const backend=read('leif/multitenant/edge-admin-console.ts');
const demo=read('leif/multitenant/demo-testers.sql');

for(const [path,html] of [['leif/index.html',landing],['leif/beheer/index.html',admin],['leif/continue/index.html',personal]]){
  test(path+' heeft geldige JavaScript-syntax',()=>{
    const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length>0);
    for(const [,source] of scripts)assert.doesNotThrow(()=>new Function(source));
  });
}

test('KEI en de oude LEIF-proef blijven behouden',()=>{
  assert.match(landing,/toUpperCase\(\)==='KEI'/);
  assert.match(landing,/leif-kei-session-v1/);
  assert.match(personal,/leif-demo-session/);
  assert.match(demo,/alter table public\.leif_demo_sessions/);
  assert.doesNotMatch(demo,/drop\s+table|truncate|delete\s+from|update\s+public\.leif_demo_sessions/i);
});
test('drie klikken openen het bestaande beheer zonder aanmelding over te slaan',()=>{
  assert.match(landing,/quickClicks===3/);
  assert.match(landing,/location\.assign\('\/leif\/beheer\/'\)/);
  assert.match(admin,/leif-admin-console/);
  assert.match(backend,/membershipList\(user\.id,service\)/);
});
test('iedere tester krijgt een aparte geheime code in dezelfde demosessie',()=>{
  assert.match(backend,/create_tester/);
  assert.match(backend,/list_testers/);
  assert.match(backend,/scope\.slug!=="leif"/);
  assert.match(backend,/scope\.role!=="manager"/);
  assert.match(backend,/LEIF-TEST-/);
  assert.match(backend,/continuation_hash:await hash\(code\)/);
  assert.match(backend,/tester_name:name/);
  assert.match(admin,/testerForm/);
  assert.match(admin,/loadTesters\(\)/);
  assert.match(admin,/leif\/continue\/\#code=/);
  assert.match(landing,/LEIF-TEST-\[a-f0-9\]/);
  assert.match(personal,/sessionStorage\.getItem\('leifContinueToken'\)/);
  assert.match(personal,/leif-demo-session/);
});
