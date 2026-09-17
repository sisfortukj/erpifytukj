// ============================================================
// KONFIGURASI BACKEND (Hostinger: folder /api - PHP + MySQL)
// ------------------------------------------------------------
// Bila API tidak tersedia (file dibuka langsung tanpa server, atau
// config database belum benar), website otomatis kembali memakai
// localStorage seperti versi statis sebelumnya.
// ============================================================
const ERPIFY_API_URL = 'api/';
const ERPIFY_API_HEADERS = { 'X-ERPify': '1' };

// Kategori folder upload, dipetakan dari id input file di admin.html
const ERPIFY_UPLOAD_CATEGORY = {
    dsFotoInput: 'dosen',
    agFotoInput: 'anggota',
    brFotoInput: 'berita',
    mtLogoInput: 'mitra'
};

let erpifyApiAvailable = false;   // true setelah api/data.php berhasil diakses
let erpifyDataCache = null;       // cache data aktif (dipakai getData)

function apiIsEnabled() {
    return erpifyApiAvailable;
}

// Pembungkus fetch ke API: selalu kirim header penanda + cookie session
function erpifyApiFetch(path, options) {
    const opts = options || {};
    opts.headers = Object.assign({}, ERPIFY_API_HEADERS, opts.headers || {});
    opts.credentials = 'same-origin';
    if (opts.cache === undefined) opts.cache = 'no-store';
    return fetch(ERPIFY_API_URL + path, opts);
}

// Notifikasi kecil di pojok kanan bawah
function erpifyToast(message, type) {
    let box = document.getElementById('erpifyToast');
    if (!box) {
        box = document.createElement('div');
        box.id = 'erpifyToast';
        box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;max-width:360px;padding:14px 18px;border-radius:10px;font-size:0.875rem;font-family:Inter,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.25);color:#fff;line-height:1.5;display:none;';
        document.body.appendChild(box);
    }
    box.style.background = (type === 'error') ? '#b42318' : '#167044';
    box.innerHTML = '<i class="fas fa-' + (type === 'error' ? 'exclamation-triangle' : 'check-circle') + '"></i> ' + message;
    box.style.display = 'block';
    clearTimeout(box._erpifyTimer);
    box._erpifyTimer = setTimeout(function() { box.style.display = 'none'; }, 6000);
}

// Ambil data bersama dari server (dipanggil sekali di awal setiap halaman)
async function loadData() {
    if (typeof fetch !== 'function' || window.location.protocol === 'file:') {
        erpifyDataCache = getLocalData();
        return erpifyDataCache;
    }
    try {
        const res = await erpifyApiFetch('data.php');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json || json.ok !== true) throw new Error((json && json.error) ? json.error : 'Respons API tidak valid');
        erpifyApiAvailable = true;
        if (json.data && json.data.platforms) {
            erpifyDataCache = normalizeData(json.data);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data)); } catch (e) {}
        } else {
            // Database masih kosong: pakai data default/local dulu, data
            // akan tersimpan ke server saat admin menyimpan perubahan.
            erpifyDataCache = normalizeData(getLocalData());
        }
    } catch (e) {
        erpifyApiAvailable = false;
        erpifyDataCache = normalizeData(getLocalData());
        // Bantu penelusuran masalah: penyebab API tidak aktif tampil di Console browser (F12)
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[ERPify] Backend tidak aktif, memakai mode statis/localStorage. Penyebab:', e && e.message ? e.message : e);
            console.warn('[ERPify] Buka ' + ERPIFY_API_URL + 'selftest.php untuk diagnosa lengkap.');
        }
    }
    return erpifyDataCache;
}

// Unggah file ke server; Promise berisi { url, fileName }
function uploadFileToApi(file, category) {
    return new Promise(function(resolve, reject) {
        const form = new FormData();
        form.append('file', file);
        form.append('category', category || 'umum');
        erpifyApiFetch('upload.php', { method: 'POST', body: form })
            .then(function(res) { return res.json().catch(function() { return null; }); })
            .then(function(json) {
                if (json && json.ok === true) {
                    resolve(json);
                } else {
                    reject(new Error((json && json.error) ? json.error : 'Upload gagal.'));
                }
            })
            .catch(reject);
    });
}

// ===== AUTENTIKASI ADMIN (diproses di server) =====
async function apiLogin(username, password) {
    try {
        const res = await erpifyApiFetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username: username, password: password })
        });
        const json = await res.json().catch(function() { return null; });
        return json || { ok: false, error: 'Respons server tidak valid.' };
    } catch (e) {
        return { ok: false, offline: true, error: 'Tidak dapat menghubungi server.' };
    }
}

async function apiLogout() {
    try {
        await erpifyApiFetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
        });
    } catch (e) { /* diabaikan */ }
}

async function apiAuthStatus() {
    try {
        const res = await erpifyApiFetch('auth.php?action=status');
        const json = await res.json().catch(function() { return null; });
        return json || { ok: false, offline: true, loggedIn: false };
    } catch (e) {
        return { ok: false, offline: true, loggedIn: false };
    }
}

async function apiChangePassword(oldPassword, newPassword) {
    try {
        const res = await erpifyApiFetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'change_password', oldPassword: oldPassword, newPassword: newPassword })
        });
        const json = await res.json().catch(function() { return null; });
        return json || { ok: false, error: 'Respons server tidak valid.' };
    } catch (e) {
        return { ok: false, offline: true, error: 'Tidak dapat menghubungi server.' };
    }
}

// Nilai gambar dari elemen preview upload (disimpan sebagai URL relatif
// supaya tetap benar walau nama domain berubah)
function getUploadPreviewValue(previewId) {
    const el = document.getElementById(previewId);
    if (!el || el.style.display === 'none') return '';
    return el.getAttribute('src') || '';
}

const STORAGE_KEY = 'erpify_data';

