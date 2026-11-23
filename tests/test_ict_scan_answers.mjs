import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resolve} from 'node:path';
import inventoryIndex from '../tools/ict-scan/inventory-index.js';
const read=p=>readFileSync(resolve(p),'utf8');
const main=JSON.parse(read('tools/ict-scan/bronnen/2026-applicatielandschap.json'));
const work=JSON.parse(read('tools/ict-scan/bronnen/2026-werkregister.json'));
const faq=JSON.parse(read('tools/ict-scan/bronnen/2026-faq.json'));
const sources=JSON.parse(read('tools/ict-scan/bronnen/2026-bronnenregister.json'));
const source=read('tools/ict-scan/answer-engine.js');
const html=read('tools/ict-scan/index.html');
const ctx={window:{},document:{getElementById(){return null;}}};
vm.runInNewContext(source,ctx,{filename:'answer-engine.js'});
const query=ctx.window.EmmausAnswerLogic.search;
const predict=ctx.window.EmmausAnswerLogic.predict;
const dataset={
  apps:main.apps,ai:main.ai,connections:main.connections,parts:main.parts,
  candidates:main.additionalCandidates,faqs:faq.faqs,dpia:main.dpia,
  licenseReview:main.licenseReview,workActions:work.workActions,devices:main.devices
};
const ask=q=>query(q,dataset);
const tasks=[
  ['wie beheert 3CX?','field',/verantwoordelijke nog niet vastgesteld/i,'APP-033'],
  ['Gebruiken we 3CX?','usage',/geregistreerd.*niet bevestigd/i,'APP-033'],
  ['Wat doet 3CX?','description',/telefonie en bereikbaarheid/i,'APP-033'],
  ['Welke gegevens verwerkt 3CX?','field',/nog niet vastgesteld welke gegevens/i,'APP-033'],
  ['Welke koppelingen heeft 3CX?','field',/gegevensuitwisseling nog niet vastgesteld/i,'APP-033'],
  ['Heeft 3CX een verwerkersovereenkomst?','field',/nog niet vastgesteld/i,'APP-033'],
  ['Wat is de DPIA-status van Kuario?','field',/nog niet vastgesteld/i,'APP-045'],
  ['Wat is de bron van 3CX?','source',/Bronnen.*bewaard voor de interne controle/i,'APP-033'],
  ['Heeft 3CX AI-functies?','relations',/geen AI-functies gekoppeld/i,'APP-033'],
  ['Welke AI-functies kent Microsoft 365?','relations',/16 AI-functies beschreven/i,'APP-034'],
  ['Hoeveel applicaties zijn er?','count',/69 basisregistraties/i],
  ['Hoeveel AI-functies staan er?','count',/76 beschreven AI-functies/i],
  ['Hoeveel Entra-registraties zijn er?','count',/93 Entra-registraties/i],
  ['Hoeveel kandidaten zijn er?','count',/76 aanvullende kandidaten/i],
  ['Hoeveel apps hebben AI-functies?','count',/beschreven AI-functie/i],
  ['Welke printsoftware gebruiken we?','list',/Canon UniFlow.*Kuario|Kuario.*Canon UniFlow/i],
  ['Welke telefoniesoftware staat geregistreerd?','list',/3CX/i,'APP-033'],
  ['Welke applicaties hebben nog geen verantwoordelijke?','list',/geen vastgestelde verantwoordelijke/i],
  ['Welke applicaties hebben een Entra-match?','list',/mogelijke Entra-match/i],
  ['Wat betekent een Entra-registratie?','faq',/bewijst niet dat de dienst/i,'FAQ-001'],
  ['Wat is een verwerkersovereenkomst?','faq',/verwerkingsverantwoordelijke/i,'FAQ-007'],
  ['Wat is het IBP-normenkader?','faq',/informatiebeveiliging en privacy/i,'FAQ-008'],
  ['Hoe worden wijzigingen vastgelegd?','faq',/pull-request/i,'FAQ-010'],
  ['Hoe voeg ik een nieuwe toepassing toe?','faq',/JSON-kaarten beheren/i,'FAQ-011'],
  ['Wat betekent niet vastgesteld?','faq',/onvoldoende informatie/i,'FAQ-004'],
  ['Wat is de status van de inventarisatie 2026?','faq',/10 augustus 2026/i,'FAQ-014'],
  ['Wat zijn de AI Act verplichtingen van 3CX?','legal',/nog geen concrete wets- of normbeoordeling/i,'APP-033'],
  ['Welke ruimteschepen gebruiken we?','none',/Geen betrouwbaar antwoord/i]
];
for(const [question,kind,expected,recordId] of tasks){
  test('Vast antwoord op: '+question,()=>{
    const response=ask(question);
    assert.equal(response.kind,kind,'Onjuiste vraagroutering: '+question+' → '+response.kind);
    assert.match(response.answer,expected,question+' → '+response.answer);
    if(recordId)assert.ok(response.records.some(x=>x.id===recordId),'Bronregistratie ontbreekt voor '+question);
  });
}
test('De zoekbalk voorspelt natuurlijke vragen terwijl je typt',()=>{
  const options=predict('print',dataset);
  assert.ok(options.length>=1);
  assert.equal(options[0].question,'Welke printsoftware gebruiken we?');
  assert.ok(options.every(x=>!x.question.includes('is geregistreerd')));
  assert.ok(options.every(x=>x.question.endsWith('?')));
});
test('Voorspellingen gebruiken de naam van de gevonden toepassing',()=>{
  const items=predict('3CX',dataset);
  assert.ok(items.some(x=>x.question==='Wie beheert 3CX?'));
  assert.ok(items.some(x=>x.question==='Gebruiken we 3CX?'));
  const source=predict('Canon uni',dataset);
  assert.ok(source.some(x=>x.question==='Wie beheert Canon UniFlow?'));
});
test('Vaste FAQ-vragen zijn voorstellen, niet de korte aliasfragmenten',()=>{
  const options=predict('entra registratie',dataset);
  assert.ok(options.some(x=>x.question==='Wat betekent een Entra-registratie?'));
  assert.ok(options.every(x=>x.question.includes('?')));
  assert.ok(!options.some(x=>x.question==='entra registratie betekenis'));
});
test('Zonder invoer toont de zoekbalk enkele nuttige startvragen',()=>{
  const options=predict('',dataset);
  assert.ok(options.length>=2&&options.length<=5);
  assert.ok(options.some(x=>x.question==='Welke printsoftware gebruiken we?'));
});
test('Voorspellingen leiden niet tot verzonnen antwoorden en gelden alleen voor aanwezige brongegevens',()=>{
  const empty={...dataset,apps:[],ai:[],connections:[],faqs:[]};
  assert.deepEqual(Array.from(predict('printer',empty)),[]);
  const original=predict('print',dataset);
  assert.ok(original.length>0);
  assert.equal(query(original[0].question,dataset).kind,'list');
  assert.match(query(original[0].question,dataset).answer,/Canon UniFlow|Kuario/);
});
test('Een antwoord komt pas na keuze of Enter, niet tijdens het voorspellen',()=>{
  const js=read('tools/ict-scan/answer-engine.js');
  assert.ok(js.includes('function render(){return suggest();}'));
  assert.ok(js.includes("button.addEventListener('click',()=>select(index))"));
  assert.ok(js.includes("if(event.key==='ArrowDown'||event.key==='ArrowUp')"));
  assert.ok(js.includes("if(event.key==='Enter')"));
  assert.ok(js.includes("answer(input.value);return true;"));
  const enh=read('tools/ict-scan/enhancements.js');
  assert.ok(enh.includes('window.EmmausAnswerEngine?.handleKeydown(e)'));
});

