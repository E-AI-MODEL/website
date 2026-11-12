import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const root=process.argv[2]||'site-build',engine=process.argv[3]==='webkit'?webkit:chromium;
const port=8891,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
mkdirSync('test-results',{recursive:true});
try{
 let ok=false;
 for(let i=0;i<100;i++){try{if((await fetch(base+'/tools/science-observatory/labs/natuurkunde/')).ok){ok=true;break}}catch{}await pause(120)}
 assert(ok,'Built physics page must be served');
 browser=await engine.launch({headless:true});
 for(const width of [320,390,768,1024,1440]){
  const height=width<500?740:width<1100?768:900;
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:width<500?2:1,isMobile:width<500,hasTouch:width<500});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#projectile',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#scene').width>0 && document.querySelector('#labTitle').textContent.includes('Schuine'));
  const geometry=await page.evaluate(()=>{
   const rect=sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
   return {w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,lab:rect('#labSection'),scene:rect('#stage'),head:rect('.lab-head'),quick:rect('#mobileQuick'),side:rect('#inspector')};
  });
  assert(geometry.scrollW<=width+2,'No horizontal page overflow '+width+': '+JSON.stringify(geometry));
  assert(geometry.scrollH<=height+2,'No vertical page overflow '+width+': '+JSON.stringify(geometry));
  assert(geometry.scene.width>150 && geometry.scene.height>100,'Scene stays usable '+width+': '+JSON.stringify(geometry));
  assert.equal(await page.locator('.experiment-link').count(),53,'All 53 labs are available');
  if(width<=720){
   assert(await page.locator('#mobileQuick').isVisible(),'Quick controls visible on phone');
   assert(await page.locator('#quick-v').isVisible(),'Projectile speed can be typed on phone');
   assert(await page.locator('#inquiryAction').isVisible(),'Throw button stays in main view');
   assert(!(await page.locator('#mobileAim').isVisible()),'Duplicate large control group removed');
   await page.locator('#quick-v').fill('21.5');await page.locator('#quick-v').dispatchEvent('change');
   await page.locator('#quickMore').click();
   assert(await page.locator('#inspector').evaluate(el=>el.classList.contains('open')),'All settings open as drawer');
   assert(await page.locator('#num-angle').isVisible(),'Detailed numeric settings are available');
   await page.locator('#num-angle').fill('32.5');await page.locator('#num-angle').dispatchEvent('change');
   assert.equal(await page.locator('#num-angle').inputValue(),'32.5');
   await page.locator('#closeMobileSettings').click();
   await page.locator('[data-bottom="graph"]').click();
   assert(await page.locator('.analysis-shell').evaluate(el=>el.classList.contains('compact-open')),'Graph opens inside fixed workspace');
   await page.locator('[data-bottom="graph"]').click();
   assert(!(await page.locator('.analysis-shell').evaluate(el=>el.classList.contains('compact-open'))),'Graph closes without scrolling');
   await page.locator('#openExplorer').click();
   assert(await page.locator('#explorer').evaluate(el=>el.classList.contains('open')),'Experiment list opens');
   await page.locator('#search').fill('wheatstone');
   assert(await page.locator('[data-open="wheatstone"]').isVisible(),'Zoeken toont een proef uit een gesloten groep');
   await page.locator('#search').fill('');
   const wheatstoneGroup=page.locator('.group-set').filter({has:page.locator('[data-open="wheatstone"]')}).locator('.group-header');
   if(await wheatstoneGroup.getAttribute('aria-expanded')==='false')await wheatstoneGroup.click();
   await page.locator('[data-open="wheatstone"]').click();
   await page.waitForFunction(()=>document.querySelector('#labTitle').textContent.toLowerCase().includes('wheatstone'));
   const graphHeight=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
   assert(graphHeight>=120,'Op de telefoon is ook de grafiek van een meetproef zichtbaar zonder extra tik: '+graphHeight);
   await page.waitForFunction(()=>!document.querySelector('#explorer').classList.contains('open'));
   await page.waitForTimeout(270);
  }else{
   assert.equal(await page.locator('#controls>.precision-control').count(),await page.evaluate(()=>interfaceFor(state.id).main.length),'Alleen de voor deze proef belangrijke knoppen staan meteen in beeld');
   const extra=page.locator('#controls>.more-controls');
   if(await extra.count()){
    assert(!(await extra.evaluate(el=>el.open)),'Extra instellingen starten dichtgeklapt');
    await extra.locator(':scope > summary').click();
    assert(await extra.evaluate(el=>el.open),'Extra instellingen zijn uitklapbaar');
    assert(await extra.locator('input[type=number]').first().isVisible(),'Extra instelwaarde blijft bereikbaar');
    await extra.locator(':scope > summary').click();
   }
   const inputs=page.locator('.precision-control-row input[type="number"]');
   assert(await inputs.count()>=2,'Number inputs replace bulky sliders');
   assert(await page.locator('input[type=range]').first().isHidden(),'Range is collapsed by default');
   await page.locator('.precision-control-row details summary').first().click();
   assert(await page.locator('.precision-control-row input[type=range]').first().isVisible(),'Slider remains available on request');
   await page.locator('#num-v').fill('20.5');await page.locator('#num-v').dispatchEvent('change');
   assert.equal(await page.locator('#num-v').inputValue(),'20.5');
   if(width===1024){await page.locator('#toggleExplorer').click();assert(await page.locator('#explorer').evaluate(el=>el.classList.contains('open')),'Catalogue opens at tablet width');await page.locator('#closeExplorer').click();}
   if(width===1440){
    const expand=page.locator('#graphExpand'),initial=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    await expand.click();
    const larger=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    assert(larger>initial+35,'Uitklapknop maakt grafiek groter');
    await expand.click();
    const restored=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    assert(Math.abs(restored-initial)<3,'Uitklapknop herstelt de oorspronkelijke ruimte');
    const divider=page.locator('#sceneDivider'), before=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height),rect=await divider.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width/2,rect.y-75,{steps:6});
    await page.mouse.up();
    const after=await page.locator('.analysis-shell').evaluate(el=>el.getBoundingClientRect().height);
    assert(after>before+30,'Leerling kan de grafiek met de scheidingslijn groter maken: '+before+' -> '+after);
   }
   await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#wheatstone',{waitUntil:'load'});
   await page.waitForFunction(()=>document.querySelector('#labTitle').textContent.toLowerCase().includes('wheatstone'));
   assert.equal(await page.locator('[data-bottom="graph"]').getAttribute('aria-selected'),'true','Nieuwe proef start met grafiek');
   const plot=page.locator('#plot'),r=await plot.boundingBox();
   await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);
   const probe=await page.evaluate(()=>state.graphProbe);
   assert(probe!==null&&probe>.1&&probe<.9,'Muis beweegt het meetpunt over de grafiek');
   assert((await page.locator('#graphDomain').innerText()).includes(':'),'Grafiek toont de waarde onder de muis');
   await plot.focus();await page.keyboard.press('ArrowRight');
   const shifted=await page.evaluate(()=>state.graphProbe);
   assert(shifted>probe,'Ook met pijltjestoetsen is de grafiek afleesbaar');
   const wheatstoneCurve=await page.evaluate(()=>{
    const d=graphSpecFor(state.id,state.p,state.t),q=(state.p.R4-d.min)/(d.max-d.min);
    return {graph:state.current.fn(q),measured:bridgeVoltage(state.p)};
   });
   assert(Math.abs(wheatstoneCurve.graph-wheatstoneCurve.measured)<1e-9,'Grafiek toont dezelfde brugspanning als de meetbrug');
  }
  assert.equal(await page.locator('#num-R3').count(),0,'Hidden Wheatstone resistance remains unknown');
  assert(await page.locator('#num-R4').count()===1,'Other circuit settings remain editable');
  if(width<=720)assert(await page.locator('#quick-R4').isVisible(),'Balancing resistor appears in the direct mobile controls');
  const actionGeometry=await page.evaluate(()=>{const a=document.querySelector('#inquiryAction').getBoundingClientRect(),r=document.querySelector('#inquiryBar').getBoundingClientRect();return{actionLeft:a.left,actionRight:a.right,barLeft:r.left,barRight:r.right}});
  assert(actionGeometry.actionLeft>=actionGeometry.barLeft-1&&actionGeometry.actionRight<=actionGeometry.barRight+1,'Research action is not clipped: '+JSON.stringify(actionGeometry));
  if(width<=720)assert(!(await page.locator('#explorer').evaluate(el=>el.classList.contains('open'))),'The experiment chooser closes after selection');

  if(width===1440){
   const uiCheck=await page.evaluate(()=>{
    const problems=[];
    for(const lab of experiments){
     const g=labInterfaces[lab.id],keys=lab.controls.map(r=>r[0]);
     if(!g){problems.push(lab.id+': geen bediening');continue}
     if(g.main.length<2||g.main.length>3||new Set(g.main).size!==g.main.length||g.main.some(k=>!keys.includes(k)))problems.push(lab.id+': onjuiste hoofdinstellingen');
     if(!['time','control','inspect'].includes(g.mode))problems.push(lab.id+': grafiekrol ontbreekt');
     if(g.mode==='control'&&g.axis!=='gas'&&!keys.includes(g.axis))problems.push(lab.id+': grafiek stuurt onbekende grootheid');
     if(g.mode==='time'&&!g.factor)problems.push(lab.id+': tijdschaal ontbreekt');
     try{const p=Object.fromEntries(lab.controls.map(([k,,,,,v])=>[k,v]));graphSpecFor(lab.id,p,0)}catch(e){problems.push(lab.id+': '+e.message)}
    }
    return {count:experiments.length,problems};
   });
   assert.equal(uiCheck.count,53,'Alle proeven houden een eigen bedieningsconfiguratie');
   assert.deepEqual(uiCheck.problems,[],'Grafiek en fysieke bediening kloppen per proef');
   const selectLab=async id=>{await page.evaluate(id=>loadLab(id),id);assert.equal(await page.locator('#labTitle').innerText(),await page.evaluate(id=>byId[id].title,id));};
   const graphDrag=async(from,to=from)=>{
    const rect=await page.locator('#plot').boundingBox(),y=rect.y+rect.height*.5;
    await page.mouse.move(rect.x+rect.width*from,y);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width*to,y,{steps:6});
    await page.mouse.up();
   };
   await selectLab('resultant');
   assert.equal(await page.locator('#controls>.precision-control').count(),3,'Vectoren hebben drie directe instelbare grootheden');
   await selectLab('pulleys');
   await graphDrag(.63);
   const pulley=await page.evaluate(()=>({n:state.p.n,discrete:discreteGraphs.has(state.id)}));
   assert(pulley.discrete&&Number.isInteger(pulley.n),'Aantal dragende touwdelen kan alleen geheel zijn');
   const ropePhysics=await page.evaluate(()=>{
    const domain=graphSpecFor(state.id,state.p,state.t),q=(state.p.n-domain.min)/(domain.max-domain.min);
    const observed=Number(state.current.readouts[1][1].split(' ')[0].replace(',','.'));
    return {graph:state.current.fn(q),observed};
   });
   assert(Math.abs(ropePhysics.graph-ropePhysics.observed)<.06,'Grafiekpunt bij heel aantal touwen is dezelfde trekkracht als de meting');
   await selectLab('bohr');
   await graphDrag(.8);
   const bohr=await page.evaluate(()=>({n:state.p.n1,discrete:discreteGraphs.has(state.id)}));
   assert(bohr.discrete&&Number.isInteger(bohr.n)&&bohr.n>=2,'Bohr-niveau blijft een geheel getal');
   const energy=await page.evaluate(()=>{
    const domain=graphSpecFor(state.id,state.p,state.t),n=state.p.n1;
    return {value:state.current.fn((n-domain.min)/(domain.max-domain.min)),expected:-13.6/(n*n)};
   });
   assert(Math.abs(energy.value-energy.expected)<1e-9,'Bohr-grafiek gebruikt de energie van een geheel niveau');
   await selectLab('doppler');
   const doppler=await page.evaluate(()=>{
    const d=graphSpecFor(state.id,state.p,state.t),q=(state.p.vs-d.min)/(d.max-d.min);
    const measured=Number(state.current.readouts[0][1].split(' ')[0].replace(',','.'));
    return {graph:state.current.fn(q),measured,expected:state.p.f*state.p.v/(state.p.v-state.p.vs)};
   });
   assert(Math.abs(doppler.graph-doppler.expected)<1e-8&&Math.abs(doppler.measured-doppler.expected)<.02,'Doppler-grafiek en meetwaarde gebruiken dezelfde snelheid');
   await selectLab('ohm');
   const ohmBefore=await page.evaluate(()=>({...state.p}));
   const rOhm=await page.locator('#plot').boundingBox();
   await page.mouse.move(rOhm.x+rOhm.width*.75,rOhm.y+rOhm.height*.5);
   assert.equal(await page.evaluate(()=>state.p.U),ohmBefore.U,'Alleen aanwijzen verandert de spanning niet');
   await graphDrag(.72,.87);
   const ohm=await page.evaluate(()=>({p:{...state.p},readout:state.current.readouts[0][1]}));
   assert(ohm.p.U>ohmBefore.U+4&&ohm.p.R===ohmBefore.R,'Slepen verandert alleen de spanning');
   assert(Math.abs(Number(ohm.readout.split(' ')[0].replace(',','.'))-ohm.p.U/ohm.p.R)<.02,'Stroom volgt de wet van Ohm');
   await selectLab('pendulum');
   await graphDrag(.7);
   const pendulum=await page.evaluate(()=>({t:state.t,playing:state.playing,p:{...state.p},domain:graphSpecFor(state.id,state.p,state.t)}));
   assert(!pendulum.playing&&pendulum.t>0,'Slepen over tijd stopt de slinger en kiest een tijdstip');
   const expectedPendulum=.7*(pendulum.domain.max-pendulum.domain.min)+pendulum.domain.min;
   assert(Math.abs(pendulum.t-expectedPendulum)<.3,'Aflezing en simulatie gebruiken dezelfde tijd');
   await selectLab('double');
   const doubleBefore=await page.evaluate(()=>JSON.stringify(state.p));
   await graphDrag(.68);
   assert.equal(await page.evaluate(()=>JSON.stringify(state.p)),doubleBefore,'Bij een ruimtelijke intensiteitsgrafiek verandert een meetpunt geen golflengte');
   assert((await page.locator('#graphDomain').innerText()).includes(':'),'Ruimtelijke meting is afleesbaar');
   await selectLab('gas');
   assert.equal(await page.locator('#num-mode').evaluate(el=>el.tagName),'SELECT','Gasproces is een betekenisvolle keuze');
   await page.locator('#num-mode').selectOption('2');
   assert(await page.locator('#num-T').isVisible(),'Bij vast volume is temperatuur direct verstelbaar');
   assert(!(await page.locator('#num-V').isVisible()),'Vast volume staat achter de andere instellingen');
   const gasBefore=await page.evaluate(()=>({...state.p}));
   await graphDrag(.78);
   const gas=await page.evaluate(()=>({...state.p}));
   assert(gas.T>gasBefore.T&&gas.V===gasBefore.V,'Isochore grafiek verandert T en behoudt V');
   await page.locator('#num-mode').selectOption('0');
   assert(await page.locator('#num-V').isVisible(),'Bij constante temperatuur is volume direct verstelbaar');
   await page.locator('#controls>.more-controls>summary').click();
   await page.locator('#num-T').fill('300');
   await page.locator('#num-T').dispatchEvent('change');
   await page.locator('#controls>.more-controls>summary').click();
   await page.locator('#num-mode').selectOption('1');
   const beforeIsobar=await page.evaluate(()=>({T:state.p.T,V:state.p.V,pressure:8.314*state.p.T/state.p.V}));
   await graphDrag(.62);
   const afterIsobar=await page.evaluate(()=>({T:state.p.T,V:state.p.V,pressure:8.314*state.p.T/state.p.V}));
   assert(afterIsobar.V>beforeIsobar.V&&afterIsobar.T>beforeIsobar.T,'Bij een isobaar proces stijgt T mee met V');
   assert(Math.abs(afterIsobar.pressure-beforeIsobar.pressure)<.015,'Druk blijft constant als het volume verandert');
   await selectLab('resistors');
   assert.equal(await page.locator('#num-mode').evaluate(el=>el.tagName),'SELECT','Serie en parallel zijn gewone keuzes');
   await page.locator('#num-mode').selectOption('0');
   await graphDrag(.76);
   const series=await page.evaluate(()=>({p:{...state.p},r:state.current.readouts[0][1]}));
   assert(Math.abs(Number(series.r.split(' ')[0].replace(',','.'))-(series.p.R1+series.p.R2))<.02,'Serie: weerstanden tellen op');
   const seriesGraph=await page.evaluate(()=>{
    const d=graphSpecFor(state.id,state.p,state.t),q=(state.p.R2-d.min)/(d.max-d.min);
    return state.current.fn(q);
   });
   assert(Math.abs(seriesGraph-(series.p.R1+series.p.R2))<1e-7,'Grafiek en serieschakeling gebruiken dezelfde waarde voor R2');
   await page.locator('#num-mode').selectOption('1');
   const parallel=await page.evaluate(()=>({p:{...state.p},r:state.current.readouts[0][1]}));
   assert(Math.abs(Number(parallel.r.split(' ')[0].replace(',','.'))-parallel.p.R1*parallel.p.R2/(parallel.p.R1+parallel.p.R2))<.02,'Parallel: vervangingsweerstand volgt parallelformule');
   await page.screenshot({path:'test-results/physics-graph-interactions-'+engine.name()+'.png'});
  }
  await page.screenshot({path:'test-results/physics-fixed-'+engine.name()+'-'+width+'.png'});

  if(width===390||width===1440){
   // Start bij iedere proef op dezelfde manier. Werkelijke pointerevents doorlopen de
   // geometrie van het model, de regelaar, de meetwaarden en de grafiek.
   const inspectModel=async id=>{
    await page.evaluate(id=>loadLab(id),id);
    return page.evaluate(()=>({...state.p}));
   };
   const grabAndDrag=async(dx,dy)=>{
    const loc=await page.evaluate(()=>{
     const c=document.querySelector('#scene'),g=sceneViewport(c),r=c.getBoundingClientRect(),p=state.p,a=p.angle*Math.PI/180;
     let pt=null;
     switch(state.id){
      case 'hydro':pt={x:540,y:105+p.depth/12*300};break;
      case 'potentiometer':pt={x:340+310*p.position/100,y:197};break;
      case 'incline':{const len=Math.min(580,330/Math.max(.0001,Math.sin(a)));pt={x:170+len*Math.cos(a),y:400-len*Math.sin(a)};break}
      case 'resolution':pt={x:325+p.F*Math.cos(a)*13,y:367-p.F*Math.sin(a)*13};break;
      case 'resultant':case 'equilibrium':pt={x:460+p.F2*Math.cos(a)*12,y:285-p.F2*Math.sin(a)*12};break;
      case 'ohm':pt={x:432+(p.R-1)/29*136,y:201};break;
      case 'wheatstone':pt={x:582+(p.R4-1)/39*84,y:398};break;
      case 'gas':pt={x:110+(p.V-2)/10*740,y:390-210*Math.log10(1+(8.314*p.T/p.V)/100)};break;
     }
     return {x:r.left+g.left+pt.x*g.scale,y:r.top+g.top+pt.y*g.scale,scale:g.scale,pt};
    });
    assert(loc.pt,'Deze proef moet een eigen bediening in de tekening hebben');
    await page.mouse.move(loc.x+8*loc.scale,loc.y+5*loc.scale);
    await page.mouse.down();
    const began=await page.evaluate(()=>({...state.p}));
    await page.mouse.move(loc.x+(8+dx)*loc.scale,loc.y+(5+dy)*loc.scale,{steps:8});
    await page.mouse.up();
    const after=await page.evaluate(()=>({...state.p}));
    return {began,after,loc};
   };
   const approx=(a,b,tolerance,message)=>assert(Math.abs(a-b)<=tolerance,message+' : '+a+' tegenover '+b);
   for(const [id,dx,dy,key] of [
     ['hydro',0,76,'depth'],
     ['potentiometer',80,0,'position'],
     ['incline',0,-62,'angle'],
     ['resolution',43,-18,'F'],
     ['resultant',38,-21,'F2'],
     ['equilibrium',35,-20,'F2'],
     ['ohm',48,0,'R'],
     ['wheatstone',30,0,'R4']
   ]){
    const original=await inspectModel(id),{began,after}=await grabAndDrag(dx,dy);
    approx(began[key],original[key],.000001,id+' mag niet verspringen bij aanraken');
    assert(after[key]>began[key],id+' verandert zijn eigen grootheid bij slepen');
    const data=await page.evaluate(()=>({rows:state.current.readouts,graph:graphSpecFor(state.id,state.p,state.t)}));
    if(id==='hydro')approx(Number(data.rows[0][1].replace(',','.').split(' ')[0]),after.rho*after.g*after.depth,1,id+' druk volgt rho*g*h');
    if(id==='potentiometer')approx(Number(data.rows[0][1].replace(',','.').split(' ')[0]),after.U*after.position/100,.03,id+' spanningsdeling');
    if(id==='ohm')approx(Number(data.rows[0][1].replace(',','.').split(' ')[0]),after.U/after.R,.03,id+' wet van Ohm');
    if(id==='wheatstone')approx(Number(data.rows[0][1].replace(',','.').split(' ')[0]),await page.evaluate(()=>bridgeVoltage(state.p)),.03,id+' brugspanning');
    if(id==='resolution')approx(Math.hypot(after.F*Math.cos(after.angle*Math.PI/180),after.F*Math.sin(after.angle*Math.PI/180)),after.F,.0001,id+' vectorcomponenten');
    if(id==='incline')assert(data.rows[0][0]==='Langs de helling',id+' helling behoudt krachtmeting');
   }
   await inspectModel('gas');
   const startIsotherm=await page.evaluate(()=>({...state.p}));
   const movedIsotherm=await grabAndDrag(90,0);
   assert(movedIsotherm.after.V>startIsotherm.V,'Isotherm: meetpunt in de tekening verandert volume');
   approx(movedIsotherm.after.T,startIsotherm.T,.0001,'Isotherm: temperatuur blijft gelijk');
   await page.evaluate(()=>state.graphSetters.mode(1));
   const beforeIsobar=await page.evaluate(()=>({...state.p}));
   const movedIsobar=await grabAndDrag(50,0);
   assert(movedIsobar.after.V>beforeIsobar.V&&movedIsobar.after.T>beforeIsobar.T,'Isobaar: T verandert mee met V');
   approx(8.314*movedIsobar.after.T/movedIsobar.after.V,8.314*beforeIsobar.T/beforeIsobar.V,.03,'Isobaar: druk constant');
   await page.evaluate(()=>state.graphSetters.mode(2));
   const beforeIsochoor=await page.evaluate(()=>({...state.p}));
   const movedIsochoor=await grabAndDrag(0,-45);
   assert(movedIsochoor.after.T>beforeIsochoor.T,'Isochoor: meetpunt verandert temperatuur');
   approx(movedIsochoor.after.V,beforeIsochoor.V,.0001,'Isochoor: volume blijft gelijk');
   assert.deepEqual(errors,[],'Geen scriptfouten bij directe bediening');
   await page.screenshot({path:'test-results/physics-touch-hands-on-'+engine.name()+'-'+width+'.png'});
  }
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#interference',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#labTitle').textContent.toLowerCase().includes('interferentie'));
  assert(await page.locator('#scene').isVisible());
  // De leerling sleept het driehoekige steunpunt, niet de twee krachtpijlen.
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#lever',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#labTitle').textContent==='De hefboom');
  const leverStart=await page.evaluate(()=>{
   const p=state.p,c=document.querySelector('#scene'),r=c.getBoundingClientRect(),g=sceneViewport(c),pivot=p.pivot??510;
   return {x:r.left+g.left+pivot*g.scale,y:r.top+g.top+350*g.scale,scale:g.scale,pivot,left:pivot-65*p.arm1,right:pivot+65*p.arm2,p:{...p}};
  });
  await page.mouse.move(leverStart.x+leverStart.scale*12,leverStart.y);
  await page.mouse.down();
  const pressed=await page.evaluate(()=>({pivot:state.p.pivot??510,arm1:state.p.arm1,arm2:state.p.arm2}));
  assert.equal(pressed.pivot,leverStart.pivot,'Het steunpunt springt niet weg bij aanraken');
  assert.equal(pressed.arm1,leverStart.p.arm1,'Aanraken zonder slepen verandert de linker arm niet');
  await page.mouse.move(leverStart.x+leverStart.scale*(65+12),leverStart.y,{steps:10});
  await page.mouse.up();
  const leverEnd=await page.evaluate(()=>{
   const p=state.p,pivot=p.pivot??510,F2=p.F*p.arm1/p.arm2;
   return {pivot,arm1:p.arm1,arm2:p.arm2,left:pivot-65*p.arm1,right:pivot+65*p.arm2,F2,shown:state.current.readouts[1][1],graphCursor:graphSpecFor(state.id,p,state.t).cursor,numArm2:document.querySelector('#num-arm2').value,numArm1:document.querySelector('#num-arm1').value};
  });
  assert(leverEnd.pivot>leverStart.pivot+40,'De leerling kan het driehoekje langs de balk schuiven');
  assert(leverEnd.arm1>leverStart.p.arm1&&leverEnd.arm2<leverStart.p.arm2,'Beide armen veranderen in de juiste richting');
  assert(Math.abs(leverEnd.left-leverStart.left)<.02&&Math.abs(leverEnd.right-leverStart.right)<.02,'Beide krachtpijlen blijven op hun eigen plek');
  assert(Math.abs(leverEnd.arm1+leverEnd.arm2-(leverStart.p.arm1+leverStart.p.arm2))<1e-7,'De totale afstand tussen de krachten blijft gelijk');
  assert(Math.abs(Number(leverEnd.shown.split(' ')[0].replace(',','.'))-leverEnd.F2)<.02,'De nieuwe tegenkracht voldoet aan F1*r1 = F2*r2');
  assert.equal(Number(leverEnd.numArm2),leverEnd.arm2,'De instelling voor rechter arm volgt het verslepen');
  assert.equal(Number(leverEnd.numArm1),leverEnd.arm1,'Ook de uitklapbare instelling voor linker arm volgt mee');
  assert.equal(leverEnd.graphCursor,leverEnd.arm2,'De grafiek gebruikt de verschoven rechter arm');
  await page.screenshot({path:'test-results/physics-lever-drag-'+engine.name()+'-'+width+'.png'});
  await page.locator('#resetBtn').click();
  const leverReset=await page.evaluate(()=>({pivot:state.p.pivot??510,arm1:state.p.arm1,arm2:state.p.arm2}));
  assert.equal(leverReset.pivot,510,'Herstel zet het draaipunt terug');
  assert.equal(leverReset.arm1,2,'Herstel zet de linker arm terug');
  assert.equal(leverReset.arm2,3,'Herstel zet de rechter arm terug');
  await page.goto(base+'/tools/science-observatory/labs/natuurkunde/#pendulum',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#scene').width>0);
  assert.deepEqual(errors,[],'No browser script errors '+width);
  console.log(engine.name()+' '+width+'px: viewport, controls, data and switching labs OK');
  await page.close();
 }
}finally{if(browser)await browser.close();server.kill();}