function getDefaultData() {
    return {
        adminAccount: {
            username: 'admin',
            password: 'erpify123',
            lastPasswordChange: new Date().toISOString()
        },

        pageSettings: {
            beranda: { subtitle: 'Pusat pengembangan konsultan fungsional dan teknis bidang ERP. Berfokus pada pelatihan, riset, dan implementasi sistem ERP profesional berbasis Odoo, SAP, dan Acumatica.' },
            dosen: { subtitle: 'Tim pengajar dan anggota laboratorium ERPify' },
            matakuliah: { subtitle: 'Berbagai mata kuliah yang dikelola oleh Laboratorium ERPify' },
            kerjasama: { subtitle: 'Jalinan kerjasama dengan berbagai institusi dan perusahaan' },
            berita: { subtitle: 'Informasi terbaru seputar kegiatan Laboratorium ERPify' },
            sertifikat: { subtitle: 'Verifikasi keaslian sertifikat SAP yang diterbitkan oleh Laboratorium ERPify' }
        },
        pageOrder: ['beranda','dosen','matakuliah','kerjasama','berita','sertifikat'],

        platforms: [
            { id:1, icon:'fab fa-odnoklassniki', name:'Odoo', desc:'Platform ERP open-source terkemuka dengan modul lengkap mulai dari CRM, accounting, inventory, HR, hingga manufacturing.', foto:'' },
            { id:2, icon:'fas fa-chart-line', name:'SAP', desc:'Sistem ERP enterprise kelas dunia yang digunakan oleh perusahaan multinasional. Fokus pada konfigurasi fungsional dan ABAP.', foto:'' },
            { id:3, icon:'fas fa-cloud', name:'Acumatica', desc:'Platform ERP cloud-based modern dengan fleksibilitas tinggi untuk perusahaan menengah hingga besar.', foto:'' }
        ],
        dosen: [
            { id:1, kode:'DSN-01', nama:'Dr. Ahmad Fauzi, M.Kom', jabatan:'Kepala Laboratorium ERPify', keahlian:'Ahli implementasi SAP dan Odoo. 15+ tahun pengalaman.', tags:['SAP','Odoo','ABAP'], foto:'' },
            { id:2, kode:'DSN-02', nama:'Rina Wijaya, S.T., M.T.', jabatan:'Dosen Senior ERP', keahlian:'Spesialis ERP Accounting dan Supply Chain Management.', tags:['Accounting','SCM','Acumatica'], foto:'' },
            { id:3, kode:'DSN-03', nama:'Budi Santoso, S.Kom., M.Eng.', jabatan:'Dosen Teknis ERP', keahlian:'Pakar konfigurasi teknis dan pengembangan modul ERP.', tags:['ABAP','Python','Odoo Dev'], foto:'' }
        ],
        mitra: [
            { nama:'PT. Tech ERP Solusi', logo:'' },
            { nama:'PT. Digital Enterprise', logo:'' },
            { nama:'CV. Software House', logo:'' },
            { nama:'PT. Konsultan ERP', logo:'' },
            { nama:'PT. Inovasi Teknologi', logo:'' },
            { nama:'CV. Bisnis Digital', logo:'' }
        ],
        generasi: {
            gen1: { title:'Generasi 1 - Angkatan Perdana', desc:'Generasi pertama yang menjadi pionir Laboratorium ERPify.', anggota:[
                { nama:'Ahmad Rizki', nim:'2201001', jabatan:'Ketua Lab', divisi:'SAP', kodeDosen:'DSN-01', kodeAsprak:'ASP-01', foto:'' },
                { nama:'Siti Nurhaliza', nim:'2201002', jabatan:'Wakil Ketua', divisi:'Odoo', kodeDosen:'DSN-01', kodeAsprak:'ASP-02', foto:'' },
                { nama:'Budi Prasetyo', nim:'2201003', jabatan:'Sekretaris', divisi:'Acumatica', kodeDosen:'DSN-02', kodeAsprak:'ASP-03', foto:'' },
                { nama:'Dewi Lestari', nim:'2201004', jabatan:'Bendahara', divisi:'ABAP', kodeDosen:'DSN-02', kodeAsprak:'ASP-04', foto:'' },
                { nama:'Rudi Hartono', nim:'2201005', jabatan:'Anggota', divisi:'SCM', kodeDosen:'DSN-03', kodeAsprak:'ASP-05', foto:'' },
                { nama:'Ani Rahmawati', nim:'2201006', jabatan:'Anggota', divisi:'HR', kodeDosen:'DSN-03', kodeAsprak:'ASP-06', foto:'' }
            ]},
            gen2: { title:'Generasi 2 - Angkatan Pengembangan', desc:'Generasi kedua yang melanjutkan pengembangan kompetensi ERP.', anggota:[
                { nama:'Fajar Nugroho', nim:'2202001', jabatan:'Ketua Lab', divisi:'Odoo', foto:'' },
                { nama:'Putri Ayu', nim:'2202002', jabatan:'Wakil Ketua', divisi:'SAP', foto:'' },
                { nama:'Adi Saputra', nim:'2202003', jabatan:'Sekretaris', divisi:'Accounting', foto:'' },
                { nama:'Mega Sari', nim:'2202004', jabatan:'Bendahara', divisi:'SCM', foto:'' },
                { nama:'Dimas Ardiansyah', nim:'2202005', jabatan:'Anggota', divisi:'ABAP', foto:'' },
                { nama:'Rina Marlina', nim:'2202006', jabatan:'Anggota', divisi:'HR', foto:'' },
                { nama:'Hendra Gunawan', nim:'2202007', jabatan:'Anggota', divisi:'Acumatica', foto:'' },
                { nama:'Sari Indah', nim:'2202008', jabatan:'Anggota', divisi:'Odoo', foto:'' }
            ]},
            gen3: { title:'Generasi 3 - Angkatan Terbaru', desc:'Generasi terbaru dengan semangat inovasi dan penguasaan teknologi ERP terkini.', anggota:[
                { nama:'Rizky Pratama', nim:'2203001', jabatan:'Ketua Lab', divisi:'SAP', foto:'' },
                { nama:'Nadia Fitri', nim:'2203002', jabatan:'Wakil Ketua', divisi:'Odoo', foto:'' },
                { nama:'Irfan Hakim', nim:'2203003', jabatan:'Sekretaris', divisi:'ABAP', foto:'' },
                { nama:'Lina Marlina', nim:'2203004', jabatan:'Bendahara', divisi:'Accounting', foto:'' },
                { nama:'Teguh Setiawan', nim:'2203005', jabatan:'Anggota', divisi:'SCM', foto:'' },
                { nama:'Fitri Handayani', nim:'2203006', jabatan:'Anggota', divisi:'HR', foto:'' },
                { nama:'Agus Wijaya', nim:'2203007', jabatan:'Anggota', divisi:'Acumatica', foto:'' },
                { nama:'Dian Permata', nim:'2203008', jabatan:'Anggota', divisi:'Odoo', foto:'' },
                { nama:'Bayu Aji', nim:'2203009', jabatan:'Anggota', divisi:'SAP', foto:'' },
                { nama:'Citra Dewi', nim:'2203010', jabatan:'Anggota', divisi:'ABAP', foto:'' }
            ]}
        },
        berita: [
            { id:1, icon:'fas fa-calendar-alt', date:'2026-06-15T09:00:00.000Z', dateDisplay:'15 Juni 2026, 09:00', title:'Workshop Implementasi Odoo untuk Mahasiswa', desc:'ERPify menyelenggarakan workshop implementasi Odoo modul Accounting dan Inventory bagi mahasiswa semester 5.', fullDesc:'Laboratorium ERPify sukses menyelenggarakan workshop Implementasi Odoo yang diikuti oleh 50 mahasiswa dari berbagai program studi. Workshop ini berfokus pada modul Accounting dan Inventory yang merupakan modul inti dalam sistem ERP Odoo.\n\nPara peserta mendapatkan pengalaman langsung dalam mengkonfigurasi modul Odoo, mulai dari setup awal perusahaan, chart of account, manajemen inventory, hingga pembuatan laporan keuangan otomatis. Workshop ini dipandu oleh instruktur berpengalaman dari tim ERPify.\n\nDengan adanya workshop ini, diharapkan mahasiswa memiliki kompetensi praktis dalam implementasi Odoo yang siap digunakan di dunia industri.', foto:'' },
            { id:2, icon:'fas fa-trophy', date:'2026-06-01T10:00:00.000Z', dateDisplay:'1 Juni 2026, 10:00', title:'Tim ERPify Juara 1 Lomba Konfigurasi SAP', desc:'Tim mahasiswa ERPify berhasil meraih juara pertama dalam lomba konfigurasi SAP tingkat nasional.', fullDesc:'Prestasi membanggakan diraih oleh tim ERPify dalam ajang Lomba Konfigurasi SAP Tingkat Nasional yang diselenggarakan di Universitas Indonesia. Tim yang terdiri dari 3 mahasiswa berhasil mengalahkan 20 tim dari berbagai universitas ternama di Indonesia.\n\nDalam kompetisi ini, peserta ditantang untuk melakukan konfigurasi SAP S/4HANA untuk studi kasus perusahaan manufaktur. Tim ERPify berhasil menyelesaikan konfigurasi modul FI, MM, dan SD dengan sempurna dalam waktu yang ditentukan.\n\nKemenangan ini membuktikan bahwa kompetensi mahasiswa ERPify dalam bidang SAP telah diakui di tingkat nasional dan siap bersaing di dunia profesional.', foto:'' },
            { id:3, icon:'fas fa-users', date:'2026-05-20T14:00:00.000Z', dateDisplay:'20 Mei 2026, 14:00', title:'Pelantikan Anggota Baru Generasi 3 ERPify', desc:'Resmi dilantik 25 anggota baru Generasi 3 yang siap mengembangkan kompetensi ERP.', fullDesc:'Laboratorium ERPify resmi melantik 25 anggota baru Generasi 3 dalam sebuah acara yang digelar di Aula Kampus. Acara pelantikan ini dihadiri oleh dosen pembimbing, pengurus laboratorium, dan para alumni ERPify.\n\nAnggota baru Generasi 3 akan dibagi ke dalam divisi-divisi sesuai minat dan bakat mereka, yaitu SAP, Odoo, Acumatica, ABAP, dan divisi pendukung lainnya. Mereka akan menjalani serangkaian pelatihan dan proyek pengembangan kompetensi ERP selama satu semester ke depan.\n\nDengan bergabungnya anggota baru ini, ERPify semakin solid dan siap untuk terus berkontribusi dalam pengembangan sumber daya manusia di bidang ERP.', foto:'' },
            { id:4, icon:'fas fa-chalkboard-teacher', date:'2026-06-10T09:00:00.000Z', dateDisplay:'10 Juni 2026, 09:00', title:'Seminar Nasional ERP: Masa Depan Digitalisasi Perusahaan', desc:'ERPify menggelar seminar nasional dengan pembicara dari praktisi ERP terkemuka di Indonesia.', fullDesc:'Seminar Nasional bertajuk "Masa Depan Digitalisasi Perusahaan Melalui Implementasi ERP" sukses digelar di Aula Universitas. Acara ini menghadirkan pembicara-pembicara ternama dari perusahaan teknologi terkemuka di Indonesia.\n\nLebih dari 200 peserta dari berbagai universitas dan perusahaan hadir dalam seminar ini. Topik yang dibahas meliputi tren ERP terkini, tantangan implementasi, dan peluang karir di bidang ERP.\n\nSeminar ini menjadi ajang networking dan berbagi pengetahuan antara akademisi, praktisi, dan mahasiswa yang tertarik dengan dunia ERP.', foto:'' },
            { id:5, icon:'fas fa-code', date:'2026-06-05T11:00:00.000Z', dateDisplay:'5 Juni 2026, 11:00', title:'Bootcamp ABAP Programming Batch 2 Dibuka', desc:'Pendaftaran bootcamp ABAP Programming batch 2 telah dibuka untuk mahasiswa aktif.', fullDesc:'ERPify membuka pendaftaran Bootcamp ABAP Programming Batch 2 setelah kesuksesan batch pertama. Program ini dirancang untuk membekali mahasiswa dengan keterampilan pemrograman ABAP yang digunakan dalam ekosistem SAP.\n\nBootcamp akan berlangsung selama 8 minggu dengan materi meliputi dasar ABAP, SAP Dictionary, Report Programming, Module Pool, dan studi kasus implementasi. Peserta akan mendapatkan sertifikat kompetensi setelah menyelesaikan program.\n\nPendaftaran dibuka hingga 30 Juni 2026. Kuota terbatas hanya 30 peserta.', foto:'' },
            { id:6, icon:'fas fa-handshake', date:'2026-05-28T13:00:00.000Z', dateDisplay:'28 Mei 2026, 13:00', title:'ERPify Jalin Kerjasama dengan PT. Tech ERP Solusi', desc:'Kerjasama strategis untuk pengembangan kurikulum dan program magang mahasiswa.', fullDesc:'Laboratorium ERPify resmi menjalin kerjasama strategis dengan PT. Tech ERP Solusi, salah satu perusahaan konsultan ERP terkemuka di Indonesia. Kerjasama ini mencakup pengembangan kurikulum, program magang, dan riset bersama.\n\nMelalui kerjasama ini, mahasiswa ERPify akan mendapatkan kesempatan magang di proyek-proyek implementasi ERP yang sesungguhnya. Selain itu, PT. Tech ERP Solusi juga akan berkontribusi dalam pengembangan materi perkuliahan yang relevan dengan kebutuhan industri.\n\nDiharapkan kerjasama ini dapat meningkatkan kompetensi lulusan dan memperkuat link and match antara dunia pendidikan dan industri.', foto:'' },
            { id:7, icon:'fas fa-laptop-code', date:'2026-05-15T10:00:00.000Z', dateDisplay:'15 Mei 2026, 10:00', title:'Pelatihan Odoo Functional Consultant Angkatan 2', desc:'Pelatihan intensif Odoo Functional Consultant untuk mahasiswa dan umum.', fullDesc:'ERPify menyelenggarakan Pelatihan Odoo Functional Consultant Angkatan 2 setelah sukses dengan angkatan pertama. Pelatihan ini terbuka untuk mahasiswa dan umum yang ingin memperdalam kompetensi di bidang Odoo ERP.\n\nMateri pelatihan mencakup konfigurasi modul Sales, Purchase, Accounting, Inventory, dan HR. Peserta akan belajar langsung dari praktisi Odoo yang berpengalaman dalam implementasi di berbagai perusahaan.\n\nPelatihan diakhiri dengan ujian sertifikasi dan peserta yang lulus akan mendapatkan sertifikat Odoo Functional Consultant dari ERPify.', foto:'' },
            { id:8, icon:'fas fa-award', date:'2026-05-10T09:00:00.000Z', dateDisplay:'10 Mei 2026, 09:00', title:'Mahasiswa ERPify Raih Sertifikasi SAP S/4HANA', desc:'5 mahasiswa ERPify berhasil meraih sertifikasi SAP S/4HANA Associate internasional.', fullDesc:'Lima mahasiswa ERPify berhasil meraih sertifikasi SAP S/4HANA Associate yang diakui secara internasional. Sertifikasi ini diperoleh setelah melalui ujian ketat yang diselenggarakan oleh SAP.\n\nKelima mahasiswa tersebut adalah Ahmad Rizki, Siti Nurhaliza, Budi Prasetyo, Dewi Lestari, dan Rudi Hartono. Mereka telah menjalani persiapan intensif selama 3 bulan yang difasilitasi oleh Laboratorium ERPify.\n\nPencapaian ini membuktikan bahwa ERPify mampu menghasilkan lulusan yang kompeten dan siap bersaing di tingkat global dalam bidang ERP.', foto:'' },
            { id:9, icon:'fas fa-robot', date:'2026-05-05T13:00:00.000Z', dateDisplay:'5 Mei 2026, 13:00', title:'Workshop RPA dan Integrasi ERP untuk Otomasi Bisnis', desc:'Workshop Robotic Process Automation dan integrasinya dengan sistem ERP.', fullDesc:'ERPify bekerja sama dengan perusahaan teknologi menyelenggarakan workshop tentang Robotic Process Automation (RPA) dan integrasinya dengan sistem ERP. Workshop ini diikuti oleh 40 mahasiswa dan dosen.\n\nPeserta mempelajari bagaimana mengotomatisasi proses bisnis berulang menggunakan RPA dan mengintegrasikannya dengan sistem ERP seperti Odoo dan SAP. Materi mencakup pengenalan RPA, studi kasus otomasi, dan praktik langsung menggunakan tools RPA.\n\nWorkshop ini bertujuan untuk membekali peserta dengan keterampilan otomasi yang sangat dibutuhkan di era digital.', foto:'' },
            { id:10, icon:'fas fa-graduation-cap', date:'2026-05-01T10:00:00.000Z', dateDisplay:'1 Mei 2026, 10:00', title:'Program Persiapan Karir ERP untuk Mahasiswa Tingkat Akhir', desc:'Program pembekalan karir bagi mahasiswa tingkat akhir yang ingin berkarir di bidang ERP.', fullDesc:'ERPify meluncurkan Program Persiapan Karir ERP yang ditujukan bagi mahasiswa tingkat akhir. Program ini dirancang untuk menjembatani kesenjangan antara kompetensi akademik dan kebutuhan industri ERP.\n\nProgram mencakup pelatihan teknis, soft skills, simulasi wawancara kerja, dan networking dengan perusahaan mitra. Peserta juga akan mendapatkan bimbingan dalam mempersiapkan portofolio dan sertifikasi ERP.\n\nProgram ini gratis untuk anggota aktif ERPify dan akan berlangsung selama 2 bulan. Pendaftaran dibuka hingga 15 Juni 2026.', foto:'' },
            { id:11, icon:'fas fa-database', date:'2026-04-25T09:00:00.000Z', dateDisplay:'25 April 2026, 09:00', title:'Pelatihan SAP MM (Material Management) untuk Mahasiswa', desc:'Pelatihan intensif modul SAP MM yang mencakup pengelolaan material, purchasing, dan inventory.', fullDesc:'ERPify menyelenggarakan pelatihan khusus modul SAP MM (Material Management) yang diikuti oleh 30 mahasiswa. Pelatihan ini berfokus pada konfigurasi dan praktik langsung pengelolaan material dalam sistem SAP.\n\nMateri pelatihan meliputi master data material, purchasing process, inventory management, valuation, dan reporting. Peserta belajar langsung menggunakan sistem SAP S/4HANA yang disediakan oleh laboratorium.\n\nPelatihan ini merupakan bagian dari program pengembangan kompetensi SAP yang berkelanjutan di ERPify.', foto:'' },
            { id:12, icon:'fas fa-chart-pie', date:'2026-04-20T10:00:00.000Z', dateDisplay:'20 April 2026, 10:00', title:'Workshop Business Intelligence dengan Odoo', desc:'Workshop integrasi Business Intelligence dan dashboard analitik menggunakan platform Odoo.', fullDesc:'Workshop Business Intelligence dengan Odoo sukses digelar dengan menghadirkan praktisi BI dari perusahaan konsultan. Peserta mempelajari cara membangun dashboard analitik dan laporan bisnis menggunakan modul Odoo BI.\n\nTopik yang dibahas mencakup data visualization, pembuatan KPI dashboard, analisis penjualan, dan forecasting menggunakan tools bawaan Odoo. Workshop ini sangat bermanfaat bagi mahasiswa yang tertarik dengan data analytics.\n\nPeserta mendapatkan akses ke template dashboard yang bisa langsung digunakan untuk proyek mereka.', foto:'' },
            { id:13, icon:'fas fa-globe', date:'2026-04-15T08:00:00.000Z', dateDisplay:'15 April 2026, 08:00', title:'Kunjungan Industri ke PT. SAP Indonesia', desc:'Mahasiswa ERPify melakukan kunjungan industri ke kantor PT. SAP Indonesia untuk belajar langsung.', fullDesc:'Sebanyak 25 mahasiswa ERPify melakukan kunjungan industri ke kantor PT. SAP Indonesia yang berlokasi di Jakarta. Kunjungan ini bertujuan untuk memberikan wawasan langsung tentang ekosistem SAP di Indonesia.\n\nMahasiswa berkesempatan untuk berdiskusi dengan para ahli SAP, melihat demo produk terbaru, dan memahami jalur karir di dunia SAP. Kegiatan ini juga menjadi ajang networking antara mahasiswa dan praktisi industri.\n\nKunjungan industri ini diharapkan dapat memotivasi mahasiswa untuk terus mengembangkan kompetensi SAP mereka.', foto:'' },
            { id:14, icon:'fas fa-file-code', date:'2026-04-10T09:00:00.000Z', dateDisplay:'10 April 2026, 09:00', title:'Hackathon Pengembangan Modul Odoo 2026', desc:'Kompetisi hackathon pengembangan modul kustom Odoo antar mahasiswa se-Indonesia.', fullDesc:'ERPify sukses menyelenggarakan Hackathon Pengembangan Modul Odoo 2026 yang diikuti oleh 15 tim dari berbagai universitas. Kompetisi ini menantang peserta untuk mengembangkan modul kustom Odoo dalam waktu 48 jam.\n\nTim ERPify berhasil meraih juara 2 dengan mengembangkan modul manajemen aset sekolah yang terintegrasi dengan Odoo Accounting. Modul ini dinilai inovatif dan siap diimplementasikan.\n\nHackathon ini menjadi ajang pembuktian kemampuan programming dan problem solving mahasiswa dalam ekosistem Odoo.', foto:'' },
            { id:15, icon:'fas fa-hand-holding-heart', date:'2026-04-05T10:00:00.000Z', dateDisplay:'5 April 2026, 10:00', title:'ERPify Mengadakan Bakti Sosial dan Pelatihan ERP untuk UMKM', desc:'Kegiatan bakti sosial dan pelatihan ERP gratis untuk pelaku UMKM di sekitar kampus.', fullDesc:'ERPify mengadakan kegiatan bakti sosial yang dikombinasikan dengan pelatihan ERP gratis untuk pelaku UMKM di sekitar kampus. Kegiatan ini merupakan bentuk kontribusi laboratorium kepada masyarakat.\n\nPelatihan mencakup pengenalan sistem ERP sederhana untuk manajemen stok, penjualan, dan keuangan menggunakan Odoo. Pelaku UMKM sangat antusias karena materi disesuaikan dengan kebutuhan bisnis mereka.\n\nKegiatan ini juga melibatkan mahasiswa sebagai fasilitator, sehingga mereka mendapatkan pengalaman mengajar dan berinteraksi langsung dengan pelaku usaha.', foto:'' },
            { id:16, icon:'fas fa-scroll', date:'2026-04-01T11:00:00.000Z', dateDisplay:'1 April 2026, 11:00', title:'Penerbitan Jurnal Ilmiah ERP oleh Tim Dosen ERPify', desc:'Tim dosen ERPify berhasil menerbitkan jurnal ilmiah tentang implementasi ERP di sektor pendidikan.', fullDesc:'Tim dosen ERPify berhasil menerbitkan jurnal ilmiah internasional yang membahas tentang implementasi sistem ERP di sektor pendidikan tinggi. Jurnal ini terbit di jurnal terindeks Scopus.\n\nPenelitian ini melibatkan survei terhadap 50 perguruan tinggi di Indonesia yang telah mengimplementasikan sistem ERP. Hasil penelitian menunjukkan bahwa adopsi ERP meningkatkan efisiensi operasional hingga 40%.\n\nPublikasi ini menjadi bukti kontribusi ERPify dalam pengembangan ilmu pengetahuan di bidang sistem informasi dan ERP.', foto:'' }
        ],



        sertifikatSAP: [
            { nim:'2201001', nama:'Ahmad Rizki', angkatan:'2022', kelas:'A', jenis:'SAP S/4HANA Associate', nilai:'A', status:'Sudah Bisa Diambil', diambil:'Belum Diambil', pdf:'' },
            { nim:'2201001', nama:'Ahmad Rizki', angkatan:'2022', kelas:'A', jenis:'SAP MM Associate', nilai:'B+', status:'Sudah Bisa Diambil', diambil:'Belum Diambil', pdf:'' },
            { nim:'2201002', nama:'Siti Nurhaliza', angkatan:'2022', kelas:'A', jenis:'SAP FI Associate', nilai:'A-', status:'Sudah Bisa Diambil', diambil:'Sudah Diambil', pdf:'' },
            { nim:'2201003', nama:'Budi Prasetyo', angkatan:'2022', kelas:'B', jenis:'SAP ABAP Professional', nilai:'B+', status:'Sudah Bisa Diambil', diambil:'Belum Diambil', pdf:'' },
            { nim:'2201004', nama:'Dewi Lestari', angkatan:'2022', kelas:'A', jenis:'SAP MM Associate', nilai:'A', status:'Belum Bisa Diambil', diambil:'Belum Diambil', pdf:'' },
            { nim:'2201005', nama:'Rudi Hartono', angkatan:'2022', kelas:'B', jenis:'SAP SD Professional', nilai:'B', status:'Sudah Bisa Diambil', diambil:'Sudah Diambil', pdf:'' }
        ],


        kegiatanLab: [
            { bulan:'Jan', jumlah:5 },
            { bulan:'Feb', jumlah:8 },
            { bulan:'Mar', jumlah:12 },
            { bulan:'Apr', jumlah:7 },
            { bulan:'Mei', jumlah:15 },
            { bulan:'Jun', jumlah:10 }
        ]
    };
}

// ============================================================
// MIGRASI DATA: menyesuaikan data lama (localStorage / database)
// dengan struktur terbaru tanpa menghapus isi yang sudah ada.
// ============================================================
function normalizeData(data) {
    if (!data || typeof data !== 'object') return data;

    // Asprak bukan lagi daftar terpisah (kode asprak melekat pada anggota)
    if ('asprak' in data) delete data.asprak;

    // Dosen: pastikan setiap dosen punya kode
    if (Array.isArray(data.dosen)) {
        data.dosen.forEach(function(d, i) {
            if (typeof d.kode !== 'string' || d.kode === '') {
                d.kode = 'DSN-' + String(i + 1).padStart(2, '0');
            }
        });
    }

    // Mitra: dari daftar teks menjadi objek { nama, logo }
    if (Array.isArray(data.mitra)) {
        data.mitra = data.mitra.map(function(m) {
            if (typeof m === 'string') return { nama: m, logo: '' };
            if (!m || typeof m !== 'object') return { nama: String(m || ''), logo: '' };
            return { nama: m.nama || '', logo: m.logo || '' };
        });
    }

    // Anggota: lengkapi kode dosen pembimbing & kode asprak.
    // Kode asprak melekat pada anggota dan wajib unik - duplikat diberi nomor baru.
    if (data.generasi) {
        let urutAsprak = 0;
        Object.keys(data.generasi).forEach(function(k) {
            const gen = data.generasi[k];
            if (!gen || !Array.isArray(gen.anggota)) return;
            gen.anggota.forEach(function(a) {
                const m = /(\d+)\s*$/.exec(a.kodeAsprak || '');
                if (m) urutAsprak = Math.max(urutAsprak, parseInt(m[1], 10));
            });
        });
        const dipakai = {};
        Object.keys(data.generasi).forEach(function(k) {
            const gen = data.generasi[k];
            if (!gen || !Array.isArray(gen.anggota)) return;
            gen.anggota.forEach(function(a) {
                if (typeof a.kodeDosen !== 'string') a.kodeDosen = '';
                if (typeof a.kodeAsprak !== 'string' || a.kodeAsprak === '' || dipakai[a.kodeAsprak]) {
                    urutAsprak++;
                    a.kodeAsprak = 'ASP-' + String(urutAsprak).padStart(2, '0');
                }
                dipakai[a.kodeAsprak] = true;
            });
        });
    }

    // Pengaturan halaman: lengkapi halaman yang belum ada
    if (!data.pageSettings || typeof data.pageSettings !== 'object') data.pageSettings = {};
    ['beranda', 'dosen', 'matakuliah', 'kerjasama', 'berita', 'sertifikat'].forEach(function(k) {
        if (!data.pageSettings[k]) data.pageSettings[k] = { subtitle: '' };
    });

    // Sertifikat: acuan utama NIM, foto tidak dipakai lagi (sudah ada upload PDF)
    if (Array.isArray(data.sertifikatSAP)) {
        data.sertifikatSAP.forEach(function(s) {
            if (typeof s.nim !== 'string') s.nim = '';
            if (typeof s.nama !== 'string') s.nama = '';
            if (typeof s.jenis !== 'string') s.jenis = '';
            if ('foto' in s) delete s.foto;
        });
    }

    return data;
}

