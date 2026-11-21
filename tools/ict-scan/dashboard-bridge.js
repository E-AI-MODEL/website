'use strict';
/* Source-backed bridge for the real Dashboard Builder. Same-origin iframe only.
 * Source data are exchanged in memory; GitHub receives reviewed layout JSON
 * only after a dedicated user-confirmation popup. */
(function(){
  const $=id=>document.getElementById(id);
  const CHANNEL='emmaus-ict-builder-v1';
  const REPO='E-AI-MODEL/website';
  const SOURCE='tools/ict-scan/dashboard-layouts/';
  const allowedTypes=new Set(['bar','column','dot','donut','table','kpi','text']);
  const frame=$('builderFrame'),surface=$('builderSurface'),popup=$('builderWriteback');
  const status=$('builderWriteStatus');
  let pending=null,original=null,sourceKey='',loading=false;
  const validKey=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(s);
  const copy=obj=>JSON.parse(JSON.stringify(obj));
  const fields=(obj,allowed)=>Object.fromEntries(Object.entries(obj).filter(([key])=>allowed.includes(key)));
  const text=(id,msg)=>{const e=$(id);if(e)e.textContent=String(msg??'');};
  const ensure=condition=>{if(!condition)throw Error('Dashboardindeling niet geldig of niet compleet.');};
  function registeredData(){
    const specs=window.EmmausRecordCards?.specs||[];
    return specs.filter(spec=>{
      if(spec.key==='ai'||spec.key==='aiControls')return window.EmmausRoles?.isEnabled('ai')!==false;
      if(spec.key==='dpia')return window.EmmausRoles?.isEnabled('fg')===true;
      return true;
    }).map(spec=>{
      const rows=[...(state[spec.store] instanceof Map?state[spec.store].values():[])];
      const attrs=['id','name',...spec.fields].filter((k,i,a)=>a.indexOf(k)===i);
      const records=rows.map(record=>{
        const obj={};for(const key of attrs){
          if(!Object.prototype.hasOwnProperty.call(record,key))continue;
          const value=record[key];
          if(value===null||['string','number','boolean'].includes(typeof value))obj[key]=value;
          else if(Array.isArray(value))obj[key]=value.map(v=>String(v)).join(' · ');
        }return obj;
      });
      const choices={apps:'area',ai:'domain',connections:'category',parts:'kind',
        additionalCandidates:'kind',checks:'category',dpia:'type',aiControls:'domain',
        devices:'type',licenseReview:'domain',workActions:'status',
        softwareReview:'status',faqs:'topic'};
      return {key:spec.key,label:spec.label,field:choices[spec.key]||'name',rows:records};
    });
  }
  function selected(){
    const cfg=window.EmmausDashboardStudio?.config?.()||{};
    const alias={candidates:'additionalCandidates'};
    return {key:alias[cfg.primary]||cfg.primary||'apps',
      filter:cfg.filter?.value||''};
  }
  function checkLayout(value){
    ensure(value&&value.schema==='eai-ict-dashboard-layout-v1'&&value.version===1&&validKey(value.source));
    ensure(typeof value.title==='string'&&value.title.length<=90&&Array.isArray(value.tiles)&&value.tiles.length>0&&value.tiles.length<=100);
    ensure(Array.isArray(value.pages)&&value.pages.length>0&&value.pages.length<=30);
    const ids=new Set();
    const cleaned=value.tiles.map(tile=>{
      ensure(tile&&allowedTypes.has(tile.type)&&typeof tile.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(tile.id)&&!ids.has(tile.id));
      ids.add(tile.id);
      ensure(['records','distribution','headlines','none'].includes(tile.sourceRole));
      if(tile.type==='text')ensure(tile.sourceRole==='none');
      else ensure(tile.sourceRole!=='none');
      for(const part of ['x','y','w','h'])ensure(Number.isInteger(tile[part])&&tile[part]>=0&&tile[part]<=4000);
      ensure(tile.w>0&&tile.w<=12&&tile.x+tile.w<=12&&tile.h>0);
      ensure(typeof tile.title==='string'&&tile.title.length<=180);
      ensure(typeof tile.pageId==='string'&&tile.pageId.length<=100);
      const opts=tile.tileOptions&&typeof tile.tileOptions==='object'&&!Array.isArray(tile.tileOptions)?tile.tileOptions:{};
      return {...fields(tile,['id','type','title','sourceRole','x','y','w','h','pageId']),tileOptions:copy(opts)};
    });
    const pageNames=new Set();
    const pages=value.pages.map(page=>{
      ensure(page&&typeof page.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(page.id)&&!pageNames.has(page.id));
      pageNames.add(page.id);ensure(typeof page.name==='string'&&page.name.length<=80);
      return {id:page.id,name:page.name};
    });
    ensure(cleaned.every(t=>pageNames.has(t.pageId)));
    const obj={schema:'eai-ict-dashboard-layout-v1',version:1,source:value.source,title:value.title,
      theme:String(value.theme||'paper').slice(0,35),pages,currentPageId:pageNames.has(value.currentPageId)?value.currentPageId:pages[0].id,tiles:cleaned};
    ensure(new TextEncoder().encode(JSON.stringify(obj)).length<180000);
    const secret=/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{15,}|sk-proj-[A-Za-z0-9_-]{12,}/;
    ensure(!secret.test(JSON.stringify(obj)));
    return obj;
  }
  async function storedLayout(source){
    if(!validKey(source))return null;
    const response=await fetch('./dashboard-layouts/'+source+'.json',{cache:'no-store',credentials:'omit'});
    if(response.status===404)return null;
    if(!response.ok)throw Error('Opgeslagen dashboard niet beschikbaar ('+response.status+').');
    return checkLayout(await response.json());
  }
  async function sendSources(){
    if(!state.ready){text('builderStatus','Brongegevens nog niet geladen. Synchroniseer eerst via Bronnen.');return;}
    const data=registeredData(),picked=selected();
    if(!data.length){text('builderStatus','Geen beschikbare registers.');return;}
    const key=data.some(r=>r.key===picked.key)?picked.key:data[0].key;
    sourceKey=key;original=await storedLayout(key).catch(()=>null);
    frame.contentWindow.postMessage({channel:CHANNEL,type:'source-data',registers:data,
      selected:key,filter:picked.filter,layout:original,
      revision:String(state.metadata?.dataVersion||state.metadata?.evidenceCutoff||'Bronversie niet vastgesteld')},location.origin);
  }
  function open(){
    if(!state.ready){text('dsStageMessage','Geen bronnen geladen. Synchroniseer eerst via Bronnen.');return;}
    surface.hidden=false;document.body.classList.add('builder-surface-open');
    frame.src='./dashboard-builder-app/?emmaus=1';
    $('builderClose').focus();
  }
  function close(){
    if(!popup.hidden){popup.hidden=true;pending=null;}
    surface.hidden=true;document.body.classList.remove('builder-surface-open');
    frame.src='about:blank';
    $('dsFullBuilder')?.focus();
  }
  function changeSummary(layout){
    const compared=original?.source===layout.source?original:null;
    const before=new Map((compared?.tiles||[]).map(t=>[t.id,JSON.stringify(t)]));
    const after=new Map(layout.tiles.map(t=>[t.id,JSON.stringify(t)]));
    const added=[...after.keys()].filter(id=>!before.has(id)).length;
    const changed=[...after.keys()].filter(id=>before.has(id)&&before.get(id)!==after.get(id)).length;
    const removed=[...before.keys()].filter(id=>!after.has(id)).length;
    return {added,changed,removed};
  }
  function showPopup(layout,count,displayed){
    pending=checkLayout(layout);
    const stats=changeSummary(pending);
    text('builderWriteTitle','Wijzigingen terugschrijven?');
    text('builderWriteSummary',pending.title+' · '+pending.tiles.length+' onderdelen · '+count+' bronregistraties ('+displayed+' in de huidige selectie)');
    text('builderWriteDiff',stats.added+' toegevoegd · '+stats.changed+' gewijzigd · '+stats.removed+' verwijderd');
    text('builderWriteTarget','GitHub: '+REPO+' / '+SOURCE+pending.source+'.json');
    const list=$('builderWriteTiles');list.replaceChildren();
    for(const tile of pending.tiles){
      const line=document.createElement('li');line.textContent=tile.title+' · '+tile.type+' · '+tile.sourceRole;list.append(line);
    }
    $('builderWriteConsent').checked=false;
    $('builderWriteToken').value='';
    $('builderWriteReason').value='';
    $('builderWriteSubmit').disabled=false;loading=false;
    status.textContent='';
    popup.hidden=false;
    $('builderWriteReason').focus();
  }
  function request(token){
    const api='https://api.github.com/repos/'+REPO;
    return async(method,route,body)=>{
      const url=route.startsWith('https://')?route:api+route;
      const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
      if(body!==undefined)headers['Content-Type']='application/json';
      const response=await fetch(url,{method,headers,cache:'no-store',credentials:'omit',body:body===undefined?undefined:JSON.stringify(body)});
      const data=await response.json().catch(()=>({message:'GitHub gaf geen geldig antwoord'}));
      if(!response.ok)throw Error('GitHub ('+response.status+'): '+String(data.message||'Onbekende fout').slice(0,200));
      return data;
    };
  }
  function encode(textValue){
    const bytes=new TextEncoder().encode(textValue),chunks=[];
    for(let i=0;i<bytes.length;i+=16000)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16000)));
    return btoa(chunks.join(''));
  }
  async function submit(){
    if(loading||!pending)return;
    const token=$('builderWriteToken').value.trim();
    const reason=$('builderWriteReason').value.trim();
    try{
      if(reason.length<8)throw Error('Geef een toelichting van minimaal acht tekens.');
      if(!token)throw Error('Vul een GitHub-token met beperkte schrijfrechten in.');
      if(!$('builderWriteConsent').checked)throw Error('Bevestig dat de beschrijvingen in dit ontwerp openbaar mogen worden voorgesteld.');
      loading=true;$('builderWriteSubmit').disabled=true;
      status.textContent='Actuele GitHub-versie controleren…';
      const call=request(token);
      const [user,head]=await Promise.all([
        call('GET','https://api.github.com/user'),
        call('GET','/git/ref/heads/main')]);
      if(!user.login||!/^([a-f0-9]{40})$/i.test(head?.object?.sha||''))throw Error('De GitHub-versie kon niet worden vastgesteld.');
      const sourcePath=SOURCE+pending.source+'.json';
      const baseline=await call('GET','/contents/'+sourcePath+'?ref=main').catch(e=>{
        if(String(e.message).includes('(404)'))return null;
        throw e;
      });
      if(original?.source===pending.source&&!baseline)throw Error('De opgeslagen indeling bestaat niet meer. Open de bouwer opnieuw.');
      if(original?.source!==pending.source&&baseline)throw Error('De indeling is sinds je opening veranderd. Open de bouwer opnieuw.');
      if(original?.source===pending.source&&baseline?.sha&&baseline.content){
        const raw=atob(baseline.content.replace(/\s+/g,''));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
        const remote=checkLayout(JSON.parse(new TextDecoder().decode(bytes)));
        if(JSON.stringify(remote)!==JSON.stringify(original))
          throw Error('De opgeslagen indeling is inmiddels veranderd. Sluit de bouwer en open opnieuw.');
      }
      const branch='applicatielandschap/dashboard-'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,8);
      status.textContent='Wijzigingsvoorstel voorbereiden…';
      await call('POST','/git/refs',{ref:'refs/heads/'+branch,sha:head.object.sha});
      await call('PUT','/contents/'+sourcePath,{
        message:'Applicatielandschap: '+reason.slice(0,115),branch,
        ...(baseline?.sha?{sha:baseline.sha}:{}),
        content:encode(JSON.stringify(pending,null,2)+'\n')});
      status.textContent='Pull request aanmaken…';
      const pr=await call('POST','/pulls',{
        title:'Applicatielandschap dashboard: '+reason.slice(0,90),head:branch,base:'main',
        body:'## Dashboardindeling\n\nBronregister: '+pending.source+'\nOnderdelen: '+pending.tiles.length+
          '\n\n## Aanleiding\n'+reason+
          '\n\nDeze wijziging bevat alleen de beschrijving van de dashboardindeling, geen bronregels of inloggegevens. Goedkeuring en nieuwe publicatie zijn vereist.'});
      if(!pr.html_url||!/^https:\/\/github\.com\//.test(pr.html_url))throw Error('GitHub gaf geen pull-requestlink.');
      status.replaceChildren(document.createTextNode('Voorstel aangemaakt: '));
      const a=document.createElement('a');a.href=pr.html_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open PR #'+pr.number;status.append(a);
      frame.contentWindow.postMessage({channel:CHANNEL,type:'writeback-result',message:'Voorstel #'+pr.number+' aangemaakt. Publicatie volgt na beoordeling.'},location.origin);
      original=copy(pending);pending=null;$('builderWriteSubmit').disabled=true;
    }catch(error){status.textContent=String(error.message||error).replace(/ghp_[\w-]+|github_pat_[\w-]+/g,'[afgeschermd]');}
    finally{$('builderWriteToken').value='';loading=false;}
  }
  window.addEventListener('message',event=>{
    if(surface.hidden||event.origin!==location.origin||event.source!==frame.contentWindow)return;
    const packet=event.data;if(!packet||packet.channel!==CHANNEL)return;
    if(packet.type==='ready'){void sendSources().catch(err=>text('builderStatus',err.message));}
    if(packet.type==='source-loaded')text('builderStatus',packet.registers+' registers gekoppeld · '+packet.source+' · brondata blijven in deze browser');
    if(packet.type==='source-selected'&&validKey(packet.source)){
      const target=registeredData().find(r=>r.key===packet.source);
      if(target){
        sourceKey=target.key;
        void storedLayout(sourceKey).then(layout=>{
          original=layout;
          if(!surface.hidden&&frame.contentWindow){
            frame.contentWindow.postMessage({channel:CHANNEL,type:'source-layout',source:sourceKey,layout},location.origin);
          }
        }).catch(err=>text('builderStatus',err.message));
      }
    }
    if(packet.type==='edit-record'){
      const reg=registeredData().find(r=>r.key===packet.register),id=String(packet.id||'');
      if(reg&&reg.rows.some(row=>row.id===id)){
        close();window.EmmausRecordCards?.open(reg.key,id,true,'manager');
      }
    }
    if(packet.type==='writeback-request'){
      try{showPopup(packet.layout,Number(packet.count)||0,Number(packet.displayed)||0);}
      catch(error){text('builderStatus',error.message);}
    }
    if(packet.type==='bridge-error')text('builderStatus',String(packet.message).slice(0,240));
  });
  $('dsFullBuilder').addEventListener('click',open);
  $('builderClose').addEventListener('click',close);
  $('builderWriteCancel').addEventListener('click',()=>{if(loading)return;popup.hidden=true;pending=null;});
  $('builderWriteSubmit').addEventListener('click',()=>void submit());
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||loading)return;
    if(!popup.hidden){popup.hidden=true;pending=null;event.stopPropagation();}
    else if(!surface.hidden)close();
  });
})();
