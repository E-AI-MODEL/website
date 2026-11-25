// EAIspeak: vrij spreken, met apart gekozen model, taal en stem.
import {localReply,interruptBrowserReply,ensureBrowserModel,browserModelStatus} from './browser-llm.js';
import {checkWebGpuAvailability} from './gpu-capability.mjs';
import {availableVoices,readVoicePreference,saveVoicePreference,voiceLanguage} from './browser-voice-choice.mjs';
import {listLocalModels,validateLocalEndpoint} from './system-probes.mjs';
import {describeDevice,suggestDeviceSetup,modelDeviceAdvice} from './device-profile.mjs';
import {isSpeechEngine,speechEngine,validateSpeechPair} from './speech-engines.mjs';
import {startSpeechBridge,probeSpeechBridge} from './speech-bridge.mjs';
const $=id=>document.getElementById(id);
const speak=$('freeTalkSpeak'),stop=$('freeTalkStop'),send=$('freeTalkSend'),play=$('freeTalkPlay');
const status=$('freeTalkStatus'),heard=$('freeTalkHeard'),answer=$('freeTalkAnswer'),typed=$('freeTalkTyped');
const engine=$('freeTalkEngine'),browserModel=$('freeTalkBrowserModel'),cloudModel=$('freeTalkCloudModel');
const connect=$('freeTalkConnect'),connectStatus=$('freeTalkConnectionStatus'),onlineOptions=$('freeTalkOnlineOptions');
const inputLang=$('freeTalkInputLang'),outputLang=$('freeTalkOutputLang'),voice=$('freeTalkVoice');
const modelRow=$('freeTalkBrowserModelRow'),hint=$('freeTalkModelHint'),modelSummary=$('freeTalkSummary');
const preload=$('freeTalkPreload'),preloadStatus=$('freeTalkPreloadStatus');
const deviceStatus=$('freeTalkDeviceStatus'),deviceAdvice=$('freeTalkDeviceAdvice');
const ollamaOptions=$('freeTalkOllamaOptions'),ollamaEndpoint=$('freeTalkOllamaEndpoint');
const ollamaModel=$('freeTalkOllamaModel'),ollamaConnect=$('freeTalkOllamaConnect'),ollamaStatus=$('freeTalkOllamaStatus');
const voiceName=$('freeTalkVoiceName'),voiceNameRow=$('freeTalkVoiceNameRow');
const autoListen=$('freeTalkAutoListen'),speechIndicator=$('freeTalkSpeechIndicator'),voiceCanvas=$('freeTalkVoiceLines');
const speechOptions=$('freeTalkSpeechOptions'),speechEndpoint=$('freeTalkSpeechEndpoint'),speechProbe=$('freeTalkSpeechProbe');
const speechDescription=$('freeTalkSpeechDescription'),speechConnection=$('freeTalkSpeechConnection');
const speechSource=$('freeTalkSpeechSource'),voiceRow=$('freeTalkVoiceRow'),autoListenRow=$('freeTalkAutoListenRow');
let speechSession=null,speechAbort=null,speechStarting=false,speechProbing=false;
const voiceCtx=voiceCanvas?.getContext('2d')||null;
let speakingLevel=0,speechLoop=null,microphoneStream=null,microphoneContext=null,microphoneAnalyser=null;
let handsfree=false,manualReplay=false,restartTimer=null;
const STORAGE_KEY='eaispeak-free-talk-prefs-v1';
let saved={};
try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{}
function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({
    engine:engine.value,model:browserModel.value,voice:voice.value,voiceURI:voiceName.value,
    inputLang:inputLang.value,outputLang:outputLang.value,autoListen:autoListen.checked,endpoint:ollamaEndpoint.value,ollamaModel:ollamaModel.value,
    speechEndpoint:speechEndpoint.value
  }));}catch{}
}
function setSpeechActivity(kind){
  speechIndicator.textContent=kind==='listening'?'Je spreekt':kind==='answer'?'Antwoord klinkt':kind==='thinking'?'Antwoord wordt gemaakt':'Wacht op je stem';
  speakingLevel=kind==='listening'?.16:kind==='answer'?.27:0;
  voiceCanvas.dataset.mode=kind;
}
function drawLines(){
  if(!voiceCtx)return;
  const ratio=Math.min(2,devicePixelRatio||1),width=Math.round(voiceCanvas.clientWidth*ratio),height=Math.round(voiceCanvas.clientHeight*ratio);
  if(voiceCanvas.width!==width||voiceCanvas.height!==height){voiceCanvas.width=width;voiceCanvas.height=height;}
  voiceCtx.clearRect(0,0,width,height);
  const cx=width/2,cy=height/2,active=voiceCanvas.dataset.mode;
  const level=active==='listening'&&microphoneAnalyser?(()=>{
    const values=new Uint8Array(microphoneAnalyser.fftSize);microphoneAnalyser.getByteTimeDomainData(values);
    let sum=0;for(const v of values){const d=(v-128)/128;sum+=d*d;}return Math.min(.9,Math.sqrt(sum/values.length)*4);
  })():speakingLevel;
  speakingLevel+=(active==='idle'?0:Math.max(level,.08)-speakingLevel)*.09;
  const amp=active==='idle'?.025:Math.min(.7,speakingLevel);
  const time=performance.now()*.001;
  for(const i of [-.5,.5]){
    voiceCtx.beginPath();
    for(let x=0;x<=width;x+=4*ratio){
      const phase=(x-cx)/Math.max(1,width)*Math.PI*3.2;
      const envelope=Math.pow(Math.max(0,1-Math.abs(x-cx)/(width*.5)),1.8);
      const y=cy+i*3*ratio+Math.sin(phase+time*1.8+i*.5)*amp*16*ratio*envelope;
      if(x===0)voiceCtx.moveTo(x,y);else voiceCtx.lineTo(x,y);
    }
    voiceCtx.lineWidth=.6*ratio;voiceCtx.strokeStyle='rgba(78,124,131,'+(active==='idle'?.12:.18+amp*.45)+')';voiceCtx.stroke();
  }
  speechLoop=requestAnimationFrame(drawLines);
}
if(voiceCtx){voiceCanvas.dataset.mode='idle';speechLoop=requestAnimationFrame(drawLines);}
function releaseMicrophone(){
  if(microphoneStream){for(const track of microphoneStream.getTracks())track.stop();microphoneStream=null;}
  if(microphoneContext){void microphoneContext.close().catch(()=>{});microphoneContext=null;microphoneAnalyser=null;}
}
async function connectMicVisual(){
  // Alleen na een expliciete microfoonactie. Met deze audiostream wordt niets opgenomen.
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(!handsfree){stream.getTracks().forEach(track=>track.stop());return;}
    microphoneStream=stream;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(Ctx){
      microphoneContext=new Ctx();
      const source=microphoneContext.createMediaStreamSource(stream);
      microphoneAnalyser=microphoneContext.createAnalyser();microphoneAnalyser.fftSize=512;
      source.connect(microphoneAnalyser);
    }
  }catch{setStatus('Microfoonvisualisatie niet beschikbaar; spraakherkenning kan afzonderlijk werken.');}
}
function scheduleListen(own){
  if(!handsfree||own!==turn||document.hidden||!$('panel').classList.contains('open')||$('page-gesprek').hidden)return;
  clearTimeout(restartTimer);
  restartTimer=setTimeout(()=>{if(handsfree&&own===turn&&!pending&&!recognition)startListening();},500);
}
function afterResponse(own,message='Jij bent weer aan zet.'){
  if(own!==turn)return;
  ready();setStatus(message,'ready');setSpeechActivity('idle');
  if(!manualReplay)scheduleListen(own);
}
let recognition=null,audio=null,utterance=null,pending=false,turn=0,lastAnswer='';
let puterSdk=null,puterLoad=null,gpuProbeSequence=0;
const history=[];
const languages={'nl-NL':'Nederlands','en-US':'Engels','fr-FR':'Frans','es-ES':'Spaans','pt-PT':'Portugees','de-DE':'Duits'};
const hasMicrophone=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
const hasBrowserVoice=!!(window.speechSynthesis&&window.SpeechSynthesisUtterance);
const device=describeDevice({userAgent:navigator.userAgent,userAgentDataMobile:navigator.userAgentData?.mobile,
  platform:navigator.platform,touchPoints:navigator.maxTouchPoints||0,width:window.innerWidth,
  pointerCoarse:window.matchMedia?.('(pointer:coarse)')?.matches||false});
