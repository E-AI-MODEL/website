// EAIgit toont pas een korte opdracht als iemand daar zelf om vraagt.
const clean=(value,limit=220)=>String(value||"").replace(/[\r\n\t]+/g," ").slice(0,limit);
export function guideActions({guidance={},repo=null,goal="site",aim=""}={}){
 const url=guidance.repoUrl||null;
 const subject=clean(aim)||guidance.purpose||"mijn project";
 const link=url||"[VOEG DE LINK NAAR JE REPOSITORY TOE]";
 const verified=(guidance.problems||[]).filter(p=>p&&p.path).slice(0,4).map(p=>p.path+(p.line?": regel "+p.line:"")+": "+clean(p.title,110));
 const issues=(guidance.problems||[]).slice(0,4).map(p=>clean(p.title,100));
 const common=[
  "Repository: "+link,
  "Doel: "+subject+".",
  "Maak geen wijzigingen zonder mijn toestemming. Werk bij wijzigingen op een aparte branch en laat me eerst de pull request beoordelen."
 ];
 return {
  onderzoek:{
   title:"Laat je project gericht onderzoeken",
   text:url?"Open de repository en laat de bestaande bestanden en eventuele tests bekijken.":"Voeg eerst je openbare GitHub-link toe. Daarna kun je gericht laten onderzoeken wat in je project staat.",
   url:url||"https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt",
   link:url?"Open repository":"GitHub koppelen aan ChatGPT",
   prompt:[
    "Onderzoek mijn project, zonder iets te wijzigen.",
    ...common,
    "Noem kort wat aantoonbaar goed is, welke codefouten je met bestand en regel kunt aantonen, welke mogelijke logische problemen nog een test nodig hebben en wat de beste eerste vervolgstap is.",
    "Gebruik links naar echte GitHub-bestanden. Schrijf eenvoudig Nederlands."
   ].join("\n")
  },
  verbeter:{
   title:issues.length?"Pak een concreet probleem aan":"Onderzoek eerst wat echt fout is",
   text:issues.length?"Controleer het genoemde probleem in de echte code. Laat een kleine wijziging voorstellen en test die.":"Er is nog geen codefout bewezen. Laat eerst gericht controleren voordat er iets wordt aangepast.",
   url:url?"https://codex.openai.com/":"https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt",
   link:url?"Open Codex":"GitHub koppelen",
   prompt:[
    "Help mij een probleem in mijn GitHub-project op te lossen.",
    ...common,
    ...(verified.length?["Deze bestandsproblemen zijn eerder gevonden:",...verified]:["Er zijn nog geen codefouten bevestigd. Controleer eerst of er werkelijk iets mis is."]),
    "Werk één bevestigd probleem tegelijk uit. Toon welke bestanden veranderen, voer geschikte controles uit en vertel wat is opgelost en wat nog onzeker is.",
    "Bereid alleen na mijn akkoord een pull request voor. Publiceer niets."
   ].join("\n")
  },
  test:{
   title:"Controleer of het doet wat je bedoelt",
   text:"Laat niet alleen naar code kijken. Test de belangrijkste handeling van de gebruiker en laat zien welke controles echt zijn uitgevoerd.",
   url:url?url+"/actions":"https://github.com/features/actions",
   link:url?"Bekijk GitHub-controles":"Over GitHub Actions",
   prompt:[
    "Controleer of mijn project werkt voor het bedoelde gebruik.",
    ...common,
    "Bepaal maximaal drie concrete gebruikstests. Voer alleen toegestane tests uit. Laat per test zien: geslaagd, mislukt of niet uitgevoerd.",
    "Noem de bestandsnaam en regel bij een bewezen fout. Stel geen geslaagde tests voor als je ze niet echt hebt uitgevoerd."
   ].join("\n")
  },
  publiceer:{
   title:"Bereid publicatie voor",
   text:"Controleer wat er nodig is om het project beschikbaar te maken. Publicatie zelf blijft een afzonderlijke keuze.",
   url:url?url+"/settings/pages":"https://docs.github.com/en/pages",
   link:url?"Bekijk publicatie-instellingen":"Uitleg GitHub Pages",
   prompt:[
    "Onderzoek hoe mijn project veilig gepubliceerd kan worden. Publiceer nog niets.",
    ...common,
    "Bepaal of GitHub Pages geschikt is of andere hosting nodig is. Controleer ontbrekende bestanden, afhankelijkheden, rechten en bestaande tests.",
    "Geef een kort stappenplan met links. Vraag apart toestemming voordat je instellingen verandert of publiceert."
   ].join("\n")
  }
 };
}
