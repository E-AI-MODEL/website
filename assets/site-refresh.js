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

  // Consistent navigation on every refreshed Dutch and English page.
  (function(){
    var header=document.querySelector('.eai-header');
    if(!header)return;
    var en=document.documentElement.lang==='en'||location.pathname.startsWith('/en/');
    var groups=en?[
      ['Explore',[['The EAI model','/en/#model'],['Education','/en/education/']]],
      ['Applications',[['All applications','/en/applications/'],['Education','/en/education/']]],
      ['Research',[['Research','/en/research/'],['Publications','/en/publications/']]],
      ['Tools',[['All tools','/en/tools/'],['Model Monitor','/en/model-monitor/'],['LLMscan','/en/llmscan/']]],
      ['About EAI',[['About EAI and Hans Visser','/en/about/']]]
    ]:[
      ['Ontdekken',[['Het EAI-model','/nl/#model'],['EAI in het onderwijs','/nl/onderwijs/']]],
      ['Toepassingen',[['Alle toepassingen','/nl/toepassingen/'],['Onderwijs in','/onderwijsin/']]],
      ['Onderzoek',[['Onderzoek','/nl/onderzoek/'],['Publicaties','/nl/publicaties/']]],
      ['Tools',[['Alle tools','/nl/tools/'],['Model Monitor','/nl/model-monitor/'],['LLMscan','/nl/llmscan/']]],
      ['Over EAI',[['Over EAI en Hans Visser','/nl/over/']]]
    ];
    var links=header.querySelector('.eai-links');
    var mobile=header.querySelector('.eai-mobile .mobile-nav-panel');
    function canonicalPath(path){
      var pathname=path.split('#')[0].split('?')[0].replace(/index\.html$/,'').replace(/\/+$/,'/');
      if(!pathname.endsWith('/'))pathname+='/';
      var aliases={'/':'/nl/','/tools/':'/nl/tools/','/publicaties/':'/nl/publicaties/','/over/':'/nl/over/','/toepassingen/':'/nl/toepassingen/','/onderwijs/':'/nl/onderwijs/','/kennis/':'/nl/onderzoek/','/model-monitor/':'/nl/model-monitor/','/llmscan/':'/nl/llmscan/'};
      return aliases[pathname]||pathname;
    }
    function active(items){
      var here=canonicalPath(currentPath);
      return items.some(function(item){
        var target=canonicalPath(item[1]);
        return here===target||(target!=='/nl/'&&target!=='/en/'&&here.startsWith(target));
      });
    }
    if(links){
      links.innerHTML='';
      groups.forEach(function(group,i){
        if(i===4){
          var anchor=document.createElement('a');
          anchor.href=group[1][0][1];anchor.textContent=group[0];
          if(active(group[1]))anchor.setAttribute('aria-current','page');
          links.appendChild(anchor);return;
        }
        var details=document.createElement('details');
        details.className='eai-nav-group';
        var summary=document.createElement('summary');summary.textContent=group[0];details.appendChild(summary);
        var panel=document.createElement('div');panel.className='eai-nav-panel';
        group[1].forEach(function(item){
          var a=document.createElement('a');a.href=item[1];a.textContent=item[0];panel.appendChild(a);
        });
        details.appendChild(panel);if(active(group[1]))details.classList.add('is-current');
        links.appendChild(details);
      });
    }
    if(mobile){
      mobile.innerHTML='';
      groups.forEach(function(group,i){
        if(i===4){var a=document.createElement('a');a.href=group[1][0][1];a.textContent=group[0];mobile.appendChild(a);return;}
        var d=document.createElement('details');d.className='eai-mobile-group';
        var s=document.createElement('summary');s.textContent=group[0];d.appendChild(s);
        group[1].forEach(function(item){var a=document.createElement('a');a.href=item[1];a.textContent=item[0];d.appendChild(a);});
        mobile.appendChild(d);
      });
    }
    header.addEventListener('click',function(e){
      var summary=e.target.closest('.eai-nav-group > summary');
      if(summary)header.querySelectorAll('.eai-nav-group[open]').forEach(function(d){if(d!==summary.parentElement)d.open=false;});
    });
    document.addEventListener('click',function(e){if(!header.contains(e.target))header.querySelectorAll('.eai-nav-group[open]').forEach(function(d){d.open=false;});});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')header.querySelectorAll('.eai-nav-group[open]').forEach(function(d){d.open=false;});});
    var css=document.createElement('style');
    css.textContent='.eai-header .eai-links{display:flex;align-items:center;gap:clamp(12px,1.6vw,26px);flex-wrap:nowrap}.eai-nav-group{position:relative}.eai-nav-group>summary{list-style:none;cursor:pointer;color:#253244;font-size:.93rem;white-space:nowrap;padding:12px 0}.eai-nav-group>summary::-webkit-details-marker{display:none}.eai-nav-group>summary:after{content:"⌄";margin-left:7px}.eai-nav-group[open]>summary:after{content:"⌃"}.eai-nav-group.is-current>summary,.eai-links>a[aria-current]{font-weight:700}.eai-nav-panel{position:absolute;top:100%;left:0;z-index:60;min-width:235px;background:white;border:1px solid #d8dfe5;border-radius:9px;padding:9px;box-shadow:0 16px 36px rgba(19,33,52,.14);display:grid;gap:2px}.eai-nav-panel a{display:block;padding:10px 12px;border-radius:5px;text-decoration:none!important;white-space:nowrap;font-size:.9rem}.eai-nav-panel a:hover,.eai-nav-panel a:focus-visible{background:#edf3f7}.eai-mobile-group{border-bottom:1px solid #e1e5e9;padding:5px 0}.eai-mobile-group>summary{cursor:pointer;padding:12px 8px;font-weight:700;list-style:none}.eai-mobile-group>summary:after{content:"+";float:right}.eai-mobile-group[open]>summary:after{content:"−"}.eai-mobile-group>a{display:block;padding:10px 20px;text-decoration:none}.eai-mobile-group>a:hover{background:#f0f3f5}.eai-nav-group>summary:focus-visible,.eai-mobile-group>summary:focus-visible{outline:2px solid #276ea0;outline-offset:3px}@media(max-width:1080px){.eai-header .eai-links{display:none}.eai-header .eai-mobile{display:block}}';
    document.head.appendChild(css);
  })();

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
    document.querySelectorAll('.eai-mobile[open]').forEach(function(menu){
      if(event.target.closest('.eai-mobile .mobile-nav-panel a'))menu.open=false;
      else if(!menu.contains(event.target))menu.open=false;
    });
  });
  document.querySelectorAll('.eai-mobile').forEach(function(menu){
    menu.addEventListener('toggle',function(){
      var summary=menu.querySelector('summary');
      if(summary)summary.setAttribute('aria-expanded',String(menu.open));
    });
  });
  document.addEventListener('keydown',function(event){
    if(event.key==='Escape')document.querySelectorAll('.eai-mobile[open]').forEach(function(menu){menu.open=false;});
  });
})();