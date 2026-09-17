<?php
/**
 * ERPify - helper dasar API
 * Berisi: pembacaan config, koneksi database (MySQL / SQLite), session,
 * pembuatan tabel, penyimpanan data, dan respons JSON.
 *
 * Kompatibel dengan PHP 7.4 - 8.3 (Hostinger mendukung PHP 8.1/8.2/8.3).
 */

if (!defined('ERPIFY_API')) {
    define('ERPIFY_API', true);
}

/**
 * Baca konfigurasi. Kalau config.php belum dibuat, otomatis memakai
 * config.sample.php supaya pesan errornya jelas dan tidak fatal.
 */
function erpify_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $fromSample = false;
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        $path = __DIR__ . '/config.sample.php';
        $fromSample = true;
    }
    $config = require $path;
    if (!is_array($config)) {
        $config = [];
    }
    $config['_from_sample'] = $fromSample;
    return $config;
}

function erpify_driver(): string
{
    $config = erpify_config();
    $driver = isset($config['db_driver']) ? strtolower((string) $config['db_driver']) : 'mysql';
    return $driver === 'sqlite' ? 'sqlite' : 'mysql';
}

/**
 * Periksa masalah konfigurasi yang paling sering terjadi.
 * Mengembalikan string pesan (kosong bila konfigurasi terlihat benar).
 */
function erpify_config_problem(): string
{
    $config = erpify_config();

    if (!empty($config['_from_sample'])) {
        return 'File api/config.php belum ada di server (yang terbaca masih contoh api/config.sample.php). '
            . 'Buka api/setup.php untuk mengisi otomatis, atau salin config.sample.php menjadi config.php lalu isi kredensial database dari hPanel (Databases > MySQL Databases).';
    }

    if (erpify_driver() === 'mysql') {
        $user = isset($config['db_user']) ? trim((string) $config['db_user']) : '';
        $name = isset($config['db_name']) ? trim((string) $config['db_name']) : '';
        $pass = isset($config['db_pass']) ? (string) $config['db_pass'] : '';
        if ($user === '' || $name === '') {
            return 'db_name / db_user pada api/config.php masih kosong. Isi sesuai data dari hPanel (Databases > MySQL Databases).';
        }
        if (strpos($user, 'u000000000_') === 0 || strpos($name, 'u000000000_') === 0) {
            return 'Kredensial di api/config.php masih memakai contoh (u000000000_erpify). Ganti db_name dan db_user dengan nama asli dari hPanel (Databases > MySQL Databases), contohnya u123456789_erpify.';
        }
        // Khusus Hostinger: nama database & user selalu berawalan uXXXXXXXXX_ sesuai akun hosting.
        $dokumen = isset($_SERVER['DOCUMENT_ROOT']) ? (string) $_SERVER['DOCUMENT_ROOT'] : '';
        if (preg_match('#/home/(u[0-9]{6,})/#', $dokumen, $cocok)) {
            $prefiks = $cocok[1] . '_';
            if (strpos($user, $prefiks) !== 0) {
                return 'Username database harus memakai akun Hostinger Anda, yaitu berawalan "' . $prefiks . '" (contoh: ' . $prefiks . 'erpify), '
                    . 'sedangkan di api/config.php tertulis "' . $user . '". User panel admin ("admin") BUKAN user database. '
                    . 'Buat/lihat user database di hPanel > Databases > MySQL Databases, lalu isi db_user dengan nama lengkapnya.';
            }
            if (strpos($name, $prefiks) !== 0) {
                return 'Nama database harus berawalan "' . $prefiks . '" (contoh: ' . $prefiks . 'erpify), sedangkan di api/config.php tertulis "' . $name . '". '
                    . 'Lihat nama lengkap database di hPanel > Databases > MySQL Databases.';
            }
        }
        if ($pass === '' || $pass === 'PASSWORD_DATABASE_ANDA') {
            return 'db_pass pada api/config.php masih kosong/contoh. Isi dengan password user database yang Anda buat di hPanel.';
        }
    }

    return '';
}

/** Kirim respons JSON lalu hentikan skrip. */
function erpify_json($payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Kirim respons gagal. */
function erpify_fail(string $message, int $status = 400): void
{
    erpify_json(['ok' => false, 'error' => $message], $status);
}

/** Ambil body JSON dari request. */
function erpify_request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Koneksi database (singleton) + pembuatan tabel otomatis. */
function erpify_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = erpify_config();

    // Beri pesan yang jelas bila konfigurasi belum diisi (mis. masih file contoh)
    $masalah = erpify_config_problem();
    if ($masalah !== '') {
        erpify_fail($masalah, 500);
    }

    try {
        if (erpify_driver() === 'sqlite') {
            $path = isset($config['sqlite_path']) ? $config['sqlite_path'] : (__DIR__ . '/../data/erpify.sqlite');
            $dir = dirname($path);
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $pdo = new PDO('sqlite:' . $path);
            $pdo->exec('PRAGMA journal_mode = WAL');
        } else {
            $host    = isset($config['db_host']) ? $config['db_host'] : 'localhost';
            $name    = isset($config['db_name']) ? $config['db_name'] : '';
            $charset = isset($config['db_charset']) ? $config['db_charset'] : 'utf8mb4';
            $dsn = 'mysql:host=' . $host . ';dbname=' . $name . ';charset=' . $charset;
            $pdo = new PDO($dsn, isset($config['db_user']) ? $config['db_user'] : '', isset($config['db_pass']) ? $config['db_pass'] : '');
        }
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        erpify_fail('Koneksi database gagal: ' . $e->getMessage(), 500);
    }

    erpify_ensure_tables($pdo);
    return $pdo;
}

