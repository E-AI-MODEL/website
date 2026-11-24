import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {join,resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(process.argv[2]||'.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    let file=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}
    if(!extname(file))file=join(file,'index.html');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
    res.end(await readFile(file));
  }catch{res.writeHead(404).end('Niet gevonden')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
let failed=false;
async function run(name,viewport,phone=false){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:phone,hasTouch:phone});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
   const response=await page.goto(origin+'/tools/eaigame/',{waitUntil:'domcontentloaded',timeout:20000});
   assert.equal(response.status(),200,'Speelpagina bereikbaar');
   await page.locator('#board .tile').first().waitFor({state:'visible',timeout:7000});
   const summary=await page.evaluate(()=>({
     background:getComputedStyle(document.body).backgroundColor,
     tiles:document.querySelectorAll('#board .tile').length,
     svg:!!document.querySelector('#island svg'),
     title:document.querySelector('h1')?.textContent?.trim(),
     boardBox:document.querySelector('#board').getBoundingClientRect().toJSON(),
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   }));
   assert.equal(summary.background,'rgb(245, 243, 250)','Lichte Sites-achtergrond');
   assert.equal(summary.tiles,32,'Originele 32 speelvakken, precies een keer');
   assert.ok(summary.svg,'Oorspronkelijk eiland wordt gerenderd');
   assert.match(summary.title,/Een worp\. Een ontdekking\./);
   assert.ok(summary.boardBox.width>250,'Bord leesbaar');
   assert.ok(summary.scrollWidth<=summary.clientWidth+8,'Geen horizontale overflow');
   await page.screenshot({path:'test-results/eaigame-sites-'+name+'-board.png',fullPage:true});
   await page.locator('#bankButton').click();
   assert.ok(await page.locator('#bankDialog').isVisible(),'Bestaande vragenbeheer blijft beschikbaar');
   assert.ok((await page.locator('#bankList .bank-item').count())>0,'Vragenbank niet leeg');
   await page.locator('#bankDialog [data-close]').first().click();
   await page.locator('#settings').click();
   if(!(await page.locator('#setupDialog').isVisible())){
     console.error('EAIgame setup diagnostic',await page.evaluate(()=>({bankOpen:document.querySelector('#bankDialog').open,setupOpen:document.querySelector('#setupDialog').open,settingsDisabled:document.querySelector('#settings').disabled,bodyClasses:document.body.className,active:document.activeElement?.id,dialogCount:document.querySelectorAll('dialog[open]').length})));
     console.error('EAIgame browser errors',errors);
   }
   assert.ok(await page.locator('#setupDialog').isVisible(),'Spelinstellingen beschikbaar');
   await page.locator('#countButtons [data-count="1"]').click();
   await page.locator('#nameInputs input').first().fill('Testspeler');
   await page.locator('#startGame').click();
   assert.equal(await page.locator('#currentName').innerText(),'Testspeler');
   assert.equal(await page.locator('#board .pawn').count(),1,'Pionnen niet dubbel');
   const initial=await page.locator('#pawn0').getAttribute('aria-label');
   await page.locator('#roll').click();
   await page.waitForFunction(()=>{
     const s=document.querySelector('#pawn0')?.getAttribute('aria-label');
     return !!s && !s.endsWith('vak 0');
   },null,{timeout:10000});
   const after=await page.locator('#pawn0').getAttribute('aria-label');
   assert.notEqual(after,initial,'Dobbelsteen zet de pion echt in beweging');
   await page.screenshot({path:'test-results/eaigame-sites-'+name+'-turn.png',fullPage:true});
   assert.deepEqual(errors,[],'Geen browser-JavaScriptfouten');
   console.log(name,'Sites-uiterlijk + vragenbank + spelstart + pionbeweging gecontroleerd.',JSON.stringify(summary));
 }finally{await context.close()}
}
async function validateLevels(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(origin+'/tools/eaigame/',{waitUntil:'domcontentloaded'});
  await page.locator('#board .tile').first().waitFor();
  assert.equal(await page.evaluate(()=>window.EAIGAME_LEVEL_QUESTIONS?.length),300);
  assert.ok(await page.locator('#extra-opts').isVisible());
  await page.locator('#settings').click();
  await page.locator('#countButtons [data-count="2"]').click();
  assert.equal(await page.locator('#nameInputs [data-player-level]').count(),2);
  await page.locator('#nameInputs [data-player-level]').nth(0).selectOption('vmbo');
  await page.locator('#nameInputs [data-player-level]').nth(1).selectOption('vwo');
  await page.locator('#startGame').click();
  assert.deepEqual(await page.evaluate(()=>state.players.map(p=>p.level)),['vmbo','vwo']);
  await page.evaluate(()=>ask('rekenen'));
  assert.match(await page.locator('#questionCategory').innerText(),/VMBO.*CONCEPT/);
  assert.match(await page.locator('#eaigame-question-origin').innerText(),/niveau niet geijkt/i);
  const question=await page.evaluate(()=>({type:currentQ.type,answer:currentQ.answer,id:currentQ.id}));
  assert.match(question.id,/-vmbo$/);
  if(question.type==='order')await page.evaluate(()=>{order=[...currentQ.answer];renderOrder()});
  else await page.locator('input[name="answer"]').nth(question.answer).check();
  await page.locator('#checkAnswer').click();
  assert.ok((await page.locator('#eaigame-feedback-actions, .eaigame-feedback-actions').count())>=1);
  await page.getByRole('button',{name:'Voor nabespreking'}).click();
  const log=await page.evaluate(()=>JSON.parse(localStorage.getItem('eaigame-antwoorden-v1')||'[]'));
  assert.equal(log.length,1);assert.equal(log[0].level,'vmbo');assert.equal(log[0].discuss,true);
  assert.deepEqual(errors,[],'Extra modules veroorzaken geen browserfouten');
  console.log('EAIgame niveautest geslaagd: per speler, conceptvraag en antwoordenlog');
 }finally{await context.close()}
}


