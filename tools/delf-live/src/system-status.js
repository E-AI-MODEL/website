import './system-status.css';
import {SERVICES,STATUS,classifyError,probeLocalModel,listLocalModels} from './system-probes.mjs';

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
      <label class="studio-field">Aanbieder<select id="systemProvider"><option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option><option value="llamacpp">llama.cpp</option></select></label>
      <label class="studio-field">Serveradres<input id="systemEndpoint" type="url" value="http://localhost:11434/" spellcheck="false" autocomplete="off"></label>
      <button type="button" class="action studio-action studio-action-quiet" id="systemDiscover">Zoek beschikbare modellen</button>
      <label class="studio-field">Model<select id="systemModel"><option value="">Zoek eerst beschikbare modellen</option></select></label>
      <button type="button" class="action studio-action" id="systemConnect" disabled>Test modelantwoord</button>
    </details>
    <div class="system-actions"><button type="button" class="action studio-action studio-action-quiet" id="systemCapabilities">Controleer browser</button><button type="button" class="action studio-action studio-action-quiet" id="systemStorage">Controleer opslag</button></div>
    <p class="studio-support" id="systemChecked" aria-live="polite">Nog geen controles uitgevoerd.</p>
    <details class="system-log"><summary>Laatste gebeurtenissen</summary><ol id="systemLog"></ol></details>`;
  host.append(section);
  const states=new Map(SERVICES.map(service=>[service.id,{status:STATUS.idle,message:'Niet gecontroleerd',code:'',advice:''}]));
  const list=$('systemServices');
  const history=[];
  function display(){
    const opened=new Set([...list.querySelectorAll('details[open]')].map(row=>row.dataset.service));
    list.replaceChildren();
    for(const service of SERVICES){
      const state=states.get(service.id);
      const row=document.createElement('details');
      row.className='system-row';
      row.open=opened.has(service.id);
      row.dataset.service=service.id;
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
      if(state.cause){const cause=document.createElement('p');cause.textContent='Melding: '+state.cause;body.append(cause);}
      row.append(summary,body);
      list.append(row);
    }
  }
  function update(id,status,message,error=null){
    const prior=states.get(id);
    if(!prior) return;
    if(prior.status===status && prior.message===message && !error) return;
    const diagnosed=error?classifyError(error,id):null;
    states.set(id,{status,message:String(message).slice(0,180),code:diagnosed?.code||'',advice:diagnosed?.advice||'',cause:error?String(error?.message||error).slice(0,240):''});
    history.push({at:new Date().toISOString(),id,status,code:diagnosed?.code||''});
    if(history.length>40) history.shift();
    const log=$('systemLog');
    log.replaceChildren();
    for(const item of history.slice(-8).reverse()) {
      const line=document.createElement('li');
      line.textContent=new Date(item.at).toLocaleTimeString('nl-NL')+' · '+(SERVICES.find(service=>service.id===item.id)?.name||item.id)+' · '+item.status+(item.code?' · '+item.code:'');
      log.append(line);
    }
    $('systemChecked').textContent='Laatste controle: '+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    display();
  }
  display();
  const idForFeedback={microphoneStatus:'mic',translationStatus:'translation',frenchStatus:'french',dutchStatus:'dutch'};
  window.addEventListener('cloud-function-status',event=>{
    const {id,state,message,error}=event.detail||{};
    const service=idForFeedback[id];
    if(!service || !Object.values(STATUS).includes(state)) return;
    update(service,state,message||'Geen nadere informatie',error?new Error(error):null);
  });
    const modelSelect=$('systemModel');
  function clearModels(){
    modelSelect.replaceChildren(new Option('Zoek eerst beschikbare modellen',''));
    $('systemConnect').disabled=true;
  }
  $('systemProvider').addEventListener('change',()=>{
    $('systemEndpoint').value=({ollama:'http://localhost:11434/',lmstudio:'http://localhost:1234/',llamacpp:'http://localhost:8080/'})[$('systemProvider').value];
    clearModels();
  });
  $('systemEndpoint').addEventListener('input',clearModels);
  $('systemDiscover').addEventListener('click',async()=>{
    const id=$('systemProvider').value,button=$('systemDiscover');
    button.disabled=true;clearModels();update(id,STATUS.busy,'Modelnamen opvragen');
    try{
      const models=await listLocalModels(id,$('systemEndpoint').value);
      modelSelect.replaceChildren();
      for(const model of models) modelSelect.add(new Option(model,model));
      $('systemConnect').disabled=false;
      update(id,STATUS.idle,models.length+' model(len) gevonden. Nog niet getest.');
    } catch(error){update(id,STATUS.error,'Modelnamen niet beschikbaar',error);}
    finally{button.disabled=false;}
  });
  $('systemConnect').addEventListener('click',async()=>{
    const id=$('systemProvider').value,button=$('systemConnect');
    if(!modelSelect.value) return;
    button.disabled=true;update(id,STATUS.busy,'Modelantwoord testen');
    try{
      const result=await probeLocalModel(id,$('systemEndpoint').value,modelSelect.value);
      update(id,STATUS.ready,'Antwoord ontvangen: '+result.model);
    } catch(error){update(id,STATUS.error,'Modeltest mislukt',error);}
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
