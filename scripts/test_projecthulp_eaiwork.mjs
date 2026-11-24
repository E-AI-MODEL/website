// This is a real cross-repository contract test. It does NOT approve or execute external actions.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {resolve,dirname} from "node:path";
import {pathToFileURL} from "node:url";
const [planFile,workRoot,outputFile]=process.argv.slice(2);
if(!planFile||!workRoot)throw new Error("Gebruik: node test_projecthulp_eaiwork.mjs <plan.json> <eaiwork-checkout> [report.json]");
const source=resolve(workRoot);
const get=(p)=>import(pathToFileURL(resolve(source,p)).href);
const [{validateMissionPlan,applyMissionEvent,blockingConstraints,missionProgress},
 {runPureTextAdapter,builtinInventory,runMissionStep,evaluateBuiltin},
 {OpsStore},{inspectMissionPlan}]=await Promise.all([
 get("packages/operations/src/missions.ts"),
 get("packages/operations/src/execution.ts"),
 get("packages/operations/src/store.ts"),
 get("packages/operations/src/preflight.ts")
]);
// Valideer de werkplannen uit de EAIgit-browser met de echte, ongewijzigde
// EAIwork-MissionPlan-validator. Dit voert geen browseropdrachten uit.
const {buildLocalWorkPlan}=await import("../assets/eaigit/work-plan.mjs");
const browserCases=[
 {name:"geen-bestanden",source:"unknown",intent:"explore"},
 {name:"zip-start",source:"zip",intent:"start",
  archive:{eligible:["index.html"],contentCheck:{checkedFiles:1}}},
 {name:"git-alleen",source:"github",intent:"repair",
  repo:{readable:true,paths:["index.html"],contentCheck:{checkedFiles:1}}},
 {name:"beide-bronnen",source:"both",intent:"repair",aim:"De belangrijkste knop moet werken",
  archive:{eligible:["index.html","app.js"],contentCheck:{checkedFiles:2}},
  repo:{readable:true,paths:["index.html","app.js"]},
  advice:{comparison:{missingCount:0,changed:[],unknown:[]}}},
 {name:"publicatie-niet-toegestaan",source:"zip",intent:"publish",
  archive:{eligible:["index.html"],contentCheck:{checkedFiles:1}}}
];
const websitePlans=browserCases.map(({name,...settings})=>{
 const built=buildLocalWorkPlan(settings);
 validateMissionPlan(built.plan);
 const check=inspectMissionPlan(built.plan);
 assert.equal(check.status,"requires-human-review");
 assert.equal(check.approvalGranted,false);
 assert.equal(check.canExecute,false);
 assert.equal(check.instructionCoverage,"not-evaluated");
 assert.ok(built.plan.tasks.every(task=>task.effect==="local"));
 assert.ok(built.pendingDecisions.every(decision=>decision.approved===false));
 assert.ok(built.observations.some(x=>x.id==="user-test"&&x.state==="niet-getest"));
 if(settings.aim)assert.equal(built.plan.sourceInstruction,settings.aim);
 else assert.equal(built.plan.sourceInstruction,undefined);
 return {name,structuralValidation:check.structuralValidation,
  tasks:built.plan.tasks.length,phases:built.plan.phases.length,
  pendingDecisions:built.pendingDecisions.map(x=>x.effect),
  userTest:"not-performed",approvalGranted:check.approvalGranted};
});
const plan=JSON.parse(readFileSync(planFile,"utf8"));
validateMissionPlan(plan);
const preflight=inspectMissionPlan(plan);
assert.equal(preflight.status,"requires-human-review");
assert.equal(preflight.approvalGranted,false);
assert.equal(preflight.canExecute,false);
assert.ok(preflight.tasks.find(t=>t.taskId==="repo-write").blockers.includes("human-approval-required"));
assert.ok(preflight.tasks.find(t=>t.taskId==="publish-site").blockers.includes("human-approval-required"));
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
// Geef alleen in deze test twee bekende workers vrij via de echte Operations-journal.
// De testpersoon is een fixture, geen toestemming van een echte gebruiker.
const temp=mkdtempSync(join(tmpdir(),"projecthulp-eaiwork-"));
let schedulerResult,operationProof;
const store=new OpsStore(temp);
let number=0;
const at="2026-11-15T00:00:00.000Z";
const emit=(event,actor={kind:"person",id:"test-owner"})=>
 store.append({id:"projecthulp-test-"+(++number),at,actor,event});
