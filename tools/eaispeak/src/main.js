import {availableVoices,readVoicePreference,saveVoicePreference} from './browser-voice-choice.mjs';
import {startSpeechBridge,probeSpeechBridge} from './speech-bridge.mjs';
import {validateSpeechPair} from './speech-engines.mjs';
import {validateTranslationPair,localTranscriptEndpoint,captionLines,createFinalQueue} from './live-session.mjs';
import {createPhononVoice} from './phonon-voice.js';
const $ = id => document.getElementById(id);
const stage=$('stage'), surface=$('displayText');
const synth=window.speechSynthesis;
let active=null, generation=0, translator=null, translatorKey='', preparing=null;
let microphoneTest=null, microphoneTimer=null, finalLines=[], draftText='', records=[], voicePending=0, reading=false;
const phonon=createPhononVoice({status:(m,t)=>feedback('frenchStatus',m,t),onReady:()=>componentStatus('frenchStatus','ready','Franse audiobuffer geproduceerd'),latency:m=>feedback('latencyStatus',m)});
function feedback(id,message,type=''){
  const node=$(id);node.textContent=message;node.classList.remove('good','bad');if(type)node.classList.add(type);
}
function componentStatus(id,state,message,error=null){
  window.dispatchEvent(new CustomEvent('cloud-function-status',{detail:{id,state,message,error:error?String(error?.message||error):null}}));
}
function panel(open) {
  document.body.classList.toggle('panel-visible',open);
  $('panel').inert = !open;
  stage.inert = open;
  $('panel').classList.toggle('open',open);
  $('panel').setAttribute('aria-hidden',String(!open));
  $('mobileSettings').setAttribute('aria-expanded',String(open));
  if(open)$('panelClose').focus({preventScroll:true});else $('mobileSettings').focus({preventScroll:true});
}
$('mobileSettings').addEventListener('click',()=>panel(!$('panel').classList.contains('open')));
$('panelClose').onclick=()=>panel(false);
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;
  if(event.key==='Escape'){event.preventDefault();panel(!$('panel').classList.contains('open'));return;}
  if ($('panel').classList.contains('open')) return;
});
function settings(){
  return {mode:$('liveMode').value,source:$('liveSource').value,target:$('liveTarget').value,route:$('translationEngine').value,recognition:$('liveRecognition').value,endpoint:$('liveEndpoint').value,drafts:$('translationDrafts').checked,speak:$('liveSpeak').checked};
}
function local(s){return ['whisper','apple'].includes(s.recognition);}
function native(s){return s.recognition==='hibiki'||s.recognition==='hibiki-zero';}
function validate(s){
  if(native(s)){if(s.mode!=='translate')throw new Error('Kies live vertalen voor Hibiki.');validateSpeechPair(s.recognition,s.source,s.target);}
  else if(s.mode==='translate')validateTranslationPair(s.route,s.source,s.target);
  if(local(s))localTranscriptEndpoint(s.endpoint);
  return s;
}
function syncSettings(){
  const s=settings(),translated=s.mode==='translate',isNative=native(s);
  $('liveTargetRow').hidden=!translated;
  $('liveTranslationRow').hidden=!translated||isNative;
  $('liveVoiceRow').hidden=!translated||isNative;
  $('liveEndpointRow').hidden=s.recognition==='browser';
  $('liveRouteHint').textContent=s.recognition==='apple'?'macOS 26 of nieuwer: gebruikt een geïnstalleerd Apple-taalmodel, indien beschikbaar.':s.recognition==='whisper'?'Microfoon naar de eigen Whisper-bridge. Geen opslag op die bridge.':isNative?'Vereist een eigen draaiende modelserver. Alleen de ondersteunde taalrichting werkt.':'Browserherkenning kan een online dienst gebruiken.';
  for(const id of ['liveMode','liveSource','liveTarget','liveRecognition','liveEndpoint','translationEngine','translationDrafts','liveSpeak'])$(id).disabled=Boolean(active||preparing);
  $('start').disabled=Boolean(active||preparing);
  $('panic').disabled=!active||Boolean(active?.finishing);
  $('stageStop').hidden=!active;$('stageStop').disabled=Boolean(active?.finishing);
  $('prepareTranslate').disabled=Boolean(active||preparing);
  $('downloadTranscript').disabled=!records.length;
}
for(const id of ['liveMode','liveSource','liveTarget','translationEngine','translationDrafts','liveSpeak','liveRecognition','liveEndpoint']){
  $(id).addEventListener('change',()=>{
    if(id==='liveRecognition')$('liveEndpoint').value=['whisper','apple'].includes($('liveRecognition').value)?'ws://localhost:8766/eaispeak':'ws://localhost:8765/eaispeak';
    feedback('translationStatus','Instellingen gewijzigd. Bereid de gekozen route zo nodig voor.');syncSettings();
  });
}
async function getTranslator(s){
  const pair=validateTranslationPair(s.route,s.source,s.target),key=s.route+':'+s.source+':'+s.target;
  if(translator&&translatorKey===key)return translator;
  if(translator){await translator.dispose?.();await translator.destroy?.();translator=null;translatorKey='';}
  let result;
  if(s.route==='chrome'){
    if(!globalThis.Translator)throw new Error('Chrome Translator is niet beschikbaar. Kies een ondersteunde lokale route.');
    const availability=await Translator.availability(pair);
    if(availability==='unavailable')throw new Error('Chrome ondersteunt deze taalrichting niet op dit apparaat.');
    result=await Translator.create({...pair,monitor(m){m.addEventListener('downloadprogress',e=>feedback('translationStatus','Taalpakket '+Math.round(e.loaded*100)+'%'));}});
  }else{
    const {createBrowserTranslator}=await import('./translation-fallback.js');
    result=await createBrowserTranslator(m=>feedback('translationStatus',m));
  }
  translator=result;translatorKey=key;return translator;
}
async function prepareTranslation(){
  if(active||preparing)return;
  const s=settings();
  preparing=(async()=>{
    validate(s);componentStatus('translationStatus','busy','Gekozen route voorbereiden');
    if(s.recognition!=='browser'){
      const target=native(s)?s.target:s.source;
      const probe=await probeSpeechBridge({endpoint:local(s)?localTranscriptEndpoint(s.endpoint):s.endpoint,engine:s.recognition,sourceLanguage:s.source,targetLanguage:target,onStatus:m=>feedback('translationStatus',m)});s.provider=probe.provider;
    }
    if(s.mode==='translate'&&!native(s))await getTranslator(s);
    feedback('translationStatus','Route voorbereid'+(s.provider?' · '+s.provider:'')+'. Nog geen live audio getest.','good');
    componentStatus('translationStatus','idle','Route voorbereid, nog niet live getest');
  })();
  syncSettings();
  try{await preparing;}catch(e){feedback('translationStatus',e.message,'bad');componentStatus('translationStatus','error','Voorbereiding mislukt',e);}
  finally{preparing=null;syncSettings();}
}
$('prepareTranslate').onclick=prepareTranslation;
function renderCaptions(){
  stage.dataset.display='captions';
  if(!surface.classList.contains('caption-layout')){
    surface.replaceChildren();surface.classList.add('caption-layout');
    for(const cls of ['caption-previous','caption-current','caption-draft']){const el=document.createElement('div');el.className='caption-row '+cls;surface.append(el);}
  }
  const vals=[finalLines.length>1?finalLines.at(-2):'',finalLines.at(-1)||'',draftText];
  [...surface.children].forEach((el,i)=>{el.textContent=vals[i];el.classList.toggle('empty',!vals[i]);});
  $('translationMeta').textContent=active?.settings.mode==='translate'?'Live vertaling':'Live tekst';
}
function record(text,translated){
  if(records.length>=3000){fail(new Error('Transcript is vol. Download de tekst en begin een nieuwe sessie.'));return;}
  records.push({text,translated});$('liveTranscript').value=records.map(r=>r.translated&&r.translated!==r.text?r.text+'\n'+r.translated:r.text).join('\n\n');
  $('downloadTranscript').disabled=false;
}
function speakBrowser(text,language,{onEnd=()=>{},onError=()=>{}}={}){
  if(!synth||!window.SpeechSynthesisUtterance){onError(new Error('Geen browserstem beschikbaar.'));return;}
  const voices=availableVoices(synth,language),chosen=voices.find(v=>v.voiceURI===readVoicePreference(language))||voices[0];
  if(!chosen){onError(new Error('Geen passende stem op dit apparaat.'));return;}
  const utterance=new SpeechSynthesisUtterance(text);utterance.voice=chosen;utterance.lang=chosen.lang;utterance.rate=.95;
  utterance.onend=onEnd;utterance.onerror=e=>onError(new Error(e.error||'Spraakuitvoer mislukt'));
  synth.speak(utterance);
}
function showFinal(text,translated,session){
  if(active!==session)return;
  draftText='';finalLines.push(...captionLines(translated));finalLines=finalLines.slice(-2);record(text,translated);
  renderCaptions();
  if(session.settings.mode==='translate')componentStatus('translationStatus','ready','Live vertaling ontvangen');
  if(!session.finishing&&session.settings.speak&&!native(session.settings)&&voicePending<3){
    voicePending++;speakBrowser(translated,session.settings.target,{onEnd:()=>{if(active===session)voicePending=Math.max(0,voicePending-1);},onError:e=>{if(active===session){voicePending=Math.max(0,voicePending-1);feedback('runtimeStatus',e.message,'bad');}}});
  }else if(!session.finishing&&session.settings.speak&&!native(session.settings)&&voicePending>=3)feedback('runtimeStatus','Spraakuitvoer loopt achter. Tekst blijft beschikbaar.','bad');
}
function stopLive(message='Gestopt.'){
  const s=active;active=null;generation++;
  if(s){clearTimeout(s.finishTimer);clearTimeout(s.draftTimer);s.queue?.stop();s.abort.abort();try{s.recognition?.abort();}catch{}s.bridge?.stop();if(s.settings.speak||native(s.settings))synth?.cancel();}
  voicePending=0;stage.dataset.phase='stopped';draftText='';if(finalLines.length)renderCaptions();
  feedback('phaseStatus','Gestopt');feedback('runtimeStatus',message);syncSettings();
}
function requestStop(){
  const s=active;if(!s||s.finishing)return;
  if(local(s.settings)&&s.bridge?.finishInput()){
    s.finishing=true;clearTimeout(s.draftTimer);s.draftVersion++;synth?.cancel();
    feedback('phaseStatus','Laatste audio verwerken…');feedback('runtimeStatus','Microfoon uit. Laatste woorden worden verwerkt.');
    $('stageStop').disabled=true;$('panic').disabled=true;return;
  }
  if(s.settings.recognition==='browser'&&s.recognition){
    s.finishing=true;clearTimeout(s.draftTimer);s.draftVersion++;synth?.cancel();
    feedback('phaseStatus','Laatste woorden verwerken…');$('stageStop').disabled=true;$('panic').disabled=true;
    s.finishTimer=setTimeout(()=>{if(active===s)void completeSession(s);},2000);
    try{s.recognition.stop();}catch{void completeSession(s);}return;
  }
  stopLive();
}
async function completeSession(s){
  if(active!==s||s.completing)return;
  s.completing=true;s.finishing=true;clearTimeout(s.finishTimer);clearTimeout(s.draftTimer);
  s.finishTimer=setTimeout(()=>{if(active===s)fail(new Error('Laatste vertaling duurde te lang.'));},45000);
  await s.queue.idle();
  if(active===s)stopLive('Gestopt. Laatste tekst verwerkt.');
}
function fail(error){stopLive(error.message||String(error));feedback('runtimeStatus',error.message||String(error),'bad');panel(true);}
function submitFinal(text,s){const clean=text.trim();if(active!==s||!clean)return;s.draftVersion++;clearTimeout(s.draftTimer);draftText='';s.queue.add(clean);}
function submitDraft(text,s){
  if(active!==s||s.finishing||!s.settings.drafts)return;
  const version=++s.draftVersion;clearTimeout(s.draftTimer);
  s.draftTimer=setTimeout(async()=>{if(active!==s||s.queue.pending)return;try{const result=await s.translate(text);if(active===s&&s.draftVersion===version&&!s.queue.pending){draftText=captionLines(result).at(-1)||'';renderCaptions();}}catch{/* A preliminary result is optional; the final queue reports errors. */}},380);
}
function startBrowser(s){
  const SR=window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR)throw new Error('Deze browser heeft geen spraakherkenning. Kies de lokale Whisper-bridge.');
  function listen(){
    if(active!==s||s.finishing||document.hidden)return;
    const instance=new SR();s.recognition=instance;instance.lang=s.settings.source;instance.continuous=true;instance.interimResults=s.settings.drafts;
    instance.onresult = event => {
      if(active!==s)return;
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){const item=event.results[i],words=item[0]?.transcript||'';if(item.isFinal)submitFinal(words,s);else interim+=words+' ';}
      if(interim)submitDraft(interim.trim(),s);
    };
    instance.onstart=()=>{if(active===s){feedback('phaseStatus','Luistert');componentStatus('microphoneStatus','idle','Luistert; nog geen tekst ontvangen');}};
    instance.onerror=e=>{if(active===s&&e.error!=='aborted'&&e.error!=='no-speech')fail(new Error('Spraakherkenning: '+e.error));};
    instance.onend=()=>{if(active===s&&s.finishing){void completeSession(s);return;}if(active===s)setTimeout(()=>{if(active===s)try{listen();}catch(e){fail(e);}},250);};
    instance.start();
  }
  listen();
}
async function startLive(){
  if(active||preparing)return;
  let config;
  try{
    config=validate(settings());
    if(config.mode==='translate'&&!native(config)&&translatorKey!==config.route+':'+config.source+':'+config.target){feedback('runtimeStatus','Klik eerst op Voorbereiden om het vertaalmodel te laden.','bad');return;}
    if(config.recognition==='browser'&&!(window.SpeechRecognition||window.webkitSpeechRecognition))throw new Error('Browserherkenning is niet beschikbaar.');
    window.dispatchEvent(new Event('eaispeak-stop-conversation'));stopReading();stopMicTest();
    const s={settings:config,abort:new AbortController(),draftVersion:0,draftTimer:null,recognition:null,bridge:null};
    active=s;generation++;finalLines=[];draftText='';surface.replaceChildren();surface.classList.remove('caption-layout');
    s.translate=config.mode==='translate'&&!native(config)?text=>translator.translate(text):async text=>text;
    s.queue=createFinalQueue({translate:s.translate,onFinal:(text,out)=>showFinal(text,out,s),onError:e=>{if(active===s)fail(e);}});
    stage.dataset.phase='live';feedback('phaseStatus','Starten…');feedback('runtimeStatus','Microfoon openen…');syncSettings();
    if(config.recognition==='browser'){startBrowser(s);panel(false);feedback('runtimeStatus','Live sessie gestart.');return;}
    const bridge=await startSpeechBridge({endpoint:local(config)?localTranscriptEndpoint(config.endpoint):config.endpoint,engine:config.recognition,sourceLanguage:config.source,targetLanguage:native(config)?config.target:config.source,signal:s.abort.signal,onStatus:m=>{if(active===s){feedback('runtimeStatus',m);if(m.startsWith('Verbonden')){feedback('phaseStatus','Luistert');panel(false);}}},onTranscript:text=>{if(active===s&&!native(config))submitFinal(text,s);},onDraft:text=>submitDraft(text,s),onTranslation:text=>{if(active===s&&native(config)){draftText='';finalLines.push(...captionLines(text));finalLines=finalLines.slice(-2);record('',text);renderCaptions();}},onEnd:(m,completed)=>{if(active===s){if(completed&&s.finishing)void completeSession(s);else fail(new Error(m));}}});
    if(active!==s)bridge.stop();else s.bridge=bridge;
  }catch(e){fail(e);}
}
$('start').onclick=startLive;
$('panic').onclick=requestStop;
$('stageStop').onclick=()=>{requestStop();panel(true);};
window.addEventListener('eaispeak-stop-live',()=>{if(active)stopLive();if(reading)stopReading();});
for(const tab of document.querySelectorAll('.studio-tab:not(#tab-podium)'))tab.addEventListener('click',()=>{if(active)stopLive();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(active)stopLive();stopMicTest();stopReading();}});
$('reset').onclick=()=>{if(active)stopLive();records=[];finalLines=[];draftText='';$('liveTranscript').value='';surface.replaceChildren();syncSettings();};
$('downloadTranscript').onclick=()=>{
  if(!records.length)return;const url=URL.createObjectURL(new Blob([$('liveTranscript').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='eaispeak-transcript.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('testTranslate').onclick=async()=>{
  if(active||preparing)return;
  const s=settings(),input=$('testDutch').value.trim();
  if(!input){feedback('translationTestResult','Typ eerst een tekst.','bad');return;}
  try{const engine=await getTranslator(s);const translated=await engine.translate(input);if(!translated?.trim())throw new Error('Geen vertaling ontvangen.');$('translationTestResult').textContent = translated;componentStatus('translationStatus','ready','Tekst vertaald');}
  catch(e){feedback('translationTestResult',e.message,'bad');componentStatus('translationStatus','error','Vertaaltest mislukt',e);}
};
function stopMicTest(){clearTimeout(microphoneTimer);const test=microphoneTest;microphoneTest=null;try{test?.abort();}catch{}}
$('prepareMic').onclick=async()=>{
  if(active)return;window.dispatchEvent(new Event('eaispeak-stop-conversation'));stopReading();stopMicTest();const s=settings();
  $('prepareMic').disabled=true;
  try{
    const openedStream=await navigator.mediaDevices.getUserMedia({audio:true});
    openedStream.getTracks().forEach(track=>track.stop());
    feedback('microphoneDeviceStatus','Microfoon bereikbaar: toestemming en audiotrack.','good');
    if(s.recognition!=='browser'){await probeSpeechBridge({endpoint:local(s)?localTranscriptEndpoint(s.endpoint):s.endpoint,engine:s.recognition,sourceLanguage:s.source,targetLanguage:native(s)?s.target:s.source});feedback('microphoneStatus','Bridge gereed. Test echte audio via Live.','good');return;}
    const SR=window.SpeechRecognition || window.webkitSpeechRecognition;if(!SR)throw new Error('Spraakherkenning ontbreekt.');
    const instance=new SR();microphoneTest=instance;instance.lang=s.source;instance.continuous=false;instance.interimResults=false;
    instance.onresult = event => {if(microphoneTest!==instance)return;const words=event.results[0][0].transcript;feedback('recognizedDutch',words);feedback('microphoneStatus','Spraakherkenning: woorden ontvangen.','good');componentStatus('microphoneStatus','ready','Woorden ontvangen');stopMicTest();};
    instance.onerror=e=>{if(microphoneTest===instance){feedback('microphoneStatus','Spraakherkenning: '+e.error,'bad');componentStatus('microphoneStatus','error','Geen woorden ontvangen',new Error(e.error));stopMicTest();}};
    microphoneTimer=setTimeout(()=>{if(microphoneTest===instance){feedback('microphoneStatus','Spraakherkenning reageert niet.','bad');stopMicTest();}},12000);
    instance.start();
  }catch(e){feedback('microphoneStatus',e.message,'bad');componentStatus('microphoneStatus','error','Microfoontest mislukt',e);}
  finally{$('prepareMic').disabled=false;}
};
function refreshVoice(select,language){
  const voices=availableVoices(window.speechSynthesis,language),current=select.value||readVoicePreference(language);
  select.replaceChildren(new Option('Automatisch passende stem',''),...voices.map(v=>new Option(v.name+' · '+v.lang,v.voiceURI)));
  if(voices.some(v=>v.voiceURI===current))select.value=current;
}
function populateVoices(){
  refreshVoice($('nlVoice'),'nl');refreshVoice($('enVoice'),'en');
}
populateVoices();synth?.addEventListener?.('voiceschanged',populateVoices);
for(const [id,lang] of [['nlVoice','nl'],['enVoice','en']])$(id).onchange=()=>saveVoicePreference(lang,$(id).value);
function previewBrowser(language,text,status){
  if(active)stopLive();window.dispatchEvent(new Event('eaispeak-stop-conversation'));stopReading();synth?.cancel();
  speakBrowser(text,language,{onEnd:()=>feedback(status,'Voorbeeld afgespeeld.','good'),onError:e=>feedback(status,e.message,'bad')});
}
$('previewDutch').onclick=()=>previewBrowser('nl-NL','Hallo, dit is een Nederlandse stem.','dutchStatus');
$('previewEnglish').onclick=()=>previewBrowser('en-US','Good evening, everyone. This is an English voice.','englishStatus');
$('loadPublicFrench').onclick=()=>phonon.loadPublic();
$('loadFrench').onclick=()=>phonon.loadFiles($('modelFolder').files);
$('previewFrench').onclick=()=>{if(active)stopLive();window.dispatchEvent(new Event('eaispeak-stop-conversation'));stopReading();phonon.speak('Bonjour, voici une voix française.').catch(e=>feedback('frenchStatus',e.message,'bad'));};
function stopReading(){reading=false;synth?.cancel();phonon.stop();feedback('readStatus','Gestopt.');}
$('readStop').onclick=stopReading;
$('readStart').onclick=()=>{
  if(active)stopLive();window.dispatchEvent(new Event('eaispeak-stop-conversation'));stopReading();const text=$('readText').value.trim(),lang=$('readLanguage').value;
  if(!text){feedback('readStatus','Voer eerst tekst in.','bad');return;}
  if($('readEngine').value==='phonon'&&lang!=='fr-FR'){feedback('readStatus','Deze Phonon-stem ondersteunt Frans.','bad');return;}
  reading=true;feedback('readStatus','Leest voor…');
  const finish=()=>{if(reading){reading=false;feedback('readStatus','Klaar.','good');}};
  const error=e=>{if(reading){reading=false;feedback('readStatus',e.message,'bad');}};
  if($('readEngine').value==='phonon')phonon.speak(text).then(finish,error);else speakBrowser(text,lang,{onEnd:finish,onError:error});
};
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
syncSettings();
panel(true);
