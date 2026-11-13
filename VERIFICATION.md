# Pemeriksaan paket STIFIn Mulia

## Terverifikasi

- Node 24: syntax server, public app, CLI recovery.
- Seluruh suite: 12 test lulus, termasuk satu alur HTTP integrasi dengan banyak assertion.
- Pendaftaran pending tidak membuka kelas, workbook, bank kunci, atau admin.
- Persetujuan admin memberi WSL1. 18 entri katalog: WSL1, WSL2, 16 tematik.
- Grade dihitung server; kolom score kiriman klien diabaikan. Jawaban tidak lengkap ditolak.
- Submit bersamaan hanya menerima satu hasil. Pengiriman ulang mendapat 409.
- Permintaan yang ditahan sebelum akun dinonaktifkan ditolak setelah body diterima.
- Pencabutan izin memblokir sesi yang masih login.
- Akun, status dan hasil bertahan setelah server dibuat ulang dengan database yang sama.
- Proxy header hanya dipercaya jika dikonfigurasi eksplisit.
- Pemeriksaan kode terpisah menemukan dan memperbaiki race submit, izin pada request tertunda, dan IP reverse proxy.
- Paket hanya membawa kode selfhost, asset branding, materi privat, konfigurasi dan dokumentasi. Tidak membawa database pengguna, .env, token, .git, atau pratinjau lama yang menyajikan materi publik.

## Batas pemeriksaan

- Docker CLI tidak tersedia di lingkungan pembuatan; image belum dibangun/dijalankan di sini.
- Browser QA tidak dilakukan: pratinjau managed mengalami relay unavailable. Respons HTTP shell/assets dan API sudah diuji, tetapi layout ponsel, pemotongan logo CSS, serta interaksi browser perlu diperiksa pada staging.
- Belum di-push ke GitHub pengguna dan belum dideploy ke server Coolify pengguna.

## Keputusan implementasi

SQLite terpusat dipilih menggantikan usulan layanan PostgreSQL terpisah agar instalasi cukup satu service dan satu volume. Gunakan satu instance aplikasi. SMTP dan notifikasi WhatsApp belum terhubung. Pemulihan sandi menggunakan CLI admin. Dua kelas utama dan 16 slot tematik tersedia pada katalog, tetapi materi baru hanya WSL1. Tidak ada klaim sertifikasi atau pengangkatan promotor otomatis.

## Pemeriksaan desain

Kode memakai forest #043F2B, dusty blue #527FA3 dan red #B94A48 dari acuan; logo memakai gambar asli melalui viewport CSS. Kontrol native, label input, fokus keyboard, skip link dan tema terang/gelap disiapkan. Tidak ada pengguna, testimoni atau statistik yang dikarang. Pemeriksaan visual dan klik langsung masih belum terverifikasi.
