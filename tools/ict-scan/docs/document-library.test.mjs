import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..','..','..');
const local=p=>readFileSync(path.join(root,p),'utf8');
const catalog=JSON.parse(local('tools/ict-scan/docs/catalog.json'));
const available=['AVG','AIACT','UAVG'];
const sha=value=>createHash('sha1').update('blob '+Buffer.byteLength(value)+'\0'+value).digest('hex');

test('documentregister houdt auteursrecht en bronherkomst uit elkaar',()=>{
  assert.equal(catalog.schema,'eai-ict-document-catalog-v1');
  assert.equal(new Set(catalog.documents.map(d=>d.id)).size,catalog.documents.length);
  for(const d of catalog.documents){
    assert.ok(d.url.startsWith('https://'));
    assert.ok(d.publisher);
    if(d.availability==='external') assert.ok(!d.path,'beschermde bestanden niet in publieke repo');
    else assert.ok(available.includes(d.id));
  }
  for(const id of ['IBP','IBP-IAM','IBP-LOGICAL','IBP-EMERGENCY'])
    assert.equal(catalog.documents.find(d=>d.id===id)?.availability,'external');
});

test('alle drie wetsteksten worden volledig bewaard en zijn tegen Git blob SHA gebonden',()=>{
  const markers={AVG:['Artikel 1','Artikel 99'],UAVG:['Artikel 1.','Artikel 54.'],AIACT:['Artikel 1','Artikel 113','BIJLAGE XIII']};
  for(const id of available){
    const d=catalog.documents.find(x=>x.id===id);
    assert.ok(d?.path?.startsWith('tools/ict-scan/docs/'));
    const body=local(d.path);
    assert.ok(body.length>10000);
    assert.equal(sha(body),d.blobSha,id+': onverifieerbare momentopname');
    for(const token of markers[id])assert.ok(body.includes(token),id+': mist '+token);
  }
});

test('documenten zijn te openen in bestaande ICT-scan zonder extra webroute',()=>{
  const html=local('tools/ict-scan/index.html');
  const js=local('tools/ict-scan/enhancements.js');
  const css=local('tools/ict-scan/monitor.css');
  for(const id of ['docDialog','docLibraryList','docLibrarySearch','docArticleSearch','docArticleJump','docLocalFile','docOpenFromPrivacy'])
    assert.ok(html.includes('id="'+id+'"'),'Ontbrekend HTML element '+id);
  assert.ok(js.includes('window.EmmausDocs'));
  assert.ok(js.includes('data.sha'));
  assert.ok(js.includes('new TextDecoder'));
  assert.ok(js.includes("credentials:'omit'"));
  assert.ok(css.includes('.doc-reader-dialog'));
});
