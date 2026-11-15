import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../assets/eaigame-sites-level-bank.js',import.meta.url),'utf8');
const scope={window:{}};
runInNewContext(code,scope,{timeout:2000});
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