// ===== HELPER DOSEN / MITRA =====
function dosenLabel(d) {
    if (!d) return '';
    return (d.kode ? d.kode + ' - ' : '') + (d.nama || '');
}

function getDosenByKode(kode) {
    if (!kode) return null;
    const data = getData();
    return (data.dosen || []).find(function(d) { return d.kode === kode; }) || null;
}

// Label "Kode - Nama" untuk dosen pembimbing mahasiswa
function anggotaDosenLabel(a) {
    if (!a) return '';
    const d = getDosenByKode(a.kodeDosen);
    if (d) return dosenLabel(d);
    return a.kodeDosen || '';
}

// Kode asprak melekat pada mahasiswa (anggota laboratorium)
function anggotaAsprakLabel(a) {
    if (!a) return '';
    return a.kodeAsprak || '';
}

// Kode anggota berikutnya (kode asprak melekat pada anggota)
function generateKodeAsprak() {
    const data = getData();
    let max = 0;
    Object.keys(data.generasi || {}).forEach(function(k) {
        const gen = data.generasi[k];
        if (!gen || !Array.isArray(gen.anggota)) return;
        gen.anggota.forEach(function(a) {
            const m = /(\d+)\s*$/.exec(a.kodeAsprak || '');
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
    });
    return 'ASP-' + String(max + 1).padStart(2, '0');
}

// Kode otomatis untuk dosen & asprak (bisa diubah manual oleh admin)
function generateKodeDosen() {
    const data = getData();
    let max = 0;
    (data.dosen || []).forEach(function(d) {
        const m = /(\d+)\s*$/.exec(d.kode || '');
        if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'DSN-' + String(max + 1).padStart(2, '0');
}

// Label "Kode - Nama" mahasiswa (kode asprak melekat pada anggota)
function anggotaLabel(a) {
    if (!a) return '';
    return (a.kodeAsprak ? a.kodeAsprak + ' - ' : '') + (a.nama || '');
}

// Susun <option> untuk daftar berkode (ditampilkan sebagai "Kode - Nama")
function opsiKodeNama(daftar, kodeTerpilih, fnLabel) {
    let html = '<option value="">-- Belum dipilih --</option>';
    (daftar || []).forEach(function(x) {
        const dipilih = (x.kode === kodeTerpilih) ? ' selected' : '';
        html += '<option value="' + escapeHtml(x.kode) + '"' + dipilih + '>' + escapeHtml(fnLabel(x)) + '</option>';
    });
    return html;
}

// Isi dropdown dosen & kolom kode asprak pada form anggota
function isiSelectAnggota(kodeDosen, kodeAsprak) {
    const data = getData();
    const selDosen = document.getElementById('agKodeDosen');
    if (selDosen) selDosen.innerHTML = opsiKodeNama(data.dosen, kodeDosen || '', dosenLabel);
    const inputAsprak = document.getElementById('agKodeAsprak');
    if (inputAsprak) inputAsprak.value = kodeAsprak || generateKodeAsprak();
}

// Mitra bisa berupa teks (data lama) atau objek { nama, logo }
function mitraNama(m) {
    if (typeof m === 'string') return m;
    return (m && m.nama) ? m.nama : '';
}

function mitraLogo(m) {
    return (m && typeof m === 'object' && m.logo) ? m.logo : '';
}

function getLocalData() {
    // RESET TOTAL: selalu pakai data default baru
    // Data lama di localStorage akan dihapus dan diganti dengan data default terbaru
    const fresh = getDefaultData();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Ambil data yang sudah dimodifikasi admin (platform, dosen, mitra, dll)
            // Tapi PAKSA adminAccount dari data default (password terbaru)
            fresh.adminAccount = parsed.adminAccount || fresh.adminAccount;
            // Update password ke yang terbaru
            fresh.adminAccount.password = 'erpify123';
            fresh.adminAccount.username = 'admin';
            // Ambil data lainnya dari localStorage jika ada
            if (parsed.platforms) fresh.platforms = parsed.platforms;
            if (parsed.dosen) fresh.dosen = parsed.dosen;
            if (parsed.mitra) fresh.mitra = parsed.mitra;
            if (parsed.generasi) fresh.generasi = parsed.generasi;
            if (parsed.berita) fresh.berita = parsed.berita;
            if (parsed.sertifikatSAP) fresh.sertifikatSAP = parsed.sertifikatSAP;
            if (parsed.kegiatanLab) fresh.kegiatanLab = parsed.kegiatanLab;
            if (parsed.pageSettings) fresh.pageSettings = parsed.pageSettings;
            if (parsed.pageOrder) fresh.pageOrder = parsed.pageOrder;
            // Simpan kembali data yang sudah diperbaiki
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
            return fresh;
        } catch(e) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
            return fresh;
        }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
}



// Data aktif: dari API bila tersedia, jika tidak dari localStorage/default
function getData() {
    if (!erpifyDataCache) {
        erpifyDataCache = normalizeData(getLocalData());
    }
    return erpifyDataCache;
}

function saveData(data) {
    erpifyDataCache = data;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    if (!erpifyApiAvailable) return;
    // Kredensial admin tidak dikirim ke server: password dikelola di tabel erpify_admin
    let payload = data;
    if (payload && payload.adminAccount) {
        payload = Object.assign({}, payload);
        delete payload.adminAccount;
    }
    erpifyApiFetch('data.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
    }).then(function(res) {
        return res.json().then(function(json) {
            return { status: res.status, json: json };
        }).catch(function() {
            return { status: res.status, json: null };
        });
    }).then(function(r) {
        if (!r.json || r.json.ok !== true) {
            if (r.status === 401) {
                erpifyToast('Sesi admin berakhir. Silakan login ulang - perubahan terakhir belum tersimpan di server.', 'error');
            } else {
                erpifyToast((r.json && r.json.error) ? r.json.error : 'Gagal menyimpan data ke server.', 'error');
            }
        }
    }).catch(function() {
        erpifyToast('Tidak dapat terhubung ke server. Perubahan belum tersimpan permanen.', 'error');
    });
}

// ===== NAVBAR TOGGLE & SCROLL =====
function initNavbar() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('navMenu');
    if (toggle && menu) {
        toggle.addEventListener('click', function(){
            this.classList.toggle('active');
            menu.classList.toggle('active');
        });
    }
    document.querySelectorAll('.nav-menu a').forEach(l=>l.addEventListener('click',()=>{
        if (toggle && menu) { toggle.classList.remove('active'); menu.classList.remove('active'); }
    }));
    document.querySelectorAll('.nav-dropdown > a').forEach(el => {
        el.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) { e.preventDefault(); this.parentElement.classList.toggle('open'); }
        });
    });
    window.addEventListener('scroll',()=>{
        const nav = document.getElementById('navbar');
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
    });
}

function initFadeIn() {
    const observer = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{
            if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
        });
    }, {threshold:0.1});
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ===== PLATFORMS =====
function renderPlatforms() {
    const data = getData();
    const grid = document.getElementById('platformsGrid');
    if (!grid) return;
    grid.innerHTML = data.platforms.map(p => `<div class="platform-card fade-in"><div class="icon"><i class="${p.icon}"></i></div><h4>${p.name}</h4><p>${p.desc}</p></div>`).join('');
}

