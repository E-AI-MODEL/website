import './ollama-setup.css';
import {inspectOllamaServer, probeLocalModel, classifyError} from './system-probes.mjs';

const host=document.querySelector('#page-meer');
if(host) {
  const section=document.createElement('section');
  section.className='studio-section cloud-reveal ollama-setup';
  section.id='ollamaSetup';
  section.innerHTML=`
    <div class="studio-section-top"><span class="studio-section-no">03</span><h2>Ollama op je Mac</h2></div>
    <p class="studio-support">Je hoeft de website niet te installeren. De handleiding opent pas wanneer je Ollama wilt koppelen.</p>
    <details class="ollama-guide"><summary>Ollama instellen op deze Mac</summary>
    <div class="ollama-steps" role="group" aria-label="Voortgang Ollama installatie"></div>
    <div class="ollama-step-content" id="ollamaStepContent"></div>
    <p id="ollamaStepFeedback" class="ollama-feedback" role="status" aria-live="polite"></p>
    <div class="ollama-navigation">
      <button type="button" class="action studio-action studio-action-quiet" id="ollamaBack">Vorige</button>
      <button type="button" class="action studio-action" id="ollamaNext">Verder</button>
    </div>
    </details>
  `;
  const before=host.querySelector('.studio-section');
  if(before)host.insertBefore(section,before);else host.append(section);

  const steps=[
    {title:'Installatie',instruction:'Ollama moet op je Mac zijn geïnstalleerd. Heb je Ollama al? Ga dan verder.'},
    {title:'Opstarten',instruction:'Start Ollama op je Mac. De app blijft in de menubalk draaien. Controleer daarna de lokale server.'},
    {title:'Browser verbinden',instruction:'De website moet vanuit Chrome toestemming krijgen om de lokale Ollama-server te benaderen.'},
    {title:'Een model kiezen',instruction:'Gebruik bij voorkeur een model dat al op je Mac staat. Ontbreekt er een model? Download er één via Terminal.'},
    {title:'Model testen',instruction:'Laat het gekozen model één korte Franse zin maken. Pas na een echt antwoord is deze controle geslaagd.'}
  ];
  const $=id=>document.getElementById(id);
  const origin=window.location.origin;
  const server='http://localhost:11434/';
  let index=0;
  let serverReady=false, models=[], selected='', verified=false;
  let busy=false, lastError='', modelReply='';
  let installAcknowledged=false;
  const stepsElement=section.querySelector('.ollama-steps');
  const contentElement=$('ollamaStepContent');
  const next=$('ollamaNext'),back=$('ollamaBack'),feedback=$('ollamaStepFeedback');

  function notify(message,isError=false){
    feedback.textContent=message;
    feedback.dataset.kind=isError?'error':'normal';
  }
  function terminal(command){
    const panel=document.createElement('div');
    panel.className='ollama-command';
    const code=document.createElement('code');code.textContent=command;
    const copy=document.createElement('button');copy.type='button';copy.className='ollama-copy';copy.textContent='Kopieer';
    copy.setAttribute('aria-label','Kopieer Terminal-opdracht');
    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(command);copy.textContent='Gekopieerd';}
      catch{copy.textContent='Selecteer de opdracht om te kopiëren';}
    });
    panel.append(code,copy);return panel;
  }
  function line(tag,text,className=''){
    const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;
  }
  function action(label,callback){
    const button=document.createElement('button');button.type='button';button.className='action studio-action studio-action-quiet';
    button.textContent=label;button.disabled=busy;button.addEventListener('click',callback);return button;
  }
  function addCommand(label,command){
    contentElement.append(line('p',label,'studio-support'),terminal(command));
  }
  function render(){
    stepsElement.replaceChildren();
    steps.forEach((step,i)=>{
      const part=document.createElement('span');
      part.textContent=String(i+1).padStart(2,'0');
      part.className='ollama-step-mark'+(i===index?' current':i<index?' passed':'');
      part.title=step.title;stepsElement.append(part);
    });
    contentElement.replaceChildren();
    contentElement.append(line('p','Stap '+(index+1)+' van '+steps.length,'ollama-kicker'));
    contentElement.append(line('h3',steps[index].title));
    contentElement.append(line('p',steps[index].instruction,'studio-support'));
    back.disabled=busy||index===0;
    next.disabled=busy || (index===1&&!installAcknowledged) || (index===2&&!serverReady) || (index===3&&!selected) || (index===4&&!verified);
    next.textContent=index===4?'Afronden':'Verder';
    if(index===0){
      const link=document.createElement('a');
      link.href='https://ollama.com/download/mac';link.target='_blank';link.rel='noopener noreferrer';
      link.textContent='Open officiële Ollama-download voor Mac';link.className='ollama-doc-link';
      contentElement.append(link);
      contentElement.append(line('p','Open de gedownloade app en verplaats Ollama naar Programma’s. Ollama kan toestemming vragen om de Terminal-opdracht beschikbaar te maken.','studio-support'));
      addCommand('Open Terminal en controleer of Ollama is geïnstalleerd:','ollama --version');
      contentElement.append(action('Ollama is geïnstalleerd',()=>{
        installAcknowledged=true;index=1;notify('Ga naar Opstarten.');render();
      }));
    }
    if(index===1){
      contentElement.append(line('p','Open Ollama via Programma’s. Gebruik Terminal alleen als je de server zelf wilt starten. Start niet twee servers naast elkaar.','studio-support'));
      addCommand('Controleer of de lokale API al draait:','curl http://localhost:11434/api/tags');
      contentElement.append(action('Controleer nu in Chrome',async()=>{
        await checkServer();
        if(serverReady){installAcknowledged=true;index=2;render();}
      }));
      contentElement.append(line('p','Krijg je in Terminal een verbindingsfout en staat Ollama niet in de menubalk? Open de app opnieuw. Gebruik eventueel “ollama serve” in een Terminal-venster; laat dat venster open.','studio-support'));
      contentElement.append(terminal('ollama serve'));
    }
    if(index===2){
      contentElement.append(line('p','Chrome gebruikt '+origin+' om verbinding te maken. Verleen toestemming als Chrome vraagt om toegang tot lokale netwerkadressen.','studio-support'));
      contentElement.append(action('Test verbinding vanuit deze browser',checkServer));
      const detail=document.createElement('details');
      detail.className='ollama-help';
      const summary=document.createElement('summary');summary.textContent='Verbinding geblokkeerd? Toon de oplossing voor macOS';detail.append(summary);
      detail.append(line('p','De website kan door Ollama’s CORS-instellingen worden geweigerd. De volgende opdracht staat uitsluitend deze website toe. Stop Ollama via het menubalkmenu, voer de opdracht uit en start Ollama opnieuw.','studio-support'));
      detail.append(terminal('launchctl setenv OLLAMA_ORIGINS "'+origin+'"'));
      detail.append(line('p','Controleer eerst of Ollama lokaal bereikbaar is. Werkt Terminal wel en Chrome niet, controleer dan de toegestane websiteherkomst en de toestemming in Chrome.','studio-support'));
      detail.append(terminal('curl http://localhost:11434/api/tags'));
      detail.append(line('p','Deze instelling geldt voor de huidige macOS-aanmeldsessie. Na een herstart van je Mac kan opnieuw instellen nodig zijn.','studio-support'));
      contentElement.append(detail);
    }
    if(index===3){
      if(models.length){
        contentElement.append(line('p',models.length+' lokaal aanwezige model(len) gevonden. Kies een model voor de test.','studio-support'));
        const label=line('label','Lokaal model','studio-field');
        const select=document.createElement('select');select.id='ollamaWizardModel';
        for(const model of models){const option=new Option(model,model);select.add(option);}
        if(selected&&models.includes(selected))select.value=selected;else selected=models[0];
        select.value=selected;
        select.addEventListener('change',()=>{selected=select.value;verified=false;modelReply='';next.disabled=false;});
        label.append(select);contentElement.append(label);
      }else contentElement.append(line('p','De server is bereikbaar, maar er staat nog geen model op je Mac.','studio-support'));
      addCommand('Een relatief licht model voor een eerste Franse test (ongeveer 2,5 GB download):','ollama pull qwen3:4b');
      contentElement.append(action('Zoek opnieuw naar lokale modellen',async()=>{
        const ok=await checkServer();
        if(ok)render();
      }));
      contentElement.append(line('p','Een download wordt nooit vanuit de website gestart. Je kunt ook een ander model gebruiken dat al geïnstalleerd is.','studio-support'));
    }
    if(index===4){
      contentElement.append(line('p','Te testen model: '+(selected||'geen')+'. De controle vraagt een Franse zin op. Dit test tekst, nog geen gesproken gesprek.','studio-support'));
      contentElement.append(action('Test Frans modelantwoord',checkAnswer));
      if(modelReply) contentElement.append(line('blockquote',modelReply,'ollama-reply'));

      contentElement.append(line('p',verified?'Het model gaf tekst terug. De lokale verbinding is klaar voor verdere integratie.':'De verbinding is pas klaar na een ontvangen antwoord.','studio-support'));
      contentElement.append(line('p','De microfoon, het realtime gesprek en de Franse stem hebben elk een eigen test nodig. Dit is nog geen volledige stemgesprektest.','studio-support'));
    }
  }
  async function checkServer(){
    if(busy)return false;
    busy=true;notify('Ollama controleren…');render();
    try{
      const result=await inspectOllamaServer(server);
      models=result.models;
      if(!models.includes(selected))selected=models[0]||'';
      serverReady=true;lastError='';
      notify('Lokale Ollama-server bereikbaar. '+models.length+' model(len) gevonden.');
      return true;
    }catch(error){
      serverReady=false;models=[];selected='';verified=false;lastError=String(error?.message||error);
      const diagnosis=classifyError(error,'ollama');
      notify('Niet bereikbaar vanuit Chrome ('+diagnosis.code+'). '+diagnosis.advice+' Open de extra stappen onder Browser verbinden.',true);
      return false;
    }finally{busy=false;render();}
  }
  async function checkAnswer(){
    if(busy||!selected)return;
    busy=true;verified=false;notify('Frans modelantwoord opvragen…');render();
    try{
      const result=await probeLocalModel('ollama',server,selected,'Réponds en français, avec une phrase simple, pour féliciter les élèves qui ont obtenu leur diplôme DELF.');
      if(!result.answer.trim()) throw new Error('Geen antwoord');
      verified=true;
      modelReply=result.answer;
      notify('Antwoord ontvangen van '+result.model+'. Ollama werkt vanuit Chrome.');
      window.dispatchEvent(new CustomEvent('cloud-ollama-ready',{detail:{endpoint:server,model:result.model}}));
    }catch(error){
      verified=false;modelReply='';const diagnosis=classifyError(error,'ollama');
      notify('Modeltest niet geslaagd ('+diagnosis.code+'). '+diagnosis.advice,true);
    }finally{busy=false;render();}
  }
  back.addEventListener('click',()=>{if(busy||index===0)return;index--;notify('');render();});
  next.addEventListener('click',()=>{
    if(busy)return;
    if(index===0){index=1;installAcknowledged=true;}
    else if(index===1&&installAcknowledged)index=2;
    else if(index===2&&serverReady)index=3;
    else if(index===3&&selected)index=4;
    else if(index===4&&verified)notify('Ollama gecontroleerd. Je kunt de studio blijven gebruiken. De Franse gespreksfunctie moet nog gekoppeld worden.');
    render();
  });
  render();
}
