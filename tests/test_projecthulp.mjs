import test from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import {readFileSync} from "node:fs";
import {inspectZip,readZipText} from "../assets/projecthulp/zip.mjs";
import {parseRepoUrl,fetchPublicRepo,stripArchiveRoot,describeProject,analyzeArchive,compareProjects,makeAdvice,reportText,readmeTemplate,ignoreTemplate} from "../assets/projecthulp/analyse.mjs";
import {checkProjectPurpose,findBrokenLocalLinks,PURPOSES} from "../assets/projecthulp/doelcontrole.mjs";
import {gitBlobId,goalTestFromAim,inspectFileSignature,fetchPublicChecks} from "../assets/projecthulp/inhoudscontrole.mjs";
import {availableProjectChecks,generateProjectCheckWorkflow} from "../assets/projecthulp/projectcheck.mjs";
import {makeGuidance,continuationPrompt} from "../assets/projecthulp/begeleiding.mjs";
import {buildJourney,primaryFinding,helpPrompt} from "../assets/eaigit/journey.mjs";
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
test("ZIP: controltekens in paden worden geweigerd",()=>assert.throws(()=>inspectZip(makeZip([["bad\\nname.js","x"]])),/onveilig|niet-ondersteund/));
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
test("ZIP: ongeldige package.json blokkeert geen overige analyse",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["site/package.json","null"],["site/index.html","ok"]])));
 assert.ok(archive.manifestError);assert.equal(archive.project.type,"JavaScript-project");
});
test("GitHub: een lege repository zonder commits",async()=>{
 const fetcher=async()=>new Response(JSON.stringify({full_name:"u/empty",private:false,default_branch:"main",size:0,pushed_at:null}),{status:200});
 const repo=await fetchPublicRepo("https://github.com/u/empty",fetcher);
 assert.equal(repo.empty,true);assert.deepEqual(repo.paths,[]);
});
test("Projectadvies: vergelijk bestandsnamen, claim geen inhoudelijke gelijkheid",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["mijn-site/index.html","hoi"],["mijn-site/.env","SECRET=example"],["mijn-site/node_modules/lib/a.js","a"]])));
 const repo={name:"u/r",url:"https://github.com/u/r",paths:["index.html"],readable:true,truncated:false,empty:false};
 assert.deepEqual(archive.eligible,["index.html"]);
 assert.equal(archive.secret.length,1);assert.equal(archive.ignored.length,1);
 const advice=makeAdvice({archive,repo});
 assert.equal(advice.ready,false);
 assert.ok(advice.warnings.some(w=>w.includes("vertrouwelijke")));
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
 assert.ok(!ignoreTemplate({project:{hasPackage:true}}).split(String.fromCharCode(10)).includes("dist/"));
 assert.ok(!ignoreTemplate({project:{hasPackage:true}}).split(String.fromCharCode(10)).includes("build/"));
});
test("Websitepagina bevat toegankelijke route, geen serverupload of AI",()=>{
 const html=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../assets/eaigit/wizard.mjs",import.meta.url),"utf8");
 assert.match(html,/name="robots" content="index,follow"/);
 assert.match(html,/<link rel="canonical" href="https:\/\/eaimodel\.nl\/tools\/eaigit\/">/);
 assert.match(html,/class="eaigit-wizard/);
 assert.match(html,/type="file"/);
 assert.match(html,/assets\/eaigit\/wizard\.mjs/);
 assert.doesNotMatch(app,/\.post\(|method:\s*["']POST|openai\.com|localStorage/);
});

test("Doeltoets: een ZIP uploaden is geen projectoverdracht",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["site/index.html","<html><link href='site.css'></html>"],["site/site.css","body{}"]])));
 const repo={name:"u/r",url:"https://github.com/u/r",paths:["project.zip"],readable:true,truncated:false,empty:false};
 const advice=makeAdvice({goal:"site",aim:"bezoekers zien de startpagina",archive,repo});
 assert.equal(advice.purpose.repoOnlyZips,true);
 assert.ok(advice.warnings.some(w=>/ZIP/.test(w)));
 assert.ok(advice.steps.some(w=>/ZIP-bestand niet automatisch uit/.test(w)));
 assert.ok(advice.steps.some(w=>/niet het \.zip-bestand/.test(w)));
 assert.equal(advice.purpose.label,PURPOSES.site);
 assert.ok(reportText({archive,repo,advice}).includes("niet inhoudelijk beoordeeld"));
});
test("Doeltoets: website met ontbrekende verwijzing krijgt geen werkend-label",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["web/index.html",'<link href="css/site.css"><script src="app.js"></script>'],["web/app.js","console.log('x')"]])));
 assert.deepEqual(archive.missingReferences,["css/site.css"]);
 const result=checkProjectPurpose({goal:"site",archive});
 assert.ok(result.found.some(t=>t.includes("index.html")));
 assert.ok(result.remaining.some(t=>t.includes("niet op de verwachte plek")));
 assert.ok(result.remaining.some(t=>t.includes("browserproef")));
 assert.ok(!result.found.some(t=>t.includes("werkend")));
});
test("Doeltoets: geen doel of geen startbestand wordt niet als succes gepresenteerd",()=>{
 const archive={eligible:["README.md","handleiding.pdf"],project:{hasReadme:true,hasPackage:false,hasHtml:false},secret:[]};
 const result=checkProjectPurpose({goal:"site",archive});
 assert.ok(result.remaining.some(t=>t.includes("Geen index.html")));
 assert.ok(checkProjectPurpose({goal:"unsure",archive}).remaining.some(t=>t.includes("niet gekozen")));
 assert.equal(checkProjectPurpose({goal:"app",archive}).found.length,0);
});
test("Doeltoets: applicatie met scripts is nog niet functioneel getest",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["project/package.json",JSON.stringify({scripts:{start:"node server.js",test:"node --test"},dependencies:{express:"4"}})],["project/server.js","console.log('hello')"]])));
 const result=checkProjectPurpose({goal:"app",archive});
 assert.ok(result.found.some(t=>t.includes("start, test")));
 assert.ok(result.remaining.some(t=>t.includes("Niet gecontroleerd")));
});
test("Doeltoets: externe links zijn niet automatisch ontbrekende projectbestanden",()=>{
 const html='<link href="https://cdn.example.com/style.css"><script src="/js/app.js"></script><img src="data:image/png;base64,abc"><a href="#start"></a>';
 assert.deepEqual(findBrokenLocalLinks("index.html",html,["index.html"]),["js/app.js"]);
});
test("Woordkeuze: begin bij het resultaat, geen belofte ZIP-upload",()=>{
 const html=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 assert.match(html,/Waar wil je hulp bij/);
 assert.match(html,/Waar staan je bestanden nu/);
 assert.match(html,/data-intent="start"/);
 assert.match(html,/data-source="both"/);
 assert.match(html,/stage-zip/);
 assert.match(html,/stage-aim/);
 assert.match(html,/stage-guide/);
 assert.match(html,/stage-finished/);
 assert.doesNotMatch(html,/één grote opdracht|redeneringssporen/i);
});