// ===== DOSEN =====
function renderDosen() {
    const data = getData();
    const grid = document.getElementById('dosenGrid');
    if (!grid) return;
    grid.innerHTML = data.dosen.map(function(d) {
        return '<div class="dosen-card fade-in">'
            + '<div class="photo" style="' + (d.foto ? 'background:transparent;' : '') + '">'
            + (d.foto ? '<img src="' + d.foto + '" alt="' + escapeHtml(d.nama) + '" style="width:100%;height:100%;object-fit:cover;">' : '<i class="fas fa-user-tie"></i>')
            + '</div>'
            + '<div class="info">'
            + '<h4>' + escapeHtml(dosenLabel(d)) + '</h4>'
            + '<div class="jabatan">' + escapeHtml(d.jabatan) + '</div>'
            + '<div class="keahlian">' + escapeHtml(d.keahlian) + '</div>'
            + '<div class="tags">' + (d.tags || []).map(function(t) { return '<span>' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
            + '</div></div>';
    }).join('');
}

// ===== MITRA =====
function renderMitra() {
    const data = getData();
    const grid = document.getElementById('mitraGrid');
    if (!grid) return;
    grid.innerHTML = (data.mitra || []).map(function(m) {
        const nama = mitraNama(m);
        const logo = mitraLogo(m);
        return '<div class="mitra-card">'
            + '<div class="mitra-logo">'
            + (logo ? '<img src="' + logo + '" alt="Logo ' + escapeHtml(nama) + '">' : '<i class="fas fa-building"></i>')
            + '</div>'
            + '<h4>' + escapeHtml(nama) + '</h4>'
            + '</div>';
    }).join('');
}

// Statistik jumlah mitra untuk hero halaman kerjasama
function renderMitraStats() {
    const data = getData();
    const el = document.getElementById('mitraTotalCount');
    if (el) el.textContent = data.mitra.length;
}

// ===== GENERASI & ANGGOTA =====
function renderGenerasiSelect() {
    const data = getData();
    const select = document.getElementById('generasiSelect');
    if (!select) return;
    select.innerHTML = Object.keys(data.generasi).map(k => `<option value="${k}">${data.generasi[k].title}</option>`).join('');
    renderAnggota(select.value);
}

function renderAnggota(genKey) {
    const data = getData();
    const gen = data.generasi[genKey];
    if (!gen) return;
    const title = document.getElementById('genTitle');
    const desc = document.getElementById('genDesc');
    if (title) title.textContent = gen.title;
    if (desc) desc.textContent = gen.desc;
    const grid = document.getElementById('anggotaGrid');
    if (!grid) return;
    grid.innerHTML = gen.anggota.map(function(a) {
        const dosen = anggotaDosenLabel(a);
        return '<div class="anggota-card fade-in">'
            + '<div class="avatar" style="' + (a.foto ? 'background:transparent;padding:0;overflow:hidden;' : '') + '">'
            + (a.foto ? '<img src="' + a.foto + '" alt="' + escapeHtml(a.nama) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">' : escapeHtml((a.nama || '?').charAt(0)))
            + '</div>'
            + '<h4>' + escapeHtml(anggotaLabel(a)) + '</h4>'
            + '<div class="nim">' + escapeHtml(a.nim) + '</div>'
            + '<div class="jabatan-anggota">' + escapeHtml(a.jabatan) + '</div>'
            + '<div class="divisi">' + escapeHtml(a.divisi) + '</div>'
            + (dosen ? '<div class="anggota-pembimbing"><span>Dosen</span>' + escapeHtml(dosen) + '</div>' : '')
            + '</div>';
    }).join('');
    setTimeout(function() { document.querySelectorAll('#anggotaGrid .fade-in').forEach(function(el) { el.classList.add('visible'); }); }, 100);
}

// ===== BERITA =====
function renderBerita() {
    const data = getData();
    const grid = document.getElementById('beritaGrid');
    if (!grid) return;
    // Cek apakah ini halaman beranda (index.html) atau halaman berita (berita.html)
    const isBeranda = !document.body.dataset.page || document.body.dataset.page === 'beranda';
    const beritaToShow = isBeranda ? data.berita.slice(0, 6) : data.berita;
    grid.innerHTML = beritaToShow.map(b => `<div class="berita-card fade-in"><div class="thumbnail" style="${b.foto?'background:transparent;':''}">${b.foto?`<img src="${b.foto}" alt="${b.title}" style="width:100%;height:100%;object-fit:cover;">`:`<i class="${b.icon}"></i>`}</div><div class="content"><div class="date"><i class="far fa-calendar"></i> ${b.dateDisplay || b.date}</div><h4>${b.title}</h4><p>${b.desc}</p><a href="javascript:void(0)" class="read-more" onclick="openBeritaModal(${b.id})">Baca Selengkapnya <i class="fas fa-arrow-right"></i></a></div></div>`).join('');

    // Jika di halaman beranda dan berita lebih dari 6, tambahkan link "Lihat Berita Lainnya"
    if (isBeranda && data.berita.length > 6) {
        const linkWrap = document.createElement('div');
        linkWrap.style.cssText = 'text-align:center;margin-top:32px;';
        linkWrap.innerHTML = '<a href="berita.html" class="btn btn-primary-outline"><i class="fas fa-newspaper"></i> Lihat Berita Lainnya <i class="fas fa-arrow-right"></i></a>';
        grid.parentNode.appendChild(linkWrap);
    }
}


// ===== BERITA MODAL =====
function openBeritaModal(id) {
    const data = getData();
    const b = data.berita.find(x => x.id === id);
    if (!b) return;
    const overlay = document.getElementById('beritaModalOverlay');
    if (!overlay) return;
    const img = document.getElementById('beritaModalImg');
    if (img) { img.src = b.foto || ''; img.style.display = b.foto ? 'block' : 'none'; }
    const dateEl = document.getElementById('beritaModalDate');
    if (dateEl) dateEl.textContent = b.dateDisplay || b.date;

    const titleEl = document.getElementById('beritaModalTitle');
    if (titleEl) titleEl.textContent = b.title;
    const descEl = document.getElementById('beritaModalDesc');
    if (descEl) descEl.textContent = b.fullDesc || b.desc;
    overlay.classList.add('active');
}

function closeBeritaModal() {
    const overlay = document.getElementById('beritaModalOverlay');
    if (overlay) overlay.classList.remove('active');
}

// ===== MATA KULIAH =====
function renderMK() {
    const grid = document.getElementById('mkGrid');
    if (!grid) return;
    const mkData = [
        { icon:'fas fa-users-cog', name:'Human Resources (ERP HR)', code:'HRM - ERP', desc:'Mempelajari sistem manajemen SDM berbasis ERP, meliputi rekrutmen, payroll, manajemen kinerja.', kompetensi:['Konfigurasi modul HR Odoo & SAP','Manajemen data karyawan terpusat','Proses payroll dan benefit otomatis'] },
        { icon:'fas fa-truck', name:'Supply Chain Management (SCM ERP)', code:'SCM - ERP', desc:'Mendalami manajemen rantai pasok enterprise, dari procurement, inventory, warehouse, hingga distribusi.', kompetensi:['Manajemen inventori multi-warehouse','Optimasi supply chain dengan ERP','Integrasi procurement & vendor'] },
        { icon:'fas fa-server', name:'Sistem Enterprise', code:'SIE - ERP', desc:'Konsep dasar dan implementasi sistem enterprise skala perusahaan. Arsitektur ERP dan best practice.', kompetensi:['Arsitektur dan modul ERP','Metodologi implementasi ERP','Business process reengineering'] },
        { icon:'fas fa-calculator', name:'Accounting (ERP Akuntansi)', code:'ACC - ERP', desc:'Sistem akuntansi dan keuangan berbasis ERP. General ledger, AP/AR, fixed asset, financial reporting.', kompetensi:['Konfigurasi modul akuntansi ERP','Financial reporting & analisis','Manajemen pajak dan audit'] },
        { icon:'fas fa-code', name:'Configuration ABAP', code:'ABAP - ERP', desc:'Konfigurasi dan pemrograman dasar ABAP untuk SAP ERP. Dictionary, report, module pool.', kompetensi:['Dasar pemrograman ABAP','SAP Dictionary & Data Element','Report & Module Pool Programming'] }
    ];
    grid.innerHTML = mkData.map(m => `<div class="mk-card fade-in"><div class="icon"><i class="${m.icon}"></i></div><h4>${m.name}</h4><div class="mk-code">${m.code}</div><p>${m.desc}</p><div class="kompetensi"><h5>Kompetensi:</h5><ul>${m.kompetensi.map(k=>`<li><i class="fas fa-check-circle"></i> ${k}</li>`).join('')}</ul></div></div>`).join('');
}

// ===== CEK SERTIFIKAT =====
// Ubah NIM menjadi bentuk seragam untuk pencocokan (abaikan spasi & tanda)
function normalizeNim(nilai) {
    return String(nilai == null ? '' : nilai).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

// Amankan teks sebelum dimasukkan ke HTML
function escapeHtml(teks) {
    return String(teks == null ? '' : teks)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Satu baris informasi di dalam kartu sertifikat
function barisInfoSertifikat(label, nilai) {
    return '<div class="sertifikat-row"><span class="lbl">' + label + '</span><span class="val">' + nilai + '</span></div>';
}

// Satu kartu sertifikat (satu mahasiswa bisa punya beberapa sertifikat)
function kartuSertifikat(s) {
    const sudahDiambil = s.diambil === 'Sudah Diambil';
    const bisaDiambil = s.status === 'Sudah Bisa Diambil';

    const badgeKelayakan = bisaDiambil
        ? '<span class="sertif-pill ok"><i class="fas fa-check-circle"></i> Sudah bisa diambil</span>'
        : '<span class="sertif-pill wait"><i class="fas fa-clock"></i> Belum bisa diambil</span>';
    const badgeDiambil = sudahDiambil
        ? '<span class="sertif-pill ok"><i class="fas fa-check-double"></i> Sudah diambil</span>'
        : '<span class="sertif-pill wait"><i class="fas fa-box"></i> Belum diambil</span>';

    const pdfUrl = getSertifikatPdfUrl(s);
    const namaFile = s.nomor + '.pdf';

    const pembayaran = (!sudahDiambil && bisaDiambil)
        ? '<div class="sertifikat-payment"><p><strong><i class="fas fa-info-circle"></i> Informasi Pembayaran Sertifikat</strong></p>'
            + '<p>Silakan lakukan pembayaran biaya sertifikat ke rekening <strong>Bank Mandiri 123-00-4567890 a.n. Laboratorium ERPify</strong>. '
            + 'Setelah transfer, konfirmasi bukti bayar ke admin laboratorium.</p></div>'
        : '';

    return '<div class="sertifikat-card">'
        + '<div class="sertifikat-card-head">'
        + '<i class="fas fa-certificate"></i>'
        + '<div class="sertifikat-card-title"><h5>' + escapeHtml(s.jenis) + '</h5></div>'
        + '<span class="sertif-nilai">' + escapeHtml(s.nilai || '-') + '</span>'
        + '</div>'
        + '<div class="sertifikat-card-body">'
        + barisInfoSertifikat('Nama', escapeHtml(s.nama))
        + barisInfoSertifikat('NIM', escapeHtml(s.nim))
        + barisInfoSertifikat('Angkatan', escapeHtml(s.angkatan || '-'))
        + barisInfoSertifikat('Kelas', escapeHtml(s.kelas || '-'))
        + barisInfoSertifikat('Status Kelayakan', badgeKelayakan)
        + barisInfoSertifikat('Status Pengambilan', badgeDiambil)
        + '</div>'
        + pembayaran
        + '<div class="sertifikat-actions" style="display:none;">'
        + '<a class="btn btn-primary" href="' + pdfUrl + '" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i> Lihat Sertifikat</a>'
        + '<a class="btn btn-outline btn-download" href="' + pdfUrl + '" download="' + escapeHtml(namaFile) + '"><i class="fas fa-download"></i> Unduh Sertifikat</a>'
        + '</div>'
        + '<p class="sertifikat-nofile" style="display:none;"><i class="fas fa-info-circle"></i> File PDF sertifikat ini belum tersedia. Silakan hubungi admin laboratorium.</p>'
        + '</div>';
}

// Tampilkan tombol Lihat/Unduh hanya bila file PDF benar-benar ada
function cekFileSertifikat(s, kartu) {
    if (!kartu) return;
    const aksi = kartu.querySelector('.sertifikat-actions');
    const kosong = kartu.querySelector('.sertifikat-nofile');
    if (!aksi) return;

    const tampil = function() {
        aksi.style.display = 'flex';
        if (kosong) kosong.style.display = 'none';
    };
    const sembunyi = function() {
        aksi.style.display = 'none';
        if (kosong) kosong.style.display = 'block';
    };

    const url = getSertifikatPdfUrl(s);
    if (!url) { sembunyi(); return; }
    if (url.indexOf('data:') === 0 || url.indexOf('://') > -1 || url.charAt(0) === '/') { tampil(); return; }
    if (typeof fetch !== 'function' || window.location.protocol === 'file:') { sembunyi(); return; }

    fetch(url, { method: 'HEAD', cache: 'no-store' })
        .then(function(res) { if (res && res.ok) { tampil(); } else { sembunyi(); } })
        .catch(function() { sembunyi(); });
}

// ===== CEK SERTIFIKAT BERDASARKAN NIM =====
// Satu NIM dapat memiliki lebih dari satu sertifikat; semuanya ditampilkan
// sebagai kartu terpisah dengan tombol Lihat & Unduh masing-masing.
function cekSertifikat() {
    const input = document.getElementById('sertifikatInput');
    const result = document.getElementById('sertifikatResult');
    if (!input || !result) return;

    const nim = input.value.trim();
    if (!nim) {
        result.className = 'sertifikat-result invalid';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i><h4>Masukkan NIM</h4><p>Silakan masukkan NIM Anda terlebih dahulu untuk melihat sertifikat.</p>';
        return;
    }

    const data = getData();
    const kunci = normalizeNim(nim);
    const daftar = (data.sertifikatSAP || []).filter(function(s) {
        return normalizeNim(s.nim) === kunci;
    });

    if (daftar.length === 0) {
        result.className = 'sertifikat-result invalid';
        result.innerHTML = '<i class="fas fa-times-circle"></i><h4>Data Tidak Ditemukan</h4>'
            + '<p>NIM "<strong>' + escapeHtml(nim) + '</strong>" belum terdaftar pada data sertifikasi ERPify. '
            + 'Silakan periksa kembali NIM Anda atau hubungi admin laboratorium.</p>';
        return;
    }

    const nama = daftar[0].nama || '';
    result.className = 'sertifikat-result valid';
    result.innerHTML = '<i class="fas fa-check-circle"></i>'
        + '<h4>Sertifikat Ditemukan (' + daftar.length + ')</h4>'
        + '<p>NIM <strong>' + escapeHtml(nim) + '</strong>' + (nama ? ' &middot; ' + escapeHtml(nama) : '') + '</p>'
        + '<div class="sertifikat-list">' + daftar.map(kartuSertifikat).join('') + '</div>';

    const kartuList = result.querySelectorAll('.sertifikat-card');
    daftar.forEach(function(s, i) {
        cekFileSertifikat(s, kartuList[i]);
    });
}


// ===== FILE PDF SERTIFIKAT =====
const SERTIFIKAT_PDF_DIR = 'sertifikat/';

// URL PDF sertifikat: pakai file hasil upload admin.
// Data lama yang masih punya kode sertifikasi memakai cadangan sertifikat/<KODE>.pdf
function getSertifikatPdfUrl(sertifikat) {
    if (!sertifikat) return '';
    if (sertifikat.pdf) return sertifikat.pdf;
    if (sertifikat.nomor) return SERTIFIKAT_PDF_DIR + sertifikat.nomor + '.pdf';
    return '';
}


// Unggah PDF sertifikat untuk satu baris pada form sertifikasi
function handleSertifikatPdfUploadRow(input) {
    const baris = input.closest ? input.closest('.sertif-row') : null;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        alert('File harus berformat PDF!');
        input.value = '';
        return;
    }
    const status = baris ? baris.querySelector('.row-pdf-status') : null;
    const target = baris ? baris.querySelector('.row-pdf') : null;

    if (!(typeof uploadFileToApi === 'function' && apiIsEnabled())) {
        if (status) status.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#d97706;"></i> Backend belum aktif - PDF belum dapat diunggah.';
        input.value = '';
        return;
    }

    if (status) status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';
    uploadFileToApi(file, 'sertifikat').then(function(res) {
        if (res && res.url) {
            if (target) target.value = res.url;
            if (status) status.innerHTML = '<i class="fas fa-check-circle" style="color:#16a34a;"></i> Terunggah: ' + (res.fileName || res.url);
        } else if (status) {
            status.innerHTML = '<i class="fas fa-times-circle" style="color:#dc2626;"></i> Gagal mengunggah.';
        }
    }).catch(function() {
        if (status) status.innerHTML = '<i class="fas fa-times-circle" style="color:#dc2626;"></i> Gagal mengunggah (server tidak merespons).';
    });
}


function applyPageSettings() {
    const data = getData();
    const page = document.body.dataset.page;
    if (!page) return;
    const setting = data.pageSettings[page];
    if (!setting) return;
    // Coba cari di page-hero (halaman dalam) atau hero-text p (halaman beranda)
    let heroP = document.querySelector('.page-hero p');
    if (!heroP) {
        heroP = document.querySelector('.hero-text p');
    }
    if (!heroP) return;
    
    let html = '';
    if (setting.subtitle) {
        html += setting.subtitle;
    }
    // Render dropdown items jika ada
    if (setting.dropdownItems && setting.dropdownItems.length > 0) {
        html += '<div class="hero-dropdown-wrap">';
        setting.dropdownItems.forEach((item, idx) => {
            const isOpen = item._open || false;
            html += '<div class="hero-dropdown-item'+(isOpen?' open':'')+'">';
            html += '<button class="hero-dropdown-btn" onclick="toggleHeroDropdown(this)">';
            html += '<span>'+item.label+'</span>';
            html += '<i class="fas fa-chevron-down"></i>';
            html += '</button>';
            html += '<div class="hero-dropdown-content" style="display:'+(isOpen?'block':'none')+';">'+item.content+'</div>';
            html += '</div>';
        });
        html += '</div>';
    }
    heroP.innerHTML = html;
}

function toggleHeroDropdown(btn) {
    const parent = btn.parentElement;
    const content = parent.querySelector('.hero-dropdown-content');
    if (content) {
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
        parent.classList.toggle('open', !isOpen);
    }
}



// ============================================================
// ADMIN FUNCTIONS
// ============================================================
let nextId = 100;

function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ===== ICON SELECT DROPDOWN =====
function updateIconPreview(selectEl, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    const val = selectEl.value;
    preview.innerHTML = '<i class="'+val+'"></i> <span>'+val+'</span>';
}

function setupUpload(inputId, previewId, wrapperId) {

    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const wrapper = document.getElementById(wrapperId);
    if (!input || !preview || !wrapper) return;

    const tampilkan = function(src) {
        preview.src = src;
        preview.style.display = 'block';
        wrapper.classList.add('has-image');
        const icon = wrapper.querySelector('i');
        const p = wrapper.querySelector('p');
        if (icon) icon.style.display = 'none';
        if (p) p.style.display = 'none';
    };

    // Proses file (setelah dipotong, atau langsung bila tidak perlu potong)
    const proses = function(file) {
        const kategori = ERPIFY_UPLOAD_CATEGORY[inputId] || 'umum';
        if (apiIsEnabled()) {
            const infoLama = wrapper.querySelector('p') ? wrapper.querySelector('p').innerHTML : '';
            if (wrapper.querySelector('p')) wrapper.querySelector('p').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';
            uploadFileToApi(file, kategori).then(function(res) {
                tampilkan(res.url);
                erpifyToast('File berhasil diunggah ke server.', 'success');
            }).catch(function(err) {
                erpifyToast('Upload gagal: ' + (err && err.message ? err.message : 'kesalahan tidak diketahui'), 'error');
                if (wrapper.querySelector('p')) wrapper.querySelector('p').innerHTML = infoLama;
            });
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            tampilkan(e.target.result);
        };
        reader.readAsDataURL(file);
    };

    wrapper.addEventListener('click', function(e) {
        if (e.target !== input) {
            input.click();
        }
    });

    input.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const perluCrop = ERPIFY_CROP_INFO[inputId] && String(file.type || '').indexOf('image/') === 0;
        if (perluCrop) {
            bukaCropModal(inputId, file, proses, this);
            return;
        }
        proses(file);
    });
}

// ============================================================
// ATUR POSISI FOTO (CROP) SEBELUM DIUNGGAH - tanpa library tambahan
// ============================================================
const ERPIFY_CROP_INFO = {
    dsFotoInput: { rasio: 1, lebar: 600, tinggi: 600, label: 'Foto profil dosen (1:1)' },
    agFotoInput: { rasio: 1, lebar: 600, tinggi: 600, label: 'Foto profil anggota (1:1)' },
    brFotoInput: { rasio: 16 / 9, lebar: 1024, tinggi: 576, label: 'Gambar cover berita (16:9)' }
};

let cropState = null;

function bukaCropModal(inputId, file, callback, inputEl) {
    if (!ERPIFY_CROP_INFO[inputId]) return;
    const gambar = new Image();
    const reader = new FileReader();
    reader.onload = function(e) {
        gambar.onload = function() {
            tampilkanCrop(inputId, gambar, callback, inputEl);
        };
        gambar.onerror = function() {
            erpifyToast('Gambar tidak dapat dibaca.', 'error');
            if (inputEl) inputEl.value = '';
        };
        gambar.src = e.target.result;
    };
    reader.onerror = function() {
        erpifyToast('Gagal membaca file gambar.', 'error');
        if (inputEl) inputEl.value = '';
    };
    reader.readAsDataURL(file);
}

function tampilkanCrop(inputId, gambar, callback, inputEl) {
    const canvas = document.getElementById('cropCanvas');
    const info = ERPIFY_CROP_INFO[inputId];
    if (!canvas || !info) return;

    const lebarTampil = 480;
    const tinggiTampil = Math.round(lebarTampil / info.rasio);
    canvas.width = lebarTampil;
    canvas.height = tinggiTampil;

    const minSkala = Math.max(lebarTampil / gambar.width, tinggiTampil / gambar.height);
    cropState = {
        inputId: inputId,
        info: info,
        gambar: gambar,
        canvas: canvas,
        callback: callback,
        inputEl: inputEl,
        minSkala: minSkala,
        skala: minSkala,
        x: (lebarTampil - gambar.width * minSkala) / 2,
        y: (tinggiTampil - gambar.height * minSkala) / 2,
        drag: false
    };

    const hint = document.getElementById('cropHint');
    if (hint) hint.textContent = info.label + ' - geser foto dan atur zoom agar hasilnya pas.';
    const slider = document.getElementById('cropZoom');
    if (slider) slider.value = '1';

    gambarCrop();
    openModal('modalCrop');
}

function batasiCrop() {
    const s = cropState;
    if (!s) return;
    const w = s.gambar.width * s.skala;
    const h = s.gambar.height * s.skala;
    s.x = Math.min(0, Math.max(s.canvas.width - w, s.x));
    s.y = Math.min(0, Math.max(s.canvas.height - h, s.y));
}

function gambarCrop() {
    const s = cropState;
    if (!s) return;
    const ctx = s.canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
    ctx.drawImage(s.gambar, s.x, s.y, s.gambar.width * s.skala, s.gambar.height * s.skala);
}

function initCropCanvas() {
    const canvas = document.getElementById('cropCanvas');
    if (!canvas || canvas._siapCrop) return;
    canvas._siapCrop = true;

    const posisiLokal = function(klienX, klienY) {
        const kotak = canvas.getBoundingClientRect();
        return { x: klienX - kotak.left, y: klienY - kotak.top };
    };
    const mulai = function(px, py) {
        if (!cropState) return;
        cropState.drag = true;
        cropState.px = px;
        cropState.py = py;
    };
    const gerak = function(px, py) {
        if (!cropState || !cropState.drag) return;
        cropState.x += px - cropState.px;
        cropState.y += py - cropState.py;
        cropState.px = px;
        cropState.py = py;
        batasiCrop();
        gambarCrop();
    };
    const berhenti = function() {
        if (cropState) cropState.drag = false;
    };

    canvas.addEventListener('mousedown', function(e) {
        mulai(e.offsetX, e.offsetY);
        e.preventDefault();
    });
    canvas.addEventListener('mousemove', function(e) {
        gerak(e.offsetX, e.offsetY);
    });
    window.addEventListener('mouseup', berhenti);
    canvas.addEventListener('touchstart', function(e) {
        const t = e.touches[0];
        const p = posisiLokal(t.clientX, t.clientY);
        mulai(p.x, p.y);
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
        const t = e.touches[0];
        const p = posisiLokal(t.clientX, t.clientY);
        gerak(p.x, p.y);
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', berhenti);

    const slider = document.getElementById('cropZoom');
    if (slider) {
        slider.addEventListener('input', function() {
            if (!cropState) return;
            const lama = cropState.skala;
            const baru = cropState.minSkala * parseFloat(this.value || '1');
            const cx = cropState.canvas.width / 2;
            const cy = cropState.canvas.height / 2;
            cropState.x = cx - (cx - cropState.x) * (baru / lama);
            cropState.y = cy - (cy - cropState.y) * (baru / lama);
            cropState.skala = baru;
            batasiCrop();
            gambarCrop();
        });
    }
}

function tutupCropModal() {
    const s = cropState;
    cropState = null;
    if (s && s.inputEl) s.inputEl.value = '';
    closeModal('modalCrop');
}

function terapkanCrop() {
    const s = cropState;
    if (!s) return;

    const keluar = document.createElement('canvas');
    keluar.width = s.info.lebar;
    keluar.height = s.info.tinggi;
    const k = s.info.lebar / s.canvas.width;
    const ctx = keluar.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, keluar.width, keluar.height);
    ctx.drawImage(s.gambar, s.x * k, s.y * k, s.gambar.width * s.skala * k, s.gambar.height * s.skala * k);

    const callback = s.callback;
    const inputEl = s.inputEl;

    const selesai = function(blob) {
        const fileBaru = new File([blob], 'foto_' + Date.now() + '.jpg', { type: 'image/jpeg' });
        cropState = null;
        if (inputEl) inputEl.value = '';
        closeModal('modalCrop');
        if (callback) callback(fileBaru);
        erpifyToast('Foto sudah dipotong sesuai bingkai.', 'success');
    };

    if (keluar.toBlob) {
        keluar.toBlob(function(blob) {
            if (blob) {
                selesai(blob);
            } else {
                erpifyToast('Gagal memproses foto.', 'error');
            }
        }, 'image/jpeg', 0.92);
    } else {
        const dataUrl = keluar.toDataURL('image/jpeg', 0.92);
        selesai(dataUrlToFile(dataUrl, 'foto_' + Date.now() + '.jpg'));
    }
}

// Ubah data URL menjadi File (untuk peramban lama yang tanpa canvas.toBlob)
function dataUrlToFile(dataUrl, namaFile) {
    const bagian = String(dataUrl).split(',');
    const mime = (bagian[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const biner = atob(bagian[1] || '');
    const buf = new Uint8Array(biner.length);
    for (let i = 0; i < biner.length; i++) buf[i] = biner.charCodeAt(i);
    return new File([buf], namaFile, { type: mime });
}


// ===== DASHBOARD =====
function renderDashboard() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    const totalKegiatan = data.kegiatanLab.reduce((sum, k) => sum + k.jumlah, 0);
    const totalBerita = data.berita.length;
    const totalAnggota = Object.values(data.generasi).reduce((sum, g) => sum + g.anggota.length, 0);
    const totalSertifikat = data.sertifikatSAP.length;
    const totalMitra = data.mitra.length;
    const maxKegiatan = Math.max(...data.kegiatanLab.map(k => k.jumlah), 1);
    container.innerHTML = '<div class="dashboard-grid">'+
        '<div class="dashboard-card"><div class="d-icon blue"><i class="fas fa-flask"></i></div><div class="d-number">'+totalKegiatan+'</div><div class="d-label">Total Kegiatan Lab</div></div>'+
        '<div class="dashboard-card"><div class="d-icon green"><i class="fas fa-newspaper"></i></div><div class="d-number">'+totalBerita+'</div><div class="d-label">Total Berita Terbit</div></div>'+
        '<div class="dashboard-card"><div class="d-icon orange"><i class="fas fa-users"></i></div><div class="d-number">'+totalAnggota+'</div><div class="d-label">Total Anggota Lab</div></div>'+
        '<div class="dashboard-card"><div class="d-icon purple"><i class="fas fa-certificate"></i></div><div class="d-number">'+totalSertifikat+'</div><div class="d-label">Total Sertifikat</div></div>'+
        '<div class="dashboard-card"><div class="d-icon teal"><i class="fas fa-handshake"></i></div><div class="d-number">'+totalMitra+'</div><div class="d-label">Mitra Perusahaan</div></div>'+
        '</div><div class="chart-container"><h4><i class="fas fa-chart-bar"></i> Grafik Peningkatan Kegiatan Bulanan</h4><div class="chart-bars">'+
        data.kegiatanLab.map(k => '<div class="chart-bar"><div class="bar-value">'+k.jumlah+'</div><div class="bar" style="height:'+((k.jumlah/maxKegiatan)*140)+'px;background:linear-gradient(180deg,var(--blue),var(--blue-light));"></div><div class="bar-label">'+k.bulan+'</div></div>').join('')+
        '</div></div><div style="text-align:center;color:var(--gray-400);font-size:0.875rem;"><i class="fas fa-sync-alt"></i> Data real-time terupdate dari sistem ERPify</div>';
}

// ===== ADMIN PLATFORM =====
function renderAdminPlatform() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;margin-bottom:24px;"><button class="btn btn-success btn-sm" onclick="showModalPlatform()"><i class="fas fa-plus"></i> Tambah Platform</button></div><div class="admin-list">'+
        data.platforms.map(p => '<div class="admin-item"><i class="'+p.icon+'" style="font-size:1.5rem;color:var(--blue);width:40px;text-align:center;"></i><div class="info"><strong>'+p.name+'</strong><br><small>'+p.desc.substring(0,80)+'...</small></div><div class="actions"><button class="btn btn-sm btn-warning" onclick="showModalPlatform('+p.id+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger" onclick="deletePlatform('+p.id+')"><i class="fas fa-trash"></i></button></div></div>').join('')+'</div>';
}

function showModalPlatform(id) {
    const data = getData();
    const p = id ? data.platforms.find(x => x.id === id) : null;
    document.getElementById('modalPlatformTitle').textContent = p ? 'Edit Platform' : 'Tambah Platform Baru';
    document.getElementById('pfId').value = p ? p.id : '';
    document.getElementById('pfName').value = p ? p.name : '';
    document.getElementById('pfDesc').value = p ? p.desc : '';
    document.getElementById('pfIcon').value = p ? p.icon : 'fas fa-cube';
    openModal('modalPlatform');
}

function savePlatform() {
    const data = getData();
    const id = document.getElementById('pfId').value;
    const name = document.getElementById('pfName').value.trim();
    const desc = document.getElementById('pfDesc').value.trim();
    const icon = document.getElementById('pfIcon').value.trim() || 'fas fa-cube';
    if (!name || !desc) { alert('Nama dan deskripsi harus diisi!'); return; }
    if (id) {
        const p = data.platforms.find(x => x.id === parseInt(id));
        if (p) { p.name = name; p.desc = desc; p.icon = icon; }
    } else {
        data.platforms.push({ id: ++nextId, icon, name, desc, foto: '' });
    }
    saveData(data);
    closeModal('modalPlatform');
    renderAdminContent();
}

function deletePlatform(id) {
    if (!confirm('Hapus platform ini?')) return;
    const data = getData();
    data.platforms = data.platforms.filter(p => p.id !== id);
    saveData(data);
    renderAdminContent();
}

// ===== ADMIN DOSEN =====
function renderAdminDosen() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;margin-bottom:24px;"><button class="btn btn-success btn-sm" onclick="showModalDosen()"><i class="fas fa-plus"></i> Tambah Dosen</button></div><div class="admin-list">'+
        data.dosen.map(d => '<div class="admin-item"><div style="width:40px;height:40px;border-radius:50%;background:'+(d.foto?'transparent':'var(--blue)')+';color:white;display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;">'+(d.foto?'<img src="'+d.foto+'" style="width:100%;height:100%;object-fit:cover;">':d.nama.charAt(0))+'</div><div class="info"><strong>'+escapeHtml(dosenLabel(d))+'</strong><br><small>'+escapeHtml(d.jabatan)+'</small></div><div class="actions"><button class="btn btn-sm btn-warning" onclick="showModalDosen('+d.id+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger" onclick="deleteDosen('+d.id+')"><i class="fas fa-trash"></i></button></div></div>').join('')+'</div>';
}

function showModalDosen(id) {
    const data = getData();
    const d = id ? data.dosen.find(x => x.id === id) : null;
    document.getElementById('modalDosenTitle').textContent = d ? 'Edit Dosen' : 'Tambah Dosen Baru';
    document.getElementById('dsId').value = d ? d.id : '';
    document.getElementById('dsKode').value = d ? (d.kode || '') : generateKodeDosen();
    document.getElementById('dsNama').value = d ? d.nama : '';
    document.getElementById('dsJabatan').value = d ? d.jabatan : '';
    document.getElementById('dsKeahlian').value = d ? d.keahlian : '';
    document.getElementById('dsTags').value = d ? d.tags.join(', ') : 'SAP, Odoo';
    const preview = document.getElementById('dsFotoPreview');
    const wrapper = document.getElementById('dsFotoWrapper');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    if (wrapper) { wrapper.classList.remove('has-image'); const i=wrapper.querySelector('i'); const p=wrapper.querySelector('p'); if(i)i.style.display=''; if(p)p.style.display=''; }
    openModal('modalDosen');
}

function saveDosen() {
    const data = getData();
    const id = document.getElementById('dsId').value;
    const kode = document.getElementById('dsKode').value.trim() || generateKodeDosen();
    const nama = document.getElementById('dsNama').value.trim();
    const jabatan = document.getElementById('dsJabatan').value.trim();
    const keahlian = document.getElementById('dsKeahlian').value.trim();
    const tags = document.getElementById('dsTags').value.split(',').map(t => t.trim()).filter(t => t);
    if (!nama || !jabatan) { alert('Nama dan jabatan harus diisi!'); return; }
    const bentrok = data.dosen.find(x => x.kode === kode && String(x.id) !== String(id));
    if (bentrok) { alert('Kode dosen "' + kode + '" sudah dipakai oleh ' + bentrok.nama + '. Gunakan kode lain.'); return; }
    const foto = getUploadPreviewValue('dsFotoPreview');
    if (id) {
        const d = data.dosen.find(x => x.id === parseInt(id));
        if (d) { d.kode = kode; d.nama = nama; d.jabatan = jabatan; d.keahlian = keahlian; d.tags = tags; if (foto) d.foto = foto; }
    } else {
        data.dosen.push({ id: ++nextId, kode, nama, jabatan, keahlian, tags, foto });
    }
    saveData(data);
    closeModal('modalDosen');
    renderAdminContent();
}

function deleteDosen(id) {
    if (!confirm('Hapus dosen ini?')) return;
    const data = getData();
    data.dosen = data.dosen.filter(d => d.id !== id);
    saveData(data);
    renderAdminContent();
}

// ===== ADMIN MITRA =====
function renderAdminMitra() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;margin-bottom:24px;"><button class="btn btn-success btn-sm" onclick="showModalMitra()"><i class="fas fa-plus"></i> Tambah Mitra</button></div><div class="admin-list">'
        + (data.mitra || []).map(function(m, i) {
            const logo = mitraLogo(m);
            return '<div class="admin-item">'
                + '<div style="width:44px;height:44px;border-radius:10px;background:' + (logo ? 'transparent' : 'var(--gray-100)') + ';display:flex;align-items:center;justify-content:center;overflow:hidden;">'
                + (logo ? '<img src="' + logo + '" style="width:100%;height:100%;object-fit:contain;">' : '<i class="fas fa-building" style="color:var(--blue);"></i>')
                + '</div>'
                + '<div class="info"><strong>' + escapeHtml(mitraNama(m)) + '</strong><br><small>' + (logo ? 'Logo terpasang' : 'Belum ada logo') + '</small></div>'
                + '<div class="actions"><button class="btn btn-sm btn-warning" onclick="showModalMitra(' + i + ')"><i class="fas fa-pen"></i></button>'
                + '<button class="btn btn-sm btn-danger" onclick="deleteMitra(' + i + ')"><i class="fas fa-trash"></i></button></div></div>';
        }).join('') + '</div>';
}

function showModalMitra(index) {
    const data = getData();
    const ada = (index !== undefined && index !== null && index >= 0);
    const m = ada ? (data.mitra || [])[index] : null;
    document.getElementById('modalMitraTitle').textContent = ada ? 'Edit Mitra' : 'Tambah Mitra Baru';
    document.getElementById('mtIndex').value = ada ? index : '';
    document.getElementById('mtName').value = m ? mitraNama(m) : '';
    const preview = document.getElementById('mtLogoPreview');
    const wrapper = document.getElementById('mtLogoWrapper');
    if (preview) {
        const icon = wrapper ? wrapper.querySelector('i') : null;
        const hint = wrapper ? wrapper.querySelector('p') : null;
        if (m && mitraLogo(m)) {
            preview.src = mitraLogo(m);
            preview.style.display = 'block';
            if (wrapper) wrapper.classList.add('has-image');
            if (icon) icon.style.display = 'none';
            if (hint) hint.style.display = 'none';
        } else {
            preview.src = '';
            preview.style.display = 'none';
            if (wrapper) wrapper.classList.remove('has-image');
            if (icon) icon.style.display = '';
            if (hint) hint.style.display = '';
        }
    }
    openModal('modalMitra');
}

function saveMitra() {
    const data = getData();
    const index = document.getElementById('mtIndex').value;
    const name = document.getElementById('mtName').value.trim();
    if (!name) { alert('Nama mitra harus diisi!'); return; }
    if (!Array.isArray(data.mitra)) data.mitra = [];
    const logoBaru = getUploadPreviewValue('mtLogoPreview');
    if (index !== '') {
        const lama = data.mitra[parseInt(index)] || {};
        data.mitra[parseInt(index)] = { nama: name, logo: logoBaru || mitraLogo(lama) };
    } else {
        data.mitra.push({ nama: name, logo: logoBaru });
    }
    saveData(data);
    closeModal('modalMitra');
    renderAdminContent();
}

function deleteMitra(index) {
    if (!confirm('Hapus mitra ini?')) return;
    const data = getData();
    data.mitra.splice(index, 1);
    saveData(data);
    renderAdminContent();
}

// ===== ADMIN ANGGOTA =====
function renderAdminAnggota() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    const genKeys = Object.keys(data.generasi);
    container.innerHTML = '<div style="text-align:center;margin-bottom:16px;"><label style="font-weight:600;margin-right:8px;">Pilih Generasi:</label><select id="adminGenSelect" class="generasi-select" style="min-width:250px;" onchange="renderAdminAnggotaList()">'+
        genKeys.map(k => '<option value="'+k+'">'+data.generasi[k].title+'</option>').join('')+
        '</select><button class="btn btn-success btn-sm" style="margin-left:8px;" onclick="showModalAnggota()"><i class="fas fa-plus"></i> Tambah</button></div><div id="adminAnggotaList"></div>';
    renderAdminAnggotaList();
}

function renderAdminAnggotaList() {
    const sel = document.getElementById('adminGenSelect');
    if (!sel) return;
    const genKey = sel.value;
    const data = getData();
    const gen = data.generasi[genKey];
    if (!gen) return;
    const list = document.getElementById('adminAnggotaList');
    if (!list) return;
    list.innerHTML = gen.anggota.map((a, i) => '<div class="admin-item" style="margin-bottom:8px;"><div style="width:36px;height:36px;border-radius:50%;background:'+(a.foto?'transparent':'linear-gradient(135deg,var(--blue),var(--navy))')+';color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem;overflow:hidden;">'+(a.foto?'<img src="'+a.foto+'" style="width:100%;height:100%;object-fit:cover;">':escapeHtml((a.nama||'?').charAt(0)))+'</div><div class="info"><strong>'+escapeHtml(anggotaLabel(a))+'</strong> ('+escapeHtml(a.nim)+')<br><small>'+escapeHtml(a.jabatan)+' - '+escapeHtml(a.divisi)+(anggotaDosenLabel(a)?' | Dosen: '+escapeHtml(anggotaDosenLabel(a)):'')+'</small></div><div class="actions"><button class="btn btn-sm btn-warning" onclick="showModalAnggota(\''+genKey+'\','+i+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger" onclick="deleteAnggota(\''+genKey+'\','+i+')"><i class="fas fa-trash"></i></button></div></div>').join('');
}

function showModalAnggota(genKey, index) {
    const data = getData();
    let a = null;
    if (genKey && index !== undefined && index !== null && index >= 0) {
        a = data.generasi[genKey]?.anggota[index];
    }
    document.getElementById('modalAnggotaTitle').textContent = a ? 'Edit Anggota' : 'Tambah Anggota Baru';
    document.getElementById('agGenKey').value = genKey || '';
    document.getElementById('agIndex').value = (a ? index : '');
    document.getElementById('agNama').value = a ? a.nama : '';
    document.getElementById('agNim').value = a ? a.nim : '';
    document.getElementById('agJabatan').value = a ? a.jabatan : 'Anggota';
    document.getElementById('agDivisi').value = a ? a.divisi : 'Odoo';
    isiSelectAnggota(a ? a.kodeDosen : '', a ? a.kodeAsprak : '');
    const preview = document.getElementById('agFotoPreview');
    const wrapper = document.getElementById('agFotoWrapper');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    if (wrapper) { wrapper.classList.remove('has-image'); const i=wrapper.querySelector('i'); const p=wrapper.querySelector('p'); if(i)i.style.display=''; if(p)p.style.display=''; }
    openModal('modalAnggota');
}

function saveAnggota() {
    const data = getData();
    const genKey = document.getElementById('agGenKey').value;
    const index = document.getElementById('agIndex').value;
    const nama = document.getElementById('agNama').value.trim();
    const nim = document.getElementById('agNim').value.trim();
    const jabatan = document.getElementById('agJabatan').value.trim();
    const divisi = document.getElementById('agDivisi').value.trim();
    const selD = document.getElementById('agKodeDosen');
    const selA = document.getElementById('agKodeAsprak');
    const kodeDosen = selD ? selD.value : '';
    const kodeAsprak = selA ? selA.value : '';
    if (!nama || !nim) { alert('Nama dan NIM harus diisi!'); return; }

    // Cek NIM ganda (satu NIM = satu mahasiswa)
    const nimBaru = normalizeNim(nim);
    let bentrok = null;
    Object.keys(data.generasi).forEach(function(k) {
        const gen = data.generasi[k];
        if (!gen || !Array.isArray(gen.anggota)) return;
        gen.anggota.forEach(function(a, i) {
            const sama = normalizeNim(a.nim) === nimBaru;
            const diriSendiri = (k === genKey && String(i) === String(index));
            if (sama && !diriSendiri) bentrok = a;
        });
    });
    if (bentrok) { alert('NIM ' + nim + ' sudah dipakai oleh ' + bentrok.nama + '. Periksa kembali.'); return; }

    const foto = getUploadPreviewValue('agFotoPreview');
    if (index !== '') {
        const a = data.generasi[genKey]?.anggota[parseInt(index)];
        if (a) {
            a.nama = nama; a.nim = nim;
            a.jabatan = jabatan || 'Anggota';
            a.divisi = divisi || 'Odoo';
            a.kodeDosen = kodeDosen;
            a.kodeAsprak = kodeAsprak;
            if (foto) a.foto = foto;
        }
    } else {
        const sel = document.getElementById('adminGenSelect');
        const gk = sel ? sel.value : genKey;
        if (!data.generasi[gk]) return;
        data.generasi[gk].anggota.push({
            nama, nim,
            jabatan: jabatan || 'Anggota',
            divisi: divisi || 'Odoo',
            kodeDosen, kodeAsprak, foto
        });
    }
    saveData(data);
    closeModal('modalAnggota');
    renderAdminContent();
}

function deleteAnggota(genKey, index) {
    if (!confirm('Hapus anggota ini?')) return;
    const data = getData();
    data.generasi[genKey]?.anggota.splice(index, 1);
    saveData(data);
    renderAdminContent();
}

// ===== ADMIN BERITA =====
function renderAdminBerita() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;margin-bottom:24px;"><button class="btn btn-success btn-sm" onclick="showModalBerita()"><i class="fas fa-plus"></i> Tambah Berita</button></div><div class="admin-list">'+
        data.berita.map(b => '<div class="admin-item"><i class="'+b.icon+'" style="font-size:1.25rem;color:var(--blue);width:36px;text-align:center;"></i><div class="info"><strong>'+b.title+'</strong><br><small>'+b.date+'</small></div><div class="actions"><button class="btn btn-sm btn-warning" onclick="showModalBerita('+b.id+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger" onclick="deleteBerita('+b.id+')"><i class="fas fa-trash"></i></button></div></div>').join('')+'</div>';
}

function formatDateDisplay(datetimeStr) {
    if (!datetimeStr) return '';
    // Format: 2026-06-15T09:00 -> 15 Juni 2026, 09:00
    try {
        const d = new Date(datetimeStr);
        if (isNaN(d.getTime())) return datetimeStr;
        const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return day + ' ' + month + ' ' + year + ', ' + hours + ':' + mins;
    } catch(e) {
        return datetimeStr;
    }
}

function showModalBerita(id) {
    const data = getData();
    const b = id ? data.berita.find(x => x.id === id) : null;
    document.getElementById('modalBeritaTitle').textContent = b ? 'Edit Berita' : 'Tambah Berita Baru';
    document.getElementById('brId').value = b ? b.id : '';
    document.getElementById('brTitle').value = b ? b.title : '';
    document.getElementById('brDesc').value = b ? b.desc : '';
    document.getElementById('brFullDesc').value = b ? (b.fullDesc || b.desc) : '';
    // Konversi date display ke datetime-local format
    if (b && b.date) {
        try {
            const d = new Date(b.date);
            if (!isNaN(d.getTime())) {
                // Format ke YYYY-MM-DDTHH:MM untuk input datetime-local
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                document.getElementById('brDate').value = year + '-' + month + '-' + day + 'T' + hours + ':' + mins;
            } else {
                document.getElementById('brDate').value = '';
            }
        } catch(e) {
            document.getElementById('brDate').value = '';
        }
    } else {
        document.getElementById('brDate').value = '';
    }
    document.getElementById('brIcon').value = b ? b.icon : 'fas fa-newspaper';
    // Update icon preview
    const iconPreview = document.getElementById('brIconPreview');
    if (iconPreview) {
        const iconVal = document.getElementById('brIcon').value;
        iconPreview.innerHTML = '<i class="'+iconVal+'"></i> <span>'+iconVal+'</span>';
    }
    const preview = document.getElementById('brFotoPreview');

    const wrapper = document.getElementById('brFotoWrapper');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    if (wrapper) { wrapper.classList.remove('has-image'); const i=wrapper.querySelector('i'); const p=wrapper.querySelector('p'); if(i)i.style.display=''; if(p)p.style.display=''; }
    openModal('modalBerita');
}

function saveBerita() {
    const data = getData();
    const id = document.getElementById('brId').value;
    const title = document.getElementById('brTitle').value.trim();
    const desc = document.getElementById('brDesc').value.trim();
    const fullDesc = document.getElementById('brFullDesc').value.trim();
    const dateRaw = document.getElementById('brDate').value;
    const icon = document.getElementById('brIcon').value.trim() || 'fas fa-newspaper';
    if (!title || !desc) { alert('Judul dan deskripsi harus diisi!'); return; }
    if (!dateRaw) { alert('Tanggal & Waktu harus diisi!'); return; }
    // Simpan dalam format ISO untuk konsistensi
    const dateISO = new Date(dateRaw).toISOString();
    const dateDisplay = formatDateDisplay(dateRaw);
    const preview = document.getElementById('brFotoPreview');
    const foto = getUploadPreviewValue('brFotoPreview');
    if (id) {
        const b = data.berita.find(x => x.id === parseInt(id));
        if (b) { b.title = title; b.desc = desc; b.fullDesc = fullDesc || desc; b.date = dateISO; b.dateDisplay = dateDisplay; b.icon = icon; if (foto) b.foto = foto; }
    } else {
        data.berita.push({ id: ++nextId, icon, date: dateISO, dateDisplay: dateDisplay, title, desc, fullDesc: fullDesc || desc, foto });
    }
    saveData(data);
    closeModal('modalBerita');
    renderAdminContent();
}


function deleteBerita(id) {
    if (!confirm('Hapus berita ini?')) return;
    const data = getData();
    data.berita = data.berita.filter(b => b.id !== id);
    saveData(data);
    renderAdminContent();
}

// ===== ADMIN GENERASI =====
function renderAdminGenerasi() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;margin-bottom:24px;"><button class="btn btn-success btn-sm" onclick="showModalGenerasi()"><i class="fas fa-plus"></i> Tambah Generasi</button></div><div class="admin-list">'+
        Object.entries(data.generasi).map(([key, gen]) => '<div class="admin-item"><div class="info"><strong>'+gen.title+'</strong><br><small>'+gen.desc.substring(0,60)+'... | '+gen.anggota.length+' anggota</small></div><div class="actions"><button class="btn btn-sm btn-warning" onclick="showModalGenerasi(\''+key+'\')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger" onclick="deleteGenerasi(\''+key+'\')"><i class="fas fa-trash"></i></button></div></div>').join('')+'</div>';
}

function showModalGenerasi(key) {
    const data = getData();
    const gen = key ? data.generasi[key] : null;
    document.getElementById('modalGenerasiTitle').textContent = gen ? 'Edit Generasi' : 'Tambah Generasi Baru';
    document.getElementById('gnKey').value = key || '';
    document.getElementById('gnTitle').value = gen ? gen.title : '';
    document.getElementById('gnDesc').value = gen ? gen.desc : '';
    openModal('modalGenerasi');
}

function saveGenerasi() {
    const data = getData();
    const key = document.getElementById('gnKey').value;
    const title = document.getElementById('gnTitle').value.trim();
    const desc = document.getElementById('gnDesc').value.trim();
    if (!title) { alert('Nama generasi harus diisi!'); return; }
    if (key) {
        const gen = data.generasi[key];
        if (gen) { gen.title = title; gen.desc = desc; }
    } else {
        const newKey = 'gen' + Date.now();
        data.generasi[newKey] = { title, desc, anggota: [] };
    }
    saveData(data);
    closeModal('modalGenerasi');
    renderAdminContent();
}

function deleteGenerasi(key) {
    if (!confirm('Hapus generasi ini? Anggota di dalamnya juga akan terhapus.')) return;
    const data = getData();
    delete data.generasi[key];
    saveData(data);
    renderAdminContent();
}

// ===== ADMIN SERTIFIKASI =====
function renderAdminSertifikasi() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;

    const searchVal = sessionStorage.getItem('erpify_sertifikat_search') || '';
    const filterStatus = sessionStorage.getItem('erpify_sertifikat_status') || '';
    const filterDiambil = sessionStorage.getItem('erpify_sertifikat_diambil') || '';
    const filterAngkatan = sessionStorage.getItem('erpify_sertifikat_angkatan') || '';

    const semua = data.sertifikatSAP || [];
    const angkatanSet = [...new Set(semua.map(s => s.angkatan).filter(Boolean))].sort();

    let filtered = semua;
    if (searchVal) {
        const q = searchVal.toLowerCase();
        filtered = filtered.filter(function(s) {
            return (s.nama || '').toLowerCase().indexOf(q) > -1
                || (s.nim || '').toLowerCase().indexOf(q) > -1
                || (s.jenis || '').toLowerCase().indexOf(q) > -1;
        });
    }
    if (filterStatus) filtered = filtered.filter(s => s.status === filterStatus);
    if (filterDiambil) filtered = filtered.filter(s => (s.diambil || 'Belum Diambil') === filterDiambil);
    if (filterAngkatan) filtered = filtered.filter(s => s.angkatan === filterAngkatan);

    // Urutkan berdasarkan NIM supaya sertifikat milik mahasiswa yang sama
    // tampil berurutan - sertifikat baru langsung muncul di bawah mahasiswa tersebut.
    filtered = filtered.slice().sort(function(a, b) {
        const ka = normalizeNim(a.nim);
        const kb = normalizeNim(b.nim);
        if (ka < kb) return -1;
        if (ka > kb) return 1;
        return String(a.jenis || '').localeCompare(String(b.jenis || ''));
    });

    const jumlahMahasiswa = [...new Set(filtered.map(s => normalizeNim(s.nim)))].length;

    container.innerHTML = '<div class="table-actions">'
        + '<button class="btn btn-success btn-sm" onclick="showModalSertifikasi()"><i class="fas fa-plus"></i> Tambah Sertifikasi</button>'
        + '<button class="btn btn-primary btn-sm" onclick="showImportModal()"><i class="fas fa-file-import"></i> Import CSV</button>'
        + '<button class="btn btn-warning btn-sm" onclick="exportSertifikatCSV()"><i class="fas fa-file-export"></i> Export CSV</button>'
        + '<button class="btn btn-success btn-sm" onclick="exportSertifikatExcel()"><i class="fas fa-file-excel"></i> Export Excel</button>'
        + '<span style="margin-left:auto;font-size:0.8125rem;color:var(--gray-400);">'
        + filtered.length + ' sertifikat &middot; ' + jumlahMahasiswa + ' mahasiswa</span></div>'

        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;background:var(--white);padding:16px;border-radius:12px;border:1px solid var(--gray-200);">'
        + '<div style="flex:1;min-width:200px;position:relative;">'
        + '<i class="fas fa-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--gray-400);font-size:0.875rem;"></i>'
        + '<input type="text" id="sertifikatSearch" placeholder="Cari NIM / nama mahasiswa / nama sertifikat..." value="' + escapeHtml(searchVal) + '" style="padding:10px 14px 10px 38px;border:1px solid var(--gray-300);border-radius:8px;width:100%;font-family:inherit;font-size:0.875rem;" oninput="filterSertifikatTable()">'
        + '</div>'
        + '<select id="filterSertifikatStatus" style="padding:10px 14px;border:1px solid var(--gray-300);border-radius:8px;font-family:inherit;font-size:0.8125rem;min-width:160px;" onchange="filterSertifikatTable()">'
        + '<option value="">Semua Status Kelayakan</option>'
        + '<option value="Sudah Bisa Diambil"' + (filterStatus === 'Sudah Bisa Diambil' ? ' selected' : '') + '>Sudah Bisa Diambil</option>'
        + '<option value="Belum Bisa Diambil"' + (filterStatus === 'Belum Bisa Diambil' ? ' selected' : '') + '>Belum Bisa Diambil</option>'
        + '</select>'
        + '<select id="filterSertifikatDiambil" style="padding:10px 14px;border:1px solid var(--gray-300);border-radius:8px;font-family:inherit;font-size:0.8125rem;min-width:160px;" onchange="filterSertifikatTable()">'
        + '<option value="">Semua Status Pengambilan</option>'
        + '<option value="Sudah Diambil"' + (filterDiambil === 'Sudah Diambil' ? ' selected' : '') + '>Sudah Diambil</option>'
        + '<option value="Belum Diambil"' + (filterDiambil === 'Belum Diambil' ? ' selected' : '') + '>Belum Diambil</option>'
        + '</select>'
        + '<select id="filterSertifikatAngkatan" style="padding:10px 14px;border:1px solid var(--gray-300);border-radius:8px;font-family:inherit;font-size:0.8125rem;min-width:140px;" onchange="filterSertifikatTable()">'
        + '<option value="">Semua Angkatan</option>'
        + angkatanSet.map(a => '<option value="' + escapeHtml(a) + '"' + (filterAngkatan === a ? ' selected' : '') + '>' + escapeHtml(a) + '</option>').join('')
        + '</select>'
        + '<button class="btn btn-sm btn-secondary" onclick="resetFilterSertifikat()"><i class="fas fa-undo"></i> Reset</button>'
        + '</div>'

        + '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>'
        + '<th>NIM</th><th>Nama Mahasiswa</th><th>Angkatan</th><th>Kelas</th><th>Nama Sertifikat</th><th>Nilai</th>'
        + '<th>Status Kelayakan</th><th>Status Pengambilan</th><th>PDF</th><th>Aksi</th>'
        + '</tr></thead><tbody>'
        + filtered.map(function(s, i) {
            const idx = semua.indexOf(s);
            const pdfUrl = getSertifikatPdfUrl(s);
            const lanjutan = (i > 0 && normalizeNim(filtered[i - 1].nim) === normalizeNim(s.nim));
            return '<tr class="' + (lanjutan ? 'baris-lanjutan' : '') + '">'
                + '<td>' + (lanjutan
                    ? '<span class="lanjutan-tanda">&#8627; ' + escapeHtml(s.nim || '') + '</span>'
                    : '<strong>' + escapeHtml(s.nim || '-') + '</strong>') + '</td>'
                + '<td>' + escapeHtml(s.nama || '-') + '</td>'
                + '<td>' + escapeHtml(s.angkatan || '-') + '</td>'
                + '<td>' + escapeHtml(s.kelas || '-') + '</td>'
                + '<td>' + escapeHtml(s.jenis || '-') + '</td>'
                + '<td>' + escapeHtml(s.nilai || '-') + '</td>'
                + '<td><span class="status-badge ' + (s.status === 'Sudah Bisa Diambil' ? 'success' : 'warning') + '">' + escapeHtml(s.status || '-') + '</span></td>'
                + '<td><span class="status-badge ' + (s.diambil === 'Sudah Diambil' ? 'success' : 'warning') + '">' + escapeHtml(s.diambil || 'Belum Diambil') + '</span></td>'
                + '<td>' + (pdfUrl ? '<a href="' + pdfUrl + '" target="_blank" rel="noopener" title="Buka file PDF"><i class="fas fa-file-pdf" style="color:#dc2626;font-size:1.1rem;"></i></a>' : '<span style="color:var(--gray-400);font-size:0.75rem;">belum ada</span>') + '</td>'
                + '<td style="white-space:nowrap;">'
                + '<button class="btn btn-sm btn-warning" onclick="showModalSertifikasi(' + idx + ')" title="Edit"><i class="fas fa-pen"></i></button> '
                + '<button class="btn btn-sm btn-danger" onclick="deleteSertifikasi(' + idx + ')" title="Hapus"><i class="fas fa-trash"></i></button>'
                + '</td></tr>';
        }).join('')
        + '</tbody></table></div>'
        + (filtered.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--gray-400);"><i class="fas fa-search" style="font-size:2rem;margin-bottom:12px;display:block;"></i>Belum ada data sertifikasi yang cocok.</div>' : '');
}

function filterSertifikatTable() {
    const search = document.getElementById('sertifikatSearch')?.value || '';
    const status = document.getElementById('filterSertifikatStatus')?.value || '';
    const diambil = document.getElementById('filterSertifikatDiambil')?.value || '';
    const angkatan = document.getElementById('filterSertifikatAngkatan')?.value || '';

    sessionStorage.setItem('erpify_sertifikat_search', search);
    sessionStorage.setItem('erpify_sertifikat_status', status);
    sessionStorage.setItem('erpify_sertifikat_diambil', diambil);
    sessionStorage.setItem('erpify_sertifikat_angkatan', angkatan);

    renderAdminSertifikasi();
}

function resetFilterSertifikat() {
    sessionStorage.removeItem('erpify_sertifikat_search');
    sessionStorage.removeItem('erpify_sertifikat_status');
    sessionStorage.removeItem('erpify_sertifikat_diambil');
    sessionStorage.removeItem('erpify_sertifikat_angkatan');
    renderAdminSertifikasi();
}

// ===== FORM SERTIFIKASI (multi sertifikat per mahasiswa) =====
let nimTermuatBaris = '';   // NIM yang baris sertifikatnya sedang ditampilkan di form
let barisDihapus = [];      // daftar index data yang dibuang lewat form

// Buka form sertifikasi.
//   - index : index data yang mau diedit (boleh kosong untuk data baru)
// Form menampilkan SEMUA sertifikat milik mahasiswa tersebut + satu baris
// kosong untuk menambah sertifikat baru.
function showModalSertifikasi(index) {
    const data = getData();
    const punyaIndex = (index !== undefined && index !== null && index !== '' && index >= 0);
    const s = punyaIndex ? data.sertifikatSAP[index] : null;

    document.getElementById('modalSertifikasiTitle').textContent = s ? 'Edit Sertifikat' : 'Tambah Data Sertifikasi';
    document.getElementById('srIndex').value = punyaIndex ? index : '';
    document.getElementById('srNim').value = s ? (s.nim || '') : '';
    document.getElementById('srNama').value = s ? (s.nama || '') : '';
    document.getElementById('srAngkatan').value = s ? (s.angkatan || '') : '';
    document.getElementById('srKelas').value = s ? (s.kelas || '') : '';

    barisDihapus = [];
    nimTermuatBaris = '';
    kosongkanBarisSertifikat();
    if (s && s.nim) {
        muatBarisSertifikat(s.nim);
    } else {
        tambahBarisSertifikat();
    }
    openModal('modalSertifikasi');
}

function kosongkanBarisSertifikat() {
    const kontainer = document.getElementById('sertifRows');
    if (kontainer) kontainer.innerHTML = '';
}

// Tampilkan semua sertifikat milik satu NIM sebagai baris form,
// lalu tambahkan satu baris kosong di bawahnya untuk sertifikat berikutnya.
function muatBarisSertifikat(nim) {
    const data = getData();
    const kunci = normalizeNim(nim);
    if (!kunci) return;
    if (nimTermuatBaris === kunci) return;   // sudah tampil, jangan timpa isian admin
    nimTermuatBaris = kunci;

    kosongkanBarisSertifikat();
    (data.sertifikatSAP || []).forEach(function(s, i) {
        if (normalizeNim(s.nim) === kunci) tambahBarisSertifikat(s, i);
    });
    tambahBarisSertifikat();   // baris kosong: sertifikat berikutnya
}

// Tambah satu baris. d = data pengisian, dataIndex = index record asli (mode edit)
function tambahBarisSertifikat(d, dataIndex) {
    const kontainer = document.getElementById('sertifRows');
    if (!kontainer) return;
    const nomor = kontainer.querySelectorAll('.sertif-row').length + 1;

    const row = document.createElement('div');
    row.className = 'sertif-row';
    row.innerHTML = '<div class="sertif-row-head">'
        + '<strong><i class="fas fa-certificate"></i> Sertifikat #<span class="row-nomor">' + nomor + '</span></strong>'
        + '<button type="button" class="btn btn-sm btn-danger" onclick="hapusBarisSertifikat(this)" title="Hapus sertifikat ini"><i class="fas fa-times"></i></button>'
        + '</div>'
        + '<input type="hidden" class="row-index" value="' + (dataIndex !== undefined && dataIndex !== null && dataIndex !== '' ? dataIndex : '') + '">'
        + '<div class="form-group"><label>Nama Sertifikat <span style="color:red;">*</span></label>'
        + '<input type="text" class="row-jenis" placeholder="Contoh: SAP S/4HANA Associate / SAP MM Associate" value="' + (d ? escapeHtml(d.jenis || '') : '') + '"></div>'
        + '<div class="sertif-row-grid">'
        + '<div class="form-group"><label>Nilai</label><input type="text" class="row-nilai" placeholder="A / B+" value="' + (d ? escapeHtml(d.nilai || '') : '') + '"></div>'
        + '<div class="form-group"><label>Status Kelayakan</label><select class="row-status">'
        + '<option value="Belum Bisa Diambil"' + (d && d.status === 'Belum Bisa Diambil' ? ' selected' : '') + '>Belum Bisa Diambil</option>'
        + '<option value="Sudah Bisa Diambil"' + (d && d.status === 'Sudah Bisa Diambil' ? ' selected' : '') + '>Sudah Bisa Diambil</option>'
        + '</select></div>'
        + '<div class="form-group"><label>Status Pengambilan</label><select class="row-diambil">'
        + '<option value="Belum Diambil"' + (d && d.diambil === 'Belum Diambil' ? ' selected' : '') + '>Belum Diambil</option>'
        + '<option value="Sudah Diambil"' + (d && d.diambil === 'Sudah Diambil' ? ' selected' : '') + '>Sudah Diambil</option>'
        + '</select></div>'
        + '</div>'
        + '<div class="form-group"><label>File PDF Sertifikat</label>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<input type="file" class="row-pdf-file" accept="application/pdf,.pdf" onchange="handleSertifikatPdfUploadRow(this)" style="font-size:0.8125rem;">'
        + '<span class="row-pdf-status" style="font-size:0.75rem;color:var(--gray-500);"></span>'
        + '</div>'
        + '<input type="hidden" class="row-pdf" value="' + (d ? escapeHtml(d.pdf || '') : '') + '">'
        + '</div>';

    kontainer.appendChild(row);
    perbaruiNomorBaris();
}

// Nomor baris selalu urut 1..n sesuai posisinya di form
function perbaruiNomorBaris() {
    const kontainer = document.getElementById('sertifRows');
    if (!kontainer) return;
    kontainer.querySelectorAll('.sertif-row').forEach(function(row, i) {
        const el = row.querySelector('.row-nomor');
        if (el) el.textContent = String(i + 1);
    });
}

// Buang satu baris dari form (minimal harus tersisa satu baris)
function hapusBarisSertifikat(btn) {
    const row = btn.closest ? btn.closest('.sertif-row') : null;
    const kontainer = document.getElementById('sertifRows');
    if (!row || !kontainer) return;
    if (kontainer.querySelectorAll('.sertif-row').length <= 1) {
        alert('Minimal harus ada satu baris sertifikat.');
        return;
    }
    const elIndex = row.querySelector('.row-index');
    if (elIndex && String(elIndex.value).trim() !== '') {
        barisDihapus.push(parseInt(elIndex.value, 10));
    }
    row.remove();
    perbaruiNomorBaris();
}

// Kumpulkan data dari semua baris sertifikat pada form
function bacaBarisSertifikat() {
    const kontainer = document.getElementById('sertifRows');
    if (!kontainer) return [];
    const hasil = [];
    kontainer.querySelectorAll('.sertif-row').forEach(function(b) {
        const elJenis = b.querySelector('.row-jenis');
        const elNilai = b.querySelector('.row-nilai');
        const elStatus = b.querySelector('.row-status');
        const elDiambil = b.querySelector('.row-diambil');
        const elPdf = b.querySelector('.row-pdf');
        const elIndex = b.querySelector('.row-index');
        hasil.push({
            dataIndex: elIndex ? String(elIndex.value).trim() : '',
            jenis: elJenis ? String(elJenis.value).trim() : '',
            nilai: elNilai ? String(elNilai.value).trim() : '',
            status: elStatus ? elStatus.value : 'Belum Bisa Diambil',
            diambil: elDiambil ? elDiambil.value : 'Belum Diambil',
            pdf: elPdf ? String(elPdf.value).trim() : ''
        });
    });
    return hasil;
}

// Isi otomatis identitas mahasiswa + tampilkan seluruh sertifikatnya di form
function autofillIdentitasMahasiswa() {
    const elNim = document.getElementById('srNim');
    const elNama = document.getElementById('srNama');
    const elAngkatan = document.getElementById('srAngkatan');
    const elKelas = document.getElementById('srKelas');
    if (!elNim) return;
    const nim = String(elNim.value).trim();
    if (!nim) return;

    const data = getData();
    const sama = (data.sertifikatSAP || []).find(function(x) { return normalizeNim(x.nim) === normalizeNim(nim); });
    if (!sama) return;   // NIM baru: biarkan isian yang sedang diketik

    if (elNama && !String(elNama.value).trim()) elNama.value = sama.nama || '';
    if (elAngkatan && !String(elAngkatan.value).trim()) elAngkatan.value = sama.angkatan || '';
    if (elKelas && !String(elKelas.value).trim()) elKelas.value = sama.kelas || '';

    muatBarisSertifikat(nim);
}

// Simpan sertifikasi. NIM + Nama Mahasiswa diisi sekali, lalu satu atau
// beberapa sertifikat sekaligus (nama, nilai, status, status pengambilan, PDF).
// Simpan sertifikasi: memperbarui baris yang sudah ada, menambah yang baru,
// dan menghapus baris yang Anda buang dari form.
function saveSertifikasi() {
    const data = getData();
    const nim = document.getElementById('srNim').value.trim();
    const nama = document.getElementById('srNama').value.trim();
    const angkatan = document.getElementById('srAngkatan').value.trim();
    const kelas = document.getElementById('srKelas').value.trim();

    if (!nim) { alert('NIM harus diisi - NIM adalah acuan utama pencarian sertifikat.'); return; }
    if (!nama) { alert('Nama mahasiswa harus diisi!'); return; }

    const baris = bacaBarisSertifikat().filter(function(b) { return b.jenis !== ''; });
    if (baris.length === 0) { alert('Isi minimal satu Nama Sertifikat.'); return; }

    if (barisDihapus.length > 0) {
        if (!confirm('Ada ' + barisDihapus.length + ' sertifikat yang Anda hapus dari daftar form. Simpan perubahan termasuk penghapusan tersebut?')) return;
    }

    if (!Array.isArray(data.sertifikatSAP)) data.sertifikatSAP = [];

    let ditambah = 0;
    let diubah = 0;

    baris.forEach(function(b) {
        const rec = {
            nim: nim, nama: nama, angkatan: angkatan, kelas: kelas,
            jenis: b.jenis, nilai: b.nilai, status: b.status, diambil: b.diambil, pdf: b.pdf
        };
        if (b.dataIndex !== '' && data.sertifikatSAP[b.dataIndex]) {
            Object.assign(data.sertifikatSAP[b.dataIndex], rec);
            diubah++;
        } else {
            data.sertifikatSAP.push(rec);
            ditambah++;
        }
    });

    // Penghapusan dilakukan dari index terbesar agar posisi index lain tidak bergeser
    if (barisDihapus.length > 0) {
        const hapus = [];
        barisDihapus.forEach(function(i) { if (data.sertifikatSAP[i]) hapus.push(i); });
        hapus.sort(function(a, b) { return b - a; }).forEach(function(i) { data.sertifikatSAP.splice(i, 1); });
    }

    saveData(data);
    closeModal('modalSertifikasi');
    renderAdminContent();

    let pesan = ditambah + ' sertifikat ditambahkan';
    if (diubah > 0) pesan += ', ' + diubah + ' diperbarui';
    if (barisDihapus.length > 0) pesan += ', ' + barisDihapus.length + ' dihapus';
    erpifyToast(pesan + '.', 'success');
}

function deleteSertifikasi(index) {
    if (!confirm('Hapus sertifikat ini? Sertifikat lain milik mahasiswa tersebut tidak terpengaruh.')) return;
    const data = getData();
    data.sertifikatSAP.splice(index, 1);
    saveData(data);
    renderAdminContent();
    erpifyToast('Satu sertifikat dihapus.', 'success');
}

function downloadTemplateSertifikat() {
    // Template: NIM menjadi kolom pertama (acuan utama)
    const headers = ['NIM','Nama Mahasiswa','Angkatan','Kelas','Nama Sertifikat','Nilai','Status Kelayakan','Status Pengambilan'];
    const contoh = [
        ['2203001','Contoh Mahasiswa 1','2023','A','SAP S/4HANA Associate','A','Sudah Bisa Diambil','Belum Diambil'],
        ['2203001','Contoh Mahasiswa 1','2023','A','SAP MM Associate','B+','Sudah Bisa Diambil','Belum Diambil'],
        ['2203002','Contoh Mahasiswa 2','2023','B','SAP FI Associate','A-','Belum Bisa Diambil','Belum Diambil']
    ];

    // Utamakan file Excel asli (.xlsx) supaya tidak ada peringatan format saat dibuka
    if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
        const aoa = [headers].concat(contoh);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = headers.map(function(h, i) { return { wch: i === 4 ? 32 : 18 }; });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Sertifikat');
        XLSX.writeFile(wb, 'template_import_sertifikat_ERPify.xlsx');
        erpifyToast('Template Excel (.xlsx) berhasil diunduh.', 'success');
        return;
    }

    // Cadangan bila pustaka Excel belum termuat: unduh CSV (aman dibuka di Excel)
    unduhCSV(headers, contoh, 'template_import_sertifikat_ERPify.csv');
    erpifyToast('Template CSV berhasil diunduh (pustaka Excel belum siap).', 'success');
}

