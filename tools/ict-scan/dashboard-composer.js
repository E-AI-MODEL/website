'use strict';
/* Emmauscollege Dashboard Studio.
   Interactive, source-backed composition of existing local registers. Layout
   preferences are local UI state only; no edited or invented source records. */
(function(){
  const $=id=>document.getElementById(id);
  const NS='http://www.w3.org/2000/svg';
  const KEY='emmaus-ict-dashboard-studio-v1';
  const DATA=[
    {key:'apps',store:'apps',card:'apps',label:'Toepassingen',help:'Software en online diensten in het register.',unit:'basisregistraties',field:'area',fieldLabel:'Gebruiksgebied',fields:['owner','local','kind']},
    {key:'ai',store:'ai',card:'ai',label:'AI-functies',help:'Beschreven functies, niet automatisch ingeschakeld.',unit:'beschreven functies',field:'domain',fieldLabel:'Domein',fields:['product','local','parentId'],role:'ai'},
    {key:'connections',store:'connections',card:'connections',label:'Entra-registraties',help:'Toegang en mogelijke systeemkoppelingen.',unit:'Entra-registraties',field:'category',fieldLabel:'Categorie',fields:['matchedId','local','usageConfirmed']},
    {key:'devices',store:'devices',card:'devices',label:'Apparaatmetingen',help:'Beschikbare metingen, niet het aantal apparaten.',unit:'apparaatmetingen',field:'type',fieldLabel:'Meettype',fields:['measurementDate','quantity','limitation']},
    {key:'checks',store:'checks',card:'checks',label:'Controlepunten',help:'Vastgelegde vragen die nog moeten worden nagegaan.',unit:'controlepunten',field:'category',fieldLabel:'Categorie',fields:['status','evidence','action']},
    {key:'candidates',store:'candidates',card:'additionalCandidates',label:'Mogelijke toepassingen',help:'Aanwijzingen voor software, nog niet bevestigd.',unit:'mogelijke toepassingen',field:'kind',fieldLabel:'Soort',fields:['status','confirmed','action']},
    {key:'aiControls',store:'aiControls',card:'aiControls',label:'AI-beheer',help:'Beheerafspraken, inrichting en controleacties.',unit:'beheerpunten',field:'domain',fieldLabel:'Domein',fields:['local','execution','managementLocation'],role:'ai'},
    {key:'dpia',store:'dpia',card:'dpia',label:'Privacybronnen',help:'Bronnen over DPIA en privacytoezicht.',unit:'brononderwerpen',field:'type',fieldLabel:'Soort bron',fields:['sourceDate','local','evidence'],role:'fg'}
  ];
  const PARTS=[
    {id:'numbers',name:'Aantallen per register',eyebrow:'AANTALLEN',caption:'Tel de registraties in de gekozen gegevensgroepen.',span:12},
    {id:'distribution',name:'Verdeling naar categorie',eyebrow:'VERDELING',caption:'Bekijk de verdeling en klik om te filteren.',span:6},
    {id:'relations',name:'Vastgelegde systeemverbanden',eyebrow:'VERBANDEN',caption:'Bekijk beschreven relaties, geen bewezen live koppelingen.',span:8,needs:'apps'},
    {id:'coverage',name:'Ingevulde gegevens',eyebrow:'INVULSTATUS',caption:'Zie welke velden wel en niet zijn ingevuld.',span:4},
    {id:'matrix',name:'Gebruiksgebied en soort toepassing',eyebrow:'UITSPLITSING',caption:'Vergelijk gebruiksgebieden met soorten voorzieningen.',span:6,needs:'apps'},
    {id:'records',name:'Gegevenskaarten openen',eyebrow:'REGISTRATIES',caption:'Klik op een registratie voor inhoud en bronnen.',span:6},
    {id:'hardware',name:'Apparaatmetingen bekijken',eyebrow:'APPARATEN',caption:'Bekijk de gemeten waarden, datum en beperkingen.',span:5,needs:'devices'},
    {id:'actions',name:'Controlepunten en opvolging',eyebrow:'CONTROLE',caption:'Bekijk geregistreerde vragen en vervolgstappen.',span:5,needsAny:['checks','candidates','aiControls']},
    {id:'sources',name:'Ingelezen bronbestanden',eyebrow:'BRONNEN',caption:'Bekijk van welke bestanden de cijfers afkomstig zijn.',span:4}
  ];
  const PRESETS={
    school:{data:['apps','ai','connections','devices'],parts:['numbers','distribution','relations','coverage','records'],primary:'apps',title:'Schoolbreed overzicht'},
    ai:{data:['ai','apps','aiControls'],parts:['numbers','distribution','relations','coverage','records'],primary:'ai',title:'AI en toepassingen'},
    technology:{data:['apps','connections','devices'],parts:['numbers','relations','matrix','hardware','records'],primary:'connections',title:'Technische inrichting'},
    review:{data:['apps','checks','candidates'],parts:['numbers','coverage','actions','distribution','records'],primary:'checks',title:'Wat moet nog worden nagegaan?'}
  };
  function defaultConfig(){const p=PRESETS.school;return {data:p.data.slice(),parts:p.parts.slice(),primary:p.primary,title:p.title,layout:'balanced',variant:0,focusApp:'APP-034',filter:null,visuals:{distribution:'lines',matrix:'matrix'}};}
  const config=defaultConfig();
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object'){
    if(Array.isArray(saved.data))config.data=saved.data.filter(k=>DATA.some(d=>d.key===k));
    if(Array.isArray(saved.parts))config.parts=saved.parts.filter(k=>PARTS.some(p=>p.id===k));
    if(typeof saved.primary==='string')config.primary=saved.primary;
    if(typeof saved.title==='string')config.title=saved.title.slice(0,90);
    if(['balanced','editorial','focus','compact'].includes(saved.layout))config.layout=saved.layout;
    if(Number.isInteger(saved.variant))config.variant=((saved.variant%9)+9)%9;
    if(typeof saved.focusApp==='string')config.focusApp=saved.focusApp;
    if(saved.visuals&&typeof saved.visuals==='object'){
      if(['lines','bars','donut','treemap','table'].includes(saved.visuals.distribution))config.visuals.distribution=saved.visuals.distribution;
      if(['matrix','table'].includes(saved.visuals.matrix))config.visuals.matrix=saved.visuals.matrix;
    }
  }}catch(_){}
  const text=(tag,value,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
  const svgEl=(tag,attrs,body)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,String(v));if(body!==undefined)e.textContent=String(body);return e;};
  const fmt=n=>Number(n).toLocaleString('nl-NL');
  const clean=v=>String(v??'').trim();
  const display=v=>clean(v)||'Niet ingevuld';
  const category=v=>clean(v)||'Niet ingedeeld';
  const known=v=>{const x=clean(v);return !!x&&!/^\?|^(nog |onbekend|niet gecontroleerd|niet bevestigd|niet vastgesteld|geen gegevens|n.v.t)/i.test(x);};
  function enabled(d){return !d.role||window.EmmausRoles?.isEnabled(d.role)===true;}
  function availableData(){return DATA.filter(d=>config.data.includes(d.key)&&enabled(d));}
  function source(d){return Array.from((state[d.store] instanceof Map?state[d.store]:new Map()).values());}
  function definition(k){return DATA.find(d=>d.key===k);}
  function activeSource(){const list=availableData();return list.find(d=>d.key===config.primary)||list[0]||null;}
  function filtered(d){
    let result=source(d);
    if(config.filter?.dataset===d.key)result=result.filter(r=>category(r[config.filter.field])===config.filter.value);
    return result;
  }
  function compatible(p){
    const keys=new Set(availableData().map(d=>d.key));
    return (!p.needs||keys.has(p.needs))&&(!p.needsAny||p.needsAny.some(k=>keys.has(k)));
  }
  function countMap(rows,field){
    const m=new Map();for(const r of rows){const k=category(r[field]);m.set(k,(m.get(k)||0)+1);}
    return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'nl'));
  }
  function persist(){try{localStorage.setItem(KEY,JSON.stringify({data:config.data,parts:config.parts,primary:config.primary,title:config.title,layout:config.layout,variant:config.variant,focusApp:config.focusApp,visuals:{...config.visuals}}));return true;}catch(_){return false;}}
  function button(label,cls,action){
    const b=text('button',label,cls);b.type='button';if(action)b.addEventListener('click',action);return b;
  }
  function openCard(d,r){if(window.EmmausRecordCards?.open&&r?.id)window.EmmausRecordCards.open(d.card,r.id);}
  function showMessage(value){const n=$('dsStageMessage');if(n)n.textContent=value;}
  function selectPart(id){
    if(config.parts.includes(id))config.parts=config.parts.filter(x=>x!==id);
    else config.parts.push(id);
    refresh();
  }
  function toggleData(key){
    if(config.data.includes(key))config.data=config.data.filter(x=>x!==key);
    else{config.data.push(key);config.primary=key;}
    if(!config.data.includes(config.primary))config.primary=config.data[0]||'';
    config.filter=null;
    refresh();
  }
  function componentTitle(p,index){
    const h=text('header',undefined,'ds-component-head');
    const label=text('div',undefined,'ds-component-label');
    const d=activeSource();
    const title=p.id==='distribution'&&d?d.label+' per '+d.fieldLabel.toLocaleLowerCase('nl-NL'):p.name;
    label.append(text('small',String(index+1).padStart(2,'0')+' / '+p.eyebrow),text('h3',title));
    const actions=text('div',undefined,'ds-component-controls');
    const modes=p.id==='distribution'
      ?[['lines','Lijnen'],['bars','Staaf'],['donut','Ring'],['treemap','Tegels'],['table','Tabel']]
      :p.id==='matrix'?[['matrix','Matrix'],['table','Tabel']]:null;
    if(modes){
      const control=text('label',undefined,'ds-component-view');
      control.append(text('span','Weergave'));
      const selection=text('select',undefined,'ds-chart-mode');
      selection.setAttribute('aria-label','Weergave voor '+p.name);
      for(const [value,name] of modes){
        const option=text('option',name);option.value=value;selection.append(option);
      }
      selection.value=config.visuals[p.id];
      selection.addEventListener('change',()=>{
        config.visuals[p.id]=selection.value;
        refresh();
      });
      control.append(selection);
      actions.append(control);
    }
    const remove=button('×','ds-component-remove',()=>selectPart(p.id));
    remove.setAttribute('aria-label','Verwijder '+p.name);remove.title='Verwijderen';
    actions.append(remove);
    h.append(label,actions);return h;
  }
  function createComponent(p,index){
    const outer=text('section',undefined,'ds-component ds-'+p.id);
    outer.dataset.component=p.id;
    outer.append(componentTitle(p,index));
    const body=text('div',undefined,'ds-component-body');outer.append(body);
    const methods={numbers:drawNumbers,distribution:drawDistribution,relations:drawRelations,coverage:drawCoverage,matrix:drawMatrix,records:drawRecords,hardware:drawHardware,actions:drawActions,sources:drawSources};
    methods[p.id](body);return outer;
  }
  function drawNumbers(root){
    const entries=availableData();const row=text('div',undefined,'ds-measure-strip');
    for(const d of entries){
      const rows=filtered(d),all=source(d);
      const item=button('', 'ds-measure',()=>{
        config.primary=d.key;
        if(!config.parts.includes('records'))config.parts.push('records');
        refresh();$('dsCanvas')?.querySelector('[data-component="records"]')?.scrollIntoView({block:'nearest',behavior:'smooth'});
      });
      item.replaceChildren(text('small',d.label),text('strong',fmt(rows.length)),text('span',rows.length===all.length?d.unit:fmt(rows.length)+' van '+fmt(all.length)+' '+d.unit));
      item.title='Bekijk '+d.label+' in de registratielijst';row.append(item);
    }
    if(!entries.length)root.append(text('p','Selecteer links een gegevensbron.','ds-component-hint'));else root.append(row);
    if(entries.some(d=>d.key==='devices'))root.append(text('p','Apparaten telt hier de beschikbare metingen, niet het aantal fysieke apparaten.','ds-note'));
  }
  function drawDistribution(root){
    const d=activeSource();
    if(!d){root.append(text('p','Kies eerst inhoud.','ds-component-hint'));return;}
    const all=source(d),rows=filtered(d),groups=countMap(rows,d.field);
    const top=text('div',undefined,'ds-inline-head');
    const info=text('p',d.label+' · '+d.fieldLabel,'ds-inline-label');top.append(info);
    if(config.filter?.dataset===d.key)top.append(button('Filter wissen','ds-inline-link',()=>{config.filter=null;refresh();}));
    root.append(top);
    if(!groups.length){root.append(text('p','Geen registraties binnen deze selectie.','ds-note'));return;}
    const selected=config.filter?.dataset===d.key?config.filter.value:'';
    const choose=name=>{
      config.filter=selected===name?null:{dataset:d.key,field:d.field,value:name};
      refresh();
    };
    if(config.visuals.distribution!=='lines'){
      const chart=text('div',undefined,'ds-shared-chart');
      root.append(chart);
      if(!window.EmmausChartViews)throw Error('De gedeelde grafiekweergaven zijn niet geladen.');
      window.EmmausChartViews.render(chart,groups,config.visuals.distribution,selected,choose,d.unit);
      root.append(text('p',fmt(rows.length)+' van '+fmt(all.length)+' '+d.unit+'. Alle '+groups.length+' categorieën zijn weergegeven.','ds-note'));
      return;
    }
    const shown=groups.slice(0,8),rest=groups.slice(8).reduce((n,e)=>n+e[1],0);
    if(rest)shown.push(['Overige categorieën',rest]);
    const W=760,L=204,R=691,Y=36,H=47*shown.length+70,max=Math.max(1,...shown.map(e=>e[1]));
    const svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,class:'ds-figure ds-desktop-lines',role:'img','aria-label':rows.length+' '+d.unit+' naar '+d.fieldLabel});
    svg.append(svgEl('title',{},'Verdeling '+d.label),svgEl('desc',{},'Selecteer een regel om op deze categorie te filteren.'));
    const xx=v=>L+(R-L)*v/max;
    for(let i=0;i<=4;i++){const count=+(max*i/4).toFixed(0);const x=xx(count);
      svg.append(svgEl('line',{x1:x,y1:18,x2:x,y2:H-23,class:'ds-grid-line'}));
      svg.append(svgEl('text',{x,y:13,'text-anchor':'middle',class:'ds-grid-label'},count));
    }
    shown.forEach(([name,n],i)=>{
      const y=Y+i*47,aggregate=rest>0&&i===shown.length-1,selected=config.filter?.dataset===d.key&&config.filter.value===name;
      const g=svgEl('g',{class:'ds-figure-row'+(selected?' selected':'')+(aggregate?' aggregate':''),role:aggregate?'presentation':'button'});
      if(!aggregate){g.setAttribute('tabindex','0');g.setAttribute('aria-label','Filter op '+name+', '+n+' registraties');}
      g.append(svgEl('rect',{x:0,y:y-18,width:W,height:37,class:'ds-hit'}));
      g.append(svgEl('text',{x:L-17,y:y+4,'text-anchor':'end',class:'ds-row-label'},name.length>30?name.slice(0,28)+'…':name));
      g.append(svgEl('line',{x1:L,y1:y,x2:R,y2:y,class:'ds-row-guide'}));
      g.append(svgEl('line',{x1:L,y1:y,x2:xx(n),y2:y,class:'ds-data-line'}));
      g.append(svgEl('circle',{cx:xx(n),cy:y,r:selected?5.5:4,class:'ds-data-mark'}));
      g.append(svgEl('text',{x:R+18,y:y+4,class:'ds-row-value'},fmt(n)));
      if(!aggregate){const select=()=>{config.filter=selected?null:{dataset:d.key,field:d.field,value:name};refresh();};
        g.addEventListener('click',select);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});}
      svg.append(g);
    });
    root.append(svg);
    const compact=text('div',undefined,'ds-mobile-lines');
    compact.setAttribute('aria-label','Verdeling in dunne lijnen');
    for(const [name,n] of shown){
      const aggregate=name==='Overige categorieën'&&rest>0;
      const selectedRow=selected===name;
      const item=button('','ds-mobile-line-row'+(selectedRow?' selected':''),aggregate?undefined:()=>choose(name));
      if(aggregate)item.disabled=true;
      item.setAttribute('aria-label',name+' · '+fmt(n)+(aggregate?'':' · filter instellen'));
      const track=text('span',undefined,'ds-mobile-line-track');
      const fill=text('span',undefined,'ds-mobile-line-fill');
      fill.style.setProperty('--value',(n/max*100).toFixed(3)+'%');
      track.append(fill);
      item.append(text('span',name,'ds-mobile-line-label'),track,text('strong',fmt(n),'ds-mobile-line-count'));
      compact.append(item);
    }
    root.append(compact);
    const infoLine=groups.length>8?'Acht grootste categorieën en een samengevoegde restgroep. ':''; 
    root.append(text('p',infoLine+fmt(rows.length)+' van '+fmt(all.length)+' '+d.unit+'. Elke registratie telt eenmaal.','ds-note'));
  }
  function drawCoverage(root){
    const d=activeSource();if(!d){root.append(text('p','Kies een bron voor deze meting.','ds-component-hint'));return;}
    const rows=filtered(d);root.append(text('p','Ingevulde velden bij '+d.label+'. Dit is geen inhoudelijke goedkeuring.','ds-component-hint'));
    for(const field of d.fields){
      const value=rows.filter(r=>known(r[field])).length,total=rows.length;
      const line=text('div',undefined,'ds-coverage-row');
      const head=text('div',undefined,'ds-coverage-head');head.append(text('span',field.replace(/([A-Z])/g,' $1')),text('strong',fmt(value)+' / '+fmt(total)));
      const meter=text('div',undefined,'ds-coverage-meter');const fill=text('span');fill.style.width=(total?100*value/total:0).toFixed(2)+'%';meter.append(fill);
      line.append(head,meter);root.append(line);
    }
    root.append(text('small','Peilmoment uit de ingelezen bron. Een lege waarde is niet automatisch een tekortkoming.','ds-note'));
  }
  function relationSets(app,index){
    const ai=index.connected('apps',app.id,{type:'ai'}).map(link=>link.other);
    const controls=new Map();
    for(const row of ai)for(const link of index.connected('ai',row.id,{type:'aiControls'})){
      controls.set(link.otherId,link.other);
    }
    return [
      {label:'AI-functies',key:'ai',card:'ai',
        rows:window.EmmausRoles?.isEnabled('ai')===false?[]:ai,note:'Beschreven functies, niet automatisch lokaal ingeschakeld'},
      {label:'Entra-matches',key:'connections',card:'connections',
        rows:index.connected('apps',app.id,{type:'connections'}).map(link=>link.other),
        note:'Mogelijke Entra-matches. Een registratie is geen actieve koppeling.'},
      {label:'Onderdelen',key:'parts',card:'parts',
        rows:index.connected('apps',app.id,{type:'parts',relationType:'part_of'}).map(link=>link.other),
        note:'Onderdelen en modules uit de gezamenlijke index, niet automatisch ingeschakeld'},
      {label:'AI-beheer',key:'aiControls',card:'aiControls',
        rows:window.EmmausRoles?.isEnabled('ai')===false?[]:[...controls.values()],
        note:'Beheer- en controlepunten gekoppeld via AI-ID'}
    ].filter(g=>g.key!=='ai'&&g.key!=='aiControls'||window.EmmausRoles?.isEnabled('ai')!==false);
  }
  function drawRelations(root){
    if(!availableData().some(x=>x.key==='apps')){
      root.append(text('p','Selecteer Toepassingen om vastgelegde verbanden te verkennen.','ds-component-hint'));return;
    }
    const index=window.IctInventoryIndex?.build(state);
    if(!index){root.append(text('p','De relatie-index kon niet worden geladen.','ds-note'));return;}
    const apps=index.records('apps').slice().sort((a,b)=>a.name.localeCompare(b.name,'nl'));
    const app=apps.find(x=>x.id===config.focusApp)||apps.find(x=>x.id==='APP-034')||apps[0];
    if(!app){root.append(text('p','Geen toepassingen ingelezen.','ds-component-hint'));return;}
    const select=text('select',undefined,'ds-link-choice');select.setAttribute('aria-label','Toepassing voor de systeemkaart');
    for(const record of apps){const o=text('option',record.name);o.value=record.id;select.append(o);}
    select.value=app.id;
    select.addEventListener('change',()=>{config.focusApp=select.value;refresh();});root.append(select);
    const groups=relationSets(app,index),stage=text('div',undefined,'ds-network');
    if(app.id==='APP-034'){
      groups.find(g=>g.key==='parts').rows=index.descendants('apps',app.id,{maxDepth:3})
        .filter(x=>x.type==='parts'&&x.record.kind==='Microsoft 365-onderdeel').map(x=>x.record);
    }
    const svg=svgEl('svg',{viewBox:'0 0 900 280',class:'ds-network-lines','aria-hidden':'true',preserveAspectRatio:'none'});
    svg.append(svgEl('circle',{cx:450,cy:140,r:84,class:'ds-orbit-guide'}));
    const positions=[[130,71],[755,71],[755,221],[130,221]];
    for(const [i,g] of groups.entries()){
      const [x,y]=positions[i];
      svg.append(svgEl('path',{d:'M450 140 Q'+(450+(x-450)*.5)+' '+(140+(y-140)*.2)+' '+x+' '+y,
        class:'ds-network-edge'+(g.rows.length?'':' is-empty')}));
      svg.append(svgEl('circle',{cx:x,cy:y,r:3.5,class:'ds-network-end'}));
    }
    stage.append(svg);
    const center=text('div',undefined,'ds-network-center');
    center.append(text('small',app.id),text('strong',app.name),text('span','Geregistreerde toepassing'));
    stage.append(center);
    for(const [i,g] of groups.entries()){
      const b=button('','ds-network-node',()=>showRelationList(g));
      b.style.setProperty('--x',(positions[i][0]/9)+'%');
      b.style.setProperty('--y',(positions[i][1]/2.8)+'%');
      b.replaceChildren(text('small',g.label),text('strong',fmt(g.rows.length)),
        text('span',g.rows.length?'Brongebonden registraties':'Geen relatie vastgelegd'));
      b.setAttribute('aria-label',g.rows.length+' '+g.label+', bekijk onderliggende registraties');
      stage.append(b);
    }
    root.append(stage,text('p','De lijnen zijn bronrelaties en bevestigen geen actieve gegevensuitwisseling.','ds-note'));
    if(app.owner&&!/^\?/.test(app.owner))root.append(text('p','Verantwoordelijke: '+app.owner,'ds-note'));
    const links=index.connected('apps',app.id).filter(x=>
      x.origin==='declared'||x.origin==='embedded-legacy'||x.otherType==='hardwareGroups');
    if(links.length){
      const section=text('section',undefined,'ds-network-records ds-recorded-links');
      section.append(text('strong','Vastgelegde verbanden · '+links.length),
        text('small','Klik op een regel voor de betekenis en bewijsstatus. Bronverwijzingen worden apart bewaard.'));
      const list=text('div',undefined,'ds-record-links');
      for(const link of links){
        const details=text('details',undefined,'ds-relationship-detail');
        const name=link.other?.name||link.otherId;
        details.append(text('summary',name+' · '+link.relationType+' · '+link.status));
        const body=text('div',undefined,'ds-relationship-proof');
        body.append(text('p',link.note||'Geen nadere toelichting vastgelegd.','ds-note'));
        const store=link.otherType==='additionalCandidates'?'candidates':link.otherType;
        if(state[store] instanceof Map&&state[store].has(link.otherId)){
          body.append(button('Open '+name,'ds-record-link',()=>openCard({card:link.otherType},link.other)));
        }
        details.append(body);list.append(details);
      }
      section.append(list);root.append(section);
    }
    function showRelationList(group){
      const old=root.querySelector('.ds-network-current-list');if(old)old.remove();
      const wrap=text('div',undefined,'ds-network-records ds-network-current-list');
      wrap.append(text('strong',group.label+' · '+group.rows.length),text('small',group.note));
      const list=text('div',undefined,'ds-record-links');
      for(const record of group.rows){
        const store=group.card==='additionalCandidates'?'candidates':group.card;
        if(state[store] instanceof Map&&state[store].has(record.id)){
          list.append(button(record.name||record.id,'ds-record-link',()=>openCard({card:group.card},record)));
        }else{
          const details=text('details',undefined,'ds-relationship-detail');
          details.append(text('summary',record.name||record.id));
          details.append(text('p',record.note||record.description||record.local||'Nog te controleren','ds-note'));
          list.append(details);
        }
      }
      if(!group.rows.length)list.append(text('p','Geen relatie vastgelegd.','ds-note'));
      wrap.append(list);root.append(wrap);
    }
  }
  function drawMatrix(root){
    const apps=source(definition('apps'));
    const areas=[...new Set(apps.map(x=>category(x.area)))].sort((a,b)=>a.localeCompare(b,'nl'));
    const kinds=[...new Set(apps.map(x=>category(x.kind)))].sort((a,b)=>a.localeCompare(b,'nl'));
    const openArea=area=>{
      config.data=['apps',...config.data.filter(x=>x!=='apps')];
      config.primary='apps';
      config.filter={dataset:'apps',field:'area',value:area};
      if(!config.parts.includes('records'))config.parts.push('records');
      refresh();
    };
    if(config.visuals.matrix==='table'){
      const list=text('table',undefined,'ds-matrix ds-matrix-list');
      const head=text('thead'),header=text('tr');
      for(const title of ['Gebruiksgebied','Soort','Aantal']){
        const cell=text('th',title);cell.scope='col';header.append(cell);
      }
      head.append(header);list.append(head);
      const body=text('tbody');
      for(const area of areas)for(const kind of kinds){
        const matching=apps.filter(x=>category(x.area)===area&&category(x.kind)===kind);
        if(!matching.length)continue;
        const row=text('tr');
        row.append(text('td',area),text('td',kind));
        const cell=text('td');
        const action=button(fmt(matching.length),'ds-matrix-cell',()=>openArea(area));
        action.title=area+' · '+kind+' · '+matching.length+' registraties. Filter op gebruiksgebied.';
        cell.append(action);row.append(cell);body.append(row);
      }
      list.append(body);
      const scroll=text('div',undefined,'ds-table-wrap');scroll.append(list);root.append(scroll);
      root.append(text('p','Alle '+fmt(apps.length)+' basisregistraties. Selecteer een aantal om op het gebruiksgebied te filteren.','ds-note'));
      return;
    }
    const table=text('table',undefined,'ds-matrix');const thead=text('thead');const tr=text('tr');
    const corner=text('th','Gebied / soort');corner.scope='col';tr.append(corner);
    for(const kind of kinds){const th=text('th',kind);th.scope='col';tr.append(th);}
    const end=text('th','Totaal');end.scope='col';tr.append(end);thead.append(tr);table.append(thead);
    const body=text('tbody');
    for(const area of areas){
      const row=text('tr'),left=text('th',area);left.scope='row';row.append(left);
      for(const kind of kinds){
        const matching=apps.filter(x=>category(x.area)===area&&category(x.kind)===kind);
        const cell=text('td');if(matching.length){const b=button(fmt(matching.length),'ds-matrix-cell',()=>openArea(area));
          b.title=area+' · '+kind+' · '+matching.length+' registraties';b.style.setProperty('--intensity',String(matching.length));cell.append(b);}
        else cell.textContent='·';row.append(cell);
      }
      row.append(text('th',fmt(apps.filter(x=>category(x.area)===area).length)));body.append(row);
    }
    const foot=text('tr');foot.append(text('th','Totaal'));for(const kind of kinds)foot.append(text('th',fmt(apps.filter(x=>category(x.kind)===kind).length)));foot.append(text('th',fmt(apps.length)));body.append(foot);
    table.append(body);const viewport=text('div',undefined,'ds-table-wrap');viewport.append(table);root.append(viewport);
    root.append(text('p','De rij- en kolomsommen tellen elk op tot '+fmt(apps.length)+' basisregistraties.','ds-note'));
  }
  function drawRecords(root){
    const d=activeSource();if(!d){root.append(text('p','Selecteer een register.','ds-component-hint'));return;}
    const all=filtered(d);
    const wrap=text('div',undefined,'ds-records');const input=text('input');input.type='search';input.placeholder='Zoek binnen '+d.label.toLowerCase();input.className='ds-record-search';input.setAttribute('aria-label','Doorzoek '+d.label);root.append(input,wrap);
    function fill(){
      const q=input.value.trim().toLocaleLowerCase('nl-NL');const matched=all.filter(r=>[r.id,r.name,r.description,r.status,r.local,r.action].filter(Boolean).join(' ').toLocaleLowerCase('nl-NL').includes(q));wrap.replaceChildren();
      for(const r of matched.slice(0,10)){const b=button('','ds-record-row',()=>openCard(d,r));b.append(text('span',r.id,'ds-record-id'),text('strong',r.name||'Naam ontbreekt'),text('span','Bekijk','ds-record-open'));wrap.append(b);}
      if(!matched.length)wrap.append(text('p','Geen registraties voor deze zoekterm.','ds-note'));
      const result=text('p',fmt(matched.length)+' registraties'+(matched.length>10?' · de eerste tien getoond':''),'ds-note');wrap.append(result);
    }
    input.addEventListener('input',fill);fill();
  }
  function drawHardware(root){
    const d=source(definition('devices'));const total=d.find(x=>/entra apparaatrecords/i.test(x.name));const compliance=d.find(x=>/compliancevelden/i.test(x.name));
    const n=Number(String(total?.quantity||'').match(/\d+/)?.[0]||0);
    const match=String(compliance?.quantity||'').match(/(\d+)\s*True\s*\/\s*(\d+)\s*False/i);
    const yes=match?+match[1]:0,no=match?+match[2]:0,missing=n-yes-no;
    if(!n||!match||missing<0){root.append(text('p','Deze meting is niet compleet of sluit niet aan.','ds-component-hint'));return;}
    const head=text('div',undefined,'ds-hardware-head');head.append(text('strong',fmt(n)),text('span','Entra-apparaatrecords · '+display(total.measurementDate)));root.append(head);
    const strip=text('div',undefined,'ds-hardware-strip');
    for(const [value,cls] of [[yes,'true'],[no,'false'],[missing,'missing']]){const part=text('span');part.className='ds-hardware-'+cls;part.style.width=(value/n*100)+'%';strip.append(part);}
    root.append(strip);
    const legend=text('div',undefined,'ds-hardware-legend');for(const [name,value,cls] of [['True',yes,'true'],['False',no,'false'],['Niet ingevuld',missing,'missing']]){const item=text('div',undefined,'ds-hardware-key');item.append(text('i',undefined,cls),text('span',name),text('strong',fmt(value)));legend.append(item);}root.append(legend);
    root.append(text('p','De compliancewaarden staan in de export. Dit is geen volledig apparaatbeheer- of veiligheidsbeeld.','ds-note'));
  }
  function drawActions(root){
    const d=availableData().find(x=>['checks','candidates','aiControls'].includes(x.key));
    if(!d){root.append(text('p','Kies Controles, Kandidaten of AI-beheer om werkpunten te tonen.','ds-component-hint'));return;}
    const rows=filtered(d),slice=rows.slice(0,9);const list=text('div',undefined,'ds-actions');
    for(const r of slice){const b=button('','ds-action-row',()=>openCard(d,r));
      b.append(text('strong',r.name||r.id),text('span',clean(r.status)||clean(r.action)||clean(r.local)||'Status niet vastgesteld'));
      list.append(b);
    }
    root.append(list,text('p','Geregistreerde werkpunten · '+fmt(rows.length)+' in '+d.label+'.','ds-note'));
  }
  function drawSources(root){
    const list=text('div',undefined,'ds-sources');
    const sources=state.sources||[];
    for(const r of sources.slice(0,12)){const line=text('div',undefined,'ds-source-row');
      line.append(text('strong',r.name||'Bron'),text('span',String(r.rows??'?')+' rijen · '+display(r.kind)));
      list.append(line);}
    if(!sources.length)list.append(text('p','Nog geen bestanden ingelezen.','ds-component-hint'));
    root.append(list,text('p','Brongegevens blijven ongewijzigd. Ontwerpinstellingen worden alleen lokaal bewaard.','ds-note'));
  }
  function renderChoices(){
    const chosen=new Set(config.data),a=$('dsDataOptions');a.replaceChildren();
    for(const d of DATA){
      const on=chosen.has(d.key),role=enabled(d),b=button('','ds-option'+(on?' selected':'')+(role?'':' unavailable'),()=>toggleData(d.key));
      const textGroup=text('span',undefined,'ds-option-text');
      textGroup.append(text('strong',d.label,'ds-option-name'),text('small',d.help,'ds-option-description'));
      const count=text('span',fmt(source(d).length),'ds-option-count');
      b.disabled=!role;b.setAttribute('aria-pressed',String(on));
      if(!role)b.title=d.role==='fg'?'Zet Privacy aan via Menu':'Zet AI aan via Menu';
      b.append(textGroup,count);a.append(b);
    }
    const effective=availableData();$('dsDataCount').textContent=effective.length+' gekozen';
    const focus=$('dsPrimary');focus.replaceChildren();
    for(const d of effective){const o=text('option',d.label);o.value=d.key;focus.append(o);}
    focus.disabled=!effective.length;
    if(effective.length)focus.value=effective.some(d=>d.key===config.primary)?config.primary:effective[0].key;
    const parts=$('dsPartOptions');parts.replaceChildren();
    for(const p of PARTS){
      const on=config.parts.includes(p.id),valid=compatible(p);
      const b=button('','ds-option ds-part'+(on?' selected':'')+(valid?'':' unavailable'),()=>selectPart(p.id));
      b.disabled=!valid;b.setAttribute('aria-pressed',String(on));
      const why=!valid?'. Selecteer eerst '+(p.needs?definition(p.needs)?.label||'de bijbehorende gegevens':'de bijbehorende gegevens')+'.':'';
      const group=text('span',undefined,'ds-option-text');
      group.append(text('strong',p.name,'ds-option-name'),text('small',p.caption+why,'ds-option-description'));
      b.append(group);parts.append(b);
    }
    $('dsPartCount').textContent=config.parts.filter(k=>compatible(PARTS.find(p=>p.id===k))).length+' gekozen';
    $('dsLayout').value=config.layout;
    for(const button of document.querySelectorAll('[data-ds-preset]')){
      const preset=PRESETS[button.dataset.dsPreset];
      const active=!!preset&&preset.data.length===config.data.length&&preset.data.every(k=>config.data.includes(k))&&preset.parts.length===config.parts.length&&preset.parts.every(k=>config.parts.includes(k));
      button.classList.toggle('selected',active);
      button.setAttribute('aria-pressed',String(active));
    }
  }
  function arrange(items){
    const rank={
      balanced:['numbers','distribution','relations','coverage','matrix','records','hardware','actions','sources'],
      editorial:['numbers','relations','distribution','records','matrix','coverage','hardware','actions','sources'],
      focus:['relations','distribution','numbers','matrix','records','hardware','coverage','actions','sources'],
      compact:['numbers','coverage','distribution','records','hardware','actions','relations','matrix','sources']
    };
    const order=rank[config.layout];
    return items.slice().sort((a,b)=>{
      const ai=order.indexOf(a.id),bi=order.indexOf(b.id);
      // A different variant genuinely changes composition without shuffling the facts.
      const wa=(ai+(config.variant*([0,3,7,2,5,1,8,4,6][ai]||0)))%23;
      const wb=(bi+(config.variant*([0,3,7,2,5,1,8,4,6][bi]||0)))%23;
      return wa-wb||ai-bi;
    });
  }
  function spanFor(p,total){
    const layout=config.layout;
    if(p.id==='numbers')return 12;
    if(layout==='focus'&&['relations','distribution','matrix'].includes(p.id))return 12;
    if(layout==='editorial'&&p.id==='relations')return 8;
    if(layout==='compact'&&['coverage','sources','hardware','actions'].includes(p.id))return 4;
    if(layout==='compact')return 6;
    if(p.id==='relations')return 8;
    if(['coverage','sources'].includes(p.id))return 4;
    if(['records','matrix','distribution'].includes(p.id))return 6;
    return p.span||6;
  }
  function renderCanvas(){
    const stage=$('dsCanvas');stage.replaceChildren();stage.dataset.layout=config.layout;
    const items=arrange(config.parts.map(id=>PARTS.find(p=>p.id===id)).filter(p=>p&&compatible(p)));
    if(!state.ready){stage.append(text('p','De bronbestanden worden ingelezen.','ds-start-text'));return;}
    if(!items.length){
      const empty=text('div',undefined,'ds-empty');const svg=svgEl('svg',{viewBox:'0 0 480 220','aria-hidden':'true'});
      for(let i=0;i<4;i++){svg.append(svgEl('line',{x1:55,y1:38+i*49,x2:423,y2:38+i*49,class:'ds-empty-line'}));}
      for(let i=0;i<7;i++){const x=67+i*53;svg.append(svgEl('circle',{cx:x,cy:36+((i*i+3)%4)*49,r:3,class:'ds-empty-dot'}));}
      empty.append(svg,text('h3','Geen grafieken gekozen'),text('p','Kies links hoe je de geselecteerde gegevens wilt bekijken.'));
      const b=button('Kies passende grafieken','ds-empty-action',()=>suggest());empty.append(b);stage.append(empty);return;
    }
    for(const [i,p] of items.entries()){
      const node=createComponent(p,i);node.style.setProperty('--span',spanFor(p,items.length));
      stage.append(node);
    }
  }
  function refresh(){
    renderChoices();renderCanvas();
    const list=availableData(),n=config.parts.filter(id=>compatible(PARTS.find(p=>p.id===id))).length;
    $('dsTitle').textContent=config.title;
    $('dsScope').textContent=list.length?list.map(d=>d.label).join(' · '):'Nog geen gegevens gekozen';
    $('dsStageMessage').textContent=n+' grafieken en kaarten · '+list.length+' gegevensgroepen gekozen';
    $('dsSourceMessage').textContent=(state.ready?'Gegevens ingelezen':'Wachten op bronnen')+' · ontwerp wordt lokaal bewaard';

  }
  function usePreset(name){
    const preset=PRESETS[name];if(!preset)return;
    Object.assign(config,{data:preset.data.slice(),parts:preset.parts.slice(),primary:preset.primary,title:preset.title,filter:null,variant:0});
    config.data=config.data.filter(k=>enabled(definition(k)));
    if(!config.data.includes(config.primary))config.primary=config.data[0]||'';
    refresh();
  }
  function suggest(){
    const keys=availableData().map(x=>x.key);
    const parts=['numbers','distribution','coverage','records'];
    if(keys.includes('apps'))parts.splice(2,0,'relations');
    if(keys.includes('devices'))parts.splice(-1,0,'hardware');
    if(keys.includes('checks')||keys.includes('candidates')||keys.includes('aiControls'))parts.splice(-1,0,'actions');
    config.parts=[...new Set(parts)];config.filter=null;refresh();
  }
  function exportDesign(){
    const output={format:'emmaus-dashboard-layout',version:1,title:config.title,content:config.data,components:config.parts,layout:config.layout,variant:config.variant,primary:config.primary,visuals:{...config.visuals}};
    const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='Emmaus-dashboard-ontwerp.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),600);
    showMessage('Ontwerp gedownload. Er zijn geen leerling- of applicatiegegevens opgenomen.');
  }
  viewNames.studio='Samenstellen';viewTitles.studio='Applicatielandschap';
  sectionTexts.studio='Kies gegevens en grafieken. Het overzicht verandert meteen.';
  const originalSelectView=selectView;
  selectView=function(view){originalSelectView(view);if(view==='studio'&&state.ready)refresh();};
  const originalRenderAll=renderAll;
  renderAll=function(){originalRenderAll();if(state.ready)refresh();};
  document.querySelectorAll('[data-ds-preset]').forEach(b=>b.addEventListener('click',()=>usePreset(b.dataset.dsPreset)));
  $('dsSuggest').addEventListener('click',suggest);
  $('dsBlank').addEventListener('click',()=>{config.parts=[];config.filter=null;config.title='Nieuw dashboard';refresh();});
  $('dsPrimary').addEventListener('change',()=>{config.primary=$('dsPrimary').value;config.filter=null;refresh();});
  $('dsLayout').addEventListener('change',()=>{config.layout=$('dsLayout').value;config.variant=0;refresh();});
  $('dsShuffle').addEventListener('click',()=>{config.variant=(config.variant+1)%9;refresh();});
  $('dsSave').addEventListener('click',()=>{showMessage(persist()?'Ontwerp bewaard in deze browser.':'Bewaren is hier niet toegestaan.');});
  $('dsExport').addEventListener('click',exportDesign);
  for(const role of ['AI','FG'])$('roleMode'+role)?.addEventListener('change',()=>queueMicrotask(refresh));
  $('dsCloseControls')?.addEventListener('click',()=>{const shell=$('viewStudio');shell.classList.remove('ds-controls-open');$('dsToggleControls')?.setAttribute('aria-expanded','false');});
  const rbutton=$('dsToggleControls');rbutton?.addEventListener('click',()=>{
    const shell=$('viewStudio');shell.classList.toggle('ds-controls-open');rbutton.setAttribute('aria-expanded',String(shell.classList.contains('ds-controls-open')));
  });
  // The composition surface is the first view. Legacy registers and reports
  // remain accessible through the normal rail; they are not duplicated.
  state.view='studio';selectView('studio');
  window.EmmausDashboardStudio=Object.freeze({
    config:()=>({data:config.data.slice(),parts:config.parts.slice(),layout:config.layout,primary:config.primary,visuals:{...config.visuals}}),
    build:refresh
  });
})();
