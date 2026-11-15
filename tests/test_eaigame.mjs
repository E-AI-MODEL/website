import test from 'node:test';
import assert from 'node:assert/strict';
import {REALMS,QUESTION_BANK,validateBank,drawQuestion} from '../assets/eaigame-questions.js';
import {createGame,ringDistance,reachableAreas,isCorrect,resolveTurn,finishTurn,MAX_ROUNDS} from '../assets/eaigame-logic.js';
import {makeAnswerTracker,presentQuestion,answerLengthCues} from '../assets/eaigame-random.js';

test('300 bruikbare vraagvarianten, gekoppeld aan zes SLO-leergebieden',()=>{
  assert.equal(REALMS.length,6);
  const check=validateBank();
  assert.equal(check.count,300);
  assert.deepEqual(check.errors,[]);
  for(const level of ['vmbo','havo','vwo']){
    assert.equal(QUESTION_BANK.filter(q=>q.level===level).length,100);
    for(const realm of REALMS)assert.ok(QUESTION_BANK.some(q=>q.area===realm.id&&q.level===level));
  }
});
test('geen herhaling in een spelbeurt zolang er ongebruikte vragen zijn',()=>{
 const used=new Set();for(let i=0;i<16;i++){const q=drawQuestion('breuk','havo',used,()=>.5);assert.ok(q);assert.ok(!used.has(q.id));used.add(q.id)}
});
test('waar-of-niet-waar en volgorde correct getoetst',()=>{
 const tf=QUESTION_BANK.find(q=>q.type==='truth'),order=QUESTION_BANK.find(q=>q.type==='order');
 assert.ok(isCorrect(tf,tf.answer));assert.ok(!isCorrect(tf,1-tf.answer));
 assert.ok(isCorrect(order,order.answer));assert.ok(!isCorrect(order,[...order.answer].reverse()));
});
test('worp opent routes, maar de speler kiest het gebied',()=>{
 assert.deepEqual(reachableAreas(-1,1),[0,1,2,3,4,5]);
 assert.deepEqual(reachableAreas(0,1),[0,1,5]);
 assert.deepEqual(reachableAreas(0,2),[0,1,2,4,5]);
 assert.equal(ringDistance(0,3),3);
 assert.throws(()=>reachableAreas(0,0));
});
test('geen energie zonder antwoord; een hint levert minder energie op',()=>{
 const g=createGame(['Alfa','Beta'],'havo');
 g.phase='travel';g.impulse=6;g.reach=reachableAreas(-1,6);g.phase='challenge';
 const a=resolveTurn(g,0,true,false);assert.equal(a.reward,10);assert.equal(g.progress[0],1);
 assert.equal(g.players[0].energy,10);assert.equal(finishTurn(g),false);
 g.reach=reachableAreas(-1,6);g.phase='challenge';
 const b=resolveTurn(g,1,true,true);assert.equal(b.reward,6);assert.equal(g.players[1].energy,6);
 assert.equal(finishTurn(g),false);assert.equal(g.turn,2);
});
test('zes herstelde bakens beëindigen het spel',()=>{
 const g=createGame(['Alfa'],'vmbo');
 for(let i=0;i<6;i++){g.reach=reachableAreas(g.players[0].loc,6);g.phase='challenge';resolveTurn(g,i,true,false);assert.equal(finishTurn(g),i===5)}
 assert.ok(g.progress.every(n=>n===1));assert.equal(g.players[0].discoveries,6);
});
test('fouten leveren geen onterechte voortgang op',()=>{
 const g=createGame(['Alfa'],'vwo');g.reach=[2];g.phase='challenge';
 const result=resolveTurn(g,2,false,false);assert.equal(result.reward,0);assert.equal(g.progress[2],0);assert.equal(g.misses[2],1);
});

test('juist antwoord wordt zichtbaar op wisselende plekken getoond, ook bij vaste bronindex',()=>{
 const tracker=makeAnswerTracker(),question=QUESTION_BANK.find(q=>q.type==='choice'&&q.options.length===4);const positions=new Set();
 for(let i=0;i<60;i++){const result=presentQuestion(question,tracker,Math.random);assert.equal(result.order[result.correctDisplayIndex],question.answer);positions.add(result.correctDisplayIndex)}
 assert.ok(positions.size>=3,'Het juiste antwoord blijft op te weinig plekken');
});
test('sorteervragen starten nooit al in de juiste volgorde',()=>{
 const q=QUESTION_BANK.find(q=>q.type==='order');for(let i=0;i<10;i++){const result=presentQuestion(q,makeAnswerTracker(),()=>.99);assert.notDeepEqual(result.order,[0,1,2]);assert.equal(result.correctDisplayIndex,null)}
});
test('inhoudsredactie kan opvallende antwoordlengtes signaleren',()=>{
 const bad=answerLengthCues({type:'choice',answer:0,options:['Een veel en veel langer antwoord dat uitspringt','A','B','C']});assert.equal(bad.severe,true);
});
