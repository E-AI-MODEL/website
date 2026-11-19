import {test} from 'node:test';import assert from 'node:assert/strict';
import {modelFiles,paragraphs,speechSegments,stageAdvance,speech,replyPauseMs,opening,reply,closing,interrupt,handback} from '../src/script.mjs';
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

test('korte Franse zinsdelen zonder vooraf ingesproken audio',()=>{const parts=speechSegments(speech); assert.ok(parts.length >= 12); assert.ok(parts.every(part=>part.length<=220)); assert.equal(parts.join(' ').includes('DELF scolaire'),true);});

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

test('mobiele test gebruikt een echt Frans Phonon-model, geen systeemstem',()=>{
  const page=readFileSync(new URL('../mobile-preview.html',import.meta.url),'utf8');
  const script=readFileSync(new URL('../src/mobile.js',import.meta.url),'utf8');
  assert.ok(page.includes('id="listen"'));
  assert.ok(page.includes('id="load"'));
  assert.ok(script.includes("import { PhononTTS } from 'phonon-tts'"));
  assert.ok(script.includes('PhononTTS.load('));
  assert.ok(script.includes('tts.stream(text,'));
  assert.ok(script.includes("lang:'fr'"));
  assert.ok(script.includes('phonon-40m-multilingual'));
  assert.ok(!script.includes('SpeechSynthesisUtterance'));
  assert.ok(!script.includes('speechSynthesis'));
  assert.ok(page.includes('niet identiek aan het afzonderlijke Franse checkpoint'));
});

