// Bouw een zelfstandige hartatlas uit bestaande BodyParts3D 4.0-anatomie.
// Bron: Niyaz-05/heart-anatomy-lab (34 structuren, 142 atlasdelen).
// Alleen de modelgegevens worden gebruikt, niet de bron-app of UI.
// De brondownload is vastgezet op commit, bestandsgrootte en SHA-256.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const dest=process.argv[2];
if(!dest)throw Error('Gebruik: node tools/eai-extract-hart-rich.mjs /pad/naar/lab');
const SOURCE_COMMIT='ad9af6cf7a1e9be26b31fe37a8235d85a6cbf909';
const URL='https://raw.githubusercontent.com/Niyaz-05/heart-anatomy-lab/'+SOURCE_COMMIT+'/public/models/heart.glb';
const HASH='0c734c396007422badf0dd027bccc5821537c9f9c1217cdd3eb9139c0bb3a802';
const EXPECTED_BYTES=2632752;
const abort=AbortSignal.timeout(45000);
const response=await fetch(URL,{signal:abort,redirect:'error',headers:{'User-Agent':'EAI-HeartAtlas-SourceImport/1.0'}});
if(!response.ok)throw Error('Anatomische modelbron niet bereikbaar: '+response.status);
const bytes=new Uint8Array(await response.arrayBuffer());
if(bytes.byteLength!==EXPECTED_BYTES)throw Error('Hartmodel-brongrootte onjuist: '+bytes.byteLength);
const actual=createHash('sha256').update(bytes).digest('hex');
if(actual!==HASH)throw Error('Hartmodel SHA-256 wijkt af: '+actual);
if(Buffer.from(bytes.slice(0,4)).toString('ascii')!=='glTF')throw Error('Bron is geen GLB');
const document=await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(bytes);
const meta={
  'right-atrium-wall':['ra_wall','Rechterboezemwand','wall',[.60,.32,.30]],
  'left-atrium-wall':['la_wall','Linkerboezemwand','wall',[.69,.35,.31]],
  'ventricular-wall':['ventricular_wall','Hartspier van de kamers','wall',[.67,.30,.29]],
  'right-atrium':['ra','Rechterboezem (bloedruimte)','space',[.43,.33,.32]],
  'left-atrium':['la','Linkerboezem (bloedruimte)','space',[.57,.29,.29]],
  'right-ventricle':['rv','Rechterkamer (bloedruimte)','space',[.40,.29,.28]],
  'left-ventricle':['lv','Linkerkamer (bloedruimte)','space',[.54,.26,.26]],
  'tricuspid-valve':['tricuspid','Tricuspidalisklep','valve',[.89,.76,.64]],
  'pulmonary-valve':['pulmonary','Pulmonalisklep','valve',[.89,.75,.62]],
  'mitral-valve':['mitral','Mitralisklep','valve',[.91,.77,.63]],
  'aortic-valve':['aortic','Aortaklep','valve',[.91,.75,.62]],
  'right-papillary-muscles':['pap_rv','Papillairspieren rechterkamer','papillary',[.73,.39,.33]],
  'left-papillary-muscles':['pap_lv','Papillairspieren linkerkamer','papillary',[.76,.37,.32]],
  'superior-vena-cava':['svc','Bovenste holle ader','vessel',[.45,.35,.37]],
  'inferior-vena-cava':['ivc','Onderste holle ader','vessel',[.43,.34,.37]],
  'pulmonary-trunk':['pa','Longslagaderstam','vessel',[.65,.40,.38]],
  'right-pulmonary-artery':['pa_right','Rechterlongslagader','vessel',[.64,.40,.37]],
  'left-pulmonary-artery':['pa_left','Linkerlongslagader','vessel',[.63,.41,.37]],
  'right-superior-pulmonary-vein':['pv_rs','Rechterbovenste longader','vessel',[.66,.43,.37]],
  'right-inferior-pulmonary-vein':['pv_ri','Rechteronderste longader','vessel',[.65,.43,.37]],
  'left-superior-pulmonary-vein':['pv_ls','Linkerbovenste longader','vessel',[.68,.42,.36]],
  'left-inferior-pulmonary-vein':['pv_li','Linkeronderste longader','vessel',[.66,.43,.38]],
  'ascending-aorta':['ao','Stijgende aorta','vessel',[.72,.36,.32]],
  'aortic-arch':['ao_arch','Aortaboog','vessel',[.73,.36,.32]],
  'descending-thoracic-aorta':['ao_desc','Dalende borstaorta','vessel',[.73,.37,.33]],
  'left-main-coronary-artery':['lca','Linkerkransslagader','artery',[.82,.39,.32]],
  'left-anterior-descending-artery':['lad','Voorste tussenkamerslagader','artery',[.83,.38,.31]],
  'circumflex-artery':['circumflex','Omloopslagader','artery',[.81,.40,.32]],
  'right-coronary-artery':['rca','Rechterkransslagader','artery',[.82,.38,.30]],
  'coronary-sinus':['coronary_sinus','Kransaderboezem','vein',[.43,.46,.54]],
  'great-cardiac-vein':['cardiac_vein','Grote hartader','vein',[.43,.46,.54]],
  'middle-cardiac-vein':['middle_cardiac_vein','Middelste hartader','vein',[.43,.47,.52]],
  'small-cardiac-vein':['small_cardiac_vein','Kleine hartader','vein',[.43,.46,.52]],
  'other-cardiac-veins':['cardiac_veins','Overige hartaders','vein',[.42,.47,.53]]
};
const names=new Set(Object.keys(meta));
const meshes=[];
const transform=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
  m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const normalTransform=(m,p)=>{const v=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]],a=Math.hypot(...v)||1;return v.map(x=>x/a)};
