/**
 * EAIgame: ieder scherm krijgt een nieuwe, onafhankelijk willekeurige antwoordvolgorde.
 * Geen A/B/C/D-cyclus, geen herhalingsverbod en geen gewichten op eerdere antwoorden.
 * Achtereenvolgende identieke posities horen bij echte willekeur.
 */
import {randomIndex,shuffleAnswers} from './eaigame-randomizer.js';

// Bestaand interfacecontract; de tracker bewaart bewust geen antwoordposities meer.
export function makeAnswerTracker(){return {recentByCount:{}}}
function fromRng(max,rng){
  const x=rng();
  if(!Number.isFinite(x)||x<0||x>=1)throw new Error('Randomizer vereist een getal tussen 0 en 1');
  return Math.floor(x*max);
}
export function shuffledIndices(length,rng=Math.random){
  if(!Number.isInteger(length)||length<2)throw new Error('Ongeldig aantal opties');
  const options=Array.from({length},(_,i)=>String(i));
  return shuffleAnswers({type:'order',options},n=>fromRng(n,rng)).order;
}
export function presentQuestion(question,tracker=makeAnswerTracker(),rng=null){
  // De optionele rng is alleen voor reproduceerbare tests.
  const draw=rng? n=>fromRng(n,rng):randomIndex;
  const shown=shuffleAnswers(question,draw);
  let {order}=shown;
  if(question.type==='order'&&order.every((value,i)=>value===i)){
    order=[...order.slice(1),order[0]];
  }
  return {order,correctDisplayIndex:shown.correctPosition};
}

/**
 * Signalering voor auteurs. Een lengteverschil blijft zichtbaar na schudden.
 * Dit is geen inhoudelijke controle van de antwoorden.
 */
export function answerLengthCues(question){
  if(question?.type!=='choice')return {kind:'not-applicable',severe:false};
  const lengths=question.options.map(x=>String(x).trim().length);
  const correct=lengths[question.answer],max=Math.max(...lengths),min=Math.min(...lengths);
  const uniqueLongest=correct===max&&lengths.filter(n=>n===max).length===1;
  const uniqueShortest=correct===min&&lengths.filter(n=>n===min).length===1;
  const different=max-min;
  // Extreme verschillen maken afleiders soms direct herkenbaar.
  const severe=(uniqueLongest||uniqueShortest)&&(different>=10||max>=2*min&&different>=5);
  return {kind:uniqueLongest?'longest':uniqueShortest?'shortest':'middle-or-tie',severe,lengths,different};
}