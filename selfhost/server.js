import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFileSync,mkdirSync,createReadStream} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {modules,questions} from './private/content.js';
import {eligible,grade,shuffle} from './private/engine.js';
const scrypt=promisify(scryptCallback),here=dirname(fileURLToPath(import.meta.url));
export async function passwordHash(password){let salt=randomBytes(16).toString('hex');return salt+':'+Buffer.from(await scrypt(password,salt,64)).toString('hex');}
export async function passwordMatches(password,stored){let [salt,hex]=stored.split(':');let result=Buffer.from(await scrypt(password,salt,64));let target=Buffer.from(hex,'hex');return target.length===result.length&&timingSafeEqual(result,target);}
const digest=s=>createHash('sha256').update(s).digest('hex');
const publicUser=u=>u?({id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,status:u.status,createdAt:u.created_at}):null;
const catalog=[{id:'wsl1',title:'WSL 1',subtitle:'Dasar STIFIn dan penerapannya',available:true}, {id:'wsl2',title:'WSL 2',subtitle:'Materi sedang disiapkan',available:false},...Array.from({length:16},(_,i)=>({id:'tematik'+(i+1),title:'WSL Tematik '+String(i+1).padStart(2,'0'),subtitle:'Topik dan materi belum ditetapkan',available:false}))];
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HttpError(status,message);};
export function clientAddress(req,trustProxy){const forwarded=String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim();return trustProxy&&isIP(forwarded)?forwarded:req.socket.remoteAddress;}
export function createApp({databasePath,adminEmail,adminPassword,origin,secureCookies=true,trustProxy=false}){
 if(!databasePath||!adminEmail||!adminPassword||adminPassword.length<12)throw Error('Isi DATABASE_PATH, ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 12 karakter).');
 origin=new URL(origin).origin;if(secureCookies&&!origin.startsWith('https://'))throw Error('APP_URL produksi harus memakai HTTPS.');
 mkdirSync(dirname(databasePath),{recursive:true});let db=new DatabaseSync(databasePath);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,phone TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member',status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS enrollments(user_id INTEGER REFERENCES users(id),course TEXT NOT NULL,PRIMARY KEY(user_id,course));
 CREATE TABLE IF NOT EXISTS progress(user_id INTEGER PRIMARY KEY REFERENCES users(id),completed TEXT NOT NULL DEFAULT '[]',notes TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),course TEXT NOT NULL,mode TEXT NOT NULL,module INTEGER,ids TEXT NOT NULL,answers TEXT,created_at TEXT NOT NULL,submitted_at TEXT,result TEXT);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER,action TEXT,target INTEGER,created_at TEXT NOT NULL);
 `);
 // Bootstrap is awaited before requests are accepted. Existing accounts are never overwritten.
 const ready=(async()=>{let email=adminEmail.trim().toLowerCase();let admin=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!admin){db.prepare('INSERT INTO users(name,email,phone,password,role,status,created_at) VALUES(?,?,?,?,?,?,?)').run('Administrator STIFIn Mulia',email,'',await passwordHash(adminPassword),'admin','approved',new Date().toISOString());}else if(admin.role!=='admin')throw Error('ADMIN_EMAIL sudah dipakai anggota. Gunakan alamat admin berbeda.');})();
 let rates=new Map();
 function throttle(key,max){let now=Date.now();if(rates.size>10000)for(let [k,v]of rates)if(v.until<now)rates.delete(k);if(rates.size>20000)fail(429,'Server sibuk. Coba lagi nanti.');let row=rates.get(key);if(!row||row.until<now){row={count:0,until:now+15*60*1000};rates.set(key,row);}if(++row.count>max)fail(429,'Terlalu banyak percobaan. Tunggu 15 menit.');}
 function userFor(req){let token=req.headers.cookie?.match(/(?:^|;\s*)mulia_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;return db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(digest(token),Date.now())||null;}
 function requireUser(req){let u=userFor(req);if(!u)fail(401,'Silakan masuk terlebih dahulu.');return u;}
 function requireAdmin(req){let u=requireUser(req);if(u.role!=='admin')fail(403,'Akses hanya untuk admin.');return u;}
 function hasAccess(u,course){return u.role==='admin'||(u.status==='approved'&&!!db.prepare('SELECT 1 FROM enrollments WHERE user_id=? AND course=?').get(u.id,course));}
 function requireCourse(req,course){let u=requireUser(req);if(!hasAccess(u,course))fail(403,'Akses kelas belum diberikan atau akun belum disetujui.');return u;}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Gunakan format JSON.');let chunks=[],size=0;for await(let chunk of req){size+=chunk.length;if(size>32768)fail(413,'Data terlalu besar.');chunks.push(chunk);}try{let b=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'Data tidak valid.');if(req.url.startsWith('/api/admin/'))requireAdmin(req);else if(req.url.startsWith('/api/progress')||req.url.startsWith('/api/attempts'))requireCourse(req,'wsl1');return b;}catch(e){if(e instanceof HttpError)throw e;fail(400,'Data JSON tidak valid.');}}
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 function audit(actor,action,target){db.prepare('INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)').run(actor,action,target,new Date().toISOString());}
 const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 try{await ready;let path=new URL(req.url,'http://localhost').pathname,method=req.method;
 if(method==='POST'&&req.headers.origin!==origin)fail(403,'Permintaan harus berasal dari situs ini.');
 if(path==='/healthz'&&method==='GET'){db.prepare('SELECT 1').get();return json(res,200,{ok:true});}
 if(path==='/api/me'&&method==='GET')return json(res,200,{user:publicUser(userFor(req))});
 if(path==='/api/register'&&method==='POST'){
 throttle('register:'+clientAddress(req,trustProxy),20);let b=await body(req);let name=typeof b.name==='string'?b.name.trim():'',email=typeof b.email==='string'?b.email.trim().toLowerCase():'',phone=typeof b.phone==='string'?b.phone.trim():'';
 if(name.length<2||name.length>100||email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\+?[0-9 ()-]{8,25}$/.test(phone)||typeof b.password!=='string'||b.password.length<12||b.password.length>128)fail(400,'Isi nama, email, nomor WhatsApp, dan kata sandi 12–128 karakter dengan benar.');
 if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'Email sudah terdaftar. Silakan masuk atau hubungi admin.');
 let h=await passwordHash(b.password);let r;try{r=db.prepare('INSERT INTO users(name,email,phone,password,created_at) VALUES(?,?,?,?,?)').run(name,email,phone,h,new Date().toISOString());}catch{fail(409,'Email sudah terdaftar.');}return json(res,201,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid))});
 }
 if(path==='/api/login'&&method==='POST'){
 let b=await body(req),email=typeof b.email==='string'?b.email.trim().toLowerCase():'';throttle('login-ip:'+clientAddress(req,trustProxy),100);throttle('login-email:'+email,15);
 if(typeof b.password!=='string'||b.password.length>128)fail(400,'Email atau kata sandi tidak valid.');let u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 let matches=await passwordMatches(b.password,u?.password||'00000000000000000000000000000000:'+('00'.repeat(64)));if(!u||!matches)fail(401,'Email atau kata sandi salah.');
 db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());let token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),u.id,Date.now()+7*86400000);
 res.setHeader('Set-Cookie',`mulia_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookies?'; Secure':''}`);return json(res,200,{user:publicUser(u)});
 }
 if(path==='/api/logout'&&method==='POST'){let token=req.headers.cookie?.match(/mulia_session=([a-f0-9]{64})/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie',`mulia_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return json(res,200,{ok:true});}
 if(path==='/api/courses'&&method==='GET'){let u=requireUser(req);return json(res,200,{courses:catalog.map(c=>({...c,access:hasAccess(u,c.id)}))});}
 if(path==='/api/courses/wsl1'&&method==='GET'){requireCourse(req,'wsl1');return json(res,200,{modules,questions:eligible(questions).map(({key,explanation,status,...q})=>q),activeCount:eligible(questions).length,draftCount:questions.filter(q=>q.status==='draft').length});}
 if(path==='/api/progress'&&method==='GET'){let u=requireCourse(req,'wsl1'),p=db.prepare('SELECT * FROM progress WHERE user_id=?').get(u.id);let attempts=db.prepare('SELECT id,mode,module,submitted_at,result FROM attempts WHERE user_id=? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC').all(u.id).map(a=>({id:a.id,mode:a.mode,module:a.module,date:a.submitted_at,...JSON.parse(a.result)}));return json(res,200,{completed:p?JSON.parse(p.completed):[],notes:p?.notes||'',attempts});}
 if(path==='/api/progress'&&method==='POST'){let u=requireCourse(req,'wsl1'),b=await body(req);if(!Array.isArray(b.completed)||b.completed.length>6||b.completed.some(n=>!Number.isInteger(n)||n<1||n>6)||typeof(b.notes??'')!=='string'||(b.notes||'').length>4000)fail(400,'Progres atau catatan tidak valid.');db.prepare('INSERT INTO progress(user_id,completed,notes) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET completed=excluded.completed,notes=excluded.notes').run(u.id,JSON.stringify([...new Set(b.completed)]),b.notes||'');return json(res,200,{ok:true});}
 if(path==='/api/attempts'&&method==='POST'){let u=requireCourse(req,'wsl1'),b=await body(req);if(b.course!=='wsl1'||!['exam','practice'].includes(b.mode)||(b.mode==='practice'&&(!Number.isInteger(b.module)||b.module<1||b.module>6)))fail(400,'Pilihan latihan tidak valid.');let qs=shuffle(eligible(questions).filter(q=>b.mode==='exam'||q.module===b.module));let id=randomBytes(16).toString('hex');db.prepare('INSERT INTO attempts(id,user_id,course,mode,module,ids,created_at) VALUES(?,?,?,?,?,?,?)').run(id,u.id,'wsl1',b.mode,b.mode==='practice'?b.module:null,JSON.stringify(qs.map(q=>q.id)),new Date().toISOString());return json(res,201,{id,mode:b.mode,questions:qs.map(q=>({id:q.id,text:q.text,options:shuffle(q.options.map((text,id)=>({text,id})))}))});}
 let check=path.match(/^\/api\/attempts\/([a-f0-9]{32})\/(check|submit)$/);
 if(check&&method==='POST'){let u=requireCourse(req,'wsl1'),a=db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(check[1],u.id);if(!a)fail(404,'Latihan tidak ditemukan.');if(a.submitted_at)fail(409,'Latihan sudah dikumpulkan.');let b=await body(req),ids=JSON.parse(a.ids),qs=ids.map(id=>questions.find(q=>q.id===id));
 if(check[2]==='check'){if(a.mode!=='practice')fail(403,'Pembahasan evaluasi tersedia setelah dikumpulkan.');let q=qs.find(q=>q.id===b.question);if(!q||!Number.isInteger(b.answer)||b.answer<0||b.answer>3)fail(400,'Pilih jawaban yang valid.');return json(res,200,{correct:b.answer===q.key,key:q.key,explanation:q.explanation,page:q.page});}
 if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers))fail(400,'Jawaban belum lengkap.');requireCourse(req,'wsl1');let result;try{result=grade(qs,b.answers);}catch{fail(400,'Jawaban belum lengkap. Isi seluruh soal.');}let date=new Date().toISOString();let updated=db.prepare('UPDATE attempts SET answers=?,submitted_at=?,result=? WHERE id=? AND submitted_at IS NULL').run(JSON.stringify(b.answers),date,JSON.stringify(result),a.id);if(updated.changes!==1)fail(409,'Latihan sudah dikumpulkan.');return json(res,200,{...result,date,review:qs.map(q=>({id:q.id,module:q.module,text:q.text,answer:q.options[b.answers[q.id]],correctAnswer:q.options[q.key],correct:b.answers[q.id]===q.key,explanation:q.explanation,page:q.page}))});
 }
 if(path==='/api/admin/users'&&method==='GET'){requireAdmin(req);return json(res,200,{users:db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(u=>({...publicUser(u),enrollments:db.prepare('SELECT course FROM enrollments WHERE user_id=?').all(u.id).map(e=>e.course),completed:JSON.parse(db.prepare('SELECT completed FROM progress WHERE user_id=?').get(u.id)?.completed||'[]'),attempts:db.prepare('SELECT mode,module,submitted_at,result FROM attempts WHERE user_id=? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC').all(u.id).map(a=>({mode:a.mode,module:a.module,date:a.submitted_at,...JSON.parse(a.result)}))})),courses:catalog});}
 if(path==='/api/admin/questions'&&method==='GET'){requireAdmin(req);return json(res,200,{questions});}
 let adminPath=path.match(/^\/api\/admin\/users\/(\d+)(\/enrollments)?$/);
 if(adminPath&&method==='POST'){let actor=requireAdmin(req),target=Number(adminPath[1]),u=db.prepare('SELECT * FROM users WHERE id=?').get(target);if(!u||u.role==='admin')fail(400,'Akun admin tidak dapat diubah melalui menu anggota.');let b=await body(req);
 if(adminPath[2]){if(!catalog.some(c=>c.id===b.course)||typeof b.grant!=='boolean')fail(400,'Izin kelas tidak valid.');if(b.grant)db.prepare('INSERT OR IGNORE INTO enrollments VALUES(?,?)').run(target,b.course);else db.prepare('DELETE FROM enrollments WHERE user_id=? AND course=?').run(target,b.course);audit(actor.id,(b.grant?'grant:':'revoke:')+b.course,target);}
 else{if(!['approved','rejected','suspended','pending'].includes(b.status))fail(400,'Status tidak valid.');db.exec('BEGIN');try{db.prepare('UPDATE users SET status=? WHERE id=?').run(b.status,target);if(b.status==='approved'&&u.status==='pending')db.prepare('INSERT OR IGNORE INTO enrollments VALUES(?,?)').run(target,'wsl1');audit(actor.id,'status:'+b.status,target);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}return json(res,200,{ok:true});}
 if(path==='/workbook.pdf'&&method==='GET'){requireCourse(req,'wsl1');res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Workbook-WSL1.pdf"'});createReadStream(join(here,'private/workbook.pdf')).pipe(res);return;}
 const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/base.css':'base.css','/style.css':'style.css','/brand-board.png':'brand-board.png'};
 if(method==='GET'&&assets[path]){let file=assets[path],mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html';let content=readFileSync(join(here,'public',file));res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});res.end(content);return;}
 fail(404,'Halaman tidak ditemukan.');
 }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Terjadi gangguan server. Silakan coba lagi.'});else res.end();if(!e.status)console.error('Request error:',e.message);}
 });
 return {server,close:()=>db.close(),ready};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createApp({databasePath:process.env.DATABASE_PATH||'/data/mulia.sqlite',adminEmail:process.env.ADMIN_EMAIL,adminPassword:process.env.ADMIN_PASSWORD,origin:process.env.APP_URL,secureCookies:process.env.COOKIE_SECURE!=='false',trustProxy:process.env.TRUST_PROXY==='true'});
 await app.ready;const port=Number(process.env.PORT||3000);app.server.listen(port,'0.0.0.0',()=>console.log(`STIFIn Mulia listening on ${port}`));process.on('SIGTERM',()=>app.server.close(()=>{app.close();process.exit(0);}));
}