for(const node of document.getRoot().listNodes()){
  const name=node.getName(),mesh=node.getMesh();
  if(!names.has(name)||!mesh)continue;
  const vertices=[],normals=[],tissue=[],world=node.getWorldMatrix();
  for(const primitive of mesh.listPrimitives()){
    const position=primitive.getAttribute('POSITION')?.getArray();
    const normal=primitive.getAttribute('NORMAL')?.getArray();
    const extra=primitive.getAttribute('_TISSUE')?.getArray();
    const indices=primitive.getIndices()?.getArray();
    if(!position||!normal||!indices||indices.length%3)throw Error('Onvolledig bronmesh '+name);
    for(const vertex of indices){
      const i=vertex*3;
      const v=transform(world,[position[i],position[i+1],position[i+2]]);
      const n=normalTransform(world,[normal[i],normal[i+1],normal[i+2]]);
      if(v.some(x=>!Number.isFinite(x))||n.some(x=>!Number.isFinite(x)))throw Error('Niet-eindige meshcoördinaat '+name);
      vertices.push(...v);normals.push(...n);
      const j=vertex*4;
      tissue.push(extra?extra[j]/255:1,extra?extra[j+1]/255:.5,extra?extra[j+2]/255:0);
    }
  }
  if(vertices.length<90)throw Error('Bronstructuur te klein '+name);
  meshes.push({name,vertices,normals,tissue,meta:meta[name]});
  names.delete(name);
}
if(names.size)throw Error('Ontbrekende anatomische structuren: '+[...names].join(', '));
if(meshes.length!==34)throw Error('Verwacht 34 structuurmeshes, ontvangen '+meshes.length);
const wallMeshes=meshes.filter(x=>x.meta[2]==='wall');
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(const {vertices} of wallMeshes)for(let i=0;i<vertices.length;i+=3)for(let a=0;a<3;a++){
  min[a]=Math.min(min[a],vertices[i+a]);max[a]=Math.max(max[a],vertices[i+a]);
}
const center=min.map((v,i)=>(v+max[i])*.5);
const diameter=Math.max(...max.map((v,i)=>v-min[i]));
if(!(diameter>.02&&diameter<.3))throw Error('Hartmodel heeft ongeldige ruimtelijke afmetingen: '+diameter);
const scale=2.75/diameter, chunks=[],parts=[];
let offset=0;
for(const part of meshes){
  const count=part.vertices.length/3;
  const v=new Float32Array(part.vertices.length),n=new Float32Array(part.normals),t=new Float32Array(part.tissue);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<v.length;i+=3)for(let axis=0;axis<3;axis++){
    const value=(part.vertices[i+axis]-center[axis])*scale;
    v[i+axis]=value;lo[axis]=Math.min(lo[axis],value);hi[axis]=Math.max(hi[axis],value);
  }
  const stores=[];
  for(const arr of [v,n,t]){const buff=Buffer.from(arr.buffer);stores.push(offset);chunks.push(buff);offset+=buff.byteLength;}
  parts.push({id:part.meta[0],label:part.meta[1],kind:part.meta[2],color:part.meta[3],
    count,positionOffset:stores[0],normalOffset:stores[1],tissueOffset:stores[2],
    center:lo.map((value,axis)=>(value+hi[axis])*.5)});
}
if(offset>22*1024*1024)throw Error('Verrijkt hartmodel te zwaar voor mobiel: '+offset);
await mkdir(resolve(dest),{recursive:true});
await writeFile(join(resolve(dest),'atlas-heart-rich.bin'),Buffer.concat(chunks));
await writeFile(join(resolve(dest),'atlas-heart-rich.json'),JSON.stringify({
  format:2,source:'BodyParts3D 4.0, DBCLS, CC BY 4.0',parts,
  sourceRepo:'https://github.com/Niyaz-05/heart-anatomy-lab',sourceCommit:SOURCE_COMMIT,
  sourceFile:'public/models/heart.glb',sourceSha256:HASH,
  modifications:'Gecentreerd, uniform geschaald; bestaande anatomische meshposities en ingebakken oppervlakteschaduw behouden',
  originalElements:142,sourceMeshCount:parts.length,bytes:offset
}));
console.log('ECHTE RIJKE HARTATLAS:',parts.length,'structuren,',offset,'bytes, bron:',HASH);
