// EAIspeak: vrij spreken, met apart gekozen model, taal en stem.
import {BROWSER_MODELS,localReply} from './browser-llm.js';
const $=id=>document.getElementById(id);
const speak=$('freeTalkSpeak'),stop=$('freeTalkStop'),send=$('freeTalkSend'),play=$('freeTalkPlay');
const status=$('freeTalkStatus'),heard=$('freeTalkHeard'),answer=$('freeTalkAnswer'),typed=$('freeTalkTyped');
const engine=$('freeTalkEngine'),browserModel=$('freeTalkBrowserModel');
const inputLang=$('freeTalkInputLang'),outputLang=$('freeTalkOutputLang'),voice=$('freeTalkVoice');
const modelRow=$('freeTalkBrowserModelRow'),hint=$('freeTalkModelHint'),modelSummary=$('freeTalkSummary');
let recognition=null,audio=null,utterance=null,pending=false,turn=0,lastAnswer='';
const history=[];
const languages={'nl-NL':'Nederlands','en-US':'Engels','fr-FR':'Frans'};
function setStatus(message,kind=''){
  status.textContent=message;
  status.dataset.kind=kind;
}
function ready(){
  pending=false;speak.disabled=false;speak.textContent='Praat';send.disabled=false;
}
function cancelSound(){
  if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio=null;}
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
  utterance=null;play.disabled=!lastAnswer;
}
function stopConversation(){
  turn++;
  const rec=recognition;recognition=null;
  if(rec){rec.onresult=null;rec.onerror=null;rec.onend=null;try{rec.abort();}catch{}}
  cancelSound();ready();
  setStatus('Gestopt. Klik op Praat om verder te praten.');
}
function updateControls(){
  const local=engine.value==='browser';
  modelSummary.textContent=languages[inputLang.value]+' → '+languages[outputLang.value]+' · '+(local?'in browser':'online');
  modelRow.hidden=!local;
  hint.textContent=local
    ? 'Dit model draait op je apparaat. Eerste keer downloaden. WebGPU vereist; de downloads kunnen honderden MB zijn.'
    : 'Online route via Puter. Eenmalig aanmelden en beperkt gratis tegoed.';
  if(local&&!navigator.gpu)hint.textContent+=' WebGPU is hier niet beschikbaar: kies voor nu de online route.';
  if(voice.value==='cloud'&&outputLang.value!=='fr-FR'){
    voice.value='browser';
    setStatus('Voor Nederlands en Engels gebruiken we voorlopig de gekozen browserstem.');
  }
}
function syncChanges(){
  if(pending||recognition)stopConversation();
  history.length=0;
  updateControls();
}
for(const control of [browserModel,inputLang,outputLang,voice])control.addEventListener('change',syncChanges);
engine.addEventListener('change',()=>{
  // Een browsermodel werkt standaard volledig zonder extern account.
  if(engine.value==='browser'&&voice.value==='cloud')voice.value='browser';
  syncChanges();
});
updateControls();
async function ensurePuter(required){
  const api=globalThis.puter;
  if(!api?.ai || (required&&!api.ai.chat) || (!required&&!api.ai.txt2speech))
    throw new Error('Puter is nog niet geladen of wordt door de browser geblokkeerd.');
  if(!api.auth.isSignedIn())await api.auth.signIn();
  return api;
}
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
      const result=await api.ai.chat(messages,{model:'gpt-5.4-nano',normalize:true});
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
  typed.value='';void ask(q);
});
stop.addEventListener('click',stopConversation);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&recognition){try{recognition.abort();}catch{}}
});
