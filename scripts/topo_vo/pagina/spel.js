(function(){
'use strict';
const $=id=>document.getElementById(id);
const DATA='/topo/data/vo/';
const params=new URLSearchParams(location.search);
const setId=params.get('set')||'ob1-nl-basis';
const MODES=['mix','shuffle','point','choice','type','missing','zoom','quiz'];
const mode=MODES.includes(params.get('mode'))?params.get('mode'):'mix';
const countChoice=params.get('questions')||'10';
const questionLimit=countChoice==='all'?Infinity:Math.max(5,Math.min(80,parseInt(countChoice,10)||10));
const noHints=params.get('assist')==='none';
const challenge=params.get('level')==='challenge';
const KAART={
 wereld:{bbox:[-180,-60,180,84],lat0:0,basis:'kaarten/wereld-landen.geojson',landen:true,
  ankers:[['Atlantische Oceaan',-38,22],['Grote Oceaan',-140,8],['Indische Oceaan',78,-22],['Noordelijke IJszee',10,79]]},
 europa:{bbox:[-25,34,62,72],lat0:52,basis:'kaarten/europa-landen.geojson',landen:true,
  ankers:[['Atlantische Oceaan',-17,46],['Noordzee',3.2,56.2],['Middellandse Zee',17,35.2],['Oostzee',19.3,57.6],['Zwarte Zee',34,43.4],['Noordelijke IJszee',36,71]]},
 nederland:{bbox:[3.2,50.7,7.3,53.6],lat0:52.2,basis:'../provincies-2026.geojson',basisKey:'statcode',context:['../buurlanden.geojson'],water:'kaarten/nederland-water.geojson',pdok:true,
  ankers:[['Noordzee',3.75,52.45],['Waddenzee',5.4,53.47]]},
 'zuid-amerika':{bbox:[-92,-56,-30,15],lat0:-15,basis:'kaarten/zuid-amerika-landen.geojson',landen:true,
  ankers:[['Grote Oceaan',-86,-22],['Atlantische Oceaan',-34,-28],['Caribische Zee',-73,14]]},
 brazilie:{bbox:[-75,-34.5,-34,6],lat0:-14,basis:'kaarten/brazilie-deelstaten.geojson',context:['kaarten/zuid-amerika-landen.geojson'],
  ankers:[['Atlantische Oceaan',-37,-22]]},
 'mexico-vs':{bbox:[-125,24,-93,42],lat0:31,basis:'kaarten/mexico-vs-staten.geojson',context:['kaarten/wereld-landen.geojson'],
  ankers:[['Grote Oceaan',-121.5,29],['Golf van Mexico',-94.8,25.6]]}
};
const TYPEN={land:['het','land'],hoofdstad:['de','hoofdstad'],stad:['de','stad'],grensstad:['de','stad'],plaats:['de','plaats'],
 provincie:['de','provincie'],deelstaat:['de','deelstaat'],staat:['de','staat'],landsdeel:['het','landsdeel'],regio:['het','gebied'],
 rivier:['de','rivier'],kanaal:['het','kanaal'],meer:['het','meer'],zee:['de','zee'],oceaan:['de','oceaan'],golf:['de','golf'],baai:['de','baai'],
 zeestraat:['de','zeestraat'],zeearm:['de','zeearm'],lagune:['de','lagune'],fjord:['het','fjord'],gebergte:['het','gebergte'],berg:['de','berg'],
 vulkaan:['de','vulkaan'],bergpas:['de','bergpas'],woestijn:['de','woestijn'],plateau:['het','hoogland'],vlakte:['de','vlakte'],bekken:['het','bekken'],
 laagland:['het','laagland'],dal:['het','dal'],toendra:['de','toendra'],delta:['de','delta'],landengte:['de','landengte'],kaap:['de','kaap'],
 schiereiland:['het','schiereiland'],eiland:['het','eiland'],eilandengroep:['de','eilandengroep'],werelddeel:['het','werelddeel'],plaat:['de','plaat'],
 moerasgebied:['het','moerasgebied'],bioom:['het','bioom'],polder:['de','polder'],dijk:['de','dijk'],waterkering:['de','waterkering'],
 luchthaven:['de','luchthaven'],natuurgebied:['het','natuurgebied'],haven:['de','haven'],stuwdam:['de','stuwdam'],mijngebied:['het','mijngebied'],
 weg:['de','weg'],favela:['de','favela'],vrijhandelszone:['de','vrijhandelszone'],kustproject:['het','kustproject'],rivierproject:['het','rivierproject'],
 'laagste punt':['het','laagste punt']};
const FAMILIE={stad:'plaats',hoofdstad:'plaats',grensstad:'plaats',plaats:'plaats',luchthaven:'plaats',haven:'plaats',favela:'plaats',
 zee:'water',oceaan:'water',golf:'water',baai:'water',zeestraat:'water',zeearm:'water',lagune:'water',fjord:'water',meer:'water',
 eiland:'eiland',eilandengroep:'eiland',gebergte:'reliëf',plateau:'reliëf',vlakte:'reliëf',bekken:'reliëf',laagland:'reliëf',dal:'reliëf',toendra:'reliëf',
 berg:'top',vulkaan:'top',deelstaat:'gebied',provincie:'gebied',staat:'gebied',landsdeel:'gebied',regio:'gebied',natuurgebied:'gebied',polder:'gebied',bioom:'gebied',
 waterkering:'werk',dijk:'werk',stuwdam:'werk',kustproject:'werk',rivierproject:'werk'};
const FAMNAAM={plaats:['de','plaats'],water:['het','water'],eiland:['het','eiland'],'reliëf':['het','landschap'],top:['de','berg'],gebied:['het','gebied'],werk:['het','waterwerk']};
const C=['#ffc2b8','#ffe3a4','#c9e6ae','#f4dfbc','#c7e6e7','#ffe4bb','#d7e8ba','#ffcfc0','#e8d8e8','#f5e4bd','#d7e0ee','#d2e7bc'];
let SET=null,K=null,kaartId=null,items=new Map(),setItems=[],facts=[],begrippen=new Map(),geo={},topoTalk={},lastSpoken={};
let scale=1,cosL=1,W=1000,H=600,basisFeatures=[],contextFeatures=[],projCache=new Map();
let submitLog=[],queue=[],index=0,stars=0,helpCount=0,peekCount=0,round=0,wrong=new Set(),assisted=new Set(),repeated=new Set(),hintStep=0,attempts=0,nearMiss=false,done=false,currentMode='point',zoom=1,guessOptions=[],correctStreak=0,wrongStreak=0,wrongTapTimes=[],retryPool=null;
const fmt=n=>Math.round(n*10)/10;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function tidy(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'')}
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}
function voice(group){const o=topoTalk[group]||[];if(!o.length)return '';const c=o.filter(v=>v!==lastSpoken[group]);const s=shuffle(c.length?c:o)[0];lastSpoken[group]=s;return s}
function typ(it){return TYPEN[it.type]||['de','plek']}
function fam(it){return FAMILIE[it.type]||it.type}
const STAMMEN=['straat','zee','oceaan','meer','golf','baai','kanaal','gebergte','woestijn','eiland','plaat','dijk','kering','dam','delta','polder','vlakte','hoogland','plateau','bekken','rivier','berg','waterweg','schelde'];
function withArticle(it){
 const [art,noun]=typ(it),n=it.naam,low=n.toLowerCase();
 if(/^(het|de) /i.test(n))return n.replace(/^Het /,'het ').replace(/^De /,'de ');
 return STAMMEN.some(s=>low.includes(s))||low.includes(noun.split(' ').pop())?art+' '+n:art+' '+noun+' '+n;
}
function welk(t){return (t[0]==='het'?'Welk ':'Welke ')+t[1]}
function ditDeze(t){return (t[0]==='het'?'dit ':'deze ')+t[1]}
// ---------------------------------------------------------------- projectie en geometrie
function setKaart(id){
 kaartId=id;K=KAART[id];cosL=Math.cos(K.lat0*Math.PI/180);
 scale=1000/((K.bbox[2]-K.bbox[0])*cosL);W=1000;H=(K.bbox[3]-K.bbox[1])*scale;
}
const proj=(lon,lat)=>[(lon-K.bbox[0])*cosL*scale,(K.bbox[3]-lat)*scale];
function flatGeom(g){
 if(!g)return [];
 if(g.type==='GeometryCollection')return g.geometries.flatMap(flatGeom);
 return [g];
}
function projGeom(g){
 const out={rings:[],lines:[]};
 for(const p of flatGeom(g)){
  const P=c=>proj(c[0],c[1]);
  if(p.type==='Polygon')out.rings.push(...p.coordinates.map(r=>r.map(P)));
  else if(p.type==='MultiPolygon')out.rings.push(...p.coordinates.flat(1).map(r=>r.map(P)));
  else if(p.type==='LineString')out.lines.push(p.coordinates.map(P));
  else if(p.type==='MultiLineString')out.lines.push(...p.coordinates.map(l=>l.map(P)));
 }
 return out;
}
function pathOf(pg){
 const r=pg.rings.map(ring=>ring.map((v,i)=>(i?'L':'M')+fmt(v[0])+' '+fmt(v[1])).join('')+'Z').join('');
 const l=pg.lines.map(line=>line.map((v,i)=>(i?'L':'M')+fmt(v[0])+' '+fmt(v[1])).join('')).join('');
 return r+l;
}
function boundsOf(points){
 if(!points.length)return null;
 let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
 for(const [x,y] of points){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y}
 return {left:l,right:r,top:t,bottom:b};
}
function inside(pg,x,y){
 let c=false;
 for(const ring of pg.rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi||1e-9)+xi))c=!c;
 }
 return c;
}
function segDist(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const k=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-a[0]-k*dx,py-a[1]-k*dy)}
function edgeDist(pg,x,y){
 let d=Infinity;
 for(const part of [...pg.rings,...pg.lines])for(let i=1;i<part.length;i++)d=Math.min(d,segDist(x,y,part[i-1],part[i]));
 return d;
}
function geoFile(k){
 if(k==='wereld-landen'&&K.landen)return K.basis;
 if(k==='wereld-landen'&&(K.context||[]).includes('kaarten/zuid-amerika-landen.geojson'))return 'kaarten/zuid-amerika-landen.geojson';
 return k.startsWith('../')?k+'.geojson':'kaarten/'+k+'.geojson';
}
function featureKey(file,f){return file===K.basis&&K.basisKey?f.properties[K.basisKey]:f.properties.id}
function shapeOf(it){
 if(projCache.has(it.id))return projCache.get(it.id);
 let pg=null;
 if(it.geo){
  const file=geoFile(it.geo.kaart),fc=geo[file];
  const fs=fc?fc.features.filter(x=>featureKey(file,x)===it.geo.key):[];
  if(fs.length){pg={rings:[],lines:[]};for(const f of fs){const p=projGeom(f.geometry);pg.rings.push(...p.rings);pg.lines.push(...p.lines)}if(!pg.rings.length&&!pg.lines.length)pg=null}
 }
 projCache.set(it.id,pg);return pg;
}
function kindOf(it){const s=shapeOf(it);return !s?'point':s.rings.length?'area':'line'}
function pt(it){return proj(it.coord[0],it.coord[1])}
// ---------------------------------------------------------------- kaart tekenen
function pdokDetail(){
 const box={west:3.0,east:7.7,south:50.4,north:53.9};
 const a=proj(box.west,box.north),b=proj(box.east,box.south);
 const attrs='x="'+fmt(a[0])+'" y="'+fmt(a[1])+'" width="'+fmt(b[0]-a[0])+'" height="'+fmt(b[1]-a[1])+'" preserveAspectRatio="none"';
 const base='https://service.pdok.nl/kadaster/brt-top10nl/wms/v1_0';
 const url=layers=>base+'?'+new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:layers,STYLES:'',CRS:'EPSG:4326',
  BBOX:[box.south,box.west,box.north,box.east].join(','),WIDTH:'1440',HEIGHT:'1120',FORMAT:'image/png',TRANSPARENT:'TRUE'}).toString().replace(/&/g,'&amp;');
 return '<g class="pdok-detail" aria-hidden="true"><image class="pdok-water" '+attrs+' href="'+url('Waterdeel')+'"/><image class="pdok-routes" '+attrs+' href="'+url('Wegdeelhartlijn,Spoorbaandeel')+'"/></g>';
}
let baseCache=null;
function baseLayers(){
 if(baseCache)return baseCache;
 const ctx=contextFeatures.map(f=>'<path class="surrounding-land" d="'+pathOf(projGeom(f.geometry))+'"/>').join('');
 const basis=basisFeatures.map((f,i)=>'<path class="area-shape" fill="'+C[i%C.length]+'" d="'+pathOf(projGeom(f.geometry))+'"/>').join('');
 let water='',lines='';
 if(K.water&&geo[K.water])for(const f of geo[K.water].features){const pg=projGeom(f.geometry);if(pg.rings.length)water+='<path class="water-area" d="'+pathOf({rings:pg.rings,lines:[]})+'"/>';if(pg.lines.length)lines+='<path class="river-line" d="'+pathOf({rings:[],lines:pg.lines})+'"/>';}
 if(geo['kaarten/meren.geojson']&&kaartId!=='nederland')for(const f of geo['kaarten/meren.geojson'].features)water+='<path class="water-area" d="'+pathOf(projGeom(f.geometry))+'"/>';
 if(geo['kaarten/rivieren.geojson']&&kaartId!=='nederland')for(const f of geo['kaarten/rivieren.geojson'].features)lines+='<path class="river-line" d="'+pathOf(projGeom(f.geometry))+'"/>';
 if(geo['kaarten/plaatgrenzen.geojson'])for(const f of geo['kaarten/plaatgrenzen.geojson'].features)lines+='<path class="plate-line" d="'+pathOf(projGeom(f.geometry))+'"/>';
 baseCache='<defs><pattern id="topo-grid" width="79" height="79" patternUnits="userSpaceOnUse"><path d="M79 0H0V79" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/></pattern></defs>'+
  '<rect x="-3000" y="-3000" width="7000" height="7000" fill="#cbe9f4"/><rect x="-3000" y="-3000" width="7000" height="7000" fill="url(#topo-grid)"/>'+
  '<g aria-hidden="true">'+ctx+'</g><g class="basis">'+basis+'</g>'+(K.pdok?pdokDetail():'')+'<g aria-hidden="true">'+water+'</g><g aria-hidden="true">'+lines+'</g>';
 return baseCache;
}
function mapSvg(cls,label){
 return '<svg class="map-art '+cls+'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+fmt(W)+' '+fmt(H)+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+esc(label)+'">'+baseLayers()+'<g class="dyn"></g></svg>';
}
// ---------------------------------------------------------------- welke plekken tonen
function current(){return queue[index]}
function sameFamily(a,b){return fam(a)===fam(b)}
function pointItems(target){return setItems.filter(it=>kindOf(it)==='point'&&sameFamily(it,target))}
function dotsFor(target){
 const same=pointItems(target);if(same.length>=4)return same;
 const all=setItems.filter(it=>kindOf(it)==='point');return all.length>=4?all:[];
}
function continentOf(it){
 if(it.werelddeel&&it.type!=='werelddeel')return it.werelddeel;
 const [x,y]=pt(it);let best=null,bd=Infinity;
 for(const o of items.values()){if(o.type!=='land'||!o.werelddeel)continue;const d=Math.hypot(pt(o)[0]-x,pt(o)[1]-y);if(d<bd){bd=d;best=o}}
 const s=shapeOf(it);
 if(s&&s.lines.length){const ps=s.lines.flat();for(const o of items.values()){if(o.type!=='land'||!o.werelddeel)continue;for(let i=0;i<ps.length;i+=Math.max(1,Math.floor(ps.length/12))){const d=Math.hypot(pt(o)[0]-ps[i][0],pt(o)[1]-ps[i][1]);if(d<bd){bd=d;best=o}}}}
 return best?.werelddeel||null;
}
function shapePts(it){const s=shapeOf(it);return s?[...s.rings.flat(),...s.lines.flat()]:[pt(it)]}
function regionBounds(task){
 const it=task.item,full={left:0,right:W,top:0,bottom:H};
 if(!it||['werelddeel','oceaan','plaat'].includes(it.type))return full;
 const kd=kindOf(it);let pts=null;
 if(challenge)return full;
 if(kaartId==='wereld'){
  const wd=continentOf(it);
  if(wd)pts=[...items.values()].filter(o=>o.werelddeel===wd&&o.type==='land'&&(o.kaarten||[]).includes('wereld')).map(pt);
 }else if(kaartId==='nederland'&&kd==='point'&&it.feiten?.provincie){
  const f=basisFeatures.find(x=>x.properties.statnaam===it.feiten.provincie);
  if(f)pts=projGeom(f.geometry).rings.flat();
 }else if(kaartId==='brazilie'&&kd==='point'&&it.feiten?.regio){
  const fs=basisFeatures.filter(x=>x.properties.regio===it.feiten.regio);
  if(fs.length)pts=fs.flatMap(f=>projGeom(f.geometry).rings.flat());
 }else if(kaartId==='europa'||(kd==='point'&&kaartId!=='nederland')){
  const [x,y]=pt(it),k=kaartId==='europa'?10:kaartId==='mexico-vs'?5:8;
  const near=setItems.filter(o=>sameFamily(o,it)).sort((a,b)=>Math.hypot(pt(a)[0]-x,pt(a)[1]-y)-Math.hypot(pt(b)[0]-x,pt(b)[1]-y)).slice(0,k);
  pts=near.flatMap(o=>kindOf(o)==='area'?shapePts(o):[pt(o)]);
 }
 if(!pts||pts.length<2)return full;
 pts=pts.concat(shapePts(it));
 return boundsOf(pts);
}
function targetBounds(it){
 const s=shapeOf(it);
 if(s)return boundsOf([...s.rings.flat(),...s.lines.flat()]);
 const [x,y]=pt(it);return {left:x,right:x,top:y,bottom:y};
}
function fitBox(b,pad,minW,minH){
 const frame=$('map');const ratio=(frame.clientWidth||400)/(frame.clientHeight||400);
 let w=Math.max(b.right-b.left+pad*2,minW),h=Math.max(b.bottom-b.top+pad*2,minH);
 if(w/h<ratio)w=h*ratio;else h=w/ratio;
 const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
 return [cx-w/2,cy-h/2,w,h];
}
function viewFor(task,m){
 const it=task.item,full={left:0,right:W,top:0,bottom:H};
 if(m==='point'||m==='missing'){const b=regionBounds(task);const isFull=b.left===0&&b.right===W,min=isFull?0:kaartId==='nederland'||kaartId==='wereld'?220:110;return fitBox(b,isFull?12:Math.max(kaartId==='mexico-vs'?14:30,(b.right-b.left)*.1),min,min)}
 const tb=targetBounds(it),tw=tb.right-tb.left,th=tb.bottom-tb.top;
 if(m==='zoom')return fitBox(tb,Math.max(45,tw),150,150);
 if(['werelddeel','oceaan','plaat'].includes(it.type))return fitBox(full,10,0,0);
 return fitBox(tb,Math.max(70,Math.max(tw,th)*.9),Math.min(W,260),Math.min(H,260));
}
function unitsPerPx(svg){const vb=svg.viewBox.baseVal;return vb.width/Math.max(1,svg.clientWidth||svg.getBoundingClientRect().width||400)}
function placeLabels(svg){
 const b=svg.viewBox.baseVal,accepted=[],u=unitsPerPx(svg),margin=6*u;
 for(const el of svg.querySelectorAll('.map-text.anchor')){el.style.display='';const r=el.getBBox();if(r.x<b.x+margin||r.x+r.width>b.x+b.width-margin||r.y<b.y+margin||r.y+r.height>b.y+b.height-margin)el.style.display='none'}
 for(const el of svg.querySelectorAll('.map-text.place')){
  el.style.display='';
  const r=el.getBBox();
  const ok=r.x>=b.x+margin&&r.x+r.width<=b.x+b.width-margin&&r.y>=b.y+margin&&r.y+r.height<=b.y+b.height-margin;
  const close=accepted.some(a=>r.x-4*u<a.x+a.width&&r.x+r.width+4*u>a.x&&r.y-3*u<a.y+a.height&&r.y+r.height+3*u>a.y);
  if(!ok||close)el.style.display='none';else accepted.push(r);
 }
}
function dynLayer(svg,opts){
 const u=unitsPerPx(svg),g=svg.querySelector('.dyn');
 const fs=13.5*u,parts=[],st=(f,w)=>' style="'+(f?'font-size:'+fmt(f)+'px;':'')+'stroke-width:'+fmt(w)+'px"';
 const anchor=K.ankers.map(([n,lon,lat])=>{const [x,y]=proj(lon,lat);return '<text class="map-text water anchor"'+st(fs*1.15,4*u)+' x="'+fmt(x)+'" y="'+fmt(y)+'" text-anchor="middle">'+esc(n)+'</text>'}).join('');
 parts.push('<g aria-hidden="true">'+anchor+'</g>');
 if(opts.highlight){
  const it=opts.highlight,s=shapeOf(it);
  if(s&&s.rings.length)parts.push('<path class="target-area"'+st(0,3.5*u)+' d="'+pathOf({rings:s.rings,lines:[]})+'"/>');
  else if(s&&s.lines.length)parts.push('<path class="target-line"'+st(0,7*u)+' d="'+pathOf({rings:[],lines:s.lines})+'"/><path class="target-line-core"'+st(0,3.2*u)+' d="'+pathOf({rings:[],lines:s.lines})+'"/>');
  else{const [x,y]=pt(it);parts.push('<circle class="city-focus" cx="'+fmt(x)+'" cy="'+fmt(y)+'" r="'+fmt(17*u)+'"'+st(0,4*u)+'/>')}
 }
 for(const it of opts.dots||[]){
  const [x,y]=pt(it),hidden=opts.hide&&opts.hide.id===it.id;
  if(hidden)continue;
  const mark=it.type==='hoofdstad'||it.feiten?.provinciehoofdstad||it.feiten?.hoofdstad?'<rect class="capital-dot" x="'+fmt(x-4.6*u)+'" y="'+fmt(y-4.6*u)+'" width="'+fmt(9.2*u)+'" height="'+fmt(9.2*u)+'" rx="'+fmt(u)+'"/>':'<circle class="city-dot" cx="'+fmt(x)+'" cy="'+fmt(y)+'" r="'+fmt(4.6*u)+'"/>';
  parts.push('<g class="city-symbol"><circle class="city-halo" cx="'+fmt(x)+'" cy="'+fmt(y)+'" r="'+fmt(9*u)+'"'+st(0,1.6*u)+'/>'+mark+'</g>');
 }
 if(opts.hide){
  const [x,y]=pt(opts.hide);
  parts.push('<circle cx="'+fmt(x)+'" cy="'+fmt(y)+'" r="'+fmt(17*u)+'" fill="#fff4c5" stroke="#182b34" stroke-width="'+fmt(2.6*u)+'" stroke-dasharray="'+fmt(5*u)+' '+fmt(4*u)+'"/><text x="'+fmt(x)+'" y="'+fmt(y+8*u)+'" text-anchor="middle" style="font-size:'+fmt(23*u)+'px;font-weight:1000">?</text>');
 }
 const labels=(opts.labels||[]).filter(it=>!(opts.hide&&opts.hide.id===it.id)).map(it=>{
  const [x,y]=pt(it),dx=kindOf(it)==='point'?10*u:0;
  return '<text class="map-text place"'+st(fs,4*u)+' x="'+fmt(x+dx)+'" y="'+fmt(y-(kindOf(it)==='point'?9*u:-fs/3))+'"'+(dx?'':' text-anchor="middle"')+'>'+esc(it.naam)+'</text>';
 }).join('');
 parts.push('<g>'+labels+'</g>');
 g.innerHTML=parts.join('');
 placeLabels(svg);
}
function focusMap(){
 const svg=$('map').querySelector('svg'),task=current();
 if(!svg||!task||!task.item||!$('map').clientWidth)return;
 const vb=viewFor(task,currentMode);
 svg.setAttribute('viewBox',vb.map(fmt).join(' '));
 svg.classList.toggle('detail-close',vb[2]<W*.45);
 const it=task.item;
 const opts={};
 if(currentMode==='point'){opts.dots=kindOf(it)==='point'?dotsFor(it):[];if(kindOf(it)==='point')opts.labels=setItems.filter(o=>kindOf(o)==='area'&&!sameFamily(o,it))}
 else if(currentMode==='missing'){opts.dots=pointItems(it);opts.labels=pointItems(it);opts.hide=it}
 else if(currentMode==='zoom'){opts.dots=pointItems(it);opts.highlight=it}
 else{opts.highlight=it;if(kindOf(it)==='point')opts.dots=dotsFor(it)}
 if(done&&currentMode!=='missing'){opts.highlight=it;opts.labels=[it]}
 if(done&&currentMode==='missing'){opts.hide=null;opts.labels=pointItems(it);opts.highlight=it}
 dynLayer(svg,opts);
}
// ---------------------------------------------------------------- ronde samenstellen
function canMissing(it){return kindOf(it)==='point'&&pointItems(it).length>=4}
function distractors(it,n){
 const sameType=[...items.values()].filter(o=>o.id!==it.id&&o.type===it.type&&(o.kaarten||[]).includes(kaartId)&&tidy(o.naam)!==tidy(it.naam));
 const family=[...items.values()].filter(o=>o.id!==it.id&&fam(o)===fam(it)&&o.type!==it.type&&(o.kaarten||[]).includes(kaartId)&&tidy(o.naam)!==tidy(it.naam));
 const [x,y]=pt(it);const near=a=>[...a].sort((p,q)=>Math.hypot(pt(p)[0]-x,pt(p)[1]-y)-Math.hypot(pt(q)[0]-x,pt(q)[1]-y));
 const inSet=new Set(setItems.map(s=>s.id));
 const pickFrom=list=>shuffle(near(list.filter(o=>inSet.has(o.id))).slice(0,9)).concat(shuffle(near(list).slice(0,9)));
 const out=[];
 for(const o of [...pickFrom(sameType),...pickFrom(family)])if(out.length<n&&!out.some(p=>tidy(p.naam)===tidy(o.naam)))out.push(o);
 return out;
}
function modeFor(it,i){
 if(mode==='point'||mode==='choice'||mode==='type')return mode==='choice'&&distractors(it,3).length<3?'type':mode;
 if(mode==='missing')return canMissing(it)?'missing':'type';
 if(mode==='zoom')return canMissing(it)?'zoom':'choice';
 const types=['point','choice','type','missing'];let m=mode==='shuffle'?shuffle(['point','point','choice','type','missing','zoom'])[0]:types[i%4];
 if((m==='missing'||m==='zoom')&&!canMissing(it))m='choice';
 if(m==='choice'&&distractors(it,3).length<3)m='type';
 return m;
}
function pickItems(pool,limit){
 // Gewoon oefenen: alleen basis- en middelplekken, ook als dat minder vragen oplevert. Extra uitdaging: alles.
 let use=pool;
 if(!challenge){const easy=pool.filter(it=>(it.moeilijkheid||2)<=2);if(easy.length)use=easy}
 return shuffle(use).slice(0,limit);
}
function factTask(q){return {id:q.id,kind:'fact',q,mode:'quiz'}}
// Gewoon oefenen: ook bij vragen zonder kaart alleen vragen over basis- en middelplekken.
function factPool(){
 if(challenge||!SET.kaart)return facts;
 const easy=facts.filter(q=>!q.itemId||(items.get(q.itemId)?.moeilijkheid||2)<=2);
 return easy.length?easy:facts;
}
function buildQueue(pool){
 const limit=questionLimit;
 if(pool)return shuffle(pool).map((x,i)=>x.question?factTask(x):{id:x.id,kind:'item',item:x,mode:modeFor(x,i)});
 if(!SET.kaart||mode==='quiz')return shuffle(factPool()).slice(0,limit).map(factTask);
 if(mode==='shuffle'&&facts.length){
  const chosen=pickItems(setItems,Math.max(1,Math.round(limit*.7)));
  const qs=shuffle(factPool()).slice(0,limit-chosen.length).map(factTask);
  return shuffle([...chosen.map((it,i)=>({id:it.id,kind:'item',item:it,mode:modeFor(it,i)})),...qs]);
 }
 // 'Wat mist er' en 'ingezoomd': de ronde bestaat uit plekken die daarvoor geschikt zijn.
 const geschikt=mode==='missing'||mode==='zoom'?setItems.filter(canMissing):setItems;
 return pickItems(geschikt.length?geschikt:setItems,limit).map((it,i)=>({id:it.id,kind:'item',item:it,mode:modeFor(it,i)}));
}
function start(pool){
 queue=buildQueue(pool);
 if(!queue.length){$('loading').classList.remove('hide');$('loading').innerHTML='<span class="sticker">OEPS!</span><h2>Geen vragen!</h2><p>Deze set heeft geen vragen voor deze vraagvorm. Kies een andere vorm.</p><p><a class="big" href="/topo/vo/?set='+encodeURIComponent(setId)+'">ANDERE KEUZE ↗</a></p>';return}
 index=0;stars=0;helpCount=0;peekCount=0;correctStreak=0;wrongStreak=0;wrongTapTimes=[];assisted=new Set();wrong=new Set();repeated=new Set();round++;
 document.body.classList.add('playing');document.body.classList.remove('keyboard-open');
 $('loading').classList.add('hide');$('end').classList.add('hide');$('game').classList.remove('hide');draw();
}
// ---------------------------------------------------------------- vraag tonen
function setKind(text){$('kind').textContent=current().revisit?'NOG EENS!':text}
function setPrompt(text){const h=$('prompt');h.textContent=text;h.classList.toggle('long',text.length>(currentMode==='quiz'?80:44));h.classList.toggle('xlong',text.length>150)}
function draw(){
 if(index>=queue.length){finish();return}
 hintStep=0;attempts=0;nearMiss=false;done=false;
 $('sub').classList.remove('answer-wrong');
 const task=current();currentMode=task.mode;
 const layout=document.querySelector('#game .game-grid');
 layout.dataset.mode=currentMode;layout.classList.toggle('shuffle-no-map',currentMode==='quiz');
 $('next').classList.add('hide');$('feedback').classList.add('hide');
 $('help').style.visibility=noHints?'hidden':'visible';$('help').textContent='Help me!';$('skip').style.visibility='visible';$('showAnswer').style.visibility=noHints?'hidden':'visible';$('answerOptions').innerHTML='';
 $('progressText').textContent=(index+1)+'/'+queue.length;$('missionName').textContent=(mode==='shuffle'?'TOPO SHUFFLE':'MISSIE '+round)+' · '+SET.titel.toUpperCase();
 $('progressFill').style.width=(100*index/queue.length)+'%';$('score').textContent='★ '+stars;
 if(currentMode==='quiz'){
  const q=task.q;$('map').innerHTML='';
  setKind(q.category==='begrippen'?'BEGRIP':'ZONDER KAART');
  setPrompt(q.question);$('sub').textContent='Kies het goede antwoord.'+(mode==='shuffle'&&index%3===0?' '+voice('shuffle'):'');
  $('mapHint').textContent='ZONDER KAART';
  $('answerOptions').innerHTML=shuffle(q.options).map(y=>'<button type="button" class="option" data-fact-choice="'+encodeURIComponent(y)+'">'+esc(y)+'</button>').join('');
  return;
 }
 const it=task.item,t=typ(it);
 $('map').innerHTML=mapSvg(currentMode==='zoom'?'zoomed':'',SET.titel);
 $('mapHint').textContent='KIJK OP DE KAART';
 if(currentMode==='point'){
  setKind('AANWIJZEN');setPrompt('Waar ligt '+withArticle(it)+'?');$('sub').textContent='Tik op de kaart!';$('mapHint').textContent='TIK OP DE KAART!';
 }else if(currentMode==='choice'||currentMode==='zoom'){
  setKind(currentMode==='zoom'?'INGEZOOMD':'KIEZEN');
  const others=currentMode==='zoom'?shuffle(pointItems(it).filter(o=>o.id!==it.id).sort((a,b)=>Math.hypot(pt(a)[0]-pt(it)[0],pt(a)[1]-pt(it)[1])-Math.hypot(pt(b)[0]-pt(it)[0],pt(b)[1]-pt(it)[1])).slice(0,6)).slice(0,3):distractors(it,3);
  const mixed=others.some(o=>o.type!==it.type);
  setPrompt(currentMode==='zoom'?(welk(mixed?FAMNAAM[fam(it)]||t:t)+' is omcirkeld?'):(welk(mixed?FAMNAAM[fam(it)]||t:t)+' is dit?'));
  $('sub').textContent=currentMode==='zoom'?'Kijk goed naar de ingezoomde kaart.'+(index%3===0?' '+voice('shuffle'):''):'Kies de naam.';
  if(currentMode==='zoom')$('mapHint').textContent='INGEZOOMD!';
  guessOptions=shuffle([it,...others]);
  $('answerOptions').innerHTML=guessOptions.map(y=>'<button type="button" class="option" data-option="'+esc(y.id)+'">'+esc(y.naam)+'</button>').join('');
 }else{
  setKind(currentMode==='missing'?'WAT MIST ER?':'TYPEN');
  setPrompt(currentMode==='missing'?welk(FAMNAAM[fam(it)]||t)+' mist er?':'Hoe heet '+ditDeze(t)+'?');
  $('sub').textContent=currentMode==='missing'?'Kijk naar de lege plek.':'Typ de naam.';$('mapHint').textContent='WELKE NAAM?';
  $('answerOptions').innerHTML='<form id="typeForm" autocomplete="off"><label class="type-label" for="typedAnswer">Jouw antwoord</label><input id="typedAnswer" class="typed" type="text" maxlength="80" autocapitalize="words" spellcheck="false" required placeholder="Typ hier..."><button class="type-submit" type="submit">CHECK! →</button></form>';
 }
 focusMap();requestAnimationFrame(focusMap);
}
function feedback(t,kind){
 const f=$('feedback');
 if(currentMode==='choice'||currentMode==='zoom'){f.className='feedback hide';$('sub').textContent=t;$('sub').classList.toggle('answer-wrong',kind==='bad');return}
 f.className='feedback '+(kind||'');f.textContent=t;
}
function queueAgain(task){
 if(task.revisit||repeated.has(task.id))return;
 repeated.add(task.id);
 const later=Math.min(index+4,queue.length);
 const again={...task,revisit:true};
 if(again.kind==='item'&&again.mode==='point')again.mode=modeFor(again.item,index+1)==='point'?'choice':modeFor(again.item,index+1);
 queue.splice(later,0,again);
}
function factNote(q){return q.note?' '+q.note:''}
// Vraag klaar: toetsenbordstand meteen sluiten, zodat VERDER! niet later nog verspringt.
function closeKeyboard(){$('typedAnswer')?.blur();if(document.body.classList.contains('keyboard-open')){document.body.classList.remove('keyboard-open');resize()}}
function answer(ok,extra){
 if(done)return;
 attempts++;
 const task=current();
 if(ok){
  done=true;
  const independent=attempts===1&&!assisted.has(task.id)&&!task.revisit;
  if(independent){stars++;correctStreak++}else{correctStreak=0;if(!task.revisit)wrong.add(task.id)}
  wrongStreak=0;$('score').textContent='★ '+stars;$('mapHint').textContent='GEVONDEN!';
  const phrase=correctStreak>=3?voice('goede_reeks'):voice('goed_antwoord');
  feedback((phrase||'Goed!')+(task.kind==='fact'?factNote(task.q):' '+naamZin(task.item))+(extra||''),'');
  closeKeyboard();$('next').classList.remove('hide');$('skip').style.visibility='hidden';$('help').style.visibility='hidden';
 }else{
  correctStreak=0;wrongStreak++;wrong.add(task.id);queueAgain(task);
  if(attempts>=2){
   done=true;
   feedback(task.kind==='fact'?'Het goede antwoord is '+task.q.answer+'.'+factNote(task.q):'Dit is '+task.item.naam+'. Deze komt straks terug!','neutral');
   closeKeyboard();$('next').classList.remove('hide');$('help').style.visibility='hidden';
  }else{
   const wild=wrongTapTimes.length>=4&&wrongTapTimes.at(-1)-wrongTapTimes.at(-4)<8000;
   const phrase=wild?voice('wild_klikken'):wrongStreak>=3?voice('veel_fouten'):voice('fout_antwoord');
   feedback((extra?extra+' ':'')+(phrase||'Nog eens!'),'bad');
  }
 }
 if(task.kind==='item')requestAnimationFrame(focusMap);
}
function naamZin(it){
 const f=it.feiten||{};
 if(f.provincie&&it.type!=='provincie')return it.naam+' ligt in '+f.provincie+'.';
 if(f.hoofdstad_van)return it.naam+' is de hoofdstad van '+f.hoofdstad_van+'.';
 if(f.deelstaat&&deelstaatNaam(f.deelstaat))return it.naam+' ligt in '+deelstaatNaam(f.deelstaat)+'.';
 if(f.regio&&it.land==='BRA')return it.naam+' ligt in de regio '+f.regio+'.';
 if(f.tweelingstad&&items.get(f.tweelingstad))return 'Tweelingstad: '+items.get(f.tweelingstad).naam+'.';
 if(f.hoogte_m)return it.naam+' is '+f.hoogte_m+' m hoog.';
 if(f.toelichting)return f.toelichting;
 return 'Dit is '+withArticle(it)+'.';
}
function deelstaatNaam(code){for(const it of items.values())if(it.type==='deelstaat'&&it.land==='BRA'&&it.feiten?.afkorting===code)return it.naam;return null}
// ---------------------------------------------------------------- invoer
function svgPoint(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
function tapResult(svg,x,y){
 const target=current().item,u=unitsPerPx(svg),kd=kindOf(target);
 const visible=setItems.filter(it=>sameFamily(it,target));
 if(kd==='point'){
  const dots=dotsFor(target);
  if(!dots.length)return {ok:Math.hypot(pt(target)[0]-x,pt(target)[1]-y)<=30*u};
  const cands=dots.map(it=>({it,d:Math.hypot(pt(it)[0]-x,pt(it)[1]-y)})).sort((a,b)=>a.d-b.d);
  const best=cands[0],own=cands.find(c=>c.it.id===target.id);
  // Twee stippen die bijna op elkaar liggen (Kinshasa en Brazzaville) zijn niet te onderscheiden: een bijna-gelijke tik telt goed.
  if(own&&own.d<=30*u&&own.d<=best.d+6*u)return {ok:true};
  return {ok:false,hit:best&&best.d<=30*u?best.it:null};
 }
 const s=shapeOf(target);
 if(kd==='area'){
  // Ook kleine landen en zeestraten: een tik op of vlak naast de vorm telt goed.
  if(inside(s,x,y)||edgeDist(s,x,y)<=9*u)return {ok:true};
  const other=visible.find(it=>it.id!==target.id&&kindOf(it)==='area'&&inside(shapeOf(it),x,y));
  return {ok:false,hit:other||null};
 }
 const lines=visible.filter(it=>kindOf(it)==='line').map(it=>({it,d:edgeDist(shapeOf(it),x,y)})).sort((a,b)=>a.d-b.d);
 const ownLine=lines.find(l=>l.it.id===target.id);
 if(ownLine&&ownLine.d<=18*u&&ownLine.d<=lines[0].d+6*u)return {ok:true};
 return {ok:false,hit:lines[0]&&lines[0].d<=18*u?lines[0].it:null};
}
$('map').addEventListener('click',e=>{
 if(currentMode!=='point'||done)return;
 const svg=$('map').querySelector('svg');if(!svg)return;
 const p=svgPoint(svg,e),r=tapResult(svg,p.x,p.y);
 if(!r.ok){wrongTapTimes.push(performance.now());if(wrongTapTimes.length>8)wrongTapTimes.shift()}
 answer(r.ok,r.ok?'':(r.hit?'Dat is '+r.hit.naam+'.':''));
});
$('answerOptions').addEventListener('click',e=>{
 const b=e.target.closest('[data-option],[data-fact-choice]');if(!b||done)return;
 const task=current();
 const ok=b.hasAttribute('data-fact-choice')?decodeURIComponent(b.dataset.factChoice)===task.q.answer:b.dataset.option===task.item.id;
 b.classList.add(ok?'good':'bad');answer(ok);
});
$('answerOptions').addEventListener('submit',e=>{
 if(e.target.id!=='typeForm')return;e.preventDefault();if(done)return;
 const it=current().item,v=tidy($('typedAnswer').value);
 submitLog.push(index+':'+v+'>'+tidy(it.naam));
 const names=[it.naam,...(it.alt||[])].map(tidy).filter(Boolean);
 if(names.includes(v)){answer(true);return}
 const close=names.some(n=>n.length>=5&&lev(v,n)<=(n.length>=9?2:1));
 if(close&&!nearMiss){nearMiss=true;feedback('Bijna! Check je spelling en probeer het nog eens.','neutral');$('typedAnswer').focus();$('typedAnswer').select();return}
 answer(false);
 if(!done){$('typedAnswer').focus();$('typedAnswer').select()}
});
$('answerOptions').addEventListener('focusin',e=>{if(e.target.matches('input')){document.body.classList.add('keyboard-open');resize()}});
// Wacht even met het weghalen van de toetsenbordstand, zodat een tik op CHECK! niet verspringt.
$('answerOptions').addEventListener('focusout',e=>{if(e.target.matches('input'))setTimeout(()=>{if(!document.activeElement?.matches?.('#answerOptions input')){document.body.classList.remove('keyboard-open');resize()}},220)});
// ---------------------------------------------------------------- hulp
function richting(from,to){
 const dx=pt(to)[0]-pt(from)[0],dy=pt(from)[1]-pt(to)[1],a=(Math.atan2(dy,dx)*180/Math.PI+360)%360;
 return ['ten oosten','ten noordoosten','ten noorden','ten noordwesten','ten westen','ten zuidwesten','ten zuiden','ten zuidoosten'][Math.round(a/45)%8];
}
function hintFor(task,step){
 if(task.kind==='fact'){
  const q=task.q;
  if(step===0){
   if(q.hint)return q.hint;
   if(q.begripId&&begrippen.get(q.begripId))return 'Dit begrip hoort bij het thema '+begrippen.get(q.begripId).thema+'.';
   const it=q.itemId&&items.get(q.itemId);if(it)return contextHint(it);
   return 'Streep eerst de antwoorden weg die zeker niet kloppen.';
  }
  return 'Gebruik de spiekkaart om het zelf uit te zoeken.';
 }
 const it=task.item;
 if(step===0)return contextHint(it);
 const others=setItems.filter(o=>o.id!==it.id&&tidy(o.naam)!==tidy(it.naam));
 others.sort((a,b)=>Math.hypot(pt(a)[0]-pt(it)[0],pt(a)[1]-pt(it)[1])-Math.hypot(pt(b)[0]-pt(it)[0],pt(b)[1]-pt(it)[1]));
 const near=others[0];if(!near)return null;
 return 'Zoek '+richting(near,it)+' van '+near.naam+'.';
}
function contextHint(it){
 const f=it.feiten||{},t=typ(it);
 if(f.provincie&&it.type!=='provincie')return 'Deze '+t[1]+' ligt in de provincie '+f.provincie+'.';
 if(f.deelstaat&&deelstaatNaam(f.deelstaat))return 'Deze '+t[1]+' ligt in de deelstaat '+deelstaatNaam(f.deelstaat)+'.';
 if(f.regio&&it.land==='BRA')return 'Deze ligt in de regio '+f.regio+' van Brazilië.';
 if(it.type==='land'&&it.subregio)return 'Dit land ligt in '+it.subregio+'.';
 if(f.land&&it.type!=='land')return 'Deze '+t[1]+' ligt in '+f.land+'.';
 if(it.subregio)return 'Kijk in '+it.subregio+'.';
 if(it.werelddeel&&it.type!=='werelddeel')return 'Kijk in '+it.werelddeel+'.';
 return 'Het is '+(t[0]==='het'?'een ':'een ')+t[1]+'.';
}
$('help').onclick=()=>{
 if(done||hintStep>=2||noHints)return;
 const task=current();let hint=hintFor(task,hintStep);
 const name=task.kind==='fact'?task.q.answer:task.item.naam;
 if(!hint||hint.toLocaleLowerCase('nl').includes(name.toLocaleLowerCase('nl'))){hint=hintStep===0?'Gebruik de spiekkaart als je vastzit.':null;if(!hint)return}
 hintStep++;helpCount++;assisted.add(task.id);wrong.add(task.id);queueAgain(task);
 feedback((voice('spieken_hints')||'Kleine hint dan.')+' '+hint,'neutral');$('mapHint').textContent='ZOEK MAAR!';
 $('help').textContent='Nog een hint?';if(hintStep>=2)$('help').style.visibility='hidden';
};
$('skip').onclick=()=>{
 const task=current();wrong.add(task.id);queueAgain(task);done=true;
 feedback(task.kind==='fact'?'Het goede antwoord is '+task.q.answer+'.':'Dit is '+task.item.naam+'. Deze komt terug!','neutral');
 closeKeyboard();$('next').classList.remove('hide');$('skip').style.visibility='hidden';
 if(task.kind==='item')requestAnimationFrame(focusMap);
};
$('next').onclick=()=>{if(!done)return;document.activeElement?.blur?.();index++;draw()};
// ---------------------------------------------------------------- einde
function finish(){
 document.body.classList.remove('playing','keyboard-open');
 $('game').classList.add('hide');$('end').classList.remove('hide');
 const firsts=queue.filter(x=>!x.revisit);
 $('endTitle').textContent=stars===firsts.length?(voice('bijnamen')||'KAARTBAAS!'):(voice('einde')||'LEKKER BEZIG!');
 $('endText').textContent=stars+' van '+firsts.length+' meteen goed, zonder hulp.';
 $('helpSummary').innerHTML='<span>TIPS '+helpCount+'×</span><span>SPIEKKAART '+peekCount+'×</span>';
 const missed=firsts.filter(x=>wrong.has(x.id));
 const label=x=>x.kind==='fact'?x.q.answer:x.item.naam;
 $('review').innerHTML=missed.length?'<strong>Deze nog eens:</strong>'+missed.map(x=>'<span>'+esc(label(x))+'</span>').join(''):'<span>Alles gevonden!</span>';
 retryPool=missed.length?missed.map(x=>x.kind==='fact'?x.q:x.item):null;
 $('retry').classList.toggle('hide',!retryPool);
}
$('again').onclick=()=>start();
$('retry').onclick=()=>{if(retryPool)start(retryPool)};
// ---------------------------------------------------------------- spiekkaart
function openSheet(){
 if(noHints)return;
 if(!$('game').classList.contains('hide')&&!done){const t=current();peekCount++;assisted.add(t.id);wrong.add(t.id);queueAgain(t)}
 const task=current();
 if(!SET.kaart){
  const list=SET.begrippen.map(id=>begrippen.get(id)).filter(Boolean);
  $('sheetTools').classList.add('hide');
  $('sheetCanvas').innerHTML='<dl class="glossary">'+list.map(b=>'<dt>'+esc(b.term)+'</dt><dd>'+esc(b.uitleg)+'</dd>').join('')+'</dl>';
 }else{
  $('sheetTools').classList.remove('hide');
  $('sheetCanvas').innerHTML=mapSvg('sheet','Spiekkaart '+SET.titel);
 }
 $('sheetLayer').classList.remove('hide');
 $('sheetNote').textContent=voice('spieken_hints')||'Kijk goed. Probeer het daarna zelf!';
 zoom=1;updateZoom();
 if(SET.kaart){
  const svg=$('sheetCanvas').querySelector('svg');
  const vb=task&&task.item?viewFor(task,'point'):[0,0,W,H];
  svg.setAttribute('viewBox',vb.map(fmt).join(' '));dynLayer(svg,{dots:setItems.filter(it=>kindOf(it)==='point'),labels:setItems});
 }
}
function updateZoom(){
 zoom=Math.max(1,Math.min(4,zoom));$('sheetCanvas').style.width=(zoom*100)+'%';$('zoomText').textContent=Math.round(zoom*100)+'%';
 const svg=$('sheetCanvas').querySelector('svg');if(svg&&!$('sheetLayer').classList.contains('hide'))dynLayer(svg,{dots:setItems.filter(it=>kindOf(it)==='point'),labels:setItems});
}
$('showAnswer').onclick=openSheet;
$('closeSheet').onclick=()=>{$('sheetLayer').classList.add('hide');$('showAnswer').focus()};
$('zoomIn').onclick=()=>{zoom+=.5;updateZoom()};
$('zoomOut').onclick=()=>{zoom-=.5;updateZoom()};
$('zoomFit').onclick=()=>{zoom=1;updateZoom()};
$('sheetLayer').onclick=e=>{if(e.target.id==='sheetLayer')$('closeSheet').click()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sheetLayer').classList.contains('hide'))$('closeSheet').click()});
function resize(){document.documentElement.style.setProperty('--vh',Math.round(window.visualViewport?.height||window.innerHeight)+'px');requestAnimationFrame(focusMap)}
window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);
resize();
// ---------------------------------------------------------------- laden
const getJSON=async path=>{const res=await fetch(DATA+path);if(!res.ok)throw Error('Kan bestand niet laden: '+path);return res.json()};
(async()=>{
 const sets=await getJSON('sets.json');
 SET=sets.sets.find(s=>s.id===setId);
 if(!SET)throw Error('Onbekende set');
 document.title=SET.titel+' | Let’s go TOPO! VO';
 $('back').href='/topo/vo/?set='+encodeURIComponent(SET.id);$('change').href=$('back').href;
 const needs=[...SET.bestanden];
 if(SET.kaart){setKaart(SET.kaart);if(SET.kaart==='wereld')needs.push('items/landen.json')}
 const [itemFiles,bundle,talk,begr]=await Promise.all([
  Promise.all([...new Set(needs)].map(getJSON)),
  SET.vragen?getJSON(SET.vragen).catch(e=>{if(mode==='quiz'||!SET.kaart)throw e;console.warn(e);return null}):null,
  getJSON('taalbank-vo.json').catch(e=>{console.warn(e);return null}),
  !SET.kaart?getJSON('begrippen.json').catch(()=>null):null
 ]);
 for(const f of itemFiles)for(const it of f.items)items.set(it.id,it);
 if(talk&&talk.total===50&&talk.uitspraak)topoTalk=talk.uitspraak;
 if(begr)for(const b of begr.begrippen)begrippen.set(b.id,b);
 facts=(bundle?.questions||[]).filter(q=>Array.isArray(q.options)&&q.options.length===4&&q.options.includes(q.answer));
 if(SET.kaart){
  setItems=SET.items.map(id=>items.get(id)).filter(it=>it&&(it.kaarten||[]).includes(SET.kaart));
  const files=new Set([K.basis,...(K.context||[])]);if(K.water)files.add(K.water);
  for(const it of setItems)if(it.geo)files.add(geoFile(it.geo.kaart));
  if(setItems.some(it=>it.type==='plaat'))files.add('kaarten/plaatgrenzen.geojson');
  if(setItems.some(it=>it.type==='meer'&&it.land!=='NLD'))files.add('kaarten/meren.geojson');
  const loaded=await Promise.all([...files].map(f=>getJSON(f).then(d=>[f,d])));
  for(const [f,d] of loaded)geo[f]=d;
  basisFeatures=geo[K.basis].features;contextFeatures=(K.context||[]).flatMap(f=>geo[f]?.features||[]);
  $('credits').textContent=kaartId==='nederland'?'Provinciegrenzen: CBS/PDOK · Water, wegen en spoor: Kadaster/PDOK BRT TOP10NL (CC BY 4.0) · Natural Earth · Oefenkaart, geen navigatiekaart':'Kaartdata: Natural Earth (publiek domein)'+(setItems.some(it=>it.type==='plaat')?' · Platen: PB2002, Bird (2003), ODC-By':'')+' · Oefenkaart, geen navigatiekaart';
 }
 if(params.get('test')==='1')window.__topoVo={task:()=>current(),targetScreen:()=>{const svg=$('map').querySelector('svg'),it=current().item,p=svg.createSVGPoint();let [x,y]=pt(it);const sh=shapeOf(it);
  if(sh&&sh.rings.length){const big=sh.rings.reduce((a,r)=>{const bb=boundsOf(r);const ar=(bb.right-bb.left)*(bb.bottom-bb.top);return ar>a[1]?[r,ar]:a},[null,-1])[0];const b=boundsOf(big);let best=null,bd=-1;
   for(let i=1;i<64;i++)for(let j=1;j<64;j++){const gx=b.left+(b.right-b.left)*i/64,gy=b.top+(b.bottom-b.top)*j/64;if(inside(sh,gx,gy)){const d=edgeDist(sh,gx,gy);if(d>bd){bd=d;best=[gx,gy]}}}
   if(best)[x,y]=best}
  else if(sh&&!sh.rings.length&&sh.lines.length){const l=sh.lines.reduce((a,b)=>b.length>a.length?b:a);[x,y]=l[Math.floor(l.length/2)]}
  p.x=x;p.y=y;const s=p.matrixTransform(svg.getScreenCTM());return {x:s.x,y:s.y}},mode:()=>currentMode,answer:()=>{const t=current();return t.kind==='fact'?t.q.answer:t.item.naam},queueLength:()=>queue.length,index:()=>index,state:()=>({index,attempts,nearMiss,done,mode:currentMode,revisit:Boolean(current()?.revisit),assisted:[...assisted],wrong:[...wrong],feedback:$('feedback').textContent,log:submitLog.slice(-6)})};
 start();
})().catch(err=>{
 console.error(err);$('loading').innerHTML='<span class="sticker">OEPS!</span><h2>Kaart even kwijt!</h2><p>De kaart of vragenbank kon niet laden. Probeer het opnieuw.</p><p><button class="big" onclick="location.reload()">OPNIEUW ↗</button></p>';
});
})();
