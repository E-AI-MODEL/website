import {analyzeArchive,fetchPublicRepo,makeAdvice,reportText,readmeTemplate,ignoreTemplate,parseRepoUrl} from "./analyse.mjs";
import {generateProjectCheckWorkflow} from "./projectcheck.mjs";
import {makeGuidance,continuationPrompt} from "./begeleiding.mjs";
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
function render(){
 const {archive,repo,advice,repoError}=state;
 const purpose=advice.purpose;
 state.guidance=makeGuidance({archive,repo,advice,goal:state.goal,aim:state.aim,repoError});
 const guidance=state.guidance;
 list("goodPoints",guidance.good);
 const problems=guidance.problems;
 const issues=$("problemPoints");issues.replaceChildren();
 if(!problems.length){const li=document.createElement("li");li.textContent="Geen concrete fout vastgesteld binnen deze beperkte controle. De code is niet functioneel getest.";issues.append(li);}
 for(const problem of problems){
  const li=document.createElement("li");
  const strong=document.createElement("strong");strong.textContent=problem.title+". ";li.append(strong);
  li.append(document.createTextNode(problem.detail));
  if(problem.path&&repo?.readable&&repo?.paths?.includes(problem.path)&&repo?.branch&&guidance.repoUrl){
   const link=document.createElement("a");
   link.href=guidance.repoUrl+"/blob/"+encodeURIComponent(repo.branch)+"/"+problem.path.split("/").map(encodeURIComponent).join("/")+(problem.line?"#L"+problem.line:"");
   link.target="_blank";link.rel="noopener noreferrer";link.textContent="Bekijk "+problem.path+(problem.line?" regel "+problem.line:"")+" in GitHub";
   li.append(document.createTextNode(" "),link);
  }
  issues.append(li);
 }
 list("unknownPoints",guidance.uncertain);
 show("nextStepsGroup",guidance.next.length>1);
 list("nextSteps",guidance.next.slice(1));
 $("nextPrompt").value=continuationPrompt(guidance,{repo});
 setText("promptStatus","");
 const summary=$("summary");summary.replaceChildren();
 const pills=[archive?archive.project.type:"Geen ZIP onderzocht",repo?repo.name:"Geen repository bevestigd"];
 pills.forEach(label=>{const span=document.createElement("span");span.textContent=label;summary.append(span);});
 list("observations",advice.observations);
 setText("purposeTitle",purpose?.label||"Wat wil je bereiken?");
 show("purposeAim",Boolean(purpose?.aim));
 setText("purposeAim",purpose?.aim?"Jouw omschrijving (niet inhoudelijk getest): “"+purpose.aim+"”":"");
 const found=purpose?.found?.length?purpose.found:["In de bestanden is nog geen duidelijke aanwijzing gevonden."];
 const remaining=purpose?.remaining?.length?purpose.remaining:["De belangrijkste gebruikershandeling is nog niet getest."];
 setText("purposeQuickFound",found[0]);
 setText("purposeQuickRemaining",remaining[0]);
 list("purposeFound",found);
 list("purposeRemaining",remaining);
 const warnings=[...advice.warnings];if(repoError)warnings.unshift("GitHub: "+repoError);
 show("warningsGroup",warnings.length>0);list("warnings",warnings);
 setText("warningsTitle",warnings.length===1?"Bekijk 1 aandachtspunt":"Bekijk "+warnings.length+" aandachtspunten");
 $("warningsGroup").open=Boolean(archive?.secret?.length||archive?.missingReferences?.length||purpose?.repoOnlyZips);
 list("steps",advice.steps.slice(0,3));
 const additional=advice.steps.slice(3);
 list("moreSteps",additional);show("moreStepsGroup",additional.length>0);
 setText("moreStepsTitle",additional.length===1?"Bekijk de laatste stap":"Bekijk de overige "+additional.length+" stappen");
 list("limits",advice.limits);
 setText("planCount",advice.steps.length+" "+(advice.steps.length===1?"stap":"stappen"));
 const missing=advice.comparison?.missing||[];
 show("missingGroup",missing.length>0);
 setText("missingTitle",missing.length===1?"Dit bestand ontbreekt nog in GitHub":"Deze "+missing.length+" bestanden ontbreken nog in GitHub");
 list("missingFiles",missing);
 const repoLink=$("openRepo");
 show("openRepo",Boolean(repo?.url));
 if(repo?.url)repoLink.href=repo.url;
 const actionLink=$("openActions");
 show("openActions",Boolean(guidance.actionsUrl));
 if(guidance.actionsUrl)actionLink.href=guidance.actionsUrl;
 repoLink.firstChild.textContent=archive?.secret?.length||purpose?.repoOnlyZips?"Bekijk GitHub, upload nog niets ":"Open je GitHub-repository ";
 let firstTitle="Dit kun je nu doen";
 if(archive?.secret?.length)firstTitle="Controleer eerst je privébestanden";
 else if(guidance.problems.some(p=>p.title.includes("ZIP in GitHub")))firstTitle="Een ZIP op GitHub is nog geen project";
 else if(archive?.missingReferences?.length)firstTitle="Controleer de ontbrekende bestanden";
 else if(!archive)firstTitle="Bekijk eerst je ZIP-bestand";
 else if(!repo?.readable)firstTitle="Controleer je GitHub-repository";
 const firstText=guidance.next[0]||"Bekijk wat er is aangetroffen en bepaal de volgende stap.";
 setText("firstTitle",firstTitle);setText("firstText",firstText);
 setText("resultLead",archive&&repo?"We hebben je ZIP en de openbare GitHub-bestandslijst onderzocht.":"Dit is wat we konden vaststellen. De overige informatie ontbreekt of was niet bereikbaar.");
 $("downloadReadme").disabled=!archive;
 $("downloadIgnore").disabled=!archive;
 show("automationDetails",Boolean(generateProjectCheckWorkflow(archive)));
 setText("copyStatus","");
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
 state.goal=document.querySelector('input[name="goal"]:checked')?.value||"upload";
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
$("copyPrompt").addEventListener("click",async()=>{
 const prompt=$("nextPrompt").value;
 if(!prompt)return;
 try{
  await navigator.clipboard.writeText(prompt);
  setText("promptStatus","Opdracht gekopieerd.");
 }catch{setText("promptStatus","Kopiëren lukte niet. Selecteer de tekst hierboven.");}
});
$("copyReport").addEventListener("click",async()=>{
 if(!state.advice)return;
 const text=reportText({archive:state.archive,repo:state.repo,advice:state.advice,workerRuns:state.workerRuns});
 try{
  await navigator.clipboard.writeText(text);
  setText("copyStatus","Advies gekopieerd. Je kunt het nu plakken in een bericht of document.");
 }catch{
  setText("copyStatus","Kopiëren lukte niet. Het volledige advies blijft hierboven zichtbaar.");
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
