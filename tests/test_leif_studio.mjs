import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const admin=read('leif/multitenant/edge-admin-console.ts');
const personal=read('leif/multitenant/edge-personal-session.ts');
const demo=read('leif/multitenant/edge-demo-session.ts');
const studio=read('leif/beheer/studio.js');
const beheer=read('leif/beheer/index.html');
const reader=read('leif/mijn/index.html');
const continuePage=read('leif/continue/index.html');

test('de browsercode en beide serverfuncties zijn syntactisch geldig',()=>{
 for(const source of [studio,admin,personal,demo]) assert.doesNotThrow(()=>new Function(source));
 for(const html of [beheer,reader,continuePage]){
  const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  for(const script of inline)assert.doesNotThrow(()=>new Function(script));
 }
});

test('afzonderlijke dossiers krijgen eigen studio-opslag',()=>{
 assert.match(studio,/participant\.legacy\?'legacy_'\+action:action/);
 assert.match(studio,/participant_id:participant\.id/);
 assert.match(studio,/tester_id:participant\.id/);
 assert.match(admin,/tenant_id=eq\./);
 assert.match(admin,/studio_revision=eq\./);
 assert.match(admin,/revision=eq\./);
 assert.match(admin,/"save_blocks","publish_blocks","unpublish_blocks"/);
 assert.match(admin,/legacy_save_blocks/);
});

test('deelnemers krijgen uitsluitend gepubliceerde blokken',()=>{
 assert.match(personal,/blocks_published/);
 assert.match(personal,/personal_texts:pub/);
 assert.match(personal,/const pub=\{\.\.\.published,blocks:/);
 assert.match(demo,/blocks_published/);
 assert.doesNotMatch(demo,/personal_texts:row\.personal_texts/);
 assert.match(reader,/const blocks=Array\.isArray\(published\.blocks\)/);
 assert.match(continuePage,/personalBlocks=Array\.isArray/);
 assert.match(reader,/frame-src https:\/\/open\.spotify\.com/);
 assert.match(continuePage,/frame-src https:\/\/open\.spotify\.com/);
});

test('Spotify en onderdeelgegevens worden op de server beperkt',()=>{
 const start=admin.indexOf('function validBlocks(value){'),end=admin.indexOf('\nDeno.serve(',start);
 assert.ok(start>=0&&end>start);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const validBlocks=new Function('object',admin.slice(start,end)+';return validBlocks;')(object);
 const good={id:'song_123',type:'spotify',title:'Kars',text:'',visible:true,spotify_url:'https://open.spotify.com/track/0bqZiCxLGqeftnqRKlV1jn'};
 assert.equal(validBlocks([good]),true);
 assert.equal(validBlocks([{...good,spotify_url:'https://evil.example/trick'}]),false);
 assert.equal(validBlocks([good,{...good}]),false);
 assert.equal(validBlocks([{...good,id:'b_other',type:'html'}]),false);
 assert.equal(validBlocks([{...good,id:'b_other',html:'<script>bad</script>'}]),false);
 assert.equal(validBlocks([]),true);
});

test('oude LEIF-gegevens blijven bestaan naast nieuwe blokken',()=>{
 assert.match(admin,/data=\{\.\.\.previous\}/);
 assert.match(admin,/data=\{\.\.\.prior\}/);
 assert.match(admin,/data\.blocks_draft=input\.blocks/);
 assert.match(admin,/data\.blocks_published=prior\.blocks_draft/);
 assert.match(read('leif/multitenant/studio-legacy-additive.sql'),/add column if not exists personal_texts/);
});

test('compacte vormgeving en nieuwe studio zijn gekoppeld',()=>{
 assert.match(beheer,/href="\/leif\/beheer\/studio\.css"/);
 assert.match(beheer,/src="\/leif\/beheer\/studio\.js"/);
 assert.match(beheer,/id="blocksTab"/);
 assert.match(beheer,/data-tab="blocks"/);
 assert.match(read('leif/beheer/studio.css'),/grid-template-columns:.*1fr/);
});
