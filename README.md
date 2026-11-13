# STIFIn Mulia: Ruang Belajar

Platform belajar anggota dengan persetujuan admin, WSL 1, katalog WSL 2, dan 16 slot WSL tematik.

STIFIn Genetic Indonesia · Cabang Kabupaten Pekalongan. Kantor operasional: Jatinangor. WhatsApp 081333362649 · cs@stifinmulia.com.

## Isi paket

- Pendaftaran nama, email, WhatsApp dan kata sandi.
- Akun baru berstatus menunggu. Admin harus menyetujui sebelum materi terbuka.
- Persetujuan pertama dari status menunggu otomatis memberi WSL 1.
- Admin bisa menolak, menonaktifkan, serta memberi/mencabut izin per kelas.
- Enam modul WSL 1; 50 soal sumber, 33 aktif dan 17 draf. Pembahasan dan workbook terlindungi login/izin.
- Penilaian dihitung server; hasil dan progres tersimpan per akun di SQLite.
- Dashboard admin menampilkan progres serta hasil nyata anggota.
- WSL 2 dan 16 kelas tematik belum berisi materi. Nama tematik bersifat slot bernomor.
- Kunci jawaban masih usulan pembelajaran. Tidak ada sertifikat atau pengangkatan promotor otomatis.

## Kebutuhan

Satu server dengan Docker dan Docker Compose, atau Node.js 24 untuk menjalankan tanpa Docker. Satu instance aplikasi dengan satu volume database lokal. SQLite dipilih agar instalasi tidak memerlukan layanan database terpisah. Bukan konfigurasi untuk banyak replika aplikasi.

Logo yang dipakai berasal dari papan identitas yang diberikan, ditampilkan melalui potongan tampilan CSS. Ganti dengan berkas logo transparan asli bila tersedia. Warna: #043F2B, #527FA3, #B94A48. Font memakai fallback lokal; tidak mengunduh font pihak ketiga otomatis.

## A. GitHub ke Coolify (disarankan: Dockerfile)

1. Ekstrak ZIP. Letakkan isi paket langsung pada akar repositori, sehingga `Dockerfile`, `compose.yaml`, `package.json` dan folder `selfhost` terlihat di root. Jangan meletakkan ZIP saja di repositori.
2. Gunakan repositori privat untuk kode yang menyertakan workbook. Izin akses web tidak menyembunyikan berkas di repositori GitHub publik. Hubungkan melalui integrasi GitHub App/deploy key yang tersedia pada Coolify Anda.
3. Jika repositori yang sudah Anda pilih adalah `muhamadsofyanar/branchmanager`, masukkan isi paket ke repositori itu setelah memeriksa berkas yang sudah ada. Paket ini belum di-push ke GitHub Anda.
4. Di Coolify, pilih Application dari Git. Pilih **Dockerfile** sebagai Build Pack, bukan Railpack atau Static. Base Directory `/`, Dockerfile Location `/Dockerfile`.
5. Isi **Ports Exposes: 3000**. Atur domain HTTPS, misalnya `https://belajar.stifinmulia.com` (contoh, bukan domain yang sudah dipasang otomatis).
6. Tambahkan runtime environment variables berikut. Tidak ada build command atau install command tambahan.

| Variabel | Nilai |
|---|---|
| APP_URL | URL HTTPS persis situs Anda, tanpa path. Contoh `https://belajar.stifinmulia.com` |
| ADMIN_EMAIL | Email admin awal, misalnya `cs@stifinmulia.com` |
| ADMIN_PASSWORD | Kata sandi buatan Anda, minimal 12 karakter; sebaiknya 20+ acak |
| COOKIE_SECURE | `true` |
| DATABASE_PATH | `/data/mulia.sqlite` |
| PORT | `3000` |
| TRUST_PROXY | `true` hanya jika akses masuk melalui reverse proxy Coolify dan port container tidak dibuka langsung |

7. **Sebelum deploy**, buat Persistent Storage berupa volume yang dipasang ke **`/data`**. Seluruh akun, izin, progres, dan hasil berada di sana. Jangan hanya menyimpan pada filesystem sementara container. Direktori harus dapat ditulis UID/GID `1000:1000` (user `node`). Named volume baru biasanya mengikuti kepemilikan direktori image.
8. Atur health check GET `/healthz`, port 3000. Deploy. Tunggu status sehat lalu buka domain.
9. Masuk menggunakan admin awal. Uji daftar anggota, persetujuan, serta akses WSL 1 dari akun anggota.

