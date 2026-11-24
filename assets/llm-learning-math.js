/* Kleine, controleerbare leerberekeningen. Geen activaties uit gpt-oss.
 * Geen externe dienst of modeldownload; werkt lokaal op CPU.
 * De token-ID's komen uit de echte tokenizer waar beschikbaar.
 */
(function(root){
 'use strict';
 const SIZE=4;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const add=(a,b,factor=1)=>a.map((x,i)=>x+b[i]*factor);
 function softmax(scores,temperature=1){
  const t=clamp(Number(temperature)||1,.05,5);
  const mx=Math.max(...scores)/t;
  const ex=scores.map(s=>Math.exp(s/t-mx));
  const total=ex.reduce((a,b)=>a+b,0);
  return ex.map(x=>x/total);
 }
 function tokenVector(id){
  const seed=Number.isInteger(id)?id:73;
  return [
   Math.sin((seed+11)*.017),
   Math.cos((seed+29)*.013),
   Math.sin((seed+47)*.009),
   Math.cos((seed+67)*.021)
  ];
 }
 function rotate(v,position,layer){
  const a=(position+1)/(layer+2)*.31,cos=Math.cos(a),sin=Math.sin(a);
  return [v[0]*cos-v[1]*sin,v[0]*sin+v[1]*cos,v[2],v[3]];
 }
 function attention(states,position,layer){
  const query=rotate(states[position],position,layer);
  const available=states.slice(0,position+1);
  const scores=available.map((v,i)=>dot(query,rotate(v,i,layer))/Math.sqrt(SIZE));
  const weights=softmax(scores);
  const vector=Array(SIZE).fill(0);
  available.forEach((v,i)=>v.forEach((value,j)=>{vector[j]+=value*weights[i]}));
  return {scores,weights,vector};
 }
 function routeExperts(vector,layer,expertCount=32,top=4){
  const count=clamp(Math.floor(expertCount),4,128);
  const ranked=Array.from({length:count},(_,expert)=>{
   const w=vector.map((_,i)=>Math.sin((expert+1)*(i+2)*.39+layer*.23));
   return {expert,score:dot(vector,w)/Math.sqrt(SIZE)};
  }).sort((a,b)=>b.score-a.score||a.expert-b.expert);
  const selected=ranked.slice(0,Math.min(top,count));
  const weights=softmax(selected.map(x=>x.score));
  const vectorOut=Array(SIZE).fill(0);
  selected.forEach((item,i)=>{
   const w=vector.map((_,j)=>Math.tanh(vector[j]*(0.4+0.1*Math.sin(item.expert+j))+Math.sin(item.expert*.27+j*.61)));
   w.forEach((v,j)=>{vectorOut[j]+=weights[i]*v});
  });
  return {selected:selected.map((x,i)=>({...x,weight:weights[i]})),vector:vectorOut};
 }
 function miniTrace(ids,selectedPosition,lastLayer=0,expertCount=32){
  if(!Array.isArray(ids)||!ids.length)throw new Error('Ten minste een token vereist');
  const pos=clamp(Math.floor(selectedPosition),0,ids.length-1);
  const layers=clamp(Math.floor(lastLayer),0,3);
  let states=ids.map(id=>tokenVector(Number.isInteger(id)?id:73));
  const trace=[];
  for(let l=0;l<=layers;l++){
   const next=[];
   for(let at=0;at<states.length;at++){
    const a=attention(states,at,l);
    const afterAttention=add(states[at],a.vector,.35);
    const experts=routeExperts(afterAttention,l,expertCount,4);
    const result=add(afterAttention,experts.vector,.25);
    if(at===pos)trace.push({layer:l,input:states[at],attention:a,afterAttention,experts,result});
    next.push(result);
   }
   states=next;
  }
  return {position:pos,trace,current:trace.at(-1)};
 }
 root.EAILearningMath=Object.freeze({softmax,tokenVector,attention,routeExperts,miniTrace});
})(typeof globalThis!=='undefined'?globalThis:this);
