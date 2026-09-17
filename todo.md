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

## Bagian 7: Permintaan Perubahan Lanjutan
- [x] 7.1 Cek sertifikat memakai **NIM** (bukan kode unik); satu NIM bisa punya banyak sertifikat dan ditampilkan sebagai kartu terpisah
- [x] 7.2 Tombol **Unduh Sertifikat** di samping tombol Lihat Sertifikat (PDF)
- [x] 7.3 Upload foto kini lewat jendela **atur posisi/zoom (crop)** sebelum disimpan (dosen, anggota, sertifikat, cover berita)
- [x] 7.4 Form mahasiswa: pilih **Dosen** & **Asprak** dengan tampilan **Kode - Nama** + menu Asprak baru di admin
- [x] 7.5 Mitra: tambah **logo** per mitra (upload + tampil di halaman Kerjasama)
- [x] 7.6 Info kontak: YouTube `@erpifyTelUJkt`, email `erpify.telujkt@gmail.com`, alamat Telkom University Jakarta, nomor telepon dihapus
- [x] 7.7 Perbaikan menu **Pengaturan** admin (drag & drop yang tidak berfungsi diganti pengaturan subjudul yang benar-benar tersimpan)
- [x] 7.8 Migrasi otomatis data lama (mitra teks -> objek, kode dosen, daftar asprak, field kode pembimbing)

## Bagian 8: Penyesuaian Lanjutan (revisi permintaan)
- [x] 8.1 Asprak bukan menu terpisah - kode asprak menjadi atribut mahasiswa (anggota); menu & modal Asprak dihapus
- [x] 8.2 Kode asprak otomatis unik per anggota (`ASP-01`, ...) + pengaman anti-duplikat saat migrasi data lama
- [x] 8.3 Sertifikasi: field **kode sertifikasi** & **foto** dihapus, **NIM jadi acuan utama**
- [x] 8.4 Menu Sertifikasi admin dikelompokkan per mahasiswa (NIM - Nama) dengan tombol **Tambah Sertifikat** per NIM
- [x] 8.5 "Jenis Sertifikasi" menjadi **Nama Sertifikat** (satu NIM bisa punya banyak sertifikat: nilai, status kelayakan, status pengambilan, file PDF)
- [x] 8.6 Halaman cek sertifikat: cukup masukkan NIM, semua sertifikat tampil rapi sebagai kartu dengan tombol Lihat & Unduh
- [x] 8.7 Import/Export/Template CSV & Excel memakai NIM sebagai kolom pertama (format lama 9 kolom tetap didukung)

## Bagian 9: Perbaikan Import/Export & Pengelompokan Tabel
- [x] 9.1 Template & Export Excel memakai file **.xlsx asli** (SheetJS) sehingga tidak ada peringatan format saat dibuka di Excel; ada cadangan CSV bila pustaka belum termuat
- [x] 9.2 Import tetap mendukung .xlsx/.xls/.csv format baru (NIM kolom pertama) maupun format lama 9 kolom
- [x] 9.3 Tabel Sertifikasi admin diurutkan per **NIM** sehingga sertifikat baru langsung muncul tepat di bawah mahasiswa yang sama
- [x] 9.4 Baris lanjutan (mahasiswa sama) diberi penanda `↳` + warna latar berbeda agar mudah terlihat

## Bagian 10: Perbaikan Form Sertifikasi (penomoran & daftar lengkap)
- [x] 10.1 Nomor baris form mengikuti sertifikat ke-berapa (`Sertifikat #1`, `#2`, `#3`, ...) dan otomatis dirapikan saat baris dihapus
- [x] 10.2 Membuka data mahasiswa menampilkan **SEMUA** sertifikatnya di form (bukan satu) + satu baris kosong untuk menambah sertifikat baru
- [x] 10.3 Mengetik NIM yang sudah terdaftar otomatis memuat seluruh sertifikat mahasiswa tersebut ke form
- [x] 10.4 Simpan: baris yang sudah ada **diperbarui** (via index baris), baris baru **ditambahkan**, baris yang dibuang dari form **dihapus** (dengan konfirmasi)

## Catatan Teknis
- Foto & PDF sertifikat disimpan sebagai URL file di server (folder `uploads/`), bukan lagi data URL di localStorage.
- Bila `api/config.php` belum diisi, website otomatis jalan dalam mode statis (localStorage) - tidak error.
- Import/Export CSV & Excel tetap memakai 9 kolom; kolom foto dan PDF tidak diekspor agar file tidak membengkak.
- Konvensi PDF tanpa panel admin: simpan file dengan nama `<KODE>.pdf` di folder `sertifikat/`.

