/* Shared write-time contract. It checks a recorded assessment, not legal conformity. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AssuranceRecord=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const roles=Object.freeze(['Gebruiksverantwoordelijke','Aanbieder','Beide rollen','Overig','Niet van toepassing']);
  const followUpStatuses=Object.freeze(['Open','In uitvoering','Afgerond','Niet van toepassing']);
  const statuses=Object.freeze(['Nog te beoordelen','In onderzoek','Onderbouwd','Niet van toepassing']);
  const fields=Object.freeze(['frameworkId','article','status','evidence','note','role','reviewedBy','reviewedAt','nextReviewAt','followUp','followUpOwner','followUpStatus','completionEvidence']);
  const has=value=>typeof value==='string'&&value.trim().length>0&&!['?','onbekend','unknown','n.t.b.','nog te beoordelen','niet vastgesteld'].includes(value.trim().toLowerCase());
  function validDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+'T00:00:00.000Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  }
  function validate(link,options={}){
    const errors=[];
    const add=(field,code,message)=>errors.push({field,code,message});
    if(!link||typeof link!=='object'||Array.isArray(link))return [{field:'frameworkLinks',code:'INVALID_LINK',message:'Een normverwijzing moet een object zijn.'}];
    for(const field of fields)if(link[field]!==undefined&&typeof link[field]!=='string')add(field,'INVALID_TYPE','Het veld '+field+' moet tekst bevatten.');
    if(errors.length)return errors;
    if(!has(link.frameworkId)||!has(link.article))add('article','INCOMPLETE_REFERENCE','Kies een toetsingskader en vul de concrete norm of het artikel in.');
    if(options.catalog&&!options.catalog.references?.some(item=>item.id===link.frameworkId))add('frameworkId','UNKNOWN_FRAMEWORK','Onbekend toetsingskader.');
    if(!statuses.includes(link.status))add('status','UNKNOWN_STATUS','Kies een bekende beoordelingsstatus.');
    if(has(link.role)&&!roles.includes(link.role))add('role','UNKNOWN_ROLE','Kies een bekende rol van de organisatie.');
    if(has(link.followUpStatus)&&!followUpStatuses.includes(link.followUpStatus))add('followUpStatus','UNKNOWN_FOLLOW_UP','Kies een bekende status voor de opvolging.');
    for(const field of ['reviewedAt','nextReviewAt'])if(has(link[field])&&!validDate(link[field]))add(field,'INVALID_DATE','Vul een bestaande datum in bij '+(field==='reviewedAt'?'Beoordeeld op.':'Volgende beoordeling.'));
    if(options.asOf&&!validDate(options.asOf))add('asOf','INVALID_CLOCK','De controledatum is ongeldig.');
    if(validDate(options.asOf)&&validDate(link.reviewedAt)&&link.reviewedAt>options.asOf)add('reviewedAt','FUTURE_REVIEW','De beoordelingsdatum ligt in de toekomst.');
    if(validDate(link.reviewedAt)&&validDate(link.nextReviewAt)&&link.nextReviewAt<link.reviewedAt)add('nextReviewAt','REVIEW_ORDER','De volgende beoordeling valt vóór de vastgelegde beoordeling.');
    if(link.status==='Onderbouwd'&&!has(link.evidence))add('evidence','EVIDENCE_REQUIRED','Onderbouwd oordeel zonder bewijs. Voeg een bronverwijzing toe.');
    if(['Onderbouwd','Niet van toepassing'].includes(link.status)){
      if(!has(link.reviewedBy))add('reviewedBy','REVIEWER_REQUIRED','Leg vast wie deze beoordeling heeft uitgevoerd.');
      if(!has(link.reviewedAt))add('reviewedAt','REVIEW_DATE_REQUIRED','Leg de beoordelingsdatum vast.');
    }
    if(link.frameworkId==='EN18286'&&link.status==='Onderbouwd'){
      if(!has(link.role)||link.role==='Niet van toepassing')add('role','ROLE_REQUIRED','Leg de rol van de organisatie vast bij de onderbouwde EN 18286-beoordeling.');
    }
    if(link.status==='Niet van toepassing'&&!has(link.note))add('note','APPLICABILITY_REASON_REQUIRED','Licht toe waarom deze bepaling niet van toepassing is.');
    if(link.followUpStatus==='Afgerond'&&(!has(link.followUp)||!has(link.completionEvidence)))add('completionEvidence','COMPLETION_EVIDENCE_REQUIRED','Een afgeronde actie vereist een omschrijving en bewijs van uitvoering.');
    return errors;
  }
  function assertValid(link,options){const errors=validate(link,options);if(errors.length)throw Error(errors[0].message);return link;}
  return Object.freeze({version:'1.0.0',roles,followUpStatuses,statuses,fields,validDate,validate,assertValid});
});
