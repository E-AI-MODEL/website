import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const definition=scripts.find(x=>x.includes('const labSpecs ='));
const model=scripts.find(x=>x.includes('function renderExperiment('));
assert.ok(definition&&model);
const labSpecs=runInNewContext(definition+';labSpecs');
const renderExperiment=runInNewContext(model+';renderExperiment');
const gfx=new Proxy({}, {get(){return ()=>{};}});
const ids=['acceleration','resolution','pulleys','lever','incline','newton2','projectile','collision','carousel','hydro','ohm','gas','bohr','chains','decay'];
function modelAt(id,changes={},t=0){
 const spec=labSpecs.find(r=>r[0]===id);
 assert.ok(spec,id);
 const p=Object.fromEntries(spec[3].map(r=>[r[0],r[5]]));
 Object.assign(p,changes);
 return renderExperiment(id,p,t,gfx);
}
const number=text=>Number(String(text).match(/-?\d[\d.,]*/)?.[0].replaceAll('.','').replace(',','.'));
const measured=(r,label)=>number(r.readouts.find(x=>x[0]===label)?.[1]);
const close=(a,b,eps=.025)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('53 proeven blijven aanwezig en 15 krijgen een live berekening',()=>{
 assert.equal(labSpecs.length,53);
 for(const id of ids){
  for(const t of [0,1.25,3.75]){
   const info=modelAt(id,{},t),insight=info.insight;
   assert.ok(insight?.formula&&insight.substitution&&insight.answer&&insight.note,id);
   if(insight.bars)for(const row of insight.bars)assert.ok(Number.isFinite(row[1])&&row[1]>=0,id);
  }
 }
});
test('hefboom: ingevulde kracht is dezelfde als de gemeten tegenkracht',()=>{
 for(const p of [{F:9,arm1:2,arm2:3},{F:14,arm1:3,arm2:1.5}]){
  const r=modelAt('lever',p),v=p.F*p.arm1/p.arm2;
  close(number(r.insight.answer),v);close(measured(r,'Tegenkracht rechts'),v);
  close(r.insight.bars[0][1],r.insight.bars[1][1],1e-8);
 }
});
test('botsing: energiebalken volgen impuls en restitutie',()=>{
 for(const e of [0,.5,1]){
  const r=modelAt('collision',{m1:3,m2:5,e});
  const [before,after,loss]=r.insight.bars.map(x=>x[1]);
  close(before-after,loss,1e-8);
  close(loss,measured(r,'Verlies bewegingsenergie'),.02);
  if(e===1)close(loss,0,1e-9);
 }
});
test('hellend vlak: krachtcomponenten en maximale wrijving',()=>{
 for(const angle of [10,28,55]){
  const p={m:6,angle,mu:.15},r=modelAt('incline',p);
  close(r.insight.bars[1][1],p.m*9.81*Math.sin(angle*Math.PI/180),1e-8);
  close(r.insight.bars[2][1],p.m*9.81*Math.cos(angle*Math.PI/180),1e-8);
  close(r.insight.bars[3][1],p.mu*r.insight.bars[2][1],1e-8);
 }
});
test('verval: moeder, dochter en stabiel blijven samen gelijk aan beginpopulatie',()=>{
 for(const t of [0,2,10,25]){
  const r=modelAt('chains',{},t);
  close(r.insight.bars.reduce((sum,row)=>sum+row[1],0),500,1e-6);
 }
});
test('Bohr: fotonenergie en niveauverschil komen overeen',()=>{
 for(const [n1,n2] of [[4,2],[3,1],[2,4]]){
  const r=modelAt('bohr',{n1,n2});
  close(number(r.insight.answer),13.6*Math.abs(1/(n1*n1)-1/(n2*n2)),.005);
  close(measured(r,'Energieverschil'),number(r.insight.answer),.005);
 }
});
test('grafiek blijft beschikbaar naast het onderwerpgebonden tweede beeld',()=>{
 assert.match(html,/data-bottom="insight"/);
 assert.match(html,/data-bottom="graph"/);
 assert.match(html,/id="mathToggle"/);
 assert.match(html,/const labSecondViews=\{/);
 assert.match(html,/function selectBottom\(tab\)/);
});

test('alle 53 proeven bieden een eigen berekening en passende standaardweergave',()=>{
 const match=html.match(/const labSecondViews=(\{[^\n]+\});/);
 assert.ok(match,'Tweede-weergavenoverzicht ontbreekt');
 const views=JSON.parse(match[1]);
 assert.deepEqual(Object.keys(views).sort(),Array.from(labSpecs,s=>s[0]).sort());
 const errors=[];
 for(const spec of labSpecs){
  const id=spec[0],p=Object.fromEntries(spec[3].map(r=>[r[0],r[5]]));
  for(const t of [0,1.31,5.17]){
   const i=renderExperiment(id,p,t,gfx).insight;
   if(!i?.title||!i.formula||!i.substitution||!i.answer||!i.note)errors.push(id+': berekening ontbreekt');
   if(/Niet beschikbaar|undefined|NaN/.test(JSON.stringify(i)))errors.push(id+': ongeldige berekening');
   if(views[id]!=='graph'){
    if(!Array.isArray(i.bars)&&!['levels','stack'].includes(i.kind))errors.push(id+': tweede beeld ontbreekt');
    if(i.bars?.some(r=>!Number.isFinite(r[1])||r[1]<0))errors.push(id+': ongeldige balk');
   }
  }
 }
 assert.deepEqual(errors,[]);
 assert.ok(Object.values(views).filter(v=>v!=='graph').length>=20);
});
test('uitkomsten veranderen samen met de ingestelde proefwaarden',()=>{
 const varied=[
  ['lever',{F:15,arm1:3.5,arm2:1.5},'Tegenkracht rechts'],
  ['ohm',{U:18,R:6},'Stroom'],
  ['newton2',{F:24,m:3},'Versnelling'],
  ['doppler',{f:500,vs:40,v:340},'Voor de bron'],
  ['refraction',{n1:1.2,n2:1.6,angle:35},'Brekingshoek'],
  ['rlc',{R:33,L:110,C:80,f:65},'Impedantie'],
  ['lens',{f:8,u:24,h:3},'Beeldafstand'],
  ['dilation',{beta:.5,tau:15},'Tijd in ander stelsel'],
  ['photo',{f:1.2,W:2.5,U:0},'Max. kinetische energie']
 ];
 for(const [id,changes,label] of varied){
  const info=modelAt(id,changes),measured=info.readouts.find(r=>r[0]===label)?.[1];
  assert.equal(info.insight.answer,measured,id+': uitkomst wijkt af');
 }
});
