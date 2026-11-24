// Hulp op het juiste moment. Korte stappen; langere uitleg staat op de hulppagina.
export const HELP_TOPICS={
 goal:{title:"Wat wil je bereiken?",intro:"Een los bestand, een offline programma en een online website zijn verschillende eindresultaten. Kies wat je wilt doen.",steps:["Een website is iets wat bezoekers in een browser openen.","Een toepassing heeft functies waarmee iemand iets doet.","Je kunt je keuze later aanpassen."],links:[]},
 source:{title:"Waar staan je bestanden?",intro:"EAIgit hoeft niet meer te weten dan waar het project nu staat.",steps:["Je kunt één los bestand kiezen, een ZIP met meerdere bestanden of een openbare GitHub-repository.","Een repository is een projectmap op GitHub, met eerdere versies.","Een los bestand en een ZIP kun je onderzoeken zonder GitHub-account."],links:[{label:"Wat is een repository?",url:"https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories"}]},
 zip:{title:"Wat is een ZIP?",intro:"Een ZIP is een ingepakte map. GitHub pakt een geüpload ZIP-bestand niet automatisch uit.",steps:["Kies de ZIP via de knop Bestandskeuze.","EAIgit bekijkt de inhoud in je browser. Je ZIP wordt niet naar onze server verstuurd.","Voordat je bestanden op GitHub zet, pak je de ZIP op je eigen apparaat uit en bekijk je welke bestanden meegaan."],links:[]},
 repo:{title:"Waar vind je je GitHub-link?",intro:"Een repository is de plek waar GitHub de bestanden en wijzigingen van je project bewaart.",steps:["Open https://github.com en meld je zo nodig aan.","Open jouw repository. Dat is de pagina met de lijst projectbestanden.","Kopieer het volledige adres uit de adresbalk, bijvoorbeeld https://github.com/naam/project.","Plak de link in EAIgit. Alleen openbare repositories kunnen hier zonder koppeling worden gelezen."],links:[{label:"GitHub openen",url:"https://github.com/"},{label:"GitHub voor beginners",url:"https://docs.github.com/en/get-started/start-your-journey/creating-a-repository-for-your-project-on-github"}]},
 aim:{title:"Wat moet het project kunnen?",intro:"Beschrijf het resultaat alsof je het aan een bezoeker uitlegt.",steps:["Bijvoorbeeld: bezoekers kunnen een oefening openen en het antwoord nakijken.","Je hoeft niet te weten welke programmeertaal of techniek is gebruikt.","EAIgit kan controleren welke bestanden aanwezig zijn, niet vanzelf of alles ook echt werkt."],links:[]},
 findings:{title:"Wat betekenen de uitkomsten?",intro:"EAIgit maakt verschil tussen wat is gevonden en wat werkelijk is getest.",steps:["‘Dit is goed’ betekent dat er concrete aanwijzingen zijn, zoals een startbestand of README.","‘Dit vraagt aandacht’ verwijst naar een aangetroffen probleem of ontbrekend onderdeel.","‘Nog niet getest’ is geen foutmelding. De werking moet apart worden gecontroleerd."],links:[]},
 single:{
  title:"Wat gebeurt er met een los bestand?",
  intro:"EAIgit leest één gekozen bestand lokaal in een browserworker. Er wordt niets uitgevoerd, geïnstalleerd of geüpload.",
  steps:[
   "Kies een HTML-, JavaScript-, Python-, tekst- of ander bestand van maximaal 8 MB.",
   "Bij leesbare tekst controleert EAIgit een beperkt deel van de syntaxis, verwijzingen en mogelijke internetafhankelijkheden.",
   "Een uitvoerbaar programma wordt niet gestart. De bestandsextensie bewijst niet dat het programma veilig is of werkt.",
   "Bij één los bestand kan EAIgit niet zien welke andere bestanden op je apparaat aanwezig zijn. Een ontbrekende verwijzing is alleen een aanwijzing.",
   "Een los bestand draait op het apparaat waarop je het opent. Je kunt het kopiëren, maar gegevens worden niet vanzelf gesynchroniseerd."
  ],links:[]
 },
 offline:{
  title:"Werkt mijn bestand zonder internet?",
  intro:"Een zelfstandige HTML-pagina kan vaak lokaal worden geopend. Dat is geen garantie voor alle functies.",
  steps:[
   "Een bestand op je apparaat gebruik je alleen daar waar het wordt geopend, of op een ander apparaat waar je het heen kopieert.",
   "Externe afbeeldingen, fonts, JavaScript-bibliotheken, API's en aanmeldfuncties kunnen zonder netwerk stoppen met werken.",
   "Browsers beperken sommige functies vanaf file://, onder andere module-imports en toegang tot andere lokale bestanden. Een lokale server op localhost kan nodig zijn.",
   "Browseropslag en bestanden op schijf worden niet vanzelf tussen computers gedeeld. Het gedrag van opslag via file:// kan per browser verschillen.",
   "Test op het juiste apparaat, verbreek daarna de internetverbinding en herhaal de belangrijkste functies. EAIgit voert deze gebruikstest niet zelf uit."
  ],links:[{label:"Browserbeveiliging en lokale bestanden",url:"https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy"}]
 },
 createLocal:{
  title:"Hoe maak ik één zelfstandig bestand?",
  intro:"Bepaal eerst welk bestandstype bij de functie past. GitHub is niet verplicht.",
  steps:[
   "Een eenvoudige interactieve browserpagina kan soms als één .html-bestand worden geleverd met de CSS en JavaScript in dat bestand.",
   "Een Python-script vraagt doorgaans een geschikte Python-installatie. Andere programma's hebben soms een installer, bibliotheken of specifieke systeemrechten nodig.",
   "Vraag desgewenst in ChatGPT om de volledige inhoud van het bestand, zonder onnodige externe afhankelijkheden.",
   "Sla het bestand lokaal op en controleer bestandsnaam en extensie. Een codefragment in een chat is nog geen werkend bestand.",
   "Open en test het resultaat echt. EAIgit schrijft, installeert of publiceert het bestand niet automatisch."
  ],links:[]
 },
 tryLocal:{
  title:"Hoe test ik een bestand lokaal?",
  intro:"Een syntaxiscontrole is geen bewijs dat iemand het programma kan gebruiken.",
  steps:[
   "Open het bestand op het bedoelde apparaat met een passend programma of in een browser.",
   "Test de belangrijkste handeling met een juiste en een onjuiste invoer.",
   "Zet internet tijdelijk uit en herhaal dezelfde handeling.",
   "Controleer of gegevens na sluiten en opnieuw openen blijven bestaan, als de toepassing dat moet kunnen.",
   "Herhaal op een tweede apparaat of browser als je het bestand aan anderen wilt geven."
  ],links:[]
 },
 sharingLocal:{
  title:"Hoe deel ik een offline bestand?",
  intro:"Bestandsdeling is niet hetzelfde als een online dienst.",
  steps:[
   "Deel het originele bestand en alle werkelijk benodigde hulpbestanden; controleer dat niemand onbedoeld privégegevens ontvangt.",
   "Een HTML-bestand kan op een ander apparaat in een browser openen, maar externe onderdelen kunnen ontbreken.",
   "Software en scripts moeten passen bij besturingssysteem, rechten en geïnstalleerde programma's.",
   "Test de kopie op een ander apparaat. Bestandskopieën delen of synchroniseren geen opgeslagen gegevens uit zichzelf."
  ],links:[]
 },
 hostingLocal:{
  title:"Wat verandert er bij online publiceren?",
  intro:"Een bestand op de computer is nog geen publiek bereikbare website of online dienst.",
  steps:[
   "Voor eenvoudige statische HTML kan hosting van losse bestanden voldoende zijn.",
   "Een server, database, inlogfunctie of buildproces vraagt een geschikte uitvoeromgeving.",
   "Controleer of bestanden, persoonlijke gegevens en instellingen wel openbaar mogen worden.",
   "EAIgit publiceert niet en schakelt geen server in. Dit vraagt een aparte expliciete opdracht."
  ],links:[]
 },
 private:{title:"Wat moet privé blijven?",intro:"In projectbestanden kunnen wachtwoorden, sleutels, persoonsgegevens en instellingen zitten.",steps:["Controleer bijvoorbeeld .env, geheime sleutels, tokens en persoonlijke gegevens.","Zet zulke bestanden niet zomaar in een openbare repository.","Bepaal zelf wat gedeeld mag worden. EAIgit verwijdert of publiceert niets."],links:[{label:"Gevoelige gegevens op GitHub",url:"https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository"}]},
 safe:{title:"Hoe maak je de map klaar?",intro:"Bepaal welke losse bestanden echt bij je project horen.",steps:["Bewaar je originele ZIP als reservekopie op je apparaat.","Maak een uitgepakte projectmap zonder privébestanden of onnodige installatiebestanden.","Controleer of een eventuele .gitignore past bij je project. Niet iedere build-map is overbodig."],links:[{label:"Bestanden toevoegen",url:"https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository"}]},
 unzip:{title:"Hoe pak je een ZIP uit?",intro:"GitHub kan de inhoud pas als projectbestanden gebruiken nadat je de ZIP hebt uitgepakt.",steps:["Windows: klik met rechts op de ZIP en kies ‘Alles uitpakken’.","Mac: dubbelklik op de ZIP. Er verschijnt een map.","Open de map en controleer of de projectbestanden erin staan. Upload straks die inhoud, niet alleen de ZIP."],links:[]},
 create:{title:"Hoe maak je een repository?",intro:"Een repository is een online projectmap waarin GitHub je bestanden en eerdere versies bijhoudt.",steps:["Open github.com/new en meld je aan bij GitHub.","Geef je repository een korte herkenbare naam.","Kies Public of Private. Private houdt de bestanden afgeschermd voor wie geen toegang heeft.","Klik op ‘Create repository’. Kopieer daarna de nieuwe repositorylink naar EAIgit."],links:[{label:"Maak een repository",url:"https://github.com/new"},{label:"Uitleg van GitHub",url:"https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository"}]},
 upload:{title:"Hoe zet je bestanden op GitHub?",intro:"GitHub bewaart losse projectbestanden en hun wijzigingen. Een ZIP uploaden is niet hetzelfde als uitpakken.",steps:["Open de repository en kies ‘Add file’ en daarna ‘Upload files’.","Selecteer de uitgepakte projectbestanden en behoud de mapstructuur.","Controleer dat geen wachtwoorden of andere privégegevens meegaan.","Kies bij voorkeur een aparte branch voor wijzigingen en bekijk wat je uploadt voordat je ‘Commit changes’ bevestigt."],links:[{label:"Bestanden uploaden",url:"https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository"}]},
 files:{title:"Welke bestanden zet je op GitHub?",intro:"Het gaat om de bestanden die het project vormen, niet om het ZIP-bestand als één bestand.",steps:["Pak de ZIP uit op je apparaat.","Selecteer de relevante bestanden en mappen.","Gebruik in GitHub ‘Add file’ > ‘Upload files’. Controleer de lijst voor je de wijziging bevestigt."],links:[{label:"Uploadhandleiding",url:"https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository"}]},
 compare:{title:"Hoe vergelijk je twee versies?",intro:"Een bestand met dezelfde naam kan toch andere inhoud hebben.",steps:["Bekijk welke bestanden EAIgit in de ZIP en op GitHub heeft gevonden.","Controleer zelf welke versie je wilt houden.","Voeg alleen de juiste bestanden toe, liefst via een nieuwe branch en pull request."],links:[{label:"Wijzigingen bekijken",url:"https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews"}]},
 references:{title:"Wat is een ontbrekende verwijzing?",intro:"Een HTML-pagina kan bijvoorbeeld verwijzen naar een afbeelding of script dat niet op de verwachte plek staat.",steps:["Kijk welk bestand ontbreekt volgens EAIgit.","Controleer de naam en map. Hoofdletters kunnen op een webserver verschil maken.","Herstel de verwijzing of voeg het juiste bestand toe. Test daarna de pagina opnieuw."],links:[]},
 actions:{title:"Wat is GitHub Actions?",intro:"GitHub Actions kan automatisch controles uitvoeren wanneer bestanden veranderen.",steps:["Open de repository en kies het tabblad ‘Actions’.","Kies een controle om de uitkomst te bekijken.","Groen betekent dat die controle slaagde, niet dat iedere functie van het project goed werkt.","Controleer eerst wat een nieuwe workflow uitvoert voordat je die activeert."],links:[{label:"Workflows bekijken",url:"https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history"}]},
 repoStep:{title:"Wat zie je in een repository?",intro:"Op het tabblad Code staan de bestanden en mappen van je project.",steps:["Open de repository op github.com.","Klik op een bestandsnaam om het bestand te bekijken.","Een README legt vaak uit wat het project doet.","Bij ‘Commits’ kun je eerdere wijzigingen bekijken."],links:[{label:"GitHub leren kennen",url:"https://docs.github.com/en/get-started/start-your-journey/creating-a-repository-for-your-project-on-github"}]},
 try:{title:"Hoe test je het project?",intro:"Een gevonden bestand bewijst niet dat een toepassing werkt.",steps:["Kies één handeling die de gebruiker zeker moet kunnen uitvoeren.","Voer die handeling echt uit in de browser of toepassing.","Beschrijf wat je verwachtte en wat er gebeurde.","Laat bij een fout de betreffende code en regel onderzoeken. Een syntaxcheck is geen functietest."],links:[]},
 publishing:{title:"Hoe zet je een website online?",intro:"GitHub Pages is bruikbaar voor statische websites, maar niet automatisch voor toepassingen met een server.",steps:["Controleer of de site statische HTML kan publiceren of dat eerst een bouwstap nodig is.","Open in je repository ‘Settings’ > ‘Pages’.","Bekijk welke publicatiemethode bij het project past.","Publiceer pas nadat je hebt gecontroleerd wat openbaar wordt en welke tests zijn geslaagd."],links:[{label:"GitHub Pages instellen",url:"https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site"}]},
 chatgpt:{title:"Waar helpt ChatGPT bij?",intro:"ChatGPT kan uitleg geven, mogelijkheden vergelijken en gerichte vragen over code beantwoorden.",steps:["Beschrijf wat je wilt bereiken en geef aan wat je al hebt gedaan.","Laat ChatGPT eerst onderzoeken of verduidelijken en daarna pas wijzigingen voorstellen.","Vraag om echte bestandslinks, testresultaten en een overzicht van wat nog niet is bewezen.","Beslis zelf welke wijzigingen je wilt laten uitvoeren."],links:[{label:"Open ChatGPT",url:"https://chatgpt.com/"}]},
 plugins:{title:"Wat is een plug-in?",intro:"Een plug-in kan ChatGPT toegang geven tot externe diensten of herbruikbare werkwijzen toevoegen.",steps:["Open in ChatGPT ‘Plug-ins’ en zoek GitHub of de gewenste plug-in.","Controleer welke gegevens worden gedeeld en welke repositories toegang krijgen.","Installeer of verbind alleen als je die toegang nodig hebt. Je kunt repositories later weer uitsluiten.","De standaard GitHub-koppeling van ChatGPT is bedoeld om te lezen. Voor code aanpassen en pushen gebruik je bijvoorbeeld Codex of een andere bevoegde omgeving."],links:[{label:"Plug-ins in ChatGPT",url:"https://help.openai.com/nl-nl/articles/20001256-plugins-in-chatgpt"},{label:"GitHub met ChatGPT koppelen",url:"https://help.openai.com/nl-nl/articles/11145903-connecting-github-to-chatgpt"}]},
 koppelen:{title:"Hoe verbind je GitHub met ChatGPT?",intro:"EAIgit kan openbare repositories zelfstandig lezen. Wil je dat ChatGPT ook in jouw repository kan kijken, verbind GitHub dan apart in ChatGPT.",steps:["Open in ChatGPT Instellingen > Plug-ins. Zoek GitHub of de plug-in waarin GitHub is opgenomen.","Kies de beschikbare verbindingsoptie. Meld je bij GitHub aan en geef alleen toegang tot de repositories waarmee je wilt werken.","Ga terug naar ChatGPT. Noem in je vraag de naam van de repository en wat je wilt laten onderzoeken.","Zie je GitHub niet? Controleer je abonnement, de gekozen ChatGPT-werkruimte en eventuele toestemming van een beheerder.","De standaard GitHub-verbinding van ChatGPT leest repositorybestanden. Voor code aanpassen en pushen gebruik je bijvoorbeeld Codex of een andere daarvoor bevoegde omgeving."],links:[{label:"GitHub verbinden met ChatGPT",url:"https://help.openai.com/nl-nl/articles/11145903-connecting-github-to-chatgpt"},{label:"Plug-ins bekijken",url:"https://help.openai.com/en/articles/20001256-plugins-in-chatgpt"}]},
 abonnement:{
  title:"Welk abonnement heb je nodig?",
  intro:"EAIgit zelf is vrij toegankelijk en de browsercontrole vraagt geen ChatGPT-abonnement. Voor de GitHub-plug-in en Codex gelden andere voorwaarden.",
  steps:[
   "De ZIP-controle en het bekijken van een openbare GitHub-repository op EAIgit zijn zonder ChatGPT-account te gebruiken. Voor een eigen GitHub-repository kun je een gratis GitHub-account maken.",
   "De plug-incatalogus van ChatGPT bestaat op alle abonnementen. De GitHub-verbinding kan per account, werkruimte en ChatGPT-onderdeel beschikbaar of geblokkeerd zijn. Eén gegarandeerd minimumabonnement voor iedereen is er niet.",
   "Codex is ook bij Free en Go beschikbaar, met beperkingen. Codex Cloud vraagt een daarvoor in aanmerking komend abonnement, bijvoorbeeld Plus, Pro, Business of Edu, en kan door werkruimte-instellingen beperkt zijn.",
   "Kijk in ChatGPT bij Instellingen > Plug-ins of GitHub beschikbaar is en controleer de actuele mogelijkheden en limieten van Codex."
  ],
  links:[{label:"Beschikbaarheid GitHub",url:"https://help.openai.com/nl-nl/articles/11145903-connecting-github-to-chatgpt"},{label:"Codex en abonnementen",url:"https://help.openai.com/nl-nl/articles/11369540-using-codex-with-your-chatgpt-plan"},{label:"Plug-ins in ChatGPT",url:"https://help.openai.com/nl-nl/articles/20001256-plugins-in-chatgpt"}]
 },
 skills:{title:"Wat is een skill?",intro:"Een skill is een herbruikbare werkwijze met instructies, voorbeelden of bestanden. Zo hoeft dezelfde uitleg niet steeds opnieuw.",steps:["Open in ChatGPT ‘Plug-ins’ en bekijk het tabblad ‘Vaardigheden’ als het beschikbaar is.","Een skill kan bijvoorbeeld altijd dezelfde kwaliteitscontrole of schrijfstijl toepassen.","Je hebt geen skill nodig voor één losse vraag of een enkele GitHub-upload.","Beschikbaarheid en installatie hangen af van je abonnement en werkruimte."],links:[{label:"Uitleg over Skills",url:"https://help.openai.com/nl-nl/articles/20001066-skills-in-chatgpt"}]},
 codex:{title:"Wat is Codex?",intro:"Codex kan in een daarvoor geschikte omgeving code wijzigen en wijzigingen voorbereiden.",steps:["Open codex.openai.com als jouw account toegang heeft.","Kies de repository en controleer welke machtigingen worden gevraagd.","Laat eerst onderzoeken of testen. Vraag daarna om een wijziging op een aparte branch.","Lees de voorgestelde wijzigingen en controleer de tests voordat je een pull request samenvoegt."],links:[{label:"Open Codex",url:"https://codex.openai.com/"},{label:"Codex en je abonnement",url:"https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan"}]},
 review:{title:"Wat is een pull request?",intro:"Met een pull request kun je wijzigingen beoordelen voordat ze onderdeel worden van de hoofdversie.",steps:["Laat de wijziging bij voorkeur in een aparte branch maken.","Bekijk welke bestanden veranderen en waarom.","Controleer wat de tests daadwerkelijk hebben gedaan.","Voeg pas samen na je eigen beoordeling."],links:[{label:"Wijzigingen beoordelen",url:"https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews"}]},
 codecheck:{
  title:"Wat heeft EAIgit in de code gecontroleerd?",
  intro:"EAIgit leest JavaScript, HTML, JSON en bestandsverwijzingen, zonder de toepassing uit te voeren. Een fout is niet hetzelfde als een mislukte gebruikstest.",
  steps:[
   "Open de genoemde bestandsnaam en, waar beschikbaar, het regelnummer.",
   "JavaScript-syntaxis is met een lokale parser gecontroleerd. Dit is geen volledige ESLint-controle. JSX en TypeScript vragen andere hulpmiddelen.",
   "Controleer het verband tussen HTML-elementen, ID's en JavaScript. Dynamisch aangemaakte elementen zijn niet altijd zichtbaar in de broncode.",
   "Herstel alleen de bedoelde fout en controleer daarna opnieuw. Test ook de werkelijke gebruikershandeling.",
   "EAIgit past bestanden niet aan en voert geen npm-scripts of projectcode uit."
  ],
  links:[{label:"JavaScript syntax",url:"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors"}]
 },
};
export const HELP_CATEGORIES=[
 {id:"intake",title:"Eerst je situatie bepalen",topics:["goal","aim","findings"]},
 {id:"local",title:"Los bestand en offline gebruiken",topics:["single","offline","createLocal","tryLocal","sharingLocal","hostingLocal"]},
 {id:"start",title:"Beginnen met GitHub",topics:["source","zip","unzip","repo","create","upload","files","private","safe"]},
 {id:"project",title:"Je project verbeteren",topics:["repoStep","actions","compare","references","codecheck","try","review","publishing"]},
 {id:"chatgpt",title:"ChatGPT en programmeren",topics:["chatgpt","koppelen","abonnement","plugins","skills","codex"]}
];
export const HELP_BY_STEP={
 private:"private",safe:"safe",unzip:"unzip",create:"create",upload:"upload",files:"files",compare:"compare",
 references:"references","create-local":"createLocal",offline:"offline","try-local":"tryLocal","file-sharing":"sharingLocal","local-hosting":"hostingLocal",audit:"codecheck",actions:"actions",repo:"repoStep",try:"try",publishing:"publishing",source:"source"
};
export function getHelpTopic(id){return HELP_TOPICS[id]||null;}
export function getHelpForStep(stepId){return HELP_BY_STEP[stepId]||"goal";}
