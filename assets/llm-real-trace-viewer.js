/* Optional recording viewer for a small trained public model.
 * Recorded GPT-Neo values, NEVER gpt-oss activations or live visitor-input inference.
 * All data comes from an audited same-origin JSON file; no third-party calls in browser.
 */
(function(root){
 'use strict';
 const FILE='/assets/llm-real-trace.json';
 let cached=null;
 let requested=null;
 const el=(tag,text,cls)=>{
  const node=document.createElement(tag);
  if(text!==undefined&&text!==null)node.textContent=String(text);
  if(cls)node.className=cls;
  return node;
 };
 const pct=x=>(100*x).toFixed(1)+'%';
 const fmt=x=>Number(x).toFixed(3);
 function valid(t){
  return Boolean(t&&t.schema==='eai-real-trace-v1'&&t.kind==='recorded_model_execution'&&
   t.model?.id==='EphAsad/IllaryiaStories-1M'&&t.model.experts===0&&
   t.model.revision&&t.model.sha256_weights?.length===64&&
   t.prompt==='Once upon a time,'&&Array.isArray(t.steps)&&t.steps.length===4&&
   t.steps.every(s=>Array.isArray(s.top_tokens)&&s.top_tokens.length===8&&
    Array.isArray(s.attention?.last_layer)&&Array.isArray(s.hidden_states)));
 }
 function load(){
  if(cached)return Promise.resolve(cached);
  if(!requested){
   requested=fetch(FILE,{cache:'force-cache',credentials:'same-origin'})
    .then(r=>{if(!r.ok)throw new Error('meetbestand niet beschikbaar');return r.json()})
    .then(t=>{if(!valid(t))throw new Error('meetbestand mist brongegevens');cached=t;return t})
    .catch(e=>{requested=null;throw e});
  }
  return requested;
 }
 function intro(host,t){
  const title=el('strong','Echte modelmeting · ander model','ai-trace-title');
  host.append(title);
  host.append(el('p','Deze getallen zijn echt gemeten bij '+t.model.id+
   '. Het model heeft '+t.model.layers+' lagen, geen experts en een eigen tokenizer. '+
   'De tekst hieronder is een vast Engels voorbeeld, niet jouw vraag.','ai-trace-disclaimer'));
  const source=el('a','Bekijk model en bron','ai-trace-source');
  source.href=t.model.url;source.target='_blank';source.rel='noopener noreferrer';
  host.append(source);
 }
 function bars(host,values){
  const group=el('div',null,'ai-trace-bars');
  values.forEach(({label,value})=>{
   const row=el('div',null,'ai-trace-bar');
   row.append(el('span',label,'ai-trace-word'));
   const track=el('div',null,'ai-trace-track');
   const fill=el('i');fill.style.width=(Math.max(0,Math.min(1,value))*100).toFixed(3)+'%';track.append(fill);
   row.append(track,el('strong',pct(value)));
   group.append(row);
  });
  host.append(group);
 }
 function tokenText(text){
  return String(text||'').replaceAll('\n','↵').replaceAll(' ','␠')||'␠';
 }
 function journey(host,t,tokenStep,redraw){
  const section=el('div',null,'ai-trace-journey');
  section.append(el('strong','Zo groeit de tekst','ai-trace-journey-title'));
  const prompt=el('p','Al geschreven: '+t.prompt+
   t.generated_tokens.slice(0,tokenStep).map(x=>x.text).join(''),'ai-trace-existing');
  section.append(prompt);
  const choices=el('div',null,'ai-trace-token-steps');
  t.generated_tokens.forEach((token,i)=>{
   const btn=el('button',String(i+1)+' · '+tokenText(token.text),'ai-trace-token-step'+(i===tokenStep?' is-active':''));
   btn.type='button';
   btn.setAttribute('aria-label','Bekijk voorspelling '+(i+1)+': '+tokenText(token.text));
   btn.setAttribute('aria-pressed',String(i===tokenStep));
   btn.title='Echt gemeten token-ID '+token.id;
   btn.onclick=()=>redraw(i,0);
   choices.append(btn);
  });
  section.append(choices);
  section.append(el('p','Nu wordt gekozen: '+JSON.stringify(t.steps[tokenStep].chosen_token.text)+
   ' (token '+t.steps[tokenStep].chosen_token.id+')','ai-trace-selected'));
  host.append(section);
 }
 function render(host,t,lessonStep,tokenStep=0,layer=0,redraw){
  host.replaceChildren();
  intro(host,t);
  const index=Math.max(0,Math.min(t.steps.length-1,tokenStep));
  const s=t.steps[index];
  const show=typeof redraw==='function'?redraw:()=>{};
  journey(host,t,index,show);
  host.append(el('p','Vaste begintekst: "'+t.prompt+'" · '+s.input_length+
    ' invoertokens op dit meetpunt','ai-trace-prompt'));
  host.append(el('p','Dit is een opname van de vaste invoer. De cijfers veranderen alleen als je een andere opgenomen voorspelling kiest.','ai-trace-help'));
  if(lessonStep===2){
   host.append(el('p','Dit zijn de eerste acht echte waarden uit de aangeleerde getallenrij bij het laatste token dat het model al kreeg. Dezelfde token-ID verwijst in dit model steeds naar dezelfde rij.','ai-trace-help'));
   const values=el('div',null,'ai-trace-numbers');
   s.last_token_embedding_first8.forEach((value,i)=>{
    const cell=el('div',null,'ai-trace-number');
    cell.append(el('small',String(i+1)),el('strong',fmt(value)));
    values.append(cell);
   });
   host.append(values);
  }else if(lessonStep===4){
   const choice=layer===1?1:0;
   const first=choice===0;
   const weights=first?s.attention.first_layer:s.attention.last_layer;
   const nav=el('div',null,'ai-trace-head-choices');
   const label=el('span','Vergelijk head 1 in twee lagen','ai-trace-head-label');
   nav.append(label);
   for(const [i,name] of ['Eerste laag','Laatste laag'].entries()){
    const btn=el('button',name,'ai-trace-head-btn'+(i===choice?' is-active':''));
    btn.type='button';
    btn.setAttribute('aria-pressed',String(i===choice));
    btn.onclick=()=>show(index,i);
    nav.append(btn);
   }
   host.append(nav);
   host.append(el('p','Dit zijn echt gemeten gewichten van head 1 in de '+
    (first?'eerste':'laatste')+' laag. Elke laag heeft zijn eigen rekenonderdeel; '+
    'head 1 in de eerste laag is dus niet dezelfde head als in de laatste laag. '+
    'De gewichten laten zien hoe de beschikbare tokens worden meegewogen, niet waarom het model dit antwoord gaf.','ai-trace-help'));
   bars(host,weights.map((value,i)=>({
    label:tokenText(s.input_tokens[i]?.text).slice(0,16),value
   })));
   host.append(el('p','Samen: '+pct(weights.reduce((a,b)=>a+b,0))+' voor de '+s.input_tokens.length+
    ' beschikbare posities.','ai-trace-footnote'));
  }else if(lessonStep===6){
   host.append(el('p','Kies een laag om de werkelijk gemeten getallen vóór en ná de berekening te vergelijken. De modelwaarden zijn niet gekoppeld aan één betekenis.','ai-trace-help'));
   const controls=el('div',null,'ai-trace-nav');
   const select=el('select');select.setAttribute('aria-label','Kies een gemeten modeluitvoer');
   s.hidden_states.forEach((row,i)=>{
    const option=el('option',i===0?'Vóór de eerste laag':'Na laag '+i);
    option.value=String(i);select.append(option);
   });
   select.value=String(Math.max(0,Math.min(layer,s.hidden_states.length-1)));
   select.onchange=()=>show(index,Number(select.value));
   controls.append(select);host.append(controls);
   const which=Number(select.value);
   const current=s.hidden_states[which];
   host.append(el('p','Grootte van de hele getallenrij: '+fmt(current.norm)+
    '. Dit is geen maat voor begrip.','ai-trace-help'));
   const values=el('div',null,'ai-trace-numbers');
   current.first.forEach((value,i)=>{
    const cell=el('div',null,'ai-trace-number');
    cell.append(el('small',String(i+1)),el('strong',fmt(value)));
    values.append(cell);
   });
   host.append(values);
   if(which>0){
    const previous=s.hidden_states[which-1];
    const diffs=el('div',null,'ai-trace-differences');
    diffs.append(el('small','Verandering sinds de vorige laag:','ai-trace-diff-title'));
    const numbers=el('div',null,'ai-trace-numbers');
    current.first.forEach((value,i)=>{
     const delta=value-previous.first[i];
     const cell=el('div',null,'ai-trace-number ai-trace-delta');
     cell.append(el('small',String(i+1)),
      el('strong',(delta>=0?'+':'')+fmt(delta)));
     numbers.append(cell);
    });
    diffs.append(numbers);
    host.append(diffs);
   }
  }else if(lessonStep===7){
   host.append(el('p','Hier zie je de acht grootste kansen die dit model werkelijk berekende voor de volgende tokenpositie. De grootste kans werd gekozen.','ai-trace-help'));
   bars(host,s.top_tokens.map(item=>({
    label:tokenText(item.text).slice(0,16),value:item.probability
   })));
   const topMass=s.top_tokens.reduce((sum,item)=>sum+item.probability,0);
   host.append(el('p','Samen: '+pct(topMass)+'. Alle overige tokens samen: '+
    pct(Math.max(0,1-topMass))+'.','ai-trace-footnote'));
   host.append(el('p','Gekozen: '+JSON.stringify(s.chosen_token.text)+' (token '+
    s.chosen_token.id+')','ai-trace-choice'));
  }else if(lessonStep===8){
   host.append(el('p','Het getrainde model berekende één token per keer. Kies hierboven een van de vier voorspellingen en zie hoe de tekst groeit. Dit is geen antwoord op jouw vraag.','ai-trace-help'));
   const sentence=el('p',null,'ai-trace-completion');
   sentence.append(document.createTextNode(t.prompt+
    t.generated_tokens.slice(0,index).map(x=>x.text).join('')));
   sentence.append(el('mark',t.generated_tokens[index].text,'ai-trace-new-token'));
   host.append(sentence);
  }
  const nav=el('div',null,'ai-trace-nav');
  const prev=el('button','Vorige voorspelling');prev.type='button';prev.disabled=index<=0;
  prev.onclick=()=>show(index-1,0);
  const current=el('span','Voorspelling '+(index+1)+' / '+t.steps.length);
  const next=el('button','Volgende voorspelling');next.type='button';next.disabled=index>=t.steps.length-1;
  next.onclick=()=>show(index+1,0);
  nav.append(prev,current,next);host.append(nav);
  host.append(el('p','Vooraf gemeten · getraind GPT-Neo-model · geen download van modelgewichten',
   'ai-trace-footnote'));
 }
 root.EAIRealTraceViewer=Object.freeze({load,valid,render,FILE});
})(typeof globalThis!=='undefined'?globalThis:this);
