// Extracteer uitsluitend hartonderdelen uit de bestaande Z-Anatomy-GLB.
// Draait tijdens build in de gepinde upstream omgeving met glTF-Transform en Draco.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const source=process.argv[2],destination=process.argv[3];
if(!source||!destination)throw Error('Gebruik: node tools/eai-extract-hart.mjs bron.glb uitvoermap');
const definitions=new Map([
  ['Left atrium',['la','Linkerboezem','chamber',[.76,.42,.42]]],
  ['Right atrium',['ra','Rechterboezem','chamber',[.45,.60,.65]]],
  ['Left ventricle',['lv','Linkerkamer','chamber',[.79,.39,.38]]],
  ['Right ventricle',['rv','Rechterkamer','chamber',[.49,.55,.60]]],
  ['Ascending aorta',['ao','Aorta','vessel',[.82,.42,.36]]],
  ['Pulmonary trunk',['pa','Longslagader','vessel',[.34,.58,.73]]],
  ['Left coronary artery',['lca','Linkerkransslagader','artery',[.91,.45,.38]]],
  ['Right coronary artery',['rca','Rechterkransslagader','artery',[.91,.45,.38]]],
  ['Anterior interventricular artery',['lad','Voorste tussenkamerslagader','artery',[.92,.49,.41]]],
  ['Circumflex artery of heart',['circumflex','Omloopslagader','artery',[.91,.45,.38]]],
  ['Great cardiac vein',['cardiac_vein','Grote hartader','vein',[.37,.61,.72]]],
  ['Inferior papillary muscle of left ventricle',['pap_lv_1','Papillairspier linkerkamer','papillary',[.85,.53,.46]]],
  ['Anterior papillary muscle of right ventricle',['pap_rv_1','Voorste papillairspier rechterkamer','papillary',[.78,.53,.48]]],
  ['Inferior papillary muscle of right ventricle',['pap_rv_2','Onderste papillairspier rechterkamer','papillary',[.78,.53,.48]]],
  ['Septal papillary muscle of right ventricle',['pap_rv_3','Septale papillairspier','papillary',[.78,.53,.48]]],
  ['Inferior leaflet of right atrioventricular valve',['tricuspid_leaflet_1','Tricuspidalisklepblad','valve',[.94,.80,.62]]],
  ['Septal leaflet of right atrioventricular valve',['tricuspid_leaflet_2','Septaal tricuspidalisklepblad','valve',[.94,.80,.62]]],
  ['Posterior leaflet of left atrioventricular valve',['mitral_leaflet','Mitralisklepblad','valve',[.95,.80,.63]]],
  ['Left coronary leaflet',['aortic_leaflet_1','Aortaklepblad','valve',[.95,.80,.63]]],
  ['Right coronary leaflet',['aortic_leaflet_2','Aortaklepblad','valve',[.95,.80,.63]]],
  ['Non-coronary leaflet',['aortic_leaflet_3','Aortaklepblad','valve',[.95,.80,.63]]],
  ['Anterior semilunar leaflet of pulmonary valve',['pulmonary_leaflet_1','Pulmonalisklepblad','valve',[.94,.79,.62]]],
  ['Left semilunar leaflet of pulmonary valve',['pulmonary_leaflet_2','Pulmonalisklepblad','valve',[.94,.79,.62]]],
  ['Right semilunar leaflet of pulmonary valve',['pulmonary_leaflet_3','Pulmonalisklepblad','valve',[.94,.79,.62]]]
]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder':await draco3d.createDecoderModule()
});
const doc=await io.read(source);
const transform=(m,p)=>[
  m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
  m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
  m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]
];
const transformNormal=(m,p)=>{
  const n=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2]];
  const len=Math.hypot(...n)||1;return n.map(x=>x/len);
};
const parts=[];
for(const node of doc.getRoot().listNodes()){
  const spec=definitions.get(node.getName());
  const mesh=node.getMesh();
  if(!spec||!mesh)continue;
  const [id,label,kind,color]=spec,model=node.getWorldMatrix();
  const positions=[],normals=[];
  for(const primitive of mesh.listPrimitives()){
    const pos=primitive.getAttribute('POSITION')?.getArray();
    if(!pos)continue;
    const normal=primitive.getAttribute('NORMAL')?.getArray();
    const index=primitive.getIndices()?.getArray();
    const order=index||Array.from({length:pos.length/3},(_,i)=>i);
    if(order.length%3)throw Error('Niet-triangulaire hartmesh: '+node.getName());
    for(let k=0;k<order.length;k++){
      const idx=order[k],p=[pos[idx*3],pos[idx*3+1],pos[idx*3+2]];
      positions.push(...transform(model,p));
      normals.push(...transformNormal(model,normal?
        [normal[idx*3],normal[idx*3+1],normal[idx*3+2]]:[0,0,1]));
    }
  }
  if(positions.length<90)continue;
  parts.push({id,label,kind,color,positions,normals});
}
const chamberIds=['ra','rv','la','lv'];
if(chamberIds.some(id=>!parts.some(p=>p.id===id)))throw Error('Een van de vier echte hartkamers ontbreekt');
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(const part of parts.filter(p=>chamberIds.includes(p.id))){
  for(let i=0;i<part.positions.length;i+=3)for(let a=0;a<3;a++){
    min[a]=Math.min(min[a],part.positions[i+a]);
    max[a]=Math.max(max[a],part.positions[i+a]);
  }
}
const center=min.map((x,i)=>(x+max[i])/2);
const diameter=Math.max(...max.map((x,i)=>x-min[i]));
if(!Number.isFinite(diameter)||diameter<.01)throw Error('Ongeldige anatomische schaal');
const scale=2.75/diameter;
let offset=0;
const chunks=[],manifestParts=[];
for(const part of parts){
  const v=new Float32Array(part.positions.length);
  const n=new Float32Array(part.normals);
  const localMin=[Infinity,Infinity,Infinity],localMax=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<v.length;i+=3)for(let a=0;a<3;a++){
    const x=(part.positions[i+a]-center[a])*scale;
    v[i+a]=x;localMin[a]=Math.min(localMin[a],x);localMax[a]=Math.max(localMax[a],x);
  }
  const vOffset=offset;const vBytes=Buffer.from(v.buffer);offset+=vBytes.byteLength;chunks.push(vBytes);
  const nOffset=offset;const nBytes=Buffer.from(n.buffer);offset+=nBytes.byteLength;chunks.push(nBytes);
  manifestParts.push({id:part.id,label:part.label,kind:part.kind,color:part.color,
    count:v.length/3,positionOffset:vOffset,normalOffset:nOffset,
    center:localMin.map((x,i)=>(x+localMax[i])/2)});
}
if(offset>40*1024*1024)throw Error('Hartmodel te zwaar voor mobiele viewer: '+offset+' bytes');
await mkdir(destination,{recursive:true});
await writeFile(path.join(destination,'atlas-heart.bin'),Buffer.concat(chunks));
const manifest={format:1,source:'nqwrc/3d-anatomy, Z-Anatomy/BodyParts3D',
  provenance:'tools/anatomie/models/cardiovascular.glb',
  sourceMeshCount:manifestParts.length,bytes:offset,parts:manifestParts};
await writeFile(path.join(destination,'atlas-heart.json'),JSON.stringify(manifest));
console.log('ECHTE HARTMESHES:',manifestParts.length,'bytes:',offset,
  'bronmaat:',diameter.toFixed(4),'onderdelen:',manifestParts.map(p=>p.id).join(', '));
