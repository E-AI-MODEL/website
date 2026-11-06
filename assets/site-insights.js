/* EAI Insights: aggregate counts only. No cookies, IDs, IP addresses or query strings. */
(function(){
  'use strict';
  if(!/^https?:$/.test(location.protocol) || navigator.doNotTrack==='1' || navigator.globalPrivacyControl)return;
  var endpoint='https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/eai-site-insights';
  var device=matchMedia('(max-width: 760px)').matches?'mobiel':'desktop';
  function cleanPath(value){
    try{
      var p=new URL(value,location.href).pathname.replace(/\/index\.html$/,'/');
      if(!p.endsWith('/')&&!/\.[a-z0-9]+$/i.test(p))p+='/';
      return p.slice(0,120);
    }catch(_){return '/';}
  }
  function send(event,path){
    var body=JSON.stringify({event:event,path:cleanPath(path),device:device});
    try{
      var blob=new Blob([body],{type:'text/plain'});
      if(navigator.sendBeacon){navigator.sendBeacon(endpoint,blob);}
      else fetch(endpoint,{method:'POST',body:body,headers:{'Content-Type':'text/plain'},keepalive:true,mode:'cors'}).catch(function(){});
    }catch(_){}
  }
  send('pagina',location.pathname);
  document.addEventListener('click',function(e){
    var link=e.target.closest('a[href]');
    if(!link)return;
    try{
      var url=new URL(link.href,location.href);
      if(!['eaimodel.nl','www.eaimodel.nl'].includes(url.hostname))return;
      if(/^\/tools\/[^/]+\//.test(url.pathname)&&!url.pathname.startsWith('/tools/index'))send('tool',url.pathname);
    }catch(_){}
  },true);
  var visibleStarted=document.visibilityState==='visible'?Date.now():0,visibleMs=0,engaged=false;
  function timeVisible(){
    if(visibleStarted){visibleMs+=Date.now()-visibleStarted;visibleStarted=0;}
    if(!engaged&&visibleMs>=20000){engaged=true;send('gelezen',location.pathname);}
  }
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')timeVisible();
    else{visibleStarted=Date.now();timeVisible();}
  });
  setInterval(function(){if(document.visibilityState==='visible'){timeVisible();visibleStarted=Date.now();}},5000);
  window.addEventListener('pagehide',timeVisible);
})();