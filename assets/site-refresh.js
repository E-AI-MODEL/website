(function(){
  'use strict';
  document.querySelectorAll('[data-eai-demo]').forEach(function(button){
    button.addEventListener('click',function(){
      var target=document.getElementById('eai-demo-output');
      if(!target)return;
      var scenarios=(target.getAttribute('data-scenarios')||'').split('|');
      var index=Number(button.getAttribute('data-eai-demo'));
      if(!Number.isInteger(index)||!scenarios[index])return;
      target.textContent=scenarios[index].replaceAll('&amp;','&');
      document.querySelectorAll('[data-eai-demo]').forEach(function(b){
        var active=b===button;
        b.classList.toggle('is-selected',active);
        b.setAttribute('aria-pressed',String(active));
      });
    });
  });
  document.querySelectorAll('[data-preserve-hash]').forEach(function(link){
    link.addEventListener('click',function(){
      var hash=window.location.hash;
      if(hash && !link.href.includes('#'))link.href+=hash;
    },{once:true});
  });
  document.addEventListener('click',function(event){
    if(event.target.closest('.eai-mobile .mobile-nav-panel a')){
      var menu=event.target.closest('.eai-mobile');
      if(menu)menu.open=false;
    }
  });
})();