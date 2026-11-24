// EAIgit: kort en doelafhankelijk. Instructies zijn geen bewijs van uitgevoerde acties.
const has=(items,part)=>Array.isArray(items)&&items.some(x=>String(x.title||x).includes(part));
const step=(id,title,description,action="",href="",help="")=>({id,title,description,action,href,help});
export function buildJourney({intent="start",source="zip",archive=null,repo=null,guidance=null,experience="guided",auditAction=null,delivery="local",aim=""}={}){
 const g=guidance||{good:[],problems:[],uncertain:[],next:[]};
 const issues=g.problems||[];
 const steps=[];
 const sensitive=Boolean(archive?.secret?.length)||issues.some(x=>x.severity==="stop");
 const zipOnly=has(issues,"ZIP in GitHub");
 const noRepo=!repo?.readable;
 const localRoute=intent==="local"||(source==="file"&&["repair","explore"].includes(intent));
 const add=(...v)=>steps.push(step(...v));
 if(sensitive){
  add("private","Controleer eerst privébestanden",source==="file"?"De bestandsnaam kan op gevoelige inhoud wijzen. Bekijk dit bestand op je eigen apparaat, deel het niet zomaar.":"In je ZIP zijn bestandsnamen gevonden die privé kunnen zijn. Open de uitgepakte map en controleer deze bestanden zelf.","","","Verwijder bijvoorbeeld wachtwoorden en sleutels uit bestanden die je online wilt zetten. Een groene controle is nog geen bewijs dat alles veilig is.");
  add("safe","Maak de map klaar",localRoute?"Houd privégegevens buiten bestanden die je aan anderen geeft. Voor lokaal gebruik hoeft niets online te staan.":"Houd privébestanden buiten je GitHub-project. Controleer daarna de bestanden die je wilt delen.","","","Je bepaalt zelf wat openbaar mag worden. EAIgit verwijdert niets.");
 }
 if(auditAction){
  const item=step("audit",auditAction.title,auditAction.description,"","",auditAction.reason);
  item.audit=auditAction;
  steps.push(item);
 }
 if(localRoute){
  const ready=archive?.readiness||null;
  const count=(ready?.external?.length||0)+(ready?.network?.length||0)+(ready?.server?.length||0);
  if(!archive&&!repo?.readable){
   add("create-local","Maak het losse bestand","Beschrijf wat de toepassing moet doen en welk apparaat het bestand moet openen. Voor een eenvoudige browsertoepassing kan één HTML-bestand met eigen CSS en JavaScript genoeg zijn. Een Python-script of ander programma kan aanvullende software nodig hebben.","","","Gebruik eventueel een gerichte AI-opdracht om een compleet bestand te laten maken. EAIgit maakt of voert dat bestand zelf niet uit.");
  }else if((source==="zip"||source==="both")&&archive){
   add("unzip","Pak de projectbestanden lokaal uit","Pak de ZIP uit op je apparaat. Bewaar alle bestanden die bij de toepassing horen in dezelfde map.","","","Een ZIP of map hoeft niet op GitHub om lokaal gebruikt te worden.");
  }
  add("offline","Controleer de voorwaarden voor lokaal gebruik",
   archive?.sourceKind==="file"&&ready?.external?.length
    ?("In "+archive.name+" zijn "+ready.external.length+" externe verwijzingen gevonden. Zonder internet kunnen die bronnen ontbreken. Controleer de verwijzingen en maak zo nodig een zelfstandige versie.")
    :archive?.sourceKind==="file"&&count
     ?"De bron bevat aanwijzingen voor netwerkgebruik, modules of een lokale server. EAIgit heeft niet getest of deze functies worden aangeroepen."
     :archive?.kind==="binary"
      ?"Dit programma is niet uitgevoerd. Controleer voor welk besturingssysteem het geschikt is, hoe het wordt gestart en welke installatie nodig is."
      :"Een HTML-bestand kan vaak rechtstreeks in een browser openen. Externe bronnen, modules, netwerkfuncties en sommige vormen van browseropslag kunnen aanvullende voorzieningen vragen.",
   "","","Een los bestand werkt op het apparaat waar je het opent. Gegevens worden niet vanzelf gedeeld of gesynchroniseerd. Een lokaal programma kan een internetverbinding nodig hebben voor bepaalde onderdelen.");
  add("try-local","Test op het apparaat en zonder internet",
   "Open het bestand met het bedoelde programma of in de browser. Zet internet tijdelijk uit en probeer de belangrijkste handeling. Controleer invoer, resultaat, opslaan en opnieuw openen.","","","Voor HTML kan file:// beperkingen hebben. Probeer waar nodig een lokale webserver op localhost. Een gevonden bestand bewijst niet dat de toepassing werkt.");
  if(delivery==="share"){
   add("file-sharing","Controleer of anderen het bestand kunnen gebruiken",
    "Kopieer het bestand naar een tweede geschikt apparaat en open het daar. Neem benodigde bestanden, fonts en bibliotheken mee en vermeld benodigde installaties.","","","Alleen een bestand delen synchroniseert geen gegevens. De ontvanger moet de toepassing kunnen starten op het eigen besturingssysteem.");
  }else if(delivery==="online"){
   add("local-hosting","Bepaal wat nodig is om online te publiceren",
    "Een HTML-bestand zonder serverfuncties kan vaak statisch online staan. Een script, database of programma vraagt mogelijk andere hosting. Kies een publicatiemethode pas na controle van de werking en de gegevens.","","","EAIgit heeft niets gepubliceerd. Online beschikbaar maken is iets anders dan lokaal een bestand openen.");
  }
 }else if(source==="file"&&archive&&intent==="start"){
  add("create","Maak een repository op GitHub","Maak een repository en bepaal of deze openbaar of privé mag zijn.","Open GitHub","https://github.com/new","Voor een los bestand is uitpakken niet nodig. Deel geen gevoelige gegevens.");
  add("upload","Voeg het losse bestand toe","Upload het bestand in de repository en controleer het resultaat voordat je de wijziging bevestigt.","","","Eén bestand is niet automatisch een werkend programma of volledig project.");
 }else if(source==="file"&&archive&&intent==="publish"){
  add("offline","Bepaal hoe je het losse bestand start","Controleer of dit een gewone HTML-pagina is of een toepassing die meer bestanden, een build of een server nodig heeft.","","","Een lokaal programma kan niet zomaar als website worden gepubliceerd.");
 }else if(zipOnly){
  add("unzip","Pak de ZIP uit","GitHub heeft een ZIP-bestand, maar niet de losse projectbestanden. Pak het ZIP-bestand uit op je eigen apparaat.","","","Je mag de ZIP bewaren als reservekopie, maar GitHub kan de code in die ZIP niet als losse bestanden bewerken.");
  add("files","Zet de losse bestanden in GitHub","Open je repository. Kies 'Add file' en daarna 'Upload files'. Voeg de projectbestanden toe met hun mappen.","Open repository",repo?.url||"","Zet geen privébestanden online. Klik pas op 'Commit changes' als je de bestanden hebt gecontroleerd.");
 }else if((source==="zip"||source==="both")&&archive){
  if(!sensitive)add("unzip","Pak de ZIP uit","Pak het bestand uit op je eigen apparaat en controleer de losse projectbestanden.","","","GitHub pakt een ZIP niet vanzelf uit.");
  if(["repair","explore"].includes(intent)){
   // Alleen onderzoeken of herstellen vereist geen GitHub-account of upload.
   // Bij twee bronnen kan een vergelijking helpen, maar niets wordt overschreven.
   if(!noRepo)add("compare","Onderzoek verschillen met GitHub",
    "Bekijk welke bestanden in je ZIP en op GitHub verschillen. Bepaal welke versie hoort bij je doel voordat je iets wijzigt.",
    "Open repository",repo.url,
    "EAIgit kan niet alle bestandsinhoud vergelijken. Onzekere overeenkomsten blijven onbeslist.");
  }else if(noRepo){
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
 if(!localRoute&&archive?.missingReferences?.length&&auditAction?.type!=="missing-reference"){
  add("references","Controleer ontbrekende bestanden","De startpagina verwijst naar bestanden die niet op de verwachte plek staan. Kijk of je ze nog hebt en pas zo nodig de verwijzingen aan.","","","Een bestandsnaam kan goed zijn terwijl de website alsnog niet werkt.");
 }
 if(repo?.readable&&!localRoute){
  add("actions","Bekijk de controles","Open GitHub Actions om te zien of er automatische controles voor je project zijn.","Bekijk controles",repo.url+"/actions","Een groene controle vertelt alleen iets over de onderdelen die daadwerkelijk zijn getest.");
 }
 const targetTest=g.goalTest;
 const addGoalTest=()=>add("try",targetTest?.title||"Probeer de belangrijkste functie",targetTest?.action||"Open je project en controleer of het doet wat jij ermee wilt bereiken.","","", "Een gevonden functie of bestandsnaam bewijst nog niet dat deze goed werkt.");
 if(intent==="publish"){
  addGoalTest();
  const staticHtml=Boolean(archive?.project?.hasHtml)&&!archive?.project?.hasPackage;
  add("publishing","Bereid de website voor","Controleer of je website in de browser werkt en of de nodige bestanden aanwezig zijn.",repo?.readable?"Open instellingen":"Lees uitleg",repo?.readable?repo.url+"/settings/pages":"https://docs.github.com/en/pages",staticHtml?"GitHub Pages kan statische HTML publiceren. Publicatie moet je zelf apart instellen.":"GitHub Pages is niet voor iedere toepassing geschikt. Een server of bouwstap kan andere hosting nodig hebben.");
 }else if(!localRoute)addGoalTest();
 while(steps.length>7){
  const optional=steps.findIndex(x=>x.id==="actions"||x.id==="repo");
  if(optional<0)break;
  steps.splice(optional,1);
 }
 const chosen=steps.slice(0,7);
 if(experience!=="compact")return chosen;
 // Een tweede niveau heeft eigen werkinstructies in plaats van dezelfde tekst
 // achter een ander knopje. Zonder brongegevens worden geen details verzonnen.
 const expertText={
  private:"Controleer de verdachte bestandsnamen en inhoud lokaal op credentials, .env, keys en persoonsgegevens. Leg vast welke bestanden niet in GitHub mogen staan.",
  safe:"Controleer .gitignore en de te uploaden bestandslijst. Verwijder gevoelige bestanden uit de projectmap voordat je een commit voorbereidt.",
  unzip:"Pak de ZIP lokaal uit, controleer de projectroot en behoud relatieve paden. Commit geen ZIP als vervanging voor losse bronbestanden.",
  create:"Maak op GitHub een repository, kies bewust Public of Private en controleer de standaardbranch. Noteer de repository-URL voor de volgende stap.",
  upload:"Open de repository en upload alleen de bedoelde bronbestanden met hun directorystructuur. Controleer het diff voordat je commit.",
  files:"Zet de uitgepakte bestanden als bronbestanden in GitHub. Controleer na de commit de exacte paden en lees een aantal bestanden terug.",
  compare:"Controleer ontbrekende en gewijzigde bestanden afzonderlijk. Gelijknamige bestanden zonder hashvergelijking zijn nog niet inhoudelijk gelijk verklaard.",
  references:"Controleer lokale href-, src- en importpaden, inclusief hoofdlettergebruik en relatieve projectroot. Test de verwijzing in de browser.",
  actions:"Open de laatste GitHub Actions-run, bekijk de uitgevoerde jobs, logs en testdekking. Een groene workflow bewijst geen eindgebruikersfunctie.",
  repo:"Controleer standaardbranch, projectroot, README en relevante bronbestanden in de openbare GitHub-repository.",
  publishing:"Controleer hostingtype, eventuele buildoutput, bronbranch en publicatie-instellingen. Voer daarna een live browserproef uit.",
  source:"Bepaal de vindplaats van de projectbron: een lokaal bestand, ZIP of openbare repository-URL. Een private repository is hier niet rechtstreeks leesbaar.",
  offline:"Controleer alle externe URLs, modules, netwerkcalls, installaties en file://-beperkingen. Test op het werkelijke apparaat, eerst online en vervolgens offline.",
  "create-local":"Leg het gewenste bestandstype en de gebruikershandeling vast. Maak een zelfstandig bestand waar de gekozen technologie dat toelaat. Bewaar het lokaal en voer daarna een echte gebruikstest uit.",
  "try-local":"Open de toepassing op het doelapparaat, maak de netwerkverbinding tijdelijk uit en controleer invoer, uitvoer, opslag en herstart.",
  "file-sharing":"Test een complete kopie op een schoon tweede apparaat zonder vooraf geïnstalleerde projectafhankelijkheden.",
  "local-hosting":"Bepaal build, uitvoeromgeving en hosting voor de applicatie. Laat publicatie pas uitvoeren na een aparte expliciete opdracht."
 };
 const count=(archive?.eligible||[]).length;
 const missing=archive?.missingReferences?.length||0;
 for(const item of chosen){
  if(expertText[item.id])item.description=expertText[item.id];
  if(item.id==="unzip"&&count)item.description+=" Gevonden: "+count+" mogelijke projectbestanden.";
  if(item.id==="references"&&missing)item.description+=" Er "+(missing===1?"ontbreekt één lokale verwijzing.":"ontbreken "+missing+" lokale verwijzingen.");
  if(item.id==="try"&&g.goalTest?.action)item.description=g.goalTest.action+" Leg verwachte en waargenomen uitkomst apart vast.";
  if(item.id==="audit"&&item.audit)item.description=item.audit.rawDetail+" Begin bij "+(item.audit.path||"de projectstructuur")+(item.audit.line?" regel "+item.audit.line:"")+".";
 }
 return chosen;
}
export function primaryFinding(guidance,{archive=null,repo=null,repoError=null,intent=null}={}){
 const problems=guidance?.problems||[];
 const first=problems.find(x=>x.severity==="stop")||problems[0];
 if(first)return {label:"Dit vraagt aandacht",title:first.title,description:first.detail,kind:first.severity==="stop"?"warning":"attention"};
 if(!archive&&!repo?.readable&&!repoError){
  return {label:"Nog geen controle",title:"Er zijn nog geen bestanden onderzocht",
   description:intent==="local"?"Je kunt een los bestand maken en lokaal testen zonder GitHub. Er is nog geen code onderzocht.":"Voeg een bestand, ZIP of openbare GitHub-repository toe om de bron te controleren.",kind:"info"};
 }
 return {label:"Gevonden",title:"Je bestanden zijn bekeken",description:(guidance?.good||[])[0]||"Voor een uitgebreidere controle zijn meer gegevens nodig.",kind:"ok"};
}
export function helpPrompt(step,repositoryUrl="",intent="start",aim="",delivery="local"){
 if(!step)return "";
 if(step.id==="audit")return step.audit?.prompt||"";
 const repo=repositoryUrl||"[vul je GitHub-link in]";
 const rules="Gebruik eenvoudige stappen. Verander niets in mijn repository zonder mijn toestemming. Verzin geen testresultaten.";
 if(["private","safe"].includes(step.id))return "";
 if(["create-local","offline","try-local","file-sharing","local-hosting"].includes(step.id))return [
  "Ik wil een los bestand of programma, zonder verplichte GitHub-repository.",
  "Mijn doel: "+(aim||"[beschrijf de gewenste functie]")+".",
  "Gebruik: "+({local:"alleen lokaal",share:"als bestand delen",online:"online aanbieden"}[delivery]||"lokaal")+".",
  "Help me nu met: "+step.title+".",
  "Stel een passend bestandsformaat voor. Een zelfstandige HTML-pagina mag CSS en JavaScript intern bevatten.",
  "Noem expliciet welke externe onderdelen, installaties, lokale server of internetverbinding nodig zijn. Doe geen alsof het offline werkt zonder bewijs.",
  "Geef het volledige bestand of alleen de kleinste nodige aanpassing, met uitleg hoe ik het lokaal kan opslaan en testen.",
  "Voer geen onbekende software uit en publiceer niets zonder mijn toestemming. Verzin geen testresultaten."
 ].join("\n");
 if(intent==="local"&&step.id==="unzip")return [
  "Ik wil de bestanden in een ZIP lokaal op mijn apparaat gebruiken.",
  "Mijn doel: "+(aim||"[beschrijf de gewenste functie]")+".",
  "Leg uit hoe ik de ZIP lokaal uitpak en de benodigde bestanden bij elkaar houd.",
  "Help me testen op het bedoelde apparaat, ook zonder internet. Controleer extra afhankelijkheden en maak geen schijnclaims.",
  "Wijzig of publiceer niets zonder mijn toestemming."
 ].join("\n");
 if(["create","unzip","upload","files","compare"].includes(step.id))
  return "Help me met deze stap in GitHub: "+step.title+".\nMijn situatie: "+step.description+"\nRepository: "+repo+"\nLeg alleen de volgende handeling uit, alsof ik GitHub nog niet ken. "+rules;
 if(["references","actions","try","publishing","repo"].includes(step.id))
  return "Onderzoek mijn project: "+repo+"\nMijn doel: "+({publish:"publiceren",repair:"een probleem oplossen",start:"mijn project op GitHub zetten",explore:"begrijpen wat ik heb"}[intent]||"mijn project verbeteren")+".\nHelp me nu met: "+step.title+". Geef bronlinks bij fouten en zeg wat niet is getest. "+rules;
 return "";
}
