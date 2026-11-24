// Onderzoek van één lokaal bestand. Geen uitvoering, opslag, upload of netwerkverzoek.
// De HTML-bron en scripttekst worden alleen statisch gelezen in de browserworker.
import {inspectProjectTexts,appendStaticAudit,inspectFileSignature} from "./inhoudscontrole.mjs";

export const SINGLE_FILE_LIMIT=8*1024*1024;
const TEXT_LIMIT=220000;
const TEXT=/\.(?:html?|css|[cm]?js|jsx|tsx?|json|py|php|svg|txt|md|xml|sh|bat|ps1)$/i;
const HTML=/\.html?$/i;
const CODE=/\.(?:[cm]?js|jsx|tsx|py|php|sh|bat|ps1)$/i;
const DATA=/\.(?:json|txt|md|xml|css|svg)$/i;
const BINARY=/\.(?:exe|msi|dmg|pkg|app|apk|jar|wasm|deb|rpm|dll|so|bin)$/i;
const SECRET=/^(?:\.env(?:\..+)?|id_(?:rsa|ed25519)(?:\.pub)?|credentials?(?:\.[^.]+)?|secrets?\.[^.]*(?:\.json|\.ya?ml)?|[^/]+\.pem|[^/]+\.p12|[^/]+\.pfx)$/i;
const trimmed=s=>String(s||"").replace(/[\r\n\t]/g," ").slice(0,160);
const uniq=(list,max=8)=>[...new Set(list)].slice(0,max);
const line=(text,index)=>text.slice(0,index).split("\n").length;

