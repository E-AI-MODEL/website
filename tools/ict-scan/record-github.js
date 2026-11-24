'use strict';
/* GitHub proposals through the password-authenticated server. Never write to main. */
(function(){
  const el=id=>document.getElementById(id);
  function configuredProfile(input){return window.AssuranceProfile.validate(input||window.IctOrganisation?.profile);}
  const equals=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const safeJson=x=>JSON.stringify(x,null,2)+'\n';
  function base64Utf8(value){
    const data=new TextEncoder().encode(value);
    const chunks=[];
    for(let i=0;i<data.length;i+=16000)chunks.push(String.fromCharCode(...data.subarray(i,i+16000)));
    return btoa(chunks.join(''));
  }
  function decodeBase64(s){
    const binary=atob((s||'').replace(/\s+/g,'')),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function fail(message){throw Error(message);}
  const secretPattern=/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{15,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/;
  function assertNoSecrets(value,token=''){
    const payload=typeof value==='string'?value:JSON.stringify(value);
    if((token.length>=8&&payload.includes(token))||secretPattern.test(payload))fail('Verwijder de toegangssleutel uit de voorgestelde inhoud of wijzigingsomschrijving.');
  }
  function safeMessage(message,token){const text=String(message||'Onbekende fout');return (token?text.split(token).join('[afgeschermd]'):text).replace(/github_pat_[\w-]+|gh[pousr]_[A-Za-z0-9]+|sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,'[afgeschermd]').slice(0,260);}
  function tokenFail(message,token){throw Error(safeMessage(message,token));}
  function apiTarget(path,profile){
    const prefix='/repos/'+profile.source.repository;
    const url=new URL(path.startsWith('https://')?path:'https://api.github.com'+prefix+path);
    if(url.origin!=='https://api.github.com'||url.username||url.password||url.hash||(url.pathname!=='/user'&&!url.pathname.startsWith(prefix+'/')))fail('GitHub-verzoek valt buiten de ingestelde repository.');
    return url.href;
  }
  function api(profile){
    return (method,path,payload)=>window.EmmausEditGate.githubRequest(apiTarget(path,profile),method,payload);
  }
  async function repositoryFile(request,path,baseSha){
    const encodedPath=path.split('/').map(encodeURIComponent).join('/');
    const raw=await request('GET','/contents/'+encodedPath+'?ref='+encodeURIComponent(baseSha));
    if(!/^[a-f0-9]{40}$/i.test(raw.sha||'')||(raw.type&&raw.type!=='file'))fail('Bestand zonder controleerbare GitHub-SHA: '+path);
    let content=raw.content;
    if(raw.encoding!=='base64'||typeof content!=='string'||!content.trim()){
      const blob=await request('GET','/git/blobs/'+raw.sha);
      if(blob.encoding!=='base64'||typeof blob.content!=='string')fail('GitHub kan het bestand niet lezen: '+path);
      content=blob.content;
    }
    return {sha:raw.sha,text:decodeBase64(content)};
  }
  function configurationFor(profile,catalog){
    const files=profile.source.configurationFiles;
    if(!files)fail('Publiceren is nog niet ingericht: het organisatieprofiel moet de repositorypaden van het profiel, de toetsingskaders en beide controlemodules benoemen. De gegevens blijven lokaal beschikbaar.');
    if(!catalog||catalog.schema!=='eai-applicable-frameworks-v1')fail('De geladen toetsingskaders ontbreken. Open het dashboard opnieuw.');
    const versions={engine:window.AssuranceEngine?.VERSION,sourceRegister:window.AssuranceSourceRegister?.VERSION};
    if(Object.values(versions).some(value=>typeof value!=='string'||!/^\d+\.\d+\.\d+$/.test(value)))fail('De geladen controleversies ontbreken. Open het dashboard opnieuw.');
    return {files,catalog:clone(catalog),versions};
  }
  function declaredModuleVersion(source,label){
    // Read the one explicit version declaration; never execute remote JavaScript.
    // Version equality does not claim that every code byte is identical.
    const matches=[...source.matchAll(/^[ \t]*const[ \t]+VERSION[ \t]*=[ \t]*(['"])(\d+\.\d+\.\d+)\1[ \t]*;[ \t]*(?:\/\/[^\r\n]*)?$/gm)];
    if(matches.length!==1)fail('De controleversie van '+label+' op GitHub is niet eenduidig vastgelegd. Publicatie is gestopt.');
    return matches[0][2];
  }
  async function assertRepositoryConfiguration(request,profile,configuration,baseSha){
    const labels={profile:'het organisatieprofiel',catalog:'de toetsingskaders',engine:'de controle-engine',sourceRegister:'de broncontrole'};
    const contents={};
    for(const [type,path] of Object.entries(configuration.files)){
      try{contents[type]=(await repositoryFile(request,path,baseSha)).text;}
      catch(error){fail('Configuratie voor '+labels[type]+' is niet leesbaar op de gekozen GitHub-basis: '+path+'. De bronrepository moet de ingestelde configuratiebestanden bevatten. '+error.message);}
    }
    const remoteProfile=window.AssuranceProfile.validate(JSON.parse(contents.profile));
    if(window.AssuranceEngine.canonicalize(remoteProfile)!==window.AssuranceEngine.canonicalize(profile))fail('Het organisatieprofiel op GitHub verschilt van het geladen profiel. Laad de actuele configuratie en bevestig nieuwe beoordelingen opnieuw.');
    const remoteCatalog=JSON.parse(contents.catalog);
    if(window.AssuranceEngine.canonicalize(remoteCatalog)!==window.AssuranceEngine.canonicalize(configuration.catalog))fail('De toetsingskaders op GitHub verschillen van de geladen toetsingskaders. Laad de actuele configuratie en bevestig nieuwe beoordelingen opnieuw.');
    for(const type of ['engine','sourceRegister'])if(declaredModuleVersion(contents[type],labels[type])!==configuration.versions[type])fail('De versie van '+labels[type]+' op GitHub verschilt van de geladen controleversie. Open de actuele dashboardversie en bevestig nieuwe beoordelingen opnieuw.');
  }
  function assertPublicSafe(drafts,profile){
    const TYPES=profile.source.registerFiles;
    if(!drafts.length)fail('Er zijn geen conceptwijzigingen.');
    for(const d of drafts){
      if(d.sourceScope!==window.AssuranceProfile.scopeKey(profile))fail('Het concept is niet gekoppeld aan de GitHub-bron van dit organisatieprofiel. Synchroniseer de juiste bron en maak het concept opnieuw.');
      if(!TYPES[d.type])fail('Onbekend register in wijzigingsvoorstel.');
      if(!/^[A-Z]+-\d{2,5}$/.test(d.id))fail('Ongeldig registratie-ID: '+d.id);
      if(!d.after.name?.trim())fail('Een registratie heeft geen naam.');
      if(!d.reason||d.reason.length<8)fail('Een wijziging mist een toelichting.');
      if(d.after.id!==d.id)fail('Het registratie-ID mag niet veranderen.');
      if(!Array.isArray(d.changed)||d.changed.some(field=>['id','sourceFields','provenance','otherDescription','auditTrail','originalNumber'].includes(field)))fail('Oorspronkelijke bronvelden mogen niet worden overschreven.');
      const payload=JSON.stringify({fields:d.changed.map(k=>d.after[k]),reason:d.reason});
      assertNoSecrets(payload);
    }
  }
  function currentFields(remote,baseline,changed){
    if(!remote||!baseline)return false;
    return changed.every(field=>field==='sources'||equals(remote[field],baseline[field]));
  }
  function checkGraph(files,inputProfile,asOf){
    const profile=configuredProfile(inputProfile),TYPES=profile.source.registerFiles;
    const byType={},sourceAliases=new Map();
    for(const [name,json] of Object.entries(files)){
      for(const key of Object.keys(TYPES))if(TYPES[key]===name)byType[key]=new Set((json[key]||[]).map(x=>x.id));
    }
    for(const [name,json] of Object.entries(files)){
      for(const key of Object.keys(TYPES)){
        if(TYPES[key]!==name)continue;
        const valid=byType[key];
        const existing=new Set();
        for(const rec of json[key]||[]){
          if(!rec.id||existing.has(rec.id))fail('Dubbel of ontbrekend ID in '+key+': '+String(rec.id));
          existing.add(rec.id);
          if(key==='sourceRegister'){
            const errors=window.AssuranceSourceRegister.validate(rec,{asOf,organisationId:profile.organisation.id,scopeId:window.AssuranceProfile.scopeKey(profile)});
            const invalid=errors.find(item=>item.severity==='fail'&&item.category!=='business');
            if(invalid)fail(invalid.message+' ('+rec.id+')');
            for(const alias of rec.referenceKeys||[]){
              if(sourceAliases.has(alias))fail('Een bronverwijzing hoort bij meerdere bronregels: '+alias);
              sourceAliases.set(alias,rec.id);
            }
          }
          if(rec.sourceIds!==undefined){
            if(!Array.isArray(rec.sourceIds)||rec.sourceIds.some(id=>typeof id!=='string'||!byType.sourceRegister?.has(id))||new Set(rec.sourceIds).size!==rec.sourceIds.length)fail('Ongeldige of ontbrekende bronkoppeling in '+rec.id);
          }
          for(const link of rec.relations||[]){
            if(!byType[link.targetType]?.has(link.targetId))fail('Relatie naar ontbrekende registratie: '+link.targetType+'/'+link.targetId);
            if(link.targetType===key&&link.targetId===rec.id)fail('Relatie naar zichzelf in '+rec.id);
            if(link.status==='Bevestigd'&&!link.evidence)fail('Bevestigde relatie zonder bewijs in '+rec.id);
          }
          for(const rule of rec.frameworkLinks||[]){
            window.AssuranceRecord.assertValid(rule,{asOf});
          }
        }
      }
    }
  }
  function assertNewBindings(beforeFiles,afterFiles,drafts,profile,catalog,asOf){
    const pending=[];
    for(const draft of drafts){
      const file=profile.source.registerFiles[draft.type];
      const before=beforeFiles[file]?.[draft.type]?.find(item=>item.id===draft.id);
      const after=afterFiles[file]?.[draft.type]?.find(item=>item.id===draft.id);
      if(!after)fail('De voorgestelde registratie ontbreekt.');
      const original=new Map();
      for(const link of before?.frameworkLinks||[]){const value=window.AssuranceEngine.canonicalize(link);original.set(value,(original.get(value)||0)+1);}
      for(const link of after.frameworkLinks||[]){
        const value=window.AssuranceEngine.canonicalize(link),count=original.get(value)||0;
        if(count){original.set(value,count-1);continue;}
        if(['Onderbouwd','Niet van toepassing'].includes(link.status))pending.push({type:draft.type,id:draft.id,link});
      }
      if(draft.type==='sourceRegister'&&after.approvalStatus==='Goedgekeurd'){
        const decision=record=>Object.fromEntries(['approvalStatus','approvedBy','approvedAt','approvalEvidence','nextReviewAt','approvalBinding'].filter(field=>record&&Object.prototype.hasOwnProperty.call(record,field)).map(field=>[field,record[field]]));
        if(window.AssuranceEngine.canonicalize(decision(before))!==window.AssuranceEngine.canonicalize(decision(after)))pending.push({type:draft.type,id:draft.id,sourceApproval:true});
      }
    }
    if(!pending.length)return;
    if(!catalog)fail('De gebruikte toetsingskaders ontbreken. Open het dashboard opnieuw.');
    const input=window.AssuranceAdapter.fromDocuments(profile,afterFiles,catalog,{asOf,sourceVersion:''});
    for(const item of pending){
      const record=input.records.find(row=>row.type===item.type&&row.id===item.id);
      const result=item.sourceApproval?window.AssuranceSourceRegister.inspectApprovalBinding(record.data,input.context):window.AssuranceEngine.inspectReviewBinding(input,record,item.link);
      if(result.status!=='current')fail('De nieuwe '+(item.sourceApproval?'brongoedkeuring':'beoordeling')+' van '+item.id+' past niet bij de actuele gegevens. Synchroniseer en bevestig opnieuw.');
    }
  }
  function applyDrafts(targetFiles,drafts,actor,stamp,inputProfile,catalog){
    const profile=configuredProfile(inputProfile),TYPES=profile.source.registerFiles;
    assertPublicSafe(drafts,profile);
    const files=clone(targetFiles);
    const changedFiles=new Set();
    for(const d of drafts){
      const filename=TYPES[d.type],src=files[filename],list=src[d.type];
      if(!Array.isArray(list))fail('Register ontbreekt in GitHub: '+d.type);
      const index=list.findIndex(item=>item.id===d.id);
      const isNew=!d.before;
      if(isNew && index!==-1)fail('Het nieuwe ID bestaat inmiddels al in GitHub: '+d.id+'. Synchroniseer opnieuw.');
      if(!isNew && index<0)fail('Registratie verwijderd sinds de laatste synchronisatie: '+d.id);
      if(!isNew && !currentFields(list[index],d.before,d.changed))fail('De registratie '+d.id+' is sinds jouw laatste bronversie gewijzigd. Synchroniseer opnieuw.');
      let next=isNew?clone(d.after):clone(list[index]);
      if(!isNew)for(const field of d.changed){
        if(field==='sources'){
          const originals=new Set(d.before.sources||[]);
          const additions=(d.after.sources||[]).filter(src=>!originals.has(src));
          next.sources=[...new Set([...(next.sources||[]),...additions])];
        }else next[field]=clone(d.after[field]);
      }
      if(next.sources!==undefined&&!Array.isArray(next.sources))fail('Bronverwijzingen moeten een lijst zijn in '+d.id+'.');
      const history=Array.isArray(next.auditTrail)?next.auditTrail:[];
      history.push({timestamp:stamp,actor,action:isNew?'toegevoegd':'aangepast',fields:d.changed.slice(),reason:d.reason,method:'GitHub-pull-request',source:'Applicatielandschap · JSON-kaart'});
      next.auditTrail=history;
      if(isNew)list.push(next);else list[index]=next;
      changedFiles.add(filename);
    }
    checkGraph(files,profile,stamp.slice(0,10));
    assertNewBindings(targetFiles,files,drafts,profile,catalog,stamp.slice(0,10));
    for(const filename of changedFiles){
      const data=files[filename];
      if(!data.metadata)data.metadata={};
      data.metadata.dataVersion=stamp.slice(0,10);
      for(const key of Object.keys(data.metadata.counts||{}))if(Array.isArray(data[key]))data.metadata.counts[key]=data[key].length;
    }
    for(const filename of changedFiles)targetFiles[filename]=files[filename];
    return changedFiles;
  }
  function assertSourceMatches(profile,sources){
    if(!Array.isArray(sources)||!sources.length)fail('Synchroniseer eerst de GitHub-bron van dit organisatieprofiel.');
    for(const source of sources||[]){
      const remote=source.githubRemote;
      if(!remote||remote.repository!==profile.source.repository||remote.ref!==profile.source.baseRef||typeof remote.path!=='string'||!remote.path.startsWith(profile.source.sourceDir+'/')||!/^[a-f0-9]{40}$/i.test(remote.sha||''))fail('De geladen gegevens zijn niet volledig gekoppeld aan de GitHub-bron van dit organisatieprofiel. Synchroniseer eerst die bron.');
    }
  }
  function sourceScope(profile,sources){
    try{assertSourceMatches(profile,sources);return window.AssuranceProfile.scopeKey(profile);}catch(_){return null;}
  }
  // Shared design settings, not a sixth school dataset. No rows, filters,
  // source IDs, source values or access credentials may enter this file.
  function validateDashboardDesign(value,allowedData,allowedComponents){
    const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
    const unique=(a,allowed)=>Array.isArray(a)&&a.length>0&&new Set(a).size===a.length&&a.every(x=>allowed.includes(x));
    if(!exact(value,['format','version','title','content','components','layout','variant','primary','visuals'])||
      value.format!=='emmaus-dashboard-layout'||value.version!==1||
      typeof value.title!=='string'||!value.title.trim()||value.title.length>90||
      !unique(value.content,allowedData)||!unique(value.components,allowedComponents)||
      !value.content.includes(value.primary)||!['balanced','editorial','focus','compact'].includes(value.layout)||
      !Number.isInteger(value.variant)||value.variant<0||value.variant>8||
      !exact(value.visuals,['distribution','matrix'])||
      !['lines','bars','donut','treemap','table'].includes(value.visuals.distribution)||
      !['matrix','table'].includes(value.visuals.matrix))fail('Ongeldige dashboardindeling. Kies ten minste één gegevensgroep en grafiek.');
    assertNoSecrets(value);
    return clone(value);
  }
  const DESIGN_PATH='tools/ict-scan/dashboard-layouts/layouts.json';
  function validateDesignFile(value,validate){
    if(!value||value.schema!=='eai-ict-dashboard-designs-v1'||Object.keys(value).sort().join('|')!=='designs|schema'||
      !value.designs||typeof value.designs!=='object'||Array.isArray(value.designs)||Object.keys(value.designs).length>15)fail('Onbekend formaat van gedeelde dashboardontwerpen.');
    const designs=Object.create(null);
    for(const [key,raw] of Object.entries(value.designs)){
      const design=validate(raw);
      if(key!==design.primary||!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(key))fail('Dashboard is niet gekoppeld aan het gekozen register.');
      designs[key]=design;
    }
    return {schema:value.schema,designs};
  }
  function designStudio(){const studio=window.EmmausDashboardStudio;if(!studio)fail('Dashboardmaker niet geladen.');return studio;}
  async function designProfile(){
    if(window.top!==window.self)fail('Open de ICT-scan rechtstreeks.');
    const profile=await window.IctOrganisation.ready;
    if(profile.source.repository!=='E-AI-MODEL/website'||profile.source.baseRef!=='main'||profile.source.sourceDir!=='tools/ict-scan/bronnen')fail('Dit organisatieprofiel heeft geen gedeelde dashboardmap.');
    if(state.sourceMode!=='github'||!state.githubVerification?.commit||window.IctGitHubSync?.isBusy())fail('Synchroniseer eerst de officiële GitHub-bron.');
    assertSourceMatches(profile,state.sources);
    return profile;
  }
  function publicRead(profile){return async(method,path)=>{
    if(method!=='GET')fail('Deze route kan alleen lezen.');
    const response=await fetch(apiTarget(path,profile),{method:'GET',headers:{Accept:'application/vnd.github+json'},cache:'no-store',credentials:'omit',redirect:'error'});
    if(!response.ok)fail('Gedeeld ontwerp niet beschikbaar ('+response.status+').');
    return response.json();
  };}
  async function readDesigns(request,profile){
    const head=await request('GET','/git/ref/heads/'+encodeURIComponent(profile.source.baseRef));
    const baseSha=head?.object?.sha;if(!/^[a-f0-9]{40}$/.test(baseSha||''))fail('GitHub-versie ontbreekt.');
    const file=await repositoryFile(request,DESIGN_PATH,baseSha);
    return {baseSha,sha:file.sha,data:validateDesignFile(JSON.parse(file.text),designStudio().validateDesign)};
  }
  let pendingDesign=null,designBusy=false;
  function designStatus(message){const status=el('dsSharedStatus');if(status)status.textContent=message;}
  async function loadSharedDesign(){
    if(designBusy)return;designBusy=true;
    try{
      const profile=await designProfile(),studio=designStudio(),key=studio.currentDesign().primary;
      const file=await readDesigns(publicRead(profile),profile);
      const design=file.data.designs[key];if(!design)fail('Voor dit register is nog geen gedeeld ontwerp gepubliceerd.');
      if(!confirm('De huidige indeling vervangen door het gedeelde ontwerp? Gegevens blijven ongewijzigd.'))return;
      studio.applyDesign(design);designStatus('Gedeeld ontwerp geopend. Gegevens blijven afkomstig uit de geladen index.');
    }catch(error){designStatus(safeMessage(error.message,''));}finally{designBusy=false;}
  }
  async function prepareDesign(){
    if(designBusy)return;designBusy=true;
    try{
      const profile=await designProfile(),studio=designStudio(),design=studio.validateDesign(studio.currentDesign());
      if(!await window.EmmausEditGate.request())return;
      const baseline=await readDesigns(publicRead(profile),profile);
      const old=baseline.data.designs[design.primary]||null;
      if(equals(old,design))fail('De indeling is al gepubliceerd.');
      pendingDesign={design,baseline};
      el('dsSharedDiff').textContent=(old?'Bestaand ontwerp vervangen':'Nieuw ontwerp')+' · '+design.primary+' · '+design.components.length+' onderdelen';
      el('dsSharedPreview').textContent=safeJson(design);
      el('dsSharedTarget').textContent=profile.source.repository+' / '+DESIGN_PATH;
      el('dsSharedReason').value='';
      el('dsSharedFeedback').textContent='';el('dsSharedSubmit').disabled=false;
      el('dsSharedDialog').showModal();
    }catch(error){designStatus(safeMessage(error.message,''));}finally{designBusy=false;}
  }
  async function publishDesign(){
    if(designBusy||!pendingDesign)return;designBusy=true;
    const reason=el('dsSharedReason').value.trim()||'Handmatige wijziging van dashboardindeling',feedback=el('dsSharedFeedback'),button=el('dsSharedSubmit');
    button.disabled=true;
    let branch=null;
    try{
      const profile=await designProfile(),{design,baseline}=pendingDesign;
      if(!await window.EmmausEditGate.request())return;
      const normalized=designStudio().validateDesign(design);
      assertNoSecrets({normalized,reason});
      const request=api(profile),current=await readDesigns(request,profile);
      if(current.sha!==baseline.sha)fail('De gedeelde ontwerpen zijn intussen gewijzigd. Sluit dit venster en open het opnieuw.');
      const next=validateDesignFile({schema:current.data.schema,designs:{...current.data.designs,[normalized.primary]:normalized}},designStudio().validateDesign);
      assertNoSecrets({next,reason});
      feedback.textContent='Wijzigingsvoorstel aanmaken…';
      branch='applicatielandschap/ontwerp-'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,8);
      await request('POST','/git/refs',{ref:'refs/heads/'+branch,sha:current.baseSha});
      await request('PUT','/contents/'+DESIGN_PATH,{message:'Dashboardontwerp: '+reason.slice(0,110),branch,sha:current.sha,content:base64Utf8(safeJson(next))});
      const pr=await request('POST','/pulls',{title:'ICT-scan: gedeeld dashboardontwerp '+normalized.primary,head:branch,base:profile.source.baseRef,body:'Wijziging van de dashboardindeling (geen schoolregisters).\n\n'+reason});
      if(!Number.isInteger(pr.number)||pr.html_url!=='https://github.com/'+profile.source.repository+'/pull/'+pr.number)fail('Geen geldige PR-link ontvangen.');
      feedback.replaceChildren(document.createTextNode('Voorstel gemaakt: '));
      const a=document.createElement('a');a.href=pr.html_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='PR #'+pr.number;feedback.append(a);
      pendingDesign=null;designStatus('Wijzigingsvoorstel gemaakt. Nog niet gepubliceerd.');
    }catch(error){feedback.textContent=(branch?'Controleer ook branch '+branch+'. ':'')+safeMessage(error.message,'');button.disabled=false;}
    finally{button.disabled=false;designBusy=false;}
  }
  el('dsSharedLoad')?.addEventListener('click',()=>void loadSharedDesign());
  el('dsSharedPublish')?.addEventListener('click',()=>void prepareDesign());
  el('dsSharedSubmit')?.addEventListener('click',()=>void publishDesign());
  el('dsSharedClose')?.addEventListener('click',()=>{if(!designBusy){pendingDesign=null;el('dsSharedDialog').close();}});
  el('dsSharedDialog')?.addEventListener('cancel',event=>{if(designBusy)event.preventDefault();else{pendingDesign=null;}});
  let saving=false;
  async function post(){
    const cards=window.EmmausRecordCards,button=el('cardCreatePR');
    if(!cards)return;
    if(saving)return false;
    const drafts=cards.drafts();
    if(!drafts.length)return false;
    const message=drafts.length===1?'Bijwerken '+drafts[0].after.name:'Bijwerken '+drafts.length+' registraties';
    saving=true;button.disabled=true;
    try{
      if(window.top!==window.self)fail('Open het dashboard rechtstreeks om wijzigingen op te slaan.');
      const profile=await window.IctOrganisation.ready;
      const SOURCE_DIR=profile.source.sourceDir+'/',baseRef=profile.source.baseRef;
      assertNoSecrets({drafts,message});
      assertSourceMatches(profile,state.sources);
      assertPublicSafe(drafts,profile);
      if(!await window.EmmausEditGate.request())return false;
      const configuration=configurationFor(profile,cards.catalog?.());
      button.disabled=true;button.textContent='GitHub controleren…';
      const request=api(profile);
      const [user,head]=await Promise.all([
        request('GET','https://api.github.com/user'),
        request('GET','/git/ref/heads/'+encodeURIComponent(baseRef))
      ]);
      if(!user.login)fail('GitHub heeft geen gebruikersnaam teruggegeven.');
      const baseSha=head?.object?.sha;
      if(!/^[a-f0-9]{40}$/i.test(baseSha||''))fail('De versie van de ingestelde bronbranch is niet vastgesteld.');
      await assertRepositoryConfiguration(request,profile,configuration,baseSha);
      const paths=[...new Set(Object.values(profile.source.registerFiles))];
      const names=paths.concat(['manifest.json']);
      const fetched={};
      for(const name of names){
        const raw=await repositoryFile(request,SOURCE_DIR+name,baseSha);
        fetched[name]={sha:raw.sha,data:JSON.parse(raw.text)};
      }
      const manifest=fetched['manifest.json'].data,docs=Object.fromEntries(paths.map(name=>[name,fetched[name].data]));
      if(manifest.schema!=='eai-school-ict-manifest-v1')fail('Het manifest heeft een onbekende structuur.');
      for(const name of paths){
        const entry=manifest.dataFiles?.find(item=>item.path===name);
        if(!entry||entry.sha!==fetched[name].sha)fail('Het manifest en de bron komen niet overeen: '+name);
      }
      button.textContent='Wijzigingen controleren…';
      const changed=applyDrafts(docs,drafts,user.login,new Date().toISOString(),profile,configuration.catalog);
      assertNoSecrets({documents:docs,manifest,message});
      if(!changed.size)fail('Er zijn geen gewijzigde bestanden.');
      const branch='applicatielandschap/kaart-'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,8);
      button.textContent='GitHub-branch maken…';
      await request('POST','/git/refs',{ref:'refs/heads/'+branch,sha:baseSha});
      try{
        for(const name of paths){
          if(!changed.has(name))continue;
          button.textContent='Bronbestand opslaan…';
          const result=await request('PUT','/contents/'+SOURCE_DIR+name,{
            message:'Applicatielandschap: '+message.slice(0,130),content:base64Utf8(safeJson(docs[name])),sha:fetched[name].sha,branch});
          const nextSha=result.content?.sha;
          if(!/^[a-f0-9]{40}$/i.test(nextSha||''))fail('GitHub heeft geen nieuwe SHA teruggegeven voor '+name);
          const row=manifest.dataFiles.find(item=>item.path===name);
          row.sha=nextSha;
          row.recordCounts=Object.fromEntries(Object.entries(row.recordCounts||{}).map(([kind])=>[kind,Array.isArray(docs[name][kind])?docs[name][kind].length:0]));
        }
        manifest.metadata={...manifest.metadata,lastProposedChange:new Date().toISOString(),lastProposedBy:user.login};
        button.textContent='Manifest opslaan…';
        await request('PUT','/contents/'+SOURCE_DIR+'manifest.json',{
          message:'Applicatielandschap: broncontrole en wijzigingslog',content:base64Utf8(safeJson(manifest)),sha:fetched['manifest.json'].sha,branch});
        button.textContent='Pull request maken…';
        const summary=drafts.map(d=>(d.before?'Wijzig':'Nieuw')+' '+d.type+'/'+d.id+' ('+d.after.name+') · '+d.reason);
        const pr=await request('POST','/pulls',{
          title:profile.organisation.name+': '+message.slice(0,90),head:branch,base:baseRef,
          body:'## Wijzigingen vanuit JSON-kaarten\n\n'+summary.map(x=>'- '+x).join('\n')+
            '\n\n## Controles\n- Bestaande bronvelden intact gelaten\n- Wijzigingen gekoppeld aan record-ID en bronversie\n- Relaties en normverwijzingen gecontroleerd\n- Wijzigingslog per registratie toegevoegd\n- Manifest en bestands-SHA bijgewerkt\n\nGoedkeuring vereist voordat de website de nieuwe gegevens uit main kan laden.'
        });
        if(!pr.html_url||!/^https:\/\/github\.com\//.test(pr.html_url))fail('GitHub heeft geen PR-link teruggegeven.');
        const remaining=cards.clearPublished(drafts)?.remaining||0;
        const p=el('cardFeedback');p.replaceChildren();
        p.append(document.createTextNode('Opgeslagen als wijzigingsvoorstel: '));
        const link=document.createElement('a');link.href=pr.html_url;link.textContent='Pull request #'+pr.number;link.target='_blank';link.rel='noopener noreferrer';
        p.append(link);
        if(remaining)p.append(document.createTextNode('. '+remaining+' nieuwe conceptwijziging'+(remaining===1?' blijft':'en blijven')+' bewaard.'));
        return true;
      }catch(error){
        cards.feedback('Wijzigingsvoorstel niet afgerond. De branch '+branch+' kan gedeeltelijke commits bevatten. '+safeMessage(error.message,''),true);
        return false;
      }
    }catch(error){cards.feedback(safeMessage(error.message,''),true);return false;}
    finally{
      saving=false;button.disabled=false;button.textContent='Opslaan';
    }
  }
  el('cardCreatePR').addEventListener('click',()=>void post());
  window.EmmausCardPublisher=Object.freeze({submit:post});
  // Expose pure validation helpers for deterministic tests, never token or write access.
  window.EmmausCardGitLogic=Object.freeze({applyDrafts,checkGraph,equals,assertSourceMatches,sourceScope,assertNoSecrets,apiTarget,validateDashboardDesign,validateDesignFile});
})();
