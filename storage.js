/* =========================================================
   MATH RUNNER — Penyimpanan data (LocalStorage, berversi)
   ---------------------------------------------------------
   Struktur di LocalStorage (kunci MR.Config.STORAGE_KEY):
   {
     app: 'math-runner', schemaVersion: 1,
     createdAt, updatedAt,
     sessions: [ Session, ... ],
     badges:   { "<nama>|<kelas>": ["factor_master", ...] },
     settings: { pin, csvSeparator }
   }
   Adapter dipisah agar kelak dapat ditambah sinkronisasi
   Firebase/Supabase tanpa mengubah game & dashboard.
   ========================================================= */
(function () {
  'use strict';
  const C = MR.Config;

  /* ---------- Adapter penyimpanan ---------- */
  const memoryStore = {};
  const LocalAdapter = {
    name: 'localStorage',
    available: (function () {
      try { const k = '__mr_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
    })(),
    get(key) { try { return this.available ? localStorage.getItem(key) : (memoryStore[key] ?? null); } catch (e) { return memoryStore[key] ?? null; } },
    set(key, val) {
      try { if (this.available) { localStorage.setItem(key, val); return true; } } catch (e) { MR.Storage.lastError = 'Penyimpanan penuh atau diblokir: ' + e.message; }
      memoryStore[key] = val; return false;
    },
    remove(key) { try { if (this.available) localStorage.removeItem(key); } catch (e) { } delete memoryStore[key]; }
  };

  /* ---------- Struktur data ---------- */
  function emptyData() {
    const now = new Date().toISOString();
    return { app: 'math-runner', schemaVersion: C.SCHEMA_VERSION, createdAt: now, updatedAt: now, sessions: [], badges: {}, settings: {} };
  }

  // Migrasi antar versi skema. Tambahkan case baru jika struktur berubah.
  function migrate(d) {
    if (!d || typeof d !== 'object') return emptyData();
    let v = d.schemaVersion || 0;
    if (v < 1) {               // v0 (tanpa versi) → v1
      d = Object.assign(emptyData(), d);
      d.sessions = Array.isArray(d.sessions) ? d.sessions : [];
      v = 1;
    }
    d.schemaVersion = C.SCHEMA_VERSION;
    d.sessions = (d.sessions || []).map(normalizeSession).filter(Boolean);
    d.badges = d.badges && typeof d.badges === 'object' ? d.badges : {};
    d.settings = d.settings && typeof d.settings === 'object' ? d.settings : {};
    return d;
  }

  let cache = null;
  function load() {
    if (cache) return cache;
    const raw = LocalAdapter.get(C.STORAGE_KEY);
    if (!raw) { cache = emptyData(); return cache; }
    try {
      cache = migrate(JSON.parse(raw));
    } catch (e) {
      // Data rusak: simpan salinannya agar tidak hilang, lalu mulai baru.
      const bk = C.STORAGE_KEY + '.corrupt-' + Date.now();
      LocalAdapter.set(bk, raw);
      MR.Storage.lastError = 'Data tersimpan rusak dan tidak dapat dibaca. Salinan mentah disimpan dengan kunci "' + bk + '". Dashboard memulai data baru.';
      cache = emptyData();
      persist();
    }
    return cache;
  }
  function persist() {
    const d = load();
    d.updatedAt = new Date().toISOString();
    const ok = LocalAdapter.set(C.STORAGE_KEY, JSON.stringify(d));
    if (remote && remote.onChange) { try { remote.onChange(d); } catch (e) { } }
    return ok;
  }
  function reload() { cache = null; return load(); }

  /* ---------- Normalisasi & validasi sesi ---------- */
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (isFinite(+v) && v !== '' && v !== null ? +v : 0);
  const pct = (a, b) => b > 0 ? Math.round(a / b * 1000) / 10 : 0;

  function normalizeHistoryItem(h) {
    if (!h || typeof h !== 'object') return null;
    return {
      questionId: String(h.questionId ?? h.id ?? ''),
      topic: String(h.topic ?? h.materi ?? '').toUpperCase() === 'KPK' ? 'KPK' : 'FPB',
      subIndicator: String(h.subIndicator ?? ''),
      difficulty: String(h.difficulty ?? ''),
      level: num(h.level),
      question: String(h.question ?? ''),
      studentAnswer: String(h.studentAnswer ?? ''),
      correctAnswer: String(h.correctAnswer ?? ''),
      isCorrect: h.isCorrect === true || h.isCorrect === 'true' || h.isCorrect === 'Benar',
      timeSec: num(h.timeSec),
      misconception: String(h.misconception ?? ''),
      answeredAt: String(h.answeredAt ?? '')
    };
  }

  // Semua angka ringkasan DIHITUNG ULANG dari questionHistory agar akurasi
  // selalu berdasarkan jawaban aktual (bukan angka yang bisa salah ketik).
  function normalizeSession(s) {
    if (!s || typeof s !== 'object' || !s.sessionId) return null;
    const hist = (Array.isArray(s.questionHistory) ? s.questionHistory : []).map(normalizeHistoryItem).filter(Boolean);
    const out = {
      studentName: String(s.studentName ?? '').trim().slice(0, 60),
      studentClass: String(s.studentClass ?? '').trim().slice(0, 30),
      sessionId: String(s.sessionId),
      date: String(s.date ?? new Date().toISOString()),
      endedAt: String(s.endedAt ?? s.date ?? ''),
      totalScore: num(s.totalScore),
      totalCoins: num(s.totalCoins),
      totalQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, overallAccuracy: 0,
      fpbAttempted: 0, fpbCorrect: 0, kpkAttempted: 0, kpkCorrect: 0,
      completedLevels: (Array.isArray(s.completedLevels) ? s.completedLevels : String(s.completedLevels || '').split(/[^0-9]+/)).map(Number).filter(n => n >= 1 && n <= 4),
      highestLevel: String(s.highestLevel ?? ''),
      startLevel: num(s.startLevel) || 1,
      status: ['tamat', 'berhenti', 'terputus', 'bermain'].includes(s.status) ? s.status : 'berhenti',
      achievements: Array.isArray(s.achievements) ? s.achievements.map(String) : [],
      durationSec: num(s.durationSec),
      appVersion: String(s.appVersion ?? ''),
      questionHistory: hist
    };
    out.completedLevels = [...new Set(out.completedLevels)].sort();
    if (hist.length || !s.totalQuestions) {
      out.totalQuestions = hist.length;
      out.correctAnswers = hist.filter(h => h.isCorrect).length;
      out.fpbAttempted = hist.filter(h => h.topic === 'FPB').length;
      out.fpbCorrect = hist.filter(h => h.topic === 'FPB' && h.isCorrect).length;
      out.kpkAttempted = hist.filter(h => h.topic === 'KPK').length;
      out.kpkCorrect = hist.filter(h => h.topic === 'KPK' && h.isCorrect).length;
    } else { // data impor tanpa riwayat: pakai angka ringkasan
      out.totalQuestions = num(s.totalQuestions); out.correctAnswers = num(s.correctAnswers);
      out.fpbAttempted = num(s.fpbAttempted); out.fpbCorrect = num(s.fpbCorrect);
      out.kpkAttempted = num(s.kpkAttempted); out.kpkCorrect = num(s.kpkCorrect);
    }
    out.incorrectAnswers = out.totalQuestions - out.correctAnswers;
    out.overallAccuracy = pct(out.correctAnswers, out.totalQuestions);
    if (!out.highestLevel) {
      const lv = Math.max(out.startLevel, ...hist.map(h => h.level), ...out.completedLevels, 0);
      out.highestLevel = lv ? 'Level ' + lv : '';
    }
    return out;
  }

  /* ---------- API sesi ---------- */
  function upsertSession(session) {
    const d = load();
    const s = normalizeSession(session);
    if (!s) return false;
    const i = d.sessions.findIndex(x => x.sessionId === s.sessionId);
    if (i >= 0) d.sessions[i] = s; else d.sessions.push(s);
    return persist();
  }
  function getSessions() { return load().sessions.slice(); }
  function deleteSession(id) { const d = load(); d.sessions = d.sessions.filter(s => s.sessionId !== id); persist(); }
  function clearAll() { const settings = load().settings; cache = emptyData(); cache.settings = settings; persist(); }

  function studentKey(name, cls) { return String(name).trim().toLowerCase().replace(/\s+/g, ' ') + '|' + String(cls).trim().toLowerCase(); }
  function addBadges(name, cls, ids) {
    const d = load(); const k = studentKey(name, cls);
    const set = new Set(d.badges[k] || []); ids.forEach(i => set.add(i)); d.badges[k] = [...set]; persist();
  }
  function getBadges(name, cls) { return (load().badges[studentKey(name, cls)] || []).slice(); }

  function getSetting(k, def) { const v = load().settings[k]; return v === undefined ? def : v; }
  function setSetting(k, v) { load().settings[k] = v; persist(); }
  function getPin() { return String(getSetting('pin', C.TEACHER_PIN_DEFAULT)); }

  /* ---------- Ekspor / Impor JSON ---------- */
  function exportJSON() {
    const d = load();
    return JSON.stringify({ app: 'math-runner', type: 'backup', schemaVersion: C.SCHEMA_VERSION, exportedAt: new Date().toISOString(), sessions: d.sessions, badges: d.badges }, null, 2);
  }
  // Menggabungkan sesi; sesi dengan sessionId yang sama TIDAK digandakan.
  function importSessions(list, badges) {
    const d = load();
    const ids = new Set(d.sessions.map(s => s.sessionId));
    let added = 0, skipped = 0, invalid = 0;
    (list || []).forEach(raw => {
      const s = normalizeSession(raw);
      if (!s) { invalid++; return; }
      if (ids.has(s.sessionId)) { skipped++; return; }
      d.sessions.push(s); ids.add(s.sessionId); added++;
    });
    if (badges && typeof badges === 'object') {
      Object.keys(badges).forEach(k => { if (Array.isArray(badges[k])) d.badges[k] = [...new Set([...(d.badges[k] || []), ...badges[k].map(String)])]; });
    }
    persist();
    return { added, skipped, invalid };
  }
  function importJSONText(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('File JSON tidak valid.'); }
    if (Array.isArray(obj)) return importSessions(obj);
    if (obj && Array.isArray(obj.sessions)) return importSessions(migrate(Object.assign({}, obj, { schemaVersion: obj.schemaVersion || 0 })).sessions, obj.badges);
    if (obj && obj.sessionId) return importSessions([obj]);
    throw new Error('Struktur JSON tidak dikenali sebagai data Math Runner.');
  }

  /* ---------- CSV ---------- */
  const CSV_COLS = [
    ['No', (s, i) => i + 1],
    ['Nama/Kode Siswa', s => s.studentName],
    ['Kelas', s => s.studentClass],
    ['ID Sesi', s => s.sessionId],
    ['Tanggal', s => MR.fmt.date(s.date)],
    ['Waktu', s => MR.fmt.time(s.date)],
    ['Skor', s => s.totalScore],
    ['Koin', s => s.totalCoins],
    ['Jumlah Soal', s => s.totalQuestions],
    ['Jawaban Benar', s => s.correctAnswers],
    ['Jawaban Salah', s => s.incorrectAnswers],
    ['Akurasi (%)', s => s.overallAccuracy, true],
    ['Soal FPB', s => s.fpbAttempted],
    ['FPB Benar', s => s.fpbCorrect],
    ['Akurasi FPB (%)', s => pct(s.fpbCorrect, s.fpbAttempted), true],
    ['Soal KPK', s => s.kpkAttempted],
    ['KPK Benar', s => s.kpkCorrect],
    ['Akurasi KPK (%)', s => pct(s.kpkCorrect, s.kpkAttempted), true],
    ['Level Mulai', s => s.startLevel],
    ['Level Diselesaikan', s => s.completedLevels.join(' ')],
    ['Level Tertinggi', s => s.highestLevel],
    ['Status', s => MR.fmt.status(s)],
    ['Riwayat Jawaban', s => s.questionHistory.map((h, k) => (k + 1) + '. [' + h.topic + '] ' + h.question + ' | jawab: ' + h.studentAnswer + ' | kunci: ' + h.correctAnswer + ' | ' + (h.isCorrect ? 'Benar' : 'Salah')).join(' || ')],
    ['questionHistoryJSON', s => JSON.stringify(s.questionHistory)]
  ];
  function csvCell(v, sep) {
    const t = String(v ?? '');
    return /["\r\n]/.test(t) || t.includes(sep) || /^\s|\s$/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function decimal(v, sep) { const t = String(v); return sep === ';' ? t.replace('.', ',') : t; }
  function sessionsToCSV(sessions, sep) {
    sep = sep || getSetting('csvSeparator', ',');
    const rows = [CSV_COLS.map(c => csvCell(c[0], sep)).join(sep)];
    sessions.forEach((s, i) => rows.push(CSV_COLS.map(c => csvCell(c[2] ? decimal(c[1](s, i), sep) : c[1](s, i), sep)).join(sep)));
    return '﻿' + rows.join('\r\n');
  }
  function answersToCSV(sessions, sep) {
    sep = sep || getSetting('csvSeparator', ',');
    const head = ['Nama/Kode Siswa', 'Kelas', 'ID Sesi', 'Tanggal', 'No Soal', 'ID Soal', 'Materi', 'Sub-indikator', 'Kesulitan', 'Level', 'Pertanyaan', 'Jawaban Siswa', 'Jawaban Benar', 'Status', 'Waktu (detik)', 'Pola Kesalahan'];
    const rows = [head.map(h => csvCell(h, sep)).join(sep)];
    sessions.forEach(s => s.questionHistory.forEach((h, k) => {
      rows.push([s.studentName, s.studentClass, s.sessionId, MR.fmt.date(s.date) + ' ' + MR.fmt.time(s.date), k + 1, h.questionId, h.topic, h.subIndicator, h.difficulty, h.level, h.question, h.studentAnswer, h.correctAnswer, h.isCorrect ? 'Benar' : 'Salah', decimal(h.timeSec, sep), h.isCorrect ? '' : (MR.Questions.TAG_LABEL[h.misconception] || '')].map(v => csvCell(v, sep)).join(sep));
    }));
    return '﻿' + rows.join('\r\n');
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return { sep, rows: rows.filter(r => r.some(c => c !== '')) };
  }
  function importCSVText(text) {
    const { sep, rows } = parseCSV(text);
    if (rows.length < 2) throw new Error('File CSV kosong.');
    const head = rows[0].map(h => h.trim());
    const col = name => head.indexOf(name);
    if (col('ID Sesi') < 0) throw new Error('CSV tidak memiliki kolom "ID Sesi". Gunakan file hasil "Export CSV (per sesi)" dari dashboard ini.');
    const g = (r, name) => { const i = col(name); return i >= 0 ? (r[i] ?? '') : ''; };
    const n = v => +String(v).replace(',', '.') || 0;
    const list = rows.slice(1).map(r => {
      let hist = [];
      try { hist = JSON.parse(g(r, 'questionHistoryJSON') || '[]'); } catch (e) { hist = []; }
      const st = g(r, 'Status').toLowerCase();
      return {
        sessionId: g(r, 'ID Sesi'), studentName: g(r, 'Nama/Kode Siswa'), studentClass: g(r, 'Kelas'),
        date: MR.fmt.parseLocal(g(r, 'Tanggal'), g(r, 'Waktu')),
        totalScore: n(g(r, 'Skor')), totalCoins: n(g(r, 'Koin')),
        totalQuestions: n(g(r, 'Jumlah Soal')), correctAnswers: n(g(r, 'Jawaban Benar')),
        fpbAttempted: n(g(r, 'Soal FPB')), fpbCorrect: n(g(r, 'FPB Benar')),
        kpkAttempted: n(g(r, 'Soal KPK')), kpkCorrect: n(g(r, 'KPK Benar')),
        startLevel: n(g(r, 'Level Mulai')) || 1,
        completedLevels: g(r, 'Level Diselesaikan'), highestLevel: g(r, 'Level Tertinggi'),
        status: st.startsWith('tamat') ? 'tamat' : st.startsWith('terputus') ? 'terputus' : 'berhenti',
        questionHistory: hist
      };
    });
    const res = importSessions(list);
    res.sep = sep;
    return res;
  }

  /* ---------- Sinkronisasi masa depan ---------- */
  // Contoh pemakaian kelak:
  // MR.Storage.registerRemote({ onChange(data){ /* kirim ke Supabase */ }, async pull(){ return [...sessions] } })
  let remote = null;
  function registerRemote(adapter) { remote = adapter; }

  function usageBytes() { const r = LocalAdapter.get(C.STORAGE_KEY); return r ? r.length * 2 : 0; }

  MR.Storage = {
    lastError: null, adapter: LocalAdapter, load, reload, persist, getSessions, upsertSession, deleteSession, clearAll,
    normalizeSession, studentKey, addBadges, getBadges, getSetting, setSetting, getPin,
    exportJSON, importJSONText, importCSVText, importSessions, sessionsToCSV, answersToCSV, parseCSV, registerRemote, usageBytes, pct
  };

  /* ---------- Format tanggal & util bersama ---------- */
  const pad = n => String(n).padStart(2, '0');
  MR.fmt = {
    date(iso) { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); },
    time(iso) { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + '.' + pad(d.getMinutes()); },
    dateKey(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    parseLocal(dateStr, timeStr) {
      const m = String(dateStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!m) { const d = new Date(dateStr); return isNaN(d) ? new Date().toISOString() : d.toISOString(); }
      const t = String(timeStr || '').match(/(\d{1,2})[.:](\d{2})/);
      return new Date(+m[3], +m[2] - 1, +m[1], t ? +t[1] : 0, t ? +t[2] : 0).toISOString();
    },
    status(s) {
      if (s.status === 'tamat') return 'Tamat (semua level)';
      if (s.status === 'terputus') return 'Terputus (belum selesai)';
      if (s.status === 'bermain') return 'Sedang bermain';
      return s.completedLevels.length ? 'Selesai ' + s.completedLevels.length + ' level' : 'Belum menyelesaikan level';
    },
    esc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    pct(v) { return (Math.round(v * 10) / 10).toLocaleString('id-ID') + '%'; }
  };

  // Unduhan file (bekerja di GitHub Pages; dapat diblokir di iframe tertentu)
  MR.download = function (filename, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      return true;
    } catch (e) { return false; }
  };
  MR.inIframe = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
})();
