import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const register=JSON.parse(readFileSync(new URL('../content/science-observatory/natuurkunde-kwaliteit.json',import.meta.url),'utf8'));
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const model=scripts.find(x=>x.includes('function renderExperiment('));
const definitions=scripts.find(x=>x.includes('const labSpecs ='));
const app=scripts.find(x=>x.includes('const physicsEvidence='));
assert.ok(model && definitions && app);
const specs=new Function(definitions+';return labSpecs')();
const render=new Function(model+';return renderExperiment')();
const evidenceMatch=app.match(/const physicsEvidence=(\{[^\n]+\});/);
assert.ok(evidenceMatch,'Bronnenoverzicht ontbreekt');
const sources=JSON.parse(evidenceMatch[1]);
const gfx=new Proxy({}, {get(){return ()=>{};}});
const pilot=['lever','collision','gas','bohr','chains'];
function trial(id,values={},t=0){
 const spec=specs.find(x=>x[0]===id);
 assert.ok(spec,id);
 const p=Object.fromEntries(spec[3].map(r=>[r[0],r[5]]));
 return render(id,Object.assign(p,values),t,gfx);
}
function measured(info,label){
 const row=info.readouts.find(r=>r[0]===label);
 assert.ok(row,label);
 const match=String(row[1]).match(/-?\d[\d.,]*/);
 assert.ok(match,label);
 return Number(match[0].replaceAll('.','').replace(',','.'));
}
function near(a,b,eps=.02){assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,'Uitkomst '+a+' verschilt van referentie '+b);}

test('Vijf bronkaarten bevatten afleiding, aannames en vindbare hoofdstukken',()=>{
 assert.deepEqual(Object.keys(sources).sort(),pilot.slice().sort());
 for(const id of pilot){
  const d=sources[id];assert.ok(d.level&&d.theory&&d.derivation&&d.limitations,id);
  assert.ok(d.sources.length>=1,id);
  for(const link of d.sources){
   assert.ok(/^https:\/\/(openstax\.org|ocw\.mit\.edu)\//.test(link.url),id);
   assert.ok(link.name.length>25,id);
  }
 }
 assert.match(html,/id="insightTeacher"/);
 assert.match(html,/id="graphTeacher"/);
 assert.match(html,/function updateTeacherEvidence\(id\)/);
 assert.match(html,/for\(const el of \[\$\('insightMathContent'\),\$\('graphMathContent'\)\]\)/);
});
test('Het register houdt alle 53 expliciet op niet inhoudelijk gevalideerd',()=>{
 assert.equal(register.proeven.length,53);
 assert.deepEqual(register.proeven.map(x=>x.id).sort(),Array.from(specs,x=>x[0]).sort());
 for(const x of register.proeven){
  assert.equal(x.inhoudelijk_gevalideerd,false,x.id);
  assert.equal(x.vakdocent_nagezien,false,x.id);
  assert.equal(x.bronstatus,'bronverwijzing_toegevoegd',x.id);
  assert.equal(x.referentietest,['cradle','magnetbar'].includes(x.id)?'kwalitatieve_modelcheck':'test_toegevoegd',x.id);
 }
});
test('Hefboom: krachtmomenten onafhankelijk nagerekend',()=>{
 for(const p of [{F:9,arm1:2,arm2:3},{F:20,arm1:1.5,arm2:2.5},{F:6.4,arm1:3.8,arm2:.8}]){
  const r=trial('lever',p);
  near(measured(r,'Tegenkracht rechts'),p.F*p.arm1/p.arm2);
  near(r.insight.bars[0][1],r.insight.bars[1][1],1e-10);
 }
});
test('Botsingen: impuls, energie en restitutie',()=>{
 for(const p of [{m1:3,m2:5,e:0},{m1:3,m2:5,e:.5},{m1:3,m2:5,e:1},{m1:9,m2:2,e:.75}]){
  const u1=4,u2=-1,pi=p.m1*u1+p.m2*u2;
  const v1=(pi-p.m2*p.e*(u1-u2))/(p.m1+p.m2),v2=v1+p.e*(u1-u2);
  const E0=(p.m1*u1*u1+p.m2*u2*u2)/2,E1=(p.m1*v1*v1+p.m2*v2*v2)/2;
  const r=trial('collision',p);
  near(measured(r,'Snelheid 1 na botsing'),v1);
  near(measured(r,'Snelheid 2 na botsing'),v2);
  near(measured(r,'Impuls totaal'),p.m1*v1+p.m2*v2);
  near(measured(r,'Verlies bewegingsenergie'),E0-E1);
  if(p.e===1)near(E0,E1,1e-10);
  if(p.e<1)assert.ok(E1<E0);
 }
});
test('Ideale gaswet: drie processtanden, liter en kPa',()=>{
 for(const p of [{T:300,V:4,mode:0},{T:275,V:6.5,mode:1},{T:440,V:9,mode:2}]){
  const expected=8.314*p.T/p.V;
  near(measured(trial('gas',p),'Druk'),expected);
  near(expected*p.V,8.314*p.T,1e-9);
 }
});
test('Bohr: emissie, absorptie en geen overgang',()=>{
 for(const [n1,n2] of [[3,2],[2,4],[4,4],[6,1]]){
  const r=trial('bohr',{n1,n2});
  near(measured(r,'Energieverschil'),13.6*Math.abs(1/n2**2-1/n1**2));
  const process=r.readouts.find(x=>x[0]==='Proces')?.[1];
  assert.equal(process,n1>n2?'Emissie':n1<n2?'Absorptie':'Geen overgang');
  if(n1===n2)assert.equal(r.readouts.find(x=>x[0].startsWith('Foton'))?.[1],'–');
 }
});
function numericalDecay(N0,l1,l2,t){
 const steps=4000,dt=t/steps;
 let A=N0,B=0;
 const diff=(a,b)=>[-l1*a,l1*a-l2*b];
 for(let k=0;k<steps;k++){
  const [a1,b1]=diff(A,B),[a2,b2]=diff(A+a1*dt/2,B+b1*dt/2);
  const [a3,b3]=diff(A+a2*dt/2,B+b2*dt/2),[a4,b4]=diff(A+a3*dt,B+b3*dt);
  A+=(a1+2*a2+2*a3+a4)*dt/6;
  B+=(b1+2*b2+2*b3+b4)*dt/6;
 }
 return [A,B];
}
test('Vervalreeks: onafhankelijke numerieke integratie, ook bij bijna gelijke halfwaardetijden',()=>{
 for(const [T1,T2,t] of [[10,20,17],[20,10,45],[20,20,20],[20,20.000001,30],[20.000001,20,30]]){
  const r=trial('chains',{T1,T2,N:500},t),[A,B,C]=r.insight.bars.map(x=>x[1]);
  const [refA,refB]=numericalDecay(500,Math.LN2/T1,Math.LN2/T2,t);
  near(A,refA,1e-6);near(B,refB,1e-6);near(A+B+C,500,1e-7);
  assert.ok(B>=0&&C>=0);
 }
});