async function validate3D(name, viewport, phone=false){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:phone,hasTouch:phone});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 try{
  await page.goto(origin+'/tools/eaigame/',{waitUntil:'domcontentloaded'});
  await page.locator('#board .tile').first().waitFor({state:'visible'});
  await page.locator('#eaigame-view-switch').click();
  await page.waitForFunction(()=>!!document.querySelector('#eaigame-3d-canvas')?.dataset.engine,null,{timeout:30000});
  assert.equal(await page.locator('#eaigame-3d-canvas').getAttribute('data-engine'),'three','Echte Three.js 3D-renderer actief');
  assert.ok(await page.locator('#eaigame-3d-stage').isVisible(),'3D staat op de plaats van het bord');
  assert.ok(!await page.locator('#board').isVisible(),'Geen dubbel 2D- en 3D-bord');
  await page.waitForFunction(()=>window.EAIGame3D.pawnPositions.length===state.players.length);
  const pawns=await page.evaluate(()=>window.EAIGame3D.pawnPositions);
  assert.equal(pawns.length,2,'Twee 3D-pionnen zichtbaar bij spel met twee spelers');
  assert.notDeepEqual(pawns[0],pawns[1],'Twee pionnen op hetzelfde startvak overlappen niet');
  const tileClick=await page.evaluate(()=>window.EAIGame3D.tileScreenPosition(12));
  assert.ok(tileClick && Number.isFinite(tileClick.x)&&Number.isFinite(tileClick.y));
  if(phone)await page.touchscreen.tap(tileClick.x,tileClick.y);
  else await page.mouse.click(tileClick.x,tileClick.y);
  assert.match(await page.locator('#boardCaption').innerText(),/Vak 12/,'3D-vak geeft dezelfde informatie als het Sites-bord');
  await page.screenshot({path:'test-results/eaigame-'+name+'-3d-tile.png',fullPage:true});
  assert.equal(await page.locator('#eaigame-3d-canvas').getAttribute('data-camera-view'),'overview');
  await page.screenshot({path:'test-results/eaigame-'+name+'-3d.png',fullPage:true});
  await page.locator('#eaigame-3d-follow').click();
  assert.equal(await page.locator('#eaigame-3d-canvas').getAttribute('data-camera-view'),'follow');
  await page.waitForTimeout(350);
  const before=await page.evaluate(()=>window.EAIGame3D.cameraPosition);
  await page.evaluate(()=>{state.players[0].pos=1;state.current=0;});
  await page.waitForTimeout(450);
  const after=await page.evaluate(()=>window.EAIGame3D.cameraPosition);
  assert.ok(Math.hypot(...after.map((x,i)=>x-before[i]))>0.2,'3D-camera beweegt werkelijk mee met pion');
  await page.screenshot({path:'test-results/eaigame-'+name+'-3d-follow.png',fullPage:true});
  await page.locator('#eaigame-3d-overview').click();
  assert.equal(await page.locator('#eaigame-3d-canvas').getAttribute('data-camera-view'),'overview');
  await page.locator('#eaigame-3d-close').click();
  assert.ok(await page.locator('#board').isVisible(),'Originele bord terug');
  assert.equal(await page.locator('#board .tile').count(),32);
  assert.deepEqual(errors,[],'Geen browserfouten tijdens 3D-wissel');
  console.log(name,'3D-overzicht, volgcamera, pionbeweging en terug naar Sites-bord geslaagd');
 }finally{await context.close();}
}

try{
 await validateLevels();
 await validate3D('desktop',{width:1365,height:820});
 await validate3D('mobile',{width:390,height:844},true);
 await run('desktop',{width:1365,height:820});
 await run('mobile',{width:390,height:844},true);
}catch(err){failed=true;console.error(err)}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
if(failed)process.exitCode=1;
