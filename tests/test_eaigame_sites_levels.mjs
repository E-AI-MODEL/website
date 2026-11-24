import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../assets/eaigame-sites-level-bank.js',import.meta.url),'utf8');
const scope={window:{}};
runInNewContext(code,scope,{timeout:2000});
const pilotCode=readFileSync(new URL('../assets/eaigame-sites-level-pilots.js',import.meta.url),'utf8');
runInNewContext(pilotCode,scope,{timeout:2000});
const bank=JSON.parse(JSON.stringify(scope.window.EAIGAME_LEVEL_QUESTIONS));
const categories=new Set(['natuur','wereld','taal','rekenen']);
test('300 originele EAIgame-varianten zijn op vier kenniswijken aangesloten',()=>{
 assert.equal(bank.length,300);assert.equal(new Set(bank.map(q=>q.id)).size,300);
 for(const level of ['vmbo','havo','vwo']){
  const questions=bank.filter(q=>q.level===level);assert.equal(questions.length,100);
  for(const cat of categories)assert.ok(questions.some(q=>q.cat===cat),level+' '+cat);
 }
});
test('geen fout in mapping van antwoorden en vraagtypen',()=>{
 for(const q of bank){
  assert.ok(categories.has(q.cat),q.id);
  assert.ok(q.prompt.length>8&&q.explanation.length>0,q.id);
  assert.ok(['choice','boolean','order'].includes(q.type),q.id+': '+q.type);
  if(q.type==='order'){
   assert.equal(q.answer.length,q.options.length,q.id);
   assert.deepEqual([...q.answer].sort(),[...q.options].sort(),q.id);
  }else{
   assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length,q.id);
  }
  assert.equal(q.reviewed,'redactioneel concept; niet geijkt');
  assert.equal(q.source.publisher,'EAIgame');
 }
});
test('de broncode bevat geen verzoek om antwoorden aan externe AI door te geven',()=>{
 assert.ok(!code.includes('fetch('));
 assert.ok(!code.includes('XMLHttpRequest'));
});
test('24 niveauproeven bevatten werkelijk andere taken en antwoordredeneringen',()=>{
 const pilots=bank.filter(q=>q.origin==='eai-niveaupilot');
 assert.equal(pilots.length,24);
 assert.equal(new Set(pilots.map(q=>q.id)).size,24);
 for(const stem of ['breuk-01','breuk-02','storm-01','storm-02','echo-01','echo-02','stad-01','stad-02']){
   const variants=['vmbo','havo','vwo'].map(level=>pilots.find(q=>q.id===stem+'-'+level));
   assert.ok(variants.every(Boolean),stem+' 3 niveaus');
   assert.equal(new Set(variants.map(q=>q.prompt)).size,3,stem+' heeft andere inhoudelijke vragen');
   assert.equal(new Set(variants.map(q=>q.explanation)).size,3,stem+' heeft andere redeneringen');
   assert.ok(variants.every(q=>q.options.length===4&&q.type==='choice'&&q.answer>=0&&q.answer<4&&q.hint));
 }
 assert.equal(scope.window.EAIGAME_LEVEL_PILOT_COUNT,24);
});
