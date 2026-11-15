// Kopieerbare opdrachten per ontwikkelfase. Niet automatisch uitvoeren of versturen.
export const PROMPT_PHASES=[
 {id:"verkennen",label:"Verkennen"},
 {id:"opzetten",label:"Opzetten"},
 {id:"bouwen",label:"Bouwen"},
 {id:"controleren",label:"Controleren"},
 {id:"publiceren",label:"Publiceren"},
 {id:"onderhouden",label:"Onderhouden"}
];
const P=(id,phase,title,forWhom,body)=>({id,phase,title,forWhom,body});
export const PROMPT_LIBRARY=[
 P("begrijp","verkennen","Wat heb ik eigenlijk?","Voor een bestaande ZIP of onbekende repository.",
`Bekijk mijn project in {{REPO}}. Ik wil bereiken: {{DOEL}}.
Begin met een overzicht in gewone taal: welke onderdelen zijn er, wat lijkt al bruikbaar en wat ontbreekt nog? Geef echte bestandsnamen als bewijs. Noem niet automatisch iets 'werkend' omdat een bestand aanwezig is. Stel maximaal één vraag als een antwoord nodig is om verder te kunnen.
Wijzig niets. Eindig met één concrete volgende handeling.`),
 P("doel","verkennen","Maak mijn idee toetsbaar","Voor je begint te bouwen of veranderen.",
`Mijn idee is: {{DOEL}}. Mijn project staat op {{REPO}}.
Help mij beschrijven wat een gebruiker straks precies moet kunnen. Maak maximaal vijf controleerbare gebruikssituaties, zonder een technische oplossing voor te schrijven. Laat mij kiezen wat de eerste versie moet kunnen.
Leg uit wat ik zelf moet beslissen en welke technische uitwerking kan worden overgenomen. Werk nog niets uit in code.`),
 P("mogelijkheden","verkennen","Welke aanpak past hier?","Voor je een framework of dienst kiest.",
`Doel: {{DOEL}}. Repository: {{REPO}}.
Onderzoek eerst de bestaande bestanden en gebruikte techniek. Vergelijk daarna maximaal drie passende manieren om mijn doel te bereiken. Beoordeel de opties op begrijpelijkheid, onderhoud, kosten, privacy en of bestaande goede onderdelen behouden blijven.
Baseer uitspraken op aantoonbare projectgegevens en officiële documentatie. Laat mij de keuze maken voordat je iets verandert.`),
 P("repo-start","opzetten","Van ZIP naar GitHub","Voor de eerste overdracht.",
`Mijn doel: {{DOEL}}. GitHub-repository: {{REPO}}.
Help mij stap voor stap om een bestaande ZIP als losse projectbestanden op GitHub te zetten. Controleer eerst de mapstructuur en mogelijke privébestanden. Leg precies uit welke knoppen ik op github.com moet gebruiken. Ga niet uit van GitHub Desktop of een terminal.
Laat mij zelf bepalen wat openbaar wordt. Stop na iedere menselijke keuze en geef pas daarna de volgende stap. Upload niet alleen de ZIP.`),
 P("plan","opzetten","Maak een werkbaar stappenplan","Voor een wijziging met meerdere onderdelen.",
`Bekijk {{REPO}} in het licht van dit doel: {{DOEL}}.
Verdeel het werk in kleine afhankelijke taken. Geef per taak: verwacht resultaat, betrokken bestanden, een passende controle en wat ik zelf moet beslissen. Begin bij wat al goed is en behoud dat.
Laat taken die onafhankelijk zijn naast elkaar uitvoeren waar dat veilig kan. Geen codewijzigingen of publicatie zonder mijn toestemming. Begin met de eerste haalbare stap.`),
 P("structuur","opzetten","Maak de projectmap begrijpelijk","Voor een rommelige of onduidelijke repository.",
`Repository: {{REPO}}. Doel: {{DOEL}}.
Bekijk de huidige mappen, README, startbestanden en configuratie. Stel alleen veranderingen voor die de vindbaarheid of werking echt verbeteren. Vertel welke bestanden moeten blijven, welke overbodig lijken en wat nog onbekend is.
Verplaats of verwijder niets zonder mijn akkoord. Geef eerst een voorstel met een korte reden per wijziging.`),
 P("kleine-wijziging","bouwen","Verbeter één onderdeel","Voor gericht werk in bestaande code.",
`Doel: {{DOEL}}. Repository: {{REPO}}.
Onderzoek het onderdeel dat hiervoor nodig is. Benoem eerst de huidige werking en wat behouden moet blijven. Stel de kleinste passende wijziging voor, op basis van echte bestanden.
Voer in een bevoegde codeomgeving alleen na mijn toestemming die wijziging uit op een aparte branch. Test het gewijzigde gedrag. Geef een overzicht van aangepaste bestanden, testresultaten en openstaande punten. Geen publicatie.`),
 P("fix","bouwen","Los een bewezen fout op","Voor een bug met een voorbeeld.",
`Repository: {{REPO}}. Het probleem houdt verband met: {{DOEL}}.
Probeer het probleem eerst te reproduceren. Vertel wat je daadwerkelijk hebt gezien. Geef een bestandslink en regelnummer bij aantoonbare codefouten. Noem een vermoeden ook echt een vermoeden.
Zoek naar de oorzaak en maak pas na mijn akkoord de kleinste passende reparatie. Controleer daarna de volledige gebruikershandeling en bestaande functies op nieuwe fouten.`),
 P("begrijp-code","bouwen","Leg een lastig bestand uit","Voor onbekende code.",
`Bekijk het bestand dat relevant is voor {{DOEL}} in {{REPO}}.
Leg in gewone taal uit waarvoor dit bestand dient, wat erin gebeurt en welke andere bestanden ermee samenhangen. Gebruik maximaal één concreet voorbeeld en geef bestandslinks.
Maak verschil tussen wat je uit de code kunt afleiden en wat alleen met uitvoering getest kan worden. Pas niets aan.`),
 P("gebruikstest","controleren","Test wat de gebruiker doet","Voor een echte functietest.",
`Mijn doel is: {{DOEL}}. Mijn project staat op {{REPO}}.
Kies drie belangrijke gebruikershandelingen. Test ze echt in de juiste omgeving, ook op een mobiel formaat waar dat zinvol is. Noteer per handeling: wat is uitgevoerd, wat gebeurde er en of de uitkomst klopt.
Maak onderscheid tussen geslaagd, mislukt en niet uitgevoerd. Een groene syntaxcheck is geen functietest. Maak geen testresultaten die je niet kunt onderbouwen.`),
 P("review","controleren","Laat wijzigingen streng nakijken","Voor een pull request.",
`Bekijk de voorgestelde wijzigingen in {{REPO}} voor dit doel: {{DOEL}}.
Controleer of de wijziging echt nodig is, bestaande goede functies behoudt, geen onbedoelde neveneffecten geeft en de rechten niet vergroot zonder reden. Lees het verschil tussen de oude en nieuwe code.
Noem bevindingen met bestand, regel en bewijs. Zet vermoedens apart. Sluit af met: gereed om te beoordelen, nog werk nodig of niet te verifiëren. Voeg niets zelf samen.`),
 P("veiligheid","controleren","Controleer wat openbaar mag","Voor delen, koppelen of publiceren.",
`Repository: {{REPO}}. Doel: {{DOEL}}.
Controleer mogelijke geheimen in bestandsnamen en configuratie, afhankelijkheden, toegangsrechten en publicatie-instellingen. Voer geen onbekende projectcode uit buiten een geschikte veilige omgeving.
Noem concrete risico's met bronverwijzingen en geef aan wat je niet hebt gecontroleerd. Stel een veilig herstelplan voor. Mijn toestemming is nodig voor verwijderen, rechten aanpassen en publiceren.`),
 P("publiceer-plan","publiceren","Onderzoek hoe ik dit online krijg","Voor een website of toepassing die klaar lijkt.",
`Doel: {{DOEL}}. Repository: {{REPO}}.
Controleer aan de hand van de echte projectbestanden of GitHub Pages geschikt is of andere hosting nodig is. Maak een kort stappenplan met officiële links, benodigde instellingen en kosten of beperkingen voor zover bekend.
Voer beschikbare tests eerst uit en benoem ontbrekende testdekking. Vraag apart toestemming voor repositorywijzigingen en voor publicatie. Publiceer nog niets.`),
 P("oplevering","publiceren","Controleer de oplevering","Na een publicatie.",
`Het gepubliceerde project hoort dit te kunnen: {{DOEL}}. Bronrepository: {{REPO}}.
Open de werkelijke pagina en doorloop de belangrijkste gebruikershandelingen. Controleer de openbare URL, de versies die zijn gepubliceerd, foutmeldingen en mobiele weergave.
Geef alleen geslaagde resultaten als je de handeling echt hebt uitgevoerd. Noem ontbrekende controles en eventuele fouten met herleidbare bronnen. Wijzig niets zonder overleg.`),
 P("onderhoud","onderhouden","Wat heeft onderhoud nodig?","Voor een bestaande repository.",
`Bekijk {{REPO}} met dit doel: {{DOEL}}.
Onderzoek openstaande problemen, beschikbare tests, oude afhankelijkheden en documentatie. Maak een korte geprioriteerde lijst. Geef per voorstel aan welk aantoonbaar probleem het oplost en welke controle nodig is.
Verzin geen problemen om de lijst langer te maken. Geen automatische upgrades of merges. Laat mij kiezen wat eerst gebeurt.`),
 P("leren","onderhouden","Leg uit wat ik nu zelf kan","Voor wie meer grip op het project wil.",
`Mijn project staat op {{REPO}} en moet dit kunnen: {{DOEL}}.
Kies één concrete handeling die ik nog niet goed begrijp uit dit project. Leg die uit met een klein voorbeeld en laat mij daarna zelf voorspellen wat er gebeurt als ik iets verander.
Neem de leerstap niet over door meteen het antwoord te geven. Laat me mijn keuze uitleggen en geef gerichte feedback. Houd wijzigingen buiten de hoofdbranch.`)
];
export function fillPrompt(prompt,{repo="",goal=""}={}){
 const value=typeof prompt==="string"?prompt:String(prompt?.body||"");
 return value.replaceAll("{{REPO}}",repo.trim()||"[voeg de link naar je repository toe]").replaceAll("{{DOEL}}",goal.trim()||"[beschrijf wat het project moet kunnen]");
}
export function promptsForPhase(phase="alle"){
 return phase==="alle"?PROMPT_LIBRARY:PROMPT_LIBRARY.filter(x=>x.phase===phase);
}
