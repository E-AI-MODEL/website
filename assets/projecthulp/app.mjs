import {analyzeArchive,fetchPublicRepo,makeAdvice,reportText,readmeTemplate,ignoreTemplate,parseRepoUrl} from "./analyse.mjs";
const $=(id)=>document.getElementById(id);
const state={archive:null,repo:null,advice:null,goal:"site",aim:"",experience:"beginner",repoError:null};
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
 repoLink.firstChild.textContent=archive?.secret?.length||purpose?.repoOnlyZips?"Bekijk GitHub, upload nog niets ":"Open je GitHub-repository ";
 let firstTitle="Bekijk je volgende stap",firstText=advice.steps[0]||"Vul je gegevens aan om verder te gaan.";
 if(archive?.secret.length){
  firstTitle="Controleer eerst je privébestanden";
  firstText=archive.secret.length===1?"Eén bestand heeft mogelijk vertrouwelijke inhoud. Controleer het op je eigen apparaat. Upload het pas als je zeker weet dat het openbaar mag zijn.":"Er zijn "+archive.secret.length+" bestanden met mogelijk vertrouwelijke inhoud. Controleer ze op je eigen apparaat. Upload ze niet voordat je zeker weet dat ze openbaar mogen zijn.";
 }else if(purpose?.repoOnlyZips){
  firstTitle="Een ZIP op GitHub is nog geen project";
  firstText="GitHub bewaart je ZIP als één bestand. Pak het ZIP-bestand op je eigen apparaat uit en voeg de losse projectbestanden toe. Controleer eerst wat je daarvan openbaar wilt maken.";
 }else if(purpose?.goal==="site"&&archive&&!archive.project.hasHtml){
  firstTitle="Zoek eerst de startpagina";
  firstText="We hebben geen HTML-startbestand in de onderzochte projectbestanden gevonden. Controleer welke bestanden de website moeten opbouwen voordat je ze publiceert.";
 }else if(purpose?.goal==="site"&&archive?.missingReferences?.length){
  firstTitle="Controleer de ontbrekende bestanden";
  firstText="De startpagina verwijst naar bestanden die niet op de verwachte plek in het ZIP-bestand staan. Herstel die verwijzingen voordat je van een werkende website uitgaat.";
 }else if(archive&&repo?.readable){
  firstTitle="Pak je ZIP uit, niet als één bestand uploaden";
  firstText="GitHub pakt een ZIP-bestand niet automatisch uit. Pak het op je apparaat uit. Controleer de projectbestanden en voeg vervolgens alleen de juiste bestanden in de juiste mappen aan GitHub toe.";
 }else if(archive&&!repo){
  firstTitle="Voeg je GitHub-link toe";
  firstText="We hebben je ZIP bekeken. Vul nu de link naar je openbare repository in, zodat we kunnen vergelijken wat er nog ontbreekt.";
 }else if(repo&&!archive){
  firstTitle="Voeg je ZIP-bestand toe";
  firstText="We kunnen je openbare repository bereiken. Kies nu je ZIP-bestand om te ontdekken wat er ontbreekt.";
 }
 setText("firstTitle",firstTitle);setText("firstText",firstText);
 setText("resultLead",archive&&repo?"We hebben je ZIP en de openbare GitHub-bestandslijst onderzocht.":"Dit is wat we konden vaststellen. De overige informatie ontbreekt of was niet bereikbaar.");
 $("downloadReadme").disabled=!archive;
 $("downloadIgnore").disabled=!archive;
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
 state.experience=$("experience").value;
 state.aim=$("projectAim").value.trim().slice(0,220);
 $("analyze").disabled=true;show("loading",true);setText("loadingText","We controleren je bestanden…");
 try{
  state.archive=null;state.repo=null;state.repoError=null;
  if(file){
   try{state.archive=await analyzeArchive(file);}
   catch(error){setText("inputError",error?.message||"Het ZIP-bestand kon niet worden gelezen.");show("inputError",true);return;}
  }
  if(url){
   setText("loadingText","We halen de openbare bestandslijst op bij GitHub…");
   try{state.repo=await fetchPublicRepo(url);}catch(error){state.repoError=error?.message||"GitHub kon niet worden gecontroleerd.";}
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
$("downloadReport").addEventListener("click",()=>{
 if(!state.advice)return;
 const text=reportText({archive:state.archive,repo:state.repo,advice:state.advice});
 download("mijn-github-stappenplan.md",text);
});
$("downloadReadme").addEventListener("click",()=>{if(state.archive)download("README.md",readmeTemplate(state.archive,state.repo?.name));});
$("downloadIgnore").addEventListener("click",()=>{if(state.archive)download("gitignore-voorbeeld.txt",ignoreTemplate(state.archive));});
$("reset").addEventListener("click",()=>{
 $("zipFile").value="";$("repoUrl").value="";setText("fileName","Kies een ZIP om te onderzoeken");show("inputError",false);
 for(const key of ["archive","repo","advice","repoError"])state[key]=null;
 document.querySelector('input[name="goal"][value="site"]').checked=true;$("experience").value="beginner";$("projectAim").value="";state.aim="";screen(1);
});
