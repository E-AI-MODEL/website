/* Progressive enhancement. The menu and language links already exist in HTML. */
(function(){
  'use strict';
  var menu=document.querySelector('.eai-site-menu');
  if(!menu)return;
  var trigger=menu.querySelector(':scope > summary');
  function sync(){trigger.setAttribute('aria-expanded',String(menu.open));}
  function close(restoreFocus){if(!menu.open)return;menu.open=false;sync();if(restoreFocus)trigger.focus();}
  menu.addEventListener('toggle',sync);
  menu.addEventListener('click',function(event){if(event.target.closest('a'))close(false);});
  document.addEventListener('click',function(event){if(!menu.contains(event.target))close(false);});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&menu.open){event.preventDefault();close(true);}});
  document.addEventListener('focusin',function(event){if(menu.open&&!menu.contains(event.target))close(false);});
  sync();
})();
