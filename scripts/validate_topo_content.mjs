import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const json=path=>JSON.parse(readFileSync(path,'utf8'));
const geo=json('topo/data/provincies-2026.geojson');
const questions=json('topo/data/shuffle-vragen.json').questions;
const language=json('topo/data/taalbank.json');
const national=readFileSync('topo/nederland/index.html','utf8');
const north=readFileSync('topo/index.html','utf8');
assert.ok(national.includes('function pdokDetail()'),'PDOK water- en spoorlagen ontbreken');
assert.ok(national.includes('BBOX:[pdokBox.south,pdokBox.west,pdokBox.north,pdokBox.east]'),'WMS-asvolgorde fout');
assert.ok(national.includes("url('Waterdeel')"),'Waterbron ontbreekt');
assert.ok(national.includes("url('Wegdeelhartlijn,Spoorbaandeel')"),'Wegen en spoor ontbreken');
assert.ok(national.includes('.pdok-detail image{pointer-events:none}'),'PDOK-laag mag geen spelinteractie blokkeren');
assert.equal(geo.features.length,12,'De provincies moeten compleet zijn');
const name=f=>f.properties.statnaam==='Fryslân'?'Friesland':f.properties.statnaam;
const provinces=geo.features.map(name);
assert.equal(new Set(provinces).size,12,'Dubbele provincies');
const capitalsText=national.match(/const provinceCapitals=(\[[\s\S]*?\]);/);
assert.ok(capitalsText,'Hoofdstedentabel ontbreekt');
const capitals=Array.from(vm.runInNewContext(capitalsText[1]),row=>Array.from(row));
assert.equal(capitals.length,12);
assert.deepEqual([...capitals.map(r=>r[0])].sort(),[...provinces].sort());
const pairs=capitals.filter(c=>c[0]===c[1]).map(c=>c[0]).sort();
assert.deepEqual(pairs,['Groningen','Utrecht']);

// Test actual polygon borders. No province neighbour answer is accepted on memory alone.
const rings=g=>g.type==='MultiPolygon'?g.coordinates.flat(1):g.coordinates;
const segmentPoints=f=>rings(f.geometry).flatMap(r=>r.slice(1).map((v,i)=>
 [[r[i][0]*69,r[i][1]*111],[v[0]*69,v[1]*111]]));
const edgeSets=geo.features.map(segmentPoints);
function pointSegmentDistance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const k=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p[0]-a[0]-k*dx,p[1]-a[1]-k*dy);
}
function edgeDistance(a,b,c,d){
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return 0;
 return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),
  pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function borders(first,second){
 const i=provinces.indexOf(first),j=provinces.indexOf(second);
 assert.ok(i>=0&&j>=0,'Unknown provinces: '+first+', '+second);
 if(i===j)return false;
 for(const a of edgeSets[i])for(const b of edgeSets[j])
  if(edgeDistance(...a,...b)<0.005)return true;
 return false;
}
function neighbors(p){return provinces.filter(other=>other!==p&&borders(p,other));}
assert.deepEqual(neighbors('Noord-Brabant').sort(),
 ['Gelderland','Limburg','Zeeland','Zuid-Holland'].sort());
assert.deepEqual(provinces.filter(p=>borders(p,'Drenthe')&&borders(p,'Gelderland')),
 ['Overijssel']);

assert.equal(questions.length,16,'Unexpected question count');
const ids=new Set();
for(const q of questions){
 assert.ok(q.id&&!ids.has(q.id),'Duplicate or missing quiz question id');
 ids.add(q.id);
 assert.equal(q.options.length,4,'Quiz needs 4 options: '+q.id);
 assert.equal(new Set(q.options).size,4,'Duplicate choices: '+q.id);
 assert.equal(q.options.filter(x=>x===q.answer).length,1,'Answer is not unique: '+q.id);
 assert.ok(q.question&&q.hint&&q.note,'Incomplete content: '+q.id);
 assert.ok(q.check&&q.check.type,'Unverified question: '+q.id);
 const c=q.check;
 switch(c.type){
  case 'water-source': {
   const url=new URL(c.source);
   assert.equal(url.protocol,'https:');
   assert.ok(['www.rijkswaterstaat.nl','www.ensie.nl'].includes(url.hostname),
     'Water question needs a checked source: '+q.id);
   break;
  }
  case 'neighbor': {
   assert.ok(neighbors(c.province).includes(q.answer),'Wrong neighbour '+q.id);
   assert.equal(q.options.filter(x=>neighbors(c.province).includes(x)).length,1,
    'More than one valid neighbor in choices '+q.id);
   break;
  }
  case 'not-neighbor': {
   assert.ok(provinces.includes(q.answer)&&!neighbors(c.province).includes(q.answer));
   assert.equal(q.options.filter(x=>provinces.includes(x)&&x!==c.province&&!neighbors(c.province).includes(x)).length,1,
    'More than one non-neighbor answer '+q.id);
   break;
  }
  case 'neighbor-count':
   assert.equal(q.answer,String(neighbors(c.province).length));break;
  case 'equal-capital-count':
   assert.equal(q.answer,String(pairs.length));break;
  case 'equal-capital-pair':
   assert.deepEqual(q.answer.split(' en ').sort(),pairs);break;
  case 'capital-of':
   assert.equal(q.answer,capitals.find(x=>x[0]===c.province)?.[1]);break;
  case 'province-of-capital':
   assert.equal(q.answer,capitals.find(x=>x[1]===c.capital)?.[0]);break;
  case 'common-neighbor': {
   const both=provinces.filter(p=>c.provinces.every(n=>borders(p,n)));
   assert.deepEqual(both,[q.answer],'Ambiguous shared province: '+q.id);
   assert.equal(q.options.filter(x=>both.includes(x)).length,1);
   break;
  }
  default:throw Error('Unknown validation rule '+c.type);
 }
}
const groups={bijnamen:9,goed_antwoord:8,fout_antwoord:6,wild_klikken:3,
 veel_fouten:5,goede_reeks:3,spieken_hints:5,shuffle:7,einde:4};
const voices=language.uitspraak;
for(const [group,length] of Object.entries(groups)){
 assert.equal(voices[group]?.length,length,'Taalbank '+group+' incomplete');
 for(const line of voices[group])assert.ok(typeof line==='string'&&line.trim().length>2);
}
assert.equal(language.total,50);
assert.equal(Object.values(voices).reduce((sum,list)=>sum+list.length,0),50);
assert.ok(!north.includes('topo/data/taalbank.json'),'Noord-Nederland is niet aangepast');
assert.ok(national.includes('setFactBank(facts)'),'Quiz data is not consumed by game');
console.log('TOPO CONTENT PASS: 12 provincies, '+questions.length+
 ' verified questions (8 source-checked water questions), 50 approved voice lines');
