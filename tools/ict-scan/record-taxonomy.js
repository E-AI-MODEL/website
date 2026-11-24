'use strict';
/* Shared deterministic meaning of existing ICT fields.
   No model, external inference or duplicated source records. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IctScanTaxonomy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DOMAINS=Object.freeze({classroom:'Onderwijsleerproces',school:'Organisatie en beheer'});
  const PHASES=Object.freeze(['Lesontwerp','Oriëntatie','Terugblik','Instructie','Begeleide inoefening','Zelfstandige verwerking','Afsluiting','Toetsing']);
  const allowed=new Set(PHASES);
  const educationFields=new Set(['phase','student','learning','didactics','attention','formative']);
  const read=value=>String(value??'').trim();
  function domain(row){
    const v=read(row?.domain);
    return v===DOMAINS.classroom?'classroom':v===DOMAINS.school?'school':'unknown';
  }
  const isClassroomAi=row=>domain(row)==='classroom';
  const isSchoolAi=row=>domain(row)==='school';
  function rawPhases(row){return [...new Set(read(row?.phase).split(/[\/,;]/).map(x=>x.trim()).filter(Boolean))];}
  function phases(row){return isClassroomAi(row)?rawPhases(row):[];}
  function chartPhases(row){
    if(!isClassroomAi(row))return [];
    const values=phases(row);
    return values.length?values:['Niet vastgelegd'];
  }
  function fieldStatus(row,field){
    if(isSchoolAi(row)&&educationFields.has(field))return 'niet-van-toepassing';
    return read(row?.[field])?'vastgelegd':'niet-vastgelegd';
  }
  function fieldLabel(field,row,fallback){
    if(isSchoolAi(row)){
      if(field==='teacher')return 'Controle door medewerker of beheerder';
      if(field==='input')return 'Wat de medewerker of beheerder instelt';
    }
    return fallback||field.replace(/([a-z])([A-Z])/g,'$1 $2');
  }
  function validateAi(records,apps=[]){
    const issues=[],ids=new Set(),appIds=new Set(apps.map(x=>x.id));
    for(const row of records){
      const id=read(row?.id)||'(zonder ID)',kind=domain(row),declared=rawPhases(row);
      const issue=(code,field)=>issues.push({id,code,field});
      if(ids.has(id))issue('DUPLICATE_ID','id');else ids.add(id);
      if(kind==='unknown')issue('UNKNOWN_DOMAIN','domain');
      if(kind==='classroom'){
        if(!declared.length)issue('MISSING_PHASE','phase');
        for(const phase of declared)if(!allowed.has(phase))issue('UNKNOWN_PHASE','phase');
      }else if(kind==='school'){
        if(declared.length)issue('PHASE_NOT_APPLICABLE','phase');
        for(const field of educationFields)if(field!=='phase'&&read(row[field]))issue('FIELD_NOT_APPLICABLE',field);
      }
      if(apps.length&&row?.parentId&&!appIds.has(row.parentId))issue('ORPHAN_APPLICATION','parentId');
    }
    return issues;
  }
  return Object.freeze({DOMAINS,PHASES,domain,isClassroomAi,isSchoolAi,phases,chartPhases,fieldStatus,fieldLabel,validateAi});
});
