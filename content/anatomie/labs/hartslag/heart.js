// Hartslaglab: BodyParts3D als anatomische basis, met didactisch benaderde beweging.
// Alleen als de anatomische atlas ontbreekt gebruiken we het oude schematische model.
// Alle grafieken, klepbewegingen, kamerbewegingen en stroomdeeltjes gebruiken dezelfde fase.
import {PHASES,volume,pressure,mechanics,phaseFor} from './cycle.js?v=__EAI_HEART_RELEASE__';
import {CHAMBERS,VESSELS,VALVES,ANATOMY_PARTS,FLOW_PATHS,leafletGeometry,chamberGeometry,tubeGeometry,ringGeometry,septumGeometry,heartEnvelopeGeometry,muscleRidges,TENDINOUS_CORDS,CORONARY_DETAILS,MUSCLE_DETAILS,AURICLES} from './anatomyGeometry.js?v=__EAI_HEART_RELEASE__';
const $=id=>document.getElementById(id);
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const span=(t,a,b)=>ease((t-a)/(b-a));
const fmt=(v,n=0)=>Number(v).toLocaleString('nl-NL',{minimumFractionDigits:n,maximumFractionDigits:n});
const state={cutaway:true,t:0,playing:false,speed:.25,yaw:-.20,pitch:.08,zoom:5.95,pan:[0,0,0],selected:null,showLabels:false,showFlow:true,vesselSection:false,tab:'phase',rate:75,last:0,drag:null,study:{guess:null,stage:'choose',stopAt:null},focusSide:'both',showDetails:false,anatomyView:false,userPaused:false,mode:'watch',guideStep:0};
const layerVisibility={outer:true,wall:true,valve:true,vessel:true,coronary:true,papillary:true};
function layerForKind(kind){return kind==='artery'||kind==='vein'?'coronary':kind;}
function isLayerVisible(part){return layerVisibility[layerForKind(part.kind)]!==false;}
function syncLayerControls(){
  $('layerMenu').hidden=!atlasRich;
  if(!atlasRich)$('layerMenu').open=false;
  document.querySelectorAll('[data-layer]').forEach(button=>{
    const layer=button.dataset.layer;
    const active=layer==='flow'?state.showFlow:
      layer==='labels'?state.showLabels:layer==='vesselSection'?state.vesselSection:layerVisibility[layer];
    button.setAttribute('aria-pressed',String(active));
    button.querySelector('.layer-state').textContent=active?'Aan':'Uit';
  });
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
const COLORS={red:[.98,.63,.53],blue:[.47,.82,.98]};
const canvas=$('heartCanvas'),stage=$('stage');
let gl,program,pointProgram,meshes={},pv=m4(),loc={},ploc={},particleBuffer,cameraEye=[0,0,6];
let atlasParts=[],atlasCenters={},atlasDetails={},atlasReady=false,atlasRich=false,atlasError=null,atlasFlowPaths=[];
function compile(gl,type,src){const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
function shader(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function setupModel(){
  gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'default'})||canvas.getContext('experimental-webgl');
  if(!gl){$('atlasLoading').hidden=true;$('modelUnavailable').hidden=false;return false;}
  // Uit de bron-GLB komen ook per-vertex schaduw, weefselvariatie en vetmaskers.
  // Op oudere/procedurele meshes blijft dit attribuut neutraal.
  program=shader(gl,
    "attribute vec3 position;\nattribute vec3 normal;\nattribute vec3 tissue;\nuniform mat4 pv;\nuniform mat4 model;\nuniform float pulse;\nuniform float atrialMode;\nuniform vec3 cutAxis;\nuniform float moveValve;\nuniform float valveOpen;\nuniform float valveRadius;\nuniform vec3 valveCenter;\nuniform vec3 valveAxis;\nvarying vec3 n;\nvarying vec3 p;\nvarying vec3 tissueData;\nvarying float front;\nvoid main(){\n  vec3 anatomy=position;\n  if(moveValve>.5){\n    // De bronmesh blijft intact. Alleen de bladen krijgen een getekende opening.\n    vec3 axis=normalize(valveAxis);\n    vec3 offset=anatomy-valveCenter;\n    vec3 radial=offset-axis*dot(offset,axis);\n    float r=clamp(length(radial)/max(valveRadius,.001),0.,1.);\n    float flex=1.-smoothstep(.12,.95,r);\n    float flare=4.*r*(1.-r);\n    anatomy+=valveOpen*valveRadius*(axis*.40*flex+normalize(radial+vec3(.00001))*.23*flare);\n  }else if(pulse>0.){\n    // Beperkte, niet-klinische contractie van de spierwand, niet van de vaten.\n    float weight=mix(1.-smoothstep(-.9,.62,anatomy.y),smoothstep(-.12,.75,anatomy.y),atrialMode);\n    anatomy.xz*=1.-.065*pulse*weight;\n    anatomy.y+=.026*pulse*weight;\n  }\n  vec4 world=model*vec4(anatomy,1.);\n  front=dot(world.xyz,cutAxis);\n  gl_Position=pv*world;\n  n=normalize(mat3(model)*normal);\n  p=world.xyz;\n  tissueData=tissue;\n}",
    'precision mediump float;varying vec3 n;varying vec3 p;varying vec3 tissueData;varying float front;uniform vec3 tint;uniform float alpha;uniform float cutFront;uniform float vesselSection;uniform vec3 eyePosition;void main(){if(cutFront>.5&&front>.025)discard;if(vesselSection>.5&&dot(normalize(n),normalize(eyePosition-p))>.12)discard;vec3 normal=normalize(n);vec3 light=normalize(vec3(-.47,.83,1.0));vec3 fill=normalize(vec3(.50,.18,-.8));float direct=max(dot(normal,light),0.0);float soft=max(dot(normal,fill),0.0);float ao=mix(.48,1.0,clamp(tissueData.r,0.0,1.0));float mottle=mix(.91,1.07,clamp(tissueData.g,0.0,1.0));vec3 base=mix(tint,vec3(.93,.71,.43),clamp(tissueData.b,0.0,1.0)*.70);vec3 color=base*(.31+.62*direct+.12*soft)*ao*mottle;float rim=pow(1.0-abs(dot(normal,normalize(vec3(0.,.15,1.)))),2.0);color+=tint*rim*.10;float spec=pow(max(dot(reflect(-light,normal),vec3(0.,0.,1.)),0.0),28.0);color+=vec3(.92,.68,.61)*spec*.15*ao;gl_FragColor=vec4(color,alpha);}');
  pointProgram=shader(gl,'attribute vec3 position;uniform mat4 pv;uniform float size;void main(){vec4 clip=pv*vec4(position,1.0);gl_Position=clip;gl_PointSize=size*clamp(5.0/clip.w,.7,2.4);}',
    'precision mediump float;uniform vec3 tint;void main(){vec2 v=gl_PointCoord-vec2(.5);float r=length(v);if(r>.5)discard;float shine=1.0-smoothstep(.10,.50,r);gl_FragColor=vec4(tint,shine*.87);}');
  for(const k of ['position','normal','tissue','pv','model','tint','alpha','pulse','atrialMode','cutAxis','cutFront','vesselSection','eyePosition','moveValve','valveOpen','valveRadius','valveCenter','valveAxis'])loc[k]=['position','normal','tissue'].includes(k)?gl.getAttribLocation(program,k):gl.getUniformLocation(program,k);
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
  meshes.cords=TENDINOUS_CORDS.map(c=>({mesh:upload(tubeGeometry(c.path,.006,8)),ventricle:c.ventricle}));
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
  let tb=null;
  if(m.t){tb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tb);gl.bufferData(gl.ARRAY_BUFFER,m.t,gl.STATIC_DRAW);}
  return {...m,vb,nb,tb};
}
function drawMesh(mesh,model,color,alpha=1,pulse=0,cutFront=false,valveMotion=null,atrialMode=0,vesselSection=false){
  gl.useProgram(program);gl.uniformMatrix4fv(loc.pv,false,pv);gl.uniformMatrix4fv(loc.model,false,model);
  gl.uniform3fv(loc.tint,color);gl.uniform1f(loc.alpha,alpha);
  gl.uniform1f(loc.pulse,pulse);
  gl.uniform1f(loc.atrialMode,atrialMode);
  gl.uniform1f(loc.cutFront,cutFront?1:0);
  gl.uniform1f(loc.vesselSection,vesselSection?1:0);
  gl.uniform3fv(loc.eyePosition,cameraEye);
  gl.uniform1f(loc.moveValve,valveMotion?1:0);
  gl.uniform1f(loc.valveOpen,valveMotion?valveMotion.opening:0);
  gl.uniform1f(loc.valveRadius,valveMotion?valveMotion.radius:.1);
  gl.uniform3fv(loc.valveCenter,valveMotion?valveMotion.center:[0,0,0]);
  gl.uniform3fv(loc.valveAxis,valveMotion?valveMotion.axis:[0,1,0]);
  // Het snijvlak ligt vast aan de anatomische voorzijde, niet aan de draaiende camera.
  gl.uniform3fv(loc.cutAxis,[0,0,1]);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nb);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);
  if(mesh.tb){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.tb);gl.enableVertexAttribArray(loc.tissue);gl.vertexAttribPointer(loc.tissue,3,gl.FLOAT,false,0,0);}
  else{gl.disableVertexAttribArray(loc.tissue);gl.vertexAttrib3f(loc.tissue,1,.5,0);}
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}
function pathPoint(path,t){
  const lengths=[];let total=0;
  for(let i=1;i<path.length;i++){const len=Math.hypot(...sub(path[i],path[i-1]));lengths.push(len);total+=len;}
  let d=clamp(t,0,1)*total;
  for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1)return add(path[i],scl(sub(path[i+1],path[i]),d/(lengths[i]||1)));d-=lengths[i];}
  return path[path.length-1];
}
// Gebogen kijkroutes door de brononderdelen. Dit zijn onderwijsroutes,
// geen gemeten bloedbanen of uitspraken over exacte stroomhoeveelheden.
function splineAt(points,fraction){
  const position=clamp(fraction,0,1)*(points.length-1);
  const i=Math.min(points.length-2,Math.floor(position));
  const t=position-i,t2=t*t,t3=t2*t;
  const p0=points[Math.max(i-1,0)],p1=points[i],p2=points[i+1],p3=points[Math.min(i+2,points.length-1)];
  return p1.map((v,j)=>{
    const m1=(p2[j]-p0[j])*.38,m2=(p3[j]-p1[j])*.38;
    return (2*t3-3*t2+1)*v+(t3-2*t2+t)*m1+
      (-2*t3+3*t2)*p2[j]+(t3-t2)*m2;
  });
}
function sampleFlow(flow,fraction){
  const positions=flow.curve||flow.path;
  if(positions.length===1)return positions[0];
  const i=clamp(fraction,0,.999999)*(positions.length-1);
  const k=Math.floor(i);
  return add(positions[k],scl(sub(positions[k+1],positions[k]),i-k));
}
// Vaatmiddenlijnen en bloedruimten uit DEZELFDE BodyParts3D-bron als de 34 3D-meshes.
// Herkomst: Niyaz-05/heart-anatomy-lab, commit ad9af6c, generated/geometry.json,
// CC BY 4.0 (DBCLS). De ruwe meters zijn met exact dezelfde uniforme schaal
// (23.8308044) als atlas-heart-rich.json omgezet naar de EAI-ruimte.
// Zo loopt een route niet meer rechtstreeks tussen de zichtbare meshmiddelpunten.
const FLOW_ANATOMY={"vessel":{"svc":[[-0.84692,1.17257,-0.21169],[-1.09317,1.27526,-0.10926],[-0.78268,1.49355,-0.3062],[-0.92459,1.62259,-0.26619],[-0.90273,1.80106,-0.27529],[-0.86973,1.94962,-0.129]],"ivc":[[-0.81768,-3.10184,-0.20606],[-0.92218,-2.55106,-0.2502],[-0.84585,-2.15643,-0.06136],[-0.94022,-1.89803,-0.3006],[-0.90042,-1.4156,0.00834],[-0.89218,-0.89582,-0.22584]],"pa":[[0.24031,0.81685,0.76192],[0.06687,0.96162,0.58919],[-0.00805,0.90898,0.30248],[0.2119,1.18136,0.20063],[0.13636,1.22862,-0.01947],[0.11341,1.46972,-0.12173]],"pa_left":[[0.10772,1.27226,0.10552],[0.26052,1.32578,-0.41299],[0.3903,1.24964,-0.83811],[0.62592,1.08077,-1.17715],[0.83827,0.79492,-1.34194],[1.24418,0.12502,-1.43666]],"pa_right":[[-1.80535,0.13083,-1.27623],[-1.57631,0.66026,-0.94029],[-1.14836,0.9426,-0.77915],[-0.71886,1.13149,-0.73156],[-0.2344,1.24792,-0.49377],[0.16448,1.34546,-0.09725]],"pv_ls":[[0.49165,0.75479,-0.83727],[0.66988,0.67205,-0.75108],[0.87647,0.36468,-0.66905],[1.04388,0.23826,-0.58772],[1.21823,0.10524,-0.49163],[1.37988,-0.12909,-0.35641]],"pv_li":[[0.35303,0.09668,-1.18973],[0.52568,0.03603,-1.15942],[0.68413,-0.09578,-1.20646],[0.79907,-0.38389,-1.38583],[0.97942,-0.27372,-0.99038],[1.15963,-0.25864,-0.84161]],"pv_rs":[[-1.32301,0.7831,-0.45126],[-1.29718,0.6395,-0.55769],[-1.26017,0.55199,-0.63847],[-1.1383,0.4692,-0.68688],[-1.00726,0.38346,-0.72279],[-0.9273,0.27162,-0.75484]],"pv_ri":[[-1.26158,-0.31392,-1.0609],[-1.16716,-0.25668,-1.02322],[-1.0869,-0.14663,-1.01286],[-0.97671,-0.08612,-0.96982],[-0.80624,-0.15044,-0.92711],[-0.72458,-0.05231,-0.90774]],"ao":[[-0.04888,0.29655,-0.13622],[-0.11718,0.46136,-0.13512],[-0.32686,0.65945,0.06063],[-0.36292,0.83768,0.09875],[-0.33497,1.13211,0.03072],[-0.44054,1.28884,0.04039]],"ao_arch":[[-0.44966,1.50804,0.15645],[-0.26114,1.66637,-0.17613],[-0.06687,1.89729,-0.4826],[0.00562,1.89705,-0.88284],[0.05662,1.72178,-1.198],[0.09323,1.4507,-1.59938]],"ao_desc":[[-0.21965,-2.18054,-0.7765],[-0.18533,-1.25822,-1.07317],[-0.11725,-0.67389,-1.22357],[-0.04242,0.03999,-1.40735],[-0.05307,0.62708,-1.46226],[-0.01299,1.53763,-1.31679]]},"chamber":{"ra":[-0.94377,0.10736,-0.21681],"rv":[-0.47376,-0.30644,0.49814],"la":[-0.295,0.25046,-0.86932],"lv":[0.51167,-0.21567,-0.14522]},"valve":{"tricuspid":[-0.47864,-0.29989,0.23292],"mitral":[0.31466,-0.27119,-0.38051],"pulmonary":[0.12382,0.65785,0.48133],"aortic":[-0.0158,0.43496,-0.07807]}};
function makeAtlasFlowPaths(centers){
  const {vessel:v,chamber:c,valve:k}=FLOW_ANATOMY;
  const distance=(a,b)=>Math.hypot(...sub(a,b));
  const from=(line,origin)=>distance(line[0],origin)<=distance(line.at(-1),origin)?line:[...line].reverse();
  const into=(line,destination)=>distance(line.at(-1),destination)<=distance(line[0],destination)?line:[...line].reverse();
  const pa=from(v.pa,k.pulmonary),paEnd=pa.at(-1);
  const aorta=from(v.ao,k.aortic),arch=from(v.ao_arch,aorta.at(-1));
  const desc=from(v.ao_desc,arch.at(-1));
  const specs=[
    ['blue','return',['svc','ra'],22,[...into(v.svc,c.ra),c.ra]],
    ['blue','return',['ivc','ra'],20,[...into(v.ivc,c.ra),c.ra]],
    ['blue','av',['ra','tricuspid','rv'],28,[c.ra,k.tricuspid,c.rv]],
    ['blue','sem',['rv','pulmonary','pa','pa_left'],23,[c.rv,k.pulmonary,...pa,...from(v.pa_left,paEnd)]],
    ['blue','sem',['rv','pulmonary','pa','pa_right'],23,[c.rv,k.pulmonary,...pa,...from(v.pa_right,paEnd)]],
    ['red','return',['pv_ls','la'],19,[...into(v.pv_ls,c.la),c.la]],
    ['red','return',['pv_li','la'],19,[...into(v.pv_li,c.la),c.la]],
    ['red','return',['pv_rs','la'],19,[...into(v.pv_rs,c.la),c.la]],
    ['red','return',['pv_ri','la'],19,[...into(v.pv_ri,c.la),c.la]],
    ['red','av',['la','mitral','lv'],28,[c.la,k.mitral,c.lv]],
    ['red','sem',['lv','aortic','ao','ao_arch','ao_desc'],26,[c.lv,k.aortic,...aorta,...arch,...desc]]
  ];
  return specs.map(([color,channel,ids,n,path])=>({
    color,channel,n,ids,path,geometrySource:'bodyparts3d-centrelines',
    curve:Array.from({length:61},(_,i)=>splineAt(path,i/60))
  }));
}
function flowIsActive(flow,m){
  return flow.channel==='return'||(flow.channel==='av'&&m.av)||
    (flow.channel==='sem'&&m.sem);
}
function drawParticles(m){
  if(!state.showFlow)return;
  const batches={red:[],blue:[]};
  const routes=atlasRich&&state.cutaway?atlasFlowPaths:FLOW_PATHS;
  for(const flow of routes){
    if(atlasReady&&state.cutaway&&state.focusSide!=='both'&&flow.color!==(state.focusSide==='left'?'red':'blue'))continue;
    if(!flowIsActive(flow,m))continue;
    for(let i=0;i<flow.n;i+=(atlasRich?2:1)){
      const progress=(i/flow.n+state.t*(flow.channel==='sem'?2.35:1.2))%1;
      const point=flow.curve?sampleFlow(flow,progress):pathPoint(flow.path,progress);
      batches[flow.color].push(...point);
    }
  }
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(pointProgram);
  gl.uniformMatrix4fv(ploc.pv,false,pv);gl.uniform1f(ploc.size,(atlasRich?3.4:7.5)*Math.min(devicePixelRatio||1,2));
  for(const name of ['blue','red']){
    const arr=batches[name];if(!arr.length)continue;
    gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(ploc.position);gl.vertexAttribPointer(ploc.position,3,gl.FLOAT,false,0,0);
    gl.uniform3fv(ploc.tint,COLORS[name]);gl.drawArrays(gl.POINTS,0,arr.length/3);
  }
  gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
}
// Dunne kleurbanen en richtingpijlen worden op de 3D-bronpunten geprojecteerd.
// De camera, zoom en pan sturen deze lijnen mee; ze blokkeren aanrakingen nooit.
const flowOverlay=$('flowOverlay');
const svgNS='http://www.w3.org/2000/svg';
let flowVisuals=[],flowVisualKey='';
function svgElement(name){return document.createElementNS(svgNS,name);}
function prepareFlowOverlay(){
  flowOverlay.replaceChildren();
  flowVisuals=atlasFlowPaths.map((flow,index)=>{
    // Korte brede kleurbanen suggereren doorlopend bloed, geen rij neonstippen.
    // Het blijft een 3D-geprojecteerde onderwijsroute, geen gemeten stromingsveld.
    const track=svgElement('path'),bed=svgElement('path'),pulse=svgElement('path'),arrow=svgElement('path');
    const color=flow.color==='blue'?'#6bc8ec':'#ec917e';
    const highlight=flow.color==='blue'?'#bcefff':'#ffd4c4';
    for(const p of [track,bed,pulse]){
      p.setAttribute('fill','none');
      p.setAttribute('stroke-linecap','round');
      p.setAttribute('stroke-linejoin','round');
    }
    track.setAttribute('stroke',color);
    track.setAttribute('stroke-width',flow.channel==='return'?'9':'11');
    track.setAttribute('class','blood-track');
    bed.setAttribute('stroke',color);
    bed.setAttribute('stroke-width',flow.channel==='return'?'5.6':'6.8');
    bed.setAttribute('class','blood-fill');
    pulse.setAttribute('stroke',highlight);
    pulse.setAttribute('stroke-width',flow.channel==='return'?'3':'3.8');
    pulse.setAttribute('class','blood-pulse');
    pulse.dataset.flowChannel=flow.channel;
    arrow.setAttribute('fill',color);
    arrow.setAttribute('class','blood-arrow');
    flowOverlay.append(track,bed,pulse,arrow);
    return {flow,index,track,bed,pulse,arrow,length:1,blob:16};
  });
  flowVisualKey='';
}
function updateFlowOverlay(m){
  if(!atlasRich||!state.cutaway||!state.showFlow||!atlasFlowPaths.length){
    flowOverlay.setAttribute('hidden','');
    return;
  }
  flowOverlay.removeAttribute('hidden');
  if(flowVisuals.length!==atlasFlowPaths.length)prepareFlowOverlay();
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  const view=[w,h,state.yaw,state.pitch,state.zoom,...state.pan].join(':');
  if(view!==flowVisualKey){
    flowOverlay.setAttribute('viewBox','0 0 '+w+' '+h);
    for(const visual of flowVisuals){
      const {flow,track,bed,pulse,arrow}=visual;
      const points=flow.curve.map(p=>project(p,pv,w,h));
      const d=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      for(const segment of [track,bed,pulse])segment.setAttribute('d',d);
      const length=Math.max(1,pulse.getTotalLength());
      const blob=clamp(length*.18,14,32);
      visual.length=length;
      visual.blob=blob;
      // Eén zachte, langgerekte stroompuls per route, met een open ruimte ertussen.
      pulse.setAttribute('stroke-dasharray',blob.toFixed(1)+' '+(length+blob).toFixed(1));
      const tip=points[Math.floor(points.length*.76)];
      const before=points[Math.floor(points.length*.70)];
      const tangent=Math.hypot(tip[0]-before[0],tip[1]-before[1])||1;
      const ux=(tip[0]-before[0])/tangent,uy=(tip[1]-before[1])/tangent;
      const back=[tip[0]-ux*8,tip[1]-uy*8];
      arrow.setAttribute('d','M '+tip[0].toFixed(1)+' '+tip[1].toFixed(1)+
        ' L '+(back[0]-uy*3.0).toFixed(1)+' '+(back[1]+ux*3.0).toFixed(1)+
        ' L '+(back[0]+uy*3.0).toFixed(1)+' '+(back[1]-ux*3.0).toFixed(1)+' Z');
    }
    flowVisualKey=view;
  }
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const {flow,index,track,bed,pulse,arrow,length,blob} of flowVisuals){
    const side=state.focusSide==='both'||flow.color===(state.focusSide==='left'?'red':'blue');
    const active=side&&flowIsActive(flow,m);
    const valveOpening=flow.channel==='av'?m.avOpening:flow.channel==='sem'?m.semOpening:1;
    const strength=active?clamp(valveOpening,0,1):0;
    // Aanvoer loopt door. Bij gesloten kleppen verdwijnen bewegende uitstroombanen.
    const entering=flow.channel==='return';
    track.style.opacity=String(strength*(entering?.13:.19));
    bed.style.opacity=String(strength*(entering?.35:.52));
    pulse.style.opacity=String(strength*(reducedMotion?.24:(entering?.62:.94)));
    // Alleen bij de vijf hoofdverbindingen een klein pijltje. De zijtakken
    // lees je aan de bewegende puls, zonder een wirwar van pijlen te tekenen.
    arrow.style.opacity=String(!entering&&active?strength*.58:0);
    const progress=entering?state.t:flow.channel==='av'?
      clamp(state.t/.64,0,1):clamp((state.t-.70)/.23,0,1);
    const travel=(progress+index*.13)%1;
    pulse.style.strokeDashoffset=String(-(length+blob)*(reducedMotion?.30:travel));
  }
}
function updateViewport(){
  const w=Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2)),h=Math.round(canvas.clientHeight*Math.min(devicePixelRatio||1,2));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  if(gl)gl.viewport(0,0,w,h);
  const center=add([0,.12,0],state.pan);
  const eye=add(center,[Math.sin(state.yaw)*Math.cos(state.pitch)*state.zoom,
    Math.sin(state.pitch)*state.zoom,Math.cos(state.yaw)*Math.cos(state.pitch)*state.zoom]);
  cameraEye=eye;
  pv=mul(persp(42*Math.PI/180,Math.max(.5,w/Math.max(h,1)),.1,100),lookAt(eye,center));
}
// De anatomische buitenvorm wordt tijdens de sitebuild uit de bestaande GLB
// gehaald. De browser heeft geen externe 3D-engine of Draco-decoder nodig.
async function loadAtlasModels(){
  if(!gl)return;
  const failures=[];
  for(const [name,isRich] of [['atlas-heart-rich',true],['atlas-heart',false]]){
    try{
      const response=await fetch('./'+name+'.json?v=__EAI_HEART_RELEASE__');
      if(!response.ok)throw Error(name+'-manifest ontbreekt: '+response.status);
      const manifest=await response.json();
      if(manifest.format!==(isRich?2:1)||!Array.isArray(manifest.parts)||manifest.parts.length<(isRich?34:4))
        throw Error('Onvolledig anatomisch model: '+name);
      const data=await fetch('./'+name+'.bin?v=__EAI_HEART_RELEASE__');
      if(!data.ok)throw Error('Hartmesh ontbreekt: '+name);
      const buffer=await data.arrayBuffer();
      if(buffer.byteLength!==manifest.bytes)throw Error('Hartmesh-bestand is niet volledig');
      const loaded=[],centers={},details={},known=new Set();
      for(const part of manifest.parts){
        if(!Number.isInteger(part.count)||part.count<=0||known.has(part.id))throw Error('Ongeldige mesh: '+part.id);
        known.add(part.id);
        const size=part.count*3;
        if(!Array.isArray(part.center)||part.center.length!==3)throw Error('Meshcentrum ontbreekt: '+part.id);
        const v=new Float32Array(buffer,part.positionOffset,size);
        const n=new Float32Array(buffer,part.normalOffset,size);
        const t=isRich?new Float32Array(buffer,part.tissueOffset,size):null;
        let valveRadius=0;
        if(part.kind==='valve'){
          for(let i=0;i<v.length;i+=3){
            valveRadius=Math.max(valveRadius,Math.hypot(
              v[i]-part.center[0],v[i+1]-part.center[1],v[i+2]-part.center[2]));
          }
          valveRadius=clamp(valveRadius,.08,.45);
        }
        loaded.push({id:part.id,kind:part.kind,color:part.color,
          center:part.center,valveRadius,mesh:upload({v,n,t,count:part.count})});
        centers[part.id]=part.center;
        details[part.id]={label:part.label,pos:part.center,type:part.kind};
      }
      atlasParts=loaded;atlasCenters=centers;atlasDetails=details;
      atlasReady=true;atlasRich=isRich;atlasError=null;
      atlasFlowPaths=isRich?makeAtlasFlowPaths(centers):[];
      flowVisuals=[];flowVisualKey='';
      if(state.cutaway)state.anatomyView=isRich;
      syncLayerControls();
      if(isRich){
        state.cutaway=true;
        state.anatomyView=true;
        state.focusSide='both';
        $('atlasLoading').hidden=true;
        $('play').disabled=false;
        // Een echte loop start zodra de atlas geladen is. Respecteer minder beweging.
        if(state.mode==='watch'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!state.userPaused)
          state.playing=true;
        syncPlay();
      }else{
        $('atlasLoading').hidden=false;
        $('atlasLoading').textContent='Het uitgebreide hartmodel is niet geladen. Alleen de beperkte terugvalweergave is beschikbaar.';
        $('play').disabled=true;
      }
      $('modelCaption').textContent=isRich?
        'Echte 3D-anatomie · BodyParts3D · 34 structuren':'3D · Anatomische hartvorm · Atlasmodel';
      if(!state.cutaway)positionInfo(null);
      syncViewControls();
      return;
    }catch(error){failures.push(name+': '+String(error.message||error));}
  }
  atlasError=failures.join(' | ');atlasReady=false;atlasRich=false;atlasFlowPaths=[];
  syncLayerControls();
  $('atlasLoading').hidden=false;
  $('atlasLoading').textContent='De gedetailleerde hartanatomie kan niet worden geladen. Ververs de pagina om opnieuw te proberen.';
  $('play').disabled=true;
  state.playing=false;syncPlay();
  state.cutaway=true;state.anatomyView=false;
  syncViewControls();
  $('modelCaption').textContent='3D · Bewegende doorsnede · Schematisch';
  $('partInfo').textContent='De anatomische 3D-bronnen konden niet worden geladen. Het schematische werkingsmodel blijft bruikbaar.';
  console.error('Hartslaglab bronmodellen:',atlasError);
}
// Stopmomenten horen bij dezelfde berekening als de doorlopende hartslag.
const GUIDED_STEPS=[
  {at:.30,title:'Het hart vult zich',
   text:'Bloed komt via de aders in de boezems. Het stroomt door de open kleppen naar de kamers.',
   route:'Boezems → kamers',focusLabel:'Kleppen tussen boezems en kamers',
   focus:['mitral','tricuspid','svc','ivc','pv_ls','pv_rs','pv_li','pv_ri']},
  {at:.58,title:'De boezems knijpen samen',
   text:'De boezems geven het laatste bloed een zetje naar de kamers. De kleppen ertussen zijn nog open.',
   route:'Boezems → kamers',focusLabel:'Boezemwanden',
   focus:['ra_wall','la_wall','mitral','tricuspid']},
  {at:.675,title:'De kamers bouwen druk op',
   text:'De kleppen naar de boezems zijn dicht. De andere kleppen zijn ook nog dicht. De druk stijgt, maar het bloed blijft even in de kamers.',
   route:'Alle kleppen dicht · druk stijgt',focusLabel:'De vier gesloten hartkleppen',
   focus:['mitral','tricuspid','aortic','pulmonary','ventricular_wall']},
  {at:.82,title:'Het hart pompt bloed weg',
   text:'De slagaderkleppen zijn open. Rechts stroomt bloed naar de longen, links naar de rest van het lichaam.',
   route:'Rechts → longen · links → lichaam',focusLabel:'Slagaderkleppen en grote bloedvaten',
   focus:['aortic','pulmonary','ao','ao_arch','pa','pa_left','pa_right']},
  {at:.965,title:'Het hart ontspant',
   text:'De slagaderkleppen zijn dicht. De kamers ontspannen en de druk daalt, voordat het hart weer gaat vullen.',
   route:'Kleppen dicht · druk daalt',focusLabel:'Slagaderkleppen en kamerwand',
   focus:['aortic','pulmonary','ventricular_wall']}
];
function guideFocusOn(part){return state.mode==='steps'&&GUIDED_STEPS[state.guideStep].focus.includes(part.id);}
function drawAtlasHeart(m,section=false){
  const pulse=clamp((1-m.ventScale)/.21,0,1);
  for(const part of atlasParts){
    if(atlasRich){
      // Bloedruimtes zijn lege ruimtes, geen extra spierwand.
      // Binnen: een open snijvlak. Buiten: dezelfde volledige bronwand
      // wordt in een aparte laag getekend, zodat de knoppen onafhankelijk zijn.
      if(part.kind==='space'||!isLayerVisible(part)||(!section&&part.kind==='wall'))continue;
      const cutWall=section&&part.kind==='wall';
      let color=part.color;
      // Subtiele routekleuren op de echte bronvaten helpen de twee
      // bloedsomlopen herkennen. De kleuren zijn didactisch.
      if(section&&part.kind==='vessel'){
        if(['svc','ivc','pa','pa_left','pa_right'].includes(part.id))color=[.34,.57,.72];
        if(['ao','ao_arch','ao_desc','pv_rs','pv_ri','pv_ls','pv_li'].includes(part.id))
          color=[.84,.46,.40];
      }
      let valveMotion=null;
      if(section&&part.kind==='valve'){
        const left=['mitral','aortic'].includes(part.id);
        const focused=state.focusSide==='both'||left===(state.focusSide==='left');
        const opening=['mitral','tricuspid'].includes(part.id)?m.avOpening:m.semOpening;
        color=focused?(opening>.3?[.99,.83,.62]:[.85,.60,.47]):[.58,.49,.43];
        if(state.showDetails&&focused)color=[1,.94,.72];
        valveMotion={
          center:part.center,radius:part.valveRadius,opening,
          axis:['mitral','tricuspid'].includes(part.id)?[0,-1,0]:[0,1,0]
        };
      }
      if(state.mode==='steps'){
        if(guideFocusOn(part)){
          color=part.kind==='vessel'?color.map(c=>Math.min(1,c*.75+.25)):[1,.91,.59];
        }else{
          color=color.map(c=>c*.77);
        }
      }
      if(state.selected===part.id)color=[1,.86,.60];
      // De atlasvorm blijft het zichtbare model; de klepbeweging is een
      // didactische vervorming, geen anatomisch gevalideerde hartcontractie.
      const atrialWall=['ra_wall','la_wall'].includes(part.id);
      const wallPulse=atrialWall?clamp((1-m.atriumScale)/.16,0,1):
        (part.kind==='wall'||part.kind==='papillary')?pulse:0;
      // Verberg de camera-gerichte helft van de grote vaten, met de echte bronmesh als achterwand.
      // De stromingsroutes blijven zichtbaar; dit is een didactische kijkopening, geen scan.
      drawMesh(part.mesh,m4(),color,1,wallPulse,cutWall,valveMotion,atrialWall?1:0,
        section&&state.vesselSection&&part.kind==='vessel');
      continue;
    }
    if(section&&part.kind!=='chamber'&&part.id!==(state.focusSide==='left'?'ao':'pa'))continue;
    const color=state.selected===part.id?[.98,.75,.56]:part.color;
    drawMesh(part.mesh,m4(),color,1,pulse,section&&part.kind==='chamber');
  }
}
// De drie bestaande BodyParts3D-wandmeshes vormen samen de buitenkant.
function drawAtlasExterior(m,section=false){
  if(!atlasRich||!layerVisibility.outer)return;
  const opacity=section?(state.mode==='steps'?.23:.31):1;
  const pulse=clamp((1-m.ventScale)/.21,0,1);
  if(section){
    // Alleen de voorste wand licht door: de achterkant hoeft niet als een
    // tweede laag over de kleppen en kamers getekend te worden.
    gl.depthMask(false);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }
  for(const part of atlasParts){
    if(part.kind!=='wall')continue;
    const atrial=['ra_wall','la_wall'].includes(part.id);
    const beat=atrial?clamp((1-m.atriumScale)/.16,0,1):pulse;
    drawMesh(part.mesh,m4(),part.color,opacity,beat,false,null,atrial?1:0);
  }
  if(section){
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
  }
}
function drawScene(m){
  if(!gl)return;
  updateViewport();
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.depthMask(true);
  if(atlasReady&&(!state.cutaway||state.anatomyView)){
    drawAtlasHeart(m,state.cutaway);
    drawAtlasExterior(m,state.cutaway);
    if(state.cutaway)drawParticles(m);
    updateFlowOverlay(m);
    updateLabels();
    return;
  }
  // Vaten achter het zichtbare myocard, maar met een herkenbaar doorlopend verloop.
  if((!atlasReady||!atlasRich||!state.anatomyView))for(const vessel of VESSELS)
    drawMesh(meshes.vessels[vessel.id],m4(),vessel.color,1);

  // Een doorlopende spierwand verbindt de hartkamers tot één orgaan.
  // De brede opening laat de inwendige holtes zichtbaar.
  if((!atlasReady||!atlasRich||!state.anatomyView))drawMesh(meshes.envelope,m4(),[.65,.31,.29],1);
  // Hartoren vormen de gekartelde uitlopers van de boezems.
  if((!atlasReady||!atlasRich||!state.anatomyView))for(const auricle of meshes.auricles)drawMesh(auricle.mesh,m4(),state.selected===auricle.id?[.96,.66,.50]:auricle.color,1);

  // Vier holtes met een echte open voorzijde, spierwand en inwendige bekleding.
  // De kamergeometrie wordt per hartfase opgeschaald. Dit is een didactische
  // vervorming en geen simulatie van alle vezelrichtingen van het myocard.
  for(const [id,part] of Object.entries(CHAMBERS)){
    if(atlasReady&&state.cutaway&&(state.focusSide==='left'?!['la','lv'].includes(id):!['ra','rv'].includes(id)))continue;
    const isVentricle=part.kind==='ventricle';
    const factor=isVentricle?m.ventScale:m.atriumScale;
    const scale=part.scale.map((v,i)=>v*(i===1?factor:Math.sqrt(factor)));
    const model=modelMatrix(part.pos,scale);
    const hit=state.selected===id;
    // Van buiten zie je één hartwand, niet vier losse ellipsoïden.
    if(!state.cutaway)continue;
    if((!atlasReady||!atlasRich||!state.anatomyView))drawMesh(meshes.chambers[id].outer,model,hit?[.95,.61,.51]:part.muscle,1);
    drawMesh(meshes.chambers[id].inner,model,part.blood,1);
    drawMesh(meshes.chambers[id].rim,model,hit?[1,.78,.62]:[.94,.63,.54],1);
    if((!atlasReady||!atlasRich||!state.anatomyView))for(const ridge of meshes.ridges[id])drawMesh(ridge.mesh,model,ridge.color,.96);
  }
  // Kransvaten en de grote hartader liggen op het epicard.
  if((!atlasReady||!atlasRich||!state.anatomyView))for(const vessel of meshes.coronary)drawMesh(vessel.mesh,m4(),state.selected===vessel.id?[.98,.75,.52]:vessel.color,1);
  if(state.cutaway){
    if(!atlasReady||state.showDetails)for(const papillary of meshes.papillary){
      if(atlasReady&&!papillary.id.includes(state.focusSide==='left'?'lv':'rv'))continue;
      drawMesh(papillary.mesh,m4(),state.selected===papillary.id?[.98,.71,.54]:papillary.color,1);
    }
    if((!atlasReady||!atlasRich||!state.anatomyView))drawMesh(meshes.septum,m4(),[.91,.59,.52],1);
    if(!atlasReady||state.showDetails)for(const chord of meshes.cords){
      if(atlasReady&&chord.ventricle!==(state.focusSide==='left'?'lv':'rv'))continue;
      drawMesh(chord.mesh,m4(),[.96,.85,.70],1);
    }
    // Klepbladen zijn geen statische stippen: twee bij mitralis, drie bij
    // tricuspidalis en drie bij elk van de halvemaanvormige kleppen.
    for(const valve of VALVES){
      if(atlasReady&&!((state.focusSide==='left'&&['mitral','aortic'].includes(valve.id))||
        (state.focusSide==='right'&&['tricuspid','pulmonary'].includes(valve.id))))continue;
      const active=valve.type==='av'?m.av:m.sem;
      const aperture=valve.type==='av'?m.avOpening:m.semOpening;
      const mesh=meshes.valves[valve.id].leaflets;
      const leaves=leafletGeometry(valve,aperture);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.bufferSubData(gl.ARRAY_BUFFER,0,leaves.v);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nb);gl.bufferSubData(gl.ARRAY_BUFFER,0,leaves.n);
      if(!atlasReady||state.showDetails)drawMesh(meshes.valves[valve.id].rim,modelMatrix(valve.pos,[1,1,1]),[.96,.75,.59],1);
      drawMesh(mesh,modelMatrix(valve.pos,[1,1,1]),active?[.91,.90,.71]:[.96,.69,.53],1);
    }
  }
  gl.depthMask(true);
  drawParticles(m);
  updateFlowOverlay(m);
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
    const world=(!state.cutaway||state.anatomyView)&&atlasCenters[id]?atlasCenters[id]:part.pos;
    const p=project(world,pv,w,h);
    const visibleLayer=['ra','rv','la','lv'].includes(id)?layerVisibility.wall:layerVisibility.vessel;
    const visible=state.showLabels&&visibleLayer&&p[2]>0&&p[0]>-25&&p[0]<w+25;
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

