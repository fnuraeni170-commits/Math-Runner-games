/* =========================================================
   MATH RUNNER: THE LOST TEMPLE — Bank Soal FPB & KPK
   ---------------------------------------------------------
   • 53 soal, 4 level, 3 tingkat kesulitan (easy/medium/challenge)
   • Kunci jawaban TIDAK diketik manual: dihitung dari bilangan
     soal (gcd/lcm/faktor/kelipatan). Penjelasan juga dibuat
     otomatis dari bilangan yang sama, sehingga selalu konsisten.
   • Setiap pilihan salah diberi "tag miskonsepsi" otomatis
     (mis. "product" = mengalikan kedua bilangan) yang dipakai
     dashboard guru untuk rekomendasi berbasis data.
   • Jalankan tests/verify-questions.js untuk memeriksa ulang.
   ========================================================= */
(function (root) {
  'use strict';

  /* ---------- Matematika dasar ---------- */
  function gcd2(a, b) { while (b) { const t = b; b = a % b; a = t; } return a; }
  function lcm2(a, b) { return a / gcd2(a, b) * b; }
  function gcd(nums) { return nums.reduce(gcd2); }
  function lcm(nums) { return nums.reduce(lcm2); }
  function factors(n) { const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; }
  function multiples(n, upto) { const m = []; for (let k = n; k <= upto; k += n) m.push(k); return m; }
  function joinNums(nums) {
    if (nums.length === 2) return nums[0] + ' dan ' + nums[1];
    return nums.slice(0, -1).join(', ') + ', dan ' + nums[nums.length - 1];
  }
  function listStr(arr) { return arr.join(', '); }

  /* ---------- Kunci jawaban (dihitung) ---------- */
  function computeAnswer(q) {
    switch (q.kind) {
      case 'gcd': return gcd(q.nums);
      case 'lcm': return lcm(q.nums);
      case 'factorList': return listStr(factors(q.nums[0]));
      case 'multipleList': return listStr(multiples(q.nums[0], q.nums[0] * 4));
      case 'commonFactor': {
        const ok = q.options.filter(v => q.nums.every(n => n % v === 0));
        return ok.length === 1 ? ok[0] : null;
      }
      case 'commonMultiple': {
        const ok = q.options.filter(v => q.nums.every(n => v % n === 0));
        return ok.length === 1 ? ok[0] : null;
      }
    }
    return null;
  }

  /* ---------- Tag miskonsepsi untuk pilihan salah ---------- */
  function tagOption(q, v) {
    const ans = q.answer;
    if (v === ans) return 'correct';
    const n = q.nums;
    const prod = n.reduce((a, b) => a * b, 1);
    const sum = n.reduce((a, b) => a + b, 0);
    switch (q.kind) {
      case 'gcd':
        if (v === lcm(n)) return 'swapKPK';                 // tertukar: memilih KPK
        if (n.every(x => x % v === 0)) return 'commonNotGreatest';
        if (v === prod) return 'product';
        return 'notCommonFactor';
      case 'lcm':
        if (v === gcd(n)) return 'swapFPB';                 // tertukar: memilih FPB
        if (v === prod) return 'product';                   // mengalikan bilangan
        if (n.every(x => v % x === 0)) return 'commonNotLeast';
        if (v === sum) return 'sum';
        return 'notCommonMultiple';
      case 'commonFactor': return 'notCommonFactor';
      case 'commonMultiple': return 'notCommonMultiple';
      case 'factorList': return 'factorListError';
      case 'multipleList': return /^1,/.test(String(v)) ? 'factorMultipleConfusion' : 'multipleListError';
    }
    return 'other';
  }

  const TAG_FEEDBACK = {
    swapKPK: 'Itu adalah KPK, bukan FPB. Ingat: FPB tidak pernah lebih besar dari bilangan terkecil.',
    swapFPB: 'Itu adalah FPB, bukan KPK. Ingat: KPK tidak pernah lebih kecil dari bilangan terbesar.',
    commonNotGreatest: 'Bilangan itu memang faktor persekutuan, tetapi bukan yang TERBESAR.',
    notCommonFactor: 'Bilangan itu tidak membagi habis semua bilangan, jadi bukan faktor persekutuan.',
    product: 'Mengalikan bilangan-bilangannya menghasilkan kelipatan bersama, tetapi belum tentu yang TERKECIL.',
    commonNotLeast: 'Bilangan itu memang kelipatan persekutuan, tetapi bukan yang TERKECIL.',
    sum: 'Menjumlahkan bilangan bukan cara mencari KPK. Coba daftar kelipatannya.',
    notCommonMultiple: 'Bilangan itu bukan kelipatan dari semua bilangan, jadi bukan kelipatan persekutuan.',
    factorListError: 'Daftar itu belum tepat. Faktor adalah SEMUA bilangan yang membagi habis, termasuk 1 dan bilangan itu sendiri.',
    factorMultipleConfusion: 'Itu daftar faktor, bukan kelipatan. Kelipatan didapat dengan mengalikan: ×1, ×2, ×3, ...',
    multipleListError: 'Daftar itu belum tepat. Kelipatan didapat dengan mengalikan bilangan dengan 1, 2, 3, 4, ...'
  };

  const TAG_LABEL = {
    swapKPK: 'Tertukar FPB ↔ KPK (memilih KPK)',
    swapFPB: 'Tertukar FPB ↔ KPK (memilih FPB)',
    commonNotGreatest: 'Memilih faktor persekutuan yang bukan terbesar',
    notCommonFactor: 'Memilih bilangan yang bukan faktor persekutuan',
    product: 'Mengalikan bilangan untuk mencari KPK',
    commonNotLeast: 'Memilih kelipatan persekutuan yang bukan terkecil',
    sum: 'Menjumlahkan bilangan',
    notCommonMultiple: 'Memilih bilangan yang bukan kelipatan persekutuan',
    factorListError: 'Daftar faktor tidak lengkap/keliru',
    factorMultipleConfusion: 'Tertukar konsep faktor ↔ kelipatan',
    multipleListError: 'Daftar kelipatan keliru'
  };

  /* ---------- Penjelasan otomatis ---------- */
  function explain(q) {
    const n = q.nums;
    let s = '';
    if (q.storyHint) s += q.storyHint + ' ';
    switch (q.kind) {
      case 'gcd': {
        n.forEach(x => { s += 'Faktor ' + x + ': ' + listStr(factors(x)) + '. '; });
        const common = factors(Math.min(...n)).filter(v => n.every(x => x % v === 0));
        s += 'Faktor persekutuannya: ' + listStr(common) + '. Yang terbesar adalah ' + q.answer + ', jadi FPB = ' + q.answer + '.';
        break;
      }
      case 'lcm': {
        const L = q.answer;
        n.forEach(x => { s += 'Kelipatan ' + x + ': ' + listStr(multiples(x, L)) + ', ... '; });
        s += 'Kelipatan persekutuan yang pertama muncul (terkecil) adalah ' + L + ', jadi KPK = ' + L + '.';
        break;
      }
      case 'factorList':
        s += 'Faktor ' + n[0] + ' adalah semua bilangan yang membagi ' + n[0] + ' habis: ' + q.answer + '.';
        break;
      case 'multipleList':
        s += 'Kelipatan ' + n[0] + ' didapat dari ' + n[0] + '×1, ' + n[0] + '×2, ' + n[0] + '×3, ' + n[0] + '×4 = ' + q.answer + '.';
        break;
      case 'commonFactor':
        n.forEach(x => { s += 'Faktor ' + x + ': ' + listStr(factors(x)) + '. '; });
        s += 'Hanya ' + q.answer + ' yang ada di semua daftar, jadi ' + q.answer + ' adalah faktor persekutuan.';
        break;
      case 'commonMultiple': {
        const top = Math.max(...q.options);
        n.forEach(x => { s += 'Kelipatan ' + x + ': ' + listStr(multiples(x, top)) + '. '; });
        s += 'Hanya ' + q.answer + ' yang ada di semua daftar, jadi ' + q.answer + ' adalah kelipatan persekutuan.';
        break;
      }
    }
    if (q.unit && (q.kind === 'gcd' || q.kind === 'lcm')) s += ' Jawabannya: ' + q.answer + ' ' + q.unit + '.';
    return s;
  }

  /* ---------- Definisi soal ---------- */
  const SUB = {
    factorList: 'Menentukan faktor', commonFactor: 'Faktor persekutuan', gcd: 'Menentukan FPB',
    multipleList: 'Menentukan kelipatan', commonMultiple: 'Kelipatan persekutuan', lcm: 'Menentukan KPK'
  };
  const HINT_FPB = 'Benda dibagi sama rata ke kelompok sebanyak-banyaknya tanpa sisa, jadi kita mencari FPB.';
  const HINT_KPK = 'Kita mencari kapan kejadiannya terjadi bersamaan lagi, jadi kita mencari KPK.';
  const HINT_FPB_LEN = 'Dipotong sama panjang sepanjang-panjangnya tanpa sisa, jadi kita mencari FPB.';

  // [id, level, difficulty, kind, nums, options, text?, story?]
  const RAW = [
    // ===== LEVEL 1 – JUNGLE OF FACTORS (FPB) =====
    ['L1-01', 1, 'easy', 'factorList', [12], ['1, 2, 3, 4, 6, 12', '1, 2, 3, 4, 12', '2, 3, 4, 6']],
    ['L1-02', 1, 'easy', 'factorList', [15], ['1, 3, 5, 15', '1, 5, 15', '3, 5, 15, 30']],
    ['L1-03', 1, 'easy', 'commonFactor', [8, 12], [4, 3, 8]],
    ['L1-04', 1, 'easy', 'gcd', [8, 12], [4, 2, 24]],
    ['L1-05', 1, 'easy', 'gcd', [6, 9], [3, 1, 18]],
    ['L1-06', 1, 'easy', 'gcd', [10, 15], [5, 10, 30]],
    ['L1-07', 1, 'medium', 'gcd', [12, 18], [6, 3, 36]],
    ['L1-08', 1, 'medium', 'gcd', [15, 25], [5, 15, 75]],
    ['L1-09', 1, 'medium', 'gcd', [18, 24], [6, 3, 72]],
    ['L1-10', 1, 'medium', 'gcd', [16, 24], [8, 4, 48]],
    ['L1-11', 1, 'medium', 'commonFactor', [12, 18], [6, 4, 9]],
    ['L1-12', 1, 'challenge', 'gcd', [20, 30], [10, 5, 60]],
    ['L1-13', 1, 'challenge', 'gcd', [24, 36], [12, 6, 72]],
    ['L1-14', 1, 'challenge', 'gcd', [28, 42], [14, 7, 84]],

    // ===== LEVEL 2 – THE MULTIPLE BRIDGE (KPK) =====
    ['L2-01', 2, 'easy', 'multipleList', [4], ['4, 8, 12, 16', '1, 2, 4, 8', '4, 6, 8, 10']],
    ['L2-02', 2, 'easy', 'multipleList', [6], ['6, 12, 18, 24', '1, 2, 3, 6', '6, 10, 14, 18']],
    ['L2-03', 2, 'easy', 'commonMultiple', [4, 6], [12, 8, 18]],
    ['L2-04', 2, 'easy', 'lcm', [3, 4], [12, 1, 7]],
    ['L2-05', 2, 'easy', 'lcm', [2, 5], [10, 1, 20]],
    ['L2-06', 2, 'easy', 'lcm', [5, 10], [10, 50, 5]],
    ['L2-07', 2, 'medium', 'lcm', [4, 6], [12, 24, 2]],
    ['L2-08', 2, 'medium', 'lcm', [6, 8], [24, 48, 2]],
    ['L2-09', 2, 'medium', 'lcm', [6, 9], [18, 54, 3]],
    ['L2-10', 2, 'medium', 'lcm', [4, 10], [20, 40, 2]],
    ['L2-11', 2, 'medium', 'commonMultiple', [3, 5], [15, 10, 9]],
    ['L2-12', 2, 'challenge', 'lcm', [8, 12], [24, 96, 4]],
    ['L2-13', 2, 'challenge', 'lcm', [9, 12], [36, 108, 3]],
    ['L2-14', 2, 'challenge', 'lcm', [10, 15], [30, 150, 5]],
    ['L2-15', 2, 'challenge', 'lcm', [2, 3, 4], [12, 24, 9]],

    // ===== LEVEL 3 – THE MYSTERY TEMPLE (campuran) =====
    ['L3-01', 3, 'medium', 'gcd', [12, 16], [4, 2, 48]],
    ['L3-02', 3, 'medium', 'lcm', [12, 16], [48, 4, 192]],
    ['L3-03', 3, 'medium', 'gcd', [14, 21], [7, 42, 3]],
    ['L3-04', 3, 'medium', 'lcm', [6, 10], [30, 60, 2]],
    ['L3-05', 3, 'medium', 'gcd', [9, 15], [3, 45, 5]],
    ['L3-06', 3, 'medium', 'lcm', [3, 9], [9, 27, 3]],
    ['L3-07', 3, 'challenge', 'gcd', [24, 40], [8, 4, 120]],
    ['L3-08', 3, 'challenge', 'lcm', [12, 18], [36, 216, 6]],
    ['L3-09', 3, 'challenge', 'gcd', [30, 45], [15, 5, 90]],
    ['L3-10', 3, 'challenge', 'lcm', [15, 20], [60, 300, 5]],
    ['L3-11', 3, 'challenge', 'gcd', [36, 48], [12, 6, 144]],
    ['L3-12', 3, 'challenge', 'lcm', [14, 21], [42, 294, 7]],

    // ===== LEVEL 4 – THE FINAL GUARDIAN (soal cerita) =====
    ['L4-01', 4, 'medium', 'gcd', [12, 18], [6, 3, 36],
      'Ibu memiliki 12 apel dan 18 jeruk. Buah tersebut akan dimasukkan ke dalam beberapa keranjang dengan jumlah masing-masing jenis buah yang sama. Berapa jumlah keranjang terbanyak yang dapat dibuat?', { unit: 'keranjang', hint: HINT_FPB }],
    ['L4-02', 4, 'medium', 'lcm', [4, 6], [12, 24, 2],
      'Lampu A menyala setiap 4 detik dan lampu B setiap 6 detik. Jika keduanya menyala bersamaan sekarang, berapa detik lagi keduanya akan menyala bersama?', { unit: 'detik', hint: HINT_KPK }],
    ['L4-03', 4, 'medium', 'gcd', [20, 30], [10, 5, 60],
      'Pak Guru punya 20 pensil dan 30 buku tulis. Semuanya dibagikan ke beberapa kelompok, setiap kelompok mendapat jumlah pensil dan buku yang sama. Paling banyak berapa kelompok yang bisa dibuat?', { unit: 'kelompok', hint: HINT_FPB }],
    ['L4-04', 4, 'medium', 'lcm', [3, 4], [12, 7, 1],
      'Rani berenang setiap 3 hari sekali, sedangkan Dodi setiap 4 hari sekali. Hari ini mereka berenang bersama. Berapa hari lagi mereka akan berenang bersama lagi?', { unit: 'hari', hint: HINT_KPK }],
    ['L4-05', 4, 'medium', 'gcd', [16, 24], [8, 4, 48],
      'Toko kue memiliki 16 donat dan 24 roti. Kue-kue itu dimasukkan ke dalam kotak dengan isi yang sama di setiap kotak. Berapa kotak terbanyak yang bisa dibuat?', { unit: 'kotak', hint: HINT_FPB }],
    ['L4-06', 4, 'medium', 'lcm', [6, 8], [24, 48, 2],
      'Bus Merah berangkat dari terminal setiap 6 menit dan Bus Biru setiap 8 menit. Pukul 07.00 kedua bus berangkat bersama. Berapa menit lagi kedua bus berangkat bersama lagi?', { unit: 'menit', hint: HINT_KPK }],
    ['L4-07', 4, 'challenge', 'gcd', [24, 36], [12, 6, 72],
      'Panitia lomba menyiapkan 24 kotak susu dan 36 roti. Semuanya dibagi ke dalam bingkisan dengan isi yang sama tanpa sisa. Berapa bingkisan terbanyak yang dapat dibuat?', { unit: 'bingkisan', hint: HINT_FPB }],
    ['L4-08', 4, 'challenge', 'lcm', [10, 15], [30, 150, 5],
      'Sirine A berbunyi setiap 10 menit dan sirine B setiap 15 menit. Kedua sirine baru saja berbunyi bersamaan. Berapa menit lagi keduanya berbunyi bersama lagi?', { unit: 'menit', hint: HINT_KPK }],
    ['L4-09', 4, 'challenge', 'gcd', [18, 27], [9, 3, 54],
      'Dina memiliki 18 kelereng merah dan 27 kelereng biru. Kelereng dimasukkan ke kantong-kantong dengan jumlah kelereng merah dan biru yang sama di setiap kantong. Berapa kantong terbanyak yang dapat dibuat?', { unit: 'kantong', hint: HINT_FPB }],
    ['L4-10', 4, 'challenge', 'lcm', [8, 12], [24, 96, 4],
      'Ayu menyiram tanaman mawar setiap 8 hari dan tanaman melati setiap 12 hari. Hari ini Ayu menyiram keduanya. Berapa hari lagi Ayu menyiram keduanya pada hari yang sama?', { unit: 'hari', hint: HINT_KPK }],
    ['L4-11', 4, 'challenge', 'gcd', [30, 45], [15, 5, 90],
      'Ibu memiliki pita merah 30 cm dan pita biru 45 cm. Kedua pita dipotong menjadi potongan-potongan yang sama panjang dan sepanjang mungkin tanpa sisa. Berapa cm panjang setiap potongan?', { unit: 'cm', hint: HINT_FPB_LEN }],
    ['L4-12', 4, 'challenge', 'lcm', [2, 3, 4], [12, 24, 9],
      'Tiga lampu hias berkedip setiap 2 detik, 3 detik, dan 4 detik. Ketiganya baru saja berkedip bersamaan. Berapa detik lagi ketiganya berkedip bersama lagi?', { unit: 'detik', hint: HINT_KPK }]
  ];

  function defaultText(kind, nums) {
    switch (kind) {
      case 'gcd': return 'Berapa FPB dari ' + joinNums(nums) + '?';
      case 'lcm': return 'Berapa KPK dari ' + joinNums(nums) + '?';
      case 'factorList': return 'Faktor dari ' + nums[0] + ' adalah ...';
      case 'multipleList': return 'Empat kelipatan pertama dari ' + nums[0] + ' adalah ...';
      case 'commonFactor': return 'Manakah yang merupakan faktor persekutuan dari ' + joinNums(nums) + '?';
      case 'commonMultiple': return 'Manakah yang merupakan kelipatan persekutuan dari ' + joinNums(nums) + '?';
    }
  }

  const TOPIC_OF = { gcd: 'FPB', factorList: 'FPB', commonFactor: 'FPB', lcm: 'KPK', multipleList: 'KPK', commonMultiple: 'KPK' };

  const BANK = RAW.map(r => {
    const [id, level, difficulty, kind, nums, options, text, story] = r;
    const q = {
      id, level, difficulty, kind, nums: nums.slice(), options: options.slice(),
      topic: TOPIC_OF[kind],
      text: text || defaultText(kind, nums),
      isStory: !!text,
      unit: story ? story.unit : '',
      storyHint: story ? story.hint : ''
    };
    q.indicator = q.topic;                                   // label indikator FPB / KPK
    q.subIndicator = q.isStory ? 'Soal cerita ' + q.topic : SUB[kind];
    q.answer = computeAnswer(q);
    q.optionTags = q.options.map(v => tagOption(q, v));
    q.explanation = explain(q);
    return q;
  });

  const BY_ID = {};
  BANK.forEach(q => { BY_ID[q.id] = q; });

  const LEVELS = [
    { id: 1, key: 'jungle', name: 'Jungle of Factors', title: 'LEVEL 1 – JUNGLE OF FACTORS', focus: 'Konsep faktor dan FPB', mission: 'FPB – The Factor Gate', theme: 'jungle' },
    { id: 2, key: 'bridge', name: 'The Multiple Bridge', title: 'LEVEL 2 – THE MULTIPLE BRIDGE', focus: 'Konsep kelipatan dan KPK', mission: 'KPK – The Multiple Gate', theme: 'bridge' },
    { id: 3, key: 'temple', name: 'The Mystery Temple', title: 'LEVEL 3 – THE MYSTERY TEMPLE', focus: 'Kombinasi FPB dan KPK', mission: 'FPB & KPK – Mystery Gates', theme: 'temple' },
    { id: 4, key: 'cave', name: 'The Final Guardian', title: 'LEVEL 4 – THE FINAL GUARDIAN', focus: 'Soal cerita FPB dan KPK', mission: 'Soal Cerita – Guardian Gates', theme: 'cave' }
  ];
  const QUESTIONS_PER_LEVEL = 5;

  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Pilih 5 soal per level dengan kesulitan meningkat.
  function pickForLevel(level) {
    const pool = BANK.filter(q => q.level === level);
    const used = new Set();
    function take(filter) {
      const c = shuffle(pool.filter(q => !used.has(q.id) && filter(q)));
      if (!c.length) return null;
      used.add(c[0].id); return c[0];
    }
    let plan;
    if (level === 1 || level === 2) {
      plan = [q => q.difficulty === 'easy', q => q.difficulty === 'easy', q => q.difficulty === 'medium', q => q.difficulty === 'medium', q => q.difficulty === 'challenge'];
    } else {
      const t = shuffle(['FPB', 'KPK']);
      plan = [
        q => q.difficulty === 'medium' && q.topic === t[0],
        q => q.difficulty === 'medium' && q.topic === t[1],
        q => q.difficulty === 'medium',
        q => q.difficulty === 'challenge' && q.topic === t[0],
        q => q.difficulty === 'challenge' && q.topic === t[1]
      ];
    }
    const out = [];
    plan.forEach(f => { const q = take(f) || take(() => true); if (q) out.push(q); });
    return out;
  }

  // Urutan pilihan diacak setiap kali tampil.
  function presentOptions(q) { return shuffle(q.options.map((v, i) => ({ value: v, tag: q.optionTags[i] }))); }

  const CORRECT_MSG = ['Hebat! Gerbang terbuka!', 'Tepat sekali!', 'Luar biasa, penjelajah!', 'Benar! Kamu makin jago!', 'Keren! Jawabanmu tepat!'];

  const api = {
    BANK, BY_ID, LEVELS, QUESTIONS_PER_LEVEL, TAG_FEEDBACK, TAG_LABEL, CORRECT_MSG,
    pickForLevel, presentOptions, math: { gcd, lcm, factors, multiples }
  };
  root.MR = root.MR || {};
  root.MR.Questions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
