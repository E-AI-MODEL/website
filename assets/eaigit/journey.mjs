// EAIgit: kort en doelafhankelijk. Instructies zijn geen bewijs van uitgevoerde acties.
const has=(items,part)=>Array.isArray(items)&&items.some(x=>String(x.title||x).includes(part));
const step=(id,title,description,action="",href="",help="")=>({id,title,description,action,href,help});
export function buildJourney({intent="start",source="zip",archive=null,repo=null,guidance=null}={}){
 const g=guidance||{good:[],problems:[],uncertain:[],next:[]};
 const issues=g.problems||[];
 const steps=[];
 const sensitive=Boolean(archive?.secret?.length)||issues.some(x=>x.severity==="stop");
 const zipOnly=has(issues,"ZIP in GitHub");
 const noRepo=!repo?.readable;
 const add=(...v)=>steps.push(step(...v));
 if(sensitive){
  add("private","Controleer eerst privébestanden","In je ZIP zijn bestandsnamen gevonden die privé kunnen zijn. Open de uitgepakte map en controleer deze bestanden zelf.","","","Verwijder bijvoorbeeld wachtwoorden en sleutels uit bestanden die je online wilt zetten. Een groene controle is nog geen bewijs dat alles veilig is.");
  add("safe","Maak de map klaar","Houd privébestanden buiten je GitHub-project. Controleer daarna de bestanden die je wilt delen.","","","Je bepaalt zelf wat openbaar mag worden. EAIgit verwijdert niets.");
 }
 if(zipOnly){
  add("unzip","Pak de ZIP uit","GitHub heeft een ZIP-bestand, maar niet de losse projectbestanden. Pak het ZIP-bestand uit op je eigen apparaat.","","","Je mag de ZIP bewaren als reservekopie, maar GitHub kan de code in die ZIP niet als losse bestanden bewerken.");
  add("files","Zet de losse bestanden in GitHub","Open je repository. Kies 'Add file' en daarna 'Upload files'. Voeg de projectbestanden toe met hun mappen.","Open repository",repo?.url||"","Zet geen privébestanden online. Klik pas op 'Commit changes' als je de bestanden hebt gecontroleerd.");
 }else if((source==="zip"||source==="both")&&archive){
  if(!sensitive)add("unzip","Pak de ZIP uit","Pak het bestand uit op je eigen apparaat en controleer de losse projectbestanden.","","","GitHub pakt een ZIP niet vanzelf uit.");
  if(noRepo){
   add("create","Maak een repository op GitHub","Open GitHub en maak een nieuwe repository. Je kunt zelf bepalen of die openbaar of privé wordt.","Open GitHub","https://github.com/new","Je hebt hiervoor een GitHub-account nodig. Het is niet nodig om code te installeren.");
   add("upload","Voeg je bestanden toe","Open je nieuwe repository. Kies 'Add file' en 'Upload files'. Voeg de losse projectbestanden toe en controleer de mappen.","","","Upload niet alleen het ZIP-bestand. Kies zelf welke bestanden mee mogen.");
  }else{
   add("compare","Bekijk wat nog ontbreekt","Vergelijk de bestandslijst van je ZIP met die van GitHub. Voeg alleen de ontbrekende of bijgewerkte projectbestanden toe.","Open repository",repo.url,"EAIgit vergelijkt hier bestandsnamen. De inhoud van twee gelijknamige bestanden is nog niet vergeleken.");
  }
 }else if(repo?.readable){
  add("repo","Open je project op GitHub","Bekijk welke bestanden er staan en of de mappen herkenbaar zijn.","Open repository",repo.url,"In GitHub vind je de bestanden via het tabblad 'Code'.");
 }else{
  add("source","Zoek je projectbestanden","Een ZIP-bestand of een link naar een openbare GitHub-repository is nodig om gericht verder te kunnen.","","","Op GitHub kun je de projectlink kopiëren uit de adresbalk.");
 }
 if(archive?.missingReferences?.length){
  add("references","Controleer ontbrekende bestanden","De startpagina verwijst naar bestanden die niet op de verwachte plek staan. Kijk of je ze nog hebt en pas zo nodig de verwijzingen aan.","","","Een bestandsnaam kan goed zijn terwijl de website alsnog niet werkt.");
 }
 if(repo?.readable){
  add("actions","Bekijk de controles","Open GitHub Actions om te zien of er automatische controles voor je project zijn.","Bekijk controles",repo.url+"/actions","Een groene controle vertelt alleen iets over de onderdelen die daadwerkelijk zijn getest.");
 }
 const targetTest=g.goalTest;
 const addGoalTest=()=>add("try",targetTest?.title||"Probeer de belangrijkste functie",targetTest?.action||"Open je project en controleer of het doet wat jij ermee wilt bereiken.","","", "Een gevonden functie of bestandsnaam bewijst nog niet dat deze goed werkt.");
 if(intent==="publish"){
  addGoalTest();
  const staticHtml=Boolean(archive?.project?.hasHtml)&&!archive?.project?.hasPackage;
  add("publishing","Bereid de website voor","Controleer of je website in de browser werkt en of de nodige bestanden aanwezig zijn.",repo?.readable?"Open instellingen":"Lees uitleg",repo?.readable?repo.url+"/settings/pages":"https://docs.github.com/en/pages",staticHtml?"GitHub Pages kan statische HTML publiceren. Publicatie moet je zelf apart instellen.":"GitHub Pages is niet voor iedere toepassing geschikt. Een server of bouwstap kan andere hosting nodig hebben.");
 }else addGoalTest();
 while(steps.length>7){
  const optional=steps.findIndex(x=>x.id==="actions"||x.id==="repo");
  if(optional<0)break;
  steps.splice(optional,1);
 }
 return steps.slice(0,7);
}
export function primaryFinding(guidance){
 const p=guidance?.problems||[];
 const first=p.find(x=>x.severity==="stop")||p[0];
 if(first)return {label:"Dit vraagt aandacht",title:first.title,description:first.detail,kind:first.severity==="stop"?"warning":"attention"};
 return {label:"Gevonden",title:"Je bestanden zijn bekeken",description:(guidance?.good||[])[0]||"Voor een uitgebreidere controle zijn meer gegevens nodig.",kind:"ok"};
}
export function helpPrompt(step,repositoryUrl="",intent="start"){
 if(!step)return "";
 const repo=repositoryUrl||"[vul je GitHub-link in]";
 const rules="Gebruik eenvoudige stappen. Verander niets in mijn repository zonder mijn toestemming. Verzin geen testresultaten.";
 if(["private","safe"].includes(step.id))return "";
 if(["create","unzip","upload","files","compare"].includes(step.id))
  return "Help me met deze stap in GitHub: "+step.title+".\nMijn situatie: "+step.description+"\nRepository: "+repo+"\nLeg alleen de volgende handeling uit, alsof ik GitHub nog niet ken. "+rules;
 if(["references","actions","try","publishing","repo"].includes(step.id))
  return "Onderzoek mijn project: "+repo+"\nMijn doel: "+({publish:"publiceren",repair:"een probleem oplossen",start:"mijn project op GitHub zetten",explore:"begrijpen wat ik heb"}[intent]||"mijn project verbeteren")+".\nHelp me nu met: "+step.title+". Geef bronlinks bij fouten en zeg wat niet is getest. "+rules;
 return "";
}
