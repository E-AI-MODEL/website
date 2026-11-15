/* Visuele 3D-laag. Gameplay draait onafhankelijk van deze renderer. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const canvas=document.getElementById('world');
const realmColors=['#f5a08b','#76ccef','#c4a3ff','#f6d58a','#80e5c4','#f7aa75'];
const positions=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3-Math.PI/2;return new THREE.Vector3(Math.cos(a)*7,0,Math.sin(a)*7)});
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x071624,.024);scene.background=new THREE.Color(0x071624);
const camera=new THREE.PerspectiveCamera(39,1,.1,150);
const OVERVIEW_POSITION=new THREE.Vector3(1,19.5,21.5);
camera.position.copy(OVERVIEW_POSITION);
canvas.dataset.cameraView='overview';
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power',alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.65;
const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=24;controls.maxDistance=55;controls.minPolarAngle=.35;controls.maxPolarAngle=1.28;controls.autoRotate=false;
controls.addEventListener('change',()=>{canvas.dataset.cameraDistance=camera.position.distanceTo(controls.target).toFixed(2)});
const state={progress:[0,0,0,0,0,0],activeIndex:0,players:[],reach:[],selected:-1,impulse:0,fail:-1};
scene.add(new THREE.HemisphereLight(0xb0ddff,0x06111a,2.2));const sun=new THREE.DirectionalLight(0xffe2c8,2.5);sun.position.set(-8,16,10);scene.add(sun);
function mesh(geom,mat,container,x=0,y=0,z=0){const obj=new THREE.Mesh(geom,mat);obj.position.set(x,y,z);container.add(obj);return obj}
function physical(color,rough=.66,metal=.22){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
const deck=physical(0x183448),dark=physical(0x0c2535),world=new THREE.Group();scene.add(world);
mesh(new THREE.IcosahedronGeometry(2.55,1),physical(0x102f3d,.95),world,0,-1.6,0).scale.set(1.18,.24,1.18);
mesh(new THREE.CylinderGeometry(1.35,1.7,.55,12),physical(0x245265),world,0,-.26,0);
const hubRing=mesh(new THREE.TorusGeometry(1.2,.035,6,84),new THREE.MeshBasicMaterial({color:0x78dacf,transparent:true,opacity:.78}),world,0,.11,0);hubRing.rotation.x=Math.PI/2;
const core=mesh(new THREE.OctahedronGeometry(.65),physical(0x68d1db,.15,.55),world,0,1.1,0);
const coreLight=new THREE.PointLight(0x50dccf,4,5);coreLight.position.set(0,1.7,0);world.add(coreLight);
for(let i=0;i<10;i++){const a=i*Math.PI/5,r=14+(i%3)*2.1;const c=mesh(new THREE.IcosahedronGeometry(1.9+(i%3)*.6,0),physical(0x133246,.95),world,Math.cos(a)*r,-4+(i%2),Math.sin(a)*r);c.scale.y=.18}
function tube(a,b,r,mat){const dir=new THREE.Vector3().subVectors(b,a),m=mesh(new THREE.CylinderGeometry(r,r,dir.length(),8),mat,world);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return m}
for(let i=0;i<6;i++){const a=positions[i],b=positions[(i+1)%6];tube(new THREE.Vector3(a.x,-.23,a.z),new THREE.Vector3(b.x,-.23,b.z),.10,physical(0x24566a));tube(new THREE.Vector3(a.x*.83,-.29,a.z*.83),new THREE.Vector3(a.x*.2,-.29,a.z*.2),.07,physical(0x3c828e))}
const realmGroups=[],hitTargets=[],lights=[],beaconRings=[],caps=[];
const realmNames=['De Breuk','De Storm','De Echo','De Stad','Het Atelier','De Arena'];
const labelLayer=document.createElement('div');labelLayer.className='world-labels';labelLayer.setAttribute('aria-label','Gebieden op het bord');
const labels=realmNames.map((name,i)=>{const button=document.createElement('button');button.type='button';button.className='world-label';button.textContent=name;button.title='Bekijk '+name;button.addEventListener('click',event=>{event.stopPropagation();onSelect(i)});labelLayer.append(button);return button});
canvas.parentElement?.append(labelLayer);
function positionLabels(){const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;for(let i=0;i<6;i++){const projected=positions[i].clone().add(new THREE.Vector3(0,2.65,0)).project(camera);const x=(projected.x+1)*w/2,y=(1-projected.y)*h/2;const el=labels[i];el.style.left=x+'px';el.style.top=y+'px';el.hidden=projected.z>1||x<36||x>w-36||y<18||y>h-18;el.classList.toggle('restored',state.progress[i]>=1);el.classList.toggle('reachable',state.reach.includes(i));el.setAttribute('aria-label',nameForLabel(i));}}
function nameForLabel(i){return realmNames[i]+(state.progress[i]>=1?' · hersteld':state.reach.includes(i)?' · bereikbaar':'')}

function decoration(group,i,col){const c=physical(col,.3,.45),pale=physical(0xe0eff7,.4,.28),baseY=.64;
 const add=(g,mt,x,y,z)=>mesh(g,mt,group,x,y,z);
 if(i===0){for(let k=0;k<6;k++){const t=k*Math.PI/3;const m=add(new THREE.TetrahedronGeometry(.36+(k%3)*.2),c,Math.cos(t)*.85,baseY+.5+(k%3)*.24,Math.sin(t)*.85);m.rotation.set(.3*k,.4*k,.2)}}
 if(i===1){for(let k=0;k<5;k++){const t=k*Math.PI*2/5;let m=add(new THREE.ConeGeometry(.21,.8+(k%3)*.45,5),c,Math.cos(t)*.9,baseY+.5,Math.sin(t)*.9);m.rotation.z=.22*Math.sin(t)}}
 if(i===2){for(let k=0;k<3;k++){const ring=add(new THREE.TorusGeometry(.55+k*.29,.035,8,48),c,0,baseY+.7,0);ring.rotation.y=.5*k;ring.rotation.x=.28+k*.2}}
 if(i===3){for(let k=0;k<8;k++){const x=(k%4-1.5)*.51,z=(Math.floor(k/4)-.5)*.8;add(new THREE.BoxGeometry(.3,.45+(k%3)*.32,.32),k%3?pale:c,x,baseY+.2+(k%3)*.16,z)}}
 if(i===4){for(let k=0;k<5;k++){const t=k*Math.PI*2/5;const m=add(new THREE.BoxGeometry(.32,.55,.32),c,Math.cos(t)*.9,baseY+.35,Math.sin(t)*.9);m.rotation.y=t}}
 if(i===5){for(let k=0;k<2;k++){const ring=add(new THREE.TorusGeometry(.92-k*.22,.095,8,48),c,0,baseY+.2+k*.22,0);ring.rotation.x=Math.PI/2}}
 const crystal=add(new THREE.OctahedronGeometry(.31,0),physical(col,.14,.68),0,1.7,0);caps.push(crystal)
}
for(let i=0;i<6;i++){
 const p=positions[i],g=new THREE.Group();g.position.copy(p);world.add(g);realmGroups.push(g);
 const foundation=mesh(new THREE.CylinderGeometry(2.05,1.82,.46,9),deck,g,0,-.5,0);foundation.scale.y=1.2;
 mesh(new THREE.CylinderGeometry(1.82,1.95,.35,9),dark,g,0,-.12,0);
 mesh(new THREE.CylinderGeometry(1.7,1.73,.08,9),physical(0x295066),g,0,.16,0);
 const outline=mesh(new THREE.TorusGeometry(1.82,.045,6,80),new THREE.MeshBasicMaterial({color:realmColors[i],transparent:true,opacity:.35}),g,0,.2,0);outline.rotation.x=Math.PI/2;beaconRings.push(outline);
 decoration(g,i,realmColors[i]);
 const light=new THREE.PointLight(realmColors[i],2.25,5);light.position.set(0,1.5,0);g.add(light);lights.push(light);
 const hit=mesh(new THREE.CylinderGeometry(2.02,2.02,2.4,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),g,0,.9,0);hit.userData.realmIndex=i;hitTargets.push(hit)
}
const playerTokens=[],tokenColors=['#9ff2e5','#f7bb8b','#b7b5fc','#e5de92'];
function redrawTokens(){const previous=playerTokens.map(t=>t.position.clone());while(playerTokens.length){const m=playerTokens.pop();m.parent?.remove(m);m.geometry.dispose();m.material.dispose()}
 state.players.forEach((pl,k)=>{const loc=Number.isInteger(pl.loc)?pl.loc:-1;const p=loc<0?new THREE.Vector3(0,0,0):positions[loc];const shift=k-(state.players.length-1)/2;const geom=new THREE.OctahedronGeometry(.18,0),mt=new THREE.MeshStandardMaterial({color:tokenColors[k],emissive:tokenColors[k],emissiveIntensity:k===state.activeIndex?.9:.23,metalness:.4});const token=mesh(geom,mt,world,p.x+shift*.28,loc<0?.75:.62,p.z+(loc<0?shift*.25:-.7));token.userData.playerId=k;token.userData.goal=token.position.clone();if(previous[k])token.position.copy(previous[k]);playerTokens.push(token)})}
const starCount=480,starPositions=new Float32Array(starCount*3);for(let i=0;i<starCount;i++){const a=Math.random()*Math.PI*2,r=8+Math.random()*27;starPositions[i*3]=Math.cos(a)*r;starPositions[i*3+1]=(Math.random()-.5)*14;starPositions[i*3+2]=Math.sin(a)*r}const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x8cb6c7,size:.043,transparent:true,opacity:.42})));
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown=null,hover=-1,onSelect=()=>{},running=true;
function indexFromEvent(event){const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);let hit=ray.intersectObjects(hitTargets,false)[0];return hit?.object?.userData?.realmIndex??-1}
canvas.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointerup',e=>{if(!pointerDown)return;const travel=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y);pointerDown=null;if(travel>10)return;const i=indexFromEvent(e);if(i>=0)onSelect(i)});
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const i=indexFromEvent(e);if(i!==hover){hover=i;canvas.style.cursor=i>=0?'pointer':'grab'}});
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?.16:-.16)}}); 
function resize(){const rect=canvas.getBoundingClientRect();const w=Math.max(100,Math.floor(rect.width)),h=Math.max(100,Math.floor(rect.height));if(Math.abs(camera.aspect-w/h)>.0001){camera.aspect=w/h;camera.updateProjectionMatrix()}renderer.setSize(w,h,false);positionLabels()}
let observer=new ResizeObserver(()=>resize());observer.observe(canvas.parentElement);
window.addEventListener('resize',resize);resize();let frame=0;const clock=new THREE.Clock();
function loop(){if(!running)return;requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.06);frame+=dt;core.rotation.y+=dt*.7;core.position.y=1.1+.12*Math.sin(frame*1.7);hubRing.rotation.z=frame*.07;caps.forEach((c,i)=>{c.rotation.y+=dt*(.28+i*.03);c.position.y=1.62+.09*Math.sin(frame*1.25+i)});realmGroups.forEach((g,i)=>{g.position.y=.05*Math.sin(frame*.7+i*.7);const v=state.progress[i]||0,active=state.reach.includes(i);beaconRings[i].material.opacity=v>=1?.95:active?.68:.27;beaconRings[i].scale.setScalar(v>=1?1+.035*Math.sin(frame*2):1);lights[i].intensity=v>=1?5.5:active?3.1:1.45});playerTokens.forEach((m,i)=>{m.position.lerp(m.userData.goal,Math.min(1,dt*4));m.rotation.y+=dt*.7;m.position.y+=Math.sin(frame*2+i)*.0006});controls.update();positionLabels();renderer.render(scene,camera)}loop();
export function createWorld({select}){onSelect=select;return{
 setState(next){Object.assign(state,next);redrawTokens();positionLabels()},
 focus(index){state.selected=index;if(index<0){controls.target.set(0,0,0);camera.position.copy(OVERVIEW_POSITION);canvas.dataset.cameraView='overview'}else{canvas.dataset.cameraView='overview'}controls.update();positionLabels()},
 attach(stage){if(!stage)throw Error('Ontbrekend bord');if(labelLayer.parentElement!==stage)stage.append(labelLayer);observer.disconnect();observer.observe(stage);resize()},
 resize,
 emphasize(index){state.selected=index;positionLabels()},
 destroy(){running=false;observer.disconnect();labelLayer.remove();controls.dispose();renderer.dispose();window.removeEventListener('resize',resize)},
 kind:'three'
}}
