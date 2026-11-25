// EAIspeak. Een apparaatnaam is een aanwijzing, geen bewijs dat een model past.
// De controle gebeurt lokaal, zonder apparaatkenmerken door te sturen.
export const LIGHT_MODEL='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const MEDIUM_MODEL='Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export function describeDevice({userAgent='',userAgentDataMobile,platform='',touchPoints=0,width=1024,pointerCoarse=false}={}){
  const ua=String(userAgent);
  const phone=userAgentDataMobile===true||/iPhone|iPod|Android[^)]*Mobile|Windows Phone|Mobile Safari/i.test(ua);
  const tablet=/iPad|Android(?![^)]*Mobile)/i.test(ua)
    || (/Mac/i.test(platform||ua)&&touchPoints>1);
  const narrowTouch=width<650&&pointerCoarse&&touchPoints>0;
  const kind=phone?'phone':tablet?'tablet':narrowTouch?'phone':'computer';
  return {kind,label:kind==='phone'?'Telefoon':kind==='tablet'?'Tablet':'Computer'};
}

export function suggestDeviceSetup({kind='computer',gpuUsable=false,memoryGB=null,saveData=false}={}){
  // Op een telefoon is de lichte keuze het veiligst. Zelfs voldoende geheugen
  // garandeert niet dat de browser de WebGPU-gewichten kan laden.
  const restricted=kind==='phone'||kind==='tablet'||saveData===true;
  const enoughMemory=typeof memoryGB==='number'&&memoryGB>=8;
  return {
    engine:restricted||!gpuUsable?'puter':'browser',
    model:!restricted&&gpuUsable&&enoughMemory?MEDIUM_MODEL:LIGHT_MODEL
  };
}

export function modelDeviceAdvice({kind='computer',gpuUsable=false,memoryGB=null,saveData=false,modelId=LIGHT_MODEL}={}){
  if(!gpuUsable)return 'Geen WebGPU-adapter. Gebruik voorlopig een online model.';
  if(saveData)return 'Databesparing staat aan. Modellen worden alleen na je eigen keuze gedownload.';
  const heavy=modelId.includes('3B-Instruct')||modelId.includes('1.5B-Instruct');
  if((kind==='phone'||kind==='tablet')&&heavy)return 'Dit model kan te zwaar zijn voor een telefoon of tablet. Probeer liever eerst Qwen 0,5B.';
  if(typeof memoryGB==='number'&&memoryGB<=4&&heavy)return 'Dit model kan te veel geheugen vragen. Probeer liever Qwen 0,5B.';
  if(kind==='phone')return 'Een klein lokaal model is te proberen. Of het past, blijkt pas tijdens het laden.';
  return 'De browser kan een lokaal model proberen. De werkelijke belasting blijkt bij het laden.';
}
