import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const render=runInNewContext(scripts.find(s=>s.includes('function renderExperiment('))+'\nrenderExperiment');
const specs=runInNewContext(scripts.find(s=>s.includes('const labSpecs ='))+'\nlabSpecs');
const engine=scripts.find(s=>s.includes('function lensPremium('));
const calls=[];
const G=new Proxy({}, {get(_o,name){return(...args)=>calls.push({name,args})}});
function sample(id,changes={},t=0){
 const s=specs.find(x=>x[0]===id);assert.ok(s,id);
 const p=Object.fromEntries(s[3].map(x=>[x[0],x[5]]));calls.length=0;
 const data=render(id,{...p,...changes},t,G);
 return{data,calls:[...calls]};
}
const row=(r,label)=>String(r.data.readouts.find(x=>x[0]===label)?.[1]??'missing');
const number=s=>Number(String(s).match(/-?\d[\d.,]*/)?.[0].replaceAll('.','').replace(',','.'));
const near=(a,b,epsilon=.04)=>assert.ok(Math.abs(a-b)<=epsilon, a+' versus '+b);

test('53 proeven: 477 combinaties zonder ongeldige waarden of tekeninstructies',()=>{
 assert.equal(specs.length,53);
 for(const spec of specs)for(const fraction of [0,.5,1]){
  const params=Object.fromEntries(spec[3].map(p=>[p[0],p[3]+fraction*(p[4]-p[3])]));
  for(const t of [0,1.4,5.8]){
   const r=sample(spec[0],params,t);
   for(const [label,val] of r.data.readouts)
    assert.doesNotMatch(val,/NaN|Infinity|undefined/i, spec[0]+': '+label);
   for(const entry of r.calls)for(const arg of entry.args)
    if(typeof arg==='number')assert.ok(Number.isFinite(arg),spec[0]+': '+entry.name);
  }
 }
});

test('Doppler: stilstaande bron staat stil en golfringen volgen geluidssnelheid',()=>{
 const center=r=>r.calls.find(x=>x.name==='dot'&&x.args[2]===18).args[0];
 near(center(sample('doppler',{vs:0},0)),center(sample('doppler',{vs:0},1)),1e-8);
 near(center(sample('doppler',{vs:80},1))-center(sample('doppler',{vs:80},0)),72);
 const firstRing=r=>r.calls.find(x=>x.name==='ring'&&x.args[2]>0).args[2];
 assert.ok(firstRing(sample('doppler',{vs:80,v:360},1))>firstRing(sample('doppler',{vs:80,v:300},1)));
 const result=sample('doppler',{vs:80,v:340},1);
 near(result.data.fn(0),440);
 near(result.data.fn(1),number(row(result,'Voor de bron')),.05);
});

test('Bolle lens: reëel omgekeerd, virtueel rechtop en terugverlengingen',()=>{
 const virtual=sample('lens',{f:6,u:4,h:3});
 const real=sample('lens',{f:6,u:18,h:3});
 const focal=sample('lens',{f:6,u:6,h:3});
 assert.match(row(virtual,'Beeldtype'),/Virtueel/);
 assert.match(row(real,'Beeldtype'),/Reëel/);
 assert.equal(row(focal,'Beeldafstand'),'Op oneindig');
 const virtualImage=virtual.calls.find(x=>x.name==='arrow'&&x.args[0]===x.args[2]&&x.args[0]<480);
 assert.ok(virtualImage&&virtualImage.args[3]<virtualImage.args[1]);
 assert.ok(virtual.calls.some(x=>x.name==='line'&&Array.isArray(x.args[6])&&x.args[6].join(',')==='5,6'));
 const lensStart=engine.indexOf('function lensPremium(');
 const lensSource=engine.slice(lensStart,engine.indexOf('\nObject.assign(flagship2d',lensStart));
 const strokes=[],labels=[],ctx={createLinearGradient(){return{addColorStop(){}}},beginPath(){},ellipse(){},arc(){},fill(){},stroke(){},fillText(...args){labels.push(args)},setLineDash(){}};
 const premium=runInNewContext(lensSource+'\nlensPremium',{background(){},stroke(...a){strokes.push(a)},circle(){},PI:Math.PI,TAU:Math.PI*2,fmt(x){return String(x)}});
 const preview=u=>{strokes.length=0;labels.length=0;premium(ctx,{f:6,u,h:3},0);return{strokes:[...strokes],labels:labels.map(x=>x[0])}};
 const v=preview(4),r=preview(18);
 assert.ok(v.labels.includes('VIRTUEEL BEELD'));
 assert.ok(v.strokes.some(x=>Array.isArray(x[5])&&x[5].join(',')==='5,6'));
 assert.ok(r.labels.includes('REËEL BEELD'));
 assert.ok(!r.strokes.some(x=>Array.isArray(x[5])&&x[5].join(',')==='5,6'));
});

test('Lorentzkracht: geen cirkelbeweging bij parallelle snelheid',()=>{
 assert.ok(!sample('lorentz',{angle:0}).calls.some(x=>x.name==='ring'));
 assert.ok(sample('lorentz',{angle:90}).calls.some(x=>x.name==='ring'));
 near(number(row(sample('lorentz',{angle:0}),'Lorentzkracht')),0);
});

test('Foto-elektrisch effect: tegenwerkende remspanning heeft negatieve anode',()=>{
 const r=sample('photo',{f:1,W:2.3,U:2});
 assert.ok(r.calls.some(x=>x.name==='txt'&&x.args[0]==='+'&&x.args[1]===565));
 assert.ok(r.calls.some(x=>x.name==='txt'&&x.args[0]==='−'&&x.args[1]===804));
});
