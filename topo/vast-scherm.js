/* Let's go TOPO! — vast scherm (PO en VO).
   Hoort bij vast-scherm.css. Zonder opslag, zonder netwerk.
   - schermhoogte volgt het zichtbare deel (ook met toetsenbord)
   - kaart: slepen, knijpen, scrollwiel en +/− knoppen (viewBox), daarna geen per-ongeluk-tik
   - kaartlabels nooit kleiner dan 11px; botsende labels verdwijnen tot je inzoomt
   - feedback als melding over de kaart; vraagtekst en knoppen passen zich aan hun vak aan
   - eindscherm en spiekkaart passen op één scherm */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const setFs=(el,px)=>px==null?el.style.removeProperty('font-size'):el.style.setProperty('font-size',px+'px','important');
 const raf=fn=>{let q=false;return()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;fn()})}};
 const MIN_LABEL=11;

 // ---------------------------------------------------------------- schermhoogte
 function height(){
  const h=Math.round(window.visualViewport?.height||window.innerHeight);
  document.documentElement.style.setProperty('--vast-h',h+'px');
 }
 height();
 window.visualViewport?.addEventListener('resize',()=>{height();schedule()});
 window.addEventListener('resize',()=>{height();schedule()});
 window.addEventListener('orientationchange',()=>setTimeout(()=>{height();schedule()},250));

 // ---------------------------------------------------------------- kaart: zoomen en slepen
 const views=new WeakMap(); // svg -> {home:[x,y,w,h],full:[x,y,w,h],last:string}
 let suppressUntil=0;
 const parse=s=>String(s||'').trim().split(/[\s,]+/).map(Number);
 function state(svg){
  let st=views.get(svg);
  const vb=svg.getAttribute('viewBox');
  if(!st){
   const home=parse(vb);
   const full=svg.dataset.full?parse(svg.dataset.full):home;
   st={home,full,last:vb};views.set(svg,st);
  }else if(vb!==st.last){st.home=parse(vb);st.last=vb}
  return st;
 }
 function geom(svg){
  const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
  const slice=svg.preserveAspectRatio?.baseVal?.meetOrSlice===2;
  const k=(slice?Math.max:Math.min)(r.width/vb.width,r.height/vb.height)||1;
  return {r,x:vb.x,y:vb.y,w:vb.width,h:vb.height,k,ox:r.left+(r.width-vb.width*k)/2,oy:r.top+(r.height-vb.height*k)/2};
 }
 const toSvg=(g,cx,cy)=>[g.x+(cx-g.ox)/g.k,g.y+(cy-g.oy)/g.k];
 function limits(svg,st){
  const zoomTask=svg.closest('#game')&&(document.querySelector('#game .game-grid')?.dataset.mode==='zoom'||svg.classList.contains('zoomed'));
  const maxW=zoomTask?st.home[2]:Math.max(st.home[2],st.full[2]*1.08);
  const minW=Math.max(st.home[2]/6,st.full[2]/40);
  return {minW:Math.min(minW,st.home[2]),maxW};
 }
 function setView(svg,x,y,w,h){
  const st=state(svg),{minW,maxW}=limits(svg,st);
  const ratio=h/w;
  if(w<minW){x+=(w-minW)/2;y+=(h-minW*ratio)/2;w=minW;h=w*ratio}
  if(w>maxW){x+=(w-maxW)/2;y+=(h-maxW*ratio)/2;w=maxW;h=w*ratio}
  const f=st.full,cx=Math.max(f[0],Math.min(f[0]+f[2],x+w/2)),cy=Math.max(f[1],Math.min(f[1]+f[3],y+h/2));
  x=cx-w/2;y=cy-h/2;
  const vb=[x,y,w,h].map(v=>Math.round(v*100)/100).join(' ');
  if(vb===svg.getAttribute('viewBox'))return;
  st.last=vb;svg.setAttribute('viewBox',vb);
  changed(svg);
 }
 function zoomBy(svg,factor,cx,cy){
  const g=geom(svg);
  if(cx==null){cx=g.r.left+g.r.width/2;cy=g.r.top+g.r.height/2}
  const [px,py]=toSvg(g,cx,cy),f=1/factor;
  setView(svg,px-(px-g.x)*f,py-(py-g.y)*f,g.w*f,g.h*f);
 }
 function goHome(svg){const st=state(svg);const [x,y,w,h]=st.home;const vb=st.home.join(' ');st.last=vb;svg.setAttribute('viewBox',vb);changed(svg)}
 const viewEvents=new WeakMap();
 function changed(svg){
  updateControls(svg.closest('.vast-pan'));
  if(!svg.querySelector('.dyn'))fitLabels(svg);
  let fire=viewEvents.get(svg);
  if(!fire){fire=raf(()=>svg.dispatchEvent(new CustomEvent('topo:view',{bubbles:true})));viewEvents.set(svg,fire)}
  fire();
 }
 function svgIn(frame){return frame.querySelector('svg.map-art')||frame.querySelector('svg')}
 function updateControls(frame){
  if(!frame)return;
  const box=frame.__vastZoom,svg=svgIn(frame);if(!box)return;
  if(!svg){box.hidden=true;return}
  box.hidden=false;
  const st=state(svg),vb=parse(svg.getAttribute('viewBox')),{minW,maxW}=limits(svg,st);
  box.querySelector('.vast-zoom-in').disabled=vb[2]<=minW*1.01;
  box.querySelector('.vast-zoom-out').disabled=vb[2]>=maxW*.99;
  const away=Math.abs(vb[2]-st.home[2])>st.home[2]*.01||Math.abs(vb[0]-st.home[0])>st.home[2]*.01||Math.abs(vb[1]-st.home[1])>st.home[3]*.01;
  box.querySelector('.vast-zoom-home').hidden=!away;
 }
 function attachPan(frame,host){
  if(!frame||frame.__vastPan)return;
  frame.__vastPan=true;frame.classList.add('vast-pan');
  const box=document.createElement('div');
  box.className='vast-zoom';box.setAttribute('role','group');box.setAttribute('aria-label','Kaart zoomen');
  box.innerHTML='<button type="button" class="vast-zoom-in" aria-label="Inzoomen">+</button><button type="button" class="vast-zoom-out" aria-label="Uitzoomen">−</button><button type="button" class="vast-zoom-home" aria-label="Terug naar het begin" hidden>⤢</button>';
  (host||frame).appendChild(box);frame.__vastZoom=box;
  box.addEventListener('click',e=>{
   const b=e.target.closest('button');const svg=svgIn(frame);if(!b||!svg)return;
   e.stopPropagation();
   if(b.classList.contains('vast-zoom-in'))zoomBy(svg,1.6);
   else if(b.classList.contains('vast-zoom-out'))zoomBy(svg,1/1.6);
   else goHome(svg);
  });
  const pts=new Map();let gesture=null;
  const begin=()=>{
   const svg=svgIn(frame);if(!svg){gesture=null;return}
   const list=[...pts.values()],g=geom(svg);
   if(list.length>=2){
    const [a,b]=list,mid=[(a.x+b.x)/2,(a.y+b.y)/2];
    gesture={svg,g,pinch:true,d:Math.hypot(a.x-b.x,a.y-b.y)||1,p:toSvg(g,mid[0],mid[1]),moved:true};
   }else if(list.length===1){
    gesture={svg,g,pinch:false,x:list[0].x,y:list[0].y,moved:gesture?.moved||false};
   }else gesture=null;
  };
  frame.addEventListener('pointerdown',e=>{
   if(e.button>0||e.target.closest('.vast-zoom'))return;
   pts.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();
  });
  frame.addEventListener('pointermove',e=>{
   if(!pts.has(e.pointerId)||!gesture)return;
   pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
   const {svg,g}=gesture;
   if(gesture.pinch&&pts.size>=2){
    const [a,b]=[...pts.values()],mid=[(a.x+b.x)/2,(a.y+b.y)/2],scale=Math.hypot(a.x-b.x,a.y-b.y)/gesture.d;
    const w=g.w/scale,h=g.h/scale,k=g.k*scale;
    setView(svg,gesture.p[0]-(mid[0]-g.ox)/k,gesture.p[1]-(mid[1]-g.oy)/k,w,h);
    e.preventDefault();
   }else if(!gesture.pinch){
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(!gesture.moved&&Math.hypot(dx,dy)<9)return;
    if(!gesture.moved){gesture.moved=true;try{frame.setPointerCapture(e.pointerId)}catch(_){}}
    setView(svg,g.x-dx/g.k,g.y-dy/g.k,g.w,g.h);
    e.preventDefault();
   }
  });
  const end=e=>{
   if(!pts.has(e.pointerId))return;
   pts.delete(e.pointerId);
   if(gesture?.moved)suppressUntil=performance.now()+(e.type==='pointercancel'?0:450);
   if(pts.size)begin();else gesture=null;
  };
  frame.addEventListener('pointerup',end);frame.addEventListener('pointercancel',end);frame.addEventListener('lostpointercapture',e=>{if(pts.has(e.pointerId)&&e.pointerType!=='mouse')return;end(e)});
  frame.addEventListener('wheel',e=>{
   const svg=svgIn(frame);if(!svg)return;
   e.preventDefault();
   const step=e.deltaMode===1?e.deltaY*16:e.deltaY;
   zoomBy(svg,Math.exp(-Math.max(-120,Math.min(120,step))*0.0022),e.clientX,e.clientY);
  },{passive:false});
  new MutationObserver(list=>{
   const svg=svgIn(frame);if(!svg){updateControls(frame);return}
   const fresh=list.some(m=>m.type==='childList'&&[...m.addedNodes].some(n=>n===svg||n.contains?.(svg)));
   const st=views.get(svg),vb=svg.getAttribute('viewBox');
   if(fresh||!st||vb!==st.last){state(svg);if(!svg.querySelector('.dyn'))fitLabels(svg);updateControls(frame)}
  }).observe(frame,{subtree:true,childList:true,attributes:true,attributeFilter:['viewBox']});
 }
 // Na slepen of knijpen geen antwoord-tik.
 window.addEventListener('click',e=>{
  if(performance.now()<suppressUntil&&e.target.closest?.('.vast-pan')){e.preventDefault();e.stopImmediatePropagation();suppressUntil=0}
 },true);

 // ---------------------------------------------------------------- kaartlabels leesbaar
 function fitLabels(svg){
  if(!svg.isConnected||svg.querySelector('.dyn'))return;
  const texts=[...svg.querySelectorAll('.map-text,.map-label')];
  if(!texts.length)return;
  const r=svg.getBoundingClientRect();if(!r.width)return;
  const k=geom(svg).k;
  const shown=[];
  for(const t of texts){
   t.style.visibility='';
   if(t.dataset.fs==null){const cs=getComputedStyle(t);t.dataset.fs=parseFloat(cs.fontSize)||16;t.dataset.sw=parseFloat(cs.strokeWidth)||0}
   const fs=+t.dataset.fs;
   if(fs*k<MIN_LABEL){const n=MIN_LABEL/k;t.style.fontSize=n+'px';if(+t.dataset.sw)t.style.strokeWidth=(+t.dataset.sw*n/fs)+'px'}
   else{t.style.fontSize='';t.style.strokeWidth=''}
   if(t.style.display==='none'||getComputedStyle(t).display==='none')continue;
   shown.push(t);
  }
  // Grote namen (water, provincies) eerst, dan de rest in kaartvolgorde.
  const rank=t=>t.matches('.water,.province,.region,.region-name,.water-name')?0:1;
  shown.sort((a,b)=>rank(a)-rank(b));
  const placed=[];
  for(const t of shown){
   const b=t.getBoundingClientRect();
   if(!b.width)continue;
   const out=b.right<r.left||b.left>r.right||b.bottom<r.top||b.top>r.bottom;
   if(out)continue;
   const hit=placed.some(p=>b.left<p.right+3&&b.right>p.left-3&&b.top<p.bottom+2&&b.bottom>p.top-2);
   if(hit){t.style.visibility='hidden';continue}
   placed.push(b);
  }
 }

 // ---------------------------------------------------------------- tekst past in zijn vak
 function lineCount(el){
  const cs=getComputedStyle(el),lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.15;
  return Math.round((el.scrollHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom))/lh);
 }
 function fitLines(el,max,min,lines){
  if(!el||!el.isConnected||!el.offsetWidth)return;
  setFs(el);
  let fs=parseFloat(getComputedStyle(el).fontSize);if(max)fs=Math.min(fs,max);
  setFs(el,fs);
  while(fs>min&&(lineCount(el)>lines||el.scrollWidth>el.clientWidth+1)){fs-=1;setFs(el,fs)}
 }
 function fitBox(el,min){
  if(!el||!el.isConnected||!el.offsetWidth)return;
  setFs(el);
  let fs=parseFloat(getComputedStyle(el).fontSize);
  while(fs>min&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)){fs-=1;setFs(el,fs)}
 }
 function fitGame(){
  const game=$('game');if(!game||game.classList.contains('hide'))return;
  const vorm=game.dataset.vorm,prompt=$('prompt');
  if(prompt){
   if(vorm==='nomap')fitLines(prompt,0,15,6);
   else{
    const base=(setFs(prompt),parseFloat(getComputedStyle(prompt).fontSize));
    fitLines(prompt,0,Math.max(17,Math.round(base*.78)),1);
    if(lineCount(prompt)>1)fitLines(prompt,0,15,2);
   }
  }
  const sub=$('sub');if(sub)fitLines(sub,0,11,2);
  document.querySelectorAll('#answerOptions .option').forEach(o=>{
   setFs(o);
   const cs=getComputedStyle(o);let fs=parseFloat(cs.fontSize);
   const inner=()=>o.scrollHeight>o.clientHeight+1||o.scrollWidth>o.clientWidth+1||lineCount(o)>2;
   while(fs>12&&inner()){fs-=1;setFs(o,fs)}
  });
  const fb=$('feedback');if(fb&&!fb.classList.contains('hide')&&fb.parentElement?.classList.contains('game-board'))fitBox(fb,12);
 }

 // ---------------------------------------------------------------- spelstand volgen
 function syncGame(){
  const game=$('game');if(!game)return;
  const grid=game.querySelector('.game-grid'),board=game.querySelector('.game-board'),card=game.querySelector('.question-card');
  const fb=$('feedback'),opts=$('answerOptions');
  const nomap=Boolean(grid?.classList.contains('shuffle-no-map'));
  const vorm=nomap?'nomap':opts?.querySelector('#typeForm')?'type':opts?.querySelector('.option')?'choice':'point';
  if(game.dataset.vorm!==vorm)game.dataset.vorm=vorm;
  if(fb&&board&&card){
   if(!nomap&&fb.parentElement!==board)board.insertBefore(fb,$('mapHint')||null);
   if(nomap&&fb.parentElement!==card)card.insertBefore(fb,$('next')||card.querySelector('.small-links'));
  }
  fitGame();
  const map=$('map');if(map){const svg=svgIn(map);if(svg){if(!svg.querySelector('.dyn'))fitLabels(svg);updateControls(map)}}
 }
 function syncEnd(){
  const end=$('end');if(!end)return;
  const on=!end.classList.contains('hide')&&!document.body.classList.contains('playing');
  document.body.classList.toggle('vast-eind',on);
  if(on)fitEnd(end);
 }
 function fitEnd(end){
  const review=end.querySelector('#review');
  if(review){
   review.querySelectorAll('.vast-meer').forEach(n=>n.remove());
   review.querySelectorAll('span').forEach(s=>s.hidden=false);
  }
  const box=end.classList.contains('result')?end:end.querySelector('.result')||end;
  const over=()=>box.scrollHeight>box.clientHeight+1||end.scrollHeight>end.clientHeight+1||document.documentElement.scrollHeight>innerHeight+1||Boolean(review&&review.scrollHeight>review.clientHeight+1);
  end.querySelectorAll('.vast-weg').forEach(n=>n.classList.remove('vast-weg'));
  for(const sel of ['.star','.help-summary small','.sticker','.end-note']){if(!over())break;end.querySelectorAll(sel).forEach(n=>n.classList.add('vast-weg'))}
  const h2=end.querySelector('h2');
  if(h2){setFs(h2);let fs=parseFloat(getComputedStyle(h2).fontSize);while(fs>26&&over()){fs-=3;setFs(h2,fs)}}
  if(review){review.classList.remove('vast-klein');if(over())review.classList.add('vast-klein')}
  if(review&&over()){
   const chips=[...review.querySelectorAll('span')].filter(s=>!s.classList.contains('vast-meer'));
   let hidden=0;const more=document.createElement('span');more.className='vast-meer';
   while(chips.length>1&&over()){chips.pop().hidden=true;hidden++;more.textContent='+'+hidden+' meer';if(!more.isConnected)review.appendChild(more)}
  }
 }
 const schedule=raf(()=>{syncGame();syncEnd()});

 // ---------------------------------------------------------------- spiekkaart
 function setupSheet(){
  const layer=$('sheetLayer'),map=$('sheetMap');if(!layer||!map)return;
  attachPan(map);
  const modal=layer.querySelector('.modal');
  const note=modal.querySelector(':scope>p')||$('sheetNote')||modal.querySelector('.sheet-zoom-note');
  const tags=$('answerTags'),print=$('printSheet');
  const foot=document.createElement('div');foot.className='vast-sheet-foot';
  map.after(foot);
  if(note&&!note.classList.contains('sheet-zoom-note'))foot.appendChild(note);
  else{const p=document.createElement('p');p.textContent='Zoom in. Bekijk de plekken.';foot.appendChild(p)}
  if(tags){
   const b=document.createElement('button');b.type='button';b.className='vast-lijst-knop';b.textContent='Lijst';
   b.setAttribute('aria-pressed','false');
   b.onclick=()=>{const on=modal.classList.toggle('vast-lijst');b.textContent=on?'Kaart':'Lijst';b.setAttribute('aria-pressed',String(on));if(on)fitTags(tags)};
   foot.appendChild(b);
  }
  if(print)foot.appendChild(print);
  new MutationObserver(()=>{if(!layer.classList.contains('hide')){modal.classList.remove('vast-lijst');const b=foot.querySelector('.vast-lijst-knop');if(b){b.textContent='Lijst';b.setAttribute('aria-pressed','false')}requestAnimationFrame(()=>{const svg=svgIn(map);if(svg){state(svg);if(!svg.querySelector('.dyn'))fitLabels(svg)}updateControls(map);pageGlossary(map,foot)})}}).observe(layer,{attributes:true,attributeFilter:['class']});
 }
 // Begrippenlijst (sets zonder kaart): bladzijden die precies passen, geen scrollvlak.
 function pageGlossary(map,foot){
  const dl=map.querySelector('.glossary');
  let pager=foot.querySelector('.vast-pager');
  if(!dl){if(pager)pager.hidden=true;return}
  const pairs=[];let cur=null;
  for(const n of dl.children){if(n.tagName==='DT'){cur=[n];pairs.push(cur)}else if(cur)cur.push(n)}
  if(!pager){
   pager=document.createElement('div');pager.className='vast-pager';pager.setAttribute('role','group');pager.setAttribute('aria-label','Meer begrippen');
   pager.innerHTML='<button type="button" class="vast-pager-prev" aria-label="Vorige">‹</button><span aria-live="polite"></span><button type="button" class="vast-pager-next" aria-label="Volgende">›</button>';
   foot.appendChild(pager);
   pager.addEventListener('click',e=>{const b=e.target.closest('button'),st=pager.__st;if(!b||!st)return;st.page=Math.max(0,Math.min(st.pages.length-1,st.page+(b.classList.contains('vast-pager-next')?1:-1)));st.show()});
  }
  pager.hidden=false;
  const box=map,show=(a,b)=>pairs.forEach((p,i)=>p.forEach(n=>n.classList.toggle('vast-pagina-weg',i<a||i>=b)));
  const over=()=>box.scrollHeight>box.clientHeight+1||dl.getBoundingClientRect().bottom>box.getBoundingClientRect().bottom+1;
  const pages=[];let start=0;
  while(start<pairs.length){
   let end=start+1;show(start,end);
   while(end<pairs.length){show(start,end+1);if(over())break;end++}
   pages.push([start,end]);start=end;
  }
  if(pages.length<2){show(0,pairs.length);pager.hidden=true;return}
  const st={pages,page:0,show:()=>{const [a,b]=st.pages[st.page];show(a,b);pager.querySelector('span').textContent=(st.page+1)+'/'+st.pages.length;pager.querySelector('.vast-pager-prev').disabled=st.page===0;pager.querySelector('.vast-pager-next').disabled=st.page>=st.pages.length-1}};
  pager.__st=st;st.show();
 }
 function fitTags(tags){
  setFs(tags);
  let fs=parseFloat(getComputedStyle(tags).fontSize)||15;
  while(fs>11&&tags.scrollHeight>tags.clientHeight+1){fs-=1;setFs(tags,fs)}
 }

 // ---------------------------------------------------------------- instellingen: passen door compacter maken en bladeren
 let settingsBusy=false;
 function settingsBox(){return document.querySelector('.board .layout>div:last-child')}
 function fitSettings(){
  const box=settingsBox();if(!box)return;
  const panel=[...box.querySelectorAll('.panel')].find(p=>!p.hidden);if(!panel)return;
  settingsBusy=true;
  try{
   panel.classList.remove('vast-dicht','vast-kort','vast-kolommen');
   panel.querySelectorAll('.vast-pagina-weg').forEach(n=>n.classList.remove('vast-pagina-weg'));
   panel.querySelectorAll('.vast-pager').forEach(n=>n.hidden=true);
   const doc=document.documentElement,bar=document.querySelector('.board .bottom');
   // Meten met scrollhoogte én met de echte plek op het scherm (WebKit rekent scrollhoogte soms anders).
   const lowest=()=>{let b=0;for(const n of panel.querySelectorAll(':scope>*,:scope>.group>*,.sheet-grid>*')){if(!n.getClientRects().length)continue;const r=n.getBoundingClientRect();if(r.height&&r.bottom>b)b=r.bottom}return b};
   const over=()=>{
    if(box.scrollHeight>box.clientHeight+1||panel.scrollHeight>panel.clientHeight+1||doc.scrollHeight>doc.clientHeight+1)return true;
    const low=lowest(),limit=Math.min(box.getBoundingClientRect().bottom,bar?bar.getBoundingClientRect().top:Infinity,window.visualViewport?.height||innerHeight);
    return low>limit+1;
   };
   if(!over())return;
   panel.classList.add('vast-dicht');
   const groups=[...panel.querySelectorAll(':scope>.group')];
   if(over()&&groups.length>1&&panel.clientWidth>=560)panel.classList.add('vast-kolommen');
   for(const grid of panel.querySelectorAll('.sheet-grid')){
    if(!over())break;
    const items=[...grid.children].filter(n=>n.matches('button'));
    const rows=pageItems(grid,items,over);
    // Liever de uitleg weg dan maar één rij keuzes per bladzijde.
    if(rows<2&&!panel.classList.contains('vast-kort')){panel.classList.add('vast-kort');items.forEach(n=>n.classList.remove('vast-pagina-weg'));pageItems(grid,items,over)}
   }
   if(over())panel.classList.add('vast-kort');
   if(over()&&groups.length>1)pageItems(panel,groups,over,true);
  }finally{settingsBusy=false}
 }
 function pagerFor(host,after,isGroups){
  let pager=host.__vastPager;
  if(!pager){
   pager=document.createElement('div');pager.className='vast-pager';pager.setAttribute('role','group');pager.setAttribute('aria-label',isGroups?'Meer keuzes':'Meer sets');
   pager.innerHTML='<button type="button" class="vast-pager-prev" aria-label="Vorige">‹</button><span aria-live="polite"></span><button type="button" class="vast-pager-next" aria-label="Volgende">›</button>';
   pager.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!host.__vastPage)return;
    e.stopPropagation();
    const st=host.__vastPage;st.page=Math.max(0,Math.min(st.pages-1,st.page+(b.classList.contains('vast-pager-next')?1:-1)));st.keep=true;
    st.show();
   });
   host.__vastPager=pager;
  }
  if(after.nextElementSibling!==pager)after.after(pager);
  return pager;
 }
 function pageItems(host,items,over,isGroups){
  if(items.length<2)return 99;
  const anchor=isGroups?items[items.length-1]:host;
  const pager=pagerFor(host,anchor,isGroups);pager.hidden=false;
  const cols=isGroups?1:Math.max(1,getComputedStyle(host).gridTemplateColumns.split(' ').filter(Boolean).length);
  const show=(start,size)=>items.forEach((it,i)=>it.classList.toggle('vast-pagina-weg',i<start||i>=start+size));
  let size=items.length;
  while(size>cols&&over()){size=Math.max(cols,(Math.ceil(size/cols)-1)*cols);show(0,size)}
  if(size>=items.length){pager.hidden=true;show(0,items.length);return 99}
  const pages=Math.ceil(items.length/size);
  const chosen=items.findIndex(it=>it.getAttribute('aria-pressed')==='true'||it.querySelector?.('[aria-pressed="true"]'));
  const old=host.__vastPage;
  const page=old&&old.keep&&old.pages===pages?Math.min(old.page,pages-1):Math.max(0,Math.floor(Math.max(0,chosen)/size));
  const st={size,pages,page,keep:Boolean(old&&old.keep&&old.pages===pages)};
  st.show=()=>{show(st.page*st.size,st.size);pager.querySelector('span').textContent=(st.page+1)+'/'+st.pages;pager.querySelector('.vast-pager-prev').disabled=st.page===0;pager.querySelector('.vast-pager-next').disabled=st.page>=st.pages-1};
  host.__vastPage=st;st.show();
  return Math.ceil(size/cols);
 }
 const scheduleSettings=raf(fitSettings);

 // ---------------------------------------------------------------- start
 function init(){
  if(settingsBox()){
   document.body.classList.add('vast-instellingen');
   const box=settingsBox();
   new MutationObserver(list=>{
    if(settingsBusy)return;
    const ours=list.every(m=>m.type==='attributes'?m.target.classList?.contains('vast-pager')||m.attributeName==='class':[...m.addedNodes,...m.removedNodes].every(n=>n.classList?.contains?.('vast-pager')));
    if(!ours)scheduleSettings();
   }).observe(box,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-pressed']});
   window.addEventListener('resize',scheduleSettings);window.visualViewport?.addEventListener('resize',scheduleSettings);
   document.fonts?.ready?.then(scheduleSettings);
   scheduleSettings();
  }
  const map=$('map');
  if(map){
   attachPan(map,map.closest('.game-board'));
   // Kaartvak van maat veranderd (andere vraagvorm, toetsenbord, draaien): laat het spel opnieuw scherpstellen.
   let last='';const kick=raf(()=>window.dispatchEvent(new Event('resize')));
   if(window.ResizeObserver)new ResizeObserver(([e])=>{const r=e.contentRect,key=Math.round(r.width)+'x'+Math.round(r.height);if(key===last)return;const first=!last;last=key;if(!first&&r.width&&r.height)kick()}).observe(map);
  }
  setupSheet();
  const game=$('game');
  if(game)new MutationObserver(schedule).observe(game,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-mode']});
  const end=$('end');
  const own=n=>n.nodeType===1&&n.classList.contains('vast-meer');
  if(end)new MutationObserver(list=>{if(list.some(m=>m.type!=='childList'||![...m.addedNodes,...m.removedNodes].every(own)))schedule()}).observe(end,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
  schedule();
 }
 window.TopoVast={zoomBy,goHome,fitLabels,refresh:schedule};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
