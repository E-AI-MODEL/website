import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {macOllamaCommands,CADDY_CONFIG,OLLAMA_HTTPS} from '../src/ollama-connection.mjs';
import {classifyError,loopbackPermission,localFetchOptions} from '../src/system-probes.mjs';

test('production permits both exact domains, no wildcard, with origin-specific curl',()=>{
  for(const origin of ['https://eaimodel.nl','https://www.eaimodel.nl']){
    const c=macOllamaCommands(origin);
    assert.equal(c.origins,'https://eaimodel.nl,https://www.eaimodel.nl');
    assert.equal(c.setOrigins,"launchctl setenv OLLAMA_ORIGINS 'https://eaimodel.nl,https://www.eaimodel.nl'");
    assert.equal(c.restartApp,'open -a Ollama');
    assert.match(c.startTerminal,/OLLAMA_HOST=127\.0\.0\.1:11434/);
    assert(c.curlHttp.includes('Origin: '+origin));
    assert(c.curlHttps.includes('Origin: '+origin));
    assert(c.curlHttps.includes(OLLAMA_HTTPS));
  }
  assert.equal(macOllamaCommands('http://127.0.0.1:4178').origins,'http://127.0.0.1:4178');
  assert.throws(()=>macOllamaCommands('https://eaimodel.nl/path'));
});
test('copied Caddy command writes the exact local-only config without port 80 redirects',()=>{
  const home=mkdtempSync(join(tmpdir(),'eaispeak-caddy-'));
  try{
    const c=macOllamaCommands('https://eaimodel.nl');
    execFileSync('bash',['-c',c.writeConfig],{env:{...process.env,HOME:home}});
    const actual=readFileSync(join(home,'.config/eaispeak/Caddyfile'),'utf8');
    assert.equal(actual,CADDY_CONFIG);
    assert.match(actual,/auto_https disable_redirects/);
    assert.match(actual,/admin off/);
    assert.match(actual,/bind 127\.0\.0\.1 \[::1\]/);
    assert.match(actual,/tls internal/);
    assert.match(actual,/header_up Host 127\.0\.0\.1:11434/);
    assert.doesNotMatch(actual,/0\.0\.0\.0|:80(?:\s|$)/);
    assert.match(c.startCaddy,/caddy validate .* && caddy run/);
    assert.doesNotMatch(c.startCaddy,/sudo/);
  }finally{rmSync(home,{recursive:true,force:true});}
});
test('403 is a distinct Ollama origin error, and unsupported permissions do not crash',async()=>{
  assert.equal(classifyError(Error('HTTP 403'),'ollama').code,'SYS-OLLAMA-403');
  assert.equal(await loopbackPermission({query:async x=>{assert.equal(x.name,'loopback-network');return {state:'denied'};}}),'denied');
  assert.equal(await loopbackPermission({query:async()=>{throw TypeError('unsupported');}}),'unknown');
  const options=localFetchOptions('http://localhost:11434/api/tags',{method:'GET',credentials:'include',redirect:'follow'});
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.throws(()=>localFetchOptions('https://example.org/api/tags'));
  assert.throws(()=>localFetchOptions('http://user:pass@localhost:11434/api/tags'));
});
