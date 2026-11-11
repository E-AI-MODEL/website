import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const model=scripts.find(s=>s.includes('function renderExperiment('));
const definitions=scripts.find(s=>s.includes('const labSpecs ='));
const graph=scripts.find(s=>s.includes('const graphSpecs={'));
assert.ok(model&&definitions&&graph,'Modelcode, regelaargegevens en grafiekbeschrijvingen ontbreken');
const graphSource=graph.slice(graph.indexOf('const graphSpecs={'),graph.indexOf('function chart('));
const runtime=runInNewContext(model+'\n'+definitions+'\n'+graphSource+'\n({graphSpecs,graphSpecFor,samplePhysical,renderExperiment,labSpecs})');
const {graphSpecs,graphSpecFor,samplePhysical,renderExperiment,labSpecs}=runtime;
const G=new Proxy({}, {get(){return ()=>{}}});
function sample(id,changes={},time=0){
 const row=labSpecs.find(x=>x[0]===id);
 assert.ok(row,id);
 const p=Object.fromEntries(row[3].map(x=>[x[0],x[5]]));
 Object.assign(p,changes);
 return {p,data:renderExperiment(id,p,time,G),domain:graphSpecFor(id,p,time)};
}
function near(actual,expected,tol=.03){
 assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tol,actual+' versus '+expected);
}
const at=(testCase,x)=>{
 const q=(x-testCase.domain.min)/(testCase.domain.max-testCase.domain.min);
 assert.ok(q>=0&&q<=1,'Waarde buiten getoond grafiekbereik');
 return testCase.data.fn(q);
};

test('Alle 53 grafieken hebben eigen assen, eenheden en een geldig fysisch bereik',()=>{
 assert.equal(labSpecs.length,53);
 assert.equal(Object.keys(graphSpecs).length,53);
 for(const lab of labSpecs){
  const id=lab[0];
  assert.ok(Object.hasOwn(graphSpecs,id),id);
  for(const mix of [0,.5,1]){
   const controls=Object.fromEntries(lab[3].map(c=>[c[0],c[3]+(c[4]-c[3])*mix]));
   const x=graphSpecFor(id,controls,0);
   assert.ok(x.xLabel.length>5&&x.yLabel.length>5,id);
   assert.ok(Number.isFinite(x.min)&&Number.isFinite(x.max)&&x.min<x.max,id+': '+x.min+'..'+x.max);
   assert.doesNotMatch(x.xLabel,/Relatief proefbereik|onbekend|undefined/i,id);
   assert.doesNotMatch(x.yLabel,/^Grafiek$|^Waarde$/i,id);
  }
 }
});

test('Werkelijke horizontale grootheden kloppen met getoonde berekeningen',()=>{
 const acceleration=sample('acceleration',{v0:3,a:2});
 near(at(acceleration,2),10);
 const ohm=sample('ohm',{U:12,R:8});near(at(ohm,12),1.5);
 const hydro=sample('hydro',{rho:1000,g:9.81,depth:10});near(at(hydro,10),98100);
 const projectile=sample('projectile',{v:20,angle:45,g:10});
 near(at(projectile,projectile.domain.max/2),10);
 const photo=sample('photo',{f:1,W:2.3});
 near(at(photo,1),4.135667696-2.3);
 const magnetwire=sample('magnetwire',{I:10,r:5});
 near(at(magnetwire,5),40);
 const dec=sample('decay',{N:600,T:8});
 near(at(dec,24),75);
 const gamma=sample('dilation',{beta:.6});near(at(gamma,.6),1.25);
 const refr=sample('refraction',{angle:30,n1:1,n2:1.5});
 near(at(refr,30),Math.asin(1/3)*180/Math.PI,.05);
 const bohr=sample('bohr',{n1:3});
 near(at(bohr,3),-13.6/9,.05);
});

test('Elke bewaarde grafiek behoudt zijn eigen x-schaal bij vergelijking',()=>{
 const old={min:0,max:10},now={min:0,max:20};
 const y=x=>x*10;
 const oldOnNew=samplePhysical(y,old,now);
 const newOnNew=samplePhysical(y,now,now);
 near(oldOnNew[60][1],5); // 5 seconden op oude as: 50% van 10
 near(newOnNew[60][1],2.5); // 5 seconden op nieuwe as: 25% van 20
 assert.ok(Number.isNaN(oldOnNew[180][1]),'Een oude meting mag niet buiten haar domein doorlopen');
 const reverse=samplePhysical(y,{min:5,max:15},{min:0,max:20});
 assert.ok(Number.isNaN(reverse[0][1]));
 near(reverse[120][1],5);
});

test('Negatieve grootheden, discontinuïteiten en nulpuntsituaties blijven te tekenen',()=>{
 const virtual=sample('lens',{f:6,u:4});
 assert.ok(at(virtual,4)<0);
 const pole=sample('lens',{f:6,u:6});
 assert.ok(Number.isNaN(at(pole,6)));
 const stopped=sample('doppler',{vs:0,f:440,v:340});
 assert.ok(stopped.domain.max>stopped.domain.min);
 near(at(stopped,0),440);
 const total=sample('refraction',{n1:1.5,n2:1,angle:60});
 const atHigh=at(total,60);
 assert.ok(Number.isNaN(atHigh));
 const spring=sample('spring',{m:2,k:30,A:.5},0);
 near(at(spring,0),.5);
});
