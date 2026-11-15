import test from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import {readFileSync} from "node:fs";
import {inspectZip,readZipText} from "../assets/projecthulp/zip.mjs";
import {parseRepoUrl,fetchPublicRepo,stripArchiveRoot,describeProject,analyzeArchive,compareProjects,makeAdvice,reportText,readmeTemplate,ignoreTemplate} from "../assets/projecthulp/analyse.mjs";
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function makeZip(files,{compress=false}={}){
 const items=files.map(([name,content])=>{
  const path=Buffer.from(name);const raw=Buffer.from(content);const packed=compress?deflateRawSync(raw):raw;
  return {path,raw,packed,crc:crc32(raw),method:compress?8:0};
 });
 const local=[],central=[];let offset=0;
 for(const x of items){
  const a=Buffer.alloc(30);a.writeUInt32LE(0x04034b50,0);a.writeUInt16LE(20,4);a.writeUInt16LE(x.method,8);a.writeUInt32LE(x.crc,14);a.writeUInt32LE(x.packed.length,18);a.writeUInt32LE(x.raw.length,22);a.writeUInt16LE(x.path.length,26);
  local.push(a,x.path,x.packed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(x.method,10);c.writeUInt32LE(x.crc,16);c.writeUInt32LE(x.packed.length,20);c.writeUInt32LE(x.raw.length,24);c.writeUInt16LE(x.path.length,28);c.writeUInt32LE(offset,42);
  central.push(c,x.path);offset+=a.length+x.path.length+x.packed.length;
 }
 const cd=Buffer.concat(central);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(items.length,8);end.writeUInt16LE(items.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cd,end]);
}
const fake=(bytes)=>({name:"mijn-project.zip",size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
test("ZIP: bestanden worden lokaal gelezen en controlesom klopt",async()=>{
 const zip=inspectZip(makeZip([["mijn-project/index.html","<h1>Hallo</h1>"],["mijn-project/package.json",'{"dependencies":{"react":"18"}}']]));
 assert.equal(zip.entries.length,2);
 assert.equal(await readZipText(zip,zip.entries[1]),'{"dependencies":{"react":"18"}}');
});
test("ZIP: deflate en projectmanifest",async()=>{
 const bytes=makeZip([["site/index.html","Test"],["site/package.json",'{"dependencies":{"react":"18"}}']],{compress:true});
 const archive=await analyzeArchive(fake(bytes));
 assert.equal(archive.project.framework,"react");assert.equal(archive.prefix,"site/");
 assert.deepEqual(archive.files,["index.html","package.json"]);
});
test("ZIP: pad buiten projectmap wordt geweigerd",()=>assert.throws(()=>inspectZip(makeZip([["../secret.txt","x"]])),/onveilig|niet-ondersteund/));
test("ZIP: dubbele namen worden geweigerd",()=>assert.throws(()=>inspectZip(makeZip([["A.txt","a"],["a.txt","b"]])),/onveilig|dubbel/));
test("ZIP: controlegetal mismatch wordt geweigerd",async()=>{
 const zip=inspectZip(makeZip([["index.html","abc"]]));zip.bytes[zip.entries[0].start]^=1;
 await assert.rejects(()=>readZipText(zip,zip.entries[0]),/beschadigd/);
});
test("ZIP: geen onbeperkt geheugen bij onzinbytes",()=>assert.throws(()=>inspectZip(Buffer.from("niet een zip")),/ZIP-bestand/));
test("GitHub: URL moet uitsluitend naar een repository wijzen",()=>{
 assert.equal(parseRepoUrl("https://github.com/voorbeeld/site").name,"voorbeeld/site");
 assert.equal(parseRepoUrl("https://github.com/voorbeeld/site.git").name,"voorbeeld/site");
 for(const url of ["https://evil.example/u/r","https://github.com/u/r/tree/main","https://github.com/u/r?token=x","https://github.com/u/r#fragment"])assert.throws(()=>parseRepoUrl(url));
});
test("GitHub: openbare repository en bestandslijst via API",async()=>{
 const called=[];const fetcher=async(url)=>{called.push(url);return new Response(JSON.stringify(called.length===1?{private:false,full_name:"u/r",default_branch:"main",html_url:"https://github.com/u/r"}:{sha:"abc",truncated:false,tree:[{type:"blob",path:"README.md"},{type:"tree",path:"docs"},{type:"blob",path:"index.html"}]}),{status:200});};
 const result=await fetchPublicRepo("https://github.com/u/r",fetcher);
 assert.deepEqual(result.paths,["README.md","index.html"]);assert.equal(result.sha,"abc");assert.equal(called.length,2);
});
test("GitHub: geen privégegevens, en geen schijnvergelijking bij API-fout",async()=>{
 await assert.rejects(()=>fetchPublicRepo("https://github.com/u/r",async()=>new Response("{}",{status:404})),/niet openbaar/);
 const fetcher=async(url)=>url.includes("/git/trees/")?new Response("",{status:500}):new Response(JSON.stringify({private:false,full_name:"u/r",default_branch:"main"}),{status:200});
 const repo=await fetchPublicRepo("https://github.com/u/r",fetcher);assert.equal(repo.readable,false);
});
test("Projectadvies: vergelijk bestandsnamen, claim geen inhoudelijke gelijkheid",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["mijn-site/index.html","hoi"],["mijn-site/.env","SECRET=example"],["mijn-site/node_modules/lib/a.js","a"]])));
 const repo={name:"u/r",url:"https://github.com/u/r",paths:["index.html"],readable:true,truncated:false,empty:false};
 assert.deepEqual(archive.eligible,["index.html"]);
 assert.equal(archive.secret.length,1);assert.equal(archive.ignored.length,1);
 const advice=makeAdvice({archive,repo});
 assert.equal(advice.ready,false);
 assert.ok(advice.warnings.some(w=>w.includes("gevoelige")));
 assert.ok(advice.warnings.some(w=>w.includes("Gelijke namen")));
 assert.ok(reportText({archive,repo,advice}).includes("niet uitgevoerd"));
});
test("Bronversie en ontbrekende data blijven zichtbaar",()=>{
 const desc=describeProject(["index.html","styles.css"]);assert.equal(desc.type,"HTML-website");
 assert.equal(stripArchiveRoot(["app/index.html","app/css/style.css"]).prefix,"app/");
 const advice=makeAdvice({goal:"publish",experience:"beginner",archive:null,repo:null});
 assert.ok(advice.warnings.some(s=>s.includes("ZIP")));
 assert.ok(advice.steps.some(s=>s.includes("GitHub Pages")));
});
test("Downloads zijn voorstellen, geen valse documentatie",()=>{
 const readme=readmeTemplate({project:{type:"HTML-website"}},"u/mijn-site");
 assert.ok(readme.includes("Beschrijf hier"));assert.ok(ignoreTemplate({project:{runtime:"Python"}}).includes("__pycache__"));
});
test("Websitepagina bevat toegankelijke route, geen serverupload of AI",()=>{
 const html=readFileSync(new URL("../tools/projecthulp/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../assets/projecthulp/app.mjs",import.meta.url),"utf8");
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/class="eai-refresh/);
 assert.match(html,/type="file"/);
 assert.match(html,/assets\/projecthulp\/app\.mjs/);
 assert.doesNotMatch(app,/\.post\(|method:\s*["']POST|openai\.com|localStorage/);
});
