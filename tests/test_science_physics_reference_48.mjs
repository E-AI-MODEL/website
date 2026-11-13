import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const register=JSON.parse(readFileSync(new URL('../content/science-observatory/natuurkunde-kwaliteit.json',import.meta.url),'utf8'));
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const definitions=scripts.find(x=>x.includes('const labSpecs ='));
const models=scripts.find(x=>x.includes('function renderExperiment('));
const app=scripts.find(x=>x.includes('const physicsEvidenceMore='));
assert.ok(definitions&&models&&app);
const specs=new Function(definitions+';return labSpecs')();
const render=new Function(models+';return renderExperiment')();
const base=JSON.parse(app.match(/const physicsEvidence=(\{[^\n]+\});/)[1]);
const extra=JSON.parse(app.match(/const physicsEvidenceMore=(\{[^\n]+\});/)[1]);
const all={...base,...extra};
const gfx=new Proxy({}, {get(){return ()=>{};}});
const phi=Math.PI,ta=2*Math.PI,rad=x=>x*phi/180;
const getP=id=>Object.fromEntries(specs.find(r=>r[0]===id)[3].map(c=>[c[0],c[5]]));
function run(id,settings={},t=1.27){
 return render(id,{...getP(id),...settings},t,gfx);
}
function val(result,label){
 const data=result.readouts.find(x=>x[0]===label);
 assert.ok(data,'Meetwaarde '+label+' niet gevonden');
 const str=String(data[1]),match=str.match(/-?\d[\d.,]*/);
 assert.ok(match,'Niet numeriek: '+str);
 return Number(match[0].replaceAll('.','').replace(',','.'));
}
function assertClose(actual,expected,epsilon=.065,label=''){
 assert.ok(Number.isFinite(actual)&&Number.isFinite(expected),'Onmeetbare referentie: '+label);
 assert.ok(Math.abs(actual-expected)<=epsilon,'Afwijking in '+label+': '+actual+' ten opzichte van '+expected+' (max '+epsilon+')');
}
const check=(label,expected,epsilon=.065)=>[label,expected,epsilon];
function keplerDistance(p,t,period){
 let M=ta*((t/period)%1),lo=0,hi=ta;
 for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(mid-p.e*Math.sin(mid)<M)lo=mid;else hi=mid;}
 const E=(lo+hi)/2;
 return p.a*(1-p.e*Math.cos(E));
}
const oracles={
 acceleration:(p,t)=>[check('Positie',p.v0*(t%8)+.5*p.a*(t%8)**2),check('Snelheid',p.v0+p.a*(t%8))],
 equilibrium:p=>[check('Resultante F₁+F₂',Math.hypot(p.F1+p.F2*Math.cos(rad(p.angle)),p.F2*Math.sin(rad(p.angle))))],
 resultant:p=>[check('Resultante F₁+F₂',Math.sqrt(p.F1**2+p.F2**2+2*p.F1*p.F2*Math.cos(rad(p.angle))))],
 resolution:p=>[check('Horizontaal',p.F*Math.cos(rad(p.angle))),check('Verticaal',p.F*Math.sin(rad(p.angle))),check('Som componenten',p.F)],
 pulleys:p=>[check('Gewicht',p.m*p.g),check('Trekkracht',p.m*p.g/p.n),check('Touwweg voor 1 m heffen',p.n)],
 incline:p=>[check('Langs de helling',p.m*9.81*Math.sin(rad(p.angle))),check('Max. wrijving',p.mu*p.m*9.81*Math.cos(rad(p.angle))),check('Versnelling',Math.max(0,9.81*(Math.sin(rad(p.angle))-p.mu*Math.cos(rad(p.angle)))))],
 newton2:p=>[check('Versnelling',p.F/p.m),check('Verplaatsing na 3 s',4.5*p.F/p.m)],
 projectile:p=>[check('Bereik',p.v*p.v*Math.sin(2*rad(p.angle))/p.g),check('Vliegtijd',2*p.v*Math.sin(rad(p.angle))/p.g),check('Max. hoogte',p.v**2*Math.sin(rad(p.angle))**2/(2*p.g))],
 cradle:p=>[check('Losgelaten bollen',p.n),check('Afname energie',0)],
 circular:p=>[check('Hoeksnelheid',p.v/p.r),check('Versnelling',p.v*p.v/p.r),check('Middelpuntzoekende kracht',p.m*p.v*p.v/p.r)],
 carousel:p=>{const omega=p.rpm*ta/60;return[check('Hoeksnelheid',omega),check('Snelheid',omega*p.r),check('Middelpuntzoekende kracht',p.m*omega**2*p.r)]},
 looping:p=>[check('Normaalkracht bovenin',Math.max(0,p.m*(p.v**2/p.r-9.81))),check('Min. snelheid bovenin',Math.sqrt(9.81*p.r))],
 kepler1:(p,t)=>[check('Afstand tot ster',keplerDistance(p,t,15)),check('Perihelium',p.a*(1-p.e)),check('Aphelium',p.a*(1+p.e))],
 kepler2:(p,t)=>[check('Afstand tot ster',keplerDistance(p,t,9)),check('Perihelium',p.a*(1-p.e)),check('Aphelium',p.a*(1+p.e))],
 hydro:p=>[check('Overdruk',p.rho*p.depth*p.g,.6),check('Absolute druk (ca.)',101325+p.rho*p.depth*p.g,.6)],
 buoyant:p=>{const up=Math.min(p.rho*9.81*p.V/1000,p.m*9.81);return[check('Opwaartse kracht',up),check('Gewicht',p.m*9.81)]},
 pendulum:p=>[check('Trillingstijd',ta*Math.sqrt(p.L/p.g)),check('Frequentie',1/(ta*Math.sqrt(p.L/p.g)))],
 spring:p=>[check('Trillingstijd',ta*Math.sqrt(p.m/p.k)),check('Max. veerkracht',p.k*p.A),check('Totale energie',.5*p.k*p.A*p.A)],
 coupled:p=>[check('Hoge frequentie',p.f*Math.sqrt(1+2*p.k)),check('Lage frequentie',p.f)],
 resonance:p=>[check('Amplitude­verhouding',1/Math.sqrt((1-(p.f/p.f0)**2)**2+(2*p.z*p.f/p.f0)**2))],
 beats:p=>[check('Zwevingsfrequentie',Math.abs(p.f1-p.f2))],
 standing:p=>[check('Frequentie',p.n*p.v/(2*p.L)),check('Golflengte',2*p.L/p.n)],
 longitudinal:p=>[check('Frequentie',p.n*p.v/(2*p.L)),check('Golflengte',2*p.L/p.n)],
 interference:p=>[check('Relatieve intensiteit midden tussen bronnen',Math.cos(rad(p.phase)/2)**2)],
 doppler:p=>[check('Voor de bron',p.f*p.v/(p.v-p.vs)),check('Achter de bron',p.f*p.v/(p.v+p.vs))],
 magnetbar:p=>[check('Relatieve sterkte',p.strength),check('Getekende veldlijnen',p.spacing)],
 magnetwire:p=>[check('Veld op meetafstand',2e-7*Math.abs(p.I)/(p.r*.01)*1e6)],
 lorentz:p=>[check('Lorentzkracht',p.v*p.B*Math.sin(rad(p.angle)))],
 motor:(p,t)=>[check('Indicatief koppel',p.I*p.B*.02*Math.abs(Math.sin(t*p.rpm*ta/60)),.0015)],
 generator:(p,t)=>{const o=p.rpm*ta/60,max=p.N*p.B*.02*o;return[check('Max. spanning',max),check('Spanning nu',max*Math.sin(o*t))]},
 ohm:p=>[check('Stroom',p.U/p.R),check('Vermogen',p.U*p.U/p.R)],
 resistors:p=>{const req=p.mode===1?p.R1*p.R2/(p.R1+p.R2):p.R1+p.R2;return[check('Vervangingsweerstand',req),check('Stroom bij 12 V',12/req)]},
 potentiometer:p=>[check('Uitgangsspanning',p.U*p.position/100),check('Weerstand onder',p.R*p.position/100)],
 wheatstone:p=>{const U=10;return[check('Brugspanning',U*p.R2/(p.R1+p.R2)-U*p.R4/(p.R3+p.R4))]},
 ac:p=>[check('Effectieve stroom',p.U/p.R)],
 rlc:p=>{const L=p.L*.001,C=p.C*1e-6,w=ta*p.f,Z=Math.hypot(p.R,w*L-1/(w*C));return[check('Impedantie',Z),check('Resonantiefrequentie',1/(ta*Math.sqrt(L*C)))]},
 lc:p=>{const C=p.C*1e-6,L=p.L*.001;return[check('Totale energie',.5*C*p.U*p.U*1000,.00007),check('Resonantiefrequentie',1/(ta*Math.sqrt(L*C)))]},
 em:p=>[check('Frequentie in vacuüm',299.8/p.lambda)],
 refraction:p=>[check('Brekingshoek',Math.asin(p.n1*Math.sin(rad(p.angle))/p.n2)/rad(1))],
 huygens:p=>[check('Hoek van breking',Math.asin(p.v2*Math.sin(rad(p.angle))/p.v1)/rad(1))],
 lens:p=>[check('Beeldafstand',p.f*p.u/(p.u-p.f)),check('Vergroting',-p.f/(p.u-p.f))],
 telescope:p=>[check('Hoekvergroting',-p.fo/p.fe),check('Lensafstand',p.fo+p.fe)],
 double:p=>[check('Streepafstand',p.lambda*1e-9*p.L/(p.d*1e-3)*1000,.0015)],
 single:p=>[check('Breedte hoofdmaximum',2*p.lambda*1e-9*p.L/(p.a*1e-3)*1000,.06)],
 dilation:p=>[check('Lorentzfactor γ',1/Math.sqrt(1-p.beta*p.beta)),check('Tijd in ander stelsel',p.tau/Math.sqrt(1-p.beta*p.beta))],
 photo:p=>[check('Fotonenergie',4.135667696*p.f),check('Max. kinetische energie',Math.max(0,4.135667696*p.f-p.W))],
 decay:(p,t)=>[check('Verwacht aantal',p.N*(.5)**(((t%(6*p.T))+(6*p.T))%(6*p.T)/p.T))],
 bragg:p=>[check('Bragghoek',Math.asin(p.order*p.lambda/(2*p.d))*180/phi)]
};
const firstFive=new Set(['lever','collision','gas','bohr','chains']);

