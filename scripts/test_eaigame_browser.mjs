import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {join,resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(process.argv[2]||'site-build');
const publicRoot=root+sep;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{const path=new URL(req.url,'http://localhost').pathname;let file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(publicRoot)&&file!==root){res.writeHead(403).end();return}
 if(file.endsWith(sep)||!extname(file))file=join(file,'index.html');
 const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(data);
 }catch{res.writeHead(404).end('Niet gevonden')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
await mkdir('test-results',{recursive:true});
let failures=[];
async function session(name,viewport,offline=false){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:name==='mobile',hasTouch:name==='mobile'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 if(offline)await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.addInitScript(()=>{Math.random=()=>.99});
 await page.goto(origin+'/tools/eaigame/3d/',{waitUntil:'domcontentloaded',timeout:20000});
 await page.locator('#setup button[type=submit]').waitFor({state:'visible'});
 const landingStage=await page.locator('#landing-board').boundingBox();
 assert.ok(landingStage?.width>295&&landingStage?.height>290,'Startscherm toont een eigen groot speelbord');
 assert.equal(await page.locator('#landing-board #world').count(),1,'Canvas staat in het bordvlak');
 await page.screenshot({path:'test-results/eaigame-'+name+'-landing.png'});
 await page.locator('#minus').click(); // solo: maximaal twaalf beurten om zes gebieden te herstellen
 await page.locator('#setup button[type=submit]').click();
 assert.ok(await page.locator('#game-ui').isVisible(),'Spel verschijnt na starten');
 assert.equal(await page.locator('#game-board #world').count(),1,'Hetzelfde 3D-bord blijft zichtbaar na starten');
 assert.match(await page.locator('#roll').textContent(),/Gooi dobbelsteen/i,'De hoofdactie gebruikt begrijpelijke woorden');
 if(!offline)await page.locator('#game-board .world-label').first().waitFor({state:'visible',timeout:25000});
 const stage=await page.locator('#game-board').boundingBox();
 const bounds=await page.locator('#world').boundingBox();
 assert.ok(stage?.width>295&&stage?.height>290,'Hele bord heeft een volwaardig oppervlak');
 assert.ok(bounds?.width>=stage.width-2&&bounds?.height>=stage.height-2,'Canvas vult het bordvlak');
 if(name==='mobile'){
   assert.ok(stage.x>=0&&stage.x+stage.width<=viewport.width+2,'Het complete bord past horizontaal op mobiel');
   const rollBox=await page.locator('#roll').boundingBox();
   assert.ok(rollBox&&rollBox.y+rollBox.height<stage.y,'Werpknop staat boven het bord op mobiel');
   assert.ok(stage.y+stage.height<=viewport.height+6,'Het hele spelbord past op mobiel binnen het eerste scherm');
 }
 const startingView=await page.locator('#world').getAttribute('data-camera-distance');
 for(let area=0;area<6;area++){
  await page.locator('#roll').click();
  if(area===0)await page.screenshot({path:'test-results/eaigame-'+name+'-playing.png'});
  const destination=await page.locator('#destinations button').count();assert.ok(destination>=1,'Worp opent een route');
  const button=page.locator('#destinations button').filter({hasText:['De Breuk','De Storm','De Echo','De Stad','Het Atelier','De Arena'][area]});
  assert.ok(await button.count()===1,'Gebied bereikbaar na worp van zes');
  await button.click();
  await page.locator('#challenge').waitFor({state:'visible'});
  if(area===0&&!offline){
    const viewed=await page.locator('#world').getAttribute('data-camera-distance');
    assert.equal(viewed,startingView,'Bezoek aan een gebied zoomt niet automatisch in');
    assert.equal(await page.locator('#world').getAttribute('data-camera-view'),'overview','Bord blijft in overzichtsstand');
  }
  const found=await page.evaluate(async()=>{
   const {QUESTION_BANK}=await import('/assets/eaigame-questions.js');
   const text=document.getElementById('challenge-question').textContent;
   const item=QUESTION_BANK.find(q=>q.question===text);
   return item&&{type:item.type,options:item.options,answer:item.answer};
  });
  assert.ok(found,'De vraag is herleidbaar naar de vraagbank');
  if(found.type==='order'){for(const ix of found.answer)await page.getByRole('button',{name:found.options[ix],exact:true}).click()}
  else await page.getByRole('button',{name:found.options[found.answer],exact:true}).click();
  assert.ok(await page.locator('#check').isEnabled(),'Antwoord kan gecontroleerd worden');
  await page.locator('#check').click();
  assert.match(await page.locator('#feedback').textContent(),/Goed onderzocht/i);
  assert.match(await page.locator('#beacons').textContent(),new RegExp('^'+(area+1)+' / 6$'));
  await page.locator('#continue').click();
 }
 await page.locator('#finished').waitFor({state:'visible'});
 assert.match(await page.locator('#finished-title').textContent(),/Alle bakens branden/);
 await page.screenshot({path:'test-results/eaigame-'+name+'-finished.png'});
 const renderer=await page.evaluate(()=>document.documentElement.dataset.eaigameRenderer||'not-started');
 const viewportWidth=await page.evaluate(()=>document.documentElement.clientWidth);
 const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(scrollWidth<=viewportWidth+8,'Horizontale overflow: '+scrollWidth+' versus '+viewportWidth);
 assert.deepEqual(errors,[],'Geen JavaScript runtimefouten');
 if(process.env.EAIGAME_REQUIRE_3D==='1'&&!offline)assert.equal(renderer,'three','Echte 3D-renderer moet geladen zijn');
 await page.locator('#restart').click();
 assert.ok(await page.locator('#setup').isVisible(),'Een nieuw spel kan starten');
 assert.equal(await page.locator('#landing-board #world').count(),1,'Na herstart staat het 3D-bord terug op startscherm');
 console.log('EAIgame',name,'renderer:',renderer,'vragen:',6,'horizontale overflow:',scrollWidth-viewportWidth);
 await context.close();
}
try{
 await session('desktop',{width:1365,height:820});
 await session('mobile',{width:390,height:844});
 await session('offline',{width:375,height:720},true);
}catch(e){failures.push(e)}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
if(failures.length){for(const error of failures)console.error(error);process.exit(1)}
