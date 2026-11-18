import test from "node:test";
import assert from "node:assert/strict";
import {inspectStaticProject} from "../assets/projecthulp/static-audit.mjs";

const inspect=(entries,paths=entries.map(x=>x[0]),options={})=>
 inspectStaticProject(entries.map(([path,text])=>({path,text})),paths,options);

test("JavaScript: echte parser accepteert geldige module en script zonder code uit te voeren",()=>{
 globalThis.__eaiAuditCanary=0;
 const a=inspect([
  ["index.html",'<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="app"></div></body></html>'],
  ["app.mjs",'import {x} from "./other.mjs"; document.getElementById("app").textContent = x;'],
  ["other.mjs",'export const x = (()=>{ globalThis.__eaiAuditCanary=42; return 1; })();']
 ]);
 assert.equal(a.checked.javascript,2);
 assert.equal(a.passed.javascript,2);
 assert.equal(a.findings.length,0);
 assert.equal(globalThis.__eaiAuditCanary,0,"Geen code uit ZIP uitvoeren");
 delete globalThis.__eaiAuditCanary;
});
test("JavaScript: syntaxisfout heeft type, bestand, regel en brongebonden tekst",()=>{
 const a=inspect([["src/app.js","const count = ;\nconsole.log(count);"]]);
 const f=a.findings.find(x=>x.type==="javascript-syntax");
 assert.ok(f);assert.equal(f.path,"src/app.js");assert.equal(f.line,1);
 assert.equal(f.certainty,"observed");
 assert.equal(a.passed.javascript,0);
 assert.equal(a.checked.javascript,1);
});
test("JSX en TypeScript geven geen onterechte rode JavaScript-fout",()=>{
 const a=inspect([
  ["src/app.jsx",'export default function App(){return <main>Hallo</main>}'],
  ["src/app.ts","const x: number = 3;"],
  ["src/component.js","export const View=()=> <Button />;"]
 ]);
 assert.equal(a.checked.javascript,1);
 assert.equal(a.findings.filter(x=>x.type==="javascript-syntax").length,0);
 assert.ok(a.skipped.javascript.includes("src/app.jsx"));
 assert.ok(a.skipped.javascript.includes("src/app.ts"));
 assert.ok(a.skipped.javascript.includes("src/component.js"));
 assert.equal(a.incomplete,true);
});
test("HTML: dubbele ids en ontbrekende alt met exacte bestandsregel",()=>{
 const a=inspect([["index.html",`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body>
<div id="antwoord"></div>
<div id="antwoord"></div>
<img src="beeld.png">
</body></html>`]]);
 const duplicate=a.findings.find(x=>x.type==="duplicate-html-id");
 const img=a.findings.find(x=>x.type==="image-without-alt");
 assert.ok(duplicate);assert.equal(duplicate.line,3);
 assert.ok(img);assert.equal(img.line,4);
 assert.equal(a.checked.html,1);
});
test("DOM: vastgelegde aanwijzing, geen bewezen ontbrekend dynamisch element",()=>{
 const a=inspect([
  ["index.html",'<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="wel"></div></body></html>'],
  ["app.js",'document.getElementById("wel");document.getElementById("later");']
 ]);
 const refs=a.findings.filter(x=>x.type==="dom-id-unseen");
 assert.equal(refs.length,1);
 assert.match(refs[0].detail,/Mogelijk/);
 assert.equal(refs[0].certainty,"review");
 assert.equal(refs[0].path,"app.js");
});
test("Structuur: echte index ontbreekt in aangeleverde projectlijst, zonder false claim over build",()=>{
 const a=inspect([["pages/home.html","<h1>Start</h1>"]],
  ["pages/home.html","package.json"]);
 const missing=a.findings.find(x=>x.type==="entry-unconfirmed");
 assert.ok(missing);
 assert.match(missing.detail,/buildproces/);
 assert.equal(missing.certainty,"review");
});
test("Projectinstellingen: ontbrekende node-start is te controleren, npm-scripts worden nooit uitgevoerd",()=>{
 globalThis.__lintScriptExecuted=0;
 const manifest={scripts:{start:"node ./src/serve.mjs",lint:"node -e 'globalThis.__lintScriptExecuted++'"}};
 const a=inspect([["package.json",JSON.stringify(manifest)]],["package.json"],{manifest});
 const item=a.findings.find(x=>x.type==="missing-script-entry");
 assert.ok(item);assert.equal(item.path,"package.json");
 assert.equal(item.certainty,"review");
 assert.equal(globalThis.__lintScriptExecuted,0);
 assert.deepEqual(a.scripts.sort(),["lint","start"]);
 delete globalThis.__lintScriptExecuted;
});
test("Beperkte of lege bronnen worden niet voor bewezen schoon gehouden",()=>{
 const a=inspect([],["src/app.js","index.html"]);
 assert.equal(a.checked.javascript,0);
 assert.equal(a.passed.javascript,0);
 assert.equal(a.checked.html,0);
 assert.equal(a.findings.filter(x=>x.type==="javascript-syntax").length,0);
 assert.ok(a.limits.some(x=>x.includes("geen volledige ESLint")));
});
