import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const read = name => readFileSync(new URL('../content/science-observatory/labs/'+name+'.html',import.meta.url),'utf8');
const maths=['wiskunde-a','wiskunde-b'];

test('Wiskunde A en B behouden ieder zes modellen en hebben geldige scripts',()=>{
 for(const name of maths){
  const html=read(name);
  const config=html.match(/<script type="application\/json" id="config">([\s\S]*?)<\/script>/);
  assert.ok(config,name+': configuratie');
  const data=JSON.parse(config[1]);
  assert.equal(data.modules.length,6,name+': aantal modellen');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  new Script(scripts.at(-1)[1],{filename:name+'.js'});
  assert.match(html,/id='deckDock'/);
  assert.match(html,/function setupAdaptiveWorkspace\(\)/);
  assert.match(html,/height:100dvh!important/);
  assert.match(html,/function renderParamPage\(\)/);
  assert.match(html,/function renderInfoPage\(\)/);
  assert.match(html,/\.clock\{display:none!important\}/);
  assert.match(html,/running:false/);
  for(const mode of data.modules)assert.ok(mode.details&&mode.params&&mode.formula,name+': '+mode.id);
 }
});
test('Slepen is gekoppeld aan echte grafiekcoordinaten en nooit aan ongeschikte proeven',()=>{
 for(const name of maths){
  const html=read(name);
  assert.match(html,/const frac=clamp\(\(e\.clientX-r\.left-left\)\/plotW,0,1\)/);
  assert.match(html,/kind==='vectors'/);
  assert.match(html,/if\(!key\)return/);
  assert.match(html,/kind==='normal'/);
  assert.match(html,/kind==='polynomial'/);
  assert.match(html,/const key=\{binom:'k'/);
 }
});
test('Natuurkunde houdt alle 53 proeven en begint zonder automatische animatie',()=>{
 const html=read('natuurkunde');
 const catalogue=html.match(/window\.CATALOG=(\[[^\n]+\]);<\/script>/);
 assert.ok(catalogue,'catalogus');
 assert.equal(JSON.parse(catalogue[1]).length,53);
 assert.match(html,/const hasMotion=timedLabs\.has\(id\)\|\|id==='lever'/);
 assert.match(html,/setPlaying\(false\)/);
 assert.match(html,/function setupContextMath\(\)/);
 assert.match(html,/selectBottom\('insight'\)/);
 assert.match(html,/id='contextMath'/);
});
test('De directe bedieningen volgen dezelfde betekenis als de getekende assen',()=>{
 const html=read('wiskunde-a');
 const source=html.slice(html.indexOf('function directGuide('),html.indexOf('\nfunction tick(now)',html.indexOf('function directGuide(')));
 const parameter={id:'k',min:0,max:20,step:1,unit:''};
 const model={id:'binom',kind:'binom',probe:'k',params:[parameter]};
 const ctrl={value:null};
 const output={textContent:''};
 const context={
  M:[model],state:{mode:0,zoom:1,parameters:{binom:{k:5,n:20}}},scene:{getBoundingClientRect:()=>({left:0,top:0,width:400,height:350})},
  $:id=>id==='ctrl-k'?ctrl:id==='value-k'?output:null,
  clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),
  format:n=>String(n),styleMetrics:()=>{},dirty:false,Math
 };
 runInNewContext(source+';sceneMove({clientX:207,clientY:140});',context);
 assert.equal(context.state.parameters.binom.k,10);
 assert.equal(ctrl.value,'10');
 context.M[0]={id:'bayes',kind:'bayes',probe:'success',params:[{id:'success',min:0,max:20,step:1}]};
 context.state.parameters.bayes={success:3};
 runInNewContext('sceneMove({clientX:290,clientY:140});',context);
 assert.equal(context.state.parameters.bayes.success,3);
});
