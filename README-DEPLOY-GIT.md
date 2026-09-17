# Deploy ERPify dengan Git (disarankan)

Dokumen ini menjelaskan cara mengubah kode website dengan aman: **edit di komputer →
push ke GitHub → tarik ke Hostinger**, supaya tidak perlu lagi meng-upload file
satu per satu (cara manual itulah yang tadi menyebabkan `api/lib.php` terhapus).

---

## 1. Kenapa Git lebih baik untuk proyek ini

| | Upload manual (sekarang) | Git (GitHub) |
|---|---|---|
| Risiko lupa/terhapus file | tinggi (pernah kejadian `lib.php`) | rendah, daftar file pasti |
| Riwayat perubahan | tidak ada | semua versi tersimpan |
| Kembali ke versi lama | sulit | satu perintah (`git revert` / `git checkout`) |
| Ganti nama domain/hosting | upload ulang semua | clone/pull |
| Data konten (berita, sertifikat) | tetap aman (di MySQL server) | tetap aman (di MySQL server) |

Catatan penting: **data konten TIDAK masuk Git** — berita, anggota, sertifikat,
foto dan PDF tersimpan di database MySQL + folder `uploads/` milik server.
Git hanya menyimpan **kode** (HTML, CSS, JS, PHP).

---

## 2. Yang tidak boleh ikut ke GitHub

Sudah diatur otomatis di file `.gitignore`:

- `api/config.php` → berisi password database (dibuat langsung di server)
- `uploads/**` → foto/PDF yang di-upload lewat panel admin
- `data/` → database SQLite untuk uji lokal
- arsip (`*.zip`, `*.log`), `.DS_Store`, serta file lama yang tidak dipakai
  (`WebsiteERPify.html`, `admin copy.html`)

---

## 3. Langkah awal (sekali saja)

### 3.1 Buat repository GitHub

1. Buka GitHub → **New repository** → nama mis. `erpify-lab` → pilih **Private** → Create.
2. Di komputer, jalankan di folder proyek ini:

```bash
git remote add origin https://github.com/USERNAME-ANDA/erpify-lab.git
git push -u origin main
```

### 3.2 Pilih cara menarik kode ke Hostinger

**Cara A - fitur Git di hPanel (paling praktis, bila tersedia di plan Anda)**
1. hPanel → cari menu **Advanced → Git** (atau **Git Version Control**).
2. Isi URL repository GitHub (repo private: sertakan Personal Access Token),
   pilih branch `main`, arahkan ke folder `public_html`.
3. Klik **Deploy/Create**. Bila tersedia opsi **auto-deploy/webhook**, aktifkan
   supaya setiap `git push` langsung ikut ter-deploy.

**Cara B - SSH (plan Business sudah menyediakan SSH)**
```bash
ssh -p 65002 u546035153@IP_SERVER_ANDA
cd ~/domains/lightslategray-cat-708888.hostingersite.com/public_html
git init -b main
git remote add origin https://github.com/USERNAME-ANDA/erpify-lab.git
git fetch origin
git reset --hard origin/main      # samakan isi folder dengan repo
```
Berikutnya, setiap mau update cukup:
```bash
cd ~/domains/lightslategray-cat-708888.hostingersite.com/public_html && git pull
```

**Cara C - tanpa Git di server (paling sederhana, tetap aman)**
1. Push ke GitHub dari komputer.
2. Di GitHub: **Code → Download ZIP**.
3. File Manager Hostinger → upload ZIP ke `public_html` → klik kanan → **Extract**
   (pilih overwrite bila ditanya). File konfigurasi & folder upload tetap aman
   karena tidak ada di dalam ZIP.

---

## 4. Rutinitas saat Anda mengubah website

```bash
# 1. lihat perubahan yang dilakukan
git status

# 2. simpan perubahan
git add -A
git commit -m "Perbaiki tampilan navbar"

# 3. kirim ke GitHub
git push
```

Lalu lakukan deploy: hPanel Git → **Deploy** (Cara A), atau `git pull` via SSH
(Cara B), atau download ZIP (Cara C).

---

## 5. Hal yang harus selalu dijaga

- **Jangan hapus** di `public_html`: `api/config.php`, folder `uploads/`,
  folder `sertifikat/` (isinya data nyata milik server, bukan bagian repo).
- Setiap kali mengubah kode PHP di folder `api/`, uji dulu di komputer
  (opsional, bila ada PHP) atau langsung cek `api/selftest.php` setelah deploy.
- Setelah semuanya stabil, hapus `api/selftest.php` dan `api/setup.php` dari server.
- Ganti password admin dari panel (ikon kunci), jangan pakai password default.

---

## 6. Kalau ada yang salah (rollback)

```bash
git log --oneline           # lihat daftar commit
git revert <kode-commit>    # batalkan satu perubahan
git push                    # kirim koreksinya
```
lalu deploy ulang seperti langkah 4.