// Unduh data sebagai CSV (dipakai juga sebagai cadangan template)
function unduhCSV(headers, rows, namaFile) {
    let csv = headers.join(',') + '\n';
    rows.forEach(function(r) {
        csv += r.map(function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = namaFile;
    a.click();
    URL.revokeObjectURL(url);
}
function exportSertifikatCSV() {
    const data = getData();
    const headers = ['NIM','Nama Mahasiswa','Angkatan','Kelas','Nama Sertifikat','Nilai','Status Kelayakan','Status Pengambilan'];
    const rows = (data.sertifikatSAP || []).map(s => [s.nim||'', s.nama||'', s.angkatan||'', s.kelas||'', s.jenis||'', s.nilai||'', s.status||'', s.diambil||'Belum Diambil']);
    unduhCSV(headers, rows, 'data_sertifikat_ERPify.csv');
    erpifyToast('Data sertifikasi diekspor ke CSV.', 'success');
}

function exportSertifikatExcel() {
    const data = getData();
    const headers = ['NIM','Nama Mahasiswa','Angkatan','Kelas','Nama Sertifikat','Nilai','Status Kelayakan','Status Pengambilan'];
    const rows = (data.sertifikatSAP || []).map(s => [s.nim||'', s.nama||'', s.angkatan||'', s.kelas||'', s.jenis||'', s.nilai||'', s.status||'', s.diambil||'Belum Diambil']);

    // File Excel asli (.xlsx) memakai pustaka SheetJS yang sudah dimuat di halaman admin
    if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
        const aoa = [headers].concat(rows);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = headers.map(function(h, i) { return { wch: i === 4 ? 32 : 18 }; });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Sertifikasi');
        XLSX.writeFile(wb, 'data_sertifikat_ERPify.xlsx');
        erpifyToast('Data sertifikasi diekspor ke Excel (.xlsx).', 'success');
        return;
    }

    // Cadangan bila pustaka Excel tidak tersedia
    unduhCSV(headers, rows, 'data_sertifikat_ERPify.csv');
    erpifyToast('Pustaka Excel tidak tersedia - data diekspor sebagai CSV.', 'success');
}

function showImportModal() {
    // Buat modal import
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'modalImportSertifikat';
    overlay.onclick = function(e) { if (e.target === this) closeImportModal(); };
    overlay.innerHTML = '<div class="modal-content" style="max-width:500px;"><div class="modal-header"><h3><i class="fas fa-file-import"></i> Import Data Sertifikat</h3><button class="modal-close" onclick="closeImportModal()"><i class="fas fa-times"></i></button></div><div class="modal-body" style="text-align:center;">'+
        '<div style="margin:24px 0;padding:40px 20px;border:2px dashed var(--gray-300);border-radius:12px;background:var(--gray-50);cursor:pointer;" id="importDropZone" onclick="document.getElementById(\'importFileInput\').click()">'+
        '<i class="fas fa-cloud-upload-alt" style="font-size:3rem;color:var(--blue);margin-bottom:16px;display:block;"></i>'+
        '<p style="font-weight:600;color:var(--navy);margin-bottom:8px;">Klik untuk upload file</p>'+
        '<p style="font-size:0.8125rem;color:var(--gray-500);">Format: NIM, Nama, Angkatan, Kelas, Nama Sertifikat, Nilai, Status Kelayakan, Status Pengambilan<br><small style="color:var(--gray-400);">(Satu NIM boleh muncul di beberapa baris untuk sertifikat berbeda)</small></p>'+
        '<p style="font-size:0.75rem;color:var(--gray-400);margin-top:4px;"><i class="fas fa-file-excel"></i> Mendukung file <strong>.xls</strong>, <strong>.xlsx</strong>, dan <strong>.csv</strong></p>'+
        '<input type="file" id="importFileInput" accept=".csv,.xls,.xlsx" style="display:none;" onchange="processImportFile(this)">'+
        '</div>'+
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">'+
        '<button class="btn btn-primary btn-sm" onclick="downloadTemplateSertifikat()"><i class="fas fa-download"></i> Download Template</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="closeImportModal()">Batal</button>'+
        '</div></div></div>';
    document.body.appendChild(overlay);
}

function closeImportModal() {
    const el = document.getElementById('modalImportSertifikat');
    if (el) el.remove();
}

function processImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
    
    if (isExcel) {
        // Baca file Excel menggunakan SheetJS (XLSX library)
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    alert('File Excel tidak valid atau kosong.');
                    return;
                }
                
                // Baris pertama adalah header, skip
                const rows = jsonData.slice(1).filter(r => r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));
                
                const appData = getData();
                let count = 0;
                let errors = [];
                
                rows.forEach((row, idx) => {
                    // Konversi semua cell ke string
                    const cols = row.map(cell => String(cell || '').trim());
                    
                    // Format baru (NIM jadi acuan): NIM, Nama, Angkatan, Kelas, Nama Sertifikat, Nilai, Status Kelayakan, Status Pengambilan
                    // Format lama 9 kolom tetap didukung: Kode Sertifikasi, Nama, NIM, Angkatan, Kelas, Jenis, Nilai, Status, Status Pengambilan
                    let rec = null;
                    if (cols.length >= 9) {
                        rec = { nomor: cols[0], nama: cols[1], nim: cols[2], angkatan: cols[3], kelas: cols[4] || '', jenis: cols[5], nilai: cols[6], status: cols[7], diambil: cols[8] || 'Belum Diambil' };
                    } else if (cols.length >= 8) {
                        rec = { nama: cols[1], nim: cols[0], angkatan: cols[2], kelas: cols[3] || '', jenis: cols[4], nilai: cols[5], status: cols[6], diambil: cols[7] || 'Belum Diambil' };
                    } else if (cols.length >= 6) {
                        rec = { nama: cols[0], nim: cols[1], angkatan: cols[2], kelas: '', jenis: cols[3], nilai: cols[4], status: cols[5], diambil: 'Belum Diambil' };
                    }
                    if (rec) {
                        rec.pdf = rec.pdf || '';
                        appData.sertifikatSAP.push(rec);
                        count++;
                    } else {
                        errors.push('Baris ' + (idx + 2) + ': hanya ' + cols.length + ' kolom (minimal 6 kolom diperlukan)');
                    }
                });
                
                saveData(appData);
                closeImportModal();
                renderAdminContent();
                let msg = 'Import berhasil! ' + count + ' data sertifikat ditambahkan.';
                if (errors.length > 0) {
                    msg += '\n\nPeringatan (' + errors.length + ' baris dilewati):\n' + errors.join('\n');
                }
                alert(msg);
            } catch(e) {
                alert('Gagal membaca file Excel: ' + e.message);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        // Baca file CSV
        const reader = new FileReader();
        reader.onload = function(ev) {
            const text = ev.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { alert('File CSV tidak valid atau kosong.'); return; }
            const data = getData();
            let count = 0;
            let errors = [];
            for (let i = 1; i < lines.length; i++) {
                // Parse CSV dengan benar (handle koma di dalam tanda kutip)
                const cols = parseCSVLine(lines[i]);
                
                // Cek jumlah kolom untuk menentukan format
                // Format baru (NIM jadi acuan): NIM, Nama, Angkatan, Kelas, Nama Sertifikat, Nilai, Status Kelayakan, Status Pengambilan
                // Format lama 9 kolom tetap didukung: Kode Sertifikasi, Nama, NIM, Angkatan, Kelas, Jenis, Nilai, Status, Status Pengambilan
                let rec = null;
                if (cols.length >= 9) {
                    rec = { nomor: cols[0], nama: cols[1], nim: cols[2], angkatan: cols[3], kelas: cols[4] || '', jenis: cols[5], nilai: cols[6], status: cols[7], diambil: cols[8] || 'Belum Diambil' };
                } else if (cols.length >= 8) {
                    rec = { nama: cols[1], nim: cols[0], angkatan: cols[2], kelas: cols[3] || '', jenis: cols[4], nilai: cols[5], status: cols[6], diambil: cols[7] || 'Belum Diambil' };
                } else if (cols.length >= 6) {
                    rec = { nama: cols[0], nim: cols[1], angkatan: cols[2], kelas: '', jenis: cols[3], nilai: cols[4], status: cols[5], diambil: 'Belum Diambil' };
                }
                if (rec) {
                    rec.pdf = rec.pdf || '';
                    data.sertifikatSAP.push(rec);
                    count++;
                } else {
                    errors.push('Baris ' + (i + 1) + ': hanya ' + cols.length + ' kolom (minimal 6 kolom diperlukan)');
                }
            }
            saveData(data);
            closeImportModal();
            renderAdminContent();
            let msg = 'Import berhasil! ' + count + ' data sertifikat ditambahkan.';
            if (errors.length > 0) {
                msg += '\n\nPeringatan (' + errors.length + ' baris dilewati):\n' + errors.join('\n');
            }
            alert(msg);
        };
        reader.readAsText(file);
    }
}

