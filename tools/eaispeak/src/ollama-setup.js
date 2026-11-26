import './ollama-setup.css';
import {inspectOllamaServer, probeLocalModel, classifyError, loopbackPermission} from './system-probes.mjs';
import {macOllamaCommands,OLLAMA_HTTP,OLLAMA_HTTPS} from './ollama-connection.mjs';

const host=document.querySelector('#page-meer');
if(host) {
  const section=document.createElement('section');
  section.className='studio-section cloud-reveal ollama-setup';
  section.id='ollamaSetup';
  section.innerHTML=`
    <div class="studio-section-top"><span class="studio-section-no">04</span><h2>Ollama installeren</h2></div>
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
  // Na Bediening, Status en Systeem: vaste leesvolgorde zonder dubbele nummers.
  host.append(section);

  const steps=[
    {title:'Installatie',instruction:'Ollama moet op je Mac zijn geïnstalleerd. Heb je Ollama al? Ga dan verder.'},
    {title:'Opstarten',instruction:'Start Ollama op je Mac. De app blijft in de menubalk draaien. Controleer daarna de lokale server.'},
    {title:'Browser verbinden',instruction:'Verbind deze browser met Ollama op je Mac. Safari gebruikt bij voorkeur een lokale HTTPS-verbinding.'},
    {title:'Een model kiezen',instruction:'Gebruik bij voorkeur een model dat al op je Mac staat. Ontbreekt er een model? Download er één via Terminal.'},
    {title:'Model testen',instruction:'Laat het gekozen model één korte testzin maken. Pas na een echt antwoord is deze controle geslaagd.'}
  ];
  const $=id=>document.getElementById(id);
  const origin=window.location.origin;
  const safari=/safari/i.test(navigator.userAgent)&&!/chrome|chromium|crios|edg/i.test(navigator.userAgent);
  const browserName=safari?'Safari':'deze browser';
  const httpServer=OLLAMA_HTTP;
  const httpsServer=OLLAMA_HTTPS;
  const commands=macOllamaCommands(origin);
  let server=safari?httpsServer:httpServer;
  let connectionKind=safari?'https':'http';
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
      contentElement.append(action('Ik zie mijn modellen in Terminal',()=>{installAcknowledged=true;index=2;notify('Kies nu hoe deze browser Ollama bereikt.');render();}));
      contentElement.append(line('p','Krijg je in Terminal een verbindingsfout en staat Ollama niet in de menubalk? Open de app opnieuw. Gebruik eventueel “ollama serve” in een Terminal-venster; laat dat venster open.','studio-support'));
      contentElement.append(terminal('ollama serve'));
    }
    if(index===2){
      contentElement.append(line('p',browserName+' opent de website op '+origin+'. Een rechtstreekse pagina op localhost bewijst niet dat een aanvraag vanuit deze website lukt.','studio-support'));
      const choices=line('label','Verbindingsmethode','studio-field');
      const method=document.createElement('select');method.id='ollamaConnectionKind';
      [['https','Beveiligde lokale verbinding (Safari)'],['http','Direct via HTTP (andere browsers)']].forEach(([value,label])=>method.add(new Option(label,value)));
      method.value=connectionKind;
      method.addEventListener('change',()=>{connectionKind=method.value;server=connectionKind==='https'?httpsServer:httpServer;serverReady=false;models=[];selected='';verified=false;lastError='';notify('');render();});
      choices.append(method);contentElement.append(choices);
      contentElement.append(line('p','Te testen adres: '+server+'. De verbinding wordt pas bevestigd na een antwoord vanuit deze browser.','studio-support'));
      if(connectionKind==='https'){
        contentElement.append(line('p','Safari kan een HTTP-aanvraag vanuit een HTTPS-website blokkeren. Ollama spreekt zelf HTTP. Caddy kan alleen op jouw Mac een vertrouwde HTTPS-verbinding vóór Ollama verzorgen.','studio-support'));
        const setup=document.createElement('details');setup.className='ollama-help';
        setup.append(line('summary','Lokale HTTPS-verbinding voor Safari'));setup.open=Boolean(lastError);
        setup.append(line('p','Installeer Caddy als je Homebrew hebt. Is Homebrew niet aanwezig, gebruik de officiële instructies van caddyserver.com. Voer de opdrachten één voor één uit.','studio-support'));
        setup.append(terminal('brew install caddy'));
        setup.append(line('p','Maak een configuratie die uitsluitend luistert op je eigen Mac:','studio-support'));
        setup.append(terminal(commands.writeConfig));
        setup.append(line('p','Laat Ollama op poort 11434 draaien. Voer in een tweede Terminal-venster de volgende opdracht uit. De configuratie wordt eerst gecontroleerd. Caddy gebruikt alleen de lokale poort 11435 en maakt geen redirect via poort 80.','studio-support'));
        setup.append(terminal(commands.startCaddy));
        setup.append(line('p','Caddy kan toestemming vragen voor zijn lokale certificaat. Vertrouw het alleen wanneer je Caddy zelf hebt geïnstalleerd en je beheerbeleid dat toestaat. Gebruik geen sudo om Caddy te starten. Laat dit Terminal-venster open.','studio-support'));
        setup.append(line('p','Open https://localhost:11435/api/tags eerst rechtstreeks in Safari. De pagina moet zonder certificaatwaarschuwing laden. Pas daarna heeft de test vanuit de website zin.','studio-support'));
        setup.append(line('p','De lokale HTTPS-poort luistert alleen op loopback (127.0.0.1 en ::1). Controleer daarna ook de website-origin via Terminal.','studio-support'));
        setup.append(terminal(commands.curlHttps));
        contentElement.append(setup);
      }else{
        contentElement.append(line('p','Probeer deze route eerst in Chrome of Edge, zonder Caddy. Geef EAIspeak toestemming om verbinding te maken met lokale apps op je computer. Safari kan HTTP blokkeren, ook na HTTP 200 in Terminal.','studio-support'));
      }
      contentElement.append(action('Test verbinding vanuit deze browser',checkServer));
      const detail=document.createElement('details');
      detail.className='ollama-help';detail.open=Boolean(lastError);
      const summary=document.createElement('summary');summary.textContent='Verbinding geblokkeerd? Toon de oplossing voor macOS';detail.append(summary);
      detail.append(line('p','Stap A · Sluit Ollama volledig af via het Ollama-icoon in de menubalk (Quit / Stop Ollama). Alleen het venster sluiten is niet genoeg. Stop ook een eventueel eerder gestart ollama serve met Ctrl+C.','studio-support'));
      detail.append(line('p','Stap B · Kopieer de opdracht naar een nieuwe Terminal-prompt en druk op Enter. Deze instelling vervangt je eerder ingestelde extra origins. Alleen de genoemde websiteadressen krijgen toegang.','studio-support'));
      detail.append(terminal(commands.setOrigins));
      detail.append(line('p','Stap C · Start Ollama opnieuw. Wacht tot de app in de menubalk staat. De oude server leest de gewijzigde instelling niet vanzelf.','studio-support'));
      detail.append(terminal(commands.restartApp));
      detail.append(line('p','Stap D · Test exact de origin van deze pagina: '+origin+'. HTTP 200 betekent dat Ollama deze origin accepteert. HTTP 403 betekent dat Ollama de origin nog afwijst.','studio-support'));
      detail.append(terminal(commands.curlHttp));
      detail.append(line('p','HTTP 403 na opnieuw starten? Controleer welk proces op poort 11434 luistert. Start geen tweede server zolang deze poort bezet is.','studio-support'));
      detail.append(terminal(commands.checkListener));
      detail.append(line('p','Alternatief: sluit Ollama volledig af en start uitsluitend deze Terminal-server. Laat het venster open. Deze server luistert alleen lokaal.','studio-support'));
      detail.append(terminal(commands.startTerminal));
      detail.append(line('p','Stap E · Bij HTTP 200: klik opnieuw op Test verbinding vanuit deze browser. In Chrome: sta de toegang tot lokale apps toe. Eerder geweigerd? Klik links van het websiteadres op het site-instellingen-icoon, open Site-instellingen en sta Lokaal netwerk / Loopback-netwerk toe. Een schoolbeheerder kan deze instelling blokkeren. Omzeil het beheerbeleid niet.','studio-support'));
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
      addCommand('Een relatief licht model voor een eerste modeltest (ongeveer 2,5 GB download):','ollama pull qwen3:4b');
      contentElement.append(action('Zoek opnieuw naar lokale modellen',async()=>{
        const ok=await checkServer();
        if(ok)render();
      }));
      contentElement.append(line('p','Een download wordt nooit vanuit de website gestart. Je kunt ook een ander model gebruiken dat al geïnstalleerd is.','studio-support'));
    }
    if(index===4){
      contentElement.append(line('p','Te testen model: '+(selected||'geen')+'. De controle vraagt een korte zin op. Dit test tekst, nog geen gesproken gesprek.','studio-support'));
      contentElement.append(action('Test modelantwoord',checkAnswer));
      if(modelReply) contentElement.append(line('blockquote',modelReply,'ollama-reply'));

      contentElement.append(line('p',verified?'Het model gaf tekst terug. De lokale verbinding is klaar voor verdere integratie.':'De verbinding is pas klaar na een ontvangen antwoord.','studio-support'));
      contentElement.append(line('p','De microfoon, het realtime gesprek en de stem hebben elk een eigen test nodig. Dit is nog geen volledige stemgesprektest.','studio-support'));
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
      const permission=await loopbackPermission();
      notify('Verbinding vanuit '+browserName+' mislukt ('+diagnosis.code+'). '+(permission==='denied'?'Deze browser weigert de toegang tot lokale apps. Open Site-instellingen. ':'')+(safari&&connectionKind==='http'?'Safari kan HTTP vanaf deze HTTPS-website blokkeren. Kies hierboven de lokale HTTPS-verbinding. ':safari&&connectionKind==='https'?'Controleer of Caddy draait en of https://localhost:11435/api/tags zonder certificaatwaarschuwing opent. ':'')+diagnosis.advice+' Volg de geopende herstelstappen hieronder.',true);
      return false;
    }finally{busy=false;render();}
  }
  async function checkAnswer(){
    if(busy||!selected)return;
    busy=true;verified=false;notify('Modelantwoord opvragen…');render();
    try{
      const result=await probeLocalModel('ollama',server,selected,'Antwoord met één korte zin dat de verbinding werkt.');
      if(!result.answer.trim()) throw new Error('Geen antwoord');
      verified=true;
      modelReply=result.answer;
      notify('Antwoord ontvangen van '+result.model+'. Ollama werkt vanuit '+browserName+'.');
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
    else if(index===4&&verified){notify('Ollama gecontroleerd. Open Vrij praten met dit model.');window.dispatchEvent(new CustomEvent('cloud-ollama-use'));}
    render();
  });
  render();
}
