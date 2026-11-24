'use strict';
/* Read-only GitHub import. Credentials are never stored or included in exports.
   Existing school files are parsed in this browser, using the same importer as local files. */
(function(){
  const $ = id => document.getElementById(id);
  const allowed = /\.(?:xlsx|csv|json|docx|pdf)$/i;
  const MAX_FILES = 60;
  const MAX_FILE_BYTES = 35 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 95 * 1024 * 1024;
  const MAX_DIRECTORY_ENTRIES = 1000;
  function assertNotCancelled(signal) {
    if(signal && signal.aborted) { const error=new Error('Synchronisatie geannuleerd.'); error.name='AbortError'; throw error; }
  }
  let busy = false;
  let abort = null;
  let syncMode='idle',syncMessage='GitHub nog niet gecontroleerd.';
  const canonicalFor=(profile,cfg)=>!!profile&&profile.source.repository===cfg.repo&&profile.source.baseRef===cfg.ref&&profile.source.sourceDir===cfg.folder;
  function renderStatus(){
    const badge=$('githubLiveStatus');if(!badge)return;
    const verified=state.githubVerification;
    const current=state.ready&&state.sourceMode==='github'&&syncMode==='success'&&verified;
    badge.dataset.mode=current?'success':syncMode==='info'?'loading':'warning';
    badge.textContent=syncMode==='info'?'GitHub ophalen…':current?'GitHub · '+verified.records+' registraties':state.ready?'GitHub niet actueel':'GitHub verbinden';
    badge.title=current?'Gecontroleerd: '+verified.files+' bestanden, '+verified.registers+' registers · '+verified.version+' · '+verified.commit:' '+syncMessage+(state.ready?' De getoonde gegevens zijn niet als actuele GitHub-versie bevestigd.':'');
    badge.setAttribute('aria-label',badge.textContent+'. '+badge.title);
  }
  function markLocal(mode='local'){state.sourceMode=mode;state.githubVerification=null;syncMode='warning';syncMessage=mode==='snapshot'?'Lokale momentopname; GitHub nog niet gecontroleerd.':'Lokale gegevens; geen actuele GitHub-bron.';renderStatus();}
  window.IctGitHubSync=Object.freeze({renderStatus,markLocal,isBusy:()=>busy});

  function showStatus(message, mode='info') {
    const el = $('githubSyncStatus');
    el.textContent = message;
    el.dataset.mode = mode;
    syncMode=mode;syncMessage=message;renderStatus();
  }
  function validInput() {
    const repo = ($('githubRepo').value.trim() || 'E-AI-MODEL/website').replace(/^https:\/\/github\.com\//i,'').replace(/\/$/,'').replace(/\.git$/i,'');
    const folder = $('githubFolder').value.trim().replace(/^\/+|\/+$/g,'');
    const ref = $('githubRef').value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || repo.includes('..')) throw Error('Gebruik een repository als eigenaar/naam.');
    if (!folder || folder.length > 240 || folder.split('/').some(s=>!s || s==='.' || s==='..' || !/^[\w .()\-]+$/.test(s))) throw Error('Vul een bestaande GitHub-map in, bijvoorbeeld tools/ict-scan/bronnen.');
    if (!ref || ref.length > 120 || !/^[\w./-]+$/.test(ref) || ref.includes('..') || ref.startsWith('/') || ref.endsWith('/')) throw Error('Controleer de branch of tag.');
    return {repo,folder,ref};
  }
  function pathUrl(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function endpoint(cfg, route) { const [owner,repo] = cfg.repo.split('/'); return 'https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/'+route; }
  function headers(token) {
    const h = {'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(token)h.Authorization='Bearer '+token;
    return h;
  }
  async function githubJson(url,token,signal) {
    assertNotCancelled(signal);
    const response = await fetch(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',headers:headers(token),signal});
    if(!response.ok) {
      if(response.status===401)throw Error('GitHub heeft de token geweigerd.');
      if(response.status===403)throw Error('GitHub weigert toegang. Controleer leesrechten of de API-limiet.');
      if(response.status===404)throw Error('Repository of bronmap niet gevonden. Controleer de broninstellingen. Een privérepository vraagt een token met leesrechten.');
      throw Error('GitHub antwoordt met HTTP '+response.status+'.');
    }
    const data=await response.json();
    assertNotCancelled(signal);
    return data;
  }
  async function listFiles(cfg,token,signal,strict=false) {
    const files=[];
    let manifest=null;
    const recurse=async (folder,depth)=>{
      assertNotCancelled(signal);
      if(depth>5)throw Error('De mapstructuur is te diep. Selecteer een kleinere map.');
      const url=endpoint(cfg,'contents/'+pathUrl(folder)+'?ref='+encodeURIComponent(cfg.ref));
      const entries=await githubJson(url,token,signal);
      if(!Array.isArray(entries))throw Error('De opgegeven locatie is een bestand, geen map.');
      if(entries.length>=MAX_DIRECTORY_ENTRIES)throw Error('GitHub toont maximaal 1.000 items per map. Kies een kleinere bronmap; anders kunnen bestanden ongemerkt ontbreken.');
      const sorted=entries.slice().sort((a,b)=>String(a.path).localeCompare(String(b.path),'nl'));
      for(const entry of sorted){
        assertNotCancelled(signal);
        if(entry.type==='dir') {
          if(!strict&&(entry.name.startsWith('.') || /^(?:node_modules|archief|archive|old|backup)$/i.test(entry.name)))continue;
          await recurse(entry.path,depth+1);
        } else if(entry.type==='file'&&entry.name.toLowerCase()==='manifest.json'&&folder===cfg.folder){
          manifest={name:entry.name,path:entry.path,sha:entry.sha,size:entry.size};
        } else if(entry.type==='file'&&allowed.test(entry.name)&&entry.name.toLowerCase()!=='manifest.json'){
          if(entry.size>MAX_FILE_BYTES)throw Error(entry.path+': bestand groter dan 35 MB.');
          files.push({name:entry.name,path:entry.path,sha:entry.sha,size:entry.size});
          if(files.length>MAX_FILES)throw Error('Meer dan '+MAX_FILES+' bestanden gevonden. Kies een kleinere map.');
        }else if(strict){throw Error('Niet-ingedeeld bestand in de verplichte bronmap: '+entry.path+'. Leg het vast in het bronpakket of verplaats het naar de juiste locatie.');}
      }
    };
    await recurse(cfg.folder,0);
    assertNotCancelled(signal);
    const total=files.reduce((n,x)=>n+x.size,0);
    if(total>MAX_TOTAL_BYTES)throw Error('Samen zijn de bestanden groter dan 95 MB. Selecteer een kleinere map.');
    files.manifest=manifest;
    return files;
  }
  function decodeBase64(input,expected) {
    const plain=input.replace(/\s/g,'');
    if(!plain || !/^[A-Za-z0-9+/]*={0,2}$/.test(plain))throw Error('GitHub heeft geen geldig bestandsbestand teruggegeven.');
    const bytes=new Uint8Array(Math.floor(plain.length*3/4));
    let pos=0;
    const chunkSize=4*8192;
    for(let i=0;i<plain.length;i+=chunkSize){
      const part=atob(plain.slice(i,i+chunkSize));
      for(let j=0;j<part.length;j++)bytes[pos++]=part.charCodeAt(j);
    }
    const actual=bytes.subarray(0,pos);
    if(Number.isFinite(expected)&&expected>=0&&actual.length!==expected)throw Error('De bestandsgrootte wijkt af van GitHub.');
    return actual;
  }
  async function downloadFile(cfg,entry,token,signal,strict=false) {
    assertNotCancelled(signal);
    // Git blob endpoint supports binary files above GitHub's 1 MB Contents API threshold.
    if(!/^[a-f0-9]{40}$/.test(entry.sha))throw Error('Onverwachte GitHub-identificatie: '+entry.path);
    const result=await githubJson(endpoint(cfg,'git/blobs/'+entry.sha),token,signal);
    if(result.encoding!=='base64'||typeof result.content!=='string')throw Error('GitHub geeft voor '+entry.path+' geen leesbare bestandsinhoud terug.');
    const bytes=decodeBase64(result.content,entry.size);
    if(strict){
      if(!globalThis.crypto?.subtle)throw Error('Bestandscontrole vereist HTTPS of localhost.');
      const prefix=new TextEncoder().encode('blob '+bytes.length+'\0');
      const payload=new Uint8Array(prefix.length+bytes.length);payload.set(prefix);payload.set(bytes,prefix.length);
      const digest=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1',payload)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==entry.sha)throw Error('Bestandsinhoud wijkt af van GitHub-SHA: '+entry.path);
    }
    assertNotCancelled(signal);
    return new File([bytes],entry.name,{type:'application/octet-stream'});
  }
  function verifyManifest(entries,manifest,cfg) {
    if(!Array.isArray(manifest?.dataFiles))return null; // Legacy or external GitHub source.
    if(!manifest.dataFiles.length)throw Error('Het GitHub-manifest bevat geen bronbestanden.');
    const expected=new Map();
    for(const source of manifest.dataFiles){
      if(!source||typeof source.path!=='string'||!source.path||source.path.includes('..')||source.path.startsWith('/'))throw Error('Ongeldig pad in manifest.');
      const path=cfg.folder+'/'+source.path;
      if(expected.has(path))throw Error('Dubbele bronverwijzing in manifest: '+source.path);
      if(!/^[a-f0-9]{40}$/i.test(source.sha||''))throw Error('Geen controleerbare GitHub-SHA voor '+source.path);
      expected.set(path,source);
    }
    if(entries.length!==expected.size)throw Error('GitHub bevat '+entries.length+' bronbestanden, maar het manifest vermeldt '+expected.size+'. Synchronisatie gestopt.');
    for(const entry of entries){
      const source=expected.get(entry.path);
      if(!source)throw Error('Niet-geregistreerd bronbestand in GitHub: '+entry.path);
      if(source.sha!==entry.sha)throw Error('Bronbestand '+source.path+' wijkt af van het manifest. Werk eerst manifest.json bij.');
    }
    return manifest.dataFiles;
  }
  function verifyCounts(spec){
    if(!spec)return;
    const mapping={apps:'apps',ai:'ai',connections:'connections',checks:'checks',parts:'parts',dpia:'dpia',aiControls:'aiControls',devices:'devices',hardwareGroups:'hardwareGroups',additionalCandidates:'candidates',licenseReview:'licenseReview',workActions:'workActions',softwareReview:'softwareReview',faqs:'faqs',sourceRegister:'sourceRegister'};
    const totals=new Map();
    for(const entry of spec){
      for(const [kind,n] of Object.entries(entry.recordCounts||{})){
        if(!(kind in mapping))throw Error('Onbekend register in manifest: '+kind);
        if(!Number.isSafeInteger(n)||n<0)throw Error('Ongeldig aantal '+kind+' in manifest.');
        totals.set(kind,(totals.get(kind)||0)+n);
      }
    }
    for(const [kind,n] of totals){
      const actual=state[mapping[kind]] instanceof Map?state[mapping[kind]].size:0;
      if(actual!==n)throw Error('Controle van '+kind+' mislukt: '+actual+' ingelezen, '+n+' verwacht. Vorige gegevens worden hersteld.');
    }
  }
  function snapshotState() {
    const maps={};
    for(const k of ['apps','ai','connections','checks','devices','hardwareGroups','parts','dpia','aiControls','policyDocs','signals','candidates','licenseReview','workActions','softwareReview','faqs','sourceRegister'])maps[k]=new Map(state[k]);
    return {maps,sources:state.sources.slice(),docs:state.docs.slice(),derived:Array.isArray(state.derived)?state.derived.slice():[],ready:state.ready,view:state.view,metadata:state.metadata||null,sourceRegisterLoaded:state.sourceRegisterLoaded===true,sourceMode:state.sourceMode,githubVerification:state.githubVerification};
  }
  function restoreState(backup) {
    for(const [name,value] of Object.entries(backup.maps))state[name]=value;
    state.sources=backup.sources;
    state.docs=backup.docs;
    state.derived=backup.derived;
    state.ready=backup.ready;
    state.view=backup.view;
    state.metadata=backup.metadata;
    state.sourceRegisterLoaded=backup.sourceRegisterLoaded;state.sourceMode=backup.sourceMode;state.githubVerification=backup.githubVerification;
    renderAll();
  }
  function resetWorkingState() {
    for(const name of ['apps','ai','connections','checks','devices','hardwareGroups','parts','dpia','aiControls','policyDocs','signals','candidates','licenseReview','workActions','softwareReview','faqs','sourceRegister']){if(state[name] instanceof Map)state[name].clear();else state[name]=new Map();}
    state.sources=[];state.docs=[];state.derived=[];state.ready=false;state.metadata=null;state.sourceRegisterLoaded=false;
  }
  async function verifyProfileDocuments(files,profile,cfg,spec){
    if(!canonicalFor(profile,cfg))return null;
    const documents=new Map();
    for(const [type,filename] of Object.entries(profile.source.registerFiles)){
      if(!documents.has(filename)){
        const downloaded=files.find(item=>item.entry.path===cfg.folder+'/'+filename);
        if(!downloaded)throw Error('Verplicht bronbestand ontbreekt voor dit organisatieprofiel: '+filename);
        documents.set(filename,JSON.parse(await downloaded.file.text()));
      }
      const document=documents.get(filename);
      if(document?.schema!=='eai-school-ict-v1'||!Array.isArray(document[type]))throw Error('Verplicht register '+type+' ontbreekt in '+filename+'.');
    }
    if(!spec)throw Error('Verplicht manifest ontbreekt voor het organisatieprofiel.');
    const expected=profile.source.registerFiles;
    if(spec.length!==documents.size)throw Error('Manifest bevat niet exact de verplichte bronbestanden.');
    for(const entry of spec){
      const doc=documents.get(entry.path);
      if(!doc)throw Error('Onbekend bronbestand: '+entry.path);
      const types=Object.keys(expected).filter(type=>expected[type]===entry.path).sort();
      if(JSON.stringify(Object.keys(entry.recordCounts||{}).sort())!==JSON.stringify(types))throw Error('Manifestregisters wijken af van het profiel: '+entry.path);
      for(const type of types){
        if(entry.recordCounts[type]!==doc[type].length)throw Error('Bronaantal wijkt af van manifest: '+type);
        const ids=new Set();for(const record of doc[type]){if(!record||typeof record.id!=='string'||!record.id.trim()||ids.has(record.id))throw Error('Ongeldige of dubbele registratie-ID: '+type);ids.add(record.id);}
      }
      for(const key of Object.keys(doc))if(Array.isArray(doc[key])&&key!=='sources'&&!types.includes(key))throw Error('Niet gekoppeld bronregister: '+key+' in '+entry.path);
    }
    return documents;
  }
  function verifyImported(profile,documents){
    const api=window.IctInventoryIndex;if(!api)throw Error('Centrale index ontbreekt.');
    const ix=api.build(state);if(ix.errors.length)throw Error('Centrale index bevat ongeldige registraties of relaties: '+ix.errors[0].code);
    let records=0;
    for(const [type,filename] of Object.entries(profile.source.registerFiles)){
      const rows=documents.get(filename)[type];records+=rows.length;
      if(ix.count(type)!==rows.length)throw Error('Index mist registraties: '+type);
      for(const row of rows){const loaded=ix.get(type,row.id);if(!loaded||JSON.stringify(loaded.record)!==JSON.stringify(row))throw Error('Registratie of velden ontbreken na import: '+type+'/'+row.id);}
    }
    return records;
  }
  async function syncGitHub({automatic=false}={}) {
    if(busy)return;
    let token='';let files=[];let cfg,profile;
    busy=true;abort=new AbortController();
    try {
      if(window.IctOrganisation)profile=await window.IctOrganisation.ready;
      cfg=validInput();
      token=$('githubToken').value.trim();
      const canonical=canonicalFor(profile,cfg);
      $('githubSyncStart').disabled=true;
      $('githubSyncCancel').hidden=false;
      $('githubSyncSummary').hidden=true;
      showStatus('GitHub-map controleren…');
      // Pin one commit before listing or reading any source file.
      let revision=cfg.ref;
      if(canonical){const commit=await githubJson(endpoint(cfg,'commits/'+encodeURIComponent(cfg.ref)),token,abort.signal);if(!/^[a-f0-9]{40}$/.test(commit.sha||''))throw Error('GitHub geeft geen geldige commitversie.');revision=commit.sha;}
      const entries=await listFiles({...cfg,ref:revision},token,abort.signal,canonical);
      assertNotCancelled(abort.signal);
      let manifestMetadata=null,manifestSpec=null;
      if(entries.manifest){const manifestFile=await downloadFile(cfg,entries.manifest,token,abort.signal,canonical);const manifest=JSON.parse(await manifestFile.text());assertNotCancelled(abort.signal);if(manifest.schema!=='eai-school-ict-manifest-v1'||!manifest.metadata||typeof manifest.metadata!=='object')throw Error('Ongeldig metadata-bestand in GitHub.');manifestMetadata=manifest.metadata;manifestSpec=verifyManifest(entries,manifest,cfg);}
      if(!entries.length){await verifyProfileDocuments([],profile,cfg,manifestSpec);if(manifestMetadata){state.metadata=manifestMetadata;renderAll();}showStatus('GitHub is bereikbaar en de metadata zijn gelezen. Er staan nog geen applicatiebronnen in '+cfg.folder+'.','warning');return;}
      // Always reapply the selected GitHub revision. A local import may have changed
      // the dashboard since the last sync even when the remote file SHAs are unchanged.
      for(let i=0;i<entries.length;i++) {
        const entry=entries[i];
        showStatus('Bestanden ophalen: '+(i+1)+' van '+entries.length+' · '+entry.name);
        const file=await downloadFile(cfg,entry,token,abort.signal,canonical);
        assertNotCancelled(abort.signal);
        files.push({file,entry});
      }
      // Only after ALL downloads succeed do we alter the current inventory.
      const documents=await verifyProfileDocuments(files,profile,cfg,manifestSpec);
      assertNotCancelled(abort.signal);
      const replacing=canonical||$('githubReplace').checked;
      const safeRefresh=state.sourceMode==='github'||(automatic&&state.sourceMode==='snapshot');
      if(replacing&&state.ready&&!safeRefresh&&!confirm('Het huidige overzicht in de browser vervangen door de GitHub-bestanden? Een eerder lokaal bewaarde momentopname blijft bestaan.')){
        showStatus('Synchronisatie geannuleerd. Het bestaande overzicht is behouden.','warning');return;
      }
      assertNotCancelled(abort.signal);
      const backup=snapshotState();
      try {
        if(replacing)resetWorkingState();
        if(manifestMetadata)state.metadata=manifestMetadata;
        for(let i=0;i<files.length;i++) {
          assertNotCancelled(abort.signal);
          const {file,entry}=files[i];
          showStatus('Gegevens verwerken: '+(i+1)+' van '+files.length+' · '+entry.name);
          const before=state.sources.length;
          await importOneFile(file);
          assertNotCancelled(abort.signal);
          for(const record of state.sources.slice(before)){
            record.githubRemote={repository:cfg.repo,ref:cfg.ref,path:entry.path,sha:entry.sha};
            if(canonical)record.githubRemote.commit=revision;
            record.info=(record.info?record.info+' · ':'')+'GitHub: '+cfg.repo+' / '+entry.path+' @ '+cfg.ref+' · '+entry.sha.slice(0,8);
          }
        }
        assertNotCancelled(abort.signal);
        if(replacing)verifyCounts(manifestSpec);
        const records=canonical?verifyImported(profile,documents):0;
        if(manifestMetadata)state.metadata=manifestMetadata;
        state.sourceMode=canonical?'github':'external';
        state.githubVerification=canonical?{commit:revision,version:manifestMetadata.dataVersion||'',files:files.length,registers:Object.keys(profile.source.registerFiles).length,records,checkedAt:new Date().toISOString()}:null;
        state.ready=state.apps.size+state.connections.size+state.ai.size+state.checks.size+state.signals.size+state.devices.size+state.parts.size+state.sourceRegister.size>0||!!state.githubVerification?.records;
        buildDerived();
        // After a completed import, show the usable overview rather than the dashboard editor.
        state.view=(state.view==='sources'||state.view==='studio'||state.view==='overview')?'overview':state.view;
        renderAll();
        assertNotCancelled(abort.signal);
      }catch(error){restoreState(backup);if(error.name==='AbortError')throw error;throw Error('Gegevens niet bijgewerkt: '+error.message);}
      const date=new Date().toLocaleString('nl-NL');
      const verified=state.githubVerification;
      const msg=verified?verified.files+' bestanden · '+verified.registers+' registers · '+verified.records+' registraties gecontroleerd. Versie '+verified.version+' · commit '+verified.commit.slice(0,12)+' · '+date:files.length+' GitHub-bestanden geladen ('+date+'). Andere bron; niet de gecontroleerde schoolinventaris.';
      $('githubSyncSummary').hidden=false;
      $('githubSyncSummary').textContent=msg;
      showStatus('Synchronisatie geslaagd. '+files.length+' bestanden ingelezen'+(manifestSpec&&replacing?' en aantallen gecontroleerd met manifest.json':'')+'.','success');
      toast('GitHub-gegevens ingelezen. Er is niets naar GitHub geüpload.');
    }catch(error){
      if(error.name==='AbortError')showStatus('Synchronisatie afgebroken. Het bestaande overzicht is behouden.','warning');
      else showStatus('Synchronisatie niet gelukt: '+error.message,'error');
    }finally{
      $('githubToken').value=''; token='';files=[];busy=false;abort=null;
      $('githubSyncStart').disabled=false;
      $('githubSyncCancel').hidden=true;
    }
  }
  let initialGitHubLoadStarted=false;
  document.addEventListener('ict-scan:local-restored',()=>{
    if(initialGitHubLoadStarted)return;
    initialGitHubLoadStarted=true;
    return syncGitHub({automatic:true});
  });
  $('githubSyncStart').addEventListener('click',syncGitHub);
  $('githubSyncCancel').addEventListener('click',()=>{if(abort)abort.abort();});
  $('topGithubSync').addEventListener('click',()=>{selectView('sources');window.EmmausScenes?.show('sources',0,false);void syncGitHub();});
  $('githubLiveStatus')?.addEventListener('click',()=>{selectView('sources');window.EmmausScenes?.show('sources',0,false);});
})();