// Fungsi untuk parse CSV line dengan benar (handle koma di dalam tanda kutip)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}



// ===== ADMIN PENGATURAN HALAMAN (DRAG & DROP) =====
function renderAdminSettings() {
    const data = getData();
    const container = document.getElementById('adminContent');
    if (!container) return;

    const halaman = [
        { key: 'beranda',    label: 'Beranda',         icon: 'fas fa-home',               file: 'index.html' },
        { key: 'dosen',      label: 'Dosen & Anggota', icon: 'fas fa-chalkboard-teacher', file: 'dosen-anggota.html' },
        { key: 'matakuliah', label: 'Mata Kuliah',     icon: 'fas fa-book',               file: 'matakuliah.html' },
        { key: 'kerjasama',  label: 'Kerjasama',       icon: 'fas fa-handshake',          file: 'kerjasama.html' },
        { key: 'berita',     label: 'Berita',          icon: 'fas fa-newspaper',          file: 'berita.html' },
        { key: 'sertifikat', label: 'Cek Sertifikat',  icon: 'fas fa-certificate',        file: 'sertifikat.html' }
    ];

    container.innerHTML = '<div style="text-align:center;margin-bottom:24px;">'
        + '<h3 style="color:var(--navy);"><i class="fas fa-paint-brush"></i> Pengaturan Halaman</h3>'
        + '<p style="color:var(--gray-500);font-size:0.875rem;">Ubah subjudul (teks di bawah judul) pada bagian hero setiap halaman. '
        + 'Klik <i class="fas fa-pen"></i> untuk mengedit, atau <i class="fas fa-external-link-alt"></i> untuk melihat halamannya.</p></div>'
        + '<div class="admin-list">'
        + halaman.map(function(h) {
            const setting = (data.pageSettings && data.pageSettings[h.key]) || {};
            const sub = setting.subtitle || '';
            const ringkas = sub.length > 90 ? escapeHtml(sub.substring(0, 90)) + '...' : escapeHtml(sub);
            const jumlahItem = (setting.dropdownItems || []).length;
            return '<div class="admin-item">'
                + '<i class="' + h.icon + '" style="font-size:1.25rem;color:var(--blue);width:36px;text-align:center;"></i>'
                + '<div class="info"><strong>' + h.label + '</strong>'
                + '<br><small>' + (sub ? ringkas : '(belum ada subjudul)') + '</small>'
                + (jumlahItem ? '<br><small><i class="fas fa-list"></i> ' + jumlahItem + ' item dropdown pada hero</small>' : '')
                + '</div>'
                + '<div class="actions">'
                + '<a class="btn btn-sm btn-secondary" href="' + h.file + '" target="_blank" rel="noopener" title="Lihat halaman"><i class="fas fa-external-link-alt"></i></a>'
                + '<button class="btn btn-sm btn-warning" onclick="showModalSetting(\'' + h.key + '\')" title="Edit subjudul"><i class="fas fa-pen"></i></button>'
                + '</div></div>';
        }).join('')
        + '</div>'
        + '<p style="text-align:center;color:var(--gray-400);font-size:0.8125rem;margin-top:20px;">'
        + '<i class="fas fa-info-circle"></i> Subjudul boleh memakai HTML sederhana, misalnya <code>&lt;br&gt;</code> atau <code>&lt;strong&gt;teks&lt;/strong&gt;</code>.</p>';
}


