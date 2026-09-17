<?php
/**
 * ERPify - SELFTEST
 * Buka halaman ini di browser setelah upload ke Hostinger:
 *   https://domain-anda.com/api/selftest.php
 * Memeriksa: versi PHP, ekstensi, config, koneksi database, pembuatan tabel,
 * folder upload, session, dan akun admin. Hapus file ini bila sudah OK.
 */

require __DIR__ . '/lib.php';

$hasil = [];
$tambah = function (string $nama, bool $lolos, string $detail = '') use (&$hasil) {
    $hasil[] = ['nama' => $nama, 'lolos' => $lolos, 'detail' => $detail];
};

// 1. Versi PHP
$tambah('Versi PHP >= 7.4', PHP_VERSION_ID >= 70400, 'Terdeteksi PHP ' . PHP_VERSION);

// 2. Ekstensi wajib
foreach (['pdo', 'json', 'session', 'fileinfo', 'mbstring'] as $ext) {
    $tambah('Ekstensi ' . $ext, extension_loaded($ext), extension_loaded($ext) ? 'aktif' : 'BELUM aktif');
}
$driver = erpify_driver();
$driverExt = $driver === 'sqlite' ? 'pdo_sqlite' : 'pdo_mysql';
$tambah('Ekstensi ' . $driverExt . ' (driver ' . $driver . ')', extension_loaded($driverExt), extension_loaded($driverExt) ? 'aktif' : 'BELUM aktif');

// 3. File config
$config = erpify_config();
$tambah('File api/config.php tersedia', empty($config['_from_sample']), empty($config['_from_sample'])
    ? 'config.php ditemukan'
    : 'BELUM ada - masih memakai config.sample.php, salin ke config.php lalu isi kredensial database');

// 4. Koneksi database + tabel
$pdo = null;
try {
    $c = $config;
    if ($driver === 'sqlite') {
        $path = isset($c['sqlite_path']) ? $c['sqlite_path'] : (__DIR__ . '/../data/erpify.sqlite');
        $dirData = dirname($path);
        if (!is_dir($dirData)) {
            @mkdir($dirData, 0775, true);
        }
        $pdo = new PDO('sqlite:' . $path);
    } else {
        $dsn = 'mysql:host=' . (isset($c['db_host']) ? $c['db_host'] : 'localhost')
            . ';dbname=' . (isset($c['db_name']) ? $c['db_name'] : '')
            . ';charset=' . (isset($c['db_charset']) ? $c['db_charset'] : 'utf8mb4');
        $pdo = new PDO($dsn, isset($c['db_user']) ? $c['db_user'] : '', isset($c['db_pass']) ? $c['db_pass'] : '');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $tambah('Koneksi database', true, 'berhasil (' . $driver . ')');
} catch (Throwable $e) {
    $tambah('Koneksi database', false, 'GAGAL: ' . $e->getMessage());
}

$punyaData = false;
$waktuUpdate = '-';
if ($pdo instanceof PDO) {
    try {
        erpify_ensure_tables($pdo);
        $tambah('Pembuatan tabel (erpify_store, erpify_admin)', true, 'tabel siap');

        // Uji tulis-baca JSON pada id khusus (99) agar data asli tidak terganggu
        $contoh = ['ok' => true, 'waktu' => date('c')];
        if ($driver === 'sqlite') {
            $sqlUji = 'INSERT INTO erpify_store (id, payload, updated_at) VALUES (99, ?, ?) '
                . 'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at';
        } else {
            $sqlUji = 'INSERT INTO erpify_store (id, payload, updated_at) VALUES (99, ?, ?) '
                . 'ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)';
        }
        $st = $pdo->prepare($sqlUji);
        $st->execute([json_encode($contoh), date('Y-m-d H:i:s')]);
        $st = $pdo->query('SELECT payload FROM erpify_store WHERE id = 99');
        $baca = $st->fetch();
        $balik = $baca ? json_decode($baca['payload'], true) : null;
        $pdo->exec('DELETE FROM erpify_store WHERE id = 99');
        $tambah('Uji tulis & baca data (JSON)', is_array($balik) && !empty($balik['ok']), 'data dapat ditulis dan dibaca kembali');

        $st = $pdo->query('SELECT updated_at FROM erpify_store WHERE id = 1');
        $row = $st->fetch();
        if ($row) {
            $punyaData = true;
            $waktuUpdate = $row['updated_at'];
        }
        $tambah('Status data website di database', true, $punyaData
            ? ('sudah ada, terakhir diperbarui: ' . $waktuUpdate)
            : 'database masih kosong - normal untuk instalasi baru, akan terisi saat admin menyimpan perubahan pertama');

        $st = $pdo->query('SELECT username, last_password_change FROM erpify_admin ORDER BY id ASC LIMIT 1');
        $adm = $st->fetch();
        $tambah('Akun admin di database', true, $adm
            ? 'username: ' . $adm['username'] . ' (password diubah: ' . ($adm['last_password_change'] ? $adm['last_password_change'] : '-') . ')'
            : 'belum ada - ini normal bila Anda belum pernah login. Akun dibuat otomatis saat login pertama di login.html memakai default_admin_user / default_admin_pass dari config.php');
    } catch (Throwable $e) {
        $tambah('Pembuatan tabel & uji data', false, 'GAGAL: ' . $e->getMessage());
    }
}

// 5. Folder upload
$uploadDir = isset($config['upload_dir']) ? $config['upload_dir'] : (__DIR__ . '/../uploads');
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}
$adaDir = is_dir($uploadDir);
$tambah('Folder upload tersedia', $adaDir, $adaDir ? $uploadDir : 'tidak dapat dibuat: ' . $uploadDir);
if ($adaDir) {
    $bisaTulis = is_writable($uploadDir);
    $tambah('Folder upload dapat ditulis', $bisaTulis, $bisaTulis ? 'izin tulis OK' : 'ubah izin folder uploads menjadi 755');
    if ($bisaTulis) {
        $uji = $uploadDir . '/selftest.txt';
        $tulis = @file_put_contents($uji, 'erpify selftest ' . date('c'));
        $tambah('Uji tulis file di folder upload', $tulis !== false, $tulis !== false ? 'berhasil' : 'gagal menulis file uji');
        if ($tulis !== false) {
            @unlink($uji);
        }
    }
}

