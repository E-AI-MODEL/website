/* One-screen subject selection, with native anchor fallback and browser history. */
(function () {
  'use strict';
  const root=document.querySelector('[data-eai-explore]');
  if(!root)return;
  const overview=root.querySelector('[data-eai-overview]');
  const panels=Array.from(root.querySelectorAll('[data-eai-detail]'));
  const byId=new Map(panels.map(panel=>[panel.id,panel]));
  const originalTitle=document.title;
  let previous='';
  function update() {
    let id='';
    try{id=decodeURIComponent(window.location.hash.slice(1));}catch(_e){id='';}
    const selected=byId.get(id)||null;
    overview.hidden=Boolean(selected);
    panels.forEach(panel=>{panel.hidden=panel!==selected;});
    document.title=selected?selected.dataset.title+' · '+originalTitle:originalTitle;
    const changed=id!==previous;
    previous=id;
    if(changed && selected){
      requestAnimationFrame(()=>{
        window.scrollTo({top:0,behavior:'instant'});
        const heading=selected.querySelector('h2');
        if(heading)heading.focus({preventScroll:true});
      });
    }
  }
  window.addEventListener('hashchange',update);
  window.addEventListener('popstate',update);
  update();
})();
