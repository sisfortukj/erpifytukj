<?php
/**
 * ERPify - endpoint upload file (foto & PDF sertifikat)
 * Wajib login admin. Menerima multipart/form-data:
 *   - file     : berkas yang diunggah (jpg, jpeg, png, webp, gif, pdf)
 *   - category : folder tujuan, contoh "sertifikat", "berita", "dosen", "anggota"
 *
 * Balasan: { ok, url, fileName, size }
 */

require __DIR__ . '/lib.php';

erpify_require_post();
erpify_require_admin();

if (empty($_FILES['file'])) {
    erpify_fail('Tidak ada file yang dikirim.');
}

$file = $_FILES['file'];
$error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
if ($error !== UPLOAD_ERR_OK) {
    $pesan = [
        UPLOAD_ERR_INI_SIZE   => 'Ukuran file melebihi batas server (upload_max_filesize).',
        UPLOAD_ERR_FORM_SIZE  => 'Ukuran file melebihi batas form.',
        UPLOAD_ERR_PARTIAL    => 'Upload terputus, silakan coba lagi.',
        UPLOAD_ERR_NO_FILE    => 'Tidak ada file yang dipilih.',
        UPLOAD_ERR_NO_TMP_DIR => 'Folder sementara server tidak tersedia.',
        UPLOAD_ERR_CANT_WRITE => 'Server gagal menulis file.',
        UPLOAD_ERR_EXTENSION  => 'Upload dihentikan oleh ekstensi PHP.',
    ];
    erpify_fail(isset($pesan[$error]) ? $pesan[$error] : 'Upload gagal (kode ' . $error . ').');
}

$config = erpify_config();
$maxMb = isset($config['max_upload_mb']) ? (float) $config['max_upload_mb'] : 8.0;
if ($maxMb > 0 && (int) $file['size'] > (int) ($maxMb * 1024 * 1024)) {
    erpify_fail('Ukuran file melebihi ' . $maxMb . ' MB.');
}

$category = isset($_POST['category']) ? (string) $_POST['category'] : 'umum';
$category = preg_replace('/[^a-zA-Z0-9_-]/', '', $category);
if ($category === '' || $category === null) {
    $category = 'umum';
}

$originalName = isset($file['name']) ? (string) $file['name'] : 'file';
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'];
if (!in_array($ext, $allowed, true)) {
    erpify_fail('Jenis file tidak diizinkan. Jenis yang diterima: ' . implode(', ', $allowed) . '.');
}

$baseDir = isset($config['upload_dir']) ? rtrim((string) $config['upload_dir'], '/') : rtrim(__DIR__ . '/../uploads', '/');
$targetDir = $baseDir . '/' . $category;
if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true)) {
    erpify_fail('Folder upload tidak dapat dibuat. Periksa izin folder "uploads".', 500);
}
if (!is_writable($targetDir)) {
    erpify_fail('Folder upload tidak dapat ditulis. Ubah izin folder menjadi 755.', 500);
}

$acak = function_exists('random_bytes') ? bin2hex(random_bytes(4)) : substr(md5(uniqid('', true)), 0, 8);
$safeName = $category . '_' . date('Ymd_His') . '_' . $acak . '.' . $ext;
$targetPath = $targetDir . '/' . $safeName;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    erpify_fail('File gagal dipindahkan ke folder upload.', 500);
}
@chmod($targetPath, 0644);

$urlBase = isset($config['upload_url']) ? trim((string) $config['upload_url'], '/') : 'uploads';
$url = $urlBase . '/' . $category . '/' . $safeName;

erpify_json([
    'ok'       => true,
    'url'      => $url,
    'fileName' => $safeName,
    'size'     => (int) $file['size'],
]);
