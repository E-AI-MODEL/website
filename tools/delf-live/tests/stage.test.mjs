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
  assert.ok(main.includes('translateFinal(words)'));
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
  assert.ok(main.includes('const segments = speechSegments(getActiveSession().speech)'));
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
  assert.ok(html.includes('Test microfoon'));
  assert.ok(main.includes('microphoneCheck = instance'));
  assert.ok(main.includes("instance.lang = 'nl-NL'"));
  assert.ok(main.includes('instance.onresult = event =>'));
  assert.ok(main.includes('Herkend Nederlands: '));
  assert.ok(!main.includes('Microfoon beschikbaar. Gebruik Nederlands.'));
});
test('geen schijnstart bij ontbrekende vertaling, fout is zichtbaar',()=>{
  assert.ok(main.includes('function goStart()'));
  assert.ok(main.includes('const translated=await prepareTranslation()'));
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
  assert.ok(html.includes('Laad Franse stem'));
  assert.ok(html.includes('advanced-setting'));
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
  assert.ok(html.includes('Start Nederlands'));
  assert.ok(html.includes('Franse speech'));
  assert.ok(html.includes('Bediening'));
  assert.ok(html.includes('studio-disclosure'));
  assert.ok(html.includes('<summary>Teksten bekijken</summary>'));
  assert.ok(main.includes("$('prepareShow').addEventListener('click',prepareShow)"));
});

test('op iOS zichtbaar waarschuwen wanneer microfoon geen woorden herkent',()=>{
  assert.ok(main.includes('micSilentTimer = setTimeout'));
  assert.ok(main.includes('const onIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)'));
  assert.ok(main.includes('if (phase === \'live\') {\n    stopMic();'));
  assert.ok(main.includes('De microfoon kon na de Franse speech niet opnieuw starten'));
});

test('Franse speech kan per passage worden bediend, zonder Nederlandse stem als voorwaarde',()=>{
  assert.ok(html.includes('id="nextFrenchPassage"'));
  assert.ok(html.includes('id="previousFrenchPassage"'));
  assert.ok(html.includes('id="speechProgress"'));
  assert.ok(main.includes('function nextFrenchPassage()'));
  assert.ok(main.includes('function previousFrenchPassage()'));
  assert.ok(main.includes('frenchSegmentIndex = i + 1'));
  assert.ok(main.includes("if (phase === 'french') nextFrenchPassage();"));
  const block=main.slice(main.indexOf('function goInterrupt()'),main.indexOf('function goFrench()'));
  assert.ok(block.includes('if (selectedDutchVoice)'));
  assert.ok(block.includes('beginReplyWindow(now)'));
  assert.ok(!block.includes("reportError('Selecteer eerst een Nederlandse stem.')"));
  const handbackBlock=main.slice(main.indexOf('function goHandback()'),main.indexOf('function goFinish()'));
  assert.ok(handbackBlock.includes('if (selectedDutchVoice)'));
  assert.ok(!handbackBlock.includes('Nederlandse teruggavestem ontbreekt'));
});

test('reserveprogramma start Franse speech alleen vanuit vertalende podiumstand',()=>{
  assert.match(html,/id="reserveProgramme"/);
  assert.match(html,/id="reserveSpeech"/);
  assert.match(html,/id="reserveTakeBack"/);
  assert.match(main,/function reserveFrenchSpeech\(\)/);
  assert.match(main,/phase!=='live' && phase!=='intro'/);
  assert.match(main,/reserveSpeechActive=true/);
  assert.match(main,/setPhase\(\x27interrupted\x27,\x27FRANSE SPEECH\x27\)/);
  assert.match(main,/goFrench\(\);/);
});
test('reserveprogramma kan onderbreken en live vertaling weer starten',()=>{
  const start=main.indexOf('function reserveTakeBack()');
  const end=main.indexOf('function goStart()',start);
  assert.ok(start>=0&&end>start);
  const part=main.slice(start,end);
  assert.match(part,/stopVoices\(\)/);
  assert.match(part,/setPhase\(\x27handback\x27,\x27WOORD TERUG\x27\)/);
  assert.match(part,/reserveSpeechActive=false/);
  assert.match(part,/goFinish\(\)/);
  assert.ok(main.includes('if (reserveSpeechActive) {'));
  assert.match(main,/reserveSpeechActive=false;\n  releasePreparedAudio\(\)/);
});

