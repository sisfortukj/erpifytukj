# Cara Hosting ERPify di Hostinger (Business Plan)

Situs ERPify sekarang **tidak lagi 100% statis**: data disimpan di database server
(folder `/api`, PHP + MySQL) sehingga perubahan dari panel admin terlihat oleh
semua pengunjung, dan file PDF sertifikat bisa diunggah lewat panel admin.

> Penting: bila backend belum aktif, website **tetap berjalan** seperti versi statis
> (memakai localStorage browser). Jadi Anda bisa menguji bertahap tanpa takut
> website error.

---

## 1. Struktur file yang diunggah

```
public_html/
├── index.html, dosen-anggota.html, matakuliah.html, sertifikat.html,
│   kerjasama.html, berita.html, login.html, admin.html
├── data.js, style.css, Logo ERP.png
├── .htaccess                 <- keamanan dasar (blokir file .sql/.log, dll)
├── api/
│   ├── config.sample.php     <- contoh konfigurasi (JANGAN diubah langsung)
│   ├── setup.php             <- wizard setup database (hapus setelah dipakai)
│   ├── selftest.php          <- halaman diagnostik (hapus setelah semua OK)
│   ├── config.php            <- dibuat otomatis oleh setup.php
│   ├── lib.php, data.php, auth.php, upload.php
├── uploads/                  <- dibuat otomatis saat upload pertama
└── sertifikat/               <- untuk PDF sertifikat cara manual
```

Folder `data/` dan file `api/config.php` yang ada di komputer Anda adalah
**khusus uji lokal** dan tidak perlu diunggah.

---

## 2. Langkah hosting (hPanel Hostinger)

### A. Buat database MySQL
1. Login hPanel > menu **Databases** > **MySQL Databases**.
2. Buat database baru, contoh: `u123456789_erpify` (nama otomatis diberi prefix).
3. Buat user database + password, lalu hubungkan user ke database (All Privileges).
4. Catat 4 data ini: **host** (biasanya `localhost`), **nama database**, **username**, **password**.

### B. Unggah file
1. hPanel > **Files** > **File Manager** > masuk ke `public_html`.
2. Hapus file bawaan (mis. `default.php` / `index.html` bawaan Hostinger).
3. Upload semua file website (bisa berupa ZIP lalu Extract).
4. Pastikan struktur seperti daftar di atas (folder `api/` sejajar dengan `index.html`).

### C. Isi konfigurasi database (pilih salah satu)

**Cara 1 - wizard otomatis (disarankan)**

1. Buka `https://domain-anda.com/api/setup.php`
2. Isi form dengan data dari hPanel (**Databases > MySQL Databases**):
   - Host: `localhost`
   - Nama database: mis. `u123456789_erpify`
   - Username database: mis. `u123456789_erpify`
   - Password database: password user database Anda
   - Username & password admin panel (untuk login di `login.html`)
3. Klik **Uji Koneksi & Simpan Konfigurasi**. Wizard akan menguji koneksi,
   membuat tabel, membuat akun admin, dan **menulis `api/config.php` otomatis**.
4. Setelah sukses: buka `login.html`, lalu **hapus `api/setup.php`** dari server.

**Cara 2 - manual**

1. Di File Manager, buka folder `api` > klik kanan `config.sample.php` > **Copy** >
   beri nama `config.php` (nama harus persis `config.php`).
2. Edit `config.php`, isi bagian database:
   ```php
   'db_driver' => 'mysql',
   'db_host'   => 'localhost',
   'db_name'   => 'u123456789_erpify',
   'db_user'   => 'u123456789_erpify',
   'db_pass'   => 'password_database_anda',
   ```
3. Simpan. Tabel database akan **dibuat otomatis** saat pertama kali diakses
   (tidak perlu import SQL manual).

### D. Jalankan pengecekan otomatis
Buka di browser: `https://domain-anda.com/api/selftest.php`

Semua baris harus berstatus **OK**. Contoh masalah & solusinya:

| Status | Penyebab & solusi |
|---|---|
| **Access denied for user 'u000000000_erpify'@'localhost' (error 1045)** | `api/config.php` belum ada / masih berisi data contoh, sehingga server memakai `config.sample.php`. Buka `api/setup.php` lalu isi data database yang benar, atau buat `api/config.php` manual (langkah C cara 2). |
| Pesan "File api/config.php belum ada di server" | Sama seperti di atas - jalankan `api/setup.php`. |
| Pesan "Kredensial di api/config.php masih memakai contoh" | `db_name`/`db_user` di `config.php` masih `u000000000_erpify`; ganti dengan nama asli dari hPanel. |
| Koneksi database GAGAL | Nama DB/user/password salah, atau host bukan `localhost` |
| config.php belum ada | Ulangi langkah C (nama file harus `config.php`) |
| Folder upload tidak dapat ditulis | Set izin folder `uploads` menjadi **755** |
| Ekstensi pdo_mysql belum aktif | hPanel > **Advanced** > **PHP Configuration** > aktifkan `pdo_mysql` |

Setelah semua OK, **hapus `api/selftest.php`** (opsional, demi keamanan).

### E. Login & ganti password
1. Buka `https://domain-anda.com/login.html`.
2. Login awal: username `admin`, password `erpify123` (sesuai `default_admin_pass` di config).
3. **Segera ganti password** dari menu admin (ikon kunci) - password disimpan
   sebagai hash (bcrypt) di database, bukan lagi teks biasa di `data.js`.

### F. Mengaktifkan tombol "Lihat Sertifikat (PDF)"
Ada dua cara:

**Cara 1 - lewat panel admin (disarankan)**
1. Login admin > menu **Sertifikasi** > tombol pensil (Edit) pada data mahasiswa.
2. Pada kolom **File PDF Sertifikat**, klik **Choose File** dan pilih PDF-nya.
3. File otomatis tersimpan di `uploads/sertifikat/` dan kolom link terisi.
4. Klik **Simpan**. Tombol akan muncul di halaman `sertifikat.html` saat
   kode sertifikat tersebut dicek pengunjung.

**Cara 2 - upload manual (tanpa panel)**
1. Beri nama file sesuai kode sertifikat: `SAP-2026-0001.pdf`.
2. Upload ke folder `sertifikat/` di `public_html`.
3. Biarkan kolom PDF di panel admin kosong - sistem otomatis mencari
   `sertifikat/<KODE>.pdf`. Tombol hanya muncul jika file benar-benar ada.

---

## 3. Setelah deploy - hal yang perlu diperiksa

1. `test-frontend.html` - halaman uji cepat: pastikan semua bertanda **PASS**.
2. Tambah 1 data di panel admin, lalu buka website di **browser/jendela lain
   (mode incognito)** - data baru harus terlihat (bukti data tersimpan di server).
3. Cek halaman sertifikat: cari kode `SAP-2026-0001`, tombol PDF muncul bila file ada.
4. Isi hero subjudul di menu **Pengaturan** - judul di halaman publik ikut berubah.

---

## 4. Troubleshooting umum

| Gejala | Solusi |
|---|---|
| Data tidak berubah untuk pengunjung | Pastikan `config.php` sudah benar dan `api/selftest.php` semua OK |
| Pesan "Sesi admin berakhir" | Session server habis; login ulang di `login.html` |
| Upload foto/PDF gagal | Cek izin folder `uploads` (755) dan ekstensi file (jpg/png/webp/pdf, maks 8 MB) |
| Website blank setelah edit admin | Buka Console browser (F12); muat ulang halaman |
| Ingin kembali ke mode statis | Kosongkan `ERPIFY_API_URL` di `data.js` (ubah menjadi `''`) atau hapus folder `api` |
| Data lama (localStorage) masih terlihat | Data itu hanya cadangan lokal; setelah admin menyimpan sekali, data server jadi acuan |

---

## 5. Keamanan yang sudah diterapkan

- Password admin disimpan sebagai hash `password_hash()` + verifikasi `password_verify()`.
- Login memakai **session PHP** (`HttpOnly`, `SameSite=Lax`, `secure` bila HTTPS).
- Semua query database memakai **prepared statement** (anti SQL injection).
- Upload divalidasi ekstensi + ukuran, dan folder `uploads` memblokir eksekusi file PHP.
- `api/config.php` tidak menampilkan apa pun saat diakses langsung dari browser.
- Header `X-ERPify` pada setiap request POST sebagai proteksi CSRF sederhana.
