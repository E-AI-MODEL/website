/* Resize only the dashboard composer: no source-data changes. */
(function () {
  'use strict';
  const view=document.getElementById('viewStudio');
  const shell=view?.querySelector('.ds-shell');
  const panel=shell?.querySelector('.ds-panel');
  const stage=shell?.querySelector('.ds-stage');
  if(!view||!shell||!panel||!stage)return;

  const KEY='emmaus-ds-sidebar-width-v1';
  const DEFAULT=300;
  const MIN=240;
  const MIN_STAGE=510;
  const desktop=window.matchMedia('(min-width: 901px)');
  const handle=document.createElement('div');
  handle.className='ds-resizer';
  handle.setAttribute('role','separator');
  handle.setAttribute('aria-label','Breedte van de filterzijbalk aanpassen');
  handle.setAttribute('aria-orientation','vertical');
  handle.setAttribute('aria-valuemin',String(MIN));
  handle.setAttribute('tabindex','0');
  handle.setAttribute('title','Sleep om de zijbalk te verbreden. Dubbelklik om te herstellen.');
  shell.insertBefore(handle,stage);

  const limit=()=>Math.max(MIN, Math.min(650,shell.clientWidth-MIN_STAGE));
  const clamp=value=>Math.max(MIN,Math.min(limit(),Math.round(value)));
  let width=DEFAULT;
  try { const saved=Number(localStorage.getItem(KEY));if(Number.isFinite(saved)&&saved>=MIN)width=saved; }catch(_){}
  const emitResize=()=>window.dispatchEvent(new Event('resize'));
  function apply(value,persist) {
    width=clamp(value);
    shell.style.setProperty('--ds-sidebar-width',width+'px');
    handle.setAttribute('aria-valuenow',String(width));
    handle.setAttribute('aria-valuemax',String(limit()));
    handle.setAttribute('aria-valuetext',width+' pixels');
    if(persist)try{localStorage.setItem(KEY,String(width));}catch(_){}
    emitResize();
  }
  let pointer=null;
  handle.addEventListener('pointerdown',event=>{
    if(!desktop.matches||event.button!==0)return;
    pointer=event.pointerId;
    handle.setPointerCapture(pointer);
    shell.classList.add('ds-resizing');
    event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{
    if(pointer!==event.pointerId||!desktop.matches)return;
    const left=shell.getBoundingClientRect().left;
    apply(event.clientX-left,false);
  });
  function stop(event) {
    if(pointer!==event.pointerId)return;
    pointer=null;shell.classList.remove('ds-resizing');
    try{localStorage.setItem(KEY,String(width));}catch(_){}
  }
  handle.addEventListener('pointerup',stop);
  handle.addEventListener('pointercancel',stop);
  handle.addEventListener('lostpointercapture',()=>{pointer=null;shell.classList.remove('ds-resizing')});
  handle.addEventListener('dblclick',()=>apply(DEFAULT,true));
  handle.addEventListener('keydown',event=>{
    let next=width;
    if(event.key==='ArrowRight')next+=event.shiftKey?50:10;
    else if(event.key==='ArrowLeft')next-=event.shiftKey?50:10;
    else if(event.key==='Home')next=MIN;
    else if(event.key==='End')next=limit();
    else return;
    event.preventDefault();apply(next,true);
  });
  const observer=new ResizeObserver(()=>apply(width,false));
  observer.observe(shell);
  apply(width,false);
})();
