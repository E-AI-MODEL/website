import {test} from 'node:test';import assert from 'node:assert/strict';
import {modelFiles,paragraphs,speechSegments,stageAdvance,speech,replyPauseMs} from '../src/script.mjs';
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

test('voldoende reactietijd tussen onderbreking en Franse speech',()=>{assert.ok(replyPauseMs >= 4000 && replyPauseMs < 7000);});

import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('clean podium zonder zaaliconen, header of vaste footer',()=>{
  for (const absent of ['masthead','stage-controls','quickSettings','panelToggle','ornament','stage-footer']) assert.ok(!html.includes(absent),absent);
  assert.ok(html.includes('id="displayText"'));
  assert.ok(html.includes('id="panel"'));
});
test('donkere Franse tekst op lichte achtergrond en alleen toetsen',()=>{
  assert.ok(styles.includes('color:#223743'));
  assert.ok(styles.includes('background:#fbfbf9'));
  assert.ok(main.includes("event.code === 'ArrowRight'"));
  assert.ok(main.includes('pulseText()'));
});
