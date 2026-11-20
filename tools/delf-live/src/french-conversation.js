import {listLocalModels,chatLocalModel,validateLocalEndpoint,classifyError} from './system-probes.mjs';

const $=id=>document.getElementById(id);
const section=$('frenchConversation');
if(section){
  const provider=$('dialogueProvider'),endpoint=$('dialogueEndpoint'),model=$('dialogueModel');
  const source=$('dialogueSource'),answer=$('dialogueAnswer'),status=$('dialogueStatus');
  const start=$('dialogueStart'),discover=$('dialogueDiscover'),stop=$('dialogueStop');
  const language=$('dialogueLanguage');
  let recognizer=null,active=false,pending=false,serial=0;
  let history=[];
  function report(message,bad=false){
    status.textContent=message;
    status.classList.toggle('bad',bad);
  }
  function resetModel(){
    model.replaceChildren(new Option('Zoek eerst een beschikbaar model',''));
    start.disabled=true;
    history=[];
  }
  function finishListening(){
    const previous=recognizer;recognizer=null;
    if(previous){
      previous.onresult=null;previous.onerror=null;previous.onend=null;
      try{previous.abort();}catch{}
    }
  }
  function cancel(){
    serial++;
    active=false;pending=false;
    finishListening();
    window.cloudFrenchConversationStop?.();
    start.disabled=!model.value;
    stop.disabled=true;
  }
  provider.addEventListener('change',()=>{
    endpoint.value=({ollama:'http://localhost:11434/',lmstudio:'http://localhost:1234/',llamacpp:'http://localhost:8080/'})[provider.value];
    resetModel();
  });
  endpoint.addEventListener('input',resetModel);
  discover.addEventListener('click',async()=>{
    discover.disabled=true;resetModel();report('Beschikbare taalmodellen opvragen…');
    try {
      const models=await listLocalModels(provider.value,validateLocalEndpoint(endpoint.value));
      model.replaceChildren();
      for(const item of models) model.add(new Option(item,item));
      start.disabled=false;
      report('Kies een model. Het Franse gesprek start pas met de microfoonknop.');
    } catch(error){
      const problem=classifyError(error,'conversation');
      report('Modellen niet bereikbaar: '+problem.code+'. '+problem.advice,true);
    } finally {discover.disabled=false;}
  });
  stop.addEventListener('click',()=>{cancel();report('Gesprek gestopt.');});
  model.addEventListener('change',()=>{history=[];start.disabled=!model.value;});
  async function respond(utterance,current){
    pending=true;report('Frans antwoord opvragen…');
    const messages=[
      {role:'system',content:'Tu es un interlocuteur francophone patient. Réponds uniquement en français, en une ou deux phrases courtes, naturelles et correctes. Pose une question pertinente pour poursuivre la conversation. Ne traduis pas sauf si on te le demande.'},
      ...history.slice(-8),
      {role:'user',content:utterance}
    ];
    try{
      const result=await chatLocalModel(provider.value,endpoint.value,model.value,messages);
      if(current!==serial) return;
      answer.textContent=result;
      history.push({role:'user',content:utterance},{role:'assistant',content:result});
      history=history.slice(-10);
      report('Frans antwoord ontvangen. Stem spreekt…');
      await window.cloudFrenchConversationSpeak(result);
      if(current===serial) report('Antwoord uitgesproken. Klik op Spreek Frans voor je volgende vraag.');
    } catch(error){
      if(current!==serial) return;
      const problem=classifyError(error,'conversation');
      report('Gesprek niet gelukt: '+problem.code+'. '+String(error?.message||error)+'. '+problem.advice,true);
    } finally {
      if(current===serial){pending=false;active=false;start.disabled=!model.value;stop.disabled=true;}
    }
  }
  start.addEventListener('click',()=>{
    if(active||pending)return;
    if(!model.value){report('Kies eerst een taalmodel.',true);return;}
    if(!window.cloudFrenchConversationSpeak){report('De Franse spraakfunctie is niet geladen.',true);return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){report('Deze browser heeft geen spraakherkenning.',true);return;}
    if(!window.isSecureContext){report('Open de pagina via HTTPS.',true);return;}
    const current=++serial;
    const recognition=new SR();
    recognizer=recognition;active=true;
    start.disabled=true;stop.disabled=false;
    recognition.lang=language.value;
    recognition.continuous=false;
    recognition.interimResults=true;
    let completed=false;
    recognition.onstart=()=>{if(current===serial)report('Luistert. Spreek in de microfoon.');};
    recognition.onresult=event=>{
      if(current!==serial)return;
      const results=Array.from(event.results);
      const words=results.map(item=>item[0]?.transcript||'').join(' ').trim();
      if(words)source.textContent=words;
      const final=results.filter(item=>item.isFinal).map(item=>item[0]?.transcript||'').join(' ').trim();
      if(final&&!completed){
        completed=true;finishListening();void respond(final,current);
      }
    };
    recognition.onerror=e=>{
      if(current!==serial || completed)return;
      finishListening();active=false;start.disabled=false;stop.disabled=true;
      report('Spraakherkenning mislukt: '+(e.error||'onbekend')+'. Controleer de microfoon in Taal.',true);
    };
    recognition.onend=()=>{
      if(current!==serial||completed)return;
      finishListening();active=false;start.disabled=false;stop.disabled=true;
      report('Geen complete zin herkend. Probeer opnieuw.',true);
    };
    try{
      source.textContent='';answer.textContent='';
      report('Microfoon openen…');
      recognition.start();
    } catch(error){
      finishListening();active=false;start.disabled=false;stop.disabled=true;
      report('Microfoon kon niet starten: '+error.message,true);
    }
  });
  window.addEventListener('pagehide',cancel);
}
