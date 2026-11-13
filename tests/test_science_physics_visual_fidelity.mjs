import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const defs=scripts.find(x=>x.includes('const labSpecs ='));
const physics=scripts.find(x=>x.includes('function renderExperiment('));
assert.ok(defs&&physics,'De fysische proefcode is beschikbaar');
const specs=new Function(defs+';return labSpecs')();
const render=new Function(physics+';return renderExperiment')();
const loopingVisualPosition=new Function(physics+';return loopingVisualPosition')();
const slitIntensityAtMm=new Function(physics+';return slitIntensityAtMm')();
const defaults=id=>Object.fromEntries(specs.find(x=>x[0]===id)[3].map(x=>[x[0],x[5]]));
function draw(id,changes={},t=0){
 const calls=[];
 const graphics=new Proxy({}, {get(_target,name){return (...args)=>calls.push({name,args});}});
 const p={...defaults(id),...changes};
 return {p,calls,result:render(id,p,t,graphics)};
}
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,String(a)+' hoort '+String(b)+' te zijn');
const ball=calls=>calls.find(c=>c.name==='dot'&&c.args[2]===20)?.args;
const bars=(calls,y)=>calls.find(c=>c.name==='rect'&&c.args[0]===660&&c.args[1]===y)?.args;

test('Looping: hoeksnelheid volgt v/r en zwaartekracht wijst naar beneden',()=>{
 const p={v:12,r:6,m:500},t=.4;
 const {calls,result}=draw('looping',p,t),b=ball(calls);
 assert.ok(b,'Bal ontbreekt');
 const angle=t*p.v/p.r-Math.PI/2;
 near(b[0],500+(17*p.r)*Math.cos(angle));
 near(b[1],245+(17*p.r)*Math.sin(angle));
 near(Math.hypot(b[0]-500,b[1]-245),17*p.r);
 assert.equal(result.readouts.find(x=>x[0]==='Contact bovenin')[1],'Ja');
 const forces=calls.filter(c=>c.name==='arrow'&&c.args[1]===245-17*p.r);
 assert.equal(forces.length,2,'Gewicht en normaalkracht afzonderlijk zichtbaar');
 for(const arrow of forces)assert.ok(arrow.args[3]>arrow.args[1],'Kracht wijst naar beneden bij de top');
 const slow=ball(draw('looping',{v:8,r:6},t).calls);
 assert.ok(Math.abs(slow[0]-b[0])>10,'Bij andere snelheid moet de loophoek veranderen');
});
test('Looping: te lage snelheid geeft vrije worp en geen fictieve contactkracht',()=>{
 const p={v:4,r:6,m:500},t=.4;
 const {calls,result}=draw('looping',p,t),b=ball(calls);
 assert.ok(b,'Voorwerp moet zichtbaar blijven');
 assert.equal(result.readouts.find(x=>x[0]==='Contact bovenin')[1],'Nee');
 near(b[0],500+p.v*t*17);
 near(b[1],245-17*p.r+.5*9.81*t*t*17);
 assert.ok(Math.abs(Math.hypot(b[0]-500,b[1]-245)-17*p.r)>5,'Voorwerp mag niet op de baan blijven');
 assert.ok(calls.some(c=>c.name==='txt'&&String(c.args[0]).includes('Geen contact')));
 assert.equal(loopingVisualPosition(p,t).contact,false);
});
test('Newtons wieg: eerst de linker ballen, na een halve periode de rechter',()=>{
 const first=draw('cradle',{n:2,angle:30},0).calls.filter(c=>c.name==='dot');
 const second=draw('cradle',{n:2,angle:30},1.4).calls.filter(c=>c.name==='dot');
 assert.equal(first.length,5);assert.equal(second.length,5);
 assert.ok(first[0].args[0]<370-90 && first[1].args[0]<435-90,'Links begint uitwijking');
 near(first[4].args[0],630);
 near(second[0].args[0],370);
 assert.ok(second[4].args[0]>630+90 && second[3].args[0]>565+90,'Rechts ontvangt de impuls');
});
test("Newtons wieg met drie ballen: ook de middelste beweegt bij links loslaten",()=>{
 const left=draw('cradle',{n:3,angle:30},0).calls.filter(c=>c.name==='dot');
 const right=draw('cradle',{n:3,angle:30},1.4).calls.filter(c=>c.name==='dot');
 assert.ok(left[2].args[0]<500-90,'Derde bal moet met de linker groep meebewegen');
 assert.ok(right[2].args[0]>500+90,'Middelste bal moet met de rechter groep meebewegen');
});
test('Beide spleetproeven: beeldstrook blijft in mm en verandert mee met instellingen',()=>{
 const cases=[
  ['double',{d:.3,lambda:550,L:1.5},{d:.6,lambda:550,L:1.5}],
  ['single',{a:.15,lambda:550,L:1.5},{a:.30,lambda:550,L:1.5}]
 ];
 const y=305,physical=(y-255)/140*10;
 for(const [id,p1,p2] of cases){
  const a=draw(id,p1).calls,b=draw(id,p2).calls;
  const barA=bars(a,y),barB=bars(b,y);
  assert.ok(barA&&barB,'Intensiteitsstrook ontbreekt');
  near(barA[2],260*slitIntensityAtMm(id,p1,physical),1e-7);
  near(barB[2],260*slitIntensityAtMm(id,p2,physical),1e-7);
  assert.ok(Math.abs(barA[2]-barB[2])>15,id+' moet zichtbaar veranderen bij een andere spleetbreedte');
  near(slitIntensityAtMm(id,p1,0),1);
  assert.ok(a.some(c=>c.name==='txt'&&String(c.args[0]).includes('±10 mm')),'Vaste schaal moet leesbaar zijn');
 }
});
test('Spleetmodellen: eerste minima en donkere interferentiestrepen',()=>{
 const pDouble={d:.3,lambda:550,L:1.5};
 const dMm=pDouble.lambda*1e-9*pDouble.L/(pDouble.d*1e-3)*1000;
 near(slitIntensityAtMm('double',pDouble,dMm/2),0,1e-12);
 near(slitIntensityAtMm('double',pDouble,dMm),1);
 const pSingle={a:.15,lambda:550,L:1.5};
 const aMm=pSingle.lambda*1e-9*pSingle.L/(pSingle.a*1e-3)*1000;
 near(slitIntensityAtMm('single',pSingle,aMm),0,1e-12);
 near(slitIntensityAtMm('single',pSingle,0),1);
});
