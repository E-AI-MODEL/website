import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const model=scripts.find(s=>s.includes('function renderExperiment('));
const definitions=scripts.find(s=>s.includes('const labSpecs ='));
const graphics=scripts.find(s=>s.includes('const graphSpecs={'));
assert.ok(model&&definitions&&graphics);
const graphSource=graphics.slice(graphics.indexOf('const graphSpecs={'),graphics.indexOf('function chart('));
const {renderExperiment,labSpecs,graphSpecFor,standingProfile,longitudinalProfile,electricProfile,interferenceProfile}=runInNewContext(
 model+'\n'+definitions+'\n'+graphSource+'\n({renderExperiment,labSpecs,graphSpecFor,standingProfile,longitudinalProfile,electricProfile,interferenceProfile})'
);
function near(actual,expected,tolerance=1e-7){
 assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,actual+' verschilt van '+expected);
}
function makeLab(id,changes={},t=0){
 const spec=labSpecs.find(x=>x[0]===id);assert.ok(spec,id);
 const p=Object.fromEntries(spec[3].map(x=>[x[0],x[5]]));
 Object.assign(p,changes);const events=[];
 const gfx=new Proxy({}, {get(_object,type){return (...args)=>events.push({type,args})}});
 const data=renderExperiment(id,p,t,gfx),domain=graphSpecFor(id,p,t);
 return {id,p,t,events,data,domain,at(x){return data.fn((x-domain.min)/(domain.max-domain.min))}};
}
const number=value=>Number(String(value).match(/-?\d+(?:[.,]\d+)?/)?.[0].replace(',','.'));
const measured=(r,name)=>{const v=r.data.readouts.find(([label])=>label===name);assert.ok(v,'Ontbrekende meetwaarde '+name);return number(v[1]);};

test('Staande golf: de grafiek volgt de getekende snaar op meerdere tijdstippen',()=>{
 for(const n of [1,2,3])for(const t of [0,.37,1.3]){
  const r=makeLab('standing',{n,L:2,v:40},t);
  const path=r.events.find(e=>e.type==='path'&&Array.isArray(e.args[0])&&e.args[0].length===351);
  assert.ok(path,'Snaar ontbreekt');
  for(const i of [0,77,175,290,350]){
   const u=i/350;
   near((250-path.args[0][i][1])/105,r.at(u*r.p.L));
   near(r.data.fn(u),standingProfile(r.p,t,u));
  }
 }
});

test('Uitgebreide staande golf: exact dezelfde uitwijking',()=>{
 const code=graphics.slice(graphics.indexOf('function standingPremium('),graphics.indexOf('const waveCanvas='));
 const strokes=[];
 const premium=runInNewContext(model+'\n'+code+'\nstandingPremium',{background(){},stroke(...a){strokes.push(a)},circle(){},fmt:String});
 const ctx={font:'',fillStyle:'',fillText(){},beginPath(){},arc(){},stroke(){},lineWidth:1};
 const p=makeLab('standing',{n:2,L:2,v:40},.7).p;
 premium(ctx,p,.7);
 const path=strokes.find(x=>x[2]==='#83efe0')?.[1];
 assert.ok(path?.length===301,'Snaargrafiek ontbreekt in de uitgebreide voorstelling');
 near((250-path[91][1])/110,standingProfile(p,.7,91/300));
});

test('Longitudinale golf: luchtdeeltjes en grafiek tonen verplaatsing, geen druk',()=>{
 for(const n of [1,2,4])for(const t of [0,.18,.63]){
  const r=makeLab('longitudinal',{n,L:2,v:60},t);
  const dots=r.events.filter(e=>e.type==='dot');
  assert.equal(dots.length,64);
  assert.match(r.domain.yLabel,/Deeltjesverplaatsing/);
  assert.doesNotMatch(r.data.title,/Drukuitwijking/);
  for(const i of [0,14,31,48,63]){
   const q=i/63;
   near((dots[i].args[0]-(120+755*q))/14,r.data.fn(q));
   near(r.at(q*r.p.L),longitudinalProfile(r.p,t,q));
  }
 }
});