test("ZIP: macOS-bijlage verhindert herkenning van projectmap niet",async()=>{
 const archive=await analyzeArchive(fake(makeZip([[".DS_Store","rommel"],["website/index.html","<h1>Start</h1>"],["website/css/style.css","body{}"]])));
 assert.equal(archive.prefix,"website/");
 assert.ok(archive.eligible.includes("index.html"));
 assert.ok(archive.ignored.includes(".DS_Store"));
 assert.ok(checkProjectPurpose({goal:"site",archive}).found.some(x=>x.includes("index.html")));
});
test("Doeltoets: interactieve HTML hoeft geen package.json te hebben",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["index.html","<button>Start</button>"],["app.js","console.log(1)"]])));
 const result=checkProjectPurpose({goal:"app",archive});
 assert.ok(result.found.some(x=>x.includes("browser")));
 assert.ok(result.remaining.some(x=>x.includes("Niet gecontroleerd")));
});


test("Doeltoets: dist-map niet blind weggooien als dit de site bevat",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["dist/index.html",'<link href="site.css">'],["dist/site.css","body{}"]])));
 assert.ok(archive.eligible.includes("dist/index.html"));
 assert.equal(archive.indexChecked,true);
 const purpose=checkProjectPurpose({goal:"site",archive});
 assert.ok(purpose.found.some(x=>x.includes("dist/index.html")));
 assert.ok(purpose.remaining.some(x=>x.includes("bouwmap")));
 assert.equal(archive.missingReferences.length,0);
});

