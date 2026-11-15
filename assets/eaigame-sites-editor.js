/* EAIgame: eigen meerkeuzevragen veilig bewerken of verwijderen. */
(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const oldRender=renderBank;
renderBank=function(...args){const result=oldRender(...args);decorate();return result};
function decorate(){
 const filter=$('#bankFilter')?.value||'all',visible=bank.filter(q=>filter==='all'||q.cat===filter);
 $$('#bankList .bank-item').forEach((node,i)=>{
  const q=visible[i];if(!q?.id?.startsWith('eigen-'))return;
  const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent='Bewerk eigen vraag';
  button.onclick=()=>edit(q.id);node.appendChild(button);
 });
}
function dialog(){
 let d=$('#eaigame-editor');if(d)return d;
 d=document.createElement('dialog');d.id='eaigame-editor';d.className='bank-dialog';
 d.innerHTML='<form id="eaigame-edit-form"><h2>Eigen vraag aanpassen</h2><label class="field-label">Vraag<textarea name="prompt" required maxlength="300"></textarea></label><label class="field-label">Antwoord A<input name="a" required maxlength="300"></label><label class="field-label">Antwoord B<input name="b" required maxlength="300"></label><label class="field-label">Antwoord C<input name="c" required maxlength="300"></label><label class="field-label">Antwoord D<input name="d" required maxlength="300"></label><label class="field-label">Goed antwoord<select name="answer"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label><label class="field-label">Uitleg<textarea name="explanation" required maxlength="600"></textarea></label><div class="eaigame-vraagtools"><button class="primary" type="submit">Opslaan</button><button class="secondary" type="button" id="eaigame-remove">Verwijderen</button><button class="secondary" type="button" id="eaigame-edit-close">Sluiten</button></div><p id="eaigame-edit-message" role="status"></p></form>';
 document.body.appendChild(d);return d;
}
function edit(id){
 const current=bank.find(q=>q.id===id&&q.id.startsWith('eigen-'));
 if(!current||current.type!=='choice')return;
 const d=dialog(),form=$('#eaigame-edit-form');
 for(const [key,value] of [['prompt',current.prompt],['a',current.options[0]],['b',current.options[1]],['c',current.options[2]],['d',current.options[3]],['answer',current.answer],['explanation',current.explanation]])form.elements.namedItem(key).value=value??'';
 $('#eaigame-edit-message').textContent='';
 form.onsubmit=e=>{
  e.preventDefault();const f=new FormData(form);
  const edited={...current,prompt:String(f.get('prompt')).trim(),options:['a','b','c','d'].map(k=>String(f.get(k)).trim()),answer:Number(f.get('answer')),explanation:String(f.get('explanation')).trim()};
  const copy=bank.map(q=>q.id===id?edited:q);
  try{validBank(copy);bank=copy;if(!saveBank())throw Error('Bewaren in deze browser is mislukt.');renderBank();d.close()}catch(error){$('#eaigame-edit-message').textContent=error.message}
 };
 const remove=$('#eaigame-remove');remove.dataset.confirm='no';remove.textContent='Verwijderen';
 remove.onclick=()=>{
  if(remove.dataset.confirm!=='yes'){remove.dataset.confirm='yes';remove.textContent='Nogmaals: verwijderen';return}
  const copy=bank.filter(q=>q.id!==id);
  try{validBank(copy);bank=copy;if(!saveBank())throw Error('Bewaren is mislukt.');renderBank();d.close()}catch(error){$('#eaigame-edit-message').textContent=error.message}
 };
 $('#eaigame-edit-close').onclick=()=>d.close();
 d.showModal();
}
})();