// EAIspeak: WebGPU is pas bruikbaar wanneer de browser ook een adapter aanbiedt.
export async function checkWebGpuAvailability(gpu){
  if(!gpu||typeof gpu.requestAdapter!=='function'){
    return {usable:false,message:'Deze browser ondersteunt geen WebGPU. Kies een online model of gebruik een andere browser.'};
  }
  try{
    const adapter=await gpu.requestAdapter();
    if(!adapter){
      return {usable:false,message:'Geen grafische processor beschikbaar voor WebGPU. Kies een online model of probeer Chrome of Safari op een geschikt apparaat.'};
    }
    return {usable:true,message:'Grafische processor beschikbaar. Je kunt een browsermodel laden.'};
  }catch(error){
    return {usable:false,message:'WebGPU kon niet worden gecontroleerd: '+String(error?.message||error)+'. Probeer een andere browser of kies online.'};
  }
}