const memoryGB=Number.isFinite(navigator.deviceMemory)?navigator.deviceMemory:null;
const saveData=!!navigator.connection?.saveData;
let gpuSupport=null,userSelectedEngine=false,userSelectedModel=false;
const defaultSetup=suggestDeviceSetup({kind:device.kind,gpuUsable:false,memoryGB,saveData});
engine.value=saved.engine&&[...engine.options].some(o=>o.value===saved.engine)?saved.engine:defaultSetup.engine;
browserModel.value=saved.model&&[...browserModel.options].some(o=>o.value===saved.model)?saved.model:defaultSetup.model;
for(const [element,value] of [[inputLang,saved.inputLang],[outputLang,saved.outputLang],[voice,saved.voice]]){
  if(value&&[...element.options].some(o=>o.value===value))element.value=value;
}
if(typeof saved.autoListen==='boolean')autoListen.checked=saved.autoListen;
if(typeof saved.endpoint==='string')ollamaEndpoint.value=saved.endpoint;
if(typeof saved.speechEndpoint==='string')speechEndpoint.value=saved.speechEndpoint;
let preferredVoiceURI=String(saved.voiceURI||'');
let chosenOllamaModel=String(saved.ollamaModel||'');
function refreshVoices(){
  if(!hasBrowserVoice)return;
  const language=voiceLanguage(outputLang.value);
  const voices=availableVoices(window.speechSynthesis,language);
  // Bewaar en herstel per taal: Nederlands, Engels en Frans hebben elk hun eigen stem.
  const selectedHere=voiceName.dataset.language===language?voiceName.value:'';
  const previously=readVoicePreference(language)||selectedHere
    ||(voiceLanguage(saved.outputLang)===language?(saved.voiceURI||preferredVoiceURI):'');
  voiceName.replaceChildren(new Option(voices.length?'Automatisch passende stem':'Geen '+languages[outputLang.value]+' stem beschikbaar',''));
  for(const v of voices)voiceName.add(new Option(v.name+' · '+v.lang+(v.localService?' · op apparaat':' · netwerk mogelijk'),v.voiceURI));
  voiceName.value=voices.some(v=>v.voiceURI===previously)?previously:'';
  voiceName.dataset.language=language;
  preferredVoiceURI=voiceName.value;
}
const hardwareCheck=checkWebGpuAvailability(navigator.gpu).then(result=>{
  gpuSupport=result;
  const option=engine.querySelector('option[value="browser"]');
  if(option){
    option.disabled=!result.usable;
    option.textContent=result.usable?'Op dit apparaat · WebLLM':'Op dit apparaat · niet beschikbaar';
  }
  const recommended=suggestDeviceSetup({kind:device.kind,gpuUsable:result.usable,memoryGB,saveData});
  if(!userSelectedModel&&!saved.model)browserModel.value=recommended.model;
  if(!userSelectedEngine&&!saved.engine&&!pending)engine.value=recommended.engine;
  if(!result.usable&&engine.value==='browser'){
    engine.value='puter';
    setStatus('Dit apparaat kan geen browsermodel laden. Kies een online model.');
  }
  updateControls();
  return result;
});
function setStatus(message,kind=''){
  status.textContent=message;
  status.dataset.kind=kind;
}
function ready(){
  pending=false;
  const speechModel=isSpeechEngine(engine.value);
  const micAvailable=speechModel?!!navigator.mediaDevices?.getUserMedia:hasMicrophone;
  speak.disabled=!micAvailable||engine.value==='dessa';
  speak.textContent=engine.value==='dessa'?'Nog niet beschikbaar'
    :micAvailable?(handsfree?'Ik luister':'Begin met spreken'):'Geen microfoon beschikbaar';
  send.disabled=speechModel;
}
function cancelSound(){
  if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio=null;}
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
  utterance=null;play.disabled=!lastAnswer;
}
function stopConversation(){
  turn++;
  interruptBrowserReply();
  speechAbort?.abort();speechAbort=null;
  speechSession?.stop();speechSession=null;
  speechStarting=false;
  handsfree=false;manualReplay=false;clearTimeout(restartTimer);
  releaseMicrophone();setSpeechActivity('idle');
  const rec=recognition;recognition=null;
  if(rec){rec.onresult=null;rec.onerror=null;rec.onend=null;try{rec.abort();}catch{}}
  cancelSound();ready();
  setStatus('Gestopt. Klik op Begin met spreken om verder te gaan.');
}
function updateControls(){
  const local=engine.value==='browser',isOllama=engine.value==='ollama';
  const selectedSpeech=speechEngine(engine.value),usingSpeech=!!selectedSpeech;
  modelSummary.textContent=languages[inputLang.value]+' → '+languages[outputLang.value]+' · '+(selectedSpeech?selectedSpeech.label:local?'in browser':isOllama?'Ollama':'online');
  modelRow.hidden=!local;
  ollamaOptions.hidden=!isOllama;
  onlineOptions.hidden=engine.value!=='puter';
  speechOptions.hidden=!usingSpeech;
  speechProbe.disabled=!usingSpeech||selectedSpeech.availability==='unreleased'||speechProbing;
  voiceRow.hidden=usingSpeech;
  autoListenRow.hidden=usingSpeech;
  voiceNameRow.hidden=usingSpeech||voice.value!=='browser';
  if(selectedSpeech){
    speechDescription.textContent=selectedSpeech.detail;
    speechSource.href=selectedSpeech.source;
    speechConnection.textContent=selectedSpeech.availability==='unreleased'
      ? 'Dessa heeft nog geen publieke API of modelgewichten. Starten is niet mogelijk.'
      : 'Vereist een eigen modelserver met een EAIspeak PCM WebSocket-bridge. Alleen een model installeren is niet genoeg.';
    if(selectedSpeech.availability==='unreleased')setStatus('Dessa is aangekondigd, maar niet beschikbaar voor gebruik.');
  }
  refreshVoices();
  const current=browserModelStatus();
  if(current.ready&&current.model===browserModel.value)preloadStatus.textContent='Model staat klaar voor dit gesprek.';
  else if(!current.loading)preloadStatus.textContent='Model opnieuw in geheugen laden. Bestanden komen uit de cache zolang die bewaard is.';
  $('freeTalkCacheStatus').textContent='Na een browserherstart wordt het model opnieuw in het werkgeheugen geladen. Een download is alleen nodig als de browsercache ontbreekt, is gewist of wordt geweigerd.';
  hint.textContent=selectedSpeech?selectedSpeech.detail:local
    ? 'WebLLM gebruikt browsercache. Kleine modellen antwoorden in het Nederlands niet altijd goed; kies bewust op taal en apparaat.'
    : isOllama?'Ollama gebruikt geïnstalleerde modellen op je computer. Het websiteadres moet door je browser bereikbaar zijn.':'Online via Puter. Meld je aan voordat je spreekt. Het gebruik kan kosten meebrengen.';
  deviceStatus.textContent=selectedSpeech
    ?device.label+' · spraakengine op eigen server · '+(navigator.mediaDevices?.getUserMedia?'Microfoon mogelijk':'Geen microfoon beschikbaar')
    :device.label+' · '+(gpuSupport?(gpuSupport.usable?'WebGPU beschikbaar':'Geen WebGPU-adapter'):'WebGPU controleren…')+' · '+(hasMicrophone?'Spreken mogelijk':'Gebruik typen');
  deviceAdvice.textContent=selectedSpeech
    ?selectedSpeech.availability==='unreleased'?'Dessa is nog niet te installeren of verbinden.':'Dit apparaat verstuurt live audio naar jouw ingestelde spraakserver. Het model draait niet in de browser.'
    :gpuSupport?modelDeviceAdvice({kind:device.kind,gpuUsable:gpuSupport.usable,
      memoryGB,saveData,modelId:browserModel.value}):'De website kiest straks een passende startinstelling. Je kunt die zelf wijzigen.';
  if(local)void probeGpu();
  else gpuProbeSequence++;
  persist();
  if(!pending)ready();
  if(!usingSpeech&&voice.value==='cloud'&&outputLang.value!=='fr-FR'){
    voice.value='browser';
    setStatus('Voor Nederlands en Engels gebruiken we voorlopig de gekozen browserstem.');
  }
  // Native selects remain authoritative; the mist menu mirrors these updates.
  document.dispatchEvent(new Event('eaispeak-mist-update'));
}
async function probeGpu(){
  const sequence=++gpuProbeSequence;
  const state=browserModelStatus();
  if(state.loading || (state.ready&&state.model===browserModel.value))return;
  preload.disabled=true;
  preloadStatus.textContent='Grafische processor controleren…';
  const support=await hardwareCheck;
  if(sequence!==gpuProbeSequence||engine.value!=='browser'||browserModelStatus().loading)return;
  preload.disabled=!support.usable;
  preloadStatus.textContent=support.message;
}
function syncChanges(){
  if(pending||recognition||speechSession||speechStarting)stopConversation();
  history.length=0;
  updateControls();
}
for(const control of [cloudModel,inputLang,outputLang,voice])control.addEventListener('change',syncChanges);
voiceName.addEventListener('change',()=>{preferredVoiceURI=voiceName.value;saveVoicePreference(outputLang.value,voiceName.value);persist();});
autoListen.addEventListener('change',persist);
ollamaEndpoint.addEventListener('change',persist);
speechEndpoint.addEventListener('change',()=>{
  persist();
  speechConnection.textContent='Het serveradres is gewijzigd. Controleer de verbinding opnieuw.';
});
speechProbe.addEventListener('click',async()=>{
  if(speechProbing||pending||speechStarting||speechSession)return;
  const chosen={
    endpoint:speechEndpoint.value,engine:engine.value,
    sourceLanguage:inputLang.value,targetLanguage:outputLang.value
  };
  speechProbing=true;speechProbe.disabled=true;
  speechConnection.textContent='Verbinding controleren zonder microfoon…';
  const stillSelected=()=>engine.value===chosen.engine&&inputLang.value===chosen.sourceLanguage
    &&outputLang.value===chosen.targetLanguage&&speechEndpoint.value===chosen.endpoint;
  try{
    await probeSpeechBridge({...chosen,onStatus:message=>{
      if(stillSelected())speechConnection.textContent=message;
    }});
    if(stillSelected()){
      speechConnection.textContent='Modelserver reageert. Microfoon en spraakuitvoer zijn nog niet getest.';
      setStatus('Modelserver bereikbaar. Kies Begin met spreken voor een echte spraakproef.','ready');
    }
  }catch(error){
    if(stillSelected()){
      speechConnection.textContent='Verbinding mislukt: '+String(error?.message||error);
      setStatus('Modelserver niet bereikbaar. Controleer adres, server en verbinding.','error');
    }
  }finally{
    speechProbing=false;
    speechProbe.disabled=engine.value==='dessa'||!isSpeechEngine(engine.value);
  }
});
ollamaModel.addEventListener('change',()=>{chosenOllamaModel=ollamaModel.value;syncChanges();});
ollamaConnect.addEventListener('click',async()=>{
  ollamaConnect.disabled=true;ollamaStatus.textContent='Lokale modellen zoeken…';
  try{
    const models=await listLocalModels('ollama',ollamaEndpoint.value);
    ollamaModel.replaceChildren(...models.map(name=>new Option(name,name)));
    ollamaModel.value=models.includes(chosenOllamaModel)?chosenOllamaModel:models[0];
    chosenOllamaModel=ollamaModel.value;
    ollamaStatus.textContent=models.length+' modellen gevonden. Kies een geschikt model voor Nederlands en Frans.';
    persist();
  }catch(error){ollamaStatus.textContent='Ollama niet bereikbaar: '+String(error?.message||error)+'. Controleer lokale HTTPS, CORS en de installatie onder Techniek.';}
  finally{ollamaConnect.disabled=false;}
});
window.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
refreshVoices();
browserModel.addEventListener('change',()=>{userSelectedModel=true;syncChanges();});
engine.addEventListener('change',()=>{
  userSelectedEngine=true;
  // Kies een ondersteunde taalrichting bij een nieuwe spraakengine.
  // Handmatige wijzigingen daarna worden gecontroleerd, niet heimelijk vertaald.
  const chosen=speechEngine(engine.value);
  if(chosen?.inputs.length){
    if(!chosen.inputs.includes(inputLang.value))inputLang.value=chosen.inputs[0];
    if(!chosen.outputs.includes(outputLang.value))outputLang.value=chosen.outputs[0];
  }
  // Een browsermodel werkt standaard volledig zonder extern account.
  if(engine.value==='browser'&&voice.value==='cloud')voice.value='browser';
  if(engine.value==='puter')void primePuter();
  if(engine.value==='ollama'&&!ollamaModel.value)ollamaStatus.textContent='Klik op Zoek lokale modellen om Ollama te verbinden.';
  syncChanges();
});
updateControls();
ready();
if(!hasBrowserVoice){
  const option=voice.querySelector('option[value="browser"]');
  if(option)option.disabled=true;
  if(voice.value==='browser')voice.value='none';
  updateControls();
}
const talkTab=$('tab-gesprek');
if(talkTab)talkTab.addEventListener('click',()=>{
  if(engine.value==='puter'&&!puterSdk)void primePuter();
  refreshVoices();
});
preload.addEventListener('click',async()=>{
  if(pending||preload.disabled)return;
  const selected=browserModel.value;
  preload.disabled=true;browserModel.disabled=true;
  const report=message=>{
    if(browserModel.value===selected)preloadStatus.textContent=message;
  };
  try{
    await ensureBrowserModel(selected,report);
    preloadStatus.textContent='Model staat klaar. Je kunt nu praten.';
  }catch(error){
    preloadStatus.textContent='Laden mislukt: '+String(error?.message||error);
  }finally{
    browserModel.disabled=false;preload.disabled=false;
  }
});
function loadPuterSdk(){
  if(puterSdk)return Promise.resolve(puterSdk);
  if(puterLoad)return puterLoad;
  connectStatus.textContent='Puter laden…';
  puterLoad=import('@heyputer/puter.js').then(module=>{
    const api=module.puter||module.default||globalThis.puter;
    if(!api?.auth?.signIn||!api?.ai?.chat)throw Error('De online module is niet beschikbaar.');
    puterSdk=api;
    connectStatus.textContent=api.auth.isSignedIn()?'Verbonden met Puter.':'Klaar voor aanmelden.';
    return api;
  }).catch(error=>{puterLoad=null;throw error;});
  return puterLoad;
}
function primePuter(){
  connect.disabled=true;
  connect.textContent='Puter laden…';
  connectStatus.textContent='Puter voorbereiden…';
  return loadPuterSdk().then(api=>{
    connect.disabled=false;
    const signed=api.auth.isSignedIn();
    connect.textContent=signed?'Puter verbonden':'Aanmelden bij Puter';
    connectStatus.textContent=signed?'Verbonden met Puter.':'Klaar voor aanmelden. Klik op Aanmelden bij Puter.';
    if(signed)void listOnlineModels(api);
    return api;
  }).catch(error=>{
    connect.disabled=false;
    connect.textContent='Puter opnieuw laden';
    connectStatus.textContent='Puter kon niet laden: '+String(error?.message||error);
    return null;
  });
}
async function ensurePuter(required){
  const api=await loadPuterSdk();
  if(!api.auth.isSignedIn())throw Error('Nog niet verbonden met Puter. Open Taal en model en klik op Verbind met Puter.');
  if(!api?.ai || (required&&!api.ai.chat) || (!required&&!api.ai.txt2speech))
    throw Error('De gekozen online functie is niet beschikbaar.');
  return api;
}
async function listOnlineModels(api){
  if(typeof api.ai.listModels!=='function')return;
  try{
    const response=await api.ai.listModels();
    const entries=Array.isArray(response)?response:Array.isArray(response?.models)?response.models:Array.isArray(response?.data)?response.data:[];
    const ids=[...new Set(entries.map(x=>typeof x==='string'?x:String(x?.id||x?.model||'')).filter(x=>x&&x.length<100))];
    if(!ids.length)return;
    ids.sort((a,b)=>{
      const score=x=>/nano|flash-lite|mini|haiku/i.test(x)?0:/flash|small|qwen|mistral/i.test(x)?1:2;
      return score(a)-score(b)||a.localeCompare(b,'en');
    });
    const selected=cloudModel.value;
    cloudModel.replaceChildren();
    for(const id of ids.slice(0,100)){
      const option=document.createElement('option');option.value=id;option.textContent=id;
      cloudModel.append(option);
    }
    if(ids.includes(selected))cloudModel.value=selected;
    connectStatus.textContent='Puter verbonden · '+ids.length+' online modellen gevonden. Gebruik kan kosten meebrengen.';
  }catch{
    connectStatus.textContent='Puter verbonden. De online modellenlijst kon niet worden geladen; het standaardmodel blijft beschikbaar.';
  }
}
connect.addEventListener('click',()=>{
  if(!puterSdk){
    void primePuter();
    return;
  }
  // Aanmelden moet direct vanuit deze klik starten, anders blokkeert Safari de popup.
  const api=puterSdk;
  if(api.auth.isSignedIn()){
    connectStatus.textContent='Puter is verbonden.';void listOnlineModels(api);return;
  }
  connectStatus.textContent='Aanmelden bij Puter…';
  connect.disabled=true;
  void api.auth.signIn().then(()=>{
    connectStatus.textContent='Puter verbonden.';
    connect.textContent='Puter verbonden';
    void listOnlineModels(api);
  }).catch(error=>{
    connectStatus.textContent='Aanmelden is gestopt: '+String(error?.msg||error?.message||error);
  }).finally(()=>{connect.disabled=false;});
});
function extractResponse(result){
  const c=result?.message?.content;
  if(typeof c==='string')return c.trim();
  if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:x?.text||'').join(' ').trim();
  if(typeof result==='string')return result.trim();
  return '';
}
function prompt(){
  const target=languages[outputLang.value];
  return 'You are a spontaneous, warm, concise conversational partner in a multilingual speaking studio. The user may speak Dutch, English or French. Always answer in '+target+'. Answer the actual message, never a predetermined speech. Use one or two natural, short sentences. Do not make up people or facts. No markdown.';
}
function sayInBrowser(text,own){
  if(!('speechSynthesis' in window))throw new Error('Deze browser heeft geen spraakuitvoer.');
  const u=new SpeechSynthesisUtterance(text);
  u.lang=outputLang.value;u.rate=.95;
  const voices=window.speechSynthesis.getVoices();
  const match=voices.find(v=>v.voiceURI===voiceName.value)||voices.find(v=>v.lang.toLowerCase()===u.lang.toLowerCase())
    ||voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.slice(0,2).toLowerCase()));
  if(match)u.voice=match;
  utterance=u;play.disabled=false;
  u.onend=()=>afterResponse(own);
  u.onerror=()=>afterResponse(own,'Spraakuitvoer lukte niet. De tekst blijft zichtbaar.');
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  setStatus('De reactie wordt uitgesproken…');setSpeechActivity('answer');
}
async function speakAnswer(text,own){
  lastAnswer=text;
  if(voice.value==='none'){afterResponse(own,'Antwoord klaar.');return;}
  if(voice.value==='browser'){sayInBrowser(text,own);return;}
  // De cloudstem gebruikt Puter uitsluitend voor spraak; de LLM mag lokaal draaien.
  const api=await ensurePuter(false);
  if(own!==turn)return;
  setStatus('Franse stem voorbereiden…');
  const spoken=await api.ai.txt2speech(text.slice(0,700),{
    provider:'aws-polly',voice:'Lea',engine:'neural',language:'fr-FR'
  });
  if(own!==turn){spoken?.pause?.();return;}
  if(!(spoken instanceof HTMLAudioElement))throw new Error('Er kwam geen afspeelbaar geluidsbestand terug.');
  audio=spoken;play.disabled=false;
  audio.onended=()=>afterResponse(own);
  audio.onerror=()=>afterResponse(own,'Audio mislukt. De tekst blijft zichtbaar.');
  try{await audio.play();setStatus('De reactie wordt uitgesproken…');setSpeechActivity('answer');}
  catch{ready();setStatus('De opname is klaar. Klik op Luister naar antwoord.');}
}
async function ask(question){
  const own=++turn;pending=true;speak.disabled=true;send.disabled=true;setSpeechActivity('thinking');
  heard.textContent=question;answer.textContent='…';lastAnswer='';play.disabled=true;
  cancelSound();
  const messages=[{role:'system',content:prompt()},...history.slice(-8),{role:'user',content:question}];
  try{
    setStatus(engine.value==='browser'?'Browsermodel laden…':'AI maakt een antwoord…');
    let text;
    if(engine.value==='browser'){
      text=await localReply(messages,browserModel.value,message=>{if(own===turn)setStatus(message);});
    }else if(engine.value==='ollama'){
      const origin=validateLocalEndpoint(ollamaEndpoint.value);
      if(!ollamaModel.value)throw new Error('Kies eerst via Zoek lokale modellen een Ollama-model.');
      const response=await fetch(origin+'/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',
        body:JSON.stringify({model:ollamaModel.value,messages,stream:false,options:{num_predict:160}})
      });
      if(!response.ok)throw new Error('Ollama HTTP '+response.status);
      const result=await response.json();
      text=String(result?.message?.content||'').trim();
    }else{
      const api=await ensurePuter(true);
      if(own!==turn)return;
      const result=await api.ai.chat(messages,{model:cloudModel.value,normalize:true});
      text=extractResponse(result);
    }
    if(own!==turn)return;
    if(!text?.trim())throw new Error('Het model gaf geen bruikbaar antwoord.');
    answer.textContent=text;
    history.push({role:'user',content:question},{role:'assistant',content:text});
    if(history.length>12)history.splice(0,history.length-12);
    await speakAnswer(text,own);
  }catch(error){
    if(own!==turn)return;
    ready();handsfree=false;releaseMicrophone();setSpeechActivity('idle');setStatus('Het gesprek liep vast: '+String(error?.message||error)+'. Controleer de gekozen verbinding of stem.','error');
  }
}
play.addEventListener('click',()=>{
  if(!lastAnswer||pending)return;
  const own=turn;manualReplay=true;
  if(audio){
    audio.currentTime=0;pending=true;speak.disabled=true;send.disabled=true;
    void audio.play().catch(e=>{ready();setStatus('Afspelen lukt niet: '+String(e?.message||e),'error');});
  }else if(voice.value==='browser'){
    pending=true;speak.disabled=true;send.disabled=true;
    try{sayInBrowser(lastAnswer,own);}catch(e){ready();setStatus(String(e?.message||e),'error');}
  }
});
async function startSpeechSession(){
  if(speechStarting||speechSession?.active||pending)return;
  const own=++turn;
  try{validateSpeechPair(engine.value,inputLang.value,outputLang.value);}
  catch(error){setStatus(String(error.message),'error');$('freeTalkOptions').open=true;return;}
  speechStarting=true;pending=true;speak.disabled=true;send.disabled=true;
  heard.textContent='…';answer.textContent='…';lastAnswer='';play.disabled=true;
  cancelSound();setSpeechActivity('thinking');
  const controller=new AbortController();speechAbort=controller;
  try{
    const session=await startSpeechBridge({
      endpoint:speechEndpoint.value,engine:engine.value,
      sourceLanguage:inputLang.value,targetLanguage:outputLang.value,
      signal:controller.signal,
      onStatus:message=>{
        if(own===turn){
          setStatus(message);speechConnection.textContent=message;
          if(message==='Verbonden. Je kunt praten.')speak.textContent='Gesprek actief';
        }
      },
      onTranscript:text=>{if(own===turn)heard.textContent=text||'…';},
      onTranslation:text=>{if(own===turn)answer.textContent=text||'…';},
      onActivity:kind=>{if(own===turn)setSpeechActivity(kind);},
      onEnd:message=>{
        if(own!==turn)return;
        speechSession=null;speechAbort=null;speechStarting=false;
        ready();setStatus(message);setSpeechActivity('idle');
      }
    });
    if(own!==turn||controller.signal.aborted){session.stop();return;}
    speechSession=session;
    speak.textContent='Verbinding maken…';
    speak.disabled=true;
    persist();
  }catch(error){
    if(own===turn){ready();setSpeechActivity('idle');setStatus('Spraakverbinding: '+String(error?.message||error),'error');}
  }finally{if(own===turn)speechStarting=false;}
}
function startListening(){
  if(isSpeechEngine(engine.value)){void startSpeechSession();return;}
  if(pending||recognition)return;
  if(engine.value==='puter'&&!puterSdk?.auth?.isSignedIn()){
    setStatus('Verbind eerst met Puter via Taal en model.','error');
    $('freeTalkOptions').open=true;return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setStatus('Geen spraakherkenning. Gebruik Typ een zin.','error');return;}
  const rec=new SR();recognition=rec;
  rec.lang=inputLang.value;rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=1;
  let captured='';
  rec.onresult=e=>{
    captured=Array.from(e.results).filter(r=>r.isFinal).map(r=>r[0]?.transcript||'').join(' ').trim();
    if(!captured)heard.textContent=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();
    if(captured)heard.textContent=captured;
  };
  rec.onerror=e=>{
    if(recognition!==rec)return;
    recognition=null;handsfree=false;releaseMicrophone();ready();setSpeechActivity('idle');setStatus('Microfoon: '+String(e.error)+'. Gebruik eventueel typen.','error');
  };
  rec.onend=()=>{
    if(recognition!==rec)return;
    recognition=null;ready();
    if(!captured){setStatus('Geen woorden herkend. Probeer opnieuw.');setSpeechActivity('idle');if(handsfree)scheduleListen(turn);return;}
    void ask(captured);
  };
  try{rec.start();speak.textContent='Luistert…';setStatus('Ik luister…');setSpeechActivity('listening');}
  catch(e){recognition=null;handsfree=false;releaseMicrophone();ready();setSpeechActivity('idle');setStatus('Microfoon kon niet starten: '+String(e?.message||e),'error');}
}
speak.addEventListener('click',()=>{
  if(pending)return;
  if(isSpeechEngine(engine.value)){void startSpeechSession();return;}
  if(recognition){recognition.stop();return;}
  handsfree=autoListen.checked;manualReplay=false;
  if(handsfree)void connectMicVisual();
  startListening();
});
send.addEventListener('click',()=>{
  if(isSpeechEngine(engine.value)){setStatus('Deze engine werkt rechtstreeks met microfoonaudio. Kies Begin met spreken.');return;}
  if(pending)return;
  const q=typed.value.trim();
  if(!q){setStatus('Typ eerst een vraag.');return;}
  if(engine.value==='puter'&&!puterSdk?.auth?.isSignedIn()){
    setStatus('Verbind eerst met Puter via Taal en model.','error');
    $('freeTalkOptions').open=true;return;
  }
  typed.value='';handsfree=false;releaseMicrophone();void ask(q);
});
stop.addEventListener('click',stopConversation);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){handsfree=false;if(speechSession||speechStarting)stopConversation();releaseMicrophone();if(recognition){try{recognition.abort();}catch{}}}
});

// Stop een gesprek bij een andere functie.
$('tab-podium').addEventListener('click',()=>{if(handsfree||recognition||speechSession||speechStarting)stopConversation();});
for(const tab of document.querySelectorAll('.studio-tab:not(#tab-gesprek)'))tab.addEventListener('click',()=>{if(handsfree||recognition||speechSession||speechStarting)stopConversation();});

window.addEventListener('eaispeak-stop-conversation',stopConversation);
for(const button of [speak,send])button?.addEventListener('click',()=>window.dispatchEvent(new Event('eaispeak-stop-live')),{capture:true});
