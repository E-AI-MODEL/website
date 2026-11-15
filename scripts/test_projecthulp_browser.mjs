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
 assert.equal(await page.title(),"EAIgit · Hulp bij je GitHub-project | EAI");
 assert.equal(await page.locator(".ph-logo img").getAttribute("src"),"/assets/eaigit/logo.svg");
 assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"),"/assets/eaigit/icon.svg");
 await page.screenshot({path:join(out,"eaigit-start.png"),fullPage:true});
 await page.locator('input[name="goal"][value="site"]').check();
 await page.locator("#projectAim").fill("Bezoekers moeten een pagina kunnen openen");
 await page.locator("#toFiles").click();
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#zipFile").setInputFiles({name:"site.zip",mimeType:"application/zip",buffer:archive});
 await page.screenshot({path:join(out,"eaigit-bestanden.png"),fullPage:true});
 await page.locator("#analyze").click();
 await page.locator("#screen3:not(.ph-hidden)").waitFor({timeout:12000});
 assert.match(await page.locator("#goodPoints").innerText(),/HTML-bestanden/);
 assert.match(await page.locator("#problemPoints").innerText(),/privébestanden/);
 assert.match(await page.locator("#unknownPoints").textContent(),/Logische fouten/);
 assert.equal(await page.locator("#openRepo").getAttribute("href"),"https://github.com/voorbeeld/project");
 assert.equal(await page.locator("#openActions").getAttribute("href"),"https://github.com/voorbeeld/project/actions");
 assert.ok(spawned.filter(url=>url.includes("onderzoek-worker.mjs")).length>=2);
 assert.equal(await page.locator("#summary span").count(),2);
 assert.equal(await page.locator("#guidePromptBox").isVisible(),false);
 await page.locator("#revealGuidePrompt").click();
 const prompt1=await page.locator("#guidePrompt").inputValue();
 assert.match(prompt1,/Onderzoek mijn project/);
 assert.match(prompt1,/voorbeeld\/project/);
 await page.locator("#copyGuidePrompt").click();
 assert.match(await page.locator("#guideStatus").innerText(),/gekopieerd/);
 assert.equal(await page.evaluate(()=>window.__copiedProjectAdvice),prompt1);
 await page.locator('[data-guide="verbeter"]').click();
 assert.match(await page.locator("#guideStepTitle").innerText(),/probleem/);
 assert.equal(await page.locator("#guidePromptBox").isVisible(),false);
 await page.locator("#revealGuidePrompt").click();
 const prompt2=await page.locator("#guidePrompt").inputValue();
 assert.notEqual(prompt1,prompt2);
 assert.match(prompt2,/pull request/);
 await page.locator('[data-guide="test"]').click();
 assert.match(await page.locator("#guideStepTitle").innerText(),/Controleer/);
 await page.locator('[data-guide="publiceer"]').click();
 assert.match(await page.locator("#guideStepTitle").innerText(),/publicatie/i);
 const visible=await page.locator("body").innerText();
 assert.doesNotMatch(visible,/Projecthulp|EAI Work|Pieter|workerRuns|zip-inspect: completed|redeneringstekst/i);
 assert.equal(await page.locator(".skip-link").evaluate(el=>el.getBoundingClientRect().x<0),true);
 await page.screenshot({path:join(out,"eaigit-desktop.png"),fullPage:true});
 assert.equal(sent.filter(x=>x.method!=="GET").length,0);
 assert.equal(sent.filter(x=>x.url.startsWith("https://api.github.com/")).length,2);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:join(out,"eaigit-mobiel.png"),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Geen horizontale mobiele overflow");
 await page.locator("#back2").click();assert(await page.locator("#screen2").isVisible());
 await page.locator("#back1").click();assert(await page.locator("#screen1").isVisible());
 await page.locator("#toFiles").click();
 await page.locator("#repoUrl").fill("javascript:alert(1)");
 await page.locator("#analyze").click();
 assert.match(await page.locator("#inputError").innerText(),/repositorylink/);
 zipOnly=true;
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#zipFile").setInputFiles({name:"site.zip",mimeType:"application/zip",buffer:safeArchive});
 await page.locator("#analyze").click();
 await page.locator("#screen3:not(.ph-hidden)").waitFor({timeout:12000});
 assert.match(await page.locator("#firstTitle").innerText(),/Pak eerst je ZIP uit/);
 assert.match(await page.locator("#problemPoints").innerText(),/ZIP in GitHub/);
 assert.match(await page.locator("#firstText").innerText(),/losse projectbestanden/);
 await page.goto(base+"/tools/projecthulp/");
 await page.waitForURL("**/tools/eaigit/");
 assert.deepEqual(errors,[]);
 console.log("EAIgit browserproef geslaagd: logo, nieuwe URL, ZIP/GitHub, vier stappen, mobiel en doorverwijzing.");
}finally{await browser?.close();server.kill();}
