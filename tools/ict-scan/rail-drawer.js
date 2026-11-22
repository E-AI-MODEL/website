'use strict';
/* Secondary actions share the existing navigation rail; no duplicate page tabs. */
(function(){
  const byId = id => document.getElementById(id);
  const trigger=byId('railMore'),drawer=byId('railDrawer'),closeButton=byId('railDrawerClose');
  const scrim=byId('railScrim'),search=byId('globalSearch'),results=byId('globalResults');
  if(!trigger||!drawer||!closeButton||!scrim||!search)return;
  const mobileViews=[...drawer.querySelectorAll('[data-drawer-view]')];
  function updateMobileNavigation(){
    for(const button of mobileViews){
      const name=button.dataset.drawerView;
      const enabled=name!=='privacy'||window.EmmausRoles?.isEnabled('fg')===true;
      button.hidden=!enabled;
      button.classList.toggle('active',name===state.view);
      button.setAttribute('aria-current',name===state.view?'page':'false');
    }
  }

  function closeDrawer(returnFocus=false){
    if(drawer.hidden)return;
    drawer.hidden=true;
    scrim.hidden=true;
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label','Extra functies openen');
    if(results)results.hidden=true;
    if(returnFocus && !byId('workspace').hidden)trigger.focus();
  }
  function openDrawer(focusSearch=false){
    updateMobileNavigation();
    drawer.hidden=false;
    scrim.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    trigger.setAttribute('aria-label','Extra functies sluiten');
    if(focusSearch)search.focus();
    else if(window.matchMedia && window.matchMedia('(max-width:720px)').matches)closeButton.focus();
  }
  trigger.addEventListener('click',()=>drawer.hidden?openDrawer(false):closeDrawer(true));
  closeButton.addEventListener('click',()=>closeDrawer(true));
  scrim.addEventListener('click',()=>closeDrawer(true));
  document.querySelectorAll('.icon-rail .rail-button[data-view]').forEach(button=>{
    button.addEventListener('click',()=>closeDrawer());
  });
  drawer.addEventListener('click',event=>{
    const target=event.target.closest('[data-drawer-view]');
    if(target){
      if(!target.hidden)selectView(target.dataset.drawerView);
      closeDrawer();
      return;
    }
    const item=event.target.closest('.rail-action,[data-result-kind]');
    if(item)closeDrawer();
  });
  document.addEventListener('click',event=>{
    if(!drawer.hidden && !drawer.contains(event.target) && !trigger.contains(event.target))closeDrawer();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!drawer.hidden){event.preventDefault();closeDrawer(true);return;}
    if(event.key!=='/' || event.altKey || event.ctrlKey || event.metaKey || !drawer.hidden || byId('workspace').hidden)return;
    const target=event.target;
    if(target && (target.closest('input,textarea,select,[contenteditable="true"]') || target.isContentEditable))return;
    event.preventDefault();
    openDrawer(true);
  });

  byId('drawerExcel').addEventListener('click',()=>byId('exportExcel').click());
  byId('drawerJson').addEventListener('click',()=>{
    if(!state.ready){selectView('sources');toast('Er zijn nog geen gegevens ingelezen.');return;}
    byId('exportJson').click();
  });
})();
