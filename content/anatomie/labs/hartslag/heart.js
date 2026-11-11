// Hartslaglab: een bestuurbaar vereenvoudigd 3D-model, geen medische patiëntsimulator.
// Alle grafieken, klepbewegingen, kamerbewegingen en stroomdeeltjes gebruiken dezelfde fase.
import {PHASES,volume,pressure,mechanics,phaseFor} from './cycle.js';
import {CHAMBERS,VESSELS,VALVES,ANATOMY_PARTS,FLOW_PATHS,leafletGeometry,chamberGeometry,tubeGeometry,ringGeometry,septumGeometry,heartEnvelopeGeometry,muscleRidges,TENDINOUS_CORDS,CORONARY_DETAILS,MUSCLE_DETAILS,AURICLES} from './anatomyGeometry.js';
const $=id=>document.getElementById(id);
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const span=(t,a,b)=>ease((t-a)/(b-a));
const fmt=(v,n=0)=>Number(v).toLocaleString('nl-NL',{minimumFractionDigits:n,maximumFractionDigits:n});
const state={cutaway:false,t:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,speed:1,yaw:-.20,pitch:.08,zoom:5.95,selected:null,showLabels:!matchMedia('(max-width: 790px)').matches,showFlow:true,tab:'phase',rate:75,last:0,drag:null};
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
const COLORS={red:[.98,.63,.53],blue:[.47,.82,.98]};
const canvas=$('heartCanvas'),stage=$('stage');
let gl,program,pointProgram,meshes={},pv=m4(),loc={},ploc={},particleBuffer;
let atlasParts=[],atlasCenters={},atlasDetails={},atlasReady=false,atlasError=null;
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
  meshes.chambers={};
  for(const [id,part] of Object.entries(CHAMBERS)){
    const geometry=chamberGeometry(part);
    meshes.chambers[id]=Object.fromEntries(Object.entries(geometry).map(([name,data])=>[name,upload(data)]));
  }
  meshes.septum=upload(septumGeometry());
  meshes.envelope=upload(heartEnvelopeGeometry());
  meshes.ridges={};
  for(const [id,part] of Object.entries(CHAMBERS))
    meshes.ridges[id]=muscleRidges(part).map(r=>({mesh:upload(tubeGeometry(r.path,r.radius)),color:r.color}));
  meshes.cords=TENDINOUS_CORDS.map(c=>upload(tubeGeometry(c.path,.006,8)));
  meshes.coronary=CORONARY_DETAILS.map(v=>({mesh:upload(tubeGeometry(v.path,v.radius,9)),color:v.color,id:v.id}));
  meshes.papillary=MUSCLE_DETAILS.map(v=>({mesh:upload(tubeGeometry(v.path,v.radius,14)),color:v.color,id:v.id}));
  meshes.auricles=AURICLES.map(v=>({mesh:upload(tubeGeometry(v.path,v.radius,13)),color:v.color,id:v.id}));
  meshes.vessels={};
  VESSELS.forEach(v=>{meshes.vessels[v.id]=upload(tubeGeometry(v.path,v.radius));});
  meshes.valves={};
  for(const v of VALVES){
    meshes.valves[v.id]={leaflets:upload(leafletGeometry(v,0)),rim:upload(ringGeometry(v.type==='sem'?.18:.23,.022))};
  }
  particleBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.035,.076,.118,1);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gl=null;$('modelUnavailable').hidden=false;},{passive:false});
  canvas.addEventListener('webglcontextrestored',()=>{$('modelUnavailable').hidden=true;atlasReady=false;atlasParts=[];setupModel();loadAtlasModels();});
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
function drawParticles(m){
  if(!state.showFlow)return;
  const batches={red:[],blue:[]};
  for(const flow of FLOW_PATHS){
    const open=flow.channel==='return'||(flow.channel==='av'&&m.av)||(flow.channel==='sem'&&m.sem);
    if(!open)continue;
    for(let i=0;i<flow.n;i++){
      const progress=(i/flow.n+state.t*(flow.channel==='sem'?2.5:1.25))%1;
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
// De anatomische buitenvorm wordt tijdens de sitebuild uit de bestaande GLB
// gehaald. De browser heeft geen externe 3D-engine of Draco-decoder nodig.
async function loadAtlasModels(){
  if(!gl)return;
  try{
    const manifestResponse=await fetch('./atlas-heart.json');
    if(!manifestResponse.ok)throw Error('Hartmesh-manifest ontbreekt');
    const manifest=await manifestResponse.json();
    if(manifest.format!==1||!Array.isArray(manifest.parts)||manifest.parts.length<4)
      throw Error('Onvolledig hartmesh-manifest');
    const bufferResponse=await fetch('./atlas-heart.bin');
    if(!bufferResponse.ok)throw Error('Hartmesh-bestand ontbreekt');
    const buffer=await bufferResponse.arrayBuffer();
    if(buffer.byteLength!==manifest.bytes)throw Error('Hartmesh is niet volledig');
    const loaded=[];
    const centers={},details={};
    for(const part of manifest.parts){
      if(!Number.isInteger(part.count)||part.count<=0)throw Error('Ongeldige mesh: '+part.id);
      const size=part.count*3;
      const v=new Float32Array(buffer,part.positionOffset,size);
      const n=new Float32Array(buffer,part.normalOffset,size);
      if(!Array.isArray(part.center)||part.center.length!==3)throw Error('Meshcentrum ontbreekt');
      loaded.push({id:part.id,kind:part.kind,color:part.color,mesh:upload({v,n,count:part.count})});
      centers[part.id]=part.center;
      details[part.id]={label:part.label,pos:part.center,type:part.kind};
    }
    atlasParts=loaded;atlasCenters=centers;atlasDetails=details;atlasReady=true;atlasError=null;
    $('modelCaption').textContent='3D · Anatomische hartvorm · Atlasmodel';
    if(!state.cutaway)positionInfo(null);
  }catch(error){
    atlasError=String(error.message||error);
    atlasReady=false;
    // Ook zonder het atlasbestand blijft de bewegende doorsnede bruikbaar.
    state.cutaway=true;
    $('sectionToggle').textContent='Doorsnede aan';
    $('sectionToggle').setAttribute('aria-pressed','true');
    $('modelCaption').textContent='3D · Bewegende doorsnede · Schematisch';
    $('partInfo').textContent='Het anatomische buitenmodel kon niet worden geladen. De bewegende doorsnede blijft beschikbaar.';
    console.error('Hartslaglab atlasmesh:',atlasError);
  }
}
function drawAtlasHeart(m){
  for(const part of atlasParts){
    const factor=part.kind==='chamber'?
      (part.id==='lv'||part.id==='rv'?1+.08*(m.ventScale-1):1+.08*(m.atriumScale-1)):1;
    const model=modelMatrix([0,0,0],[factor,factor,factor]);
    const color=state.selected===part.id?[.98,.75,.56]:part.color;
    drawMesh(part.mesh,model,color,1);
  }
}
function drawScene(m){
  if(!gl)return;
  updateViewport();
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.depthMask(true);
  if(!state.cutaway&&atlasReady){
    drawAtlasHeart(m);
    updateLabels();
    return;
  }
  // Vaten achter het zichtbare myocard, maar met een herkenbaar doorlopend verloop.
  for(const vessel of VESSELS)
    drawMesh(meshes.vessels[vessel.id],m4(),vessel.color,1);

  // Een doorlopende spierwand verbindt de hartkamers tot één orgaan.
  // De brede opening laat de inwendige holtes zichtbaar.
  drawMesh(meshes.envelope,m4(),[.65,.31,.29],1);
  // Hartoren vormen de gekartelde uitlopers van de boezems.
  for(const auricle of meshes.auricles)drawMesh(auricle.mesh,m4(),state.selected===auricle.id?[.96,.66,.50]:auricle.color,1);

  // Vier holtes met een echte open voorzijde, spierwand en inwendige bekleding.
  // De kamergeometrie wordt per hartfase opgeschaald. Dit is een didactische
  // vervorming en geen simulatie van alle vezelrichtingen van het myocard.
  for(const [id,part] of Object.entries(CHAMBERS)){
    const isVentricle=part.kind==='ventricle';
    const factor=isVentricle?m.ventScale:m.atriumScale;
    const scale=part.scale.map((v,i)=>v*(i===1?factor:Math.sqrt(factor)));
    const model=modelMatrix(part.pos,scale);
    const hit=state.selected===id;
    // Van buiten zie je één hartwand, niet vier losse ellipsoïden.
    if(!state.cutaway)continue;
    drawMesh(meshes.chambers[id].outer,model,hit?[.95,.61,.51]:part.muscle,1);
    drawMesh(meshes.chambers[id].inner,model,part.blood,1);
    drawMesh(meshes.chambers[id].rim,model,hit?[1,.78,.62]:[.94,.63,.54],1);
    for(const ridge of meshes.ridges[id])drawMesh(ridge.mesh,model,ridge.color,.96);
  }
  // Kransvaten en de grote hartader liggen op het epicard.
  for(const vessel of meshes.coronary)drawMesh(vessel.mesh,m4(),state.selected===vessel.id?[.98,.75,.52]:vessel.color,1);
  if(state.cutaway){
    for(const papillary of meshes.papillary)drawMesh(papillary.mesh,m4(),state.selected===papillary.id?[.98,.71,.54]:papillary.color,1);
    drawMesh(meshes.septum,m4(),[.91,.59,.52],1);
    for(const chord of meshes.cords)drawMesh(chord,m4(),[.96,.85,.70],1);
    // Klepbladen zijn geen statische stippen: twee bij mitralis, drie bij
    // tricuspidalis en drie bij elk van de halvemaanvormige kleppen.
    for(const valve of VALVES){
      const active=valve.type==='av'?m.av:m.sem;
      const aperture=valve.type==='av'?m.avOpening:m.semOpening;
      const mesh=meshes.valves[valve.id].leaflets;
      const leaves=leafletGeometry(valve,aperture);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.bufferSubData(gl.ARRAY_BUFFER,0,leaves.v);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nb);gl.bufferSubData(gl.ARRAY_BUFFER,0,leaves.n);
      drawMesh(meshes.valves[valve.id].rim,modelMatrix(valve.pos,[1,1,1]),[.96,.75,.59],1);
      drawMesh(mesh,modelMatrix(valve.pos,[1,1,1]),active?[.91,.90,.71]:[.96,.69,.53],1);
    }
  }
  gl.depthMask(true);
  drawParticles(m);
  updateLabels();
}
const labelConnectors=new Map();
function updateLabels(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(w<1||h<1)return;
  const svg=$('labelLeaders');
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  const groups={left:[],right:[]};
  const leftIds=new Set(['ra','rv','pa']);
  for(const el of $('labels').children){
    const id=el.dataset.part,part=ANATOMY_PARTS[id];
    if(!part)continue;
    const world=!state.cutaway&&atlasCenters[id]?atlasCenters[id]:part.pos;
    const p=project(world,pv,w,h);
    const visible=state.showLabels&&p[2]>0&&p[0]>-25&&p[0]<w+25;
    el.hidden=!visible;
    let connector=labelConnectors.get(id);
    if(!connector){
      const ns='http://www.w3.org/2000/svg';
      const path=document.createElementNS(ns,'path');
      const dot=document.createElementNS(ns,'circle');
      path.classList.add('leader-path');
      dot.classList.add('leader-dot');
      svg.append(path,dot);
      connector={path,dot};
      labelConnectors.set(id,connector);
    }
    connector.path.hidden=connector.dot.hidden=!visible;
    if(!visible)continue;
    const side=leftIds.has(id)?'left':'right';
    groups[side].push({el,id,p,connector,wanted:clamp(p[1],54,h-68)});
  }
  const labelMargin=w>660?Math.min(190,w*.21):13;
  for(const side of ['left','right']){
    const entries=groups[side].sort((a,b)=>a.wanted-b.wanted);
    let y=51;
    for(const entry of entries){
      entry.y=Math.max(y,entry.wanted);
      y=entry.y+38;
    }
    if(entries.length&&y-38>h-62){
      let difference=y-38-(h-62);
      for(let i=entries.length-1;i>=0;i--){
        entries[i].y=Math.max(48,entries[i].y-difference);
        difference=Math.max(0,(i?entries[i-1].y+38-entries[i].y:0));
      }
    }
    for(const entry of entries){
      const {el,id,p,connector}=entry;
      el.style.left=(side==='left'?labelMargin:w-labelMargin)+'px';
      el.style.top=entry.y+'px';
      el.style.transform=side==='left'?'translateY(-50%)':'translate(-100%,-50%)';
      el.classList.toggle('active',state.selected===id);
      const width=el.offsetWidth;
      const targetX=side==='left'?labelMargin+width+7:w-labelMargin-width-7;
      const midX=p[0]+(targetX-p[0])*.57;
      connector.path.setAttribute('d','M '+p[0].toFixed(1)+' '+p[1].toFixed(1)+
        ' L '+midX.toFixed(1)+' '+p[1].toFixed(1)+
        ' L '+targetX.toFixed(1)+' '+entry.y.toFixed(1));
      connector.dot.setAttribute('cx',p[0].toFixed(1));
      connector.dot.setAttribute('cy',p[1].toFixed(1));
      connector.dot.setAttribute('r',state.selected===id?'3.2':'2.2');
      connector.path.classList.toggle('active',state.selected===id);
      connector.dot.classList.toggle('active',state.selected===id);
    }
  }
}

function selectedPartAt(x,y){
  let best=null,score=55;
  const available=!state.cutaway&&atlasReady?atlasDetails:ANATOMY_PARTS;
  for(const [id,part] of Object.entries(available)){
    const world=part.pos;
    const p=project(world,pv,canvas.clientWidth,canvas.clientHeight);
    const dist=Math.hypot(p[0]-x,p[1]-y);
    const limit=['artery','vein','papillary','auricle'].includes(part.type)?27:55;
    if(p[2]>0&&dist<limit&&dist<score){best=id;score=dist;}
  }
  return best;
}
function positionInfo(id){
  state.selected=id;
  const part=(!state.cutaway&&atlasReady?atlasDetails:ANATOMY_PARTS)[id];
  if(!part){
    $('partInfo').textContent=state.cutaway?
      'Sleep om het hart te draaien. Tik op een onderdeel om het te onderzoeken.':
      'Draai het hart met je vinger. Kies Doorsnede om de hartslag van binnen te bekijken.';
    return;
  }
  if(part.type==='valve'){
    const v=VALVES.find(v=>v.id===id),m=mechanics(state.t);
    if(!v){
      $('partInfo').textContent=part.label+' · Onderdeel van de anatomische klep. Bekijk Doorsnede voor de beweging tijdens één hartslag.';
      return;
    }
    const open=v.type==='av'?m.av:m.sem;
    $('partInfo').textContent=part.label+' · '+(open?'open':'gesloten')+'. Let op de klepbladen en de stroomrichting.';
    return;
  }
  if(part.type==='artery'||part.type==='vein'||part.type==='papillary'||part.type==='auricle'){
    const explanation={
      artery:'Kransslagaders voorzien de hartspier van zuurstofrijk bloed.',
      vein:'Hartaders voeren zuurstofarm bloed uit de hartspier terug.',
      papillary:'Deze spier houdt via peesdraden de AV-klepbladen tegen bij het samentrekken.',
      auricle:'Een uitloper van de boezem. De vorm is hier schematisch weergegeven.'
    };
    $('partInfo').textContent=part.label+' · '+explanation[part.type];
    return;
  }
  const extra=id==='lv'?'De dikke spierwand perst bloed naar de aorta.':
    id==='rv'?'Deze kamer pompt bloed naar de longslagader.':
    id==='septum'?'Het tussenschot houdt beide kamers gescheiden.':
    id==='ao'?'Voert zuurstofrijk bloed naar het lichaam.':
    id==='pa'?'Voert zuurstofarm bloed naar de longen.':'Volg dit deel tijdens één hartslag.';
  $('partInfo').textContent=part.label+' · '+extra;
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
function focusActivePhase(){
  if(!matchMedia('(max-width: 790px)').matches)return;
  const bar=$('timeline');
  const btn=bar.querySelector('[data-phase="'+phaseFor(state.t)+'"]');
  if(!btn)return;
  const area=bar.getBoundingClientRect(),item=btn.getBoundingClientRect();
  if(item.left<area.left+6||item.right>area.right-6){
    bar.scrollLeft+=item.left-area.left-12;
  }
}
function setTime(t,autopause=false){
  state.t=(t%1+1)%1;
  if(autopause)state.playing=false;
  syncPlay();
  render();
  if(autopause)focusActivePhase();
}
function syncPlay(){$('play').textContent=state.playing?'Pauze':'Start';$('play').setAttribute('aria-label',state.playing?'Pauzeer de hartslag':'Start de hartslag');}
$('play').addEventListener('click',()=>{state.playing=!state.playing;syncPlay();});
$('prevPhase').addEventListener('click',()=>{let i=phaseFor(state.t);if(Math.abs(state.t-PHASES[i].at)<.012)i=(i+PHASES.length-1)%PHASES.length;setTime(PHASES[i].at,true);});
$('nextPhase').addEventListener('click',()=>setTime(PHASES[(phaseFor(state.t)+1)%PHASES.length].at,true));
$('scrub').addEventListener('input',e=>setTime(Number(e.target.value)/1000,true));
$('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);});
$('timeline').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>setTime(PHASES[Number(btn.dataset.phase)].at,true)));
$('sectionToggle').addEventListener('click',()=>{
  state.cutaway=!state.cutaway;
  $('sectionToggle').textContent=state.cutaway?'Doorsnede aan':'Buitenkant aan';
  $('sectionToggle').setAttribute('aria-pressed',String(state.cutaway));
  $('modelCaption').textContent=state.cutaway?
    '3D · Bewegende doorsnede · Schematisch':
    '3D · Anatomische hartvorm · Atlasmodel';
  positionInfo(null);
});
function syncLabelsToggle(){
  // Verberg de volledige labellaag direct, ook vóór het eerste animatieframe.
  $('labels').hidden=!state.showLabels;
  $('labelLeaders').hidden=!state.showLabels;
  $('labelsToggle').textContent=state.showLabels?'Namen verbergen':'Namen tonen';
  $('labelsToggle').setAttribute('aria-pressed',String(state.showLabels));
}
$('labelsToggle').addEventListener('click',()=>{state.showLabels=!state.showLabels;syncLabelsToggle();updateLabels();});
$('flowToggle').addEventListener('click',()=>{
  state.showFlow=!state.showFlow;
  $('flowToggle').textContent=state.showFlow?'Bloedstroom verbergen':'Bloedstroom tonen';
  $('flowToggle').setAttribute('aria-pressed',String(state.showFlow));
});
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
setupModel();syncPlay();syncLabelsToggle();loadAtlasModels();
window.__EAI_HEART_LAB__={
  get state(){return {t:state.t,playing:state.playing,speed:state.speed,yaw:state.yaw,zoom:state.zoom,selected:state.selected,cutaway:state.cutaway,showLabels:state.showLabels,atlasReady,atlasError,atlasPartCount:atlasParts.length};},
  get metrics(){return mechanics(state.t);},
  setTime:t=>setTime(t,true),pause:()=>{state.playing=false;syncPlay();},
  get rendererReady(){return Boolean(gl)&&(state.cutaway||atlasReady);}
};
function frame(now){
  const dt=state.last?Math.min((now-state.last)/1000,.065):0;state.last=now;
  if(state.playing)state.t=(state.t+dt*state.speed*state.rate/60)%1;
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
