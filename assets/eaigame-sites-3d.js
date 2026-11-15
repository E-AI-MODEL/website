/* Optionele 3D-weergave van het originele Sites-bord.
   De 2D-spelregels, vragen en opslag blijven de enige bron van spelstatus. */
(function () {
  'use strict';
  const board = document.getElementById('board');
  const shell = board && board.closest('.board-shell');
  if (!shell) return;

  const stage = document.createElement('section');
  stage.id = 'eaigame-3d-stage';
  stage.className = 'eaigame-3d-stage';
  stage.hidden = true;
  stage.setAttribute('aria-label', 'Driedimensionaal speelbord');
  stage.innerHTML = [
    '<canvas id="eaigame-3d-canvas" tabindex="0" aria-label="Driedimensionale versie van de 32 speelvakken en het oorspronkelijke eiland"></canvas>',
    '<div class="eaigame-3d-toolbar">',
    '<span class="eaigame-3d-title">EAIgame <small>32 vakken · hetzelfde spel</small></span>',
    '<div class="eaigame-3d-actions">',
    '<button type="button" id="eaigame-3d-overview" aria-pressed="true">Hele bord</button>',
    '<button type="button" id="eaigame-3d-follow" aria-pressed="false">Volg pion</button>',
    '<button type="button" id="eaigame-3d-close" aria-label="Terug naar het oorspronkelijke bord">Terug naar bord</button>',
    '</div></div>',
    '<p class="eaigame-3d-status" id="eaigame-3d-status" role="status">3D-weergave laden…</p>'
  ].join('');
  shell.append(stage);
  const canvas = stage.querySelector('canvas');
  const status = stage.querySelector('#eaigame-3d-status');
  const overview = stage.querySelector('#eaigame-3d-overview');
  const follow = stage.querySelector('#eaigame-3d-follow');
  const closeButton = stage.querySelector('#eaigame-3d-close');
  const viewSwitch = document.getElementById('eaigame-view-switch');
  const caption = document.getElementById('boardCaption');
  let originalCaption = '';
  const prefersLessMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.module.js';
  let three = null, scene = null, camera = null, renderer = null, observer = null;
  let opening = false, open = false, frame = 0, mode = 'overview', lastFrame = 0;
  let figures = [], observed = [], tweens = [], tileMeshes = [];
  let heading = null, lookAt = null;
  const orbit = {yaw: 0.40, elevation: 0.98, distance: 19.8};
  let drag = null;
  const cellPositions = [];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const positionOf = index => cellPositions[index];

  function setStatus(message, visible) {
    status.textContent = message;
    status.hidden = !visible;
  }

  function resize() {
    if (!renderer || !open) return;
    const rect = stage.getBoundingClientRect();
    const w = Math.max(1,Math.round(rect.width));
    const h = Math.max(1,Math.round(rect.height));
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }

  function tileTexture(t) {
    const el = document.createElement('canvas');
    el.width = el.height = 256;
    const ctx = el.getContext('2d');
    const c = CATS[t.cat];
    const special = t.type !== 'question';
    const bg = t.type === 'start' ? '#7545d5' : special ? '#f1e7ff' : c.bg;
    const accent = t.type === 'start' ? '#ffffff' : special ? '#9675b5' : c.color;
    ctx.fillStyle = bg; ctx.fillRect(0,0,256,256);
    ctx.fillStyle = accent; ctx.fillRect(0,0,256,25);
    ctx.fillStyle = t.type === 'start' ? '#ffffff' : '#443553';
    ctx.font = '600 35px system-ui,sans-serif';
    ctx.fillText(String(t.i).padStart(2,'0'),24,79);
    ctx.font = '600 25px system-ui,sans-serif';
    const label = t.label.length > 11 ? t.label.slice(0,11) : t.label;
    ctx.fillText(label,24,164,218);
    const texture = new three.CanvasTexture(el);
    texture.colorSpace = three.SRGBColorSpace;
    texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function makeBoard() {
    const group = new three.Group();
    scene.add(group);
    const base = new three.Mesh(
      new three.BoxGeometry(12.2,0.35,12.2),
      new three.MeshStandardMaterial({color:'#e8e1f2',roughness:0.86})
    );
    base.position.y = -0.23; group.add(base);
    const center = new three.Mesh(
      new three.PlaneGeometry(9.4,9.4),
      new three.MeshStandardMaterial({color:'#f4effa',roughness:0.93,side:three.DoubleSide})
    );
    center.rotation.x = -Math.PI/2;
    center.position.y = -0.045; group.add(center);

    for (const t of tiles) {
      const x = (t.col-5)*1.32, z = (t.row-5)*1.32;
      cellPositions[t.i] = new three.Vector3(x,0.20,z);
      const color = t.type === 'question' ? CATS[t.cat].color : '#a885c7';
      const tile = new three.Mesh(
        new three.BoxGeometry(1.18,0.25,1.18),
        new three.MeshStandardMaterial({color,roughness:0.68})
      );
      tile.position.set(x,0.08,z);
      tile.userData.tileIndex=t.i;
      tileMeshes.push(tile);
      group.add(tile);
      const face = new three.Mesh(
        new three.PlaneGeometry(1.13,1.13),
        new three.MeshBasicMaterial({map:tileTexture(t),side:three.DoubleSide})
      );
      face.rotation.x = -Math.PI/2; face.position.set(x,0.211,z); group.add(face);
    }

    // Gebruik exact de SVG van de Sites-app als afbeelding op het 3D-eiland.
    const originalIsland = document.querySelector('#island svg');
    if (originalIsland) {
      const image = new XMLSerializer().serializeToString(originalIsland);
      const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(image);
      new three.TextureLoader().load(uri, texture => {
        texture.colorSpace = three.SRGBColorSpace;
        const shape = new three.Mesh(
          new three.PlaneGeometry(8.7,6.35),
          new three.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:three.DoubleSide})
        );
        shape.rotation.x = -Math.PI/2;
        shape.position.y = -0.010;
        group.add(shape);
      }, undefined, () => setStatus('Het eiland kon niet worden geladen; het speelbord blijft beschikbaar.',true));
    }
  }

  function createFigure(index) {
    const group = new three.Group();
    const color = COLORS[index % COLORS.length];
    const material = new three.MeshStandardMaterial({color,roughness:0.45,metalness:0.04});
    const body = new three.Mesh(new three.ConeGeometry(0.25,0.68,16),material);
    body.position.y = 0.45; group.add(body);
    const head = new three.Mesh(new three.SphereGeometry(0.205,16,12),material);
    head.position.y = 0.92; group.add(head);
    const foot = new three.Mesh(
      new three.CylinderGeometry(0.28,0.32,0.08,16),
      new three.MeshStandardMaterial({color:'#ffffff',roughness:0.6})
    );
    foot.position.y = 0.12; group.add(foot);
    scene.add(group);
    return group;
  }

  function pawnTarget(playerIndex) {
    const p = state.players[playerIndex];
    const onTile = state.players.map((item,index) => ({item,index})).filter(entry => entry.item.pos === p.pos);
    const rank = onTile.findIndex(entry => entry.index === playerIndex);
    const position = positionOf(p.pos).clone();
    if (onTile.length <= 1) return position;
    // Pionnen die hetzelfde vak delen, moeten elk zichtbaar blijven.
    const columns = Math.min(onTile.length,2);
    const rows = Math.ceil(onTile.length/2);
    const column = rank % columns;
    const row = Math.floor(rank/columns);
    position.x += (column-(columns-1)/2)*0.42;
    position.z += (row-(rows-1)/2)*0.42;
    return position;
  }

  function syncFigures(now) {
    const players = state.players || [];
    if (figures.length !== players.length) {
      for (const figure of figures) scene.remove(figure);
      figures = players.map((_,index) => createFigure(index));
      observed = players.map(p => p.pos);
      tweens = players.map(() => null);
      players.forEach((_,i) => figures[i].position.copy(pawnTarget(i)));
    }
    players.forEach((p,i) => {
      const figure = figures[i];
      const previous = observed[i];
      const to = pawnTarget(i);
      const moved = previous !== p.pos;
      const offsetChanged = !tweens[i] && figure.position.distanceTo(to) > 0.03;
      if (moved || offsetChanged) {
        const from = figure.position.clone();
        if (moved && i === state.current) {
          const direction = positionOf(p.pos).clone().sub(positionOf(previous));
          if (direction.lengthSq() > 0.0001) heading.copy(direction.normalize());
        }
        tweens[i] = {from,to,start:now,duration:prefersLessMotion?0:200};
        observed[i] = p.pos;
      }
      const tween = tweens[i];
      if (tween) {
        const fraction = tween.duration ? clamp((now-tween.start)/tween.duration,0,1) : 1;
        const eased = fraction*fraction*(3-2*fraction);
        figure.position.lerpVectors(tween.from,tween.to,eased);
        if (fraction === 1) tweens[i] = null;
      }
      figure.scale.setScalar(i === state.current ? 1.08 : 0.88);
    });
  }

  function updateCamera() {
    if (mode === 'follow' && figures[state.current]) {
      const p = figures[state.current].position;
      // Schuin achter de pion en buiten de bordrand: route én eiland blijven zichtbaar.
      // Een lage camera op pionhoogte liet alleen grote pionnen en lege lucht zien.
      const outward = new three.Vector3(p.x,0,p.z);
      if (outward.lengthSq() > 0.001) outward.normalize();
      else outward.set(0,0,1);
      const desired = p.clone().addScaledVector(heading,-3.8).addScaledVector(outward,3.2);
      desired.y = 7.3;
      const target = p.clone().addScaledVector(heading,1.8).lerp(new three.Vector3(0,0,0),0.29);
      target.y = 0.08;
      camera.position.lerp(desired,prefersLessMotion?1:0.17);
      lookAt.lerp(target,prefersLessMotion?1:0.19);
      camera.lookAt(lookAt);
    } else {
      const flat = Math.cos(orbit.elevation)*orbit.distance;
      const desired = new three.Vector3(
        Math.sin(orbit.yaw)*flat,
        Math.sin(orbit.elevation)*orbit.distance,
        Math.cos(orbit.yaw)*flat
      );
      camera.position.lerp(desired,prefersLessMotion?1:0.20);
      lookAt.lerp(new three.Vector3(0,0,0),prefersLessMotion?1:0.20);
      camera.lookAt(lookAt);
    }
  }

  function animate(now) {
    if (!open || document.hidden) {frame=0;return;}
    if (!lastFrame || now-lastFrame >= 16) {
      syncFigures(now);
      updateCamera();
      renderer.render(scene,camera);
      lastFrame = now;
    }
    frame = requestAnimationFrame(animate);
  }

  function setMode(value) {
    mode = value === 'follow' ? 'follow' : 'overview';
    stage.dataset.view = mode;
    canvas.dataset.cameraView = mode;
    overview.setAttribute('aria-pressed',String(mode === 'overview'));
    follow.setAttribute('aria-pressed',String(mode === 'follow'));
    if (mode === 'follow') {
      const p = state.players[state.current];
      if (p) {
        const prev = positionOf((p.pos+31)%32);
        const current = positionOf(p.pos);
        heading.copy(current).sub(prev).normalize();
        if (heading.lengthSq() < 0.001) heading.set(0,0,-1);
      }
    }
  }

  async function toggle() {
    if (open) {close();return;}
    if (opening) return;
    opening = true;
    stage.hidden = false;
    document.body.classList.add('eaigame-3d-active');
    if(viewSwitch){viewSwitch.setAttribute('aria-pressed','true');viewSwitch.textContent='3D actief';}
    if(caption){originalCaption=caption.textContent;caption.textContent='Draai het bord of kies Volg pion. Tik op een vak voor uitleg.';}
    setStatus('3D-weergave laden…',true);
    closeButton.focus();
    try {
      if (!window.WebGLRenderingContext) throw Error('Deze browser ondersteunt geen WebGL.');
      if (!three) three = await import(CDN);
      // Een gesloten laadvenster mag niet alsnog onzichtbaar gaan renderen.
      if (stage.hidden) return;
      if (!renderer) {
        scene = new three.Scene();
        scene.background = new three.Color('#f5f2fb');
        scene.add(new three.HemisphereLight('#ffffff','#aa98c1',2.6));
        const sun = new three.DirectionalLight('#ffffff',2.1);
        sun.position.set(-5,11,8); scene.add(sun);
        camera = new three.PerspectiveCamera(52,1,0.1,100);
        camera.position.set(9,14,14);
        lookAt = new three.Vector3(0,0,0);
        heading = new three.Vector3(0,0,-1);
        renderer = new three.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
        renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio || 1));
        renderer.outputColorSpace = three.SRGBColorSpace;
        makeBoard();
        observer = new ResizeObserver(resize);
        observer.observe(stage);
      }
      open = true; stage.dataset.ready = 'true';
      canvas.dataset.engine = 'three';
      setMode('overview');
      setStatus('Sleep om het bord te draaien. Tik op Volg pion om mee te reizen.',false);
      resize();
      frame = requestAnimationFrame(animate);
    } catch (error) {
      stage.dataset.ready = 'false';
      canvas.dataset.engine = 'unavailable';
      setStatus('3D is hier niet beschikbaar. Gebruik Terug naar bord om gewoon verder te spelen.',true);
      console.warn('EAIgame optionele 3D-weergave:',error);
    } finally {opening = false;}
  }

  function close() {
    open = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastFrame = 0;
    stage.hidden = true;
    document.body.classList.remove('eaigame-3d-active');
    if(viewSwitch){viewSwitch.setAttribute('aria-pressed','false');viewSwitch.textContent='Bekijk in 3D';}
    if(caption)caption.textContent=originalCaption;
    requestAnimationFrame(() => { positionPawns(); viewSwitch?.focus({preventScroll:true}); });
  }

  viewSwitch?.addEventListener('click',toggle);
  overview.addEventListener('click', () => setMode('overview'));
  follow.addEventListener('click', () => setMode('follow'));
  closeButton.addEventListener('click',close);
  function hitTestTile(event) {
    if (!open || !three || !camera) return;
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX-bounds.left)/bounds.width)*2-1;
    const y = -((event.clientY-bounds.top)/bounds.height)*2+1;
    const ray = new three.Raycaster();
    ray.setFromCamera(new three.Vector2(x,y),camera);
    const hit = ray.intersectObjects(tileMeshes,false)[0];
    if (hit && Number.isInteger(hit.object.userData.tileIndex)) {
      tileInfo(tiles[hit.object.userData.tileIndex]);
    }
  }
  canvas.addEventListener('pointerdown',event => {
    if (mode !== 'overview') return;
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event => {
    if (!drag || drag.id !== event.pointerId || mode !== 'overview') return;
    if (Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5) drag.moved=true;
    orbit.yaw -= (event.clientX-drag.x)*0.009;
    orbit.elevation = clamp(orbit.elevation+(event.clientY-drag.y)*0.006,0.35,1.40);
    drag.x=event.clientX;drag.y=event.clientY;
  });
  canvas.addEventListener('pointerup',event => {
    if ((mode==='overview' && drag?.id===event.pointerId && !drag.moved) ||
        (mode==='follow' && !drag)) hitTestTile(event);
    if (drag?.id===event.pointerId) drag=null;
  });
  canvas.addEventListener('pointercancel',event => {
    if (drag?.id===event.pointerId) drag=null;
  });
  canvas.addEventListener('wheel',event => {
    if (mode !== 'overview') return;
    event.preventDefault();
    orbit.distance = clamp(orbit.distance + Math.sign(event.deltaY)*1.3,14,31);
  },{passive:false});
  canvas.addEventListener('keydown',event => {
    if (mode !== 'overview') return;
    const steps={ArrowLeft:[-0.13,0,0],ArrowRight:[0.13,0,0],ArrowUp:[0,-0.09,0],ArrowDown:[0,0.09,0],'+':[0,0,-1],'-':[0,0,1],'=':[0,0,-1]};
    const step=steps[event.key];
    if (!step) return;
    event.preventDefault();
    orbit.yaw+=step[0];
    orbit.elevation=clamp(orbit.elevation+step[1],0.35,1.40);
    orbit.distance=clamp(orbit.distance+step[2],14,31);
  });
  document.addEventListener('visibilitychange', () => {
    if (open && !document.hidden && !frame) frame=requestAnimationFrame(animate);
  });

  window.EAIGame3D = {toggle,close,setMode,
    get active(){return open;},
    get view(){return mode;},
    get cameraPosition(){return camera?.position.toArray() || [];},
    get pawnPositions(){return figures.map(figure=>figure.position.toArray());},
    tileScreenPosition(index){
      const position=positionOf(index)?.clone();
      if (!position || !camera) return null;
      position.y=0.25;
      position.project(camera);
      const rect=canvas.getBoundingClientRect();
      return {x:rect.left+(position.x+1)*rect.width/2,y:rect.top+(1-position.y)*rect.height/2};
    }
  };
})();