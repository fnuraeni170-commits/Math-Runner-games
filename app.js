/* =========================================================
   MATH RUNNER — Aplikasi utama (alur siswa, sesi, skor, lencana)
   ========================================================= */
(function () {
  'use strict';
  const C = MR.Config, Q = MR.Questions, St = MR.Storage, A = MR.Audio, esc = MR.fmt.esc;
  const $ = id => document.getElementById(id);
  const DIFF_LABEL = { easy: 'Mudah', medium: 'Sedang', challenge: 'Tantangan' };

  /* ---------------- Lencana & relik (SVG orisinal) ---------------- */
  const BADGES = [
    { id: 'factor_master', name: 'Factor Master', desc: 'Minimal 5 soal FPB benar dengan akurasi FPB ≥ 80% dalam satu sesi.', color: '#13b5a6', glyph: 'FPB' },
    { id: 'multiple_explorer', name: 'Multiple Explorer', desc: 'Minimal 5 soal KPK benar dengan akurasi KPK ≥ 80% dalam satu sesi.', color: '#3d8bfd', glyph: 'KPK' },
    { id: 'coin_collector', name: 'Coin Collector', desc: 'Kumpulkan 150 koin dalam satu sesi.', color: '#f2b632', glyph: 'coin' },
    { id: 'math_adventurer', name: 'Math Adventurer', desc: 'Selesaikan 2 level dalam satu sesi.', color: '#2f9a52', glyph: 'compass' },
    { id: 'champion', name: 'Lost Temple Champion', desc: 'Selesaikan keempat level dari Level 1 sampai Level 4.', color: '#d98f12', glyph: 'crown' }
  ];
  function badgeSVG(b) {
    let inner = '';
    if (b.glyph === 'coin') inner = '<circle cx="50" cy="52" r="20" fill="#ffe28a" stroke="#8a5a10" stroke-width="4"/><path d="M50 40l3.5 7.5 8 .9-6 5.4 1.7 8-7.2-4.1-7.2 4.1 1.7-8-6-5.4 8-.9z" fill="#d98f12"/>';
    else if (b.glyph === 'compass') inner = '<circle cx="50" cy="52" r="20" fill="#fff8e7" stroke="#1e5b3a" stroke-width="4"/><path d="M50 34l6 18-6 18-6-18z" fill="#ff6b5e"/><path d="M50 52l6 0-6 18z" fill="#1e5b3a"/><circle cx="50" cy="52" r="3" fill="#1e5b3a"/>';
    else if (b.glyph === 'crown') inner = '<path d="M30 62l-3-24 13 10 10-16 10 16 13-10-3 24z" fill="#ffe28a" stroke="#8a5a10" stroke-width="3" stroke-linejoin="round"/><rect x="30" y="62" width="40" height="7" rx="2" fill="#8a5a10"/><circle cx="50" cy="50" r="4" fill="#13b5a6"/>';
    else inner = '<text x="50" y="61" text-anchor="middle" font-family="Baloo 2, system-ui, sans-serif" font-weight="800" font-size="25" fill="#fff">' + b.glyph + '</text>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4l40 20v30c0 22-18 36-40 42C28 90 10 76 10 54V24z" fill="' + b.color + '" stroke="#3a2205" stroke-width="4"/><path d="M50 12l32 16v25c0 17-14 29-32 34-18-5-32-17-32-34V28z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5"/>' + inner + '</svg>';
  }
  function badgeHTML(b, state) { return '<div class="badge ' + (state || '') + '">' + badgeSVG(b) + '<div><b>' + esc(b.name) + '</b><small>' + esc(b.desc) + '</small></div></div>'; }
  const RELICS = {
    1: { name: 'Amulet Hutan', color: '#2f9a52' }, 2: { name: 'Kompas Jembatan', color: '#c9874a' },
    3: { name: 'Kunci Kuil Misteri', color: '#2fe0c8' }, 4: { name: 'Kristal Sang Penjaga', color: '#3d8bfd' }
  };
  function relicSVG(l) {
    const c = RELICS[l].color;
    return '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="' + c + '" opacity=".25"/><circle cx="60" cy="60" r="40" fill="#ffd772" stroke="#8a5a10" stroke-width="5"/><polygon points="60,30 82,60 60,90 38,60" fill="' + c + '" stroke="#3a2205" stroke-width="4"/><polygon points="60,40 72,60 60,80 48,60" fill="#fff" opacity=".5"/><text x="60" y="114" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="16" fill="#ffd772">LEVEL ' + l + '</text></svg>';
  }
  const HEART = full => '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.4C.3 8.3 2.3 4 6.3 4c2.3 0 3.9 1.3 5.7 3.4C13.8 5.3 15.4 4 17.7 4c4 0 6 4.3 4.3 7.6C19.5 16.4 12 21 12 21z" fill="' + (full ? '#ff5d6e' : 'rgba(255,255,255,.18)') + '" stroke="' + (full ? '#fff' : 'rgba(255,255,255,.4)') + '" stroke-width="1.5"/></svg>';

  /* ---------------- State aplikasi ---------------- */
  const App = { session: null, levelQs: [], presented: [], qShownAt: 0, levelRecord: null, startLevel: 1, chosenLevel: 1, student: null, saved: false, newBadges: [] };
  MR.App = App;

  /* ---------------- Navigasi layar ---------------- */
  const SCREENS = ['scr-menu', 'scr-howto', 'scr-learn', 'scr-results'];
  const GAME_UI = ['hud', 'qpanel', 'vcontrols', 'ov-pause', 'ov-feedback', 'ov-down', 'ov-level'];
  function show(id) {
    SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id));
    if (id) GAME_UI.forEach(g => $(g).classList.add('hidden'));
  }
  function go(where) {
    A.unlock(); A.sfx('click');
    if (where === 'teacher') { setHash('teacher'); MR.Dashboard.open(); return; }
    if (where === 'learn') { show('scr-learn'); MR.Learning.render($('learn-root'), () => { if (App.returnToPause) { App.returnToPause = false; show(null); showGameUI(); $('ov-pause').classList.remove('hidden'); } else go('menu'); }); setHash('learn'); return; }
    if (where === 'howto') { show('scr-howto'); setHash('howto'); return; }
    // menu
    App.session = null;
    MR.Game.setMenu(); A.music('menu');
    show('scr-menu'); setHash('');
  }
  function setHash(h) { try { if (h) history.replaceState(null, '', '#' + h); else history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
  MR.goMenu = () => go('menu');

  /* ---------------- Dialog umum ---------------- */
  MR.dialog = function ({ title, html, buttons }) {
    return new Promise(resolve => {
      $('dlg-title').textContent = title || '';
      $('dlg-body').innerHTML = html || '';
      const act = $('dlg-actions'); act.innerHTML = '';
      (buttons || [{ label: 'OK', value: true, primary: true }]).forEach(b => {
        const btn = document.createElement('button');
        btn.className = 't-btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
        btn.textContent = b.label;
        btn.onclick = () => {
          if (b.validate && !b.validate()) return;
          const v = typeof b.value === 'function' ? b.value() : b.value;
          $('dialog').classList.add('hidden'); resolve(v);
        };
        act.appendChild(btn);
      });
      $('dialog').classList.remove('hidden');
      const f = $('dlg-body').querySelector('input,textarea') || act.lastChild; if (f) setTimeout(() => f.focus(), 30);
    });
  };
  MR.toast = function (html, cls, ms) {
    const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.innerHTML = html;
    $('toasts').appendChild(t); setTimeout(() => t.remove(), ms || (cls && cls.includes('long') ? 5600 : 3500));
  };

  /* ---------------- Menu: formulir ---------------- */
  function buildMenu() {
    const sel = $('in-class');
    sel.innerHTML = '<option value="">Pilih kelas…</option>' + C.CLASSES.map(c => '<option>' + esc(c) + '</option>').join('') + '<option value="__other">Lainnya…</option>';
    sel.onchange = () => $('other-class-wrap').classList.toggle('hidden', sel.value !== '__other');
    $('level-grid').innerHTML = Q.LEVELS.map(L => '<button type="button" class="lvl-btn" data-l="' + L.id + '" aria-pressed="' + (L.id === 1) + '"><b>' + L.id + '</b><small>' + esc(L.name) + '</small></button>').join('');
    $('level-grid').onclick = e => { const b = e.target.closest('.lvl-btn'); if (!b) return; App.chosenLevel = +b.dataset.l; [...$('level-grid').children].forEach(x => x.setAttribute('aria-pressed', x === b)); A.unlock(); A.sfx('click'); };
    try { const last = JSON.parse(localStorage.getItem('mathRunner.lastStudent') || 'null'); if (last) { $('in-name').value = last.name || ''; if (C.CLASSES.includes(last.cls)) sel.value = last.cls; else if (last.cls) { sel.value = '__other'; $('in-class-other').value = last.cls; $('other-class-wrap').classList.remove('hidden'); } } } catch (e) { }
    $('start-form').onsubmit = e => {
      e.preventDefault(); A.unlock();
      const name = $('in-name').value.trim().replace(/\s+/g, ' ');
      let cls = sel.value === '__other' ? $('in-class-other').value.trim() : sel.value;
      const err = $('form-error');
      if (!name) { err.textContent = 'Tulis nama panggilan atau kode siswa dulu, ya.'; $('in-name').focus(); return; }
      if (/@|\d{8,}/.test(name)) { err.textContent = 'Gunakan nama panggilan/kode saja, jangan email atau nomor telepon.'; return; }
      if (!cls) { err.textContent = 'Pilih kelasmu dulu, ya.'; sel.focus(); return; }
      err.textContent = '';
      try { localStorage.setItem('mathRunner.lastStudent', JSON.stringify({ name, cls })); } catch (e2) { }
      startSession(name, cls, App.chosenLevel);
    };
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    $('howto-badges').innerHTML = BADGES.map(b => badgeHTML(b)).join('');
    $('sel-quality').value = MR.Game.quality;
    $('sel-quality').onchange = e => MR.Game.setQuality(e.target.value);
    const syncSound = () => { $('btn-sound-menu').textContent = 'Suara: ' + (A.isMuted() ? 'OFF' : 'ON'); $('btn-sound').classList.toggle('off', A.isMuted()); };
    $('btn-sound-menu').onclick = () => { A.unlock(); A.setMuted(!A.isMuted()); syncSound(); };
    $('btn-sound').onclick = () => { A.setMuted(!A.isMuted()); syncSound(); };
    syncSound();
    if (MR.inIframe) { const a = $('open-tab'); a.classList.remove('hidden'); try { a.href = location.href.split('#')[0]; } catch (e) { } }
  }

  /* ---------------- Sesi ---------------- */
  function newId() { return 'S' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase(); }
  function startSession(name, cls, level) {
    App.student = { name, cls };
    App.startLevel = level; App.saved = false; App.newBadges = [];
    App.session = {
      studentName: name, studentClass: cls, sessionId: newId(), date: new Date().toISOString(),
      totalScore: 0, totalCoins: 0, totalQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, overallAccuracy: 0,
      fpbAttempted: 0, fpbCorrect: 0, kpkAttempted: 0, kpkCorrect: 0, completedLevels: [], highestLevel: 'Level ' + level,
      startLevel: level, status: 'bermain', achievements: [], durationSec: 0, appVersion: C.APP_VERSION, questionHistory: [], _t0: Date.now()
    };
    saveProgress();
    startLevel(level);
  }
  function saveProgress() {
    const s = App.session; if (!s) return;
    s.durationSec = Math.round((Date.now() - s._t0) / 1000);
    const copy = Object.assign({}, s); delete copy._t0;
    St.upsertSession(copy);
  }

  function startLevel(L) {
    const s = App.session;
    App.level = L;
    App.levelQs = Q.pickForLevel(L);
    App.presented = App.levelQs.map(q => Q.presentOptions(q));
    App.levelRecord = { level: L, correct: 0, total: 0, coins: 0 };
    s.highestLevel = 'Level ' + Math.max(L, parseInt(String(s.highestLevel).replace(/\D/g, '')) || 0);
    show(null); showGameUI();
    $('qpanel').classList.add('hidden');
    const def = Q.LEVELS[L - 1];
    $('hud-level').textContent = 'LEVEL ' + L + ' – ' + def.name.toUpperCase();
    $('hud-mission').textContent = 'Misi: ' + def.mission;
    MR.Game.startLevel(L, App.levelQs.length);
    renderHud();
    banner('LEVEL ' + L, def.name.toUpperCase(), MR.Game.THEMES[MR.Game.LEVEL_THEME[L]].label + ' • ' + def.focus);
    saveProgress();
  }
  function showGameUI() {
    $('hud').classList.remove('hidden');
    const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    $('vcontrols').classList.toggle('hidden', !touch);
  }
  function banner(sub, main, env) {
    const b = $('banner'); $('banner-sub').textContent = sub; $('banner-main').textContent = main; $('banner-env').textContent = env;
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.add('hidden'), 2700);
  }

  /* ---------------- HUD ---------------- */
  function renderHud() {
    const s = App.session; if (!s) return;
    const G = MR.Game.state;
    $('hud-score').textContent = s.totalScore.toLocaleString('id-ID');
    $('hud-coins').textContent = s.totalCoins;
    $('hud-correct').textContent = s.correctAnswers;
    $('hud-hearts').innerHTML = [0, 1, 2].map(i => HEART(i < G.hearts)).join('');
    const lvHist = s.questionHistory.filter(h => h.level === App.level);
    $('hud-progress').innerHTML = App.levelQs.map((q, i) => {
      const h = lvHist[i]; const cls = h ? (h.isCorrect ? 'ok' : 'no') : (i === G.gateIndex && G.q ? 'now' : '');
      return '<i class="' + cls + '" title="Gerbang ' + (i + 1) + '"></i>';
    }).join('');
  }

  /* ---------------- Soal ---------------- */
  function showQuestion(i) {
    const q = App.levelQs[i], opts = App.presented[i];
    $('q-topic').textContent = q.topic; $('q-topic').classList.toggle('kpk', q.topic === 'KPK');
    $('q-diff').textContent = DIFF_LABEL[q.difficulty] + (q.isStory ? ' • Soal cerita' : '');
    $('q-count').textContent = 'Gerbang ' + (i + 1) + '/' + App.levelQs.length;
    $('q-text').textContent = q.text;
    const lanes = ['◀ A<span class="lt"> • Kiri</span>', '▲ B<span class="lt"> • Tengah</span>', 'C<span class="lt"> • Kanan</span> ▶'];
    $('q-options').innerHTML = opts.map((o, k) => '<button class="q-opt" data-k="' + k + '"><span class="lane">' + lanes[k] + '</span><span class="val">' + esc(o.value) + (q.unit ? ' <small style="font-size:.6em">' + esc(q.unit) + '</small>' : '') + '</span></button>').join('');
    $('q-hint').textContent = 'Pindah ke jalur gerbang yang benar, atau ketuk jawabanmu.';
    $('qpanel').classList.remove('need', 'hidden');
    highlightLane(MR.Game.state.lane, false);
    App.qShownAt = performance.now();
    MR.Audio.sfx('gate');
  }
  function highlightLane(lane, chosen) {
    [...$('q-options').children].forEach((b, k) => b.classList.toggle('sel', chosen !== false && k === lane));
  }

  /* ---------------- Lencana ---------------- */
  function checkBadges() {
    const s = App.session; const got = new Set(s.achievements); const earned = [];
    const fAcc = s.fpbAttempted ? s.fpbCorrect / s.fpbAttempted * 100 : 0, kAcc = s.kpkAttempted ? s.kpkCorrect / s.kpkAttempted * 100 : 0;
    const rules = {
      factor_master: s.fpbCorrect >= 5 && fAcc >= 80,
      multiple_explorer: s.kpkCorrect >= 5 && kAcc >= 80,
      coin_collector: s.totalCoins >= 150,
      math_adventurer: s.completedLevels.length >= 2,
      champion: [1, 2, 3, 4].every(l => s.completedLevels.includes(l))
    };
    Object.keys(rules).forEach(k => { if (rules[k] && !got.has(k)) { s.achievements.push(k); earned.push(k); } });
    if (earned.length) {
      St.addBadges(s.studentName, s.studentClass, earned);
      App.newBadges.push(...earned);
      earned.forEach(k => { const b = BADGES.find(x => x.id === k); MR.toast('<b style="color:#ffd772">Lencana baru!</b> ' + esc(b.name), 'good'); });
      A.sfx('badge');
    }
    return earned;
  }

  /* ---------------- Hooks dari mesin game ---------------- */
  const hooks = {
    onHud: () => renderHud(),
    onCoin() {
      const s = App.session; if (!s) return;
      s.totalCoins++; s.totalScore += C.POINTS_PER_COIN; App.levelRecord.coins++;
      if (s.totalCoins === 150) checkBadges();
      renderHud();
    },
    onGateSpawn(i) {
      const q = App.levelQs[i]; if (!q) return null;
      showQuestion(i);
      return { labels: App.presented[i].map(o => o.value), title: q.topic === 'FPB' ? 'THE FACTOR GATE' : 'THE MULTIPLE GATE', readWords: q.text.split(/\s+/).length };
    },
    onLaneChange(lane) { highlightLane(lane, true); $('qpanel').classList.remove('need'); },
    onNeedChoice() { $('qpanel').classList.add('need'); $('q-hint').textContent = 'Pilih salah satu gerbang dulu: geser ke jalurnya atau ketuk jawabannya!'; },
    onChoiceMade() { $('qpanel').classList.remove('need'); },
    onGateCross(i, lane) {
      const s = App.session, q = App.levelQs[i], opt = App.presented[i][lane];
      const correct = String(opt.value) === String(q.answer);
      const correctLane = App.presented[i].findIndex(o => String(o.value) === String(q.answer));
      const timeSec = Math.round((performance.now() - App.qShownAt) / 100) / 10;
      s.questionHistory.push({
        questionId: q.id, topic: q.topic, subIndicator: q.subIndicator, difficulty: q.difficulty, level: App.level,
        question: q.text, studentAnswer: String(opt.value), correctAnswer: String(q.answer), isCorrect: correct,
        timeSec, misconception: correct ? '' : opt.tag, answeredAt: new Date().toISOString()
      });
      s.totalQuestions++; App.levelRecord.total++;
      if (q.topic === 'FPB') { s.fpbAttempted++; if (correct) s.fpbCorrect++; } else { s.kpkAttempted++; if (correct) s.kpkCorrect++; }
      if (correct) { s.correctAnswers++; s.totalScore += C.POINTS_CORRECT; App.levelRecord.correct++; }
      s.incorrectAnswers = s.totalQuestions - s.correctAnswers;
      s.overallAccuracy = St.pct(s.correctAnswers, s.totalQuestions);
      $('qpanel').classList.add('hidden');
      if (correct) {
        MR.toast('<b>+' + C.POINTS_CORRECT + '</b>' + esc(Q.CORRECT_MSG[Math.floor(Math.random() * Q.CORRECT_MSG.length)]) + '<small>' + esc(q.explanation) + '</small>', 'good long', 5200);
        if (i < App.levelQs.length - 1) setTimeout(() => MR.toast('Checkpoint tersimpan'), 1800);
      } else {
        setTimeout(() => {
          if (!App.session) return;
          MR.Game.pause();
          $('fb-yours').textContent = opt.value + (q.unit ? ' ' + q.unit : '');
          $('fb-right').textContent = q.answer + (q.unit ? ' ' + q.unit : '');
          $('fb-tag').textContent = Q.TAG_FEEDBACK[opt.tag] || '';
          $('fb-explain').textContent = q.explanation;
          $('ov-feedback').classList.remove('hidden');
          setTimeout(() => $('btn-fb-continue').focus(), 50);
        }, 700);
      }
      checkBadges();
      saveProgress(); renderHud();
      return { correct, correctLane };
    },
    onLevelComplete() {
      const s = App.session, L = App.level;
      if (!s.completedLevels.includes(L)) s.completedLevels.push(L);
      s.completedLevels.sort();
      s.totalScore += C.POINTS_LEVEL_CLEAR;
      const before = App.newBadges.length; checkBadges(); const fresh = App.newBadges.slice(before);
      saveProgress(); renderHud();
      setTimeout(() => {
        $('qpanel').classList.add('hidden');
        $('lv-relic').innerHTML = relicSVG(L);
        $('lv-title').textContent = 'LEVEL ' + L + ' SELESAI!';
        $('lv-reward').textContent = 'Kamu mendapatkan relik "' + RELICS[L].name + '" dan bonus +' + C.POINTS_LEVEL_CLEAR + ' poin.';
        const r = App.levelRecord;
        $('lv-stats').innerHTML = '<div><b>' + r.correct + '/' + r.total + '</b><span>Soal benar</span></div><div><b>' + r.coins + '</b><span>Koin level ini</span></div><div><b>' + s.totalScore.toLocaleString('id-ID') + '</b><span>Skor total</span></div>';
        $('lv-badges').innerHTML = fresh.map(k => badgeHTML(BADGES.find(b => b.id === k), 'new')).join('');
        const next = $('btn-next-level');
        if (L < 4) { next.classList.remove('hidden'); next.textContent = 'Lanjut ke Level ' + (L + 1); }
        else next.classList.add('hidden');
        if (L === 4) $('lv-title').textContent = 'KAMU MENAKLUKKAN KUIL!';
        $('ov-level').classList.remove('hidden');
        setTimeout(() => (L < 4 ? next : $('btn-level-finish')).focus(), 50);
      }, 1400);
    },
    onOutOfHearts() {
      setTimeout(() => {
        const g = MR.Game.state;
        $('down-msg').textContent = g.gateIndex > 0 ? 'Tenang, kemajuanmu aman di checkpoint gerbang ke-' + g.gateIndex + '. Semua jawabanmu tetap tersimpan.' : 'Tenang, kamu bisa lanjut dari awal level ini. Koin dan skor tetap aman.';
        $('ov-down').classList.remove('hidden'); $('btn-checkpoint').focus();
      }, 900);
    },
    onHit(h) { renderHud(); if (h > 0) MR.toast('Aduh! Nyawa tersisa ' + h); },
    onAutoPause() { if (App.session) $('ov-pause').classList.remove('hidden'); }
  };

  /* ---------------- Hasil ---------------- */
  function finish() {
    const s = App.session; if (!s) return;
    MR.Game.pause();
    s.status = [1, 2, 3, 4].every(l => s.completedLevels.includes(l)) ? 'tamat' : 'berhenti';
    s.endedAt = new Date().toISOString();
    checkBadges();
    saveProgress(); App.saved = true;
    GAME_UI.forEach(g => $(g).classList.add('hidden'));
    const acc = s.totalQuestions ? s.correctAnswers / s.totalQuestions * 100 : 0;
    $('res-who').textContent = s.studentName + ' • Kelas ' + s.studentClass;
    $('res-title').textContent = s.status === 'tamat' ? 'Juara Kuil yang Hilang!' : 'Petualangan Selesai!';
    $('res-score').textContent = s.totalScore.toLocaleString('id-ID');
    let msg;
    if (!s.totalQuestions) msg = 'Ayo, coba jawab gerbang soal pada permainan berikutnya!';
    else if (acc >= 86) msg = 'Luar biasa! Kamu benar-benar Penjelajah Matematika sejati. Pertahankan!';
    else if (acc >= 76) msg = 'Hebat! Sedikit latihan lagi dan kamu bisa menjadi juara kuil.';
    else if (acc >= 60) msg = 'Bagus, kamu terus berkembang! Coba ulangi Learning Zone agar makin jago FPB dan KPK.';
    else msg = 'Tetap semangat! Setiap penjelajah belajar dari kesalahan. Yuk, pelajari lagi di Learning Zone lalu coba lagi.';
    $('res-motivation').textContent = msg;
    $('res-grid').innerHTML = [
      [s.correctAnswers, 'Soal benar'], [s.incorrectAnswers, 'Soal salah', 'r-bad'], [MR.fmt.pct(St.pct(s.correctAnswers, s.totalQuestions)), 'Akurasi'],
      [s.totalCoins, 'Koin'], [s.completedLevels.length + '/4', 'Level selesai']
    ].map(x => '<div class="' + (x[2] || '') + '"><b>' + esc(x[0]) + '</b><span>' + x[1] + '</span></div>').join('');
    $('res-levels').innerHTML = Q.LEVELS.map(L => '<span class="' + (s.completedLevels.includes(L.id) ? 'done' : '') + '">' + (s.completedLevels.includes(L.id) ? '✓ ' : '') + 'Level ' + L.id + ' • ' + esc(L.name) + '</span>').join('');
    const owned = new Set(St.getBadges(s.studentName, s.studentClass));
    $('res-badges').innerHTML = BADGES.map(b => badgeHTML(b, App.newBadges.includes(b.id) ? 'new' : owned.has(b.id) ? '' : 'locked')).join('');
    $('res-note').textContent = 'Skor = ' + C.POINTS_CORRECT + ' × jawaban benar + ' + C.POINTS_PER_COIN + ' × koin + ' + C.POINTS_LEVEL_CLEAR + ' × level selesai. Hasil sudah tersimpan otomatis di perangkat ini.';
    $('btn-save').textContent = 'Simpan Hasil';
    show('scr-results');
    A.sfx(s.status === 'tamat' ? 'level' : 'badge');
  }

  /* ---------------- Tombol overlay ---------------- */
  function bindOverlays() {
    $('btn-pause').onclick = () => togglePause();
    $('btn-resume').onclick = () => togglePause(false);
    $('btn-quit').onclick = () => finish();
    $('btn-learn-pause').onclick = () => { App.returnToPause = true; go('learn'); };
    $('btn-fb-continue').onclick = () => { $('ov-feedback').classList.add('hidden'); MR.Game.resume(); };
    $('btn-checkpoint').onclick = () => { $('ov-down').classList.add('hidden'); MR.Game.continueFromCheckpoint(); MR.toast('Kembali dari checkpoint!'); };
    $('btn-down-quit').onclick = () => finish();
    $('btn-next-level').onclick = () => { $('ov-level').classList.add('hidden'); startLevel(App.level + 1); };
    $('btn-level-finish').onclick = () => { $('ov-level').classList.add('hidden'); finish(); };
    $('btn-again').onclick = () => { A.sfx('click'); const st = App.student; startSession(st.name, st.cls, App.startLevel); };
    $('btn-save').onclick = () => {
      const s = App.session; if (!s) return;
      const ok = (saveProgress(), St.adapter.available);
      $('btn-save').textContent = ok ? 'Tersimpan ✓' : 'Tersimpan sementara';
      MR.toast(ok ? 'Hasil tersimpan di perangkat ini.' : 'Browser ini memblokir penyimpanan. Hasil hanya ada sampai halaman ditutup.', ok ? 'good' : '');
    };
    $('btn-res-learn').onclick = () => go('learn');
    $('q-options').addEventListener('click', e => { const b = e.target.closest('.q-opt'); if (b) { A.unlock(); MR.Game.selectLane(+b.dataset.k); } });
  }
  function togglePause(force) {
    const G = MR.Game.state; if (G.mode !== 'run' || !App.session) return;
    if (!$('ov-feedback').classList.contains('hidden')) return;
    const toPause = force === undefined ? !G.paused : force;
    if (toPause) { MR.Game.pause(); $('ov-pause').classList.remove('hidden'); }
    else { $('ov-pause').classList.add('hidden'); MR.Game.resume(); }
  }

  /* ---------------- Input ---------------- */
  function inGame() { return App.session && !$('hud').classList.contains('hidden') && $('teacher').classList.contains('hidden'); }
  function bindInput() {
    window.addEventListener('keydown', e => {
      if (!$('dialog').classList.contains('hidden')) { if (e.key === 'Escape') $('dlg-actions').firstChild && $('dlg-actions').firstChild.click(); return; }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!inGame()) return;
      const k = e.key;
      if (!$('ov-feedback').classList.contains('hidden')) { if (k === 'Enter' || k === ' ') { e.preventDefault(); $('btn-fb-continue').click(); } return; }
      if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); togglePause(); return; }
      const G = MR.Game;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); G.moveLeft(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); G.moveRight(); }
      else if (k === 'ArrowUp' || k === ' ' || k === 'w' || k === 'W') { e.preventDefault(); G.jump(); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); G.slide(); }
      else if (k === '1' || k === '2' || k === '3') { if (!$('qpanel').classList.contains('hidden')) G.selectLane(+k - 1); }
    });
    // Swipe
    let sx = 0, sy = 0, st = 0, tracking = false;
    const root = $('game-root');
    root.addEventListener('touchstart', e => { if (!inGame()) return; const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); tracking = true; A.unlock(); }, { passive: true });
    root.addEventListener('touchmove', e => { if (tracking) e.preventDefault(); }, { passive: false });
    root.addEventListener('touchend', e => {
      if (!tracking || !inGame()) return; tracking = false;
      const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28 || Date.now() - st > 700) return;
      const G = MR.Game;
      if (Math.abs(dx) > Math.abs(dy)) (dx < 0 ? G.moveLeft : G.moveRight)(); else (dy < 0 ? G.jump : G.slide)();
    }, { passive: true });
    // Tombol virtual
    $('vcontrols').addEventListener('pointerdown', e => {
      const b = e.target.closest('button'); if (!b) return; e.preventDefault(); A.unlock();
      ({ left: MR.Game.moveLeft, right: MR.Game.moveRight, jump: MR.Game.jump, slide: MR.Game.slide })[b.dataset.act]();
    });
    // Simpan sesi jika halaman ditutup di tengah permainan
    window.addEventListener('pagehide', () => { if (App.session && App.session.status === 'bermain') { App.session.status = 'terputus'; saveProgress(); } });
    window.addEventListener('hashchange', route);
  }
  function route() {
    const h = (location.hash || '').replace('#', '');
    if (h === 'teacher') { if ($('teacher').classList.contains('hidden')) MR.Dashboard.open(); }
    else if (!$('teacher').classList.contains('hidden')) MR.Dashboard.close(true);
    if (h === 'learn' && $('scr-learn').classList.contains('hidden') && !App.session) go('learn');
    if (h === 'howto' && !App.session) go('howto');
  }

  /* ---------------- Start ---------------- */
  function boot() {
    // Sesi yang tertinggal berstatus "bermain" (mis. tab ditutup paksa) → "terputus"
    try { St.getSessions().filter(s => s.status === 'bermain').forEach(s => { s.status = 'terputus'; St.upsertSession(s); }); } catch (e) { }
    if (!window.THREE || !(function () { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })()) {
      $('boot-msg').textContent = 'Browser ini tidak mendukung grafis 3D (WebGL). Teacher Dashboard dan Learning Zone tetap bisa dibuka.';
    }
    try { MR.Game.init($('game-root'), hooks); } catch (e) { console.error(e); $('boot-msg').textContent = 'Grafis 3D gagal dimuat: ' + e.message; }
    buildMenu(); bindOverlays(); bindInput();
    MR.Game.setMenu();
    show('scr-menu');
    const b = $('boot'); b.classList.add('gone'); setTimeout(() => b.remove(), 600);
    document.addEventListener('pointerdown', function first() { A.unlock(); A.music('menu'); document.removeEventListener('pointerdown', first); }, { once: true });
    route();
  }
  App.BADGES = BADGES; App.badgeSVG = badgeSVG;
  const ready = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('800 40px "Baloo 2"'), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  ready.then(boot, boot);
})();