test("GitHub Actions workflow voor project: syntaxcontroles zonder schrijfbevoegdheid",()=>{
 const archive={eligible:["index.html","assets/app.mjs","scripts/controle.py"],manifest:{scripts:{test:"rm -rf /"}}};
 const supported=availableProjectChecks(archive);
 assert.equal(supported.javascript,true);assert.equal(supported.python,true);
 const yaml=generateProjectCheckWorkflow(archive);
 assert.ok(yaml.includes("node --check"));
 assert.ok(yaml.includes("ast.parse"));
 assert.ok(!yaml.includes("compileall"));
 assert.ok(!yaml.includes("pip install"));
 assert.ok(yaml.includes("permissions:"+String.fromCharCode(10)+"  contents: read"));
 assert.ok(!yaml.includes("npm run test"));
 assert.ok(!yaml.includes("npm install"));
 assert.ok(!yaml.includes("pull_request_target:"));
 assert.equal(generateProjectCheckWorkflow({eligible:["index.html","style.css"]}),null);
});
test("De browserworker heeft een beperkt contract: leesacties, geen schrijfverzoeken",()=>{
 const worker=readFileSync(new URL("../assets/projecthulp/onderzoek-worker.mjs",import.meta.url),"utf8");
 assert.match(worker,/analyzeArchive/);
 assert.match(worker,/fetchPublicRepo/);
 assert.ok(!worker.includes("child_process"));
 assert.ok(!worker.includes("method: \"POST\""));
});

