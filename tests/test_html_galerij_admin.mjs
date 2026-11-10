import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../services/html-galerij/src/index.js';

const markup=readFileSync(new URL('../tools/html-galerij/index.html',import.meta.url),'utf8');
const script=markup.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script,'inline gallery script');
new Function(script[1]); // Syntax only, no browser execution
for(const text of ['id="secret-entrance"','id="gallery-management-status"',
                   'class="hero"','editorial-row','card-delete','taps===3',
                   'deleteMode','removeUpload','window.confirm','adminKey=']){
 assert.ok(markup.includes(text),text);
}
assert.ok(!markup.includes('id="admin-panel"'),'no separate admin popup');


const id='1762800000000-11111111-1111-4111-8111-111111111111';
let status='published';
let attempt=0;
const DB={
 prepare(sql){
  return {bind(...args){
   return {
    async first(){
     if(sql.includes('INSERT INTO upload_limits'))return {count:++attempt};
     if(sql.includes('SELECT html_content'))return status==='published'?{html_content:'<!doctype html><html></html>'}:null;
     throw new Error('Unexpected first query: '+sql);
    },
    async run(){
     if(sql.includes("UPDATE uploads SET status = 'hidden'")){
      const changes=status==='published'&&args[0]===id?1:0;
      if(changes)status='hidden';
      return {meta:{changes}};
     }
     throw new Error('Unexpected run query: '+sql);
    },
    async all(){
     if(sql.includes('SELECT id, title, author'))return {results:status==='published'?[{id,title:'Voorbeeld',author:'Maker',filename:'test.html'}]:[]};
     throw new Error('Unexpected all query: '+sql);
    }
   };
  }};
 }
};
const secret='a'.repeat(48);
const env={DB,ADMIN_DELETE_KEY:secret,ALLOWED_ORIGIN:'https://eaimodel.nl'};
const origin='https://eaimodel.nl';
const url='https://eai-html-galerij.vis-c9d.workers.dev';
const req=(route,method='GET',token=null,from=origin)=>{
 const headers={Origin:from,'CF-Connecting-IP':'203.0.113.9'};
 if(token!==null)headers.Authorization='Bearer '+token;
 return new Request(url+route,{method,headers});
};
let r=await worker.fetch(req('/api/admin/session'),env);
assert.equal(r.status,401,'no credential denied');
r=await worker.fetch(req('/api/admin/session','GET','incorrect'),env);
assert.equal(r.status,401,'wrong credential denied');
r=await worker.fetch(req('/api/admin/session','GET',secret,'https://other.example'),env);
assert.equal(r.status,403,'wrong origin denied');
r=await worker.fetch(req('/api/admin/session','GET',secret),{DB,ALLOWED_ORIGIN:origin});
assert.equal(r.status,401,'missing secret denied');
r=await worker.fetch(req('/api/admin/session','GET',secret),env);
assert.equal(r.status,200,'correct credential accepted');
r=await worker.fetch(new Request(url+'/view/'+id),env);
assert.equal(r.status,200);
assert.equal(r.headers.get('Cache-Control'),'no-store','uploaded HTML must not remain cached after deletion');
r=await worker.fetch(req('/api/admin/uploads/'+id,'DELETE','wrong'),env);
assert.equal(r.status,401,'wrong password cannot hide');
assert.equal(status,'published');
r=await worker.fetch(req('/api/admin/uploads/'+id,'DELETE',secret),env);
assert.equal(r.status,200,'authenticated soft deletion');
assert.equal(status,'hidden');
r=await worker.fetch(req('/api/uploads'),env);
assert.deepEqual((await r.json()).items,[],'hidden entry is absent from public gallery');
r=await worker.fetch(new Request(url+'/view/'+id),env);
assert.equal(r.status,404,'hidden HTML is no longer accessible');
r=await worker.fetch(req('/api/admin/uploads/'+id,'DELETE',secret),env);
assert.equal(r.status,404,'repeat delete has no effect');
r=await worker.fetch(req('/api/admin/uploads/'+id,'OPTIONS'),env);
assert.equal(r.status,204,'preflight works');
assert.match(r.headers.get('Access-Control-Allow-Headers')||'',/Authorization/);
console.log('Gallery UI script parses and admin routes enforce authorization, origin and soft delete');
