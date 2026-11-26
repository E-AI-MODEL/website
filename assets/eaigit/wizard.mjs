import {analyzeArchive,fetchPublicRepo,makeAdvice,parseRepoUrl} from "../projecthulp/analyse.mjs";
import {analyzeSingleFile,SINGLE_FILE_LIMIT} from "../projecthulp/los-bestand.mjs";
import {makeGuidance} from "../projecthulp/begeleiding.mjs";
import {buildJourney,primaryFinding,helpPrompt} from "./journey.mjs";
import {buildLocalWorkPlan,reasonForStep} from "./work-plan.mjs";
import {selectAuditAction} from "./audit-advice.mjs";
import {getHelpTopic,getHelpForStep} from "./help-topics.mjs";
import {githubChecksView} from "./github-checks.mjs";

const $=id=>document.getElementById(id);
const state={intent:null,source:null,goal:"code",delivery:"local",zip:null,singleFile:null,repoUrl:"",archive:null,repo:null,repoError:null,aim:"",guidance:null,steps:[],stepIndex:0,busy:false,experience:"guided",workPlan:null,completedSteps:new Set()};
const stages=["intent","source","file","zip","repo","aim","result","guide","finished"];
function openHelp(topicId,contextTip=""){
 const topic=getHelpTopic(topicId);if(!topic)return;
 label("helpTitle",topic.title);
 label("helpIntro",topic.intro);
 show("helpContextTip",Boolean(contextTip));
 label("helpContextTip",contextTip);
 const list=$("helpSteps");list.replaceChildren();
 for(const instruction of topic.steps){const li=document.createElement("li");li.textContent=instruction;list.append(li);}
 const links=$("helpLinks");links.replaceChildren();
 for(const resource of topic.links||[]){
  const link=document.createElement("a");link.textContent=resource.label;link.href=resource.url;
  link.target="_blank";link.rel="noopener noreferrer";links.append(link);
 }
 $("helpFull").href="/tools/eaigit/hulp/#uitleg-"+encodeURIComponent(topicId);
 if(!$("helpDialog").open)$("helpDialog").showModal();
}

