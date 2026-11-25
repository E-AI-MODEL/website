import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activationGate,liveKey,talkKey,liveNeedsModel,ROUTES,LIVE_SAMPLES} from '../src/activation.mjs';
test('activation evidence is scoped to the exact selected route',()=>{
  const s={mode:'translate',source:'nl-NL',target:'fr-FR',route:'chrome',recognition:'browser',endpoint:'ws://localhost:8766/eaispeak',speak:false};
  const gate=activationGate();assert.equal(gate.has(liveKey(s)),false);gate.mark(liveKey(s));assert.equal(gate.has(liveKey(s)),true);
  for(const change of [{target:'en-US'},{recognition:'whisper'},{endpoint:'ws://localhost:9000/eaispeak'},{mode:'captions'},{speak:true}])assert.equal(gate.has(liveKey({...s,...change})),false);
  gate.clear();assert.equal(gate.has(liveKey(s)),false);
});
test('plain browser captions need no model; every server and translation needs preparation',()=>{
  assert.equal(liveNeedsModel({mode:'captions',recognition:'browser'}),false);
  assert.equal(liveNeedsModel({mode:'translate',recognition:'browser'}),true);
  assert.equal(liveNeedsModel({mode:'transcribe',recognition:'whisper'}),true);
  for(const r of ['apple','whisper','hibiki','hibiki-zero','moshi'])assert.match(ROUTES[r].url,/github\.com/);
  assert.equal(Object.keys(LIVE_SAMPLES).length,6);
});
test('conversation changes invalidate evidence',()=>{
  const s={engine:'ollama',model:'one',endpoint:'http://localhost:11434/',source:'nl-NL',target:'en-US',voice:'browser'};
  const gate=activationGate();gate.mark(talkKey(s));assert.equal(gate.has(talkKey(s)),true);
  for(const [key,value] of Object.entries({model:'two',endpoint:'http://localhost:11435/',target:'fr-FR',source:'de-DE',voice:'none',engine:'puter'}))assert.equal(gate.has(talkKey({...s,[key]:value})),false);
});
