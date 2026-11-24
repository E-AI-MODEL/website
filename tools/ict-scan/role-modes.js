'use strict';
/* View modes only. These controls never grant an FG role, hide source data
   from exports or replace the controller's DPIA responsibilities. */
(function(){
  const KEY='emmaus-ict-scan-visible-roles-v1';
  const byId=id=>document.getElementById(id);
  const roles={ai:true,fg:false};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved&&typeof saved==='object'){
      if(typeof saved.ai==='boolean')roles.ai=saved.ai;
      if(typeof saved.fg==='boolean')roles.fg=saved.fg;
    }
  }catch(_){}
  // Expose a read-only predicate to the relationship visualization.
  window.EmmausRoles=Object.freeze({isEnabled:name=>roles[name]!==false});

  const originalSelectView=selectView;
  selectView=function(name){
    if((name==='ai'&&!roles.ai)||(name==='privacy'&&!roles.fg))name='overview';
    originalSelectView(name);
    // The management records now live in AI instead of being repeated in FG.
    if(name==='ai')renderPrivacy();
  };

  function apply(){
    const ai=byId('roleModeAI'),fg=byId('roleModeFG');
    if(ai)ai.checked=roles.ai;
    if(fg)fg.checked=roles.fg;
    document.body.classList.toggle('role-ai-hidden',!roles.ai);
    document.body.classList.toggle('role-fg-hidden',!roles.fg);
    for(const [view,on] of [['ai',roles.ai],['privacy',roles.fg]]){
      const tab=document.querySelector('.rail-button[data-view="'+view+'"]');
      if(tab){tab.hidden=!on;tab.setAttribute('aria-hidden',String(!on));}
    }
    const reports=byId('reportPicker');
    for(const [scope,on] of [['ai',roles.ai],['aiGovernance',roles.ai],['privacy',roles.fg]]){
      const option=reports?.querySelector('[data-report="'+scope+'"]');
      if(option)option.hidden=!on;
    }
    if((!roles.ai&&['ai','aiGovernance'].includes(state.reportScope))||(!roles.fg&&state.reportScope==='privacy')){
      state.reportScope='all';
      if(typeof renderReports==='function')renderReports();
    }
    if((state.view==='ai'&&!roles.ai)||(state.view==='privacy'&&!roles.fg)){
      selectView('overview');
    }
    if(state.ready&&typeof renderOverview==='function'){
      renderOverview();
    }
  }
  function setRole(name,enabled){
    roles[name]=Boolean(enabled);
    try{localStorage.setItem(KEY,JSON.stringify(roles));}catch(_){}
    apply();
  }
  byId('roleModeAI')?.addEventListener('change',e=>setRole('ai',e.target.checked));
  byId('roleModeFG')?.addEventListener('change',e=>setRole('fg',e.target.checked));
  byId('jumpAiBeheer')?.addEventListener('click',()=>{
    if(!roles.ai)return;
    selectView('ai');
    window.EmmausScenes?.show('ai',3);
  });
  apply();
})();