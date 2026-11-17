// EAIgit. Praktische opdrachten met controleerbare uitkomsten.
// Een opdracht geeft nooit toestemming om wijzigingen automatisch te publiceren.
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
    "title": "Breng mijn project in kaart",
    "forWhom": "Eerst begrijpen wat er werkelijk staat.",
    "outcome": "Overzicht van bestanden en werking",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nBepaal of de repository het juiste project bevat. Lees README, projectconfiguratie, startbestanden en scripts. Leg met exacte paden uit wat het programma doet, hoe het volgens de code start, welke onderdelen samenwerken en waar de gebruiker het resultaat ziet. Controleer welke tests er zijn, zonder hun aanwezigheid als succes te beschouwen. Lever een projectkaart met de rubrieken aanwezig, onduidelijk en niet getest, plus drie gerichte vervolgstappen. Geen nieuw framework voorstellen voordat de bestaande situatie duidelijk is.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "doel",
    "phase": "verkennen",
    "title": "Maak de gewenste werking toetsbaar",
    "forWhom": "Maak van een idee concrete gebruikershandelingen.",
    "outcome": "Acceptatiecriteria voor de eerste versie",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nVertaal mijn doel naar maximaal vijf concrete gebruikershandelingen. Beschrijf per handeling de startsituatie, invoer, verwachte zichtbare uitkomst, foutpad en het criterium voor geslaagd. Zoek in de bestaande code naar aanwijzingen dat de handeling al mogelijk is. Scheid functionele eisen van technische keuzes en uiterlijk. Lever een korte acceptatielijst waarmee iemand op desktop of telefoon kan testen. Vul onbekende productkeuzes niet in; stel alleen een vraag als die echt nodig is. Bouw nog niets.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "mogelijkheden",
    "phase": "verkennen",
    "title": "Vergelijk passende technische routes",
    "forWhom": "Kies niet opnieuw wat al goed gebouwd is.",
    "outcome": "Vergelijking met concrete gevolgen",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nOnderzoek eerst de huidige techniek, hosting en aantoonbaar werkende onderdelen. Vergelijk behoud van de bestaande aanpak met maximaal twee realistische alternatieven. Beoordeel de benodigde wijzigingen, hergebruik, beheer, onderhoud, kosten met actuele bron en gevolgen voor privacy. Noteer wat aantoonbaar is en welke aannames over de uitvoerbaarheid nog getest moeten worden. Lever een compacte vergelijking en een voorstel met expliciete voorwaarden. Start geen migratie zonder akkoord.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "repo-start",
    "phase": "opzetten",
    "title": "Zet mijn ZIP goed op GitHub",
    "forWhom": "Voor een project dat nog als ZIP bestaat.",
    "outcome": "Controleerbaar uploadplan",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nHelp mij een ZIP als losse projectbestanden op GitHub te plaatsen. Bepaal de hoofdmap en startbestanden. Controleer namen en, waar mogelijk, inhoud op .env, tokens, sleutels, persoonsgegevens, tijdelijke mappen en buildbestanden. Benoem concreet wat wel en niet mee moet. Beschrijf de stappen via github.com zonder terminal of GitHub Desktop te veronderstellen. Een ZIP uploaden is niet hetzelfde als broncode publiceren. Stop vóór het openbaar maken. Laat na de upload de bestandsstructuur en commit controleren.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "plan",
    "phase": "opzetten",
    "title": "Maak een uitvoerbaar bouwplan",
    "forWhom": "Voor werk met meerdere samenhangende wijzigingen.",
    "outcome": "Taken met bestanden en controles",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nLees het project, de openstaande problemen en de bestaande tests. Maak maximaal acht kleine taken. Geef per taak de aanleiding, het zichtbare resultaat, betrokken bestanden, afhankelijkheden, passend testscenario en stopcriterium. Benoem bestaande functies die behouden moeten blijven en mogelijke regressie. Zet noodzakelijke reparaties vóór uitbreidingen. Scheid onafhankelijke taken van werk dat op andere wijzigingen wacht. Lever het plan; begin pas met implementeren na akkoord.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "structuur",
    "phase": "opzetten",
    "title": "Maak de repository overzichtelijk",
    "forWhom": "Voor veel mappen of onduidelijke startpunten.",
    "outcome": "Voorstel zonder ongevraagde verhuizingen",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nInventariseer mappen, startbestanden, imports, build-output, routes, workflows, configuratie en documentatie. Onderzoek mogelijke dubbelen; noem iets pas overbodig na controle van verwijzingen. Maak een tabel met huidig pad, voorgesteld pad, reden, gevolgen en controle. Wijs bestaande URL's en imports aan die niet mogen breken. Lever alleen een voorstel. Verplaats of verwijder niets zonder akkoord.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "kleine-wijziging",
    "phase": "bouwen",
    "title": "Pas één functie gericht aan",
    "forWhom": "Voor een gerichte uitbreiding of verbetering.",
    "outcome": "Kleine wijziging met aantoonbare test",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nZoek de code achter de gevraagde handeling. Beschrijf eerst wat nu gebeurt en wat behouden moet blijven, met bestandslinks. Stel de kleinst passende wijziging en een toetsbaar acceptatiecriterium voor. Pas na akkoord code aan op een aparte branch. Voeg waar mogelijk een regressietest toe en test ook de volledige zichtbare handeling. Lever diff, gewijzigde paden, werkelijk uitgevoerde tests en wat nog onzeker is. Publiceer niet.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "fix",
    "phase": "bouwen",
    "title": "Onderzoek en herstel een fout",
    "forWhom": "Voor een fout die iemand werkelijk ziet.",
    "outcome": "Reproductie, oorzaak, reparatie en hertest",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nReproduceer eerst de fout met exacte stappen, verwacht gedrag en waargenomen uitkomst. Onderzoek browserconsole, netwerk, testlog en relevante bestanden. Scheid vermoedens van bewezen oorzaken. Wijs de oorzaak aan met pad en regel of leg uit waarom dat nog niet kan. Stel een gerichte reparatie voor, vraag akkoord en wijzig op een aparte branch. Test daarna dezelfde handeling, één foutpad en een verwante functie. Geef bewijs; een groene build vervangt de hertest niet.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "begrijp-code",
    "phase": "bouwen",
    "title": "Leg een stuk code uit",
    "forWhom": "Voor wie een onderdeel wil begrijpen.",
    "outcome": "Uitleg met echte paden en een voorbeeld",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nZoek de bestanden die de genoemde functie uitvoeren. Leg de stroom van invoer, verwerking, externe afhankelijkheden en uitkomst uit. Gebruik één realistisch voorbeeld met concrete waarden en verwijzingen naar de juiste code. Maak duidelijk wat uit de code volgt en wat alleen met een test is vast te stellen. Lever een uitleg in maximaal vijf stappen en één controlevraag waarmee ik kan laten zien dat ik de werking begrijp. Pas niets aan.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "api-data",
    "phase": "bouwen",
    "title": "Controleer een data- of API-koppeling",
    "forWhom": "Voor gegevens die van buiten het project komen.",
    "outcome": "Bron-tot-scherm controle met foutpaden",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nBreng een gegevensstroom in kaart van externe bron tot zichtbare waarde. Controleer veldnamen, transformaties, datums, verversing, foutafhandeling en dubbele records. Gebruik echte responsvoorbeelden, met aandacht voor geheimen in de browser en verouderde caching. Voer geen onbedoelde schrijfacties naar externe systemen uit. Lever een tabel met veld, bron, verwerking, uitkomst en werkelijk uitgevoerde test. Noem wat niet bereikbaar was.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "gebruikstest",
    "phase": "controleren",
    "title": "Test wat de bezoeker echt doet",
    "forWhom": "Voor een werkende interface op desktop en mobiel.",
    "outcome": "Testrapport per gebruikershandeling",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nKies drie gebruikershandelingen die het doel rechtstreeks toetsen. Open de echte website of testomgeving. Doorloop op desktop en waar passend mobiel het normale pad en een foutpad. Controleer ook toetsenbord, foutmeldingen, netwerkfouten en horizontaal scrollen. Leg per test URL, versie, stappen, verwacht gedrag, waarneming, bewijs en status vast: geslaagd, mislukt of niet uitgevoerd. Lever een compact testrapport; geen schijnbewijs op basis van alleen bestanden of builds.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "review",
    "phase": "controleren",
    "title": "Controleer een pull request",
    "forWhom": "Voor wijzigingen die nog niet zijn samengevoegd.",
    "outcome": "Review met bevindingen en bewijslast",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nLees de echte diff tegen de doelbranch en controleer het afgesproken doel, bestaand gedrag, beveiliging, privacy, imports, URL's, toegankelijkheid en mogelijke regressie. Noem per bevinding bestand, regel, bewijs en impact. Scheid bewezen fouten, vermoedens en suggesties. Controleer welke tests aantoonbaar zijn uitgevoerd. Lever maximaal vijf bevindingen plus het oordeel klaar voor beoordeling, nog werk nodig of onvoldoende bewijs. Voeg niets samen.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "veiligheid",
    "phase": "controleren",
    "title": "Controleer wat openbaar mag",
    "forWhom": "Voor bestanden, koppelingen en publicatie.",
    "outcome": "Veiligheidscontrole met concrete herstelacties",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nControleer openbare bestanden en configuratie op tokens, wachtwoorden, persoonsgegevens, onnodige rechten, externe afhankelijkheden en blootstelling vanuit de browser. Onderzoek waar mogelijk of gevoelige inhoud ooit in een commit is beland. Toon geen geheime waarden en voer geen onbevoegde proeven uit. Benoem per bevinding het bewijs, het mogelijke gevolg en wat niet gecontroleerd is. Lever niet-destructieve herstelvoorstellen en vraag akkoord vóór een wijziging. Noem dit geen volledige beveiligingsaudit.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "ci",
    "phase": "controleren",
    "title": "Onderzoek een mislukte GitHub-controle",
    "forWhom": "Voor rode Actions en onduidelijke testresultaten.",
    "outcome": "Oorzaak met run-link en gerichte oplossing",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nOpen de specifieke workflow-run, job en logregels. Bepaal of de fout in code, configuratie, een externe dienst, toegang of de test zelf zit. Maak onderscheid tussen failure, cancelled en skipped. Leg de gebruikte commit vast. Wijs de bewijsbare foutregel aan en geef de kleinste hersteloptie plus hertest. Lever run-link, foutregel, oorzaakstatus en controleplan. Claim pas succes als dezelfde workflow op de juiste commit opnieuw geslaagd is. Wijzig niets zonder akkoord.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "publiceer-plan",
    "phase": "publiceren",
    "title": "Kies een passende publicatieroute",
    "forWhom": "Voor code die online moet komen.",
    "outcome": "Publicatieplan met voorwaarden en terugweg",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nControleer bouwstappen, routes, serverfuncties, variabelen, domein en aanwezige hostinginstellingen. Bepaal met bewijs of statische hosting zoals GitHub Pages volstaat. Noteer bekende kosten alleen met actuele bron. Maak een concrete volgorde voor build, test, livecontrole en terugdraaien. Benoem ontbrekende rechten of gegevens. Lever een publicatieplan en vraag apart akkoord voor codewijzigingen en livegang. Publiceer nog niets.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "oplevering",
    "phase": "publiceren",
    "title": "Vergelijk live met de repository",
    "forWhom": "Na een release die ook echt zichtbaar moet zijn.",
    "outcome": "Livecontrole met versie- en functieverschillen",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nOpen de openbare URL. Controleer de belangrijkste pagina's en werkelijke gebruikershandelingen, statuscodes, CSS/JS, assets, navigatie, mobiel en console. Vergelijk waar mogelijk de livebestanden of versie met de bedoelde commit. Let op caching en oude redirects. Lever per onderdeel verwacht, waargenomen, bewijs en status. Een geslaagde Actions-run bewijst niet dat de juiste versie live staat. Meld wat niet gecontroleerd is; publiceer niets.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "onderhoud",
    "phase": "onderhouden",
    "title": "Bepaal welk onderhoud nodig is",
    "forWhom": "Voor een project dat al enige tijd draait.",
    "outcome": "Onderhoudslijst op basis van echte problemen",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nBekijk recente issues, workflows, afhankelijkheden, kapotte links, documentatie en ontbrekende tests. Scheid bewezen problemen van mogelijke verbeteringen. Noem per punt concrete bron, merkbaar gevolg, beperkte oplossing en test. Benoem ook wat goed werkt en met rust gelaten moet worden. Lever maximaal zes taken in verstandige volgorde. Stel geen grote herbouw voor alleen omdat code oud is. Voer geen upgrades uit zonder akkoord.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  },
  {
    "id": "leren",
    "phase": "onderhouden",
    "title": "Leer één GitHub-handeling zelf doen",
    "forWhom": "Voor wie zelfstandiger wil werken.",
    "outcome": "Kleine oefening met terugkoppeling",
    "body": "Repository: {{REPO}}\nGewenst resultaat: {{DOEL}}\n\nOpdracht\nKies een handeling die past bij mijn project, zoals een commit bekijken, een foutlog lezen of een pull request vergelijken. Leg in eenvoudige stappen uit waar ik moet klikken en waarom. Geef mij één kleine oefening met een zichtbaar resultaat. Vraag eerst wat ik verwacht, geef daarna feedback op mijn eigen keuze en laat mij zelf controleren. Lever alleen de volgende stap en de controle, geen hele cursus ineens. Verander niets aan de repository.\n\nWerkwijze en bewijs\n- Lees de echte bestanden en meld welke paden, commits, PR's of logs de bevinding onderbouwen.\n- Scheid vastgesteld, daadwerkelijk getest, aannemelijk en niet onderzocht. Een geslaagde build zegt niet dat alle functies werken.\n- Verzin geen bestanden, tests, rechten of resultaten. Zeg duidelijk wat je niet kunt openen of uitvoeren.\n- Verander geen code, bestanden, rechten of publicatie-instellingen zonder mijn toestemming. Gebruik voor goedgekeurde wijzigingen een aparte branch, nooit rechtstreeks main.\n- Geef een bondige uitkomst en eindig met één concrete volgende handeling."
  }
];
export function fillPrompt(prompt,{repo="",goal=""}={}){
 const value=typeof prompt==="string"?prompt:String(prompt?.body||"");
 return value.replaceAll("{{REPO}}",String(repo||"").trim()||"[voeg de link naar je repository toe]")
  .replaceAll("{{DOEL}}",String(goal||"").trim()||"[beschrijf wat het project moet kunnen]");
}
export function promptsForPhase(phase="alle"){
 return phase==="alle"?PROMPT_LIBRARY:PROMPT_LIBRARY.filter(x=>x.phase===phase);
}
