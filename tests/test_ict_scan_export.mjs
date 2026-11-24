import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../tools/ict-scan/app.js', import.meta.url),'utf8').replace(/\$\('reportDate'\)\.textContent[\s\S]*$/, '');
const ctx = {Blob, TextDecoder, TextEncoder, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../tools/ict-scan/record-taxonomy.js',import.meta.url),'utf8'),ctx);
vm.runInContext(source,ctx);
// Evalueer de browsercode eerst volledig. Voeg de testtoegang pas na de
// declaraties toe: een aangeplakte opdracht kan anders midden in de
// initialisatie belanden en een onterechte ReferenceError geven.
vm.runInContext('globalThis.scanTest={state,createReportWorkbook,generateReportSheets,isClassroomAi};',ctx);
const state = ctx.scanTest.state;
state.apps.set('APP-001',{id:'APP-001',name:'Schoolsoftware',kind:'Applicatie',area:'Onderwijs & leren',description:'Een begrijpelijke omschrijving met concrete schoolfunctie.',local:'?',owner:'?',links:'?',data:'?',sources:['Voorbeeld']});
state.ai.set('AI-001',{id:'AI-001',name:'Oefenkaarten',product:'Schoolsoftware',domain:'Onderwijsleerproces',phase:'Oefenen',action:'Maakt oefenvragen',input:'Docent geeft tekst',teacher:'Docent leest mee',student:'Leerling beantwoordt vragen',learning:'Ophaaloefening en herhalen',attention:'Denk aan de leerdoelen',unknown:'De selectie van vragen is onbekend',local:'? Onbekend',sources:['Voorbeeld']});
state.ai.set('AI-002',{id:'AI-002',name:'Administratieve analyse',product:'Schoolsoftware',domain:'Organisatie en beheer',action:'Stelt een analyse op',local:'? Onbekend',sources:['Voorbeeld']});
state.connections.set('ENT-1',{id:'ENT-1',name:'Schoolsoftware Entra',enabled:'Enabled',matched:'?',sources:['Export']});
state.checks.set('C-1',{id:'C-1',name:'Beheer controleren',category:'Toegang',explanation:'Welke rechten?',sources:['Export']});
state.derived=[];state.sources=[{name:'voorbeeld.xlsx',kind:'toepassingen',rows:2,info:'Test'}];
const sheets=ctx.scanTest.generateReportSheets();
assert.deepEqual(Array.from(sheets,s=>s.name),['Schoolbreed','AI in de klas','AI in de school','Controle & bronnen']);
assert.equal(sheets[1].rows.some(r=>r.values.includes('Ophaaloefening en herhalen')),true);
assert.equal(sheets[1].rows.some(r=>r.values.includes('Denk aan de leerdoelen')),true);
assert.equal(sheets[2].rows.some(r=>r.values.includes('Administratieve analyse')),true);
assert.equal(sheets[3].rows.some(r=>r.values.includes('Schoolsoftware Entra')),true);
assert.equal(sheets[1].rows.some(r=>r.outline===1),true);
assert.equal(ctx.scanTest.isClassroomAi(state.ai.get('AI-001')),true);
assert.equal(ctx.scanTest.isClassroomAi(state.ai.get('AI-002')),false);
const blob=ctx.scanTest.createReportWorkbook();
const bytes=Buffer.from(await blob.arrayBuffer());
const count=(bytes.toString().match(/<sheet name=/g)||[]).length;
assert.equal(count,4,'De Excel-uitvoer hoort precies vier bladen te hebben');
assert.ok(bytes.includes(Buffer.from('Denk aan de leerdoelen')));
assert.ok(bytes.includes(Buffer.from('AI in de school')));
assert.ok(!bytes.includes(Buffer.from('factuurbedrag')));
console.log('ICT-scan-export: 4 tabbladen, didactische teksten, AI-scheiding, Entra en Excel in orde');