test('Bronnen per proef: 53 unieke onderwerpkaarten en directe bronlinks',()=>{
 assert.equal(specs.length,53);
 assert.equal(Object.keys(base).length,5);
 assert.equal(Object.keys(extra).length,48);
 assert.deepEqual(Object.keys(all).sort(),Array.from(specs,x=>x[0]).sort());
 for(const [id,e] of Object.entries(all)){
  for(const field of ['level','theory','derivation','limitations'])assert.ok(e[field].length>(field==='level'?7:20),id+' '+field);
  assert.ok(e.sources.length>=1,id);
  for(const source of e.sources) {
   assert.ok(source.name.length>20,id+' naam bron');
   assert.ok(/^https:\/\/(openstax\.org|phys\.libretexts\.org|ocw\.mit\.edu)\//.test(source.url),id+' bron');
   assert.ok(!source.url.includes('undefined'),id+' bronurl');
   const registered=register.proeven.find(row=>row.id===id)?.bronhoofdstukken||[];
   assert.ok(registered.some(row=>row.url===source.url),id+': bron ontbreekt in register');
  }
 }
 assert.match(html,/Object\.assign\(physicsEvidence,physicsEvidenceMore\)/);
});

test('Overige 48 proefberekeningen vergelijken met onafhankelijke formules',()=>{
 assert.equal(Object.keys(oracles).length,48);
 assert.deepEqual(Object.keys(oracles).sort(),specs.map(x=>x[0]).filter(x=>!firstFive.has(x)).sort());
 for(const id of Object.keys(oracles)){
  const p=getP(id);
  for(const t of [0,1.27,2.31]){
   const result=run(id,p,t);
   for(const [label,expected,tol] of oracles[id](p,t))assertClose(val(result,label),expected,tol,id+' '+label+' t='+t);
  }
 }
});

test('Randgevallen: absorptie, reflectie, brandpunt en energiebehoud',()=>{
 assert.equal(run('refraction',{n1:1.5,n2:1,angle:60}).readouts.find(x=>x[0]==='Refractie')[1],'Totaal gereflecteerd');
 assert.equal(run('huygens',{v1:2,v2:4,angle:60}).readouts.find(x=>x[0]==='Hoek van breking')[1],'Geen');
 assert.equal(run('lens',{f:8,u:8}).readouts.find(x=>x[0]==='Beeldafstand')[1],'Op oneindig');
 assert.equal(run('looping',{v:2,r:8,m:200}).readouts.find(x=>x[0]==='Contact bovenin')[1],'Nee');
 assertClose(val(run('lc',{U:15,L:80,C:40}),'Totale energie'),.5*40e-6*15*15*1000,.00007,'LC energie');
 assert.equal(run('photo',{f:.3,W:3}).readouts.find(x=>x[0]==='Elektronen gedetecteerd')[1],'Nee');
 assert.equal(run('bragg',{d:.1,lambda:.3,order:2}).readouts.find(x=>x[0]==='Bragghoek')[1],'Geen oplossing');
});

test('Elke proef blijft renderbaar bij minimum en maximum van zijn bediening',()=>{
 for(const spec of specs){
  const id=spec[0],limits=spec[3];
  for(const edge of [3,4]){
   const p=Object.fromEntries(limits.map(x=>[x[0],x[edge]]));
   for(const t of [0,1.27]){
    let result;
    assert.doesNotThrow(()=>result=run(id,p,t),id+' limiet '+edge);
    assert.equal(result.readouts.length,4,id);
    for(const row of result.readouts)assert.ok(!/undefined|NaN/i.test(String(row[1])),id+' '+row[0]);
   }
  }
 }
});
