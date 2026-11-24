import {goalTestFromAim} from "./inhoudscontrole.mjs";
// Gebruikersgerichte uitkomst voor Projecthulp. Geen nieuwe claims zonder broncontrole.
const display=(name)=>String(name||"onbekend").replace(/[\r\n\t]/g," ").slice(0,180);
function goalName(goal){
 return ({site:"een website die bezoekers kunnen openen",app:"een interactieve toepassing die werkt",code:"mijn project verder kunnen ontwikkelen",docs:"documenten overzichtelijk delen",unsure:"begrijpen wat mijn project kan"})[goal]||"mijn project kunnen gebruiken";
}
function repoLink(repo){
 if(!repo?.url||!/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/?$/i.test(repo.url))return null;
 return repo.url;
}
function issue(title,detail,severity="attention",path=null,line=null){
 return {title,detail,severity,path,line};
}
export function makeGuidance({archive=null,repo=null,advice=null,goal="site",aim="",repoError=null,intent=null,source=null,delivery="local"}={}){
 const good=[],problems=[],uncertain=[],next=[],reference=repoLink(repo);
 const purpose=goalName(goal);
 const single=archive?.sourceKind==="file";
 const localRoute=intent==="local"||(source==="file"&&["repair","explore"].includes(intent));
 const goalTest=goalTestFromAim(aim,archive?.contentCheck?.signals||repo?.contentCheck?.signals);
 const addGood=(x)=>good.push(x);
 if(archive){
  addGood(single?"Het losse bestand is lokaal gelezen: "+archive.name+". De toepassing is niet uitgevoerd.":"Het ZIP-bestand is lokaal onderzocht: "+archive.eligible.length+" mogelijke projectbestanden gevonden.");
  if(archive.contentCheck?.checkedFiles)addGood(archive.contentCheck.checkedFiles+" projectbestanden zijn op inhoud en lokale verwijzingen onderzocht, zonder code uit te voeren.");
  if(archive.project?.hasHtml)addGood("Er zijn HTML-bestanden gevonden. Dat kan een startpunt zijn voor een website of browsertoepassing.");
  if(archive.project?.hasReadme)addGood("Er staat al een README met informatie over het project.");
  if(archive.project?.hasTests)addGood("Er zijn bestanden aangetroffen die op tests wijzen. We hebben ze nog niet uitgevoerd.");
  if(archive.project?.framework)addGood("De projectbestanden wijzen op "+archive.project.framework+". Een ander framework is niet automatisch nodig.");
  if(archive.secret?.length)problems.push(issue("Mogelijk privébestanden in je ZIP",(archive.secret.length===1?"Eén bestandsnaam lijkt vertrouwelijk.":"Er zijn "+archive.secret.length+" bestandsnamen die vertrouwelijk lijken.")+" Controleer deze op je eigen apparaat en zet de inhoud niet zomaar openbaar.","stop"));
  if(archive.manifestError)problems.push(issue("Projectinstellingen niet goed leesbaar",archive.manifestError,"attention","package.json"));
  if(archive.missingReferences?.length&&!single)problems.push(issue("Verwijzingen naar ontbrekende bestanden",archive.missingReferences.length+" lokale bestandsverwijzingen konden niet worden gevonden: "+archive.missingReferences.slice(0,4).map(display).join(", ")+".","attention",archive.indexPath||"index.html"));
  if(archive.ignored?.length)uncertain.push("Er zijn "+archive.ignored.length+" tijdelijke of installatiebestanden herkend. Controleer welke je echt nodig hebt.");
 }else if(repo?.contentCheck?.checkedFiles)uncertain.push("Er is geen lokaal bestand aangeleverd. Alleen een beperkte selectie openbare GitHub-bestanden is inhoudelijk nagekeken.");
 else uncertain.push(localRoute?"Er is nog geen bestand onderzocht. De begeleiding gaat over maken, starten en testen.":"Er is geen lokaal bestand of ZIP onderzocht. Het advies is daardoor beperkt.");
 if(repo?.readable){
  if(repo.contentCheck?.checkedFiles)addGood(repo.contentCheck.checkedFiles+" openbare GitHub-bronbestanden zijn inhoudelijk nagekeken.");
  addGood("De openbare GitHub-repository is bereikbaar en de bestandenlijst is gelezen.");
  if(repo.empty)problems.push(issue("Er staan nog geen projectbestanden in GitHub","De repository lijkt leeg. Eerst moet duidelijk zijn welke uitgepakte bestanden er horen.","attention"));
  if(repo.paths?.some(x=>x.toLowerCase().endsWith(".zip"))){
   const zips=repo.paths.filter(x=>x.toLowerCase().endsWith(".zip"));
   const sourceCount=repo.paths.filter(x=>/\.(?:html?|[cm]?jsx?|tsx?|py|css|php|vue|svelte)$/i.test(x)).length;
   if(sourceCount===0)problems.push(issue("Een ZIP in GitHub is nog geen uitgepakt project","GitHub pakt deze bestanden niet vanzelf uit: "+zips.slice(0,3).map(display).join(", ")+".","attention"));
  }
  if(repo.truncated)uncertain.push("GitHub heeft de bestandslijst afgekapt. We kunnen niet alles vergelijken.");
 }else if(repoError)problems.push(issue("GitHub kon niet worden gecontroleerd",display(repoError),"attention"));
 else if(repo)uncertain.push("De GitHub-repository is bereikbaar, maar de bestandenlijst kon niet volledig worden gelezen.");
 else if(!localRoute)uncertain.push("Nog geen openbare GitHub-repository gecontroleerd.");
 if(single){
  const ready=archive.readiness;
  if(archive.kind==="binary")uncertain.push("Dit programma is niet uitgevoerd. Systeemvereisten, installatie, veiligheid en eventuele internetafhankelijkheid zijn niet vastgesteld.");
  if(archive.contentCheck?.notInspected?.length)uncertain.push("Dit losse bestand is niet als leesbare broncode geanalyseerd. Bestandsnaam of formaat bewijzen de werking niet.");
  if(ready?.external?.length)problems.push(issue("Externe onderdelen voor offline gebruik","In "+archive.name+" staan "+ready.external.length+" verwijzingen naar externe bronnen, bijvoorbeeld "+display(ready.external[0])+". Die kunnen zonder netwerk ontbreken. Of ze voor de bedoelde functie nodig zijn, is niet getest.","attention",archive.name));
  if(ready?.network?.length)uncertain.push("Er zijn netwerk-API's in de bron gevonden. Of ze worden aangeroepen en of internet echt vereist is, is niet getest.");
  if(ready?.server?.length)uncertain.push("Er zijn aanwijzingen voor modules, imports of een lokale server. Direct openen via file:// is niet in een browser getest.");
  if(ready?.storage?.length)uncertain.push("Browseropslag is aangetroffen. Data synchroniseert niet vanzelf tussen apparaten en file://-opslag kan per browser verschillen.");
  if(!ready?.external?.length&&!ready?.network?.length&&!ready?.server?.length)
   uncertain.push("Geen externe afhankelijkheid gevonden in de gelezen bron. Dit bewijst niet dat het bestand zonder internet werkt.");
 }
 for(const [origin,check] of [[single?"Los bestand":"ZIP",archive?.contentCheck],["GitHub",repo?.contentCheck]]){
  for(const finding of check?.findings||[]){
   if(origin==="ZIP"&&finding.type==="missing-reference"&&archive?.missingReferences?.includes(finding.target))continue;
   if(finding.certainty==="review"){
    uncertain.push(origin+": "+finding.title+(finding.path?" ("+finding.path+(finding.line?":"+finding.line:"")+")":"")+". "+finding.detail);
   }else problems.push(issue(finding.title,origin+": "+finding.detail,"attention",finding.path,finding.line));
  }
  if(check?.incomplete)uncertain.push(origin+": een deel van de bestanden is niet inhoudelijk onderzocht (grootte, formaat of limiet).");
  if(check?.audit){
   const a=check.audit,js=a.checked?.javascript||0,ok=a.passed?.javascript||0,skipped=a.skipped?.javascript?.length||0;
   if(js)addGood(origin+": "+js+" JavaScript-bestand(en) met Acorn geparseerd, "+ok+" zonder syntaxisfout. De projectcode is niet uitgevoerd.");
   if(a.checked?.html)addGood(origin+": "+a.checked.html+" HTML-bestand(en) statisch op IDs en elementen onderzocht.");
   if(skipped)uncertain.push(origin+": "+skipped+" JavaScript/JSX/TypeScript-bestand(en) niet volledig op syntaxis gecontroleerd.");
  }
 }
 if(goalTest){
  const hints=archive?.contentCheck?.features?.[goalTest.id]||repo?.contentCheck?.features?.[goalTest.id];
  if(hints?.checkedFiles){
   if(hints.found.length){
    const present=hints.found.slice(0,4).map(x=>x.label+" ("+x.paths.slice(0,2).join(", ")+")");
    addGood("Voor jouw doel zijn aanwijzingen aangetroffen voor: "+present.join("; ")+". Dit zegt nog niet of ze werken.");
   }
   if(hints.notSeen.length)uncertain.push("Voor jouw doel geen duidelijke aanwijzing gevonden voor: "+hints.notSeen.join(", ")+". Dit betreft alleen de "+hints.checkedFiles+" gelezen tekstbestanden en is geen bewijs dat de functies ontbreken.");
  }
  if(goalTest.evidence.length)addGood("In "+goalTest.evidence.slice(0,3).join(", ")+" zijn aanwijzingen gevonden die bij jouw doel passen. De werking is niet getest.");
  uncertain.push("Jouw doel: "+goalTest.title.toLowerCase()+". De volledige gebruikershandeling is nog niet uitgevoerd.");
 }
 const ci=repo?.actionChecks;
 for(const finding of ci?.syntaxErrors||[]){
  problems.push(issue(finding.title,finding.detail,"attention",finding.path,finding.line));
 }
 if(ci?.runs?.length){
  for(const run of ci.runs.slice(0,3)){
   if(run.status==="completed"&&run.conclusion==="success"){
    addGood("GitHub Actions meldt een geslaagde controle: "+run.name+". Dat bewijst geen functionele werking.");
   }else if(run.conclusion==="failure"&&!ci.syntaxErrors?.length){
    problems.push(issue("GitHub Actions-controle mislukt","Controle '"+run.name+"' is mislukt. Bekijk de gegevens in GitHub Actions voor de oorzaak.","attention"));
   }
  }
  uncertain.push("Van GitHub Actions zijn alleen jobstatussen en eventuele EAIgit-syntaxisannotaties gelezen. Het volledige rapport is nog niet gekoppeld.");
 }
 if(ci?.incomplete)uncertain.push("Niet alle GitHub Actions-resultaten konden worden gelezen.");
 if(advice?.comparison&&repo?.readable&&!repo.truncated&&archive){
  const n=advice.comparison.missingCount||0;
  if(n>0)problems.push(issue(n===1?"Eén bestand staat nog niet in GitHub":n+" bestanden staan nog niet in GitHub","Vergelijk de mappen en voeg de ontbrekende uitgepakte bestanden toe. Gelijke bestandsnamen bewijzen niet dat de inhoud gelijk is.","attention"));
  if(advice.comparison.changed?.length)problems.push(issue("ZIP en GitHub bevatten verschillende versies",
    advice.comparison.changed.length+" gelijknamige bestanden hebben andere inhoud: "+advice.comparison.changed.slice(0,4).join(", ")+". Vergelijk ze voordat je iets overschrijft.","attention",advice.comparison.changed[0]));
  if(advice.comparison.identical?.length)addGood(advice.comparison.identical.length+" ZIP-bestanden hebben dezelfde Git-vingerafdruk als in GitHub.");
  if(advice.comparison.unknown?.length)uncertain.push(advice.comparison.unknown.length+" gelijknamige bestanden zijn nog niet op inhoud vergeleken.");
  if(!n&&!(advice.comparison.identical?.length)&&!(advice.comparison.changed?.length))
   addGood("Alle onderzochte projectbestandsnamen komen ook in GitHub voor. De inhoud is nog niet vergeleken.");
 }
 if(goal==="site"&&archive&&!archive.project?.hasHtml)problems.push(issue("Startpagina niet vastgesteld","Er is geen herkenbaar HTML-bestand gevonden. Mogelijk moet dit project eerst gebouwd worden.","attention"));
 if(!good.length)good.push("We hebben nog te weinig gecontroleerde informatie om onderdelen als goed te beoordelen.");
 if(ci?.syntaxErrors?.length)uncertain.push("Andere code en functies zijn niet automatisch getest. De meldingen uit GitHub Actions gaan alleen over de aangewezen syntaxisfouten.");
 else if((archive?.contentCheck?.audit?.checked?.javascript||0)+(repo?.contentCheck?.audit?.checked?.javascript||0)>0)
  uncertain.push("Een lokale parser heeft de ondersteunde JavaScript-syntaxis onderzocht. Volledige ESLint, TypeScript, build, imports bij uitvoering en tests zijn niet gedraaid.");
 else uncertain.push("Codefouten zijn nog niet getest met een compiler of linter. We kunnen niet zeggen dat de code foutloos is.");
 uncertain.push("Logische fouten of ontbrekende werking kun je pas vaststellen met gerichte gebruikstests. We hebben de projectcode niet uitgevoerd.");
 const syntaxProblem=problems.find(x=>x.title==="JavaScript-syntaxisfout");
 if(archive?.secret?.length)next.push("Bekijk de mogelijk vertrouwelijke bestanden op je eigen apparaat en bepaal wat openbaar mag worden.");
 else if(syntaxProblem)next.push("Onderzoek de gemelde JavaScript-syntaxisfout in "+(syntaxProblem.path||"het bestand")+(syntaxProblem.line?" op regel "+syntaxProblem.line:"")+". Controleer het gewijzigde project daarna opnieuw.");
 else if(!archive&&!repo?.readable)next.push(localRoute?"Beschrijf je doel en maak een passend lokaal bestand. Een GitHub-repository is niet verplicht.":"Selecteer een bestand of ZIP zodat de projectbestanden kunnen worden onderzocht.");
 else if(!repo?.readable&&!["repair","explore","local"].includes(intent))next.push("Voeg desgewenst een openbare GitHub-repository toe voor een vergelijking. Dit is niet nodig om je lokale bestand te onderzoeken.");
 else if(problems.some(x=>x.title.includes("ZIP in GitHub")))next.push("Pak het ZIP-bestand op je eigen apparaat uit en voeg daarna de losse projectbestanden toe. GitHub pakt een geüpload ZIP niet automatisch uit.");
 else if(problems.some(x=>x.title==="Syntaxisfout bevestigd door GitHub Actions"))next.push("Open de gemelde syntaxisfout in GitHub, herstel deze en laat de GitHub Actions-controle opnieuw uitvoeren.");
 else if(problems.some(x=>x.title==="Ongeldige JSON"||x.title==="Lokaal bestand niet gevonden"||x.title==="ZIP en GitHub bevatten verschillende versies"))next.push("Bekijk de concrete fouten en verschillen bij het genoemde bestand en regelnummer. Verander niets voordat duidelijk is welke versie moet blijven.");
 else if(advice?.comparison?.missingCount)next.push("Voeg de ontbrekende losse bestanden toe aan GitHub. Bewaar de mapindeling en controleer eventuele privégegevens.");
 else if(problems.some(x=>x.title.includes("Verwijzingen")))next.push("Controleer de verwijzingen vanuit de startpagina en herstel de ontbrekende bestanden.");
 else next.push(localRoute?"Open het bestand op het bedoelde apparaat en controleer de werking, ook zonder internet.":goalTest?.action||"Controleer of de belangrijkste gebruikershandeling werkt, en besluit pas daarna of je iets wilt publiceren.");
 if(reference)next.push("Open de repository om de bestanden en de eventuele controles in GitHub te bekijken.");
 if(archive&&repo?.readable&&!localRoute)next.push("Laat vervolgens een codecheck uitvoeren. Gebruik de GitHub-workflow of Codex; deze browsercontrole is nog geen echte functionele test.");
 return {purpose,goal,aim:String(aim||"").trim().slice(0,220),goalTest,good,problems,uncertain,next:next.slice(0,3),
  repoUrl:reference,
  actionsUrl:reference?reference+"/actions":null,
  helpUrl:"https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt",
  codexUrl:"https://codex.openai.com/",
  codexHelpUrl:"https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
  // Benoem niet-verifieerbare fouten nooit als bewezen.
  codeErrorsVerified:Boolean(ci?.syntaxErrors?.length),logicErrorsVerified:false
 };
}
export function continuationPrompt(guidance,{repo=null}={}){
 const url=guidance.repoUrl||"[VUL HIER JE GITHUB-REPOSITORY IN]";
 const verified=guidance.problems.map(x=>"- "+x.title+": "+x.detail).slice(0,6).join("\n")||"- Nog geen concrete fouten bevestigd.";
 return [
 "Ik wil verder met mijn project op GitHub.",
 "Mijn repository: "+url,
 "Mijn doel: "+guidance.purpose+".",
 ...(guidance.aim?["Wat iemand moet kunnen: "+guidance.aim+"."]:[]),
 "",
 "Dit is eerder gecontroleerd:",
 ...verified.split("\n"),
 "",
 "Onderzoek de ECHTE bestanden in mijn repository. Noem wat al goed is. Zoek codefouten en mogelijke logische fouten, maar onderscheid vastgestelde fouten van vermoedens. Geef bij iedere bewezen fout de bestandsnaam, het regelnummer en een GitHub-link. Controleer bestaande tests, voer veilige controles uit en maak zo nodig een plan met kleine stappen.",
 "Schrijf in eenvoudig Nederlands en leg de eerstvolgende handeling uit. Gebruik bestaande bestanden en behoud goede functies.",
 "Gebruik voor wijzigingen Codex of een andere aantoonbaar bevoegde GitHub-schrijfomgeving. Maak pas na mijn toestemming een aparte branch en pull request. Schrijf niet rechtstreeks naar main en publiceer niets zonder mijn afzonderlijke toestemming.",
 "Vertel eerlijk wat niet uitgevoerd of niet gecontroleerd is."
 ].join("\n");
}
