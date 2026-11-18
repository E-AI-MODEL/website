// Zet concrete statische bevindingen om in een veilige volgende handeling.
// Geen projectcode uitvoeren, geen automatische wijzigingen of uploads.
const PRIORITY={
 "javascript-syntax":100,"invalid-json":98,"format-mismatch":95,
 "missing-reference":88,"missing-script-entry":82,"duplicate-html-id":78,
 "entry-unconfirmed":70,"dom-id-unseen":54,"missing-viewport":32,
 "image-without-alt":27,"missing-doctype":15
};
const wording={
 "javascript-syntax":{
  title:"Controleer de JavaScript-syntaxis",
  reason:"De lokale parser kon dit JavaScript-bestand niet volledig lezen. Daardoor is de syntaxiscontrole niet geslaagd.",
  verify:"Corrigeer het genoemde bestand. Controleer daarna het gewijzigde ZIP-bestand opnieuw of laat een echte JavaScript-controle draaien.",
  prompt:"fix",help:"codecheck"
 },
 "invalid-json":{
  title:"Herstel het JSON-bestand",
  reason:"Dit bestand kan niet als JSON worden gelezen. Dat kan projectinstellingen of gegevens onbruikbaar maken.",
  verify:"Controleer het JSON-bestand met een parser en onderzoek daarna het gewijzigde project opnieuw.",
  prompt:"fix",help:"codecheck"
 },
 "missing-reference":{
  title:"Controleer de bestandsverwijzing",
  reason:"Een opgegeven lokaal pad werd niet gevonden in de aangeleverde bestandslijst. Het bestand kan ook tijdens een build ontstaan.",
  verify:"Vergelijk de bestandsnaam en het relatieve pad. Controleer daarna de verwijzing en, bij een website, de pagina zelf.",
  prompt:"fix",help:"references"
 },
 "missing-script-entry":{
  title:"Controleer het startscript",
  reason:"De projectconfiguratie verwijst naar een JavaScript-bestand dat niet in de aangeleverde lijst staat.",
  verify:"Controleer het script in package.json en het bedoelde bestand. Voer het pas in een geschikte, veilige testomgeving uit.",
  prompt:"fix",help:"codecheck"
 },
 "duplicate-html-id":{
  title:"Maak HTML-ID's eenduidig",
  reason:"In één HTML-bestand is dezelfde ID meermaals aangetroffen. Dit kan DOM-selecties onduidelijk maken.",
  verify:"Controleer of het om verschillende elementen gaat. Gebruik zo nodig unieke ID's en controleer daarna de functie die ze gebruikt.",
  prompt:"kleine-wijziging",help:"codecheck"
 },
 "dom-id-unseen":{
  title:"Controleer het gebruikte HTML-element",
  reason:"JavaScript verwijst naar een ID die niet in de gelezen HTML voorkomt. Het element kan later via JavaScript ontstaan.",
  verify:"Controleer of het element bij uitvoering aanwezig is en of de functie de bedoelde uitkomst geeft.",
  prompt:"gebruikstest",help:"codecheck"
 },
 "entry-unconfirmed":{
  title:"Bepaal welk bestand het project opent",
  reason:"Er is geen startpagina gevonden op een gebruikelijke locatie. Dat betekent niet dat het project geen werkende ingang heeft.",
  verify:"Controleer de bouwopdracht en de uiteindelijke publicatiemap. Open de pagina via de bedoelde werkwijze.",
  prompt:"begrijp",help:"codecheck"
 },
 "missing-viewport":{
  title:"Controleer de mobiele weergave",
  reason:"De startpagina bevat geen herkenbare viewport-instelling.",
  verify:"Bekijk de pagina op een telefoon en controleer de schaal en breedte.",
  prompt:"gebruikstest",help:"codecheck"
 },
 "image-without-alt":{
  title:"Controleer de afbeeldingstekst",
  reason:"Een img-element bevat geen alt-attribuut. Ook decoratieve afbeeldingen horen een passende lege alt-tekst te hebben.",
  verify:"Controleer het element in de HTML en de weergave met een schermlezer.",
  prompt:"review",help:"codecheck"
 },
 "missing-doctype":{
  title:"Controleer de HTML-startpagina",
  reason:"Er is geen herkenbare HTML-doctype in de startpagina aangetroffen.",
  verify:"Controleer de bronweergave en of de browser de pagina in standaardmodus opent.",
  prompt:"review",help:"codecheck"
 },
 "format-mismatch":{
  title:"Controleer het bestandsformaat",
  reason:"De bestandsinhoud komt niet overeen met de extensie.",
  verify:"Controleer de bytes van het oorspronkelijke bestand en vervang het alleen door de juiste versie.",
  prompt:"fix",help:"codecheck"
 }
};
const singleLine=s=>String(s||"").replace(/[\r\n\t]/g," ").slice(0,200);
export function selectAuditAction({archive=null,repo=null}={}){
 const candidates=[];
 for(const [source,check] of [["ZIP",archive?.contentCheck],["GitHub",repo?.contentCheck]]){
  for(const item of check?.findings||[]){
   if(!Object.hasOwn(PRIORITY,item.type))continue;
   candidates.push({...item,source,priority:PRIORITY[item.type],
    certainty:item.certainty==="review"?"review":"observed"});
  }
 }
 candidates.sort((a,b)=>b.priority-a.priority||+(a.certainty==="review")-+(b.certainty==="review"));
 const item=candidates[0];
 // Kleine verbeterpunten horen in het detailoverzicht, niet als verplichte eerste wizardstap.
 if(!item||item.priority<50)return null;
 const c=wording[item.type]||wording["missing-reference"];
 const location=item.path?singleLine(item.path)+(item.line?" (regel "+item.line+")":""):"projectstructuur";
 const reason=c.reason;
 const line=item.certainty==="review"?"Dit is een aanwijzing, geen bewezen defect.":"De genoemde bestandscontrole is daadwerkelijk uitgevoerd.";
 const prompt=[
  "Onderzoek deze concrete bevinding in mijn project.",
  "Herkomst van de controle: "+item.source+".",
  "Bestand: "+location+".",
  "Controle: "+singleLine(item.title)+".",
  "Waargenomen: "+singleLine(item.detail)+".",
  "",
  "Lees de echte bronbestanden en controleer eerst of de bevinding klopt.",
  "Maak onderscheid tussen aangetoonde fouten, mogelijke oorzaken en onderdelen die niet zijn getest.",
  "Geef de kleinste veilige vervolghandeling, met bestand, regel en een manier om het resultaat te testen.",
  "Vraag mijn toestemming voordat je bestanden wijzigt. Publiceer nooit automatisch.",
  "Meld expliciet wat je niet kunt controleren. Geen resultaten verzinnen."
 ].join("\n");
 return {
  id:"audit",type:item.type,source:item.source,certainty:item.certainty,
  title:c.title,description:item.type==="javascript-syntax"?"In "+location+" staat een JavaScript-syntaxisfout. De parser kon dit bestand niet volledig lezen; de code is niet uitgevoerd.":singleLine(item.detail),
  rawDetail:singleLine(item.detail),reason,verify:c.verify,notice:line,
  path:item.path||null,line:item.line||null,priority:item.priority,
  promptId:c.prompt,helpId:c.help,prompt
 };
}
