import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=get('leif/index.html');
const reading=get('leif/verhaal/index.html');
const personal=get('leif/mijn/index.html');
const continuation=get('leif/continue/index.html');
const beheer=get('leif/beheer/index.html');
const server=get('leif/multitenant/edge-personal-session.ts');

test('KEI gebruikt de bestaande pagina en het versleutelde leesverhaal',()=>{
 assert.match(main,/code\.toUpperCase\(\)==='KEI'/);
 assert.match(main,/leif-kei-session-v1/);
 assert.match(main,/renderIntro\(\)/);
 assert.match(reading,/unlock\('KEI'\)/);
 assert.match(reading,/id="protected-text"/);
 assert.doesNotMatch(main,/Mijn eigen LEIF-omgeving/);
});
test('LIS opent Kars via uitsluitend de gemarkeerde demo-alias',()=>{
 assert.match(main,/code\.toUpperCase\(\)==='LIS'/);
 assert.match(main,/location\.assign\('\/leif\/mijn\/'\)/);
 assert.match(server,/body\.code==="lis"/);
 assert.match(server,/test_alias=eq\.LIS&is_demo=eq\.true/);
 assert.match(server,/member\.state!=="active"/);
 assert.match(personal,/id="demoLabel"/);
});
test('VIS opent een wachtwoordlogin zonder verplichte e-maillink',()=>{
 assert.match(main,/id="adminPasswordGroup" hidden/);
 assert.match(main,/id="adminPassword" type="password"/);
 assert.doesNotMatch(main,/id="adminEmail"/);
 assert.doesNotMatch(main,/action:'request_magic_link'/);
 assert.match(main,/action:'login',email:'vis@emmauscollege.nl',password/);
 assert.match(main,/showAdminPassword\(\)/);
 assert.match(main,/action:'session'/);
 assert.match(main,/completeAdminLink/);
 assert.match(main,/t\.slug==='leif'&&t\.role==='manager'/);
 assert.match(main,/leif-admin-session-v1/);
 assert.match(main,/quickClicks===3/);
 assert.match(beheer,/request\('refresh'/);
 assert.doesNotMatch(beheer,/id="password"|id="email"/);
});
test('geen tweede zichtbaar inlogformulier',()=>{
 for(const html of [reading,personal,continuation,beheer])assert.match(html,/<section[^>]*id="(?:gate|login)"[^>]*hidden>/);
 assert.match(personal,/else location\.replace\('\/leif\/'\)/);
 assert.match(continuation,/else location\.replace\('\/leif\/'\)/);
 assert.match(beheer,/location\.replace\('\/leif\/\?beheer=1'\)/);
 assert.match(reading,/else location\.replace\('\/leif\/'\)/);
});
test('mobiele KEI-header is compact',()=>{
 assert.match(main,/@media\(max-width:620px\)/);
 assert.match(main,/\.app-header \.brand-tag\{display:none\}/);
 assert.match(main,/id="leaveKei"/);
});
test('inline JavaScript parseert',()=>{
 for(const [path,html] of [['LEIF',main],['verhaal',reading],['mijn',personal],['vervolg',continuation],['beheer',beheer]]){
  const chunks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(chunks.length>0,path);
  for(const [,source] of chunks)assert.doesNotThrow(()=>new Function(source),path);
 }
 assert.doesNotThrow(()=>new Function(server));
});
