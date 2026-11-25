// Alleen publieke, brongebonden GitHub Actions-uitslagen voor het mobiele EAIgit-scherm.
// Geen OAuth, geen GitHub-schrijfrechten en geen opdracht aan de EAIwork-server.
const validSha=value=>typeof value==="string"&&/^[a-f0-9]{40}$/i.test(value);
const validRunUrl=value=>typeof value==="string"&&/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:actions\/runs\/\d+(?:\/job\/\d+)?|runs\/\d+)(?:\?.*)?$/.test(value);
const safeText=value=>String(value||"").replace(/[\r\n\t]/g," ").slice(0,120);
const conclusions={
 success:"Technische controle geslaagd",
 failure:"Technische controle mislukt",
 cancelled:"Geannuleerd",
 timed_out:"Afgebroken na tijdslimiet",
 skipped:"Overgeslagen",
 neutral:"Neutraal afgerond",
 action_required:"Actie nodig",
 stale:"Verouderd",
 startup_failure:"Starten mislukt"
};

export function githubChecksView(repo){
 if(!repo?.readable||typeof repo.url!=="string"||
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.url))
  return {visible:false,runs:[]};
 const actionsUrl=repo.url+"/actions";
 const checks=repo.actionChecks;
 const base={visible:true,actionsUrl,runs:[],headSha:null,verifiedWorking:false};
 if(checks?.revisionMismatch){
  return {...base,state:"uncertain",summary:"Bronversie niet bevestigd",explanation:"De branch is gewijzigd of kon niet aan de gelezen bestanden worden gekoppeld. Vernieuw de controle."};
 }
 if(!checks?.checked){
  return {...base,state:"unavailable",summary:"Niet vastgesteld",
   explanation:"Voor dit project konden we geen GitHub-controles uitlezen. Dit zegt niets over de werking."};
 }
 const runs=Array.isArray(checks.runs)?checks.runs:[];
 if(!runs.length&&checks.incomplete){
  return {...base,state:"partial",summary:"Nog niet volledig",explanation:"Niet alle relevante controles konden worden opgehaald."};
 }
 if(!runs.length){
  return {...base,state:"none",summary:"Geen specifieke controle",
   explanation:"Voor deze repositoryversie is geen EAIgit- of syntaxiscontrole aangetroffen. Je kunt de beschikbare workflows op GitHub bekijken."};
 }
 const headSha=validSha(checks.headSha)?checks.headSha.toLowerCase():null;
 if(!headSha){
  return {...base,state:"uncertain",summary:"Bronversie niet bevestigd",
   explanation:"De bijbehorende commit kon niet worden vastgesteld. Er wordt geen geslaagde controle geclaimd."};
 }
 const all=runs.map(run=>({
  name:safeText(run.name),
  status:run.status==="completed"&&conclusions[run.conclusion]?
   conclusions[run.conclusion]:"Nog niet afgerond of onbekende uitslag",
  passed:run.status==="completed"&&run.conclusion==="success",
  failed:run.status==="completed"&&["failure","timed_out","startup_failure","action_required"].includes(run.conclusion),
  url:validRunUrl(run.url)&&run.url.startsWith(repo.url+"/")?run.url:null
 }));
 const complete=all.length>0&&all.every(run=>run.passed)&&checks.incomplete===false;
 const failed=all.some(run=>run.failed);
 const shown=[...all].sort((a,b)=>Number(b.failed)-Number(a.failed)||Number(a.passed)-Number(b.passed)).slice(0,8);
 const count=all.length>shown.length?" "+shown.length+" van "+all.length+" gevonden controles zichtbaar.":"";
 return {...base,headSha,runs:shown,
  state:failed?"failed":complete?"checked":"partial",
  summary:failed?"Fout gemeld":complete?"Technische controles geslaagd":"Nog niet volledig",
  explanation:(failed?
   "GitHub meldt bij deze commit een mislukte controle of een controle die actie vraagt."+(checks.incomplete?" Niet alle controles zijn uitgelezen.":""):
   complete?
   "De gevonden EAIgit- en syntaxiscontroles zijn geslaagd. De werking van het project is hiermee niet getest.":
   "Niet alle gevonden controles zijn afgerond of volledig uitgelezen. De werking is niet vastgesteld.")+count};
}
