/* Browser/CLI adapter for the existing inventory format. Original records stay intact. */
(function(factory){
  const api=typeof module==='object'&&module.exports?factory(require('./profile.js')):factory(window.AssuranceProfile);
  if(typeof module==='object'&&module.exports)module.exports=api;else window.AssuranceAdapter=api;
})(function(profiles){
  'use strict';
  const stores=Object.freeze({additionalCandidates:'candidates'});
  const clone=value=>JSON.parse(JSON.stringify(value));
  function policyFor(profile,catalog){
    const p=profiles.validate(profile);
    if(!catalog||!Array.isArray(catalog.references)||!Array.isArray(catalog.relationTypes))throw Error('Het register met toetsingskaders ontbreekt.');
    return {id:p.policy.id,version:p.policy.version,reviewMaxAgeDays:p.policy.reviewMaxAgeDays,
      knownFrameworkIds:catalog.references.map(item=>item.id),knownRelationTypes:catalog.relationTypes.map(item=>item.id),
      roleRequiredFrameworkIds:['EN18286'],allowedRoles:['Gebruiksverantwoordelijke','Aanbieder','Beide rollen','Overig','Niet van toepassing']};
  }
  function fromRegisters(profile,registers,catalog,context){
    const p=profiles.validate(profile),records=[];
    if(!registers||typeof registers!=='object')throw Error('Registers ontbreken.');
    for(const type of Object.keys(p.source.registerFiles).sort()){
      const items=registers[type];
      if(!Array.isArray(items))throw Error('Register ontbreekt of is geen lijst: '+type);
      for(const original of items){
        const data=clone(original);
        // The importer adds the JSON filename for display. It is not an original source claim.
        if(Array.isArray(data.sources))data.sources=data.sources.filter(value=>value!==p.source.registerFiles[type]);
        records.push({type,id:data.id,data});
      }
    }
    records.sort((a,b)=>a.type<b.type?-1:a.type>b.type?1:String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
    return {records,context:{...context,organisationId:p.organisation.id,scopeId:profiles.scopeKey(p)},policy:policyFor(p,catalog),
      reviewRules:{catalog:clone(catalog),registerFiles:clone(p.source.registerFiles)}};
  }
  function fromState(profile,state,catalog,context){
    const registers={};
    for(const type of Object.keys(profile.source.registerFiles)){
      const source=state[stores[type]||type];
      if(!source||typeof source.values!=='function')throw Error('Register ontbreekt in het dashboard: '+type);
      if(type==='sourceRegister'&&source.size===0&&state.sourceRegisterLoaded!==true)throw Error('Het verplichte bronregister is nog niet ingelezen.');
      registers[type]=Array.from(source.values());
    }
    return fromRegisters(profile,registers,catalog,context);
  }
  function fromDocuments(profile,documents,catalog,context){
    const registers={};
    for(const [type,file] of Object.entries(profile.source.registerFiles)){
      if(documents[file]?.schema!=='eai-school-ict-v1')throw Error('Onbekende bronstructuur: '+file);
      registers[type]=documents[file][type];
    }
    return fromRegisters(profile,registers,catalog,context);
  }
  return Object.freeze({version:'1.0.0',policyFor,fromRegisters,fromState,fromDocuments});
});
