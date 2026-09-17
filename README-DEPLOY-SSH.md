# Deploy ERPify LANGSUNG dari komputer ke Hostinger (tanpa GitHub)

Cara ini memakai **SSH** (tersedia di plan Business/Cloud Hostinger). Hasilnya:
`git push hostinger main` dari VS Code/terminal → file di `public_html` **langsung
terupdate**, tanpa GitHub, tanpa upload manual.

> Pilih salah satu: kalau Anda ingin ada cadangan + riwayat di cloud, tetap pakai
> GitHub (README-DEPLOY-GIT.md). Kalau ingin yang paling sedikit langkah, pakai cara ini.

---

## 1. Aktifkan SSH di hPanel

1. hPanel → **Advanced → SSH Access** (kadang bernama *SSH Keys* / *SSH Connection*)
2. Aktifkan SSH, lalu catat:
   - **Host/IP**: mis. `145.xx.xx.xx` atau `srv123.hstgr.io`
   - **Port**: biasanya **65002**
   - **Username**: `u546035153`
3. Masukkan **public SSH key** Anda (opsional tapi disarankan supaya tidak perlu
   mengetik password terus). Bila belum punya key, jalankan di komputer:
   ```bash
   ssh-keygen -t ed25519 -C "erpify"
   # lalu copy isi ~/.ssh/id_ed25519.pub ke kolom SSH Public Key di hPanel
   ```

Uji koneksi:
```bash
ssh -p 65002 u546035153@HOST_ANDA
```

## 2. Buat "repositori kosong" di server (sekali saja)

Jalankan **di server** (setelah login SSH):

```bash
mkdir -p ~/erpify.git && cd ~/erpify.git
git init --bare
mkdir -p hooks
```

Lalu buat file `~/erpify.git/hooks/post-receive` (isi bisa disalin dari file
`deploy/post-receive` di proyek ini) dan beri izin jalan:

```bash
chmod +x ~/erpify.git/hooks/post-receive
```

Cek dulu nama folder domain Anda:
```bash
ls ~/domains/
```
Sesuaikan baris `TARGET=` di dalam hook bila perlu.

## 3. Daftarkan remote di komputer (sekali saja)

Di folder proyek `ERPify`:

```bash
git remote add hostinger ssh://u546035153@HOST_ANDA:65002/home/u546035153/erpify.git
git push hostinger main
```

Setelah itu, **setiap update cukup**:

```bash
git add -A
git commit -m "Ubah tampilan halaman kerjasama"
git push hostinger main
```

dan file di `public_html` otomatis diperbarui (keluar pesan
`==> Deploy ERPify ke: ...` / `==> Selesai ...`).

---

## 4. Yang tetap aman / tidak tersentuh

| Bagian | Status |
|---|---|
| `api/config.php` (kredensial DB) | ✅ tidak tersentuh (tidak ada di repo) |
| `uploads/` (foto & PDF hasil upload admin) | ✅ tidak tersentuh |
| `data/` (SQLite uji lokal) | ✅ tidak tersentuh |
| Isi database MySQL (berita, sertifikat, dll) | ✅ tidak tersentuh |
| File kode (HTML, CSS, JS, PHP di `api/`) | 🔄 diperbarui sesuai repo |

## 5. Hal yang perlu diingat

- **Jangan mengedit file kode langsung di server** (lewat File Manager), karena
  push berikutnya akan menimpanya. Semua perubahan kode lakukan di komputer.
- **Rollback** bila ada kesalahan:
  ```bash
  git revert <kode-commit>
  git push hostinger main
  ```
  atau kembali total ke versi tertentu:
  ```bash
  git checkout <kode-commit>
  git push hostinger main --force
  ```
- Kalau muncul pesan error saat push (`! [rejected] ... fetch first`), berarti ada
  commit di server yang belum ada di komputer:
  ```bash
  git fetch hostinger && git merge hostinger/main
  ```
- Setelah semua stabil, hapus `api/selftest.php` dan `api/setup.php` **sekaligus
  dari repo** (supaya tidak ikut ter-deploy lagi):
  ```bash
  git rm api/selftest.php api/setup.php && git commit -m "Hapus file diagnosa" && git push hostinger main
  ```
