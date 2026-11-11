// Hartslaglab: een bestuurbaar vereenvoudigd 3D-model, geen medische patiëntsimulator.
// Alle grafieken, klepbewegingen, kamerbewegingen en stroomdeeltjes gebruiken dezelfde fase.
const $=id=>document.getElementById(id);
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const span=(t,a,b)=>ease((t-a)/(b-a));
const fmt=(v,n=0)=>Number(v).toLocaleString('nl-NL',{minimumFractionDigits:n,maximumFractionDigits:n});
const PHASES=[
  {id:'vulling',at:0,end:.52,title:'De kamers vullen zich',
   text:'Bloed stroomt vanuit de boezems naar de hartkamers. De kleppen tussen boezems en kamers zijn open; de slagaderkleppen blijven dicht.',
   hint:'Tijdens de vulling neemt het kamervolume toe. Bekijk de groene volumelijn.'},
  {id:'atria',at:.52,end:.64,title:'De boezems trekken samen',
   text:'De boezems persen het laatste bloed de kamers in. De AV-kleppen staan nog open. Aan het einde van deze fase zijn de kamers maximaal gevuld.',
   hint:'Kijk hoe het kamervolume nog iets stijgt. Daarna sluiten de AV-kleppen.'},
  {id:'isocontractie',at:.64,end:.70,title:'De kamerdruk stijgt',
   text:'De kamers beginnen samen te trekken. De AV-kleppen sluiten, maar de slagaderkleppen zijn nog dicht. De druk stijgt terwijl het kamervolume gelijk blijft.',
   hint:'Dit heet isovolumetrische contractie. De druk stijgt al voordat het bloed wordt uitgepompt.'},
  {id:'ejectie',at:.70,end:.93,title:'Bloed wordt uitgepompt',
   text:'De druk in de kamers wordt groot genoeg om de slagaderkleppen te openen. Bloed stroomt vanuit de rechterkamer naar de longen en vanuit de linkerkamer naar het lichaam.',
   hint:'Let op: het kamervolume daalt terwijl de druk hoog is. De AV-kleppen blijven dicht.'},
  {id:'relaxatie',at:.93,end:1,title:'De kamers ontspannen',
   text:'De slagaderkleppen sluiten en de kamers ontspannen. Beide klepsoorten zijn kort dicht. De druk daalt voordat de kamers opnieuw gaan vullen.',
   hint:'Dit heet isovolumetrische relaxatie: de druk daalt, maar het kamervolume blijft nog gelijk.'}
];
const state={t:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,speed:1,yaw:-.20,pitch:.08,zoom:5.95,selected:null,showLabels:true,showFlow:true,tab:'phase',rate:75,last:0,drag:null};
const phaseFor=t=>PHASES.findIndex((p,i)=>t>=p.at&&t<(i===PHASES.length-1?1:p.end));
function volume(t){
  if(t<.52)return lerp(60,116,span(t,0,.52));
  if(t<.64)return lerp(116,130,span(t,.52,.64));
  if(t<.70)return 130;
  if(t<.93)return lerp(130,60,span(t,.70,.93));
  return 60;
}
function pressure(t){
  if(t<.52)return lerp(5,8,span(t,0,.52));
  if(t<.64)return lerp(8,12,span(t,.52,.64));
  if(t<.70)return lerp(12,85,span(t,.64,.70));
  if(t<.76)return lerp(85,120,span(t,.70,.76));
  if(t<.88)return lerp(120,88,span(t,.76,.88));
  if(t<.93)return lerp(88,76,span(t,.88,.93));
  return lerp(76,5,span(t,.93,1));
}
function mechanics(t){
  const volumeFrac=(volume(t)-60)/70;
  const atriumShrink=t>=.52&&t<.64?1-.16*Math.sin(Math.PI*(t-.52)/.12):1;
  return {av:t<.64,sem:t>=.70&&t<.93,ventScale:.79+.21*volumeFrac,
    atriumScale:atriumShrink,pressure:pressure(t),volume:volume(t),phase:phaseFor(t)};
}
const m4=()=>{
  const o=new Float32Array(16);o[0]=o[5]=o[10]=o[15]=1;return o;
};
function mul(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function persp(fov,aspect,near,far){
  const o=new Float32Array(16),f=1/Math.tan(fov/2),nf=1/(near-far);
  o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scl=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((p,v,i)=>p+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>scl(a,1/(Math.hypot(...a)||1));
function lookAt(eye,target){
  const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x),o=m4();
  o[0]=x[0];o[1]=y[0];o[2]=z[0];o[4]=x[1];o[5]=y[1];o[6]=z[1];
  o[8]=x[2];o[9]=y[2];o[10]=z[2];o[12]=-dot(x,eye);o[13]=-dot(y,eye);o[14]=-dot(z,eye);return o;
}
function modelMatrix(pos,scale){
  const o=m4();o[0]=scale[0];o[5]=scale[1];o[10]=scale[2];
  o[12]=pos[0];o[13]=pos[1];o[14]=pos[2];return o;
}
function project(p,pv,w,h){
  const x=pv[0]*p[0]+pv[4]*p[1]+pv[8]*p[2]+pv[12];
  const y=pv[1]*p[0]+pv[5]*p[1]+pv[9]*p[2]+pv[13];
  const ww=pv[3]*p[0]+pv[7]*p[1]+pv[11]*p[2]+pv[15];
  return [w*(.5+x/(ww||1)*.5),h*(.5-y/(ww||1)*.5),ww];
}
function sphere(lat=19,lon=28){
  const v=[],n=[];
  const point=(a,b)=>{const y=Math.cos(a),r=Math.sin(a);return [r*Math.cos(b),y,r*Math.sin(b)];};
  const push=p=>{v.push(...p);n.push(...p);};
  for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
    const a=i*Math.PI/lat,b=j*TAU/lon,c=(i+1)*Math.PI/lat,d=(j+1)*TAU/lon;
    const p=point(a,b),q=point(c,b),r=point(c,d),s=point(a,d);
    push(p);push(q);push(r);push(p);push(r);push(s);
  }
  return {v:new Float32Array(v),n:new Float32Array(n),count:v.length/3};
}
function tube(path,radius=.095,segments=10){
  const v=[],n=[];
  function addVertex(p,nn){v.push(...p);n.push(...nn);}
  for(let k=0;k<path.length-1;k++){
    const a=path[k],b=path[k+1],direction=norm(sub(b,a));
    const radial=norm(cross(Math.abs(direction[1])>.95?[1,0,0]:[0,1,0],direction));
    const other=norm(cross(direction,radial));
    function vtx(p,theta){const normal=add(scl(radial,Math.cos(theta)),scl(other,Math.sin(theta)));return [add(p,scl(normal,radius)),normal];}
    for(let j=0;j<segments;j++){
      const ang=j*TAU/segments,next=(j+1)*TAU/segments;
      const A=vtx(a,ang),B=vtx(b,ang),C=vtx(b,next),D=vtx(a,next);
      [[A,B,C],[A,C,D]].forEach(tr=>tr.forEach(([p,nn])=>addVertex(p,nn)));
    }
  }
  return {v:new Float32Array(v),n:new Float32Array(n),count:v.length/3};
}
function valveLeaflets(open,semilunar){
  // Two bendable leaflets. Open: central points move off the ring plane.
  // The simplified geometry is not a surgical representation of a valve.
  const v=[],n=[],axis=semilunar?1:-1;
  for(const side of [-1,1]){
    const central=[side*open*.15,axis*.32*open,0];
    for(let j=0;j<12;j++){
      const t=j/12,u=(j+1)/12,theta1=(side===-1?Math.PI/2:Math.PI*1.5)+Math.PI*t;
      const theta2=(side===-1?Math.PI/2:Math.PI*1.5)+Math.PI*u;
      const p=[.30*Math.cos(theta1),0,.30*Math.sin(theta1)];
      const q=[.30*Math.cos(theta2),0,.30*Math.sin(theta2)];
      v.push(...central,...p,...q);n.push(0,1,0,0,1,0,0,1,0);
    }
  }
  return {v:new Float32Array(v),n:new Float32Array(n),count:v.length/3};
}
const SHAPES={
  ra:{pos:[-.57,.57,.36],scale:[.43,.39,.35],color:[.30,.66,.84],label:'Rechterboezem'},
  rv:{pos:[-.37,-.35,.23],scale:[.52,.71,.44],color:[.22,.52,.75],label:'Rechterkamer'},
  la:{pos:[.50,.56,-.22],scale:[.43,.37,.36],color:[.92,.54,.45],label:'Linkerboezem'},
  lv:{pos:[.34,-.38,-.24],scale:[.57,.77,.49],color:[.79,.34,.30],label:'Linkerkamer'}
};
const VESSELS=[
  {id:'ao',color:[.90,.45,.37],radius:.145,path:[[.38,.14,-.15],[.59,.47,-.17],[.72,1.18,-.17],[.40,1.57,-.40],[-.12,1.47,-.48],[-.42,1.06,-.55]],label:'Aorta'},
  {id:'pa',color:[.29,.69,.85],radius:.135,path:[[-.43,.10,.34],[-.69,.53,.42],[-.93,1.13,.33],[-1.31,1.20,.30]],label:'Longslagader'},
  {id:'svc',color:[.24,.54,.78],radius:.13,path:[[-.83,1.84,.36],[-.75,1.24,.35],[-.59,.70,.35]],label:'Bovenste holle ader'},
  {id:'ivc',color:[.24,.54,.78],radius:.115,path:[[-.84,-1.52,.36],[-.76,-.71,.42],[-.57,.41,.35]],label:'Onderste holle ader'},
  {id:'pv',color:[.93,.49,.42],radius:.115,path:[[1.46,.80,-.29],[1.04,.74,-.30],[.61,.60,-.21]],label:'Longaders'}
];
const VALVES=[
  {id:'tricuspid',pos:[-.44,.12,.30],type:'av',label:'Tricuspidalisklep'},
  {id:'mitral',pos:[.46,.12,-.22],type:'av',label:'Mitralisklep'},
  {id:'pulmonary',pos:[-.52,.35,.37],type:'sem',label:'Longslagaderklep'},
  {id:'aortic',pos:[.58,.37,-.17],type:'sem',label:'Aortaklep'}
];
const PARTS={
  ...Object.fromEntries(Object.entries(SHAPES).map(([id,v])=>[id,{pos:v.pos,label:v.label}])),
  ao:{pos:[.68,1.25,-.20],label:'Aorta'},pa:{pos:[-1.02,1.10,.34],label:'Longslagader'}
};
const COLORS={red:[.98,.63,.53],blue:[.47,.82,.98]};
const canvas=$('heartCanvas'),stage=$('stage');
let gl,program,pointProgram,meshes={},pv=m4(),loc={},ploc={},particleBuffer;
function compile(gl,type,src){const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
function shader(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function setupModel(){
  gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'default'})||canvas.getContext('experimental-webgl');
  if(!gl){$('modelUnavailable').hidden=false;return false;}
  program=shader(gl,'attribute vec3 position;attribute vec3 normal;uniform mat4 pv;uniform mat4 model;varying vec3 n;varying vec3 p;void main(){vec4 world=model*vec4(position,1.0);gl_Position=pv*world;n=normalize(mat3(model)*normal);p=world.xyz;}',
    'precision mediump float;varying vec3 n;varying vec3 p;uniform vec3 tint;uniform float alpha;void main(){vec3 light=normalize(vec3(-.44,.85,1.0));float a=max(dot(normalize(n),light),0.0);float rim=pow(1.0-abs(dot(normalize(n),normalize(vec3(.1,.15,.99)))),2.0);vec3 c=tint*(.33+.63*a)+vec3(.16,.22,.27)*rim;gl_FragColor=vec4(c,alpha);}');
  pointProgram=shader(gl,'attribute vec3 position;uniform mat4 pv;uniform float size;void main(){vec4 clip=pv*vec4(position,1.0);gl_Position=clip;gl_PointSize=size*clamp(5.0/clip.w,.7,2.4);}',
    'precision mediump float;uniform vec3 tint;void main(){vec2 v=gl_PointCoord-vec2(.5);float r=length(v);if(r>.5)discard;float shine=1.0-smoothstep(.10,.50,r);gl_FragColor=vec4(tint,shine*.87);}');
  for(const k of ['position','normal','pv','model','tint','alpha'])loc[k]=k==='position'||k==='normal'?gl.getAttribLocation(program,k):gl.getUniformLocation(program,k);
  for(const k of ['position','pv','size','tint'])ploc[k]=k==='position'?gl.getAttribLocation(pointProgram,k):gl.getUniformLocation(pointProgram,k);
  meshes.sphere=upload(sphere());
  VESSELS.forEach(v=>meshes[v.id]=upload(tube(v.path,v.radius)));
  particleBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.035,.076,.118,1);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gl=null;$('modelUnavailable').hidden=false;},{passive:false});
  canvas.addEventListener('webglcontextrestored',()=>{$('modelUnavailable').hidden=true;setupModel();});
  return true;
}
function upload(m){
  const vb=gl.createBuffer(),nb=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,m.v,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,m.n,gl.STATIC_DRAW);
  return {...m,vb,nb};
}
function drawMesh(mesh,model,color,alpha=1){
  gl.useProgram(program);gl.uniformMatrix4fv(loc.pv,false,pv);gl.uniformMatrix4fv(loc.model,false,model);
  gl.uniform3fv(loc.tint,color);gl.uniform1f(loc.alpha,alpha);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nb);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}
