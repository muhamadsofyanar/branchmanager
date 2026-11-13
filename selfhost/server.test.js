import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp,clientAddress} from './server.js';
import http from 'node:http';
test('forwarded client address is trusted only when configured',()=>{const req={headers:{'x-forwarded-for':'1.2.3.4, 5.6.7.8'},socket:{remoteAddress:'127.0.0.1'}};assert.equal(clientAddress(req,false),'127.0.0.1');assert.equal(clientAddress(req,true),'5.6.7.8');req.headers['x-forwarded-for']='invalid';assert.equal(clientAddress(req,true),'127.0.0.1');});

test('membership, protected lessons, admin grants, server grading and persistence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mulia-')); const databasePath=join(dir,'db.sqlite');
 let app=createApp({databasePath,adminEmail:'admin@example.test',adminPassword:'Test-Admin-Passphrase-42',origin:'http://localhost',secureCookies:false});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+app.server.address().port;
 async function request(path,method='GET',body,cookie=''){let r=await fetch(base+path,{method,headers:{'content-type':'application/json',origin:'http://localhost',cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try{
 assert.equal((await request('/')).status,200);
 assert.match((await request('/')).data,/STIFIn Mulia/);
 assert.equal((await request('/app.js')).status,200);
 assert.equal((await request('/workbook.pdf')).status,401);
 assert.equal((await request('/content.js')).status,404);
 assert.equal((await request('/api/courses')).status,401);
 let reg=await request('/api/register','POST',{name:'Peserta Uji',email:'learner@example.test',phone:'081234567890',password:'Learner-Passphrase-42'});
 assert.equal(reg.status,201);let user=reg.data.user;assert.equal(user.status,'pending');
 let login=await request('/api/login','POST',{email:'learner@example.test',password:'Learner-Passphrase-42'});let cookie=login.cookie;
 assert.equal((await request('/api/courses/wsl1','GET',undefined,cookie)).status,403);
 assert.equal((await request('/workbook.pdf','GET',undefined,cookie)).status,403);
 assert.equal((await request('/api/admin/users','GET',undefined,cookie)).status,403);
 let admin=await request('/api/login','POST',{email:'admin@example.test',password:'Test-Admin-Passphrase-42'});assert.equal(admin.status,200);
 assert.equal((await request('/api/admin/users/'+user.id,'POST',{status:'approved'},admin.cookie)).status,200);
 let courses=await request('/api/courses','GET',undefined,cookie);assert.equal(courses.data.courses.length,18);assert.equal(courses.data.courses.find(c=>c.id==='wsl1').access,true);
 let course=await request('/api/courses/wsl1','GET',undefined,cookie);assert.equal(course.data.modules.length,6);assert.equal(course.data.questions.some(q=>'key' in q),false);
 let practice=await request('/api/attempts','POST',{mode:'practice',module:1,course:'wsl1'},cookie);let first=practice.data.questions[0];assert.equal((await request('/api/attempts/'+practice.data.id+'/check','POST',{question:first.id,answer:0},cookie)).status,200);
 let exam=await request('/api/attempts','POST',{mode:'exam',course:'wsl1'},cookie);assert.equal(exam.status,201);
 assert.equal((await request('/api/attempts/'+exam.data.id+'/check','POST',{question:exam.data.questions[0].id,answer:0},cookie)).status,403);
 let incomplete=await request('/api/attempts/'+exam.data.id+'/submit','POST',{answers:{}},cookie);assert.equal(incomplete.status,400);
 let answers=Object.fromEntries(exam.data.questions.map(q=>[q.id,0]));
 let submitted=await request('/api/attempts/'+exam.data.id+'/submit','POST',{answers,score:100},cookie);assert.equal(submitted.status,200);assert.equal(submitted.data.total,33);assert.ok(submitted.data.score<100);
 assert.equal((await request('/api/attempts/'+exam.data.id+'/submit','POST',{answers},cookie)).status,409);
 let concurrent=await request('/api/attempts','POST',{mode:'exam',course:'wsl1'},cookie);
 const slow=()=>{let req;const result=new Promise((resolve,reject)=>{req=http.request(base+'/api/attempts/'+concurrent.data.id+'/submit',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost',cookie}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.write('{');});return {req,result};};
 let one=slow(),two=slow();await new Promise(r=>setTimeout(r,30));let payload=JSON.stringify({answers:Object.fromEntries(concurrent.data.questions.map(q=>[q.id,0]))});one.req.end(payload.slice(1));two.req.end(payload.slice(1));assert.deepEqual((await Promise.all([one.result,two.result])).sort(),[200,409]);
 assert.equal((await request('/api/progress','POST',{completed:[1,2]},cookie)).status,200);
 assert.equal((await request('/api/progress','GET',undefined,cookie)).data.attempts.length,2);
 assert.equal((await request('/api/admin/users/'+user.id+'/enrollments','POST',{course:'wsl1',grant:false},admin.cookie)).status,200);
 assert.equal((await request('/api/courses/wsl1','GET',undefined,cookie)).status,403);
 assert.equal((await request('/api/admin/users/'+user.id+'/enrollments','POST',{course:'wsl1',grant:true},admin.cookie)).status,200);
 let heldRequest;let heldResult=new Promise((resolve,reject)=>{heldRequest=http.request(base+'/api/progress',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost',cookie}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});heldRequest.on('error',reject);heldRequest.write('{');});await new Promise(r=>setTimeout(r,30));
 assert.equal((await request('/api/admin/users/'+user.id,'POST',{status:'suspended'},admin.cookie)).status,200);
 heldRequest.end('"completed":[1]}');assert.equal(await heldResult,403);
 assert.equal((await request('/api/courses/wsl1','GET',undefined,cookie)).status,403);
 let csrf=await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json',origin:'https://other.test'},body:'{}'});assert.equal(csrf.status,403);
 await new Promise(r=>app.server.close(r));app.close();
 app=createApp({databasePath,adminEmail:'admin@example.test',adminPassword:'Different-Password-42',origin:'http://localhost',secureCookies:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
 assert.equal((await request('/api/login','POST',{email:'admin@example.test',password:'Test-Admin-Passphrase-42'})).status,200);
 let persisted=await request('/api/login','POST',{email:'learner@example.test',password:'Learner-Passphrase-42'});assert.equal(persisted.data.user.status,'suspended');
 }finally{await new Promise(r=>app.server.close(r));app.close();rmSync(dir,{recursive:true,force:true});}
});