Pesan pada screenshot Anda, “No Dockerfile or Compose file found”, akan teratasi setelah `Dockerfile` diunggah ke root branch yang dibaca Coolify. Gunakan Scan Again setelah push selesai. Rate-limit Git provider adalah pemberitahuan terpisah dari berkas Dockerfile yang belum ada.

Referensi resmi: https://coolify.io/docs/applications/builds/dockerfile dan https://coolify.io/docs/applications/configuration/persistent-storage.

### Jika memilih Docker Compose di Coolify

`compose.yaml` bawaan ditujukan untuk instalasi manual dengan reverse proxy lokal. Untuk Coolify Compose, gunakan `compose.coolify.yaml`, pilih file itu sebagai Compose Location, lalu tentukan domain untuk service `app` port 3000. File tersebut memakai `expose` dan volume bernama, tanpa memublikasikan port host. Isi environment yang sama pada Coolify. Jangan menambahkan mount kedua ke `/data`.

## B. Instalasi manual dengan Docker Compose

Ekstrak paket ke direktori server, misalnya `stifin-mulia`, lalu jalankan di direktori tersebut:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose logs --tail=100 app
```

Isi APP_URL, ADMIN_EMAIL dan ADMIN_PASSWORD sebelum menjalankan. Gunakan HTTPS pada reverse proxy Nginx/Caddy/Traefik yang mengarah ke `127.0.0.1:3000`. Compose hanya mengikat port host pada loopback. Jangan menambahkan port publik jika trafik seharusnya melalui reverse proxy.

Untuk uji coba pada komputer sendiri saja, isi:

```dotenv
APP_URL=http://localhost:3000
COOKIE_SECURE=false
```

Buka URL itu persis. `localhost` dan `127.0.0.1` merupakan origin berbeda. Produksi wajib HTTPS dan `COOKIE_SECURE=true`.

## C. Manual tanpa Docker

Gunakan Node.js 24. Tidak ada dependency npm eksternal yang perlu diinstal.

```bash
cp .env.example .env
nano .env
mkdir -p data
# Atur DATABASE_PATH=./data/mulia.sqlite di .env untuk cara ini.
node --env-file=.env selfhost/server.js
```

Gunakan process manager/systemd agar aplikasi hidup kembali setelah restart server. Tempatkan di belakang reverse proxy HTTPS. Jangan menggunakan perintah server preview statis untuk aplikasi ini: kontrol akun berada di `selfhost/server.js`.

## Cara admin bekerja

1. Masuk sebagai admin, buka **Admin**.
2. Filter **Menunggu persetujuan**, periksa nama/email/WhatsApp.
3. Klik **Setujui anggota**. Persetujuan pertama dari status pending memberi WSL 1.
4. Buka **Izin kelas dan hasil belajar** untuk memberi/mencabut kelas atau melihat nilai.
5. **Nonaktifkan akses** memblokir semua materi walaupun sesi pengguna masih aktif.
6. Jika mengaktifkan kembali akun ditolak/dinonaktifkan, periksa izin kelas secara manual. Tidak ada izin otomatis baru pada proses aktivasi ulang tersebut.

WSL 2/tematik belum dapat dibuka karena materinya belum tersedia. Memberi izin lebih awal tidak menciptakan materi.

Data kontak dan hasil anggota hanya tersedia bagi anggota itu sendiri serta admin. Pendaftaran tidak mengirim email/WhatsApp otomatis. Peserta dapat masuk dan menekan **Periksa status terbaru**. Pemulihan kata sandi belum menggunakan email otomatis; admin memakai perintah di bawah.

## Admin awal dan pemulihan kata sandi

ADMIN_EMAIL dan ADMIN_PASSWORD hanya membuat admin saat email tersebut belum ada. Mengubah environment tidak menimpa kata sandi akun yang sudah dibuat. Jangan gunakan email anggota biasa sebagai ADMIN_EMAIL. Tidak ada kata sandi bawaan.

Untuk reset admin atau anggota melalui Compose, jalankan di terminal Bash. Kata sandi dibaca dari stdin, bukan argumen proses:

```bash
read -r -s -p 'Kata sandi baru: ' MULIA_NEW_PASSWORD
echo
printf '%s' "$MULIA_NEW_PASSWORD" | docker compose exec -T app node selfhost/manage.js reset-password cs@stifinmulia.com
unset MULIA_NEW_PASSWORD
```

Ganti alamat email sesuai akun. Semua sesi akun yang direset dicabut. Pada terminal container Coolify, jalankan perintah Node yang sama dengan kata sandi lewat stdin; jangan tempelkan kata sandi ke argumen perintah. Sesuaikan ADMIN_PASSWORD di environment setelah pemulihan agar pengelola tidak menyimpan nilai lama.

## Backup dan restore

Persistent volume bukan pengganti backup. Buat salinan SQLite konsisten dengan perintah berikut; gunakan nama baru setiap kali:

```bash
docker compose exec app node selfhost/manage.js backup /data/backup-2026-11-13.sqlite
mkdir -p backups
docker compose cp app:/data/backup-2026-11-13.sqlite ./backups/
```

Simpan backup di lokasi terpisah dan batasi akses karena memuat data anggota. Perintah `VACUUM INTO` membuat snapshot konsisten saat aplikasi berjalan. Jangan hanya menyalin file `.sqlite` aktif karena ada WAL.

Restore dilakukan saat aplikasi berhenti:

```bash
docker compose stop app
docker compose cp ./backups/backup-2026-11-13.sqlite app:/data/mulia.sqlite
docker compose run --rm --user root --entrypoint sh app -c 'rm -f /data/mulia.sqlite-wal /data/mulia.sqlite-shm && chown 1000:1000 /data/mulia.sqlite'
docker compose up -d app
```

Pastikan backup yang dipilih benar dan buat snapshot kondisi lama terlebih dahulu. Restore mengganti seluruh akun dan hasil dengan isi backup. Untuk Coolify gunakan snapshot konsisten lewat `manage.js` lalu unduh berkas dari volume dengan akses server Anda.

## Pembaruan

Backup dahulu. Setelah perubahan source di-push, deploy ulang melalui Coolify dengan volume `/data` yang sama. Instalasi manual: `git pull` (jika menggunakan Git) lalu `docker compose up -d --build`. Jangan menjalankan `docker compose down -v` karena menghapus volume data.

## Mengubah materi dan soal

Sumber materi ada di `selfhost/private/content.js`, workbook di `selfhost/private/workbook.pdf`. Status `draft` dan kunci `null` membuat soal tidak masuk penilaian. `ready` berarti aktif untuk latihan, bukan persetujuan resmi BM. Perubahan soal jangan dilakukan ketika peserta memiliki sesi ujian aktif. Simpan nomor soal unik dan jangan mengubah arti nomor pada riwayat yang sudah digunakan.

Materi WSL 2/tematik memerlukan konten dan implementasi rute kelasnya; katalog saat ini hanya tempat penyediaan kelas berikutnya. Bukan fitur unggah kursus otomatis.

## Pemeriksaan

```bash
node --test selfhost/server.test.js
node --check selfhost/public/app.js
```

Pengujian mencakup akun pending, pemblokiran workbook, izin admin, persetujuan, server grading, pencabutan akses dan penyimpanan lintas restart. Jalankan uji tampilan dan uji alur nyata pada staging sebelum digunakan banyak peserta.

Jika login/pendaftaran mendapat kesalahan asal situs, periksa APP_URL. Jika cookie tidak tersimpan, periksa HTTPS/COOKIE_SECURE. Jika database tidak dapat dibuka, periksa mount `/data` dan kepemilikan 1000:1000. Jika login dibatasi, tunggu 15 menit.

### Reverse proxy dan pembatasan percobaan

Default `TRUST_PROXY=false` memakai alamat koneksi langsung. Di belakang Coolify/proxy, set `TRUST_PROXY=true` agar pembatasan tidak menggabungkan semua peserta sebagai satu IP. Aplikasi memakai alamat valid paling kanan dari `X-Forwarded-For`, untuk satu proxy tepercaya yang menambahkan alamat pengunjung sebenarnya. Proxy harus mengganti/menambahkan header dengan benar dan port aplikasi tidak boleh dapat diakses langsung dari internet. Untuk topologi beberapa proxy/CDN, sesuaikan aturan header pada proxy terdepan yang terhubung ke aplikasi sebelum mengaktifkan kepercayaan ini.
