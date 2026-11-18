// EAIgit: lokale taakafhankelijkheden, herleidbare status en toestemmingsgrenzen.
// Gebaseerd op de EAIwork MissionPlan v1-vorm. EAIgit voert de voorgestelde
// EAIwork-taken NIET uit. Browsercontroles hebben hun eigen uitvoerlogica.
const PRODUCT_RULES={write:"Wijzigingen vereisen een apart akkoord.",publish:"Publiceren vereist een apart akkoord."};
const task=(id,title,taskKind,dependsOn=[],effect="local")=>({
 id,title,taskKind,dependsOn:[...dependsOn],effect,input:{text:title}
});
const evidence=(id,title,state,detail)=>({id,title,state,detail});
const plain=(value)=>String(value||"").replace(/[\r\n\t]/g," ").slice(0,240);
export function buildLocalWorkPlan({
 intent="explore",source="unknown",archive=null,repo=null,repoError=null,
 advice=null,aim="",steps=[]
}={}){
 const hasZip=Boolean(archive?.eligible);
 const hasRepo=Boolean(repo?.readable);
 const wantsZip=["zip","both"].includes(source);
 const wantsRepo=["github","both"].includes(source);
 const observations=[],tasks=[],phases=[];
 const add=(id,title,members)=>{
  if(!members.length)return;
  tasks.push(...members);
  phases.push({id,title,taskIds:members.map(m=>m.id)});
 };
 const inputs=[];
 if(wantsZip){
  inputs.push(task("zip-source","ZIP-bestand onderzoeken","zip-inspect"));
  observations.push(evidence("zip-source","ZIP-bestand",hasZip?"gevonden":"niet-onderzocht",
   hasZip?archive.eligible.length+" mogelijke projectbestanden lokaal geïnventariseerd; projectcode is niet uitgevoerd.":"Er is geen ZIP-bestand onderzocht."));
 }
 if(wantsRepo){
  inputs.push(task("github-source","Openbare GitHub-repository lezen","github-read"));
  observations.push(evidence("github-source","GitHub",hasRepo?"gevonden":"niet-onderzocht",
   hasRepo?repo.paths.length+" bestandspaden in de openbare repository gelezen.":plain(repoError)||"GitHub is niet of niet volledig uitgelezen."));
 }
 if(!inputs.length){
  inputs.push(task("find-source","Vind de projectbestanden","source-locate"));
  observations.push(evidence("find-source","Projectbestanden","niet-onderzocht","Er is nog geen bestand of repository gecontroleerd."));
 }
 add("phase-sources","Bronnen",inputs);
 const checks=[],sourceIds=inputs.map(t=>t.id);
 const actualSources=hasZip||hasRepo;
 if(actualSources){
  checks.push(task("text-review","Bestandstekst en verwijzingen onderzoeken","static-file-review",sourceIds));
  const checked=Number(archive?.contentCheck?.checkedFiles||0)+Number(repo?.contentCheck?.checkedFiles||0);
  observations.push(evidence("text-review","Inhoud en verwijzingen",checked?"gevonden":"beperkt",
   checked?checked+" leesbare bronbestanden statisch gecontroleerd. De toepassing is niet gestart.":"Er zijn nog geen leesbare bronbestanden inhoudelijk gecontroleerd."));
 }
 if(wantsZip&&wantsRepo){
  checks.push(task("file-compare","ZIP en GitHub vergelijken","file-compare",sourceIds));
  const c=advice?.comparison;
  observations.push(evidence("file-compare","Bronnen vergelijken",hasZip&&hasRepo&&c?"gevonden":"niet-onderzocht",
   hasZip&&hasRepo&&c
    ?c.missingCount+" ontbreken op dezelfde plek, "+c.changed.length+" verschillen aantoonbaar, "+c.unknown.length+" kunnen niet inhoudelijk worden vergeleken."
    :"Voor een vergelijking zijn beide bronnen nodig."));
 }
 add("phase-inspect","Onderzoek",checks);
 const adviceTask=task("guided-next","Bepaal de volgende handeling","deterministic-guidance",checks.length?checks.map(t=>t.id):sourceIds);
 add("phase-guidance","Begeleiding",[adviceTask]);
 observations.push(evidence("guided-next","Vervolgroute","voorgesteld",
  (steps.length||0)+" mogelijke vervolgstappen uit de gekozen route en beschikbare brongegevens. Geen van deze stappen is uitgevoerd."));
 // Toestemming kan hier niet zijn gegeven. Externe handelingen staan daarom
 // uitdrukkelijk BUITEN het EAIwork-taakplan. De gebruiker ziet slechts voorstellen.
 const pendingDecisions=[];
 for(const [id,title,effect] of [
  ["write","Wijzigingen beoordelen","external-write"],
  ["publish","Publicatie beoordelen","publish"]
 ]){
  if(id==="write"?!["start","repair"].includes(intent):intent!=="publish")continue;
  pendingDecisions.push({id,title,effect,policy:PRODUCT_RULES[id],approved:false});
  observations.push(evidence(id,title,"toestemming-nodig",
   "Er is niets gewijzigd of gepubliceerd. Deze handeling vraagt afzonderlijke toestemming."));
 }
 add("phase-verify","Controle",[task("user-test","Test de belangrijkste gebruikershandeling","human-review",["guided-next"])]);
 observations.push(evidence("user-test","Werkende toepassing","niet-getest",
  "Een bestandencontrole bewijst niet dat de website of toepassing werkt. Er is geen volledige gebruikstest uitgevoerd."));
 const originalAim=String(aim||"").trim();
 const plan={
  id:"eaigit-local-project",title:"EAIgit projectonderzoek",
  goal:plain(aim).slice(0,180)||"Mijn project begrijpen en gericht verder werken",
  ...(originalAim?{sourceInstruction:originalAim}:{}),
  tasks,phases
 };
 validateLocalWorkPlan(plan);
 return {
  plan,observations,pendingDecisions,
  investigated:observations.filter(o=>o.state==="gevonden").length,
  notTested:observations.filter(o=>["niet-onderzocht","niet-getest"].includes(o.state)).length,
  proposedSteps:steps.length, aiRequired:false,mode:"read-only",
  explanation:"EAIgit gebruikt lokaal uitgevoerde browsercontroles en EAIwork-taakafhankelijkheden. EAIwork-workers zijn hier niet gestart."
 };
}