test("Gebruikersantwoord: feitelijk goede onderdelen, bevestigde fouten en niet-geteste werking",()=>{
 const archive={eligible:["index.html","app.js"],project:{hasHtml:true,hasReadme:true,hasTests:false},secret:[],missingReferences:["css/ontbreekt.css"],ignored:[]};
 const repo={name:"voorbeeld/site",url:"https://github.com/voorbeeld/site",readable:true,paths:["index.html"],truncated:false};
 const advice={comparison:{missingCount:1}};
 const result=makeGuidance({archive,repo,advice,goal:"site",aim:"Bezoeker opent de site"});
 assert.ok(result.good.some(x=>x.includes("README")));
 assert.ok(result.problems.some(x=>x.title.includes("Verwijzingen")));
 assert.ok(result.problems.some(x=>x.title.includes("bestand")));
 assert.ok(result.uncertain.some(x=>x.includes("Codefouten zijn nog niet getest")));
 assert.ok(result.uncertain.some(x=>x.includes("Logische fouten")));
 assert.equal(result.codeErrorsVerified,false);
 assert.equal(result.actionsUrl,"https://github.com/voorbeeld/site/actions");
 const prompt=continuationPrompt(result);
 assert.ok(prompt.includes("https://github.com/voorbeeld/site"));
 assert.ok(prompt.includes("pull request"));
 assert.ok(prompt.includes("bestandsnaam"));
});
test("Gebruikersantwoord: nooit vertrouwelijke inhoud, geen ongegronde foutenclaims",()=>{
 const result=makeGuidance({archive:{eligible:["main.py"],project:{},secret:[".env"],missingReferences:[],ignored:[]},repo:null,goal:"app"});
 assert.ok(result.problems.some(p=>p.severity==="stop"));
 assert.ok(!JSON.stringify(result).includes("SECRET=fixture"));
 assert.ok(result.next[0].includes("vertrouwelijke bestanden"));
 assert.equal(result.logicErrorsVerified,false);
});
test("EAIgit is een wizard met één handeling per scherm",()=>{
 const html=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../assets/eaigit/wizard.mjs",import.meta.url),"utf8");
 assert.match(html,/assets\/eaigit\/logo\.svg/);
 assert.match(html,/assets\/eaigit\/icon\.svg/);
 assert.match(html,/id="stage-intent"/);
 assert.match(html,/id="stage-source"/);
 assert.match(html,/id="stage-zip"/);
 assert.match(html,/id="stage-repo"/);
 assert.match(html,/id="stage-aim"/);
 assert.match(html,/id="stage-result"/);
 assert.match(html,/id="stage-guide"/);
 assert.match(html,/id="stage-finished"/);
 assert.match(html,/id="guideNext"/);
 assert.match(html,/id="guideBack"/);
 assert.match(html,/id="guideMore"/);
 assert.match(html,/id="helpContextTip"/);
 assert.doesNotMatch(html,/id="helpDetails"/);
 assert.doesNotMatch(html,/Projecthulp|Pieter|EAI Work|redenering|uitvoerspoor/);
 assert.ok(!app.includes('reportText('));
 const redirect=readFileSync(new URL("../tools/projecthulp/index.html",import.meta.url),"utf8");
 assert.match(redirect,/\/tools\/eaigit\//);
});
test("Wizard bepaalt een veilige volgorde op basis van bestanden en GitHub",()=>{
 const archive={secret:[".env"],project:{hasHtml:true,hasPackage:false},missingReferences:[]};
 const repo={readable:true,url:"https://github.com/voorbeeld/site"};
 const g={good:["HTML aanwezig"],problems:[{title:"Mogelijk privébestand",severity:"stop"}],uncertain:[]};
 const steps=buildJourney({intent:"start",source:"both",archive,repo,guidance:g});
 assert.equal(steps[0].id,"private");
 assert.equal(steps[1].id,"safe");
 assert.ok(steps.some(x=>x.id==="compare"));
 assert.ok(steps.some(x=>x.id==="try"));
 assert.ok(steps.every(x=>x.title&&x.description));
 assert.ok(!helpPrompt(steps[0],repo.url,"start"));
 assert.match(helpPrompt(steps.find(x=>x.id==="compare"),repo.url,"start"),/zonder mijn toestemming/);
 assert.equal(primaryFinding(g).kind,"warning");
});
test("Wizard past stappen aan bij ZIP-only, nog geen GitHub en publicatie",()=>{
 const archive={secret:[],project:{hasHtml:true,hasPackage:false},missingReferences:[]};
 const zipOnly=buildJourney({intent:"repair",source:"both",archive,repo:{readable:true,url:"https://github.com/a/b"},guidance:{problems:[{title:"Een ZIP in GitHub is nog geen uitgepakt project"}]}});
 assert.equal(zipOnly[0].id,"unzip");
 assert.equal(zipOnly[1].id,"files");
 const fresh=buildJourney({intent:"start",source:"zip",archive,repo:null,guidance:{problems:[]}});
 assert.ok(fresh.some(x=>x.id==="create"));
 assert.ok(fresh.some(x=>x.id==="upload"));
 const publish=buildJourney({intent:"publish",source:"github",repo:{readable:true,url:"https://github.com/a/b"},guidance:{problems:[]}});
 assert.equal(publish[publish.length-1].id,"publishing");
 assert.match(publish[publish.length-1].help,/niet voor iedere/);
 const unsure=buildJourney({intent:"explore",source:"unknown",guidance:{problems:[]}});
 assert.equal(unsure[0].id,"source");
});

test("Herstellen en verkennen verplichten geen GitHub-upload",()=>{
 const archive={eligible:["index.html"],secret:[],missingReferences:[],project:{hasHtml:true}};
 for(const intent of ["repair","explore"]){
  const steps=buildJourney({intent,source:"zip",archive,repo:null,guidance:{problems:[]}});
  assert.ok(steps.some(x=>x.id==="unzip"));
  assert.ok(steps.some(x=>x.id==="try"));
  assert.ok(!steps.some(x=>["create","upload","files"].includes(x.id)),
   "Bij "+intent+" is een GitHub-account niet nodig");
 }
 const both=buildJourney({intent:"repair",source:"both",archive,
  repo:{readable:true,url:"https://github.com/voorbeeld/site"},guidance:{problems:[]}});
 assert.ok(both.some(x=>x.id==="compare"));
 assert.ok(!both.some(x=>["create","upload"].includes(x.id)));
});
test("Regressie: bestaande index.html krijgt geen melding over ontbrekend startbestand",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["site/index.html","<h1>Site</h1>"]])));
 const purpose=checkProjectPurpose({goal:"site",archive});
 assert.ok(purpose.found.some(x=>x.includes("index.html")));
 assert.ok(!purpose.remaining.some(x=>x.includes("Geen index.html")));
});
test("ZIP: statische controle vindt echte lokale import-, CSS- en JSON-problemen",async()=>{
 const archive=await analyzeArchive(fake(makeZip([
  ["site/index.html",'<link rel="stylesheet" href="style.css"><script src="app.js"></script>'],
  ["site/style.css",'body{background:url("assets/ontbreekt.png")}'],
  ["site/app.js",'import "./scripts/ontbreekt.js";'],
  ["site/config.json",'{"fout": }'],
  ["site/.env","DIT_MAG_NOOIT_IN_HET_ADVIES"]
 ])));
 const result=archive.contentCheck;
 assert.ok(result.checkedFiles>=4);
 assert.ok(result.findings.some(x=>x.type==="missing-reference"&&x.path==="app.js"&&x.line===1));
 assert.ok(result.findings.some(x=>x.type==="missing-reference"&&x.path==="style.css"));
 assert.ok(result.findings.some(x=>x.type==="invalid-json"&&x.path==="config.json"));
 assert.ok(!JSON.stringify(result).includes("DIT_MAG_NOOIT_IN_HET_ADVIES"));
 assert.ok(!Object.hasOwn(archive.fingerprints,".env"));
 assert.equal(result.executesProjectCode,false);
});
test("GitHub: ZIP-vingerafdrukken onderscheiden bewezen identieke en gewijzigde bytes",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["index.html","origineel"],["main.js","code-versie-A"]])));
 const sha=archive.fingerprints["index.html"];
 assert.match(sha,/^[a-f0-9]{40}$/);
 const repo={readable:true,truncated:false,paths:["index.html","main.js"],blobs:{
  "index.html":sha,"main.js":await gitBlobId(new TextEncoder().encode("code-versie-B"))
 }};
 const comparison=compareProjects(archive,repo);
 assert.deepEqual(comparison.identical,["index.html"]);
 assert.deepEqual(comparison.changed,["main.js"]);
 assert.deepEqual(comparison.unknown,[]);
 const guidance=makeGuidance({archive,repo:{...repo,name:"test/repo",url:"https://github.com/test/repo"},advice:{comparison},goal:"site"});
 assert.ok(guidance.problems.some(x=>x.title.includes("verschillende versies")));
});
test("GitHub: openbare blobinhoud wordt pas beoordeeld na overeenkomende hash",async()=>{
 const text='<script src="ontbreekt.js"></script>';
 const bytes=new TextEncoder().encode(text);
 const sha=await gitBlobId(bytes);
 let blobCalls=0;
 const fetcher=async(url)=>{
  if(url.includes("/git/blobs/")){
   blobCalls++;
   return new Response(JSON.stringify({size:bytes.length,encoding:"base64",content:Buffer.from(bytes).toString("base64")}),{status:200});
  }
  if(url.includes("/git/trees/"))
   return new Response(JSON.stringify({sha:"tree",truncated:false,tree:[{type:"blob",path:"index.html",sha,size:bytes.length}]}),{status:200});
  return new Response(JSON.stringify({private:false,full_name:"sample/repo",default_branch:"main",html_url:"https://github.com/sample/repo"}),{status:200});
 };
 const repo=await fetchPublicRepo("https://github.com/sample/repo",fetcher);
 assert.equal(blobCalls,1);
 assert.equal(repo.contentCheck.checkedFiles,1);
 assert.ok(repo.contentCheck.findings.some(x=>x.path==="index.html"&&x.target==="ontbreekt.js"));
 assert.equal(repo.blobs["index.html"],sha);
});
test("Gebruikersdoel oefeningen leidt tot concrete functionele test, geen schijnbewijs",async()=>{
 const archive=await analyzeArchive(fake(makeZip([["index.html",'<button id="startQuiz">Oefen</button>']])));
 const guidance=makeGuidance({archive,goal:"app",aim:"Bezoekers moeten oefeningen kunnen maken en hun antwoorden en resultaten terugzien."});
 assert.equal(guidance.goalTest.id,"exercise");
 assert.match(guidance.goalTest.action,/goed en een fout antwoord/);
 assert.equal(guidance.goalTest.tested,false);
 assert.ok(guidance.uncertain.some(x=>x.includes("nog niet uitgevoerd")));
 const steps=buildJourney({intent:"publish",source:"zip",archive,guidance});
 assert.ok(steps.some(x=>x.id==="try"&&x.description.includes("feedback")));
 assert.equal(steps[steps.length-1].id,"publishing");
 assert.equal(goalTestFromAim("",{}),null);
});

