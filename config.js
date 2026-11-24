/* =========================================================
   KONFIGURASI APLIKASI — ubah nilai di sini sesuai kebutuhan
   ========================================================= */
window.MR = window.MR || {};
MR.Config = {
  APP_VERSION: '1.0.0',

  // PIN guru bawaan. Dapat diganti di sini ATAU dari menu
  // Teacher Dashboard › Data & Pengaturan (tersimpan di browser).
  // PERHATIAN: PIN ini hanya penghalang sederhana di perangkat lokal,
  // BUKAN sistem keamanan. Jangan simpan data sensitif.
  TEACHER_PIN_DEFAULT: '1234',

  // Daftar kelas pada pilihan siswa (boleh ditambah/diubah).
  CLASSES: ['IV A', 'IV B', 'IV C', 'IV D', 'IV E'],

  // Kunci & versi struktur penyimpanan LocalStorage.
  STORAGE_KEY: 'mathRunner.data',
  SCHEMA_VERSION: 1,

  // Batas minimum data sebelum dashboard memberi kesimpulan penguasaan.
  MIN_QUESTIONS_OVERALL: 5,   // minimal soal untuk kategori performa
  MIN_QUESTIONS_TOPIC: 3,     // minimal soal FPB / KPK untuk kesimpulan per materi

  // Sistem poin
  POINTS_CORRECT: 100,
  POINTS_PER_COIN: 5,
  POINTS_LEVEL_CLEAR: 250,

  // Kategori performa (persentase akurasi)
  CATEGORIES: [
    { key: 'sb', label: 'Sangat Baik', min: 86, color: '#1f9d74' },
    { key: 'b', label: 'Baik', min: 76, color: '#2f7fc1' },
    { key: 'c', label: 'Cukup', min: 60, color: '#e0a526' },
    { key: 'pb', label: 'Perlu Bimbingan', min: 0, color: '#d9534f' }
  ],

  // Rencana sinkronisasi masa depan (Firebase / Supabase).
  // Lihat storage.js › MR.Storage.registerRemote().
  REMOTE_SYNC: { enabled: false, provider: null }
};
