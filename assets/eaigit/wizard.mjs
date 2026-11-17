import {analyzeArchive,fetchPublicRepo,makeAdvice,parseRepoUrl} from "../projecthulp/analyse.mjs";
import {makeGuidance} from "../projecthulp/begeleiding.mjs";
import {buildJourney,primaryFinding,helpPrompt} from "./journey.mjs";
import {getHelpTopic,getHelpForStep} from "./help-topics.mjs";

const $=id=>document.getElementById(id);
const state={intent:null,source:null,goal:"code",zip:null,repoUrl:"",archive:null,repo:null,repoError:null,aim:"",guidance:null,steps:[],stepIndex:0,busy:false};
const stages=["intent","source","zip","repo","aim","result","guide","finished"];
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
const getFlow=()=>["intent","source",...(state.source==="zip"||state.source==="both"?["zip"]:[]),...(state.source==="github"||state.source==="both"?["repo"]:[]),"aim","result"];
const goals={start:"code",repair:"app",publish:"site",explore:"unsure"};
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
 label("progressLabel",target==="guide"?"Aan de slag":target==="finished"?"Afronden":({intent:"Jouw vraag",source:"Je bestanden",zip:"Je ZIP",repo:"Je repository",aim:"Je doel",result:"Je advies"}[target]||"EAIgit"));
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
 if(state.source==="zip"||state.source==="both")navigate("zip");
 else if(state.source==="github")navigate("repo");
 else navigate("aim");
}
async function runWorker(kind,data,transfer=[]){
 if(typeof Worker!=="function"){
  const source=kind==="zip"?{name:data.name,size:data.buffer.byteLength,arrayBuffer:async()=>data.buffer}:null;
  return kind==="zip"?analyzeArchive(source):fetchPublicRepo(data.url);
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
function renderResult(){
 const g=makeGuidance({archive:state.archive,repo:state.repo,advice:makeAdvice({goal:state.goal,aim:state.aim,experience:"beginner",archive:state.archive,repo:state.repo}),goal:state.goal,aim:state.aim,repoError:state.repoError});
 state.guidance=g;
 const noSource=!state.archive&&!state.repo?.readable&&!state.repoError;
 const first=primaryFinding(g,{archive:state.archive,repo:state.repo,repoError:state.repoError});
 label("resultTag",first.label);
 label("resultHeading",first.title);
 label("resultDescription",first.description);
 const good=noSource?[]:g.good||[],problems=g.problems||[];
 label("goodCount",noSource?"Nog niets onderzocht":good.length+" gevonden");
 label("issueCount",noSource?"Nog geen controle":problems.length+" aandachtspunt"+(problems.length===1?"":"en"));
 liList("goodPoints",noSource?["Er zijn nog geen projectbestanden onderzocht."]:good);
 liList("problemPoints",noSource?[{title:"Nog geen beoordeling mogelijk",detail:"Voeg een ZIP-bestand of een openbare GitHub-repository toe."}]:problems.length?problems:[{title:"Geen concrete fout vastgesteld",detail:"Alleen de uitgevoerde controles tellen mee."}],true);
 liList("unknownPoints",g.uncertain||[]);
 $("goodDetails").open=false;$("issueDetails").open=false;$("unknownDetails").open=false;
 if(problems.some(p=>p.severity==="stop"))$("issueDetails").open=true;
 show("repoLink",Boolean(g.repoUrl));
 show("actionsLink",Boolean(g.actionsUrl));
 if(g.repoUrl)$("repoLink").href=g.repoUrl;
 if(g.actionsUrl)$("actionsLink").href=g.actionsUrl;
 state.steps=buildJourney({intent:state.intent,source:state.source,archive:state.archive,repo:state.repo,guidance:g});
 state.stepIndex=0;
 navigate("result");
}
async function analyze(){
 if(state.busy)return;
 state.busy=true;$("analyze").disabled=true;
 show("loading",true);
 try{
  state.archive=null;state.repo=null;state.repoError=null;
  const zip=state.zip?state.zip.arrayBuffer().then(buffer=>runWorker("zip",{name:state.zip.name,buffer},[buffer])):Promise.resolve(null);
  const repo=state.repoUrl?runWorker("github",{url:state.repoUrl}):Promise.resolve(null);
  const [z,r]=await Promise.allSettled([zip,repo]);
  if(z.status==="rejected"){label("zipError",z.reason?.message||"ZIP kon niet worden gelezen.");show("zipError",true);navigate("zip");show("zipError",true);return;}
  if(z.value)state.archive=z.value;
  if(r.status==="fulfilled"&&r.value)state.repo=r.value;
  if(r.status==="rejected")state.repoError=r.reason?.message||"GitHub is niet bereikbaar.";
  renderResult();
 }catch(error){
  label("repoError",error?.message||"Er ging iets mis. Probeer het opnieuw.");
  show("repoError",true);
  navigate(state.repoUrl?"repo":state.zip?"zip":"aim");
 }finally{show("loading",false);$("analyze").disabled=false;state.busy=false;}
}
function renderGuide(){
 const step=state.steps[state.stepIndex];
 if(!step){navigate("finished");return;}
 label("guideCounter","Stap "+(state.stepIndex+1)+" van "+state.steps.length);
 label("guideTitle",step.title);
 label("guideDescription",step.description);
 $("guideMore").dataset.help=getHelpForStep(step.id);
 show("createdRepoBox",step.id==="create");
 if(step.id==="create")$("createdRepoUrl").value=state.repoUrl||"";
 show("createdRepoError",false);
 show("guideLink",Boolean(step.href&&step.action));
 if(step.href&&step.action){$("guideLink").href=step.href;$("guideLink").firstChild.textContent=step.action+" ";}
 const phases={
  source:"verkennen",repo:"verkennen",unzip:"opzetten",create:"opzetten",upload:"opzetten",files:"opzetten",
  compare:"opzetten",private:"controleren",safe:"controleren",references:"bouwen",actions:"controleren",
  try:"controleren",publishing:"publiceren"
 };
 $("phasePrompts").href="/tools/eaigit/prompts/?fase="+(phases[step.id]||"verkennen");
 const prompt=helpPrompt(step,state.guidance?.repoUrl||"",state.intent);
 show("promptDetails",Boolean(prompt));
 $("promptDetails").open=false;
 $("stepPrompt").value=prompt;
 label("copyStatus","");
 label("guideNext",state.stepIndex===state.steps.length-1?"Afronden →":"Deze stap heb ik gedaan →");
 navigate("guide");
}
function reset(){
 state.intent=null;state.source=null;state.goal="code";state.zip=null;state.repoUrl="";state.archive=null;state.repo=null;state.repoError=null;state.aim="";state.guidance=null;state.steps=[];state.stepIndex=0;
 $("zipFile").value="";label("zipFileName","Bestand kiezen");$("zipNext").disabled=true;
 $("repoUrl").value="";$("projectAim").value="";
 show("zipError",false);show("repoError",false);
 navigate("intent");
}
for(const button of document.querySelectorAll("[data-intent]")){
 button.addEventListener("click",()=>{state.intent=button.dataset.intent;state.goal=goals[state.intent]||"code";navigate("source");});
}
for(const button of document.querySelectorAll("[data-source]")){
 button.addEventListener("click",()=>{state.source=button.dataset.source;afterSource();});
}
$("sourceBack").addEventListener("click",()=>navigate("intent"));
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
$("resultBack").addEventListener("click",()=>navigate("aim"));
$("reset").addEventListener("click",reset);
$("startGuidance").addEventListener("click",()=>{state.stepIndex=0;renderGuide();});
$("guideBack").addEventListener("click",()=>{if(state.stepIndex===0)navigate("result");else{state.stepIndex--;renderGuide();}});
$("guideNext").addEventListener("click",()=>{
 const step=state.steps[state.stepIndex];
 if(step?.id==="create"){
  const entered=$("createdRepoUrl").value.trim();
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
 state.stepIndex++;
 if(state.stepIndex<state.steps.length)renderGuide();
 else{show("checkAgain",Boolean(state.repoUrl));navigate("finished");}
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
$("helpClose").addEventListener("click",()=>$("helpDialog").close());
$("checkAgain").addEventListener("click",analyze);
$("finishReset").addEventListener("click",reset);
navigate("intent");
