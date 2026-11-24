/* =========================================================
   MATH RUNNER – TEACHER DASHBOARD
   Membaca data langsung dari LocalStorage (MR.Storage).
   ========================================================= */
(function () {
  'use strict';
  const C = MR.Config, St = MR.Storage, Q = MR.Questions, esc = MR.fmt.esc, pct = St.pct;
  const root = () => document.getElementById('teacher');
  const D = {
    unlocked: false, view: 'overview', student: null,
    filters: { q: '', cls: '', from: '', to: '', level: '' }, sort: { key: 'date', dir: -1 }, charts: [], importMsg: null
  };
  try { D.unlocked = sessionStorage.getItem('mathRunner.teacher') === '1'; } catch (e) { }

  /* ---------------- Perhitungan ---------------- */
  function category(acc, n) {
    if (n < C.MIN_QUESTIONS_OVERALL) return { key: 'na', label: 'Data belum memadai', color: '#9aa5a0' };
    const a = Math.round(acc);
    const c = C.CATEGORIES.find(c => a >= c.min);
    return { key: c.key, label: c.label, color: c.color };
  }
  function topicCat(correct, n) {
    if (n < C.MIN_QUESTIONS_TOPIC) return { key: 'na', label: 'Data belum memadai' };
    return category(pct(correct, n), Infinity);
  }
  function lvNum(s) { return parseInt(String(s.highestLevel).replace(/\D/g, '')) || 0; }
  function filtered() {
    const f = D.filters; const q = f.q.trim().toLowerCase();
    return St.getSessions().filter(s => {
      if (q && !(s.studentName.toLowerCase().includes(q))) return false;
      if (f.cls && s.studentClass !== f.cls) return false;
      const dk = MR.fmt.dateKey(s.date);
      if (f.from && dk < f.from) return false;
      if (f.to && dk > f.to) return false;
      if (f.level === 'tamat' && s.status !== 'tamat') return false;
      if (/^\d$/.test(f.level) && lvNum(s) !== +f.level) return false;
      return true;
    });
  }
  function hist(sessions) { return sessions.flatMap(s => s.questionHistory); }
  function students(sessions) {
    const map = new Map();
    sessions.forEach(s => {
      const k = St.studentKey(s.studentName, s.studentClass);
      if (!map.has(k)) map.set(k, { key: k, name: s.studentName, cls: s.studentClass, sessions: [] });
      map.get(k).sessions.push(s);
    });
    return [...map.values()].map(st => {
      const H = hist(st.sessions);
      const n = st.sessions.reduce((a, s) => a + s.totalQuestions, 0);
      const c = st.sessions.reduce((a, s) => a + s.correctAnswers, 0);
      const fa = st.sessions.reduce((a, s) => a + s.fpbAttempted, 0), fc = st.sessions.reduce((a, s) => a + s.fpbCorrect, 0);
      const ka = st.sessions.reduce((a, s) => a + s.kpkAttempted, 0), kc = st.sessions.reduce((a, s) => a + s.kpkCorrect, 0);
      const levels = [...new Set(st.sessions.flatMap(s => s.completedLevels))].sort();
      st.sessions.sort((a, b) => b.date.localeCompare(a.date));
      return Object.assign(st, {
        H, n, c, acc: pct(c, n), fa, fc, ka, kc, levels,
        totalScore: st.sessions.reduce((a, s) => a + s.totalScore, 0), bestScore: Math.max(0, ...st.sessions.map(s => s.totalScore)),
        last: st.sessions[0] ? st.sessions[0].date : '', cat: category(pct(c, n), n)
      });
    });
  }
  function classes() { return [...new Set([...C.CLASSES, ...St.getSessions().map(s => s.studentClass)].filter(Boolean))].sort(); }
  function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
  const nf = v => Math.round(v).toLocaleString('id-ID');

  /* ---------------- Rekomendasi berbasis data ---------------- */
  function recommend(st) {
    const out = []; const nm = 'Ananda ' + st.name;
    if (st.n < C.MIN_QUESTIONS_OVERALL) {
      out.push({ warn: true, text: 'Data belum memadai: ' + nm + ' baru mengerjakan ' + st.n + ' soal (minimal ' + C.MIN_QUESTIONS_OVERALL + '). Minta Ananda menyelesaikan minimal satu level sebelum menarik kesimpulan penguasaan.' });
      return out;
    }
    const fOk = st.fa >= C.MIN_QUESTIONS_TOPIC, kOk = st.ka >= C.MIN_QUESTIONS_TOPIC;
    const fA = pct(st.fc, st.fa), kA = pct(st.kc, st.ka);
    const word = a => a >= 86 ? 'sangat baik' : 'baik';
    if (fOk && kOk) {
      const fG = Math.round(fA) >= 76, kG = Math.round(kA) >= 76;
      if (fG && kG) out.push({ text: nm + ' menunjukkan penguasaan yang ' + word(Math.min(fA, kA)) + ' pada FPB (' + MR.fmt.pct(fA) + ') dan KPK (' + MR.fmt.pct(kA) + '). Berikan soal pengayaan, misalnya soal cerita dengan tiga bilangan atau soal yang meminta alasan memilih FPB/KPK.' });
      else if (fG) out.push({ text: nm + ' menunjukkan penguasaan yang ' + word(fA) + ' pada konsep FPB (' + MR.fmt.pct(fA) + '), tetapi masih perlu latihan menentukan KPK melalui daftar kelipatan (akurasi KPK ' + MR.fmt.pct(kA) + ').' });
      else if (kG) out.push({ text: nm + ' menunjukkan penguasaan yang ' + word(kA) + ' pada konsep KPK (' + MR.fmt.pct(kA) + '), tetapi masih perlu latihan menentukan FPB melalui daftar faktor (akurasi FPB ' + MR.fmt.pct(fA) + ').' });
      else out.push({ warn: true, text: nm + ' masih memerlukan bimbingan pada FPB (' + MR.fmt.pct(fA) + ') dan KPK (' + MR.fmt.pct(kA) + '). Mulai lagi dari konsep faktor dan kelipatan dengan benda konkret (Learning Zone bagian 1), lalu latih langkah mendaftar faktor/kelipatan.' });
    } else {
      if (fOk) out.push({ text: 'Akurasi FPB ' + nm + ': ' + MR.fmt.pct(fA) + ' (' + topicCat(st.fc, st.fa).label + ').' });
      else out.push({ warn: true, text: 'Data FPB belum memadai (' + st.fa + ' soal). Belum dapat disimpulkan.' });
      if (kOk) out.push({ text: 'Akurasi KPK ' + nm + ': ' + MR.fmt.pct(kA) + ' (' + topicCat(st.kc, st.ka).label + ').' });
      else out.push({ warn: true, text: 'Data KPK belum memadai (' + st.ka + ' soal). Ajak Ananda memainkan Level 2–4 agar kemampuan KPK dapat diamati.' });
    }
    // Pola kesalahan (miskonsepsi) dari pilihan jawaban yang salah
    const wrong = st.H.filter(h => !h.isCorrect);
    const cnt = {}; wrong.forEach(h => { if (h.misconception) cnt[h.misconception] = (cnt[h.misconception] || 0) + 1; });
    const swap = (cnt.swapKPK || 0) + (cnt.swapFPB || 0);
    const ADV = {
      product: n => 'Pola kesalahan: memilih hasil kali kedua bilangan sebagai KPK (' + n + ' kali). Tekankan bahwa KPK adalah kelipatan persekutuan TERKECIL; latih dengan mendaftar kelipatan sampai menemukan bilangan sama yang pertama.',
      commonNotLeast: n => 'Pola kesalahan: memilih kelipatan persekutuan yang bukan terkecil (' + n + ' kali). Ingatkan untuk berhenti pada kelipatan sama yang PERTAMA muncul.',
      commonNotGreatest: n => 'Pola kesalahan: sudah menemukan faktor persekutuan, tetapi belum memilih yang TERBESAR (' + n + ' kali). Minta Ananda menuliskan semua faktor persekutuan lalu melingkari yang terbesar.',
      notCommonFactor: n => 'Pola kesalahan: memilih bilangan yang tidak membagi habis kedua bilangan (' + n + ' kali). Latih uji pembagian: apakah kedua bilangan habis dibagi bilangan itu?',
      notCommonMultiple: n => 'Pola kesalahan: memilih bilangan yang bukan kelipatan kedua bilangan (' + n + ' kali). Gunakan garis bilangan/lompatan untuk memeriksa kelipatan.',
      factorListError: n => 'Daftar faktor belum lengkap/keliru (' + n + ' kali). Latih mencari pasangan perkalian (misalnya 12 = 1×12 = 2×6 = 3×4).',
      factorMultipleConfusion: n => 'Masih tertukar antara konsep faktor dan kelipatan (' + n + ' kali). Gunakan analogi: faktor = membagi rata; kelipatan = melompat/berulang.',
      multipleListError: n => 'Daftar kelipatan keliru (' + n + ' kali). Latih perkalian bilangan dengan 1, 2, 3, 4, … secara berurutan.',
      sum: n => 'Menjumlahkan bilangan saat mencari KPK (' + n + ' kali). Tunjukkan bahwa KPK dicari dari daftar kelipatan, bukan penjumlahan.'
    };
    const pats = [];
    if (swap >= 2) pats.push({ n: swap, text: 'Pola kesalahan: masih tertukar antara FPB dan KPK (' + swap + ' kali). Gunakan ciri cepat: FPB tidak lebih besar dari bilangan terkecil, KPK tidak lebih kecil dari bilangan terbesar.' });
    Object.keys(ADV).forEach(k => { if ((cnt[k] || 0) >= 2) pats.push({ n: cnt[k], text: ADV[k](cnt[k]) }); });
    pats.sort((a, b) => b.n - a.n).slice(0, 3).forEach(p => out.push({ warn: true, text: p.text }));
    if (!pats.length && wrong.length) out.push({ text: 'Kesalahan yang ada belum membentuk pola berulang (setiap jenis kesalahan muncul paling banyak 1 kali). Tinjau daftar soal salah di bawah.' });
    // Soal cerita vs soal hitung
    const story = st.H.filter(h => /^Soal cerita/.test(h.subIndicator)), plain = st.H.filter(h => !/^Soal cerita/.test(h.subIndicator));
    if (story.length >= 3 && plain.length >= 3) {
      const sA = pct(story.filter(h => h.isCorrect).length, story.length), pA = pct(plain.filter(h => h.isCorrect).length, plain.length);
      if (pA - sA >= 20) out.push({ warn: true, text: 'Akurasi soal cerita (' + MR.fmt.pct(sA) + ') jauh lebih rendah daripada soal hitung (' + MR.fmt.pct(pA) + '). Latih Ananda menentukan kapan memakai FPB (membagi sama rata sebanyak-banyaknya) dan kapan KPK (kejadian berulang yang terjadi bersamaan).' });
    }
    if (st.levels.length === 4 && st.acc >= 86) out.push({ text: nm + ' telah menuntaskan keempat level dengan akurasi ' + MR.fmt.pct(st.acc) + '. Siap untuk tantangan lanjutan atau menjadi tutor sebaya.' });
    return out;
  }

  /* ---------------- Render shell ---------------- */
  function open() {
    root().classList.remove('hidden');
    if (MR.Game && MR.Game.state.mode === 'run' && MR.App.session) MR.Game.pause();
    render();
  }
  function close(fromHash) {
    destroyCharts(); root().classList.add('hidden'); root().innerHTML = '';
    if (!fromHash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
    if (MR.App && MR.App.session && MR.Game.state.mode === 'run') { document.getElementById('ov-pause').classList.remove('hidden'); }
    else if (MR.goMenu) MR.goMenu();
  }
  function destroyCharts() { D.charts.forEach(c => { try { c.destroy(); } catch (e) { } }); D.charts = []; }

  function render() {
    destroyCharts();
    if (!D.unlocked) return renderPin();
    const navs = [['overview', 'Ringkasan'], ['table', 'Hasil Siswa'], ['analytics', 'Analisis Pembelajaran'], ['report', 'Laporan Siswa'], ['data', 'Data & Pengaturan']];
    const alerts = [];
    if (St.lastError) alerts.push('<div class="t-alert err">' + esc(St.lastError) + '</div>');
    if (!St.adapter.available) alerts.push('<div class="t-alert err">Browser ini memblokir LocalStorage (mungkin mode penyamaran atau iframe yang dibatasi). Data hanya tersimpan sementara selama halaman terbuka. Buka aplikasi di tab biasa.</div>');
    root().innerHTML =
      '<div class="t-shell"><aside class="t-side t-noprint"><div class="t-brand">MATH RUNNER<span>TEACHER DASHBOARD</span></div>' +
      navs.map(n => '<button class="t-nav" data-nav="' + n[0] + '"' + (D.view === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + '</button>').join('') +
      '<div class="t-spacer"></div><button class="t-exit" data-act="exit">Keluar ke Menu</button></aside>' +
      '<main class="t-main"><div class="t-top"><div><h1>MATH RUNNER – TEACHER DASHBOARD</h1><p>Data dari browser &amp; perangkat ini saja. Gabungkan perangkat lain lewat menu <b>Data &amp; Pengaturan › Import</b>.</p></div></div>' +
      alerts.join('') + '<div id="t-view"></div></main></div>';
    const v = root().querySelector('#t-view');
    ({ overview: viewOverview, table: viewTable, analytics: viewAnalytics, report: viewReport, data: viewData })[D.view](v);
    bind();
  }
  function renderPin() {
    root().innerHTML = '<div class="t-pin"><form class="t-pin-card" id="t-pin-form"><h1>Teacher Dashboard</h1><p>Masukkan PIN guru untuk membuka dashboard.</p>' +
      '<input id="t-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN guru"><div class="t-err" id="t-pin-err"></div>' +
      '<div class="t-actions"><button class="t-btn primary" type="submit">Buka Dashboard</button><button class="t-btn" type="button" data-act="exit">Kembali ke Game</button></div>' +
      '<p class="t-small">PIN bawaan: lihat <code>config.js</code> (TEACHER_PIN_DEFAULT) atau README. PIN ini hanya penghalang sederhana agar siswa tidak membuka dashboard secara tidak sengaja; ini <b>bukan</b> sistem keamanan.</p></form></div>';
    const f = root().querySelector('#t-pin-form');
    f.onsubmit = e => {
      e.preventDefault();
      if (root().querySelector('#t-pin').value === St.getPin()) { D.unlocked = true; try { sessionStorage.setItem('mathRunner.teacher', '1'); } catch (e2) { } render(); }
      else { root().querySelector('#t-pin-err').textContent = 'PIN salah. Coba lagi.'; root().querySelector('#t-pin').select(); }
    };
    root().querySelector('[data-act=exit]').onclick = () => close();
    setTimeout(() => root().querySelector('#t-pin').focus(), 30);
  }

  function filtersHTML() {
    const f = D.filters;
    return '<div class="t-filters t-noprint">' +
      '<label>Cari nama/kode<input data-f="q" type="search" value="' + esc(f.q) + '" placeholder="Ketik nama…"></label>' +
      '<label>Kelas<select data-f="cls"><option value="">Semua kelas</option>' + classes().map(c => '<option' + (c === f.cls ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label>' +
      '<label>Dari tanggal<input data-f="from" type="date" value="' + esc(f.from) + '"></label>' +
      '<label>Sampai tanggal<input data-f="to" type="date" value="' + esc(f.to) + '"></label>' +
      '<label>Level tertinggi<select data-f="level"><option value="">Semua</option>' + [1, 2, 3, 4].map(l => '<option value="' + l + '"' + (f.level == l ? ' selected' : '') + '>Level ' + l + '</option>').join('') + '<option value="tamat"' + (f.level === 'tamat' ? ' selected' : '') + '>Tamat semua level</option></select></label>' +
      '<button class="t-btn" data-act="clear-filters">Reset filter</button></div>';
  }
  function emptyHTML(msg) { return '<div class="t-empty"><b>Belum ada data</b>' + esc(msg || 'Data akan muncul setelah siswa bermain di perangkat ini, atau setelah Anda mengimpor file dari perangkat lain.') + '</div>'; }

  /* ---------------- 1. Ringkasan ---------------- */
  function viewOverview(v) {
    const ss = filtered(); const stu = students(ss);
    const withQ = ss.filter(s => s.totalQuestions > 0);
    const above80 = stu.filter(s => s.n >= C.MIN_QUESTIONS_OVERALL && s.acc > 80).length;
    const cards = [
      ['Total siswa yang bermain', stu.length, 'siswa unik (nama + kelas)'],
      ['Total sesi permainan', ss.length, 'termasuk sesi terputus'],
      ['Rata-rata skor', nf(mean(ss.map(s => s.totalScore))), 'per sesi'],
      ['Rata-rata akurasi', withQ.length ? MR.fmt.pct(mean(withQ.map(s => s.overallAccuracy))) : '–', 'sesi yang menjawab ≥1 soal'],
      ['Siswa akurasi > 80%', above80, 'min. ' + C.MIN_QUESTIONS_OVERALL + ' soal dikerjakan'],
      ['Sesi tamat semua level', ss.filter(s => s.status === 'tamat').length, 'Level 1–4 selesai']
    ];
    const recent = ss.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const dist = {}; stu.forEach(s => { dist[s.cat.key] = (dist[s.cat.key] || 0) + 1; });
    const cats = C.CATEGORIES.concat([{ key: 'na', label: 'Data belum memadai', color: '#9aa5a0' }]);
    v.innerHTML = filtersHTML() +
      '<div class="t-cards">' + cards.map((c, i) => '<div class="t-card' + (i === 3 ? ' accent' : '') + '"><span>' + c[0] + '</span><b>' + esc(c[1]) + '</b><small>' + c[2] + '</small></div>').join('') + '</div>' +
      (ss.length ? '<div class="t-grid2"><section class="t-panel"><h2>Kategori performa siswa</h2><p class="t-desc">Berdasarkan akurasi gabungan seluruh sesi tiap siswa.</p>' +
        cats.map(c => { const n = dist[c.key] || 0; const p = stu.length ? n / stu.length * 100 : 0; return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-weight:700"><span>' + c.label + (c.min !== undefined ? ' <small style="color:#6b7a72">(' + (c.key === 'pb' ? '&lt; 60%' : c.key === 'sb' ? '86–100%' : c.key === 'b' ? '76–85%' : '60–75%') + ')</small>' : '') + '</span><span>' + n + ' siswa</span></div><div class="t-meter"><i style="width:' + p + '%;background:' + c.color + '"></i></div></div>'; }).join('') +
        '</section><section class="t-panel"><h2>Sesi terbaru</h2><p class="t-desc">Klik untuk membuka laporan siswa.</p><div class="t-tablewrap"><table class="t-table"><thead><tr><th>Siswa</th><th>Kelas</th><th>Waktu</th><th class="num">Skor</th><th class="num">Akurasi</th></tr></thead><tbody>' +
        recent.map(s => '<tr tabindex="0" data-student="' + esc(St.studentKey(s.studentName, s.studentClass)) + '"><td>' + esc(s.studentName) + '</td><td>' + esc(s.studentClass) + '</td><td>' + MR.fmt.date(s.date) + ' ' + MR.fmt.time(s.date) + '</td><td class="num">' + nf(s.totalScore) + '</td><td class="num">' + MR.fmt.pct(s.overallAccuracy) + '</td></tr>').join('') +
        '</tbody></table></div></section></div>' : '<section class="t-panel">' + emptyHTML() + '</section>');
  }

  /* ---------------- 2. Tabel hasil ---------------- */
  function sortSessions(ss) {
    const k = D.sort.key, d = D.sort.dir;
    const val = s => k === 'score' ? s.totalScore : k === 'acc' ? s.overallAccuracy : k === 'name' ? s.studentName.toLowerCase() : k === 'cls' ? s.studentClass : k === 'level' ? lvNum(s) : s.date;
    return ss.slice().sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * d; });
  }
  function viewTable(v) {
    const ss = sortSessions(filtered());
    const th = (k, label, num) => '<th class="' + (num ? 'num' : '') + '"><button data-sort="' + k + '"' + (D.sort.key === k ? ' data-dir="' + (D.sort.dir > 0 ? '▲' : '▼') + '"' : '') + '>' + label + '</button></th>';
    const max = 600;
    v.innerHTML = filtersHTML() +
      '<section class="t-panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><div><h2>Hasil permainan siswa</h2><p class="t-desc" style="margin:0">' + ss.length + ' sesi. Klik baris untuk melihat laporan siswa. Urutkan dengan menekan judul kolom.</p></div>' +
      '<div class="t-actions t-noprint"><label class="t-file" style="font-weight:700;font-size:13px">Urutkan <select class="t-input" data-act="sort-select" style="width:auto"><option value="date">Tanggal terbaru</option><option value="score">Skor tertinggi</option><option value="acc">Akurasi tertinggi</option><option value="name">Nama A–Z</option></select></label>' +
      '<button class="t-btn primary" data-act="csv-sessions">Export CSV</button><button class="t-btn" data-act="csv-answers">CSV detail jawaban</button></div></div>' +
      (ss.length ? '<div class="t-tablewrap"><table class="t-table stack"><thead><tr><th class="num">No.</th>' + th('name', 'Nama/kode siswa') + th('cls', 'Kelas') + th('date', 'Tanggal &amp; waktu') + th('score', 'Skor', 1) + '<th class="num">Benar</th><th class="num">Salah</th>' + th('acc', 'Akurasi', 1) + th('level', 'Level tertinggi') + '<th>Status penyelesaian</th></tr></thead><tbody>' +
        ss.slice(0, max).map((s, i) => { const cat = category(s.overallAccuracy, s.totalQuestions); return '<tr tabindex="0" data-student="' + esc(St.studentKey(s.studentName, s.studentClass)) + '"><td class="num">' + (i + 1) + '</td><td><b>' + esc(s.studentName) + '</b></td><td>' + esc(s.studentClass) + '</td><td>' + MR.fmt.date(s.date) + ' ' + MR.fmt.time(s.date) + '</td><td class="num">' + nf(s.totalScore) + '</td><td class="num">' + s.correctAnswers + '</td><td class="num">' + s.incorrectAnswers + '</td><td class="num">' + MR.fmt.pct(s.overallAccuracy) + ' <span class="t-pill ' + cat.key + '">' + cat.label + '</span></td><td>' + esc(s.highestLevel) + '</td><td>' + (s.status === 'tamat' ? '<span class="t-pill done">' + esc(MR.fmt.status(s)) + '</span>' : esc(MR.fmt.status(s))) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + (ss.length > max ? '<p class="t-desc">Menampilkan ' + max + ' sesi pertama. Persempit dengan filter atau gunakan Export CSV untuk semua data.</p>' : '') : emptyHTML(St.getSessions().length ? 'Tidak ada sesi yang cocok dengan filter.' : undefined)) + '</section>';
    const sel = v.querySelector('[data-act=sort-select]'); if (sel) sel.value = ['date', 'score', 'acc', 'name'].includes(D.sort.key) ? D.sort.key : 'date';
  }

  /* ---------------- 3. Analisis ---------------- */
  function viewAnalytics(v) {
    const ss = filtered(); const H = hist(ss); const stu = students(ss);
    const fa = ss.reduce((a, s) => a + s.fpbAttempted, 0), fc = ss.reduce((a, s) => a + s.fpbCorrect, 0);
    const ka = ss.reduce((a, s) => a + s.kpkAttempted, 0), kc = ss.reduce((a, s) => a + s.kpkCorrect, 0);
    const tAll = fa + ka;
    const topicBox = (cls, title, a, c) => { const cat = topicCat(c, a); return '<div class="' + cls + '"><h3>' + title + '</h3><dl><dt>Soal dikerjakan</dt><dd>' + a + '</dd><dt>Soal benar</dt><dd>' + c + '</dd><dt>Akurasi</dt><dd>' + (a ? MR.fmt.pct(pct(c, a)) : '–') + '</dd><dt>Kesimpulan</dt><dd><span class="t-pill ' + cat.key + '">' + cat.label + '</span></dd></dl></div>'; };
    // Soal paling sering salah
    const byQ = {}; H.forEach(h => { const k = h.questionId; byQ[k] = byQ[k] || { id: k, text: h.question, topic: h.topic, n: 0, wrong: 0, tags: {} }; byQ[k].n++; if (!h.isCorrect) { byQ[k].wrong++; if (h.misconception) byQ[k].tags[h.misconception] = (byQ[k].tags[h.misconception] || 0) + 1; } });
    const hard = Object.values(byQ).filter(x => x.n >= 2 && x.wrong > 0).sort((a, b) => b.wrong / b.n - a.wrong / a.n || b.n - a.n).slice(0, 8);
    const mis = {}; H.filter(h => !h.isCorrect && h.misconception).forEach(h => { mis[h.misconception] = (mis[h.misconception] || 0) + 1; });
    const misList = Object.entries(mis).sort((a, b) => b[1] - a[1]);
    v.innerHTML = filtersHTML() +
      (tAll < C.MIN_QUESTIONS_OVERALL ? '<div class="t-alert">Data belum memadai untuk analisis (baru ' + tAll + ' soal dikerjakan pada filter ini). Grafik ditampilkan apa adanya, tetapi belum layak dijadikan kesimpulan penguasaan.</div>' : '') +
      '<section class="t-panel"><h2>Penguasaan FPB dan KPK</h2><p class="t-desc">Dihitung dari jawaban aktual yang tersimpan. Kesimpulan per materi muncul jika minimal ' + C.MIN_QUESTIONS_TOPIC + ' soal sudah dikerjakan.</p>' +
      '<div class="t-topic">' + topicBox('fpb', 'FPB (Faktor Persekutuan Terbesar)', fa, fc) + topicBox('kpk', 'KPK (Kelipatan Persekutuan Terkecil)', ka, kc) + '</div>' +
      '<div class="t-chart short"><canvas id="ch-topic" aria-label="Grafik akurasi FPB dan KPK"></canvas></div></section>' +
      '<div class="t-grid2">' +
      '<section class="t-panel"><h2>Rata-rata akurasi per level</h2><p class="t-desc">Persentase jawaban benar pada setiap level.</p><div class="t-chart"><canvas id="ch-level"></canvas></div></section>' +
      '<section class="t-panel"><h2>Distribusi kategori performa siswa</h2><p class="t-desc">Sangat Baik 86–100%, Baik 76–85%, Cukup 60–75%, Perlu Bimbingan &lt; 60%.</p><div class="t-chart"><canvas id="ch-cat"></canvas></div></section>' +
      '<section class="t-panel"><h2>Jawaban benar vs salah</h2><p class="t-desc">Jumlah jawaban per materi.</p><div class="t-chart"><canvas id="ch-cw"></canvas></div></section>' +
      '<section class="t-panel"><h2>Pola kesalahan yang paling sering</h2><p class="t-desc">Diambil dari jenis pilihan salah yang dipilih siswa.</p>' +
      (misList.length ? '<table class="t-table"><tbody>' + misList.map(([k, n]) => '<tr style="cursor:default"><td>' + esc(Q.TAG_LABEL[k] || k) + '</td><td class="num"><b>' + n + '</b> kali</td></tr>').join('') + '</tbody></table>' : '<p class="t-desc">Belum ada jawaban salah.</p>') + '</section>' +
      '</div>' +
      '<section class="t-panel"><h2>Soal yang paling sering salah</h2><p class="t-desc">Soal yang dikerjakan minimal 2 kali, diurutkan dari persentase salah tertinggi.</p>' +
      (hard.length ? '<div class="t-tablewrap"><table class="t-table stack"><thead><tr><th>ID</th><th>Materi</th><th>Soal</th><th class="num">Dikerjakan</th><th class="num">Salah</th><th>Kesalahan terbanyak</th></tr></thead><tbody>' +
        hard.map(x => { const top = Object.entries(x.tags).sort((a, b) => b[1] - a[1])[0]; return '<tr style="cursor:default"><td>' + esc(x.id) + '</td><td>' + esc(x.topic) + '</td><td>' + esc(x.text) + '</td><td class="num">' + x.n + '</td><td class="num">' + x.wrong + ' (' + MR.fmt.pct(pct(x.wrong, x.n)) + ')</td><td>' + esc(top ? Q.TAG_LABEL[top[0]] : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="t-desc">Belum cukup data.</p>') + '</section>';

    if (!window.Chart) { v.querySelectorAll('.t-chart').forEach(c => c.innerHTML = '<p class="t-desc">Pustaka grafik tidak termuat.</p>'); return; }
    Chart.defaults.font.family = "'Nunito', system-ui, sans-serif"; Chart.defaults.color = '#3d4b44';
    const pctAxis = { min: 0, max: 100, ticks: { callback: x => x + '%' }, grid: { color: '#eceee9' } };
    const tip = { callbacks: { label: c => ' ' + c.dataset.label + ': ' + (typeof c.raw === 'number' ? c.raw.toLocaleString('id-ID') : c.raw) + (c.dataset.unit || '') } };
    const mk = (id, cfg) => { const el = v.querySelector('#' + id); if (el) D.charts.push(new Chart(el, cfg)); };
    mk('ch-topic', { type: 'bar', data: { labels: ['FPB', 'KPK'], datasets: [{ label: 'Akurasi', unit: '%', data: [pct(fc, fa), pct(kc, ka)], backgroundColor: ['#13b5a6', '#2f6fd6'], borderRadius: 8, maxBarThickness: 90 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: pctAxis, y: { grid: { display: false } } } } });
    const lvA = [1, 2, 3, 4].map(l => { const h = H.filter(x => x.level === l); return h.length ? pct(h.filter(x => x.isCorrect).length, h.length) : null; });
    const lvN = [1, 2, 3, 4].map(l => H.filter(x => x.level === l).length);
    mk('ch-level', { type: 'bar', data: { labels: Q.LEVELS.map(L => ['Level ' + L.id, '(' + lvN[L.id - 1] + ' soal)']), datasets: [{ label: 'Akurasi', unit: '%', data: lvA, backgroundColor: ['#2f9a52', '#c9874a', '#3d7f78', '#3d8bfd'], borderRadius: 8, maxBarThickness: 64 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: pctAxis, x: { grid: { display: false } } } } });
    const cats = C.CATEGORIES.concat([{ key: 'na', label: 'Data belum memadai', color: '#b9c2bd' }]);
    mk('ch-cat', { type: 'bar', data: { labels: cats.map(c => c.label), datasets: [{ label: 'Jumlah siswa', data: cats.map(c => stu.filter(s => s.cat.key === c.key).length), backgroundColor: cats.map(c => c.color), borderRadius: 8, maxBarThickness: 60 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eceee9' } }, x: { grid: { display: false } } } } });
    mk('ch-cw', { type: 'bar', data: { labels: ['FPB', 'KPK', 'Total'], datasets: [{ label: 'Benar', data: [fc, kc, fc + kc], backgroundColor: '#1f9d74', borderRadius: 6 }, { label: 'Salah', data: [fa - fc, ka - kc, fa - fc + ka - kc], backgroundColor: '#d9534f', borderRadius: 6 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: tip }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eceee9' } }, x: { grid: { display: false } } } } });
  }

  /* ---------------- 4. Laporan siswa ---------------- */
  function viewReport(v) {
    const all = students(St.getSessions());
    const st = D.student && all.find(s => s.key === D.student);
    if (!st) {
      const q = D.filters.q.toLowerCase(), c = D.filters.cls;
      const list = all.filter(s => (!q || s.name.toLowerCase().includes(q)) && (!c || s.cls === c)).sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name));
      v.innerHTML = filtersHTML() + '<section class="t-panel"><h2>Pilih siswa</h2><p class="t-desc">' + list.length + ' siswa. Laporan menggabungkan semua sesi siswa tersebut.</p>' +
        (list.length ? '<div class="t-studentlist">' + list.map(s => '<button class="t-student" data-student="' + esc(s.key) + '"><b>' + esc(s.name) + '</b><span>Kelas ' + esc(s.cls) + ' • ' + s.sessions.length + ' sesi • ' + (s.n ? MR.fmt.pct(s.acc) : 'belum menjawab') + '</span></button>').join('') + '</div>' : emptyHTML()) + '</section>';
      return;
    }
    v.innerHTML = reportHTML(st, false);
  }
  function reportHTML(st, standalone) {
    const fA = pct(st.fc, st.fa), kA = pct(st.kc, st.ka);
    const fCat = topicCat(st.fc, st.fa), kCat = topicCat(st.kc, st.ka);
    const wrong = st.sessions.flatMap(s => s.questionHistory.filter(h => !h.isCorrect).map(h => Object.assign({ date: s.date }, h))).sort((a, b) => b.date.localeCompare(a.date));
    const recs = recommend(st);
    const meter = (p, color) => '<div class="t-meter"><i style="width:' + Math.min(100, p) + '%;background:' + color + '"></i></div>';
    return '' +
      (standalone ? '' : '<div class="t-actions t-noprint" style="margin-bottom:12px"><button class="t-btn" data-act="back-list">← Daftar siswa</button><button class="t-btn primary" data-act="dl-report">Download laporan</button><button class="t-btn" data-act="print">Print laporan</button></div>') +
      '<section class="t-panel"><h2 style="font-size:22px">' + esc(st.name) + '</h2><p class="t-desc">Kelas ' + esc(st.cls) + ' • ' + st.sessions.length + ' sesi • terakhir bermain ' + MR.fmt.date(st.last) + ' ' + MR.fmt.time(st.last) + '</p>' +
      '<div class="t-kv"><div><span>Total skor (semua sesi)</span><b>' + nf(st.totalScore) + '</b><small> skor tertinggi ' + nf(st.bestScore) + '</small></div>' +
      '<div><span>Akurasi keseluruhan</span><b>' + (st.n ? MR.fmt.pct(st.acc) : '–') + '</b>' + meter(st.acc, st.cat.color || '#9aa5a0') + '<small><span class="t-pill ' + st.cat.key + '">' + st.cat.label + '</span> ' + st.c + '/' + st.n + ' soal</small></div>' +
      '<div><span>Akurasi FPB</span><b>' + (st.fa ? MR.fmt.pct(fA) : '–') + '</b>' + meter(fA, '#13b5a6') + '<small><span class="t-pill ' + fCat.key + '">' + fCat.label + '</span> ' + st.fc + '/' + st.fa + '</small></div>' +
      '<div><span>Akurasi KPK</span><b>' + (st.ka ? MR.fmt.pct(kA) : '–') + '</b>' + meter(kA, '#2f6fd6') + '<small><span class="t-pill ' + kCat.key + '">' + kCat.label + '</span> ' + st.kc + '/' + st.ka + '</small></div></div>' +
      '<p style="margin:0"><b>Level yang berhasil diselesaikan:</b> ' + (st.levels.length ? st.levels.map(l => 'Level ' + l + ' (' + esc(Q.LEVELS[l - 1].name) + ')').join(', ') : 'belum ada') + '</p></section>' +
      '<section class="t-panel"><h2>Rekomendasi tindak lanjut pembelajaran</h2><p class="t-desc">Disusun otomatis dari jawaban yang tersimpan, bukan dibuat acak. Tinjau kembali sesuai pengamatan Anda di kelas.</p>' +
      recs.map(r => '<p class="t-rec' + (r.warn ? ' warn' : '') + '">' + esc(r.text) + '</p>').join('') + '</section>' +
      '<section class="t-panel"><h2>Riwayat sesi permainan</h2><div class="t-tablewrap"><table class="t-table stack"><thead><tr><th>Tanggal &amp; waktu</th><th class="num">Skor</th><th class="num">Benar</th><th class="num">Salah</th><th class="num">Akurasi</th><th class="num">Akurasi FPB</th><th class="num">Akurasi KPK</th><th>Level selesai</th><th>Status</th>' + (standalone ? '' : '<th class="t-noprint"></th>') + '</tr></thead><tbody>' +
      st.sessions.map(s => '<tr style="cursor:default"><td>' + MR.fmt.date(s.date) + ' ' + MR.fmt.time(s.date) + '</td><td class="num">' + nf(s.totalScore) + '</td><td class="num">' + s.correctAnswers + '</td><td class="num">' + s.incorrectAnswers + '</td><td class="num">' + MR.fmt.pct(s.overallAccuracy) + '</td><td class="num">' + (s.fpbAttempted ? MR.fmt.pct(pct(s.fpbCorrect, s.fpbAttempted)) : '–') + '</td><td class="num">' + (s.kpkAttempted ? MR.fmt.pct(pct(s.kpkCorrect, s.kpkAttempted)) : '–') + '</td><td>' + (s.completedLevels.join(', ') || '–') + '</td><td>' + esc(MR.fmt.status(s)) + '</td>' + (standalone ? '' : '<td class="t-noprint"><button class="t-btn" data-del-session="' + esc(s.sessionId) + '">Hapus</button></td>') + '</tr>').join('') +
      '</tbody></table></div></section>' +
      '<section class="t-panel"><h2>Soal yang salah dijawab (' + wrong.length + ')</h2><p class="t-desc">Beserta jawaban siswa, jawaban benar, dan konsep yang perlu dipelajari kembali.</p>' +
      (wrong.length ? wrong.map(h => { const q = Q.BY_ID[h.questionId]; return '<div class="t-wrong"><h4>[' + esc(h.topic) + ' • ' + esc(h.subIndicator || '') + ' • Level ' + h.level + '] ' + esc(h.question) + '</h4><div class="ans"><span>Jawaban siswa: <b class="no">' + esc(h.studentAnswer) + '</b></span><span>Jawaban benar: <b class="yes">' + esc(h.correctAnswer) + '</b></span>' + (h.misconception ? '<span>Pola: ' + esc(Q.TAG_LABEL[h.misconception] || h.misconception) + '</span>' : '') + '</div><p><b>Konsep:</b> ' + esc(q ? q.explanation : 'Penjelasan tidak tersedia untuk soal ini.') + '</p></div>'; }).join('') : '<p class="t-desc">Tidak ada jawaban salah. ' + (st.n ? 'Hebat!' : '') + '</p>') + '</section>';
  }
  function standaloneReport(st) {
    const css = document.querySelector('link[href="style.css"]') ? '' : '';
    const style = 'body{font:14px/1.5 system-ui,Segoe UI,sans-serif;color:#1f2a24;max-width:900px;margin:24px auto;padding:0 16px}h1{font-size:20px;color:#123b2c;margin:0}h2{font-size:17px;color:#123b2c;margin:0 0 4px}.t-panel{border:1px solid #ddd;border-radius:10px;padding:12px 14px;margin:12px 0;break-inside:avoid}.t-desc{color:#5a6a62;margin:0 0 8px}.t-kv{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.t-kv div{border:1px solid #eee;border-radius:8px;padding:8px}.t-kv span{display:block;font-size:11px;font-weight:700;color:#5a6a62}.t-kv b{font-size:18px}.t-meter{height:8px;background:#eee;border-radius:9px;overflow:hidden;margin:4px 0}.t-meter i{display:block;height:100%}.t-pill{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:700;background:#eee}.t-rec{border-left:4px solid #13b5a6;background:#f4f8f5;padding:8px 10px;margin:0 0 6px;border-radius:6px}.t-rec.warn{border-left-color:#e0a526;background:#fdf8ea}table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{border-bottom:1px solid #eee;padding:5px;text-align:left}.num{text-align:right}.t-wrong{border:1px solid #eee;border-radius:8px;padding:8px;margin-bottom:6px}.t-wrong h4{margin:0 0 3px;font-size:13px}.t-wrong p{margin:0}.ans{display:flex;gap:14px;flex-wrap:wrap}.no{color:#b3261e}.yes{color:#0f6b4c}';
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Laporan ' + esc(st.name) + ' – Math Runner</title><style>' + style + css + '</style></head><body><h1>MATH RUNNER – Laporan Hasil Belajar Siswa</h1><p class="t-desc">Dibuat ' + MR.fmt.date(new Date().toISOString()) + ' ' + MR.fmt.time(new Date().toISOString()) + ' • Materi FPB &amp; KPK kelas IV</p>' + reportHTML(st, true) + '</body></html>';
  }

  /* ---------------- 5. Data & pengaturan ---------------- */
  function viewData(v) {
    const n = St.getSessions().length; const kb = St.usageBytes() / 1024;
    const sep = St.getSetting('csvSeparator', ',');
    v.innerHTML =
      (D.importMsg ? '<div class="t-alert' + (D.importMsg.err ? ' err' : '') + '">' + esc(D.importMsg.text) + '</div>' : '') +
      '<div class="t-grid2">' +
      '<section class="t-panel"><h2>Tentang penyimpanan</h2><p>Saat ini tersimpan <b>' + n + ' sesi</b> (± ' + kb.toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' KB) di LocalStorage browser ini.</p>' +
      '<ul style="margin:0;padding-left:20px;color:#3d4b44"><li>Data hanya ada di <b>browser dan perangkat ini</b>, tidak tersinkron ke perangkat lain.</li><li>Satu perangkat dapat dipakai bergantian oleh banyak siswa.</li><li>Untuk menggabungkan hasil dari perangkat lain: di perangkat itu klik <b>Backup data (JSON)</b>, lalu di sini klik <b>Import</b>. Sesi yang sama tidak akan tergandakan.</li><li>Menghapus riwayat/cache browser dapat menghapus data. Lakukan backup secara berkala.</li><li>Batas LocalStorage biasanya sekitar 5 MB per situs (dapat berbeda antarbrowser).</li></ul></section>' +
      '<section class="t-panel"><h2>Export &amp; backup</h2><p class="t-desc">Export memakai filter yang sedang aktif di halaman lain; backup selalu berisi seluruh data.</p>' +
      '<label style="display:block;font-weight:700;font-size:13px;margin-bottom:8px">Pemisah kolom CSV <select class="t-input" data-act="csv-sep" style="width:auto;display:inline-block;margin-left:6px"><option value=","' + (sep === ',' ? ' selected' : '') + '>Koma (,) – Google Sheets / Excel bahasa Inggris</option><option value=";"' + (sep === ';' ? ' selected' : '') + '>Titik koma (;) – Excel pengaturan Indonesia</option></select></label>' +
      '<div class="t-actions"><button class="t-btn primary" data-act="csv-sessions">Export CSV (per sesi)</button><button class="t-btn" data-act="csv-answers">CSV detail jawaban</button><button class="t-btn" data-act="backup">Backup data (JSON)</button><button class="t-btn" data-act="copy-json">Salin backup JSON</button></div>' +
      '<p class="t-desc" style="margin-top:8px">Jika tombol unduh tidak bekerja (mis. di dalam Google Sites atau pratinjau), buka aplikasi di tab baru atau gunakan tombol Salin lalu tempel ke berkas teks.</p></section>' +
      '<section class="t-panel"><h2>Import data</h2><p class="t-desc">Terima file backup .json atau file "Export CSV (per sesi)" dari dashboard ini. Sesi dengan ID yang sudah ada akan dilewati.</p>' +
      '<div class="t-actions"><input type="file" class="t-input" id="t-import" accept=".json,.csv,application/json,text/csv" style="max-width:320px"><button class="t-btn primary" data-act="import">Import</button><button class="t-btn" data-act="paste-import">Tempel teks JSON</button></div></section>' +
      '<section class="t-panel"><h2>Ganti PIN guru</h2><p class="t-desc">PIN disimpan di browser ini. PIN bawaan diatur di config.js. Ingat: PIN hanya penghalang sederhana, bukan keamanan.</p>' +
      '<div class="t-actions"><input class="t-input" id="pin-old" type="password" inputmode="numeric" placeholder="PIN lama" style="max-width:140px"><input class="t-input" id="pin-new" type="password" inputmode="numeric" placeholder="PIN baru (4–12)" style="max-width:160px"><input class="t-input" id="pin-new2" type="password" inputmode="numeric" placeholder="Ulangi PIN baru" style="max-width:160px"><button class="t-btn primary" data-act="pin">Simpan PIN</button></div><p class="t-desc" id="pin-msg" style="margin-top:6px"></p></section>' +
      '<section class="t-panel"><h2>Reset dashboard</h2><p class="t-desc">Mengembalikan filter, urutan tabel, pemisah CSV, dan PIN ke pengaturan bawaan. <b>Data siswa tidak dihapus.</b></p><button class="t-btn" data-act="reset-dash">Reset dashboard</button></section>' +
      '<section class="t-panel"><h2>Hapus seluruh data</h2><p class="t-desc">Menghapus semua sesi dan lencana di perangkat ini secara permanen. Lakukan backup terlebih dahulu.</p><button class="t-btn danger" data-act="wipe">Hapus seluruh data…</button></section>' +
      '</div>' +
      '<section class="t-panel"><h2>Pengembangan berikutnya: sinkronisasi antarperangkat</h2><p class="t-desc" style="margin:0">Struktur penyimpanan sudah memakai adapter (lihat <code>storage.js › MR.Storage.registerRemote</code>) dan versi skema ' + C.SCHEMA_VERSION + ', sehingga kelak dapat dihubungkan ke Firebase atau Supabase tanpa mengubah game maupun dashboard.</p></section>';
  }

  /* ---------------- Aksi ---------------- */
  function stamp() { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); }
  function deliver(name, content, mime) {
    MR.download(name, content, mime);
    if (MR.inIframe) MR.toast('Jika file tidak terunduh, gunakan "Buka di tab baru" atau tombol Salin.', 'long');
  }
  async function showCopy(title, text) {
    await MR.dialog({ title, html: '<p>Salin teks di bawah, lalu tempel ke berkas teks (.json/.csv).</p><textarea readonly id="copy-ta">' + esc(text) + '</textarea>', buttons: [{ label: 'Salin', primary: true, value: () => { const ta = document.getElementById('copy-ta'); ta.select(); try { navigator.clipboard.writeText(ta.value).catch(() => document.execCommand('copy')); } catch (e) { document.execCommand('copy'); } return true; } }, { label: 'Tutup', value: false }] });
  }
  async function doImport(text, name) {
    try {
      const isCSV = /\.csv$/i.test(name || '') || (!/^\s*[\[{]/.test(text));
      const r = isCSV ? St.importCSVText(text) : St.importJSONText(text);
      D.importMsg = { text: 'Import selesai: ' + r.added + ' sesi baru ditambahkan, ' + r.skipped + ' sesi dilewati karena sudah ada' + (r.invalid ? ', ' + r.invalid + ' baris tidak valid' : '') + '.' };
    } catch (e) { D.importMsg = { err: true, text: 'Import gagal: ' + e.message }; }
    render();
  }

  function bind() {
    const r = root();
    r.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { D.view = b.dataset.nav; D.importMsg = null; render(); root().scrollTop = 0; });
    r.querySelectorAll('[data-f]').forEach(el => {
      const ev = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
      el.addEventListener(ev, () => {
        D.filters[el.dataset.f] = el.value;
        const pos = el.selectionStart, k = el.dataset.f;
        render();
        const again = root().querySelector('[data-f="' + k + '"]'); if (again && k === 'q') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { } }
      });
    });
    r.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; D.sort = { key: k, dir: D.sort.key === k ? -D.sort.dir : (k === 'name' || k === 'cls' ? 1 : -1) }; render(); });
    r.querySelectorAll('[data-student]').forEach(el => {
      const go = () => { D.student = el.dataset.student; D.view = 'report'; render(); root().scrollTop = 0; };
      el.addEventListener('click', go); el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    r.querySelectorAll('[data-del-session]').forEach(b => b.onclick = async () => {
      const ok = await MR.dialog({ title: 'Hapus sesi ini?', html: '<p>Sesi akan dihapus permanen dari perangkat ini.</p>', buttons: [{ label: 'Batal', value: false }, { label: 'Hapus sesi', danger: true, value: true }] });
      if (ok) { St.deleteSession(b.dataset.delSession); render(); }
    });
    const act = r.querySelectorAll('[data-act]');
    act.forEach(el => {
      const a = el.dataset.act;
      if (a === 'sort-select') { el.onchange = () => { D.sort = { key: el.value, dir: el.value === 'name' ? 1 : -1 }; render(); }; return; }
      if (a === 'csv-sep') { el.onchange = () => { St.setSetting('csvSeparator', el.value); }; return; }
      el.addEventListener('click', async () => {
        if (a === 'exit') close();
        else if (a === 'clear-filters') { D.filters = { q: '', cls: '', from: '', to: '', level: '' }; render(); }
        else if (a === 'csv-sessions') { const ss = sortSessions(filtered()); if (!ss.length) return MR.dialog({ title: 'Tidak ada data', html: '<p>Tidak ada sesi untuk diekspor pada filter ini.</p>' }); deliver('math-runner-sesi-' + stamp() + '.csv', St.sessionsToCSV(ss), 'text/csv;charset=utf-8'); }
        else if (a === 'csv-answers') { const ss = sortSessions(filtered()); if (!ss.length) return MR.dialog({ title: 'Tidak ada data', html: '<p>Tidak ada sesi untuk diekspor pada filter ini.</p>' }); deliver('math-runner-jawaban-' + stamp() + '.csv', St.answersToCSV(ss), 'text/csv;charset=utf-8'); }
        else if (a === 'backup') deliver('math-runner-backup-' + stamp() + '.json', St.exportJSON(), 'application/json');
        else if (a === 'copy-json') showCopy('Backup JSON', St.exportJSON());
        else if (a === 'import') {
          const f = root().querySelector('#t-import').files[0];
          if (!f) { D.importMsg = { err: true, text: 'Pilih file .json atau .csv terlebih dahulu.' }; return render(); }
          const text = await f.text(); doImport(text, f.name);
        } else if (a === 'paste-import') {
          const text = await MR.dialog({ title: 'Tempel data JSON', html: '<p>Tempel isi file backup JSON di sini.</p><textarea id="paste-ta"></textarea>', buttons: [{ label: 'Batal', value: null }, { label: 'Import', primary: true, value: () => document.getElementById('paste-ta').value }] });
          if (text) doImport(text, 'paste.json');
        } else if (a === 'pin') {
          const o = root().querySelector('#pin-old').value, n1 = root().querySelector('#pin-new').value, n2 = root().querySelector('#pin-new2').value, msg = root().querySelector('#pin-msg');
          if (o !== St.getPin()) msg.textContent = 'PIN lama salah.';
          else if (!/^\d{4,12}$/.test(n1)) msg.textContent = 'PIN baru harus 4–12 angka.';
          else if (n1 !== n2) msg.textContent = 'Ulangan PIN baru tidak sama.';
          else { St.setSetting('pin', n1); msg.textContent = 'PIN berhasil diganti.'; ['pin-old', 'pin-new', 'pin-new2'].forEach(id => root().querySelector('#' + id).value = ''); }
        } else if (a === 'reset-dash') {
          const ok = await MR.dialog({ title: 'Reset dashboard?', html: '<p>Filter, urutan, pemisah CSV, dan PIN dikembalikan ke bawaan (PIN bawaan dari config.js). Data siswa <b>tidak</b> dihapus.</p>', buttons: [{ label: 'Batal', value: false }, { label: 'Reset', primary: true, value: true }] });
          if (ok) { D.filters = { q: '', cls: '', from: '', to: '', level: '' }; D.sort = { key: 'date', dir: -1 }; D.student = null; St.load().settings = {}; St.persist(); D.importMsg = { text: 'Dashboard telah direset ke pengaturan bawaan.' }; render(); }
        } else if (a === 'wipe') {
          const n = St.getSessions().length;
          const ok = await MR.dialog({ title: 'Hapus seluruh data?', html: '<p>Anda akan menghapus <b>' + n + ' sesi</b> dan semua lencana siswa di perangkat ini. Tindakan ini tidak dapat dibatalkan.</p><p>Ketik <b>HAPUS</b> untuk mengonfirmasi:</p><input id="wipe-in" autocomplete="off">', buttons: [{ label: 'Batal', value: false }, { label: 'Hapus permanen', danger: true, value: () => document.getElementById('wipe-in').value.trim().toUpperCase() === 'HAPUS', validate: () => { const ok2 = document.getElementById('wipe-in').value.trim().toUpperCase() === 'HAPUS'; if (!ok2) document.getElementById('wipe-in').style.borderColor = '#b3261e'; return ok2; } }] });
          if (ok) { St.clearAll(); D.importMsg = { text: 'Seluruh data telah dihapus.' }; render(); }
        } else if (a === 'back-list') { D.student = null; render(); }
        else if (a === 'dl-report') { const st = students(St.getSessions()).find(s => s.key === D.student); if (st) deliver('laporan-' + st.name.replace(/[^\w-]+/g, '_') + '-' + stamp() + '.html', standaloneReport(st), 'text/html;charset=utf-8'); }
        else if (a === 'print') { try { window.print(); } catch (e) { } if (MR.inIframe) MR.toast('Jika jendela cetak tidak muncul, buka aplikasi di tab baru atau gunakan Download laporan.', 'long'); }
      });
    });
  }

  MR.Dashboard = { open, close, recommend, students, category, _state: D };
})();
