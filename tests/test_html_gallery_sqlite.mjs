// Integration test: actual SQLite constraints and transactions, synthetic data only.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from '../services/html-galerij/src/index.js';

const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../services/html-galerij/schema.sql',import.meta.url),'utf8'));
const DB={
  prepare(sql){
    const statement=db.prepare(sql);
    const bound=(args)=>({
      first:async()=>statement.get(...args)??null,
      all:async()=>({results:statement.all(...args)}),
      run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})
    });
    return {...bound([]),bind:(...args)=>bound(args)};
  },
  async batch(statements){
    db.exec('BEGIN');
    try { const results=[]; for(const s of statements)results.push(await s.run()); db.exec('COMMIT');return results; }
    catch(err){db.exec('ROLLBACK');throw err;}
  }
};
const BASE='https://synthetic-gallery.test';
const email='test@example.test',password=randomBytes(24).toString('base64url'),salt=randomBytes(24);
const env={DB,GALLERY_ADMIN_EMAIL:email,GALLERY_PASSWORD_HASH:'pbkdf2_sha256$100000$'+salt.toString('base64')+'$'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64'),RATE_LIMIT_SALT:randomBytes(32).toString('hex')};
let cookie='';
async function call(path,method='GET',body,auth=true,origin=BASE){
  const headers=new Headers({'Origin':origin});
  if(auth&&cookie)headers.set('Cookie',cookie);
  return worker.fetch(new Request(BASE+path,{method,headers,body}),env);
}
const total=(table)=>Number(db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n);
const status=(id)=>db.prepare('SELECT status FROM uploads WHERE id=?').get(id)?.status;
const audit=()=>db.prepare('SELECT action FROM site_admin_audit ORDER BY id').all().map(x=>x.action);
const form=()=>{const data=new FormData();data.set('title','Synthetic integration test');data.set('author','Test runner');data.set('file',new File(['<!doctype html><html><body>Test only</body></html>'],'test.html',{type:'text/html'}));return data;};
try{
  assert.equal((await call('/api/uploads','POST',form(),false)).status,401);
  assert.equal(total('uploads'),0);
  let r=await call('/auth/login','POST',new URLSearchParams({email,password}),false);
  assert.equal(r.status,303);
  cookie=r.headers.get('Set-Cookie').split(';')[0];
  assert.equal(total('gallery_sessions'),1);
  assert.equal((await call('/api/uploads','POST',form(),true,'https://other.example')).status,403);
  r=await call('/api/uploads','POST',form());assert.equal(r.status,201);
  const id=(await r.json()).id;assert.equal(status(id),'published');
  assert.equal(total('uploads'),1);assert.deepEqual(audit(),['upload.published']);
  assert.equal((await call('/view/'+id,'GET',undefined,false)).status,401);
  r=await call('/view/'+id);assert.equal(r.status,200);
  assert.match(r.headers.get('Content-Security-Policy'),/sandbox allow-scripts/);
  assert.ok(!r.headers.get('Content-Security-Policy').includes('allow-same-origin'));
  const hide='/api/admin/uploads/'+id,restore='/api/admin/files/'+id+'/restore';
  assert.equal((await call(hide,'DELETE',undefined,false)).status,401);
  db.exec("CREATE TRIGGER test_block BEFORE UPDATE OF status ON uploads WHEN NEW.status='hidden' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  assert.equal((await call(hide,'DELETE')).status,503);
  assert.equal(status(id),'published');assert.deepEqual(audit(),['upload.published']);
  db.exec('DROP TRIGGER test_block');
  assert.equal((await call(hide,'DELETE')).status,200);
  assert.equal(status(id),'hidden');assert.equal((await call('/view/'+id)).status,404);
  assert.equal((await call(hide,'DELETE')).status,404);
  assert.equal((await call(restore,'POST',undefined,false)).status,401);
  assert.equal((await call(restore,'POST',undefined,true,'https://other.example')).status,403);
  assert.equal((await call(restore,'POST')).status,200);
  assert.equal(status(id),'published');
  assert.equal((await call(restore,'POST')).status,404);
  assert.equal((await call('/view/'+id)).status,200);
  assert.deepEqual(audit(),['upload.published','upload.hidden','upload.restored']);
  assert.equal((await call('/auth/logout','POST')).status,303);
  assert.equal(total('gallery_sessions'),0);
  assert.equal((await call('/view/'+id)).status,401);
  console.log('SQLite integration passed: login, upload, sandbox, hide, restore, rollback, audit, logout.');
}finally{db.close();}