try{
 for(const id of ["text-normalize","text-metrics"]){
  const contract={
   id,version:"1.0.0",name:id,specialization:"Controlled deterministic text fixture",
   taskKinds:[id],inputSchema:{type:"object"},outputSchema:{type:"object"},
   tools:[],requestedPermissions:[],modelPolicy:{preferred:"deterministic"},
   testSuite:"builtin-fixture-v1",stopConditions:["invalid-input"]
  };
  emit({type:"worker.register",contract});
  const measurement=evaluateBuiltin(id,contract);
  assert.equal(measurement.numerator,measurement.denominator);
  const evidenceRef="fixture:"+id+":1.0.0";
  emit({type:"quality.record",measurement:{
   id:"measurement-"+id,workerId:id,version:"1.0.0",
   taskKind:id,dataset:measurement.dataset,suiteVersion:measurement.suiteVersion,
   cohort:measurement.cohort,metric:measurement.metric,numerator:measurement.numerator,
   denominator:measurement.denominator,measuredAt:at,evidenceRef
  }},{kind:"check",id:"check:builtins"});
  emit({type:"worker.release",id,evidenceRef});
 }
 emit({type:"mission.create",plan});
 const firstRun=runMissionStep(store,plan.id,1);
 const secondRun=runMissionStep(store,plan.id,1);
 const blockedRun=runMissionStep(store,plan.id,2);
 assert.deepEqual(firstRun.completed,["goal-normalize"]);
 assert.deepEqual(secondRun.completed,["goal-measure"]);
 assert.deepEqual(blockedRun.completed,[]);
 assert.deepEqual(blockedRun.blocked.map(x=>x.taskId).sort(),["github-inventory","zip-inventory"]);
 const snapshot=store.snapshot().missions[plan.id];
 assert.equal(snapshot.tasks["goal-normalize"].status,"done");
 assert.equal(snapshot.tasks["goal-measure"].status,"done");
 assert.deepEqual(blockingConstraints(snapshot,"repo-write").map(x=>x.id),["gate-github-write"]);
 assert.deepEqual(blockingConstraints(snapshot,"publish-site").map(x=>x.id),["gate-publish"]);
 schedulerResult={first:firstRun.completed,second:secondRun.completed,blocked:blockedRun.blocked};
 operationProof={registered:Object.keys(store.snapshot().workers),completed:2,
  journalIntegrity:"recorded-by-ops-store",
  permissionScope:"test-only-no-external-writes",remaining:missionProgress(snapshot)};
}finally{store.close();rmSync(temp,{recursive:true,force:true});}
const result={
 contract:"EAIwork MissionPlan v1",mission:plan.id,websitePlans,
 preflight:{status:preflight.status,approvalGranted:preflight.approvalGranted,canExecute:preflight.canExecute,blocked:preflight.tasks.filter(t=>t.blockers?.length).map(t=>({task:t.taskId,blockers:t.blockers}))},
 outcome:"first-two-dependency-tasks-executed-in-eaiwork-opsstore-remainder-blocked",
 phases:plan.phases.map(p=>({id:p.id,title:p.title,tasks:p.taskIds})),
 schedulerRuns:schedulerResult,
 operations:operationProof,
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
console.log("EAIgit browser workplans validated against actual EAIwork: "+websitePlans.length+" paths, no external approval.");
console.log("Remaining adapters are NOT installed in EAIwork runtime. This fixture does NOT run a user ZIP or target repository.");
