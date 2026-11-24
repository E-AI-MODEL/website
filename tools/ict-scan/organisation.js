'use strict';
/* One explicit profile per page. No fallback to another organisation on failure. */
(function(){
  const source=document.currentScript?.dataset.profile;
  let current=null,error=null;
  const ready=(async()=>{
    if(!source)throw Error('Organisatieprofiel ontbreekt.');
    const url=new URL(source,document.baseURI);
    if(url.origin!==location.origin)throw Error('Het organisatieprofiel moet van deze website komen.');
    const response=await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error'});
    if(!response.ok)throw Error('Organisatieprofiel niet beschikbaar (HTTP '+response.status+').');
    current=window.AssuranceProfile.validate(await response.json());
    for(const [id,value] of [['githubRepo',current.source.repository],['githubFolder',current.source.sourceDir],['githubRef',current.source.baseRef]]){
      const input=document.getElementById(id);if(input)input.value=value;
    }
    const target=document.getElementById('cardPublishTarget');
    if(target)target.textContent='Wijzigingsvoorstel voor '+current.organisation.name+' · '+current.source.repository+' / '+current.source.sourceDir+' @ '+current.source.baseRef;
    return current;
  })().catch(failure=>{error=failure;throw failure;});
  ready.catch(()=>{}); // Callers display the failure; avoid an unhandled-rejection event.
  window.IctOrganisation=Object.freeze({ready,get profile(){return current;},get error(){return error;}});
})();
