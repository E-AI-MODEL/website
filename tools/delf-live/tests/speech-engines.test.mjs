import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPEECH_ENGINES,isSpeechEngine,validateSpeechPair,validateSpeechEndpoint} from '../src/speech-engines.mjs';
import {bridgeHandshake,floatToPcm16,pcm16ToFloat,parseBridgeMessage} from '../src/speech-bridge.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const freeTalk=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');

test('alle vier spraakopties zichtbaar, Dessa eerlijk niet beschikbaar',()=>{
  for(const id of ['moshi','hibiki','hibiki-zero','dessa']){
    assert.ok(isSpeechEngine(id));
    assert.ok(html.includes('<option value="'+id+'">'),id);
  }
  assert.equal(SPEECH_ENGINES.dessa.availability,'unreleased');
  assert.match(SPEECH_ENGINES.dessa.detail,/geen|niet/i);
  for(const id of ['freeTalkSpeechOptions','freeTalkSpeechEndpoint','freeTalkSpeechConnection'])
    assert.ok(html.includes('id="'+id+'"'),id);
});

test('spraakmodellen houden hun echte taalrichtingen',()=>{
  assert.equal(validateSpeechPair('moshi','en-US','en-US').kind,'conversation');
  assert.equal(validateSpeechPair('hibiki','fr-FR','en-US').kind,'translation');
  for(const lang of ['fr-FR','es-ES','pt-PT','de-DE'])
    assert.equal(validateSpeechPair('hibiki-zero',lang,'en-US').kind,'translation');
  assert.throws(()=>validateSpeechPair('moshi','nl-NL','en-US'),/ondersteunt/);
  assert.throws(()=>validateSpeechPair('hibiki','nl-NL','fr-FR'),/ondersteunt/);
  assert.throws(()=>validateSpeechPair('dessa','en-US','en-US'),/niet beschikbaar/);
});

test('veilige WebSocket endpointvalidatie en geen tokens in URL',()=>{
  assert.equal(validateSpeechEndpoint('ws://localhost:8765/eaispeak'),'ws://localhost:8765/eaispeak');
  assert.equal(validateSpeechEndpoint('wss://voice.example.org/eaispeak'),'wss://voice.example.org/eaispeak');
  assert.throws(()=>validateSpeechEndpoint('ws://voice.example.org/eaispeak'),/wss/);
  assert.throws(()=>validateSpeechEndpoint('https://voice.example.org/eaispeak'),/ws/);
  assert.throws(()=>validateSpeechEndpoint('wss://voice.example.org/eaispeak?token=secret'),/wachtwoorden|tokens/);
});

test('bridge handshake en PCM16 roundtrip',()=>{
  const msg=bridgeHandshake({engine:'hibiki-zero',sourceLanguage:'fr-FR',targetLanguage:'en-US',sampleRate:48000});
  assert.equal(msg.protocol,'eaispeak-pcm-v1');
  assert.equal(msg.input.sample_rate,48000);
  assert.equal(msg.output.sample_rate,24000);
  const samples=new Float32Array([-1,-.5,0,.5,1]);
  const pcm=floatToPcm16(samples);
  assert.equal(pcm[0],-32768);
  assert.equal(pcm[4],32767);
  const decoded=pcm16ToFloat(pcm.buffer);
  for(let i=0;i<samples.length;i++)assert.ok(Math.abs(decoded[i]-samples[i])<.0001);
  assert.throws(()=>pcm16ToFloat(new Uint8Array(3).buffer),/PCM16/);
});

test('bridgeberichten vereisen bekende types',()=>{
  assert.equal(parseBridgeMessage('{"type":"ready","protocol":"eaispeak-pcm-v1"}').type,'ready');
  assert.throws(()=>parseBridgeMessage('broken'),/Onleesbaar/);
  assert.throws(()=>parseBridgeMessage('{"type":"ignore"}'),/Ongeldig/);
});

test('spraak kiest echt audio en sluit alle sessies bij verlaten',()=>{
  assert.ok(freeTalk.includes('startSpeechBridge('));
  assert.ok(freeTalk.includes('speechSession?.stop()'));
  assert.ok(freeTalk.includes('speechAbort?.abort()'));
  assert.ok(freeTalk.includes("onTranscript:text=>"));
  assert.ok(freeTalk.includes("onTranslation:text=>"));
  assert.ok(freeTalk.includes('controller.signal'));
  assert.ok(freeTalk.includes('isSpeechEngine(engine.value)'));
  assert.ok(freeTalk.includes('speechEndpoint.value'));
});
