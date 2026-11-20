import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(p),'utf8');
const main=JSON.parse(read('ict-scan/bronnen/2026-applicatielandschap.json'));
const work=JSON.parse(read('ict-scan/bronnen/2026-werkregister.json'));
const faq=JSON.parse(read('ict-scan/bronnen/2026-faq.json'));
const source=read('tools/ict-scan/answer-engine.js');
const html=read('tools/ict-scan/index.html');
const ctx={window:{},document:{getElementById(){return null;}}};
vm.runInNewContext(source,ctx,{filename:'answer-engine.js'});
const query=ctx.window.EmmausAnswerLogic.search;
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
  ['Wat is de bron van 3CX?','source',/Applicaties rij/i,'APP-033'],
  ['Heeft 3CX AI-functies?','relations',/geen AI-functies gekoppeld/i,'APP-033'],
  ['Welke AI-functies kent Microsoft 365?','relations',/16 AI-functies beschreven/i,'APP-034'],
  ['Hoeveel applicaties zijn er?','count',/61 basisregistraties/i],
  ['Hoeveel AI-functies staan er?','count',/76 beschreven AI-functies/i],
  ['Hoeveel Entra-registraties zijn er?','count',/93 Entra-registraties/i],
  ['Hoeveel kandidaten zijn er?','count',/76 aanvullende kandidaten/i],
  ['Hoeveel apps hebben AI-functies?','count',/beschreven AI-functie/i],
  ['Welke printsoftware is geregistreerd?','list',/Canon UniFlow.*Kuario|Kuario.*Canon UniFlow/i],
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
  assert.match(query('Hoeveel applicaties zijn er?',changed).answer,/60 basisregistraties/);
  assert.match(query('Hoeveel AI-functies zijn er?',changed).answer,/10 beschreven AI-functies/);
  assert.match(query('Hoeveel Entra-registraties zijn er?',changed).answer,/12 Entra-registraties/);
  assert.match(query('Hoeveel kandidaten zijn er?',changed).answer,/7 aanvullende kandidaten/);
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
  assert.ok(html.includes('src="./answer-engine.js"'));
  assert.ok(html.includes('href="./answer-engine.css"'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('XMLHttpRequest'));
  assert.ok(!source.includes('gemini'));
  assert.ok(!source.includes('openai'));
  const app=read('tools/ict-scan/app.js');
  assert.ok(app.includes('faqs:new Map()'));
  assert.ok(app.includes("['faqs',state.faqs]"));
});
