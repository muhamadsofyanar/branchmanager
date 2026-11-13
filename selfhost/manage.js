import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {passwordHash} from './server.js';
let database=process.env.DATABASE_PATH||'/data/mulia.sqlite';
if(!existsSync(database))throw Error('Database belum ada. Jalankan aplikasi dahulu.');
const db=new DatabaseSync(database);db.exec('PRAGMA busy_timeout=5000');
try{
 const [command,arg]=process.argv.slice(2);
 if(command==='reset-password'){
  if(!arg)throw Error('Gunakan: reset-password email; kirim kata sandi baru melalui stdin.');
  let password=readFileSync(0,'utf8').trimEnd();if(password.length<12||password.length>128)throw Error('Kata sandi harus 12–128 karakter.');
  let user=db.prepare('SELECT id FROM users WHERE email=?').get(arg.trim().toLowerCase());if(!user)throw Error('Email tidak ditemukan.');
  let hash=await passwordHash(password);db.exec('BEGIN');try{db.prepare('UPDATE users SET password=? WHERE id=?').run(hash,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}console.log('Kata sandi diperbarui. Semua sesi akun ini telah dicabut.');
 }else if(command==='backup'){
  if(!arg)throw Error('Gunakan: backup /data/backup.sqlite');let target=resolve(arg);if(existsSync(target))throw Error('Berkas tujuan sudah ada. Gunakan nama baru.');db.prepare('VACUUM INTO ?').run(target);console.log('Backup database selesai.');
 }else throw Error('Perintah: reset-password email | backup /data/nama.sqlite');
}finally{db.close();}
