// Exercise the verifier with ephemeral test keys; never modify published keys.
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.EAI_TEST_URL||'http://127.0.0.1:8790';
const server=process.env.EAI_TEST_URL?null:spawn('python3',['-m','http.server','8790','--bind','127.0.0.1','--directory','site-build'],{stdio:'ignore'});
const reports=[];
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
const publicBytes=publicKey.export({format:'der',type:'spki'}).subarray(-32);
const bytes=Buffer.from('# TEST ONLY\nFictieve inhoud voor de browsercontrole.\n');
const name='fixture-test-only.md';
const manifest={schema:'eai-signed-provenance/v1',document:name,document_version:'synthetic-test',document_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),key_id:crypto.createHash('sha256').update(publicBytes).digest('hex').slice(0,16),signature_algorithm:'Ed25519'};
manifest.signature_base64=crypto.sign(null,Buffer.from(canonical(manifest)),privateKey).toString('base64');
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const engine of [chromium,webkit]){
  browser=await engine.launch();
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')&&r.request().method()==='GET'?r.continue():r.abort());
  await context.route('**/assets/provenance/EAI_PUBLIC_KEY.txt',r=>r.fulfill({status:200,contentType:'text/plain',body:'TEST KEY ONLY\nbase64: '+publicBytes.toString('base64')+'\n'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.goto(base+'/nl/tools/verificatie/',{waitUntil:'domcontentloaded'});
  async function check(content,payload,expected,pattern){
   await page.locator('#document').setInputFiles({name,mimeType:'text/markdown',buffer:content});
   await page.locator('#manifest').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
   await page.locator('button[type=submit]').click();
   await page.waitForFunction(s=>document.querySelector('#result').dataset.status===s,expected);
   assert.match(await page.locator('#result').innerText(),pattern);
  }
  await check(bytes,manifest,'ok',/Geldig/);
  await check(Buffer.concat([bytes,Buffer.from('changed')]),manifest,'bad',/wijkt af/);
  await check(bytes,{...manifest,document_version:'tampered'},'bad',/handtekening is ongeldig/);
  reports.push({engine:engine.name(),passed:true,validSyntheticDocumentAccepted:true,changedDocumentRejected:true,changedManifestRejected:true,originalEaiDocumentTested:false});
  await browser.close();browser=null;
 }
}catch(e){reports.push({passed:false,error:e.message});process.exitCode=1;}
finally{
 if(browser)await browser.close();if(server)server.kill();
 mkdirSync('own-export-results',{recursive:true});
 writeFileSync('own-export-results/verifier.json',JSON.stringify({fixture:'Ephemeral test key intercepted in test context only',reports},null,2));
 console.log(JSON.stringify(reports,null,2));
}
