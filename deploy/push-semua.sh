#!/bin/sh
# ============================================================
# ERPify - kirim kode ke SEMUA remote yang terdaftar
# (mis. origin = GitHub, hostinger = push langsung via SSH)
# Pakai:  sh deploy/push-semua.sh
# ============================================================
set -e

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Folder ini bukan repository git."
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "==> Ada perubahan yang belum di-commit. Menyimpan dulu..."
    PESAN="${1:-Update website ERPify}"
    git add -A
    git commit -m "$PESAN"
fi

REMOTE_LIST="$(git remote)"
if [ -z "$REMOTE_LIST" ]; then
    echo "Belum ada remote. Jalankan dulu salah satu:"
    echo "  sh deploy/connect-github.sh https://github.com/USERNAME/NAMA-REPO.git"
    echo "  git remote add hostinger ssh://u546035153@HOST:65002/home/u546035153/erpify.git"
    exit 1
fi

for R in $REMOTE_LIST; do
    echo "==> Push ke remote: $R"
    git push "$R" main
done

echo "==> Semua remote selesai. Cek tab Actions di GitHub bila memakai auto-deploy."
