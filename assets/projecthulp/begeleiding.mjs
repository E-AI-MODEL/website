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
export function makeGuidance({archive=null,repo=null,advice=null,goal="site",aim="",repoError=null}={}){
 const good=[],problems=[],uncertain=[],next=[],reference=repoLink(repo);
 const purpose=goalName(goal);
 const addGood=(x)=>good.push(x);
 if(archive){
  addGood("Het ZIP-bestand is lokaal onderzocht: "+archive.eligible.length+" mogelijke projectbestanden gevonden.");
  if(archive.project?.hasHtml)addGood("Er zijn HTML-bestanden gevonden. Dat kan een startpunt zijn voor een website of browsertoepassing.");
  if(archive.project?.hasReadme)addGood("Er staat al een README met informatie over het project.");
  if(archive.project?.hasTests)addGood("Er zijn bestanden aangetroffen die op tests wijzen. We hebben ze nog niet uitgevoerd.");
  if(archive.project?.framework)addGood("De projectbestanden wijzen op "+archive.project.framework+". Een ander framework is niet automatisch nodig.");
  if(archive.secret?.length)problems.push(issue("Mogelijk privébestanden in je ZIP",archive.secret.length+" bestandsnamen lijken vertrouwelijk. Controleer die zelf en zet ze niet zomaar openbaar.","stop"));
  if(archive.manifestError)problems.push(issue("Projectinstellingen niet goed leesbaar",archive.manifestError,"attention","package.json"));
  if(archive.missingReferences?.length)problems.push(issue("Verwijzingen naar ontbrekende bestanden",archive.missingReferences.length+" lokale bestandsverwijzingen konden niet worden gevonden: "+archive.missingReferences.slice(0,4).map(display).join(", ")+".","attention",archive.indexPath||"index.html"));
  if(archive.ignored?.length)uncertain.push("Er zijn "+archive.ignored.length+" tijdelijke of installatiebestanden herkend. Controleer welke je echt nodig hebt.");
 }else uncertain.push("We hebben nog geen ZIP-bestand onderzocht. Het advies is daardoor beperkt.");
 if(repo?.readable){
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
 else uncertain.push("Nog geen openbare GitHub-repository gecontroleerd.");
 if(advice?.comparison&&repo?.readable&&!repo.truncated&&archive){
  const n=advice.comparison.missingCount||0;
  if(n>0)problems.push(issue(n===1?"Eén bestand staat nog niet in GitHub":n+" bestanden staan nog niet in GitHub","Vergelijk de mappen en voeg de ontbrekende uitgepakte bestanden toe. Gelijke bestandsnamen bewijzen niet dat de inhoud gelijk is.","attention"));
  else addGood("Alle onderzochte projectbestandsnamen komen ook in GitHub voor. De inhoud is nog niet vergeleken.");
 }
 if(goal==="site"&&archive&&!archive.project?.hasHtml)problems.push(issue("Startpagina niet vastgesteld","Er is geen herkenbaar HTML-bestand gevonden. Mogelijk moet dit project eerst gebouwd worden.","attention"));
 if(!good.length)good.push("We hebben nog te weinig gecontroleerde informatie om onderdelen als goed te beoordelen.");
 uncertain.push("Codefouten zijn nog niet getest met een compiler of linter. We kunnen niet zeggen dat de code foutloos is.");
 uncertain.push("Logische fouten of ontbrekende werking kun je pas vaststellen met gerichte gebruikstests. We hebben de projectcode niet uitgevoerd.");
 if(archive?.secret?.length)next.push("Bekijk de mogelijk vertrouwelijke bestanden op je eigen apparaat en bepaal wat openbaar mag worden.");
 else if(!archive)next.push("Selecteer je ZIP-bestand zodat de projectbestanden kunnen worden onderzocht.");
 else if(!repo?.readable)next.push("Voeg de link naar je openbare GitHub-repository toe en controleer of de repository bereikbaar is.");
 else if(problems.some(x=>x.title.includes("ZIP in GitHub")))next.push("Pak het ZIP-bestand op je eigen apparaat uit. GitHub pakt een geüpload ZIP niet automatisch uit.");
 else if(advice?.comparison?.missingCount)next.push("Voeg de ontbrekende losse bestanden toe aan GitHub. Bewaar de mapindeling en controleer eventuele privégegevens.");
 else if(problems.some(x=>x.title.includes("Verwijzingen")))next.push("Controleer de verwijzingen vanuit de startpagina en herstel de ontbrekende bestanden.");
 else next.push("Controleer of de belangrijkste gebruikershandeling werkt, en besluit pas daarna of je iets wilt publiceren.");
 if(reference)next.push("Open de repository om de bestanden en de eventuele controles in GitHub te bekijken.");
 if(archive&&repo?.readable)next.push("Laat vervolgens een codecheck uitvoeren. Gebruik de GitHub-workflow of Codex; deze browsercontrole is nog geen echte functionele test.");
 return {purpose,goal,aim:String(aim||"").trim().slice(0,220),good,problems,uncertain,next:next.slice(0,3),
  repoUrl:reference,
  actionsUrl:reference?reference+"/actions":null,
  helpUrl:"https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt",
  codexUrl:"https://codex.openai.com/",
  codexHelpUrl:"https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
  // Benoem niet-verifieerbare fouten nooit als bewezen.
  codeErrorsVerified:false,logicErrorsVerified:false
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
