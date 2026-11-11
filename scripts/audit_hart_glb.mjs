// Lees de werkelijke node- en meshstructuur van de bestaande cardiovasculaire atlas.
// Geen aannames over welk object de hartspier is: namen en bounds eerst controleren.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const path='tools/anatomie/models/cardiovascular.glb';
const data=await readFile(path);
if(data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(4)!==2)throw Error('Onbekend glTF-formaat');
const n=data.readUInt32LE(12),type=data.toString('ascii',16,20);
if(type!=='JSON')throw Error('GLB zonder JSON-chunk');
const gltf=JSON.parse(data.subarray(20,20+n).toString('utf8'));
const regex=/(heart|cardia|coron|atri|ventric|aorta|myocard|papillar|mitral|tricuspid)/i;
const nodes=(gltf.nodes||[]).map((x,i)=>({i,name:x.name||'',mesh:x.mesh,
  translation:x.translation,scale:x.scale,children:x.children?.length}))
  .filter(x=>regex.test(x.name));
const meshes=(gltf.meshes||[]).map((x,i)=>({i,name:x.name||'',primitives:x.primitives?.length}))
  .filter(x=>regex.test(x.name));
const summaries={
  source:path,totalNodes:gltf.nodes?.length||0,totalMeshes:gltf.meshes?.length||0,
  totalBuffers:gltf.buffers?.length||0,
  heartNodes:nodes,heartMeshes:meshes,
  sampleNodes:(gltf.nodes||[]).slice(0,35).map((x,i)=>({i,name:x.name,mesh:x.mesh})),
  sampleMeshes:(gltf.meshes||[]).slice(0,35).map((x,i)=>({i,name:x.name}))
};
await mkdir('audit-anatomie',{recursive:true});
await writeFile('audit-anatomie/heart-glb-audit.json',JSON.stringify(summaries,null,2));
console.log('Cardiovasculair GLB:',summaries.totalNodes,'nodes,',summaries.totalMeshes,'meshes');
console.log('HARTNODES:',JSON.stringify(nodes.slice(0,90)));
console.log('HARTMESHES:',JSON.stringify(meshes.slice(0,90)));
