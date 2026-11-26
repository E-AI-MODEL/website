// EAIspeak voice palette. Native selects remain the single source of truth for
// voice / language / model logic; this layer only changes their presentation.
export const routeForEngine=value=>(
  ['browser','ollama'].includes(value)?'device':
  value==='puter'?'online':
  ['moshi','hibiki','hibiki-zero','dessa'].includes(value)?'speech':'device'
);

export function initMistVoiceUI({panel,root,details,closeMenu}){
  const engine=document.getElementById('freeTalkEngine');
  const models=[...root.querySelectorAll('[data-mist-engine]')];
  const routes=[...root.querySelectorAll('[data-mist-route]')];
  const nav=document.querySelector('.studio-nav');
  let currentRoute=routeForEngine(engine.value);
  let openPicker=null;
  const pickers=[];
  const list=document.createElement('div');
  list.className='mist-voice-select-layer';
  list.hidden=true;
  list.id='mistVoiceSelectLayer';
  list.setAttribute('role','listbox');
  panel.appendChild(list);

  function setRoute(route){
    if(!['device','online','speech'].includes(route))return;
    currentRoute=route;
    for(const item of routes){
      const active=item.dataset.mistRoute===route;
      item.setAttribute('aria-pressed',String(active));
      item.classList.toggle('is-current',active);
    }
    for(const item of models)item.hidden=item.dataset.mistGroup!==route;
    requestAnimationFrame(()=>window.dispatchEvent(new Event('eaispeak-mist-layout')));
  }

  function updateModels(){
    for(const item of models){
      const option=engine.querySelector('option[value="'+item.dataset.mistEngine+'"]');
      const unavailable=!!option?.disabled;
      item.disabled=unavailable;
      item.setAttribute('aria-disabled',String(unavailable));
      item.setAttribute('aria-pressed',String(item.dataset.mistEngine===engine.value));
      item.classList.toggle('is-current',item.dataset.mistEngine===engine.value);
    }
  }

  for(const item of routes)item.addEventListener('click',()=>{
    const route=item.dataset.mistRoute;
    setRoute(route);
    // A single provider does not need a second click.
    const choices=models.filter(m=>m.dataset.mistGroup===route&&!m.disabled);
    if(choices.length===1 && engine.value!==choices[0].dataset.mistEngine)chooseModel(choices[0].dataset.mistEngine);
  });
  function chooseModel(value){
    if(engine.value===value)return;
    engine.value=value;
    engine.dispatchEvent(new Event('change',{bubbles:true}));
    updateModels();
    updatePickers();
  }
  for(const item of models)item.addEventListener('click',()=>chooseModel(item.dataset.mistEngine));

  function closePicker(returnFocus=false){
    if(!openPicker)return;
    const previous=openPicker;
    openPicker=null;
    list.hidden=true;
    list.replaceChildren();
    previous.button.setAttribute('aria-expanded','false');
    if(returnFocus)previous.button.focus({preventScroll:true});
  }

  function positionPicker(){
    if(!openPicker||list.hidden)return;
    const anchor=openPicker.button.getBoundingClientRect();
    const navBottom=nav.getBoundingClientRect().bottom;
    const width=Math.min(330,innerWidth-24);
    const height=Math.min(list.scrollHeight,290,innerHeight-navBottom-30);
    const left=Math.max(12,Math.min(anchor.left,innerWidth-width-12));
    const roomBelow=innerHeight-anchor.bottom-12;
    const top=roomBelow>=Math.min(height,160)?anchor.bottom+5:Math.max(navBottom+6,anchor.top-height-5);
    Object.assign(list.style,{left:left+'px',top:top+'px',width:width+'px',maxHeight:Math.max(100,height)+'px'});
  }

  function showPicker(picker){
    if(openPicker===picker){closePicker();return;}
    closePicker();
    openPicker=picker;
    const select=picker.select;
    list.replaceChildren();
    list.setAttribute('aria-label',picker.label);
    for(const option of select.options){
      const item=document.createElement('button');
      item.type='button';
      item.className='mist-voice-choice';
      item.setAttribute('role','option');
      item.setAttribute('aria-selected',String(option.value===select.value));
      item.disabled=!!option.disabled;
      item.textContent=option.textContent.trim()||'Niet beschikbaar';
      item.dataset.value=option.value;
      item.addEventListener('click',()=>{
        if(item.disabled)return;
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        closePicker(true);
        queueMicrotask(updatePickers);
      });
      list.append(item);
    }
    list.hidden=false;
    picker.button.setAttribute('aria-expanded','true');
    positionPicker();
    requestAnimationFrame(()=>{
      const active=list.querySelector('[aria-selected="true"]:not(:disabled)')||list.querySelector('button:not(:disabled)');
      active?.focus({preventScroll:true});
      active?.scrollIntoView({block:'nearest'});
    });
  }

  // Avoid nested buttons inside HTML <label>; convert these select-only
  // labels into equivalent field groups before adding the custom controls.
  for(const select of root.querySelectorAll('select:not(#freeTalkEngine)')){
    const fieldLabel=select.closest('label.studio-field');
    const container=document.createElement('div');
    container.className='mist-voice-select-field';
    if(fieldLabel){
      // Preserve the original label node. Existing voice logic keeps a reference
      // to it and toggles its hidden property for live speech engines.
      fieldLabel.replaceWith(container);
      container.append(fieldLabel);
      container.hidden=fieldLabel.hidden;
      new MutationObserver(()=>{container.hidden=fieldLabel.hidden;})
        .observe(fieldLabel,{attributes:true,attributeFilter:['hidden']});
    } else{
      select.before(container);
      container.append(select);
    }
    select.classList.add('mist-voice-native');
    select.tabIndex=-1;
    select.setAttribute('aria-hidden','true');
    const button=document.createElement('button');
    button.type='button';
    button.className='mist-voice-selector';
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label',labelForSelect(select));
    const value=document.createElement('span');
    value.className='mist-voice-selector-value';
    const chevron=document.createElement('span');
    chevron.className='mist-voice-selector-chevron';
    chevron.setAttribute('aria-hidden','true');
    chevron.textContent='⌄';
    button.append(value,chevron);
    container.append(button);
    const picker={select,button,value,label:labelForSelect(select)};
    pickers.push(picker);
    button.addEventListener('click',()=>showPicker(picker));
    button.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){
        event.preventDefault();showPicker(picker);
      }
    });
    select.addEventListener('change',()=>queueMicrotask(updatePickers));
    new MutationObserver(()=>queueMicrotask(updatePickers)).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label']});
  }

  function labelForSelect(select){
    const label=select.closest('label.studio-field');
    const text=label?[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim():'';
    return text||select.id||'Kies een optie';
  }
  function updatePickers(){
    for(const picker of pickers){
      const {select,button,value}=picker;
      const option=select.selectedOptions[0];
      value.textContent=option?.textContent?.trim()||'Maak een keuze';
      button.disabled=select.disabled||(!select.options.length);
    }
  }
  list.addEventListener('keydown',event=>{
    const options=[...list.querySelectorAll('button:not(:disabled)')];
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePicker(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const index=Math.max(0,options.indexOf(document.activeElement));
    const next=event.key==='Home'?0:event.key==='End'?options.length-1
      :(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options[next]?.focus({preventScroll:true});
    options[next]?.scrollIntoView({block:'nearest'});
  });
  // Let Tab leave the list normally; never trap focus.
  list.addEventListener('focusout',event=>{
    if(!list.contains(event.relatedTarget)&&event.relatedTarget!==openPicker?.button)closePicker();
  });
  document.addEventListener('pointerdown',event=>{
    if(openPicker&&!list.contains(event.target)&&!openPicker.button.contains(event.target))closePicker();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&openPicker){event.preventDefault();event.stopPropagation();closePicker(true);}
  },true);
  document.addEventListener('eaispeak-mist-update',()=>{updateModels();updatePickers();setRoute(routeForEngine(engine.value));});
  engine.addEventListener('change',()=>queueMicrotask(()=>{
    updateModels();setRoute(routeForEngine(engine.value));updatePickers();
  }));
  window.addEventListener('resize',positionPicker);
  window.addEventListener('eaispeak-mist-layout',positionPicker);
  root.querySelector('#freeTalkMenuClose')?.addEventListener('click',closeMenu);
  details.addEventListener('toggle',()=>{
    if(!details.open)closePicker();
  });
  // The palette is a presentation layer; never load a model on menu opening.
  updateModels();
  updatePickers();
  setRoute(routeForEngine(engine.value));
  return {closePicker,update:()=>{updateModels();updatePickers();setRoute(routeForEngine(engine.value));}};
}