test('podium bereidt onderdelen samen voor zonder Terminal',()=>{
  assert.match(html,/id="prepareShow"/);
  assert.match(html,/id="showReadyStatus"/);
  assert.match(html,/Start Nederlands/);
  assert.match(html,/Franse speech/);
  assert.match(main,/async function prepareShow\(\)/);
  assert.match(main,/await prepareTranslation\(\)/);
  assert.doesNotMatch(main.slice(main.indexOf('async function prepareShow()'),main.indexOf("$('prepareShow').addEventListener")), /loadPublicFrench/);
});
test('Franse noodspeech kan zonder actieve vertaling starten',()=>{
  const part=main.slice(main.indexOf('function reserveFrenchSpeech()'),main.indexOf('function reserveTakeBack()'));
  assert.doesNotMatch(part,/if\(!translator\)/);
  assert.match(part,/phase!=='live' && phase!=='intro'/);
  assert.match(main,/interrupt:reserveFrenchSpeech/);
  assert.match(main,/if\(translator\) goFinish\(\)/);
});

test('nieuwe voorstelling heeft twee aparte geluidsopnamen en vereenvoudigd menu',()=>{
  assert.match(html,/id="scriptedStart"/);
  assert.match(html,/id="scriptedNext"/);
  assert.match(html,/id="scriptedAudioOne"/);
  assert.match(html,/id="scriptedAudioTwo"/);
  assert.match(html,/id="extraStudioTabs"/);
  assert.match(html,/Overige opties/);
  assert.match(html,/>Instellingen<\/button>/);
});
test('Nederlands antwoord heeft geen timer en volgende scène start pas door pijl',()=>{
  const part=main.slice(main.indexOf('let scriptedMode'),main.indexOf('// De centrale lijnen'));
  assert.match(part,/scriptedMode='reply'/);
  assert.match(part,/Jij antwoordt nu zelf\. Er is geen timer/);
  assert.match(part,/else if\(scriptedMode==='reply'\)playScriptedScene\(1\)/);
  assert.doesNotMatch(part,/setTimeout\(/);
  assert.match(main,/if\(scriptedMode!=='off'\)\{scriptedNext\(\);return;\}/);
});
test('scène twee eindigt zonder automatische live vertaling of gesproken slot',()=>{
  const part=main.slice(main.indexOf('function playScriptedScene('),main.indexOf("$('scriptedStart').addEventListener"));
  assert.match(part,/scriptedMode='finished'/);
  assert.match(part,/setPhase\('handback','JOUW NEDERLANDSE SLOT'\)/);
  assert.match(part,/blankStage\(\)/);
  assert.doesNotMatch(part,/goFinish\(/);
});
test('Scène-afspelen gebruikt geluidsbestanden, niet browserstem of AI-model',()=>{
  const part=main.slice(main.indexOf('function playScriptedScene('),main.indexOf('function scriptedNext()'));
  assert.match(part,/new Audio\(scriptedAudioUrls\[index\]\)/);
  assert.match(part,/player\.play\(\)/);
  assert.doesNotMatch(part,/speechSynthesis\.speak/);
  assert.doesNotMatch(part,/french\.stream/);
});

test('rechterpijl bevestigt de handeling met een subtiele visuele golf',()=>{
  const css=readFileSync(new URL('../cloud-shell.css',import.meta.url),'utf8');
  assert.match(html,/id="arrowWave" class="arrow-wave" aria-hidden="true"/);
  assert.match(css,/\.arrow-wave\.is-pulsing/);
  assert.match(css,/@keyframes delf-arrow-wave/);
  assert.match(css,/pointer-events:none/);
  assert.match(main,/function acknowledgeArrow\(\)/);
  assert.match(main,/wave\.classList\.remove\('is-pulsing'\)/);
  assert.match(main,/wave\.classList\.add\('is-pulsing'\)/);
});
test('scène bevestigen met golf verandert de handmatige wachtstand niet',()=>{
  const block=main.slice(main.indexOf('function scriptedNext()'),main.indexOf("$('scriptedStart').addEventListener"));
  assert.match(block,/acknowledgeArrow\(\)/);
  assert.match(block,/if\(scriptedMode==='armed'\)playScriptedScene\(0\)/);
  assert.match(block,/scriptedMode==='reply'\)playScriptedScene\(1\)/);
  assert.doesNotMatch(block,/setTimeout\(/);
  const key=main.slice(main.indexOf("if (event.code === 'ArrowRight')"));
  assert.match(key,/if\(scriptedMode!=='off'\)\{scriptedNext\(\);return;\}/);
  assert.match(key,/acknowledgeArrow\(\)/);
});

test('einde scene twee geeft vanzelf een golf zonder de microfoon te starten',()=>{
  const block=main.slice(main.indexOf('function playScriptedScene('),main.indexOf('function scriptedNext()'));
  assert.match(block,/scriptedMode='finished';\s*setPhase\('handback','JOUW NEDERLANDSE SLOT'\);\s*blankStage\(\);[\s\S]*?acknowledgeArrow\(\)/);
  assert.doesNotMatch(block,/startMic\(/);
  assert.doesNotMatch(block,/goFinish\(/);
});
test('microfoon is uit tijdens scene een, eigen antwoord, scene twee en slot',()=>{
  const start=main.slice(main.indexOf('function startMic()'), main.indexOf('function stopMic()',main.indexOf('function startMic()')));
  assert.match(start,/\['scene1','reply','scene2','finished'\]\.includes\(scriptedMode\)/);
  const block=main.slice(main.indexOf('function playScriptedScene('),main.indexOf('function scriptedNext()'));
  assert.match(block,/stopMic\(\);stopVoices\(\);stopScriptedPlayer\(\)/);
});
test('de pauzeknop stopt een vooraf opgenomen fragment zonder nieuwe stem aan te zetten',()=>{
  const block=main.slice(main.indexOf('function togglePause()'),main.indexOf('function followAudioClock('));
  assert.match(block,/scriptedPlayer\.pause\(\)/);
  assert.match(block,/scriptedPlayer\.play\(\)/);
});

test('Franse scene-opnamen blijven zonder externe hosting lokaal in Safari',()=>{
  const block=main.slice(main.indexOf('const scriptedDbName='),main.indexOf('function scriptedFeedback('));
  assert.match(block,/indexedDB\.open\(scriptedDbName,1\)/);
  assert.match(block,/tx\.objectStore\('audio'\)\.put\(file,index\)/);
  assert.match(block,/tx\.objectStore\('audio'\)\.get\(index\)/);
  assert.match(block,/!scriptedAudioChosen\[index\]/);
  assert.ok(main.includes('void loadBuiltInFrenchScenes();'));
});

test('de twee Franse MP3s worden automatisch ingeladen; eigen audio blijft optioneel',()=>{
  assert.match(main,/function loadBuiltInFrenchScenes\(\)/);
  assert.match(main,/scene-1-interruption\.mp3/);
  assert.match(main,/scene-2-discours\.mp3/);
  assert.ok(main.includes('void loadBuiltInFrenchScenes();'));
  assert.match(html,/Andere audio kiezen \(optioneel\)/);
  assert.match(html,/Franse opnamen worden automatisch geladen/);
  assert.match(main,/new Audio\(scriptedAudioUrls\[index\]\)/);
});
test('DELF audio workflow synthesizes from the exact speech instead of hardcoded short samples',()=>{
  const generator=readFileSync(new URL('../scripts/generate_scene_audio.py',import.meta.url),'utf8');
  assert.match(generator,/ROOT\s*\/\s*'src\/script\.mjs'/);
  assert.match(generator,/KPipeline\(lang_code='f'\)/);
  assert.match(generator,/scene-2-discours\.mp3/);
  assert.match(generator,/SCENE_1/);
  assert.match(generator,/Et maintenant, je vous rends la parole/);
});

test('dunne golflijnen reageren op de werkelijke MP3 in beide scenes',()=>{
  assert.match(main,/function connectScriptedAudio\(player\)/);
  assert.match(main,/createMediaElementSource\(player\)/);
  assert.match(main,/source\.connect\(analyser\)/);
  assert.match(main,/analyser\.connect\(context\.destination\)/);
  assert.match(main,/connectScriptedAudio\(player\)/);
  assert.match(main,/scriptedMode === 'scene1' \|\| scriptedMode === 'scene2'/);
  assert.match(main,/scriptedAnalyser\.getFloatTimeDomainData\(voiceSamples\)/);
  assert.match(main,/scriptedPlayer\?\.paused/);
  assert.match(main,/scriptedAnalyser = null;/);
  assert.match(main,/old\.close\(\)/);
});

test('vrij praten is gescheiden van de vaste voorstelling',()=>{
  assert.match(html,/id="tab-gesprek"/);
  assert.match(html,/id="page-gesprek"/);
  assert.match(html,/id="freeTalkSpeak"/);
  assert.match(html,/id="freeTalkStop"/);
  assert.match(html,/id="freeTalkPlay"/);
  assert.match(html,/id="freeTalkSend"/);
  assert.match(html,/\.\/src\/free-talk\.js/);
  assert.match(html,/https:\/\/js\.puter\.com\/v2\//);
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  assert.match(chat,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(chat,/rec\.lang=inputLang\.value/);
  assert.match(chat,/api\.ai\.chat\(messages/);
  assert.match(chat,/api\.ai\.txt2speech\(text/);
  assert.match(chat,/play\.addEventListener\('click'/);
  assert.match(chat,/language:'fr-FR'/);
  assert.match(chat,/if\(own!==turn\)return/);
  assert.doesNotMatch(chat,/ollama serve|localhost:11434|Caddy/);
});

test('EAIspeak is de naam van de hub en de bestaande DELF-scènes blijven behouden',()=>{
  assert.match(html,/<title>EAIspeak \| praten, vertalen en presenteren<\/title>/);
  assert.match(html,/id="scriptedStart"/);
  assert.match(html,/id="freeTalkSpeak"/);
  assert.match(html,/id="arrowWave"/);
  const doc=readFileSync(new URL('../EAISPEAK-PIM-TECH.md',import.meta.url),'utf8');
  assert.match(doc,/project-pim/);
  assert.match(doc,/WebGPU/);
  assert.match(doc,/design-only/);
  const workflow=readFileSync(new URL('../../../.github/workflows/delf-live.yml',import.meta.url),'utf8');
  assert.match(workflow,/mkdir -p \/tools\/eaispeak/);
  assert.match(workflow,/mkdir -p \/tools\/delf-live/);
  assert.match(workflow,/https:\/\/eaimodel\.nl\/tools\/eaispeak\//);
});

test('EAIspeak laat alle zes richtingen tussen NL EN en FR kiezen',()=>{
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  for(const id of ['freeTalkInputLang','freeTalkOutputLang','freeTalkEngine','freeTalkVoice','freeTalkBrowserModel']){
    assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(chat,new RegExp(id));
  }
  for(const lang of ['nl-NL','en-US','fr-FR']){
    assert.match(html,new RegExp('value="'+lang+'"'));
    assert.match(chat,new RegExp(lang));
  }
  assert.match(chat,/rec\.lang=inputLang\.value/);
  assert.match(chat,/outputLang\.value/);
  assert.match(chat,/history\.length=0/);
  assert.match(chat,/engine\.value==='browser'/);
  assert.match(chat,/localReply\(messages,browserModel\.value/);
  assert.match(chat,/api\.ai\.chat\(messages/);
});
test('browser-LLM laadt alleen na expliciete keuze en ondersteunt statusweergave',()=>{
  const local=readFileSync(new URL('../src/browser-llm.js',import.meta.url),'utf8');
  assert.match(local,/Qwen2\.5-0\.5B-Instruct-q4f16_1-MLC/);
  assert.match(local,/Qwen2\.5-1\.5B-Instruct-q4f16_1-MLC/);
  assert.match(local,/if\(!navigator\.gpu\)/);
  assert.match(local,/await import\('@mlc-ai\/web-llm'\)/);
  assert.match(local,/initProgressCallback/);
  assert.match(local,/model\.chat\.completions\.create/);
  assert.doesNotMatch(local,/fetch\(.+api\/generate/);
});

test('Vrij praten gebruikt een compact zwevend taal- en modelmenu',()=>{
  const css=readFileSync(new URL('../cloud-shell.css',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  assert.match(html,/id="freeTalkOptions"/);
  assert.doesNotMatch(html,/id="freeTalkOptions" open/);
  assert.match(html,/id="freeTalkSummary"/);
  assert.match(html,/free-talk-floating-content/);
  assert.match(css,/\.free-talk-floating>\.mist-detail-body/);
  assert.match(css,/backdrop-filter:blur\(24px\)/);
  assert.match(chat,/modelSummary\.textContent=languages\[inputLang\.value\]/);
});
