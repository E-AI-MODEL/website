import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkWebGpuAvailability} from '../src/gpu-capability.mjs';

test('geen WebGPU API geeft helder advies en geen schijnbare beschikbaarheid',async()=>{
  const result=await checkWebGpuAvailability(undefined);
  assert.equal(result.usable,false);
  assert.match(result.message,/WebGPU/);
});
test('WebGPU API zonder grafische adapter wordt afgekeurd',async()=>{
  const result=await checkWebGpuAvailability({requestAdapter:async()=>null});
  assert.equal(result.usable,false);
  assert.match(result.message,/grafische processor/);
});
test('WebGPU met adapter kan een browsermodel proberen',async()=>{
  const result=await checkWebGpuAvailability({requestAdapter:async()=>({})});
  assert.equal(result.usable,true);
});
test('WebGPU fout geeft een leesbare melding',async()=>{
  const result=await checkWebGpuAvailability({requestAdapter:async()=>{throw new Error('GPU blocked');}});
  assert.equal(result.usable,false);
  assert.match(result.message,/GPU blocked/);
});
