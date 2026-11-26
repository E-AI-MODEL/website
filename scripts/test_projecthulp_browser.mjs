import {chromium} from "playwright";
import {PROMPT_LIBRARY,promptsForPhase} from "../assets/eaigit/prompts-data.mjs";
import {spawn} from "node:child_process";
import {mkdirSync,readFileSync} from "node:fs";
import {resolve,join} from "node:path";
import assert from "node:assert/strict";
const root=resolve(process.argv[2]||"site-build"),out=resolve("test-results");
mkdirSync(out,{recursive:true});
const base="http://127.0.0.1:8873";
const server=spawn("python3",["-m","http.server","8873","--bind","127.0.0.1","--directory",root],{stdio:"ignore"});
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b){let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){
 const local=[],central=[];let offset=0;
 for(const [name,value] of files){const n=Buffer.from(name),b=Buffer.from(value),sum=crc(b);
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt32LE(sum,14);l.writeUInt32LE(b.length,18);l.writeUInt32LE(b.length,22);l.writeUInt16LE(n.length,26);local.push(l,n,b);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(sum,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=l.length+n.length+b.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,dir,end]);
}
const archive=zip([["eigen-site/index.html","<!doctype html><title>Hallo</title>"],["eigen-site/css/site.css","body{color:red}"],["eigen-site/.env","SECRET=fixture"]]);
const safeArchive=zip([["eigen-site/index.html","<h1>Hallo</h1>"],["eigen-site/css/site.css","body{}"]]);
let zipOnly=false;
let browser;const errors=[],sent=[];
try{
 let online=false;for(let i=0;i<65;i++){try{online=(await fetch(base)).ok;}catch{}if(online)break;await new Promise(r=>setTimeout(r,110));}assert(online);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 await page.addInitScript(()=>{
  window.__copiedProjectAdvice="";
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
   writeText:async(value)=>{window.__copiedProjectAdvice=String(value);}
  }});
 });
 const spawned=[];page.on("worker",w=>spawned.push(w.url()));
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith(base))sent.push({method:r.method(),url:r.url()});});
 await page.route("https://api.github.com/**",route=>{
  const url=route.request().url();
  const data=url.includes("/git/trees/")?{sha:"fixture-sha",tree:zipOnly?[{type:"blob",path:"project.zip"}]:[{type:"blob",path:"index.html"}],truncated:false}:{full_name:"voorbeeld/project",html_url:"https://github.com/voorbeeld/project",private:false,default_branch:"main"};
  return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(data)});
 });
 await page.goto(base+"/tools/eaigit/");
 assert.match(await page.title(),/^EAIgit · Los bestand/);
 assert.equal(await page.locator(".eg-logo img").getAttribute("src"),"/assets/eaigit/logo.svg");
 assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"),"/assets/eaigit/icon.svg");
 assert(await page.locator("#stage-intent").isVisible());
 // Hulp verschijnt alleen nadat de bezoeker daarom vraagt.
 await page.locator('[data-help="goal"]').click();
 assert(await page.locator("#helpDialog").evaluate(el=>el.open));
 assert.match(await page.locator("#helpTitle").innerText(),/Wat wil je bereiken/);
 assert.match(await page.locator("#helpSteps").innerText(),/website/);
 assert.match(await page.locator("#helpFull").getAttribute("href"),/uitleg-goal/);
 await page.locator("#helpClose").click();
 assert.equal(await page.locator("#helpDialog").evaluate(el=>el.open),false);
 assert.equal(await page.locator("#stage-source").isVisible(),false);
 await page.screenshot({path:join(out,"eaigit-start.png"),fullPage:true});
 // Elke vraag staat op een eigen scherm.
 await page.locator('[data-intent="start"]').click();
 assert(await page.locator("#stage-source").isVisible());
 assert.equal(await page.locator("#stage-intent").isVisible(),false);
 await page.locator('[data-source="both"]').click();
 assert(await page.locator("#stage-zip").isVisible());
 await page.locator("#zipFile").setInputFiles({name:"site.zip",mimeType:"application/zip",buffer:archive});
 assert.equal(await page.locator("#zipNext").isEnabled(),true);
 await page.locator("#zipNext").click();
 assert(await page.locator("#stage-repo").isVisible());
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#repoNext").click();
 assert(await page.locator("#stage-aim").isVisible());
 await page.locator("#projectAim").fill("Bezoekers moeten een pagina kunnen openen");
 await page.screenshot({path:join(out,"eaigit-intake.png"),fullPage:true});
 await page.locator("#analyze").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:15000});
 assert.match(await page.locator("#resultHeading").innerText(),/privébestanden/);
 assert.equal(await page.locator("#goodDetails").getAttribute("open"),null);
 assert.match(await page.locator("#goodPoints").textContent(),/HTML-bestanden/);
 assert.match(await page.locator("#problemPoints").textContent(),/privébestanden/);
 assert.match(await page.locator("#unknownPoints").textContent(),/Logische fouten/);
 assert.match(await page.locator("#workSummary").innerText(),/onderzocht/);
 await page.locator("#workDetails summary").click();
 assert.match(await page.locator("#workEvidence").innerText(),/Niet getest/);
 assert.match(await page.locator("#workEvidence").innerText(),/ZIP-bestand/);
 assert.equal(await page.locator("#repoLink").getAttribute("href"),"https://github.com/voorbeeld/project");
 assert.equal(await page.locator("#actionsLink").getAttribute("href"),"https://github.com/voorbeeld/project/actions");
 assert.ok(spawned.filter(url=>url.includes("onderzoek-worker.mjs")).length>=2,"GitHub en ZIP werken in aparte browserworkers");
 assert.equal(await page.locator("#stage-guide").isVisible(),false);
 assert.equal(sent.filter(x=>x.method!=="GET").length,0,"Geen uploads naar een externe server");
 assert.equal(sent.filter(x=>x.url.startsWith("https://api.github.com/")).length,2);
 await page.screenshot({path:join(out,"eaigit-desktop.png"),fullPage:true});
 // De begeleiding toont maar een handeling en geen standaardprompt.
 await page.locator("#startGuidance").click();
 assert(await page.locator("#stage-guide").isVisible());
 assert.match(await page.locator("#guideTitle").innerText(),/privébestanden/);
 assert.match(await page.locator("#guideReason").innerText(),/privégegevens kan wijzen/);
 await page.locator("#guideCheckDetails summary").click();
 assert.match(await page.locator("#guideCheck").innerText(),/Bekijk/);
 await page.locator("#guideTrouble").click();
 assert(await page.locator("#helpDialog").evaluate(el=>el.open));
 await page.locator("#helpClose").click();
 assert.equal(await page.locator("#phasePrompts").getAttribute("href"),"/tools/eaigit/prompts/?taak=veiligheid");
 await page.locator("#guideMore").click();
 assert(await page.locator("#helpDialog").evaluate(el=>el.open));
 assert.match(await page.locator("#helpTitle").innerText(),/privé blijven/);
 assert.match(await page.locator("#helpContextTip").innerText(),/wachtwoorden/);
 assert(parseFloat(await page.locator("#progressFill").evaluate(el=>el.style.width))<100,"Niet al klaar tijdens begeleiding");
 assert.match(await page.locator("#helpSteps").innerText(),/geheime sleutels/);
 await page.locator("#helpClose").click();
 assert.equal(await page.locator("#promptDetails").isVisible(),false);
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#guideTitle").innerText(),/map klaar/);
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#guideTitle").innerText(),/ontbreekt/);
 await page.locator("#promptDetails summary").click();
 const stepPrompt=await page.locator("#stepPrompt").inputValue();
 assert.match(stepPrompt,/repository/i);
 assert.match(stepPrompt,/zonder mijn toestemming/);
 await page.locator("#copyPrompt").click();
 assert.match(await page.locator("#copyStatus").innerText(),/Gekopieerd/);
 assert.equal(await page.evaluate(()=>window.__copiedProjectAdvice),stepPrompt);
 await page.locator("#guideBack").click();
 assert.match(await page.locator("#guideTitle").innerText(),/map klaar/);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:join(out,"eaigit-mobiel.png"),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Geen horizontale scroll op mobiel");
 for(let k=0;k<8;k++){
  if(await page.locator("#stage-finished").isVisible())break;
  await page.locator("#guideNext").click();
 }
 assert(await page.locator("#stage-finished").isVisible());
 assert.match(await page.locator("#stage-finished").innerText(),/niet gecontroleerd/);
 assert(await page.locator("#checkAgain").isVisible());
 // Foutpad: ongeldige URL wordt op hetzelfde scherm afgehandeld.
 await page.locator("#finishReset").click();
 await page.locator('[data-intent="repair"]').click();
 await page.locator('[data-source="github"]').click();
 assert(await page.locator("#stage-repo").isVisible());
 await page.locator("#repoUrl").fill("javascript:alert(1)");
 await page.locator("#repoNext").click();
 assert.match(await page.locator("#repoError").innerText(),/repositorylink/);
 assert(await page.locator("#stage-repo").isVisible());
 // Tweede volledige route: repository bevat alleen een ZIP.
 zipOnly=true;
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#repoNext").click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 assert.match(await page.locator("#problemPoints").textContent(),/ZIP in GitHub/);
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/ZIP uit/);
 // Derde route: bezoeker heeft nog geen bestanden.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="explore"]').click();
 await page.locator('[data-source="unknown"]').click();
 assert(await page.locator("#stage-aim").isVisible());
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 assert.match(await page.locator("#resultHeading").innerText(),/nog geen bestanden onderzocht/i);
 assert.match(await page.locator("#goodCount").innerText(),/Nog niets onderzocht/);
 assert.match(await page.locator("#issueCount").innerText(),/Nog geen controle/);
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/projectbestanden/);
 // Nieuwe repository wordt pas gevraagd nadat iemand die heeft aangemaakt.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="start"]').click();
 await page.locator('[data-source="zip"]').click();
 await page.locator("#zipFile").setInputFiles({name:"mijnsite.zip",mimeType:"application/zip",buffer:safeArchive});
 await page.locator("#zipNext").click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/Pak de ZIP uit/);
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#guideTitle").innerText(),/repository/);
 assert(await page.locator("#createdRepoBox").isVisible());
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#createdRepoError").innerText(),/Plak eerst de link/);
 await page.locator("#createdRepoUrl").fill("not-a-repo");
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#createdRepoError").innerText(),/repositorylink/);
 await page.locator("#createdRepoUrl").fill("https://github.com/voorbeeld/nieuw-project");
 await page.locator("#guideNext").click();
 assert.match(await page.locator("#guideTitle").innerText(),/Voeg je bestanden toe/);
 assert.equal(await page.locator("#guideLink").getAttribute("href"),"https://github.com/voorbeeld/nieuw-project");
 // Eigen doel is leidend: de wizard vraagt om een gerichte oefeningentest en doet geen onterechte succesclaim.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="repair"]').click();
 await page.locator('[data-source="zip"]').click();
 const exercises=zip([["les/index.html",'<button id="startQuiz">Maak de oefening</button>'],["les/app.js",'console.log("test fixture")']]);
 await page.locator("#zipFile").setInputFiles({name:"oefeningen.zip",mimeType:"application/zip",buffer:exercises});
 await page.locator("#zipNext").click();
 await page.locator("#projectAim").fill("Leerlingen moeten oefeningen maken en na elk antwoord feedback en een score zien.");
 await page.locator("#analyze").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 assert.match(await page.locator("#unknownPoints").textContent(),/oefeningen/);
 await page.locator("#startGuidance").click();
 let exerciseStepFound=false;
 for(let k=0;k<8;k++){
  const stage=await page.locator("#stage-guide").isVisible();
  if(!stage)break;
  const title=await page.locator("#guideTitle").innerText();
  if(title==="Controleer de oefeningen"){
   assert.match(await page.locator("#guideDescription").innerText(),/goed en een fout antwoord/);
   exerciseStepFound=true;
   break;
  }
  if(title==="Maak een repository op GitHub"){
   await page.locator("#createdRepoUrl").fill("https://github.com/voorbeeld/oefeningen");
  }
  await page.locator("#guideNext").click();
 }
 assert.equal(exerciseStepFound,true,"Gebruikersdoel moet concrete functietest in wizard tonen");
 // De test is een opdracht aan de eigenaar; EAIgit heeft de werking nog niet bevestigd.
 assert.match(await page.locator("#unknownPoints").textContent(),/niet uitgevoerd/);

 // Hulppagina: eigen overzicht, per onderwerp slechts korte instructies.
 await page.goto(base+"/tools/eaigit/hulp/#uitleg-plugins");
 assert.match(await page.title(),/Uitleg en hulp bij je project/);
 assert(await page.locator("#uitleg-plugins").evaluate(el=>el.open));
 assert.match(await page.locator("#uitleg-plugins").innerText(),/lezen/);
 assert.match(await page.locator(".eg-tool-cards").innerText(),/GitHub/);
 assert.match(await page.locator(".eg-tool-cards").innerText(),/ChatGPT/);
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Hulppagina past op telefoon");
 await page.screenshot({path:join(out,"eaigit-uitleg-mobiel.png"),fullPage:true});
 // Promptbibliotheek: dezelfde rustige dashboardopzet op groot en klein scherm.
 await page.setViewportSize({width:1365,height:900});
 await page.goto(base+"/tools/eaigit/prompts/");
 assert(await page.locator("#selectedPrompt").isVisible(),"Op desktop is de geselecteerde opdracht direct zichtbaar");
 assert.equal(await page.locator("#promptList .eg-prompt-card").count(),PROMPT_LIBRARY.length);
 assert.equal(await page.locator(".eg-logo img").count(),1,"Alleen eigen EAIgit-logo");
 assert.equal(await page.locator(".eg-dashboard-homebrand").count(),0,"Geen dubbel EAI-logo");
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Dashboard past op desktop");
 await page.screenshot({path:join(out,"eaigit-prompts-desktop.png"),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+"/tools/eaigit/prompts/?fase=controleren");
 assert.equal(await page.locator("#promptList .eg-prompt-card").count(),promptsForPhase("controleren").length);
 assert.equal(await page.locator('[data-phase="controleren"]').getAttribute("aria-pressed"),"true");
 await page.goto(base+"/tools/eaigit/prompts/");
 assert.match(await page.title(),/Promptbibliotheek/);
 assert(await page.locator("#selectedOutcome").textContent());
 await page.locator("#promptSearch").fill("zoek en herstel een fout");
 assert((await page.locator("#promptList .eg-prompt-card").count())>0);
 assert((await page.locator("#promptList .eg-prompt-card").count())<PROMPT_LIBRARY.length);
 await page.locator("#promptSearch").fill("");
 assert.equal(await page.locator("#promptList .eg-prompt-card").count(),PROMPT_LIBRARY.length);
 await page.locator('[data-phase="controleren"]').click();
 assert.equal(await page.locator("#promptList .eg-prompt-card").count(),promptsForPhase("controleren").length);
 await page.locator('[data-prompt-id="gebruikstest"]').click();
 assert(await page.locator("#selectedPrompt").isVisible());
 await page.locator("#projectSettings summary").click();
 await page.locator("#promptRepo").fill("https://github.com/voorbeeld/project");
 await page.locator("#promptGoal").fill("Bezoekers kunnen een oefening afronden");
 assert(await page.locator("#promptWorkspace").evaluate(el=>el.classList.contains("eg-dashboard-mobile-detail")),"Op mobiel opent de gekozen opdracht als eigen werkruimte");
 assert.match(await page.locator("#selectedOutcome").innerText(),/testrapport/i);
 const selectedPrompt=await page.locator("#selectedBody").inputValue();
 assert.match(selectedPrompt,/https:\/\/github.com\/voorbeeld\/project/);
 assert.match(selectedPrompt,/Bezoekers kunnen een oefening afronden/);
 assert.match(selectedPrompt,/niet|geen|test/i);
 await page.locator("#copySelected").click();
 assert.match(await page.locator("#copyFeedback").innerText(),/gekopieerd/);
 assert.equal(await page.evaluate(()=>window.__copiedProjectAdvice),selectedPrompt);
 await page.locator("#selectedBody").fill("Mijn wijziging");
 await page.locator("#restoreSelected").click();
 assert.equal(await page.locator("#selectedBody").inputValue(),selectedPrompt);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Promptbibliotheek past op telefoon");
 const mobileTitleSize=await page.locator("#promptPageTitle").evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 assert(mobileTitleSize<=34,"Mobiele kop is te groot: "+mobileTitleSize+"px");
 await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
 await page.waitForFunction(()=>window.scrollY===0);
 await page.screenshot({path:join(out,"eaigit-prompts-mobiel.png"),fullPage:true});
 // Korte keuzeroute en ervaren modus mogen geen schijncontrole opleveren.
 await page.setViewportSize({width:1365,height:900});
 await page.goto(base+"/tools/eaigit/prompts/");
 await page.locator('[data-suggest="fix"]').click();
 assert.match(await page.locator("#selectedTitle").innerText(),/fout/);
 assert.equal(await page.locator('[data-phase="bouwen"]').getAttribute("aria-pressed"),"true");
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-experience="compact"]').click();
 assert.equal(await page.locator('[data-experience="compact"]').getAttribute("aria-pressed"),"true");
 await page.locator('[data-intent="publish"]').click();
 await page.locator('[data-source="unknown"]').click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:12000});
 assert.equal(await page.locator("#workDetails").evaluate(el=>el.open),false,"Onderzoeksdetails staan standaard dicht");
 await page.locator("#workDetails summary").click();
 assert.match(await page.locator("#workEvidence").innerText(),/Niet uitgevoerd/);
 await page.locator("#startGuidance").click();
 assert.equal(await page.locator("#routeDetails").evaluate(el=>el.open),false,"Route staat standaard dicht");
 await page.locator("#routeDetails summary").click();
 assert(await page.locator("#routeDetails").evaluate(el=>el.open));
 assert.match(await page.locator("#guideDescription").innerText(),/private repository/i);
 assert((await page.locator("#routeList button").count())>=2);
 assert.equal(await page.locator("#guideCheckDetails").evaluate(el=>el.open),false,"Controleuitleg staat standaard dicht");
 await page.locator("#guideCheckDetails summary").click();
 assert(await page.locator("#guideCheckDetails").evaluate(el=>el.open));
 // Nieuwe controle: ZIP met ongeldige JavaScript-syntaxis leidt zonder AI naar
 // een concrete vervolgstap, een echt bronregelnummer en een optionele prompt.
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="repair"]').click();
 await page.locator('[data-source="zip"]').click();
 const brokenZip=zip([
  ["probe/index.html",'<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="bestaand"></div></body></html>'],
  ["probe/app.js","const kapot = ;"]
 ]);
 await page.locator("#zipFile").setInputFiles({name:"codecontrole.zip",mimeType:"application/zip",buffer:brokenZip});
 await page.locator("#zipNext").click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:15000});
 assert(await page.locator("#auditNext").isVisible(),"Gegronde vervolgstap ontbreekt");
 assert.match(await page.locator("#auditNextTitle").innerText(),/JavaScript-syntaxis/);
 assert.ok((await page.locator("#auditNextSource").innerText()).includes("app.js · regel 1"));
 await page.locator("#issueDetails summary").click();
 assert.match(await page.locator("#problemPoints").innerText(),/JavaScript-syntaxisfout/);
 await page.locator("#workDetails summary").click();
 assert.match(await page.locator("#workEvidence").innerText(),/JavaScript-syntaxis/);
 assert.match(await page.locator("#workEvidence").innerText(),/Niet getest/);
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/JavaScript-syntaxis/);
 assert.match(await page.locator("#guideReason").innerText(),/parser/);
 assert.equal(await page.locator("#phasePrompts").getAttribute("href"),"/tools/eaigit/prompts/?taak=fix");
 await page.locator("#promptDetails summary").click();
 assert.ok((await page.locator("#stepPrompt").inputValue()).includes("app.js (regel 1)"));
 assert.match(await page.locator("#stepPrompt").inputValue(),/toestemming/);
 await page.locator("#copyPrompt").click();
 assert.match(await page.locator("#copyStatus").innerText(),/Gekopieerd/);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Codeadvies past niet op mobiel");
 await page.screenshot({path:join(out,"eaigit-codecontrole-mobiel.png"),fullPage:true});
 assert.equal(sent.filter(x=>x.method!=="GET").length,0,"Projectcode is nooit verstuurd of uitgevoerd");
 // Zelfstandig een los bestand willen maken, zonder aangeleverde bron of GitHub.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="local"]').click();
 await page.locator('[data-source="unknown"]').click();
 assert(await page.locator("#deliveryChoices").isVisible());
 await page.locator("#projectAim").fill("Een offline oefening die resultaten lokaal kan tonen");
 await page.locator('[data-delivery="share"]').click();
 assert.equal(await page.locator('[data-delivery="share"]').getAttribute("aria-pressed"),"true");
 await page.locator("#analyze").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor();
 assert.match(await page.locator("#resultHeading").innerText(),/geen bestanden onderzocht/);
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/Maak het losse bestand/);
 assert.equal(await page.locator("#phasePrompts").isVisible(),false,"De GitHub-opdrachten horen niet in een lokale route");
 await page.locator("#promptDetails summary").click();
 assert.match(await page.locator("#stepPrompt").inputValue(),/Een offline oefening/);
 assert.doesNotMatch(await page.locator("#stepPrompt").inputValue(),/Mijn repository|vul je GitHub-link in/i);
 const shareSteps=await page.locator("#routeList button").allTextContents();
 assert(shareSteps.some(x=>/anderen het bestand/.test(x)));
 assert(!shareSteps.some(x=>/repository|GitHub/i.test(x)));
 assert.equal(await page.locator("#routeDetails").evaluate(el=>el.open),false,"Extra uitleg blijft gesloten");
 await page.screenshot({path:join(out,"eaigit-los-bestand-zonder-bron.png"),fullPage:true});

 // Gegeven losse HTML met externe onderdelen: een echte browserworkercontrole.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="local"]').click();
 await page.locator('[data-source="file"]').click();
 assert(await page.locator("#stage-file").isVisible());
 assert.equal(await page.locator("#stage-zip").isVisible(),false);
 const localHtml='<!doctype html><html><head><meta name="viewport" content="width=device-width"><script type="module" src="https://cdn.example/script.js"></script></head><body><h1>Oefening</h1></body></html>';
 await page.locator("#singleFile").setInputFiles({name:"oefening.html",mimeType:"text/html",buffer:Buffer.from(localHtml)});
 await page.locator("#fileNext").click();
 assert(await page.locator("#stage-aim").isVisible());
 assert(await page.locator("#deliveryChoices").isVisible());
 await page.locator("#projectAim").fill("Oefening werkt zonder internet");
 await page.locator("#analyze").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:15000});
 assert.match(await page.locator("#resultHeading").innerText(),/Externe onderdelen/);
 await page.locator("#workDetails summary").click();
 assert.match(await page.locator("#workEvidence").innerText(),/Los bestand/);
 assert.match(await page.locator("#workEvidence").innerText(),/Offline gebruik/);
 await page.locator("#startGuidance").click();
 assert.match(await page.locator("#guideTitle").innerText(),/voorwaarden voor lokaal gebruik/);
 assert.match(await page.locator("#guideDescription").innerText(),/externe verwijzing/);
 const offlineSteps=await page.locator("#routeList button").allTextContents();
 assert(offlineSteps.some(x=>/zonder internet/.test(x)));
 assert(!offlineSteps.some(x=>/repository|GitHub/i.test(x)));
 assert.equal(sent.filter(x=>x.method!=="GET").length,0,"Ook een los bestand wordt nergens naartoe geüpload");
 await page.screenshot({path:join(out,"eaigit-offline-html-mobiel.png"),fullPage:true});

 // Een lokaal ZIP-project mag eveneens zonder repository door de route.
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="local"]').click();
 await page.locator('[data-source="zip"]').click();
 await page.locator("#zipFile").setInputFiles({name:"offline.zip",mimeType:"application/zip",buffer:safeArchive});
 await page.locator("#zipNext").click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:15000});
 await page.locator("#startGuidance").click();
 const zipLocalSteps=await page.locator("#routeList button").allTextContents();
 assert(zipLocalSteps.some(x=>/lokaal uit/.test(x)));
 assert(!zipLocalSteps.some(x=>/repository|GitHub/i.test(x)));
 // The real browser worker must not announce success when the ninth check fails.
 const commitSha="a".repeat(40),treeSha="b".repeat(40);
 let checkMode="failure";
 const fixtureRun=(id,conclusion)=>({id,name:"EAIgit syntax "+id,head_sha:commitSha,status:"completed",conclusion,html_url:"https://github.com/voorbeeld/project/actions/runs/123/job/"+id});
 await page.unroute("https://api.github.com/**");
 await page.route("https://api.github.com/**",route=>{
  const url=route.request().url();
  let data,status=200;
  if(url.includes("/git/trees/"))data={sha:treeSha,truncated:false,tree:[{type:"blob",path:".github/workflows/check.yml"},{type:"blob",path:"index.html"}]};
  else if(url.endsWith("/commits/main"))data={sha:commitSha,commit:{tree:{sha:treeSha}}};
  else if(url.includes("/check-runs?")){
   assert.ok(url.includes("/commits/"+commitSha+"/"),"The checks must use the exact commit");
   if(checkMode==="unavailable"){status=429;data={message:"rate limit"};}
   else data={total_count:9,check_runs:Array.from({length:9},(_,i)=>fixtureRun(i+1,i===8&&checkMode==="failure"?"failure":"success"))};
  }else if(url.includes("/annotations?"))data=[];
  else data={full_name:"voorbeeld/project",html_url:"https://github.com/voorbeeld/project",private:false,default_branch:"main"};
  return route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(data)});
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+"/tools/eaigit/");
 await page.locator('[data-intent="repair"]').click();
 await page.locator('[data-source="github"]').click();
 await page.locator("#repoUrl").fill("https://github.com/voorbeeld/project");
 await page.locator("#repoNext").click();
 await page.locator("#aimSkip").click();
 await page.locator("#stage-result:not(.eg-hidden)").waitFor({timeout:15000});
 assert.equal(await page.locator("#githubCheckPanel").getAttribute("data-state"),"failed");
 assert.match(await page.locator("#githubCheckList").innerText(),/EAIgit syntax 9/);
 assert.equal(await page.locator("#githubCheckList li").count(),8);
 assert.match(await page.locator("#githubCheckRevision").innerText(),/aaaaaaaaaaaa/);
 await page.screenshot({path:join(out,"eaigit-github-checks-failure-mobile.png"),fullPage:true});
 checkMode="success";
 await page.locator("#githubCheckReload").click();
 await page.waitForFunction(()=>document.querySelector("#githubCheckPanel").dataset.state==="checked");
 assert.match(await page.locator("#githubCheckExplanation").innerText(),/werking.*niet getest/);
 checkMode="unavailable";
 await page.locator("#githubCheckReload").click();
 await page.waitForFunction(()=>document.querySelector("#githubCheckPanel").dataset.state==="unavailable");
 assert.equal(await page.locator("#githubCheckList li").count(),0,"Old successful results must disappear after an unsuccessful refresh");
 assert.equal(sent.filter(x=>x.method!=="GET").length,0);
 // Oude URL blijft werken, zonder de oude naam in de nieuwe UI.
 await page.goto(base+"/tools/projecthulp/");
 await page.waitForURL("**/tools/eaigit/");
 assert.deepEqual(errors,[]);
 console.log("EAIgit wizard geslaagd: intake, eigen ZIP, openbare GitHub, stap-voor-stap, mobiel, foutpad en oude URL.");
}finally{await browser?.close();server.kill();}
