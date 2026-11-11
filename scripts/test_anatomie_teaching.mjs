// Test de daadwerkelijke onderwijsuitleg, inclusief exact behoud van model-ID's.
// Gebruik: node scripts/test_anatomie_teaching.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('content/anatomie/teaching.js', 'utf8');
const { anatomyTeaching } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const systems = JSON.parse(await readFile('tools/anatomie/data/systems.json','utf8'));
const names = JSON.parse(await readFile('content/anatomie/synonyms.nl.json','utf8'));
const unresolved = new Set(['????????','?x',"central canal'",'lat_fis-ant-horizont','lat_fis-ant-vertical','lat_fis-post','sulcus interm_prim-jensen']);
const seen = new Map();
let covered=0;
for (const [system,parts] of Object.entries(systems)) {
  for(const id of parts) {
    const base=id.replace(/\.[lr]$/,'').trim();
    const key=base.toLowerCase();
    const lesson=anatomyTeaching(base,{system});
    if (unresolved.has(key)) {
      assert.equal(lesson,null,'Onbekende modelsleutel mag geen anatomische uitleg krijgen: '+id);
      continue;
    }
    assert.ok(Array.isArray(names[key])&&names[key][0], 'Nederlandse naam ontbreekt: '+id);
    assert.ok(lesson && lesson.kind && lesson.explanation && lesson.question,'Geen uitleg: '+id);
    assert.ok(lesson.explanation.length>=75,'Te korte uitleg: '+id);
    assert.equal(lesson.status,'algemene-uitleg');
    assert(!/gegarandeerd|bewezen|medisch gevalideerd/i.test(lesson.explanation));
    covered++;
    seen.set(key, lesson.type);
  }
}
assert.equal(seen.size,1636);
assert.equal(covered,2827-[...Object.values(systems).flat()].filter(id=>unresolved.has(id.replace(/\.[lr]$/,'').trim().toLowerCase())).length);

const checks = [
  ['Fifth rib','skeletal','rib'],
  ['Intervertebral disc C4-C5','joints','schijf'],
  ['Nucleus pulposus C4-C5','joints','nucleus'],
  ['Anterior cruciate ligament','joints','band'],
  ['Lateral meniscus','joints','meniscus'],
  ['Subacromial bursa','muscular','slijmbeurs'],
  ['Tibialis anterior muscle','muscular','spier'],
  ['Anterior axillary nodes','lymphatic','lymfeklier'],
  ['Femoral artery','cardiovascular','slagader'],
  ['Femoral vein','cardiovascular','ader'],
  ['Retina','nervous','zintuig'],
  ['Central sulcus','nervous','hersengroeve'],
  ['Optic nerve (II)','nervous','zenuw'],
  ['Superior segmental bronchus of left lung (BVI)','visceral','bronchus'],
  ['Duodenum','visceral','darm'],
];
for(const [name,system,kind] of checks) {
  assert.equal(anatomyTeaching(name,{system}).type,kind,name);
}
console.log('Anatomie: '+seen.size+' unieke structuren met passende onderwijsuitleg; '+checks.length+' categorieën steekproefsgewijs gecontroleerd');
