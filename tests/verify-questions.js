// Pemeriksaan independen kunci jawaban (brute force, tidak memakai fungsi gcd/lcm dari questions.js)
// Jalankan: node tests/verify-questions.js
const Q = require('../questions.js');
let errors = 0;
const err = (id, m) => { errors++; console.log('✗', id, m); };

const bruteGcd = ns => { let best = 0; for (let d = 1; d <= Math.min(...ns); d++) if (ns.every(n => n % d === 0)) best = d; return best; };
const bruteLcm = ns => { for (let m = Math.max(...ns); ; m++) if (ns.every(n => m % n === 0)) return m; };
const factorStr = n => { const f = []; for (let d = 1; d <= n; d++) if (n % d === 0) f.push(d); return f.join(', '); };
const multStr = n => [1, 2, 3, 4].map(k => n * k).join(', ');

function isCorrect(q, v) {
  switch (q.kind) {
    case 'gcd': return v === bruteGcd(q.nums);
    case 'lcm': return v === bruteLcm(q.nums);
    case 'factorList': return v === factorStr(q.nums[0]);
    case 'multipleList': return v === multStr(q.nums[0]);
    case 'commonFactor': return q.nums.every(n => n % v === 0);
    case 'commonMultiple': return q.nums.every(n => v % n === 0);
  }
}

const ids = new Set();
for (const q of Q.BANK) {
  if (ids.has(q.id)) err(q.id, 'ID ganda'); ids.add(q.id);
  if (q.options.length !== 3) err(q.id, 'harus 3 pilihan');
  if (new Set(q.options.map(String)).size !== q.options.length) err(q.id, 'pilihan ganda/duplikat');
  const correct = q.options.filter(v => isCorrect(q, v));
  if (correct.length !== 1) err(q.id, 'jumlah pilihan benar = ' + correct.length + ' (harus 1)');
  if (q.answer === null || q.answer === undefined) err(q.id, 'kunci kosong');
  if (!isCorrect(q, q.answer)) err(q.id, 'kunci salah: ' + q.answer);
  if (!q.options.includes(q.answer)) err(q.id, 'kunci tidak ada di pilihan');
  if (!['FPB', 'KPK'].includes(q.indicator)) err(q.id, 'indikator tidak valid');
  if (!['easy', 'medium', 'challenge'].includes(q.difficulty)) err(q.id, 'kesulitan tidak valid');
  if (!q.explanation || !q.explanation.includes(String(q.answer))) err(q.id, 'penjelasan tidak memuat jawaban');
  q.optionTags.forEach((t, i) => { if (t !== 'correct' && !Q.TAG_FEEDBACK[t]) err(q.id, 'tag tanpa feedback: ' + t + ' (' + q.options[i] + ')'); });
  if (q.isStory && !q.unit) err(q.id, 'soal cerita tanpa satuan');
}

// Seleksi per level
for (const L of [1, 2, 3, 4]) {
  for (let run = 0; run < 300; run++) {
    const p = Q.pickForLevel(L);
    if (p.length !== 5) { err('L' + L, 'pick ' + p.length + ' soal'); break; }
    if (new Set(p.map(q => q.id)).size !== 5) { err('L' + L, 'soal terulang'); break; }
    const rank = { easy: 0, medium: 1, challenge: 2 };
    for (let i = 1; i < 5; i++) if (rank[p[i].difficulty] < rank[p[i - 1].difficulty]) { err('L' + L, 'kesulitan tidak naik'); break; }
    if (L >= 3 && !(p.some(q => q.topic === 'FPB') && p.some(q => q.topic === 'KPK'))) { err('L' + L, 'tidak campuran'); break; }
  }
}

const by = {};
Q.BANK.forEach(q => { const k = 'L' + q.level + ' ' + q.topic + ' ' + q.difficulty; by[k] = (by[k] || 0) + 1; });
console.log('Total soal:', Q.BANK.length, '| FPB:', Q.BANK.filter(q => q.topic === 'FPB').length, '| KPK:', Q.BANK.filter(q => q.topic === 'KPK').length, '| cerita:', Q.BANK.filter(q => q.isStory).length);
console.log(by);
console.log(errors ? `GAGAL: ${errors} masalah` : 'SEMUA KUNCI JAWABAN BENAR ✓');
if (process.argv.includes('--show')) Q.BANK.forEach(q => console.log(q.id, '|', q.text, '|', q.options.join(' / '), '→', q.answer, '|', q.optionTags.join(','), '\n   ', q.explanation));
process.exit(errors ? 1 : 0);
