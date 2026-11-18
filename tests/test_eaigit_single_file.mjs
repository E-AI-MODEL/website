import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {analyzeSingleFile,inspectOfflineDependencies,SINGLE_FILE_LIMIT} from "../assets/projecthulp/los-bestand.mjs";
import {buildJourney,helpPrompt} from "../assets/eaigit/journey.mjs";
import {buildLocalWorkPlan,validateLocalWorkPlan} from "../assets/eaigit/work-plan.mjs";
import {makeGuidance} from "../assets/projecthulp/begeleiding.mjs";
import {selectAuditAction} from "../assets/eaigit/audit-advice.mjs";

const file=(name,content)=>{const bytes=typeof content==="string"?new TextEncoder().encode(content):content;return {name,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};

test("Eén HTML-bestand wordt gelezen zonder netwerk, uitvoering of upload",async()=>{
 const previous=globalThis.fetch;let requests=0;
 globalThis.fetch=()=>{requests++;throw Error("Projectcode mag geen verzoek sturen");};
 try{
  const html='<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"><script type="module" src="https://cdn.example/test.js"></script></head><body><h1>Werken</h1><script>localStorage.setItem("x","1")</script></body></html>';
  const result=await analyzeSingleFile(file("oefening.html",html));
  assert.equal(requests,0);
  assert.equal(result.sourceKind,"file");
  assert.equal(result.project.hasHtml,true);
  assert.equal(result.contentCheck.checkedFiles,1);
  assert.equal(result.contentCheck.audit.checked.html,1,"Een benoemd HTML-bestand is ook een startbron");
  assert.equal(result.contentCheck.audit.findings.some(f=>f.type==="entry-unconfirmed"),false);
  assert.equal(result.readiness.executed,false);
  assert.equal(result.executesProjectCode,false);
  assert.deepEqual(result.readiness.external,["https://cdn.example/test.js"]);
  assert.ok(result.readiness.server.length>0);
  assert.ok(result.readiness.storage.length>0);
  assert.ok(result.contentCheck.findings.some(f=>f.type==="missing-reference"&&f.certainty==="review"));
  const advice=makeGuidance({archive:result,source:"file",intent:"local",delivery:"local"});
  assert.ok(advice.problems.some(p=>/Externe onderdelen/.test(p.title)));
  assert.ok(advice.uncertain.some(x=>/Bijbehorend bestand/.test(x)));
  assert.doesNotMatch(advice.good.join(" "),/ZIP-bestand/);
 }finally{globalThis.fetch=previous;}
});
test("Ongeldige JavaScript-syntaxis wordt geconstateerd met bestand en regel",async()=>{
 const result=await analyzeSingleFile(file("mijn-tool.js","const kapot = ;"));
 const issue=result.contentCheck.findings.find(x=>x.type==="javascript-syntax");
 assert.ok(issue);
 assert.equal(issue.path,"mijn-tool.js");
 assert.equal(issue.line,1);
 const action=selectAuditAction({archive:result});
 assert.equal(action.type,"javascript-syntax");
 const route=buildJourney({intent:"local",source:"file",archive:result,auditAction:action});
 assert.equal(route[0].id,"audit");
 assert.ok(route.some(s=>s.id==="offline"));
 assert.ok(route.some(s=>s.id==="try-local"));
 assert.ok(!route.some(s=>s.id==="create"||s.id==="upload"));
});
test("Onbekend of binair bestand wordt niet uitgevoerd en niet als veilig verklaard",async()=>{
 const result=await analyzeSingleFile(file("programma.exe",new Uint8Array([77,90,0,1,2,3])));
 assert.equal(result.kind,"binary");
 assert.equal(result.contentCheck.checkedFiles,0);
 assert.equal(result.readiness.executed,false);
 const g=makeGuidance({archive:result,source:"file",intent:"local"});
 assert.match(g.uncertain.join(" "),/niet uitgevoerd/);
 const steps=buildJourney({intent:"local",source:"file",archive:result});
 assert.match(steps.find(x=>x.id==="offline").description,/besturingssysteem/);
});
test("Gevoelige bestandsnaam wordt niet als leesbare bron onderzocht",async()=>{
 const result=await analyzeSingleFile(file(".env","SECRET_KEY=sample"));
 assert.deepEqual(result.secret,[".env"]);
 assert.equal(result.contentCheck.checkedFiles,0);
 const route=buildJourney({intent:"local",source:"file",archive:result});
 assert.equal(route[0].id,"private");
 assert.ok(!route.some(x=>x.id==="create"||x.id==="upload"));
});
test("Los bestand heeft begrensd formaat en veilige bestandsnaam",async()=>{
 await assert.rejects(()=>analyzeSingleFile({name:"te-groot.html",size:SINGLE_FILE_LIMIT+1,arrayBuffer:async()=>new ArrayBuffer(0)}),/maximaal 8 MB/);
 await assert.rejects(()=>analyzeSingleFile(file("../fout.js","const a=1")),/bestandsnaam/);
 await assert.rejects(()=>analyzeSingleFile(file("niet\0veilig.js","const a=1")),/bestandsnaam/);
 await assert.rejects(()=>analyzeSingleFile({...file("ok.html","abc"),size:7}),/volledig/);
});
test("EAIgit stelt zonder bestandsbron een lokale maakroute voor en claimt geen controle",()=>{
 const route=buildJourney({intent:"local",source:"unknown",aim:"Een oefening zonder internet"});
 assert.deepEqual(route.map(x=>x.id),["create-local","offline","try-local"]);
 assert.ok(route.every(x=>!x.href));
 assert.doesNotMatch(route.map(x=>x.title).join(" "),/GitHub|repository/);
 const prompt=helpPrompt(route[0],"","local","Een oefening zonder internet","local");
 assert.match(prompt,/volledige bestand/);
 assert.doesNotMatch(prompt,/VUL HIER JE GITHUB-REPOSITORY IN/);
 const unzip=buildJourney({intent:"local",source:"zip",archive:{eligible:["index.html"],project:{hasHtml:true}}})[0];
 assert.equal(unzip.id,"unzip");
 assert.doesNotMatch(helpPrompt(unzip,"","local","Mijn oefening","local"),/GitHub|repository/);
 const plan=buildLocalWorkPlan({intent:"local",source:"unknown",steps:route,aim:"Een oefening zonder internet"});
 assert.equal(validateLocalWorkPlan(plan.plan),true);
 assert.equal(plan.observations.find(x=>x.id==="find-source").state,"niet-onderzocht");
 assert.equal(plan.observations.find(x=>x.id==="user-test").state,"niet-getest");
 assert.equal(plan.pendingDecisions.length,0);
});
test("Lokaal delen en online publiceren zijn andere keuzes, nooit vanzelf uitgevoerd",async()=>{
 const result=await analyzeSingleFile(file("site.html","<!doctype html><html><body>Test</body></html>"));
 const share=buildJourney({intent:"local",source:"file",archive:result,delivery:"share"});
 const online=buildJourney({intent:"local",source:"file",archive:result,delivery:"online"});
 assert.ok(share.some(x=>x.id==="file-sharing"));
 assert.ok(!share.some(x=>x.id==="create"||x.id==="upload"||x.id==="publishing"));
 assert.ok(online.some(x=>x.id==="local-hosting"));
 assert.ok(!online.some(x=>x.id==="create"||x.id==="upload"));
 const plan=buildLocalWorkPlan({intent:"local",source:"file",archive:result,steps:online,delivery:"online"});
 assert.deepEqual(plan.pendingDecisions.map(x=>x.effect),["publish"]);
 assert.equal(plan.pendingDecisions[0].approved,false);
 assert.ok(plan.plan.tasks.every(x=>x.effect==="local"));
 assert.equal(plan.observations.find(x=>x.id==="offline-review").state,"beperkt");
 assert.equal(validateLocalWorkPlan(plan.plan),true);
});
test("Een los bestand op GitHub zetten blijft de bestaande GitHub-route",async()=>{
 const result=await analyzeSingleFile(file("hallo.html","<!doctype html><html><body>Hoi</body></html>"));
 const route=buildJourney({intent:"start",source:"file",archive:result});
 assert.ok(route.some(x=>x.id==="create"||x.id==="upload"));
 assert.ok(!route.some(x=>x.id==="unzip"));
 const publish=buildJourney({intent:"publish",source:"file",archive:result});
 assert.ok(publish.some(x=>x.id==="publishing"));
});
test("De gebruikerskeuzes en lokale bestandsroute zijn op één wizardpagina aanwezig",()=>{
 const page=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../assets/projecthulp/onderzoek-worker.mjs",import.meta.url),"utf8");
 const wizard=readFileSync(new URL("../assets/eaigit/wizard.mjs",import.meta.url),"utf8");
 for(const fragment of ['data-intent="local"','data-source="file"','id="stage-file"','id="singleFile"','data-delivery="local"','data-delivery="share"','data-delivery="online"'])
  assert.ok(page.includes(fragment),fragment);
 assert.match(worker,/data\.kind==="file"/);
 assert.match(wizard,/runWorker\(kind,/);
 assert.doesNotMatch(page,/\/assets\/site-analytics\.js|cloudflareinsights\.com/);
});
