import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../content/science-observatory/labs/natuurkunde.html',import.meta.url),'utf8');
const quality=JSON.parse(readFileSync(new URL('../content/science-observatory/natuurkunde-kwaliteit.json',import.meta.url),'utf8'));
const labBlock=html.slice(html.indexOf('const labSpecs = ['),html.indexOf('const catalog=window.CATALOG;'));
const ids=[...labBlock.matchAll(/^\['([^']+)'[,]/gm)].map(m=>m[1]);
const member=name=>{
 const match=html.match(new RegExp('const '+name+'=new Set\\(\\[([^\\]]+)\\]\\)'));
 assert.ok(match,'Ontbrekende groep '+name);
 return [...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
};
test('Alle 53 proeven zijn afzonderlijk opgenomen zonder stilzwijgend keurmerk',()=>{
 const entries=quality.proeven,keys=entries.map(x=>x.id);
 assert.equal(ids.length,53);
 assert.equal(entries.length,53,'Er moet voor iedere proef een beoordeling zijn');
 assert.equal(new Set(keys).size,53,'Proeven mogen niet dubbel worden afgetekend');
 assert.deepEqual([...keys].sort(),[...ids].sort());
 for(const item of entries){
  assert.ok(item.verfijning.length>15,item.id+' mist concrete vervolghandeling');
  assert.ok(item.physics_check.length>8,item.id+' mist natuurkundige controle');
  assert.equal(item.inhoudelijk_gevalideerd,false,item.id+' mag niet zonder externe toetsing af zijn');
 }
});
test('Het register maakt onderscheid tussen slepen, 3D-draaien en grafiekbediening',()=>{
 const direct=new Set(member('directManip')),spatial=new Set(member('special3d'));
 assert.equal(direct.size,16);
 assert.equal(spatial.size,7);
 for(const item of quality.proeven){
  const category=direct.has(item.id)?'versleepbaar':spatial.has(item.id)?'3d-draaibaar':'knoppen-grafiek';
  assert.equal(item.interaction,category,item.id+' komt niet overeen met de echte bediening');
  if(item.browser_drag_test)assert.ok(direct.has(item.id),item.id+' claimt een ongebruikte greep');
 }
 assert.equal(quality.proeven.filter(x=>x.browser_drag_test).length,10);
});
