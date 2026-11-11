// Hartslaglab: schematische anatomie voor een verkenbare 3D-doorsnede.
// Coördinaten: +x = anatomisch links (rechts op het scherm); +z = voorzijde.
// Geometrie is educatief en niet afkomstig uit een klinisch gevalideerde scan.
const TAU=Math.PI*2;
const vadd=(a,b)=>a.map((x,i)=>x+b[i]);
const vsub=(a,b)=>a.map((x,i)=>x-b[i]);
const vmul=(a,s)=>a.map(x=>x*s);
const vnorm=a=>vmul(a,1/(Math.hypot(...a)||1));
const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const push=(out,p,n)=>{out.xyz.push(...p);out.normal.push(...n);};
function triangle(out,a,b,c,na,nb,nc){
  push(out,a,na);push(out,b,nb);push(out,c,nc);
}
const collector=()=>({xyz:[],normal:[]});
const result=o=>({v:new Float32Array(o.xyz),n:new Float32Array(o.normal),count:o.xyz.length/3});
const smooth=(p,a,b)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};

export const CHAMBERS={
  ra:{label:'Rechterboezem',pos:[-.57,.58,.37],scale:[.49,.41,.39],wall:.14,cut:.79,kind:'atrium',blood:[.15,.39,.59],muscle:[.60,.39,.39]},
  rv:{label:'Rechterkamer',pos:[-.43,-.34,.22],scale:[.58,.74,.48],wall:.15,cut:.78,kind:'ventricle',blood:[.12,.34,.54],muscle:[.68,.39,.36]},
  la:{label:'Linkerboezem',pos:[.51,.57,-.18],scale:[.48,.40,.39],wall:.14,cut:.78,kind:'atrium',blood:[.65,.26,.24],muscle:[.70,.44,.39]},
  lv:{label:'Linkerkamer',pos:[.43,-.39,-.24],scale:[.66,.83,.53],wall:.28,cut:.76,kind:'ventricle',blood:[.60,.21,.18],muscle:[.80,.46,.40]}
};
export const VESSELS=[
  {id:'ao',label:'Aorta',color:[.87,.38,.31],radius:.139,
    path:[[.38,.16,-.12],[.52,.45,-.16],[.68,1.13,-.19],[.39,1.59,-.29],[-.18,1.49,-.39],[-.50,1.14,-.45]]},
  {id:'ao_b1',label:'Aortatak 1',color:[.79,.33,.27],radius:.055,
    path:[[.30,1.60,-.29],[.29,1.82,-.28],[.17,2.06,-.32]]},
  {id:'ao_b2',label:'Aortatak 2',color:[.79,.33,.27],radius:.051,
    path:[[.05,1.56,-.34],[-.01,1.83,-.35],[-.04,2.01,-.38]]},
  {id:'ao_b3',label:'Aortatak 3',color:[.79,.33,.27],radius:.055,
    path:[[-.18,1.48,-.39],[-.39,1.77,-.42],[-.58,1.91,-.46]]},
  {id:'pa',label:'Longslagader',color:[.22,.54,.73],radius:.137,
    path:[[-.44,.09,.38],[-.60,.51,.47],[-.76,1.10,.51],[-.97,1.32,.51]]},
  {id:'pa_left',label:'Longslagader (tak)',color:[.23,.56,.76],radius:.087,
    path:[[-.84,1.18,.51],[-.44,1.40,.50],[.28,1.36,.42],[.67,1.23,.35]]},
  {id:'pa_right',label:'Longslagader (tak)',color:[.25,.59,.79],radius:.077,
    path:[[-.92,1.25,.53],[-1.34,1.26,.56],[-1.65,1.16,.56]]},
  {id:'svc',label:'Bovenste holle ader',color:[.18,.49,.71],radius:.136,
    path:[[-.79,2.00,.28],[-.74,1.50,.35],[-.66,1.03,.36],[-.58,.75,.38]]},
  {id:'ivc',label:'Onderste holle ader',color:[.18,.49,.70],radius:.11,
    path:[[-.99,-1.37,-.05],[-1.01,-.65,-.06],[-.86,.04,.09],[-.65,.44,.29]]},
  {id:'pv1',label:'Longader',color:[.85,.39,.32],radius:.100,
    path:[[1.52,.91,-.20],[1.03,.77,-.19],[.61,.60,-.17]]},
  {id:'pv2',label:'Longader',color:[.84,.38,.31],radius:.085,
    path:[[1.52,.51,-.26],[1.05,.48,-.24],[.61,.54,-.18]]}
];
export const VALVES=[
  {id:'tricuspid',label:'Tricuspidalisklep',pos:[-.50,.13,.49],leaflets:3,type:'av',blood:'blue'},
  {id:'mitral',label:'Mitralisklep',pos:[.47,.13,.04],leaflets:2,type:'av',blood:'red'},
  {id:'pulmonary',label:'Longslagaderklep',pos:[-.58,.43,.49],leaflets:3,type:'sem',blood:'blue'},
  {id:'aortic',label:'Aortaklep',pos:[.55,.45,-.04],leaflets:3,type:'sem',blood:'red'}
];
export const ANATOMY_PARTS={
  ...Object.fromEntries(Object.entries(CHAMBERS).map(([id,v])=>[id,{label:v.label,pos:v.pos,type:'chamber'}])),
  ao:{label:'Aorta',pos:[.63,1.26,-.18],type:'vessel'},
  pa:{label:'Longslagader',pos:[-.84,1.10,.52],type:'vessel'},
  tricuspid:{label:'Tricuspidalisklep',pos:VALVES[0].pos,type:'valve'},
  mitral:{label:'Mitralisklep',pos:VALVES[1].pos,type:'valve'},
  pulmonary:{label:'Longslagaderklep',pos:VALVES[2].pos,type:'valve'},
  aortic:{label:'Aortaklep',pos:VALVES[3].pos,type:'valve'},
  septum:{label:'Harttussenschot',pos:[.015,-.39,.50],type:'septum'}
};
// Bewegende zichtbare deeltjes volgen herkenbare routes. Hun aantal is geen bloeddebiet.
export const FLOW_PATHS=[
  {color:'blue',path:[[-.80,1.87,.33],[-.69,1.05,.39],[-.57,.68,.45]],channel:'return',n:11},
  {color:'blue',path:[[-.60,.54,.49],[-.50,.20,.53],[-.41,-.32,.57]],channel:'av',n:14},
  {color:'blue',path:[[-.40,-.43,.54],[-.46,.14,.55],[-.61,.53,.59],[-.92,1.26,.60],[-1.35,1.19,.62]],channel:'sem',n:14},
  {color:'red',path:[[1.42,.89,-.10],[.92,.73,-.11],[.54,.58,.03]],channel:'return',n:10},
  {color:'red',path:[[.51,.54,.08],[.49,.21,.11],[.45,-.39,.17]],channel:'av',n:14},
  {color:'red',path:[[.45,-.47,.22],[.46,.12,.14],[.57,.53,.08],[.71,1.17,-.04],[.38,1.51,-.14],[-.15,1.48,-.23]],channel:'sem',n:14}
];
function ellipsoidPoint(u,v,ventricle,inside,cutStyle){
  // Vorm naar de hartpunt bij de kamers: onder smaller, aan de bovenzijde breder.
  let x=Math.sin(u)*Math.cos(v),y=Math.sin(u)*Math.sin(v),z=Math.cos(u);
  if(ventricle){
    const narrow=.78+.20*smooth(y,-.85,.75);
    x*=narrow;
    y-=.08*(1-y*y);
    z*=1+.06*y;
    x+=.095*y;
  }
  if(cutStyle)z+=.035;
  const factor=inside?1:1;
  return [x*factor,y*factor,z*factor];
}
function ellipsoidNormal(p,inside){
  const n=vnorm([p[0]*.90,p[1]*.90,p[2]*1.10]);
  return inside?vmul(n,-1):n;
}
// FRONT FACES OMITTED: pupil can actually see tissue thickness and the cavities.
export function chamberGeometry(chamber){
  const outer=collector(),inner=collector(),rim=collector(),solid=collector();
  const steps=28,radial=52;
  const cut=chamber.cut,vent=chamber.kind==='ventricle',ratio=1-chamber.wall;
  function p(theta,phi,innerLayer=false){
    const a=ellipsoidPoint(theta,phi,vent,innerLayer,false);
    return innerLayer?vmul(a,ratio):a;
  }
  for(let i=0;i<steps;i++){
    const a=cut+(Math.PI-cut)*i/steps,b=cut+(Math.PI-cut)*(i+1)/steps;
    for(let j=0;j<radial;j++){
      const th=j*TAU/radial,ne=(j+1)*TAU/radial;
      for(const [out,isInner] of [[outer,false],[inner,true]]){
        const A=p(a,th,isInner),B=p(b,th,isInner),C=p(b,ne,isInner),D=p(a,ne,isInner);
        const nA=ellipsoidNormal(A,isInner),nB=ellipsoidNormal(B,isInner),nC=ellipsoidNormal(C,isInner),nD=ellipsoidNormal(D,isInner);
        triangle(out,A,B,C,nA,nB,nC);triangle(out,A,C,D,nA,nC,nD);
      }
    }
  }
  for(let j=0;j<radial;j++){
    const th=j*TAU/radial,ne=(j+1)*TAU/radial;
    const A=p(cut,th),B=p(cut,ne),C=p(cut,ne,true),D=p(cut,th,true);
    const n=vnorm([Math.cos(th),Math.sin(th),.55]);
    const nn=vnorm([Math.cos(ne),Math.sin(ne),.55]);
    triangle(rim,A,C,B,n,nn,nn);triangle(rim,A,D,C,n,n,nn);
  }
  const full=38;
  for(let i=0;i<full;i++)for(let j=0;j<radial;j++){
    const a=Math.PI*i/full,b=Math.PI*(i+1)/full,th=j*TAU/radial,ne=(j+1)*TAU/radial;
    const A=p(a,th),B=p(b,th),C=p(b,ne),D=p(a,ne);
    triangle(solid,A,B,C,ellipsoidNormal(A),ellipsoidNormal(B),ellipsoidNormal(C));
    triangle(solid,A,C,D,ellipsoidNormal(A),ellipsoidNormal(C),ellipsoidNormal(D));
  }
  return {outer:result(outer),inner:result(inner),rim:result(rim),solid:result(solid)};
}
const catmull=(p0,p1,p2,p3,t)=>{
  const t2=t*t,t3=t2*t;
  return [0,1,2].map(i=>.5*((2*p1[i])+(-p0[i]+p2[i])*t+
    (2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+
    (-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3));
};
export function smoothPath(points,steps=8){
  if(points.length<2)throw new Error('Een bloedvat heeft minimaal twee punten nodig');
  const result=[];
  for(let i=0;i<points.length-1;i++)for(let n=0;n<steps;n++){
    result.push(catmull(points[Math.max(i-1,0)],points[i],points[i+1],points[Math.min(i+2,points.length-1)],n/steps));
  }
  result.push([...points[points.length-1]]);
  return result;
}
export function tubeGeometry(path,radius=.10,segments=14){
  const points=smoothPath(path,6),out=collector();
  function ring(i,j){
    const p=points[i],t=vnorm(vsub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]));
    const right=vnorm(vcross(Math.abs(t[1])>.92?[1,0,0]:[0,1,0],t));
    const up=vnorm(vcross(t,right));
    const angle=TAU*j/segments;
    const normal=vadd(vmul(right,Math.cos(angle)),vmul(up,Math.sin(angle)));
    // Slight taper at the open ends. These vessels do not represent vessel wall layers.
    const taper=.88+.12*Math.sin(Math.PI*i/(points.length-1));
    return [vadd(p,vmul(normal,radius*taper)),normal];
  }
  for(let i=0;i<points.length-1;i++)for(let j=0;j<segments;j++){
    const A=ring(i,j),B=ring(i+1,j),C=ring(i+1,j+1),D=ring(i,j+1);
    triangle(out,A[0],B[0],C[0],A[1],B[1],C[1]);
    triangle(out,A[0],C[0],D[0],A[1],C[1],D[1]);
  }
  return result(out);
}
// Atrio-ventricular: two (mitral) or three (tricuspid) cusps;
// semilunar: three cusps and no chordae tendineae.
export function leafletGeometry(valve,opening){
  const out=collector(),n=valve.leaflets;
  const radius=valve.type==='sem'?.18:.23,opens=Math.max(0,Math.min(1,opening));
  const ydir=valve.type==='sem'?1:-1;
  for(let i=0;i<n;i++){
    const start=TAU*i/n,end=TAU*(i+1)/n,mid=(start+end)*.5;
    const edge1=[radius*Math.cos(start),-.06*Math.sin(start),radius*.70*Math.sin(start)];
    const edge2=[radius*Math.cos(end),-.06*Math.sin(end),radius*.70*Math.sin(end)];
    const middle=[radius*Math.cos(mid)*.90,-.06*Math.sin(mid),radius*.65*Math.sin(mid)];
    const tip=[radius*Math.cos(mid)*(.12+opens*.98),
      ydir*(.035+opens*(valve.type==='sem'?.20:.27)),
      .03+radius*Math.sin(mid)*(.10+opens*.75)];
    const m1=vadd(vmul(edge1,.45),vmul(tip,.55)),m2=vadd(vmul(edge2,.45),vmul(tip,.55));
    // Curved two-part leaflet with visible fold on the front surface.
    const normal=vnorm(vcross(vsub(edge2,edge1),vsub(tip,edge1)));
    triangle(out,edge1,middle,m1,normal,normal,normal);
    triangle(out,middle,edge2,m2,normal,normal,normal);
    triangle(out,m1,middle,m2,normal,normal,normal);
    triangle(out,m1,m2,tip,normal,normal,normal);
  }
  return result(out);
}
export function ringGeometry(radius=.22,thickness=.022,steps=32){
  const pts=[];for(let i=0;i<=steps;i++){const a=TAU*i/steps;pts.push([Math.cos(a)*radius,-Math.sin(a)*.065,Math.sin(a)*radius*.72]);}
  return tubeGeometry(pts,thickness,8);
}
// A raised, slightly curved partition, not a connection between the two ventricles.
export function septumGeometry(){
  const o=collector(),rows=20;
  for(let i=0;i<rows;i++){
    const t=i/rows,next=(i+1)/rows;
    const point=(v,side)=>{
      const y=.19-1.37*v,arc=Math.sin(Math.PI*v);
      return [.02-.065*v+side*.06, y, .42+arc*.085+side*.028];
    };
    for(const side of [-1,1]){
      const a=point(t,side),b=point(next,side),c=point(next,-side),d=point(t,-side);
      if(side===1){const n=[0,0,1];triangle(o,a,b,c,n,n,n);triangle(o,a,c,d,n,n,n);}
    }
  }
  return result(o);
}
// Small myocardial ridges for depth in the exposed chamber cavities.
export function muscleRidges(chamber){
  const ridges=[],pos=chamber.pos,scale=chamber.scale;
  if(chamber.kind!=='ventricle')return ridges;
  for(const side of [-1,1]){
    for(let i=0;i<3;i++){
      const x=side*(.13+.10*i),z=.23+.05*Math.sin(i),start=-.13-i*.11;
      ridges.push({path:[[x,start,z],[x*.83,start-.25,z+.06],[x*.52,start-.46,z+.035]],
        radius:.012+i*.0025,color:[.90,.56,.49]});
    }
  }
  return ridges;
}
// Schematic cords from the mitral and tricuspid valve to papillary muscles.
export const TENDINOUS_CORDS=[
  {ventricle:'rv',path:[[-.60,.12,.56],[-.57,-.13,.56],[-.59,-.43,.60]]},
  {ventricle:'rv',path:[[-.36,.12,.55],[-.29,-.12,.55],[-.30,-.47,.57]]},
  {ventricle:'lv',path:[[.28,.13,.10],[.29,-.10,.17],[.31,-.44,.22]]},
  {ventricle:'lv',path:[[.65,.13,.09],[.64,-.12,.18],[.65,-.48,.22]]}
];
export function geometryAudit(){
  const rv=chamberGeometry(CHAMBERS.rv),lv=chamberGeometry(CHAMBERS.lv);
  return {ventricles:2,atria:2,valves:VALVES.length,
    avCusps:VALVES.filter(v=>v.type==='av').map(v=>v.leaflets),
    semCusps:VALVES.filter(v=>v.type==='sem').map(v=>v.leaflets),
    leftWall:CHAMBERS.lv.wall,rightWall:CHAMBERS.rv.wall,
    polygons:[rv.outer.count,rv.inner.count,lv.outer.count,lv.inner.count]};
}
