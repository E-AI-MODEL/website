'use strict';
/* One editable card for every 2026 register. Drafts never overwrite the verified dashboard.
   Inspired by the HOVI / OnderwijsIn mapping approach: source identity, fields,
   taxonomy relations and source evidence remain separate. */
(function(){
  const $c=id=>document.getElementById(id);
  const SPECS=[
    {key:'apps',store:'apps',label:'Toepassingen en diensten',prefix:'APP',file:'2026-applicatielandschap.json',fields:['name','description','area','process','kind','local','owner','users','data','links','processorAgreement','dpiaStatus','aiRefs','reviewAction','sourceDescription','suggestedParent','suggestedParentStatus']},
    {key:'ai',store:'ai',label:'AI-functies',prefix:'AI',file:'2026-applicatielandschap.json',fields:['name','product','supplier','parentId','domain','phase','action','input','teacher','student','reviewer','didactics','learning','attention','formative','unknown','steer','instructions','aiAct','aiActExplanation','local','users','defaultSetting','privacyStatus','processingAgreement','supplierSource']},
    {key:'connections',store:'connections',label:'Entra-registraties',prefix:'ENT',file:'2026-applicatielandschap.json',fields:['name','visible','enabled','registeredAt','assessment','matched','matchedId','category','priority','local','usageConfirmed']},
    {key:'parts',store:'parts',label:'Technische onderdelen',prefix:'MOD',file:'2026-applicatielandschap.json',fields:['name','parent','kind','description','local','connectionId']},
    {key:'additionalCandidates',store:'candidates',label:'Aanvullende kandidaten',prefix:'A',file:'2026-applicatielandschap.json',fields:['name','kind','status','priority','included','description','action','source','evidenceDate','confirmed']},
    {key:'checks',store:'checks',label:'Controles',prefix:'C',file:'2026-applicatielandschap.json',fields:['name','category','status','explanation','evidence','value','action']},
    {key:'dpia',store:'dpia',label:'DPIA en privacy',prefix:'DPIA',file:'2026-applicatielandschap.json',fields:['name','type','assessment','description','sourceDate','url','evidence','local']},
    {key:'aiControls',store:'aiControls',label:'AI-beheer',prefix:'B',file:'2026-applicatielandschap.json',fields:['name','domain','aiRefs','advice','description','knownUse','local','managementLocation','action','nuance','execution','nextStep','sourceInternal','supplierSource','extraSources']},
    {key:'devices',store:'devices',label:'Apparaatmetingen',prefix:'DEV',file:'2026-applicatielandschap.json',fields:['name','type','quantity','description','measurementDate','limitation']},
    {key:'licenseReview',store:'licenseReview',label:'Licenties ter controle',prefix:'LIC',file:'2026-applicatielandschap.json',fields:['name','domain','type','status','aiPossibilities','localAI','license2026','priority','action','sourceNotes','sourceCode']},
    {key:'workActions',store:'workActions',label:'Werkregisteracties',prefix:'WRK',file:'2026-werkregister.json',fields:['name','action','involvedRoles','status']},
    {key:'softwareReview',store:'softwareReview',label:'Softwarecontroles',prefix:'SWR',file:'2026-werkregister.json',fields:['name','known','action','status']},
    {key:'faqs',store:'faqs',label:'Veelgestelde vragen',prefix:'FAQ',file:'2026-faq.json',fields:['name','answer','aliases','topic','reference','status','reviewedAt']}
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
    localAI:'AI lokaal ingeschakeld?',sourceNotes:'Bronnotities',sourceCode:'Broncode',involvedRoles:'Betrokken rollen',known:'Bekend uit documenten',
    originalNumber:'Oorspronkelijk nummer',sourceRow:'Rij in export',moduleId:'Module-ID',usageContext:'Gebruikssituatie',m365Context:'Microsoft 365-context'
  };
  const PROTECTED=new Set(['id','originalNumber','sourceFields','otherDescription','provenance','sources','auditTrail','relations','frameworkLinks','sourceMeta','recordMeta','sourceRefs']);
  const MULTILINE=/answer|aliases|description|action|explanation|attention|didactics|learning|evidence|processing|agreement|note|instructions|source|data|links|review|unknown|advice|formative|usageContext|m365Context|nuance|execution|nextStep|limitation|input|teacher|student|known|status/i;
  const typesByKey=Object.fromEntries(SPECS.map(s=>[s.key,s]));
  const model={drafts:new Map(),current:null,editing:false,adding:false,original:null,working:null,catalog:null,loading:false};
  const key=(type,id)=>type+':'+id;
  const text=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
  const copy=obj=>JSON.parse(JSON.stringify(obj));
  function entry(type,id){const spec=typesByKey[type];return spec&&state[spec.store] instanceof Map?state[spec.store].get(id):null;}
  function record(type,id){const draft=model.drafts.get(key(type,id));return draft?draft.after:entry(type,id);}
  function records(type){
    const spec=typesByKey[type];if(!spec)return[];
    const map=new Map([...state[spec.store].values()].map(r=>[r.id,r]));
    for(const draft of model.drafts.values())if(draft.type===type)map.set(draft.id,draft.after);
    return [...map.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'nl'));
  }
  function availableTargets(){
    return SPECS.flatMap(spec=>records(spec.key).map(r=>({type:spec.key,id:r.id,label:spec.label+' · '+r.name+' ('+r.id+')'})));
  }
  function label(field){return labels[field]||field.replace(/([a-z])([A-Z])/g,'$1 $2');}
  function specFor(type){const spec=typesByKey[type];if(!spec)throw Error('Onbekend register: '+type);return spec;}
  function nextId(spec){
    const suffixes=records(spec.key).map(r=>Number((String(r.id||'').match(new RegExp('^'+spec.prefix+'-(\\d+)$'))||[])[1])).filter(Number.isFinite);
    const num=Math.max(0,...suffixes)+1;return spec.prefix+'-'+String(num).padStart(spec.prefix==='DPIA'||spec.prefix==='C'||spec.prefix==='B'?2:3,'0');
  }
  function fillTypeSelect(){
    const list=$c('cardTypeFilter');list.replaceChildren();
    for(const spec of SPECS){const o=text('option','',spec.label);o.value=spec.key;list.append(o);}
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
      button.addEventListener('click',()=>open(type,r.id));
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
    $c('cardJsonPanel').hidden=!recordObj;
    $c('cardJson').textContent=recordObj?JSON.stringify(recordObj,null,2):'';
    if(!model.editing)showRead(recordObj);
    else showForm();
    showPending();
  }
  function lines(container,title,items){
    const group=text('section','card-read-section');group.append(text('h4','',title));
    const dl=text('dl','card-read-grid');
    for(const [name,value] of items){
      if(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length))continue;
      const dt=text('dt','',name),dd=text('dd','',typeof value==='object'?JSON.stringify(value,null,2):value);
      dl.append(dt,dd);
    }
    if(dl.children.length){group.append(dl);container.append(group);}
  }
  function showRead(r){
    const container=$c('cardReadView');container.replaceChildren();
    if(!r){container.append(text('p','card-empty','Kies links een registratie of maak een nieuwe kaart.'));return;}
    const spec=specFor(model.current.type),main=spec.fields.filter(f=>f!=='name').map(f=>[label(f),r[f]]);
    lines(container,'Gegevens',main);
    const used=new Set([...spec.fields,'id','originalNumber','sourceFields','otherDescription','provenance','sources','auditTrail','relations','frameworkLinks','recordMeta','sourceMeta','sourceRefs']);
    const extras=Object.keys(r).filter(k=>!used.has(k)).map(k=>[label(k),r[k]]);
    if(extras.length){const advanced=text('details','card-details'),summary=text('summary','','Aanvullende velden ('+extras.length+')');advanced.append(summary);lines(advanced,'Overige gegevens',extras);container.append(advanced);}
    const relations=Array.isArray(r.relations)?r.relations:[];
    const fLinks=Array.isArray(r.frameworkLinks)?r.frameworkLinks:[];
    const meta=r.recordMeta||{};
    const rels=relations.map(x=>[x.relationType+' → '+x.targetType+':'+x.targetId,x.status+' · '+(x.evidence||'Bron ontbreekt')+(x.note?' · '+x.note:'')]);
    lines(container,'Verbanden',rels.length?rels:[['Vastgelegde verbanden','Nog geen handmatig beoordeelde verbanden']]);
    const catalog=new Map((model.catalog?.references||[]).map(x=>[x.id,x]));
    lines(container,'IBP, AVG, AI Act en overige regels',fLinks.length?fLinks.map(x=>[(catalog.get(x.frameworkId)?.name||x.frameworkId)+' '+(x.article||''),x.status+' · '+(x.evidence||'Bewijs niet ingevuld')+(x.note?' · '+x.note:'')]):[['Toetsingen','Nog niet per bepaling beoordeeld']]);
    lines(container,'Herkomst',[
      ['Bronnen',(r.sources||[]).join('; ')],
      ['Verwijzingen',(r.sourceRefs||[]).join('; ')],
      ['Oorspronkelijk nummer',r.originalNumber],
      ['Bronrijen',(r.provenance||[]).map(x=>[x.file,x.sheet,x.row].join(' / ')).join('; ')],
      ['Broninstellingen',Object.keys(meta).length?JSON.stringify(meta):'']
    ]);
    const histories=r.auditTrail||[];
    lines(container,'Logboek',histories.length?histories.map(x=>[(x.timestamp||'Datum onbekend')+' · '+(x.actor||'Onbekend'),(x.action||'Wijziging')+' · '+(x.fields||[]).join(', ')+' · '+(x.reason||'Geen toelichting')]):[['Wijzigingen','Nog geen vastgelegde wijzigingen via de kaart']]);
    if(r.sourceFields||r.otherDescription){
      const legacy=text('details','card-details');legacy.append(text('summary','','Oorspronkelijke Excelbeschrijvingen'));
      for(const [title,key] of [['Oorspronkelijke velden','sourceFields'],['Tweede beschrijving','otherDescription']])if(r[key])lines(legacy,title,Object.entries(r[key]));
      container.append(legacy);
    }
  }
  function inputControl(name,value,group){
    const outer=text('label','card-field'),title=text('span','card-field-label',label(name));
    const multiline=MULTILINE.test(name)||String(value||'').length>130;
    const input=document.createElement(multiline?'textarea':'input');
    input.name=name;input.dataset.field=name;
    if(multiline){input.rows=String(value||'').length>250?4:2;}
    else{input.type='text';input.autocomplete='off';}
    input.value=typeof value==='boolean'?String(value):String(value??'');
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
    const reference=text('select','');reference.dataset.part='frameworkId';
    options(reference,(model.catalog?.references||[]).map(x=>[x.id,x.name]),obj.frameworkId||'IBP');
    const article=text('input','');article.dataset.part='article';article.value=obj.article||'';article.placeholder='Normcode of artikel';
    const status=text('select','');status.dataset.part='status';options(status,(model.catalog?.statuses||[]).map(x=>[x,x]),obj.status||'Nog te beoordelen');
    const evidence=text('input','');evidence.dataset.part='evidence';evidence.value=obj.evidence||'';evidence.placeholder='Bewijs of bron';
    const note=text('input','');note.dataset.part='note';note.value=obj.note||'';note.placeholder='Beoordeling en maatregel';
    const remove=text('button','card-remove-row','×');remove.type='button';remove.title='Toetsing verwijderen';remove.addEventListener('click',()=>row.remove());
    row.append(reference,article,status,evidence,note,remove);return row;
  }
  function showForm(){
    const r=model.working,spec=specFor(model.current.type);
    const holder=$c('cardFormFields');holder.replaceChildren();
    const grid=text('div','card-input-grid');
    const fields=[...new Set(['name',...spec.fields,...Object.keys(r).filter(k=>!PROTECTED.has(k))])];
    for(const field of fields)if(!PROTECTED.has(field))grid.append(inputControl(field,r[field]));
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
    return [...$c(id).children].filter(x=>x.dataset.group).map(row=>Object.fromEntries(parts.map(part=>[part,row.querySelector('[data-part="'+part+'"]')?.value.trim()||''])));
  }
  function collect(){
    if(!model.working||!model.current)throw Error('Kies eerst een registratie.');
    const r=copy(model.working);
    for(const input of $c('cardFormFields').querySelectorAll('[data-field]')){
      const field=input.dataset.field;
      const raw=input.value.trim();
      if(!raw&&(r[field]===undefined||r[field]===null)){delete r[field];continue;}
      if(typeof r[field]==='boolean'){if(!['true','false'].includes(raw.toLowerCase()))throw Error(label(field)+' moet true of false zijn.');r[field]=raw.toLowerCase()==='true';}
      else if(typeof r[field]==='number'){if(raw!==''&&!Number.isFinite(Number(raw)))throw Error(label(field)+' moet een getal zijn.');r[field]=raw===''?null:Number(raw);}
      else r[field]=raw;
    }
    r.relations=parseRows('cardRelationRows',['targetType','targetId','relationType','status','evidence','note']);
    r.frameworkLinks=parseRows('cardFrameworkRows',['frameworkId','article','status','evidence','note']);
    const sourceInput=$c('cardFormFields').querySelector('[name="newSourceReference"]');
    if(sourceInput&&sourceInput.value.trim())r.sources=[...new Set([...(r.sources||[]),sourceInput.value.trim()])];
    r.recordMeta={};
    for(const input of $c('cardFormFields').querySelectorAll('[name^="recordMeta."]'))if(input.value.trim())r.recordMeta[input.name.slice(11)]=input.value.trim();
    const reason=$c('cardFormFields').querySelector('[name="changeReason"]').value.trim();
    if(!r.name?.trim())throw Error('Naam is verplicht.');
    if(!reason||reason.length<8)throw Error('Beschrijf de wijziging en de herkomst in minimaal acht tekens.');
    if(r.recordMeta.referenceDate&&!/^\d{4}-\d{2}-\d{2}$/.test(r.recordMeta.referenceDate))throw Error('Peildatum moet jjjj-mm-dd zijn.');
    const targets=new Set(availableTargets().map(x=>key(x.type,x.id)));
    const seen=new Set();
    for(const rel of r.relations){
      if(!rel.targetId||!targets.has(key(rel.targetType,rel.targetId)))throw Error('Een verband verwijst niet naar een bestaande registratie.');
      if(rel.targetType===model.current.type&&rel.targetId===r.id)throw Error('Een registratie kan niet naar zichzelf verwijzen.');
      if(!model.catalog.relationTypes.some(x=>x.id===rel.relationType))throw Error('Onbekend relatietype.');
      const relKey=[rel.targetType,rel.targetId,rel.relationType].join('/');
      if(seen.has(relKey))throw Error('Dubbel verband in deze kaart.');
      seen.add(relKey);
      if(rel.status==='Bevestigd'&&!rel.evidence)throw Error('Een bevestigd verband vereist bronbewijs.');
    }
    for(const link of r.frameworkLinks){
      if(!model.catalog.references.some(x=>x.id===link.frameworkId))throw Error('Onbekend toetsingskader.');
      if(!link.article)throw Error('Vul de concrete norm of het artikel in.');
      if(link.status==='Onderbouwd'&&!link.evidence)throw Error('Onderbouwde toetsing vereist bronbewijs.');
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
      const result=collect(),id=model.current.id,type=model.current.type,old=entry(type,id)||null;
      const base=model.drafts.get(key(type,id))?.before|| (old?copy(old):null);
      const changed=diff(base,result.after);
      if(!changed.length){model.drafts.delete(key(type,id));feedback('Geen wijzigingen om te bewaren.');model.editing=false;model.working=null;showPane();return;}
      model.drafts.set(key(type,id),{type,id,after:result.after,before:base,changed,reason:result.reason,stagedAt:new Date().toISOString()});
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
  function startEdit(){
    if(!model.current)return;
    const r=record(model.current.type,model.current.id);if(!r)return;
    model.original=copy(r);model.working=copy(r);model.editing=true;model.adding=!entry(model.current.type,model.current.id);
    feedback('');showPane();
  }
  function open(type,id,edit=false){
    if($c('workspace').hidden)return;
    if(model.editing&&!confirm('Niet-bewaarde invoer verlaten?'))return;
    const spec=specFor(type);
    if(!record(type,id)){feedback('Registratie niet gevonden.',true);return;}
    $c('cardEditor').hidden=false;$c('cardScrim').hidden=false;document.body.classList.add('record-card-open');
    model.current={type,id};model.editing=false;model.working=null;model.adding=false;
    $c('cardTypeFilter').value=type;$c('cardSearch').value='';
    showList();showPane();if(edit)startEdit();
  }
  function create(){
    if(model.editing&&!confirm('Niet-bewaarde invoer verlaten?'))return;
    if(!state.ready){feedback('Laad eerst de brongegevens vanuit GitHub voordat je een nieuwe kaart maakt.',true);return;}
    const type=$c('cardTypeFilter').value,spec=specFor(type),id=nextId(spec);
    const source={id,name:'',relations:[],frameworkLinks:[],sources:[],recordMeta:{sourceSystem:'Handmatige registratie',referenceDate:new Date().toISOString().slice(0,10)}};
    if(type==='additionalCandidates')source.confirmed=false;
    if(type==='connections')source.usageConfirmed=false;
    model.current={type,id};model.working=source;model.original=null;model.adding=true;model.editing=true;
    $c('cardEditor').hidden=false;$c('cardScrim').hidden=false;
    document.body.classList.add('record-card-open');
    showList();showPane();
    $c('cardFormFields').querySelector('[name="name"]')?.focus();
  }
  function close(){
    if(model.editing&&!confirm('Niet-bewaarde invoer sluiten?'))return;
    model.editing=false;model.working=null;$c('cardEditor').hidden=true;$c('cardScrim').hidden=true;
    document.body.classList.remove('record-card-open');$c('cardGithubToken').value='';
    $c('cardOpen').focus();
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
  $c('cardEditButton').addEventListener('click',startEdit);
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
    clearPublished:()=>{
      model.drafts.clear();model.editing=false;model.working=null;model.current=null;
      showList();showPane();feedback('Wijzigingsvoorstel aangemaakt. De huidige tellingen veranderen pas na goedkeuring en synchronisatie.');
    },
    specs:SPECS.map(s=>({...s})),
    catalog:()=>model.catalog
  });
  fillTypeSelect();
  document.addEventListener('ict-scan:opened',()=>void init());
})();
