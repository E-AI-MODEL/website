import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const definitions=scripts.find(s=>s.includes('const labSpecs ='));
const inquiry=scripts.find(s=>s.includes('function bridgeVoltage('));
const wave=scripts.find(s=>s.includes('function wavePower('));
assert.ok(definitions&&inquiry&&wave,'Onderzoeksfuncties en proefbeschrijvingen moeten bestaan');
const specs=runInNewContext(definitions+'\nlabSpecs');
const snippet=wave.slice(wave.indexOf('function wavePower('),wave.indexOf('const waveCanvas='))+'\n'+inquiry.slice(inquiry.indexOf('function bridgeVoltage('),inquiry.indexOf('function wheatstoneMission('));
const physics=runInNewContext('const TAU=2*Math.PI;const rad=d=>d*Math.PI/180;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));\n'+snippet+'\n({wavePower,bridgeVoltage})');

test('De volledige bibliotheek van 53 proeven blijft beschikbaar',()=>{
 assert.equal(specs.length,53);
 for(const id of ['projectile','wheatstone','interference'])assert.ok(specs.some(row=>row[0]===id),id);
});

test('Schuine worp: doel is haalbaar en zonder schot wordt de baan niet getoond',()=>{
 const target=24,g=9.81,velocity=18,angle=Math.asin(target*g/(velocity**2))/2*180/Math.PI;
 assert.ok(angle>5&&angle<85);
 const range=v=>v*v*Math.sin(2*angle*Math.PI/180)/g;
 assert.ok(Math.abs(range(velocity)-target)<.001);
 assert.match(html,/if\(mission\.launched\)stroke\(ctx,curve/);
 assert.match(html,/classList\.toggle\('await-shot',!mission\.launched\)/);
 assert.match(html,/if\(state\.t>=duration\)/);
});

test('Wheatstone: onbekende blijft verborgen en de brugmeter sluit op de juiste weerstand',()=>{
 const p={R1:10,R2:20,R3:15,R4:12};
 assert.ok(Math.abs(physics.bridgeVoltage(p))>.5,'Proef mag niet in balans beginnen');
 assert.ok(Math.abs(physics.bridgeVoltage({...p,R4:30}))<1e-10);
 assert.ok(Math.abs(physics.bridgeVoltage({...p,R4:32}))>.01);
 assert.match(html,/visibleControls=e\.controls\.filter\(row=>id!=='wheatstone'\|\|row\[0\]!=='R3'\)/);
 assert.match(html,/Math\.abs\(guess-state\.p\.R3\)<\.26/);
});

test('Interferentie: sonde gebruikt de intensiteit uit het gekleurde veld',()=>{
 const base={distance:2.5,lambda:1.5,phase:0};
 const midpoint=physics.wavePower(base,500,260);
 assert.ok(Math.abs(midpoint-1)<1e-12);
 assert.ok(Math.abs(physics.wavePower({...base,phase:180},500,260))<1e-12);
 const far=physics.wavePower(base,600,195);
 assert.ok(far>=0&&far<=1);
 assert.match(html,/const x=i\/ww\*1000,y=j\/hh\*500,power=wavePower\(p,x,y\)/);
 assert.match(html,/mission\.samples\.push\(\{x,y,power\}\)/);
 assert.match(html,/mission\.pointer===ev\.pointerId/);
});

test('Alle drie de onderzoeksroutes hebben verschillende opdrachten in dezelfde interface',()=>{
 for(const term of ['Richt','Schiet','Verbeter','Zoek nul','Bereken','Controleer','Verken','Meet','Verklaar'])assert.ok(html.includes(term),term);
 assert.match(html,/function researchCopy\(id\)/);
 assert.match(html,/resetInquiry\(id\);researchCopy\(id\)/);
 assert.match(html,/id="inquiryBar"/);
 assert.match(html,/const directManip=new Set\(\['projectile','pendulum','refraction','circular','lens','interference'\]\)/);
});
