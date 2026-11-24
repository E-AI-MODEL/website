import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {githubChecksView} from "../assets/eaigit/github-checks.mjs";

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
