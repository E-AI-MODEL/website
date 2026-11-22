'use strict';
/* One bounded, local worker. The caller terminates obsolete runs. */
importScripts('./source-register.js?v=20261121d','./engine.js?v=20261121d');
async function digest(value){
  const bytes=new TextEncoder().encode(AssuranceEngine.canonicalize(value));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return 'sha256:'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
self.onmessage=async event=>{
  const message=event.data;
  if(!message||!Number.isSafeInteger(message.id)||message.id<1)return;
  try{
    if(!message.input||typeof message.input!=='object')throw Error('De invoer voor de controle ontbreekt.');
    const input=message.input;
    input.context={...input.context,sourceFingerprint:await digest(input.records)};
    if(!input.context.sourceVersion)input.context.sourceVersion=input.context.sourceFingerprint;
    const result=AssuranceEngine.evaluate(input);
    result.provenance={inputFingerprint:input.context.sourceFingerprint,policyFingerprint:await digest(input.policy),reviewRulesFingerprint:await digest(input.reviewRules||null),sourceRegisterVersion:AssuranceSourceRegister.VERSION,corpusFingerprint:await digest(input.evaluation),execution:'browser-worker',modelCalls:0};
    let baseline=null;
    if(result.checks.find(check=>check.id==='structure')?.status==='pass')baseline=AssuranceEngine.createBaseline(input);
    self.postMessage({id:message.id,result,baseline});
  }catch(error){self.postMessage({id:message.id,error:String(error.message||'Controle mislukt.').slice(0,300)});}
};