function showModalSetting(key) {
    const data = normalizeData(getData());
    const setting = (data.pageSettings && data.pageSettings[key]) || {};
    document.getElementById('modalSettingTitle').textContent = 'Edit Subjudul Halaman';
    document.getElementById('stKey').value = key;
    document.getElementById('stSubtitle').value = setting.subtitle || '';
    // Load dropdown items
    const container = document.getElementById('dropdownItemsContainer');
    if (container) {
        const items = setting.dropdownItems || [];
        if (items.length === 0) {
            container.innerHTML = '<p style="font-size:0.8125rem;color:var(--gray-400);">Belum ada item dropdown. Klik "Tambah Item" untuk menambahkan.</p>';
        } else {
            container.innerHTML = items.map((item, idx) => 
                '<div class="dropdown-item-field" data-idx="'+idx+'">'+
                '<input type="text" class="dd-label" placeholder="Judul item (klik untuk expand)" value="'+item.label+'">'+
                '<textarea class="dd-content" rows="2" placeholder="Konten yang muncul saat diklik...">'+item.content+'</textarea>'+
                '<button class="btn btn-sm btn-danger" onclick="removeDropdownItemField(this)" style="flex-shrink:0;"><i class="fas fa-times"></i></button>'+
                '</div>'
            ).join('');
        }
    }
    openModal('modalSetting');
}

