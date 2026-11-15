/* EAIgame: onafhankelijke antwoordvolgorde zonder A/B/C/D-patroon.
   Een herhaling is toegestaan; een geforceerde cyclus is voorspelbaar. */
export function randomIndex(n, cryptoSource=globalThis.crypto){
  if(!Number.isInteger(n)||n<1||n>65536)throw new RangeError('Ongeldige keuzelengte');
  if(typeof cryptoSource?.getRandomValues==='function'){
    const upper=0x100000000,ceiling=Math.floor(upper/n)*n,sample=new Uint32Array(1);
    do{cryptoSource.getRandomValues(sample)}while(sample[0]>=ceiling);
    return sample[0]%n;
  }
  return Math.floor(Math.random()*n);
}
export function shuffleAnswers(question,choose=randomIndex){
  if(!Array.isArray(question?.options)||question.options.length<2)throw new Error('Geen antwoordopties');
  const order=question.options.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){
    const j=choose(i+1);
    if(!Number.isInteger(j)||j<0||j>i)throw new Error('Ongeldige willekeurige index');
    [order[i],order[j]]=[order[j],order[i]];
  }
  return{order,displayed:order.map(i=>question.options[i]),
    correctPosition:question.type==='order'?null:order.indexOf(question.answer)};
}
// Statistische signalen, geen inhoudelijke beoordeling.
export function auditAnswerCues(bank){
  const choices=bank.filter(q=>q.type==='choice'&&q.options.length===4);
  const result={total:choices.length,uniqueLongest:0,uniqueShortest:0,largeLengthGap:[],answerPositions:[0,0,0,0],truth:{waar:0,onwaar:0}};
  for(const q of bank)if(q.type==='truth'){const correct=q.options[q.answer];if(correct==='Waar')result.truth.waar++;else if(correct==='Niet waar')result.truth.onwaar++}
  for(const q of choices){
    result.answerPositions[q.answer]++;
    const lengths=q.options.map(x=>Array.from(x.trim()).length),correct=lengths[q.answer];
    const others=lengths.filter((_,i)=>i!==q.answer);
    if(correct>Math.max(...others))result.uniqueLongest++;
    if(correct<Math.min(...others))result.uniqueShortest++;
    const gap=correct-Math.max(...others);
    if(gap>=7)result.largeLengthGap.push({id:q.id,gap});
  }
  result.longestRate=choices.length?result.uniqueLongest/choices.length:0;
  result.shortestRate=choices.length?result.uniqueShortest/choices.length:0;
  return result;
}