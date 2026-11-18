// EAIgit: statische browsercontrole. Niet importeren of uitvoeren van projectcode.
// Acorn wordt lokaal gehost, zodat ook een ZIP zonder netwerk kan worden onderzocht.
import {parse} from "../eaigit/vendor/acorn-8.15.0.mjs";

const JS=/\.(?:js|mjs|cjs)$/i;
const OTHER_CODE=/\.(?:jsx|ts|tsx|vue|svelte|astro)$/i;
const HTML=/\.html?$/i;
const safe=s=>String(s||"").replace(/[\r\n\t]/g," ").slice(0,150);
const lineAt=(text,offset)=>text.slice(0,offset).split("\n").length;
const MAX_FINDINGS=22;
const MAX_JS=60;
const MAX_JS_TEXT=220000;
const knownEntry=["index.html","public/index.html","docs/index.html","dist/index.html","build/index.html"];
function finding(type,title,detail,path,line=null,certainty="observed"){
 return {type,title,detail,path,line,severity:"attention",certainty};
}
function looksLikeTransformedCode(text){
 return /<\s*[A-Z][A-Za-z\d]*(?:\s|\/?>)|<>[\s\S]*<\/>/.test(text)
  || /\binterface\s+[A-Za-z_$]|\btype\s+[A-Za-z_$]+\s*=/.test(text);
}
function parseJavascript(path,text){
 const types=path.endsWith(".cjs")?["script"]:path.endsWith(".mjs")?["module"]:["module","script"];
 let last=null;
 for(const sourceType of types){
  try{
   parse(text,{ecmaVersion:"latest",sourceType,allowHashBang:true});
   return {ok:true};
  }catch(error){last=error;}
 }
 if(looksLikeTransformedCode(text))
  return {ok:false,unsupported:true,reason:"Dit bestand lijkt JSX of TypeScript te bevatten. Hiervoor is de gewone JavaScript-parser niet geschikt."};
 return {ok:false,unsupported:false,line:Number.isSafeInteger(last?.loc?.line)?last.loc.line:null,
  detail:"JavaScript-syntaxis kan niet worden geparseerd: "+safe(last?.message||"onbekende fout")};
}
function htmlMarkup(path,text){
 // Alleen eenvoudige, zichtbare tags. Geen JavaScript, CSS, templates of HTML-entiteiten uitvoeren.
 const blank=m=>m.replace(/[^\n]/g," ");
 const markup=text.replace(/<!--[\s\S]*?-->/g,blank)
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,blank);
 const ids=new Map(),found=[],images=[];
 const tag=/<([a-z][a-z\d:-]*)\b([^<>]*?)>/gi;
 let m;
 while((m=tag.exec(markup))!==null){
  const name=m[1].toLowerCase(),attr=m[2];
  const id=/\bid\s*=\s*(["'])([^"']+)\1/i.exec(attr);
  if(id){
   const label=id[2],prior=ids.get(label);
   if(prior&&found.length<4){
    found.push(finding("duplicate-html-id","Dubbele HTML-ID",
     "De ID '"+safe(label)+"' komt meer dan één keer voor in dit HTML-bestand. Elementen zijn daardoor niet eenduidig te vinden.",path,lineAt(markup,m.index)));
   }else ids.set(label,lineAt(markup,m.index));
  }
  if(name==="img"&&!/\balt\s*=/i.test(attr)&&images.length<4){
   images.push(finding("image-without-alt","Afbeelding zonder alt-tekst",
    "Dit img-element heeft geen alt-attribuut. Controleer de toegankelijkheid; voor een decoratieve afbeelding kan alt=\"\" passend zijn.",path,lineAt(markup,m.index)));
  }
 }
 const viewport=/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(text);
 const doctype=/<!doctype\s+html\b/i.test(text);
 return {ids,findings:[...found,...images],viewport,doctype};
}
function staticDomReferences(path,text){
 const refs=[],rules=[
  /\bgetElementById\s*\(\s*(["'])([A-Za-z][\w:.-]{0,80})\1\s*\)/g,
  /\bquerySelector(?:All)?\s*\(\s*(["'])#([A-Za-z][\w:-]{0,80})\1\s*\)/g
 ];
 for(const re of rules){
  let m;
  while((m=re.exec(text))&&refs.length<70)refs.push({id:m[2],path,line:lineAt(text,m.index)});
 }
 return refs;
}
export function inspectStaticProject(records=[],paths=[],{manifest=null,standalone=false}={}){
 const existing=new Set(paths),checked={javascript:0,html:0,domReferences:0},
  passed={javascript:0},skipped={javascript:[],markup:[]},findings=[];
 const add=x=>{if(findings.length<MAX_FINDINGS)findings.push(x);};
 const byPath=new Map(records.filter(r=>typeof r?.text==="string"&&typeof r.path==="string").map(r=>[r.path,r.text]));
 const htmlRecords=records.filter(r=>HTML.test(r.path)&&typeof r.text==="string");
 const knownIds=new Set();
 for(const record of records){
  const {path,text}=record;
  if(typeof text!=="string")continue;
  if(JS.test(path)){
   if(checked.javascript>=MAX_JS||text.length>MAX_JS_TEXT){skipped.javascript.push(path);continue;}
   checked.javascript++;
   const parsed=parseJavascript(path,text);
   if(parsed.ok)passed.javascript++;
   else if(parsed.unsupported)skipped.javascript.push(path);
   else add(finding("javascript-syntax","JavaScript-syntaxisfout",parsed.detail,path,parsed.line));
  }else if(OTHER_CODE.test(path))skipped.javascript.push(path);
 }
 for(const record of htmlRecords){
  checked.html++;
  const inspected=htmlMarkup(record.path,record.text);
  for(const id of inspected.ids.keys())knownIds.add(id);
  for(const f of inspected.findings)add(f);
  if(knownEntry.includes(record.path)||standalone){
   if(!inspected.viewport)add(finding("missing-viewport","Mobiele viewport ontbreekt",
    "In deze startpagina is geen viewport-meta-instelling aangetroffen. Controleer de weergave op telefoons.",record.path,1,"review"));
   if(!inspected.doctype)add(finding("missing-doctype","HTML-doctype niet gevonden",
    "De startpagina bevat geen herkenbare <!doctype html>. Dit kan de browserweergave beïnvloeden.",record.path,1,"review"));
  }
 }
 const domReferences=records.filter(r=>JS.test(r.path)&&typeof r.text==="string")
  .flatMap(r=>staticDomReferences(r.path,r.text)).slice(0,70);
 checked.domReferences=domReferences.length;
 if(htmlRecords.length){
  // Afwezige elementen kunnen door code worden aangemaakt. Altijd een vraag, geen bewezen defect.
  const seen=new Set();
  for(const ref of domReferences){
   if(knownIds.has(ref.id)||seen.has(ref.id))continue;
   seen.add(ref.id);
   add(finding("dom-id-unseen","HTML-element niet statisch gevonden",
    "JavaScript zoekt de ID '"+safe(ref.id)+"', maar die staat niet in de gelezen HTML. Mogelijk wordt het element later dynamisch aangemaakt.",ref.path,ref.line,"review"));
  }
 }
 const htmlCount=paths.filter(p=>HTML.test(p)).length;
 if(htmlCount&&!standalone&&!knownEntry.some(p=>existing.has(p))){
  const isBuild=paths.some(p=>p==="package.json"||p.endsWith("/package.json"));
  add(finding("entry-unconfirmed","Startpagina niet eenduidig",
   isBuild?"Er zijn HTML-bestanden, maar geen bekende publieke index.html. Een buildproces kan de startpagina maken.":
    "Er zijn HTML-bestanden, maar geen index.html in de gebruikelijke project- of publicatiemap.",null,null,"review"));
 }
 // Een startscript dat letterlijk node bestand.js gebruikt, kan statisch worden gecontroleerd.
 const packageText=byPath.get("package.json");
 let manifestData=manifest;
 if(!manifestData&&packageText){try{manifestData=JSON.parse(packageText);}catch{/* JSON is elsewhere reported */}}
 const scripts=manifestData&&typeof manifestData.scripts==="object"&&!Array.isArray(manifestData.scripts)
   ?manifestData.scripts:{};
 const scriptNames=Object.keys(scripts).filter(k=>typeof scripts[k]==="string").slice(0,24);
 for(const name of ["start","dev"]){
  const command=scripts[name];
  if(typeof command!=="string")continue;
  const m=/^\s*node\s+(?:(?:--[\w-]+)(?:=\S+)?\s+)*([\w./-]+\.(?:js|mjs|cjs))(?:\s|$)/.exec(command);
  if(m&&!existing.has(m[1])&&!m[1].includes(".."))
   add(finding("missing-script-entry","Startscript verwijst naar ontbrekend bestand",
    "Het script '"+name+"' gebruikt node "+safe(m[1])+", maar dit bestand staat niet in de aangeleverde projectlijst. Het kan eventueel door een buildstap worden aangemaakt.",
    "package.json",null,"review"));
 }
 return {
  schema:"eaigit/static-audit-v1",engine:"acorn-8.15.0-offline",
  checked,passed,skipped:{javascript:skipped.javascript.slice(0,30)},
  scripts:scriptNames,entryPoints:knownEntry.filter(p=>existing.has(p)),
  findings,
  incomplete:skipped.javascript.length>0||findings.length>=MAX_FINDINGS,
  limits:[
   "JavaScript is alleen geparseerd, niet uitgevoerd. Dit is geen volledige ESLint-controle.",
   "JSX, TypeScript, Vue, Svelte en Astro zijn niet als gewone JavaScript gevalideerd.",
   "HTML en DOM-verwijzingen zijn statisch bekeken. Dynamisch aangemaakte elementen blijven onzeker.",
   "Projecttests, buildstappen, afhankelijkheden en gebruikershandelingen zijn niet uitgevoerd."
  ]
 };
}
