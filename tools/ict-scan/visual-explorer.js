'use strict';
/* Selectable, source-backed visualizations for Applicatielandschap.
   All counts use the same deduplicated application records as the register.
   No derived link is presented as proof of a live connection. */
(function(){
  const el = id => document.getElementById(id);
  const COLORS=['#253867','#e09b3d','#566c9d','#a1b4d0','#b98144','#687c99','#9babc0','#c9a573','#526b80','#929aba','#6f8ba4','#a37c65','#5d648a','#bdbaac'];
  const choice={area:'bars',kind:'treemap',matrix:'matrix',family:'map'};
  let focusedFamily='';
  const expandedGroups=new Set();

  function category(v){return String(v||'').trim()||'Niet ingedeeld';}
  function tally(rows,field) {
    const counts=new Map();
    for(const row of rows){const name=category(row[field]);counts.set(name,(counts.get(name)||0)+1);}
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'nl'));
  }
  function pairs(rows){
    const counts=new Map();
    for(const row of rows){
      const a=category(row.area),b=category(row.kind),key=JSON.stringify([a,b]);
      counts.set(key,(counts.get(key)||0)+1);
    }
    return [...counts].map(([key,n])=>({area:JSON.parse(key)[0],kind:JSON.parse(key)[1],count:n}));
  }
  function treemap(entries,x=0,y=0,width=100,height=100){
    if(!entries.length)return [];
    if(entries.length===1)return [{name:entries[0][0],count:entries[0][1],x,y,width,height}];
    const ordered=entries.slice().sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'nl'));
    const sum=ordered.reduce((n,p)=>n+p[1],0);
    let cut=1,running=ordered[0][1],chosenSum=running,best=Math.abs(sum/2-running);
    for(let i=2;i<ordered.length;i++){running+=ordered[i-1][1];const dist=Math.abs(sum/2-running);if(dist<best){best=dist;cut=i;chosenSum=running;}}
    const ratio=chosenSum/sum;
    if(width>=height){
      return treemap(ordered.slice(0,cut),x,y,width*ratio,height).concat(treemap(ordered.slice(cut),x+width*ratio,y,width*(1-ratio),height));
    }
    return treemap(ordered.slice(0,cut),x,y,width,height*ratio).concat(treemap(ordered.slice(cut),x,y+height*ratio,width,height*(1-ratio)));
  }
  const math=Object.freeze({tally,pairs,treemap});
  if(typeof window!=='undefined')window.EAIApplicatieVisualMath=math;
  if(!el('areaVizMode')||!el('crossMatrix')||!el('familyVisual'))return;

  const dom=(tag,cls,txt)=>{
    const node=document.createElement(tag);if(cls)node.className=cls;
    if(txt!==undefined)node.textContent=String(txt);return node;
  };
  const sum=rows=>rows.reduce((n,r)=>n+r[1],0);
  const fmt=n=>Number(n||0).toLocaleString('nl-NL');
  function palette(key){
    let n=7;for(const c of key)n=((n*31)+c.charCodeAt(0))>>>0;
    return COLORS[n%COLORS.length];
  }
  function subtitle(parent,message){parent.replaceChildren(dom('div','viz-empty',message));}
  function markClick(button,name,count,total,selected,onSelect){
    button.type='button';button.title=name+' · '+fmt(count)+' van '+fmt(total);
    button.setAttribute('aria-label',button.title+'; klik om te filteren');
    button.setAttribute('aria-pressed',String(selected===name));
    if(selected===name)button.classList.add('is-selected');
    button.addEventListener('click',()=>onSelect(name));
    return button;
  }
  function renderBars(root,entries,total,selected,select){
    const chart=dom('div','viz-bars');
    const top=Math.max(1,...entries.map(e=>e[1]));
    for(const [name,count] of entries){
      const b=markClick(dom('button','viz-bar'),name,count,total,selected,select);
      const label=dom('span','viz-bar-label',name),track=dom('span','viz-bar-track');
      const fill=dom('span','viz-bar-fill');fill.style.width=(count/top*100).toFixed(3)+'%';fill.style.backgroundColor=palette(name);
      track.append(fill);b.append(label,track,dom('strong','viz-bar-number',fmt(count)));chart.append(b);
    }
    root.append(chart);
  }
  function renderDonut(root,entries,total,selected,select){
    const section=dom('div','viz-donut-layout');
    let acc=0;const slices=[];
    for(const [name,count] of entries){
      const start=acc/total*360;acc+=count;
      slices.push(palette(name)+' '+start.toFixed(3)+'deg '+(acc/total*360).toFixed(3)+'deg');
    }
    const ring=dom('div','viz-donut-ring');
    ring.style.background='conic-gradient('+slices.join(',')+')';
    ring.setAttribute('role','img');
    const unit=root.dataset.unit||(root.id==='phaseChart'?'lesfasevermeldingen':(root.id==='aiProducts'?'AI-functies':'registraties'));
    ring.setAttribute('aria-label',fmt(total)+' '+unit+' verdeeld over '+entries.length+' categorieën');
    const center=dom('div','viz-donut-center');
    center.append(dom('strong','',fmt(total)),dom('span','',unit));ring.append(center);
    const legend=dom('div','viz-donut-legend');
    for(const [name,count] of entries){
      const b=markClick(dom('button','viz-legend-row'),name,count,total,selected,select);
      const dot=dom('i','viz-legend-dot');dot.style.backgroundColor=palette(name);
      const label=dom('span','viz-legend-label',name);
      const n=dom('strong','',fmt(count));
      const share=dom('small','',((count/total)*100).toLocaleString('nl-NL',{maximumFractionDigits:1})+'%');
      b.append(dot,label,n,share);legend.append(b);
    }
    section.append(ring,legend);root.append(section);
  }
  function renderTiles(root,entries,total,selected,select){
    const stage=dom('div','viz-treemap');
    for(const item of treemap(entries)){
      const b=markClick(dom('button','viz-tile'),item.name,item.count,total,selected,select);
      b.style.left=item.x.toFixed(4)+'%';b.style.top=item.y.toFixed(4)+'%';
      b.style.width=item.width.toFixed(4)+'%';b.style.height=item.height.toFixed(4)+'%';
      b.style.backgroundColor=palette(item.name);
      const color=palette(item.name);const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),blue=parseInt(color.slice(5,7),16);
      if((0.2126*r+0.7152*g+0.0722*blue)>157)b.style.color='#1f3455';
      if(item.width<19||item.height<19)b.classList.add('viz-tile-small');
      b.append(dom('span','viz-tile-label',item.name),dom('strong','',fmt(item.count)));
      stage.append(b);
    }
    root.append(stage);
  }
  function renderTable(root,entries,total,selected,select){
    const shell=dom('div','viz-table-wrap'),table=dom('table','viz-data-table');
    const head=dom('thead'),tr=dom('tr');
    for(const h of ['Categorie','Aantal','Aandeel']){const th=dom('th','',h);th.scope='col';tr.append(th);}
    head.append(tr);table.append(head);
    const body=dom('tbody');
    for(const [name,count] of entries){
      const row=dom('tr'),cell=dom('td');
      cell.append(markClick(dom('button','viz-table-choice',name),name,count,total,selected,select));
      row.append(cell,dom('td','viz-num',fmt(count)),dom('td','viz-num',((count/total)*100).toLocaleString('nl-NL',{maximumFractionDigits:1})+'%'));body.append(row);
    }
    table.append(body);shell.append(table);root.append(shell);
  }
  function showEntries(root,entries,mode,selected,select){
    root.classList.add('viz-stage');
    root.replaceChildren();
    const total=sum(entries);
    if(!total){subtitle(root,'Geen registraties bij deze combinatie. Wis een filter.');return;}
    if(mode==='donut')renderDonut(root,entries,total,selected,select);
    else if(mode==='treemap')renderTiles(root,entries,total,selected,select);
    else if(mode==='table')renderTable(root,entries,total,selected,select);
    else renderBars(root,entries,total,selected,select);
  }
  // The dashboard composer reuses these exact, already verified chart renderers.
  // The existing view code remains the owner of all source-specific definitions.
  window.EmmausChartViews=Object.freeze({
    modes:Object.freeze(['bars','donut','treemap','table']),
    render(root,entries,mode,selected,select,unit){
      if(!root||!Array.isArray(entries)||!this.modes.includes(mode))throw Error('Ongeldige visualisatiekeuze');
      if(unit)root.dataset.unit=unit;
      showEntries(root,entries,mode,selected,select);
    }
  });
  function showChart(id,rows,field,mode,selected,select){
    const root=el(id);root.className='viz-stage';
    const entries=tally(rows,field);
    showEntries(root,entries,mode,selected,select);
    // Every mode includes all categories. No silent top-N truncation.
    if(sum(entries)!==rows.length)throw Error('De telling per '+field+' sluit niet op de bron aan.');
  }
  function selectDimension(field,value){
    const key=field==='area'?'overviewArea':'overviewKind';
    state[key]=state[key]===value?'':value;
    renderOverview();
  }
  function selectedApps(){
    return array(state.apps).filter(a=>(!state.overviewArea||category(a.area)===state.overviewArea)&&(!state.overviewKind||category(a.kind)===state.overviewKind));
  }
  function renderInventoryLine(){
    const meta=state.metadata||{},apps=state.apps.size,ai=state.ai.size,entra=state.connections.size,candidates=state.candidates?.size||0;
    const date=String(meta.firstInventoryStarted||'').match(/^\d{4}-\d{2}-\d{2}$/)
      ?new Date(meta.firstInventoryStarted+'T00:00:00').toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'}) : 'onbekend';
    const cutoff=String(meta.evidenceCutoff||'');
    el('inventoryMetaLine').textContent='Eerste inventarisatie '+date+(cutoff?' · bronpeildatum '+new Date(cutoff+'T00:00:00').toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'}):'')+' · '+String(meta.compiledBy||'');
    el('inventoryPopulation').textContent=fmt(apps)+' basis · '+fmt(ai)+' AI-functies · '+fmt(entra)+' Entra · '+fmt(candidates)+' kandidaten';
  }
  function renderTrustMetrics(selected){
    const all=array(state.apps),ai=array(state.ai),entra=array(state.connections);
    const ids=new Set(selected.map(x=>x.id));
    const relevantAi=ai.filter(x=>ids.has(x.parentId));
    const aiAppIds=new Set(relevantAi.map(x=>x.parentId));
    const possibleMatches=entra.filter(x=>ids.has(x.matchedId));
    function tile(label,value,detail){
      const box=dom('div','kpi trust-kpi');box.append(dom('span','kpi-label',label),dom('strong','kpi-value',fmt(value)),dom('span','kpi-desc',detail));return box;
    }
    const kpiRoot=el('kpiGrid');kpiRoot.replaceChildren(
      tile('Basisregistraties',selected.length,(selected.length===all.length?'':fmt(all.length)+' totaal · ')+'actueel gebruik niet overal bevestigd'),
      tile('Met beschreven AI',aiAppIds.size,'Van '+fmt(selected.length)+' geselecteerde toepassingen'),
      tile('AI-functies',relevantAi.length,fmt(ai.length)+' beschreven in totaal; niet automatisch actief'),
      tile('Mogelijke Entra-match',possibleMatches.length,'Van '+fmt(entra.length)+' registraties; geen bewijs van werking')
    );
  }
  function renderCoverage(selected){
    const ai=array(state.ai);
    const total=selected.length;
    const valid=value=>String(value||'').trim()!==''&&!hasUnknown(value);
    const stats=[
      ['Beschrijving aanwezig',selected.filter(a=>valid(a.description)).length,total],
      ['Verantwoordelijke benoemd',selected.filter(a=>valid(a.owner)).length,total],
      ['Lokaal gebruik bevestigd',selected.filter(a=>valid(a.local)).length,total],
      ['Gegevensuitwisseling beschreven',selected.filter(a=>valid(a.links)).length,total]
    ];
    const wrap=el('coverage');wrap.replaceChildren();
    for(const [title,count,denominator] of stats){
      const row=dom('div','coverage-row evidence-row');
      const header=dom('div','evidence-head');
      header.append(dom('span','coverage-name',title),dom('strong','',fmt(count)+' / '+fmt(denominator)));
      const rail=dom('div','coverage-progress'),fill=dom('div');
      fill.style.width=(denominator?count/denominator*100:0).toFixed(2)+'%';rail.append(fill);
      row.append(header,rail);wrap.append(row);
    }
    const foot=dom('p','viz-caption evidence-foot','Een open veld betekent: nog niet vastgesteld in de gebruikte bron. Dit is geen oordeel over de werkelijke schoolpraktijk.');
    wrap.append(foot);
  }
  function renderCrossMatrix(){
    const apps=array(state.apps),byArea=tally(apps,'area').map(x=>x[0]),byKind=tally(apps,'kind').map(x=>x[0]);
    const joint=new Map(pairs(apps).map(x=>[JSON.stringify([x.area,x.kind]),x.count]));
    const total=apps.length,observed=[...joint.values()].reduce((n,x)=>n+x,0);
    const result=el('crossMatrix');result.replaceChildren();result.className='cross-matrix';
    el('matrixContext').textContent=fmt(total)+' basisregistraties · de cellen tellen samen op tot '+fmt(observed)+'. Selecteer een vak om toepassingen te filteren.';
    if(total!==observed){subtitle(result,'De matrix kan niet worden weergegeven: de aantallen sluiten niet aan.');return;}
    if(choice.matrix==='table'){
      const table=dom('table','viz-data-table'),thead=dom('thead'),tr=dom('tr');
      for(const label of ['Gebruiksgebied','Soort','Aantal','Aandeel'])tr.append(dom('th','',label));
      thead.append(tr);table.append(thead);
      const tbody=dom('tbody');
      for(const cell of pairs(apps).sort((a,b)=>b.count-a.count||a.area.localeCompare(b.area,'nl'))){
        const row=dom('tr');
        for(const text of [cell.area,cell.kind]){
          const td=dom('td'),btn=dom('button','viz-table-choice',text);btn.type='button';
          btn.addEventListener('click',()=>{const same=state.overviewArea===cell.area&&state.overviewKind===cell.kind;state.overviewArea=same?'':cell.area;state.overviewKind=same?'':cell.kind;renderOverview();});
          td.append(btn);row.append(td);
        }
        row.append(dom('td','viz-num',fmt(cell.count)),dom('td','viz-num',((cell.count/total)*100).toLocaleString('nl-NL',{maximumFractionDigits:1})+'%'));
        tbody.append(row);
      }
      table.append(tbody);const shell=dom('div','viz-table-wrap');shell.append(table);result.append(shell);return;
    }
    const shell=dom('div','heat-scroll'),table=dom('table','heat-table');
    const h=dom('thead'),header=dom('tr');
    header.append(dom('th','heat-sticky','Gebied / soort'));
    for(const kind of byKind){const cell=dom('th','heat-label',kind);cell.title=kind;cell.scope='col';header.append(cell);}
    header.append(dom('th','heat-total-head','Totaal'));h.append(header);table.append(h);
    const body=dom('tbody');
    const max=Math.max(1,...joint.values());
    for(const area of byArea){
      const row=dom('tr'),left=dom('th','heat-sticky',area);left.scope='row';row.append(left);
      for(const kind of byKind){
        const n=joint.get(JSON.stringify([area,kind]))||0;
        const td=dom('td','heat-cell');
        if(n){
          const selected=state.overviewArea===area&&state.overviewKind===kind;
          const btn=dom('button','heat-value',fmt(n));
          btn.type='button';const alpha=0.1+0.68*Math.pow(n/max,0.72);
          btn.style.backgroundColor='rgba(48,74,127,'+alpha.toFixed(3)+')';
          btn.style.color=alpha<0.48?'#263e66':'#ffffff';
          btn.setAttribute('aria-label',area+' / '+kind+': '+fmt(n)+' toepassingen; klik om te filteren');
          btn.setAttribute('aria-pressed',String(selected));
          btn.title=area+' · '+kind+' · '+n+' van '+total;
          if(selected)btn.classList.add('is-selected');
          btn.addEventListener('click',()=>{
            const same=state.overviewArea===area&&state.overviewKind===kind;
            state.overviewArea=same?'':area;state.overviewKind=same?'':kind;renderOverview();
          });
          td.append(btn);
        }else td.append(dom('span','heat-empty','·'));
        row.append(td);
      }
      row.append(dom('th','heat-row-total',fmt(apps.filter(x=>category(x.area)===area).length)));body.append(row);
    }
    const foot=dom('tr','heat-footer');foot.append(dom('th','heat-sticky','Totaal'));
    for(const kind of byKind)foot.append(dom('th','',fmt(apps.filter(x=>category(x.kind)===kind).length)));
    foot.append(dom('th','',fmt(total)));body.append(foot);
    table.append(body);shell.append(table);result.append(shell);
  }
  function recordedConnections(app){
    const groups=[['apps','apps'],['ai','ai'],['connections','connections'],['parts','parts'],['additionalCandidates','candidates'],['checks','checks'],['dpia','dpia'],['aiControls','aiControls'],['devices','devices'],['licenseReview','licenseReview'],['workActions','workActions'],['softwareReview','softwareReview'],['faqs','faqs']];
    const lookup=Object.fromEntries(groups.map(([type,store])=>[type,state[store]]));
    const linked=[],seen=new Set();
    for(const [type,store] of groups){
      for(const current of state[store]?.values()||[]){
        for(const relation of current.relations||[]){
          const outgoing=type==='apps'&&current.id===app.id;
          const incoming=relation.targetType==='apps'&&relation.targetId===app.id;
          if(!outgoing&&!incoming)continue;
          const target=outgoing?lookup[relation.targetType]?.get(relation.targetId):current;
          const otherType=outgoing?relation.targetType:type;
          if(!target)continue;
          const id=type+'/'+current.id+'/'+relation.relationType+'/'+relation.targetType+'/'+relation.targetId;
          if(seen.has(id))continue;seen.add(id);
          linked.push({
            id:target.id,name:target.name||target.id,cardType:otherType,
            description:relation.relationType+' · '+(relation.status||'Status onbekend')+
              (relation.evidence?' · Bron: '+relation.evidence:' · Bron nog niet vastgelegd')+
              (relation.note?' · '+relation.note:'')
          });
        }
      }
    }
    return linked;
  }
  function applicableRules(app){
    return (app.frameworkLinks||[]).map(link=>({
      id:link.frameworkId+' '+link.article,
      name:link.frameworkId+' · '+link.article,
      description:(link.status||'Nog te beoordelen')+
        (link.evidence?' · Bron: '+link.evidence:' · Bewijs ontbreekt')+
        (link.note?' · '+link.note:'')
    }));
  }
  function matchingFamily(app){
    const key=normalize(app.name);
    return [
      {key:'child',title:'Onderliggende toepassingen',entries:array(state.apps).filter(x=>x.id!==app.id&&(x.parent===app.id||normalize(x.parent||'')===key)),view:'apps'},
      {key:'part',title:'Technische registraties',entries:array(state.parts).filter(x=>x.parent===app.id),view:''},
      {key:'ai',title:'Beschreven AI-functies',entries:array(state.ai).filter(x=>x.parentId===app.id),view:'ai'},
      {key:'entra',title:'Mogelijke Entra-matches',entries:array(state.connections).filter(x=>x.matchedId===app.id),view:'connections'},
      {key:'recorded',title:'Beoordeelde verbanden',entries:recordedConnections(app),view:''},
      {key:'legal',title:'Gekoppelde normen en wetten',entries:applicableRules(app),view:''}
    ].filter(g=>g.entries.length>0);
  }
  function familyScore(app){return matchingFamily(app).reduce((n,g)=>n+g.entries.length,0);}
  function renderFamily(){
    const apps=array(state.apps),select=el('familyApp'),panel=el('familyVisual');panel.replaceChildren();
    const families=apps.slice().sort((a,b)=>familyScore(b)-familyScore(a)||a.name.localeCompare(b.name,'nl'));
    if(!families.length){subtitle(panel,'Er zijn nog geen relaties beschreven.');el('familyContext').textContent='Geen relaties verzonnen uit productnamen.';return;}
    const active=focusedFamily&&families.some(x=>x.id===focusedFamily)?focusedFamily:families[0].id;
    if(select.options.length!==families.length||select.value!==active){
      select.replaceChildren();for(const app of families){const opt=dom('option','',app.name+' · '+familyScore(app));opt.value=app.id;select.append(opt);}
    }
    select.value=active;focusedFamily=active;
    const app=state.apps.get(active);if(!app)return;
    const groups=matchingFamily(app),size=groups.reduce((n,g)=>n+g.entries.length,0);
    const root=dom('div','family-main');
    const label=dom('span','family-main-label',app.id+' · '+category(app.kind));
    root.append(label,dom('strong','family-main-name',app.name));
    if(app.description)root.append(dom('p','family-main-desc',app.description));
    const open=dom('button','family-open','Toepassing openen');
    open.type='button';open.addEventListener('click',()=>openRecord('apps',app.id));root.append(open);
    panel.append(root);
    if(!groups.length)panel.append(dom('p','family-no-links','Er zijn voor deze toepassing nog geen onderdelen, AI-functies of Entra-matches vastgelegd.'));
    if(choice.family==='list'){
      const list=dom('div','family-list');
      for(const group of groups){
        const head=dom('div','family-list-head',group.title+' · '+group.entries.length);list.append(head);
        for(const entry of group.entries){
          const item=dom('div','family-list-row');item.append(dom('strong','',entry.name));
          const text=entry.action||entry.description||entry.matched||entry.local||'';
          item.append(dom('span','',text));
          if(group.view||entry.cardType){
            const link=dom('button','family-open','Bekijk');
            link.type='button';link.addEventListener('click',()=>entry.cardType?window.EmmausRecordCards?.open(entry.cardType,entry.id):openRecord(group.view,entry.id));item.append(link);
          }
          list.append(item);
        }
      }
      panel.append(list);
    }else{
      const grid=dom('div','family-groups');
      for(const group of groups){
        const column=dom('section','family-branch');
        const h=dom('div','family-branch-head');
        h.append(dom('strong','',group.title),dom('span','',fmt(group.entries.length)));column.append(h);
        const expanded=expandedGroups.has(app.id+':'+group.key);
        const visible=expanded?group.entries:group.entries.slice(0,5);
        for(const entry of visible){
          if(group.view||entry.cardType){
            const b=dom('button','family-leaf');
            b.type='button';b.append(dom('strong','',entry.name),dom('span','',entry.description||entry.id));
            b.addEventListener('click',()=>entry.cardType?window.EmmausRecordCards?.open(entry.cardType,entry.id):openRecord(group.view,entry.id));column.append(b);
          }else{
            const detail=dom('details','family-leaf-details');
            detail.append(dom('summary','',entry.name));
            detail.append(dom('p','',entry.description||'Technische registratie; gebruik nog controleren.'));
            column.append(detail);
          }
        }
        if(group.entries.length>5){
          const more=dom('button','family-more',expanded?'Minder tonen':(group.entries.length-5)+' meer tonen');
          more.type='button';more.addEventListener('click',()=>{const k=app.id+':'+group.key;if(expandedGroups.has(k))expandedGroups.delete(k);else expandedGroups.add(k);renderFamily();});
          column.append(more);
        }
        grid.append(column);
      }
      panel.append(grid);
    }
    el('familyContext').textContent=size?fmt(size)+' bronrelaties in '+fmt(groups.length)+' soorten; onderdelen en matches kunnen naar dezelfde registratie verwijzen. Een Entra-match is geen bevestigde actieve koppeling.':'Geen bronrelaties vastgesteld; dit zegt niets over de feitelijke technische inrichting.';
  }

  const previousRenderOverview=renderOverview;
  renderOverview=function(){
    state.chartMode='bars'; // Old presentation is immediately replaced with the selected complete chart.
    previousRenderOverview();
    if(!state.ready)return;
    const apps=array(state.apps),selected=selectedApps();
    renderInventoryLine();renderTrustMetrics(selected);renderCoverage(selected);
    const byKind=apps.filter(x=>!state.overviewKind||category(x.kind)===state.overviewKind);
    const byArea=apps.filter(x=>!state.overviewArea||category(x.area)===state.overviewArea);
    showChart('areaChart',byKind,'area',choice.area,state.overviewArea,value=>selectDimension('area',value));
    showChart('typeChart',byArea,'kind',choice.kind,state.overviewKind,value=>selectDimension('kind',value));
    el('areaChartCaption').textContent=fmt(byKind.length)+' registraties in '+tally(byKind,'area').length+' gebruiksgebieden · '+(state.overviewKind?'Soort: '+state.overviewKind:'Alle soorten')+' · klik om te filteren.';
    el('kindChartCaption').textContent=fmt(byArea.length)+' registraties in '+tally(byArea,'kind').length+' soorten · '+(state.overviewArea?'Gebied: '+state.overviewArea:'Alle gebruiksgebieden')+' · klik om te filteren.';
    renderCrossMatrix();renderFamily();
    const link=el('overviewToApps');if(link)link.textContent='Open '+fmt(selected.length)+' toepassingen';
  };
  for(const [id,key] of [['areaVizMode','area'],['kindVizMode','kind'],['matrixVizMode','matrix'],['familyMode','family']]){
    const control=el(id);
    choice[key]=control.value;
    control.addEventListener('change',()=>{choice[key]=control.value;if(key==='family')renderFamily();else renderOverview();});
  }
  // The same visual choices also work on the AI and Entra pages.
  choice.phase=el('phaseVizMode').value;
  choice.aiProduct=el('aiProductVizMode').value;
  choice.connection=el('connectionVizMode').value;
  const beforeRenderAi=renderAi;
  renderAi=function(){
    beforeRenderAi();
    if(!state.ready)return;
    const ai=array(state.ai).filter(isClassroomAi);
    const assignments=[];
    for(const item of ai)for(const phase of IctScanTaxonomy.chartPhases(item))assignments.push({phase});
    showChart('phaseChart',assignments,'phase',choice.phase,state.phase,value=>{
      state.phase=state.phase===value?'':value;renderAi();
    });
    showChart('aiProducts',ai,'product',choice.aiProduct,state.aiProduct,value=>{
      state.aiProduct=state.aiProduct===value?'':value;renderAi();
    });
    el('aiProductsCaption').textContent=fmt(ai.length)+' beschreven onderwijsfuncties. Dit zijn geen zelfstandige toepassingen en niet automatisch ingeschakelde functies.';
  };
  const beforeRenderConnections=renderConnections;
  renderConnections=function(){
    beforeRenderConnections();
    if(!state.ready)return;
    const all=array(state.connections).map(item=>({status:connectionState(item)}));
    const selected=el('connectionsStatus').value;
    showChart('connectionChart',all,'status',choice.connection,selected,value=>{
      el('connectionsStatus').value=selected===value?'':value;
      renderConnections();
    });
  };
  for(const [id,key,render] of [
    ['phaseVizMode','phase',()=>renderAi()],
    ['aiProductVizMode','aiProduct',()=>renderAi()],
    ['connectionVizMode','connection',()=>renderConnections()]
  ]){
    el(id).addEventListener('change',()=>{choice[key]=el(id).value;render();});
  }
  el('familyApp').addEventListener('change',()=>{focusedFamily=el('familyApp').value;expandedGroups.clear();renderFamily();});
  el('overviewToApps').addEventListener('click',()=>{
    state.area=state.overviewArea||'';state.type=state.overviewKind||'';
    if(state.ready)renderApps();
  });
})();
