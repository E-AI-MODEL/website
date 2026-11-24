import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { dashboardPage } from '../services/html-galerij/src/dashboard.js';
import { adminClientJs } from '../services/html-galerij/src/admin-client.js';
import { handleAdmin } from '../services/html-galerij/src/admin.js';

globalThis.crypto ||= webcrypto;
const ORIGIN='https://eai-html-galerij.vis-c9d.workers.dev';
const USER='beheer@example.test';
const ID='1762800000000-11111111-1111-4111-8111-111111111111';
const rows=[
 {id:ID,title:'Demo',author:'Maker',filename:'demo.html',status:'hidden',created_at:'2026-11-15 12:00:00'},
 {id:'1762800000001-11111111-1111-4111-8111-111111111112',title:'Zonnestelsel',author:'Maker 2',filename:'zon.html',status:'published',created_at:'2026-11-14 12:00:00'}
];
const actions=[];
let sessions=2;
const DB={
 async batch(statements){
  const results=[];
  for(const statement of statements)results.push(await statement.run());
  return results;
 },
 prepare(sql){
  return {bind(...args){
   return {
    async first(){
     if(sql.includes('COUNT(*) AS total,') && sql.includes('FROM uploads')){
      return {total:rows.length,published:rows.filter(x=>x.status==='published').length,
       hidden:rows.filter(x=>x.status==='hidden').length,newest:rows[0].created_at};
     }
     if(sql.includes('gallery_sessions'))return {total:sessions};
     if(sql.includes('gallery_login_attempts'))return {count:3};
     throw Error('Unexpected DB first: '+sql);
    },
    async all(){
     if(sql.includes('FROM site_admin_audit'))return {results:actions.slice().reverse()};
     if(sql.includes('FROM uploads')){
      const selected=sql.includes('WHERE status=?')?rows.filter(x=>x.status===args[0]):rows;
      return {results:selected.map(x=>({...x}))};
     }
     throw Error('Unexpected DB all: '+sql);
    },
    async run(){
     if(sql.startsWith('INSERT INTO site_admin_audit')){
      if(sql.includes('WHERE EXISTS') && rows.find(x=>x.id===args[3])?.status!=='hidden') return {meta:{changes:0}};
      actions.push({id:actions.length+1,actor:args[0],action:args[1],target:args[2],created_at:'2026-11-15 20:00:00'});
      return {meta:{changes:1}};
     }
     if(sql.startsWith('UPDATE uploads SET status=')){
      const row=rows.find(x=>x.id===args[0]&&x.status==='hidden');
      if(row)row.status='published';
      return {meta:{changes:row?1:0}};
     }
     if(sql.startsWith('DELETE FROM gallery_sessions')){sessions=0;return {success:true};}
     throw Error('Unexpected DB run: '+sql);
    }
   };
  }, first(){return this.bind().first();}, all(){return this.bind().all();}, run(){return this.bind().run();}};
 }
};
const env={DB};
const req=(path,method='GET',origin=null)=>new Request(ORIGIN+path,{method,headers:origin?{Origin:origin}:{}});
async function data(response){return response.json();}
const page=dashboardPage(USER);
assert.match(page,/Websiteoverzicht/);
for(const term of ['Bezoekers','Websitecontrole','Publicaties','HTML-galerij','Beveiliging','Laatste commit','Laatste geregistreerde dag','aria-selected']){
 assert.ok(page.includes(term),term);
}
assert.ok(!dashboardPage('<script>alert("XSS")</script>').includes('<script>alert("XSS")</script>'));
assert.match(dashboardPage('<script>alert("XSS")</script>'),/&lt;script&gt;/);
new Function(adminClientJs);
assert.ok(adminClientJs.includes('credentials:"same-origin"'));
assert.ok(adminClientJs.includes('fetch('));

// Check aggregated, strictly source-tagged data and avoid exposing uploads or credentials.
let response=await handleAdmin(req('/api/admin/overview'),env,USER);
assert.equal(response.status,200);
let body=await data(response);
assert.equal(body.gallery.hidden,1);
assert.equal(body.gallery.published,1);
assert.equal(body.security.activeSessions,2);
assert.equal(body.security.loginAttempts15min,3);
assert.equal(body.source,'Cloudflare D1 · eai-html-galerij');
assert.ok(!JSON.stringify(body).includes('html_content'));
response=await handleAdmin(req('/api/admin/files'),env,USER);
body=await data(response);
assert.equal(body.items.length,2);
response=await handleAdmin(req('/api/admin/files?status=hidden'),env,USER);
assert.equal((await data(response)).items.length,1);
response=await handleAdmin(req('/api/admin/files?status=invalid'),env,USER);
assert.equal(response.status,400);

// Mutation must reject missing/foreign Origin, and only restore the requested hidden entry.
response=await handleAdmin(req('/api/admin/files/'+ID+'/restore','POST'),env,USER);
assert.equal(response.status,403);
response=await handleAdmin(req('/api/admin/files/'+ID+'/restore','POST','https://attacker.example'),env,USER);
assert.equal(response.status,403);
assert.equal(rows[0].status,'hidden');
response=await handleAdmin(req('/api/admin/files/'+ID+'/restore','POST',ORIGIN),env,USER);
assert.equal(response.status,200);
assert.equal(rows[0].status,'published');
assert.equal(actions.at(-1).action,'upload.restored');
response=await handleAdmin(req('/api/admin/files/'+ID+'/restore','POST',ORIGIN),env,USER);
assert.equal(response.status,404);
response=await handleAdmin(req('/api/admin/audit'),env,USER);
body=await data(response);
assert.equal(body.items.length,1);
assert.equal(body.items[0].actor,USER);

