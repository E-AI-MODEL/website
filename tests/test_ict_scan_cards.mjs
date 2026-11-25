import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=path=>readFileSync(resolve(path),'utf8');
const cardSource=read('tools/ict-scan/record-cards.js');
const githubSource=read('tools/ict-scan/record-github.js');
const html=read('tools/ict-scan/index.html');
const catalog=JSON.parse(read('tools/ict-scan/frameworks.json'));
const main=JSON.parse(read('tools/ict-scan/bronnen/2026-applicatielandschap.json'));
const work=JSON.parse(read('tools/ict-scan/bronnen/2026-werkregister.json'));
const faq=JSON.parse(read('tools/ict-scan/bronnen/2026-faq.json'));
const sourceRegister=JSON.parse(read('tools/ict-scan/bronnen/2026-bronnenregister.json'));
const clone=v=>JSON.parse(JSON.stringify(v));
const profile=JSON.parse(read('tools/ict-scan/assurance/profiles/emmauscollege.json'));
const ctx={URL,window:{},document:{getElementById:()=>({addEventListener(){}})},TextEncoder,TextDecoder,atob,btoa,Uint8Array};
vm.createContext(ctx);vm.runInContext(read('tools/ict-scan/assurance/profile.js'),ctx);vm.runInContext(read('tools/ict-scan/assurance/source-register.js'),ctx);vm.runInContext(read('tools/ict-scan/assurance/engine.js'),ctx);ctx.window.AssuranceEngine=ctx.AssuranceEngine;vm.runInContext(read('tools/ict-scan/assurance/adapter.js'),ctx);vm.runInContext(read('tools/ict-scan/assurance/record-contract.js'),ctx);ctx.window.AssuranceRecord=ctx.AssuranceRecord;ctx.window.IctOrganisation={profile};vm.runInContext(githubSource,ctx);
const sourceScope=ctx.window.AssuranceProfile.scopeKey(profile);
const logic=ctx.window.EmmausCardGitLogic;
function docs(){return {'2026-applicatielandschap.json':clone(main),'2026-werkregister.json':clone(work),'2026-faq.json':clone(faq),'2026-bronnenregister.json':clone(sourceRegister)};}
function change(type,record,fields){
  return {sourceScope,type,id:record.id,before:clone(record),after:{...clone(record),...fields},changed:Object.keys(fields),reason:'Broncorrectie op basis van vastgelegde inventarisatie'};
}
test('Één editor voor veertien registers, zonder weggooien bronvelden',()=>{
  for(const token of ["{key:'apps'","{key:'ai'","{key:'connections'","{key:'parts'","{key:'additionalCandidates'","{key:'checks'","{key:'dpia'","{key:'aiControls'","{key:'devices'","{key:'licenseReview'","{key:'workActions'","{key:'softwareReview'","{key:'faqs'","{key:'sourceRegister'"])
    assert.ok(cardSource.includes(token),token);
  assert.ok(cardSource.includes("'sourceFields'"));
  assert.ok(cardSource.includes("'otherDescription'"));
  assert.ok(cardSource.includes("function relationRow(obj)"));
  assert.ok(cardSource.includes("function frameworkRow(obj)"));
  for(const id of ['cardEditor','cardOpen','cardGithubPanel','cardCreatePR','cardSaveDraft','cardTypeFilter','cardFeedback','cardJson']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.ok(html.includes('id="railMore"'));
  assert.ok(html.includes('id="unlockZero"'));
});
test('Het normregister bevat de vereiste IDs, bronlinks en beoordelingsstatussen',()=>{
  assert.equal(catalog.schema,'eai-applicable-frameworks-v1');
  for(const id of ['IBP','AVG','AIACT','UAVG','WVO2020']){
    const item=catalog.references.find(x=>x.id===id);
    assert.ok(item,id+' ontbreekt');
    assert.ok(/^https:\/\//.test(item.url),item.url);
  }
  assert.ok(catalog.relationTypes.length>=7);
  assert.ok(catalog.statuses.includes('Nog te beoordelen'));
  assert.ok(!catalog.statuses.some(s=>/voldoet|compliant/i.test(s)));
});
test('Een wijziging blijft gekoppeld aan ID, originele tekst, bewijs en auteur',()=>{
  const all=docs(),original=all['2026-applicatielandschap.json'].apps[0],before=clone(original);
  const edit=change('apps',original,{description:'Gecorrigeerde beschrijving na broncontrole'});
  const changed=logic.applyDrafts(all,[edit],'test-reviewer','2026-11-20T15:00:00Z');
  assert.equal(changed.has('2026-applicatielandschap.json'),true);
  const after=all['2026-applicatielandschap.json'].apps[0];
  assert.equal(after.id,original.id);
  assert.equal(after.description,'Gecorrigeerde beschrijving na broncontrole');
  assert.deepEqual(clone(after.sourceFields),before.sourceFields);
  assert.deepEqual(clone(after.provenance),before.provenance);
  assert.deepEqual(clone(after.sources),before.sources);
  assert.equal(after.auditTrail.length,(before.auditTrail||[]).length+1);
  assert.equal(after.auditTrail.at(-1).actor,'test-reviewer');
  assert.equal(after.auditTrail.at(-1).reason,edit.reason);
  assert.deepEqual(Array.from(after.auditTrail.at(-1).fields),['description']);
});
test('Nieuwe bronverwijzingen worden toegevoegd zonder originele bronnen te vervangen',()=>{
  const all=docs(),original=all['2026-applicatielandschap.json'].apps[0];
  const baseline=clone(original);baseline.sources=baseline.sources.concat(['2026-applicatielandschap.json']);
  const updated=clone(baseline);updated.sources.push('Getekend verwerkerscontract 2026');
  const staged={sourceScope,type:'apps',id:original.id,before:baseline,after:updated,changed:['sources'],reason:'Nieuwe bewijsverwijzing toegevoegd aan bestaande registratie'};
  logic.applyDrafts(all,[staged],'reviewer','2026-11-20T15:00:00Z');
  const stored=all['2026-applicatielandschap.json'].apps[0];
  assert.equal(stored.sources.includes('Getekend verwerkerscontract 2026'),true);
  assert.equal(stored.sources.includes('2026-applicatielandschap.json'),false);
  assert.ok(original.sources.every(x=>stored.sources.includes(x)));
});

test('FAQ-antwoord aanpassen behoudt vaste ID, bronverwijzing en wijzigingslog',()=>{
  const all=docs(),original=all['2026-faq.json'].faqs[0];
  const before=clone(original);
  const changed=change('faqs',original,{answer:original.answer+' Aanvullend gecontroleerd in bronregister.'});
  logic.applyDrafts(all,[changed],'faq-reviewer','2026-11-20T20:00:00Z');
  const after=all['2026-faq.json'].faqs[0];
  assert.equal(after.id,'FAQ-001');
  assert.deepEqual(clone(after.sourceRefs),before.sourceRefs);
  assert.deepEqual(clone(after.sources),before.sources);
  assert.match(after.answer,/Aanvullend gecontroleerd/);
  assert.equal(after.auditTrail.length,1);
  assert.equal(after.auditTrail[0].actor,'faq-reviewer');
  assert.equal(all['2026-applicatielandschap.json'].apps.length,69);
});

test('Nieuwe kaart wijzigt alleen het juiste register en de telling',()=>{
  const all=docs();
  const entry={id:'APP-999',name:'Nieuwe testtoepassing',description:'Voorbeeldregistratie',relations:[],frameworkLinks:[],sources:[]};
  const newItem={sourceScope,type:'apps',id:entry.id,before:null,after:entry,changed:['name','description'],reason:'Nieuwe registratie uit handmatige inventarisatie'};
  logic.applyDrafts(all,[newItem],'reviewer','2026-11-20T15:00:00Z');
  assert.equal(all['2026-applicatielandschap.json'].apps.length,70);
  assert.equal(all['2026-applicatielandschap.json'].metadata.counts.apps,70);
  assert.equal(all['2026-werkregister.json'].workActions.length,work.workActions.length);
  assert.equal(all['2026-applicatielandschap.json'].apps.at(-1).auditTrail[0].action,'toegevoegd');
});
test('Gelijktijdige wijzigingen en dubbele IDs stoppen publicatie',()=>{
  const all=docs(),base=all['2026-applicatielandschap.json'].apps[0];
  const edit=change('apps',base,{description:'Test gecorrigeerd'});
  all['2026-applicatielandschap.json'].apps[0].description='Andere auteur was eerder';
  assert.throws(()=>logic.applyDrafts(all,[edit],'reviewer','2026-11-20T15:00:00Z'),/sinds jouw laatste bronversie gewijzigd/);
  const add={sourceScope,type:'apps',id:base.id,before:null,after:{id:base.id,name:'Dubbel'},changed:['name'],reason:'Toets van dubbele registraties'};
  assert.throws(()=>logic.applyDrafts(docs(),[add],'reviewer','2026-11-20T15:00:00Z'),/bestaat inmiddels al/);
});
test('Bevestigde relaties en oordelen vereisen bewijs',()=>{
  const base=main.apps[0];
  const target=main.apps[1];
  const rel=change('apps',base,{relations:[{targetType:'apps',targetId:target.id,relationType:'uses',status:'Bevestigd',evidence:''}]});
  assert.throws(()=>logic.applyDrafts(docs(),[rel],'reviewer','2026-11-20T15:00:00Z'),/zonder bewijs/);
  const law=change('apps',base,{frameworkLinks:[{frameworkId:'AVG',article:'art. 28',status:'Onderbouwd',evidence:''}]});
  assert.throws(()=>logic.applyDrafts(docs(),[law],'reviewer','2026-11-20T15:00:00Z'),/zonder bewijs/);
});
test('Geen rechtstreekse overschrijving van main',()=>{
  assert.ok(githubSource.includes("request('POST','/git/refs'"));
  assert.ok(githubSource.includes("request('POST','/pulls'"));
  assert.equal(profile.source.baseRef,'main');
  assert.ok(githubSource.includes('base:baseRef'));
  assert.ok(githubSource.includes('profile.source.registerFiles'));
  assert.ok(githubSource.includes('manifest.dataFiles'));
  assert.ok(githubSource.includes('source_sha')===false);
  assert.ok(html.includes("connect-src 'self' https://api.github.com"));
  assert.ok(html.includes('src="./record-cards.js'));
  assert.ok(html.includes('src="./record-github.js'));
  assert.ok(html.includes('href="./record-cards.css'));
});

test('AI-tussenstand gebruikt uitsluitend de index en de bestaande kaarten',()=>{
  const ixContext={};
  vm.runInNewContext(read('tools/ict-scan/inventory-index.js'),ixContext);
  const records={...main,...work,...faq,...sourceRegister,candidates:main.additionalCandidates};
  const index=ixContext.IctInventoryIndex.build(records,{catalog});
  assert.deepEqual(Array.from(index.errors),[]);
  const summary=index.aiProgress();
  assert.equal(summary.featureCount,main.ai.length);
  assert.equal(summary.unknownLocal.length,summary.unknownCount);
  assert.ok(summary.unknownLocal.every(row=>index.get('ai',row.id)));
  assert.equal(new Set(summary.unknownLocal.map(row=>row.id)).size,summary.unknownCount);
  assert.equal(summary.possibleHighRisk.length,main.ai.filter(x=>/mogelijk hoog risico/i.test(x.aiAct)).length);
  for(const [group,ids] of Object.entries({good:['APP-012','WRK-010','WRK-012','SWR-005'],open:['WRK-001','WRK-008','WRK-014','WRK-016'],unknown:['WRK-003','WRK-015','SWR-004','C-07']})){
    for(const id of ids)assert.ok(summary.groups[group].some(x=>x.id===id),group+' '+id);
  }
  for(const row of Object.values(summary.groups).flat())assert.ok(index.get(row.type,row.id));
  const adjusted=clone(records);
  adjusted.workActions.find(x=>x.id==='WRK-010').status='Niet inzichtelijk';
  assert.ok(ixContext.IctInventoryIndex.build(adjusted).aiProgress().groups.unknown.some(x=>x.id==='WRK-010'));
  assert.ok(html.includes('id="aiProgress"'));
  assert.ok(read('tools/ict-scan/app.js').includes('ix.aiProgress()'));
  assert.ok(read('tools/ict-scan/scene-navigation.js').includes("['Stand van zaken',1]"));
});

test('Gedeelde dashboardontwerpen accepteren alleen de bestaande layoutkeuzes, geen brondata',()=>{
  const design={format:'emmaus-dashboard-layout',version:1,title:'ICT-overzicht',content:['apps'],components:['numbers'],layout:'balanced',variant:0,primary:'apps',visuals:{distribution:'lines',matrix:'matrix'}};
  const validate=value=>logic.validateDashboardDesign(value,['apps','ai'],['numbers','distribution']);
  assert.deepEqual(clone(validate(design)),design);
  for(const bad of [{...design,rows:[{id:'APP-001'}]},{...design,filter:{value:'privé'}},{...design,primary:'ai'},{...design,content:['apps','apps']},{...design,components:['invented']},{...design,visuals:{...design.visuals,records:[]}},{...design,title:'ghp_'+'a'.repeat(25)}])
    assert.throws(()=>validate(bad));
  const file=logic.validateDesignFile({schema:'eai-ict-dashboard-designs-v1',designs:{apps:design}},validate);
  assert.deepEqual(clone(file.designs.apps),design);
  assert.throws(()=>logic.validateDesignFile({schema:'eai-ict-dashboard-designs-v1',designs:{ai:design}},validate));
  assert.throws(()=>logic.validateDesignFile({schema:'eai-ict-dashboard-designs-v1',designs:{apps:design},sourceData:[]},validate));
  for(const id of ['dsSharedLoad','dsSharedPublish','dsSharedDialog','dsSharedSubmit','cardKeepDraft'])assert.ok(html.includes('id="'+id+'"'));
  assert.ok(!html.includes('id="cardGithubToken"'));assert.ok(!html.includes('id="dsSharedToken"'));
});
