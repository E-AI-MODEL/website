'use strict';
/* Complete relationship explorer. Reads only IctInventoryIndex and existing source records.
   No inferred links, no second persisted dataset and no change to role permissions. */
(function(){
  const NS='http://www.w3.org/2000/svg';
  const $=id=>document.getElementById(id);
  const TYPE_NAMES=Object.freeze({
    apps:'Applicaties',ai:'AI-functies',connections:'Entra-registraties',
    parts:'Onderdelen',additionalCandidates:'Overige software',checks:'Controles',
    dpia:'Privacybronnen',aiControls:'AI-beheer',devices:'Apparaatmetingen',
    hardwareGroups:'Apparaatgroepen',licenseReview:'Licenties',
    workActions:'Acties',softwareReview:'Softwarecontrole',
    faqs:'Vragen en antwoorden',sourceRegister:'Bronnen'
  });
  const RELATION_NAMES=Object.freeze({
    part_of:'Onderdeel van',integration:'Gekoppeld aan',sso:'Eenmalige aanmelding',
    registered_as:'Geregistreerd in Entra',possible_match:'Mogelijke overeenkomst',
    reviews:'Controleert',managed_by:'Wordt beheerd via',
    license_review:'Licentiecontrole',software_review:'Softwarecontrole',
    follow_up:'Vervolgactie',supports:'Ondersteunt'
  });
  const key=(type,id)=>JSON.stringify([type,String(id)]);
  const label=type=>TYPE_NAMES[type]||type;
  const relationName=type=>RELATION_NAMES[type]||String(type).replace(/_/g,' ');
  const fmt=n=>Number(n||0).toLocaleString('nl-NL');
  const el=(tag,cls,txt)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(txt!==undefined)node.textContent=String(txt);
    return node;
  };
  const button=(txt,cls,onClick)=>{
    const b=el('button',cls,txt);b.type='button';b.addEventListener('click',onClick);return b;
  };
  const svgNode=(tag,attributes,txt)=>{
    const node=document.createElementNS(NS,tag);
    for(const [name,value] of Object.entries(attributes||{}))node.setAttribute(name,String(value));
    if(txt!==undefined)node.textContent=String(txt);
    return node;
  };
  const shorten=(value,n=22)=>String(value||'Naam onbekend').length>n?String(value).slice(0,n-1)+'…':String(value||'Naam onbekend');
  function csvSafe(value){
    let v=String(value==null?'':value);
    if(/^[\s]*[=+\-@\t\r]/.test(v))v="'"+v;
    return '"'+v.replace(/"/g,'""')+'"';
  }
  const dialog=document.createElement('dialog');
  dialog.id='relationAtlasDialog';dialog.className='relation-atlas-dialog';
  dialog.setAttribute('aria-labelledby','relationAtlasTitle');
  const shell=el('div','ra-shell');
  const header=el('header','ra-header');
  const heading=el('div','ra-heading');
  heading.append(el('p','ra-overline','ICT-SCAN'),el('h2','', 'Alle verbanden'));
  heading.querySelector('h2').id='relationAtlasTitle';
  heading.append(el('p','ra-intro','Geregistreerde en vermoedelijke verbanden uit dezelfde gegevensindex. Geen van beide bewijst op zichzelf een actieve koppeling.'));
  const headerActions=el('div','ra-head-actions');
  const exportButton=button('CSV downloaden','ra-action',()=>exportCsv());
  const closeButton=button('Sluiten','ra-close',()=>close());
  headerActions.append(exportButton,closeButton);
  header.append(heading,headerActions);

  const toolbar=el('div','ra-toolbar');
  const search=el('input','ra-search');
  search.type='search';search.placeholder='Zoek op naam of registratienummer';
  search.setAttribute('aria-label','Zoek een applicatie of registratie in alle verbanden');
  const typeSelect=el('select','ra-select');
  typeSelect.setAttribute('aria-label','Filter onderdeel');
  const statusSelect=el('select','ra-select');
  statusSelect.setAttribute('aria-label','Filter status van het verband');
  for(const [value,name] of [['','Alle statussen'],['Bevestigd','Bevestigd'],['Geregistreerd','Geregistreerd'],['Vermoedelijk','Vermoedelijk'],['Historisch','Historisch']]){
    const opt=el('option','',name);opt.value=value;statusSelect.append(opt);
  }
  const relationSelect=el('select','ra-select');
  relationSelect.setAttribute('aria-label','Filter soort verband');
  const reset=button('Wis filters','ra-action ra-reset',()=>resetFilters());
  toolbar.append(search,typeSelect,statusSelect,relationSelect,reset);

  const stats=el('div','ra-stats');
  stats.id='relationAtlasStats';
  const area=el('div','ra-content');
  const graphWrap=el('section','ra-graph-wrap');
  graphWrap.setAttribute('aria-label','Netwerkdiagram');
  const graphTitle=el('div','ra-graph-title');
  const graphHeadline=el('strong','','Verbanden per onderdeel');
  const graphSub=el('span','');
  graphTitle.append(graphHeadline,graphSub);
  const graphControls=el('div','ra-graph-controls');
  const zoomOut=button('−','ra-zoom',()=>setZoom(zoom/1.25));
  const zoomIn=button('+','ra-zoom',()=>setZoom(zoom*1.25));
  zoomOut.setAttribute('aria-label','Verklein diagram');
  zoomIn.setAttribute('aria-label','Vergroot diagram');
  const zoomReset=button('100%','ra-zoom-label',()=>setZoom(1));
  const graphMode=el('select','ra-select ra-graph-mode');graphMode.setAttribute('aria-label','Netwerkweergave');for(const [v,t] of [['groups','Groepen'],['network','Netwerk van registraties']]){const opt=el('option','',t);opt.value=v;graphMode.append(opt);}graphMode.addEventListener('change',()=>{mode=graphMode.value;focused=null;zoom=1;render();});
  graphControls.append(zoomOut,zoomReset,zoomIn);
  graphControls.prepend(graphMode);
  const backToNetwork=button('Terug naar netwerk','ra-action ra-back-network',()=>{focused=null;zoom=1;render();});backToNetwork.hidden=true;
  graphTitle.append(backToNetwork,graphControls);
  const graphScroll=el('div','ra-graph-scroll');
  const svg=svgNode('svg',{viewBox:'0 0 1000 600',class:'ra-graph',role:'img','aria-label':'Relaties tussen registraties'});
  graphScroll.append(svg);
  const mobileGraph=el('div','ra-mobile-graph');
  mobileGraph.setAttribute('aria-label','Relaties per onderdeel');
  const graphNote=el('p','ra-footnote');
  const legend=el('div','ra-network-legend');graphWrap.append(graphTitle,legend,graphScroll,mobileGraph,graphNote);
  const detail=el('aside','ra-detail');
  detail.setAttribute('aria-label','Geselecteerde registratie');
  area.append(graphWrap,detail);

  const searchMatches=el('div','ra-matches');
  const listHeader=el('div','ra-list-head');
  const listTitle=el('h3','','Alle vastgelegde verbanden');
  const listCaption=el('span','');
  listHeader.append(listTitle,listCaption);
  const list=el('div','ra-link-list');
  list.setAttribute('role','list');
  const foot=el('p','ra-bottom-note','Bronverwijzingen zijn bewijsinformatie, geen technische koppelingen. Ze worden bij de afzonderlijke registratie getoond.');
  shell.append(header,toolbar,stats,searchMatches,area,listHeader,list,foot);
  dialog.append(shell);
  document.body.append(dialog);

  let index=null,focused=null,zoom=1,matchedNodes=[],currentEdges=[],mode='groups',openState=false,opener=null;
  function node(type,id){return index?.get(type,id)||null;}
  const fullName=(type,id)=>node(type,id)?.record?.name||id;
  function endpoints(edge){
    return [[edge.fromType,edge.fromId],[edge.toType,edge.toId]];
  }
  function edgeName(edge){return fullName(edge.fromType,edge.fromId)+' - '+fullName(edge.toType,edge.toId);}
  function sourceFor(edge){return edge.evidence||'Niet geregistreerd';}
  function addStat(title,value,hint){
    const block=el('div','ra-stat');
    block.append(el('small','',title),el('strong','',value));
    if(hint)block.append(el('span','',hint));
    stats.append(block);
  }
  function fillOptions(select,entries,firstLabel){
    const old=select.value;
    select.replaceChildren();
    const first=el('option','',firstLabel);first.value='';select.append(first);
    for(const [value,name] of entries){
      const opt=el('option','',name);opt.value=value;select.append(opt);
    }
    select.value=entries.some(([v])=>v===old)?old:'';
  }
  function initFilters(){
    if(!index)return;
    const types=[...new Set([...index.nodes.values()].map(n=>n.type))].sort((a,b)=>label(a).localeCompare(label(b),'nl'));
    const relations=[...new Set(index.edges.map(x=>x.relationType))].sort((a,b)=>relationName(a).localeCompare(relationName(b),'nl'));
    fillOptions(typeSelect,types.map(t=>[t,label(t)]),'Alle onderdelen');
    fillOptions(relationSelect,relations.map(r=>[r,relationName(r)]),'Alle soorten verbanden');
  }
  function ensureIndex(){
    const builder=window.IctInventoryIndex?.build;
    if(typeof builder!=='function'||typeof state!=='object'||!state.ready)return false;
    index=builder(state);
    return true;
  }
  function filterEdges(){
    if(!index)return [];
    const query=search.value.trim().toLocaleLowerCase('nl-NL');
    const type=typeSelect.value,status=statusSelect.value,kind=relationSelect.value;
    return index.edges.filter(edge=>{
      if(kind&&edge.relationType!==kind)return false;
      if(status&&edge.status!==status)return false;
      if(type&&edge.fromType!==type&&edge.toType!==type)return false;
      if(focused&&!endpoints(edge).some(([t,id])=>t===focused.type&&id===focused.id))return false;
      if(query&&![
        edge.fromId,edge.toId,fullName(edge.fromType,edge.fromId),
        fullName(edge.toType,edge.toId),relationName(edge.relationType)
      ].some(x=>String(x).toLocaleLowerCase('nl-NL').includes(query)))return false;
      return true;
    });
  }
  function svgText(x,y,value,cls){
    return svgNode('text',{x,y,'text-anchor':'middle',class:cls},value);
  }
  function selection(type,id){
    focused={type,id};
    // Searching within an item must not silently suppress its own connections.
    search.value='';
    typeSelect.value='';statusSelect.value='';relationSelect.value='';
    zoom=1;render();
  }
  function clickNode(group,action){
    group.setAttribute('role','button');
    group.setAttribute('tabindex','0');
    group.addEventListener('click',action);
    group.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}
    });
  }
  function drawGroupGraph(edges){
    graphHeadline.textContent='Verbanden per onderdeel';
    graphSub.textContent='Kies een groep voor de bijbehorende registraties';
    const types=[...new Set(edges.flatMap(e=>[e.fromType,e.toType]))]
      .sort((a,b)=>label(a).localeCompare(label(b),'nl'));
    const countMap=new Map();
    for(const e of edges){
      const id=[e.fromType,e.toType].sort().join('|');
      if(!countMap.has(id))countMap.set(id,{a:e.fromType,b:e.toType,count:0,probable:0});
      const row=countMap.get(id);row.count++;if(e.status==='Vermoedelijk')row.probable++;
    }
    if(!types.length){
      svg.append(svgText(500,270,'Geen vastgelegde verbanden bij deze selectie','ra-empty-text'));
      graphNote.textContent='Wis de filters om alle geregistreerde verbanden te zien.';
      return;
    }
    const coords=new Map();
    for(const [i,type] of types.entries()){
      const angle=(2*Math.PI*i/types.length)-Math.PI/2;
      coords.set(type,{x:500+352*Math.cos(angle),y:293+226*Math.sin(angle)});
    }
    const edgeLayer=svgNode('g',{class:'ra-edges'});
    for(const row of countMap.values()){
      const a=coords.get(row.a),b=coords.get(row.b);
      if(!a||!b)continue;
      const isLoop=row.a===row.b;
      const attrs=isLoop
        ?{d:'M'+(a.x+28)+' '+(a.y-14)+' C'+(a.x+96)+' '+(a.y-102)+' '+(a.x-82)+' '+(a.y-102)+' '+(a.x-28)+' '+(a.y-14)}
        :{d:'M'+a.x+' '+a.y+' Q'+(500+(a.x+b.x-1000)*.10)+' '+(293+(a.y+b.y-586)*.10)+' '+b.x+' '+b.y};
      const path=svgNode('path',{...attrs,class:'ra-line'+(row.probable===row.count?' ra-probable':''),'stroke-width':Math.min(9,1.6+Math.sqrt(row.count))});
      path.append(svgNode('title',{},row.count+' verbanden tussen '+label(row.a)+' en '+label(row.b)+', waarvan '+row.probable+' vermoedelijk'));
      edgeLayer.append(path);
    }
    svg.append(edgeLayer);
    const degree=new Map();
    for(const e of edges){degree.set(e.fromType,(degree.get(e.fromType)||0)+1);if(e.fromType!==e.toType)degree.set(e.toType,(degree.get(e.toType)||0)+1);}
    for(const type of types){
      mobileGraph.append(button(label(type)+' · '+fmt(degree.get(type)||0),'ra-mobile-group',()=>{typeSelect.value=type;focused=null;render();}));
    }
    for(const [type,p] of coords){
      const group=svgNode('g',{class:'ra-type-group','aria-label':label(type)+', '+(degree.get(type)||0)+' verbanden'});
      group.append(svgNode('circle',{cx:p.x,cy:p.y,r:34,class:'ra-type-circle'}));
      group.append(svgText(p.x,p.y+7,fmt(degree.get(type)||0),'ra-type-count'));
      const names=label(type).split(' ');
      if(names.length>2){
        const mid=Math.ceil(names.length/2);
        group.append(svgText(p.x,p.y+50,names.slice(0,mid).join(' '),'ra-type-label'));
        group.append(svgText(p.x,p.y+63,names.slice(mid).join(' '),'ra-type-label'));
      }else group.append(svgText(p.x,p.y+50,label(type),'ra-type-label'));
      clickNode(group,()=>{typeSelect.value=type;focused=null;render();});
      svg.append(group);
    }
    graphNote.textContent=fmt(edges.length)+' afzonderlijke verbanden samengevat per soort. Kies een groep of zoek een registratie. De volledige lijst staat onder het diagram.';
  }
  // Deterministic graph of the actual indexed endpoints. Node positions encode
  // no measured distance, direction of traffic or technical dependency.
  const palette=['#355f91','#c77c35','#409082','#756ab0','#a95369','#708a45','#60768c','#bd9740','#4383a9','#936eac','#668bb9','#8f7971','#287b8c','#668150','#b76f49'];
  function drawNetworkGraph(edges){
    graphHeadline.textContent='Netwerk van registraties';
    graphSub.textContent='Klik op een knooppunt voor de directe verbanden';
    const all=new Map();
    for(const edge of edges)for(const [type,id] of endpoints(edge)){
      const k=key(type,id);
      if(!all.has(k))all.set(k,{k,type,id,degree:0});
      all.get(k).degree++;
    }
    const ordered=[...all.values()].sort((a,b)=>b.degree-a.degree||a.k.localeCompare(b.k));
    const shown=ordered.slice(0,400);
    const lookup=new Map(shown.map((n,i)=>[n.k,i]));
    const pairs=edges.map(e=>({a:lookup.get(key(e.fromType,e.fromId)),b:lookup.get(key(e.toType,e.toId)),edge:e})).filter(e=>e.a!==undefined&&e.b!==undefined);
    if(!shown.length){svg.append(svgText(500,270,'Geen verbanden in deze selectie','ra-empty-text'));graphNote.textContent='Wis de filters om het netwerk te bekijken.';return;}
    const types=[...new Set(shown.map(n=>n.type))].sort();
    const colors=new Map(types.map(t=>[t,palette[Math.max(0,Object.keys(TYPE_NAMES).indexOf(t))%palette.length]]));
    for(const type of types){const swatch=el('i','ra-legend-dot');swatch.style.background=colors.get(type);const item=el('span','ra-legend-item');item.append(swatch,el('span','',label(type)));legend.append(item);}
    legend.append(el('span','ra-legend-item','Gestippeld: vermoedelijk · Doorgetrokken: geregistreerd/bevestigd · Dun grijs: historisch'));
    // Place each connected component separately. No position is clamped to a
    // rectangular edge: forces are resolved first, then fitted proportionally.
    const n=shown.length,adj=shown.map(()=>new Set());
    for(const {a,b} of pairs){if(a!==b){adj[a].add(b);adj[b].add(a);}}
    const seen=new Set(),components=[];
    for(let i=0;i<n;i++){
      if(seen.has(i))continue;
      const queue=[i];seen.add(i);
      for(let j=0;j<queue.length;j++)for(const id of adj[queue[j]])if(!seen.has(id)){seen.add(id);queue.push(id);}
      components.push(queue);
    }
    components.sort((a,b)=>b.length-a.length||a[0]-b[0]);
    const fit=(ids,x,y,w,h)=>{
      const pad=Math.min(22,w*.15,h*.15),m=ids.length,area=Math.max(1,w*h);
      const k=Math.sqrt(area/Math.max(1,m))*.83;
      const member=new Set(ids);
      const localPairs=[];for(const a of ids)for(const b of adj[a])if(a<b&&member.has(b))localPairs.push([a,b]);
      ids.forEach((id,j)=>{
        const p=shown[id],a=j*2.399963229728653,r=k*Math.sqrt(j+.5);
        p.x=r*Math.cos(a);p.y=r*Math.sin(a);p.dx=0;p.dy=0;
      });
      if(m===2){shown[ids[0]].x=-1;shown[ids[0]].y=0;shown[ids[1]].x=1;shown[ids[1]].y=0;if(h>w){shown[ids[0]].x=0;shown[ids[0]].y=-1;shown[ids[1]].x=0;shown[ids[1]].y=1;}}
      else if(m>2){
        const steps=m>50?125:75;
        for(let step=0;step<steps;step++){
          const temperature=Math.max(.2,k*1.6*Math.pow(1-step/steps,1.8));
          for(const id of ids){const p=shown[id];p.dx=-p.x*.035;p.dy=-p.y*.035;}
          for(let i=0;i<m;i++)for(let j=i+1;j<m;j++){
            const a=shown[ids[i]],b=shown[ids[j]],dx=a.x-b.x,dy=a.y-b.y,d2=Math.max(.01,dx*dx+dy*dy),f=k*k/d2;
            a.dx+=dx*f;a.dy+=dy*f;b.dx-=dx*f;b.dy-=dy*f;
          }
          for(const [i,j] of localPairs){const a=shown[i],b=shown[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.1,Math.hypot(dx,dy)),f=d/k;a.dx+=dx*f;a.dy+=dy*f;b.dx-=dx*f;b.dy-=dy*f;}
          for(const id of ids){const p=shown[id],d=Math.hypot(p.dx,p.dy),factor=d?Math.min(temperature,d)/d:0;p.x+=p.dx*factor;p.y+=p.dy*factor;}
        }
      }
      const points=ids.map(i=>shown[i]),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const spanX=maxX-minX,spanY=maxY-minY;
      const sx=(w-2*pad)/Math.max(1,spanX),sy=(h-2*pad)/Math.max(1,spanY);
      const uniform=Math.min(sx,sy,m===2?Math.min(w,h)*.32:Infinity);
      // Layout distances carry no measurement meaning. Give the main group
      // the width and height assigned to it rather than compressing it into a strip.
      const scaleX=m>8?sx:uniform,scaleY=m>8?sy:uniform;
      for(const p of points){
        p.x=x+w/2+(p.x-(minX+maxX)/2)*scaleX;p.y=y+h/2+(p.y-(minY+maxY)/2)*scaleY;
        p.component=ids[0];p.radius=Math.min(3.1+Math.sqrt(p.degree)*1.4,10.5,Math.max(2.8,Math.min(w,h)*.1));
        p.ax=p.x;p.ay=p.y;
      }
      // Resolve collisions between actual rendered node circles. The gentle
      // anchor keeps local connectivity readable; no global border attraction.
      if(m>4)for(let pass=0;pass<36;pass++){
        for(let i=0;i<m;i++)for(let j=i+1;j<m;j++){
          const a=points[i],b=points[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.001,Math.hypot(dx,dy)),min=a.radius+b.radius+3;
          if(d>=min)continue;
          const ux=d<.002?Math.cos((i+j)*2.4):dx/d,uy=d<.002?Math.sin((i+j)*2.4):dy/d;
          const push=(min-d)*.49;a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;
        }
        for(const p of points){p.x+=(p.ax-p.x)*.018;p.y+=(p.ay-p.y)*.018;}
      }
      // A final translation/fitting operation keeps every circle inside its
      // allotted space without pinning many unrelated nodes to the same edge.
      const left=Math.min(...points.map(p=>p.x-p.radius)),right=Math.max(...points.map(p=>p.x+p.radius));
      const top=Math.min(...points.map(p=>p.y-p.radius)),bottom=Math.max(...points.map(p=>p.y+p.radius));
      const f=Math.min(1,(w-6)/Math.max(1,right-left),(h-6)/Math.max(1,bottom-top));
      for(const p of points){p.x=x+w/2+(p.x-(left+right)/2)*f;p.y=y+h/2+(p.y-(top+bottom)/2)*f;p.radius*=f;}

    };
    const weight=ids=>Math.max(4,ids.length);
    const pack=(groups,x,y,w,h)=>{
      if(!groups.length)return;
      if(groups.length===1){fit(groups[0],x,y,w,h);return;}
      const total=groups.reduce((v,g)=>v+weight(g),0);let split=1,first=weight(groups[0]);
      while(split<groups.length-1&&Math.abs(first+weight(groups[split])-total/2)<Math.abs(first-total/2)){first+=weight(groups[split++]);}
      const ratio=first/total;
      if(w>=h){const a=w*ratio;pack(groups.slice(0,split),x,y,a,h);pack(groups.slice(split),x+a,y,w-a,h);}
      else{const a=h*ratio;pack(groups.slice(0,split),x,y,w,a);pack(groups.slice(split),x,y+a,w,h-a);}
    };
    pack(components,18,20,964,560);
    const layer=svgNode('g',{class:'ra-network-edges'}),edgeEls=[],nodeEls=[];
    for(const {a,b,edge} of pairs){
      const p=shown[a],q=shown[b],line=svgNode('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,class:'ra-network-edge'+(edge.status==='Vermoedelijk'?' ra-probable':edge.status==='Historisch'?' ra-historic':edge.status==='Bevestigd'?' ra-confirmed':''),'data-status':edge.status});
      line.append(svgNode('title',{},edgeName(edge)+' · '+relationName(edge.relationType)+' · '+edge.status));layer.append(line);edgeEls.push({a,b,line});
    }
    svg.append(layer);
    const labelBoxes=[];
    function clearHighlight(){svg.classList.remove('ra-network-active');for(const o of edgeEls)o.line.classList.remove('is-connected');for(const node of nodeEls)node.classList.remove('is-connected');svg.querySelectorAll('.ra-network-label.is-connected').forEach(l=>l.classList.remove('is-connected'));}
    function highlight(i){
      clearHighlight();svg.classList.add('ra-network-active');
      nodeEls[i]?.classList.add('is-connected');
      for(const j of adj[i])nodeEls[j]?.classList.add('is-connected');
      for(const o of edgeEls)if(o.a===i||o.b===i)o.line.classList.add('is-connected');for(const l of svg.querySelectorAll('.ra-network-label[data-label-for]'))if(+l.getAttribute('data-label-for')===i||adj[i].has(+l.getAttribute('data-label-for')))l.classList.add('is-connected');
    }
    for(const [i,p] of shown.entries()){
      const group=svgNode('g',{class:'ra-network-node','data-record-id':p.id,'data-record-type':p.type,'data-component':p.component,'aria-label':fullName(p.type,p.id)+', '+label(p.type)+', '+p.degree+' verbanden'});
      const radius=p.radius;
      group.append(svgNode('circle',{cx:p.x,cy:p.y,r:radius,fill:colors.get(p.type),stroke:'#fff','stroke-width':1.3}));
      group.append(svgNode('title',{},fullName(p.type,p.id)+' · '+p.id+' · '+p.degree+' verbanden'));
      clickNode(group,()=>selection(p.type,p.id));group.addEventListener('mouseenter',()=>highlight(i));group.addEventListener('mouseleave',clearHighlight);group.addEventListener('focus',()=>highlight(i));group.addEventListener('blur',clearHighlight);
      nodeEls.push(group);svg.append(group);
    }
    // Prefer recognizable application names. Test several label positions
    // against both nearby circles and the labels already placed.
    const labelsLayer=svgNode('g',{class:'ra-network-labels','aria-hidden':'true'});
    const candidates=shown.map((p,i)=>({p,i})).filter(({p,i})=>n<25||p.type==='apps'&&p.degree>=3||i<10)
      .sort((a,b)=>(b.p.type==='apps')-(a.p.type==='apps')||b.p.degree-a.p.degree||a.i-b.i).slice(0,n<25?25:20);
    for(const {p,i} of candidates){
      const name=shorten(fullName(p.type,p.id),26),w=name.length*5.9,r=p.radius+5;
      const options=[[p.x,p.y-r,'middle'],[p.x+r,p.y+4,'start'],[p.x,p.y+r+11,'middle'],[p.x-r,p.y+4,'end']];
      for(const [tx,ty,anchor] of options){
        const l=anchor==='middle'?tx-w/2:anchor==='start'?tx:tx-w,box={l,r:l+w,t:ty-11,b:ty+2};
        if(box.l<4||box.r>996||box.t<2||box.b>598)continue;
        if(labelBoxes.some(b=>box.l<b.r+3&&box.r>b.l-3&&box.t<b.b+2&&box.b>b.t-2))continue;
        if(shown.some(q=>{const nx=Math.max(box.l,Math.min(box.r,q.x)),ny=Math.max(box.t,Math.min(box.b,q.y));return Math.hypot(nx-q.x,ny-q.y)<q.radius+2;}))continue;
        labelsLayer.append(svgNode('text',{x:tx,y:ty,'text-anchor':anchor,class:'ra-network-label','data-label-for':i},name));labelBoxes.push(box);break;
      }
    }
    svg.append(labelsLayer);
    for(const type of types)mobileGraph.append(button(label(type)+' · '+fmt(shown.filter(p=>p.type===type).length)+' registraties','ra-mobile-group',()=>{typeSelect.value=type;mode='groups';graphMode.value=mode;render();}));
    graphNote.textContent=fmt(shown.length)+' van '+fmt(ordered.length)+' verbonden registraties, verdeeld over '+components.length+' groepen. '+fmt(pairs.length)+' van '+fmt(edges.length)+' verbanden getoond. Wijs een punt aan om de directe lijnen uit te lichten. De afstand tussen punten heeft geen betekenis.';
  }
  function drawFocusGraph(edges){
    const selected=node(focused.type,focused.id);
    if(!selected){focused=null;drawGroupGraph(edges);return;}
    graphHeadline.textContent=selected.record.name||focused.id;
    graphSub.textContent=label(focused.type)+' · '+fmt(edges.length)+' directe verbanden';
    const direct=[...new Map(edges.map(e=>{
      const [t,id]=e.fromType===focused.type&&e.fromId===focused.id?[e.toType,e.toId]:[e.fromType,e.fromId];
      return [key(t,id),{type:t,id,edge:e}];
    })).values()].sort((a,b)=>label(a.type).localeCompare(label(b.type),'nl')||fullName(a.type,a.id).localeCompare(fullName(b.type,b.id),'nl'));
    const shown=direct.slice(0,22);
    for(const item of direct){
      mobileGraph.append(button(label(item.type)+' · '+fullName(item.type,item.id),'ra-mobile-group',()=>selection(item.type,item.id)));
    }
    const center={x:500,y:288};
    if(!shown.length){
      svg.append(svgText(500,180,'Geen directe verbanden bij deze selectie','ra-empty-text'));
    }
    const paths=svgNode('g',{class:'ra-edges'});
    shown.forEach((item,i)=>{
      const angle=(2*Math.PI*i/Math.max(1,shown.length))-Math.PI/2;
      const point={x:center.x+345*Math.cos(angle),y:center.y+218*Math.sin(angle)};
      const cls='ra-line'+(item.edge.status==='Vermoedelijk'?' ra-probable':'');
      const path=svgNode('line',{x1:center.x,y1:center.y,x2:point.x,y2:point.y,class:cls,'stroke-width':1.6});
      const title=svgNode('title',{},relationName(item.edge.relationType)+' · '+item.edge.status);
      path.append(title);paths.append(path);
      item.point=point;
    });
    svg.append(paths);
    const centerGroup=svgNode('g',{class:'ra-node-center','aria-label':selected.record.name||focused.id});
    centerGroup.append(svgNode('circle',{cx:center.x,cy:center.y,r:74,class:'ra-center-circle'}));
    centerGroup.append(svgText(center.x,center.y-6,shorten(selected.record.name,21),'ra-center-label'));
    centerGroup.append(svgText(center.x,center.y+15,label(focused.type),'ra-center-sub'));
    svg.append(centerGroup);
    for(const item of shown){
      const group=svgNode('g',{class:'ra-record-group','aria-label':fullName(item.type,item.id)+', '+item.edge.status});
      group.append(svgNode('circle',{cx:item.point.x,cy:item.point.y,r:14,class:'ra-record-circle'+(item.edge.status==='Vermoedelijk'?' ra-probable-circle':'')}));
      group.append(svgText(item.point.x,item.point.y+29,shorten(fullName(item.type,item.id),17),'ra-record-label'));
      clickNode(group,()=>selection(item.type,item.id));
      svg.append(group);
    }
    graphNote.textContent=shown.length<direct.length?'In het diagram staan '+shown.length+' van '+direct.length+' gekoppelde registraties. De lijst eronder bevat alle '+fmt(edges.length)+' verbanden.':'Klik op een verbonden registratie om de relaties daarvan te bekijken.';
  }
  function describeSelection(){
    detail.replaceChildren();
    if(!focused){
      detail.append(el('h3','', 'Bekijk een registratie'),el('p','ra-detail-copy','Kies een toepassing hieronder, zoek op naam of klik in het diagram. Je ziet de directe verbanden en hun bronstatus.'));
      const degree=new Map();for(const e of currentEdges)for(const [t,id] of endpoints(e))if(t==='apps')degree.set(id,(degree.get(id)||0)+1);
      const shortcuts=el('div','ra-shortcuts');for(const [id,count] of [...degree].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,7)){const b=button(fullName('apps',id),'ra-shortcut',()=>selection('apps',id));b.append(el('small','',count+' verbanden'));shortcuts.append(b);}if(shortcuts.children.length){detail.append(el('p','ra-detail-note','Applicaties met veel vastgelegde verbanden'),shortcuts);}
      const registered=currentEdges.filter(e=>e.status==='Geregistreerd').length;
      const presumed=currentEdges.filter(e=>e.status==='Vermoedelijk').length;
      detail.append(el('div','ra-status-row',fmt(registered)+' geregistreerd'),el('div','ra-status-row',fmt(presumed)+' vermoedelijk'));
      detail.append(el('p','ra-detail-note',mode==='groups'?'De lijnbreedte toont het aantal geregistreerde verbanden tussen groepen, niet de intensiteit van gegevensuitwisseling.':'Een lijn staat voor een vastgelegd verband, niet voor gemeten gegevensuitwisseling.'));
      return;
    }
    const selected=node(focused.type,focused.id);
    if(!selected)return;
    detail.append(el('small','ra-overline',label(focused.type)),el('h3','',selected.record.name||focused.id),el('p','ra-detail-copy',focused.id));
    const source=index.sourcesFor(focused.type,focused.id);
    const sources=el('div','ra-sources');
    sources.append(el('strong','', 'Bronverwijzingen'));
    const names=source.matched;
    const note=names.length?names.join(', '):'Geen gekoppelde bron-ID';
    sources.append(el('p','',note));
    if(source.unmatched.length)sources.append(el('p','ra-detail-note',source.unmatched.length+' bronverwijzingen kunnen niet worden gekoppeld aan het bronnenregister.'));
    detail.append(sources);
    const btn=button('Gegevenskaart openen','ra-action ra-primary',()=>{
      close();
      if(window.EmmausRecordCards?.open)window.EmmausRecordCards.open(focused.type,focused.id);
    });
    detail.append(btn);
    if(currentEdges.length===0)detail.append(el('p','ra-detail-note','Bij deze registratie is geen verband vastgelegd. Dat betekent niet dat er geen verband bestaat.'));
  }
  function renderMatches(){
    searchMatches.replaceChildren();
    const q=search.value.trim().toLocaleLowerCase('nl-NL');
    if(!q||!index)return;
    const found=[...index.nodes.values()].filter(x=>String(x.id+' '+(x.record.name||'')).toLocaleLowerCase('nl-NL').includes(q));
    const title=el('span','ra-match-label',fmt(found.length)+' registraties gevonden');
    searchMatches.append(title);
    matchedNodes=found;
    const buttons=el('div','ra-match-buttons');
    for(const entry of found.slice(0,8))buttons.append(button(shorten(entry.record.name||entry.id,30),'ra-match-button',()=>selection(entry.type,entry.id)));
    if(found.length>8)buttons.append(el('span','ra-more-matches','Verfijn je zoekopdracht voor meer resultaten.'));
    searchMatches.append(buttons);
  }
  function renderList(){
    list.replaceChildren();
    listCaption.textContent=fmt(currentEdges.length)+' verbanden';
    if(!currentEdges.length){
      list.append(el('p','ra-empty','Geen geregistreerde verbanden bij deze selectie. Probeer andere filters.'));
      return;
    }
    // Render every matching edge. No silent 32/50-record cutoff.
    for(const edge of currentEdges){
      const line=el('div','ra-link-row');line.setAttribute('role','listitem');
      const info=el('div','ra-link-info');
      const names=el('strong','',edgeName(edge));
      const meta=el('span','',relationName(edge.relationType)+' · '+edge.status);
      info.append(names,meta);
      const actions=el('div','ra-link-actions');
      actions.append(button('Bekijk', 'ra-link-action',()=>selection(edge.fromType,edge.fromId)));
      const details=el('details','ra-link-proof');
      details.append(el('summary','', 'Bron en status'));
      const contents=el('div','');
      contents.append(el('p','',edge.note||'Geen toelichting geregistreerd.'),el('p','','Bron: '+sourceFor(edge)),el('p','','Status: '+edge.status));
      details.append(contents);
      line.append(info,actions,details);list.append(line);
    }
  }
  function setZoom(value){
    zoom=Math.max(.75,Math.min(2.4,value));
    const w=1000/zoom,h=600/zoom;
    svg.setAttribute('viewBox',((1000-w)/2)+' '+((600-h)/2)+' '+w+' '+h);
    zoomReset.textContent=Math.round(zoom*100)+'%';
  }
  function render(){
    if(!index)return;
    currentEdges=filterEdges();
    const allStatus=index.edges.reduce((acc,x)=>(acc[x.status]=(acc[x.status]||0)+1,acc),{});
    const connected=new Set(index.edges.flatMap(e=>[key(e.fromType,e.fromId),key(e.toType,e.toId)]));
    stats.replaceChildren();
    addStat('Registraties',fmt(index.nodes.size),'Alle onderdelen');
    addStat('Verbanden',fmt(index.edges.length),'In de gegevensindex');
    addStat('Vermoedelijk',fmt(allStatus.Vermoedelijk||0),'Nog niet bevestigd');
    addStat('Zonder vastgelegd verband',fmt(index.nodes.size-connected.size),'Niet automatisch ongebruikt');
    svg.replaceChildren();svg.classList.remove('ra-network-active');legend.replaceChildren();
    mobileGraph.replaceChildren();graphMode.value=mode;backToNetwork.hidden=!focused;
    if(focused)drawFocusGraph(currentEdges);else if(mode==='network')drawNetworkGraph(currentEdges);else drawGroupGraph(currentEdges);
    describeSelection();renderMatches();renderList();setZoom(zoom);
  }
  function resetFilters(){
    search.value='';focused=null;statusSelect.value='';typeSelect.value='';relationSelect.value='';zoom=1;render();
  }
  function csvName(x){return x?.record?.name||x?.id||'';}
  function exportCsv(){
    if(!index)return;
    const cols=['Van (ID)','Van (naam)','Van (onderdeel)','Naar (ID)','Naar (naam)','Naar (onderdeel)','Soort verband','Status','Bron','Toelichting'];
    const lines=[cols,...currentEdges.map(e=>[
      e.fromId,csvName(node(e.fromType,e.fromId)),label(e.fromType),
      e.toId,csvName(node(e.toType,e.toId)),label(e.toType),
      relationName(e.relationType),e.status,e.evidence||'',e.note||''
    ])].map(row=>row.map(csvSafe).join(';'));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=el('a');
    a.href=url;a.download='ict-scan-verbanden.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function open(event,initialMode='groups'){
    opener=event?.currentTarget||document.activeElement;
    if(!ensureIndex()){
      // No false graph when data have not loaded.
      if(typeof toast==='function')toast('De gegevens zijn nog niet ingelezen.');
      return;
    }
    mode=initialMode;graphMode.value=mode;initFilters();resetFilters();
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    openState=true;
    closeButton.focus();
  }
  function close(){
    if(typeof dialog.close==='function'&&dialog.open)dialog.close();
    else dialog.removeAttribute('open');
    openState=false;
    (opener||trigger).focus();
  }
  dialog.addEventListener('close',()=>{openState=false;(opener||trigger).focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  for(const control of [search,typeSelect,statusSelect,relationSelect])control.addEventListener(control===search?'input':'change',()=>{
    focused=null;render();
  });
  const atlasPanel=document.querySelector('#viewOverview .atlas-panel .panel-head');
  if(!atlasPanel)return;
  const trigger=button('Alle verbanden','ra-open-button',open);
  trigger.id='relationAtlasOpen';
  trigger.setAttribute('aria-haspopup','dialog');
  atlasPanel.append(trigger);
  const studioActions=document.querySelector('#viewStudio .ds-toolbar-actions');
  if(studioActions){
    const studioLink=button('Alle verbanden','ds-icon-action',open);
    studioLink.setAttribute('aria-haspopup','dialog');
    studioLink.id='relationAtlasStudioOpen';
    studioActions.append(studioLink);
  }
  window.EmmausRelationAtlas=Object.freeze({
    open,openNetwork:()=>open(null,'groups'),close,refresh:()=>{if(openState&&ensureIndex()){initFilters();render();}},
    counts:()=>index?({registrations:index.nodes.size,links:index.edges.length,visible:currentEdges.length}):null
  });
})();