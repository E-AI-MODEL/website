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
    // One hamburger menu on desktop, tablet and mobile.
    if(links)links.remove();
    if(mobile){
      mobile.innerHTML='';
      groups.forEach(function(group){
        var d=document.createElement('details');d.className='eai-mobile-group';
        var summary=document.createElement('summary');summary.textContent=group[0];d.appendChild(summary);
        group[1].forEach(function(item){
          var a=document.createElement('a');a.href=item[1];a.textContent=item[0];
          if(canonicalPath(currentPath)===canonicalPath(item[1]))a.setAttribute('aria-current','page');
          d.appendChild(a);
        });
        mobile.appendChild(d);
      });
    }
    var menu=header.querySelector('.eai-mobile');
    if(menu){
      var trigger=menu.querySelector(':scope > summary');
      if(trigger){trigger.textContent=en?'Menu':'Menu';trigger.setAttribute('aria-label',en?'Open navigation':'Open navigatie');}
      menu.addEventListener('toggle',function(){
        document.body.classList.toggle('eai-menu-open',menu.open);
      });
    }
    header.addEventListener('click',function(e){
      var summary=e.target.closest('.eai-nav-group > summary');
      if(summary)header.querySelectorAll('.eai-nav-group[open]').forEach(function(d){if(d!==summary.parentElement)d.open=false;});
    });
    document.addEventListener('click',function(e){if(!header.contains(e.target))header.querySelectorAll('.eai-nav-group[open]').forEach(function(d){d.open=false;});});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')header.querySelectorAll('.eai-nav-group[open]').forEach(function(d){d.open=false;});});
    var css=document.createElement('style');
    css.textContent=`
.eai-header .eai-links{display:none!important}
.eai-header .eai-mobile{display:block!important;position:relative}
.eai-header .eai-header-end{display:flex;align-items:center;gap:20px}
.eai-header .eai-mobile>summary{display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;font-weight:650;white-space:nowrap;padding:9px 4px}
.eai-header .eai-mobile>summary::-webkit-details-marker{display:none}
.eai-header .eai-mobile>summary:before{content:"";display:inline-block;width:22px;height:16px;border-top:2px solid currentColor;border-bottom:2px solid currentColor;background:linear-gradient(currentColor,currentColor) center / 100% 2px no-repeat}
.eai-header .eai-mobile[open]>summary:before{background:none;transform:rotate(0deg)}
.eai-header .eai-mobile .mobile-nav-panel{position:absolute!important;right:0!important;left:auto!important;top:calc(100% + 15px)!important;width:min(420px,calc(100vw - 32px))!important;max-height:calc(100dvh - 90px);overflow-y:auto;display:block;z-index:100;background:#fff;color:#1a2633;border:1px solid #d6dee5;border-radius:10px;box-shadow:0 20px 50px rgba(13,27,44,.18);padding:14px 18px}
.eai-header .eai-mobile:not([open]) .mobile-nav-panel{display:none!important}
.eai-header .eai-mobile-group{border-bottom:1px solid #e2e7eb;padding:4px 0}
.eai-header .eai-mobile-group:last-child{border-bottom:0}
.eai-header .eai-mobile-group>summary{display:block;cursor:pointer;padding:13px 8px;font-weight:700;list-style:none;font-size:1rem}
.eai-header .eai-mobile-group>summary::-webkit-details-marker{display:none}
.eai-header .eai-mobile-group>summary:after{content:"+";float:right;font-size:1.15rem}
.eai-header .eai-mobile-group[open]>summary:after{content:"−"}
.eai-header .eai-mobile-group>a{display:block;padding:10px 20px;text-decoration:none;font-size:.94rem;line-height:1.4}
.eai-header .eai-mobile-group>a:hover,.eai-header .eai-mobile-group>a:focus-visible,.eai-header .eai-mobile-group>a[aria-current]{background:#eef3f6;border-radius:5px}
.eai-header .eai-mobile>summary:focus-visible,.eai-header .eai-mobile-group>summary:focus-visible{outline:2px solid #276ea0;outline-offset:3px}
@media(max-width:600px){.eai-header .eai-mobile .mobile-nav-panel{position:fixed!important;top:68px!important;right:10px!important;width:calc(100vw - 20px)!important;max-height:calc(100dvh - 80px)}}
`;
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