// Statische onderzoekslaag: bekijkt bestandstekst en verwijzingen, voert nooit projectcode uit.
// Alleen herleidbare bevindingen worden teruggegeven. Broncode wordt niet in het advies opgeslagen.
const TEXT_FILE=/\.(?:html?|css|[cm]?js|jsx|tsx?|json|vue|svelte|svg|py)$/i;
const FILE_TARGET=/\.(?:html?|css|[cm]?js|jsx|tsx?|json|png|jpe?g|gif|svg|webp|ico|avif|woff2?|ttf|otf|pdf|webm|mp4|mp3)$/i;
const SCRIPT_FILE=/\.(?:[cm]?js|jsx|tsx?|vue|svelte)$/i;
const numberLine=(text,offset)=>text.slice(0,offset).split("\n").length;
const safeLabel=value=>String(value||"").slice(0,160).replace(/[\r\n\t]/g," ");

export async function gitBlobId(bytes){
 if(!globalThis.crypto?.subtle)return null;
 const prefix=new TextEncoder().encode("blob "+bytes.byteLength+"\0");
 const data=new Uint8Array(prefix.length+bytes.byteLength);
 data.set(prefix);data.set(bytes,prefix.length);
 const hash=new Uint8Array(await globalThis.crypto.subtle.digest("SHA-1",data));
 return Array.from(hash,x=>x.toString(16).padStart(2,"0")).join("");
}
function resolveLocal(from,reference,files,script=false){
 let value=reference.trim().split(/[?#]/,1)[0];
 if(!value||/^(?:[a-z][\w+.-]*:|\/\/|#|\?|@)/i.test(value)||/[{}]/.test(value))return null;
 try{value=decodeURIComponent(value);}catch{return null;}
 if(value.includes("\\")||value.includes("\0"))return null;
 const parts=value.startsWith("/")?[]:from.split("/").slice(0,-1);
 for(const part of value.split("/")){
  if(!part||part===".")continue;
  if(part===".."){if(!parts.length)return null;parts.pop();}
  else parts.push(part);
 }
 const found=parts.join("/");
 if(!found)return null;
 // Bundlers kunnen imports zonder extensie of via een index-bestand afhandelen.
 const candidates=script&&!/\.[a-z0-9]+$/i.test(found)
   ?[found,...["js","mjs","cjs","jsx","ts","tsx","json"].map(x=>found+"."+x),
      ...["js","mjs","cjs","jsx","ts","tsx"].map(x=>found+"/index."+x)]
   :[found];
 return {path:found,exists:candidates.some(x=>files.has(x)),
  relevant:script||FILE_TARGET.test(found),generated:found.startsWith("_next/")||found.startsWith("build/")};
}
function references(path,text){
 const found=[];
 function extract(re,kind,group){
  let m;while((m=re.exec(text))&&found.length<160){
   const raw=Array.isArray(group)?group.map(i=>m[i]).find(Boolean)||"":m[group]||"";if(raw)found.push({raw,kind,line:numberLine(text,m.index)});
  }
 }
 if(/\.html?$/i.test(path)){
  extract(/\b(?:src|href|poster)\s*=\s*(["'])([^"'<>]+)\1/gi,"html",2);
 }
 if(/\.css$/i.test(path)){
  extract(/\burl\s*\(\s*(?:["']([^"']+)["']|([^)]{1,240}))\s*\)/gi,"css",[1,2]);
  extract(/@import\s+(?:url\s*\(\s*)?["']([^"']+)["']/gi,"css",1);
 }
 if(SCRIPT_FILE.test(path)){
  extract(/\b(?:from\s*|import\s*|require\s*\(\s*|import\s*\(\s*)(["'])(\.{1,2}\/[^"'\s]+)\1/g,"script",2);
  extract(/\bnew\s+URL\s*\(\s*(["'])(\.{1,2}\/[^"']+)\1/g,"script",2);
 }
 return found;
}
const SIGNALS={
 exercise:/\b(?:oefening(?:en)?|oefen(?:en)?|exercise|exercises|quiz|vragen|question|vragenlijst|nakijken|antwoord(?:en)?|answer|score|feedback)\b/i,
 forms:/\b(?:formulier(?:en)?|form|submit|aanmeld(?:en|ing)|registratie|contactformulier|sendmessage)\b/i,
 charts:/\b(?:grafiek(?:en)?|chart|plot|visualisatie|simulatie|simulation|canvas|webgl|three\.js|d3\.)\b/i,
 search:/\b(?:zoeken|zoekveld|search|filteren|filter|query)\b/i,
 login:/\b(?:inloggen|login|sign.?in|authenticate|session|wachtwoord|password)\b/i
};

// Vindt onderdelen die bij een gebruikersdoel zouden kunnen horen.
// Dit zijn statische aanwijzingen, geen bewijs dat een functie werkt.
const FEATURE_HINTS={
 exercise:[
  ["opgaven of vragen",/\b(?:vraag|vragen|question|questions|exercise|opgave|quiz|oefening|exerciseItems)\b/i],
  ["antwoord invoeren",/<(?:input|select|textarea)\b|\b(?:userAnswer|inputAnswer|antwoord|answers?)\b/i],
  ["antwoord controleren",/\b(?:checkAnswer|validateAnswer|isCorrect|correctAnswer|correctAnswers|nakijken|controleerAntwoord)\b/i],
  ["feedback tonen",/\b(?:feedback|showFeedback|toonFeedback|correct|incorrect)\b/i],
  ["score of resultaat",/\b(?:score|result(?:aat)?|uitslag|punten|correctCount|totaalGoed)\b/i]
 ],
 forms:[
  ["invoervelden",/<(?:input|textarea|select)\b/i],
  ["invoer valideren",/\b(?:required|pattern|validate|checkValidity|validatie)\b/i],
  ["verzenden",/\b(?:submit|fetch\s*\(|sendForm|verzenden|versturen)\b/i],
  ["bevestiging",/\b(?:confirmation|success|bevestiging|gelukt|bedankt)\b/i]
 ],
 charts:[
  ["invoer of parameters",/\b(?:parameter|slider|range|input|instel|waarde)\b/i],
  ["berekeningscode",/\b(?:calculate|compute|bereken|Math\.[a-z]+|formula|equation)\b/i],
  ["grafiek of animatie",/\b(?:chart|plot|grafiek|requestAnimationFrame|canvas|three\.js)\b/i],
  ["meetwaarde of resultaat",/\b(?:measure|meetwaarde|result|waarde|output)\b/i]
 ],
 search:[
  ["zoekinvoer",/\b(?:search|zoeken|zoekveld|query|zoekterm)\b/i],
  ["filterlogica",/\b(?:filter\s*\(|filterResult|filtered|match|includes\s*\()\b/i],
  ["resultaatweergave",/\b(?:results?|resultaten|searchResults|gevonden)\b/i]
 ],
 login:[
  ["inlogformulier",/\b(?:login|inloggen|signin|signIn)\b/i],
  ["sessie of toegang",/\b(?:session|sessie|token|auth|autorisatie)\b/i],
  ["afmelden",/\b(?:logout|signOut|afmelden|uitloggen)\b/i]
 ]
};
export function inspectFeatureHints(records){
 const out={};
 for(const [id,checks] of Object.entries(FEATURE_HINTS)){
  const found=[],notSeen=[];
  for(const [label,re] of checks){
   const paths=records.filter(x=>/\.(?:html?|[cm]?js|jsx|tsx?|vue|svelte|py)$/i.test(x.path)&&re.test(x.text)).slice(0,3).map(x=>x.path);
   if(paths.length)found.push({label,paths});
   else notSeen.push(label);
  }
  out[id]={found,notSeen,checkedFiles:records.length,verifiedWorking:false};
 }
 return out;
}

export function inspectProjectTexts(records,paths){
 const files=new Set(paths),issues=[],signals=Object.fromEntries(Object.keys(SIGNALS).map(x=>[x,[]]));
 let referenceChecks=0,jsonChecks=0;
 for(const record of records){
  const {path,text}=record;
  if(!TEXT_FILE.test(path)||typeof text!=="string")continue;
  for(const [name,re] of Object.entries(SIGNALS)){
   if(re.test(text)&&signals[name].length<5)signals[name].push(path);
  }
  if(/\.json$/i.test(path)){
   jsonChecks++;
   try{JSON.parse(text);}
   catch(error){
    const m=String(error.message||"").match(/(?:position|at)\s+(\d+)/i);
    const line=m?numberLine(text,Math.max(0,Number(m[1]))):null;
    issues.push({type:"invalid-json",severity:"attention",path,line,title:"Ongeldige JSON",
     detail:"Dit bestand kan niet als geldige JSON worden gelezen. Controleer de opbouw en leestekens."});
   }
  }
  for(const ref of references(path,text)){
   if(referenceChecks++>=320||issues.length>=32)break;
   const target=resolveLocal(path,ref.raw,files,ref.kind==="script");
   if(!target||!target.relevant||target.exists)continue;
   issues.push({type:"missing-reference",severity:"attention",path,line:ref.line,target:target.path,
    title:"Lokaal bestand niet gevonden",
    detail:"Verwijzing naar '"+safeLabel(ref.raw)+"' staat niet in de aangeleverde projectbestanden. Mogelijk ontstaat deze verwijzing tijdens het bouwen."});
  }
  if(issues.length>=32)break;
 }
 return {schema:"eaigit/content-check-v1",checkedFiles:records.length,jsonChecks,referenceChecks,
  findings:issues.slice(0,32),signals,features:inspectFeatureHints(records),executesProjectCode:false,
  incomplete:issues.length>=32||referenceChecks>=320};
}
// Pas een syntactische/structurele analyse toe zonder projectcode uit te voeren.
// Laad de parser pas op aanvraag, niet al bij de start van de EAIgit-wizard.
export async function appendStaticAudit(result,records,paths,options={}){
 const {inspectStaticProject}=await import("./static-audit.mjs");
 const audit=inspectStaticProject(records,paths,options);
 result.audit=audit;
 const seen=new Set(result.findings.map(f=>[f.type,f.path,f.line,f.target].join("|")));
 for(const item of audit.findings){
  const key=[item.type,item.path,item.line,item.target].join("|");
  if(seen.has(key))continue;
  if(result.findings.length>=32){result.incomplete=true;break;}
  result.findings.push(item);seen.add(key);
 }
 result.incomplete=result.incomplete||audit.incomplete;
 return result;
}

const GOALS=[
 {id:"exercise",re:/\b(?:oefen(?:en|ing|ingen)?|quiz|vragen|toets(?:en|vragen)?|exercise|questions?|antwoorden|nakijken)\b/i,
  title:"Controleer de oefeningen",
  action:"Open een oefening, geef een goed en een fout antwoord, controleer de feedback en kijk of het resultaat correct wordt bijgehouden."},
 {id:"forms",re:/\b(?:formulier|aanmeld(?:en|ing)|inschrijv(?:en|ing)|contact|registr(?:eren|atie)|submit)\b/i,
  title:"Controleer het formulier",
  action:"Vul het formulier correct en onjuist in. Controleer foutmeldingen, verzending en de bevestiging voor de bezoeker."},
 {id:"charts",re:/\b(?:grafiek|bereken(?:en|ing)|simulat(?:ie|or)|meetwaarde|visualis(?:atie|eren)|chart|simulation)\b/i,
  title:"Controleer de berekening en de weergave",
  action:"Verander een invoerwaarde en controleer of de berekening, grafiek, animatie en getoonde meetwaarde met elkaar overeenkomen."},
 {id:"search",re:/\b(?:zoek(?:en|functie|veld)?|filter(?:en)?|search)\b/i,
  title:"Controleer zoeken en filteren",
  action:"Zoek naar een bekend resultaat, naar iets dat niet bestaat en met een lege zoekterm. Controleer of de resultaten kloppen."},
 {id:"login",re:/\b(?:inlog(?:gen)?|aanmeld(?:en|ing)|account|wachtwoord|auth(?:enticatie)?|login)\b/i,
  title:"Controleer de toegang",
  action:"Test met een geschikt testaccount of aanmelden, afmelden en toegang tot afgeschermde onderdelen werken. Gebruik geen echte wachtwoorden in deze controle."}
];
export function goalTestFromAim(aim,signals={}){
 const text=String(aim||"").trim();
 if(!text)return null;
 const selected=GOALS.find(x=>x.re.test(text));
 if(!selected)return {id:"general",title:"Controleer jouw eigen doel",
  action:"Voer als bezoeker de belangrijkste handeling uit die je beschrijft en controleer of het resultaat overeenkomt met je bedoeling.",
  evidence:[],tested:false};
 return {id:selected.id,title:selected.title,action:selected.action,
  evidence:Array.isArray(signals?.[selected.id])?signals[selected.id].slice(0,5):[],tested:false};
}

const REPO_TEXT=/\.(?:html?|css|[cm]?js|jsx|tsx?|json|vue|svelte|py)$/i;
const REPO_PRIVATE=/(^|\/)(?:\.env(?:\..+)?|id_(?:rsa|ed25519)|[^/]+\.pem|credentials?\.[^/]*|secrets?\.[^/]*)$/i;
const REPO_IGNORE=/(^|\/)(?:node_modules|vendor|coverage|\.git|\.next|\.venv)\/|(^|\/)(?:package-lock|pnpm-lock|yarn\.lock)(?:\.json)?$/i;
const rankFile=p=>p==="index.html"?0:p==="package.json"?1:p==="public/index.html"?2:
 /(^|\/)(?:main|app|index)\.[cm]?[jt]sx?$/i.test(p)?3:/\.html?$/i.test(p)?4:/\.css$/i.test(p)?5:6;
// Alleen publieke, korte GitHub-blobs, met extra hashcontrole. Geen willekeurige downloadlinks.
export async function inspectPublicBlobs(api,entries,paths,fetcher,headers){
 const candidates=entries.filter(x=>x.type==="blob"&&REPO_TEXT.test(x.path)&&
  Number.isSafeInteger(x.size)&&x.size<=100000&&x.size>=0&&
  /^[a-f0-9]{40}$/i.test(x.sha||"")&&!REPO_PRIVATE.test(x.path)&&!REPO_IGNORE.test(x.path))
  .sort((a,b)=>rankFile(a.path)-rankFile(b.path)||a.path.localeCompare(b.path));
 const selected=candidates.slice(0,6),records=[];
 const checks=await Promise.allSettled(selected.map(async(entry)=>{
  const response=await fetcher(api+"/git/blobs/"+entry.sha,{
   headers,redirect:"error",signal:AbortSignal.timeout(8500)});
  if(!response.ok)return null;
  const data=await response.json();
  if(data.encoding!=="base64"||typeof data.content!=="string"||data.size!==entry.size||
   data.content.length>150000||typeof atob!=="function")return null;
  const bytes=Uint8Array.from(atob(data.content.replace(/\s/g,"")),x=>x.charCodeAt(0));
  if(bytes.length!==entry.size||await gitBlobId(bytes)!==entry.sha.toLowerCase())return null;
  return {path:entry.path,text:new TextDecoder("utf-8",{fatal:true}).decode(bytes)};
 }));
 for(const check of checks){if(check.status==="fulfilled"&&check.value)records.push(check.value);}
 const result=inspectProjectTexts(records,paths);
 await appendStaticAudit(result,records,paths);
 result.incomplete=result.incomplete||records.length<candidates.length;
 result.notInspectedCount=Math.max(0,candidates.length-records.length);
 result.source="github-public-blobs";
 return result;
}

// Publieke GitHub Checks horen bij de huidige branch. Alleen EAIgit-annotaties
// mogen als bewezen syntaxfouten in de wizard verschijnen; een groen vinkje bewijst geen werking.
export async function fetchPublicChecks(api,commitSha,paths,fetcher,headers){
 const result={checked:false,headSha:null,runs:[],syntaxErrors:[],incomplete:false,annotationsIncomplete:false};
 if(!/^[a-f0-9]{40}$/i.test(commitSha||""))return result;
 const sha=commitSha.toLowerCase(),pageSize=100,maxPages=3,deadline=Date.now()+8500;
 const request=async url=>{
  const remaining=deadline-Date.now();
  if(remaining<=0)throw Error("GitHub check time budget exceeded");
  const response=await fetcher(url,{headers,redirect:"error",signal:AbortSignal.timeout(remaining)});
  if(!response.ok)throw Error("GitHub check request failed");
  return response.json();
 };
 const relevant=[],seen=new Set();
 let total=null,received=0;
 for(let page=1;page<=maxPages;page++){
  let data;
  try{data=await request(api+"/commits/"+sha+"/check-runs?per_page="+pageSize+"&page="+page+"&filter=latest");}
  catch{result.incomplete=true;break;}
  if(!Array.isArray(data?.check_runs)){result.incomplete=true;break;}
  result.checked=true;result.headSha=sha;
  if(!Number.isSafeInteger(data.total_count)||data.total_count<0){
   result.incomplete=true;
  }else if(total===null){total=data.total_count;}
  else if(total!==data.total_count){result.incomplete=true;}
  if(data.check_runs.length>pageSize)result.incomplete=true;
  received+=data.check_runs.length;
  for(const run of data.check_runs){
   if(!run||!Number.isSafeInteger(run.id)||run.id<=0||seen.has(run.id)){
    result.incomplete=true;continue;
   }
   seen.add(run.id);
   if(typeof run.name!=="string"||!run.name.trim()||typeof run.head_sha!=="string"||run.head_sha.toLowerCase()!==sha){
    result.incomplete=true;continue;
   }
   if(/EAIgit|projectcontrole|project.?engine|syntax|syntaxis/i.test(run.name))relevant.push(run);
  }
  if(total===null||received>=total||data.check_runs.length<pageSize)break;
 }
 if(total===null||received!==total||seen.size!==received)result.incomplete=true;
 const known=["success","failure","cancelled","timed_out","skipped","neutral","action_required","stale","startup_failure"];
 const safeUrl=value=>typeof value==="string"&&/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:actions\/runs\/\d+(?:\/job\/\d+)?|runs\/\d+)(?:\?[^#\s]*)?$/.test(value)&&value.toLowerCase().startsWith(api.replace("https://api.github.com/repos/","https://github.com/").toLowerCase()+"/")?value:null;
 result.runs=relevant.map(run=>({id:run.id,name:safeLabel(run.name),status:run.status==="completed"?"completed":"pending",
  conclusion:known.includes(run.conclusion)?run.conclusion:null,url:safeUrl(run.html_url)}));
 // All returned checks count towards the verdict; annotations have a separate bounded budget.
 const failed=relevant.filter(x=>x.status==="completed"&&x.conclusion==="failure");
 if(failed.length>3)result.annotationsIncomplete=true;
 const permitted=new Set(paths);
 for(const check of failed.slice(0,3)){
  let annotations;
  try{annotations=await request(api+"/check-runs/"+check.id+"/annotations?per_page=100");}
  catch{result.annotationsIncomplete=true;continue;}
  if(!Array.isArray(annotations)){result.annotationsIncomplete=true;continue;}
  if(annotations.length>=100||(Number.isSafeInteger(check.output?.annotations_count)&&check.output.annotations_count>annotations.length))result.annotationsIncomplete=true;
  for(const x of annotations){
   if(!x||x.title!=="EAIgit syntaxis"||!permitted.has(x.path))continue;
   const line=Number.isSafeInteger(x.start_line)&&x.start_line>0?x.start_line:null;
   result.syntaxErrors.push({path:x.path,line,title:"Syntaxisfout gemeld door GitHub Actions",
    detail:"GitHub Actions meldt een syntaxisfout voor dit bestand. De uitgevoerde controle is niet onafhankelijk herhaald.",checkUrl:safeUrl(check.html_url)});
   if(result.syntaxErrors.length>=30){result.annotationsIncomplete=true;return result;}
  }
 }
 return result;
}

export function inspectFileSignature(path,bytes){
 const required={
  png:[137,80,78,71,13,10,26,10],
  pdf:[37,80,68,70,45],
  jpg:[255,216,255],
  jpeg:[255,216,255],
  gif:[71,73,70,56],
  webp:[82,73,70,70]
 };
 const ext=String(path).split(".").pop().toLowerCase(),signature=required[ext];
 if(!signature||signature.every((n,i)=>bytes[i]===n)&&
  (ext!=="webp"||[87,69,66,80].every((n,i)=>bytes[i+8]===n)))return null;
 return {type:"format-mismatch",severity:"attention",path,line:null,title:"Bestandsformaat klopt niet",
  detail:"De inhoud heeft niet de verwachte bestandskop voor een ."+ext+"-bestand. Controleer of het beschadigd of verkeerd benoemd is."};
}
