import {test} from 'node:test';import assert from 'node:assert/strict';
import {modelFiles,paragraphs,speechSegments,stageAdvance,speech} from '../src/script.mjs';
test('podiumvolgorde en noodstop',()=>{
 let s='intro';for(const action of ['start','interrupt','french','handback','finish']){
  const next=stageAdvance(s,action);assert.ok(next);s=next;
 }assert.equal(s,'live');assert.equal(stageAdvance('live','french'),null);
 assert.equal(stageAdvance('live','panic'),'stopped');assert.equal(stageAdvance('stopped','reset'),'intro');
});
test('geen schijnstem zonder de Franse checkpointbestanden',()=>{
 assert.ok(modelFiles([]).missing.length>=4);
 const fake=n=>({name:n});
 assert.deepEqual(modelFiles(['model.q8.gguf','config.json','tokenizer.json','default-voice.safetensors'].map(fake)).missing,[]);
});
test('script bevat alinea’s en blijft Frans',()=>{assert.ok(paragraphs(speech).length>=5);assert.ok(speech.includes('DELF scolaire'));});

test('korte Franse zinsdelen zonder vooraf ingesproken audio',()=>{const parts=speechSegments(speech); assert.ok(parts.length>paragraphs(speech).length); assert.ok(parts.every(part=>part.length<=220)); assert.equal(parts.join(' ').includes('DELF scolaire'),true);});
