// This is a real cross-repository contract test. It does NOT approve or execute external actions.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {pathToFileURL} from "node:url";
const [planFile,workRoot,outputFile]=process.argv.slice(2);
if(!planFile||!workRoot)throw new Error("Gebruik: node test_projecthulp_eaiwork.mjs <plan.json> <eaiwork-checkout> [report.json]");
const source=resolve(workRoot);
const get=(p)=>import(pathToFileURL(resolve(source,p)).href);
const [{validateMissionPlan,applyMissionEvent,blockingConstraints,missionProgress},{runPureTextAdapter,builtinInventory}]=await Promise.all([
 get("packages/operations/src/missions.ts"),get("packages/operations/src/execution.ts")
]);
const plan=JSON.parse(readFileSync(planFile,"utf8"));
validateMissionPlan(plan);
assert.equal(plan.phases.length,6);
assert.equal(plan.tasks.length,11);
assert.ok(plan.tasks.find(x=>x.id==="repo-write"&&x.effect==="external-write"));
assert.ok(plan.tasks.find(x=>x.id==="publish-site"&&x.effect==="publish"));
assert.throws(()=>{const c=structuredClone(plan);c.tasks[0].dependsOn=["publish-site"];validateMissionPlan(c);},/cyclic dependency|phase dependency/);
assert.throws(()=>{const c=structuredClone(plan);c.constraints=[];validateMissionPlan(c);},/approval gate/);
const missions={};
applyMissionEvent(missions,{type:"mission.create",plan},{kind:"person",id:"test-owner"},"2026-11-15T00:00:00.000Z");
const mission=missions[plan.id];
const writeGates=blockingConstraints(mission,"repo-write");
const publishGates=blockingConstraints(mission,"publish-site");
assert.deepEqual(writeGates.map(x=>x.id),["gate-github-write"]);
assert.deepEqual(publishGates.map(x=>x.id),["gate-publish"]);
assert.equal(missionProgress(mission).blockedByConstraints,2);
const first=plan.tasks.find(x=>x.id==="goal-normalize");
const normal=runPureTextAdapter("text-normalize",first.input);
assert.equal(normal.text,"GitHub project bruikbaar maken");
const measured=runPureTextAdapter("text-metrics",{text:normal.text});
assert.equal(measured.words,4);
assert.throws(()=>runPureTextAdapter("github-write",{text:"nooit"}),/unsupported/);
const available=new Set(builtinInventory().adapterIds);
const actual=plan.tasks.filter(x=>available.has(x.taskKind)).map(x=>x.id);
assert.deepEqual(actual,["goal-normalize","goal-measure"]);
const result={
 contract:"EAIwork MissionPlan v1",mission:plan.id,
 outcome:"contract-checked-not-mission-executed",
 phases:plan.phases.map(p=>({id:p.id,title:p.title,tasks:p.taskIds})),
 eaiworkWorkersExecuted:[
  {task:"goal-normalize",adapter:"text-normalize",output:normal.text},
  {task:"goal-measure",adapter:"text-metrics",words:measured.words}
 ],
 missingAdapters:plan.tasks.filter(x=>!available.has(x.taskKind)).map(x=>({task:x.id,taskKind:x.taskKind})),
 humanGates:plan.constraints.map(c=>({id:c.id,taskIds:c.taskIds,unresolved:true})),
 checks:{
  missionSchema:"pass",dependencyCycles:"checked",phaseDependencies:"checked",
  externalWritesBlocked:"pass",publishBlocked:"pass",
  repositoryCodeLint:"not-run-here",targetProjectTests:"not-run-here"
 }
};
if(outputFile){mkdirSync(dirname(resolve(outputFile)),{recursive:true});writeFileSync(outputFile,JSON.stringify(result,null,2)+"\n");}
console.log("EAI Work genuine contract: "+plan.tasks.length+" tasks / "+plan.phases.length+" phases / "+actual.length+" real text adapters / "+publishGates.length+" publication gate unresolved.");
console.log("Remaining adapters are NOT installed in EAIwork runtime. This fixture does NOT run a user ZIP or target repository.");
