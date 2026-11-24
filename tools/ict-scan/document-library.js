/* Juridische documentbibliotheek; dezelfde bronbestanden, geen extra register of model.
   Officiele wetsteksten worden op GitHub gelezen. Beschermde voorbeelden blijven
   bij de rechthebbende en kunnen alleen door de bezoeker lokaal worden bekeken. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id);
  const FILES='tools/ict-scan/docs/';
  const API='https://api.github.com/repos/E-AI-MODEL/website/contents/';
  const allowedHosts=new Set(['eur-lex.europa.eu','wetten.overheid.nl','normenkaderibp.kennisnet.nl','www.nen.nl']);
  let documents=[],catalogPromise=null,opened=null,previousFocus=null,sections=[],loaded=new Map(),localFiles=new Map(),reading='';
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const node=(tag,cls,label)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(label!==undefined)x.textContent=String(label);return x;};
  function status(message){if(el('docLibraryStatus'))el('docLibraryStatus').textContent=message;}
  // Public legal sources are separate from the four school JSON registers.
  // Resolve one release commit per catalogue session; no token, no local data sent.
  let revision=null, revisionPromise=null;
  async function ref(){
    if(revision)return revision;
    if(!revisionPromise)revisionPromise=fetch('https://api.github.com/repos/E-AI-MODEL/website/commits/main',{cache:'no-store',credentials:'omit',redirect:'error',headers:{Accept:'application/vnd.github+json'}})
      .then(async response=>{if(!response.ok)throw Error('GitHub-versie niet beschikbaar ('+response.status+').');const data=await response.json();if(!/^[a-f0-9]{40}$/.test(data.sha||''))throw Error('Onbekende GitHub-versie.');return revision=data.sha;})
      .catch(error=>{revisionPromise=null;throw error;});
    return revisionPromise;
  }
  async function readGit(path,sha){
    if(!new RegExp('^'+FILES.replaceAll('/','\\/')+'[a-z0-9._-]+\\.(?:txt|json)$').test(path))throw Error('Dit documentpad is niet toegestaan.');
    const url=API+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(await ref());
    const response=await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error',headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw Error('Document niet beschikbaar in de gekozen GitHub-versie ('+response.status+').');
    const data=await response.json();
    if(data.encoding!=='base64'||typeof data.content!=='string'||data.size>1000000)throw Error('Onleesbare of te grote GitHub-bron.');
    if(sha&&sha!==data.sha)throw Error('De documentversie wijkt af van de gecontroleerde catalogus.');
    const binary=atob(data.content.replace(/\s+/g,''));
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(bytes.length!==data.size)throw Error('Onvolledige documentinhoud.');
    if(sha){
      if(!globalThis.crypto?.subtle)throw Error('Broncontrole vereist HTTPS.');
      const prefix=new TextEncoder().encode('blob '+bytes.length+'\0');
      const input=new Uint8Array(prefix.length+bytes.length);input.set(prefix);input.set(bytes,prefix.length);
      const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',input)),x=>x.toString(16).padStart(2,'0')).join('');
      if(actual!==sha)throw Error('Documentinhoud wijkt af van de bronvingerafdruk.');
    }
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }
  function validDocument(item){
    if(!item||!(/^[A-Z][A-Z0-9-]{1,30}$/).test(item.id||'')||!item.title||!item.group||!item.url)return false;
    try{const u=new URL(item.url);if(u.protocol!=='https:'||!allowedHosts.has(u.hostname))return false;}catch(_){return false;}
    if(item.availability==='bundled')return !!(item.path?.startsWith(FILES)&&/^[a-f0-9]{40}$/.test(item.blobSha||''));
    return item.availability==='external'&&!item.path;
  }
  async function catalog(){
    if(catalogPromise)return catalogPromise;
    catalogPromise=readGit(FILES+'catalog.json').then(value=>{
      const file=JSON.parse(value);
      if(file.schema!=='eai-ict-document-catalog-v1'||!Array.isArray(file.documents)||file.repo!=='E-AI-MODEL/website')throw Error('Onjuist documentenregister.');
      if(file.documents.some(item=>!validDocument(item)))throw Error('Een documentverwijzing is ongeldig.');
      const ids=file.documents.map(x=>x.id);
      if(new Set(ids).size!==ids.length)throw Error('Dubbele document-ID in catalogus.');
      documents=file.documents;
      listDocuments();
      status(documents.length+' documenten gevonden · '+documents.filter(x=>x.availability==='bundled').length+' volledige wetsteksten in GitHub.');
      return documents;
    }).catch(error=>{catalogPromise=null;status('Documenten niet geladen: '+error.message);throw error;});
    return catalogPromise;
  }
  function listDocuments(){
    const area=el('docLibraryList');if(!area)return;
    const q=norm(el('docLibrarySearch')?.value||'').trim(),filter=el('docLibraryType')?.value||'';
    const visible=documents.filter(d=>(!filter||d.group===filter)&&(!q||norm([d.title,d.group,d.type,d.note,d.frameworkId,...(d.tags||[])].join(' ')).includes(q)));
    area.replaceChildren();
    for(const d of visible){
      const row=node('div','doc-catalog-row'),content=node('div','doc-catalog-info');
      content.append(node('small','doc-catalog-category',d.group+' · '+d.id),node('strong','',d.title),node('span','',d.availability==='bundled'?'Volledige tekst beschikbaar · '+d.version:'Origineel document bij '+d.publisher+' · lokaal te openen'));
      const b=node('button','doc-catalog-open',d.availability==='bundled'?'Lees document':'Bekijk document');
      b.type='button';b.addEventListener('click',()=>void open(d.id));
      row.append(content,b);area.append(row);
    }
    if(!visible.length)area.append(node('p','doc-catalog-empty','Geen documenten bij deze zoekopdracht.'));
    const n=el('docLibraryCount');if(n)n.textContent=visible.length+' van '+documents.length;
  }
  function showText(raw){
    reading=String(raw||'');
    const parent=el('docSections'),jump=el('docArticleJump'),q=el('docArticleSearch');
    parent.replaceChildren();jump.replaceChildren();sections=[];
    const pattern=/^(?:#{1,5}\s*)?(Artikel[\s\u00a0]+\d+[a-z]?(?:\.[^\n]*)?|BIJLAGE[\s\u00a0]+[IVX]+(?:[^\n]*)?)[\s\u00a0]*$/gmi;
    const matches=[...reading.matchAll(pattern)];
    const pieces=matches.length?matches.map((m,i)=>({title:m[1].trim(),text:reading.slice(m.index,i+1<matches.length?matches[i+1].index:reading.length)})):[{title:'Volledige tekst',text:reading}];
    if(matches.length&&matches[0].index>0)pieces.unshift({title:'Inleiding en brondocument',text:reading.slice(0,matches[0].index)});
    for(const [i,piece] of pieces.entries()){
      const section=node('section','doc-law-section');section.dataset.anchor=String(i);
      const h=node('h3','',piece.title);
      const pre=node('pre','doc-law-text',piece.text.trim());
      section.append(h,pre);parent.append(section);
      const opt=node('option','',piece.title.slice(0,105));opt.value=String(i);jump.append(opt);
      sections.push({node:section,text:norm(piece.text)});
    }
    jump.hidden=pieces.length<2;q.value='';
    el('docArticleStats').textContent=pieces.length+' onderdelen. Zoek in de tekst of spring naar een artikel.';
    el('docArticleScroll').scrollTop=0;
  }
  function findWithin(){
    const q=norm(el('docArticleSearch').value).trim();
    let hits=0;
    for(const part of sections){const show=!q||part.text.includes(q);part.node.hidden=!show;if(show)hits++;}
    el('docArticleStats').textContent=q?hits+' tekstonderdelen met "'+el('docArticleSearch').value.trim()+'".':sections.length+' onderdelen in de volledige tekst.';
  }
  function chooseFile(){
    if(!opened)return;
    el('docLocalFile').value='';
    el('docLocalFile').click();
  }
  async function importLocal(file){
    if(!opened||!file)return;
    const selected=opened;
    if(file.size>15000000)throw Error('Bestand is groter dan 15 MB. Kies een kleinere versie.');
    const ext=file.name.split('.').pop().toLowerCase();
    if(ext==='pdf'){
      const old=localFiles.get(opened.id);if(old?.url)URL.revokeObjectURL(old.url);
      localFiles.set(opened.id,{kind:'pdf',url:URL.createObjectURL(file),name:file.name});
      showExternal(opened);
      return;
    }
    let body='';
    if(ext==='docx')body=await extractDocx(await file.arrayBuffer());
    else if(ext==='txt'||ext==='md')body=await file.text();
    else throw Error('Kies een DOCX, PDF of TXT-document.');
    if(!body.trim())throw Error('Het bestand bevat geen leesbare tekst.');
    if(opened!==selected)return;
    localFiles.set(selected.id,{kind:'text',text:body,name:file.name});
    showText(body);
    el('docReaderStatus').textContent='Lokaal gelezen: '+file.name+'. Niets verzonden of gepubliceerd.';
  }
  function showExternal(d){
    const local=localFiles.get(d.id);
    el('docSections').replaceChildren();el('docArticleJump').replaceChildren();
    el('docArticleSearch').value='';el('docArticleJump').hidden=true;
    sections=[];
    const body=el('docSections');
    body.append(node('p','doc-external-notice',d.note));
    body.append(node('p','doc-external-notice','Van dit document is geen kopie in de openbare ICT-scan opgenomen. Open het oorspronkelijke bestand bij de uitgever of kies je eigen exemplaar om het alleen op dit apparaat te lezen.'));
    if(local?.kind==='text'){showText(local.text);el('docReaderStatus').textContent='Lokaal gelezen: '+local.name+'. Niet geüpload.';}
    else if(local?.kind==='pdf'){
      const a=node('a','doc-original-link','Open lokale PDF');
      a.href=local.url;a.target='_blank';a.rel='noopener noreferrer';body.append(a);
      el('docReaderStatus').textContent='PDF geselecteerd. Open de lokale PDF in de browser; tekst doorzoeken is niet beschikbaar.';
    }else el('docReaderStatus').textContent='Document bij de uitgever · geen herpublicatie.';
    el('docArticleStats').textContent=local?.kind==='text'?'Doorzoek de ingelezen tekst.':'Het oorspronkelijke document staat bij de uitgever.';
  }
  async function display(d){
    opened=d;el('docReaderTitle').textContent=d.title;
    el('docReaderMeta').textContent=d.type+' · '+d.publisher+' · '+d.version;
    const link=el('docOfficialUrl');link.href=d.url;link.textContent=d.availability==='bundled'?'Actuele officiële bron openen':'Origineel bij uitgever openen';
    el('docLocalChoice').hidden=d.availability==='bundled';
    el('docReaderStatus').textContent='Bron wordt ingelezen...';
    el('docSections').replaceChildren();el('docArticleJump').replaceChildren();
    if(d.availability!=='bundled'){showExternal(d);return;}
    const key=revision+'/'+d.id+'/'+d.blobSha;
    try{
      const body=loaded.has(key)?loaded.get(key):await readGit(d.path,d.blobSha);
      if(opened!==d||el('docDialog').hidden)return;
      loaded.set(key,body);
      if((d.id==='AVG'&&!body.includes('Artikel 99'))||(d.id==='AIACT'&&!body.includes('Artikel 113'))||(d.id==='UAVG'&&!body.includes('Artikel 54')))throw Error('De volledige documenttekst is niet aantoonbaar beschikbaar.');
      showText(body);
      el('docReaderStatus').textContent='Volledige bronmomentopname · '+d.snapshotAt+'. '+d.note;
    }catch(error){if(opened===d&&!el('docDialog').hidden)el('docReaderStatus').textContent='Document niet geladen: '+error.message;}
  }
  async function open(docId){
    const dialog=el('docDialog'),scrim=el('docScrim');
    if(!dialog||!scrim)return;
    previousFocus=document.activeElement;
    scrim.hidden=false;dialog.hidden=false;
    el('docReaderTitle').textContent='Documenten';
    el('docReaderMeta').textContent='Bronnen worden gecontroleerd...';
    opened=null;sections=[];el('docSections').replaceChildren();el('docArticleJump').replaceChildren();el('docLocalChoice').hidden=true;
    el('docReaderStatus').textContent='Documentenregister laden...';
    el('docDialogClose').focus();
    try{
      const docs=await catalog();
      if(!docs.length)throw Error('Geen documenten in de catalogus.');
      if(dialog.hidden)return;
      const selected=docId?(docs.find(d=>d.id===docId)||docs.find(d=>d.frameworkId===docId)):docs[0];
      if(!selected)throw Error('Geen brondocument gekoppeld aan deze norm.');
      await display(selected);
    }catch(error){el('docReaderStatus').textContent='Bibliotheek niet beschikbaar: '+error.message;}
  }
  function close(){
    el('docDialog').hidden=true;el('docScrim').hidden=true;opened=null;
    if(previousFocus?.isConnected)previousFocus.focus();
  }
  for(const button of ['docLibraryOpen','docOpenFromPrivacy']){
    el(button)?.addEventListener('click',()=>void open());
  }
  el('docLibrarySearch')?.addEventListener('input',listDocuments);
  el('docLibraryType')?.addEventListener('change',listDocuments);
  el('docDialogClose')?.addEventListener('click',close);
  el('docScrim')?.addEventListener('click',close);
  el('docArticleSearch')?.addEventListener('input',findWithin);
  el('docArticleJump')?.addEventListener('change',()=>{
    const n=el('docSections').querySelector('[data-anchor="'+el('docArticleJump').value+'"]');
    if(n){for(const s of sections)s.node.hidden=false;n.scrollIntoView({block:'start',behavior:'smooth'});}
  });
  el('docLocalChoice')?.addEventListener('click',chooseFile);
  el('docLocalFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)void importLocal(f).catch(error=>el('docReaderStatus').textContent=error.message);});
  el('docDialog')?.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Tab'){
      const focusable=[...el('docDialog').querySelectorAll('button:not([hidden]),input:not([hidden]),select:not([hidden]),a[href]')].filter(x=>!x.disabled&&x.offsetParent!==null);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  // Geen verborgen netwerkverzoeken bij openen van de ICT-scan. De bibliotheek
  // wordt pas op verzoek geladen, zodat bestaande GitHub-sync en browserproeven
  // dezelfde routevolgorde behouden.
  el('docLibrarySearch')?.addEventListener('focus',()=>void catalog().catch(()=>{}));
  el('docLibraryType')?.addEventListener('focus',()=>void catalog().catch(()=>{}));
  window.EmmausDocs=Object.freeze({open,refresh:()=>catalog(),known:()=>documents.map(d=>({id:d.id,availability:d.availability}))});
})();

