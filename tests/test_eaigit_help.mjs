import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HELP_TOPICS,HELP_CATEGORIES,HELP_BY_STEP} from "../assets/eaigit/help-topics.mjs";
import {PROMPT_LIBRARY,PROMPT_PHASES,promptsForPhase,fillPrompt} from "../assets/eaigit/prompts-data.mjs";
import {buildLocalWorkPlan,validateLocalWorkPlan,reasonForStep} from "../assets/eaigit/work-plan.mjs";
import {buildJourney} from "../assets/eaigit/journey.mjs";

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
  assert.ok(["docs.github.com","github.com","help.openai.com","chatgpt.com","codex.openai.com","developer.mozilla.org"].includes(url.hostname),url.hostname);
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
 assert.deepEqual(work.pendingDecisions.map(x=>x.effect),["external-write"]);
 assert.equal(work.pendingDecisions[0].approved,false);
 assert.ok(work.plan.tasks.every(x=>x.effect==="local"));
 assert.equal(work.plan.sourceInstruction,"Controleer de oefening");
 assert.equal(validateLocalWorkPlan(work.plan),true);
 assert.match(reasonForStep({id:"try"}),/geen werkende gebruikersroute getest/);
});
test("EAIwork-plan is veilig: publiceren is slechts een voorstel, nooit een taak",()=>{
 const archive={eligible:["index.html"],contentCheck:{checkedFiles:1}};
 const work=buildLocalWorkPlan({intent:"publish",source:"zip",archive,steps:[{id:"publishing"}]});
 assert.deepEqual(work.pendingDecisions.map(x=>x.effect),["publish"]);
 assert.equal(work.pendingDecisions[0].approved,false);
 assert.ok(work.plan.tasks.every(x=>x.effect==="local"));
 assert.equal(work.plan.sourceInstruction,undefined,"Verzin geen gebruikersopdracht");
 assert.equal(work.observations.find(x=>x.id==="publish").state,"toestemming-nodig");
 assert.equal(validateLocalWorkPlan(work.plan),true);
 const illegalWrite=structuredClone(work.plan);
 illegalWrite.tasks[0].effect="publish";
 assert.throws(()=>validateLocalWorkPlan(illegalWrite),/zonder toestemming/);
 const cycle=structuredClone(work.plan);
 cycle.tasks[0].dependsOn=["user-test"];
 assert.throws(()=>validateLocalWorkPlan(cycle),/afhankelijkheid|Cirkel/);
});

test("Onzekere bronvergelijking krijgt geen volledig onderzocht-label",()=>{
 const archive={eligible:["index.html"],contentCheck:{checkedFiles:1}};
 const repo={readable:true,paths:["index.html"],truncated:false};
 const advice={comparison:{missingCount:0,changed:[],unknown:["index.html"]}};
 const work=buildLocalWorkPlan({intent:"repair",source:"both",archive,repo,advice});
 const item=work.observations.find(o=>o.id==="file-compare");
 assert.equal(item.state,"beperkt");
 assert.equal(work.partial,1);
 assert.match(item.detail,/van 1 bestand is niet vastgesteld of de inhoud gelijk is/);
});

test("Ervaren gebruiker krijgt andere, op bewijs gerichte handelingen",()=>{
 const archive={eligible:["index.html","app.js"],missingReferences:["bad.css"],secret:[]};
 const guided=buildJourney({intent:"repair",source:"zip",archive,experience:"guided"});
 const compact=buildJourney({intent:"repair",source:"zip",archive,experience:"compact"});
 assert.deepEqual(guided.map(x=>x.id),compact.map(x=>x.id),"De veiligheidsroute mag niet veranderen");
 assert.notEqual(guided[0].description,compact[0].description);
 assert.match(compact[0].description,/projectroot|bronbestanden/);
 assert.match(compact.find(x=>x.id==="references").description,/één lokale verwijzing/);
 assert.ok(guided[0].description.length>0);
});


test("GitHub koppelen is optioneel, met controleerbare en voorzichtige abonnementsuitleg",()=>{
 const help=readFileSync(new URL("../tools/eaigit/hulp/index.html",import.meta.url),"utf8");
 assert.match(help,/<details class="eg-help-group eg-connection-guide" id="githubConnect">/);
 assert.doesNotMatch(help,/<details class="eg-help-group eg-connection-guide" id="githubConnect" open/);
 assert.match(help,/Instellingen → Plug-ins/);
 assert.match(HELP_TOPICS.koppelen.intro,/ChatGPT/);
 assert.match(HELP_TOPICS.abonnement.intro,/geen ChatGPT-abonnement/);
 assert.match(HELP_TOPICS.abonnement.steps.join(" "),/werkruimte/);
 assert.doesNotMatch(HELP_TOPICS.abonnement.steps.join(" "),/minimaal Plus|Free en Go zijn plug-inextensies niet beschikbaar/);
 assert.ok(HELP_CATEGORIES.find(g=>g.id==="chatgpt").topics.includes("koppelen"));
 assert.ok(HELP_CATEGORIES.find(g=>g.id==="chatgpt").topics.includes("abonnement"));
});

test("Optionele technische details blijven standaard dicht, ook voor ervaren gebruikers",()=>{
 const code=readFileSync(new URL("../assets/eaigit/wizard.mjs",import.meta.url),"utf8");
 for(const id of ["workDetails","routeDetails","guideCheckDetails"]){
  assert.ok(code.includes('$("'+id+'").open=false;'),id+" moet standaard dicht");
 }
 assert.doesNotMatch(code,/\.open=state\.experience==="compact"/);
 const wizard=readFileSync(new URL("../tools/eaigit/index.html",import.meta.url),"utf8");
 assert.match(wizard,/<details id="routeDetails"/);
 assert.match(wizard,/<details\b[^>]*id="guideCheckDetails"/);
});

test("Drie openbare EAIgit-pagina's zijn indexeerbaar en hebben correcte sitemap en canonical",()=>{
 const routes=["/tools/eaigit/","/tools/eaigit/hulp/","/tools/eaigit/prompts/"];
 const files=["../tools/eaigit/index.html","../tools/eaigit/hulp/index.html","../tools/eaigit/prompts/index.html"];
 const sitemap=readFileSync(new URL("../sitemap.xml",import.meta.url),"utf8");
 const generator=readFileSync(new URL("../scripts/build_site.py",import.meta.url),"utf8");
 const register=JSON.parse(readFileSync(new URL("../catalog/website-register.json",import.meta.url),"utf8"));
 for(let i=0;i<routes.length;i++){
  const html=readFileSync(new URL(files[i],import.meta.url),"utf8");
  const url="https://eaimodel.nl"+routes[i];
  assert.match(html,/<meta name="robots" content="index,follow">/);
  assert.ok(html.includes('<link rel="canonical" href="'+url+'">'));
  assert.doesNotMatch(html,/noindex|nofollow/i);
  assert.doesNotMatch(html,/cloudflareinsights\.com\/beacon|\/assets\/site-analytics\.js/,"De ZIP-tool krijgt geen bezoekersmeting of POST-tracker");
  assert.equal(sitemap.split("<loc>"+url+"</loc>").length-1,1);
  assert.equal(register.pages.find(p=>p.url===routes[i])?.in_committed_sitemap,true);
 }
 assert.ok(generator.includes('urls.extend(["/tools/eaigit/", "/tools/eaigit/hulp/", "/tools/eaigit/prompts/"])'));
});
