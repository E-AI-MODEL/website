// Execute the actual inline calculation functions, not a reimplementation.
// No DOM, network calls or UI animation are required for this numerical test.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../',import.meta.url);
const read = path => fs.readFileSync(new URL(path,root),'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const mw=read('content/science-observatory/labs/melkweg.html');
const leo=read('content/science-observatory/labs/leeuw.html');
const data=JSON.parse(read('tests/fixtures/astronomy-rotation-curves.json'));
const extract=(text,regex,label)=>{const m=text.match(regex);assert.ok(m,label+' not found');return m[0]};
const constants=extract(mw,/const G=[^\n;]+;/,'constants');
const defaults=extract(mw,/model:\{disk:[\d.]+,bulge:[\d.]+,halo:[\d.]+,sigma:[\d.]+\}/,'default model').slice(6);
const a=mw.indexOf('function nfwF('),b=mw.indexOf('function recalcOmega(',a);
assert.ok(a>=0&&b>a,'actual gravity functions');
const context=vm.createContext({});
vm.runInContext(constants+';const state={model:'+defaults+'};'+mw.slice(a,b)+';globalThis.api={vParts,orbitPeriod,toomreQ,state,G,R0,MBH};',context);
const {vParts,orbitPeriod,toomreQ,state,G,R0,MBH}=context.api;
const base={...state.model};
const cases=[
 {id:'default',...base},
 {id:'low_disk',...base,disk:2},
 {id:'high_disk',...base,disk:9},
 {id:'low_bulge',...base,bulge:.2},
 {id:'high_bulge',...base,bulge:2.2},
 {id:'low_halo',...base,halo:.2},
 {id:'high_halo',...base,halo:2},
 {id:'combined_low',disk:2,bulge:.2,halo:.2,sigma:15},
 {id:'combined_high',disk:9,bulge:2.2,halo:2,sigma:65}
];
const radii=[...new Set([...Array.from({length:191},(_,i)=>1+i*.1),R0,...data.series.flatMap(s=>s.rows.map(row=>row[0]))])].sort((a,b)=>a-b);
const results=cases.map(({id,...params})=>{
 Object.assign(state.model,params);
 return {id,params,rows:radii.map(radius=>{
   const speed=vParts(radius);return {radius,...speed,period_myr:orbitPeriod(radius),q:toomreQ(radius)};
 })};
});
Object.assign(state.model,base);
const source=leo.match(/<script id="leo-data"[^>]*>([\s\S]*?)<\/script>/);
const model=leo.match(/<script id="leo-model">([\s\S]*?)<\/script>/);
assert.ok(source&&model,'actual stellar source and model');
const w={};
const lc=vm.createContext({window:w,document:{getElementById:id=>{assert.equal(id,'leo-data');return {textContent:source[1]}}}});
vm.runInContext(model[1],lc);
const M=w.LEO_MODEL;
const stars=M.stars.map(s=>({id:s.id,name:s.name,source:s.source,ra_deg:s.ra/M.D,dec_deg:s.dec/M.D,ra_hms:s.rah,dec_dms:s.dech,parallax_mas:s.p,parallax_error_mas:s.e,distance_ly:s.d,lower_ly:s.lo,upper_ly:s.hi,xyz_ly:s.r}));
const pairs=[];
for(let i=0;i<M.stars.length;i++)for(let j=i+1;j<M.stars.length;j++){
 const x=M.stars[i],y=M.stars[j];
 pairs.push({a:x.id,b:y.id,angle_deg:M.angle(x.u,y.u),separation_ly:M.separation(x.r,y.r)});
}
process.stdout.write(JSON.stringify({sha256:{melkweg:hash(mw),leeuw:hash(leo),fixture:hash(read('tests/fixtures/astronomy-rotation-curves.json'))},constants:{G,R0,MBH},base,cases:results,stars,pairs}));
