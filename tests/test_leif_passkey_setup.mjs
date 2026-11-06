import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const start=read('leif/index.html');
const beheer=read('leif/beheer/index.html');
const client=read('leif/passkey-client.js');
const edge=read('leif/multitenant/edge-passkey.ts');

test('eerste registratie verandert de huidige VIS-login nog niet',()=>{
 assert.match(start,/action:'request_magic_link'/);
 assert.match(start,/async function completeAdminLink\(\)/);
 assert.match(start,/code\.toUpperCase\(\)==='KEI'/);
 assert.match(start,/code\.toUpperCase\(\)==='LIS'/);
 assert.match(start,/code\.toUpperCase\(\)==='VIS'/);
});

test('Face ID registreren vergt een bestaande managersessie',()=>{
 assert.match(beheer,/id="setupPasskey"/);
 assert.match(beheer,/window\.LeifPasskey\.register\(auth\.access_token\)/);
 assert.match(beheer,/tenants\.some\(t=>t\.slug==='leif'&&t\.role==='manager'\)/);
 assert.match(client,/passkey_register_start/);
 assert.match(edge,/if\(registration&&!bearer\.startsWith\("Bearer "\)\)/);
 assert.match(edge,/t\.slug==="leif"&&t\.role==="manager"/);
 assert.match(edge,/return send\(\{error:"not_authorized"\},403,origin\)/);
 assert.doesNotMatch(client,/service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/);
});

test('de nieuwe code is syntactisch geldig',()=>{
 assert.doesNotThrow(()=>new Function(client));
 assert.doesNotThrow(()=>new Function(edge));
});
