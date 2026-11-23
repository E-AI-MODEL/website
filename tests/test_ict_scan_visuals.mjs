import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const source=readFileSync(resolve('tools/ict-scan/visual-explorer.js'),'utf8');
const html=readFileSync(resolve('tools/ict-scan/index.html'),'utf8');
const css=readFileSync(resolve('tools/ict-scan/visual-explorer.css'),'utf8');
const data=JSON.parse(readFileSync(resolve('tools/ict-scan/bronnen/2026-applicatielandschap.json'),'utf8'));
const context={window:{},document:{getElementById(){return null;}}};
vm.runInNewContext(source,context,{filename:'visual-explorer.js'});
const {tally,pairs,treemap}=context.window.EAIApplicatieVisualMath;
const apps=data.apps;

test('Tellingen zijn afkomstig uit de 61 basisregistraties en sluiten exact',()=>{
  assert.equal(apps.length,61);
  const byArea=tally(apps,'area'),byKind=tally(apps,'kind'),joint=pairs(apps);
  assert.equal(byArea.length,8);
  assert.equal(byKind.length,14);
  assert.equal(byArea.reduce((n,x)=>n+x[1],0),61);
  assert.equal(byKind.reduce((n,x)=>n+x[1],0),61);
  assert.equal(joint.reduce((n,x)=>n+x.count,0),61);
  assert.deepEqual(JSON.parse(JSON.stringify(byArea.slice(0,2))),[['Schoolorganisatie',19],['Onderwijs',18]]);
  assert.ok(byKind.some(([name,count])=>name==='Applicatie'&&count===34));
});

test('Elk gebied/soort-kruispunt komt uit exact dezelfde populatie',()=>{
  const joint=pairs(apps);
  for(const cell of joint){
    const expected=apps.filter(a=>a.area===cell.area&&a.kind===cell.kind).length;
    assert.equal(cell.count,expected,cell.area+' / '+cell.kind);
  }
  assert.ok(joint.every(x=>x.count>0));
});

test('Elke categorie staat in de treemap, zonder verlies of overlap',()=>{
  for(const field of ['area','kind']){
    const values=tally(apps,field),rects=treemap(values);
    assert.equal(rects.length,values.length);
    assert.equal(new Set(rects.map(x=>x.name)).size,values.length);
    for(const r of rects){
      assert.ok(r.x>=0&&r.y>=0&&r.width>0&&r.height>0,r.name);
      assert.ok(r.x+r.width<=100+1e-8&&r.y+r.height<=100+1e-8,r.name);
    }
    let area=0;
    for(let i=0;i<rects.length;i++){
      const a=rects[i];area+=a.width*a.height;
      for(let j=i+1;j<rects.length;j++){
        const b=rects[j];
        const overlap=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
          Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
        assert.ok(overlap<1e-7,'Rechthoeken overlappen: '+a.name+' / '+b.name);
      }
    }
    assert.ok(Math.abs(area-10000)<1e-6,'Oppervlak sluit niet aan: '+field);
  }
});

test('Bronrelaties zijn expliciet; technische matches worden niet als actieve koppeling beschouwd',()=>{
  const ids=new Set(apps.map(x=>x.id));
  assert.equal(data.ai.filter(x=>ids.has(x.parentId)).length,76);
  assert.equal(data.connections.filter(x=>ids.has(x.matchedId)).length,21);
  assert.equal(data.parts.filter(x=>ids.has(x.parent)).length,13);
  assert.ok(!source.includes('Microsoft 365 Copilot</span>'));
  assert.ok(source.includes('matchingFamily(app,index)'));
  assert.ok(source.includes("index.connected('apps',app.id)"));
  assert.ok(source.includes('Een Entra-match is geen bevestigde actieve koppeling'));
});

test('Elke kaart heeft eigen weergavekeuze en het 404-menu en de zijbalk blijven bestaan',()=>{
  for(const id of ['areaVizMode','kindVizMode','matrixVizMode','familyMode','phaseVizMode','aiProductVizMode','connectionVizMode','crossMatrix','familyApp','familyVisual','inventoryMetaLine','inventoryPopulation']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  for(const mode of ['bars','donut','treemap','table'])assert.ok(source.includes("mode==='"+mode+"'")||html.includes('value="'+mode+'"'));
  assert.ok(source.includes('renderAi=function()'));
  assert.ok(source.includes('renderConnections=function()'));
  assert.ok(source.includes('const families=apps.slice()'));
  assert.ok(html.includes('id="railMore"'));
  assert.ok(html.includes('id="unlockZero"'));
  assert.ok(html.includes('<title>404 Not Found</title>'));
  assert.ok(!html.includes('class="monitor-hero"'));
  assert.ok(!html.includes('class="relation-tree"'));
  assert.ok(css.includes('@media(max-width:720px)'));
  assert.ok(html.includes('href="./visual-explorer.css'));
  assert.ok(html.includes('src="./visual-explorer.js'));
});
