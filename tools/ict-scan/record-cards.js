'use strict';
/* One editable card for every 2026 register. Drafts never overwrite the verified dashboard.
   Inspired by the HOVI / OnderwijsIn mapping approach: source identity, fields,
   taxonomy relations and source evidence remain separate. */
(function(){
  const $c=id=>document.getElementById(id);
  const SPECS=[
    {key:'apps',store:'apps',label:'Toepassingen en diensten',prefix:'APP',fields:['name','description','area','process','kind','local','owner','users','data','links','processorAgreement','dpiaStatus','aiRefs','reviewAction','sourceDescription','suggestedParent','suggestedParentStatus']},
    {key:'ai',store:'ai',label:'AI-functies',prefix:'AI',fields:['name','product','supplier','parentId','domain','phase','action','input','teacher','student','reviewer','didactics','learning','attention','formative','unknown','steer','instructions','aiAct','aiActExplanation','local','users','defaultSetting','privacyStatus','processingAgreement','supplierSource']},
    {key:'connections',store:'connections',label:'Entra-registraties',prefix:'ENT',fields:['name','visible','enabled','registeredAt','assessment','matched','matchedId','category','priority','local','usageConfirmed']},
    {key:'parts',store:'parts',label:'Technische onderdelen',prefix:'MOD',fields:['name','parent','kind','description','local','connectionId']},
    {key:'additionalCandidates',store:'candidates',label:'Aanvullende kandidaten',prefix:'A',fields:['name','kind','status','priority','included','description','action','source','evidenceDate','confirmed']},
    {key:'checks',store:'checks',label:'Controles',prefix:'C',fields:['name','category','status','explanation','evidence','value','action']},
    {key:'dpia',store:'dpia',label:'FG | DPIA-bronnen',prefix:'DPIA',fields:['name','type','assessment','description','sourceDate','url','evidence','local']},
    {key:'aiControls',store:'aiControls',label:'AI-beheer',prefix:'B',fields:['name','domain','aiRefs','advice','description','knownUse','local','managementLocation','action','nuance','execution','nextStep','sourceInternal','supplierSource','extraSources']},
    {key:'devices',store:'devices',label:'Apparaatmetingen',prefix:'DEV',fields:['name','type','quantity','description','measurementDate','limitation']},
    {key:'hardwareGroups',store:'hardwareGroups',label:'Hardwaregroepen',prefix:'H',fields:['name','category','users','manager','owner','status','description','quantity','note','appRefs']},
    {key:'licenseReview',store:'licenseReview',label:'Licenties ter controle',prefix:'LIC',fields:['name','domain','type','status','aiPossibilities','localAI','license2026','priority','action','sourceNotes','sourceCode']},
    {key:'workActions',store:'workActions',label:'Werkregisteracties',prefix:'WRK',fields:['name','action','involvedRoles','status']},
    {key:'softwareReview',store:'softwareReview',label:'Softwarecontroles',prefix:'SWR',fields:['name','known','action','status']},
    {key:'faqs',store:'faqs',label:'Veelgestelde vragen',prefix:'FAQ',fields:['name','answer','aliases','topic','reference','status','reviewedAt']},
    {key:'sourceRegister',store:'sourceRegister',label:'Bronnenregister',prefix:'SRC',fields:['name','owner','version','contentSha256','rightsStatus','rightsBasis','allowedUse','scope','retention','approvalStatus','approvedBy','approvedAt','approvalEvidence','nextReviewAt']}
  ];
  const labels={
    name:'Naam',id:'ID',answer:'Vast antwoord',aliases:'Andere vraagformuleringen (gescheiden door |)',topic:'Onderwerp',reference:'Verwijzing naar bron',reviewedAt:'Beoordeeld op',description:'Beschrijving',area:'Gebruiksgebied',process:'Proces',kind:'Soort voorziening',type:'Type',local:'Gebruik op school',owner:'Verantwoordelijke',users:'Gebruikers',
    data:'Welke gegevens?',links:'Gegevensuitwisseling en koppelingen',processorAgreement:'Verwerkersovereenkomst',dpiaStatus:'DPIA-status',aiRefs:'AI-functies',reviewAction:'Nog controleren',sourceDescription:'Aanvullende bronbeschrijving',
    product:'Toepassing',supplier:'Leverancier',parentId:'Hoofdtoepassing-ID',parent:'Hoofdtoepassing-ID',suggestedParent:'Mogelijke familie',suggestedParentStatus:'Status mogelijke familie',
    domain:'Domein',phase:'Lesfase',action:'Functie of vervolgstap',input:'Wat kan de docent instellen?',teacher:'Controle door docent',student:'Wat doet de leerling?',reviewer:'Wie beoordeelt de uitkomst?',didactics:'Didactische onderbouwing',learning:'Leerdoel',attention:'Didactisch aandachtspunt',
    formative:'Formatief handelen',unknown:'Niet inzichtelijk of te controleren',steer:'Stuurbaarheid',instructions:'Instructies',aiAct:'AI Act-indicatie (brontekst)',aiActExplanation:'Toelichting AI Act',defaultSetting:'Leveranciersinstelling',
    privacyStatus:'Privacy-status',processingAgreement:'Verwerkersafspraak',supplierSource:'Leveranciersbron',visible:'Zichtbaarheid',enabled:'Ingeschakeld volgens export',registeredAt:'Registratiedatum',assessment:'Beoordeling',
    matched:'Mogelijke koppeling',matchedId:'Mogelijke toepassing-ID',category:'Categorie',priority:'Prioriteit',usageConfirmed:'Actief gebruik bevestigd?',status:'Status',included:'Opgenomen in basisinventaris',
    source:'Bron',evidenceDate:'Bewijsdatum',evidence:'Bewijs',value:'Waarde',url:'Bron-URL',sourceDate:'Datum bron',knownUse:'Bekend gebruik',managementLocation:'Beheerlocatie',advice:'Advies',nuance:'Nuance',execution:'Uitvoering',
    nextStep:'Vervolgstap',sourceInternal:'Interne bron',extraSources:'Aanvullende bronnen',quantity:'Aantal of waarde',measurementDate:'Meetdatum',limitation:'Beperking van de meting',license2026:'Licentie 2026',aiPossibilities:'Mogelijke AI-functies',
    localAI:'AI lokaal ingeschakeld?',manager:'Beheer via',appRefs:'Beheerrelaties (app-ID’s)',audience:'Doelgroepen',availability:'Licentiebeschikbaarheid',accessStatus:'Toegang in schooltenant',sourceNotes:'Bronnotities',sourceCode:'Broncode',involvedRoles:'Betrokken rollen',known:'Bekend uit documenten',
    originalNumber:'Oorspronkelijk nummer',sourceRow:'Rij in export',moduleId:'Module-ID',usageContext:'Gebruikssituatie',m365Context:'Microsoft 365-context',
    version:'Bronversie',contentSha256:'SHA-256 van het bronbestand',rightsStatus:'Gebruiksrecht',rightsBasis:'Grondslag voor gebruik',allowedUse:'Toegestaan gebruik',scope:'Toepassingsgebied',retention:'Bewaarafspraak',approvalStatus:'Goedkeuring',approvedBy:'Goedgekeurd door',approvedAt:'Goedgekeurd op',approvalEvidence:'Bewijs van goedkeuring',nextReviewAt:'Opnieuw beoordelen op',referenceKeys:'Bijbehorende bronverwijzingen',
    sourceIds:'Gekoppelde bronnen',frameworkLinks:'Normbeoordelingen',approvalBinding:'Bevestigde bronversie',reviewBinding:'Bevestigde beoordeling',relations:'Verbanden',recordMeta:'Beoordelingsgegevens'
  };
  const PROTECTED=new Set(['id','originalNumber','sourceFields','otherDescription','provenance','sources','auditTrail','hardwareLinks','serviceLinks','relations','frameworkLinks','sourceMeta','recordMeta','sourceRefs','sourceIds','referenceKeys','approvalBinding','defaultPolicy']);
  const MULTILINE=/answer|aliases|description|action|explanation|attention|didactics|learning|evidence|processing|agreement|note|instructions|source|data|links|review|unknown|advice|formative|usageContext|m365Context|nuance|execution|nextStep|limitation|input|teacher|student|known|status/i;
  const typesByKey=Object.fromEntries(SPECS.map(s=>[s.key,s]));
  const model={drafts:new Map(),current:null,editing:false,adding:false,original:null,working:null,catalog:null,loading:false,contextMode:false,returnFocus:null,editSourceScope:null};
  const key=(type,id)=>type+':'+id;
  const text=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
  const copy=obj=>JSON.parse(JSON.stringify(obj));
  function entry(type,id){const spec=typesByKey[type];return spec&&state[spec.store] instanceof Map?state[spec.store].get(id):null;}
  function record(type,id){const draft=model.drafts.get(key(type,id));return draft?draft.after:entry(type,id);}
  function records(type){
    const spec=typesByKey[type];if(!spec)return[];
    const map=new Map([...(state[spec.store]?.values()||[])].map(r=>[r.id,r]));
    for(const draft of model.drafts.values())if(draft.type===type)map.set(draft.id,draft.after);
    return [...map.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'nl'));
  }
  function availableTargets(){
    return SPECS.flatMap(spec=>records(spec.key).map(r=>({type:spec.key,id:r.id,label:spec.label+' · '+r.name+' ('+r.id+')'})));
  }
  function reviewInput(replacement){
    const profile=window.IctOrganisation.profile,registers={};
    for(const type of Object.keys(profile.source.registerFiles)){
      registers[type]=records(type).map(copy);
      if(replacement?.type===type){
        const index=registers[type].findIndex(item=>item.id===replacement.data.id);
        if(index<0)registers[type].push(copy(replacement.data));else registers[type][index]=copy(replacement.data);
      }
    }
    return window.AssuranceAdapter.fromRegisters(profile,registers,model.catalog,{asOf:new Date().toISOString().slice(0,10),sourceVersion:''});
  }
  function reviewState(record,link){
    if(!['Onderbouwd','Niet van toepassing'].includes(link.status))return '';
    try{
      const input=reviewInput({type:model.current.type,data:record});
      const wrapper=input.records.find(item=>item.type===model.current.type&&item.id===record.id);
      const result=window.AssuranceEngine.inspectReviewBinding(input,wrapper,link);
      return {current:'Bevestigd voor deze gegevens',missing:'Nog niet aan deze gegevens bevestigd',stale:'Gegevens of beoordeling gewijzigd: opnieuw beoordelen',invalid:'Versiekoppeling ongeldig'}[result.status]||'Opnieuw beoordelen';
    }catch(_){return 'Versiekoppeling niet gecontroleerd';}
  }
  function sourceApprovalState(record){
    if(record.approvalStatus!=='Goedgekeurd')return '';
    try{
      const input=reviewInput({type:'sourceRegister',data:record});
      const source=input.records.find(item=>item.type==='sourceRegister'&&item.id===record.id);
      const result=window.AssuranceSourceRegister.inspectApprovalBinding(source.data,input.context);
      return {current:'Goedkeuring bevestigd voor deze bronversie',missing:'Bevestiging voor deze bronversie ontbreekt',stale:'Brongegevens gewijzigd: opnieuw goedkeuren',invalid:'Goedkeuring heeft een ongeldige versiekoppeling'}[result.status]||'Opnieuw goedkeuren';
    }catch(_){return 'Versiekoppeling niet gecontroleerd';}
  }
  function label(field,source){return IctScanTaxonomy.fieldLabel(field,source,labels[field]||field.replace(/([a-z])([A-Z])/g,'$1 $2'));}
  function provenanceText(value){
    const rows=Array.isArray(value)?value:value==null?[]:[value];
    return rows.map(row=>{
      if(!row||typeof row!=='object')return String(row??'');
      const parts=[row.file,row.sheet,row.row].filter(part=>part!==undefined&&part!==null&&part!=='');
      return parts.length?parts.join(' / '):JSON.stringify(row);
    }).filter(Boolean).join('; ');
  }
  function specFor(type){const spec=typesByKey[type];if(!spec)throw Error('Onbekend register: '+type);return spec;}
  function nextId(spec){
    const suffixes=records(spec.key).map(r=>Number((String(r.id||'').match(new RegExp('^'+spec.prefix+'-(\\d+)$'))||[])[1])).filter(Number.isFinite);
    const num=Math.max(0,...suffixes)+1;return spec.prefix+'-'+String(num).padStart(spec.prefix==='SRC'?5:spec.prefix==='DPIA'||spec.prefix==='C'||spec.prefix==='B'?2:3,'0');
  }
  function fillTypeSelect(){
    const list=$c('cardTypeFilter');list.replaceChildren();
    for(const spec of SPECS){if(!window.IctOrganisation.profile?.source.registerFiles[spec.key])continue;const o=text('option','',spec.label);o.value=spec.key;list.append(o);}
  }
  function showList(){
    const type=$c('cardTypeFilter').value,query=$c('cardSearch').value.trim().toLocaleLowerCase('nl-NL');
    const list=$c('cardBrowserList');list.replaceChildren();
    const items=records(type).filter(r=>([r.id,r.name,r.description,r.action,r.status,r.local].filter(Boolean).join(' ')).toLocaleLowerCase('nl-NL').includes(query));
    for(const r of items){
      const button=text('button','card-browser-item');button.type='button';
      if(model.current?.type===type&&model.current?.id===r.id)button.classList.add('active');
      button.append(text('small','',r.id),text('strong','',r.name||'Zonder naam'));
      if(model.drafts.has(key(type,r.id)))button.append(text('em','','Concept'));
      button.addEventListener('click',()=>open(type,r.id,false,'manager'));
      list.append(button);
    }
    if(!items.length)list.append(text('p','card-empty','Geen registraties bij deze selectie.'));
  }
  function showPane(){
    const recordObj=model.working|| (model.current?record(model.current.type,model.current.id):null);
    $c('cardRecordId').textContent=recordObj?.id||'';
    $c('cardRecordName').textContent=recordObj?.name||'Kies een registratie';
    $c('cardRecordContext').textContent=model.current?specFor(model.current.type).label:'';
    $c('cardEditButton').hidden=!recordObj||model.editing;
    $c('cardNewFromRecord').hidden=!recordObj||model.editing;
    $c('cardForm').hidden=!model.editing;
    $c('cardReadView').hidden=model.editing;
    $c('cardJsonPanel').hidden=true;
    $c('cardJson').textContent=recordObj?JSON.stringify(recordObj,null,2):'';
    $c('cardEditor').classList.toggle('card-context-mode',!!model.contextMode);
    
    if(!model.editing)showRead(recordObj);
    else showForm();
    showPending();
    const pending=$c('cardPendingPanel');
    if(pending)pending.hidden=model.contextMode&&!model.editing&&model.drafts.size===0;
  }
  function lines(container,title,items,showUnknown=false){
    const group=text('section','card-read-section');if(title)group.append(text('h4','',title));
    const dl=text('dl','card-read-grid');
    for(const [name,value] of items){
      const missing=value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length);
      if(missing&&!showUnknown)continue;
      // Alleen een weergavelabel. Een onbekend bronveld blijft leeg in de JSON en in de controles.
      const dt=text('dt','',name),dd=text('dd','',missing?'Onbekend':typeof value==='object'?JSON.stringify(value,null,2):value);
      dl.append(dt,dd);
    }
    if(dl.children.length){group.append(dl);container.append(group);}
  }
  function showRead(r){
    const container=$c('cardReadView');
    container.replaceChildren();
    if(!r){
      container.append(text('p','card-empty','Kies een registratie. De details verschijnen hier.'));
      $c('cardJsonPanel').hidden=true;
      return;
    }
    const spec=specFor(model.current.type);
    const important={
      apps:['description','local','owner','area','kind','reviewAction'],
      ai:['product','action','phase','teacher','local','unknown'],
      connections:['enabled','matched','assessment','local'],
      devices:['quantity','measurementDate','limitation'],
      hardwareGroups:['category','users','manager','owner','status','quantity','description'],
      dpia:['assessment','sourceDate','evidence','local'],
      aiControls:['advice','managementLocation','execution','nextStep'],
      additionalCandidates:['kind','status','action','priority'],
      checks:['category','status','explanation','priority'],
      sourceRegister:['owner','version','rightsStatus','allowedUse','approvalStatus','approvedBy','approvedAt']
    };
    const first=(important[spec.key]||['description','local','status','action','owner','priority'])
      .filter(k=>spec.key==='sourceRegister'||(k in r && r[k]!==undefined && r[k]!==null && String(r[k]).trim()));
    const other=spec.fields.filter(k=>k!=='name'&&!first.includes(k)&&!['aiRefs','sourceDescription','sourceNotes','sourceCode','sourceInternal','supplierSource','source'].includes(k));
    const nav=text('nav','card-read-tabs');nav.setAttribute('role','tablist');
    nav.setAttribute('aria-label','Inhoud van de registratie');
    const panes=new Map(),tabs=new Map();
    const sections=[
      ['overview','Overzicht'],['details','Meer gegevens'],['links','Verbanden']
    ];
    for(const [id,name] of sections){
      const panel=text('section','card-tab-panel');
      panel.dataset.cardTab=id;panel.id='cardTabPanel'+id;
      panel.hidden=id!=='overview';panel.setAttribute('role','tabpanel');
      const button=text('button','card-read-tab'+(id==='overview'?' active':''),name);
      button.type='button';button.dataset.target=id;
      button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
      button.setAttribute('aria-selected',String(id==='overview'));
      button.tabIndex=id==='overview'?0:-1;
      nav.append(button);panes.set(id,panel);tabs.set(id,button);
    }
    const overview=panes.get('overview');
    lines(overview,'',first.map(k=>[label(k,r),r[k]]),spec.key==='sourceRegister');
    if(spec.key==='sourceRegister')lines(overview,'Bronbeoordeling',[['Goedkeuringsstatus',sourceApprovalState(r)]]);
    if((spec.key==='apps'||spec.key==='parts')&&r.defaultPolicy){
      const p=r.defaultPolicy;
      lines(overview,'Standaardinstellingen volgens Microsoft',[
        ['Medewerkers / docenten',p.staff],['Leerlingen',p.students],
        ['KlasTeams',p.classTeams],['Voorwaarde',p.condition],['Licentie-uitgangspunt',p.licenseBasis],
        ['Bewijsstatus',p.evidenceStatus],
        ['Werkelijke toegang in schooltenant',p.verifiedInTenant===true?'Gecontroleerd':'Niet onafhankelijk gecontroleerd']
      ]);
    }
    if(spec.key==='apps'&&Object.prototype.hasOwnProperty.call(r,'processorAgreement')){
      lines(overview,'Verwerkersovereenkomst: beoordelingsroute',[
        ['Route','Dienst Verwerkersovereenkomsten Kennisnet (https://dv.kennisnet.nl/), voor aangesloten leveranciers'],
        ['Toegang','eHerkenning: beoordelen DV of beheren voor beoordeling; ondertekenen vereist afzonderlijke machtiging'],
        ['Beoordeling','Controleer overeenkomst, privacybijsluiter, beveiligingsbijlage en afwijkingen'],
        ['Besluit','Bevoegd ondertekenaar accordeert; status en ondertekenbewijs pas na afronding vastleggen'],
        ['Andere leveranciers','Bijvoorbeeld Microsoft: toepasselijke DPA afzonderlijk beoordelen']
      ]);
    }

    if(spec.key==='apps'){const ix=window.IctInventoryIndex?.build(state);
      if(ix)lines(overview,'AI-functies',[['Beschreven functies',ix.connected('apps',r.id,{type:'ai'}).length]]);
    }
    if(!overview.children.length)overview.append(text('p','card-empty','Voor deze registratie zijn nog geen hoofdgegevens ingevuld.'));
    const details=panes.get('details');
    lines(details,'',other.map(k=>[label(k,r),r[k]]),spec.key==='sourceRegister');
    const hiddenFields=new Set([...spec.fields,'id','originalNumber','sourceFields','otherDescription','provenance','sources','auditTrail','hardwareLinks','serviceLinks','relations','frameworkLinks','recordMeta','sourceMeta','sourceRefs','sourceIds','referenceKeys','approvalBinding']);
    const extras=Object.keys(r).filter(k=>!hiddenFields.has(k)).map(k=>[label(k,r),r[k]]);
    if(extras.length)lines(details,'Overige gegevens',extras);
    if(!details.children.length)details.append(text('p','card-empty','Geen aanvullende gegevens.'));
    const links=panes.get('links');
    const ix=window.IctInventoryIndex?.build(state);
    const relations=ix?ix.connected(spec.key,r.id):[];
    const references=Array.isArray(r.frameworkLinks)?r.frameworkLinks:[];
    const catalog=new Map((model.catalog?.references||[]).map(x=>[x.id,x]));
    const relationNames=new Map((model.catalog?.relationTypes||[]).map(x=>[x.id,x.label]));
    lines(links,'Verbanden ('+relations.length+')',relations.length
      ?relations.map(x=>[
        (relationNames.get(x.relationType)||x.relationType)+' · '+(x.other?.name||x.otherId)+' ('+x.otherId+')',
        (x.status||'Niet vastgesteld')+' · '+(x.direction==='incoming'?'Relatie naar deze registratie':'Relatie vanuit deze registratie')+
        (x.note?' · '+x.note:'')
      ])
      :[['Verbanden','Geen vastgelegde relatie in de ingelezen index']]);
    lines(links,'Normbeoordelingen',references.length
      ?references.map(x=>[(catalog.get(x.frameworkId)?.name||x.frameworkId)+' '+(x.article||''),
        [x.status||'Nog te beoordelen',reviewState(r,x),x.note,
        x.role&&'Rol: '+x.role,x.reviewedBy&&'Beoordeeld door: '+x.reviewedBy,
        x.reviewedAt&&'Beoordeeld: '+x.reviewedAt,
        x.nextReviewAt&&'Volgende beoordeling: '+x.nextReviewAt,
        x.followUp&&'Actie: '+x.followUp,
        x.followUpOwner&&'Actiehouder: '+x.followUpOwner,
        x.followUpStatus&&'Opvolging: '+x.followUpStatus].filter(Boolean).join(' · ')])
      :[['Normen','Nog niet per bepaling beoordeeld']]);
    // Bronverwijzingen blijven in het bronregister en worden niet in deze
    // publiek zichtbare kaart uitgegeven. Zij blijven onderdeel van de review.
    function activate(key){
      for(const [name,panel] of panes)panel.hidden=name!==key;
      for(const [name,tab] of tabs){
        const active=name===key;tab.classList.toggle('active',active);
        tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      }
      $c('cardJsonPanel').hidden=true;
      $c('cardJsonPanel').open=false;
      $c('cardEditSurface').scrollTop=0;
    }
    const names=sections.map(([id])=>id);
    for(const [index,id] of names.entries()){
      const button=tabs.get(id);
      button.addEventListener('click',()=>activate(id));
      button.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const next=e.key==='Home'?0:e.key==='End'?names.length-1:
          (index+(e.key==='ArrowRight'?1:names.length-1))%names.length;
        activate(names[next]);tabs.get(names[next]).focus();
      });
    }
    container.append(nav,...panes.values());
    activate('overview');
  }
  function inputControl(name,value,group,record){
    const outer=text('label','card-field'),title=text('span','card-field-label',model.current?.type==='sourceRegister'&&name==='owner'?'Bronhouder':label(name,record));
    if(value!==null&&typeof value==='object'){
      const output=text('pre','card-original-json',JSON.stringify(value,null,2));
      outer.append(title,text('span','card-help','Gestructureerde gegevens blijven bij deze bewerking behouden.'),output);
      return outer;
    }
    const choice=model.current?.type==='sourceRegister'?{rightsStatus:window.AssuranceSourceRegister?.RIGHTS_STATUSES,approvalStatus:window.AssuranceSourceRegister?.APPROVAL_STATUSES}[name]:null;
    const multiline=!choice&&(MULTILINE.test(name)||String(value||'').length>130);
    const input=document.createElement(choice?'select':multiline?'textarea':'input');
    input.name=name;input.dataset.field=name;
    if(choice){options(input,[['','Nog vaststellen'],...choice.map(item=>[item,item]),...(value&&!choice.includes(value)?[[value,value]]:[])],value||'');}
    else if(multiline){input.rows=String(value||'').length>250?4:2;}
    else{input.type=model.current?.type==='sourceRegister'&&['approvedAt','nextReviewAt'].includes(name)?'date':'text';input.autocomplete='off';}
    input.value=typeof value==='boolean'?String(value):String(value??'');
    if(model.current?.type==='sourceRegister'&&!choice&&!String(value??'').trim())input.placeholder='Onbekend';
    if(name==='name')input.required=true;
    if(name==='parentId'||name==='matchedId'||name==='parent'||name==='connectionId'){
      input.setAttribute('list','cardKnownIds');input.title='Gebruik een bestaand ID, geen nieuwe naam';
    }
    outer.append(title,input);return outer;
  }
  function options(select,items,selected){
    select.replaceChildren();
    for(const [value,name] of items){const el=text('option','',name);el.value=value;select.append(el);}
    if(selected!==undefined)select.value=selected;
  }
  function relationRow(obj){
    const row=text('div','card-linked-row');row.dataset.group='relation';
    row.sourceValue=copy(obj);
    const type=text('select','');type.dataset.part='targetType';
    options(type,SPECS.map(s=>[s.key,s.label]),obj.targetType||'apps');
    const target=text('select','');target.dataset.part='targetId';
    const kind=text('select','');kind.dataset.part='relationType';
    options(kind,(model.catalog?.relationTypes||[]).map(x=>[x.id,x.label]),obj.relationType||'uses');
    const status=text('select','');status.dataset.part='status';
    options(status,(model.catalog?.relationStatuses||[]).map(x=>[x,x]),obj.status||'Vermoedelijk');
    function rebuild(){options(target,records(type.value).map(r=>[r.id,r.name+' · '+r.id]),obj.targetId||undefined);}
    type.addEventListener('change',()=>{obj.targetId='';rebuild();});
    rebuild();
    const evidence=text('input','');evidence.dataset.part='evidence';evidence.placeholder='Bron of document';evidence.value=obj.evidence||'';
    const note=text('input','');note.dataset.part='note';note.placeholder='Wat is vastgesteld?';note.value=obj.note||'';
    const remove=text('button','card-remove-row','×');remove.type='button';remove.title='Verband verwijderen';remove.addEventListener('click',()=>row.remove());
    row.append(type,target,kind,status,evidence,note,remove);return row;
  }
  function frameworkRow(obj){
    const row=text('div','card-linked-row');row.dataset.group='framework';
    row.sourceValue=copy(obj);
    const reference=text('select','');reference.dataset.part='frameworkId';
    options(reference,(model.catalog?.references||[]).map(x=>[x.id,x.name]),obj.frameworkId||'IBP');
    const article=text('input','');article.dataset.part='article';article.value=obj.article||'';article.placeholder='Normcode of artikel';
    const status=text('select','');status.dataset.part='status';options(status,(model.catalog?.statuses||[]).map(x=>[x,x]),obj.status||'Nog te beoordelen');
    const evidence=text('input','');evidence.dataset.part='evidence';evidence.value=obj.evidence||'';evidence.placeholder='Bewijs of bron';
    const note=text('input','');note.dataset.part='note';note.value=obj.note||'';note.placeholder='Beoordeling en maatregel';
    const remove=text('button','card-remove-row','×');remove.type='button';remove.title='Toetsing verwijderen';remove.addEventListener('click',()=>row.remove());
    for(const [input,name] of [[reference,'Toetsingskader'],[article,'Normcode of artikel'],[status,'Beoordelingsstatus'],[evidence,'Bewijs of bron'],[note,'Beoordeling en maatregel']])input.setAttribute('aria-label',name);
    const review=text('details','card-framework-review');
    review.append(text('summary','','Controle en opvolging'));
    const grid=text('div','card-framework-review-fields');
    const choices={role:window.AssuranceRecord.roles,followUpStatus:window.AssuranceRecord.followUpStatuses};
    for(const [part,name] of [['role','Rol van de organisatie'],['reviewedBy','Beoordeeld door'],['reviewedAt','Beoordeeld op'],['nextReviewAt','Volgende beoordeling'],['followUp','Vervolgactie'],['followUpOwner','Actiehouder'],['followUpStatus','Status van de actie'],['completionEvidence','Bewijs van uitvoering']]){
      const field=text('label','card-field'),control=text(choices[part]?'select':'input');
      control.dataset.part=part;
      if(choices[part])options(control,[['','Nog vaststellen'],...choices[part].map(value=>[value,value])],obj[part]||'');
      else{control.type=/At$/.test(part)?'date':'text';control.value=obj[part]||'';control.autocomplete='off';}
      field.append(text('span','card-field-label',name),control);grid.append(field);
    }
    const confirmation=text('label','card-confirm-review'),confirm=text('input');confirm.type='checkbox';confirm.dataset.part='confirmReviewBinding';confirm.checked=false;
    confirmation.append(confirm,text('span','','Ik bevestig deze beoordeling voor de ingevulde gegevens en gekoppelde bronnen.'));
    review.append(grid,confirmation);
    if(obj.reviewBinding)review.append(text('p','card-help',reviewState(model.working||record(model.current.type,model.current.id),obj)));
    status.addEventListener('change',()=>{if(['Onderbouwd','Niet van toepassing'].includes(status.value))review.open=true;});
    const hint=text('p','card-help');
    function updateHint(){hint.textContent=reference.value==='EN18286'?'EN 18286: bepaal eerst de rol en toepasselijkheid per systeem. Voor Onderbouwd zijn een rol, beoordelaar, datum en bewijs nodig.':'';hint.hidden=!hint.textContent;}
    reference.addEventListener('change',updateHint);updateHint();
    row.append(reference,article,status,evidence,note,remove,review,hint);return row;
  }
  function sourceRow(id=''){
    const row=text('div','card-source-row');row.dataset.group='source';
    const select=text('select');select.dataset.part='sourceId';select.setAttribute('aria-label','Gekoppelde bron');
    const sources=records('sourceRegister');
    const choices=[['','Kies een bron'],...sources.map(item=>[item.id,item.name+' · '+item.id])];
    if(id&&!sources.some(item=>item.id===id))choices.push([id,'Niet gevonden · '+id]);
    options(select,choices,id);
    const remove=text('button','card-remove-row','×');remove.type='button';remove.title='Bronkoppeling verwijderen';remove.addEventListener('click',()=>row.remove());
    row.append(select,remove);return row;
  }
  function showForm(){
    const r=model.working,spec=specFor(model.current.type);
    const holder=$c('cardFormFields');holder.replaceChildren();
    const grid=text('div','card-input-grid');
    const fields=[...new Set(['name',...spec.fields,...Object.keys(r).filter(k=>!PROTECTED.has(k))])];
    for(const field of fields){
      if(PROTECTED.has(field))continue;
      if(spec.key==='ai'&&IctScanTaxonomy.fieldStatus(r,field)==='niet-van-toepassing'&&!String(r[field]??'').trim())continue;
      grid.append(inputControl(field,r[field],undefined,r));
    }
    holder.append(grid);
    const links=text('section','card-form-section');links.append(text('h4','','Onderlinge verbanden'));
    links.append(text('p','card-help','Koppel twee bestaande registraties en geef aan waarop het verband berust.'));
    const relRows=text('div','card-form-rows');relRows.id='cardRelationRows';
    for(const link of r.relations||[])relRows.append(relationRow(link));
    links.append(relRows);
    const addRel=text('button','card-button card-button-subtle','+ Verband');addRel.type='button';addRel.addEventListener('click',()=>relRows.append(relationRow({})));links.append(addRel);
    holder.append(links);
    const laws=text('section','card-form-section');laws.append(text('h4','','IBP, AVG, AI Act en andere regels'));
    laws.append(text('p','card-help','Kies een kader én een concrete norm of bepaling. Geef een eigen beoordeling, niet automatisch een nalevingsoordeel.'));
    const frameworkRows=text('div','card-form-rows');frameworkRows.id='cardFrameworkRows';
    for(const row of r.frameworkLinks||[])frameworkRows.append(frameworkRow(row));
    laws.append(frameworkRows);
    const addLaw=text('button','card-button card-button-subtle','+ Toetsing');addLaw.type='button';addLaw.addEventListener('click',()=>frameworkRows.append(frameworkRow({})));laws.append(addLaw);
    const refs=text('div','card-framework-refs');
    for(const item of model.catalog?.references||[]){const a=text('a','',item.id);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.title=item.name+' · bron openen';refs.append(a);}
    laws.append(refs);holder.append(laws);
    const evidence=text('section','card-form-section');evidence.append(text('h4','','Herkomst en opvolging'));
    if(spec.key==='sourceRegister'){
      const field=text('label','card-field'),input=text('textarea');input.name='referenceKeys';input.rows=4;input.value=Array.isArray(r.referenceKeys)?r.referenceKeys.join('\n'):String(r.referenceKeys??'');
      input.originalReferenceText=input.value;
      field.append(text('span','card-field-label','Bijbehorende bronverwijzingen, één per regel'),input);evidence.append(field);
      const confirmation=text('label','card-confirm-review'),confirm=text('input');confirm.type='checkbox';confirm.name='confirmSourceApproval';confirm.checked=false;
      confirmation.append(confirm,text('span','','Ik keur deze bronversie goed voor het vastgelegde gebruik.'));evidence.append(confirmation);
      if(r.approvalBinding)evidence.append(text('p','card-help',sourceApprovalState(r)));
    }else if(window.IctOrganisation.profile.source.registerFiles.sourceRegister){
      const sourceRows=text('div','card-form-rows');sourceRows.id='cardSourceRows';
      for(const id of r.sourceIds||[])sourceRows.append(sourceRow(id));
      const addSource=text('button','card-button card-button-subtle','+ Bron koppelen');addSource.type='button';addSource.addEventListener('click',()=>sourceRows.append(sourceRow()));
      evidence.append(text('h4','','Gekoppelde bronnen'),sourceRows,addSource);
    }
    const meta=r.recordMeta||{};
    for(const [field,lbl] of [['sourceSystem','Oorspronkelijke bron / leverancier'],['externalId','Oorspronkelijk bron-ID'],['referenceDate','Peildatum (jjjj-mm-dd)'],['rights','Gebruiksrecht / publicatie'],['confidentiality','Vertrouwelijkheid']]){
      const labelEl=text('label','card-field'),title=text('span','card-field-label',lbl),inp=text('input','');
      inp.name='recordMeta.'+field;inp.value=meta[field]||'';inp.autocomplete='off';labelEl.append(title,inp);evidence.append(labelEl);
    }
    const extraSource=text('label','card-field'),sourceTitle=text('span','card-field-label','Nieuwe bronverwijzing (bestaande blijven behouden)'),sourceInput=text('input','');
    sourceInput.name='newSourceReference';sourceInput.placeholder='Bestand, document, URL of registratie-ID';sourceInput.autocomplete='off';extraSource.append(sourceTitle,sourceInput);evidence.append(extraSource);
    const reason=text('label','card-field'),title=text('span','card-field-label','Toelichting bij deze wijziging'),textarea=text('textarea','');
    textarea.name='changeReason';textarea.rows=3;textarea.required=true;textarea.placeholder='Wat is aangepast, waarom en op basis van welke bron?';
    textarea.value=model.drafts.get(key(model.current.type,r.id))?.reason||'';
    reason.append(title,textarea);evidence.append(reason);
    const frozen=text('details','card-details');frozen.append(text('summary','','Oorspronkelijke bronvelden (ongewijzigd)'));
    const code=text('pre','card-original-json',JSON.stringify({sources:r.sources||[],provenance:r.provenance||[],sourceFields:r.sourceFields||{},otherDescription:r.otherDescription||{}},null,2));
    frozen.append(code);evidence.append(frozen);holder.append(evidence);
    const datalist=text('datalist');datalist.id='cardKnownIds';
    for(const row of availableTargets()){const o=text('option');o.value=row.id;o.label=row.label;datalist.append(o);}
    holder.append(datalist);
  }
  function parseRows(id,parts){
    return [...$c(id).children].filter(x=>x.dataset.group).map(row=>{
      const result=copy(row.sourceValue||{});
      for(const part of parts){const value=row.querySelector('[data-part="'+part+'"]')?.value.trim()||'';if(value||Object.prototype.hasOwnProperty.call(result,part))result[part]=value;}
      return result;
    });
  }
  function collect(){
    if(!model.working||!model.current)throw Error('Kies eerst een registratie.');
    const r=copy(model.working);
    for(const input of $c('cardFormFields').querySelectorAll('[data-field]')){
      const field=input.dataset.field;
      const raw=input.value.trim();
      if(!raw&&(r[field]===undefined||r[field]===null)){if(r[field]!==null)delete r[field];continue;}
      if(typeof r[field]==='boolean'){if(!['true','false'].includes(raw.toLowerCase()))throw Error(label(field)+' moet true of false zijn.');r[field]=raw.toLowerCase()==='true';}
      else if(typeof r[field]==='number'){if(raw!==''&&!Number.isFinite(Number(raw)))throw Error(label(field)+' moet een getal zijn.');r[field]=raw===''?null:Number(raw);}
      else r[field]=raw;
    }
    const relations=parseRows('cardRelationRows',['targetType','targetId','relationType','status','evidence','note']);
    if(relations.length||Object.prototype.hasOwnProperty.call(r,'relations'))r.relations=relations;
    r.frameworkLinks=parseRows('cardFrameworkRows',window.AssuranceRecord.fields);
    const referenceKeys=$c('cardFormFields').querySelector('[name="referenceKeys"]');
    if(model.current.type==='sourceRegister'&&referenceKeys&&(!Array.isArray(r.referenceKeys)||referenceKeys.value!==referenceKeys.originalReferenceText)){
      const values=referenceKeys.value.split(/\r\n|\n|\r/).filter(value=>value!=='');
      if(values.some(value=>!value.trim()))throw Error('Een bronverwijzing bevat alleen spaties. Vul de verwijzing in of verwijder de lege regel.');
      r.referenceKeys=values;
    }
    if(model.current.type!=='sourceRegister'&&window.IctOrganisation.profile.source.registerFiles.sourceRegister){
      const ids=[...$c('cardSourceRows').children].map(row=>row.querySelector('[data-part="sourceId"]')?.value||'').filter(Boolean);
      if(ids.length||Object.prototype.hasOwnProperty.call(r,'sourceIds'))r.sourceIds=ids;
    }
    const sourceInput=$c('cardFormFields').querySelector('[name="newSourceReference"]');
    if(sourceInput&&sourceInput.value.trim())r.sources=[...new Set([...(r.sources||[]),sourceInput.value.trim()])];
    const recordMeta={...(r.recordMeta||{})};
    for(const input of $c('cardFormFields').querySelectorAll('[name^="recordMeta."]')){const field=input.name.slice(11);if(input.value.trim())recordMeta[field]=input.value.trim();else delete recordMeta[field];}
    if(Object.keys(recordMeta).length||Object.prototype.hasOwnProperty.call(r,'recordMeta'))r.recordMeta=recordMeta;
    const reason=$c('cardFormFields').querySelector('[name="changeReason"]').value.trim();
    if(!r.name?.trim())throw Error('Naam is verplicht.');
    if(!reason||reason.length<8)throw Error('Beschrijf de wijziging en de herkomst in minimaal acht tekens.');
    if(r.recordMeta?.referenceDate&&!window.AssuranceRecord.validDate(r.recordMeta.referenceDate))throw Error('Peildatum moet een bestaande datum zijn (jjjj-mm-dd).');
    const targets=new Set(availableTargets().map(x=>key(x.type,x.id)));
    const seen=new Set();
    for(const rel of r.relations||[]){
      if(!rel.targetId||!targets.has(key(rel.targetType,rel.targetId)))throw Error('Een verband verwijst niet naar een bestaande registratie.');
      if(rel.targetType===model.current.type&&rel.targetId===r.id)throw Error('Een registratie kan niet naar zichzelf verwijzen.');
      if(!model.catalog.relationTypes.some(x=>x.id===rel.relationType))throw Error('Onbekend relatietype.');
      const relKey=[rel.targetType,rel.targetId,rel.relationType].join('/');
      if(seen.has(relKey))throw Error('Dubbel verband in deze kaart.');
      seen.add(relKey);
      if(rel.status==='Bevestigd'&&!rel.evidence)throw Error('Een bevestigd verband vereist bronbewijs.');
    }
    for(const [index,link] of r.frameworkLinks.entries()){
      const errors=window.AssuranceRecord.validate(link,{catalog:model.catalog,asOf:new Date().toISOString().slice(0,10)});
      if(errors.length){const row=$c('cardFrameworkRows').children[index];const detail=row.querySelector('details');if(detail)detail.open=true;row.querySelector('[data-part="'+errors[0].field+'"]')?.focus();throw Error(errors[0].message);}
    }
    const input=reviewInput({type:model.current.type,data:r});
    const wrapper=input.records.find(item=>item.type===model.current.type&&item.id===r.id);
    if(model.current.type==='sourceRegister'){
      const confirmed=$c('cardFormFields').querySelector('[name="confirmSourceApproval"]')?.checked;
      if(confirmed){
        r.approvalBinding=window.AssuranceSourceRegister.createApprovalBinding(wrapper.data,input.context);
        wrapper.data.approvalBinding=copy(r.approvalBinding);
      }
      const errors=window.AssuranceSourceRegister.validate(wrapper.data,input.context);
      const invalid=errors.find(item=>item.severity==='fail'&&item.category!=='business');if(invalid)throw Error(invalid.message);
      const decision=record=>Object.fromEntries(['approvalStatus','approvedBy','approvedAt','approvalEvidence','nextReviewAt','approvalBinding'].filter(field=>Object.prototype.hasOwnProperty.call(record,field)).map(field=>[field,record[field]]));
      if(r.approvalStatus==='Goedgekeurd'&&window.AssuranceEngine.canonicalize(decision(model.working))!==window.AssuranceEngine.canonicalize(decision(r))&&!confirmed)throw Error('Bevestig de gewijzigde brongoedkeuring voor deze bronversie.');
    }
    for(const [index,link] of r.frameworkLinks.entries()){
      const row=$c('cardFrameworkRows').children[index],confirmed=row.querySelector('[data-part="confirmReviewBinding"]')?.checked;
      if(confirmed){
        if(!['Onderbouwd','Niet van toepassing'].includes(link.status))throw Error('Rond de beoordeling af voordat je deze bevestigt.');
        link.reviewBinding=window.AssuranceEngine.createReviewBinding(input,wrapper,link);
      }
      const original=row.sourceValue||{};
      if(['Onderbouwd','Niet van toepassing'].includes(link.status)&&window.AssuranceEngine.canonicalize(original)!==window.AssuranceEngine.canonicalize(link)){
        if(!confirmed)throw Error('Bevestig de gewijzigde beoordeling voor deze gegevens.');
        const binding=window.AssuranceEngine.inspectReviewBinding(input,wrapper,link);
        if(binding.status!=='current')throw Error('De beoordeling past niet bij deze gegevens. Controleer de bronkoppelingen en bevestig opnieuw.');
      }
    }
    const allText=JSON.stringify(r);
    if(/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{15,}|sk-proj-[A-Za-z0-9_-]{12,}/.test(allText))throw Error('De kaart lijkt een toegangssleutel te bevatten. Haal die eerst weg.');
    return {after:r,reason};
  }
  function diff(before,after){
    const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);
    return [...keys].filter(k=>!['auditTrail','sourceFields','provenance','otherDescription','id'].includes(k)&&JSON.stringify(before?.[k]??null)!==JSON.stringify(after?.[k]??null));
  }
  function saveDraft(){
    try{
      const result=collect(),id=model.current.id,type=model.current.type;
      const previous=model.drafts.get(key(type,id));
      const base=previous?previous.before:(model.adding?null:copy(model.original));
      const changed=diff(base,result.after);
      if(!changed.length){model.drafts.delete(key(type,id));feedback('Geen wijzigingen om te bewaren.');model.editing=false;model.working=null;showPane();return;}
      const sourceScope=previous?previous.sourceScope:model.editSourceScope;
      model.drafts.set(key(type,id),{type,id,after:result.after,before:base,changed,reason:result.reason,sourceScope,stagedAt:new Date().toISOString()});
      model.editing=false;model.working=null;
      feedback('Concept bewaard. De gepubliceerde inventaris is nog niet gewijzigd.');
      showList();showPane();
    }catch(error){feedback(error.message,true);}
  }
  function feedback(msg,bad=false){const el=$c('cardFeedback');el.textContent=msg;el.dataset.error=bad?'true':'false';}
  function showPending(){
    const drafts=[...model.drafts.values()];
    const count=drafts.length;$c('cardDraftCount').textContent=count?count+' conceptwijziging'+(count!==1?'en':''):'Geen conceptwijzigingen';
    $c('cardPending').hidden=!count;$c('cardPending').textContent=count;
    $c('cardUndo').hidden=!model.current||!model.drafts.has(key(model.current.type,model.current.id));
    $c('cardPublishToggle').hidden=!count;
    if(!count)$c('cardGithubPanel').hidden=true;
    const changes=$c('cardChangeSummary');changes.replaceChildren();
    for(const d of drafts){
      const line=text('div','card-change-line');
      line.append(text('strong','',d.after.name||d.id),text('span','',d.before?'Bijwerken':'Toevoegen'),text('small','',d.changed.map(label).join(', ')));
      const b=text('button','card-text-action','Open');b.type='button';b.addEventListener('click',()=>open(d.type,d.id));line.append(b);changes.append(line);
    }
  }
  function focusEditField(field){
    if(!field)return;
    const target=[...$c('cardFormFields').querySelectorAll('[data-field]')].find(el=>el.dataset.field===field);
    if(!target){feedback('Dit invulveld is nog niet beschikbaar op deze kaart.',true);return;}
    target.scrollIntoView({block:'center',behavior:'auto'});target.focus({preventScroll:true});
  }
  async function startEdit(fieldName){
    if(!model.current)return;
    const r=record(model.current.type,model.current.id);if(!r)return;
    if(!await window.EmmausEditGate?.request())return;
    const previous=model.drafts.get(key(model.current.type,model.current.id));
    model.original=copy(previous?previous.before:r);model.working=copy(r);model.editing=true;model.adding=!entry(model.current.type,model.current.id);
    model.editSourceScope=model.drafts.get(key(model.current.type,model.current.id))?.sourceScope??window.EmmausCardGitLogic.sourceScope(window.IctOrganisation.profile,state.sources);
    feedback('');showPane();focusEditField(typeof fieldName==='string'?fieldName:'');
  }
  async function open(type,id,edit=false,mode='context',fieldName=''){
    if($c('workspace').hidden)return;
    if(model.editing&&!confirm('Niet-bewaarde invoer verlaten?'))return;
    const spec=specFor(type);
    if(!record(type,id)){feedback('Registratie niet gevonden.',true);return;}
    model.returnFocus=document.activeElement;
    model.contextMode=!edit&&mode!=='manager';
    $c('cardEditor').hidden=false;$c('cardScrim').hidden=false;document.body.classList.add('record-card-open');
    model.current={type,id};model.editing=false;model.working=null;model.adding=false;
    $c('cardTypeFilter').value=type;$c('cardSearch').value='';
    showList();showPane();if(edit)await startEdit(fieldName);
  }
  async function create(){
    if(!await window.EmmausEditGate?.request())return;
    if(model.editing&&!confirm('Niet-bewaarde invoer verlaten?'))return;
    if(!state.ready){feedback('Laad eerst de brongegevens vanuit GitHub voordat je een nieuwe kaart maakt.',true);return;}
    const type=$c('cardTypeFilter').value,spec=specFor(type),id=nextId(spec);
    const source={id,name:'',relations:[],frameworkLinks:[],sources:[],recordMeta:{sourceSystem:'Handmatige registratie',referenceDate:new Date().toISOString().slice(0,10)}};
    if(type==='additionalCandidates')source.confirmed=false;
    if(type==='connections')source.usageConfirmed=false;
    model.current={type,id};model.working=source;model.original=null;model.adding=true;model.editing=true;model.contextMode=false;
    model.editSourceScope=window.EmmausCardGitLogic.sourceScope(window.IctOrganisation.profile,state.sources);
    $c('cardEditor').hidden=false;$c('cardScrim').hidden=false;
    document.body.classList.add('record-card-open');
    showList();showPane();
    $c('cardFormFields').querySelector('[name="name"]')?.focus();
  }
  function close(){
    if(model.editing&&!confirm('Niet-bewaarde invoer sluiten?'))return;
    model.editing=false;model.working=null;$c('cardEditor').hidden=true;$c('cardScrim').hidden=true;
    document.body.classList.remove('record-card-open');$c('cardGithubToken').value='';
    if(model.returnFocus?.isConnected)model.returnFocus.focus();else $c('cardOpen').focus();model.returnFocus=null;
  }
  function undo(){
    if(!model.current)return;
    const k=key(model.current.type,model.current.id);
    if(!model.drafts.has(k))return;
    model.drafts.delete(k);
    if(!entry(model.current.type,model.current.id)){model.current=null;model.editing=false;model.working=null;}
    showList();showPane();feedback('Concept hersteld. De brongegevens zijn ongewijzigd.');
  }
  async function init(){
    if(model.loading)return;
    model.loading=true;
    try{
      const profile=await window.IctOrganisation.ready;
      for(const spec of SPECS)spec.file=profile.source.registerFiles[spec.key];
      const response=await fetch('./frameworks.json',{cache:'no-store',credentials:'omit'});
      if(!response.ok)throw Error('Toetsingskaders niet beschikbaar (HTTP '+response.status+').');
      const catalog=await response.json();if(catalog.schema!=='eai-applicable-frameworks-v1')throw Error('Ongeldig toetsingskaderbestand.');
      model.catalog=catalog;
    }catch(e){
      model.catalog={references:[],relationTypes:[],statuses:[],relationStatuses:[]};
      feedback('Toetsingskaders konden niet worden gelezen: '+e.message,true);
    }
    fillTypeSelect();model.loading=false;
  }
  function launch(){
    model.contextMode=false;
    if(!$c('cardEditor').hidden){showList();showPane();return;}
    $c('cardEditor').hidden=false;$c('cardScrim').hidden=false;
    document.body.classList.add('record-card-open');
    $c('cardTypeFilter').value=model.current?.type||'apps';
    showList();showPane();
  }
  function logbookRows(){
    const rows=[];
    const meta=state.metadata||{};
    if(meta.firstInventoryStarted){
      rows.push({id:'START-2026',type:null,at:meta.firstInventoryStarted+'T00:00:00',actor:meta.compiledBy||'Samensteller',name:'Inventarisatie gestart',
        message:'Eerste inventarisatie van het applicatielandschap. Startdatum volgens GitHub-metadata.',initial:true});
    }
    for(const spec of SPECS){
      for(const record of state[spec.store].values()){
        for(const event of record.auditTrail||[]){
          rows.push({id:record.id,type:spec.key,at:event.timestamp||'',actor:event.actor||'Onbekend',name:record.name||record.id,
            message:(event.action||'Wijziging')+' · '+(event.fields||[]).map(label).join(', ')+(event.reason?' · '+event.reason:'')});
        }
      }
    }
    return rows.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  }
  function renderLogbook(){
    const target=$c('logbookList');if(!target)return;
    const rows=logbookRows(),query=$c('logbookSearch').value.trim().toLocaleLowerCase('nl-NL');
    const visible=rows.filter(x=>(x.at+' '+x.actor+' '+x.name+' '+x.message).toLocaleLowerCase('nl-NL').includes(query));
    $c('logbookCount').textContent=rows.filter(x=>!x.initial).length;
    target.replaceChildren();
    if(!visible.length){target.append(text('p','card-empty','Nog geen wijzigingsregels voor deze selectie.'));return;}
    for(const event of visible){
      const row=text('article','card-logbook-row');
      const stamp=text('span','card-logbook-date',event.at?new Date(event.at).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'}):'Datum onbekend');
      const name=text('strong','',event.name),actor=text('small','',event.actor),message=text('p','',event.message);
      row.append(stamp,name,actor,message);
      if(event.type){
        const link=text('button','card-text-action','Open kaart');
        link.type='button';link.addEventListener('click',()=>open(event.type,event.id));row.append(link);
      }
      target.append(row);
    }
  }
  const oldRenderSources=renderSources;
  renderSources=function(){oldRenderSources();renderLogbook();};
  $c('logbookSearch').addEventListener('input',renderLogbook);
  $c('cardOpen').addEventListener('click',launch);
  $c('cardEditorClose').addEventListener('click',close);
  $c('cardScrim').addEventListener('click',close);
  $c('cardTypeFilter').addEventListener('change',()=>{if(model.editing&&!confirm('Niet-bewaarde invoer verlaten?')){$c('cardTypeFilter').value=model.current.type;return;}model.current=null;model.editing=false;model.working=null;showList();showPane();});
  $c('cardSearch').addEventListener('input',showList);
  $c('cardNew').addEventListener('click',create);
  $c('cardNewFromRecord').addEventListener('click',create);
  $c('cardEditButton').addEventListener('click',()=>void startEdit());
  $c('cardCancelEdit').addEventListener('click',()=>{
    if(model.adding&&!entry(model.current.type,model.current.id)&&!model.drafts.has(key(model.current.type,model.current.id)))model.current=null;
    model.editing=false;model.working=null;showList();showPane();
  });
  $c('cardForm').addEventListener('submit',event=>{event.preventDefault();saveDraft();});
  $c('cardUndo').addEventListener('click',undo);
  $c('cardPublishToggle').addEventListener('click',()=>{
    $c('cardGithubPanel').hidden=!$c('cardGithubPanel').hidden;
    if(!$c('cardGithubPanel').hidden)$c('cardCommitMessage').focus();
  });
  $c('cardCopyJson').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($c('cardJson').textContent);feedback('JSON gekopieerd.');}
    catch(e){feedback('Kopiëren niet beschikbaar: '+e.message,true);}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!$c('cardEditor').hidden){event.preventDefault();close();}
  });
  document.addEventListener('ict-scan:local-restored',()=>{
    if(!$c('cardEditor').hidden&&!model.editing){showList();showPane();}
  });
  window.EmmausRecordCards=Object.freeze({
    open,launch,feedback,
    drafts:()=>[...model.drafts.values()].map(copy),
    clearPublished:submitted=>{
      if(!Array.isArray(submitted))throw Error('De gepubliceerde conceptversies ontbreken.');
      let cleared=0;
      for(const draft of submitted){
        const id=key(draft.type,draft.id),current=model.drafts.get(id);
        if(current&&JSON.stringify(current)===JSON.stringify(draft)){model.drafts.delete(id);cleared++;}
      }
      if(!model.editing){
        if(model.current&&!record(model.current.type,model.current.id))model.current=null;
        showList();showPane();
      }else showPending();
      const remaining=model.drafts.size;
      feedback('Wijzigingsvoorstel aangemaakt.'+(remaining?' Nieuwe conceptwijzigingen blijven bewaard.':'')+' De huidige tellingen veranderen pas na goedkeuring en synchronisatie.');
      return {cleared,remaining};
    },
    specs:SPECS.map(s=>({...s})),
    catalog:()=>model.catalog
  });
  fillTypeSelect();
  document.addEventListener('ict-scan:opened',()=>void init());
})();
