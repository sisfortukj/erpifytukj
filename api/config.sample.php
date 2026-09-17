<?php
/**
 * ERPify - konfigurasi API (contoh)
 *
 * CARA PAKAI:
 * 1. Salin file ini menjadi config.php  (nama file harus persis: config.php)
 * 2. Isi kredensial database dari hPanel Hostinger:
 *    hPanel > Databases > MySQL Databases  ->  buat database + user
 * 3. Sesuaikan default_admin_pass, lalu simpan.
 *
 * CATATAN: file config.php hanya dibaca oleh PHP di server, tidak bisa diunduh
 * dari browser (tidak menghasilkan output apa pun bila diakses langsung).
 */

return [
    // ===== DATABASE =====
    // 'mysql'  = untuk Hostinger (produksi)
    // 'sqlite' = untuk uji coba lokal di komputer sendiri
    'db_driver'  => 'mysql',

    'db_host'    => 'localhost',
    'db_name'    => 'u000000000_erpify',
    'db_user'    => 'u000000000_erpify',
    'db_pass'    => 'PASSWORD_DATABASE_ANDA',
    'db_charset' => 'utf8mb4',

    // Khusus db_driver = sqlite (uji lokal)
    'sqlite_path' => __DIR__ . '/../data/erpify.sqlite',

    // ===== AKUN ADMIN AWAL =====
    // Dipakai HANYA saat pertama kali tabel admin masih kosong.
    // Segera ganti password dari panel admin setelah website online.
    'default_admin_user' => 'admin',
    'default_admin_pass' => 'erpify123',

    // ===== UPLOAD =====
    'upload_dir'    => __DIR__ . '/../uploads',
    'upload_url'    => 'uploads/',
    'max_upload_mb' => 8,

    // ===== SESSION =====
    'session_name' => 'erpify_sid',
];
