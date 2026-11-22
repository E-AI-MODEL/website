import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const source=JSON.parse(readFileSync(resolve('tools/ict-scan/bronnen/2026-applicatielandschap.json'),'utf8'));
const manifest=JSON.parse(readFileSync(resolve('tools/ict-scan/bronnen/manifest.json'),'utf8'));
const work=JSON.parse(readFileSync(resolve('tools/ict-scan/bronnen/2026-werkregister.json'),'utf8'));
const faq=JSON.parse(readFileSync(resolve('tools/ict-scan/bronnen/2026-faq.json'),'utf8'));

const html=readFileSync(resolve('tools/ict-scan/index.html'),'utf8');
const app=readFileSync(resolve('tools/ict-scan/app.js'),'utf8');
const sync=readFileSync(resolve('tools/ict-scan/github-sync.js'),'utf8');

test('Bronregistraties 2026 zijn compleet volgens de gecontroleerde werkmap',()=>{
  assert.equal(source.schema,'eai-school-ict-v1');
  const totals={apps:61,ai:76,connections:93,additionalCandidates:76,dpia:10,aiControls:22,checks:16,licenseReview:40,devices:4};
  for(const [category,count] of Object.entries(totals)){
    assert.equal(source[category].length,count,category);
    assert.equal(source.metadata.counts[category],count,category+' in metadata');
  }
  assert.equal(source.metadata.firstInventoryStarted,'2026-08-10');
  assert.equal(source.metadata.compiledBy,'Hans Visser');
  assert.equal(manifest.metadata.firstInventoryStarted,source.metadata.firstInventoryStarted);
  assert.equal(manifest.dataFiles[0].recordCounts.apps,61);
  assert.equal(manifest.dataFiles[0].recordCounts.ai,76);
});

test('Alle ID-registraties zijn uniek en verwijzingen naar toepassing bestaan',()=>{
  for(const category of ['apps','ai','connections','additionalCandidates','parts','dpia','aiControls','checks','devices','licenseReview']){
    const ids=source[category].map(x=>x.id);
    assert.equal(new Set(ids).size,ids.length,category+' duplicate ID');
  }
  const appIds=new Set(source.apps.map(x=>x.id));
  for(const item of source.parts)assert.ok(appIds.has(item.parent),'Ongeldige parent: '+item.id);
  for(const item of source.ai)if(item.parentId)assert.ok(appIds.has(item.parentId),'Ongeldige AI-app: '+item.id);
  for(const item of source.connections)if(item.matchedId)assert.ok(appIds.has(item.matchedId),'Ongeldige match: '+item.id);
});

test('Uitgebreide beschrijvingen blijven beschikbaar',()=>{
  for(const name of ['3CX','Canon UniFlow','Microsoft 365','Kuario']){
    const item=source.apps.find(x=>x.name.toLowerCase()===name.toLowerCase());
    assert.ok(item,name+' ontbreekt');
    assert.ok(item.description,name+' heeft geen beschrijving');
    assert.ok(Object.keys(item.sourceFields||{}).length>=8,name+' mist oorspronkelijke kolommen');
    assert.ok(item.sources.length>=1,name+' heeft geen bronverwijzing');
  }
  for(const item of source.ai){
    assert.ok(item.id.match(/^AI-\d{3}$/),item.id);
    assert.ok(item.action && item.input && item.teacher,'Beschrijving onvolledig: '+item.id);
    assert.ok(Object.keys(item.sourceFields||{}).length>=12,'Bronkolommen ontbreken: '+item.id);
    assert.ok(item.otherDescription && Object.keys(item.otherDescription).length>=10,'Compacte beschrijving ontbreekt: '+item.id);
  }
});

test('Aanvullende kandidaten zijn niet als bevestigde toepassingen meegeteld',()=>{
  const ids=new Set(source.apps.map(x=>x.id));
  assert.ok(source.additionalCandidates.every(x=>!ids.has(x.id)&&x.confirmed===false));
  assert.ok(source.connections.every(x=>x.usageConfirmed===false));
  assert.ok(source.metadata.limitations.some(s=>s.includes('76 aanvullende')));
});

test('FAQ-registraties en hun bronnen zijn afzonderlijk gecontroleerd',()=>{
  assert.equal(faq.schema,'eai-school-ict-v1');
  assert.equal(faq.faqs.length,14);
  assert.equal(new Set(faq.faqs.map(x=>x.id)).size,14);
  const row=manifest.dataFiles.find(x=>x.path==='2026-faq.json');
  assert.ok(row,'FAQ staat niet in het manifest');
  assert.equal(row.recordCounts.faqs,14);
  assert.ok(faq.faqs.every(x=>x.answer&&x.status==='Brongebonden werkversie'&&x.sources.length));
});

test('Manifest-SHA controleert de exacte publicatiebestanden',()=>{
  const sources=[
    ['2026-applicatielandschap.json',readFileSync(resolve('tools/ict-scan/bronnen/2026-applicatielandschap.json'))],
    ['2026-werkregister.json',readFileSync(resolve('tools/ict-scan/bronnen/2026-werkregister.json'))],
    ['2026-faq.json',readFileSync(resolve('tools/ict-scan/bronnen/2026-faq.json'))],
    ['2026-bronnenregister.json',readFileSync(resolve('tools/ict-scan/bronnen/2026-bronnenregister.json'))]
  ];
  for(const [name,bytes] of sources){
    const expected=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(manifest.dataFiles.find(x=>x.path===name)?.sha,expected,name+' wijkt af van het manifest');
  }
});

test('Een vermoede productfamilie wordt niet als bewezen parent/child opgenomen',()=>{
  for(const id of ['APP-010','APP-035']){
    const app=source.apps.find(x=>x.id===id);
    assert.equal(app.parent,'',id);
    assert.equal(app.suggestedParent,'Microsoft 365',id);
    assert.equal(app.suggestedParentStatus,'Niet bevestigd uit de bron');
  }
});

test('Het gecontroleerde werkregister is apart beschikbaar',()=>{
  assert.equal(work.schema,'eai-school-ict-v1');
  assert.equal(work.workActions.length,13);
  assert.equal(work.softwareReview.length,12);
  assert.ok(manifest.dataFiles.some(item=>item.path==='2026-werkregister.json'));
  assert.ok(work.workActions.every(item=>item.id && item.action && item.status));
  assert.ok(work.softwareReview.every(item=>item.id && item.action));
});

test('Website kan de registers laden en toont ze in eigen panelen',()=>{
  for(const id of ['candidatePanel','candidatesList','candidateTotal','licensePanel','licenseList','licenseTotal','workPanel','workList','workTotal','softwareReviewList']){
    assert.ok(html.includes('id="'+id+'"'),id+' mist in HTML');
  }
  for(const piece of ["function renderCandidates()","function renderLicenseReview()"]){
    assert.ok(app.includes(piece),piece);
  assert.ok(app.includes('function renderWorkActions()'));
  assert.ok(app.includes('function renderSoftwareReview()'));
  }
  assert.ok(sync.includes("'candidates','licenseReview'"));
  assert.ok(html.includes('id="railMore"'));
});

test('Openbare gegevens bevatten geen e-mailadressen of toegangstokens',()=>{
  const contents=JSON.stringify(source);
  assert.doesNotMatch(contents,/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(contents,/github_pat_|ghp_[a-z0-9]{15,}|sk-proj-[a-z0-9]/i);
  assert.doesNotMatch(contents,/"password"\s*:\s*"[^\"]+"/i);
});
