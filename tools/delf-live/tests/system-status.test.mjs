import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SERVICES,STATUS,listLocalModels,validateLocalEndpoint,probeLocalModel,chatLocalModel,classifyError} from '../src/system-probes.mjs';

test('geen automatische verbinding en duidelijke beginstatus',()=>{
  assert.equal(SERVICES.length,8);
  assert.equal(STATUS.idle,'idle');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../src/system-status.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/src\/system-status\.js/);
  assert.match(panel,/addEventListener\('click',async\(\)=>/);
  assert.match(panel,/probeLocalModel\(id,\$\('systemEndpoint'\)\.value,modelSelect.value\)/);
  assert.match(panel,/systemDiscover/);
  assert.match(panel,/systemConnect'\)\.disabled=true/);
  assert.match(panel,/Niet gecontroleerd/);
  assert.match(panel,/Laatste gebeurtenissen/);
  assert.match(main,/componentStatus\('translationStatus','idle','Browsermodel geladen/);
  assert.match(main,/componentStatus\('frenchStatus','ready','Franse audiobuffer geproduceerd/);
});

test('alleen loopbackadressen zonder toegangsgegevens worden geaccepteerd',()=>{
  for(const address of ['http://localhost:11434/','http://127.0.0.1:1234/','http://[::1]:1234/']){
    assert.ok(validateLocalEndpoint(address).startsWith('http://'));
  }
  for(const address of ['https://example.org/','http://192.168.1.12:11434/','http://host.local/','file:///etc/passwd','http://localhost:11434/private','http://user:pass@localhost:11434/','http://localhost:11434/?token=abc']){
    assert.throws(()=>validateLocalEndpoint(address));
  }
});

test('Ollama: een modelantwoord wordt echt opgevraagd',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options)=>{
    calls.push({url,options});
    return {ok:true,json:async()=>url.endsWith('/api/tags')?{models:[{name:'test-model'}]}:{response:'OK'}};
  };
  try {
    const result=await probeLocalModel('ollama','http://localhost:11434/');
    assert.equal(result.model,'test-model');
    assert.equal(result.answer,'OK');
    assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/tags','/api/generate']);
    assert.equal(JSON.parse(calls[1].options.body).stream,false);
  } finally {globalThis.fetch=original;}
});

test('LM Studio: test via OpenAI-compatibele endpoints',async()=>{
  const original=globalThis.fetch;
  let count=0;
  globalThis.fetch=async (url,options)=>{
    count++;
    return {ok:true,json:async()=>url.endsWith('/v1/models')?{data:[{id:'local-test'}]}:{choices:[{message:{content:'OK'}}]}};
  };
  try{
    const result=await probeLocalModel('lmstudio','http://127.0.0.1:1234/');
    assert.equal(result.model,'local-test');
    assert.equal(count,2);
  } finally {globalThis.fetch=original;}
});

test('een bereikbare server zonder antwoord is geen geslaagde modeltest',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async (url)=>({ok:true,json:async()=>url.endsWith('/api/tags')?{models:[{name:'model'}]}:{response:''}});
  try{await assert.rejects(()=>probeLocalModel('ollama','http://localhost:11434/'),/geen tekst terug/i);}
  finally{globalThis.fetch=original;}
});

test('verbindingsfouten en timeouts krijgen een hersteladvies',()=>{
  const network=classifyError(new Error('Failed to fetch'),'ollama');
  assert.equal(network.code,'SYS-NET-002');
  assert.match(network.advice,/CORS/);
  assert.equal(classifyError(new Error('operation aborted'),'lmstudio').code,'SYS-TIMEOUT-001');
  assert.equal(classifyError(new Error('HTTP 404'),'ollama').code,'SYS-MODEL-004');
});

test('llama.cpp: modelnamen en geselecteerd model',async()=>{
  const original=globalThis.fetch;
  const bodies=[];
  globalThis.fetch=async (url,options)=>{
    if(options?.body)bodies.push(JSON.parse(options.body));
    return {ok:true,json:async()=>url.endsWith('/v1/models')
      ? {data:[{id:'first'},{id:'second'}]}
      : {choices:[{message:{content:'OK'}}]}};
  };
  try{
    const models=await listLocalModels('llamacpp','http://localhost:8080/');
    assert.deepEqual(models,['first','second']);
    const result=await probeLocalModel('llamacpp','http://localhost:8080/','second');
    assert.equal(result.model,'second');
    assert.equal(bodies[0].model,'second');
    await assert.rejects(()=>probeLocalModel('llamacpp','http://localhost:8080/','absent'),/staat niet op de server/);
  } finally {globalThis.fetch=original;}
});

test('Frans gesprek gebruikt chatmodel zonder Nederlandse systeemstem',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>({message:{content:'Bonjour ! Comment allez-vous ?'}})};
  };
  try {
    const result=await chatLocalModel('ollama','http://localhost:11434/','francais',[
      {role:'system',content:'Réponds en français.'},{role:'user',content:'Bonjour'}
    ]);
    assert.match(result,/Bonjour/);
    assert.equal(new URL(calls[0].url).pathname,'/api/chat');
    assert.equal(calls[0].body.stream,false);
    assert.equal(calls[0].body.model,'francais');
  }finally{globalThis.fetch=original;}
  const stage=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const conversation=readFileSync(new URL('../src/french-conversation.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(stage,/cloudFrenchConversationSpeak/);
  assert.match(conversation,/recognition.lang=language.value/);
  assert.match(conversation,/cloudFrenchConversationSpeak\(result\)/);
  assert.match(html,/id="dialogueLanguage"/);
  assert.match(html,/id="dialogueStart"/);
});