function addDropdownItemField() {
    const container = document.getElementById('dropdownItemsContainer');
    if (!container) return;
    // Hapus placeholder jika ada
    const placeholder = container.querySelector('p');
    if (placeholder && container.children.length === 1) {
        container.innerHTML = '';
    }
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'dropdown-item-field';
    div.dataset.idx = idx;
    div.innerHTML = '<input type="text" class="dd-label" placeholder="Judul item (klik untuk expand)" value="">'+
        '<textarea class="dd-content" rows="2" placeholder="Konten yang muncul saat diklik..."></textarea>'+
        '<button class="btn btn-sm btn-danger" onclick="removeDropdownItemField(this)" style="flex-shrink:0;"><i class="fas fa-times"></i></button>';
    container.appendChild(div);
}

function removeDropdownItemField(btn) {
    const div = btn.parentElement;
    div.remove();
    const container = document.getElementById('dropdownItemsContainer');
    if (container && container.children.length === 0) {
        container.innerHTML = '<p style="font-size:0.8125rem;color:var(--gray-400);">Belum ada item dropdown. Klik "Tambah Item" untuk menambahkan.</p>';
    }
}

function saveSetting() {
    const data = normalizeData(getData());
    const key = document.getElementById('stKey').value;
    const subtitle = document.getElementById('stSubtitle').value.trim();
    if (!key) { alert('Halaman tidak dikenali. Tutup lalu buka ulang menu Pengaturan.'); return; }
    if (!subtitle) { alert('Subjudul harus diisi!'); return; }
    if (!data.pageSettings[key]) data.pageSettings[key] = {};
    data.pageSettings[key].subtitle = subtitle;
    
    // Simpan dropdown items
    const container = document.getElementById('dropdownItemsContainer');
    if (container) {
        const fields = container.querySelectorAll('.dropdown-item-field');
        const items = [];
        fields.forEach(f => {
            const label = f.querySelector('.dd-label')?.value?.trim();
            const content = f.querySelector('.dd-content')?.value?.trim();
            if (label && content) {
                items.push({ label, content, _open: false });
            }
        });
        data.pageSettings[key].dropdownItems = items.length > 0 ? items : [];
    }
    
    saveData(data);
    closeModal('modalSetting');
    renderAdminContent();
    erpifyToast('Subjudul halaman berhasil disimpan.', 'success');
}


// ===== ADMIN BERANDA =====
function renderAdminBeranda() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px 0;"><div style="width:80px;height:80px;border-radius:20px;background:linear-gradient(135deg,var(--blue),var(--navy));display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:2rem;color:white;"><i class="fas fa-home"></i></div>'+
        '<h2 style="font-size:1.75rem;font-weight:800;color:var(--navy);margin-bottom:8px;">Selamat Datang di Panel Admin ERPify</h2>'+
        '<p style="color:var(--gray-500);font-size:1rem;margin-bottom:32px;max-width:500px;margin-left:auto;margin-right:auto;">Kelola semua konten website ERPify dari sini. Gunakan menu sidebar untuk mengelola data.</p>'+
        '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">'+
        '<a href="index.html" target="_blank" class="btn btn-primary"><i class="fas fa-external-link-alt"></i> Lihat Website</a>'+
        '<a href="index.html" class="btn btn-primary-outline"><i class="fas fa-edit"></i> Edit Halaman Beranda</a>'+
        '</div>'+
        '<div style="margin-top:48px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;max-width:700px;margin-left:auto;margin-right:auto;">'+
        '<a href="dosen-anggota.html" target="_blank" style="background:var(--white);border-radius:12px;padding:20px;border:1px solid var(--gray-200);text-decoration:none;transition:var(--transition);"><i class="fas fa-chalkboard-teacher" style="font-size:1.5rem;color:var(--blue);margin-bottom:8px;display:block;"></i><span style="font-size:0.875rem;font-weight:600;color:var(--navy);">Dosen & Anggota</span></a>'+
        '<a href="matakuliah.html" target="_blank" style="background:var(--white);border-radius:12px;padding:20px;border:1px solid var(--gray-200);text-decoration:none;transition:var(--transition);"><i class="fas fa-book" style="font-size:1.5rem;color:var(--blue);margin-bottom:8px;display:block;"></i><span style="font-size:0.875rem;font-weight:600;color:var(--navy);">Mata Kuliah</span></a>'+
        '<a href="sertifikat.html" target="_blank" style="background:var(--white);border-radius:12px;padding:20px;border:1px solid var(--gray-200);text-decoration:none;transition:var(--transition);"><i class="fas fa-certificate" style="font-size:1.5rem;color:var(--blue);margin-bottom:8px;display:block;"></i><span style="font-size:0.875rem;font-weight:600;color:var(--navy);">Cek Sertifikat</span></a>'+
        '<a href="kerjasama.html" target="_blank" style="background:var(--white);border-radius:12px;padding:20px;border:1px solid var(--gray-200);text-decoration:none;transition:var(--transition);"><i class="fas fa-handshake" style="font-size:1.5rem;color:var(--blue);margin-bottom:8px;display:block;"></i><span style="font-size:0.875rem;font-weight:600;color:var(--navy);">Kerjasama</span></a>'+
        '<a href="berita.html" target="_blank" style="background:var(--white);border-radius:12px;padding:20px;border:1px solid var(--gray-200);text-decoration:none;transition:var(--transition);"><i class="fas fa-newspaper" style="font-size:1.5rem;color:var(--blue);margin-bottom:8px;display:block;"></i><span style="font-size:0.875rem;font-weight:600;color:var(--navy);">Berita</span></a>'+
        '</div></div>';
}

// ===== ADMIN CONTENT RENDERER =====
function renderAdminContent() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    const tab = document.querySelector('.admin-tabs .active');
    const activeTab = tab ? tab.dataset.tab : 'dashboard';
    switch(activeTab) {
        case 'beranda': renderAdminBeranda(); break;
        case 'dashboard': renderDashboard(); break;
        case 'platform': renderAdminPlatform(); break;
        case 'dosen': renderAdminDosen(); break;
        case 'mitra': renderAdminMitra(); break;
        case 'anggota': renderAdminAnggota(); break;
        case 'berita': renderAdminBerita(); break;
        case 'generasi': renderAdminGenerasi(); break;
        case 'sertifikasi': renderAdminSertifikasi(); break;
        case 'settings': renderAdminSettings(); break;
        default: renderDashboard();
    }
}


function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tabs button').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderAdminContent();
}

