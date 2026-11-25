import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {probeSpeechBridge} from '../src/speech-bridge.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const freeTalk=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');

test('UI exposes one compact model probe without changing the published stage',()=>{
  assert.ok(html.includes('id="freeTalkSpeechProbe"'));
  assert.ok(freeTalk.includes('probeSpeechBridge('));
  assert.ok(freeTalk.includes('Modelserver reageert. Microfoon en spraakuitvoer zijn nog niet getest.'));
});

test('probe gets native readiness without opening microphone',async()=>{
  const sent=[],statuses=[];
  class MockSocket{
    constructor(url){
      this.url=url;this.readyState=0;this.listeners={};
      queueMicrotask(()=>{this.readyState=1;this.emit('open',{});});
    }
    addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
    emit(type,event){for(const callback of this.listeners[type]||[])callback(event);}
    send(data){
      sent.push(JSON.parse(data));
      queueMicrotask(()=>{
        this.emit('message',{data:JSON.stringify({type:'status',message:'Model starten…'})});
        this.emit('message',{data:JSON.stringify({
          type:'ready',protocol:'eaispeak-pcm-v1',probe:true,output_sample_rate:24000
        })});
      });
    }
    close(){this.readyState=3;this.emit('close',{code:1000});}
  }
  const result=await probeSpeechBridge({
    endpoint:'ws://localhost:8765/eaispeak',
    engine:'moshi',sourceLanguage:'en-US',targetLanguage:'en-US',
    WebSocketClass:MockSocket,onStatus:message=>statuses.push(message)
  });
  assert.deepEqual(result,{engine:'moshi',sourceLanguage:'en-US',targetLanguage:'en-US'});
  assert.equal(sent.length,1);
  assert.equal(sent[0].type,'probe');
  assert.equal(sent[0].protocol,'eaispeak-pcm-v1');
  assert.equal(sent[0].input.sample_rate,48000);
  assert.ok(statuses.includes('Model starten…'));
});

test('probe rejects server errors, does not invent successful audio quality',async()=>{
  class ErrorSocket{
    constructor(){this.readyState=0;this.listeners={};queueMicrotask(()=>{this.readyState=1;this.emit('open',{});});}
    addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}
    emit(type,e){for(const cb of this.listeners[type]||[])cb(e);}
    send(){queueMicrotask(()=>this.emit('message',{
      data:JSON.stringify({type:'error',message:'Geen modelserver geconfigureerd'})
    }));}
    close(){this.readyState=3;this.emit('close',{});}
  }
  await assert.rejects(()=>probeSpeechBridge({
    endpoint:'wss://voice.example.org/eaispeak',
    engine:'hibiki',sourceLanguage:'fr-FR',targetLanguage:'en-US',
    WebSocketClass:ErrorSocket
  }),/Geen modelserver geconfigureerd/);
  await assert.rejects(()=>probeSpeechBridge({
    endpoint:'ws://localhost:8765/eaispeak',
    engine:'moshi',sourceLanguage:'nl-NL',targetLanguage:'en-US',
    WebSocketClass:ErrorSocket
  }),/ondersteunt/);
});