test("Bestandstype: ongeldige afbeelding en PDF worden gemeld, geldige kop niet",async()=>{
 const archive=await analyzeArchive(fake(makeZip([
  ["site/foto.png","geen echte afbeelding"],
  ["site/rapport.pdf","dit is geen PDF"]
 ])));
 assert.ok(archive.contentCheck.findings.some(x=>x.type==="format-mismatch"&&x.path==="foto.png"));
 assert.ok(archive.contentCheck.findings.some(x=>x.type==="format-mismatch"&&x.path==="rapport.pdf"));
 assert.equal(inspectFileSignature("voorbeeld.png",Uint8Array.from([137,80,78,71,13,10,26,10])),null);
});
test("GitHub Checks: verifieer EAIgit-annotaties, filter ongeldige paden en leg echte codefout vast",async()=>{
 const sha="a".repeat(40);
 const fetcher=async(url)=>{
  if(url.includes("/check-runs?"))
   return new Response(JSON.stringify({total_count:1,check_runs:[{
    id:12345,name:"EAIgit · projectcontrole",head_sha:sha,status:"completed",conclusion:"failure",
    html_url:"https://github.com/u/r/actions/runs/12345"
   }]}),{status:200});
  if(url.includes("/annotations?"))
   return new Response(JSON.stringify([
    {title:"EAIgit syntaxis",path:"src/app.js",start_line:8},
    {title:"EAIgit syntaxis",path:".env",start_line:1},
    {title:"Ander type fout",path:"src/app.js",start_line:12}
   ]),{status:200});
  throw Error("Unexpected API URL "+url);
 };
 const checks=await fetchPublicChecks("https://api.github.com/repos/u/r","main",["src/app.js"],fetcher,{});
 assert.equal(checks.checked,true);
 assert.equal(checks.syntaxErrors.length,1);
 assert.equal(checks.syntaxErrors[0].line,8);
 const guidance=makeGuidance({repo:{name:"u/r",url:"https://github.com/u/r",readable:true,paths:["src/app.js"],
  actionChecks:checks},goal:"app"});
 assert.equal(guidance.codeErrorsVerified,true);
 assert.ok(guidance.problems.some(x=>x.path==="src/app.js"&&x.line===8));
 assert.match(guidance.next[0],/syntaxisfout/);
});

