#!/bin/sh
# ============================================================
# ERPify - hubungkan folder ini ke repository GitHub Anda
# Pakai:
#   sh deploy/connect-github.sh https://github.com/USERNAME/erpify-lab.git
# ============================================================
set -e

URL="$1"
if [ -z "$URL" ]; then
    echo "Pakai: sh deploy/connect-github.sh https://github.com/USERNAME/NAMA-REPO.git"
    exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Folder ini bukan repository git. Jalankan dulu: git init -b main"
    exit 1
fi

if git remote | grep -q '^origin$'; then
    echo "==> Mengubah remote 'origin' menjadi: $URL"
    git remote set-url origin "$URL"
else
    echo "==> Menambahkan remote 'origin': $URL"
    git remote add origin "$URL"
fi

echo "==> Mengirim kode ke GitHub (branch main)..."
git push -u origin main

cat <<'CATATAN'

=== SELESAI. Langkah berikutnya (sekali saja) ===

1. Buat akun FTP di hPanel:
   Files > FTP Accounts > Create new FTP account
   Catat: FTP host, username, password.

2. Buka repository di GitHub:
   Settings > Secrets and variables > Actions > New repository secret
   Tambahkan 3 secret berikut:
     FTP_SERVER    = host FTP dari hPanel
     FTP_USERNAME  = username FTP
     FTP_PASSWORD  = password FTP

3. Selesai! Setiap "git push" ke branch main akan otomatis
   meng-upload kode ke Hostinger (lihat tab Actions di GitHub).
   Cek juga menu Actions > Deploy ERPify ke Hostinger > apakah hijau/berhasil.

CATATAN
