import {PROMPT_PHASES,PROMPT_LIBRARY,promptsForPhase,fillPrompt} from "./prompts-data.mjs";
const $=id=>document.getElementById(id);
const filters=$("promptFilters"),list=$("promptList");
let currentPhase="alle",selected=null;
const node=(tag,cls="",text="")=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
const phaseName=(id)=>PROMPT_PHASES.find(p=>p.id===id)?.label||id;
const data=()=>({repo:$("promptRepo").value,goal:$("promptGoal").value});
function drawFilters(){
 filters.replaceChildren();
 for(const p of [{id:"alle",label:"Alles"},...PROMPT_PHASES]){
  const btn=node("button","eg-filter"+(p.id===currentPhase?" active":""),p.label);
  btn.type="button";btn.dataset.phase=p.id;btn.setAttribute("aria-pressed",String(p.id===currentPhase));
  btn.addEventListener("click",()=>{currentPhase=p.id;drawFilters();drawCards();});
  filters.append(btn);
 }
}
function drawCards(){
 list.replaceChildren();
 const shown=promptsForPhase(currentPhase);
 $("promptCount").textContent=shown.length+" "+(shown.length===1?"opdracht":"opdrachten");
 for(const p of shown){
  const button=node("button","eg-prompt-card");
  button.type="button";button.dataset.promptId=p.id;
  button.append(node("span","eg-prompt-phase",phaseName(p.phase)));
  button.append(node("strong","",p.title));
  button.append(node("span","eg-prompt-for",p.forWhom));
  button.append(node("span","eg-prompt-next","Bekijk de opdracht →"));
  button.addEventListener("click",()=>selectPrompt(p.id));
  list.append(button);
 }
}
function selectPrompt(id){
 const p=PROMPT_LIBRARY.find(x=>x.id===id);
 if(!p)return;
 selected=p;
 $("selectedTitle").textContent=p.title;
 $("selectedUse").textContent=p.forWhom;
 $("selectedPhase").textContent=phaseName(p.phase);
 $("selectedBody").value=fillPrompt(p,data());
 $("copyFeedback").textContent="";
 $("selectedPrompt").classList.remove("eg-hidden");
 for(const btn of list.querySelectorAll("[data-prompt-id]"))btn.classList.toggle("selected",btn.dataset.promptId===id);
 $("selectedPrompt").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
 $("selectedTitle").setAttribute("tabindex","-1");$("selectedTitle").focus({preventScroll:true});
}
function refreshBody(){if(selected){$("selectedBody").value=fillPrompt(selected,data());$("copyFeedback").textContent="";}}
$("restoreSelected").addEventListener("click",refreshBody);
$("copySelected").addEventListener("click",async()=>{
 const text=$("selectedBody").value;
 try{await navigator.clipboard.writeText(text);$("copyFeedback").textContent="Opdracht gekopieerd.";}
 catch{$("copyFeedback").textContent="Kopiëren lukte niet. Selecteer de opdracht en kopieer hem zelf.";}
});
$("closePrompt").addEventListener("click",()=>{
 $("selectedPrompt").classList.add("eg-hidden");
 selected=null;
 for(const btn of list.querySelectorAll("[data-prompt-id]"))btn.classList.remove("selected");
});
drawFilters();drawCards();
