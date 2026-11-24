/*
 * Onderwijsregio Rotterdam | interactieve MVP-proef
 * Bronnen: 20261106 Userstories MVP 2, Actie 1.3 Content keuze lijst MVP,
 * 20261014 Procesinrichting en 20261113 Componentengids.
 * Dit is een simulatie: geen accounts, geen echte afspraken of vacatures.
 */
const $ = id => document.getElementById(id);
const contentByStep = [
 {code:"0",phase:"Kennismaken",summary:"Wat kun je in het onderwijs doen?",intro:"Bekijk welke soorten werk er zijn en wat een overstap naar een school of opleiding betekent.",topics:["Werken in het primair onderwijs, voortgezet onderwijs of mbo","De verschillende functies op een school","Wat je al kunt uitzoeken voordat je een route kiest"]},
 {code:"1A",phase:"Een dag in de klas",summary:"Hoe ziet het werk eruit?",intro:"Leraren vertellen wat ze meemaken tijdens een les. In deze proef kun je alvast bekijken welke vragen je na een schoolbezoek zou willen stellen.",topics:["Inspirerende praktijkverhalen","Korte video’s van Bo en Dave","Informatiebijeenkomsten en webinars","Duidelijke mogelijkheid om verder te kijken"],note:"Dit onderdeel hoort bij de algemene kennismaking. De regionale instroomroute begint bij ‘Opleidingen bekijken’."},
 {code:"1B",phase:"Wat trekt je aan?",summary:"Waarom denk je aan een overstap?",intro:"Er is vaak meer dan één reden om voor het onderwijs te kiezen. Je kunt eerst onderzoeken wat je aanspreekt, wat je zou willen behouden uit je huidige werk en wat nog vragen oproept.",topics:["Verdiepende verhalen van carrièreswitchers","Uitleg over overstappen vanuit werk","Routekiezer en vragentool","Meekijkdagen en informatiebijeenkomsten","Een eerste keuze voor PO, VO of mbo"],note:"Dit is de oriëntatie vóór het regionale traject."},
 {code:"2A",phase:"Opleidingen bekijken",summary:"Welke mogelijkheden heb je met je diploma?",intro:"Een route begint niet bij een standaardadvies. Je vooropleiding, de sector waarin je wilt werken en de mogelijkheden van een opleiding of school bepalen wat je moet uitzoeken.",topics:["Functies in het onderwijs","Instroomroutes","Toelatingseisen","Duur en kosten van opleidingen","Financieringsmogelijkheden","Routekiezer","Veelgestelde vragen","Open dagen en webinars","Opleidingen en relevante bronnen"],note:"Dit is volgens de contentkeuzelijst het begin van de regionale instroomroute."},
 {code:"2B",phase:"Past het werk bij je?",summary:"Past een overstap bij jouw leven?",intro:"Hoeveel tijd kun je vrijmaken? Wat vraagt de combinatie van werk en studie? En welke vragen wil je na een eerste kennismaking nog stellen?",topics:["Interactieve scenario’s","Reflectievragen","Werk, studie en privé combineren","Ervaringsverhalen","Contact met een instroomadviseur","Bijeenkomsten en meekijkdagen","Advies en een passende vervolgstap"]},
 {code:"3A",phase:"Een gesprek voorbereiden",summary:"Met wie wil je kennismaken?",intro:"Je hebt een eerste beeld van het werk en van de opleidingsroutes. Nu wordt het concreet: een school bezoeken, je vragen bespreken of een afspraak maken.",topics:["Meeloopdagen","Meet-and-greets","Wat je van deelname kunt verwachten","Afspraak met een instroomadviseur","Ervaring van een kandidaat","Vier reflectievragen","Aanmelden of contact opnemen"]},
 {code:"3B",phase:"Een keuze maken",summary:"Wat heb je nodig om te beslissen?",intro:"Vergelijk de routes die je hebt onderzocht. Kijk ook welke afspraken je nog moet maken en welke informatie je mist voordat je verdergaat.",topics:["Vergelijking van routes en mogelijkheden","Samenvatting van gemaakte keuzes","Laatste vragen of advies","Doorgaan, begeleiding vragen of een stap terugzetten","Doorleiding naar de actiefase"]},
 {code:"4A",phase:"Aan de slag",summary:"Wat is je volgende concrete stap?",intro:"Zoek passende functies, bereid een sollicitatie voor of neem contact op met een school of adviseur.",topics:["Vacatureoverzicht met filters voor PO, VO en mbo","Uitleg over solliciteren","Scholen en opleidingen","Informatie over assessments","Sollicitatielinks","Contactmogelijkheid"]},
 {code:"4B",phase:"Wachten op bericht",summary:"Hoe houd je zicht op het vervolg?",intro:"Je hebt een vervolgstap gezet en wacht op bericht. Zet op een rij wat er is afgesproken en wanneer je weer contact opneemt.",topics:["Doorlooptijden en vervolgstappen","Statusinformatie","Aanvullende informatie tijdens de wachtperiode","Contact- of terugvalroute","Herinneringen en statusberichten","Opnieuw ondersteuning vragen"]}
];
const jumpTargets={"Veelgestelde vragen":"vragen","Afspraak met een instroomadviseur":"afspraak","Contact met een instroomadviseur":"afspraak","Aanmelden of contact opnemen":"afspraak","Contactmogelijkheid":"afspraak","Vacatureoverzicht met filters voor PO, VO en mbo":"vacatures"};
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const routeLabels={PO:"basisonderwijs",VO:"voortgezet onderwijs",MBO:"mbo"};
export function renderStep(index){
 const step=contentByStep[index];
 if(!step)return;
 const container=$("phaseDetails");
 if(!container)return;
 container.replaceChildren();
 const caption=make("p","phase-eyebrow",step.code==="0"?"Kennismaken":step.code.startsWith("1")?"Algemene oriëntatie":"Jouw route in Rotterdam");
 const h=make("h3","phase-detail-title",step.summary);
 const p=make("p","phase-detail-description",step.intro);
 container.append(caption,h,p);
 const selection=$("sector")?.value;
 const profile=$("background")?.value;
 if(selection||profile){
   const sectorText=selection?"Je bekijkt de route voor het "+routeLabels[selection]+".":"Je hebt nog geen sector gekozen.";
   const backgroundText=profile==="HBO_WO"?" Vooropleiding: hbo of wo.":profile==="MBO4"?" Vooropleiding: mbo 4.":"";
   container.append(make("p","phase-personalisation",sectorText+backgroundText+" De keuze is een filter in deze proef, geen beoordeling van je toelating."));
 }
 const details=make("details","phase-topics");
 const summary=make("summary",null,"Wat hoort bij deze stap?");
 const list=make("ul","phase-topic-list");
 for(const title of step.topics){
   const li=make("li");
   const target=jumpTargets[title];
   if(target){const a=make("a",null,title);a.href="#"+target;li.append(a);}
   else li.textContent=title;
   list.append(li);
 }
 details.append(summary,list);
 container.append(details);
 if(step.note)container.append(make("p","phase-note",step.note));
 const action=step.code==="3A"||step.code==="2B"||step.code==="4A";
 if(action){
   const target=step.code==="4A"?"vacatures":"afspraak";
   const link=make("a","phase-action",step.code==="4A"?"Bekijk voorbeeldvacatures":"Plan een voorbeeldgesprek");
   link.href="#"+target;
   container.append(link);
 }
}
const sampleVacancies=[
 {sector:"PO",title:"Leerkracht basisonderwijs",kind:"Primair onderwijs"},
 {sector:"VO",title:"Docent Nederlands",kind:"Voortgezet onderwijs"},
 {sector:"MBO",title:"Docent zorg en welzijn",kind:"Mbo"}
];
function renderVacancies(){
 const select=$("vacancySector"),list=$("vacancyCards"),count=$("vacancyResultCount");
 if(!list)return;
 const sector=select.value;
 const found=sampleVacancies.filter(v=>!sector||v.sector===sector);
 list.replaceChildren();
 for(const vacancy of found){
   const card=make("article","sample-vacancy");
   card.append(make("small",null,"Voorbeeld · geen actuele vacature"),make("h3",null,vacancy.title),make("p",null,vacancy.kind+" · Rotterdam"));
   list.append(card);
 }
 count.textContent=found.length+" voorbeeld"+(found.length===1?"vacature":"vacatures");
}
function setupBooking(){
 const form=$("bookingForm"),date=$("demoDate"),time=$("demoSlot"),subject=$("demoSubject"),confirmation=$("bookingConfirmation");
 if(!form)return;
 date.replaceChildren(new Option("Kies een dag",""));
 const now=new Date();let added=0;
 for(let offset=1;offset<=21&&added<8;offset++){
   const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,12);
   const week=day.getDay();
   if(week===0||week===6)continue;
   const dayValue=[day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
   const label=new Intl.DateTimeFormat("nl-NL",{weekday:"long",day:"numeric",month:"long"}).format(day);
   date.add(new Option(label,dayValue));added++;
 }
 const testMessage=$("bookingStatus");
 form.addEventListener("submit",event=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   const displayDate=date.selectedOptions[0].textContent;
   const displayTime=time.selectedOptions[0].textContent;
   const displaySubject=subject.selectedOptions[0].textContent;
   $("bookingSummary").textContent=displayDate+" om "+displayTime+" · "+displaySubject+".";
   confirmation.hidden=false;
   form.hidden=true;
   testMessage.textContent="Dit is een proef. Er is niets verzonden of gereserveerd.";
   confirmation.focus({preventScroll:true});
 });
 $("editBooking").addEventListener("click",()=>{
   form.hidden=false;confirmation.hidden=true;testMessage.textContent="";
   date.focus();
 });
 $("resetBooking").addEventListener("click",()=>{
   form.reset();form.hidden=false;confirmation.hidden=true;testMessage.textContent="";
   date.focus();
 });
}
function setupProfile(){
 const open=$("routeOpen"),pane=$("prefs"),menu=$("mastNav");
 open?.addEventListener("click",()=>{
   menu.hidden=true;
   $("mastMenu").setAttribute("aria-expanded","false");
   pane.hidden=false;
   $("pie").hidden=true;
   pane.querySelector("summary")?.focus();
 });
 for(const id of ["sector","background"]){
   $(id)?.addEventListener("change",()=>{
     const selected=document.querySelector("#phaseCard [data-step]");
     const code=$("phaseCard")?.dataset.step || "1A";
     renderStep(Math.max(0,contentByStep.findIndex(v=>v.code===code)));
   });
 }
}
setupBooking();
setupProfile();
$("vacancySector")?.addEventListener("change",renderVacancies);
renderVacancies();