test("Doelcontrole kijkt afzonderlijk naar opgaven, antwoorden, feedback en score",async()=>{
 const archive=await analyzeArchive(fake(makeZip([
  ["oefeningen/index.html",'<button>Start quiz</button><input id="answer">'],
  ["oefeningen/app.js",'const questions = []; function checkAnswer(){}; function showFeedback(){};']
 ])));
 const hints=archive.contentCheck.features.exercise;
 assert.ok(hints.found.some(x=>x.label==="opgaven of vragen"));
 assert.ok(hints.found.some(x=>x.label==="antwoord invoeren"));
 assert.ok(hints.found.some(x=>x.label==="antwoord controleren"));
 assert.ok(hints.found.some(x=>x.label==="feedback tonen"));
 assert.ok(hints.notSeen.includes("score of resultaat"));
 assert.equal(hints.verifiedWorking,false);
 const guidance=makeGuidance({archive,goal:"app",aim:"Oefeningen maken en eigen antwoorden en resultaten terugzien."});
 assert.ok(guidance.good.some(x=>x.includes("antwoord controleren")));
 assert.ok(guidance.uncertain.some(x=>x.includes("score of resultaat")));
 assert.ok(guidance.uncertain.some(x=>x.includes("geen bewijs")));
});


test("EAIgit zegt zonder projectbron niet dat bestanden zijn bekeken",()=>{
 const guidance=makeGuidance({archive:null,repo:null,advice:{purpose:{}},goal:"code",aim:""});
 const first=primaryFinding(guidance,{archive:null,repo:null});
 assert.match(first.title,/nog geen bestanden onderzocht/i);
 assert.equal(first.kind,"info");
 assert.doesNotMatch(first.description,/zijn bekeken/i);
 const failed=primaryFinding({problems:[{title:"GitHub kon niet worden gecontroleerd",detail:"Repository niet gevonden",severity:"attention"}]},{repoError:"Repository niet gevonden"});
 assert.equal(failed.title,"GitHub kon niet worden gecontroleerd");
});

