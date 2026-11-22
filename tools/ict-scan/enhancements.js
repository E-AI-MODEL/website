'use strict';
/* Dashboard UI. No uploads, analytics, external scripts or implicit persistence. */
viewNames.privacy='FG | DPIA-bronnen';
viewNames.reports='Rapporten';
viewTitles.privacy='FG | DPIA-bronnen en privacy';
viewTitles.reports='Rapportages op maat';
sectionTexts.privacy='Aangeleverde bronnen voor het onafhankelijke advies en toezicht van de FG. Geen FG-oordeel of DPIA van deze scan.';
sectionTexts.reports='Kies een onderwerp. Elke export gebruikt alleen de ingelezen gegevens.';
state.overviewArea='';
state.overviewKind='';
state.chartMode='bars';
state.reportScope='all';

function ringChart(target, entries, selected, onSelect){
  const parent=$(target); if(!parent)return;
  const groups=entries.filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,7);
  if(!groups.length){parent.innerHTML='<div class="no-results">Nog geen gegevens voor deze weergave.</div>';return;}
  const colors=['#212d5c','#de9526','#596bb0','#90a5ce','#f0c985','#8393ab','#d5dce9'];
  const sum=groups.reduce((n,e)=>n+e[1],0);let acc=0;
  const slices=groups.map((e,i)=>{const start=acc/sum*360;acc+=e[1];return `${colors[i]} ${start.toFixed(3)}deg ${(acc/sum*360).toFixed(3)}deg`;});
  parent.classList.add('ring-layout');
  parent.innerHTML='<div class="ring" style="background:conic-gradient('+slices.join(',')+')"><div><strong>'+sum+'</strong><span>geregistreerd</span></div></div><div class="ring-legend">'+groups.map(([name,n],i)=>'<button type="button" data-ring-index="'+i+'" class="ring-legend-row'+(selected===name?' selected':'')+'"><span class="ring-legend-dot" style="background:'+colors[i]+'"></span><span title="'+esc(name)+'">'+esc(name)+'</span><strong>'+n+'</strong></button>').join('')+'</div>';
  parent.querySelectorAll('[data-ring-index]').forEach(el=>el.addEventListener('click',()=>onSelect(groups[+el.dataset.ringIndex][0])));
}
function reportStatusText(){return state.sources.length ? `${state.sources.length} brononderdelen ingelezen` : 'Nog geen bronnen ingelezen';}
const originalRenderOverview=renderOverview;
renderOverview=function(){
  originalRenderOverview();
  const apps=array(state.apps), links=array(state.connections), ai=array(state.ai), checks=array(state.checks);
  const areas=[...new Set(apps.map(x=>x.area).filter(Boolean))],kinds=[...new Set(apps.map(x=>x.kind).filter(Boolean))];
  fillSelect('overviewArea',areas,state.overviewArea);fillSelect('overviewKind',kinds,state.overviewKind);
  state.overviewArea=$('overviewArea').value;state.overviewKind=$('overviewKind').value;
  const shown=apps.filter(a=>(!state.overviewArea||a.area===state.overviewArea)&&(!state.overviewKind||a.kind===state.overviewKind));
  const filtered=shown.length!==apps.length;
  $('overviewResultCount').textContent=filtered?`${shown.length} van ${apps.length} onderdelen`:`${apps.length} onderdelen in de inventaris`;
  $('overviewClear').disabled=!state.overviewArea&&!state.overviewKind;
  const hasAi=new Set(); for(const a of ai){if(a.product)hasAi.add(normalize(a.product));}
  const relevantAi=ai.filter(a=>shown.some(p=>normalize(p.name)===normalize(a.product)||normalize(p.name).includes(normalize(a.product||'~unlikely~'))));
  $('kpiGrid').innerHTML=kpi('Toepassingen en diensten',shown.length,filtered?'Binnen de geselecteerde categorie':'Geregistreerd, gebruik niet overal vastgesteld')+
    kpi('Met beschreven AI',filtered?shown.filter(a=>hasAi.has(normalize(a.name))).length:aiAppsCount(),'Toepassingen met een of meer AI-functies')+
    kpi('AI-functies',filtered?relevantAi.length:ai.length,'Functies binnen bestaande toepassingen')+
    kpi('Entra-koppelingen',links.length,'Technische registraties, niet automatisch actief');
  const change=(field,v)=>{state[field]=state[field]===v?'':v;renderOverview();};
  for(const id of ['areaChart','typeChart'])$(id).classList.remove('ring-layout');
  const left=groupCounts(shown,'area'),right=groupCounts(shown,'kind');
  if(state.chartMode==='ring'){
    ringChart('areaChart',left,state.overviewArea,v=>change('overviewArea',v));
    ringChart('typeChart',right,state.overviewKind,v=>change('overviewKind',v));
  }else{
    barChart('areaChart',left,9,v=>change('overviewArea',v));
    barChart('typeChart',right,9,v=>change('overviewKind',v));
  }
  // Independent chart modes are handled by visual-explorer.js.
  const cover=[['Verantwoordelijke vastgelegd',shown.filter(x=>!hasUnknown(x.owner)).length,shown.length],['Gebruik op school bevestigd',shown.filter(x=>!hasUnknown(x.local)).length,shown.length],['Gegevensuitwisseling beschreven',shown.filter(x=>!hasUnknown(x.links)).length,shown.length],['Lokale AI-instellingen bekend',ai.filter(x=>!hasUnknown(x.local)).length,ai.length]];
  $('coverage').innerHTML=cover.map(([label,n,total])=>'<div class="coverage-row"><span class="coverage-name">'+esc(label)+'</span><b>'+n+' / '+total+'</b><div class="coverage-progress"><div style="width:'+(total?Math.min(100,n/total*100):0)+'%"></div></div></div>').join('');
  $('overviewApps').innerHTML='<div class="preview-rows">'+(shown.length?shown.slice(0,9).map(x=>'<button type="button" class="preview-row" data-quick-app="'+esc(x.id)+'"><span>'+esc(x.id)+'</span><strong>'+esc(x.name)+'</strong><small>'+esc(x.area||x.kind||'')+'</small></button>').join(''):'<div class="no-results">Geen resultaten voor deze filters.</div>')+'</div>';
  $('overviewApps').querySelectorAll('[data-quick-app]').forEach(b=>b.addEventListener('click',()=>openRecord('apps',b.dataset.quickApp)));
};
function dataCard(label,number,desc){return '<div class="data-card"><small>'+esc(label)+'</small><strong>'+esc(number)+'</strong><span>'+esc(desc)+'</span></div>';}
function governanceRow(rec,kind){
  const fields=kind==='dpia' ? [['Beoordeling externe bron',rec.assessment],['Bewijsstatus',rec.evidence],['Onderzoek',rec.description],['Lokale toepassing',rec.local]] : [['Functie',rec.description],['Advies',rec.advice],['Status op school',rec.local],['Te verifiëren',rec.action]];
  return '<details class="governance-row"><summary><span><small>'+esc(rec.id||'BRON')+'</small><strong>'+esc(rec.name)+'</strong></span><span class="governance-status">'+esc(short(rec.assessment||rec.local||'Niet vastgesteld',42))+'</span></summary><div class="governance-body">'+fields.map(([l,v])=>'<div><small>'+esc(l)+'</small><p>'+esc(v||'Niet vastgesteld')+'</p></div>').join('')+'<div><small>Bronverwijzing</small><p>'+esc((rec.sources||[]).join('; ')||'Niet vastgelegd')+'</p></div></div></details>';
}
function renderPrivacy(){
  const dpia=array(state.dpia),admin=array(state.aiControls),ai=array(state.ai);
  const open=dpia.length; // Geen lokale bevestiging afgeleid uit externe bronnen.
  $('privacySummary').innerHTML=dataCard('DPIA-registraties',dpia.length,'Externe beoordelingen en bewijs')+dataCard('AI-beheerpunten',admin.length,'Inrichting en maatregelen')+dataCard('Lokaal te verifiëren',open,'Geen automatische lokale goedkeuring')+dataCard('AI-functies',ai.length,'Niet automatisch actief');
  $('privacyDpia').innerHTML=dpia.length?dpia.map(x=>governanceRow(x,'dpia')).join(''):'<div class="no-results">Nog geen DPIA-bronnen ingelezen.</div>';
  $('privacyControls').innerHTML=admin.length?admin.map(x=>governanceRow(x,'control')).join(''):'<div class="no-results">Nog geen AI-beheerregistratie ingelezen.</div>';
  $('privacyLegal').innerHTML=legalSources.map(x=>'<div class="legal-item"><div><strong>'+esc(x.name)+'</strong><p>'+esc(x.description)+'</p></div><a target="_blank" rel="noopener noreferrer" href="'+esc(x.url)+'">Bron openen</a></div>').join('');
}
const reportNames={all:['Volledige broninventaris','Bronregistraties, waaronder externe privacybronnen. Geen DPIA of FG-oordeel door deze scan.'],schoolbreed:['Applicatielandschap','Software, diensten en de onderliggende productstructuur.'],koppelingen:['Entra en toegang','Technische registraties, matches en ontbrekend bewijs.'],ai:['AI in het onderwijs','AI-functies per lesfase en AI in de schoolorganisatie.'],privacy:['FG | DPIA-bronnen','Bronvermeldingen ter ondersteuning van de FG, niet een eigen DPIA of goedkeuring.'],controles:['Controlepunten','Vastgelegde vragen, bronverwijzingen en aanvullende signalen.'],devices:['Apparaten en beheer','Apparaatrecords, meetdekking en grenzen van de huidige export.']};
function renderReports(){
  document.querySelectorAll('[data-report]').forEach(b=>{const selected=b.dataset.report===state.reportScope;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected?'true':'false');});
  const [title,desc]=reportNames[state.reportScope]||reportNames.all;
  $('reportPreviewTitle').textContent=title;
  $('reportPreviewDescription').textContent=desc;
  const counts={all:[['Toepassingen',state.apps.size],['AI-functies',state.ai.size],['Entra-koppelingen',state.connections.size],['Controles',state.checks.size]],schoolbreed:[['Toepassingen',state.apps.size],['Onderdelen',state.parts.size],['Apparaatmetingen',state.devices.size]],koppelingen:[['Entra-koppelingen',state.connections.size],['Te bevestigen matches',array(state.connections).filter(x=>!x.matched).length]],ai:[['AI-functies',state.ai.size],['Onderwijs',array(state.ai).filter(isClassroomAi).length],['Beheer',state.aiControls.size]],privacy:[['DPIA-onderwerpen',state.dpia.size],['AI-beheer',state.aiControls.size],['Toetsingsbronnen',legalSources.length]],devices:[['Apparaatmetingen',state.devices.size],['Entra-records',Number(String([...state.devices.values()].find(x=>/Entra apparaatrecords/i.test(x.name))?.quantity||'').match(/\d+/)?.[0]||0)],['Meetperiode','september 2026']],controles:[['Unieke controles',state.checks.size],['Aanvullende signalen',state.derived.length],['Bronregels',state.sources.filter(x=>x.kind==='controles').reduce((n,x)=>n+x.rows,0)]]};
  $('reportPreviewMeta').innerHTML=(counts[state.reportScope]||[]).map(([label,count])=>'<span><b>'+count+'</b> '+esc(label)+'</span>').join('');
  $('reportStamp').textContent=state.sources.length?reportStatusText():'Nog geen bronbestanden ingelezen';
  for(const id of ['reportExcel','reportPdf','reportJson'])$(id).disabled=!state.ready;
  $('saveLocal').disabled=!state.ready;
}
function scopedSheet(name,lead){const s=reportSheet(name);rtitle(s,'EMMAUSCOLLEGE  /  '+name.toUpperCase(),lead);return s;}
const baselineGenerateSheets=generateReportSheets;
function sheetsForScope(scope){
  if(scope==='all')return baselineGenerateSheets();
  if(scope==='schoolbreed')return baselineGenerateSheets().filter(s=>s.name==='Schoolbreed');
  if(scope==='ai')return baselineGenerateSheets().filter(s=>s.name==='AI in de klas'||s.name==='AI in de school');
  if(scope==='koppelingen'){
    const s=scopedSheet('Entra-koppelingen','Geregistreerde verbindingen met toepassingen en diensten. Aanwezigheid bewijst geen actief gebruik.');
    rkpis(s,[['ENTRA-REGISTRATIES',state.connections.size,'Niet automatisch actief'],['GEKOPPELD AAN TOEPASSING',array(state.connections).filter(x=>x.matched).length,'Mogelijke match, nog controleren'],['TOEPASSINGEN',state.apps.size,'Geregistreerde diensten'],['BRONNEN',state.sources.length,'Ingelezen brononderdelen']]);
    rsection(s,'REGISTER EN KOPPELINGEN');const h=rtableHeader(s,['ID','Naam','Enabled in export','Zichtbaarheid','Mogelijke toepassing','Bron']);
    for(const e of array(state.connections).sort((a,b)=>a.name.localeCompare(b.name,'nl')))rline(s,[e.id,e.name,e.enabled,e.visible,e.matched,(e.sources||[]).join('; ')],42);
    s.filter='A'+h+':F'+s.rows.length;return [s];
  }
  if(scope==='devices'){
    const s=scopedSheet('Apparaten en beheer','Technische apparaatrecords uit de aangeleverde export. Geen volledige, actuele telling van fysieke schoolapparaten.');
    rsection(s,'MEETGEGEVENS','Apparaatrecords en afzonderlijke meetwaarden niet optellen. Een onbekende compliancewaarde is niet gelijk aan False.');
    const h=rtableHeader(s,['ID','Metingen','Type','Waarde uit bron','Peildatum','Beschrijving','Beperking','Herkomst']);
    for(const x of state.devices.values())rline(s,[x.id,x.name,x.type,x.quantity,x.measurementDate,x.description,x.limitation,(x.sources||[]).join('; ')],68);
    s.filter='A'+h+':H'+s.rows.length;
    return [s];
  }
  if(scope==='privacy'){
    const s=scopedSheet('FG broninformatie','Verzamelde DPIA-onderwerpen voor FG-advies en onafhankelijk toezicht. Geen FG-oordeel of besluit door deze schoolscan.');
    rkpis(s,[['DPIA-BRONITEMS',state.dpia.size,'Brononderwerpen, geen uitgevoerde DPIAs'],['PRIVACYBRONNEN',legalSources.length,'Actuele versies controleren'],['FG-ADVIES','Niet aangeleverd','Niet beoordeeld door deze scan'],['BESLUIT GEZAG','Niet aangeleverd','Bevoegd gezag blijft verantwoordelijk']]);
    rsection(s,'DPIA EN ONDERBOUWING');for(const x of state.dpia.values()){rgroup(s,x.id,x.name,x.assessment);rdetail(s,'Status volgens bron',x.assessment,true);rdetail(s,'Beschrijving',x.description,true);rdetail(s,'Lokaal',x.local,true);rdetail(s,'Bron',(x.sources||[]).join('; '),true);}
    rsection(s,'WETGEVING EN BRONNEN');for(const x of legalSources){rgroup(s,'BRON',x.name,x.url);rdetail(s,'Onderwerp',x.description,true);}return [s];
  }
  if(scope==='controles'){
    const s=scopedSheet('Controles','Onzekerheden en ontbrekende informatie. Een controlepunt is niet vanzelf een vastgesteld probleem.');
    const all=allFindings();rkpis(s,[['UNIEKE CONTROLE-ID',all.length,'Bronregels kunnen dubbele ID hebben'],['AANVULLENDE SIGNALEN',state.derived.length,'Automatisch vastgesteld ontbrekend bewijs'],['BRONONDERDELEN',state.sources.length,'Herkomst vastgelegd'],['APPLICATIES',state.apps.size,'Context van de inventaris']]);
    rsection(s,'OVERZICHT PER ONDERWERP');rbar(s,rsummaryCounts(all,'category'),15);
    rsection(s,'CONTROLEPUNTEN');const h=rtableHeader(s,['ID','Onderwerp','Categorie','Prioriteit','Status','Wat controleren?','Bron']);for(const x of all)rline(s,[x.id,x.name,x.category,x.priority,x.status,x.explanation,(x.sources||[]).join('; ')],65);s.filter='A'+h+':G'+s.rows.length;
    rsection(s,'AANVULLENDE SIGNALEN');for(const x of state.derived){rgroup(s,x.id,x.name,x.category);rdetail(s,'Controle',x.explanation,true);}appendAssuranceRows(s);return[s];
  }
  return baselineGenerateSheets();
}
function scopedWorkbook(scope){
  const current=generateReportSheets;
  generateReportSheets=()=>sheetsForScope(scope);
  try{return createReportWorkbook();}finally{generateReportSheets=current;}
}
function exportScopedExcel(scope){if(!state.ready){toast('Voeg eerst bronbestanden toe.');return;}const name=scope==='all'?'nulmeting':scope;download('Emmauscollege_'+name+'_'+new Date().toISOString().slice(0,10)+'.xlsx',scopedWorkbook(scope));toast(reportNames[scope][0]+' als Excel gemaakt.');}
const baselinePdf=exportPdf;
function exportScopedPdf(scope){
  if(!state.ready){toast('Voeg eerst bronbestanden toe.');return;}
  if(scope==='all')return baselinePdf();
  const lead='<img class="print-logo" src="./emmaus-logo.svg" alt="Emmauscollege Rotterdam"><h1>'+esc(reportNames[scope][0])+'</h1><p>Emmauscollege · '+new Date().toLocaleDateString('nl-NL')+' · Gebaseerd op ingelezen bronnen. Onbekende informatie is niet als vastgesteld gemarkeerd.</p>';
  let body='';
  if(scope==='schoolbreed'){const apps=array(state.apps);body=printBarSection('Gebruik per schoolonderdeel','Aantal geregistreerde toepassingen en diensten.',rsummaryCounts(apps,'area'))+printBarSection('Technische indeling','Dezelfde toepassingen, een andere verdeling.',rsummaryCounts(apps,'kind'))+printTable('Toepassingen',['ID','Naam','Gebruik','Beschrijving'],apps.map(x=>[x.id,x.name,x.area,x.description]),200);}
  else if(scope==='koppelingen'){body='<p>Entra-koppelingen zijn technische registraties. Hun aanwezigheid zegt niets over actief gegevensverkeer.</p>'+printTable('Entra-koppelingen',['ID','Registratie','Status','Gekoppeld aan'],array(state.connections).map(x=>[x.id,x.name,x.enabled,x.matched]),200);}
  else if(scope==='ai'){const classroom=array(state.ai).filter(isClassroomAi),others=array(state.ai).filter(x=>IctScanTaxonomy.isSchoolAi(x));body=printBarSection('AI per lesfase','Een AI-functie kan in meer dan één lesfase vallen.',phaseBreakdown(classroom))+classroom.map(printFeature).join('')+'<div class="pagebreak"></div><h2>AI voor organisatie en beheer</h2>'+others.map(printFeature).join('');}
  else if(scope==='devices'){body='<p>Deze metingen zijn afkomstig uit september 2026. Het aantal Entra-records vormt geen volledige schoolbrede hardware-inventaris.</p>'+printTable('Apparaatmetingen',['ID','Onderwerp','Waarde','Peildatum','Beperking'],array(state.devices).map(x=>[x.id,x.name,x.quantity,x.measurementDate,x.limitation]),100);}
  else if(scope==='privacy'){body='<h2>FG | DPIA-bronnen</h2><p>Broninformatie voor FG-advies en toezicht. Dit rapport is geen DPIA, geen FG-oordeel en geen goedkeuring. Het bevoegd gezag blijft verantwoordelijk voor besluiten.</p>'+array(state.dpia).map(x=>printGovernanceItem(x,'dpia')).join('')+'<h2>Privacybronnen</h2>'+legalSources.map(x=>'<p>'+esc(x.name)+': '+esc(x.url)+'</p>').join('');}
  else if(scope==='controles'){const all=allFindings();body=printBarSection('Open punten naar onderwerp','Vastgelegde controles.',rsummaryCounts(all,'category'))+printTable('Open controles',['ID','Onderwerp','Wat controleren','Status'],all.map(x=>[x.id,x.name,x.explanation,x.status]),250);}
  $('printReport').innerHTML=lead+body+'<p class="print-end">Bronnen en beoordelingen moeten actueel worden gecontroleerd. Bedragen en boekingsregels worden niet opgenomen.</p>';
  window.print();
}
function openRecord(view,id){
  state.area='';state.type='';state.phase='';state.aiProduct='';
  if(view==='ai'){const r=state.ai.get(id);if(r)state.aiMode=isClassroomAi(r)?'klas':'school';}
  const searches={apps:'appsSearch',ai:'aiSearch',connections:'connectionsSearch',findings:'findingsSearch'};
  const selectId=searches[view];if(selectId){$(selectId).value=id;}
  selectView(view);
  const first=$('main').querySelector('.item-card .item-summary');if(first)first.click();
}
const originalRenderConnections=renderConnections;
function connectionState(x){
  const s=low(x.enabled);
  if(/true|enabled|ingeschakeld|ja/.test(s))return 'Ingeschakeld volgens export';
  if(/false|disabled|uitgeschakeld|nee/.test(s))return 'Uitgeschakeld volgens export';
  return 'Status onbekend';
}
renderConnections=function(){
  const all=array(state.connections),statusOptions=[...new Set(all.map(connectionState))];
  fillSelect('connectionsStatus',statusOptions);
  const selected=$('connectionsStatus').value,q=normalize($('connectionsSearch').value);
  const filtered=all.filter(x=>(!q||normalize([x.id,x.name,x.matched].join(' ')).includes(q))&&(!selected||connectionState(x)===selected));
  $('connectionsCount').textContent=filtered.length+' van '+all.length+' registraties';
  $('connectionStats').innerHTML=dataCard('Entra-koppelingen',all.length,'Geregistreerd')+dataCard('Mogelijke toepassingen',all.filter(x=>x.matched).length,'Matches nog controleren')+dataCard('Zonder match',all.filter(x=>!x.matched).length,'Nader identificeren');
  barChart('connectionChart',groupCounts(all.map(x=>({status:connectionState(x)})),'status'),5,label=>{const sel=$('connectionsStatus');sel.value=sel.value===label?'':label;renderConnections();});
  renderList('connectionsList',filtered.sort((a,b)=>a.name.localeCompare(b.name,'nl')),'connection',180);
};
const originalRenderFindings=renderFindings;
renderFindings=function(){
  originalRenderFindings();
  const current=state.findingMode==='registered'?allFindings():state.derived;
  barChart('findingsChart',groupCounts(current,'category'),9,label=>{const sel=$('findingsFilter');sel.value=sel.value===label?'':label;renderFindings();});
};
const originalSelectView=selectView;
selectView=function(view){
  originalSelectView(view);
  if(view==='privacy'||view==='reports'){
    $('view'+view[0].toUpperCase()+view.slice(1)).hidden=false;
    $('emptyState').hidden=true;
    if(view==='privacy')renderPrivacy();else renderReports();
  }
  $('main').scrollTop=0;
  document.querySelectorAll('.rail-button[data-view],.work-tab[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
};
function renderGlobalSuggestions(){
  if(window.EmmausAnswerEngine)return window.EmmausAnswerEngine.render();
  const q=normalize($('globalSearch').value),host=$('globalResults');
  if(q.length<2){host.hidden=true;host.replaceChildren();return;}
  const sections=[['Toepassingen','apps',array(state.apps),x=>[x.id,x.name,x.description]],['AI-functies','ai',array(state.ai),x=>[x.id,x.name,x.product,x.action]],['Entra-koppelingen','connections',array(state.connections),x=>[x.id,x.name,x.matched]],['Controles','findings',allFindings(),x=>[x.id,x.name,x.explanation]]];
  let groups='';let count=0;
  for(const [title,type,items,fields] of sections){const hits=items.filter(x=>normalize(fields(x).join(' ')).includes(q)).slice(0,4);if(!hits.length)continue;
    groups+='<div class="suggest-group"><div class="suggest-head">'+title+'</div>'+hits.map(x=>'<button type="button" data-result-kind="'+type+'" data-result-id="'+esc(x.id)+'"><span>'+esc(x.name)+'</span><small>'+esc(x.id)+'</small></button>').join('')+'</div>';count+=hits.length;
  }
  host.hidden=false;host.innerHTML=groups||'<div class="no-results">Geen resultaten gevonden.</div>';
  host.querySelectorAll('[data-result-kind]').forEach(el=>el.addEventListener('click',()=>{openRecord(el.dataset.resultKind,el.dataset.resultId);host.hidden=true;$('globalSearch').value='';}));
}
const snapshotStore='emmaus-ict-scan-v2';
const snapshotSchema='ict-scan-snapshot-v1';
const snapshotRegisters=['apps','ai','connections','checks','devices','parts','dpia','aiControls','policyDocs','signals','candidates','licenseReview','workActions','softwareReview','faqs','sourceRegister'];
function snapshotScope(profile){return window.AssuranceProfile.scopeKey(profile);}
function snapshotKey(profile){return 'profile:'+snapshotScope(profile);}
function openSnapshotDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(Error('Opslag is niet beschikbaar in deze browser.'));const req=indexedDB.open(snapshotStore,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('scans'))req.result.createObjectStore('scans');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Lokale opslag is niet beschikbaar.'));});}
async function snapshotWrite(value,profile){const key=snapshotKey(profile);validateSnapshot(value,profile);const db=await openSnapshotDB();return new Promise((resolve,reject)=>{const tx=db.transaction('scans','readwrite');const req=tx.objectStore('scans').put(value,key);req.onerror=()=>reject(req.error);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});}
async function snapshotRead(profile){const key=snapshotKey(profile),db=await openSnapshotDB();return new Promise((resolve,reject)=>{const tx=db.transaction('scans','readonly');const req=tx.objectStore('scans').get(key);req.onsuccess=()=>{db.close();resolve(req.result);};req.onerror=()=>reject(req.error);});}
async function legacySnapshotRead(){const db=await openSnapshotDB();return new Promise((resolve,reject)=>{const tx=db.transaction('scans','readonly'),req=tx.objectStore('scans').get('latest');req.onsuccess=()=>{db.close();resolve(req.result);};req.onerror=()=>reject(req.error);});}
async function downloadLegacySnapshot(){try{const saved=await legacySnapshotRead();if(!saved){$('saveStatus').textContent='Er staat geen oudere lokale kopie op dit apparaat.';return;}download('oude-lokale-kopie.json',new Blob([JSON.stringify(saved,null,2)+'\n'],{type:'application/json'}));$('saveStatus').textContent='Oude lokale kopie gedownload.';}catch(e){$('saveStatus').textContent='Downloaden is niet gelukt: '+e.message;}}
async function snapshotDelete(profile){const key=snapshotKey(profile),db=await openSnapshotDB();return new Promise((resolve,reject)=>{const tx=db.transaction('scans','readwrite');tx.objectStore('scans').delete(key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});}
function snapshotObject(profile){return {schema:snapshotSchema,scopeId:snapshotScope(profile),organisationId:profile.organisation.id,date:new Date().toISOString(),maps:Object.fromEntries(snapshotRegisters.map(k=>[k,array(state[k])])),sourceRegisterLoaded:state.sourceRegisterLoaded===true||state.sourceRegister.size>0,sources:state.sources.map(x=>({name:x.name,kind:x.kind,rows:x.rows,info:x.info})),docs:state.docs,metadata:state.metadata};}
function validateSnapshot(saved,profile){
  if(!saved||saved.schema!==snapshotSchema||saved.scopeId!==snapshotScope(profile)||saved.organisationId!==profile.organisation.id)throw Error('Deze momentopname hoort niet bij de huidige organisatie en bron.');
  if(!saved.maps||typeof saved.maps!=='object'||Array.isArray(saved.maps)||!Array.isArray(saved.sources)||!Array.isArray(saved.docs))throw Error('De momentopname heeft een ongeldige structuur.');
  if(saved.sourceRegisterLoaded!==undefined&&typeof saved.sourceRegisterLoaded!=='boolean')throw Error('De status van het opgeslagen bronregister is ongeldig.');
  for(const key of snapshotRegisters){
    // A scoped snapshot from before the source register remains recoverable.
    // Its missing register stays explicitly unloaded; the adapter rejects it.
    if(key==='sourceRegister'&&!Object.prototype.hasOwnProperty.call(saved.maps,key)&&saved.sourceRegisterLoaded===undefined)continue;
    const items=saved.maps[key];if(!Array.isArray(items))throw Error('Een register ontbreekt in de momentopname: '+key);
    const ids=new Set();
    for(const item of items){if(!item||typeof item!=='object'||Array.isArray(item)||(!item.id&&!item.name))throw Error('Een registratie in de momentopname is ongeldig.');const id=String(item.id||item.name);if(ids.has(id))throw Error('Een registratie staat dubbel in de momentopname.');ids.add(id);}
  }
  return saved;
}
async function saveSnapshot(){if(!state.ready){toast('Er zijn nog geen gegevens om te bewaren.');return;}try{const profile=await window.IctOrganisation.ready;await snapshotWrite(snapshotObject(profile),profile);$('saveStatus').textContent='Bewaard voor '+profile.organisation.name+' op '+new Date().toLocaleString('nl-NL');toast('Momentopname lokaal bewaard.');}catch(e){$('saveStatus').textContent='Opslaan is niet gelukt: '+e.message;}}
async function restoreSnapshot(){try{const profile=await window.IctOrganisation.ready,saved=await snapshotRead(profile);if(!saved||state.ready)return;validateSnapshot(saved,profile);const maps=Object.fromEntries(snapshotRegisters.map(key=>[key,new Map((saved.maps[key]||[]).map(item=>[String(item.id||item.name),item]))]));for(const key of snapshotRegisters)state[key]=maps[key];state.sources=saved.sources;state.docs=saved.docs;state.metadata=saved.metadata||null;state.sourceRegisterLoaded=saved.sourceRegisterLoaded===undefined?Array.isArray(saved.maps.sourceRegister):saved.sourceRegisterLoaded;state.ready=[state.apps.size,state.ai.size,state.connections.size,state.checks.size,state.parts.size,state.sourceRegister.size].some(x=>x>0);buildDerived();renderAll();$('saveStatus').textContent='Momentopname voor '+profile.organisation.name+' geladen ('+new Date(saved.date).toLocaleDateString('nl-NL')+').'+(profile.source.registerFiles.sourceRegister&&!state.sourceRegisterLoaded?' Het bronregister ontbreekt nog; lees het bronbestand in of synchroniseer met GitHub.':'');}catch(e){const status=$('saveStatus');if(status)status.textContent='Lokale momentopname niet geladen: '+e.message;}}
async function clearSnapshot(){if(!confirm('De lokaal bewaarde gegevens voor deze organisatie verwijderen? Ook het huidige overzicht wordt leeggemaakt.'))return;try{const profile=await window.IctOrganisation.ready;await snapshotDelete(profile);for(const k of snapshotRegisters)state[k].clear();state.sources=[];state.docs=[];state.derived=[];state.ready=false;state.metadata=null;state.sourceRegisterLoaded=false;for(const k of ['area','type','overviewArea','overviewKind','phase','aiProduct'])state[k]='';$('saveStatus').textContent='De lokaal bewaarde gegevens voor '+profile.organisation.name+' zijn gewist.';renderAll();selectView('sources');toast('Lokale momentopname verwijderd.');}catch(e){$('saveStatus').textContent='Verwijderen niet gelukt: '+e.message;}}
function enhancementEvents(){
  $('topReports').addEventListener('click',()=>selectView('reports'));
  for(const id of ['overviewArea','overviewKind'])$(id).addEventListener('change',()=>{state.overviewArea=$('overviewArea').value;state.overviewKind=$('overviewKind').value;renderOverview();});
  $('connectionsStatus').addEventListener('change',renderConnections);
  $('overviewClear').addEventListener('click',()=>{state.overviewArea='';state.overviewKind='';renderOverview();});
  // Chart choices are bound per visual, not as a single global switch.
  document.querySelectorAll('[data-report]').forEach(btn=>btn.addEventListener('click',()=>{state.reportScope=btn.dataset.report;renderReports();}));
  $('reportExcel').addEventListener('click',()=>exportScopedExcel(state.reportScope));
  $('reportPdf').addEventListener('click',()=>exportScopedPdf(state.reportScope));
  $('reportJson').addEventListener('click',exportJson);
  $('saveLocal').addEventListener('click',saveSnapshot);$('deleteLocal').addEventListener('click',clearSnapshot);
  $('downloadLegacyLocal').addEventListener('click',downloadLegacySnapshot);
  $('globalSearch').addEventListener('input',renderGlobalSuggestions);
  $('globalSearch').addEventListener('keydown',e=>{if(window.EmmausAnswerEngine?.handleKeydown(e))return;if(e.key==='Escape'){$('globalResults').hidden=true;$('globalSearch').blur();}if(e.key==='Enter'){const first=$('globalResults').querySelector('[data-result-kind]');if(first)first.click();}});
  document.addEventListener('click',e=>{if(!e.target.closest('.global-search-wrap'))$('globalResults').hidden=true;});
  document.addEventListener('ict-scan:opened',async()=>{await restoreSnapshot();document.dispatchEvent(new Event('ict-scan:local-restored'));});
  window.addEventListener('beforeprint',()=>{const root=$('printReport');if(root.children.length && !root.querySelector('.print-logo'))root.insertAdjacentHTML('afterbegin','<img class="print-logo" src="./emmaus-logo.svg" alt="Emmauscollege Rotterdam">');});
}
enhancementEvents();

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
  function ref(){
    const repo=el('githubRepo')?.value.trim();
    const chosen=repo==='E-AI-MODEL/website'?el('githubRef')?.value.trim():'main';
    return chosen&&/^[\w./-]{1,100}$/.test(chosen)&&!chosen.includes('..')?chosen:'main';
  }
  async function readGit(path,sha){
    if(!new RegExp('^'+FILES.replaceAll('/','\\/')+'[a-z0-9._-]+\\.(?:txt|json)$').test(path))throw Error('Dit documentpad is niet toegestaan.');
    const url=API+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(ref());
    const response=await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error',headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw Error('Document niet beschikbaar in de gekozen GitHub-versie ('+response.status+').');
    const data=await response.json();
    if(data.encoding!=='base64'||typeof data.content!=='string'||data.size>1000000)throw Error('Onleesbare of te grote GitHub-bron.');
    if(sha&&sha!==data.sha)throw Error('De documentversie wijkt af van de gecontroleerde catalogus.');
    const binary=atob(data.content.replace(/\s+/g,''));
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
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
    localFiles.set(opened.id,{kind:'text',text:body,name:file.name});
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
    const key=ref()+'/'+d.id+'/'+d.blobSha;
    try{
      const body=loaded.has(key)?loaded.get(key):await readGit(d.path,d.blobSha);
      if(opened?.id!==d.id)return;
      loaded.set(key,body);
      if((d.id==='AVG'&&!body.includes('Artikel 99'))||(d.id==='AIACT'&&!body.includes('Artikel 113'))||(d.id==='UAVG'&&!body.includes('Artikel 54')))throw Error('De volledige documenttekst is niet aantoonbaar beschikbaar.');
      showText(body);
      el('docReaderStatus').textContent='Volledige bronmomentopname · '+d.snapshotAt+'. '+d.note;
    }catch(error){el('docReaderStatus').textContent='Document niet geladen: '+error.message;}
  }
  async function open(docId){
    const dialog=el('docDialog'),scrim=el('docScrim');
    if(!dialog||!scrim)return;
    previousFocus=document.activeElement;
    scrim.hidden=false;dialog.hidden=false;
    el('docReaderTitle').textContent='Documenten';
    el('docReaderMeta').textContent='Bronnen worden gecontroleerd...';
    el('docReaderStatus').textContent='Documentenregister laden...';
    el('docDialogClose').focus();
    try{
      const docs=await catalog();
      if(!docs.length)throw Error('Geen documenten in de catalogus.');
      const selected=docs.find(d=>d.id===docId)||docs.find(d=>d.frameworkId===docId)||docs[0];
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
  document.addEventListener('ict-scan:opened',()=>void catalog().catch(()=>{}));
  window.EmmausDocs=Object.freeze({open,refresh:()=>{catalogPromise=null;return catalog();},known:()=>documents.map(d=>({id:d.id,availability:d.availability}))});
})();

