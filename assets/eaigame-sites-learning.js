/* EAIgame: hints, voorlezen, vragen signaleren, controleerbaar lokaal antwoordlog. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const KEY='eaigame-antwoorden-v1';
function get(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return []}}
function put(list){try{localStorage.setItem(KEY,JSON.stringify(list.slice(-500)))}catch{}}
const baseAsk=ask;
ask=function(...params){const result=baseAsk(...params);attachQuestion();return result};
function attachQuestion(){
 if(!currentQ)return;
 const container=$('.question-inner');if(!container)return;
 let tools=$('#eaigame-question-tools');
 if(!tools){
  tools=document.createElement('div');tools.id='eaigame-question-tools';tools.className='eaigame-vraagtools';
  const hint=document.createElement('button');hint.type='button';hint.id='eaigame-hint';hint.className='secondary';hint.textContent='Toon hint';
  hint.onclick=()=>{if(currentQ?.hint){$('#questionHint').textContent=currentQ.hint;hint.hidden=true}};
  const speaker=document.createElement('button');speaker.type='button';speaker.id='eaigame-speak';speaker.className='secondary';speaker.textContent='Lees vraag voor';
  speaker.onclick=()=>{
   if(!('speechSynthesis' in window))return;
   speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance($('#questionPrompt').textContent);utterance.lang='nl-NL';speechSynthesis.speak(utterance);
  };
  tools.append(hint,speaker);$('#questionHint').after(tools);
  const source=document.createElement('p');source.id='eaigame-question-origin';source.className='eaigame-bron';tools.after(source);
 }
 $('#eaigame-hint').hidden=!currentQ.hint;
 $('#eaigame-speak').hidden=!('speechSynthesis' in window);
 $('#eaigame-question-origin').textContent=currentQ.origin==='eai-niveaupilot'?'Niveauproef met andere denkstappen per niveau. Redactioneel EAIgame-concept bij SLO-leergebied; niveau niet geijkt.':currentQ.origin==='eai-300'?'Redactionele EAIgame-vraag bij een SLO-leergebied. Niveau niet geijkt.':'Originele/eigen vragenbank. Controleer vragen voor gebruik.';
}
const baseFeedback=showFeedback;
showFeedback=function(q,correct,newMedal){
 baseFeedback(q,correct,newMedal);
 if(!q)return;
 $('#eaigame-hint')?.setAttribute('hidden','');
 const key=(state.sessionId||'oud')+':'+state.turn+':'+state.current+':'+q.id;
 const entries=get();let record=entries.find(e=>e.key===key);
 if(!record){
  const selected=$('input[name="answer"]:checked');
  record={key,time:new Date().toISOString(),player:state.players[state.current]?.name,level:state.players[state.current]?.level||'bank',category:q.cat,questionId:q.id,question:q.prompt,antwoord:q.type==='number'?$('#numberAnswer')?.value||'':q.type==='order'?order.join(' | '):selected?q.options[Number(selected.value)]:'',correct:!!correct,discuss:false,unclear:false};
  entries.push(record);put(entries);
 }
 const panel=$('#feedback');if(!panel)return;
 const bar=document.createElement('div');bar.className='eaigame-feedback-actions';
 for(const [flag,label] of [['discuss','Voor nabespreking'],['unclear','Vraag is onduidelijk']]){
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;
  button.setAttribute('aria-pressed',String(!!record[flag]));
  button.onclick=()=>{const list=get(),entry=list.find(e=>e.key===key);if(!entry)return;entry[flag]=!entry[flag];put(list);button.setAttribute('aria-pressed',String(entry[flag]));button.textContent=entry[flag]?'Gemarkeerd: '+label:label};
  bar.appendChild(button);
 }
 panel.appendChild(bar);
};
if($('#questionDialog')?.open)attachQuestion();
})();