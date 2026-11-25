import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {githubChecksView} from "../assets/eaigit/github-checks.mjs";
import {fetchPublicChecks} from "../assets/projecthulp/inhoudscontrole.mjs";
import {fetchPublicRepo} from "../assets/projecthulp/analyse.mjs";

const base={
 readable:true,url:"https://github.com/example/demo",name:"example/demo",
 actionChecks:{checked:true,headSha:"a".repeat(40),incomplete:false,runs:[{
   name:"EAIgit · projectcontrole",status:"completed",conclusion:"success",
   url:"https://github.com/example/demo/actions/runs/12345"
 }]}
};
test("GitHub mobile result is optional and never claims functional proof",()=>{
 assert.deepEqual(githubChecksView(null),{visible:false,runs:[]});
 const good=githubChecksView(base);
 assert.equal(good.visible,true);
 assert.equal(good.state,"checked");
 assert.equal(good.verifiedWorking,false);
 assert.equal(good.headSha,"a".repeat(40));
 assert.equal(good.runs[0].passed,true);
 assert.match(good.explanation,/werking.*niet getest/);
});
test("An absent, pending or unsuccessful check cannot be advertised as passed",()=>{
 assert.equal(githubChecksView({...base,actionChecks:null}).state,"unavailable");
 assert.equal(githubChecksView({...base,actionChecks:{checked:true,runs:[]}}).state,"none");
 assert.equal(githubChecksView({...base,actionChecks:{...base.actionChecks,headSha:null}}).state,"uncertain");
 assert.equal(githubChecksView({...base,actionChecks:{...base.actionChecks,incomplete:true}}).state,"partial");
 assert.equal(githubChecksView({...base,actionChecks:{...base.actionChecks,runs:[
  {...base.actionChecks.runs[0],status:"in_progress",conclusion:null}
 ]}}).state,"partial");
 const fail=githubChecksView({...base,actionChecks:{...base.actionChecks,runs:[
  {...base.actionChecks.runs[0],conclusion:"failure"}
 ]}});
 assert.equal(fail.state,"failed");
 assert.equal(fail.runs[0].passed,false);
});
test("A malicious control URL is dropped, and user strings are plain text",()=>{
 const changed=githubChecksView({...base,actionChecks:{...base.actionChecks,runs:[{
  name:"bad\nname",status:"completed",conclusion:"success",
  url:"https://attacker.example/actions/runs/12345"
 }]}});
 assert.equal(changed.runs[0].name,"bad name");
 assert.equal(changed.runs[0].url,null);
 assert.equal(githubChecksView({...base,url:"javascript:alert(1)"}).visible,false);
 const oversized=githubChecksView({...base,actionChecks:{...base.actionChecks,runs:[{...base.actionChecks.runs[0],name:"x".repeat(500)}]}});
 assert.equal(oversized.runs[0].name.length,120,"GitHub-checknamen moeten begrensd blijven");
});
test("Existing mobile page includes optional controls, not an upload requirement",()=>{
 const html=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../assets/eaigit/wizard.mjs",import.meta.url),"utf8");
 assert.match(html,/id="githubCheckPanel"/);
 assert.match(html,/id="githubCheckReload"/);
 assert.match(app,/renderGithubChecks\(\)/);
 assert.match(app,/runWorker\("github"/);
 assert.doesNotMatch(html,/Upload je bestand naar de backend/i);
});

const sha="a".repeat(40),treeSha="b".repeat(40),api="https://api.github.com/repos/example/demo";
const run=(id,conclusion="success",head=sha)=>({id,name:"EAIgit syntax "+id,head_sha:head,status:"completed",conclusion,html_url:"https://github.com/example/demo/actions/runs/12345/job/"+id});
const jsonResponse=value=>new Response(JSON.stringify(value),{status:200});
const display=checks=>githubChecksView({...base,actionChecks:checks});
test("The ninth and thirteenth failures count, even though only eight rows are visible",async()=>{
 const runs=Array.from({length:13},(_,i)=>run(i+1,i===8||i===12?"failure":"success"));
 const calls=[];
 const checks=await fetchPublicChecks(api,sha,[],async url=>{
  calls.push(url);
  return jsonResponse(url.includes("/annotations?")?[]:{total_count:runs.length,check_runs:runs});
 },{});
 assert.equal(checks.runs.length,13);
 assert.equal(checks.incomplete,false);
 assert.equal(display(checks).state,"failed");
 assert.equal(display(checks).runs.length,8);
 assert.equal(display(checks).runs.filter(r=>r.failed).length,2);
 assert.match(display(checks).explanation,/8 van 13/);
 assert.ok(calls.every(x=>!x.includes("/commits/main/")));
 assert.match(display(checks).runs[0].url,/\/job\//);
});
test("A failed check on the second page is never hidden by a green first page",async()=>{
 const runs=Array.from({length:101},(_,i)=>run(i+1,i===100?"failure":"success"));
 const checks=await fetchPublicChecks(api,sha,[],async url=>{
  if(url.includes("/annotations?"))return jsonResponse([]);
  const page=Number(new URL(url).searchParams.get("page"));
  return jsonResponse({total_count:runs.length,check_runs:runs.slice((page-1)*100,page*100)});
 },{});
 assert.equal(checks.runs.length,101);
 assert.equal(checks.incomplete,false);
 assert.equal(display(checks).state,"failed");
 assert.equal(display(checks).runs[0].failed,true);
});
test("Missing pages, duplicate IDs, missing totals and wrong revisions never produce green",async()=>{
 const first=Array.from({length:100},(_,i)=>run(i+1));
 for(const fetcher of [
  async url=>new URL(url).searchParams.get("page")==="1"?jsonResponse({total_count:101,check_runs:first}):new Response("",{status:429}),
  async()=>jsonResponse({check_runs:[run(1)]}),
  async()=>jsonResponse({total_count:2,check_runs:[run(1),run(1)]}),
  async()=>jsonResponse({total_count:2,check_runs:[run(1),run(2,"success","c".repeat(40))]}),
  async()=>jsonResponse({total_count:200,check_runs:[]})
 ]){
  const checks=await fetchPublicChecks(api,sha,[],fetcher,{});
  assert.equal(checks.incomplete,true);
  assert.notEqual(display(checks).state,"checked");
  assert.notEqual(display(checks).state,"none");
 }
});
test("A pending or skipped check outside the display limit is not a successful set",()=>{
 for(const state of [{status:"pending",conclusion:null},{status:"completed",conclusion:"skipped"}]){
  const checks={...base.actionChecks,runs:[...Array.from({length:8},(_,i)=>({...base.actionChecks.runs[0],name:"success "+i})),{name:"last",...state}]};
  assert.equal(display(checks).state,"partial");
 }
});
test("The collection never associates check results with a different file tree",async()=>{
 for(const mismatch of [false,true]){
  const calls=[];
  const repo=await fetchPublicRepo("https://github.com/example/demo",async url=>{
   calls.push(url);
   if(url===api)return jsonResponse({full_name:"example/demo",html_url:"https://github.com/example/demo",private:false,default_branch:"main"});
   if(url.includes("/git/trees/"))return jsonResponse({sha:treeSha,truncated:false,tree:[{type:"blob",path:".github/workflows/check.yml"}]});
   if(url===api+"/commits/main")return jsonResponse({sha,commit:{tree:{sha:mismatch?"c".repeat(40):treeSha}}});
   if(url.includes("/commits/"+sha+"/check-runs?"))return jsonResponse({total_count:1,check_runs:[run(1)]});
   throw Error("Unexpected "+url);
  });
  assert.equal(repo.sha,treeSha);
  assert.equal(githubChecksView(repo).state,mismatch?"uncertain":"checked");
  assert.equal(calls.some(x=>x.includes("/check-runs?")),!mismatch);
 }
});