test('Geen bevestiging uit een ontbrekend veld verzinnen',()=>{
  const who=ask('Wie beheert 3CX?');
  assert.equal(who.status,'Niet vastgesteld');
  assert.doesNotMatch(who.answer,/\b(hoofd ict|facilitair manager|beheerder jan)\b/i);
  const use=ask('Gebruiken we 3CX?');
  assert.equal(use.status,'Niet vastgesteld');
  assert.match(use.answer,/niet bevestigd/);
  const legal=ask('Wat zijn de AI Act verplichtingen van 3CX?');
  assert.equal(legal.status,'Niet beoordeeld');
});
test('Vragen gebruiken de actuele bronpopulatie en geen vaste aantallen',()=>{
  const changed={...dataset,apps:dataset.apps.slice(1),ai:dataset.ai.slice(0,10),connections:dataset.connections.slice(0,12),candidates:dataset.candidates.slice(0,7)};
  assert.match(query('Hoeveel applicaties zijn er?',changed).answer,/68 basisregistraties/);
  assert.match(query('Hoeveel AI-functies zijn er?',changed).answer,/10 beschreven AI-functies/);
  assert.match(query('Hoeveel Entra-registraties zijn er?',changed).answer,/12 Entra-registraties/);
  assert.match(query('Hoeveel kandidaten zijn er?',changed).answer,/7 aanvullende kandidaten/);
});
test('LessonUp-telling is geen totaal van veertig schoolbrede licentiecontrolepunten',()=>{
  const output=ask('Hoeveel licenties heeft LessonUp?');
  assert.equal(output.kind,'count');
  assert.match(output.answer,/niet geverifieerd/i);
  assert.doesNotMatch(output.answer,/40 licentieregistraties/i);
  assert.ok(output.records.some(x=>x.id==='APP-008'));
});

