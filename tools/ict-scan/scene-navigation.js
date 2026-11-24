'use strict';
/* A compact fixed-screen shell around the existing ICT-scan modules.
   Only existing DOM nodes move, so graphs, imports and form listeners are retained. */
(function(){
  const groups={
    overview:[['Start',2],['Koppelingen',1],['Cijfers en verdeling',4],['Applicaties',1]],
    apps:[['Applicaties zoeken',3]],
    connections:[['Koppelingen in cijfers',2],['Koppelingen zoeken',3]],
    devices:[['Apparaten in cijfers',3],['Meetgegevens',1]],
    ai:[['Stand van zaken',1],['AI per lesfase',1],['AI-functies',1],['Instellingen en beheer',1]],
    privacy:[['Privacyonderzoeken',3],['Wet- en regelgeving',1]],
    findings:[['Controle-uitkomsten',1],['Controles en acties',6]],
    reports:[['Rapport kiezen',2],['Rapport downloaden',2]],
    sources:[['Bronbestanden ophalen',2],['Bestanden en wijzigingen',3],['Broninformatie',3]]
  };
  const leading={apps:1};
  const scenes=new Map();
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  function show(view,index,animate=true){
    const item=scenes.get(view);
    if(!item||index<0||index>=item.panels.length)return;
    if(item.index===index)return;
    // Switch atomically, also after quick consecutive tab changes.
    const next=item.panels[index];
    item.index=index;item.frame.dataset.fixedStart=String(index===0);
    item.tabs.forEach((tab,i)=>{
      const selected=i===index;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex=selected?0:-1;tab.classList.toggle('active',selected);
    });
    item.panels.forEach((panel,i)=>{
      panel.hidden=i!==index;panel.classList.remove('scene-leaving','scene-entering');
    });
    if(animate&&!reduce){void next.offsetWidth;next.classList.add('scene-entering');}
    item.frame.scrollTop=0;
  }
  function build(name,parts){
    const title='view'+name[0].toUpperCase()+name.slice(1),root=document.getElementById(title);
    if(!root)return;
    const children=Array.from(root.children);
    const before=leading[name]||0;
    if(children.length<before+parts.reduce((sum,p)=>sum+p[1],0))return;
    let at=before;
    const nav=document.createElement('nav');
    nav.className='scene-navigation';
    nav.setAttribute('role','tablist');
    nav.setAttribute('aria-label','Onderdelen van dit scherm');
    const frame=document.createElement('div');
    frame.className='scene-frame';
    const panels=[],tabs=[];
    parts.forEach(([label,count],index)=>{
      const panel=document.createElement('section');
      panel.id=title+'Scene'+index;
      panel.className='scene-panel'+(index===0?' fixed-start':'');
      panel.setAttribute('role','tabpanel');
      panel.hidden=true;
      for(let j=0;j<count;j++)panel.append(children[at++]);
      frame.append(panel);panels.push(panel);
      if(parts.length===1)return;
      const button=document.createElement('button');
      button.type='button';button.className='scene-tab';button.id=title+'Tab'+index;
      button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
      panel.setAttribute('aria-labelledby',button.id);
      button.textContent=label;
      button.addEventListener('click',()=>show(name,index));
      button.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
        show(name,next);tabs[next].focus();
      });
      nav.append(button);tabs.push(button);
    });
    // New modules may be added later. Never discard unknown content.
    while(at<children.length)panels[panels.length-1].append(children[at++]);
    if(tabs.length)root.append(nav);
    root.append(frame);
    scenes.set(name,{root,frame,panels,tabs,index:-1,timer:null});
    show(name,0,false);
  }
  for(const [name,parts] of Object.entries(groups))build(name,parts);
  // The start screen itself does not scroll. Long collections have their own
  // named and keyboard-accessible viewport, without losing any records.
  for(const [selector,label] of [
    ['#appsList','Applicatieregistraties'],['#candidatesList','Overige software'],
    ['#connectionChart','Entra-status en legenda'],
    ['#viewDevicesScene0 > .two-col','Apparaatbeleid en aandachtspunten'],
    ['#privacyDpia','DPIA-bronvermeldingen'],
    ['#assuranceDetailArea','Toelichting en vergelijking van controles'],
    ['#reportPicker','Rapportkeuze'],
    ['#githubSyncDetailArea','Synchronisatiestatus en broninstellingen']
  ]){
    const el=document.querySelector(selector);if(!el)continue;
    el.classList.add('screen-scroll');
    if(el.tagName!=='DETAILS'){el.setAttribute('role','region');el.setAttribute('aria-label',label);el.tabIndex=0;}
  }

  const previousSelect=selectView;
  selectView=function(view){
    previousSelect(view);
    if(!scenes.has(view))return;
    const searches={connections:'connectionsSearch',ai:'aiSearch',findings:'findingsSearch'};
    if(searches[view]&&document.getElementById(searches[view])?.value.trim())show(view,view==='ai'?2:1,false);
    scenes.get(view).frame.scrollTop=0;
  };
  // Scope controls belong to the function browser; the other three scenes retain their own population.
  // Open the record list rather than leaving a filtered graph on screen.
  for(const [chart,view] of [['connectionChart','connections'],['phaseChart','ai'],['aiProducts','ai'],['findingsChart','findings']]){
    document.getElementById(chart)?.addEventListener('click',e=>{
      if(e.target.closest('button,[role="button"]'))queueMicrotask(()=>show(view,view==='ai'?2:1));
    });
  }
  document.getElementById('reportPicker')?.addEventListener('click',e=>{
    if(e.target.closest('[data-report]'))queueMicrotask(()=>show('reports',1));
  });

  // Position this popover outside the narrow sidebar to avoid all ancestor clipping.
  // Existing rail-drawer.js retains ownership of open/close and keyboard behavior.
  const drawer=document.getElementById('railDrawer');
  if(drawer)document.body.append(drawer);
  window.EmmausScenes={show};
})();