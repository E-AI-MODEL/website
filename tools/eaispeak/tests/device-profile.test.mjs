import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describeDevice,suggestDeviceSetup,modelDeviceAdvice,LIGHT_MODEL,MEDIUM_MODEL} from '../src/device-profile.mjs';

test('iPhone wordt herkend als telefoon, ook wanneer scherminformatie ontbreekt',()=>{
  const p=describeDevice({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',width:1200});
  assert.equal(p.kind,'phone');
});
test('iPad en iPadOS desktop user agent worden herkend als tablet',()=>{
  assert.equal(describeDevice({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0)',width:1024}).kind,'tablet');
  assert.equal(describeDevice({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',touchPoints:5,width:1024}).kind,'tablet');
});
test('Android telefoon en tablet krijgen afzonderlijke apparaatsoorten',()=>{
  assert.equal(describeDevice({userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36'}).kind,'phone');
  assert.equal(describeDevice({userAgent:'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Safari/537.36'}).kind,'tablet');
});
test('desktop op smal venster is niet automatisch een telefoon',()=>{
  assert.equal(describeDevice({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',touchPoints:0,width:390,pointerCoarse:false}).kind,'computer');
});
test('mobiele hints en aanraakscherm zijn bruikbaar zonder modelnaam',()=>{
  assert.equal(describeDevice({userAgentDataMobile:true}).kind,'phone');
  assert.equal(describeDevice({width:390,pointerCoarse:true,touchPoints:5}).kind,'phone');
});
test('telefoon en tablet starten zonder grote downloads, ook met WebGPU',()=>{
  for(const kind of ['phone','tablet']){
    const s=suggestDeviceSetup({kind,gpuUsable:true,memoryGB:8});
    assert.equal(s.engine,'puter');
    assert.equal(s.model,LIGHT_MODEL);
  }
});
test('computer met WebGPU kan direct browsermodel aanbieden',()=>{
  const s=suggestDeviceSetup({kind:'computer',gpuUsable:true,memoryGB:8});
  assert.equal(s.engine,'browser');
  assert.equal(s.model,MEDIUM_MODEL);
});
test('apparaat zonder WebGPU krijgt online alternatief, ook op desktop',()=>{
  const s=suggestDeviceSetup({kind:'computer',gpuUsable:false});
  assert.equal(s.engine,'puter');
  assert.equal(s.model,LIGHT_MODEL);
});
test('databesparing voorkomt automatische lokale route',()=>{
  assert.equal(suggestDeviceSetup({kind:'computer',gpuUsable:true,memoryGB:16,saveData:true}).engine,'puter');
  assert.match(modelDeviceAdvice({gpuUsable:true,saveData:true}),/Databesparing/);
});
test('zwaar model op telefoon geeft waarschuwing, niet valse zekerheid',()=>{
  assert.match(modelDeviceAdvice({kind:'phone',gpuUsable:true,modelId:'Qwen2.5-3B-Instruct-q4f16_1-MLC'}),/te zwaar/);
  assert.match(modelDeviceAdvice({kind:'phone',gpuUsable:true,modelId:LIGHT_MODEL}),/blijkt pas tijdens het laden/);
});
test('zonder WebGPU is lokale inferentie niet beschikbaar',()=>{
  assert.match(modelDeviceAdvice({kind:'computer',gpuUsable:false}),/Geen WebGPU-adapter/);
});
