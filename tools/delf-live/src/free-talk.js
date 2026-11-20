// EAIspeak: vrij spreken, met apart gekozen model, taal en stem.
import {localReply,interruptBrowserReply,ensureBrowserModel,browserModelStatus} from './browser-llm.js';
import {checkWebGpuAvailability} from './gpu-capability.mjs';
import {describeDevice,suggestDeviceSetup,modelDeviceAdvice} from './device-profile.mjs';
const $=id=>document.getElementById(id);
const speak=$('freeTalkSpeak'),stop=$('freeTalkStop'),send=$('freeTalkSend'),play=$('freeTalkPlay');
const status=$('freeTalkStatus'),heard=$('freeTalkHeard'),answer=$('freeTalkAnswer'),typed=$('freeTalkTyped');
const engine=$('freeTalkEngine'),browserModel=$('freeTalkBrowserModel'),cloudModel=$('freeTalkCloudModel');
const connect=$('freeTalkConnect'),connectStatus=$('freeTalkConnectionStatus'),onlineOptions=$('freeTalkOnlineOptions');
const inputLang=$('freeTalkInputLang'),outputLang=$('freeTalkOutputLang'),voice=$('freeTalkVoice');
const modelRow=$('freeTalkBrowserModelRow'),hint=$('freeTalkModelHint'),modelSummary=$('freeTalkSummary');
const preload=$('freeTalkPreload'),preloadStatus=$('freeTalkPreloadStatus');
const deviceStatus=$('freeTalkDeviceStatus'),deviceAdvice=$('freeTalkDeviceAdvice');
let recognition=null,audio=null,utterance=null,pending=false,turn=0,lastAnswer='';
let puterSdk=null,puterLoad=null,gpuProbeSequence=0;
const history=[];
const languages={'nl-NL':'Nederlands','en-US':'Engels','fr-FR':'Frans'};
const hasMicrophone=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
const hasBrowserVoice=!!(window.speechSynthesis&&window.SpeechSynthesisUtterance);
const device=describeDevice({userAgent:navigator.userAgent,userAgentDataMobile:navigator.userAgentData?.mobile,
  platform:navigator.platform,touchPoints:navigator.maxTouchPoints||0,width:window.innerWidth,
  pointerCoarse:window.matchMedia?.('(pointer:coarse)')?.matches||false});
