import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HELP_TOPICS,HELP_CATEGORIES,HELP_BY_STEP} from "../assets/eaigit/help-topics.mjs";
import {PROMPT_LIBRARY,PROMPT_PHASES,promptsForPhase,fillPrompt} from "../assets/eaigit/prompts-data.mjs";
import {buildLocalWorkPlan,validateLocalWorkPlan,reasonForStep} from "../assets/eaigit/work-plan.mjs";

test("Bij iedere wizardvraag hoort relevante hulp met handelingen",()=>{
 for(const id of ["goal","source","zip","repo","aim","findings"]){
  const topic=HELP_TOPICS[id];assert.ok(topic,id);
  assert.ok(topic.title.length>5);
  assert.ok(topic.steps.length>=2);
 }
 for(const id of ["private","safe","unzip","create","upload","files","compare","references","actions","repo","try","publishing","source"]){
  assert.ok(HELP_TOPICS[HELP_BY_STEP[id]],"Geen hulp bij "+id);
 }
 const grouped=new Set(HELP_CATEGORIES.flatMap(g=>g.topics));
 assert.deepEqual(new Set(Object.keys(HELP_TOPICS)),grouped);
});
test("Bronlinks voor GitHub en ChatGPT leiden naar officiële hulp of de dienst zelf",()=>{
 const links=Object.values(HELP_TOPICS).flatMap(topic=>topic.links||[]);
 assert.ok(links.length>=12);
 for(const link of links){
  const url=new URL(link.url);
  assert.equal(url.protocol,"https:");
  assert.ok(["docs.github.com","github.com","help.openai.com","chatgpt.com","codex.openai.com"].includes(url.hostname),url.hostname);
 }
 assert.match(HELP_TOPICS.plugins.intro,/plug-in/);
 assert.match(HELP_TOPICS.skills.intro,/skill/);
 assert.match(HELP_TOPICS.codex.intro,/Codex/);
});
test("Bibliotheek heeft verschillende opdrachten voor alle ontwikkelfasen",()=>{
 assert.equal(PROMPT_PHASES.length,6);
 assert.ok(PROMPT_LIBRARY.length>=15);
 assert.equal(new Set(PROMPT_LIBRARY.map(x=>x.id)).size,PROMPT_LIBRARY.length);
 for(const phase of PROMPT_PHASES)assert.ok(promptsForPhase(phase.id).length>=2,phase.id);
 for(const prompt of PROMPT_LIBRARY){
  assert.ok(prompt.body.includes("{{REPO}}"),prompt.id);
  assert.ok(prompt.body.includes("{{DOEL}}"),prompt.id);
  assert.ok(prompt.body.length>=750,"Opdracht te summier: "+prompt.id);
  assert.ok(prompt.outcome.length>=25,"Geen concreet resultaat: "+prompt.id);
  assert.ok(!prompt.body.includes("Pieter"));
  assert.ok(!/mijn chain.of.thought|interne redeneersporen|redeneringstekst/i.test(prompt.body));
  const ready=fillPrompt(prompt,{repo:"https://github.com/voorbeeld/site",goal:"Een werkende website"});
  assert.match(ready,/https:\/\/github\.com\/voorbeeld\/site/);
  assert.ok(!ready.includes("{{REPO}}")&&!ready.includes("{{DOEL}}"));
 }
});
test("Promptbibliotheek vervangt taken niet door onbewezen claims of ongevraagde writes",()=>{
 for(const prompt of PROMPT_LIBRARY){
  assert.ok(/niet|geen|toestemming|akkoord|beoordeel|controle|bewijs|test/i.test(prompt.body));
 }
 assert.match(fillPrompt(PROMPT_LIBRARY[0]),/\[voeg de link naar je repository toe\]/);
 assert.match(fillPrompt(PROMPT_LIBRARY[0]),/\[beschrijf wat het project moet kunnen\]/);
});
test("Hulppagina en prompts zijn aparte toegankelijke routes",()=>{
 const help=readFileSync(new URL("../tools/eaigit/hulp/index.html",import.meta.url),"utf8");
 const prompts=readFileSync(new URL("../tools/eaigit/prompts/index.html",import.meta.url),"utf8");
 const wizard=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 assert.match(help,/id="helpCategories"/);
 assert.match(help,/Wat gebruik je waarvoor/);
 assert.match(prompts,/id="promptFilters"/);
 assert.match(prompts,/id="promptSearch"/);
 assert.match(prompts,/id="selectedOutcome"/);
 assert.match(prompts,/eg-dashboard-workspace/);
 assert.match(prompts,/prompt-dashboard/);
 assert.match(prompts,/id="selectedBody"/);
 assert.match(prompts,/id="copySelected"/);
 assert.match(wizard,/id="helpDialog"/);
 assert.match(wizard,/data-help="zip"/);
 assert.match(wizard,/id="guideMore"/);
 assert.match(wizard,/href="\/tools\/eaigit\/hulp\//);
 assert.match(wizard,/href="\/tools\/eaigit\/prompts\//);
 assert.doesNotMatch(wizard,/Pieter|redeneringssporen|chain.of.thought/);
});

test("EAIgit heeft één eigen logo en een heldere route op alle pagina's",()=>{
 const pages=["../tools/eaigit/index.html","../tools/eaigit/hulp/index.html","../tools/eaigit/prompts/index.html"];
 for(const path of pages){
  const html=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.match(html,/src="\/assets\/eaigit\/logo\.svg" alt="EAIgit"/);
  assert.equal((html.match(/<img\b/g)||[]).length,1,path);
  assert.doesNotMatch(html,/eg-dashboard-homebrand|eg-dashboard-symbol/);
 }
 const start=readFileSync(new URL(pages[0],import.meta.url),"utf8");
 assert.match(start,/data-experience="guided"/);
 assert.match(start,/data-experience="compact"/);
 for(const id of ["workSummary","workEvidence","guideReason","guideCheck","routeList","guideTrouble","finishStatus"])
  assert.match(start,new RegExp('id="'+id+'"'));
 const prompts=readFileSync(new URL(pages[2],import.meta.url),"utf8");
 assert.match(prompts,/data-suggest="fix"/);
 assert.match(prompts,/id="projectSettings"/);
 assert.doesNotMatch(prompts,/Vul deze gegevens één keer in/);
});
test("Zonder projectbron kan EAIgit geen werkend project claimen",()=>{
 const work=buildLocalWorkPlan({source:"unknown",intent:"explore",steps:[{id:"source"}]});
 assert.equal(work.aiRequired,false);
 assert.equal(work.mode,"read-only");
 assert.equal(work.investigated,0);
 assert.equal(work.observations.find(x=>x.id==="find-source").state,"niet-onderzocht");
 assert.equal(work.observations.find(x=>x.id==="user-test").state,"niet-getest");
 assert.equal(work.observations.find(x=>x.id==="guided-next").state,"voorgesteld");
 assert.equal(validateLocalWorkPlan(work.plan),true);
 assert.equal(work.plan.tasks.filter(x=>x.effect!=="local").length,0);
});
test("Een ZIP en openbare repository leveren brongebonden, maar geen bewezen gebruikstest op",()=>{
 const archive={eligible:["index.html","app.js"],contentCheck:{checkedFiles:2},secret:[]};
 const repo={readable:true,paths:["index.html","app.js"]};
 const advice={comparison:{missingCount:0,changed:[],unknown:[]}};
 const work=buildLocalWorkPlan({
  intent:"repair",source:"both",archive,repo,advice,
  aim:"Controleer de oefening",steps:[{id:"try"},{id:"compare"}]
 });
 assert.equal(work.investigated,4);
 assert.equal(work.proposedSteps,2);
 assert.equal(work.observations.find(x=>x.id==="file-compare").state,"gevonden");
 assert.equal(work.observations.find(x=>x.id==="user-test").state,"niet-getest");
 assert.equal(work.observations.find(x=>x.id==="write").state,"toestemming-nodig");
 assert.equal(work.plan.tasks.find(x=>x.id==="write").effect,"external-write");
 assert.equal(validateLocalWorkPlan(work.plan),true);
 assert.match(reasonForStep({id:"try"}),/geen werkende gebruikersroute getest/);
});
test("EAIwork-achtige plancontrole weigert ontbrekende toestemmingen en cirkels",()=>{
 const archive={eligible:["index.html"],contentCheck:{checkedFiles:1}};
 const work=buildLocalWorkPlan({intent:"publish",source:"zip",archive,steps:[{id:"publishing"}]});
 assert.equal(work.plan.tasks.find(x=>x.id==="publish").effect,"publish");
 assert.equal(work.observations.find(x=>x.id==="publish").state,"toestemming-nodig");
 assert.ok(work.plan.constraints[0].quote.includes("Publiceer"));
 assert.equal(validateLocalWorkPlan(work.plan),true);
 const missingGate=structuredClone(work.plan);missingGate.constraints=[];
 assert.throws(()=>validateLocalWorkPlan(missingGate),/zonder toestemming/);
 const changedQuote=structuredClone(work.plan);changedQuote.constraints[0].quote="Goedgekeurd";
 assert.throws(()=>validateLocalWorkPlan(changedQuote),/niet herleidbaar/);
 const cycle=structuredClone(work.plan);
 cycle.tasks[0].dependsOn=["user-test"];
 assert.throws(()=>validateLocalWorkPlan(cycle),/afhankelijkheid|Cirkel/);
});
