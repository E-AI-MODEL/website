// Vrij gesprek in de browser. De bestaande vaste voorstelling blijft onafhankelijk.
const $ = id => document.getElementById(id);
const speak = $('freeTalkSpeak');
const stop = $('freeTalkStop');
const send = $('freeTalkSend');
const play = $('freeTalkPlay');
const status = $('freeTalkStatus');
const heard = $('freeTalkHeard');
const answer = $('freeTalkAnswer');
const typed = $('freeTalkTyped');

let recognition = null;
let audio = null;
let pending = false;
let turn = 0;
const history = [];
const instructions = 'Tu es une voix française chaleureuse et vive pendant une remise de diplômes DELF scolaire au collège Emmaus de Rotterdam. On te parle surtout néerlandais. Réponds naturellement en français, en une ou deux phrases courtes, de manière spontanée et avec une pointe d\'humour. Ce n\'est pas un discours préparé. Réponds à ce qui vient vraiment d\'être dit, sans inventer de conversation ou de personnes. Pas de markdown.';

function state(message, kind=''){
  status.textContent=message;
  status.classList.toggle('bad',kind==='error');
  status.classList.toggle('good',kind==='ready');
}
function ready(){speak.disabled=false;speak.textContent='Praat';send.disabled=false;pending=false;}
function cancelAudio(){
  if(!audio)return;
  audio.onended=null;audio.onerror=null;
  audio.pause();
  audio=null;
  play.disabled=true;
}
function stopConversation(){
  turn++;
  const rec=recognition;
  recognition=null;
  if(rec){rec.onresult=null;rec.onerror=null;rec.onend=null;try{rec.abort();}catch{}}
  cancelAudio();
  ready();
  state('Gestopt. Klik op Praat om verder te praten.');
}
async function ensurePuter(){
  const api=globalThis.puter;
  if(!api?.ai?.chat||!api?.ai?.txt2speech)throw new Error('De gratis gespreksdienst kon niet laden. Controleer internet.');
  if(!api.auth.isSignedIn())await api.auth.signIn();
  return api;
}
function extractResponse(result){
  const content=result?.message?.content;
  if(typeof content==='string')return content.trim();
  if(Array.isArray(content))return content.map(x=>typeof x==='string'?x:x?.text||'').join(' ').trim();
  if(typeof result==='string')return result.trim();
  return '';
}
async function ask(question,api){
  const own=++turn;
  pending=true;speak.disabled=true;send.disabled=true;
  heard.textContent=question;
  answer.textContent='…';
  state('De Franse spreker denkt na…');
  const messages=[{role:'system',content:instructions},...history.slice(-8),{role:'user',content:question}];
  try{
    cancelAudio();
    const result=await api.ai.chat(messages,{model:'gpt-5.4-nano',normalize:true});
    if(own!==turn)return;
    const french=extractResponse(result);
    if(!french)throw new Error('Het taalmodel gaf geen bruikbaar antwoord.');
    answer.textContent=french;
    history.push({role:'user',content:question},{role:'assistant',content:french});
    if(history.length>12)history.splice(0,history.length-12);
    state('De Franse spreker maakt geluid…');
    const spoken=await api.ai.txt2speech(french.slice(0,700),{
      provider:'aws-polly',voice:'Lea',engine:'neural',language:'fr-FR'
    });
    if(own!==turn){spoken?.pause?.();return;}
    if(!(spoken instanceof HTMLAudioElement))throw new Error('De spraakdienst stuurde geen audiobestand.');
    audio=spoken;
    play.disabled=false;
    audio.onended=()=>{if(own!==turn)return;ready();state('Jij bent weer aan zet. Klik op Praat.','ready');};
    audio.onerror=()=>{if(own!==turn)return;audio=null;ready();state('De tekst is beschikbaar, maar de Franse stem kon niet afspelen.','error');};
    state('De Franse spreker antwoordt…');
    try{await audio.play();}
    catch(error){
      // Safari kan autoplay blokkeren na het ophalen van tekst en spraak.
      ready();
      state('Het Franse antwoord is klaar. Klik op Luister naar antwoord om het af te spelen.');
    }
  }catch(e){
    if(own!==turn)return;
    ready();
    state('Gesprek niet gelukt: '+String(e?.message||e)+'. Controleer je gratis tegoed of probeer opnieuw.','error');
  }
}
play.addEventListener('click',()=>{
  if(!audio)return;
  audio.currentTime=0;
  pending=true;speak.disabled=true;send.disabled=true;
  state('De Franse spreker antwoordt…');
  void audio.play().catch(error=>{ready();state('Afspelen lukt niet: '+String(error?.message||error),'error');});
});
speak.addEventListener('click',async()=>{
  if(pending)return;
  if(recognition){try{recognition.stop()}catch{}return;}
  // De aanmelding opent vanuit een echte gebruikersklik.
  speak.disabled=true;
  state('Verbinding maken…');
  let api;
  try{api=await ensurePuter();}
  catch(e){ready();state('Aanmelden mislukt: '+String(e?.message||e),'error');return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ready();state('Deze browser heeft geen spraakherkenning. Typ je vraag hieronder.','error');return;}
  const rec=new SR();
  recognition=rec;
  rec.lang='nl-NL';rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
  let captured='';
  rec.onresult=e=>{
    captured=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();
    heard.textContent=captured||'Nog niets gehoord';
  };
  rec.onerror=e=>{
    if(recognition!==rec)return;
    recognition=null;ready();
    state('Microfoon: '+String(e.error)+'. Je kunt ook een zin typen.','error');
  };
  rec.onend=()=>{
    if(recognition!==rec)return;
    recognition=null;
    if(!captured){ready();state('Geen woorden herkend. Klik op Praat en probeer opnieuw.');return;}
    void ask(captured,api);
  };
  try{rec.start();state('Ik luister naar jouw Nederlands…');speak.disabled=false;speak.textContent='Klaar met praten';}
  catch(e){recognition=null;ready();state('Microfoon kon niet starten: '+String(e?.message||e),'error');}
});
send.addEventListener('click',async()=>{
  if(pending)return;
  const question=typed.value.trim();
  if(!question){state('Typ eerst een vraag.');return;}
  send.disabled=true;
  try{const api=await ensurePuter();typed.value='';await ask(question,api);}
  catch(e){ready();state('Aanmelden mislukt: '+String(e?.message||e),'error');}
});
stop.addEventListener('click',stopConversation);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recognition){try{recognition.abort()}catch{}}});