// Selectie volgt de daadwerkelijk getoonde geometrie, niet de verborgen
// schematische kamers. Bloedruimtes uit de atlas zijn geen getekende oppervlakken.
function anatomicalAtlasVisible(){
  return atlasReady&&(!state.cutaway||state.anatomyView);
}
function selectableParts(){
  if(!anatomicalAtlasVisible())return ANATOMY_PARTS;
  if(!atlasRich)return atlasDetails;
  return Object.fromEntries(Object.entries(atlasDetails).filter(([,part])=>{
    if(part.type==='space')return false;
    // Een hartwand mag alleen aanklikbaar zijn als een van beide wandlagen
    // daadwerkelijk zichtbaar is in het gekozen binnen- of buitenaanzicht.
    if(part.type==='wall')return state.cutaway?
      layerVisibility.wall||layerVisibility.outer:layerVisibility.outer;
    return layerVisibility[layerForKind(part.type)]!==false;
  }));
}
function selectedPartAt(x,y){
  let best=null,score=55;
  for(const [id,part] of Object.entries(selectableParts())){
    const p=project(part.pos,pv,canvas.clientWidth,canvas.clientHeight);
    const dist=Math.hypot(p[0]-x,p[1]-y);
    const limit=['artery','vein','papillary','auricle'].includes(part.type)?27:55;
    if(p[2]>0&&dist<limit&&dist<score){best=id;score=dist;}
  }
  return best;
}
function positionInfo(id){
  state.selected=id;
  const part=selectableParts()[id];
  $('partInfo').hidden=!part;
  if(!part){
    $('partInfo').textContent=state.cutaway?
      'Sleep om het hart te draaien. Tik op een onderdeel om het te onderzoeken.':
      'Draai het hart met je vinger. Kies Bekijk binnenkant om de hartslag van binnen te onderzoeken.';
    return;
  }
  if(part.type==='valve'){
    if(anatomicalAtlasVisible()&&atlasRich){
      const opening=['mitral','tricuspid'].includes(id)?mechanics(state.t).avOpening:mechanics(state.t).semOpening;
      $('partInfo').textContent=part.label+' · '+(opening>.5?'Open':'Gesloten')+
        ' in deze fase. De anatomische vorm komt uit BodyParts3D; de beweging is vereenvoudigd.';
      return;
    }
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
  const extra=part.type==='wall'?'Dit is hartspierweefsel. Met Bekijk binnenkant kun je achter de buitenste wand kijken.':
    part.type==='vessel'?'Dit bloedvat voert bloed naar of vanuit het hart. Kijk naar de verbindingen met de hartkamers.':
    id==='lv'?'De dikke spierwand perst bloed naar de aorta.':
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
function drawMiniTrace(){
  const strip=$('miniTrace'),width=strip.clientWidth,height=strip.clientHeight;
  if(width<=10||height<=10)return;
  const dpr=Math.min(devicePixelRatio||1,2),W=Math.round(width*dpr),H=Math.round(height*dpr);
  if(strip.width!==W||strip.height!==H){strip.width=W;strip.height=H;}
  const ctx=strip.getContext('2d');if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const x0=8,x1=width-8,y0=6,y1=height-8,w=x1-x0,h=y1-y0;
  ctx.lineWidth=.7;ctx.strokeStyle='rgba(123,156,166,.2)';
  for(const t of [0,.52,.64,.70,.93,1]){
    const x=x0+t*w;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);ctx.stroke();
  }
  for(const series of [
    {fn:pressure,normal:v=>v/130,color:'#ed9a80'},
    {fn:volume,normal:v=>(v-60)/70,color:'#7ecdbb'}
  ]){
    ctx.beginPath();ctx.lineWidth=1.45;ctx.strokeStyle=series.color;
    for(let i=0;i<=150;i++){
      const t=i/150,x=x0+t*w,y=y1-clamp(series.normal(series.fn(t)),0,1)*h;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
    const value=series.fn(state.t),x=x0+state.t*w,y=y1-clamp(series.normal(value),0,1)*h;
    ctx.beginPath();ctx.arc(x,y,2.6,0,TAU);ctx.fillStyle=series.color;ctx.fill();
  }
  const cursor=x0+state.t*w;
  ctx.lineWidth=.8;ctx.strokeStyle='#e2ece7';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(cursor,y0);ctx.lineTo(cursor,y1);ctx.stroke();ctx.setLineDash([]);
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
  $('storyAV').textContent='AV-kleppen '+(m.av?'open':'dicht');
  $('storySL').textContent='Slagaderkleppen '+(m.sem?'open':'dicht');
  $('storyAV').classList.toggle('open',m.av);
  $('storySL').classList.toggle('open',m.sem);
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
  // Verborgen grafieken hoeven op mobiel niet ieder animatieframe te tekenen.
  if($('moreTools').open&&document.querySelector('.more-tools .measurements')?.open){
    drawChart('pressureChart',pressure,'#ed9a80',130,'mmHg');
    drawChart('volumeChart',volume,'#7ecdbb',150,'ml');
  }
  $('miniPressure').textContent=fmt(m.pressure)+' mmHg';
  $('miniVolume').textContent=fmt(m.volume)+' ml';
  $('miniTraceTime').textContent=fmt(state.t*60/state.rate,2)+' s';
  $('playbackDuration').textContent='Afspelen: '+fmt(60/state.rate/state.speed,1)+
    ' s per hartslag. De hartcyclus zelf duurt '+fmt(60/state.rate,2)+' s.';
  if($('quickMeasurements').open)drawMiniTrace();
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
function syncPlay(){
  $('play').textContent=state.playing?'Pauzeer':'Start hartslag';
  $('play').setAttribute('aria-label',state.playing?'Pauzeer de doorlopende hartslag':'Start de doorlopende hartslag');
  $('loopLabel').textContent=state.mode==='steps'?'Bekijk elke stap rustig':
    state.mode==='explore'?'Draai en onderzoek het hart':
    state.playing?'Het hart klopt steeds opnieuw':'Hartslag gepauzeerd';
}
function syncLearningMode(){
  const guided=state.mode==='steps';
  const exploring=state.mode==='explore';
  $('storyNumber').hidden=!guided;
  $('storyStatus').hidden=!guided;
  $('guideNavigation').hidden=!guided;
  $('learningChoices').hidden=guided;
  $('guidedFocus').hidden=!guided;
  $('transport').hidden=guided;
  $('exploreStart').setAttribute('aria-pressed',String(exploring));
  $('exploreStart').textContent=exploring?'Terug naar hartslag':'Zelf onderzoeken';
  if(guided){
    const step=GUIDED_STEPS[state.guideStep];
    $('storyNumber').textContent=String(state.guideStep+1).padStart(2,'0')+' / 05';
    $('storyTitle').textContent=step.title;
    $('storyText').textContent=step.text;
    $('storyRoute').textContent=step.route;
    $('guidedFocus').textContent='Kijk naar: '+step.focusLabel;
    $('guideCount').textContent='Stap '+(state.guideStep+1)+' van 5';
    $('guidePrevious').disabled=state.guideStep===0;
    $('guideNext').textContent=state.guideStep===4?'Bekijk opnieuw':'Volgende stap';
  }else{
    $('storyTitle').textContent=exploring?'Onderzoek het hart zelf':'Volg de bloedstroom';
    $('storyText').textContent=exploring?
      'Sleep om het hart te draaien. Tik op een onderdeel voor de naam, of open Lagen om onderdelen te verbergen.':
      'Blauw bloed stroomt vanuit het lichaam naar de longen. Rood bloed stroomt vanuit de longen naar het lichaam. Kijk welke kleppen open- en dichtgaan.';
  }
  syncPlay();
}
function selectGuideStep(index){
  state.mode='steps';
  state.guideStep=(index+GUIDED_STEPS.length)%GUIDED_STEPS.length;
  state.playing=false;state.userPaused=true;
  state.cutaway=true;state.anatomyView=atlasRich;state.focusSide='both';
  // Toon de bronstructuren; uitleg mag niet verwijzen naar verborgen onderdelen.
  Object.keys(layerVisibility).forEach(k=>{layerVisibility[k]=true;});
  state.showFlow=true;
  state.t=GUIDED_STEPS[state.guideStep].at;
  positionInfo(null);
  syncLayerControls();
  syncViewControls();
  syncLearningMode();
  render();
}
function returnToWatch(){
  state.mode='watch';
  state.playing=atlasRich&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.userPaused=!state.playing;
  syncLearningMode();
  render();
}
$('guideStart').addEventListener('click',()=>selectGuideStep(0));
$('guidePrevious').addEventListener('click',()=>selectGuideStep(state.guideStep-1));
$('guideNext').addEventListener('click',()=>selectGuideStep(state.guideStep+1));
$('guideExit').addEventListener('click',returnToWatch);
$('exploreStart').addEventListener('click',()=>{
  if(state.mode==='explore'){returnToWatch();return;}
  state.mode='explore';state.playing=false;state.userPaused=true;
  syncLearningMode();render();
});
$('play').addEventListener('click',()=>{
  if(!atlasRich)return;
  state.playing=!state.playing;
  state.userPaused=!state.playing;
  syncPlay();
});
$('prevPhase').addEventListener('click',()=>{let i=phaseFor(state.t);if(Math.abs(state.t-PHASES[i].at)<.012)i=(i+PHASES.length-1)%PHASES.length;setTime(PHASES[i].at,true);});
$('nextPhase').addEventListener('click',()=>setTime(PHASES[(phaseFor(state.t)+1)%PHASES.length].at,true));
$('scrub').addEventListener('input',e=>setTime(Number(e.target.value)/1000,true));
$('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);render();});
$('timeline').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>setTime(PHASES[Number(btn.dataset.phase)].at,true)));
function syncViewControls(){
  $('sectionToggle').textContent=state.cutaway?'Bekijk buitenkant':'Bekijk binnenkant';
  $('sectionToggle').setAttribute('aria-pressed',String(state.cutaway));
  const inside=state.cutaway;
  $('flowToggle').hidden=!inside;
  $('flowLegend').hidden=!inside||!state.showFlow;
  $('heartSideControls').hidden=!inside;
  // Geen schakelaar meer die de rijke atlas door een getekend hart vervangt.
  $('detailToggle').textContent=state.showDetails?'Markering uit':'Kleppen uitlichten';
  $('detailToggle').setAttribute('aria-pressed',String(state.showDetails));
  document.querySelectorAll('[data-heart-side]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.heartSide===state.focusSide)));
  $('modelCaption').textContent=state.cutaway?
    state.anatomyView?'3D-anatomie · BodyParts3D · Klepbeweging benaderd':
      '3D · Schematische terugvalweergave':
    atlasRich?'Echte 3D-anatomie · BodyParts3D · 34 structuren':'3D · Anatomische hartvorm · Atlasmodel';
}
$('sectionToggle').addEventListener('click',()=>{
  state.cutaway=!state.cutaway;
  state.anatomyView=state.cutaway&&atlasRich;
  syncViewControls();
  positionInfo(null);
});
$('detailToggle').addEventListener('click',()=>{
  state.showDetails=!state.showDetails;
  syncViewControls();
});
document.querySelectorAll('[data-heart-side]').forEach(button=>button.addEventListener('click',()=>{
  state.focusSide=button.dataset.heartSide;
  syncViewControls();
  positionInfo(null);
  $('partInfo').textContent=state.focusSide==='left'?
    'Linkerkamer: volg de mitralis- en aortaklep. Vergelijk de beweging met druk en volume.':
    'Rechterkamer: volg de tricuspidalis- en longslagaderklep. De lijnen onder het hart blijven voorbeeldwaarden van de linkerkamer.';
}));
function syncLabelsToggle(){
  // Verberg de volledige naamlaag direct, ook vóór het eerste animatieframe.
  $('labels').hidden=!state.showLabels;
  $('labelLeaders').hidden=!state.showLabels;
  syncLayerControls();
}
document.querySelectorAll('[data-layer]').forEach(button=>button.addEventListener('click',()=>{
  const layer=button.dataset.layer;
  if(layer==='flow')state.showFlow=!state.showFlow;
  else if(layer==='labels')state.showLabels=!state.showLabels;
  else if(layer==='vesselSection'){
    state.vesselSection=!state.vesselSection;
    if(state.vesselSection){state.cutaway=true;state.anatomyView=atlasRich;}
  }else layerVisibility[layer]=!layerVisibility[layer];
  positionInfo(null);
  syncLabelsToggle();
  syncViewControls();
  updateLabels();
  updateFlowOverlay(mechanics(state.t));
}));
$('resetLayers').addEventListener('click',()=>{
  Object.keys(layerVisibility).forEach(layer=>{layerVisibility[layer]=true;});
  state.showFlow=true;
  state.showLabels=false;
  state.vesselSection=false;
  positionInfo(null);
  syncLabelsToggle();
  syncViewControls();
  updateLabels();
  updateFlowOverlay(mechanics(state.t));
});
$('layerMenu').addEventListener('toggle',()=>{
  // Een open laagmenu blijft op mobiel binnen het hartvenster.
  $('layerMenu').classList.toggle('is-open',$('layerMenu').open);
});
$('resetCamera').addEventListener('click',()=>{state.yaw=-.20;state.pitch=.08;state.zoom=5.95;state.pan=[0,0,0];positionInfo(null);});
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
function syncStudy(){
  const {guess,stage:step}=state.study;
  for(const button of document.querySelectorAll('[data-guess]')){
    const chosen=button.dataset.guess===guess;
    button.setAttribute('aria-pressed',String(chosen));
  }
  const action=$('discoveryAction');
  action.disabled=!guess||step==='watch';
  action.textContent=step==='watch'?'Kijk naar het hart…':
    step==='compare'?'Vergelijk je voorspelling':
    step==='done'?'Nog eens proberen':'Bekijk de beweging';
}
document.querySelectorAll('[data-guess]').forEach(button=>button.addEventListener('click',()=>{
  if(state.study.stage==='watch')return;
  state.study.guess=button.dataset.guess;
  state.study.stage='choose';
  $('discoveryFeedback').textContent='Je voorspelling staat vast. Bekijk nu wat er vlak voor het uitpompen gebeurt.';
  syncStudy();
}));
$('discoveryAction').addEventListener('click',()=>{
  const study=state.study;
  if(study.stage==='done'){
    study.stage='choose';study.guess=null;study.stopAt=null;
    $('discoveryFeedback').textContent='Kies opnieuw wat je verwacht.';
    setTime(.58,true);syncStudy();return;
  }
  if(!study.guess)return;
  if(study.stage==='choose'){
    study.stage='watch';
    state.mode='explore';
    state.cutaway=true;state.anatomyView=atlasRich;state.showFlow=true;state.focusSide='left';
    syncLearningMode();
    state.yaw=-.20;state.pitch=.08;
    state.zoom=matchMedia('(max-width: 790px)').matches?6.65:5.4;
    syncViewControls();
    positionInfo(null);
    $('partInfo').textContent='Kijk naar de mitralisklep. Die sluit voordat de aortaklep opent. Beide kleppen komen uit het anatomische bronmodel.';
    // Het onderzoek begint vlak voor de AV-kleppen sluiten.
    setTime(.50,true);
    state.speed=.1;$('speed').value='.1';
    study.stopAt=.90;state.playing=true;syncPlay();
    $('discoveryFeedback').textContent='Kijk naar de kleppen. Wat sluit er, en wat gaat daarna open?';
  }else if(study.stage==='compare'){
    const correct=study.guess==='av';
    $('discoveryFeedback').textContent=(correct?'Je voorspelling klopt. ':'Je voorspelling kwam niet uit. ')+
      'De AV-kleppen sluiten eerst. De slagaderkleppen openen daarna, zodra de kamerdruk hoog genoeg is. Vergelijk de twee lijnen met de beweging.';
    study.stage='done';
    study.stopAt=null;
  }
  syncStudy();
});
// Pointer Events verwerken één en twee vingers, muis en pen op dezelfde manier.
// Zo stuurt een pinch nooit per ongeluk ook de draaiing aan.
const pointers=new Map();
let gesture=null,suppressSelection=false;
const pointerDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pointerCenter=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function cameraPan(dx,dy){
  const worldPerPixel=2*Math.tan(42*Math.PI/360)*state.zoom/Math.max(canvas.clientHeight,1);
  const right=[Math.cos(state.yaw),0,-Math.sin(state.yaw)];
  const up=[-Math.sin(state.yaw)*Math.sin(state.pitch),Math.cos(state.pitch),
    -Math.cos(state.yaw)*Math.sin(state.pitch)];
  const move=add(scl(right,-dx*worldPerPixel),scl(up,dy*worldPerPixel));
  const next=add(state.pan,move);
  const length=Math.hypot(...next);
  state.pan=length>2.1?scl(next,2.1/length):next;
}
function resetGesture(){
  const points=[...pointers.values()];
  if(points.length>=2){
    const a=points[0],b=points[1];
    gesture={mode:'pinch',center:pointerCenter(a,b),distance:Math.max(pointerDistance(a,b),1),
      moved:true};
  }else if(points.length===1){
    const point=points[0];
    gesture={mode:point.pan?'pan':'orbit',last:{...point},start:{...point},moved:false};
  }else gesture=null;
}
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
  e.preventDefault();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,
    pan:e.pointerType==='mouse'&&(e.shiftKey||e.button===2)});
  if(pointers.size>=2)suppressSelection=true;
  try{canvas.setPointerCapture?.(e.pointerId);}catch{ /* Gecancelde of synthetische pointers. */ }
  resetGesture();
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;
  e.preventDefault();
  const prior=pointers.get(e.pointerId);
  pointers.set(e.pointerId,{...prior,x:e.clientX,y:e.clientY});
  if(pointers.size>=2){
    const [a,b]=[...pointers.values()];
    const center=pointerCenter(a,b);
    const distance=Math.max(pointerDistance(a,b),1);
    if(gesture.mode!=='pinch')resetGesture();
    else{
      cameraPan(center.x-gesture.center.x,center.y-gesture.center.y);
      state.zoom=clamp(state.zoom*gesture.distance/distance,3.5,9.5);
      gesture.center=center;gesture.distance=distance;
    }
    return;
  }
  if(gesture.mode!=='orbit'&&gesture.mode!=='pan')resetGesture();
  const dx=e.clientX-gesture.last.x,dy=e.clientY-gesture.last.y;
  if(Math.hypot(e.clientX-gesture.start.x,e.clientY-gesture.start.y)>5)gesture.moved=true;
  if(gesture.mode==='pan')cameraPan(dx,dy);
  else{
    state.yaw+=dx*.008;
    state.pitch=clamp(state.pitch+dy*.007,-1.1,1.1);
  }
  gesture.last={...pointers.get(e.pointerId)};
});
canvas.addEventListener('pointerup',e=>{
  if(!pointers.has(e.pointerId))return;
  const selected=!suppressSelection&&pointers.size===1&&gesture?.mode==='orbit'&&!gesture.moved&&
    Math.hypot(e.clientX-gesture.start.x,e.clientY-gesture.start.y)<=5;
  pointers.delete(e.pointerId);
  if(!pointers.size)suppressSelection=false;
  if(selected){
    const r=canvas.getBoundingClientRect();
    positionInfo(selectedPartAt(e.clientX-r.left,e.clientY-r.top));
  }
  resetGesture();
});
canvas.addEventListener('pointercancel',e=>{
  pointers.delete(e.pointerId);if(!pointers.size)suppressSelection=false;resetGesture();
});
canvas.addEventListener('lostpointercapture',e=>{
  pointers.delete(e.pointerId);if(!pointers.size)suppressSelection=false;resetGesture();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  state.zoom=clamp(state.zoom*Math.exp(e.deltaY*.001),3.5,9.5);
},{passive:false});
canvas.addEventListener('keydown',e=>{
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(directions[e.key]){
    e.preventDefault();
    const [dx,dy]=directions[e.key];
    if(e.shiftKey)cameraPan(dx*32,dy*32);
    else{state.yaw+=dx*.12;state.pitch=clamp(state.pitch+dy*.12,-1.1,1.1);}
  }else if(e.key==='+'||e.key==='='){e.preventDefault();state.zoom=clamp(state.zoom*.87,3.5,9.5);}
  else if(e.key==='-'){e.preventDefault();state.zoom=clamp(state.zoom*1.13,3.5,9.5);}
});
canvas.tabIndex=0;
let resize=new ResizeObserver(()=>{if(gl)render();});resize.observe(stage);
setupModel();syncLearningMode();syncLabelsToggle();syncViewControls();syncStudy();loadAtlasModels();
window.__EAI_HEART_LAB__={
  get state(){return {t:state.t,playing:state.playing,speed:state.speed,yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,pan:[...state.pan],selected:state.selected,cutaway:state.cutaway,showLabels:state.showLabels,showFlow:state.showFlow,vesselSection:state.vesselSection,focusSide:state.focusSide,showDetails:state.showDetails,atlasReady,atlasRich,anatomyView:state.anatomyView,atlasError,atlasPartCount:atlasParts.length,studyStage:state.study.stage,mode:state.mode,guideStep:state.guideStep,layers:{...layerVisibility,vesselSection:state.vesselSection,flow:state.showFlow,labels:state.showLabels}};},
  get visibleAtlasPartIds(){return atlasParts.filter(part=>part.kind!=='space'&&isLayerVisible(part)).map(part=>part.id);},
  // Debugbare projectiepunten voor een echte browserklik in de regressietest.
  get hitTargets(){return Object.entries(selectableParts()).map(([id,part])=>{
    const [x,y,depth]=project(part.pos,pv,canvas.clientWidth,canvas.clientHeight);
    return {id,type:part.type,x,y,visible:depth>0&&x>=0&&y>=0&&x<=canvas.clientWidth&&y<=canvas.clientHeight};
  });},
  get metrics(){return mechanics(state.t);},
  get guide(){return GUIDED_STEPS.map(step=>({at:step.at,title:step.title,focus:step.focus}));},
  get motion(){return {playbackSeconds:60/state.rate/state.speed,
    valveParts:atlasParts.filter(p=>p.kind==='valve').map(p=>p.id),
    flowRoutes:atlasFlowPaths.length};},
  get flowPreview(){return atlasFlowPaths.map(f=>({
    color:f.color,channel:f.channel,ids:f.ids,points:f.curve.length,
    waypoints:f.path.length,source:f.geometrySource||'illustrative',
    active:flowIsActive(f,mechanics(state.t))
  }));},
  setTime:t=>setTime(t,true),pause:()=>{state.playing=false;syncPlay();},
  get rendererReady(){return Boolean(gl)&&(state.cutaway||atlasReady);}
};
function frame(now){
  const dt=state.last?Math.min((now-state.last)/1000,.065):0;state.last=now;
  if(state.playing)state.t=(state.t+dt*state.speed*state.rate/60)%1;
  if(state.study.stage==='watch'&&state.t>=state.study.stopAt){
    state.t=state.study.stopAt;
    state.playing=false;syncPlay();
    state.study.stage='compare';
    $('discoveryFeedback').textContent='Welke kleppen zag je sluiten? Vergelijk nu met je voorspelling.';
    syncStudy();
  }
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
