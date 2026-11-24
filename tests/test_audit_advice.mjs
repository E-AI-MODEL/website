import test from "node:test";
import assert from "node:assert/strict";
import {selectAuditAction} from "../assets/eaigit/audit-advice.mjs";
import {buildJourney,helpPrompt} from "../assets/eaigit/journey.mjs";
import {getHelpForStep} from "../assets/eaigit/help-topics.mjs";

test("Een syntaxfout wordt een concrete eerste herstelstap met bron en handmatige prompt",()=>{
 const archive={
  eligible:["index.html","app.js"],secret:[],
  contentCheck:{findings:[{type:"javascript-syntax",title:"JavaScript-syntaxisfout",
   detail:"Unexpected token",path:"app.js",line:3,certainty:"observed"}]}
 };
 const audit=selectAuditAction({archive});
 assert.equal(audit.type,"javascript-syntax");
 assert.equal(audit.line,3);assert.equal(audit.path,"app.js");
 assert.equal(audit.source,"ZIP");
 assert.equal(audit.promptId,"fix");
 assert.match(audit.prompt,/app\.js \(regel 3\)/);
 assert.match(audit.prompt,/toestemming/);
 const route=buildJourney({intent:"repair",source:"zip",archive,guidance:{problems:[]},auditAction:audit});
 assert.equal(route[0].id,"audit");
 assert.ok(route.some(x=>x.id==="try"));
 assert.ok(!route.some(x=>["create","upload"].includes(x.id)));
 assert.match(helpPrompt(route[0]),/JavaScript-syntaxisfout/);
 assert.equal(getHelpForStep("audit"),"codecheck");
});
test("Privébestanden gaan vóór lintproblemen",()=>{
 const archive={eligible:["app.js"],secret:[".env"],contentCheck:{findings:[
  {type:"javascript-syntax",path:"app.js",title:"Fout",detail:"Fout",line:1}
 ]}};
 const audit=selectAuditAction({archive});
 const route=buildJourney({intent:"start",source:"zip",archive,guidance:{problems:[]},auditAction:audit});
 assert.deepEqual(route.slice(0,3).map(x=>x.id),["private","safe","audit"]);
});
test("Een onbekende dynamische DOM-ID is een waarschuwing, geen bewezen fout",()=>{
 const archive={eligible:["index.html","app.js"],contentCheck:{findings:[
  {type:"dom-id-unseen",title:"HTML-element niet statisch gevonden",detail:"Kan later bestaan",
   path:"app.js",line:8,certainty:"review"}
 ]}};
 const audit=selectAuditAction({archive});
 assert.equal(audit.certainty,"review");
 assert.equal(audit.type,"dom-id-unseen");
 assert.match(audit.notice,/aanwijzing/);
});
test("Kleine HTML-verbeterpunten overstemmen de eigenlijke gebruikersvraag niet",()=>{
 const archive={eligible:["index.html"],contentCheck:{findings:[
  {type:"missing-viewport",title:"Viewport",detail:"Niet gevonden",path:"index.html",certainty:"review"},
  {type:"missing-doctype",title:"Doctype",detail:"Niet gevonden",path:"index.html",certainty:"review"},
 ]}};
 assert.equal(selectAuditAction({archive}),null);
});
test("Bij meerdere bevindingen krijgt de aangetoonde JS-fout voorrang boven HTML-hints",()=>{
 const a={contentCheck:{findings:[
  {type:"dom-id-unseen",title:"Element",detail:"Onbekend",path:"app.js",certainty:"review"},
  {type:"javascript-syntax",title:"JS",detail:"Parse error",path:"app.js",line:2,certainty:"observed"}
 ]}};
 assert.equal(selectAuditAction({archive:a}).type,"javascript-syntax");
});