/**
 * Kleine browser-preflight volgens de strikte, herbruikbare EAIwork-regels.
 * Dit is een lokale contractcontrole, geen EAIwork-Operations-run.
 * Iedere taak hoort bij precies één fase. Er zijn geen afhankelijkheidscirkels.
 * Onuitgevoerde externe acties zijn geen onderdeel van het uitvoerbare plan.
 */
export function validateLocalWorkPlan(plan){
 if(!plan||!Array.isArray(plan.tasks)||!Array.isArray(plan.phases))throw Error("Ongeldig werkplan");
 if(!plan.tasks.length||plan.tasks.length>32)throw Error("Ongeldig aantal taken");
 const byId=new Map(plan.tasks.map(t=>[t.id,t]));
 if(byId.size!==plan.tasks.length)throw Error("Dubbele taak");
 const assigned=new Map();
 for(const [phaseIndex,p] of plan.phases.entries()){
  if(!p.taskIds?.length)throw Error("Lege fase");
  for(const id of p.taskIds){
   if(!byId.has(id)||assigned.has(id))throw Error("Ongeldige fase-indeling");
   assigned.set(id,phaseIndex);
  }
 }
 if(assigned.size!==byId.size)throw Error("Taak ontbreekt in fase");
 const visited=new Set(),active=new Set();
 function visit(id){
  if(active.has(id))throw Error("Cirkel in taakafhankelijkheden");
  if(visited.has(id))return;
  active.add(id);
  const t=byId.get(id);
  if(!Array.isArray(t.dependsOn)||!t.taskKind)throw Error("Taak zonder contract");
  for(const dep of t.dependsOn){
   if(!byId.has(dep)||assigned.get(dep)>assigned.get(id))throw Error("Ongeldige afhankelijkheid");
   visit(dep);
  }
  active.delete(id);visited.add(id);
 }
 for(const t of plan.tasks)visit(t.id);
 const constraints=plan.constraints||[];
 for(const c of constraints){
  if(!c.quote||plan.sourceInstruction?.slice(c.start,c.end)!==c.quote)
   throw Error("Toestemming niet herleidbaar");
  if(!c.taskIds?.length||c.taskIds.some(id=>!byId.has(id)))
   throw Error("Toestemming zonder taak");
 }
 for(const t of plan.tasks){
  if(t.effect!=="local"&&!constraints.some(c=>c.kind==="approval"&&c.taskIds.includes(t.id)))
   throw Error("Externe handeling zonder toestemming");
 }
 return true;
}

export function reasonForStep(step,{archive=null,repo=null,guidance=null}={}){
 const id=step?.id;
 if(id==="source")return "Er zijn nog geen projectbestanden onderzocht.";
 if(["private","safe"].includes(id))return "Er zijn "+(archive?.secret?.length||0)+" namen aangetroffen die mogelijk vertrouwelijk zijn. Controleer ze zelf voordat je iets deelt.";
 if(id==="references"){
  const found=(guidance?.problems||[]).find(p=>/verwijzingen|ontbrekende bestanden/i.test(p.title));
  return found?plain(found.detail):"Een verwijzing kan naar een ontbrekend bestand wijzen. Controleer het precieze pad.";
 }
 if(["unzip","create","upload","files","compare"].includes(id))
  return archive?.eligible?.length
   ?archive.eligible.length+" mogelijke projectbestanden gevonden in de ZIP. Dit zegt niets over hun werking."
   :repo?.readable?"De openbare GitHub-bestandslijst is gelezen. Er is geen ZIP onderzocht.":"We hebben nog geen volledig project kunnen vergelijken.";
 if(id==="actions"||id==="repo")return repo?.readable?"De repository is bereikbaar. De inhoud en werking zijn niet automatisch volledig getest.":"De repository is nog niet gecontroleerd.";
 if(id==="try")return "Er is geen werkende gebruikersroute getest. De gevonden code is hiervoor geen bewijs.";
 if(id==="publishing")return "Een startbestand is geen bevestiging dat de website live werkt. Publicatie is nog niet gedaan.";
 return "Deze handeling komt voort uit het gekozen doel en de controles die wel of niet zijn uitgevoerd.";
}