/** Buat tabel bila belum ada. */
function erpify_ensure_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pk = erpify_driver() === 'sqlite'
        ? 'INTEGER PRIMARY KEY AUTOINCREMENT'
        : 'INT AUTO_INCREMENT PRIMARY KEY';

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS erpify_store ('
        . ' id ' . $pk . ','
        . ' payload LONGTEXT NOT NULL,'
        . ' updated_at DATETIME NOT NULL'
        . ')'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS erpify_admin ('
        . ' id ' . $pk . ','
        . ' username VARCHAR(64) NOT NULL,'
        . ' password_hash VARCHAR(255) NOT NULL,'
        . ' last_password_change DATETIME NULL'
        . ')'
    );
    $done = true;
}

// ============================================================
// SESSION & AUTENTIKASI
// ============================================================

function erpify_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $config = erpify_config();
    if (session_status() === PHP_SESSION_NONE) {
        session_name(isset($config['session_name']) ? $config['session_name'] : 'erpify_sid');
    }
    $https = false;
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        $https = true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        $https = true;
    }
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'httponly' => true,
            'secure'   => $https,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params(0, '/', '', $https, true);
    }
    @session_start();
}

function erpify_is_admin(): bool
{
    erpify_session_start();
    return !empty($_SESSION['erpify_admin']);
}

function erpify_require_admin(): void
{
    if (!erpify_is_admin()) {
        erpify_fail('Anda belum login sebagai admin.', 401);
    }
}

/** Hanya izinkan POST + header penanda dari frontend (proteksi CSRF sederhana). */
function erpify_require_post(): void
{
    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    if (strtoupper($method) !== 'POST') {
        erpify_fail('Metode tidak diizinkan.', 405);
    }
    if (empty($_SERVER['HTTP_X_ERPIFY'])) {
        erpify_fail('Permintaan tidak valid. Muat ulang halaman admin lalu coba lagi.', 400);
    }
}

function erpify_need_password_change($lastChange): bool
{
    if (empty($lastChange)) {
        return false;
    }
    $ts = strtotime((string) $lastChange);
    if (!$ts) {
        return false;
    }
    return $ts <= strtotime('-3 months');
}

/** Ambil baris admin pertama. */
function erpify_admin_row()
{
    $pdo = erpify_db();
    $st = $pdo->query('SELECT id, username, password_hash, last_password_change FROM erpify_admin ORDER BY id ASC LIMIT 1');
    $row = $st->fetch();
    return $row ? $row : null;
}

/** Pastikan baris admin ada (dibuat dari config saat pertama kali). */
function erpify_admin_ensure(): array
{
    $row = erpify_admin_row();
    if ($row) {
        return $row;
    }
    $config = erpify_config();
    $user = isset($config['default_admin_user']) ? $config['default_admin_user'] : 'admin';
    $pass = isset($config['default_admin_pass']) ? $config['default_admin_pass'] : 'erpify123';
    $pdo = erpify_db();
    $st = $pdo->prepare('INSERT INTO erpify_admin (username, password_hash, last_password_change) VALUES (?, ?, ?)');
    $st->execute([$user, password_hash($pass, PASSWORD_DEFAULT), date('Y-m-d H:i:s')]);
    return erpify_admin_row();
}

// ============================================================
// PENYIMPANAN DATA (satu baris JSON agar cocok dengan struktur data.js)
// ============================================================

function erpify_get_store()
{
    $pdo = erpify_db();
    $st = $pdo->query('SELECT payload, updated_at FROM erpify_store WHERE id = 1');
    $row = $st->fetch();
    if (!$row) {
        return null;
    }
    $data = json_decode($row['payload'], true);
    if (!is_array($data)) {
        return null;
    }
    return ['data' => $data, 'updated_at' => $row['updated_at']];
}

function erpify_put_store(array $data): string
{
    $pdo = erpify_db();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        erpify_fail('Data tidak dapat disimpan (JSON tidak valid).', 422);
    }
    $now = date('Y-m-d H:i:s');
    if (erpify_driver() === 'sqlite') {
        $sql = 'INSERT INTO erpify_store (id, payload, updated_at) VALUES (1, ?, ?) '
            . 'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at';
    } else {
        $sql = 'INSERT INTO erpify_store (id, payload, updated_at) VALUES (1, ?, ?) '
            . 'ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)';
    }
    $st = $pdo->prepare($sql);
    $st->execute([$json, $now]);
    return $now;
}
