import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {mkdirSync,readFileSync} from "node:fs";
import {resolve,join} from "node:path";
import assert from "node:assert/strict";
const root=resolve(process.argv[2]||"site-build"),out=resolve("test-results");
mkdirSync(out,{recursive:true});
const base="http://127.0.0.1:8873";
const server=spawn("python3",["-m","http.server","8873","--bind","127.0.0.1","--directory",root],{stdio:"ignore"});
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b){let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){
 const local=[],central=[];let offset=0;
 for(const [name,value] of files){const n=Buffer.from(name),b=Buffer.from(value),sum=crc(b);
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt32LE(sum,14);l.writeUInt32LE(b.length,18);l.writeUInt32LE(b.length,22);l.writeUInt16LE(n.length,26);local.push(l,n,b);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(sum,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=l.length+n.length+b.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,dir,end]);
}
const archive=zip([["eigen-site/index.html","<!doctype html><title>Hallo</title>"],["eigen-site/css/site.css","body{color:red}"],["eigen-site/.env","SECRET=fixture"]]);
const safeArchive=zip([["eigen-site/index.html","<h1>Hallo</h1>"],["eigen-site/css/site.css","body{}"]]);
let zipOnly=false;
let browser;const errors=[],sent=[];
try{
 let online=false;for(let i=0;i<65;i++){try{online=(await fetch(base)).ok;}catch{}if(online)break;await new Promise(r=>setTimeout(r,110));}assert(online);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 await page.addInitScript(()=>{
  window.__copiedProjectAdvice="";
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
   writeText:async(value)=>{window.__copiedProjectAdvice=String(value);}
  }});
 });
 const spawned=[];page.on("worker",w=>spawned.push(w.url()));
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith(base))sent.push({method:r.method(),url:r.url()});});
 await page.route("https://api.github.com/**",route=>{
  const url=route.request().url();
  const data=url.includes("/git/trees/")?{sha:"fixture-sha",tree:zipOnly?[{type:"blob",path:"project.zip"}]:[{type:"blob",path:"index.html"}],truncated:false}:{full_name:"voorbeeld/project",html_url:"https://github.com/voorbeeld/project",private:false,default_branch:"main"};
  return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(data)});
 });
 await page.goto(base+"/tools/eaigit/");
 assert.equal(await page.title(),"EAIgit · Stap voor stap naar GitHub");
 assert.equal(await page.locator(".eg-logo img").getAttribute("src"),"/assets/eaigit/logo.svg");
 assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"),"/assets/eaigit/icon.svg");
 assert(await page.locator("#stage-intent").isVisible());
 assert.equal(await page.locator("#stage-source").isVisible(),false);
 await page.screenshot({path:join(out,"eaigit-start.png"),fullPage:true});
 // Elke vraag staat op een eigen scherm.
 await page.locator('[data-intent="start"]').click();
 assert(await page.locator("#stage-source").isVisible());
 assert.equal(await page.locator("#stage-intent").isVisible(),false);
 await page.locator('[data-source="both"]').click();
 assert(await page.locator("#stage-zip").isVisible());
 await page.locator("#zipFile").setInputFiles({name:"site.zip",mimeType:"application/zip",buffer:archive});
 assert.equal(await page.locator("#zipNext").isEnabled(),true);
 await page.locator("#zipNext").click();
 assert(await page.locator("#stage-repo").isVisible());
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#repoNext").click();
 assert(await page.locator("#stage-aim").isVisible());
 await page.locator("#projectAim").fill("Bezoekers moeten een pagina kunnen openen");
 await page.screenshot({path:join(out,"eaigit-intake.png"),fullPage:true});
 await page.locator("#analyze").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:15000});
 assert.match(await page.locator("#resultHeading").innerText(),/privébestanden/);
 assert.equal(await page.locator("#goodDetails").getAttribute("open"),null);
 assert.match(await page.locator("#goodPoints").textContent(),/HTML-bestanden/);
 assert.match(await page.locator("#problemPoints").textContent(),/privébestanden/);
 assert.match(await page.locator("#unknownPoints").textContent(),/Logische fouten/);
 assert.equal(await page.locator("#repoLink").getAttribute("href"),"https://github.com/voorbeeld/project");
 assert.equal(await page.locator("#actionsLink").getAttribute("href"),"https://github.com/voorbeeld/project/actions");
 assert.ok(spawned.filter(url=>url.includes("onderzoek-worker.mjs")).length>=2,"GitHub en ZIP werken in aparte browserworkers");
 assert.equal(await page.locator("#stage-guide").isVisible(),false);
 assert.equal(sent.filter(x=>x.method!=="GET").length,0,"Geen uploads naar een externe server");
 assert.equal(sent.filter(x=>x.url.startsWith("https://api.github.com/")).length,2);
 await page.screenshot({path:join(out,"eaigit-desktop.png"),fullPage:true});
 // De begeleiding toont maar een handeling en geen standaardprompt.
 await page.locator("#startGuidance").click();
 assert(await page.locator("#stage-guide").isVisible());
 assert.match(await page.locator("#guideTitle").innerText(),/privébestanden/);
 assert.equal(await page.locator("#promptDetails").isVisible(),false);
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#guideTitle").innerText(),/map klaar/);
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#guideTitle").innerText(),/ontbreekt/);
 await page.locator("#promptDetails summary").click();
 const stepPrompt=await page.locator("#stepPrompt").inputValue();
 assert.match(stepPrompt,/repository/i);
 assert.match(stepPrompt,/zonder mijn toestemming/);
 await page.locator("#copyPrompt").click();
 assert.match(await page.locator("#copyStatus").innerText(),/Gekopieerd/);
 assert.equal(await page.evaluate(()=>window.__copiedProjectAdvice),stepPrompt);
 await page.locator("#guideBack").click();
 assert.match(await page.locator("#guideTitle").innerText(),/map klaar/);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:join(out,"eaigit-mobiel.png"),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Geen horizontale scroll op mobiel");
 for(let k=0;k<8;k++){
  if(await page.locator("#stage-finished").isVisible())break;
  await page.locator("#guideNext").click();
 }
 assert(await page.locator("#stage-finished").isVisible());
 assert.match(await page.locator("#stage-finished").innerText(),/niet gecontroleerd/);
 assert(await page.locator("#checkAgain").isVisible());
 // Foutpad: ongeldige URL wordt op hetzelfde scherm afgehandeld.
 await page.locator("#finishReset").click();
 await page.locator('[data-intent="repair"]').click();
 await page.locator('[data-source="github"]').click();
 assert(await page.locator("#stage-repo").isVisible());
 await page.locator("#repoUrl").fill("javascript:alert(1)");
 await page.locator("#repoNext").click();
 assert.match(await page.locator("#repoError").innerText(),/repositorylink/);
 assert(await page.locator("#stage-repo").isVisible());
 // Tweede volledige route: repository bevat alleen een ZIP.
 zipOnly=true;
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#repoNext").click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 assert.match(await page.locator("#problemPoints").textContent(),/ZIP in GitHub/);
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/ZIP uit/);
 // Derde route: bezoeker heeft nog geen bestanden.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="explore"]').click();
 await page.locator('[data-source="unknown"]').click();
 assert(await page.locator("#stage-aim").isVisible());
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/projectbestanden/);
 // Oude URL blijft werken, zonder de oude naam in de nieuwe UI.
 await page.goto(base+"/tools/projecthulp/");
 await page.waitForURL("**/tools/eaigit/");
 assert.deepEqual(errors,[]);
 console.log("EAIgit wizard geslaagd: intake, eigen ZIP, openbare GitHub, stap-voor-stap, mobiel, foutpad en oude URL.");
}finally{await browser?.close();server.kill();}