function pathPoint(path,t){
  const lengths=[];let total=0;
  for(let i=1;i<path.length;i++){const len=Math.hypot(...sub(path[i],path[i-1]));lengths.push(len);total+=len;}
  let d=clamp(t,0,1)*total;
  for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1)return add(path[i],scl(sub(path[i+1],path[i]),d/(lengths[i]||1)));d-=lengths[i];}
  return path[path.length-1];
}
const FLOW_PATHS=[
  {color:'blue',path:[[ -.85,1.7,.38],[-.58,.63,.40],[-.53,.27,.36],[-.37,-.36,.35]],active:()=>true,n:15},
  {color:'blue',path:[[-.30,-.49,.39],[-.51,.22,.41],[-.82,.72,.43],[-1.29,1.17,.30]],active:m=>m.sem,n:14},
  {color:'red',path:[[1.43,.8,-.27],[.54,.60,-.22],[.46,.20,-.17],[.32,-.49,-.15]],active:()=>true,n:16},
  {color:'red',path:[[.26,-.55,-.20],[.53,.23,-.13],[.68,1.15,-.12],[.47,1.58,-.35],[-.37,1.12,-.47]],active:m=>m.sem,n:16}
];
function drawParticles(m){
  if(!state.showFlow)return;
  const batches={red:[],blue:[]};
  for(const flow of FLOW_PATHS){
    if(!flow.active(m))continue;
    for(let i=0;i<flow.n;i++){
      const progress=(i/flow.n+state.t*(flow.active(m)&&m.sem?2.5:1.25))%1;
      const point=pathPoint(flow.path,progress);
      batches[flow.color].push(...point);
    }
  }
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(pointProgram);
  gl.uniformMatrix4fv(ploc.pv,false,pv);gl.uniform1f(ploc.size,7.5*Math.min(devicePixelRatio||1,2));
  for(const name of ['blue','red']){
    const arr=batches[name];if(!arr.length)continue;
    gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(ploc.position);gl.vertexAttribPointer(ploc.position,3,gl.FLOAT,false,0,0);
    gl.uniform3fv(ploc.tint,COLORS[name]);gl.drawArrays(gl.POINTS,0,arr.length/3);
  }
  gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
}
function updateViewport(){
  const w=Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2)),h=Math.round(canvas.clientHeight*Math.min(devicePixelRatio||1,2));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  if(gl)gl.viewport(0,0,w,h);
  const eye=[Math.sin(state.yaw)*Math.cos(state.pitch)*state.zoom,Math.sin(state.pitch)*state.zoom+.17,Math.cos(state.yaw)*Math.cos(state.pitch)*state.zoom];
  pv=mul(persp(42*Math.PI/180,Math.max(.5,w/Math.max(h,1)),.1,100),lookAt(eye,[0,.12,0]));
}
function drawScene(m){
  if(!gl)return;
  updateViewport();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.depthMask(true);
  for(const v of VESSELS)drawMesh(meshes[v.id],m4(),v.color,.96);
  // Klepbladen bewegen zichtbaar met de open/dicht-status.
  for(const v of VALVES){
    const open=v.type==='av'?m.av:m.sem;
    const leaves=upload(valveLeaflets(open,v.type==='sem'));
    drawMesh(leaves,modelMatrix(v.pos,[.78,.78,.78]),open?[.75,.91,.85]:[.96,.78,.58],.95);
    gl.deleteBuffer(leaves.vb);gl.deleteBuffer(leaves.nb);
  }
  // Kamers veranderen daadwerkelijk van 3D-volume. Geen vlakke video.
  gl.depthMask(false);
  for(const [id,part] of Object.entries(SHAPES)){
    const isVentricle=id==='rv'||id==='lv';
    const scaleFactor=isVentricle?m.ventScale:m.atriumScale;
    const scale=part.scale.map((v,i)=>v*(i===1?scaleFactor:Math.sqrt(scaleFactor)));
    const color=state.selected===id?part.color.map(c=>Math.min(1,c*1.35)):part.color;
    drawMesh(meshes.sphere,modelMatrix(part.pos,scale),color,state.selected===id?.83:.58);
  }
  gl.depthMask(true);drawParticles(m);
  updateLabels();
}
function updateLabels(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  for(const el of $('labels').children){
    const part=PARTS[el.dataset.part],position=project(part.pos,pv,w,h);
    el.style.left=clamp(position[0],48,w-48)+'px';el.style.top=clamp(position[1],33,h-30)+'px';
    el.hidden=!state.showLabels||position[2]<=0;
    el.classList.toggle('active',state.selected===el.dataset.part);
  }
}
function selectedPartAt(x,y){
  let best=null,score=50;
  for(const [id,part] of Object.entries(PARTS)){
    const p=project(part.pos,pv,canvas.clientWidth,canvas.clientHeight);
    const dist=Math.hypot(p[0]-x,p[1]-y);
    if(p[2]>0&&dist<score){best=id;score=dist;}
  }
  return best;
}
function positionInfo(id){
  state.selected=id;
  const label=PARTS[id]?.label;
  $('partInfo').textContent=label?label+' geselecteerd. Volg hoe dit deel tijdens de hartslag verandert.':'Sleep om het hart te draaien. Kies een onderdeel om het te onderzoeken.';
}
function drawChart(id,fn,color,max,unit){
  const canvas=$(id),dpr=Math.min(devicePixelRatio||1,2),width=canvas.clientWidth,height=canvas.clientHeight;
  const W=Math.max(160,Math.round(width*dpr)),H=Math.max(100,Math.round(height*dpr));
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const x0=33,x1=width-12,y0=12,y1=height-25,ww=x1-x0,hh=y1-y0;
  ctx.lineWidth=1;ctx.strokeStyle='rgba(96,128,147,.20)';
  for(let j=0;j<=4;j++){const y=y0+j*hh/4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();}
  [0,.52,.64,.70,.93,1].forEach(t=>{const x=x0+t*ww;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);ctx.stroke();});
  ctx.fillStyle='#819cac';ctx.font='10px system-ui';
  for(let j=0;j<=3;j++){const value=Math.round(max*(3-j)/3);ctx.fillText(String(value),2,y0+j*hh/3+3);}
  ctx.fillText('0',x0,y1+15);ctx.fillText(fmt(60/state.rate,2)+' s',x1-32,y1+15);
  ctx.beginPath();
  for(let i=0;i<=220;i++){const t=i/220,x=x0+t*ww,y=y1-clamp(fn(t)/max,0,1)*hh;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.stroke();
  const mx=x0+state.t*ww,my=y1-clamp(fn(state.t)/max,0,1)*hh;
  ctx.strokeStyle='#e0eae9';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(mx,y0);ctx.lineTo(mx,y1);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(mx,my,4.2,0,TAU);ctx.fill();
  ctx.strokeStyle='#0b1828';ctx.lineWidth=1;ctx.stroke();
}
function display(m){
  const phase=PHASES[m.phase];const prev=Number($('phaseNumber').dataset.index||-1);
  if(prev!==m.phase){
    $('phaseNumber').textContent='FASE '+String(m.phase+1).padStart(2,'0')+' / 05';
    $('phaseNumber').dataset.index=String(m.phase);
    $('phaseTitle').textContent=phase.title;
    $('phaseText').textContent=phase.text;
    $('phaseHint').textContent=phase.hint;
  }
  $('phaseIndex').innerHTML=String(m.phase+1).padStart(2,'0')+' <small>/ 05</small>';
  $('avStatus').textContent=m.av?'Open':'Gesloten';
  $('slStatus').textContent=m.sem?'Open':'Gesloten';
  $('pressureMetric').innerHTML=fmt(m.pressure)+' <small>mmHg</small>';
  $('volumeMetric').innerHTML=fmt(m.volume)+' <small>ml</small>';
  $('pressureTop').innerHTML=fmt(m.pressure)+' <small>mmHg</small>';
  $('volumeTop').innerHTML=fmt(m.volume)+' <small>ml</small>';
  $('timeOutput').textContent=fmt(state.t*60/state.rate,2)+' s';
  $('cycleMetric').innerHTML=fmt(60/state.rate,2)+' <small>s</small>';
  $('scrub').value=Math.round(state.t*1000);
  $('scrub').style.setProperty('--progress',(state.t*100).toFixed(1)+'%');
  $('timeline').querySelectorAll('[data-phase]').forEach(btn=>{const on=Number(btn.dataset.phase)===m.phase;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));});
  drawChart('pressureChart',pressure,'#ed9a80',130,'mmHg');
  drawChart('volumeChart',volume,'#7ecdbb',150,'ml');
}
function render(){const m=mechanics(state.t);drawScene(m);display(m);}
function setTime(t,autopause=false){state.t=(t%1+1)%1;if(autopause)state.playing=false;syncPlay();render();}
function syncPlay(){$('play').textContent=state.playing?'Pauze':'Start';$('play').setAttribute('aria-label',state.playing?'Pauzeer de hartslag':'Start de hartslag');}
$('play').addEventListener('click',()=>{state.playing=!state.playing;syncPlay();});
$('prevPhase').addEventListener('click',()=>{let i=phaseFor(state.t);if(Math.abs(state.t-PHASES[i].at)<.012)i=(i+PHASES.length-1)%PHASES.length;setTime(PHASES[i].at,true);});
$('nextPhase').addEventListener('click',()=>setTime(PHASES[(phaseFor(state.t)+1)%PHASES.length].at,true));
$('scrub').addEventListener('input',e=>setTime(Number(e.target.value)/1000,true));
$('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);});
$('timeline').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>setTime(PHASES[Number(btn.dataset.phase)].at,true)));
$('labelsToggle').addEventListener('click',()=>{state.showLabels=!state.showLabels;$('labelsToggle').textContent=state.showLabels?'Namen aan':'Namen uit';$('labelsToggle').setAttribute('aria-pressed',String(state.showLabels));});
$('flowToggle').addEventListener('click',()=>{state.showFlow=!state.showFlow;$('flowToggle').textContent=state.showFlow?'Bloedstroom aan':'Bloedstroom uit';$('flowToggle').setAttribute('aria-pressed',String(state.showFlow));});
$('resetCamera').addEventListener('click',()=>{state.yaw=-.20;state.pitch=.08;state.zoom=5.95;positionInfo(null);});
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  state.tab=btn.dataset.tab;
  for(const tab of document.querySelectorAll('[data-tab]')){const active=tab===btn;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  const table={phase:'tabPhase',explore:'tabExplore',sources:'tabSources'};
  Object.entries(table).forEach(([key,id])=>{$(id).hidden=key!==state.tab;});
}));
$('checkPrediction').addEventListener('click',()=>{
  const answer=document.querySelector('input[name=prediction]:checked');
  if(!answer){$('predictionFeedback').textContent='Kies eerst wat je verwacht.';return;}
  const correct=answer.value==='av';
  $('predictionFeedback').textContent=(correct?'Dat klopt. ':'Dat gebeurt anders. ')+'De AV-kleppen sluiten bij het begin van de kamersamentrekking. De slagaderkleppen openen pas nadat de kamerdruk hoog genoeg is geworden.';
  setTime(.655,true);
});
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'&&e.isPrimary===false)return;
  state.drag={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,moved:false};
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!state.drag)return;
  const dx=e.clientX-state.drag.x,dy=e.clientY-state.drag.y;
  if(Math.hypot(dx,dy)>5)state.drag.moved=true;
  state.yaw=state.drag.yaw+dx*.008;
  state.pitch=clamp(state.drag.pitch+dy*.007,-1.1,1.1);
});
canvas.addEventListener('pointerup',e=>{
  if(!state.drag)return;
  if(!state.drag.moved){const r=canvas.getBoundingClientRect();positionInfo(selectedPartAt(e.clientX-r.left,e.clientY-r.top));}
  state.drag=null;
});
canvas.addEventListener('pointercancel',()=>{state.drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(e.deltaY*.001),3.5,9.5);},{passive:false});
canvas.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();
    if(e.key==='ArrowLeft')state.yaw-=.12;
    if(e.key==='ArrowRight')state.yaw+=.12;
    if(e.key==='ArrowUp')state.pitch=clamp(state.pitch-.1,-1.1,1.1);
    if(e.key==='ArrowDown')state.pitch=clamp(state.pitch+.1,-1.1,1.1);
  }
});
canvas.tabIndex=0;
canvas.addEventListener('touchstart',e=>{if(e.touches.length===2){state.drag=null;const a=e.touches[0],b=e.touches[1];state.pinch=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}}, {passive:true});
canvas.addEventListener('touchmove',e=>{if(e.touches.length===2&&state.pinch){const a=e.touches[0],b=e.touches[1],next=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);state.zoom=clamp(state.zoom*state.pinch/Math.max(next,1),3.5,9.5);state.pinch=next;}},{passive:true});
canvas.addEventListener('touchend',()=>{state.pinch=null;});
let resize=new ResizeObserver(()=>{if(gl)render();});resize.observe(stage);
setupModel();syncPlay();
window.__EAI_HEART_LAB__={
  get state(){return {t:state.t,playing:state.playing,speed:state.speed,yaw:state.yaw,zoom:state.zoom,selected:state.selected};},
  get metrics(){return mechanics(state.t);},
  setTime:t=>setTime(t,true),pause:()=>{state.playing=false;syncPlay();},
  get rendererReady(){return Boolean(gl);}
};
function frame(now){
  const dt=state.last?Math.min((now-state.last)/1000,.065):0;state.last=now;
  if(state.playing)state.t=(state.t+dt*state.speed*state.rate/60)%1;
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
