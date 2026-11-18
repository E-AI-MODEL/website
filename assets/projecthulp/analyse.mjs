import {inspectZip,readZipText,readZipBytes} from "./zip.mjs";
import {inspectProjectTexts,gitBlobId,inspectPublicBlobs,fetchPublicChecks,inspectFileSignature,appendStaticAudit} from "./inhoudscontrole.mjs";
import {checkProjectPurpose,findBrokenLocalLinks} from "./doelcontrole.mjs";
const REPO=/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;
const TEXT_LIMIT=350000;
export function parseRepoUrl(text){
 const m=REPO.exec(String(text||"").trim());
 if(!m||m[2].startsWith(".")||m[2].endsWith(".")||m[2].length>100)throw new Error("Vul de volledige repositorylink in, bijvoorbeeld https://github.com/gebruiker/project.");
 return {owner:m[1],repo:m[2],name:m[1]+"/"+m[2]};
}
export async function fetchPublicRepo(url,fetcher=fetch){
 const p=parseRepoUrl(url);
 const headers={Accept:"application/vnd.github+json"};
 const api="https://api.github.com/repos/"+encodeURIComponent(p.owner)+"/"+encodeURIComponent(p.repo);
 let response;
 try{response=await fetcher(api,{headers,redirect:"error",signal:AbortSignal.timeout(12000)});}
 catch{throw new Error("GitHub is niet bereikbaar. Controleer je verbinding of probeer later opnieuw.");}
 if(response.status===404)throw new Error("Deze repository is niet openbaar of bestaat niet. Privérepositories kunnen we zonder toestemming niet lezen.");
 if(response.status===403||response.status===429)throw new Error("GitHub weigert tijdelijk nieuwe verzoeken of de aanvraaglimiet is bereikt. Probeer later opnieuw.");
 if(!response.ok)throw new Error("GitHub gaf een foutmelding (HTTP "+response.status+").");
 let meta;try{meta=await response.json();}catch{throw new Error("GitHub gaf ongeldige repositorygegevens terug.");}
 if(meta.private===true)throw new Error("Deze repository is privé. De proef ondersteunt alleen openbare repositories.");
 if(meta.full_name?.toLowerCase()!==p.name.toLowerCase())throw new Error("GitHub antwoordde met een andere repository.");
 let paths=[],branch=meta.default_branch||null,sha=null,truncated=false,readable=true,blobs={},contentCheck=null,actionChecks=null;
 if(branch&&!(meta.size===0&&meta.pushed_at===null)){
  try{
   const treeResponse=await fetcher(api+"/git/trees/"+encodeURIComponent(branch)+"?recursive=1",{headers,redirect:"error",signal:AbortSignal.timeout(15000)});
   if(treeResponse.status===403||treeResponse.status===429)throw new Error("GitHub heeft de bestandslijst tijdelijk geblokkeerd.");
   if(!treeResponse.ok)throw new Error("De bestandslijst van GitHub is niet beschikbaar.");
   const tree=await treeResponse.json();
   if(!Array.isArray(tree.tree))throw new Error("GitHub gaf geen volledige bestandslijst terug.");
   sha=tree.sha||null;truncated=tree.truncated===true;
   const entries=tree.tree.filter(x=>x.type==="blob"&&typeof x.path==="string");
   paths=entries.map(x=>x.path);
   blobs=Object.fromEntries(entries.filter(x=>/^[a-f0-9]{40}$/i.test(x.sha||"")).slice(0,3500).map(x=>[x.path,x.sha]));
   try{contentCheck=await inspectPublicBlobs(api,entries,paths,fetcher,headers);}catch{contentCheck=null;}
  }catch(error){readable=false;return {name:meta.full_name,url:meta.html_url||"https://github.com/"+p.name,branch,paths,sha,truncated,readable,blobs,contentCheck,actionChecks,error:error.message,empty:false};}
 }
 if(paths.some(x=>x.startsWith(".github/workflows/"))){
  try{actionChecks=await fetchPublicChecks(api,branch,paths,fetcher,headers);}catch{actionChecks=null;}
 }
 return {name:meta.full_name,url:meta.html_url||"https://github.com/"+p.name,branch,paths,sha,truncated,readable,blobs,contentCheck,actionChecks,empty:!branch||paths.length===0};
}
export function stripArchiveRoot(paths){
 const eligible=paths.filter(Boolean);
 if(!eligible.length)return {prefix:"",paths:[]};
 const parts=eligible.map(p=>p.split("/"));
 const first=parts[0][0];
 if(parts.every(a=>a.length>1&&a[0]===first)&&!["src","public","docs","assets","dist","build"].includes(first.toLowerCase()))return {prefix:first+"/",paths:eligible.map(p=>p.slice(first.length+1))};
 return {prefix:"",paths:eligible};
}
const SECRETS=/(^|\/)(\.env(?:\..+)?|id_rsa(?:\.pub)?|id_ed25519(?:\.pub)?|[^/]*\.pem|[^/]*\.p12|[^/]*\.pfx|credentials?(?:\.[^/]*)?|secrets?\.(?:json|ya?ml)|config\.local\.[^/]*)$/i;
const JUNK=/(^|\/)(__MACOSX|node_modules|\.git|\.next|coverage|\.venv|venv|__pycache__|\.DS_Store|Thumbs\.db)(\/|$)/i;
const extension=(path)=>path.split("/").at(-1).split(".").pop().toLowerCase();
const includes=(set,name)=>set.has(name)||[...set].some(p=>p.endsWith("/"+name));
export function describeProject(paths,manifest={}){
 const s=new Set(paths),files=paths.length;
 let type="Bestanden of documentatie",runtime="Niet vastgesteld",framework=null;
 const html=paths.some(p=>p.toLowerCase().endsWith(".html")),js=paths.some(p=>/\.(js|mjs|jsx|ts|tsx)$/i.test(p));
 if(includes(s,"package.json")){
  type="JavaScript-project";runtime="Node.js / JavaScript";
  const dependencies={...(manifest.dependencies&&typeof manifest.dependencies==="object"?manifest.dependencies:{}),...(manifest.devDependencies&&typeof manifest.devDependencies==="object"?manifest.devDependencies:{})};
  for(const name of ["next","vite","react","vue","svelte","astro","angular","express"]){if(Object.hasOwn(dependencies,name)||manifest.name===name){framework=name;break;}}
  if(framework==="next")type="Next.js-applicatie";
  else if(framework==="vite")type="Vite-project";
  else if(framework==="react")type="React-project";
 }else if(includes(s,"requirements.txt")||includes(s,"pyproject.toml")){type="Python-project";runtime="Python";}
 else if(includes(s,"composer.json")){type="PHP-project";runtime="PHP";}
 else if(html){type="HTML-website";runtime=js?"HTML, CSS en JavaScript":"HTML en CSS";}
 return {type,runtime,framework,files,hasReadme:includes(s,"README.md")||includes(s,"README"),hasIgnore:includes(s,".gitignore"),hasLicense:includes(s,"LICENSE"),hasHtml:html,hasPackage:includes(s,"package.json"),hasTests:paths.some(p=>/(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[a-z]+$/i.test(p))};
}
export async function analyzeArchive(file){
 if(!file)throw new Error("Kies eerst je ZIP-bestand.");
 if(file.size>16*1024*1024)throw new Error("Dit ZIP-bestand is groter dan 16 MB.");
 const zip=inspectZip(await file.arrayBuffer());
 const rawFiles=zip.entries.filter(x=>!x.directory);
 const root=stripArchiveRoot(rawFiles.filter(x=>!JUNK.test(x.path)).map(x=>x.path));
 const paths=rawFiles.map(x=>x.path.startsWith(root.prefix)?x.path.slice(root.prefix.length):x.path).filter(Boolean);
 const ignored=paths.filter(p=>JUNK.test(p));
 const secret=paths.filter(p=>SECRETS.test(p));
 const eligible=paths.filter(p=>!JUNK.test(p)&&!SECRETS.test(p));
 const manifestEntry=rawFiles.find(e=>e.path===root.prefix+"package.json");
 let manifest={},manifestError=null;
 if(manifestEntry){
  try{manifest=JSON.parse(await readZipText(zip,manifestEntry,TEXT_LIMIT));if(!manifest||typeof manifest!=="object"||Array.isArray(manifest))throw new Error("geen geldig JSON-object");}
  catch(e){manifestError="package.json kon niet veilig worden gelezen: "+e.message;}
 }
 const project=describeProject(eligible,manifest && typeof manifest==="object" && !Array.isArray(manifest)?manifest:{});
 const htmlEntry=["index.html","public/index.html","dist/index.html","build/index.html"].map(path=>rawFiles.find(e=>e.path===root.prefix+path)).find(Boolean);
 let missingReferences=[],indexChecked=false,indexError=null;
 if(htmlEntry){
  try{
   const html=await readZipText(zip,htmlEntry,TEXT_LIMIT);
   missingReferences=findBrokenLocalLinks(htmlEntry.path.slice(root.prefix.length),html,eligible);
   indexChecked=true;
  }catch(error){indexError="De startpagina kon niet volledig worden nagekeken: "+error.message;}
 }
 const fingerprints={},textRecords=[],notInspected=[],formatFindings=[];let hashedBytes=0,textBytes=0;
 const available=new Set(eligible);
 // De ZIP wordt lokaal op bestandbytes vergeleken met GitHub-blobs, zonder upload of code-uitvoering.
 for(const entry of rawFiles){
  const path=entry.path.startsWith(root.prefix)?entry.path.slice(root.prefix.length):entry.path;
  if(!available.has(path))continue;
  const isText=/\.(?:html?|css|[cm]?js|jsx|tsx?|json|vue|svelte|svg|py)$/i.test(path);
  if(entry.size>600000||hashedBytes+entry.size>12*1024*1024){notInspected.push(path);continue;}
  try{
   const bytes=await readZipBytes(zip,entry,600000);
   hashedBytes+=bytes.byteLength;
   const formatFinding=inspectFileSignature(path,bytes);
   if(formatFinding&&formatFindings.length<12)formatFindings.push(formatFinding);
   const blobId=await gitBlobId(bytes);
   if(blobId)fingerprints[path]=blobId;
   if(isText){
    if(bytes.byteLength<=220000&&textBytes+bytes.byteLength<=1500000&&textRecords.length<100){
     try{
      textRecords.push({path,text:new TextDecoder("utf-8",{fatal:true}).decode(bytes)});
      textBytes+=bytes.byteLength;
     }catch{notInspected.push(path);}
    }else notInspected.push(path);
   }
  }catch{notInspected.push(path);}
 }
 const contentCheck=inspectProjectTexts(textRecords,eligible);
 await appendStaticAudit(contentCheck,textRecords,eligible,{manifest});
 contentCheck.findings.push(...formatFindings.slice(0,Math.max(0,32-contentCheck.findings.length)));
 contentCheck.notInspected=notInspected.slice(0,40);
 contentCheck.incomplete=contentCheck.incomplete||notInspected.length>0;
 return {name:file.name,archiveSize:file.size,files:paths,total:zip.total,prefix:root.prefix,eligible,ignored,secret,project,manifest,manifestError,missingReferences,indexChecked,indexError,fingerprints,contentCheck};
}
export function compareProjects(archive,repo){
 const existing=new Set(repo?.paths||[]);
 const missing=archive.eligible.filter(p=>!existing.has(p));
 const present=archive.eligible.filter(p=>existing.has(p));
 const onlyRepo=repo?.paths.filter(p=>!new Set(archive.eligible).has(p))||[];
 const identical=[],changed=[],unknown=[];
 for(const path of present){
  const zipHash=archive?.fingerprints?.[path],gitHash=repo?.blobs?.[path];
  if(!zipHash||!gitHash)unknown.push(path);
  else if(zipHash===gitHash)identical.push(path);
  else changed.push(path);
 }
 return {missing,present,onlyRepo,matched:present.length,missingCount:missing.length,
  identical,changed,unknown,comparedCount:identical.length+changed.length};
}
function line(text){return text.replace(/\r/g,"").replace(/\n{3,}/g,"\n\n");}
const countText=(n,one,many)=>n+" "+(n===1?one:many);
export function makeAdvice({goal="code",experience="beginner",archive,repo,aim=""}){
 const selectedGoal=({upload:"code",maintain:"code",publish:"site"})[goal]||goal;
 const purpose=checkProjectPurpose({goal:selectedGoal,archive,repo,aim});
 const observations=[],warnings=[],steps=[];
 if(archive){
  observations.push("Het ZIP-bestand bevat "+countText(archive.files.length,"bestand","bestanden")+" ("+archive.project.type+").");
  if(archive.prefix)observations.push("De bestanden zitten in een bovenliggende map '"+archive.prefix.slice(0,-1)+"'. Voor GitHub kan die map meestal worden weggelaten.");
  if(archive.ignored.length)warnings.push(archive.ignored.length===1?"Eén bestand of map lijkt tijdelijk of overbodig voor GitHub. Controleer dit voor het uploaden.":archive.ignored.length+" bestanden of mappen lijken tijdelijk of overbodig voor GitHub. Controleer deze voor het uploaden.");
  if(archive.secret.length)warnings.push(countText(archive.secret.length,"bestand heeft","bestanden hebben")+" een mogelijk vertrouwelijke naam. Controleer de inhoud op je eigen apparaat voordat je iets uploadt.");
  if(archive.manifestError)warnings.push(archive.manifestError);
  if(archive.indexError)warnings.push(archive.indexError);
  if(archive.missingReferences?.length)warnings.push("De startpagina verwijst naar "+archive.missingReferences.length+" lokaal bestand(en) dat niet op de verwachte plek staat: "+archive.missingReferences.slice(0,4).join(", ")+".");
 }else warnings.push("Er is geen ZIP onderzocht. Het advies is beperkt tot de repository en je antwoorden.");
 if(repo){
  if(repo.contentCheck?.checkedFiles)observations.push("Van GitHub zijn "+repo.contentCheck.checkedFiles+" kleine bronbestanden inhoudelijk gelezen en statisch gecontroleerd.");
  if(repo.contentCheck?.findings?.length)warnings.push("In de GitHub-code zijn "+repo.contentCheck.findings.length+" inhoudelijke aandachtspunten gevonden.");
  if(repo.actionChecks?.syntaxErrors?.length)warnings.push("GitHub Actions bevestigt "+repo.actionChecks.syntaxErrors.length+" syntaxisfout(en), met bestandsverwijzingen.");
  observations.push("GitHub-repository '"+repo.name+"' is openbaar en bereikbaar.");
  if(!repo.readable)warnings.push("De bestandslijst kon niet worden opgehaald. De vergelijking is niet compleet.");
  if(repo.truncated)warnings.push("De GitHub-bestandslijst is afgekapt. De vergelijking kan bestanden missen.");
  if(repo.readable&&repo.empty)observations.push("GitHub heeft nog geen projectbestanden in de standaardbranch.");
  else if(repo.readable)observations.push("GitHub toont "+countText(repo.paths.length,"bestand","bestanden")+" in de branch '"+repo.branch+"'.");
 }else warnings.push("Er is geen GitHub-repository gecontroleerd.");
 let comparison=null;
 if(archive&&repo&&repo.readable&&!repo.truncated){
  comparison=compareProjects(archive,repo);
  observations.push(countText(comparison.missingCount,"bestand uit het ZIP-bestand staat","bestanden uit het ZIP-bestand staan")+" nog niet op dezelfde plek in GitHub.");
  if(comparison.identical.length)observations.push(countText(comparison.identical.length,"bestand is","bestanden zijn")+" inhoudelijk gelijk aan de GitHub-versie (Git-vingerafdruk).");
  if(comparison.changed.length)warnings.push(countText(comparison.changed.length,"bestand heeft","bestanden hebben")+" aantoonbaar andere inhoud dan dezelfde bestandsnaam in GitHub. Controleer welke versie je wilt behouden.");
  if(comparison.unknown.length)warnings.push(countText(comparison.unknown.length,"bestandsnaam komt","bestandsnamen komen")+" al voor in GitHub, maar de inhoud kon niet worden vergeleken. Gelijke namen bewijzen niet dat de bestanden identiek zijn.");
 }
 if(archive?.contentCheck?.findings?.length)warnings.push(archive.contentCheck.findings.length+" inhoudelijke fouten of verwijzingsproblemen gevonden. Zie de concrete bevindingen.");
 if(archive?.contentCheck?.incomplete)warnings.push("Sommige bestanden zijn door grootte of formaat niet inhoudelijk gecontroleerd.");
 if(purpose.repoOnlyZips)warnings.unshift("Er staat in GitHub alleen een ZIP of een ZIP met documentatie. De projectbestanden zijn daarmee nog niet beschikbaar als broncode.");
 if(archive?.secret.length)steps.push("Bekijk eerst de mogelijk gevoelige bestanden en haal wachtwoorden of privésleutels uit het project.");
 if(archive?.contentCheck?.findings?.length)steps.push("Bekijk de gevonden inhoudelijke problemen en controleer per bestand en regel welke wijziging nodig is.");
 if(comparison?.changed?.length)steps.push("Vergelijk de afwijkende bestanden inhoudelijk voordat je iets overschrijft in GitHub.");
 if(selectedGoal==="site"&&archive?.missingReferences?.length)steps.push("Herstel de ontbrekende verwijzingen uit je startpagina voordat je de website publiceert.");
 if(selectedGoal==="site"&&archive&&!archive.project.hasHtml)steps.push("Zoek het bestand dat de website moet openen. Zonder startpagina kunnen we nog geen website aanbieden.");
 if(selectedGoal==="app"&&archive&&!archive.project.hasPackage)steps.push("Bepaal hoe het programma gestart en getest moet worden. In het onderzochte archief ontbreekt een duidelijke projectconfiguratie.");
 if(archive?.ignored.length)steps.push("Houd installatie- en bouwmappen buiten GitHub. Bewaar alleen de bestanden die nodig zijn om het project opnieuw op te bouwen.");

 if(repo&&!repo.readable)steps.push("Open je repository op GitHub en controleer of de bestandenlijst daar wel zichtbaar is.");
 if(archive&&repo&&repo.readable){
  steps.push("Pak het ZIP-bestand uit op je eigen apparaat. GitHub pakt een geüpload ZIP-bestand niet automatisch uit tot een project.");
  steps.push("Open '"+repo.name+"' in GitHub. Kies 'Add file' en daarna 'Upload files'.");
  if(comparison?.missingCount)steps.push("Selecteer in GitHub de uitgepakte projectbestanden, niet het .zip-bestand zelf. Behoud de mappen en upload de ontbrekende bestanden. Bij veel bestanden kan dit in delen.");
  else steps.push("Vergelijk eerst de inhoud van bestaande bestanden. Alleen op basis van bestandsnamen is geen wijziging nodig.");
  steps.push("Controleer de wijzigingen, vul een korte commitbeschrijving in en bevestig de commit.");
  steps.push("Vernieuw de repository. Controleer of de bestanden en hun mapnamen kloppen.");
 }else if(archive){steps.push("Maak een repository op GitHub of kopieer de bestaande repository-URL naar deze tool.");}
 else if(repo){steps.push("Selecteer je ZIP-bestand om een controle van de mappen en bestanden uit te voeren.");}
 if(archive&&!archive.project.hasReadme)steps.push("Maak een korte README.md waarin je uitlegt wat het project doet, voor wie het is en hoe iemand het kan gebruiken.");
 if(archive&&!archive.project.hasIgnore)steps.push("Voeg een .gitignore toe als het project tijdelijke bestanden gebruikt. Bekijk daarvoor het voorgestelde voorbeeld.");
 if(selectedGoal==="site"&&archive?.project?.hasPackage)steps.push("Bekijk de bouwopdrachten in package.json. Mogelijk moet de website eerst worden gebouwd, bijvoorbeeld met GitHub Actions.");
 if(selectedGoal==="site"&&archive&&!archive.project.hasPackage&&archive.project.hasHtml)steps.push("Open de startpagina en controleer of de knoppen, afbeeldingen en links echt werken. Het bestand index.html alleen is geen bewijs dat de website goed werkt.");
 if(selectedGoal==="site")steps.push("Test na het uploaden de website in een browser. GitHub Pages kan een statische website publiceren, maar dat moet je apart instellen. Een servertoepassing heeft andere hosting nodig.");
 if(selectedGoal==="app")steps.push("Test het programma en bepaal welke omgeving of hosting het nodig heeft. GitHub bewaart bronbestanden, maar voert je programma niet vanzelf uit.");
 if(goal==="maintain")steps.push("Gebruik voor toekomstige wijzigingen een aparte branch en controleer het verschil voordat je het samenvoegt.");
 if(experience==="beginner"&&archive&&repo)steps.push("Kijk na de upload of je bestanden op de juiste plek staan. Je hoeft nu geen nieuw programma te installeren.");
 const ready=Boolean(archive&&repo&&repo.readable&&!repo.truncated&&!archive.secret.length&&
  !archive.contentCheck?.findings?.length&&!repo.contentCheck?.findings?.length&&
  !repo.actionChecks?.syntaxErrors?.length&&comparison?.missingCount===0&&
  comparison?.changed?.length===0&&comparison?.unknown?.length===0);
 return {observations,warnings,steps,comparison,ready,purpose,limits:["Projectcode is niet uitgevoerd. Knoppen, berekeningen en andere functies zijn niet automatisch getest.","De statische ZIP-analyse is begrensd. Grote of ongeschikte bestanden blijven deels onbeoordeeld.","De GitHub-vergelijking gebruikt alleen bestanden met beschikbare Git-vingerafdrukken. De tool schrijft of publiceert niets."]};
}
export function readmeTemplate(project,repoName){
 const name=repoName?.split("/").at(-1)||"Mijn project";
 const tech=project?.project?.type||"Project";
 return line("# "+name+"\n\n## Over dit project\n\nBeschrijf hier wat het project doet en voor wie het bedoeld is.\n\n## Opbouw\n\nType: "+tech+"\n\nBeschrijf hier de belangrijkste mappen en bestanden.\n\n## Gebruiken\n\nBeschrijf hoe iemand het project kan openen of starten.\n\n## Beheer\n\nBeschrijf hoe wijzigingen worden bijgehouden en wie daarvoor verantwoordelijk is.\n");
}
export function ignoreTemplate(project){
 if(project?.project?.hasPackage)return "# Controleer of dist/ en build/ voor de website nodig zijn.\nnode_modules/\n.env\n.env.*\n!.env.example\n.DS_Store\nThumbs.db\ncoverage/\n";
 if(project?.project?.runtime==="Python")return "__pycache__/\n*.pyc\n.venv/\nvenv/\n.env\n.env.*\n.DS_Store\n";
 return ".DS_Store\nThumbs.db\n.env\n.env.*\n";
}
export function reportText(data){
 const r=data.advice,a=data.archive,repo=data.repo;
 const runs=(Array.isArray(data.workerRuns)?data.workerRuns:[]).map(x=>
  "- "+x.task+": "+x.status+(x.mode?" ("+x.mode+")":"")+
  (Number.isFinite(x.elapsedMs)?" in "+x.elapsedMs+" ms":"")+(x.reason?" · "+x.reason:""));
 return ["# Persoonlijk GitHub-advies","","Gemaakt op "+new Date().toLocaleString("nl-NL"),"",
 "## Gecontroleerd",...r.observations.map(x=>"- "+x),"",
 "## Aandachtspunten",...(r.warnings.length?r.warnings:["- Geen bijzonderheden gevonden binnen de uitgevoerde controles."]).map(x=>x.startsWith("- ")?x:"- "+x),"",
 "## Wat wil je bereiken?","- "+(r.purpose?.label||"Niet opgegeven"),...(r.purpose?.aim?["- Jouw eigen toelichting (niet inhoudelijk beoordeeld): "+r.purpose.aim]:[]),"",
 "## Wat de bestanden laten zien",...(r.purpose?.found||[]).map(x=>"- "+x),"",
 "## Wat nog niet vaststaat",...(r.purpose?.remaining||[]).map(x=>"- "+x),"",
 "## Jouw stappen",...r.steps.map((x,i)=>(i+1)+". "+x),"",
 "## Niet gecontroleerd",...r.limits.map(x=>"- "+x),"",
 "## Uitgevoerde browserwerkers",...(runs.length?runs:["- Niet vastgelegd"]),"","## Bronnen","- ZIP: "+(a?.name||"niet aangeleverd"),"- GitHub: "+(repo?.url||"niet gecontroleerd"),"- GitHub-bronversie: "+(repo?.sha||"onbekend"),""].join("\n");
}
