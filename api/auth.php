<?php
/**
 * ERPify - endpoint autentikasi admin
 *
 * GET  api/auth.php?action=status          -> cek status login
 * POST api/auth.php  { action: 'login', username, password }
 * POST api/auth.php  { action: 'logout' }
 * POST api/auth.php  { action: 'change_password', oldPassword, newPassword }
 */

require __DIR__ . '/lib.php';

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
$queryAction = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($method === 'GET') {
    if ($queryAction === 'status') {
        erpify_session_start();
        erpify_json([
            'ok'                 => true,
            'loggedIn'           => erpify_is_admin(),
            'needPasswordChange' => !empty($_SESSION['erpify_need_pw_change']),
            'username'           => isset($_SESSION['erpify_admin']) ? $_SESSION['erpify_admin'] : null,
            'apiVersion'         => '1.0',
        ]);
    }
    erpify_fail('Aksi tidak dikenal.', 400);
}

erpify_require_post();
$body = erpify_request_body();
$action = isset($body['action']) && $body['action'] !== '' ? (string) $body['action'] : $queryAction;

if ($action === 'login') {
    $username = isset($body['username']) ? trim((string) $body['username']) : '';
    $password = isset($body['password']) ? (string) $body['password'] : '';
    if ($username === '' || $password === '') {
        erpify_fail('Username dan password harus diisi!');
    }

    $admin = erpify_admin_ensure();
    $userOk = hash_equals((string) $admin['username'], $username);
    $passOk = password_verify($password, (string) $admin['password_hash']);
    if (!$userOk || !$passOk) {
        erpify_fail('Username atau password salah!', 401);
    }

    erpify_session_start();
    session_regenerate_id(true);
    $_SESSION['erpify_admin'] = $admin['username'];
    $need = erpify_need_password_change($admin['last_password_change']);
    $_SESSION['erpify_need_pw_change'] = $need;

    erpify_json([
        'ok'                 => true,
        'loggedIn'           => true,
        'needPasswordChange' => $need,
        'username'           => $admin['username'],
    ]);
}

if ($action === 'logout') {
    erpify_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], !empty($params['secure']), !empty($params['httponly']));
    }
    session_destroy();
    erpify_json(['ok' => true, 'loggedIn' => false]);
}

if ($action === 'change_password') {
    erpify_require_admin();
    $old = isset($body['oldPassword']) ? (string) $body['oldPassword'] : '';
    $new = isset($body['newPassword']) ? (string) $body['newPassword'] : '';
    if ($old === '' || $new === '') {
        erpify_fail('Password lama dan password baru harus diisi!');
    }
    if (strlen($new) < 6) {
        erpify_fail('Password baru minimal 6 karakter!');
    }
    $admin = erpify_admin_ensure();
    if (!password_verify($old, (string) $admin['password_hash'])) {
        erpify_fail('Password lama salah!', 401);
    }
    $pdo = erpify_db();
    $st = $pdo->prepare('UPDATE erpify_admin SET password_hash = ?, last_password_change = ? WHERE id = ?');
    $st->execute([password_hash($new, PASSWORD_DEFAULT), date('Y-m-d H:i:s'), $admin['id']]);
    $_SESSION['erpify_need_pw_change'] = false;
    erpify_json(['ok' => true]);
}

erpify_fail('Aksi tidak dikenal.', 400);