const show=(id,yes)=>$(id)?.classList.toggle("eg-hidden",!yes);
const label=(id,value)=>{$(id).textContent=value;};
const getFlow=()=>["intent","source",...(state.source==="file"?["file"]:[]),...(state.source==="zip"||state.source==="both"?["zip"]:[]),...(state.source==="github"||state.source==="both"?["repo"]:[]),"aim","result"];
const goals={start:"code",local:"app",repair:"app",publish:"site",explore:"unsure"};
let currentStage="intent";
function navigate(target){
 currentStage=target;
 for(const stage of stages)show("stage-"+stage,stage===target);
 show("loading",false);
 const flow=getFlow(),index=flow.indexOf(target),total=flow.length-1;
 const progress=target==="finished"?1:target==="guide"
  ?0.66+0.34*((state.stepIndex+1)/(state.steps.length+1))
  :index<0?0:0.66*(index+1)/Math.max(1,total);
 $("progressFill").style.width=Math.round(progress*100)+"%";
 label("progressStep",target==="guide"?"Stap "+(state.stepIndex+1)+" van "+state.steps.length:
  target==="finished"?"Klaar":"Stap "+Math.max(1,Math.min(index+1,total))+" van "+total);
 label("progressLabel",target==="guide"?"Aan de slag":target==="finished"?"Afronden":({intent:"Jouw vraag",source:"Je bestanden",file:"Je bestand",zip:"Je ZIP",repo:"Je repository",aim:"Je doel",result:"Je advies"}[target]||"EAIgit"));
 if(target==="aim")show("deliveryChoices",state.intent==="local"||(state.source==="file"&&["repair","explore"].includes(state.intent)));
 document.body.classList.toggle("eg-is-result",["result","guide","finished"].includes(target));
 const heading=$("stage-"+target).querySelector("h1,h2");
 heading?.setAttribute("tabindex","-1");
 heading?.focus({preventScroll:true});
 window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
}
function previous(stage){
 const flow=getFlow(),at=flow.indexOf(stage);
 navigate(flow[Math.max(0,at-1)]||"intent");
}
function afterSource(){
 if(state.source==="file")navigate("file");
 else if(state.source==="zip"||state.source==="both")navigate("zip");
 else if(state.source==="github")navigate("repo");
 else navigate("aim");
}
async function runWorker(kind,data,transfer=[]){
 if(typeof Worker!=="function"){
  const source=kind!=="github"?{name:data.name,size:data.buffer.byteLength,arrayBuffer:async()=>data.buffer}:null;
  return kind==="zip"?analyzeArchive(source):kind==="file"?analyzeSingleFile(source):fetchPublicRepo(data.url);
 }
 const worker=new Worker(new URL("../projecthulp/onderzoek-worker.mjs",import.meta.url),{type:"module"});
 return new Promise((resolve,reject)=>{
  let finished=false;
  const finish=()=>{if(finished)return false;finished=true;clearTimeout(timer);worker.terminate();return true;};
  const timer=setTimeout(()=>{if(finish())reject(new Error("De controle duurt te lang. Probeer het opnieuw."));},30000);
  worker.onmessage=event=>{
   const m=event.data;
   if(!m||m.id!==1||!finish())return;
   if(m.ok)resolve(m.result);else reject(new Error(m.error||"De controle is mislukt."));
  };
  worker.onerror=()=>{if(finish())reject(new Error("De browser kon het bestand niet onderzoeken."));};
  worker.postMessage({id:1,kind,...data},transfer);
 });
}
function liList(id,entries,problem=false){
 const node=$(id);node.replaceChildren();
 for(const entry of entries){
  const li=document.createElement("li");
  if(!problem){li.textContent=entry;node.append(li);continue;}
  const bold=document.createElement("strong");bold.textContent=entry.title+". ";li.append(bold,document.createTextNode(entry.detail));
  let linked=false;
  if(entry.path&&state.repo?.readable&&state.repo?.paths?.includes(entry.path)&&state.repo?.branch&&state.guidance?.repoUrl){
   const a=document.createElement("a");
   a.href=state.guidance.repoUrl+"/blob/"+encodeURIComponent(state.repo.branch)+"/"+entry.path.split("/").map(encodeURIComponent).join("/")+(entry.line?"#L"+entry.line:"");
   a.target="_blank";a.rel="noopener noreferrer";a.textContent="Bekijk "+entry.path+" in GitHub";
   li.append(document.createTextNode(" "),a);
   linked=true;
  }
  if(entry.path&&!linked){
   li.append(document.createTextNode(" Bestand: "+entry.path+(entry.line?" (regel "+entry.line+")":"")+"."));
  }
  node.append(li);
 }
}
function renderGithubChecks(){
 const view=githubChecksView(state.repo);
 show("githubCheckPanel",view.visible);
 if(!view.visible)return;
 label("githubCheckSummary",view.summary);
 label("githubCheckExplanation",view.explanation);
 label("githubCheckRevision",view.headSha?"GitHub commit: "+view.headSha.slice(0,12):"Geen bevestigde commit beschikbaar.");
 const list=$("githubCheckList");list.replaceChildren();
 for(const run of view.runs){
  const item=document.createElement("li");
  const name=document.createElement("strong");name.textContent=run.name;
  const status=document.createElement("span");status.textContent=run.status;
  item.append(name,status);
  if(run.url){
   const link=document.createElement("a");link.href=run.url;link.target="_blank";
   link.rel="noopener noreferrer";link.textContent="Bekijk controle";
   item.append(link);
  }
  list.append(item);
 }
 $("githubCheckLink").href=view.actionsUrl;
 $("githubCheckPanel").dataset.state=view.state;
}
function renderResult(){
 const advice=(state.intent==="local"||state.source==="file")?null:makeAdvice({
  goal:state.goal,aim:state.aim,experience:state.experience==="compact"?"advanced":"beginner",
  archive:state.archive,repo:state.repo
 });
 const g=makeGuidance({archive:state.archive,repo:state.repo,advice,
  goal:state.goal,aim:state.aim,repoError:state.repoError,intent:state.intent,source:state.source,delivery:state.delivery});
 state.guidance=g;
 const noSource=!state.archive&&!state.repo?.readable&&!state.repoError;
 const first=primaryFinding(g,{archive:state.archive,repo:state.repo,repoError:state.repoError,intent:state.intent});
 label("resultTag",first.label);
 label("resultHeading",first.title);
 label("resultDescription",first.description);
 const good=noSource?[]:g.good||[],problems=g.problems||[];
 label("goodCount",noSource?"Nog niets onderzocht":good.length+" gevonden");
 label("issueCount",noSource?"Nog geen controle":problems.length+" aandachtspunt"+(problems.length===1?"":"en"));
 liList("goodPoints",noSource?["Er zijn nog geen projectbestanden onderzocht."]:good);
 liList("problemPoints",noSource?[{title:"Nog geen beoordeling mogelijk",detail:state.intent==="local"?"Er is nog geen bestand aangeleverd. Je krijgt wel stappen om een zelfstandig bestand te maken en te testen.":"Voeg een bestand, ZIP of openbare GitHub-repository toe."}]:problems.length?problems:[{title:"Geen concrete fout vastgesteld",detail:"Alleen de uitgevoerde controles tellen mee."}],true);
 liList("unknownPoints",g.uncertain||[]);
 $("goodDetails").open=false;$("issueDetails").open=false;$("unknownDetails").open=false;
 if(problems.some(p=>p.severity==="stop"))$("issueDetails").open=true;
 show("repoLink",Boolean(g.repoUrl));
 show("actionsLink",Boolean(g.actionsUrl));
 if(g.repoUrl)$("repoLink").href=g.repoUrl;
 if(g.actionsUrl)$("actionsLink").href=g.actionsUrl;
 state.auditAction=selectAuditAction({archive:state.archive,repo:state.repo});
 // Een privacyblokkade gaat altijd vóór gewone syntax- of structuuradviezen.
 show("auditNext",Boolean(state.auditAction)&&!state.archive?.secret?.length&&!g.problems.some(x=>x.severity==="stop"));
 if(state.auditAction){
  const a=state.auditAction;
  label("auditNextTitle",a.title);
  label("auditNextDescription",a.description);
  label("auditNextSource",a.source+" · "+(a.path||"Projectstructuur")+(a.line?" · regel "+a.line:"")
   +" · "+(a.certainty==="review"?"nog controleren":"statisch vastgesteld"));
 }
 state.steps=buildJourney({intent:state.intent,source:state.source,archive:state.archive,
  repo:state.repo,guidance:g,experience:state.experience,auditAction:state.auditAction,delivery:state.delivery,aim:state.aim});
 state.stepIndex=0;
 state.completedSteps.clear();
 state.workPlan=buildLocalWorkPlan({
  intent:state.intent,source:state.source,archive:state.archive,repo:state.repo,
  repoError:state.repoError,advice,aim:state.aim,steps:state.steps,delivery:state.delivery
 });
 showWorkEvidence(state.workPlan);
 renderGithubChecks();
 navigate("result");
}
async function analyze(){
 if(state.busy)return;
 state.busy=true;$("analyze").disabled=true;
 show("loading",true);
 try{
  state.archive=null;state.repo=null;state.repoError=null;
  const selected=state.source==="file"?state.singleFile:state.zip;
  const kind=state.source==="file"?"file":"zip";
  const zip=selected?selected.arrayBuffer().then(buffer=>runWorker(kind,{name:selected.name,buffer},[buffer])):Promise.resolve(null);
  const repo=state.repoUrl?runWorker("github",{url:state.repoUrl}):Promise.resolve(null);
  const [z,r]=await Promise.allSettled([zip,repo]);
  if(z.status==="rejected"){
   const target=state.source==="file"?"file":"zip";const errorId=target==="file"?"fileError":"zipError";
   label(errorId,z.reason?.message||"Bestand kon niet worden gelezen.");show(errorId,true);navigate(target);show(errorId,true);return;
  }
  if(z.value)state.archive=z.value;
  if(r.status==="fulfilled"&&r.value)state.repo=r.value;
  if(r.status==="rejected")state.repoError=r.reason?.message||"GitHub is niet bereikbaar.";
  renderResult();
 }catch(error){
  label("repoError",error?.message||"Er ging iets mis. Probeer het opnieuw.");
  show("repoError",true);
  navigate(state.repoUrl?"repo":state.source==="file"?"file":state.zip?"zip":"aim");
 }finally{show("loading",false);$("analyze").disabled=false;state.busy=false;}
}
function showWorkEvidence(work){
 const list=$("workEvidence");list.replaceChildren();
 const states={
  "gevonden":"Onderzocht","beperkt":"Beperkt","niet-onderzocht":"Niet onderzocht",
  "niet-getest":"Niet getest","voorgesteld":"Voorgesteld",
  "toestemming-nodig":"Niet uitgevoerd"
 };
 for(const entry of work.observations){
  const item=document.createElement("li");
  const name=document.createElement("strong");name.textContent=entry.title;
  const status=document.createElement("span");
  status.className="eg-proof-status eg-proof-"+entry.state;
  status.textContent=states[entry.state]||entry.state;
  const detail=document.createElement("p");detail.textContent=entry.detail;
  item.append(name,status,detail);list.append(item);
 }
 const found=work.investigated||0;
 const partial=work.partial||0;
 label("workSummary",found||partial
  ?found+" onderdelen onderzocht"+(partial?", "+partial+" met beperkingen":"")+". De werking van het project is nog niet getest."
  :"Er is nog geen volledige broncontrole uitgevoerd. De werking is niet getest.");
 $("workDetails").open=false;
}
function verifyStep(step){
 switch(step.id){
  case "private": return "Bekijk de genoemde bestanden op je eigen apparaat. Ga pas verder als je hebt bepaald wat openbaar mag zijn. EAIgit kan dat niet voor je beslissen.";
  case "safe":return "Controleer dat de uitgepakte projectmap geen wachtwoorden, sleutels of andere privégegevens bevat.";
  case "unzip":return "Je ziet losse bestanden en mappen, niet alleen een .zip-bestand.";
  case "create-local":return "Je hebt een bestand gemaakt en op je eigen apparaat opgeslagen. EAIgit heeft het nog niet automatisch getest.";
  case "offline":return "Open het bestand op het bedoelde apparaat, zet de internetverbinding uit en test de belangrijkste functie. Bij een programma kunnen installaties nodig zijn.";
  case "file-sharing":return "Open de kopie op een ander geschikt apparaat. Controleer of alle benodigde bestanden en programma’s aanwezig zijn.";
  case "local-hosting":return "Controleer de openbare URL en de belangrijkste functie. EAIgit heeft niets gepubliceerd.";
  case "try-local":return "Test openen, bediening en opslag op het bedoelde apparaat, zonder internet. Test ook in een tweede browser waar dat helpt.";
  case "create":return "Je nieuwe repository is zichtbaar in GitHub. Kopieer de volledige repositorylink en vul die hier in.";
  case "upload":case "files":return "Vernieuw GitHub en open enkele bestanden. Controleer of de paden en bestandsinhoud kloppen.";
  case "compare":return "Vergelijk de bedoelde bestanden op GitHub met je eigen ZIP. Gelijke namen betekenen niet dat de inhoud gelijk is.";
  case "references":return "Open het bronbestand of de website en controleer dat de eerder ontbrekende verwijzing nu naar het juiste bestand gaat.";
  case "actions":return "Bekijk een recente GitHub Actions-run. Lees ook welke tests zijn uitgevoerd en welke niet.";
  case "repo":return "Je ziet de verwachte bestanden op GitHub en kunt enkele daarvan openen.";
  case "publishing":return "Open de openbare URL in een nieuw venster. Controleer de belangrijkste functie en de links, niet alleen de startpagina.";
  case "source":return "Je hebt een ZIP op je apparaat gevonden of de link naar een openbare repository. Gebruik 'Opnieuw beginnen' om die hier te onderzoeken.";
  case "try":return "Voer de beschreven handeling zelf uit. Controleer wat er na een goed en een fout antwoord gebeurt. Een gevonden knop is geen geslaagde test.";
  default:return "Voer de handeling uit en controleer het zichtbare resultaat. EAIgit voert dit niet automatisch uit.";
 }
}
function renderRoute(){
 const list=$("routeList");list.replaceChildren();
 for(const [index,step] of state.steps.entries()){
  const li=document.createElement("li");
  const button=document.createElement("button");button.type="button";
  button.textContent=(index+1)+". "+step.title;
  button.setAttribute("aria-current",String(index===state.stepIndex));
  button.addEventListener("click",()=>{state.stepIndex=index;renderGuide();});
  li.append(button);
  if(state.completedSteps.has(step.id)){
   const label=document.createElement("small");label.textContent="Zelf afgevinkt";
   li.append(label);
  }
  list.append(li);
 }
 $("routeDetails").open=false;
}
function renderGuide(){
 const step=state.steps[state.stepIndex];
 if(!step){navigate("finished");return;}
 label("guideCounter","Stap "+(state.stepIndex+1)+" van "+state.steps.length);
 label("guideTitle",step.title);
 label("guideDescription",step.description);
 label("guideReason",step.audit?.reason||reasonForStep(step,{archive:state.archive,repo:state.repo,guidance:state.guidance}));
 label("guideCheck",step.audit?.verify||verifyStep(step));
 $("guideCheckDetails").open=false;
 renderRoute();
 $("guideMore").dataset.help=step.audit?.helpId||getHelpForStep(step.id);
 show("createdRepoBox",step.id==="create");
 if(step.id==="create")$("createdRepoUrl").value=state.repoUrl||"";
 show("createdRepoError",false);
 show("guideLink",Boolean(step.href&&step.action));
 if(step.href&&step.action){$("guideLink").href=step.href;$("guideLink").firstChild.textContent=step.action+" ";}
 const selectedPrompts={
  source:"begrijp",repo:"begrijp",unzip:"repo-start",create:"repo-start",upload:"repo-start",
  files:"repo-start",compare:"repo-start",private:"veiligheid",safe:"veiligheid",
  references:"fix",actions:"ci",try:"gebruikstest",publishing:"publiceer-plan",
   "create-local":"begrijp",offline:"gebruikstest","file-sharing":"review","local-hosting":"publiceer-plan","try-local":"gebruikstest"
 };
 $("phasePrompts").href="/tools/eaigit/prompts/?taak="+(step.audit?.promptId||selectedPrompts[step.id]||"begrijp");
 show("phasePrompts",!step.audit&&state.intent!=="local"&&!(state.source==="file"&&["repair","explore"].includes(state.intent)));
 const prompt=helpPrompt(step,state.guidance?.repoUrl||"",state.intent,state.aim,state.delivery);
 show("promptDetails",Boolean(prompt));
 $("promptDetails").open=false;
 $("stepPrompt").value=prompt;
 label("copyStatus","");
 label("guideNext",state.stepIndex===state.steps.length-1?"Naar de afsluiting →":"Ik heb dit gedaan →");
 navigate("guide");
}
function reset(){
 state.intent=null;state.source=null;state.goal="code";state.delivery="local";state.zip=null;state.singleFile=null;state.repoUrl="";state.archive=null;state.repo=null;state.repoError=null;state.aim="";state.guidance=null;state.steps=[];state.stepIndex=0;state.workPlan=null;state.auditAction=null;state.completedSteps.clear();
 $("zipFile").value="";label("zipFileName","Bestand kiezen");$("zipNext").disabled=true;
 $("singleFile").value="";label("singleFileName","Los bestand kiezen");$("fileNext").disabled=true;
 for(const b of document.querySelectorAll("[data-delivery]"))b.setAttribute("aria-pressed",String(b.dataset.delivery==="local"));
 $("repoUrl").value="";$("projectAim").value="";
 show("zipError",false);show("fileError",false);show("repoError",false);
 navigate("intent");
}
for(const button of document.querySelectorAll("[data-experience]")){
 button.addEventListener("click",()=>{
  state.experience=button.dataset.experience==="compact"?"compact":"guided";
  document.body.classList.toggle("eg-compact",state.experience==="compact");
  for(const b of document.querySelectorAll("[data-experience]"))
   b.setAttribute("aria-pressed",String(b.dataset.experience===state.experience));
 });
}
for(const button of document.querySelectorAll("[data-intent]")){
 button.addEventListener("click",()=>{state.intent=button.dataset.intent;state.goal=goals[state.intent]||"code";navigate("source");});
}
for(const button of document.querySelectorAll("[data-source]")){
 button.addEventListener("click",()=>{state.source=button.dataset.source;afterSource();});
}
$("sourceBack").addEventListener("click",()=>navigate("intent"));
for(const button of document.querySelectorAll("[data-delivery]")){
 button.addEventListener("click",()=>{
  state.delivery=button.dataset.delivery;
  for(const b of document.querySelectorAll("[data-delivery]"))
   b.setAttribute("aria-pressed",String(b.dataset.delivery===state.delivery));
 });
}
const fileInput=$("singleFile");
fileInput.addEventListener("change",()=>{
 state.singleFile=fileInput.files?.[0]||null;
 label("singleFileName",state.singleFile?.name||"Los bestand kiezen");
 $("fileNext").disabled=!state.singleFile;
 show("fileError",false);
});
const fileDrop=$("fileDrop");
for(const event of ["dragenter","dragover"])fileDrop.addEventListener(event,e=>{e.preventDefault();fileDrop.classList.add("eg-drag");});
for(const event of ["dragleave","drop"])fileDrop.addEventListener(event,e=>{e.preventDefault();fileDrop.classList.remove("eg-drag");});
fileDrop.addEventListener("drop",e=>{
 const file=e.dataTransfer?.files?.[0];if(!file)return;
 try{const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}));}
 catch{label("fileError","Kies het bestand via de bestandsknop.");show("fileError",true);}
});
$("fileBack").addEventListener("click",()=>navigate("source"));
$("fileNext").addEventListener("click",()=>{
 if(!state.singleFile)return;
 if(state.singleFile.size>SINGLE_FILE_LIMIT){label("fileError","Kies een los bestand van maximaal 8 MB.");show("fileError",true);return;}
 navigate("aim");
});
const zipInput=$("zipFile");
zipInput.addEventListener("change",()=>{
 state.zip=zipInput.files?.[0]||null;
 label("zipFileName",state.zip?.name||"Bestand kiezen");
 $("zipNext").disabled=!state.zip;
 show("zipError",false);
});
const drop=$("zipDrop");
for(const event of ["dragenter","dragover"])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add("eg-drag");});
for(const event of ["dragleave","drop"])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove("eg-drag");});
drop.addEventListener("drop",e=>{
 const file=e.dataTransfer?.files?.[0];if(!file)return;
 try{const transfer=new DataTransfer();transfer.items.add(file);zipInput.files=transfer.files;zipInput.dispatchEvent(new Event("change",{bubbles:true}));}
 catch{label("zipError","Kies het ZIP-bestand via de bestandsknop.");show("zipError",true);}
});
$("zipBack").addEventListener("click",()=>navigate("source"));
$("zipNext").addEventListener("click",()=>{
 if(!state.zip)return;
 if(!state.zip.name.toLowerCase().endsWith(".zip")||state.zip.size>16*1024*1024){label("zipError","Kies een ZIP van maximaal 16 MB.");show("zipError",true);return;}
 if(state.source==="both")navigate("repo");else navigate("aim");
});
$("repoBack").addEventListener("click",()=>previous("repo"));
$("repoNext").addEventListener("click",()=>{
 const entered=$("repoUrl").value.trim();
 if(!entered){label("repoError","Plak een GitHub-link of kies 'Ik heb nog geen repository'.");show("repoError",true);return;}
 try{state.repoUrl="https://github.com/"+parseRepoUrl(entered).name;show("repoError",false);navigate("aim");}
 catch(error){label("repoError",error.message);show("repoError",true);}
});
$("repoSkip").addEventListener("click",()=>{state.repoUrl="";$("repoUrl").value="";if(state.source==="github")state.source="unknown";navigate("aim");});
$("aimBack").addEventListener("click",()=>previous("aim"));
$("aimSkip").addEventListener("click",()=>{$("projectAim").value="";state.aim="";analyze();});
$("analyze").addEventListener("click",()=>{state.aim=$("projectAim").value.trim().slice(0,220);analyze();});
$("githubCheckReload").addEventListener("click",async()=>{
 if(state.busy||!state.repo?.readable||!state.repoUrl)return;
 state.busy=true;
 const button=$("githubCheckReload");button.disabled=true;
 label("githubCheckSummary","GitHub-controles worden opnieuw opgehaald…");
 try{
  const repo=await runWorker("github",{url:state.repoUrl});
  state.repo=repo;state.repoError=null;
  renderResult();
 }catch(error){
  state.repo={...state.repo,actionChecks:null};
  renderResult();
  label("githubCheckSummary","Vernieuwen niet gelukt");
  label("githubCheckExplanation",error?.message||"Controleer je verbinding en probeer opnieuw.");
 }finally{
  button.disabled=false;state.busy=false;
 }
});
$("resultBack").addEventListener("click",()=>navigate("aim"));
$("reset").addEventListener("click",reset);
$("startGuidance").addEventListener("click",()=>{state.stepIndex=0;renderGuide();});
$("guideBack").addEventListener("click",()=>{if(state.stepIndex===0)navigate("result");else{state.stepIndex--;renderGuide();}});
$("guideNext").addEventListener("click",()=>{
 const step=state.steps[state.stepIndex];
 if(step?.id==="create"){
  const entered=$("createdRepoUrl").value.trim();
  if(!entered){
   label("createdRepoError","Plak eerst de link naar je nieuwe repository. EAIgit heeft die nodig om je bij het uploaden te helpen.");
   show("createdRepoError",true);return;
  }
  if(entered){
   try{
    state.repoUrl="https://github.com/"+parseRepoUrl(entered).name;
    const nextStep=state.steps.find(x=>x.id==="upload");
    if(nextStep){nextStep.href=state.repoUrl;nextStep.action="Open nieuwe repository";}
    show("createdRepoError",false);
   }catch(error){
    label("createdRepoError",error.message);
    show("createdRepoError",true);return;
   }
  }
 }
 state.completedSteps.add(step.id);
 state.stepIndex++;
 if(state.stepIndex<state.steps.length)renderGuide();
 else{
  const count=state.completedSteps.size;
  label("finishStatus","Je hebt "+count+" van "+state.steps.length+" stappen zelf afgevinkt. Dit is geen controle van de werking.");
  show("checkAgain",Boolean(state.repoUrl||state.zip));
  navigate("finished");
 }
});
$("copyPrompt").addEventListener("click",async()=>{
 const value=$("stepPrompt").value;
 try{await navigator.clipboard.writeText(value);label("copyStatus","Gekopieerd.");}
 catch{label("copyStatus","Selecteer de tekst om die zelf te kopiëren.");}
});
for(const button of document.querySelectorAll("[data-help]")){
 button.addEventListener("click",()=>openHelp(button.dataset.help));
}
$("guideMore").addEventListener("click",()=>openHelp($("guideMore").dataset.help||"goal",state.steps[state.stepIndex]?.help||""));
$("guideTrouble").addEventListener("click",()=>{
 const step=state.steps[state.stepIndex];
 openHelp(getHelpForStep(step?.id)||"goal",
  "Loop je vast? Bekijk de handelingen hieronder. "+(step?.help||""));
});
$("helpClose").addEventListener("click",()=>$("helpDialog").close());
$("checkAgain").addEventListener("click",analyze);
$("finishReset").addEventListener("click",reset);
navigate("intent");
