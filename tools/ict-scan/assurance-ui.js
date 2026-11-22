'use strict';
/* The UI presents observations. It never creates a legal or learning judgement. */
(function(){
  const byId=id=>document.getElementById(id);
  const labels={structure:'Gegevens',sources:'Bronnen',review:'Beoordelingen',drift:'Wijzigingen',evaluation:'Tests'};
  const states={pass:'Geslaagd',attention:'Aandacht',fail:'Afgekeurd',not_run:'Niet uitgevoerd'};
  let profile=null,catalog=null,corpus=null,worker=null,timer=null,queued=false,serial=0;
  let latest=null,latestBasis=null,candidateBaseline=null,baseline=null,lastInput=null;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const day=()=>new Date().toISOString().slice(0,10);
  async function json(path){const response=await fetch(path,{cache:'no-store',credentials:'omit',redirect:'error'});if(!response.ok)throw Error('Controlebestand niet beschikbaar (HTTP '+response.status+').');return response.json();}
  const ready=Promise.all([window.IctOrganisation.ready,json('./frameworks.json'),json('./assurance/evaluation-corpus.json')]).then(values=>{[profile,catalog,corpus]=values;});
  ready.catch(()=>{});
  function sourceVersion(){
    const versions=state.sources.filter(source=>source.githubRemote).map(source=>{const r=source.githubRemote;return r.repository+'/'+r.path+'@'+r.sha;});
    return [...new Set(versions)].sort().join('|');
  }
  function inputNow(){
    const input=window.AssuranceAdapter.fromState(profile,state,catalog,{asOf:day(),sourceVersion:sourceVersion()});
    input.evaluation=corpus;
    if(baseline)input.baseline=baseline;
    return input;
  }
  function basis(input){return window.AssuranceEngine.canonicalize(input);}
  function stop(){if(worker)worker.terminate();worker=null;if(timer)clearTimeout(timer);timer=null;}
  function invalidate(message='Controle wordt uitgevoerd…'){
    serial++;stop();latest=null;latestBasis=null;candidateBaseline=null;
    const summary=byId('assuranceSummary');summary.textContent=message;summary.dataset.status='not_run';
    byId('assuranceChecks').replaceChildren();byId('assuranceFindings').replaceChildren();
    byId('assuranceExport').disabled=true;byId('assuranceSaveBaseline').disabled=true;
  }
  function fail(message){
    latest=null;latestBasis=null;candidateBaseline=null;
    const summary=byId('assuranceSummary');summary.textContent='Controle niet afgerond';summary.dataset.status='fail';
    byId('assuranceFindings').replaceChildren(node('p',message,'assurance-message'));
    byId('assuranceDetails').open=true;
    byId('assuranceExport').disabled=true;byId('assuranceSaveBaseline').disabled=true;
  }
  function current(){
    if(!latest||!profile)return null;
    try{if(basis(inputNow())!==latestBasis){schedule();return null;}}catch(_){schedule();return null;}
    return latest;
  }
  function render(result){
    const summary=byId('assuranceSummary');summary.textContent=states[result.overall.status]||'Niet uitgevoerd';summary.dataset.status=result.overall.status;
    byId('assuranceStamp').textContent=(lastInput?.records.length||0)+' registraties · '+result.context.asOf;
    const cards=byId('assuranceChecks'),details=byId('assuranceFindings');cards.replaceChildren();details.replaceChildren();
    for(const check of result.checks){
      const button=node('button',undefined,'assurance-check');button.type='button';button.dataset.status=check.status;
      button.append(node('span',labels[check.id]||check.title,'assurance-check-title'),node('strong',states[check.status]||'Niet uitgevoerd','assurance-check-status'));
      button.setAttribute('aria-controls','assuranceFinding-'+check.id);
      button.addEventListener('click',()=>{byId('assuranceDetails').open=true;byId('assuranceFinding-'+check.id).focus();});cards.append(button);
      const section=node('section',undefined,'assurance-finding-group');section.id='assuranceFinding-'+check.id;section.tabIndex=-1;
      section.append(node('h3',(labels[check.id]||check.title)+' · '+(states[check.status]||'Niet uitgevoerd')));
      if(!check.findings.length)section.append(node('p',check.id==='evaluation'?(check.coverage.executedCases||0)+' testgevallen geslaagd.':'Geen aandachtspunten binnen deze controle.'));
      else{
        const list=node('ul');
        for(const finding of check.findings.slice(0,30)){
          const item=node('li');item.append(node('span',(finding.recordId?finding.recordId+': ':'')+finding.message));
          if(finding.recordType&&finding.recordId&&window.EmmausRecordCards){const open=node('button','Open registratie','assurance-link');open.type='button';open.addEventListener('click',()=>window.EmmausRecordCards.open(finding.recordType,finding.recordId));item.append(open);}
          list.append(item);
        }
        section.append(list);
        if(check.findings.length>30)section.append(node('p',(check.findings.length-30)+' extra meldingen staan in het controleverslag.'));
      }
      details.append(section);
    }
    byId('assuranceExport').disabled=false;
    byId('assuranceSaveBaseline').disabled=!candidateBaseline;
    byId('assuranceBaselineNote').textContent=baseline?'Vergelijking met '+baseline.context.asOf+'.':'Nog geen vergelijkingsstand gekozen.';
    byId('assuranceExportBaseline').disabled=!baseline;
    byId('assuranceClearBaseline').disabled=!baseline;
  }
  async function run(id){
    try{
      await ready;if(id!==serial)return;
      const input=inputNow(),signature=basis(input);
      lastInput=input;
      worker=new Worker('./assurance/worker.js?v=20261121d');
      timer=setTimeout(()=>{if(id!==serial)return;stop();fail('De controle duurde te lang. Probeer opnieuw.');},10000);
      worker.onerror=()=>{if(id!==serial)return;stop();fail('De controle kon niet worden uitgevoerd. Probeer opnieuw.');};
      worker.onmessage=event=>{
        if(id!==serial||event.data?.id!==id)return;
        stop();
        if(event.data.error){fail(event.data.error);return;}
        if(basis(inputNow())!==signature){schedule();return;}
        const result=event.data.result;
        if(result?.schema!=='assurance-result-v1'||result.rulesetVersion!==window.AssuranceEngine.VERSION){fail('De uitslag hoort niet bij de huidige controleversie.');return;}
        latest=result;latestBasis=signature;candidateBaseline=event.data.baseline;render(result);
      };
      worker.postMessage({id,input});
    }catch(error){if(id===serial){stop();fail(error.message||'De controle kon niet worden uitgevoerd.');}}
  }
  function schedule(){
    invalidate();
    if(queued)return;
    queued=true;queueMicrotask(()=>{queued=false;void run(serial);});
  }
  function download(value,name){
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
    const link=node('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  byId('assuranceRun').addEventListener('click',schedule);
  byId('assuranceExport').addEventListener('click',()=>{const result=current();if(result)download(result,'controleverslag-'+profile.organisation.id+'-'+day()+'.json');});
  byId('assuranceSaveBaseline').addEventListener('click',()=>{if(!current()||!candidateBaseline)return;baseline=candidateBaseline;schedule();});
  byId('assuranceExportBaseline').addEventListener('click',()=>{if(baseline)download(baseline,'vergelijkingsstand-'+profile.organisation.id+'-'+baseline.context.asOf+'.json');});
  byId('assuranceClearBaseline').addEventListener('click',()=>{baseline=null;schedule();});
  byId('assuranceBaselineInput').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    invalidate('Vergelijkingsstand wordt geopend…');const id=serial;
    try{
      if(file.size>35*1024*1024)throw Error('Dit vergelijkingsbestand is te groot.');
      await ready;
      const value=JSON.parse(await file.text());if(id!==serial)return;
      if(value?.schema!=='assurance-baseline-v1'||value.context?.organisationId!==profile.organisation.id||value.context?.scopeId!==window.AssuranceProfile.scopeKey(profile))throw Error('Dit vergelijkingsbestand hoort niet bij deze organisatie en bron.');
      baseline=value;schedule();
    }catch(error){if(id===serial){invalidate();fail(error.message);}}
  });
  const previousRender=renderAll;
  renderAll=function(){previousRender();schedule();};
  document.addEventListener('ict-scan:opened',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!byId('workspace').hidden)schedule();});
  window.addEventListener('pagehide',stop);
  window.IctAssurance=Object.freeze({refresh:schedule,result:current});
})();
