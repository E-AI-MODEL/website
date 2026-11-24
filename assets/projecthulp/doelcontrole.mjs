// Controleer aanwijzingen voor het gekozen doel; claim geen werkende software zonder uitvoering.
export const PURPOSES = Object.freeze({
  site:"Een website die anderen kunnen openen",
  app:"Een programma of interactieve toepassing die werkt",
  code:"Mijn project onderhouden en verder bouwen",
  docs:"Documenten of materiaal overzichtelijk delen",
  unsure:"Ik weet nog niet precies wat het eindresultaat moet zijn"
});
const isDocument=(p)=>/\.(pdf|md|txt|docx?|pptx?|xlsx?|odt|ods|odp)$/i.test(p);
const isCode=(p)=>/\.(html?|css|[cm]?jsx?|tsx?|py|php|java|rb|go|rs|vue|svelte|astro|json|ya?ml)$/i.test(p);
const isZip=(p)=>/\.zip$/i.test(p);
function filenameSet(paths){return new Set(paths||[]);}
function has(p,name){return p.has(name);}
export function findBrokenLocalLinks(indexPath,html,paths){
 if(typeof html!=="string")return [];
 const files=filenameSet(paths),missing=new Set(),regexp=/\b(?:src|href)\s*=\s*(['"])(.*?)\1/gi;
 let match;
 while((match=regexp.exec(html))!==null){
  let address=match[2].trim();
  if(!address||address.startsWith("#")||/^(?:[a-z][\w+.-]*:|\/\/|\?)/i.test(address)||address.includes("{")||address.includes("%7B"))continue;
  address=address.split(/[?#]/,1)[0];
  if(!/\.(?:css|[cm]?js|png|jpe?g|gif|svg|webp|ico|woff2?|html?)$/i.test(address))continue;
  try{address=decodeURIComponent(address);}catch{continue;}
  const parts=(address.startsWith("/")?[]:indexPath.split("/").slice(0,-1)).concat(address.split("/"));
  const resolved=[];
  for(const part of parts){if(!part||part===".")continue;if(part===".."){if(!resolved.length){resolved.length=0;break;}resolved.pop();}else resolved.push(part);}
  const path=resolved.join("/");
  if(path && !files.has(path))missing.add(path);
  if(missing.size>=25)break;
 }
 return [...missing];
}
export function checkProjectPurpose({goal="unsure",archive=null,repo=null,aim=""}={}){
 const selected=Object.hasOwn(PURPOSES,goal)?goal:"unsure";
 const files=archive?.eligible||[],p=filenameSet(files),project=archive?.project||{};
 const manifest=archive?.manifest&&typeof archive.manifest==="object"&&!Array.isArray(archive.manifest)?archive.manifest:{};
 const scripts=manifest.scripts&&typeof manifest.scripts==="object"&&!Array.isArray(manifest.scripts)?manifest.scripts:{};
 const found=[],remaining=[];
 const index=["index.html","public/index.html","dist/index.html","build/index.html"].find(x=>has(p,x))||null;
 const code=files.filter(isCode);
 const docs=files.filter(isDocument);
 const repoFiles=repo?.paths||[];
 const zipInRepo=repoFiles.filter(isZip);
 const repoOnlyZips=Boolean(repo?.readable&&zipInRepo.length>0&&repoFiles.every(x=>isZip(x)||/^(?:README\.md|\.gitignore|LICENSE)$/i.test(x)));
 if(repoOnlyZips)remaining.push("In GitHub staat vooral een ZIP-bestand. GitHub heeft de inhoud niet uitgepakt tot projectbestanden.");
 if(!archive){remaining.push("Het ZIP-bestand is niet onderzocht. De opbouw van het project is nog onbekend.");return {goal:selected,label:PURPOSES[selected],aim,found,remaining,repoOnlyZips,indication:"Niet te beoordelen"};}
 if(!files.length)remaining.push("Na het weglaten van mogelijke privé- en tijdelijke bestanden blijven geen projectbestanden over.");
 if(selected==="site"){
  if(index)found.push("Een mogelijk startbestand voor een website gevonden: "+index+".");
  if(index?.startsWith("dist/")||index?.startsWith("build/"))remaining.push("De startpagina staat in een bouwmap. GitHub publiceert deze map niet vanzelf: bepaal welke uitvoer naar de website moet.");
  else if(!index)remaining.push("Geen index.html in de hoofdmap of public-map gevonden. We kunnen nog niet aanwijzen welke pagina moet openen.");
  if(project.hasPackage){found.push("Het project bevat package.json. Een bouwstap kan nodig zijn voordat de website online kan.");}
  else if(index)found.push("De bestanden wijzen op een website die mogelijk zonder extra framework kan worden geopend.");
  if(archive.missingReferences?.length)remaining.push("De startpagina verwijst naar "+archive.missingReferences.length+" lokaal bestand(en) dat niet op de verwachte plek in het ZIP-bestand staat.");
  if(!archive.indexChecked&&index)remaining.push("De verwijzingen in de startpagina konden niet worden nagekeken.");
  remaining.push("Een echte browserproef en het instellen van een webadres zijn nog niet uitgevoerd. GitHub uploaden alleen maakt geen website online.");
 }else if(selected==="app"){
  if(project.hasPackage){found.push("package.json gevonden"+(project.framework?" met "+project.framework:"")+".");}
  if(Object.keys(scripts).length)found.push("Het project vermeldt start- of bouwopdrachten: "+Object.keys(scripts).slice(0,6).join(", ")+".");
  else if(project.hasHtml)found.push("Een HTML-bestand kan het startpunt zijn van een toepassing die in de browser draait.");
  else remaining.push("Geen bevestigde start- of bouwopdracht gevonden in de onderzochte projectbestanden.");
  if(!project.hasPackage&&!project.hasHtml&&!files.some(x=>x.endsWith(".py")))remaining.push("Geen duidelijk programma-startpunt gevonden.");
  remaining.push("Niet gecontroleerd of het programma start, welke functies werken of waar het veilig kan draaien.");
 }else if(selected==="code"){
  if(code.length)found.push("Er zijn "+code.length+" bestanden gevonden die op broncode of projectinstellingen wijzen.");
  else remaining.push("Geen herkenbare bronbestanden gevonden; controleer of de ZIP de echte projectbestanden bevat.");
  if(project.hasReadme)found.push("Een README is aanwezig om het project uit te leggen.");
  else remaining.push("Een README ontbreekt. Beschrijf wat het project doet en hoe iemand verder kan werken.");
  remaining.push("Of bestaande code goed werkt is niet met een test vastgesteld.");
 }else if(selected==="docs"){
  if(docs.length)found.push("Er zijn "+docs.length+" bestanden gevonden die op documentatie of materiaal wijzen.");
  else remaining.push("Geen herkenbare documenten gevonden. Controleer of dit wel het bedoelde archief is.");
  if(project.hasReadme)found.push("Er staat een README met ruimte voor toelichting.");
  remaining.push("Controleer zelf of het materiaal compleet is en of je het openbaar mag delen.");
 }else{
  found.push("We kunnen de aanwezige bestanden in kaart brengen.");
  remaining.push("Het beoogde gebruik is nog niet gekozen. Daardoor kunnen we niet beoordelen of de inhoud daarvoor voldoende is.");
 }
 if(archive.secret?.length)remaining.unshift("Mogelijk vertrouwelijke bestanden gevonden. Jij moet beoordelen wat openbaar mag worden.");
 const suggestion=selected==="site"?"Controleer eerst de startpagina en de verwijzingen. Test daarna in een browser en richt afzonderlijk publicatie in.":selected==="app"?"Onderzoek hoe je het programma start en test de belangrijkste gebruikershandeling, vóór je het als werkend beschrijft.":selected==="code"?"Zet de uitgepakte bronbestanden in GitHub, met uitleg en zonder privébestanden.":"Controleer de inhoud en rechten voordat je iets publiek deelt.";
 return {goal:selected,label:PURPOSES[selected],aim,found,remaining,repoOnlyZips,indication:remaining.length?"Nog te controleren":"Alleen aanwijzingen",suggestion};
}