export function inspectOfflineDependencies(path,text){
 const external=[],requests=[],server=[],storage=[];
 const add=(arr,item)=>{if(arr.length<12&&!arr.includes(item))arr.push(item);};
 if(HTML.test(path)){
  const markup=text.replace(/<!--[\s\S]*?-->/g,"");
  const tags=/<(script|link|img|source|audio|video|iframe)\b[^>]*>/gi;
  let tag;
  while((tag=tags.exec(markup))!==null){
   const attrs=tag[0];
   const asset=/(?:^|\s)(?:src|href|poster)\s*=\s*["']([^"'<>]{1,400})["']/i.exec(attrs);
   if(asset&&/^(?:https?:)?\/\//i.test(asset[1]))add(external,trimmed(asset[1]));
   if(tag[1].toLowerCase()==="script"&&/\btype\s*=\s*["']module["']/i.test(attrs))
    add(server,"HTML gebruikt een JavaScript-module; openen via file:// kan door browserbeveiliging mislukken.");
  }
 }
 const css=/@import\s+(?:url\(\s*)?["']?(https?:\/\/|\/\/)[^"'\s)]+|url\(\s*["']?(https?:\/\/|\/\/)[^"'\s)]+/gi;
 let match;
 while((match=css.exec(text))!==null)add(external,trimmed(match[0]));
 if(/\b(?:fetch|XMLHttpRequest|EventSource|WebSocket)\s*(?:\(|\b)/.test(text))
  add(requests,"In de code staat een netwerk-API. Of deze wordt gebruikt en internet nodig heeft, is niet uitgevoerd of vastgesteld.");
 if(/\b(?:navigator\.serviceWorker|serviceWorker\.register)\b/.test(text))
  add(server,"Een serviceworker werkt niet rechtstreeks vanaf file://; gebruik HTTPS of localhost.");
 if(/\b(?:import\s+(?:[{"'*]|\w)|import\s*\(|require\s*\()\b/.test(text)&&CODE.test(path))
  add(server,"Imports of modules kunnen afhankelijk zijn van extra bestanden, pakketten of een lokale server.");
 if(/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(text))
  add(storage,"Er zijn aanwijzingen voor browseropslag. Bestanden worden daardoor niet automatisch tussen apparaten gedeeld; opslag via file:// verschilt per browser.");
 if(/\b(?:document\.cookie|cookieStore)\b/.test(text))
  add(storage,"Cookiegebruik is afhankelijk van de browsercontext en werkt anders bij file:// dan bij een website.");
 return {schema:"eaigit/offline-readiness-v1",external:uniq(external),network:uniq(requests),
  server:uniq(server),storage:uniq(storage),executed:false};
}
export async function analyzeSingleFile(input){
 if(!input||typeof input.name!=="string"||typeof input.arrayBuffer!=="function")
  throw new Error("Kies eerst een los bestand op je apparaat.");
 const name=input.name.trim();
 if(!name||name.length>160||/[\/\\\x00-\x1f\x7f]/.test(name)||name==="."||name==="..")
  throw new Error("Deze bestandsnaam kan niet veilig worden onderzocht.");
 if(!Number.isSafeInteger(input.size)||input.size<0||input.size>SINGLE_FILE_LIMIT)
  throw new Error("Kies een los bestand van maximaal 8 MB.");
 const bytes=new Uint8Array(await input.arrayBuffer());
 if(bytes.byteLength!==input.size||bytes.byteLength>SINGLE_FILE_LIMIT)
  throw new Error("Het bestand kon niet volledig worden gelezen.");
 const secret=SECRET.test(name)?[name]:[];
 const isText=TEXT.test(name),isHtml=HTML.test(name),isCode=CODE.test(name),isBinary=BINARY.test(name);
 let kind=isHtml?"html":isCode?"script":DATA.test(name)?"data":isBinary?"binary":"other";
 const project={type:isHtml?"Los HTML-bestand":isCode?"Los script of codebestand":
  isBinary?"Programma of binair bestand":DATA.test(name)?"Los tekst- of gegevensbestand":"Los bestand",
  runtime:isHtml?"Webbrowser":/\.(?:py)$/i.test(name)?"Python":
   /\.(?:[cm]?js|jsx|tsx)$/i.test(name)?"JavaScript-omgeving":
   isBinary?"Afhankelijk van besturingssysteem en bestandsformaat":"Niet vastgesteld",
  framework:null,files:1,hasReadme:false,hasIgnore:false,hasLicense:false,hasHtml:isHtml,hasPackage:false,hasTests:false};
 const records=[],notInspected=[],formatFindings=[],eligible=secret.length?[]:[name];
 if(eligible.length){
  const finding=inspectFileSignature(name,bytes);
  if(finding)formatFindings.push(finding);
  if(isText&&bytes.byteLength<=TEXT_LIMIT&&!bytes.includes(0)){
   try{records.push({path:name,text:new TextDecoder("utf-8",{fatal:true}).decode(bytes)});}
   catch{notInspected.push(name);}
  }else notInspected.push(name);
 }
 const contentCheck=inspectProjectTexts(records,eligible);
 // Alleen het gekozen bestand is bekend. Een verwijzing kan naast het bestand
 // bestaan zonder dat die tweede bron is aangeleverd.
 for(const issue of contentCheck.findings){
  if(issue.type==="missing-reference"){
   issue.certainty="review";
   issue.title="Bijbehorend bestand niet meegeleverd";
   issue.detail="De verwijzing is in dit losse bestand gevonden, maar het doelbestand is niet aangeleverd. Of het op het apparaat bestaat, is niet gecontroleerd.";
  }
 }
 await appendStaticAudit(contentCheck,records,eligible,{standalone:true});
 contentCheck.findings.push(...formatFindings);
 contentCheck.notInspected=notInspected;
 contentCheck.incomplete=contentCheck.incomplete||notInspected.length>0;
 const readiness=records[0]?inspectOfflineDependencies(name,records[0].text):{
  schema:"eaigit/offline-readiness-v1",external:[],network:[],server:[],storage:[],executed:false};
 return {sourceKind:"file",kind,name,archiveSize:bytes.byteLength,total:bytes.byteLength,
  files:[name],prefix:"",eligible,ignored:[],secret,project,manifest:{},
  manifestError:null,missingReferences:contentCheck.findings.filter(x=>x.type==="missing-reference")
   .map(x=>x.target).filter(Boolean),indexChecked:isHtml&&records.length>0,indexError:null,
  contentCheck,readiness,fingerprints:{},truncated:records.length===0,executesProjectCode:false};
}
