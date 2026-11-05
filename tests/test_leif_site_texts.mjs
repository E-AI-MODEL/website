import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pages=['leif/index.html','leif/mijn/index.html','leif/continue/index.html','leif/verhaal/index.html','leif/beheer/index.html'];
const sources=pages.map(read);
const frontend=read('leif/tekstbeheer.js');
const editor=read('leif/beheer/teksteditor.js');
const backend=read('leif/multitenant/edge-admin-console.ts');
const schema=read('leif/multitenant/site-texts.sql');
test('LEIF pagina s en tekstmodules hebben leesbare JS',()=>{
 for(const [i,html] of sources.entries()){
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0,pages[i]);
  for(const [,js] of scripts)assert.doesNotThrow(()=>new Function(js),pages[i]);
 }
 for(const js of [frontend,editor,backend])assert.doesNotThrow(()=>new Function(js));
});
test('de bestaande inlogroutes en geheimhouding blijven staan',()=>{
 const main=sources[0];
 for(const code of ['KEI','LIS','VIS'])assert.match(main,new RegExp("code\\.toUpperCase\\(\\)==='"+code+"'"));
 assert.match(main,/leif-kei-session-v1/);
 assert.match(sources[3],/KEI_WRAPPED_KEY/);
 assert.match(sources[3],/protected-text/);
 assert.match(main,/id="adminPassword"/);
});
test('alle pagina s laden de gepubliceerde redactie',()=>{
 for(const html of sources){
  assert.match(html,/script src="\/leif\/tekstbeheer\.js"/);
  assert.match(html,/script-src 'self' 'unsafe-inline'/);
 }
 assert.match(frontend,/action:'site_public'/);
 assert.match(frontend,/published_text/);
 assert.doesNotMatch(frontend,/localStorage\.setItem/);
 assert.match(frontend,/nodeValue/);
});
test('privégegevens en concepten horen niet in de publieke tekstreactie',()=>{
 assert.match(backend,/if\(input\.action==="site_public"\)/);
 assert.match(backend,/published_text=not\.is\.null/);
 assert.match(backend,/select=field_key,published_text/);
 assert.match(backend,/scope\.slug!=="leif"\|\|scope\.role!=="manager"/);
 assert.match(frontend,/#protected-text/);
 assert.match(frontend,/#testerAnswers/);
 assert.match(frontend,/\.reportlist/);
});
test('veilig previewen zonder persoonlijke sessie of schrijven',()=>{
 assert.match(sources[1],/if\(leifPreview\)/);
 assert.match(sources[2],/if\(leifPreview\)return true/);
 assert.match(sources[3],/get\('leif_voorbeeld'\)==='1'/);
 assert.match(sources[4],/E\('newPanel'\)\.hidden=true/);
 assert.match(frontend,/document\.addEventListener\('submit'/);
 assert.match(frontend,/document\.addEventListener\('beforeinput'/);
});
test('concept, publicatie en geschiedenis met versienummer',()=>{
 assert.match(backend,/site_save/);
 assert.match(backend,/site_publish/);
 assert.match(backend,/site_unpublish/);
 assert.match(backend,/site_history/);
 assert.match(backend,/site_restore/);
 assert.match(backend,/revision=eq/);
 assert.match(schema,/create table if not exists public\.leif_site_texts/);
 assert.match(schema,/create table if not exists public\.leif_site_text_history/);
 assert.match(schema,/enable row level security/);
 assert.match(schema,/revoke all on public\.leif_site_texts from anon, authenticated/);
 assert.match(schema,/create trigger leif_site_text_history_trigger/);
 assert.doesNotMatch(schema,/drop table|truncate table|delete from public\.leif_documents/i);
});
test('rustig inlogscherm respecteert bewegingsvoorkeur en behoudt logo',()=>{
 const html=sources[0];
 assert.match(html,/Welkom bij LEIF/);
 assert.match(html,/id="accessHeading"/);
 assert.match(html,/@keyframes leifDrift/);
 assert.match(html,/prefers-reduced-motion:reduce/);
 assert.match(html,/circle cx="22" cy="22" r="17\.5"/);
 assert.match(sources[4],/id="siteEditor"/);
 assert.match(sources[4],/id="siteEditInput"/);
 assert.match(editor,/site_restore/);
});
