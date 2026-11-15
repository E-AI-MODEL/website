import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {mkdirSync,readFileSync} from "node:fs";
import fs from "node:fs/promises";
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
let browser;const errors=[],sent=[];
try{
 let online=false;for(let i=0;i<65;i++){try{online=(await fetch(base)).ok;}catch{}if(online)break;await new Promise(r=>setTimeout(r,110));}assert(online);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith(base))sent.push({method:r.method(),url:r.url()});});
 await page.route("https://api.github.com/**",route=>{
  const url=route.request().url();
  const data=url.includes("/git/trees/")?{sha:"fixture-sha",tree:[{type:"blob",path:"index.html"}],truncated:false}:{full_name:"voorbeeld/project",html_url:"https://github.com/voorbeeld/project",private:false,default_branch:"main"};
  return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(data)});
 });
 await page.goto(base+"/tools/projecthulp/");
 await page.screenshot({path:join(out,"projecthulp-start.png"),fullPage:true});
 await page.locator("#toFiles").click();
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#zipFile").setInputFiles({name:"website.zip",mimeType:"application/zip",buffer:archive});
 await page.screenshot({path:join(out,"projecthulp-bestanden.png"),fullPage:true});
 await page.locator("#analyze").click();
 await page.locator("#screen3:not(.ph-hidden)").waitFor({timeout:10000});
 const warnings=await page.locator("#warnings").innerText();
 assert.match(warnings,/vertrouwelijke naam/i);
 assert.match(warnings,/Gelijke namen/);
 assert.match(await page.locator("#observations").innerText(),/GitHub-repository/);
 assert.match(await page.locator("#firstTitle").innerText(),/privébestanden/);
 assert.equal(await page.locator("#openRepo").getAttribute("href"),"https://github.com/voorbeeld/project");
 assert.ok((await page.locator("#missingFiles").innerText()).includes("css/site.css"));
 assert(await page.locator("#moreStepsGroup").count());
 assert.equal(await page.locator(".skip-link").evaluate(el=>el.getBoundingClientRect().x < 0),true);
 assert.equal(await page.locator("#summary span").count(),2);
 await page.screenshot({path:join(out,"projecthulp-desktop.png"),fullPage:true});
 const [report]=await Promise.all([page.waitForEvent("download"),page.locator("#downloadReport").click()]);
 await report.saveAs(join(out,"projecthulp-advies.md"));
 const text=await fs.readFile(join(out,"projecthulp-advies.md"),"utf8");
 assert.match(text,/GitHub-bronversie: fixture-sha/);
 assert.match(text,/niet uitgevoerd/);
 assert.equal(sent.filter(x=>x.method!=="GET").length,0,"Er mag niets naar GitHub of EAI worden geüpload");
 assert.equal(sent.filter(x=>x.url.startsWith("https://api.github.com/")).length,2);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(out,"projecthulp-mobiel.png"),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Mobiele pagina heeft horizontale overflow");
 await page.locator("#back2").click();assert(await page.locator("#screen2").isVisible());
 await page.locator("#back1").click();assert(await page.locator("#screen1").isVisible());
 await page.locator("#toFiles").click();await page.locator("#repoUrl").fill("javascript:alert(1)");
 await page.locator("#analyze").click();assert.match(await page.locator("#inputError").innerText(),/repositorylink/);
 assert.deepEqual(errors,[]);
 console.log("Projecthulp browserproef geslaagd: ZIP lokaal, GitHub API gemockt, advies, download, foutpad en mobiel.");
}finally{await browser?.close();server.kill();}
