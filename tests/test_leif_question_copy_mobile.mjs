import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const paths=['leif/mijn/index.html','leif/continue/index.html','leif/index.html'];
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sources=paths.map(read);
const list=html=>{
 const match=html.match(/const chapters\s*=\s*(\[[\s\S]*?\]);\s*const\s/);
 assert(match,'Geen hoofdstukken gevonden');
 return new Function('return '+match[1])().flatMap(ch=>ch.questions.map(q=>({id:q.id,title:q.title,type:q.type,hint:q.hint,options:q.options||[],placeholder:q.placeholder||''})));
};
test('Alle 32 vraagondertitels zijn op elke LEIF-route gelijk',()=>{
 const [first,...others]=sources.map(list);
 assert.equal(first.length,32);
 assert.equal(new Set(first.map(q=>q.id)).size,32);
 for(const questions of others)assert.deepEqual(questions,first);
 for(const q of first){
  assert.equal(typeof q.hint,'string');
  assert(q.hint.length>=24&&q.hint.length<=125,q.id+' heeft geen leesbare korte ondertitel');
  assert(!/\.\.\./.test(q.hint),'Onnodige afgebroken hint: '+q.id);
 }
});
test('Vraaggegevens blijven dezelfde opslagsleutels gebruiken',()=>{
 const ids=list(sources[0]).map(q=>q.id);
 for(const key of ['zichtbaar','observeren','behoefte','contactreactie','geschiedenis','uitspreken','stap'])
  assert(ids.includes(key),'Vraag verdwenen: '+key);
 for(const html of sources){
  assert.match(html,/function growAnswerBox\(/);
  assert.match(html,/scrollHeight/);
  assert.match(html,/overflow-y:hidden/);
  assert.match(html,/resize:none/);
 }
});
test('Persoonlijke route bewaart en groeit na typen en heropenen',()=>{
 const html=sources[0];
 assert.match(html,/growAnswerBox\(t\);mergeChanges\(\{answers:/);
 assert.match(html,/requestAnimationFrame\(\(\)=>growAnswerBox\(block\.querySelector\('textarea'\)\)\)/);
 assert.match(html,/growAnswerBox\(t\);mergeChanges\(\{exercises:/);
 assert.match(html,/requestAnimationFrame\(\(\)=>growAnswerBox\(t\)\)/);
});
