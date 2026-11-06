// Passkeys voor LEIF-beheer. Supabase Auth verifieert de handtekening; LEIF controleert de managerrol.
(()=>{
 'use strict';
 const endpoint='https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/leif-passkey';
 function supported(){
  return window.isSecureContext && typeof window.PublicKeyCredential==='function'
   && typeof navigator.credentials?.get==='function' && typeof navigator.credentials?.create==='function';
 }
 function fromBase64(value){
  if(typeof value!=='string')throw Error('invalid_challenge');
  const b64=value.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length/4)*4,'=')),c=>c.charCodeAt(0));
 }
 function toBase64(data){
  let str='';for(const b of new Uint8Array(data))str+=String.fromCharCode(b);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 }
 function publicKeyOptions(raw,registration){
  if(!raw||typeof raw.challenge!=='string')throw Error('invalid_challenge');
  const opts={...raw,challenge:fromBase64(raw.challenge)};
  const arrayName=registration?'excludeCredentials':'allowCredentials';
  if(Array.isArray(raw[arrayName]))opts[arrayName]=raw[arrayName].map(x=>({...x,id:fromBase64(x.id)}));
  if(registration){
   if(!raw.user||typeof raw.user.id!=='string')throw Error('invalid_challenge');
   opts.user={...raw.user,id:fromBase64(raw.user.id)};
  }
  return opts;
 }
 function encodeCredential(value,registration){
  if(!value||value.type!=='public-key')throw Error('invalid_credential');
  if(typeof value.toJSON==='function')return value.toJSON();
  const r=value.response;
  const response=registration?{
   clientDataJSON:toBase64(r.clientDataJSON),attestationObject:toBase64(r.attestationObject),
   transports:typeof r.getTransports==='function'?r.getTransports():[]
  }:{
   clientDataJSON:toBase64(r.clientDataJSON),authenticatorData:toBase64(r.authenticatorData),
   signature:toBase64(r.signature),userHandle:r.userHandle?toBase64(r.userHandle):null
  };
  return {id:value.id,rawId:toBase64(value.rawId),type:value.type,
   authenticatorAttachment:value.authenticatorAttachment||undefined,
   clientExtensionResults:value.getClientExtensionResults?.()||{},response};
 }
 async function call(action,body={},token){
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',credentials:'omit',
   headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   body:JSON.stringify({action,...body})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok){
   const error=new Error(data.error||'passkey_unavailable');
   error.status=response.status;
   throw error;
  }
  return data;
 }
 async function signIn(){
  if(!supported())throw Error('unsupported_device');
  const start=await call('passkey_signin_start');
  const credential=await navigator.credentials.get({publicKey:publicKeyOptions(start.options,false)});
  if(!credential)throw Error('cancelled');
  return call('passkey_signin_finish',{challenge_id:start.challenge_id,credential:encodeCredential(credential,false)});
 }
 async function register(accessToken){
  if(!supported())throw Error('unsupported_device');
  if(typeof accessToken!=='string'||accessToken.length<100)throw Error('not_authenticated');
  const start=await call('passkey_register_start',{},accessToken);
  const credential=await navigator.credentials.create({publicKey:publicKeyOptions(start.options,true)});
  if(!credential)throw Error('cancelled');
  return call('passkey_register_finish',{challenge_id:start.challenge_id,credential:encodeCredential(credential,true)},accessToken);
 }
 async function openAdmin(){
  const session=await signIn();
  if(!session.ok||typeof session.access_token!=='string'||typeof session.refresh_token!=='string')throw Error('invalid_session');
  sessionStorage.setItem('leif-admin-session-v1',JSON.stringify({
   access_token:session.access_token,refresh_token:session.refresh_token
  }));
  location.replace('/leif/beheer/');
 }
 window.LeifPasskey=Object.freeze({supported,signIn,register,openAdmin});
})();