import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const dir='tools/ict-scan/bronnen/';
const data=JSON.parse(readFileSync(dir+'2026-applicatielandschap.json','utf8'));
const work=JSON.parse(readFileSync(dir+'2026-werkregister.json','utf8'));
const manifest=JSON.parse(readFileSync(dir+'manifest.json','utf8'));
const catalog=JSON.parse(readFileSync('tools/ict-scan/frameworks.json','utf8'));
const registries={apps:data.apps,licenseReview:data.licenseReview,softwareReview:work.softwareReview,workActions:work.workActions};
const indexed=Object.fromEntries(Object.entries(registries).map(([type,rows])=>[type,new Set(rows.map(x=>x.id))]));
const all=data.apps.flatMap(app=>(app.relations||[]).map(rel=>({app,rel})));

test('Bevestigde bronpopulaties blijven ongewijzigd en elke nieuwe relatie heeft een echte doel-ID',()=>{
 assert.equal(data.apps.length,69);
 assert.equal(data.ai.length,76);
 assert.equal(data.connections.length,93);
 assert.equal(data.licenseReview.length,40);
 assert.equal(work.softwareReview.length,12);
 assert.equal(work.workActions.length,13);
 assert.equal(all.length,64);
 assert.equal(new Set(all.map(x=>x.app.id)).size,34);
 const uniq=new Set();
 for(const {app,rel} of all){
   assert.ok(indexed[rel.targetType]?.has(rel.targetId),app.id+' -> '+rel.targetType+'/'+rel.targetId);
   assert.ok(catalog.relationTypes.some(t=>t.id===rel.relationType),rel.relationType);
   assert.ok(catalog.relationStatuses.includes(rel.status),rel.status);
   assert.ok(rel.evidence?.trim(),'Elke relatie vermeldt een bron');
   assert.ok(rel.note?.trim(),'Elke relatie bevat een concrete bewijsgrens');
   assert.notEqual(rel.status,'Bevestigd','Productrelaties bewijzen geen actief gebruik');
   const key=[app.id,rel.relationType,rel.targetType,rel.targetId].join('|');
   assert.ok(!uniq.has(key),'Dubbele relatie '+key);
   uniq.add(key);
 }
});
test('LessonUp, Showbie en Microsoft-productfamilie zijn bereikbaar via de nieuwe relaties',()=>{
 const relations=id=>data.apps.find(app=>app.id===id).relations||[];
 const has=(id,type,target)=>relations(id).some(r=>r.targetType===type&&r.targetId===target);
 assert.ok(has('APP-008','licenseReview','LIC-003'));
 assert.ok(has('APP-008','softwareReview','SWR-007'));
 assert.ok(has('APP-012','licenseReview','LIC-004'));
 assert.ok(has('APP-012','softwareReview','SWR-007'));
 assert.ok(has('APP-012','apps','APP-004'));
 assert.ok(has('APP-010','apps','APP-034'));
 assert.ok(has('APP-035','apps','APP-034'));
 assert.ok(has('APP-016','workActions','WRK-008'));
});
test('Verantwoordelijke functies zijn door schoolleiding aangewezen zonder gebruikersrechten te suggereren',()=>{
 const byId=id=>data.apps.find(x=>x.id===id);
 for(const id of ['APP-034','APP-010','APP-035','APP-058','APP-027','APP-021','APP-020','APP-025','APP-026','APP-005','APP-057','APP-023','APP-022']){
   assert.equal(byId(id).owner,'ICT-beheer',id);
   assert.match(byId(id).recordMeta.ownerSource,/schoolleiding/i);
 }
 for(const id of ['APP-008','APP-012']){
   assert.equal(byId(id).owner,'Stuurgroep ICT',id);
   assert.match(byId(id).recordMeta.ownerScope,/onderwijsapplicatie/i);
 }
});

test('Microsoft-identiteitsketen staat als onderzoekssignaal en niet als actief bevestigd geregistreerd',()=>{
 const byId=id=>data.apps.find(x=>x.id===id);
 const pairs=[
  ['APP-026','APP-027'],['APP-025','APP-027'],['APP-052','APP-027'],
  ['APP-056','APP-027'],['APP-020','APP-027'],['APP-021','APP-027'],
  ['APP-057','APP-010'],['APP-057','APP-034'],['APP-045','APP-027'],['APP-035','APP-058']
 ];
 for(const [id,target] of pairs){
   const edge=byId(id).relations.find(r=>r.targetType==='apps'&&r.targetId===target);
   assert.ok(edge, id+' -> '+target);
   assert.equal(edge.status,'Vermoedelijk');
   assert.ok(edge.evidence);
 }
 assert.equal(data.parts.length,53,'13 bestaande Entra-onderdelen en 40 M365-productvermeldingen');
 assert.equal(data.parts.filter(x=>x.kind==='Microsoft 365-onderdeel').length,40);
 assert.ok(data.parts.some(x=>x.id==='M365-SP'&&x.parent==='APP-034'));
 assert.ok(data.parts.some(x=>x.id==='M365-FORMS'&&x.parent==='APP-034'));
 assert.ok(data.parts.some(x=>x.id==='M365-COPCHAT'&&x.parent==='APP-035'));
 assert.equal(Object.hasOwn(byId('APP-034'),'serviceLinks'),false,'M365-onderdelen zitten niet meer in een aparte embedded lijst');
});

test('15 hardwaregroepen zijn eenduidig verbonden en niet gemengd met vier Entra-metingen',()=>{
 const byId=id=>data.hardwareGroups.find(x=>x.id===id);
 assert.equal(data.hardwareGroups.length,15);
 for(const [id,refs] of Object.entries({
   H01:['APP-020','APP-005','APP-065'],H02:['APP-020','APP-021'],
   H03:['APP-023'],H07:['APP-057']
 })){
   const h=byId(id);
   assert.ok(h,h.id);assert.equal(h.owner,'ICT-beheer');
   assert.deepEqual(h.appRefs,refs,id);
   assert.ok(h.sources[0].includes('Hardware rij'));
 }
 assert.equal(data.devices.length,4);
 assert.ok(data.hardwareGroups.every(x=>x.quantity===null&&x.status.startsWith('?')),
   'De bronwerkmap bevat geen onafhankelijk geverifieerde hardwareaantallen');
 assert.ok(data.apps.every(x=>!Object.hasOwn(x,'hardwareLinks')));
});

test('Manifest is gebonden aan de exacte bronbytes en bevat geen individuele accountgegevens',()=>{
 const file=readFileSync(dir+'2026-applicatielandschap.json');
 const blob=createHash('sha1').update('blob '+file.length+String.fromCharCode(0)).update(file).digest('hex');
 const recorded=manifest.dataFiles.find(x=>x.path==='2026-applicatielandschap.json');
 assert.equal(recorded.sha,blob);
 const body=file.toString('utf8');
 assert.doesNotMatch(body,/[\w.%+-]+@emmauscollege\.nl/i);
 assert.doesNotMatch(body,/"(?:email|assignedUser|personName)"\s*:/i);
 assert.doesNotMatch(body,/"(?:accountCountLessonUp|showbieProUsers)"\s*:/i);
});
test('De systeemkaart toont licenties, werkacties en de bronstatus',()=>{
 const js=readFileSync('tools/ict-scan/dashboard-composer.js','utf8');
 for(const token of ['ds-recorded-links','IctInventoryIndex','index.connected','link.status','ds-relationship-detail','link.origin'])assert.ok(js.includes(token),token);
});
