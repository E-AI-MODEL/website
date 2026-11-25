import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeForEngine} from '../src/mist-voice-ui.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../cloud-shell.css',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/cloud-shell.js',import.meta.url),'utf8');
const voice=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
const chooser=readFileSync(new URL('../src/mist-voice-ui.mjs',import.meta.url),'utf8');

test('modelgroepen zijn juist gekoppeld, zonder te bluffen over Dessa',()=>{
  for(const name of ['browser','ollama'])assert.equal(routeForEngine(name),'device');
  assert.equal(routeForEngine('puter'),'online');
  for(const name of ['moshi','hibiki','hibiki-zero','dessa'])assert.equal(routeForEngine(name),'speech');
  for(const name of ['browser','ollama','puter','moshi','hibiki','hibiki-zero','dessa']){
    assert.match(html,new RegExp('data-mist-engine="'+name+'"'));
    assert.match(html,new RegExp('<option value="'+name+'">'));
  }
  assert.match(html,/Dessa[\s\S]*?Nog niet beschikbaar/);
});

test('de vrije spreekstudio gebruikt één mistpalet, zonder zichtbaar native modelselect',()=>{
  assert.match(html,/id="freeTalkOptions"/);
  assert.match(html,/class="free-talk-floating-content mist-voice-body"/);
  assert.match(html,/id="freeTalkMenuClose"/);
  assert.match(html,/id="freeTalkModelChoices"/);
  assert.match(html,/class="mist-voice-native" tabindex="-1" aria-hidden="true"/);
  assert.match(html,/data-mist-route="speech"/);
  assert.match(html,/mist-talk-dialogue/);
  assert.match(html,/id="freeTalkVoiceLines"/);
  // This regression concerns the conversation UI, not the separate Live tools.
  const start=html.indexOf('id="page-gesprek"');
  const end=html.indexOf('id="page-taal"',start);
  assert.ok(start>=0 && end>start,'conversation section exists');
  const conversation=html.slice(start,end);
  assert.ok(!conversation.includes('class="studio-action-grid">\n          <label class="studio-field">Ik spreek'));
  const menuStart=conversation.indexOf('id="freeTalkOptions"');
  const menuEnd=conversation.indexOf('id="freeTalkSpeak"',menuStart);
  assert.ok(menuStart>=0 && menuEnd>menuStart);
  for(const id of ['freeTalkInputLang','freeTalkOutputLang','freeTalkEngine']){
    assert.ok(conversation.slice(menuStart,menuEnd).includes('id="'+id+'"'),id+' is in the mist settings');
    assert.equal((conversation.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  }
  assert.doesNotMatch(conversation,/id="liveSource"|id="liveTarget"/);
});

test('alle instellingen hebben precies één ID: geen verborgen dubbele formulieren',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  const dup=ids.filter((id,index)=>ids.indexOf(id)!==index);
  assert.deepEqual(dup,[]);
  for(const id of [
    'freeTalkEngine','freeTalkInputLang','freeTalkOutputLang','freeTalkBrowserModel',
    'freeTalkCloudModel','freeTalkOllamaModel','freeTalkVoice','freeTalkVoiceName',
    'freeTalkSpeechEndpoint','freeTalkSpeechProbe','freeTalkAutoListen',
    'freeTalkStatus','freeTalkHeard','freeTalkAnswer','freeTalkSpeak','freeTalkStop'
  ]) assert.ok(ids.includes(id),id);
});

test('visuele laag houdt de originele select als state en geeft change-events door',()=>{
  assert.match(chooser,/select\.dispatchEvent\(new Event\('change'/);
  assert.match(chooser,/engine\.dispatchEvent\(new Event\('change'/);
  assert.match(chooser,/item\.disabled=unavailable/);
  assert.match(chooser,/container\.hidden=fieldLabel\.hidden/);
  assert.match(voice,/document\.dispatchEvent\(new Event\('eaispeak-mist-update'\)\)/);
  assert.match(chooser,/new MutationObserver/);
});

test('floating popup staat boven de scroll en houdt toetsenbordtoegang',()=>{
  assert.match(shell,/panel\.appendChild\(talkPopup\)/);
  assert.match(shell,/closeTalkMenu/);
  assert.match(shell,/window\.innerHeight-navBottom-24/);
  assert.match(chooser,/aria-expanded/);
  assert.match(chooser,/ArrowDown/);
  assert.match(chooser,/event\.key==='Escape'/);
  assert.match(css,/\.cloud-studio\.panel>\.mist-voice-portal/);
  assert.match(css,/\.mist-voice-select-layer/);
  assert.match(css,/overscroll-behavior:contain/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('mist heeft rustige animatie en compacte tekst, geen harde nieuwe theme-kleuren',()=>{
  assert.match(css,/@keyframes mist-voice-appear/);
  assert.match(css,/@keyframes mist-voice-dissolve/);
  assert.match(css,/@keyframes mist-voice-drift/);
  assert.match(css,/--cloud-fine/);
  assert.match(css,/rgba\(250,252,251/);
});
