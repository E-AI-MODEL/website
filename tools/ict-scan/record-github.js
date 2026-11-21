'use strict';
/* GitHub proposals: reviewable branch and pull request. Never write to main.
   Token lives only in the input and this one asynchronous click handler. */
(function(){
  const el=id=>document.getElementById(id);
  const REPO='E-AI-MODEL/website',API='https://api.github.com/repos/'+REPO;
  const TYPES=Object.fromEntries([
    ['apps','2026-applicatielandschap.json'],['ai','2026-applicatielandschap.json'],
    ['connections','2026-applicatielandschap.json'],['parts','2026-applicatielandschap.json'],
    ['additionalCandidates','2026-applicatielandschap.json'],['checks','2026-applicatielandschap.json'],
    ['dpia','2026-applicatielandschap.json'],['aiControls','2026-applicatielandschap.json'],
    ['devices','2026-applicatielandschap.json'],['licenseReview','2026-applicatielandschap.json'],
    ['workActions','2026-werkregister.json'],['softwareReview','2026-werkregister.json'],['faqs','2026-faq.json']
  ]);
  const SOURCE_DIR='tools/ict-scan/bronnen/';
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
  function tokenFail(message){throw Error(message.replace(/github_pat_[\w-]+|ghp_[A-Za-z0-9]+/g,'[afgeschermd]'));}
  function api(token){
    return async function(method,path,payload){
      const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
      if(payload!==undefined)headers['Content-Type']='application/json';
      const resp=await fetch(path.startsWith('https://')?path:API+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store',credentials:'omit'});
      const data=await resp.json().catch(()=>({message:'Geen geldig JSON-antwoord'}));
      if(!resp.ok){
        const status=resp.status,reason=String(data.message||'Onbekende GitHub-fout').slice(0,220);
        tokenFail('GitHub ('+status+'): '+reason);
      }
      return data;
    };
  }
  function assertPublicSafe(drafts){
    if(!drafts.length)fail('Er zijn geen conceptwijzigingen.');
    for(const d of drafts){
      if(!TYPES[d.type])fail('Onbekend register in wijzigingsvoorstel.');
      if(!/^[A-Z]+-\d{2,5}$/.test(d.id))fail('Ongeldig registratie-ID: '+d.id);
      if(!d.after.name?.trim())fail('Een registratie heeft geen naam.');
      if(!d.reason||d.reason.length<8)fail('Een wijziging mist een toelichting.');
      if(d.after.id!==d.id)fail('Het registratie-ID mag niet veranderen.');
      const payload=JSON.stringify({fields:d.changed.map(k=>d.after[k]),reason:d.reason});
      if(/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{15,}|sk-proj-[A-Za-z0-9_-]{12,}/.test(payload))fail('Gegevens bevatten mogelijk een toegangssleutel.');
    }
  }
  function currentFields(remote,baseline,changed){
    if(!remote||!baseline)return false;
    return changed.every(field=>field==='sources'||equals(remote[field],baseline[field]));
  }
  function checkGraph(files){
    const byType={};
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
          for(const link of rec.relations||[]){
            if(!byType[link.targetType]?.has(link.targetId))fail('Relatie naar ontbrekende registratie: '+link.targetType+'/'+link.targetId);
            if(link.targetType===key&&link.targetId===rec.id)fail('Relatie naar zichzelf in '+rec.id);
            if(link.status==='Bevestigd'&&!link.evidence)fail('Bevestigde relatie zonder bewijs in '+rec.id);
          }
          for(const rule of rec.frameworkLinks||[]){
            if(rule.status==='Onderbouwd'&&!rule.evidence)fail('Onderbouwd oordeel zonder bewijs in '+rec.id);
            if(!rule.frameworkId||!rule.article)fail('Onvolledige normverwijzing in '+rec.id);
          }
        }
      }
    }
  }
  function applyDrafts(files,drafts,actor,stamp){
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
      if(!Array.isArray(next.sources))next.sources=[];
      const history=Array.isArray(next.auditTrail)?next.auditTrail:[];
      history.push({timestamp:stamp,actor,action:isNew?'toegevoegd':'aangepast',fields:d.changed.slice(),reason:d.reason,method:'GitHub-pull-request',source:'Applicatielandschap · JSON-kaart'});
      next.auditTrail=history;
      if(isNew)list.push(next);else list[index]=next;
      changedFiles.add(filename);
    }
    checkGraph(files);
    for(const filename of changedFiles){
      const data=files[filename];
      if(!data.metadata)data.metadata={};
      data.metadata.dataVersion=stamp.slice(0,10);
      if(filename==='2026-applicatielandschap.json'){
        for(const [key,value] of Object.entries(data.metadata.counts||{}))if(Array.isArray(data[key]))data.metadata.counts[key]=data[key].length;
      }
    }
    return changedFiles;
  }
  function confirmChangePopup(drafts){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');
      dialog.className='card-publish-review';dialog.setAttribute('aria-labelledby','cardPublishReviewHeading');
      const heading=document.createElement('div');heading.className='card-publish-review-head';
      const eyebrow=document.createElement('small');eyebrow.textContent='CONTROLE VOOR TERUGSCHRIJVEN';
      const title=document.createElement('h2');title.id='cardPublishReviewHeading';title.textContent='Wijzigingen terugschrijven?';
      heading.append(eyebrow,title);dialog.append(heading);
      const intro=document.createElement('p');intro.textContent=drafts.length===1?'Eén registratie wordt voorgesteld aan GitHub. Publicatie volgt pas na beoordeling van het pull request.':drafts.length+' registraties worden voorgesteld aan GitHub. Publicatie volgt pas na beoordeling van het pull request.';
      dialog.append(intro);
      const list=document.createElement('div');list.className='card-publish-review-list';
      for(const d of drafts){
        const item=document.createElement('article');
        const h=document.createElement('strong');h.textContent=(d.before?'Wijzig':'Nieuw')+' '+d.id+' · '+d.after.name;
        const summary=document.createElement('p');summary.textContent='Velden: '+d.changed.join(', ');
        const reason=document.createElement('small');reason.textContent=d.reason;
        item.append(h,summary,reason);list.append(item);
      }
      dialog.append(list);
      const target=document.createElement('p');target.className='card-publish-review-target';
      target.textContent='Bestemming: E-AI-MODEL/website · nieuwe branch, pull request naar main';dialog.append(target);
      const controls=document.createElement('div');controls.className='card-publish-review-actions';
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Annuleren';
      const approve=document.createElement('button');approve.type='button';approve.className='card-publish-review-approve';approve.textContent='Ja, wijzigingsvoorstel maken';
      controls.append(cancel,approve);dialog.append(controls);document.body.append(dialog);
      let accepted=false;
      cancel.addEventListener('click',()=>dialog.close());
      approve.addEventListener('click',()=>{accepted=true;dialog.close();});
      dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted);},{once:true});
      try{dialog.showModal();cancel.focus();}
      catch(_){dialog.remove();resolve(false);}
    });
  }
  async function post(){
    const cards=window.EmmausRecordCards,button=el('cardCreatePR');
    if(!cards)return;
    const drafts=cards.drafts();
    const token=el('cardGithubToken').value.trim();
    const message=el('cardCommitMessage').value.trim()||'Bijwerken Applicatielandschap 2026';
    const consent=el('cardConfirmPublic').checked;
    try{
      if(!consent)fail('Bevestig eerst dat deze wijzigingen openbaar mogen worden voorgesteld.');
      if(!token)fail('Vul een GitHub-token met beperkte schrijfrechten in.');
      assertPublicSafe(drafts);
      if(!await confirmChangePopup(drafts)){cards.feedback('Niet verstuurd. De conceptwijzigingen blijven behouden.');return;}
      button.disabled=true;button.textContent='GitHub controleren…';
      const request=api(token);
      const [user,head]=await Promise.all([
        request('GET','https://api.github.com/user'),
        request('GET','/git/ref/heads/main')
      ]);
      if(!user.login)fail('GitHub heeft geen gebruikersnaam teruggegeven.');
      const baseSha=head?.object?.sha;
      if(!/^[a-f0-9]{40}$/i.test(baseSha||''))fail('De versie van main is niet vastgesteld.');
      const paths=['2026-applicatielandschap.json','2026-werkregister.json','2026-faq.json'];
      const names=paths.concat(['manifest.json']);
      const fetched={};
      for(const name of names){
        const raw=await request('GET','/contents/'+SOURCE_DIR+name+'?ref='+encodeURIComponent(baseSha));
        if(!/^[a-f0-9]{40}$/i.test(raw.sha||''))fail('Bronbestand zonder controleerbare GitHub-SHA: '+name);
        let base64=raw.content;
        if(raw.encoding!=='base64'||typeof base64!=='string'||!base64.trim()){
          const blob=await request('GET','/git/blobs/'+raw.sha);
          if(blob.encoding!=='base64'||typeof blob.content!=='string')fail('GitHub kan de JSON-bron niet lezen: '+name);
          base64=blob.content;
        }
        fetched[name]={sha:raw.sha,data:JSON.parse(decodeBase64(base64))};
      }
      const manifest=fetched['manifest.json'].data,docs=Object.fromEntries(paths.map(name=>[name,fetched[name].data]));
      if(manifest.schema!=='eai-school-ict-manifest-v1')fail('Het manifest heeft een onbekende structuur.');
      for(const name of paths){
        const entry=manifest.dataFiles?.find(item=>item.path===name);
        if(!entry||entry.sha!==fetched[name].sha)fail('Het manifest en de bron komen niet overeen: '+name);
      }
      button.textContent='Wijzigingen controleren…';
      const changed=applyDrafts(docs,drafts,user.login,new Date().toISOString());
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
          title:'Applicatielandschap 2026: '+message.slice(0,90),head:branch,base:'main',
          body:'## Wijzigingen vanuit JSON-kaarten\n\n'+summary.map(x=>'- '+x).join('\n')+
            '\n\n## Controles\n- Bestaande bronvelden intact gelaten\n- Wijzigingen gekoppeld aan record-ID en bronversie\n- Relaties en normverwijzingen gecontroleerd\n- Wijzigingslog per registratie toegevoegd\n- Manifest en bestands-SHA bijgewerkt\n\nGoedkeuring vereist voordat de website de nieuwe gegevens uit main kan laden.'
        });
        if(!pr.html_url||!/^https:\/\/github\.com\//.test(pr.html_url))fail('GitHub heeft geen PR-link teruggegeven.');
        cards.clearPublished();
        const p=el('cardFeedback');p.replaceChildren();
        p.append(document.createTextNode('Wijzigingsvoorstel aangemaakt: '));
        const link=document.createElement('a');link.href=pr.html_url;link.textContent='Pull request #'+pr.number;link.target='_blank';link.rel='noopener noreferrer';
        p.append(link);
      }catch(error){
        cards.feedback('Wijzigingsvoorstel niet afgerond. De branch '+branch+' kan gedeeltelijke commits bevatten. '+error.message,true);
        return;
      }
    }catch(error){cards.feedback(error.message,true);}
    finally{
      el('cardGithubToken').value='';button.disabled=false;button.textContent='Wijzigingsvoorstel maken';
    }
  }
  el('cardCreatePR').addEventListener('click',()=>void post());
  // Expose pure validation helpers for deterministic tests, never token or write access.
  window.EmmausCardGitLogic=Object.freeze({applyDrafts,checkGraph,equals});
})();
