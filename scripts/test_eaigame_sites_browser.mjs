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
try{
 await run('desktop',{width:1365,height:820});
 await run('mobile',{width:390,height:844},true);
}catch(err){failed=true;console.error(err)}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
if(failed)process.exitCode=1;
