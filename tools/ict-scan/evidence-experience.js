'use strict';
/* One visible purpose per screen, with the supplied source records as the only evidence. */
(function(){
  viewNames.devices='Apparaten';
  viewTitles.devices='Apparaten en beheer';
  sectionTexts.devices='Apparaatregistraties, meetdekking en wat nog niet vaststaat.';
  const byId=id=>document.getElementById(id);
  const items=map=>Array.from(map.values());
  const fmt=n=>Number(n).toLocaleString('nl-NL');
  const safe=x=>esc(x==null?'':String(x));
  const unknown=v=>!String(v||'').trim()||/^\?|niet vastgesteld|onbekend|niet gecontroleerd|niet inzichtelijk/i.test(String(v));
  const digits=s=>Number(String(s||'').match(/\d+/)?.[0]||0);
  const openCard=(type,id)=>window.EmmausRecordCards?.open(type,id);
  const action=(label,fn,cls='monitor-button subtle')=>{
    const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',fn);return b;
  };
  const note=(label,text)=>'<div class="evidence-fact"><small>'+safe(label)+'</small><span>'+safe(text||'Niet vastgesteld')+'</span></div>';
  function deviceData(){
    const rows=items(state.devices);
    const total=rows.find(x=>/entra apparaatrecords/i.test(x.name))||null;
    const compliance=rows.find(x=>/compliancevelden/i.test(x.name))||null;
    const macs=rows.find(x=>/mac.records/i.test(x.name))||null;
    const test=rows.find(x=>/getest apparaat/i.test(x.name))||null;
    const amount=digits(total?.quantity),match=String(compliance?.quantity||'').match(/(\d+)\s*True\s*\/\s*(\d+)\s*False/i);
    const yes=match?Number(match[1]):0,no=match?Number(match[2]):0;
    const missing=amount-(yes+no);
    const complete=amount>0&&yes+no<=amount;
    return {rows,total,amount,yes,no,missing,complete,macs,test};
  }
  function renderDevices(){
    const d=deviceData(),cardRoot=byId('deviceStats'),bars=byId('deviceCoverage');
    if(!cardRoot||!bars)return;
    if(!d.rows.length){
      cardRoot.innerHTML='<div class="no-results">Er zijn nog geen apparaatmetingen ingelezen.</div>';
      bars.innerHTML='<div class="no-results">Meetgegevens ontbreken.</div>';
      byId('deviceRecords').replaceChildren();return;
    }
    const period=d.total?.measurementDate||'Periode nog onbekend';
    byId('deviceStamp').textContent='Peildatum '+period;
    cardRoot.innerHTML=[
      ['Apparaten in Entra',d.amount?fmt(d.amount):'Onbekend','Niet het totaal aantal apparaten op school'],
      ['Status apparaatbeleid bekend',d.complete?fmt(d.yes+d.no):'Onbekend','Volgens de beschikbare export'],
      ['Status apparaatbeleid ontbreekt',d.complete?fmt(d.missing):'Onbekend','Geen status in de export'],
      ['Mac-registraties',d.macs?String(d.macs.quantity):'Onbekend','Aantal volgens de bron']
    ].map(([label,num,sub])=>'<div class="evidence-stat"><small>'+safe(label)+'</small><strong>'+safe(num)+'</strong><span>'+safe(sub)+'</span></div>').join('');
    if(d.complete){
      const parts=[{n:d.yes,label:'Voldoet (Entra)',cls:'yes'},{n:d.no,label:'Voldoet niet (Entra)',cls:'no'},{n:d.missing,label:'Niet ingevuld',cls:'missing'}];
      bars.innerHTML='<div class="device-headline"><strong>'+fmt(d.yes+d.no)+' / '+fmt(d.amount)+'</strong><span>records met een ingevulde waarde</span></div>'+
        '<div class="device-meter" role="img" aria-label="'+parts.map(p=>p.n+' '+p.label).join(', ')+'">'+parts.filter(p=>p.n).map(p=>'<span class="device-meter-'+p.cls+'" style="width:'+(p.n/d.amount*100).toFixed(3)+'%"></span>').join('')+'</div>'+
        '<div class="device-legend">'+parts.map(p=>'<div><i class="device-dot '+p.cls+'"></i><span>'+p.label+'</span><strong>'+fmt(p.n)+'</strong><small>'+Math.round(p.n/d.amount*100)+'%</small></div>').join('')+'</div>';
      byId('deviceCoverageNote').textContent=fmt(d.yes)+' voldoen en '+fmt(d.no)+' voldoen niet volgens de export. Bij '+fmt(d.missing)+' ontbreekt de status. Dit is geen volledige beveiligingsbeoordeling.';
    }else{
      bars.innerHTML='<div class="no-results">De totalen van deze bron sluiten niet op elkaar aan. Geen verdeling getoond.</div>';
      byId('deviceCoverageNote').textContent='Controleer de bronwaarden voordat percentages worden gebruikt.';
    }
    byId('deviceGaps').innerHTML=[
      ['Actuele schoolpopulatie','De export uit september bevestigt niet hoeveel fysieke apparaten er nu zijn.'],
      ['Eigenaar en gebruik','Voor iedere apparaatgroep ontbreken hier volledige rol-, locatie- en gebruiksgegevens.'],
      ['Beheer en beveiliging','De exportstatus alleen is onvoldoende om de beveiliging te beoordelen.'],
      ['Actuele gegevens','Controleer de aantallen en beheerstatus in de systemen van de school.']
    ].map(([name,desc])=>'<div class="device-gap"><span class="device-gap-line"></span><strong>'+safe(name)+'</strong><p>'+safe(desc)+'</p></div>').join('');
    const host=byId('deviceRecords');host.replaceChildren();
    for(const row of d.rows){
      const box=document.createElement('div');box.className='device-record';
      box.innerHTML='<div><small>'+safe(row.id)+' · '+safe(row.type)+' · '+safe(row.measurementDate)+'</small><strong>'+safe(row.name)+'</strong><p>'+safe(row.description)+'</p><span>Beperking: '+safe(row.limitation)+'</span></div>';
      box.append(action('Bronkaart',()=>openCard('devices',row.id),'evidence-link'));
      host.append(box);
    }
  }
  const priorPrivacy=renderPrivacy;
  renderPrivacy=function(){
    priorPrivacy();
    const dpia=items(state.dpia),controls=items(state.aiControls);
    const external=dpia.filter(x=>/bevestigd/i.test(x.evidence||'')).length;
    byId('privacySummary').innerHTML=[
      ['DPIA-bronitems',dpia.length,'Geen uitgevoerde DPIAs of FG-oordelen'],
      ['Externe bronstatus',external,'Bronnen met vastgelegde externe onderbouwing'],
      ['FG-advies','Niet aangeleverd','Niet opgenomen in deze inventarisatie'],
      ['Besluit bevoegd gezag','Niet aangeleverd','Geen besluit in de aangeleverde bronnen']
    ].map(([name,n,caption])=>'<div class="evidence-stat"><small>'+safe(name)+'</small><strong>'+(typeof n==='number'?fmt(n):safe(n))+'</strong><span>'+safe(caption)+'</span></div>').join('');
    const grouped=new Map();
    for(const record of controls){const group=record.domain||'Overige beheerpunten';if(!grouped.has(group))grouped.set(group,[]);grouped.get(group).push(record);}
    byId('privacyControls').innerHTML=[...grouped].map(([name,records],i)=>
      '<details class="evidence-group" '+(i===0?'open':'')+'><summary><strong>'+safe(name)+'</strong><span>'+fmt(records.length)+' beheerpunten</span></summary><div class="evidence-group-list">'+
      records.map(r=>'<details class="evidence-row"><summary><span><small>'+safe(r.id)+'</small><strong>'+safe(r.name)+'</strong></span><span class="evidence-chevron">Toelichting</span></summary><div class="evidence-row-body">'+
        note('Advies',r.advice)+note('Waar wordt dit beheerd?',r.managementLocation)+note('Wat moet worden nagegaan?',r.action)+note('Uitvoering',r.execution)+note('Nuance',r.nuance)+note('Bron',Array.isArray(r.sources)?r.sources.join('; '):'')+
        '<button class="evidence-record-open" type="button" data-card-type="aiControls" data-card-id="'+safe(r.id)+'">Open volledige gegevenskaart</button></div></details>').join('')+
      '</div></details>').join('')||'<div class="no-results">Geen AI-beheerpunten gevonden.</div>';
    byId('privacyDpia').innerHTML=dpia.map(r=>{
      const status=String(r.assessment||'Niet beoordeeld');
      const level=/^GROEN/i.test(status)?'partial':/^ORANJE/i.test(status)?'caution':'unknown';
      return '<details class="evidence-row dpia-evidence"><summary><span><small>'+safe(r.id)+' · '+safe(r.type||'Beoordeling')+'</small><strong>'+safe(r.name)+'</strong></span><span class="evidence-status '+level+'">'+safe(status)+'</span></summary><div class="evidence-row-body">'+
        note('Wat is beoordeeld?',r.description)+note('Aandachtspunt volgens aangeleverde bron',r.local)+note('Status van de bronvermelding',r.evidence)+note('Bronpeildatum',r.sourceDate)+note('Bron',Array.isArray(r.sources)?r.sources.join('; '):'')+
        '<button class="evidence-record-open" type="button" data-card-type="dpia" data-card-id="'+safe(r.id)+'">Open volledige gegevenskaart</button></div></details>';
    }).join('')||'<div class="no-results">Geen DPIA-onderwerpen gevonden.</div>';
    for(const node of document.querySelectorAll('#privacyDpia [data-card-id],#privacyControls [data-card-id]')){
      node.addEventListener('click',()=>openCard(node.dataset.cardType,node.dataset.cardId));
    }
  };
  // No second copy of DPIA or AI management inside the AI-functions view.
  const previouslyRenderedAi=renderAi;
  renderAi=function(){previouslyRenderedAi();byId('aiSchoolPanels')?.classList.toggle('evidence-organisational',state.aiMode==='school');};

  function relationSets(app){
    const index=window.IctInventoryIndex?.build(state);
    if(!index)return[];
    const ai=index.connected('apps',app.id,{type:'ai'}).map(link=>link.other);
    const parts=index.connected('apps',app.id,{type:'parts',relationType:'part_of'}).map(link=>link.other);
    const entra=index.connected('apps',app.id,{type:'connections'}).map(link=>link.other);
    const controls=new Map();
    for(const item of ai)for(const link of index.connected('ai',item.id,{type:'aiControls'})){
      controls.set(link.otherId,link.other);
    }
    const dpia=index.connected('apps',app.id,{type:'dpia'}).map(link=>link.other);
    return [
      {key:'ai',name:'AI-functies',items:ai,type:'ai',note:'Beschrijving, niet automatisch lokaal actief'},
      {key:'parts',name:'Onderdelen',items:parts,type:'parts',note:'Vastgelegde productonderdelen; beschikbare functie is niet automatisch actief'},
      {key:'entra',name:'Entra-matches',items:entra,type:'connections',note:'Mogelijke overeenkomst, werking niet bewezen'},
      {key:'controls',name:'AI-beheer',items:[...controls.values()],type:'aiControls',note:'Via AI-ID gekoppelde beheercontroles'},
      {key:'dpia',name:'DPIA-beoordelingen',items:dpia,type:'dpia',note:'Alleen expliciet vastgelegde relaties; geen automatisch privacyoordeel'}
    ].filter(group=>{
      if(group.key==='dpia')return window.EmmausRoles?.isEnabled('fg')===true&&group.items.length>0;
      if(group.key==='ai'||group.key==='controls')return window.EmmausRoles?.isEnabled('ai')!==false;
      return true;
    });
  }
  let relationTab='ai',relationApp='';
  function renderRelations(){
    const select=byId('familyApp'),root=byId('relationshipExplorer');
    if(!root)return;
    const app=state.apps.get(select?.value)||items(state.apps)[0];
    if(!app){root.innerHTML='<p>Geen toepassingen ingelezen.</p>';return;}
    if(relationApp!==app.id){relationApp=app.id;relationTab='ai';}
    const sets=relationSets(app);
    if(!sets.some(x=>x.key===relationTab&&x.items.length))relationTab=(sets.find(x=>x.items.length)||sets[0]).key;
    const positions=sets.length===5?[[230,105],[765,110],[847,242],[725,373],[228,369]]:
      sets.length===4?[[234,112],[765,112],[765,372],[234,372]]:
      sets.length===3?[[245,122],[775,230],[245,365]]:
      sets.length===2?[[245,230],[765,230]]:[[500,95]];
    const connectors=sets.map((group,i)=>{
      const [x,y]=positions[i]||[500,90],active=group.key===relationTab;
      return '<path class="'+(group.items.length?'linked':'empty')+(active?' selected':'')+'" d="M500 240 Q'+Math.round((500+x)/2)+' '+Math.round((240+y)/2-12)+' '+x+' '+y+'"/>'+
      '<circle class="'+(active?'selected':'')+'" cx="'+x+'" cy="'+y+'" r="'+(active?7:4)+'"/>';
    }).join('');
    const orbit='<svg class="relation-orbit-lines" viewBox="0 0 1000 480" preserveAspectRatio="none" aria-hidden="true">'+
      '<circle class="orbit-trace orbit-trace-a" cx="500" cy="240" r="119"/>'+
      '<ellipse class="orbit-trace orbit-trace-b" cx="500" cy="240" rx="302" ry="181"/>'+
      connectors+'</svg>';
    root.innerHTML='<div class="relation-overview" data-node-count="'+sets.length+'">'+orbit+
      '<div class="relation-center"><small>'+safe(app.id)+' · '+safe(app.kind)+'</small><strong>'+safe(app.name)+'</strong><span>'+safe(unknown(app.local)?'Gebruik niet bevestigd':app.local)+'</span></div>'+
      '<div class="relation-spokes">'+sets.map((group,i)=>{
         const [x,y]=positions[i]||[500,95];
         return '<button type="button" data-relation="'+group.key+'" style="--node-x:'+x/10+'%;--node-y:'+y/4.8+'%;" class="relation-spoke '+(relationTab===group.key?'active':'')+'" aria-pressed="'+(relationTab===group.key?'true':'false')+'"><small>'+safe(group.name)+'</small><strong>'+fmt(group.items.length)+'</strong><span>'+safe(group.items.length?'Vastgelegde relaties':'Geen relatie gevonden')+'</span></button>';
      }).join('')+'</div><span class="orbit-axis-label" aria-hidden="true">VERBANDEN UIT BRONNEN · NIET AUTOMATISCH BEVESTIGD</span></div>'+
      '<div class="relation-detail" id="relationDetail"></div>';
    for(const b of root.querySelectorAll('[data-relation]'))b.addEventListener('click',()=>{relationTab=b.dataset.relation;renderRelations();});
    const chosen=sets.find(x=>x.key===relationTab);
    const rows=chosen.items;
    const box=byId('relationDetail');
    box.innerHTML='<div class="relation-detail-head"><strong>'+safe(chosen.name)+' · '+fmt(rows.length)+'</strong><span>'+safe(chosen.note)+'</span></div>';
    if(!rows.length){box.insertAdjacentHTML('beforeend','<p class="no-results">Geen bevestigde relatie in de beschikbare bron. Dat sluit een bestaande relatie niet uit.</p>');return;}
    const list=document.createElement('div');list.className='relation-items';
    for(const rec of rows.slice(0,32)){
      const item=document.createElement('div');item.className='relation-item';
      item.innerHTML='<span><small>'+safe(rec.id)+'</small><strong>'+safe(rec.name)+'</strong></span>';
      const store=chosen.type==='additionalCandidates'?'candidates':chosen.type;
      if(state[store] instanceof Map&&state[store].has(rec.id)){
        item.append(action('Bekijk',()=>openCard(chosen.type,rec.id),'evidence-link'));
      }else if(rec.description||rec.note||rec.local){
        item.append(document.createTextNode(' · '+(rec.note||rec.description||rec.local)));
      }
      list.append(item);
    }
    box.append(list);
    if(rows.length>32){const p=document.createElement('p');p.className='viz-caption';p.textContent='32 van '+rows.length+' relaties getoond. Open de bijbehorende registerpagina voor de volledige lijst.';box.append(p);}
  }
  const family=byId('familyVisual');
  if(family){
    const relation=document.createElement('div');relation.id='relationshipExplorer';relation.className='relationship-explorer';
    family.parentNode.insertBefore(relation,family.nextSibling);
    byId('familyApp')?.addEventListener('change',renderRelations);
  }
  const earlierOverview=renderOverview;
  function renderOverviewMetrics(){
    // Count source records by type, not all graph nodes or inferred relationships.
    const index=window.IctInventoryIndex.build(state);
    const registered=type=>index.records(type).filter(r=>index.get(type,r.id)?.derived===false);
    const apps=registered('apps'),candidates=registered('additionalCandidates'),ai=registered('ai');
    const connections=registered('connections'),hardware=registered('hardwareGroups'),parts=registered('parts');
    const appIds=new Set(apps.map(r=>r.id));
    const aiWithParent=ai.filter(r=>appIds.has(r.parentId));
    const appsWithAi=new Set(aiWithParent.map(r=>r.parentId)).size;
    const directMatches=connections.filter(r=>appIds.has(r.matchedId)).length;
    const totalRecords=[...index.nodes.values()].filter(n=>!n.derived).length;
    const d=deviceData(),rawAmount=String(d.total?.quantity??'').trim();
    const measurement=/^\d+$/.test(rawAmount)&&Number.isSafeInteger(Number(rawAmount))?fmt(Number(rawAmount)):null;
    const cards=[
      {key:'software',label:'Softwarevermeldingen',value:apps.length+candidates.length,detail:fmt(apps.length)+' applicatieregistraties · '+fmt(candidates.length)+' overige vermeldingen',context:'Overlap mogelijk. '+fmt(parts.length)+' onderdelen worden apart geteld.',view:'apps',link:'Bekijk software'},
      {key:'ai',label:'Beschreven AI-functies',value:ai.length,detail:'Bij '+fmt(appsWithAi)+' van '+fmt(apps.length)+' applicatieregistraties'+(aiWithParent.length<ai.length?' · '+fmt(ai.length-aiWithParent.length)+' functies zonder geregistreerde bovenliggende applicatie':''),context:'Aantal daadwerkelijk ingeschakelde functies niet vastgesteld.',view:'ai',link:'Bekijk AI-functies'},
      {key:'entra',label:'Entra-appregistraties',value:connections.length,detail:fmt(directMatches)+' mogelijke directe appmatches · '+fmt(connections.length-directMatches)+' zonder directe appmatch',context:'Actuele technische koppelingen niet vastgesteld.',view:'connections',link:'Bekijk Entra-registraties'},
      {key:'hardware',label:'Hardwaregroepen',value:hardware.length,detail:measurement!==null?measurement+' Entra-apparaatrecords · '+(d.total.measurementDate||'peildatum onbekend'):'Geen Entra-apparaattelling beschikbaar.',context:'Schoolbreed aantal fysieke apparaten niet vastgesteld.',view:'devices',link:'Bekijk hardware en metingen'}
    ].filter(row=>row.view!=='ai'||window.EmmausRoles?.isEnabled('ai')!==false);
    const grid=byId('kpiGrid');
    grid.replaceChildren();
    for(const row of cards){
      const b=document.createElement('button');
      b.type='button';b.className='kpi trust-kpi evidence-kpi';
      b.dataset.metric=row.key;
      b.setAttribute('aria-label',row.label+': '+fmt(row.value)+'. '+row.detail+'. '+row.context+' '+row.link);
      b.innerHTML='<span class="kpi-label">'+safe(row.label)+'</span><strong class="kpi-value">'+safe(fmt(row.value))+'</strong><span class="kpi-desc">'+safe(row.detail)+'</span><span class="evidence-kpi-context">'+safe(row.context)+'</span><span class="evidence-kpi-open">'+safe(row.link)+'</span>';
      b.addEventListener('click',()=>selectView(row.view));grid.append(b);
    }
    const sub=byId('inventoryPopulation');
    if(sub)sub.textContent=fmt(totalRecords)+' records in alle ingelezen registers. Geen telling van unieke systemen.';
  }
  renderOverview=function(){earlierOverview();if(state.ready){renderOverviewMetrics();renderRelations();}};
  const oldCandidates=renderCandidates;
  renderCandidates=function(){
    oldCandidates();
    const info=byId('candidateInfo');
    if(info)info.textContent='Niet opgenomen bij de applicaties. Gebruik en overlap nog niet gecontroleerd.';
  };
  // Record population and status instead of suggesting every recorded item is in use.
  const sourceLabels={studio:'Dashboard op maat',overview:'Overzicht',apps:'Applicaties',connections:'Koppelingen vanuit Entra',devices:'Apparaten',ai:'AI-functies',privacy:'Privacybronnen',findings:'Controles',reports:'Rapporten',sources:'Bronnen'};
  function updatePath(view){
    let path=byId('evidencePath');
    if(!path){path=document.createElement('div');path.id='evidencePath';path.className='evidence-path';byId('sectionEyebrow').insertAdjacentElement('afterend',path);}
    const current=byId('view'+view[0].toUpperCase()+view.slice(1));
    const selected=current?.querySelector('.scene-tab.active');
    path.textContent=(sourceLabels[view]||view)+(selected?' / '+selected.textContent:'');
  }
  const beforeSelect=selectView;
  selectView=function(view){beforeSelect(view);if(view==='devices')renderDevices();if(viewNames[view])updatePath(view);};
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.scene-tab');
    if(tab)queueMicrotask(()=>updatePath(state.view));
    const deviceLink=e.target.closest('#viewDevices [data-open]');
    if(deviceLink){e.preventDefault();selectView(deviceLink.dataset.open);}
  });
  const earlierAll=renderAll;
  renderAll=function(){earlierAll();if(state.ready)renderDevices();updatePath(state.view);};
  // Keep the useful report builder as the one place for exports.
  const duplicateExport=byId('exportExcel')?.closest('.panel');
  if(duplicateExport)duplicateExport.classList.add('duplicate-source-export');
  const candidate=byId('candidatePanel');
  if(candidate)candidate.querySelector('summary')?.setAttribute('title','Software buiten de huidige applicatielijst. Gebruik en dubbele vermeldingen nog te controleren.');
  // Golden path: one starting point for viewing, searching, checking, editing and reporting.
  // This is a navigation layer; source records and permissions never change.
  const nav=byId('sections');
  const overviewNav=nav?.querySelector('[data-view="overview"]');
  const studioNav=nav?.querySelector('[data-view="studio"]');
  if(overviewNav&&studioNav)nav.insertBefore(overviewNav,studioNav);
  const overview=byId('viewOverview');
  if(overview&&!byId('overviewQuickActions')){
    const actions=document.createElement('nav');
    actions.id='overviewQuickActions';
    actions.className='overview-quick-actions';
    actions.setAttribute('aria-label','Direct naar');
    const destinations=[
      ['Applicatie zoeken',()=>{selectView('apps');byId('appsSearch')?.focus();}],
      ['Controles bekijken',()=>{selectView('findings');window.EmmausScenes?.show('findings',1,false);}],
      ['Verbanden onderzoeken',()=>window.EmmausRelationAtlas?.openNetwork()],
      ['Dashboard aanpassen',()=>{selectView('studio');window.EmmausDashboardStudio?.setEditing(true);}],
      ['Registratie bewerken',()=>window.EmmausRecordCards?.launch()],
      ['Rapport maken',()=>{selectView('reports');window.EmmausScenes?.show('reports',0,false);}]
    ];
    for(const [label,action] of destinations){
      const button=document.createElement('button');
      button.type='button';
      button.className='overview-quick-action';
      button.textContent=label;
      if(label==='Registratie bewerken')button.classList.add('overview-edit-action');
      if(label==='Dashboard aanpassen')button.classList.add('overview-layout-action');
      button.addEventListener('click',action);
      actions.append(button);
    }
    overview.insertBefore(actions,overview.querySelector('.scene-navigation')||overview.firstChild);
  }
  // Rapporten blijven bereikbaar via de navigatie en de overzichtsactie.
  // Het submenu hoeft dezelfde downloadmogelijkheden niet opnieuw te tonen.
  byId('topReports')?.closest('.rail-drawer-section')?.setAttribute('hidden','');
  const registerRoot=byId('viewAppsScene0');
  if(registerRoot){
    const tabs=document.createElement('div');tabs.className='app-register-switch';
    const buttons=[
      action('Applicaties',()=>chooseApps('registered'),'app-register-tab active'),
      action('Overige software',()=>chooseApps('candidates'),'app-register-tab')
    ];
    buttons.forEach(b=>tabs.append(b));registerRoot.prepend(tabs);
    function chooseApps(mode){
      const candidates=mode==='candidates';
      byId('appsList').hidden=candidates;
      registerRoot.querySelector(':scope > .list-tools').hidden=candidates;
      byId('candidatePanel').hidden=!candidates;
      if(candidates)byId('candidatePanel').open=true;
      buttons.forEach((b,i)=>{const active=(i===1)===candidates;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    }
    chooseApps('registered');
  }
})();