test("ZIP: statische lintachtige controles draaien lokaal en nemen concrete bronregels mee",async()=>{
 const zip=makeZip([
  ["mijnsite/index.html",'<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="bestaat"></div></body></html>'],
  ["mijnsite/app.js",'const ongelukkig = ;\ndocument.getElementById("onbekend");']
 ]);
 const a=await analyzeArchive(fake(zip));
 assert.equal(a.contentCheck.audit.checked.javascript,1);
 assert.ok(a.contentCheck.findings.some(x=>x.type==="javascript-syntax"&&x.path==="app.js"&&x.line===1));
 assert.ok(a.contentCheck.findings.some(x=>x.type==="dom-id-unseen"&&x.certainty==="review"));
 assert.equal(a.contentCheck.audit.passed.javascript,0);
});
test("GitHub: openbare en hash-gecontroleerde JS-bestanden worden statisch geparseerd",async()=>{
 const text="const x = ;",bytes=new TextEncoder().encode(text);
 const sha=await gitBlobId(bytes);
 assert.ok(sha);
 const blob={content:Buffer.from(bytes).toString("base64"),encoding:"base64",size:bytes.length};
 const fetcher=async url=>{
  const content=url.includes("/git/blobs/")?blob:
   url.includes("/git/trees/")?{sha:"tree",truncated:false,tree:[{type:"blob",path:"app.js",size:bytes.length,sha}]}:
   {private:false,full_name:"u/r",default_branch:"main",html_url:"https://github.com/u/r"};
  return new Response(JSON.stringify(content),{status:200});
 };
 const r=await fetchPublicRepo("https://github.com/u/r",fetcher);
 assert.equal(r.readable,true);
 assert.equal(r.contentCheck.audit.checked.javascript,1);
 assert.ok(r.contentCheck.findings.some(x=>x.type==="javascript-syntax"&&x.path==="app.js"));
 assert.equal(r.contentCheck.source,"github-public-blobs");
});
