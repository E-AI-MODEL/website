// EAIgit: opdrachten voor een bewijsbare, afgebakende GitHub-werkwijze.
// De opdrachten worden alleen lokaal samengesteld en niet automatisch uitgevoerd.
export const PROMPT_PHASES=[
 {
  "id": "verkennen",
  "label": "Verkennen"
 },
 {
  "id": "opzetten",
  "label": "Opzetten"
 },
 {
  "id": "bouwen",
  "label": "Bouwen"
 },
 {
  "id": "controleren",
  "label": "Controleren"
 },
 {
  "id": "publiceren",
  "label": "Publiceren"
 },
 {
  "id": "onderhouden",
  "label": "Onderhouden"
 }
];
export const PROMPT_LIBRARY=[
 {
  "id": "begrijp",
  "phase": "verkennen",
  "title": "Wat staat er in mijn project?",
  "forWhom": "Je hebt een ZIP of repository en wilt weten wat erin zit.",
  "outcome": "Een onderbouwd overzicht van bestanden, startpunten en open vragen.",
  "body": "Project: {{REPO}}\nWat dit project moet kunnen: {{DOEL}}\n\nOnderzoek de bestaande bronbestanden. Lees de README en het startbestand, zoek de gebruikte techniek, de mappen met eigen code, de tests en de publicatie-instellingen. Controleer of genoemde bestanden werkelijk bestaan. Heb je geen toegang tot de repository of ZIP, zeg dat direct en vraag om precies de ontbrekende bron.\n\nLever een overzicht met:\n- Wat het project volgens de bestanden doet, met links naar de relevante bestanden.\n- Welke onderdelen er aantoonbaar zijn en welke alleen worden genoemd.\n- Hoe je het project vermoedelijk start, inclusief de bron van die instructie.\n- Wat niet gecontroleerd kon worden en waarom.\n- Eén logische volgende controle, passend bij mijn doel.\n\nGebruik de termen 'gevonden', 'uitgevoerd' en 'niet getest' zorgvuldig. Een aanwezige knop is nog geen werkende knop. Verander niets en verzin geen uitvoer of testresultaten."
 },
 {
  "id": "doel",
  "phase": "verkennen",
  "title": "Maak mijn doel toetsbaar",
  "forWhom": "Je hebt een idee, maar nog geen duidelijke eisen.",
  "outcome": "Concrete gebruikershandelingen en een controleerbare eerste versie.",
  "body": "Repository of projectbestanden: {{REPO}}\nWat ik wil bereiken: {{DOEL}}\n\nVertaal dit doel naar gedrag dat een bezoeker zelf kan waarnemen. Beschrijf de gebruiker, het startpunt, de handeling, de verwachte uitkomst en wat een fout of onvolledige uitkomst is. Haal eisen die al in het project staan uit echte bestanden; presenteer je eigen aanvullingen apart als voorstel.\n\nWerk maximaal vijf gebruikssituaties uit. Voeg per situatie een korte acceptatieproef toe: welke stappen zet iemand, welk resultaat moet zichtbaar zijn en welke afwijking telt als mislukking? Maak onderscheid tussen noodzakelijk voor de eerste versie en later wenselijk. Houd toegankelijkheid, gegevensopslag en mobiele bediening in beeld voor zover relevant.\n\nLever een tabel met situatie, verwachte uitkomst, toets en bron of aanname. Sluit af met de kleinste eerste versie die ik kan beoordelen. Ontwerp of programmeer nog niets. Leg alleen een keuze aan mij voor als die werkelijk nodig is."
 },
 {
  "id": "mogelijkheden",
  "phase": "verkennen",
  "title": "Welke techniek past bij dit project?",
  "forWhom": "Je wilt kiezen zonder opnieuw te beginnen.",
  "outcome": "Een vergelijking op basis van de huidige code, met duidelijke beperkingen.",
  "body": "Mijn project staat hier: {{REPO}}\nHet moet dit kunnen: {{DOEL}}\n\nBekijk eerst de bestaande technologie en wat daarvan al bruikbaar is. Controleer packagebestanden, bouwopdrachten, afhankelijkheden, hosting en dataopslag. Onderzoek pas daarna maximaal drie uitvoerbare routes, waaronder het voortzetten van de huidige aanpak. Noem officiële documentatie bij technische beperkingen.\n\nVergelijk de routes op: hergebruik van bestaande bestanden, benodigde ontwikkeling, onderhoud door iemand zonder specialistische kennis, kosten voor zover verifieerbaar, privacy en publicatie. Scheid harde feiten van aannames. Een nieuwe techniek is niet vanzelf beter.\n\nLever een compacte vergelijking, je voorkeur met onderbouwing, de gevolgen voor bestaande bestanden en drie concrete vragen die nog openstaan. Maak geen migratieplan alsof de techniek al gekozen is. Installeer, verplaats of publiceer niets."
 },
 {
  "id": "repo-start",
  "phase": "opzetten",
  "title": "Zet een ZIP goed op GitHub",
  "forWhom": "Je hebt projectbestanden lokaal en wilt versiebeheer gebruiken.",
  "outcome": "Een veilige overdracht van losse bestanden met behoud van mappen.",
  "body": "Project: {{REPO}}\nDoel: {{DOEL}}\n\nHelp me de inhoud van een ZIP naar GitHub overzetten, zonder dat ik een terminal nodig heb. Vraag eerst wat er in de ZIP staat of inspecteer die lokaal als je toegang hebt. Bepaal de projectmap, het startbestand en mappen die niet mee moeten, zoals tijdelijke bouwbestanden of dependencies. Zoek naar mogelijk gevoelige bestandsnamen en waarschuw zonder de inhoud daarvan te citeren.\n\nGeef precies één uitvoerbare handeling per stap op github.com. Begin bij een geschikte repository en de keuze openbaar of privé. Laat zien hoe ik de ZIP uitpak, losse bestanden selecteer, de mapstructuur controleer en de wijzigingen bevestig. Gebruik officiële GitHub-instructies voor de interface.\n\nLever een korte checklist waarmee ik na de upload bestandsnamen, startbestand en zichtbaarheid kan controleren. Een ZIP als één bestand uploaden telt niet als geslaagde overdracht. Upload of commit niets namens mij zonder expliciete toestemming."
 },
 {
  "id": "plan",
  "phase": "opzetten",
  "title": "Maak een uitvoerbaar wijzigplan",
  "forWhom": "Je wilt meerdere onderdelen aanpassen en grip houden op het werk.",
  "outcome": "Een kleine reeks taken, elk met bewijs en een eigen test.",
  "body": "Repository: {{REPO}}\nGewenste uitkomst: {{DOEL}}\n\nLees eerst de relevante bestanden, bestaande tests en eventuele openstaande issues. Beschrijf wat al werkt voor zover dat aantoonbaar is. Splits de opdracht in kleine wijzigingen die afzonderlijk kunnen worden gecontroleerd. Zet afhankelijke taken in de juiste volgorde; geef aan welke taken echt naast elkaar kunnen.\n\nLever een werkoverzicht met per taak:\n- De gebruiker die er iets van merkt en het gewenste gedrag.\n- De bestanden of onderdelen die moeten veranderen, met bronlinks.\n- De concrete oplevering en de manier waarop die wordt gecontroleerd.\n- Een mogelijke terugvaloptie bij een mislukte wijziging.\n- De keuze die ik zelf moet maken, indien nodig.\n\nBeperk de eerste stap tot wat veilig en toetsbaar kan. Zet niet alle gevonden problemen op één hoop. Maak nog geen commits, installeer niets en publiceer niets. Meld wat je door ontbrekende toegang niet kunt vaststellen."
 },
 {
  "id": "structuur",
  "phase": "opzetten",
  "title": "Orden mijn repository",
  "forWhom": "Mappen en bestanden zijn moeilijk te vinden.",
  "outcome": "Een voorstel voor een begrijpelijke structuur zonder onnodige verhuizing.",
  "body": "Repository: {{REPO}}\nWaarvoor het project gebruikt wordt: {{DOEL}}\n\nBreng de huidige structuur in kaart. Kijk naar de README, invoerbestanden, scripts, assets, tests, workflows en de manier waarop de site gebouwd wordt. Bepaal eerst welke paden in code, documentatie en publicatie verwijzen naar bestaande mappen.\n\nStel alleen wijzigingen voor die aantoonbaar iets oplossen. Toon een voorbeeld van de nieuwe mappenstructuur, een tabel met oud pad en voorgesteld nieuw pad en welke imports, links of buildinstellingen daardoor mee moeten veranderen. Maak duidelijk wat ongemoeid blijft. Benoem bestanden waarvan het doel nog onzeker is.\n\nGeef een controleplan voor links, imports, tests en productiepublicatie. Verwijder of hernoem geen bestand zonder akkoord. Een nette mappenboom is geen verbetering als de bestaande website daardoor stukgaat."
 },
 {
  "id": "kleine-wijziging",
  "phase": "bouwen",
  "title": "Verbeter één functie",
  "forWhom": "Je wilt iets aanpassen zonder andere functies te raken.",
  "outcome": "Een kleine wijziging met aantoonbare voor- en natest.",
  "body": "Repository: {{REPO}}\nWat de gebruiker daarna moet kunnen: {{DOEL}}\n\nZoek de code voor precies deze functie en bekijk hoe zij met andere onderdelen samenhangt. Leg de huidige werking uit met bestandslinks. Schrijf één controleerbare acceptatieproef voor het gevraagde gedrag en noteer hoe je bestaande functies beschermt.\n\nStel een beperkte wijziging voor. Gebruik dezelfde programmeer- en ontwerpafspraken als de repository tenzij die het probleem veroorzaken. Werk alleen in een bevoegde codeomgeving en na mijn toestemming op een aparte branch. Maak geen opportunistische aanpassingen aan andere bestanden.\n\nLever: de gewijzigde bestanden, een beknopte beschrijving van het verschil, de uitgevoerde teststappen met resultaat en de onderdelen die niet getest zijn. Een geslaagde build is aanvullend bewijs, geen vervanging voor een gebruikstest. Publiceer niets zonder apart akkoord."
 },
 {
  "id": "fix",
  "phase": "bouwen",
  "title": "Zoek en herstel een fout",
  "forWhom": "Een functie vertoont aantoonbaar verkeerd gedrag.",
  "outcome": "Reproduceerbare oorzaak, gerichte reparatie en regressiecontrole.",
  "body": "Repository: {{REPO}}\nFout of gewenst gedrag: {{DOEL}}\n\nBegin met reproductie. Beschrijf de exacte stappen, omgeving en verwachte versus waargenomen uitkomst. Ontbreekt een voorbeeld, zoek eerst naar een bestaande issue, test of foutmelding. Zoek daarna de kleinste aannemelijke oorzaak in de relevante bronbestanden; geef bestandslink en regelnummer. Houd een vermoeden gescheiden van een bewezen oorzaak.\n\nSchrijf eerst een test die de fout laat zien, waar dat technisch mogelijk is. Stel vervolgens de kleinste reparatie voor. Voer die alleen na toestemming uit op een aparte branch. Controleer het oorspronkelijke probleem opnieuw en voer relevante bestaande tests uit.\n\nLever een korte foutbeschrijving met bewijs, de gekozen aanpassing, de voor- en naresultaten en eventuele neveneffecten. Geen claims over 'opgelost' zonder geslaagde herhaling van de gebruikershandeling. Voeg niet zelfstandig samen en publiceer niet."
 },
 {
  "id": "begrijp-code",
  "phase": "bouwen",
  "title": "Leg deze code uit",
  "forWhom": "Je wilt begrijpen wat een onderdeel werkelijk doet.",
  "outcome": "Een leesbare uitleg van invoer, verwerking en afhankelijkheden.",
  "body": "Repository: {{REPO}}\nDe functie die ik wil begrijpen: {{DOEL}}\n\nZoek het bestand of de functie die hierbij hoort en verwijs naar de juiste bron. Leg uit wat de invoer is, wat de code ermee doet en welke uitvoer volgt. Beschrijf welke andere modules, externe diensten of instellingen nodig zijn. Gebruik één klein, realistisch voorbeeld dat past bij de code.\n\nMaak duidelijk welk gedrag je rechtstreeks uit de code kunt afleiden en welk gedrag alleen door uitvoering kan worden bevestigd. Wijs op foutafhandeling, grenzen en mogelijke gevolgen van een wijziging, alleen waar de bron daarvoor aanleiding geeft.\n\nLever een korte uitleg in gewone taal, een overzicht van de bestandsrelaties en één concrete, veilige manier waarop ik dit zelf kan controleren. Bouw of verander niets en leg geen niet-bestaande afhankelijkheden in de mond van het project."
 },
 {
  "id": "gebruikstest",
  "phase": "controleren",
  "title": "Test de echte gebruikersroute",
  "forWhom": "Je wilt weten of de toepassing voor bezoekers werkt.",
  "outcome": "Een testrapport met uitgevoerde stappen, bewijs en open punten.",
  "body": "Project: {{REPO}}\nDe belangrijkste gebruikershandeling: {{DOEL}}\n\nBepaal eerst de live URL of lokale testomgeving en controleer dat deze echt bij de repository hoort. Kies drie concrete gebruikersroutes: de hoofdhandeling, een foutpad en een mobiele route. Open de toepassing in een browser en voer iedere handeling zelf uit waar de omgeving dat toestaat. Noteer schermgrootte, invoer, verwachte uitkomst, waargenomen uitkomst en relevante console- of netwerkfouten.\n\nControleer ook of teksten en knoppen begrijpelijk zijn, focus zichtbaar blijft en er geen horizontale overloop ontstaat. Probeer geen echte accounts of externe gegevens te wijzigen zonder toestemming. Lukt een handeling technisch niet, meld 'niet getest' met de reden.\n\nLever een testtabel met Geslaagd, Mislukt of Niet getest, bewijslinks of screenshots en de ernst van bevestigde fouten. Maak geen groene eindconclusie op basis van alleen een syntaxcheck of succesvolle build. Wijzig nog geen code."
 },
 {
  "id": "review",
  "phase": "controleren",
  "title": "Beoordeel een wijziging",
  "forWhom": "Er staat een branch of pull request klaar.",
  "outcome": "Controle op gedrag, regressies en onderbouwing vóór samenvoegen.",
  "body": "Repository: {{REPO}}\nWat de wijziging moet bereiken: {{DOEL}}\n\nZoek de pull request of vraag om de exacte link. Bekijk de verschillen met de basisbranch en controleer welke bestanden bewust of onbedoeld zijn geraakt. Controleer of de wijziging aansluit bij de opdracht, bestaande functies behoudt en geen onnodige toegang of afhankelijkheid toevoegt.\n\nLees de relevante tests en hun werkelijk gerapporteerde uitkomst. Test het nieuwe gedrag waar mogelijk zelf en kijk naar foutpaden, mobiel gebruik, toegankelijkheid en publicatie. Noem een bevinding alleen bewezen met concrete bron of reproduceerbare test. Maak onderscheid tussen blokkade, aandachtspunt en voorkeur.\n\nLever je bevindingen per bestand of gebruikersroute, inclusief link, gevolg en mogelijke reparatie. Sluit af met 'klaar voor beoordeling', 'eerst aanpassen' of 'niet vast te stellen', met reden. Review is geen toestemming om te mergen; wijzig niets zonder overleg."
 },
 {
  "id": "veiligheid",
  "phase": "controleren",
  "title": "Controleer wat openbaar wordt",
  "forWhom": "Je gaat delen of publiceren en wilt geen gegevens lekken.",
  "outcome": "Een gerichte controle op zichtbaarheid, geheimen en rechten.",
  "body": "Repository: {{REPO}}\nWaarvoor het project bedoeld is: {{DOEL}}\n\nControleer eerst of de repository openbaar of privé is en welke bestanden daadwerkelijk gepubliceerd worden. Inspecteer bestandsnamen en configuratie op mogelijke sleutels, tokens, wachtwoorden, persoonlijke informatie, bronkaarten en onbeveiligde endpoints. Bekijk waar mogelijk GitHub Actions-rechten, gebruikte externe scripts en toegangsinstellingen. Lees geen geheimen hardop terug in het rapport.\n\nMaak onderscheid tussen een bewezen blootstelling, een verdachte verwijzing en een niet bekeken onderdeel. Geef per bevinding de locatie, het gevolg en de veiligste vervolgstap. Controleer zo mogelijk of ongewenste informatie al in eerdere commits zit; het bestand alleen nu verwijderen is dan niet genoeg.\n\nLever een prioriteitenlijst, een hercontrole na eventuele reparatie en een lijst met openstaande vragen. Wijzig geen rechten, draai geen sleutels in en publiceer of verwijder niets zonder expliciet akkoord."
 },
 {
  "id": "publiceer-plan",
  "phase": "publiceren",
  "title": "Kies een geschikte publicatieroute",
  "forWhom": "Je wilt je website of app online zetten.",
  "outcome": "Een hostingskeuze met bouwstappen, kosten en controles.",
  "body": "Bronrepository: {{REPO}}\nWat bezoekers online moeten kunnen: {{DOEL}}\n\nInspecteer de startbestanden, bouwscripts, client/server-onderdelen, API-afhankelijkheden, dataopslag en bestaande workflows. Bepaal of statische hosting zoals GitHub Pages geschikt is; vergelijk alleen alternatieven die echt nodig zijn. Verwijs bij platformregels naar actuele officiële documentatie en noem kosten alleen met een bron en datum.\n\nLever één aanbevolen route en een stappenplan van repository tot live URL. Beschrijf welke configuratie, secrets, domeininstellingen, buildstappen en rechten nodig zijn, plus de rollback bij een fout. Voeg een controle toe voor 404's, navigatie, mobiele weergave en de belangrijkste gebruikershandeling.\n\nMaak onderscheid tussen een geslaagde build en een geslaagde publicatie. Wijzig geen workflows, DNS of hostinginstellingen en start geen publicatie zonder mijn afzonderlijke toestemming."
 },
 {
  "id": "oplevering",
  "phase": "publiceren",
  "title": "Controleer wat daadwerkelijk live staat",
  "forWhom": "Een publicatie is afgerond of lijkt te zijn afgerond.",
  "outcome": "Bewijs dat de juiste versie bereikbaar is en de hoofdroute werkt.",
  "body": "Repository: {{REPO}}\nVerwacht gedrag van de live toepassing: {{DOEL}}\n\nOpen de publieke URL. Controleer de HTTP-status van de hoofd- en relevante subpagina's, scripts, styles en andere noodzakelijke bestanden. Vergelijk waar mogelijk de gepubliceerde codeversie met de bedoelde commit. Een geslaagde GitHub Action is niet genoeg: loop de voornaamste gebruikersroute echt door, inclusief foutpad en mobiele schermmaat.\n\nLeg per controle vast: URL of bestand, uitgevoerde stap, verwacht en waargenomen resultaat, status en bewijs. Meld ontbrekende bronkoppeling, netwerktoegang of browserfunctionaliteit uitdrukkelijk als 'niet getest'. Noteer bevestigde problemen, hun gevolg voor bezoekers en een beperkte hersteloptie.\n\nLever een korte opleveringstabel, de exacte publicatieversie indien verifieerbaar en een onderscheid tussen gecontroleerd, defect en onbekend. Pas niets aan en publiceer niet opnieuw zonder toestemming."
 },
 {
  "id": "onderhoud",
  "phase": "onderhouden",
  "title": "Bepaal welk onderhoud nodig is",
  "forWhom": "De repository bestaat al langer en je wilt gericht bijwerken.",
  "outcome": "Een korte onderhoudslijst met aantoonbare noodzaak.",
  "body": "Repository: {{REPO}}\nWaar het project voor blijft dienen: {{DOEL}}\n\nOnderzoek de recente commits, bestaande issues, geautomatiseerde tests, kwetsbaarheidsmeldingen voor zover bereikbaar en afhankelijkheden. Kijk ook naar verlopen links, ontbrekende documentatie en grote handmatige stappen bij publicatie. Controleer of gevonden signalen nog actueel zijn.\n\nPrioriteer hooguit vijf onderhoudstaken. Zet bij elke taak: bewijs uit repository of documentatie, effect voor de gebruiker, geschatte omvang met duidelijke onzekerheid, voorgestelde controle en een veilige manier om terug te draaien. Markeer vermoedens apart en verzin geen taken om een lijst te vullen.\n\nLever een voorstel voor de eerstvolgende kleine onderhoudsronde. Verhoog geen dependencyversies, verwijder geen code en merge niets zonder toestemming. Noem wat je niet kon controleren door beperkte rechten of ontbrekende uitvoer."
 },
 {
  "id": "leren",
  "phase": "onderhouden",
  "title": "Leer één projecthandeling zelf doen",
  "forWhom": "Je wilt de eigen code beter begrijpen en beheren.",
  "outcome": "Een korte begeleide oefening met controle van je begrip.",
  "body": "Project: {{REPO}}\nWat ik met dit project wil kunnen: {{DOEL}}\n\nKies op basis van de echte repository één handeling die ik zelfstandig kan leren, zoals een tekst aanpassen, een test starten, een branch bekijken of een foutmelding lezen. Laat eerst zien waar dit in de code of GitHub-interface gebeurt. Gebruik een klein voorbeeld zonder productiesystemen te wijzigen.\n\nGeef één vraag of handeling per keer. Laat mij voorspellen wat er zal veranderen en waarom. Reageer op mijn antwoord met gerichte feedback en laat mij daarna zelf de controle uitvoeren. Maak verschil tussen wat ik zelfstandig heb gedaan en wat jij hebt toegelicht.\n\nEindig met een beknopte oefenkaart: startpunt, handeling, verwachte uitkomst, foutsignaal en herstelstap. Voer het werk niet automatisch voor mij uit. Wijzig niets in main en publiceer niets."
 }
];
export function fillPrompt(prompt,{repo="",goal=""}={}){
 const value=typeof prompt==="string"?prompt:String(prompt?.body||"");
 return value.replaceAll("{{REPO}}",String(repo).trim()||"[voeg de link naar je repository toe]").replaceAll("{{DOEL}}",String(goal).trim()||"[beschrijf wat het project moet kunnen]");
}
export function promptsForPhase(phase="alle"){
 return phase==="alle"?PROMPT_LIBRARY:PROMPT_LIBRARY.filter(x=>x.phase===phase);
}