test('echt gesproken Nederlands wordt vertaald, spiektekst niet',()=>{
  assert.ok(html.includes('id="displayText"></div>'));
  assert.ok(html.includes('id="voiceVisual"'));
  assert.ok(!html.includes('Une langue de plus.'));
  assert.match(opening,/Onze rector kan er vanmiddag helaas niet bij zijn/);
  assert.match(closing,/Mevrouw Klatten/);
  assert.match(reply,/gedraag je/);
  assert.ok(main.includes('translateFinal(value[0].transcript)'));
  assert.ok(main.includes('translatePreview(interim)'));
  assert.ok(!main.includes('translateFinal(opening)'));
  assert.ok(!main.includes('translateFinal(closing)'));
});
test('voorgelezen script blijft vast, maar staat niet op het scherm',()=>{
  assert.match(interrupt,/toespraak in het Nederlands/);
  assert.match(handback,/In het Nederlands, vooruit dan maar/);
  assert.match(speech,/Madame Klatten/);
  assert.match(speech,/A2 au niveau B2/);
  assert.match(speech,/toute la direction de l'Emmauscollege/);
  assert.ok(!speech.includes('chers parents'));
  assert.ok(!main.includes("screen('Un instant"));
  assert.ok(!main.includes("screen('Merci. À vous"));
  assert.ok(!main.includes("screen('À vous maintenant"));
  assert.ok(!main.includes("screen(captionCues.shift().text"));
});
test('wolken en dunne lijnen op stem, geen podiumiconen',()=>{
  assert.ok(styles.includes('@keyframes delf-cloud-drift'));
  assert.ok(styles.includes('.voice-visual'));
  assert.ok(!html.includes('stage-controls'));
  assert.ok(styles.includes('color:#223743'));
});

test('dunne stemlijnen volgen echte Franse audio en Nederlandse spreekgrenzen',()=>{
  assert.ok(main.includes('const analyser = ctx.createAnalyser()'));
  assert.ok(main.includes('node.connect(analyser)'));
  assert.ok(main.includes('frenchAnalyser.getFloatTimeDomainData(voiceSamples)'));
  assert.ok(main.includes('requestAnimationFrame(drawVoice)'));
  assert.ok(main.includes('utterance.onboundary'));
  assert.ok(main.includes('stopReplyMic()'));
});
test('vrije reactie zonder wijziging van de vaste Franse speech',()=>{
  assert.ok(main.includes('function beginReplyWindow(expectedEpoch)'));
  assert.ok(main.includes("instance.lang = 'nl-NL'"));
  assert.ok(main.includes('const segments = speechSegments(speech)'));
  assert.ok(!main.includes("speechSegments($('speechText').value)"));
  assert.ok(html.includes('id="speechText" rows="13" spellcheck="false" readonly'));
});

test('iPhone heeft altijd bereikbaar instellingenmenu rechtsboven',()=>{
  assert.ok(html.includes('id="mobileSettings"'));
  assert.ok(html.includes('aria-controls="panel"'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(main.includes("$('mobileSettings').addEventListener('click'"));
  assert.ok(main.includes("trigger.setAttribute('aria-expanded', String(open))"));
  assert.ok(styles.includes('(max-width:680px) and (pointer:coarse)'));
  assert.ok(styles.includes('.mobile-settings-lines>span'));
});
test('instellingen zijn dun en rustig, en Esc werkt ook bij focus op een invoerveld',()=>{
  assert.ok(styles.includes('.panel .group'));
  assert.ok(styles.includes('border-top:1px solid rgba(132,156,159,.23)'));
  assert.ok(styles.includes('.panel .action'));
  const keyBlock=main.slice(main.indexOf("document.addEventListener('keydown'"));
  assert.ok(keyBlock.indexOf("event.key === 'Escape'")<keyBlock.indexOf("event.target instanceof HTMLInputElement"));
  assert.ok(html.includes('id="panelClose"'));
  assert.ok(html.includes('close-strokes'));
});

test('microfoontest herkent echte Nederlandse woorden in plaats van alleen toestemming',()=>{
  assert.ok(html.includes('Nederlandse spraak testen'));
  assert.ok(main.includes('microphoneCheck = instance'));
  assert.ok(main.includes("instance.lang = 'nl-NL'"));
  assert.ok(main.includes('instance.onresult = event =>'));
  assert.ok(main.includes('Herkend Nederlands: '));
  assert.ok(!main.includes('Microfoon beschikbaar. Gebruik Nederlands.'));
});
test('geen schijnstart bij ontbrekende vertaling, fout is zichtbaar',()=>{
  assert.ok(main.includes('function goStart()'));
  assert.ok(main.includes('void prepareTranslation()'));
  assert.ok(main.includes('panel(true)'));
  assert.ok(main.includes("import('./translation-fallback.js')"));
});
test('de witgolf ademt zichtbaar vanuit het midden',()=>{
  assert.ok(styles.includes('@keyframes delf-center-breathe'));
  assert.ok(styles.includes('transform-origin:50% 50%'));
  assert.ok(styles.includes('scale(1.12)'));
});

test('browservertaling zonder Chrome Translator gebruikt een eigen ONNX-model',()=>{
  const fallback=readFileSync(new URL('../src/translation-fallback.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../src/translation-worker.js',import.meta.url),'utf8');
  assert.ok(main.includes("import('./translation-fallback.js')"));
  assert.ok(main.includes('createBrowserTranslator(progress'));
  assert.ok(main.includes('const availability = await Translator.availability(opts)'));
  assert.ok(fallback.includes("new Worker(new URL('./translation-worker.js', import.meta.url)"));
  assert.ok(worker.includes("pipeline('translation', 'Xenova/opus-mt-nl-fr'"));
  assert.ok(worker.includes("dtype: 'q8'"));
  assert.ok(worker.includes("device: 'wasm'"));
  assert.ok(!worker.includes('token='));
  assert.ok(!worker.includes('api_key'));
});

test('Frans stemmodel kan zonder handmatige checkpointmap worden geladen',()=>{
  assert.ok(html.includes('id="loadPublicFrench"'));
  assert.ok(html.includes('Franse AI-stem laden'));
  assert.ok(html.includes('class="advanced-setting"'));
  assert.ok(main.includes('ldenoue/phonon-40m-multilingual'));
  assert.ok(main.includes('gradium/phonon-voices'));
  assert.ok(main.includes("lang:'fr',quant:'q8'"));
});
test('iPhone audio krijgt een actieve context vanuit de overnameklik',()=>{
  assert.ok(main.includes('function prewarmFrenchAudio()'));
  assert.ok(main.includes('prewarmFrenchAudio();'));
  assert.ok(main.includes("preparedFrenchContext && preparedFrenchContext.state !== 'closed'"));
  assert.ok(main.includes('function releasePreparedAudio()'));
});

test('menu toont eerst alleen voorbereiding en eenvoudige bediening',()=>{
  assert.ok(html.includes('id="runtimeStatus" aria-live="assertive"'));
  assert.ok(html.includes('Start / hervat ondertiteling'));
  assert.ok(html.includes('AI neemt over'));
  assert.ok(html.includes('Handmatige stappen'));
  assert.ok(html.includes('compact-details'));
  assert.ok(html.includes('<summary>Franse speech</summary>'));
  assert.ok(main.includes('Tik nogmaals op Start ondertiteling'));
});

test('op iOS zichtbaar waarschuwen wanneer microfoon geen woorden herkent',()=>{
  assert.ok(main.includes('micSilentTimer = setTimeout'));
  assert.ok(main.includes('const onIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)'));
  assert.ok(main.includes('if (phase === \'live\') {\n    stopMic();'));
  assert.ok(main.includes('De microfoon kon na de Franse speech niet opnieuw starten'));
});