// Invalid/unrecognized filters or mutations never return success.
assert.equal((await handleAdmin(req('/api/admin/traffic?days=999'),env,USER)).status,400);
assert.equal((await handleAdmin(req('/api/admin/nope'),env,USER)).status,404);

// External network responses are mocked ONLY in this test, never as production values.
const originalFetch=globalThis.fetch;
let runMode='older';
let jobsMode='complete';
globalThis.fetch=async (url,opts)=>{
 const target=String(url);
 if(target.includes('eai-site-insights?days=30')){
  return Response.json({rows:[
   {day:'2026-11-14',event:'pagina',path:'/nl/',device:'desktop',count:9},
   {day:'2026-11-15',event:'pagina',path:'/tools/abc/',device:'mobiel',count:6},
   {day:'2026-11-15',event:'tool',path:'/tools/abc/',device:'mobiel',count:5},
   {day:'2026-11-15',event:'gelezen',path:'/tools/abc/',device:'mobiel',count:4},
   {day:'2026-11-15',event:'pagina',path:'javascript:alert(1)',device:'desktop',count:200}
  ]});
 }
 if(target.includes('api.github.com/repos/E-AI-MODEL/website/commits/main')){
  return Response.json({sha:'ab'.repeat(20),commit:{message:'Update site\nbody'}});
 }
 if(target.includes('api.github.com/repos/E-AI-MODEL/website/actions/workflows/deploy-theory7.yml/runs')){
  const old={id:123456,status:'completed',conclusion:'success',created_at:'2026-11-15T10:00:00Z',updated_at:'2026-11-15T10:01:00Z',head_sha:'de'.repeat(20)};
  const current={...old,id:123457,head_sha:'ab'.repeat(20)};
  return Response.json({workflow_runs:runMode==='current'?[old,current]:runMode==='none'?[]:[old]});
 }
 if(target.includes('/actions/runs/123456/jobs')||target.includes('/actions/runs/123457/jobs')){
  const head=target.includes('/123457/')?'ab'.repeat(20):'de'.repeat(20);
  const row=(id,name,conclusion)=>({id,name,conclusion,status:'completed',head_sha:head,started_at:'2026-11-15T12:00:00Z'});
  if(jobsMode==='failure')return Response.json({}, {status:403});
  const jobs=[row(1,'release-check / static-checks','success'),row(2,'release-check / build-check / build','success'),row(3,'release-check / topo-check','skipped'),row(4,'deploy','success')];
  if(jobsMode==='mismatch')jobs[0].head_sha='ff'.repeat(20);
  if(jobsMode==='blocked')jobs[0].conclusion='failure';
  return Response.json({total_count:jobsMode==='partial'?jobs.length+1:jobs.length,jobs});
 }
 if(target.startsWith('https://eaimodel.nl/')){
  if(target.endsWith('/tools/anatomie/'))return Response.json({}, {status:503});
  if(target.endsWith('/tools/html-galerij/'))throw Error('Timeout');
  return new Response(null,{status:200});
 }
 throw Error('Unexpected outgoing test URL '+target);
};
try{
 response=await handleAdmin(req('/api/admin/traffic?days=30'),env,USER);
 assert.equal(response.status,200);
 body=await data(response);
 assert.equal(body.events.page,15);
 assert.equal(body.events.tool,5);
 assert.equal(body.events.read,4);
 assert.equal(body.devices.desktop,9);
 assert.equal(body.devices.mobiel,6);
 assert.match(body.note,/geen unieke personen/i);
 assert.ok(!JSON.stringify(body).includes('javascript:alert'));
 response=await handleAdmin(req('/api/admin/health'),env,USER);
 body=await data(response);
 assert.equal(body.pages.length,6);
 assert.equal(body.pages.filter(x=>x.state==='afwijking').length,1);
 assert.equal(body.pages.filter(x=>x.state==='onbekend').length,1);
 response=await handleAdmin(req('/api/admin/deploy'),env,USER);
 body=await data(response);
 assert.equal(body.main.commit,'ab'.repeat(6));
 assert.equal(body.deploy.conclusion,'success');
 assert.equal(body.deploy.matchesMain,false);
 assert.equal(body.deploy.verifiedCurrent,false);
 assert.equal(body.checks.length,3);
 assert.equal(body.checks.find(x=>x.name==='topo-check').conclusion,'skipped');
 assert.ok(body.checksAvailable);
 runMode='current';
 const release=async()=>data(await handleAdmin(req('/api/admin/deploy'),env,USER));
 body=await release();
 assert.equal(body.deploy.id,123457);
 assert.equal(body.deploy.matchesMain,true);
 assert.equal(body.deploy.verifiedCurrent,true);
 assert.equal(body.deploy.publishJob.name,'deploy');
 for(const mode of ['failure','mismatch','partial']){
  jobsMode=mode;body=await release();
  assert.equal(body.checksAvailable,false);
  assert.equal(body.deploy.verifiedCurrent,false);
  assert.deepEqual(body.checks,[]);
 }
 jobsMode='blocked';body=await release();
 assert.equal(body.deploy.verifiedCurrent,false);
 runMode='none';body=await release();
 assert.equal(body.deploy,null);
 assert.equal(body.checksAvailable,false);
}finally{
 globalThis.fetch=originalFetch;
}
// Revoking all sessions requires CSRF protection and is recorded without sensitive data.
assert.equal((await handleAdmin(req('/api/admin/sessions/revoke','POST'),env,USER)).status,403);
response=await handleAdmin(req('/api/admin/sessions/revoke','POST',ORIGIN),env,USER);
assert.equal(response.status,200);
body=await data(response);
assert.equal(body.signedOut,true);
assert.equal(sessions,0);
assert.equal(actions.at(-1).action,'sessions.revoked');
console.log('EAI Beheer: dashboard, source data, security, gallery and audit tests passed.');
