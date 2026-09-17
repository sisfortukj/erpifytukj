# Todo List - Perbaikan & Tambahan Fitur Website ERPify

Status: **SELESAI** - semua item Bagian 1-5 sudah ada di kode dan sudah diverifikasi,
ditambah Bagian 6 (backend dinamis untuk hosting Hostinger).

## Bagian 1: Perubahan Halaman Website (Frontend)
- [x] 1.1 Perbaiki Navbar: Gabung "Mata Kuliah" & "Sertifikat SAP" jadi dropdown "Mata Kuliah & Sertifikasi"
- [x] 1.2 Halaman Kerjasama: Tambah statistik jumlah mitra di hero + card mitra
- [x] 1.3 Halaman Berita: Modal popup detail berita saat klik "Selengkapnya"
- [x] 1.4 Halaman Sertifikat: Detail lengkap + info pembayaran + error handling

## Bagian 2: Perubahan & Tambahan Halaman Admin
- [x] 2.1 Dashboard Admin: Statistik card + grafik bulanan
- [x] 2.2 Modal Form Create/Update untuk semua data
- [x] 2.3 Upload Foto untuk Dosen, Anggota, Berita, Sertifikasi
- [x] 2.4 Menu "Pengaturan Halaman" untuk edit subjudul hero
- [x] 2.5 Halaman "Data Sertifikasi" dengan tabel lengkap + import/export

## Bagian 3: Update data.js
- [x] 3.1 Restruktur data untuk mendukung fitur baru (foto, pdf, subjudul, sertifikat detail)
- [x] 3.2 Fungsi CRUD dengan modal untuk semua entitas
- [x] 3.3 Fungsi dashboard statistik
- [x] 3.4 Fungsi import/export Excel/CSV
- [x] 3.5 Fungsi berita modal
- [x] 3.6 Fungsi pengaturan halaman

## Bagian 4: Update style.css
- [x] 4.1 Style dropdown navbar
- [x] 4.2 Style modal popup
- [x] 4.3 Style dashboard admin
- [x] 4.4 Style tabel sertifikasi
- [x] 4.5 Style upload foto
- [x] 4.6 Style statistik kerjasama

## Bagian 5: Update Semua Halaman HTML
- [x] 5.1 Update navbar di semua halaman (index, matakuliah, sertifikat, kerjasama, dosen-anggota, berita, admin)
- [x] 5.2 Update footer di semua halaman
- [x] 5.3 Update halaman kerjasama.html
- [x] 5.4 Update halaman berita.html
- [x] 5.5 Update halaman sertifikat.html
- [x] 5.6 Update halaman admin.html

## Bagian 6: Backend Dinamis untuk Hostinger (Business Plan)
- [x] 6.1 API PHP + MySQL: api/lib.php, api/data.php, api/auth.php, api/upload.php, api/selftest.php, api/config.sample.php
- [x] 6.2 Data bersama antar pengunjung (tidak lagi hanya localStorage) + fallback otomatis bila backend belum aktif
- [x] 6.3 Login admin server-side (session PHP + password_hash), ganti password, logout
- [x] 6.4 Upload file ke server (folder uploads/) untuk foto dosen, anggota, berita, dan sertifikat
- [x] 6.5 Keamanan: .htaccess, blokir eksekusi PHP di folder upload, prepared statement, header penanda CSRF
- [x] 6.6 Tombol "Lihat Sertifikat (PDF)" di halaman sertifikat + kolom link/upload PDF di panel admin
- [x] 6.7 Dokumentasi deploy README-HOSTINGER.md + halaman uji api/selftest.php dan test-frontend.html
- [x] 6.8 Wizard api/setup.php (isi database + uji koneksi + tulis config.php otomatis) dan pesan error konfigurasi yang jelas (menggantikan error SQL mentah)

## Catatan Teknis
- Foto & PDF sertifikat disimpan sebagai URL file di server (folder `uploads/`), bukan lagi data URL di localStorage.
- Bila `api/config.php` belum diisi, website otomatis jalan dalam mode statis (localStorage) - tidak error.
- Import/Export CSV & Excel tetap memakai 9 kolom; kolom foto dan PDF tidak diekspor agar file tidak membengkak.
- Konvensi PDF tanpa panel admin: simpan file dengan nama `<KODE>.pdf` di folder `sertifikat/`.

