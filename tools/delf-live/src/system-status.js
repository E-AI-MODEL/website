import './system-status.css';

// Alleen ingeschakelde functies worden getest. Een statische browsercontrole start geen model.
const SERVICES = [
  {id:'mic', name:'Spraakherkenning', hint:'Microfoon en browser', action:'Test via Taal'},
  {id:'translation',name:'Vertaling',hint:'Chrome Translator of lokaal browsermodel',action:'Laad en test via Taal'},
  {id:'french',name:'Franse stem',hint:'Phonon op dit apparaat',action:'Laad en beluister via Stem'},
  {id:'dutch',name:'Nederlandse stem',hint:'Systeemstem van de browser',action:'Kies en beluister via Stem'},
  {id:'sessions',name:'Sessies',hint:'Opslag op dit apparaat',action:'Controleer opslag'},
  {id:'ollama',name:'Ollama',hint:'Optionele lokale modelserver',action:'Test verbinding'},
  {id:'lmstudio',name:'LM Studio',hint:'Optionele lokale modelserver',action:'Test verbinding'}
];
export const STATUS = Object.freeze({idle:'idle',ready:'ready',busy:'busy',error:'error',unavailable:'unavailable'});
export function classifyError(error,service='') {
  const message=String(error?.message||error||'Onbekende fout');
  if (/abort|timeout|time.out/i.test(message)) return {code:'SYS-TIMEOUT-001',advice:'De controle duurde te lang. Probeer het opnieuw en kijk of het model geladen is.'};
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) return {code:'SYS-NET-002',advice:'De verbinding is niet bereikbaar of de browser blokkeert de aanvraag (CORS). Controleer adres, server en toegestane browserorigin.'};
  if (/permission|not.allowed|denied/i.test(message)) return {code:'SYS-PERM-003',advice:'Controleer de browsertoestemming voor de microfoon.'};
  if (/404|model.*not found/i.test(message)) return {code:'SYS-MODEL-004',advice:'Het gekozen model ontbreekt op de server. Laad of kies een beschikbaar model.'};
  return {code:'SYS-'+service.toUpperCase().replace(/[^A-Z]/g,'').slice(0,8)+'-005',advice:'Open de betreffende functie, controleer de instellingen en probeer de test opnieuw.'};
}
export function validateLocalEndpoint(value) {
  let url;
  try {url=new URL(String(value));} catch {throw new Error('Ongeldig serveradres');}
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Alleen HTTP of HTTPS is toegestaan');
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Alleen een adres op dit apparaat is toegestaan');
  if (url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('Vul uitsluitend het basisadres in, zonder pad of inloggegevens');
  return url.origin;
}
async function request(url,init={},ms=8000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try {
    const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    return response.json();
  } finally {clearTimeout(timer);}
}
export async function probeLocalModel(provider,endpoint) {
  const origin=validateLocalEndpoint(endpoint);
  if(!['ollama','lmstudio'].includes(provider)) throw new Error('Onbekende aanbieder');
  const models=provider==='ollama'
    ? await request(origin+'/api/tags')
    : await request(origin+'/v1/models');
  const candidates=provider==='ollama' ? models.models : models.data;
  if(!Array.isArray(candidates)||!candidates.length) throw new Error('Geen modellen gevonden');
  const model=provider==='ollama' ? (candidates[0].name||candidates[0].model) : candidates[0].id;
  if(typeof model!=='string'||!model) throw new Error('Geen geldig model gevonden');
  // Een bereikbare server is nog geen bewijs dat een model antwoord geeft.
  const payload=provider==='ollama'
    ? {model,prompt:'Antwoord alleen met OK.',stream:false,options:{num_predict:8}}
    : {model,messages:[{role:'user',content:'Antwoord alleen met OK.'}],max_tokens:8,stream:false};
  const result=await request(origin+(provider==='ollama'?'/api/generate':'/v1/chat/completions'),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  },20000);
  const answer=provider==='ollama'?result.response:result.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim()) throw new Error('Het model gaf geen tekst terug');
  return {model,answer};
}
const $=id=>document.getElementById(id);
const host=document.querySelector('#page-meer');
if(host) {
  const section=document.createElement('section');
  section.className='studio-section cloud-reveal system-section';
  section.innerHTML=`<div class="studio-section-top"><span class="studio-section-no">03</span><h2>Systeem</h2></div>
    <p class="studio-support">Functies worden pas geladen als je ze gebruikt. Controleer hier wat werkt.</p>
    <div id="systemServices" class="system-services"></div>
    <details class="system-provider">
      <summary>Lokale modellen verbinden</summary>
      <p class="studio-support">Alleen op dit apparaat. Een verbinding wordt pas getest wanneer je op Test klikt.</p>
      <label class="studio-field">Aanbieder<select id="systemProvider"><option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option></select></label>
      <label class="studio-field">Serveradres<input id="systemEndpoint" type="url" value="http://localhost:11434/" spellcheck="false" autocomplete="off"></label>
      <button type="button" class="action studio-action" id="systemConnect">Test modelantwoord</button>
    </details>
    <div class="system-actions"><button type="button" class="action studio-action studio-action-quiet" id="systemCapabilities">Controleer browser</button><button type="button" class="action studio-action studio-action-quiet" id="systemStorage">Controleer opslag</button></div>
    <p class="studio-support" id="systemChecked" aria-live="polite">Nog geen controles uitgevoerd.</p>`;
  host.append(section);
  const states=new Map(SERVICES.map(service=>[service.id,{status:STATUS.idle,message:'Niet gecontroleerd',code:'',advice:''}]));
  const list=$('systemServices');
  const history=[];
  function display(){
    list.replaceChildren();
    for(const service of SERVICES){
      const state=states.get(service.id);
      const row=document.createElement('details');
      row.className='system-row';
      row.dataset.status=state.status;
      const summary=document.createElement('summary');
      const indicator=document.createElement('span');indicator.className='system-indicator';indicator.setAttribute('aria-hidden','true');
      const title=document.createElement('span');title.className='system-name';title.textContent=service.name;
      const label=document.createElement('span');label.className='system-state';label.textContent=state.message;
      summary.append(indicator,title,label);
      const body=document.createElement('div');body.className='system-detail';
      const hint=document.createElement('p');hint.textContent=service.hint;
      const advice=document.createElement('p');advice.textContent=state.advice||service.action;
      body.append(hint,advice);
      if(state.code){const code=document.createElement('code');code.textContent=state.code;body.append(code);}
      row.append(summary,body);
      list.append(row);
    }
  }
  function update(id,status,message,error=null){
    const prior=states.get(id);
    if(!prior) return;
    const diagnosed=error?classifyError(error,id):null;
    states.set(id,{status,message:String(message).slice(0,180),code:diagnosed?.code||'',advice:diagnosed?.advice||''});
    history.push({at:new Date().toISOString(),id,status,code:diagnosed?.code||''});
    if(history.length>40) history.shift();
    $('systemChecked').textContent='Laatste controle: '+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    display();
  }
  display();
  const idForFeedback={microphoneStatus:'mic',translationStatus:'translation',frenchStatus:'french',dutchStatus:'dutch'};
  window.addEventListener('cloud-function-status',event=>{
    const {id,kind,message}=event.detail||{};
    const service=idForFeedback[id];
    if(!service) return;
    // Een laden-melding toont geen succes. Alleen een geslaagde actie geeft 'klaar'.
    const successful=kind==='good' && !/gevonden|kies|beluister.*vóór|eerste klank nog niet/i.test(message||'');
    update(service,kind==='bad'?STATUS.error:successful?STATUS.ready:STATUS.busy,
      kind==='bad'?'Storing':successful?'Gereed':'Bezig of nog niet getest',
      kind==='bad'?new Error(message):null);
  });
  $('systemProvider').addEventListener('change',()=>{
    $('systemEndpoint').value=$('systemProvider').value==='ollama'?'http://localhost:11434/':'http://localhost:1234/';
  });
  $('systemConnect').addEventListener('click',async()=>{
    const id=$('systemProvider').value,button=$('systemConnect');
    button.disabled=true;update(id,STATUS.busy,'Model testen');
    try{const result=await probeLocalModel(id,$('systemEndpoint').value);update(id,STATUS.ready,'Antwoord ontvangen: '+result.model);}
    catch(error){update(id,STATUS.error,'Modeltest mislukt',error);}
    finally{button.disabled=false;}
  });
  $('systemCapabilities').addEventListener('click',()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR) update('mic',STATUS.unavailable,'Niet ondersteund',new Error('Spraakherkenning ontbreekt'));
    else update('mic',STATUS.idle,'Browser ondersteunt dit. Nog niet gesproken.');
    if(!('speechSynthesis' in window)) update('dutch',STATUS.unavailable,'Geen browserstemmen beschikbaar');
    else update('dutch',STATUS.idle,'Browser ondersteunt stemmen. Test via Stem.');
    if(window.Translator) update('translation',STATUS.idle,'Chrome Translator aanwezig. Nog niet getest.');
    else update('translation',STATUS.idle,'Browsermodel kan op aanvraag laden.');
  });
  $('systemStorage').addEventListener('click',()=>{
    try{
      const key='eai-cloud-storage-probe';
      const value='check-'+Date.now();
      localStorage.setItem(key,value);
      if(localStorage.getItem(key)!==value) throw new Error('Opslagtest wijkt af');
      localStorage.removeItem(key);
      update('sessions',STATUS.ready,'Opslagtest geslaagd');
    }catch(error){update('sessions',STATUS.error,'Opslag niet beschikbaar',error);}
  });
}
