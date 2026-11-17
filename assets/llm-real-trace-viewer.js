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
 function render(host,t,lessonStep,tokenStep=0,layer=0,redraw){
  host.replaceChildren();
  intro(host,t);
  const s=t.steps[Math.max(0,Math.min(3,tokenStep))];
  host.append(el('p','Vaste invoer: "'+t.prompt+'" · '+s.input_length+' tokens','ai-trace-prompt'));
  if(lessonStep===2){
   host.append(el('p','Dit zijn de eerste acht waarden uit de echte aangeleerde getallenrij bij het laatste invoertoken. De waarden zijn niet uit gpt-oss.','ai-trace-help'));
   const values=el('div',null,'ai-trace-numbers');
   s.last_token_embedding_first8.forEach((value,i)=>{
    const cell=el('div',null,'ai-trace-number');
    cell.append(el('small',String(i+1)),el('strong',fmt(value)));
    values.append(cell);
   });host.append(values);
  }else if(lessonStep===4){
   host.append(el('p','Dit zijn de gemeten aandachtgewichten van één head in de laatste laag voor het huidige token. Je ziet hoe waarden verdeeld zijn over eerdere posities. Dit verklaart niet waarom het model een antwoord kiest.','ai-trace-help'));
   bars(host,s.attention.last_layer.map((value,i)=>({
    label:(s.input_tokens[i]?.text||'').replaceAll('\n','↵').trim()||'spatie',value
   })));
  }else if(lessonStep===6){
   host.append(el('p','Kies een meetpunt in het model. De waarden hieronder zijn daadwerkelijk berekend. Een groter getal betekent niet automatisch meer begrip.','ai-trace-help'));
   const controls=el('div',null,'ai-trace-nav');
   const select=el('select');select.setAttribute('aria-label','Kies een gemeten modeluitvoer');
   s.hidden_states.forEach((row,i)=>{
    const option=el('option',i===0?'Invoer van de lagen':'Na laag '+i);
    option.value=String(i);select.append(option);
   });
   select.value=String(Math.max(0,Math.min(layer,s.hidden_states.length-1)));
   select.onchange=()=>redraw(tokenStep,Number(select.value));
   controls.append(select);host.append(controls);
   const current=s.hidden_states[Number(select.value)];
   host.append(el('p','Lengte van de getallenrij (norm): '+fmt(current.norm),'ai-trace-help'));
   const values=el('div',null,'ai-trace-numbers');
   current.first.forEach((value,i)=>{
    const cell=el('div',null,'ai-trace-number');
    cell.append(el('small',String(i+1)),el('strong',fmt(value)));values.append(cell);
   });host.append(values);
  }else if(lessonStep===7){
   host.append(el('p','Dit zijn echte voorspellingen voor de volgende tokenpositie. De acht grootste kansen tellen niet noodzakelijk op tot 100%, want er zijn veel meer mogelijke tokens.','ai-trace-help'));
   bars(host,s.top_tokens.map(item=>({
    label:item.text.replaceAll('\n','↵').replaceAll(' ','␠').slice(0,16),value:item.probability
   })));
   host.append(el('p','Gekozen: '+JSON.stringify(s.chosen_token.text)+' (token '+s.chosen_token.id+')','ai-trace-choice'));
  }else if(lessonStep===8){
   host.append(el('p','Het getrainde model koos vier keer een volgend token. Dit fragment is ooit echt gegenereerd en hier als meting opgeslagen. Het reageert niet op jouw vraag.','ai-trace-help'));
   host.append(el('p',t.prompt+t.generated_tokens.slice(0,tokenStep+1).map(x=>x.text).join(''),'ai-trace-completion'));
  }
  const nav=el('div',null,'ai-trace-nav');
  const prev=el('button','Vorige voorspelling');prev.type='button';prev.disabled=tokenStep<=0;
  prev.onclick=()=>redraw(tokenStep-1,layer);
  const current=el('span','Voorspelling '+(tokenStep+1)+' / '+t.steps.length);
  const next=el('button','Volgende voorspelling');next.type='button';next.disabled=tokenStep>=t.steps.length-1;
  next.onclick=()=>redraw(tokenStep+1,layer);
  nav.append(prev,current,next);host.append(nav);
  host.append(el('p','Eenmalig vooraf berekend · echt getraind model · geen download van modelgewichten','ai-trace-footnote'));
 }
 root.EAIRealTraceViewer=Object.freeze({load,valid,render,FILE});
})(typeof globalThis!=='undefined'?globalThis:this);