function indexedDataset(){
  const store={};
  for(const type of inventoryIndex.TYPES){
    const rows=main[type]||work[type]||faq[type]||sources[type]||[];
    store[inventoryIndex.STORES[type]]=new Map(rows.map(row=>[row.id,row]));
  }
  return {...dataset,index:inventoryIndex.build(store)};
}
test('M365-vragen tellen uitsluitend productonderdelen uit de gedeelde index',()=>{
  const data=indexedDataset();
  assert.deepEqual(data.index.errors,[]);
  const modules=data.index.descendants('apps','APP-034',{maxDepth:3})
    .filter(x=>x.type==='parts'&&x.record.kind==='Microsoft 365-onderdeel');
  assert.equal(modules.length,40,'Teams- en Copilot-onderdelen worden via hun parent meegenomen');
  const count=query('Hoeveel apps heeft Microsoft 365?',data);
  assert.equal(count.kind,'count');
  assert.match(count.answer,/40 Microsoft 365-productonderdelen/);
  assert.doesNotMatch(count.answer,/69 basisregistraties|69 toepassingen/);
  assert.match(count.answer,/geen bewijs van activatie of licentietoewijzing/i);
  const list=query('Welke apps van Microsoft 365 zijn beschikbaar voor leerlingen?',data);
  assert.equal(list.kind,'relations');
  assert.match(list.answer,/40 Microsoft 365-onderdelen/);
  assert.match(list.answer,/daadwerkelijk toegang hebben/i);
  assert.ok(list.records.some(x=>x.type==='parts'));
  const parts=query('Welke onderdelen heeft Microsoft 365?',data);
  assert.equal(parts.kind,'relations');
  assert.match(parts.answer,/40 Microsoft 365-onderdelen/);
});
test('Onbekende M365-toegang blijft onbekend, ook als de productcatalogus compleet is',()=>{
  const data=indexedDataset();
  assert.ok(data.index.records('parts').filter(x=>x.kind==='Microsoft 365-onderdeel')
    .every(x=>x.accessStatus==='Niet onafhankelijk geverifieerd'));
  const count=query('Hoeveel apps heeft Microsoft 365 voor leerlingen?',data);
  assert.match(count.answer,/niet geverifieerd/i);
  assert.doesNotMatch(count.answer,/hebben werkelijk toegang|toegang bevestigd/i);
  const licenties=query('Hoeveel licenties heeft Microsoft 365?',data);
  assert.match(licenties.answer,/niet geverifieerd/i);
  assert.doesNotMatch(licenties.answer,/40 toegewezen licenties/i);
});
test('Zonder relatie-index geen verzonnen M365-totaal',()=>{
  const count=ask('Hoeveel apps heeft Microsoft 365?');
  assert.match(count.answer,/relatie-index is niet geladen/i);
  assert.doesNotMatch(count.answer,/69 basisregistraties/);
  const list=ask('Welke apps van Microsoft 365 zijn beschikbaar voor leerlingen?');
  assert.match(list.answer,/relatie-index is niet geladen/i);
});
test('Geen automatisch FAQ-antwoord bij onduidelijke vragen',()=>{
  const out=ask('heeft 3CX een actieve verwerkersovereenkomst en een DPIA');
  assert.notEqual(out.kind,'faq');
  assert.notEqual(out.status,'Bevestigd');
  const nonsense=ask('xyzksdt');
  assert.equal(nonsense.kind,'none');
});
test('FAQ-cards zijn uniek, brongebonden en niet bestuurlijk goedgekeurd',()=>{
  assert.equal(faq.schema,'eai-school-ict-v1');
  assert.equal(faq.faqs.length,14);
  assert.equal(new Set(faq.faqs.map(x=>x.id)).size,14);
  for(const x of faq.faqs){
    assert.ok(x.answer.length>50,x.id);
    assert.ok(x.aliases,x.id);
    assert.ok(x.sources?.length,x.id);
    assert.equal(x.status,'Brongebonden werkversie');
  }
});
test('Bestaande zijbalk en eenvoudige bronverwijzingen blijven intact',()=>{
  assert.ok(html.includes('id="railMore"'));
  assert.ok(html.includes('id="globalSearch"'));
  assert.ok(html.includes('src="./answer-engine.js'));
  assert.ok(html.includes('href="./answer-engine.css'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('XMLHttpRequest'));
  assert.ok(!source.includes('gemini'));
  assert.ok(!source.includes('openai'));
  const app=read('tools/ict-scan/app.js');
  assert.ok(app.includes('faqs:new Map()'));
  assert.ok(app.includes("faqs:'faqs'"),'De native JSON-import moet FAQ-registraties blijven inlezen.');
});
