import {PROMPT_PHASES,PROMPT_LIBRARY,promptsForPhase,fillPrompt} from "./prompts-data.mjs";

const $=id=>document.getElementById(id);
const filters=$("promptFilters"),list=$("promptList"),workspace=$("promptWorkspace");
const query=new URLSearchParams(location.search);
const requested=query.get("fase");
const requestedTask=query.get("taak");
let currentPhase=PROMPT_PHASES.some(p=>p.id===requested)?requested:"alle";
let selected=null;
let edited=false;
let lastTrigger=null;
const node=(tag,cls="",text="")=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text)el.textContent=text;
 return el;
};
const phaseName=id=>PROMPT_PHASES.find(p=>p.id===id)?.label||id;
const project=()=>({repo:$("promptRepo").value,goal:$("promptGoal").value});
const isNarrow=()=>window.matchMedia("(max-width: 840px)").matches;
const selectionIsVisible=()=>!$("selectedPrompt").classList.contains("eg-hidden");
function matchingPrompts(){
 const search=$("promptSearch").value.trim().toLocaleLowerCase("nl");
 const entries=promptsForPhase(currentPhase);
 if(!search)return entries;
 return entries.filter(p=>[p.title,p.forWhom,p.outcome,p.phase,p.body]
  .some(value=>String(value||"").toLocaleLowerCase("nl").includes(search)));
}
function drawFilters(){
 filters.replaceChildren();
 for(const phase of [{id:"alle",label:"Alles"},...PROMPT_PHASES]){
  const btn=node("button","eg-filter"+(phase.id===currentPhase?" active":""),phase.label);
  btn.type="button";
  btn.dataset.phase=phase.id;
  btn.setAttribute("aria-pressed",String(phase.id===currentPhase));
  btn.addEventListener("click",()=>{
   currentPhase=phase.id;
   workspace.classList.remove("eg-dashboard-mobile-detail");
   drawFilters();
   drawCards();
  });
  filters.append(btn);
 }
}
function drawCards(){
 const entries=matchingPrompts();
 list.replaceChildren();
 $("promptCount").textContent=entries.length+" "+(entries.length===1?"opdracht":"opdrachten");
 $("promptEmpty").classList.toggle("eg-hidden",entries.length>0);
 for(const [i,p] of entries.entries()){
  const button=node("button","eg-prompt-card");
  button.type="button";
  button.dataset.promptId=p.id;
  button.setAttribute("aria-label",p.title+". "+p.forWhom);
  button.append(node("span","eg-prompt-index",String(i+1).padStart(2,"0")));
  const text=node("span","eg-prompt-info");
  text.append(node("strong","",p.title));
  text.append(node("span","eg-prompt-for",p.forWhom));
  button.append(text);
  button.append(node("span","eg-prompt-next","→"));
  button.addEventListener("click",()=>selectPrompt(p.id,{openOnMobile:true,trigger:button}));
  list.append(button);
 }
 const keep=entries.find(p=>p.id===selected?.id);
 if(entries.length)selectPrompt((keep||entries[0]).id,{openOnMobile:false});
 else{
  selected=null;
  $("selectedPrompt").classList.add("eg-hidden");
  workspace.classList.remove("eg-dashboard-mobile-detail");
 }
}
function selectPrompt(id,{openOnMobile=false,trigger=null}={}){
 const p=PROMPT_LIBRARY.find(item=>item.id===id);
 if(!p)return;
 if(trigger)lastTrigger=trigger;
 const changed=selected?.id!==id;
 selected=p;
 $("selectedTitle").textContent=p.title;
 $("selectedUse").textContent=p.forWhom;
 $("selectedPhase").textContent=phaseName(p.phase)+" / Opdracht";
 $("selectedOutcome").textContent=p.outcome;
 if(changed||!selectionIsVisible()){
  $("selectedBody").value=fillPrompt(p,project());
  edited=false;
 }
 $("promptChanged").classList.add("eg-hidden");
 $("copyFeedback").textContent="";
 $("selectedPrompt").classList.remove("eg-hidden");
 for(const button of list.querySelectorAll("[data-prompt-id]")){
  const active=button.dataset.promptId===id;
  button.classList.toggle("selected",active);
  button.setAttribute("aria-current",String(active));
 }
 if(openOnMobile&&isNarrow()){
  workspace.classList.add("eg-dashboard-mobile-detail");
  $("selectedPrompt").scrollIntoView({behavior:"instant",block:"start"});
  $("selectedTitle").setAttribute("tabindex","-1");
  $("selectedTitle").focus({preventScroll:true});
 }
}
function handleProjectChange(){
 if(!selected)return;
 if(edited){$("promptChanged").classList.remove("eg-hidden");return;}
 $("selectedBody").value=fillPrompt(selected,project());
}
function restore(){
 if(!selected)return;
 $("selectedBody").value=fillPrompt(selected,project());
 edited=false;
 $("promptChanged").classList.add("eg-hidden");
 $("copyFeedback").textContent="De oorspronkelijke opdracht is hersteld met je huidige projectgegevens.";
}
$("promptSearch").addEventListener("input",()=>{
 workspace.classList.remove("eg-dashboard-mobile-detail");
 drawCards();
});
$("promptRepo").addEventListener("input",handleProjectChange);
$("promptGoal").addEventListener("input",handleProjectChange);
$("selectedBody").addEventListener("input",()=>{
 edited=true;
 $("copyFeedback").textContent="";
});
$("restoreSelected").addEventListener("click",restore);
$("copySelected").addEventListener("click",async()=>{
 if(!selected)return;
 try{
  await navigator.clipboard.writeText($("selectedBody").value);
  $("copyFeedback").textContent="Opdracht gekopieerd.";
 }catch{
  $("copyFeedback").textContent="Kopiëren lukte niet. Selecteer de opdracht en kopieer de tekst zelf.";
 }
});
$("closePrompt").addEventListener("click",()=>{
 if(isNarrow()){
  workspace.classList.remove("eg-dashboard-mobile-detail");
  $("promptList").scrollIntoView({behavior:"instant",block:"start"});
  lastTrigger?.focus({preventScroll:true});
 }else{
  $("selectedPrompt").classList.add("eg-hidden");
  for(const button of list.querySelectorAll("[data-prompt-id]")){
   button.classList.remove("selected");
   button.setAttribute("aria-current","false");
  }
  selected=null;
 }
});
function suggestPrompt(id){
 const prompt=PROMPT_LIBRARY.find(item=>item.id===id);
 if(!prompt)return;
 currentPhase=prompt.phase;
 $("promptSearch").value="";
 workspace.classList.remove("eg-dashboard-mobile-detail");
 drawFilters();drawCards();
 selectPrompt(id,{openOnMobile:true});
 if(!isNarrow())$("selectedPrompt").scrollIntoView({behavior:"smooth",block:"start"});
}
for(const button of document.querySelectorAll("[data-suggest]"))
 button.addEventListener("click",()=>suggestPrompt(button.dataset.suggest));
drawFilters();
drawCards();
if(requestedTask)suggestPrompt(requestedTask);
