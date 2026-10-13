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
  // Language links follow the current page, including legacy Dutch routes.
  var englishRoutes={"/":"/en/","/nl/":"/en/","/toepassingen/":"/en/applications/","/nl/toepassingen/":"/en/applications/","/onderwijs/":"/en/education/","/nl/onderwijs/":"/en/education/","/kennis/":"/en/research/","/nl/onderzoek/":"/en/research/","/publicaties/":"/en/publications/","/nl/publicaties/":"/en/publications/","/tools/":"/en/tools/","/nl/tools/":"/en/tools/","/model-monitor/":"/en/model-monitor/","/nl/model-monitor/":"/en/model-monitor/","/over/":"/en/about/","/nl/over/":"/en/about/","/nl/onderzoek/leermiddelen/":"/en/research/teaching-tools/"};
  var dutchRoutes={"/en/":"/nl/","/en/applications/":"/nl/toepassingen/","/en/education/":"/nl/onderwijs/","/en/research/":"/nl/onderzoek/","/en/publications/":"/nl/publicaties/","/en/tools/":"/nl/tools/","/en/model-monitor/":"/nl/model-monitor/","/en/about/":"/nl/over/","/en/research/teaching-tools/":"/nl/onderzoek/leermiddelen/"};
  var currentPath=window.location.pathname.replace(/index\.html$/,'').replace(/\/+$/,'/');
  if (!currentPath.endsWith('/')) currentPath+='/';
  document.querySelectorAll('.eai-lang a').forEach(function(link){
    var lang=link.getAttribute('lang');
    var destination=lang==='en' ? (englishRoutes[currentPath]||'/en/') : (dutchRoutes[currentPath]||'/nl/');
    link.setAttribute('href',destination);
  });
  document.querySelectorAll('[data-preserve-hash]').forEach(function(link){
    link.addEventListener('click',function(){
      var hash=window.location.hash;
      if(hash && !link.href.includes('#'))link.href+=hash;
    },{once:true});
  });
  // Keep the English monitor's existing shareable hash links usable inside the iframe.
  if (window.location.pathname.startsWith('/en/model-monitor/')) {
    var frame=document.getElementById('model-monitor-frame');
    var openFull=document.querySelector('.monitor-embed-section a[href*="chatgpt.site/"]');
    var valid=['latest','dashboard','models','countries','developers','usage','incidents','context','education','legal','sources'];
    var syncMonitor=function(){
      var route=(window.location.hash||'#dashboard').slice(1).toLowerCase();
      if(!valid.includes(route))route='dashboard';
      var url='https://ai-act-model-monitor.werkruimte-s-2100.chatgpt.site/#'+route;
      if(frame && frame.getAttribute('src')!==url)frame.setAttribute('src',url);
      if(openFull)openFull.setAttribute('href',url);
    };
    window.addEventListener('hashchange',syncMonitor);
    syncMonitor();
  }
  document.addEventListener('click',function(event){
    if(event.target.closest('.eai-mobile .mobile-nav-panel a')){
      var menu=event.target.closest('.eai-mobile');
      if(menu)menu.open=false;
    }
  });
})();