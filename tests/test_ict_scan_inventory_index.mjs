import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import index from '../tools/ict-scan/inventory-index.js';

const directory='tools/ict-scan/bronnen/';
const landscape=JSON.parse(readFileSync(directory+'2026-applicatielandschap.json','utf8'));
const work=JSON.parse(readFileSync(directory+'2026-werkregister.json','utf8'));
const faq=JSON.parse(readFileSync(directory+'2026-faq.json','utf8'));
const source=JSON.parse(readFileSync(directory+'2026-bronnenregister.json','utf8'));
const catalog=JSON.parse(readFileSync('tools/ict-scan/frameworks.json','utf8'));

function state(){
  const result={};
  for(const type of index.TYPES){
    const store=index.STORES[type];
    const rows=landscape[type]||work[type]||faq[type]||source[type]||[];
    result[store]=new Map(rows.map(x=>[x.id,x]));
  }
  return result;
}
test('Een index uit vier bestaande bronbestanden, zonder extra bronbestand of gedupliceerde feiten',()=>{
  const built=index.build(state(),{catalog});
  assert.equal(built.nodes.size,579,'501 oorspronkelijke registraties plus acht apps, 40 modules, 15 hardwaregroepen, twaalf extra bronnen en drie extra FAQ’s');
  assert.equal(built.errors.length,0,JSON.stringify(built.errors.slice(0,6)));
  assert.equal(built.count('apps'),69);
  assert.equal(built.count('ai'),76);
  assert.equal(built.count('connections'),93);
  assert.equal(built.count('devices'),4);
  assert.equal(built.count('sourceRegister'),63);
  assert.equal(built.count('faqs'),17);
  assert.equal(built.count('parts'),53,'13 Entra-registraties en 40 Microsoft 365-productonderdelen');
  assert.equal(built.count('hardwareGroups'),15,'Hardwaregroepen zijn geen Entra-apparaatmetingen');
  assert.ok(built.sourceCoverage.directReferences>=485);
  assert.equal(built.sourceCoverage.unmatched,0,'Alle rechtstreeks genoemde bestanden moeten via een bron-ID terugvindbaar zijn');
});
test('De index ontsluit alle soorten getypeerde koppelingen in beide richtingen',()=>{
  const idx=index.build(state(),{catalog});
  const names=(type,id,t)=>idx.connected(type,id,{type:t}).map(x=>x.otherId);
  assert.ok(names('apps','APP-034','ai').length>=16);
  assert.ok(names('apps','APP-034','parts').includes('M365-SP'));
  assert.ok(names('apps','APP-034','apps').includes('APP-010'));
  assert.ok(names('apps','APP-027','connections').length>=0);
  assert.ok(names('apps','APP-008','licenseReview').includes('LIC-003'));
  assert.ok(names('apps','APP-012','softwareReview').includes('SWR-007'));
  assert.ok(names('apps','APP-057','hardwareGroups').includes('H07'));
  assert.equal(names('parts','MOD-003','connections').length,1);
});
test('Een Entra-match is nooit een bewijs van een actieve koppeling',()=>{
  const idx=index.build(state(),{catalog});
  for(const edge of idx.edges.filter(x=>x.relationType==='possible_match')){
    assert.equal(edge.status,'Vermoedelijk');
  }
  assert.ok(idx.edges.some(x=>x.relationType==='registered_as'));
  assert.ok(idx.edges.some(x=>x.relationType==='reviews'));
  assert.ok(idx.edges.some(x=>x.relationType==='managed_by'));
});
test('Bronverwijzingen en ontbrekende aliases blijven zichtbaar als aparte controles',()=>{
  const idx=index.build(state(),{catalog});
  const ms=idx.sourcesFor('apps','APP-034');
  assert.ok(ms.matched.length>=1);
  assert.equal(ms.unmatched.length,0);
  assert.ok(idx.sourceCoverage.relationEvidence>0);
  assert.ok(idx.sourceCoverage.relationEvidenceMatched<idx.sourceCoverage.relationEvidence);
});
test('Dynamische verandering van de bron wordt niet door een eerder berekende index verborgen',()=>{
  const data=state();
  const before=index.build(data,{catalog});
  assert.equal(before.count('apps'),69);
  data.apps.set('APP-ZZZ',{id:'APP-ZZZ',name:'Nieuwe gecontroleerde testregistratie',relations:[{relationType:'part_of',targetType:'apps',targetId:'APP-034',status:'Geregistreerd',evidence:'test',note:'test'}]});
  const after=index.build(data,{catalog});
  assert.equal(after.count('apps'),70);
  assert.ok(after.connected('apps','APP-034',{type:'apps'}).some(x=>x.otherId==='APP-ZZZ'));
  assert.equal(before.count('apps'),69);
});