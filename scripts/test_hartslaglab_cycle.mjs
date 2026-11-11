// Geen animatie zonder controleerbare fysiologie.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile('content/anatomie/labs/hartslag/cycle.js','utf8');
const {PHASES,volume,pressure,phaseFor,mechanics}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
assert.equal(PHASES.length,5);
assert.equal(PHASES[0].at,0);
assert.equal(PHASES[4].end,1);
for(let i=0;i<PHASES.length-1;i++)assert.equal(PHASES[i].end,PHASES[i+1].at,'Gat tussen hartfasen');
for(let i=0;i<=999;i++){
  const t=i/1000,m=mechanics(t);
  assert(m.phase>=0&&m.phase<5,'Fase niet gevonden: '+t);
  assert.equal(m.phase,phaseFor(t));
  assert(Number.isFinite(m.pressure)&&m.pressure>=4&&m.pressure<=122,'Foutieve druk: '+t);
  assert(Number.isFinite(m.volume)&&m.volume>=59&&m.volume<=131,'Foutief kamervolume: '+t);
  assert(!(m.av&&m.sem),'AV- en slagaderkleppen staan tegelijk open: '+t);
}
assert.equal(mechanics(.3).av,true);
assert.equal(mechanics(.66).av,false);
assert.equal(mechanics(.66).sem,false);
assert.equal(mechanics(.8).sem,true);
assert.equal(mechanics(.96).sem,false);
assert(Math.abs(volume(.6)-volume(.65))<14);
assert.equal(volume(.65),volume(.69),'Bij gesloten kleppen mag het volume niet veranderen');
assert.equal(volume(.94),volume(.98),'Tijdens isovolumetrische relaxatie blijft het volume constant');
assert(pressure(.69)>pressure(.64)+40,'Druk moet stijgen bij de gesloten kleppen');
assert(pressure(.8)>pressure(.3)+60,'Ejectiedruk moet hoger liggen dan vullingsdruk');
assert.equal(volume(.70),130);
assert.equal(volume(.93),60);
assert.equal(130-60,70,'Slagvolume in dit onderwijsmodel is 70 ml');
console.log('Hartcyclus: 5 fasen, 1000 meetmomenten, klepstanden en druk-/volumeverloop gecontroleerd.');