const memoryGB=Number.isFinite(navigator.deviceMemory)?navigator.deviceMemory:null;
const saveData=!!navigator.connection?.saveData;
let gpuSupport=null,userSelectedEngine=false,userSelectedModel=false;
const defaultSetup=suggestDeviceSetup({kind:device.kind,gpuUsable:false,memoryGB,saveData});
engine.value=defaultSetup.engine;
browserModel.value=defaultSetup.model;
const hardwareCheck=checkWebGpuAvailability(navigator.gpu).then(result=>{
  gpuSupport=result;
  const option=engine.querySelector('option[value="browser"]');
  if(option){
    option.disabled=!result.usable;
    option.textContent=result.usable?'Op dit apparaat · WebLLM':'Op dit apparaat · niet beschikbaar';
  }
  const recommended=suggestDeviceSetup({kind:device.kind,gpuUsable:result.usable,memoryGB,saveData});
  if(!userSelectedModel)browserModel.value=recommended.model;
  if(!userSelectedEngine&&!pending)engine.value=recommended.engine;
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
  pending=false;speak.disabled=!hasMicrophone;
  speak.textContent=hasMicrophone?'Praat':'Geen microfoonherkenning';
  send.disabled=false;
}
function cancelSound(){
  if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio=null;}
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
  utterance=null;play.disabled=!lastAnswer;
}
function stopConversation(){
  turn++;
  interruptBrowserReply();
  const rec=recognition;recognition=null;
  if(rec){rec.onresult=null;rec.onerror=null;rec.onend=null;try{rec.abort();}catch{}}
  cancelSound();ready();
  setStatus('Gestopt. Klik op Praat om verder te praten.');
}
function updateControls(){
  const local=engine.value==='browser';
  modelSummary.textContent=languages[inputLang.value]+' → '+languages[outputLang.value]+' · '+(local?'in browser':'online');
  modelRow.hidden=!local;
  onlineOptions.hidden=local;
  const current=browserModelStatus();
  if(current.ready&&current.model===browserModel.value)preloadStatus.textContent='Model staat klaar voor dit gesprek.';
  else if(!current.loading)preloadStatus.textContent='Laad het model vooraf om de eerste wachttijd te vermijden.';
  hint.textContent=local
    ? 'Het taalmodel draait op dit apparaat. De eerste download kan enkele minuten duren. De microfoonherkenning kan wel een internetdienst gebruiken.'
    : 'Online via Puter. Meld je aan voordat je spreekt. Het gebruik kan kosten meebrengen.';
  deviceStatus.textContent=device.label+' · '+(gpuSupport?(gpuSupport.usable?'WebGPU beschikbaar':'Geen WebGPU-adapter'):'WebGPU controleren…')+' · '+(hasMicrophone?'Spreken mogelijk':'Gebruik typen');
  deviceAdvice.textContent=gpuSupport?modelDeviceAdvice({kind:device.kind,gpuUsable:gpuSupport.usable,
    memoryGB,saveData,modelId:browserModel.value}):'De website kiest straks een passende startinstelling. Je kunt die zelf wijzigen.';
  if(local)void probeGpu();
  else gpuProbeSequence++;
  if(voice.value==='cloud'&&outputLang.value!=='fr-FR'){
    voice.value='browser';
    setStatus('Voor Nederlands en Engels gebruiken we voorlopig de gekozen browserstem.');
  }
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
  if(pending||recognition)stopConversation();
  history.length=0;
  updateControls();
}
for(const control of [cloudModel,inputLang,outputLang,voice])control.addEventListener('change',syncChanges);
browserModel.addEventListener('change',()=>{userSelectedModel=true;syncChanges();});
engine.addEventListener('change',()=>{
  userSelectedEngine=true;
  // Een browsermodel werkt standaard volledig zonder extern account.
  if(engine.value==='browser'&&voice.value==='cloud')voice.value='browser';
  if(engine.value==='puter')void primePuter();
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
  const match=voices.find(v=>v.lang.toLowerCase()===u.lang.toLowerCase())
    ||voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.slice(0,2).toLowerCase()));
  if(match)u.voice=match;
  utterance=u;play.disabled=false;
  u.onend=()=>{if(own!==turn)return;ready();setStatus('Jij bent weer aan zet.','ready');};
  u.onerror=()=>{if(own!==turn)return;ready();setStatus('Spraakuitvoer lukte niet. De tekst blijft zichtbaar.','error');};
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  setStatus('De reactie wordt uitgesproken…');
}
async function speakAnswer(text,own){
  lastAnswer=text;
  if(voice.value==='none'){ready();setStatus('Antwoord klaar.','ready');return;}
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
  audio.onended=()=>{if(own!==turn)return;ready();setStatus('Jij bent weer aan zet.','ready');};
  audio.onerror=()=>{if(own!==turn)return;ready();setStatus('Audio mislukt. Gebruik Luister naar antwoord of kies browserstem.','error');};
  try{await audio.play();setStatus('De reactie wordt uitgesproken…');}
  catch{ready();setStatus('De opname is klaar. Klik op Luister naar antwoord.');}
}
async function ask(question){
  const own=++turn;pending=true;speak.disabled=true;send.disabled=true;
  heard.textContent=question;answer.textContent='…';lastAnswer='';play.disabled=true;
  cancelSound();
  const messages=[{role:'system',content:prompt()},...history.slice(-8),{role:'user',content:question}];
  try{
    setStatus(engine.value==='browser'?'Browsermodel laden…':'AI maakt een antwoord…');
    let text;
    if(engine.value==='browser'){
      text=await localReply(messages,browserModel.value,message=>{if(own===turn)setStatus(message);});
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
    ready();setStatus('Het gesprek liep vast: '+String(error?.message||error)+'. Probeer een ander model of een andere stem.','error');
  }
}
play.addEventListener('click',()=>{
  if(!lastAnswer||pending)return;
  const own=turn;
  if(audio){
    audio.currentTime=0;pending=true;speak.disabled=true;send.disabled=true;
    void audio.play().catch(e=>{ready();setStatus('Afspelen lukt niet: '+String(e?.message||e),'error');});
  }else if(voice.value==='browser'){
    pending=true;speak.disabled=true;send.disabled=true;
    try{sayInBrowser(lastAnswer,own);}catch(e){ready();setStatus(String(e?.message||e),'error');}
  }
});
speak.addEventListener('click',()=>{
  if(pending)return;
  if(recognition){try{recognition.stop();}catch{}return;}
  if(engine.value==='puter'&&!puterSdk?.auth?.isSignedIn()){
    setStatus('Verbind eerst met Puter via Taal en model.','error');
    $('freeTalkOptions').open=true;return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setStatus('Geen spraakherkenning. Gebruik Typ een zin.','error');return;}
  const rec=new SR();recognition=rec;
  rec.lang=inputLang.value;rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
  let captured='';
  rec.onresult=e=>{
    captured=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();
    heard.textContent=captured||'Nog niets gehoord.';
  };
  rec.onerror=e=>{
    if(recognition!==rec)return;
    recognition=null;ready();setStatus('Microfoon: '+String(e.error)+'. Gebruik eventueel typen.','error');
  };
  rec.onend=()=>{
    if(recognition!==rec)return;
    recognition=null;ready();
    if(!captured){setStatus('Geen woorden herkend. Probeer opnieuw.');return;}
    void ask(captured);
  };
  try{rec.start();speak.textContent='Klaar met praten';setStatus('Ik luister…');}
  catch(e){recognition=null;ready();setStatus('Microfoon kon niet starten: '+String(e?.message||e),'error');}
});
send.addEventListener('click',()=>{
  if(pending)return;
  const q=typed.value.trim();
  if(!q){setStatus('Typ eerst een vraag.');return;}
  if(engine.value==='puter'&&!puterSdk?.auth?.isSignedIn()){
    setStatus('Verbind eerst met Puter via Taal en model.','error');
    $('freeTalkOptions').open=true;return;
  }
  typed.value='';void ask(q);
});
stop.addEventListener('click',stopConversation);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&recognition){try{recognition.abort();}catch{}}
});
