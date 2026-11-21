import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {availableVoices,readVoicePreference,saveVoicePreference} from '../src/browser-voice-choice.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../index.html');
const main=read('../src/main.js');
const shell=read('../src/cloud-shell.js');
const talk=read('../src/free-talk.js');
const css=read('../cloud-shell.css');

test('Engelse stemmen zijn zichtbaar en beluisterbaar in de eigen Stem-pagina',()=>{
  for(const id of ['enVoice','previewEnglish','englishStatus']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(html.includes('>Engelse stem</h2>'));
  assert.ok(main.includes("availableVoices(window.speechSynthesis,'en')"));
  assert.ok(main.includes('previewEnglish'));
  assert.ok(main.includes("Good evening, everyone."));
  assert.ok(main.includes("utterance.voice=chosen"));
});

test('De browserstemkeuze werkt voor het volledige Engels en bewaart voorkeuren per taal',()=>{
  const voices=[{voiceURI:'british',lang:'en-GB',name:'English UK'},
    {voiceURI:'american',lang:'en-US',name:'English US'},
    {voiceURI:'dutch',lang:'nl-NL',name:'Dutch'}];
  assert.deepEqual(availableVoices({getVoices:()=>voices},'en-US').map(x=>x.voiceURI),['british','american']);
  const values=new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,val)=>values.set(key,val),removeItem:key=>values.delete(key)};
  saveVoicePreference('en-US','british',storage);
  saveVoicePreference('nl-NL','dutch',storage);
  assert.equal(readVoicePreference('en-GB',storage),'british');
  assert.equal(readVoicePreference('nl',storage),'dutch');
  assert.ok(talk.includes('readVoicePreference(language)'));
  assert.ok(talk.includes('saveVoicePreference(outputLang.value,voiceName.value)'));
});

test('Overige opties sluit na keuze en toont de actieve paginanaam',()=>{
  assert.ok(html.includes('id="studioMoreLabel"'));
  for(const name of ['stem','sessie','meer'])assert.ok(shell.includes(name));
  assert.ok(shell.includes('closeMoreMenu()'));
  assert.ok(shell.includes('moreLabel.textContent=extra?extraNames[name]'));
  assert.ok(shell.includes('moreMenu.open=false'));
  assert.ok(shell.includes("event.key==='Escape'"));
  assert.ok(css.includes('@keyframes eaispeak-menu-in'));
  assert.ok(css.includes('@keyframes eaispeak-menu-out'));
});

test('Dezelfde vaste layout past ook bij kleine schermhoogte',()=>{
  assert.ok(shell.includes('positionMoreMenu()'));
  assert.ok(shell.includes('positionTalkPopup()'));
  assert.ok(shell.includes('window.innerHeight-navBottom-24'));
  assert.ok(shell.includes('panel.appendChild(talkPopup)'));
  assert.ok(css.includes('--extra-menu-top'));
  assert.ok(css.includes('.cloud-studio.panel>.mist-voice-portal'));
});
