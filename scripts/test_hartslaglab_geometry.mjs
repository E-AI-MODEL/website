// Controle op de daadwerkelijk gegenereerde anatomische geometrie.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile('content/anatomie/labs/hartslag/anatomyGeometry.js','utf8');
const g=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(Object.keys(g.CHAMBERS).length,4);
assert.equal(g.VALVES.length,4);
assert.deepEqual(g.VALVES.filter(v=>v.type==='av').map(v=>v.leaflets).sort(),[2,3],
  'Mitralis heeft twee en tricuspidalis drie klepbladen');
assert.deepEqual(g.VALVES.filter(v=>v.type==='sem').map(v=>v.leaflets),[3,3],
  'Slagaderkleppen hebben drie slippen');
assert(g.CHAMBERS.lv.wall>g.CHAMBERS.rv.wall,
  'Linkerkamerwand moet in de schematische doorsnede dikker zijn dan de rechterkamerwand');
function valid(mesh,label){
  assert(mesh.count>20,label+' heeft te weinig driehoeken');
  assert.equal(mesh.v.length,mesh.n.length,label+' heeft ongelijke vertices/normals');
  assert.equal(mesh.v.length,mesh.count*3,label+' verkeerde vertexcount');
  for(const x of mesh.v)assert(Number.isFinite(x),label+' heeft een niet-eindige coördinaat');
  for(const x of mesh.n)assert(Number.isFinite(x),label+' heeft een niet-eindige normaal');
}
for(const [id,chamber] of Object.entries(g.CHAMBERS)){
  const parts=g.chamberGeometry(chamber);
  for(const [part,mesh] of Object.entries(parts))valid(mesh,id+' '+part);
  assert(parts.outer.count>3000,'Het getoonde hart mag geen eenvoudige ellipsoïde zijn');
  assert(parts.inner.count>3000,'De kamer moet een getekende binnenwand hebben');
  assert(parts.rim.count>=200,'De doorsnede moet zichtbare wanddikte tonen');
}
const envelope=g.heartEnvelopeGeometry();
valid(envelope,'doorlopende hartwand');
assert(envelope.count>12000,'De hartwand mist detail of de opengewerkte voorzijde');
assert(g.geometryAudit().envelopePolygons===envelope.count);
for(const vessel of g.VESSELS)valid(g.tubeGeometry(vessel.path,vessel.radius),vessel.id);
for(const valve of g.VALVES){
  valid(g.leafletGeometry(valve,0),'klep '+valve.id+' gesloten');
  const open=g.leafletGeometry(valve,1);
  valid(open,'klep '+valve.id+' open');
  const closed=g.leafletGeometry(valve,0);
  assert.equal(open.count,closed.count,'Klepvervorming mag het GPU-bufferformaat niet veranderen');
  assert(open.v.some((x,i)=>Math.abs(x-closed.v[i])>.05),'Klepbladen moeten daadwerkelijk bewegen: '+valve.id);
}
assert(g.CORONARY_DETAILS.length>=5,'Oppervlakte-anatomie bevat kransarterien en een hartader');
assert(g.CORONARY_DETAILS.some(x=>x.kind==='vein'),'Hartader ontbreekt');
assert(g.MUSCLE_DETAILS.filter(x=>x.kind==='papillary').length===4,'Papillairspieren ontbreken');
assert(g.AURICLES.length===2,'Beide boezemaanhangsels moeten zichtbaar zijn');
for(const entry of [...g.CORONARY_DETAILS,...g.MUSCLE_DETAILS,...g.AURICLES]){
  assert(entry.radius>0&&entry.radius<.12,'Detail mag geen grove buis worden: '+entry.id);
  assert(entry.path.length>=3,'Detail heeft een te korte route: '+entry.id);
  valid(g.tubeGeometry(entry.path,entry.radius,12),'detail '+entry.id);
}
for(const valve of g.VALVES){
  assert(g.leafletGeometry(valve,0).count>=600,'Klepbladen moeten een gebogen oppervlak tonen');
}
valid(g.septumGeometry(),'harttussenschot');
assert.equal(g.TENDINOUS_CORDS.length,4);
assert(g.FLOW_PATHS.some(p=>p.channel==='av')&&g.FLOW_PATHS.some(p=>p.channel==='sem'),
  'Doorlopende stroomroutes door beide kleptypen vereist');
console.log('Hartslaglab anatomie: 4 open hartkamers, wanddikten, 4 kleppen, bloedvaten en geometrie gecontroleerd.');
