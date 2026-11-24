import {analyzeArchive,fetchPublicRepo,makeAdvice,readmeTemplate,ignoreTemplate,parseRepoUrl} from "./analyse.mjs";
import {generateProjectCheckWorkflow} from "./projectcheck.mjs";
import {makeGuidance} from "./begeleiding.mjs";
import {guideActions} from "./hulpstappen.mjs";
const $=(id)=>document.getElementById(id);
const state={archive:null,repo:null,advice:null,goal:"site",aim:"",experience:"beginner",repoError:null,workerRuns:[]};
async function runAnalysisWorker(kind,data,transfer=[]){
 if(typeof Worker!=="function"){
  const input=kind==="zip"?{name:data.name,size:data.buffer.byteLength,arrayBuffer:async()=>data.buffer}:null;
  return {result:kind==="zip"?await analyzeArchive(input):await fetchPublicRepo(data.url),worker:"fallback",elapsedMs:null};
 }
 const worker=new Worker(new URL("./onderzoek-worker.mjs",import.meta.url),{type:"module"});
 return new Promise((resolve,reject)=>{
  let finished=false;
  const close=()=>{if(finished)return false;finished=true;clearTimeout(timeout);worker.terminate();return true;};
  const timeout=setTimeout(()=>{if(close())reject(new Error("De controle is niet afgerond. Probeer opnieuw."));},30000);
  worker.onmessage=event=>{
   const msg=event.data;
   if(!msg||msg.id!==1)return;
   if(!close())return;
   if(msg.ok)resolve({result:msg.result,worker:"module-worker",elapsedMs:msg.elapsedMs});
   else reject(new Error(msg.error||"De controle is mislukt."));
  };
  worker.onerror=()=>{if(close())reject(new Error("De browser kon de onderzoeksworker niet starten."));};
  worker.postMessage({id:1,kind,...data},transfer);
 });
}
const setText=(id,text)=>{$(id).textContent=text;};
const show=(id,on)=>$(id).classList.toggle("ph-hidden",!on);
function screen(index){
 document.body.classList.toggle("ph-results",index===3);
 for(let i=1;i<=3;i++){show("screen"+i,index===i);const label=$("stepLabel"+i);label.classList.toggle("active",i===index);label.classList.toggle("done",i<index);}
 window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
 const title=$("screen"+index).querySelector("h2");title?.setAttribute("tabindex","-1");title?.focus({preventScroll:true});
}
function list(id,items,ordered=false){
 const node=$(id);node.replaceChildren();
 items.forEach(text=>{const el=document.createElement("li");el.textContent=text;node.append(el);});
}
const download=(name,text,type="text/plain;charset=utf-8")=>{
 const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const link=document.createElement("a");
 link.href=url;link.download=name;link.style.display="none";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
let currentGuides={};
function selectGuide(id){
 const guide=currentGuides[id];
 if(!guide)return;
 for(const button of document.querySelectorAll("[data-guide]")){
  const active=button.dataset.guide===id;
  button.classList.toggle("active",active);
  button.setAttribute("aria-pressed",String(active));
 }
 setText("guideStepTitle",guide.title);
 setText("guideStepText",guide.text);
 const link=$("guideUrl");
 link.href=guide.url;link.textContent=guide.link;
 show("guideUrl",Boolean(guide.url));
 $("guidePrompt").value=guide.prompt;
 show("guidePromptBox",false);
 setText("guideStatus","");
 $("revealGuidePrompt").textContent="Toon opdracht voor deze stap";
 state.selectedGuide=id;
}
function render(){
 const {archive,repo,advice,repoError}=state;
 const guidance=makeGuidance({archive,repo,advice,goal:state.goal,aim:state.aim,repoError});
 state.guidance=guidance;
 const pills=[archive?archive.project.type:"Geen ZIP onderzocht",repo?.name||"Geen repository gecontroleerd"];
 const summary=$("summary");summary.replaceChildren();
 for(const label of pills){const item=document.createElement("span");item.textContent=label;summary.append(item);}
 list("goodPoints",guidance.good);
 const issues=$("problemPoints");issues.replaceChildren();
 if(!guidance.problems.length){
  const li=document.createElement("li");
  li.textContent="Geen concrete fout gevonden in de uitgevoerde controles.";
  issues.append(li);
 }
 for(const problem of guidance.problems){
  const li=document.createElement("li");
  const bold=document.createElement("strong");bold.textContent=problem.title+". ";
  li.append(bold,document.createTextNode(problem.detail));
  if(problem.path&&repo?.readable&&repo?.paths?.includes(problem.path)&&repo?.branch&&guidance.repoUrl){
   const link=document.createElement("a");
   link.href=guidance.repoUrl+"/blob/"+encodeURIComponent(repo.branch)+"/"+problem.path.split("/").map(encodeURIComponent).join("/")+(problem.line?"#L"+problem.line:"");
   link.target="_blank";link.rel="noopener noreferrer";
   link.textContent="Bekijk "+problem.path+(problem.line?" regel "+problem.line:"")+" in GitHub";
   li.append(document.createTextNode(" "),link);
  }
  issues.append(li);
 }
 list("unknownPoints",guidance.uncertain);
 show("nextStepsGroup",guidance.next.length>1);
 list("nextSteps",guidance.next.slice(1));
 const repoLink=$("openRepo");
 show("openRepo",Boolean(guidance.repoUrl));
 if(guidance.repoUrl)repoLink.href=guidance.repoUrl;
 const actionsLink=$("openActions");
 show("openActions",Boolean(guidance.actionsUrl));
 if(guidance.actionsUrl)actionsLink.href=guidance.actionsUrl;
 let title="Dit kun je nu doen";
 if(archive?.secret?.length)title="Controleer eerst je privébestanden";
 else if(guidance.problems.some(x=>x.title.includes("ZIP in GitHub")))title="Pak eerst je ZIP uit";
 else if(archive?.missingReferences?.length)title="Bekijk de ontbrekende bestanden";
 else if(!archive)title="Onderzoek eerst je ZIP-bestand";
 else if(!repo?.readable)title="Controleer de repository";
 setText("firstTitle",title);
 setText("firstText",guidance.next[0]||"Bekijk de gevonden onderdelen en kies je volgende stap.");
 currentGuides=guideActions({guidance,repo,goal:state.goal,aim:state.aim});
 selectGuide("onderzoek");
 $("downloadReadme").disabled=!archive;
 $("downloadIgnore").disabled=!archive;
 show("optionalFiles",Boolean(archive));
 show("automationDetails",Boolean(generateProjectCheckWorkflow(archive)));
 screen(3);
}
async function analyze(){
 const file=$("zipFile").files?.[0];
 const url=$("repoUrl").value.trim();
 show("inputError",false);
 if(!file&&!url){setText("inputError","Voeg een ZIP-bestand of een GitHub-link toe om te beginnen.");show("inputError",true);return;}
 if(file&&(!file.name.toLowerCase().endsWith(".zip")||file.size>16*1024*1024)){
  setText("inputError","Kies een ZIP-bestand van maximaal 16 MB.");show("inputError",true);return;
 }
 if(url){try{parseRepoUrl(url);}catch(error){setText("inputError",error.message);show("inputError",true);return;}}
 state.goal=document.querySelector('input[name="goal"]:checked')?.value||"site";
 state.experience="beginner";
 state.aim=$("projectAim").value.trim().slice(0,220);
 $("analyze").disabled=true;show("loading",true);setText("loadingText","We controleren je bestanden…");
 try{
  state.archive=null;state.repo=null;state.repoError=null;state.workerRuns=[];
  // ZIP en GitHub zijn onafhankelijk: beide controles starten vóór de eerste wordt afgewacht.
  const zipJob=file?(async()=>{
   const buffer=await file.arrayBuffer();
   return runAnalysisWorker("zip",{buffer,name:file.name},[buffer]);
  })():Promise.resolve(null);
  const githubJob=url?runAnalysisWorker("github",{url}):Promise.resolve(null);
  const [zipResult,githubResult]=await Promise.allSettled([zipJob,githubJob]);
  if(zipResult.status==="rejected"){
   setText("inputError",zipResult.reason?.message||"Het ZIP-bestand kon niet worden gelezen.");
   show("inputError",true);
   return;
  }
  if(zipResult.value){
   state.archive=zipResult.value.result;
   state.workerRuns.push({task:"zip-inspect",mode:zipResult.value.worker,elapsedMs:zipResult.value.elapsedMs,status:"completed"});
  }
  if(githubResult.status==="fulfilled"&&githubResult.value){
   state.repo=githubResult.value.result;
   state.workerRuns.push({task:"github-read",mode:githubResult.value.worker,elapsedMs:githubResult.value.elapsedMs,status:state.repo.readable?"completed":"partial"});
  }else if(githubResult.status==="rejected"){
   state.repoError=githubResult.reason?.message||"GitHub kon niet worden gecontroleerd.";
   state.workerRuns.push({task:"github-read",mode:"module-worker",status:"failed",reason:state.repoError});
  }
  state.advice=makeAdvice({goal:state.goal,aim:state.aim,experience:state.experience,archive:state.archive,repo:state.repo});
  render();
 }finally{show("loading",false);$("analyze").disabled=false;}
}
$("toFiles").addEventListener("click",()=>screen(2));
$("back1").addEventListener("click",()=>screen(1));
$("back2").addEventListener("click",()=>screen(2));
$("analyze").addEventListener("click",analyze);
$("zipFile").addEventListener("change",()=>{
 const file=$("zipFile").files?.[0];setText("fileName",file?file.name:"Kies een ZIP om te onderzoeken");show("inputError",false);
});
const drop=$("dropZone");
for(const event of ["dragenter","dragover"]){drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add("dragover");});}
for(const event of ["dragleave","drop"]){drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove("dragover");});}
drop.addEventListener("drop",event=>{
 const file=event.dataTransfer?.files?.[0];
 if(!file)return;
 try{const transfer=new DataTransfer();transfer.items.add(file);$("zipFile").files=transfer.files;setText("fileName",file.name);}
 catch{setText("inputError","Sleep het ZIP-bestand niet, maar kies het via de bestandsknop.");show("inputError",true);}
});
for(const button of document.querySelectorAll("[data-guide]")){
 button.addEventListener("click",()=>selectGuide(button.dataset.guide));
}
$("revealGuidePrompt").addEventListener("click",()=>{
 const next=$("guidePromptBox").classList.contains("ph-hidden");
 show("guidePromptBox",next);
 $("revealGuidePrompt").textContent=next?"Verberg opdracht":"Toon opdracht voor deze stap";
});
$("copyGuidePrompt").addEventListener("click",async()=>{
 if(!$("guidePrompt").value)return;
 try{
  await navigator.clipboard.writeText($("guidePrompt").value);
  setText("guideStatus","Opdracht gekopieerd.");
 }catch{
  setText("guideStatus","Kopiëren lukte niet. Selecteer de tekst en kopieer die zelf.");
 }
});
$("downloadReadme").addEventListener("click",()=>{if(state.archive)download("README.md",readmeTemplate(state.archive,state.repo?.name));});
$("downloadIgnore").addEventListener("click",()=>{if(state.archive)download("gitignore-voorbeeld.txt",ignoreTemplate(state.archive));});
$("downloadCheck").addEventListener("click",()=>{const yaml=generateProjectCheckWorkflow(state.archive);if(yaml)download("projectcontrole.yml",yaml,"text/yaml;charset=utf-8");});
$("reset").addEventListener("click",()=>{
 $("zipFile").value="";$("repoUrl").value="";setText("fileName","Kies een ZIP om te onderzoeken");show("inputError",false);
 for(const key of ["archive","repo","advice","repoError","guidance"])state[key]=null;state.workerRuns=[];
 document.querySelector('input[name="goal"][value="site"]').checked=true;$("projectAim").value="";state.aim="";screen(1);
});
