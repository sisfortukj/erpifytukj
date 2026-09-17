<?php
/**
 * ERPify - wizard setup database (jalankan sekali saja)
 * Buka: https://domain-anda.com/api/setup.php
 *
 * Halaman ini akan:
 *  1. menguji koneksi ke database Hostinger,
 *  2. membuat tabel yang dibutuhkan,
 *  3. menulis file api/config.php secara otomatis.
 *
 * DEMI KEAMANAN: setelah setup berhasil, HAPUS file ini dari server.
 * Halaman ini menolak bekerja bila api/config.php sudah ada.
 */

$configPath = __DIR__ . '/config.php';
$sudahAda = is_file($configPath);

$form = [
    'db_driver'          => 'mysql',
    'db_host'            => 'localhost',
    'db_name'            => '',
    'db_user'            => '',
    'default_admin_user' => 'admin',
    'default_admin_pass' => '',
];

$pesanGagal = '';
$pesanSukses = '';
$tautanSukses = false;
$configManual = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$sudahAda) {
    foreach ($form as $k => $v) {
        if (isset($_POST[$k])) {
            $form[$k] = trim((string) $_POST[$k]);
        }
    }
    $dbPass = isset($_POST['db_pass']) ? (string) $_POST['db_pass'] : '';

    if ($form['db_driver'] !== 'sqlite') {
        $form['db_driver'] = 'mysql';
    }

    // ===== VALIDASI =====
    $polaNama = '/^[A-Za-z0-9_\-]+$/';
    $polaHost = '/^[A-Za-z0-9_.\-]+$/';
    $valid = true;
    if ($form['db_driver'] === 'mysql') {
        if ($form['db_host'] === '' || !preg_match($polaHost, $form['db_host'])) {
            $valid = false;
            $pesanGagal = 'Host database tidak valid (biasanya: localhost).';
        } elseif (!preg_match($polaNama, $form['db_name'])) {
            $valid = false;
            $pesanGagal = 'Nama database hanya boleh huruf, angka, garis bawah, dan tanda hubung.';
        } elseif ($form['db_user'] === '' || !preg_match($polaNama, $form['db_user'])) {
            $valid = false;
            $pesanGagal = 'Username database tidak valid.';
        } elseif ($dbPass === '') {
            $valid = false;
            $pesanGagal = 'Password database belum diisi.';
        }
    }
    if ($valid && $form['default_admin_user'] === '') {
        $valid = false;
        $pesanGagal = 'Username admin panel belum diisi.';
    }
    if ($valid && strlen($form['default_admin_pass']) < 6) {
        $valid = false;
        $pesanGagal = 'Password admin panel minimal 6 karakter.';
    }

    // ===== UJI KONEKSI =====
    $pdo = null;
    if ($valid) {
        try {
            if ($form['db_driver'] === 'sqlite') {
                $dirData = __DIR__ . '/../data';
                if (!is_dir($dirData)) {
                    @mkdir($dirData, 0775, true);
                }
                $pdo = new PDO('sqlite:' . $dirData . '/erpify.sqlite');
            } else {
                $dsn = 'mysql:host=' . $form['db_host'] . ';dbname=' . $form['db_name'] . ';charset=utf8mb4';
                $pdo = new PDO($dsn, $form['db_user'], $dbPass);
            }
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            $valid = false;
            $pesanGagal = 'Koneksi database gagal: ' . $e->getMessage()
                . ' -> Periksa nama database, username, dan password di hPanel (Databases > MySQL Databases). '
                . 'Pastikan user database sudah dihubungkan ke database tersebut dengan hak All Privileges.';
        }
    }

    // ===== BUAT TABEL + AKUN ADMIN =====
    if ($valid && $pdo instanceof PDO) {
        try {
            $pk = $form['db_driver'] === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
            $pdo->exec('CREATE TABLE IF NOT EXISTS erpify_store ( id ' . $pk . ', payload LONGTEXT NOT NULL, updated_at DATETIME NOT NULL )');
            $pdo->exec('CREATE TABLE IF NOT EXISTS erpify_admin ( id ' . $pk . ', username VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL, last_password_change DATETIME NULL )');

            $st = $pdo->query('SELECT COUNT(*) AS jml FROM erpify_admin');
            $row = $st->fetch();
            if (!$row || (int) $row['jml'] === 0) {
                $st = $pdo->prepare('INSERT INTO erpify_admin (username, password_hash, last_password_change) VALUES (?, ?, ?)');
                $st->execute([$form['default_admin_user'], password_hash($form['default_admin_pass'], PASSWORD_DEFAULT), date('Y-m-d H:i:s')]);
            }
        } catch (Throwable $e) {
            $valid = false;
            $pesanGagal = 'Tabel database gagal dibuat: ' . $e->getMessage()
                . ' -> Pastikan user database punya hak penuh (All Privileges) pada database tersebut.';
        }
    }

    // ===== TULIS config.php =====
    if ($valid && $pdo instanceof PDO) {
        $baris = [];
        $baris[] = '<?php';
        $baris[] = '/**';
        $baris[] = ' * ERPify - konfigurasi (dibuat otomatis oleh api/setup.php pada ' . date('d-m-Y H:i') . ')';
        $baris[] = ' * Berisi kredensial database. Jangan bagikan file ini kepada siapa pun.';
        $baris[] = ' */';
        $baris[] = '';
        $baris[] = 'return [';
        $baris[] = '    // ===== DATABASE =====';
        $baris[] = "    'db_driver'  => " . var_export($form['db_driver'], true) . ',';
        if ($form['db_driver'] === 'sqlite') {
            $baris[] = "    'sqlite_path' => __DIR__ . '/../data/erpify.sqlite',";
        } else {
            $baris[] = "    'db_host'    => " . var_export($form['db_host'], true) . ',';
            $baris[] = "    'db_name'    => " . var_export($form['db_name'], true) . ',';
            $baris[] = "    'db_user'    => " . var_export($form['db_user'], true) . ',';
            $baris[] = "    'db_pass'    => " . var_export($dbPass, true) . ',';
            $baris[] = "    'db_charset' => 'utf8mb4',";
        }
        $baris[] = '';
        $baris[] = '    // ===== AKUN ADMIN AWAL (dipakai saat tabel admin masih kosong) =====';
        $baris[] = "    'default_admin_user' => " . var_export($form['default_admin_user'], true) . ',';
        $baris[] = "    'default_admin_pass' => " . var_export($form['default_admin_pass'], true) . ',';
        $baris[] = '';
        $baris[] = '    // ===== UPLOAD =====';
        $baris[] = "    'upload_dir'    => __DIR__ . '/../uploads',";
        $baris[] = "    'upload_url'    => 'uploads/',";
        $baris[] = "    'max_upload_mb' => 8,";
        $baris[] = '';
        $baris[] = '    // ===== SESSION =====';
        $baris[] = "    'session_name' => 'erpify_sid',";
        $baris[] = '];';
        $configManual = implode("\n", $baris) . "\n";

        $tulis = @file_put_contents($configPath, $configManual);
        if ($tulis === false) {
            $pesanGagal = 'Koneksi database berhasil, tetapi file api/config.php tidak dapat ditulis. '
                . 'Ubah izin folder api menjadi 755, atau buat sendiri file api/config.php lalu tempel isi kotak di bawah.';
        } else {
            @chmod($configPath, 0644);
            $pesanSukses = 'Setup berhasil! Database terhubung, tabel dibuat, dan file api/config.php sudah tersimpan.';
            $tautanSukses = true;
        }
    }
}
?><!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup Database - ERPify</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f0f2f5;margin:0;padding:32px;color:#0a1628}
.card{max-width:720px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
h1{font-size:1.35rem;margin:0 0 6px}
p.sub{color:#667;font-size:.9rem;margin:0 0 20px;line-height:1.6}
label{display:block;font-size:.875rem;font-weight:600;margin:14px 0 6px}
input,select,textarea{width:100%;padding:11px 13px;border:1px solid #d7dee8;border-radius:8px;font:inherit;box-sizing:border-box}
small{display:block;color:#8894a5;font-size:.75rem;margin-top:4px}
button{margin-top:22px;width:100%;padding:13px;border:none;border-radius:9px;background:linear-gradient(135deg,#207ae0,#1a5fa8);color:#fff;font-size:1rem;font-weight:600;cursor:pointer}
.msg{margin:18px 0;padding:14px 16px;border-radius:10px;font-size:.875rem;line-height:1.6}
.msg.err{background:#fef3f2;color:#b42318;border:1px solid #fecdca}
.msg.ok{background:#ecfdf3;color:#167044;border:1px solid #abefc6}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.row{background:#f8fafc;border:1px solid #e6ebf2;border-radius:10px;padding:16px;margin-top:18px;font-size:.875rem;line-height:1.7}
code{background:#f4f6f8;padding:2px 6px;border-radius:4px;font-size:.8125rem}
a.btnlink{display:inline-block;margin:10px 10px 0 0;padding:10px 16px;border-radius:8px;background:#0a1628;color:#fff;text-decoration:none;font-size:.875rem}
.hapus{color:#b42318;font-weight:600}
textarea{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.75rem;height:230px}
</style>
</head>
<body>
<div class="card">
<h1>Setup Database ERPify</h1>

<?php if ($sudahAda): ?>
<p class="sub">File <code>api/config.php</code> sudah ada di server, jadi wizard ini tidak mengubah apa pun (pengaman agar kredensial database tidak bisa diubah orang lain).</p>
<div class="msg ok">Website sudah dikonfigurasi. Ingin mengatur ulang? Hapus dulu file <code>api/config.php</code> lewat File Manager, lalu muat ulang halaman ini.</div>
<div class="row">
<strong class="hapus">Langkah penting:</strong> setelah website berjalan normal, hapus file
<code>api/setup.php</code> dan <code>api/selftest.php</code> dari server.
<div><a class="btnlink" href="selftest.php">Buka Selftest</a><a class="btnlink" href="../login.html">Login Admin</a></div>
</div>

<?php elseif ($tautanSukses): ?>
<div class="msg ok"><strong><?php echo htmlspecialchars($pesanSukses, ENT_QUOTES, 'UTF-8'); ?></strong></div>
<div class="row">
<strong>Langkah selanjutnya:</strong>
<ol>
<li>Buka <a href="selftest.php">api/selftest.php</a> &mdash; pastikan semua pemeriksaan bertanda OK.</li>
<li>Login di <a href="../login.html">login.html</a> memakai username
<code><?php echo htmlspecialchars($form['default_admin_user'], ENT_QUOTES, 'UTF-8'); ?></code> dan password yang baru saja Anda isi.</li>
<li>Ganti password dari panel admin (ikon kunci) bila perlu.</li>
<li class="hapus">Hapus file <code>api/setup.php</code> (wajib) dan <code>api/selftest.php</code> (opsional) dari server.</li>
</ol>
</div>

<?php else: ?>
<p class="sub">
Isi data database yang Anda buat di hPanel Hostinger (<strong>Databases &gt; MySQL Databases</strong>).
Wizard ini akan menguji koneksi, membuat tabel, lalu menulis file <code>api/config.php</code> secara otomatis.
</p>

<?php if ($pesanGagal !== ''): ?>
<div class="msg err"><?php echo htmlspecialchars($pesanGagal, ENT_QUOTES, 'UTF-8'); ?></div>
<?php endif; ?>

<form method="post" autocomplete="off">
<div class="grid">
<div>
<label for="db_host">Host database</label>
<input type="text" id="db_host" name="db_host" value="<?php echo htmlspecialchars($form['db_host'], ENT_QUOTES, 'UTF-8'); ?>" required>
<small>Umumnya <code>localhost</code> di Hostinger</small>
</div>
<div>
<label for="db_name">Nama database</label>
<input type="text" id="db_name" name="db_name" value="<?php echo htmlspecialchars($form['db_name'], ENT_QUOTES, 'UTF-8'); ?>" placeholder="u123456789_erpify" required>
<small>Lihat di hPanel &gt; Databases &gt; MySQL Databases</small>
</div>
<div>
<label for="db_user">Username database</label>
<input type="text" id="db_user" name="db_user" value="<?php echo htmlspecialchars($form['db_user'], ENT_QUOTES, 'UTF-8'); ?>" placeholder="u123456789_erpify" required>
<small>Biasanya sama dengan nama database</small>
</div>
<div>
<label for="db_pass">Password database</label>
<input type="password" id="db_pass" name="db_pass" placeholder="password user database" required>
<small>Password yang Anda set saat membuat user database</small>
</div>
<div>
<label for="default_admin_user">Username admin panel</label>
<input type="text" id="default_admin_user" name="default_admin_user" value="<?php echo htmlspecialchars($form['default_admin_user'], ENT_QUOTES, 'UTF-8'); ?>" required>
</div>
<div>
<label for="default_admin_pass">Password admin panel</label>
<input type="password" id="default_admin_pass" name="default_admin_pass" placeholder="minimal 6 karakter" required>
<small>Dipakai untuk login di login.html</small>
</div>
</div>

<label for="db_driver">Jenis database</label>
<select id="db_driver" name="db_driver">
<option value="mysql"<?php echo $form['db_driver'] === 'mysql' ? ' selected' : ''; ?>>MySQL / MariaDB (Hostinger)</option>
<option value="sqlite"<?php echo $form['db_driver'] === 'sqlite' ? ' selected' : ''; ?>>SQLite (hanya untuk uji lokal di komputer)</option>
</select>
<small>Untuk Hostinger, pilih MySQL. Kolom database di atas akan diabaikan bila memilih SQLite.</small>

<button type="submit">Uji Koneksi &amp; Simpan Konfigurasi</button>
</form>

<?php if ($configManual !== ''): ?>
<div class="row">
<strong>Koneksi berhasil, tetapi penulisan otomatis gagal.</strong> Buat file <code>api/config.php</code> lewat File Manager,
lalu tempel isi berikut:
<textarea readonly onclick="this.select()"><?php echo htmlspecialchars($configManual, ENT_QUOTES, 'UTF-8'); ?></textarea>
</div>
<?php endif; ?>

<div class="row">
<strong>Di mana data database saya?</strong> Buka hPanel &gt; <em>Databases</em> &gt; <em>MySQL Databases</em>.
Kalau database belum ada: buat database baru, buat user + password, lalu klik <em>All Privileges</em> agar user terhubung ke database.
</div>
<?php endif; ?>
</div>
</body>
</html>
