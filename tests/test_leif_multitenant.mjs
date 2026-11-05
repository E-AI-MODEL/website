import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const root=read('leif/index.html');
const participant=read('leif/mijn/index.html');
const admin=read('leif/beheer/index.html');
const api=read('leif/multitenant/edge-personal-session.ts');
const management=read('leif/multitenant/edge-admin-console.ts');
const schema=read('leif/multitenant/schema.sql');

function checkInlineJs(html,path) {
  const script=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, `Inline script missing: ${path}`);
  assert.doesNotThrow(()=>new Function(script[1]),`JavaScript syntax: ${path}`);
}
test('beide nieuwe omgevingen hebben leesbare JavaScript-syntax',()=>{
  checkInlineJs(participant,'leif/mijn/index.html');
  checkInlineJs(admin,'leif/beheer/index.html');
});
test('bestaande LEIF-inhoud en KEI blijven beschikbaar',()=>{
  assert.match(root,/pw\.value\.trim\(\)\.toUpperCase\(\)==='KEI'/);
  assert.match(root,/\/leif\/verhaal\//);
  assert.match(root,/\/leif\/mijn\//);
  assert.doesNotMatch(schema,/drop\s+table\s+(if\s+exists\s+)?(?:public\.)?leif_demo_sessions/i);
});
test('deelnemer gebruikt lange persoonlijke code en eigen serverdossier',()=>{
  assert.match(participant,/maxlength="48"/);
  assert.match(participant,/leif-personal-session/);
  assert.match(participant,/expected_revision/);
  assert.match(participant,/mergeChanges/);
  assert.match(api,/\^\[a-f0-9\]\{48\}\$/);
  assert.match(api,/access_hash=eq/);
  assert.match(api,/revision_conflict/);
});
test('niet gepubliceerde verhalen worden nooit aan deelnemers teruggegeven',()=>{
  assert.match(management,/data\.draft=input\.draft/);
  assert.match(management,/data\.published=\{\.\.\.draft\}/);
  assert.match(api,/personal_texts:pub/);
  assert.doesNotMatch(participant,/personal_texts\.draft/);
});
test('beheerder heeft een apart account met rol per organisatie',()=>{
  for(const action of ['login','refresh','invite','rename','rotate','revoke','save_draft','publish_story','unpublish_story'])
    assert.ok(management.includes(action),`Missing admin action: ${action}`);
  assert.match(management,/membershipList\(user\.id,service\)/);
  assert.match(management,/scope\.role!=="manager"/);
  assert.match(management,/tenant_id=eq/);
  assert.match(admin,/leif-admin-console/);
  assert.match(admin,/newName/);
  assert.match(admin,/saveDraft/);
  assert.match(admin,/publish/);
  assert.doesNotMatch(admin,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});
test('nieuwe dossiers blijven database-afgeschermd en versieerbaar',()=>{
  for(const table of ['leif_tenants','leif_participants','leif_documents','leif_document_history','leif_admin_memberships']){
    assert.ok(schema.includes('public.'+table),`Missing table ${table}`);
    assert.ok(schema.includes('alter table public.'+table+' enable row level security'),`Missing RLS ${table}`);
    assert.ok(schema.includes('revoke all on public.'+table+' from anon, authenticated'),`Missing public revoke ${table}`);
  }
  assert.match(schema,/leif_document_audit/);
  assert.match(schema,/leif_initialize_document/);
  assert.match(schema,/revision must advance by one/);
});