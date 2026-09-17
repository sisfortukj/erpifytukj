<?php
/**
 * ERPify - endpoint data bersama (GET publik, POST khusus admin)
 *
 * GET  api/data.php  -> { ok, empty, data, updatedAt }
 * POST api/data.php  -> simpan seluruh data (wajib login admin)
 *                       body: { data: {...} }  atau langsung objek datanya
 */

require __DIR__ . '/lib.php';

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';

if ($method === 'GET') {
    $store = erpify_get_store();
    if ($store === null) {
        erpify_json([
            'ok'        => true,
            'empty'     => true,
            'data'      => null,
            'updatedAt' => null,
        ]);
    }
    erpify_json([
        'ok'        => true,
        'empty'     => false,
        'data'      => $store['data'],
        'updatedAt' => $store['updated_at'],
    ]);
}

if ($method === 'POST') {
    erpify_require_post();
    erpify_require_admin();

    $body = erpify_request_body();
    $data = isset($body['data']) && is_array($body['data']) ? $body['data'] : $body;

    if (!is_array($data) || count($data) === 0) {
        erpify_fail('Data yang dikirim kosong.');
    }
    if (!isset($data['platforms']) || !is_array($data['platforms'])) {
        erpify_fail('Struktur data tidak dikenali (field platforms tidak ditemukan).', 422);
    }
    if (!isset($data['sertifikatSAP']) || !is_array($data['sertifikatSAP'])) {
        erpify_fail('Struktur data tidak dikenali (field sertifikatSAP tidak ditemukan).', 422);
    }

    $updatedAt = erpify_put_store($data);
    erpify_json(['ok' => true, 'updatedAt' => $updatedAt]);
}

erpify_fail('Metode tidak diizinkan.', 405);