// 6. Session
erpify_session_start();
$tambah('Session PHP berjalan', session_status() === PHP_SESSION_ACTIVE, 'session id: ' . substr(session_id(), 0, 8) . '...');

// 7. Info URL
$skema = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$baseUrl = $skema . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost');
$dirApi = rtrim(dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/api/selftest.php'), '/');

$gagal = 0;
foreach ($hasil as $h) {
    if (!$h['lolos']) {
        $gagal++;
    }
}
?><!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Selftest API ERPify</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f0f2f5;margin:0;padding:32px;color:#0a1628}
.card{max-width:880px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
h1{font-size:1.35rem;margin:0 0 6px}
p.sub{color:#667;font-size:.9rem;margin:0 0 20px}
table{width:100%;border-collapse:collapse;font-size:.875rem}
th{background:#0a1628;color:#fff;text-align:left;padding:10px 12px}
td{padding:10px 12px;border-bottom:1px solid #eef0f2;vertical-align:top}
.ok{color:#16a34a;font-weight:600}
.no{color:#dc2626;font-weight:600}
.detail{color:#556;font-size:.8125rem}
.summary{margin-top:20px;padding:14px 16px;border-radius:10px;font-weight:600}
.summary.good{background:#ecfdf3;color:#167044}
.summary.bad{background:#fef3f2;color:#b42318}
code{background:#f4f6f8;padding:2px 6px;border-radius:4px;font-size:.8125rem}
.step{margin-top:22px;font-size:.875rem;line-height:1.8}
</style>
</head>
<body>
<div class="card">
<h1>Selftest API ERPify</h1>
<p class="sub">Halaman ini memastikan backend PHP + database siap dipakai website. Hapus file ini setelah semua berstatus OK.</p>
<table>
<thead><tr><th style="width:34%">Pemeriksaan</th><th style="width:10%">Status</th><th>Detail</th></tr></thead>
<tbody>
<?php foreach ($hasil as $h): ?>
<tr>
<td><?php echo htmlspecialchars($h['nama'], ENT_QUOTES, 'UTF-8'); ?></td>
<td class="<?php echo $h['lolos'] ? 'ok' : 'no'; ?>"><?php echo $h['lolos'] ? 'OK' : 'GAGAL'; ?></td>
<td class="detail"><?php echo htmlspecialchars($h['detail'], ENT_QUOTES, 'UTF-8'); ?></td>
</tr>
<?php endforeach; ?>
</tbody>
</table>
<div class="summary <?php echo $gagal === 0 ? 'good' : 'bad'; ?>">
<?php
echo $gagal === 0
    ? 'Semua pemeriksaan lolos. Backend ERPify siap digunakan.'
    : $gagal . ' pemeriksaan belum lolos. Perbaiki sesuai kolom Detail di atas.';
?>
</div>
<div class="step">
<strong>Endpoint yang dipakai website:</strong><br>
Data: <code><?php echo htmlspecialchars($baseUrl . $dirApi . '/data.php', ENT_QUOTES, 'UTF-8'); ?></code><br>
Login: <code><?php echo htmlspecialchars($baseUrl . $dirApi . '/auth.php', ENT_QUOTES, 'UTF-8'); ?></code><br>
Upload: <code><?php echo htmlspecialchars($baseUrl . $dirApi . '/upload.php', ENT_QUOTES, 'UTF-8'); ?></code><br>
Folder upload: <code><?php echo htmlspecialchars(isset($config['upload_url']) ? $config['upload_url'] : 'uploads/', ENT_QUOTES, 'UTF-8'); ?></code>
</div>
</div>
</body>
</html>
