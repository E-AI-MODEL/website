/* Compact navigation and local search of public pages and experiments. */
(function(){
 'use strict';
 var menu=document.querySelector('.eai-site-menu');
 if(!menu)return;
 var trigger=menu.querySelector(':scope > summary');
 var searchTrigger=document.querySelector('.eai-site-search-trigger');
 var searchBox=menu.querySelector('.eai-site-search');
 var panel=menu.querySelector('.eai-site-menu-panel');
 var sections=menu.querySelector('.eai-site-menu-sections');
 var groups=Array.from(menu.querySelectorAll('.eai-site-group'));
 var input=menu.querySelector('#eai-site-search-input');
 var results=menu.querySelector('#eai-site-search-results');
 var english=document.documentElement.lang==='en';
 var dataPromise=null;
 var activeQuery=0;

 function reset(){
  activeQuery++;
  if(searchBox)searchBox.hidden=true;
  if(searchTrigger)searchTrigger.setAttribute('aria-expanded','false');
  groups.forEach(function(group){group.open=false;});
  menu.querySelectorAll('.eai-site-topic,.eai-site-cluster').forEach(function(item){item.open=false;});
  if(input){input.value='';}
  if(sections)sections.hidden=false;
  if(results){results.hidden=true;results.replaceChildren();}
  panel.scrollTop=0;
 }
 function sync(){
  trigger.setAttribute('aria-expanded',String(menu.open));
  if(searchTrigger)searchTrigger.setAttribute('aria-expanded',String(menu.open && searchBox && !searchBox.hidden));
  trigger.setAttribute('aria-label',english?(menu.open?'Close menu':'Open menu'):(menu.open?'Menu sluiten':'Menu openen'));
  if(!menu.open)reset();
 }
 function close(focus){
  if(!menu.open)return;
  var wasSearching=Boolean(searchBox && !searchBox.hidden);
  menu.open=false;
  reset();
  sync();
  if(focus)(wasSearching && searchTrigger ? searchTrigger : trigger).focus();
 }
 function clean(value){
  return String(value||'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
 }
 function searchData(){
  if(!dataPromise){
   dataPromise=fetch('/assets/site-search-index.json',{credentials:'same-origin'})
    .then(function(response){if(!response.ok)throw new Error('Search index unavailable');return response.json();})
    .then(function(items){return Array.isArray(items)?items:[];})
    .catch(function(){return null;});
  }
  return dataPromise;
 }
 function resultLink(item){
  if(!item || typeof item.url!=='string'||!item.url.startsWith('/')||item.url.startsWith('//'))return null;
  var link=document.createElement('a');
  link.href=item.url;
  link.className='eai-site-search-hit';
  var name=document.createElement('strong');
  name.textContent=item.title||item.url;
  var note=document.createElement('small');
  note.textContent=item.category||'';
  link.append(name,note);
  var detail=String(item.description||'').trim();
  if(detail&&clean(detail)!==clean(item.title)){
   var summary=document.createElement('span');
   summary.className='eai-site-search-hit-description';
   summary.textContent=detail;
   link.append(summary);
  }
  return link;
 }
 function showMessage(message){
  var note=document.createElement('p');
  note.className='eai-site-search-status';
  note.setAttribute('role','status');
  note.textContent=message;
  results.append(note);
 }
 async function doSearch(){
  if(!input||!results||!sections)return;
  var query=clean(input.value);
  var current=++activeQuery;
  if(!query){
   results.replaceChildren();
   results.hidden=true;
   sections.hidden=false;
   return;
  }
  sections.hidden=true;
  results.hidden=false;
  results.replaceChildren();
  showMessage(english?'Searching…':'Zoeken…');
  var items=await searchData();
  if(current!==activeQuery)return;
  results.replaceChildren();
  if(!items){
   showMessage(english?'Search is unavailable. Browse the menu below.':'Zoeken is niet beschikbaar. Gebruik de categorieën in het menu.');
   sections.hidden=false;
   return;
  }
  var words=query.split(' ').filter(Boolean);
  var matches=items.map(function(item){
   var title=clean(item.title),category=clean(item.category),summary=clean(item.description);
   var combined=title+' '+category+' '+summary;
   if(!words.every(function(word){return combined.includes(word);})){return null;}
   var score=title===query?0:title.startsWith(query)?1:title.includes(query)?2:category.includes(query)?3:4;
   return {item:item,score:score};
  }).filter(Boolean).sort(function(a,b){return a.score-b.score||a.item.title.localeCompare(b.item.title);});
  var count=matches.length;
  showMessage(english?(count+' results'):(count+' resultaten'));
  if(!count){
   var back=document.createElement('button');
   back.type='button';
   back.className='eai-site-search-back';
   back.textContent=english?'Browse categories':'Bekijk de categorieën';
   back.addEventListener('click',function(){input.value='';doSearch();input.focus();});
   results.append(back);
   return;
  }
  matches.slice(0,60).forEach(function(record){var link=resultLink(record.item);if(link)results.append(link);});
  if(count>60)showMessage(english?'Refine your search for more results.':'Verfijn je zoekopdracht om meer resultaten te zien.');
  panel.scrollTop=0;
 }
 if(searchTrigger && searchBox && input){
  searchTrigger.addEventListener('click',function(event){
   event.preventDefault();
   event.stopPropagation();
   if(menu.open && !searchBox.hidden){close(false);searchTrigger.focus();return;}
   menu.open=true;
   reset();
   searchBox.hidden=false;
   sync();
   input.focus();
  });
 }
 groups.forEach(function(group){
  group.addEventListener('toggle',function(){
   if(!group.open)return;
   groups.forEach(function(other){if(other!==group)other.open=false;});
  });
 });
 if(input){
  input.addEventListener('input',doSearch);
  input.addEventListener('keydown',function(event){
   if(event.key==='ArrowDown'){
    var first=results.querySelector('a');
    if(first){event.preventDefault();first.focus();}
   }
   if(event.key==='Enter'){
    var best=results.querySelector('a');
    if(best){event.preventDefault();best.click();}
   }
   if(event.key==='Escape'){
    event.preventDefault();
    event.stopPropagation();
    if(input.value){input.value='';doSearch();}
    else{close(true);}
   }
  });
 }
 menu.addEventListener('toggle',sync);
 menu.addEventListener('click',function(event){if(event.target.closest('a'))close(false);});
 document.addEventListener('click',function(event){if(!menu.contains(event.target))close(false);});
 document.addEventListener('keydown',function(event){if(event.key==='Escape'&&menu.open){event.preventDefault();close(true);}});
 document.addEventListener('focusin',function(event){if(menu.open&&!menu.contains(event.target))close(false);});
 window.addEventListener('pageshow',function(){close(false);reset();});
 reset();sync();
})();
