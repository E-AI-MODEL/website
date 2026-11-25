import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../index.html');
const js=read('../src/free-talk.js');
const css=read('../cloud-shell.css');
const llm=read('../src/browser-llm.js');

test('Vrij praten biedt Ollama aan naast browser en online',()=>{
  for(const v of ['browser','ollama','puter'])assert.match(html,new RegExp('option value="'+v+'"'));
  for(const id of ['freeTalkOllamaEndpoint','freeTalkOllamaModel','freeTalkOllamaConnect'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(js.includes("listLocalModels('ollama'"));
  assert.ok(js.includes("origin+'/api/chat'"));
  assert.ok(js.includes('validateLocalEndpoint('));
});

test('browserstemmen worden per taal en naam aangeboden',()=>{
  for(const id of ['freeTalkVoice','freeTalkVoiceName','freeTalkAutoListen'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(js.includes('speechSynthesis.getVoices()'));
  assert.ok(js.includes('voiceschanged'));
  assert.ok(js.includes('voices.find(v=>v.voiceURI===voiceName.value)'));
  assert.ok(js.includes('voiceLanguage(outputLang.value)'));
  assert.ok(js.includes('availableVoices(window.speechSynthesis,language)'));
});

test('handsfree heeft een stopmogelijkheid en luistert na antwoord',()=>{
  assert.ok(js.includes('scheduleListen(own)'));
  assert.ok(js.includes('afterResponse(own)'));
  assert.ok(js.includes('handsfree=autoListen.checked'));
  assert.ok(js.includes('releaseMicrophone()'));
  assert.ok(js.includes("if(document.hidden){handsfree=false;"));
  assert.ok(js.includes('getUserMedia({audio:true})'));
  assert.ok(js.includes('microphoneAnalyser.getByteTimeDomainData'));
});

test('werkruimte blijft binnen viewport en menu boven content',()=>{
  assert.ok(css.includes('.stage{position:fixed!important;inset:0!important'));
  assert.ok(css.includes('.cloud-studio .studio-scroll{min-height:0;flex:1 1 0'));
  assert.ok(css.includes('.studio-extra-links{top:calc(100% + 8px)'));
  assert.ok(html.includes('id="freeTalkVoiceLines"'));
  assert.ok(css.includes('.free-talk-visual canvas'));
});

test('cachetekst belooft niet steeds opnieuw volledige download',()=>{
  assert.match(html,/browsercache bewaard/);
  assert.match(llm,/Model laden uit browsercache/);
  assert.ok(js.includes('eaispeak-free-talk-prefs-v1'));
});
