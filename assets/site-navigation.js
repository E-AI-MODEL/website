/* Native disclosures with one open theme and predictable reopening. */
(function(){
  'use strict';
  var menu=document.querySelector('.eai-site-menu');
  if(!menu)return;
  var trigger=menu.querySelector(':scope > summary');
  var panel=menu.querySelector('.eai-site-menu-panel');
  var groups=Array.from(menu.querySelectorAll('.eai-site-group'));
  function reset(){groups.forEach(function(group){group.open=false;});panel.scrollTop=0;}
  function sync(){
    trigger.setAttribute('aria-expanded',String(menu.open));
    trigger.setAttribute('aria-label',menu.open?'Menu sluiten':'Menu openen');
    if(document.documentElement.lang==='en')trigger.setAttribute('aria-label',menu.open?'Close menu':'Open menu');
    if(!menu.open)reset();
  }
  function close(restoreFocus){
    if(!menu.open)return;
    menu.open=false;reset();sync();
    if(restoreFocus)trigger.focus();
  }
  groups.forEach(function(group){
    group.addEventListener('toggle',function(){
      if(!group.open)return;
      groups.forEach(function(other){if(other!==group)other.open=false;});
    });
  });
  menu.addEventListener('toggle',sync);
  menu.addEventListener('click',function(event){if(event.target.closest('a'))close(false);});
  document.addEventListener('click',function(event){if(!menu.contains(event.target))close(false);});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&menu.open){event.preventDefault();close(true);}});
  document.addEventListener('focusin',function(event){if(menu.open&&!menu.contains(event.target))close(false);});
  window.addEventListener('pageshow',function(){close(false);reset();});
  reset();sync();
})();