test('Wisselstroom: gemeten stroom, grafiek en bewegende stip hebben dezelfde fase',()=>{
 for(const f of [20,50,60])for(const t of [0,.137,.7,1.31]){
  const r=makeLab('ac',{f,U:12,R:8},t);
  const cursor=r.domain.cursor,y=r.at(cursor);
  near(y,measured(r,'Momentane stroom'),.012);
  assert.equal(r.events.filter(e=>e.type==='path').length,2);
  const tip=r.events.find(e=>e.type==='dot');
  assert.ok(tip,'Momentane stroom heeft geen stip');
  near((280-tip.args[1])/70,y/(Math.SQRT2*12/8),1e-6);
  near(r.domain.max,3/f);
 }
});

test('Elektromagnetische golf: elektrische veldwaarde en grafiek zijn gelijk',()=>{
 for(const lambda of [.5,1.3,3])for(const t of [0,.47,1.8]){
  const r=makeLab('em',{lambda,E:1.3,speed:1.5},t);
  const paths=r.events.filter(e=>e.type==='path');
  assert.ok(paths[0]?.args[0]?.length===271);
  for(const i of [0,55,135,216,270]){
   const q=i/270;
   near((255-paths[0].args[0][i][1])/85,r.data.fn(q),1e-6);
   near(r.at(q*8),electricProfile(r.p,t,q));
  }
 }
 assert.match(graphics,/phase=TAU\*\(s\*8\/p\.lambda-t\*p\.speed\)/);
});

test('Interferentiekaart en meetlijn gebruiken dezelfde voortplantingsfase',()=>{
 const r=makeLab('interference',{lambda:1.5,distance:2.5,phase:90},.65);
 for(const q of [0,.16,.32,.5,.78,1])near(r.data.fn(q),interferenceProfile(r.p,r.t,(q-.5)*7));
 const buffers=[];
 const document={createElement(){return{width:0,height:0,getContext(){return{
  createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},
  putImageData(im){buffers.push(im)}
 }}}}};
 const snippet=graphics.slice(graphics.indexOf('const waveCanvas='),graphics.indexOf('function doublePremium('));
 const premium=runInNewContext(model+'\n'+snippet+'\ninterferencePremium',{document,background(){},circle(){}});
 const arcs=[];
 const ctx={save(){},restore(){},drawImage(){},beginPath(){},arc(...args){arcs.push(args)},stroke(){},fillText(){}};
 premium(ctx,r.p,r.t);
 assert.equal(buffers.length,1);
 assert.equal(arcs.length,18,'Negen golffronten per bron');
 for(const [idx,shift] of [[0,0],[9,r.p.phase/360]]){
  const expected=(((.25+r.t*3.1/(2*Math.PI)-shift)*r.p.lambda*70)%620+620)%620;
  near(arcs[idx][2],expected,1e-6);
 }
 assert.ok(arcs[9][2]<arcs[0][2],'Het tweede golffront volgt het ingestelde faseverschil');
 const w=190,h=98;
 for(const [i,j] of [[20,26],[77,43],[95,51],[151,69],[180,97]]){
  const X=(i/w*1000-500)/70,Y=(j/h*500-260)/70;
  const amplitude=interferenceProfile(r.p,r.t,X,Y),power=(amplitude/2)**2;
  near(buffers[0].data[(j*w+i)*4],Math.round(11+25*power));
 }
});

test('Zwevingen: huidige som staat op het berekende grafiekpunt',()=>{
 for(const t of [0,.28,1.4,2.99]){
  const r=makeLab('beats',{f1:8,f2:9,A:.6},t),q=(t%3)/3;
  near(r.data.fn(q),measured(r,'Som op dit moment'),.012);
  const tip=r.events.find(e=>e.type==='dot');
  assert.ok(tip,'Tijdstip niet op grafiek getoond');
  near((330-tip.args[1])/65,r.data.fn(q),1e-6);
  near(tip.args[0],90+828*q);
 }
});

test('Radioactief verval: tijdstip, meetwaarde en curve zijn identiek',()=>{
 for(const T of [2,7,20])for(const t of [0,11,70,111]){
  const r=makeLab('decay',{N:600,T},t);
  const expected=((t%(6*T))+6*T)%(6*T);
  near(measured(r,'Tijd'),expected,.012);
  near(r.domain.cursor,expected);
  near(r.at(expected),measured(r,'Verwacht aantal'),.06);
 }
});
