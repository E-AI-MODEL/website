/**
 * Presentatie-randomizer. Antwoordindexen in de vraagbank zijn NIET de
 * posities op het scherm. Elke vraag krijgt een nieuwe presentatie.
 *
 * Geen vaste A-B-C-D-cyclus: de nieuwe positie wordt gewogen willekeurig
 * gekozen, met een lichte correctie voor de afgelopen beurten.
 * Ook een herhaling blijft mogelijk: anders wordt het zelf voorspelbaar.
 */
export function makeAnswerTracker(){return {recentByCount:{}}}

function choice(max,rng){
  if(!Number.isInteger(max)||max<1)throw new Error('Ongeldig aantal opties');
  const x=rng();
  if(!Number.isFinite(x)||x<0||x>=1)throw new Error('Randomizer moet een getal in [0,1) geven');
  return Math.floor(x*max);
}

export function shuffledIndices(length,rng=Math.random){
  const order=Array.from({length},(_,i)=>i);
  for(let i=order.length-1;i>0;i--){
    const j=choice(i+1,rng);
    [order[i],order[j]]=[order[j],order[i]];
  }
  return order;
}

export function presentQuestion(question,tracker=makeAnswerTracker(),rng=Math.random){
  if(!Array.isArray(question?.options)||question.options.length<2)throw new Error('Ongeldige vraag');
  const n=question.options.length;
  if(question.type==='order'){
    // Een sorteervraag mag niet al in de goede volgorde verschijnen.
    let order=shuffledIndices(n,rng);
    if(order.every((value,i)=>value===i))order=[...order.slice(1),order[0]];
    return {order,correctDisplayIndex:null};
  }
  if(!Number.isInteger(question.answer)||question.answer<0||question.answer>=n)throw new Error('Ongeldig juist antwoord');
  tracker.recentByCount??={};
  const recent=tracker.recentByCount[n]??=[];
  const window=recent.slice(-20);
  const counts=Array.from({length:n},(_,i)=>window.filter(p=>p===i).length);
  const mean=window.length/n;
  // Afwijkingen van het gemiddelde tellen mee zonder een positie af te dwingen.
  const weights=counts.map((count,i)=>{
    const imbalance=Math.exp(-.85*(count-mean));
    const last=window.at(-1)===i?.79:1;
    const repeated=window.length>=2&&window.at(-1)===i&&window.at(-2)===i?.58:1;
    return imbalance*last*repeated;
  });
  const total=weights.reduce((a,b)=>a+b,0);
  let threshold=rng()*total,correctDisplayIndex=n-1;
  for(let i=0;i<n;i++){threshold-=weights[i];if(threshold<0){correctDisplayIndex=i;break}}
  const others=shuffledIndices(n-1,rng).map(i=>Array.from({length:n},(_,j)=>j).filter(j=>j!==question.answer)[i]);
  const order=[...others];
  order.splice(correctDisplayIndex,0,question.answer);
  recent.push(correctDisplayIndex);
  if(recent.length>60)recent.splice(0,recent.length-60);
  tracker.recentByCount[n]=recent;
  return {order,correctDisplayIndex};
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