/* =========================================================
   MATH RUNNER — LEARNING ZONE (materi interaktif FPB & KPK)
   ========================================================= */
(function () {
  'use strict';
  const { gcd, lcm, factors, multiples } = MR.Questions.math;
  const esc = MR.fmt.esc;
  let tab = 'fpb', lampTimer = null;

  const PAIRS_FPB = [[8, 12], [12, 18], [15, 25], [18, 24], [20, 30], [16, 24], [6, 9], [24, 36]];
  const PAIRS_KPK = [[3, 4], [4, 6], [5, 10], [6, 8], [8, 12], [2, 5], [6, 9], [4, 10]];
  const FRUITS = [[12, 18], [8, 12], [10, 15], [16, 24], [6, 9], [20, 30]];

  function opts(list, cur) { return list.map(p => '<option value="' + p.join(',') + '"' + (p.join(',') === cur ? ' selected' : '') + '>' + p.join(' dan ') + '</option>').join(''); }

  function render(root, onClose) {
    clearInterval(lampTimer);
    root.innerHTML =
      '<div class="sheet-head"><h2>Learning Zone</h2><button class="btn-x" id="lz-close" aria-label="Tutup">✕</button></div>' +
      '<div class="learn-tabs" role="tablist"><button class="learn-tab" role="tab" data-t="fpb">FPB – Faktor</button><button class="learn-tab kpk" role="tab" data-t="kpk">KPK – Kelipatan</button></div>' +
      '<div id="lz-body"></div>' +
      '<div class="sheet-foot"><button class="btn btn-play small" id="lz-done">Siap berpetualang!</button></div>';
    root.querySelector('#lz-close').onclick = () => { clearInterval(lampTimer); onClose(); };
    root.querySelector('#lz-done').onclick = () => { clearInterval(lampTimer); onClose(); };
    root.querySelectorAll('.learn-tab').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(root); });
    draw(root);
  }

  function draw(root) {
    clearInterval(lampTimer);
    root.querySelectorAll('.learn-tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === tab));
    const body = root.querySelector('#lz-body');
    body.innerHTML = tab === 'fpb' ? fpbHTML() : kpkHTML();
    if (tab === 'fpb') bindFpb(body); else bindKpk(body);
  }

  /* ------------------------ FPB ------------------------ */
  function fpbHTML() {
    return '' +
      '<div class="lz-intro">' +
      '<div class="lz-card"><h4>Apa itu faktor?</h4><p><b>Faktor</b> suatu bilangan adalah bilangan-bilangan yang dapat <b>membagi habis</b> bilangan itu (tanpa sisa). Contoh: 12 dapat dibagi habis oleh 1, 2, 3, 4, 6, dan 12. Jadi faktor 12 adalah 1, 2, 3, 4, 6, 12.</p></div>' +
      '<div class="lz-card"><h4>Cara menentukan FPB</h4><ol><li>Tulis semua faktor bilangan pertama.</li><li>Tulis semua faktor bilangan kedua.</li><li>Tandai faktor yang sama (<b>faktor persekutuan</b>).</li><li>Pilih yang <b>terbesar</b>. Itulah FPB!</li></ol></div>' +
      '</div>' +
      '<section class="lz-block"><h3>1. Menyusun benda untuk menemukan faktor</h3><p>Geser angkanya. Setiap faktor membuat susunan baris yang rapi tanpa sisa.</p>' +
      '<div class="lz-controls"><label>Bilangan <input type="range" id="f-n" min="2" max="36" value="12"></label><span class="lz-num" id="f-nv">12</span></div>' +
      '<div class="arrays" id="f-arrays"></div><div class="lz-answer" id="f-list"></div></section>' +
      '<section class="lz-block"><h3>2. Faktor persekutuan &amp; FPB</h3><p>Pilih dua bilangan. Faktor yang sama ditandai hijau, dan yang terbesar diberi bintang emas.</p>' +
      '<div class="lz-controls"><label>Bilangan <select id="f-pair">' + opts(PAIRS_FPB, '12,18') + '</select></label></div>' +
      '<div id="f-common"></div></section>' +
      '<section class="lz-block"><h3>3. Membagi buah ke keranjang secara merata</h3><p>Ibu ingin membagi apel dan jeruk ke beberapa keranjang. Setiap keranjang harus berisi jumlah apel yang sama dan jumlah jeruk yang sama, tanpa sisa. Coba pilih banyak keranjang!</p>' +
      '<div class="lz-controls"><label>Buah <select id="f-fruit">' + FRUITS.map(p => '<option value="' + p.join(',') + '">' + p[0] + ' apel dan ' + p[1] + ' jeruk</option>').join('') + '</select></label></div>' +
      '<div class="lz-controls"><span>Banyak keranjang:</span><div class="kbtns" id="f-k"></div></div>' +
      '<div class="baskets" id="f-baskets"></div><div id="f-verdict"></div></section>';
  }
  function bindFpb(el) {
    const n = el.querySelector('#f-n');
    const upN = () => {
      const v = +n.value; el.querySelector('#f-nv').textContent = v;
      const fs = factors(v);
      const pairs = fs.filter(a => a <= v / a);
      el.querySelector('#f-arrays').innerHTML = pairs.map(a => { const b = v / a; return '<div class="arr"><div class="grid" style="grid-template-columns:repeat(' + b + ',11px)">' + '<i></i>'.repeat(v) + '</div><span>' + a + ' baris × ' + b + '</span></div>'; }).join('');
      el.querySelector('#f-list').innerHTML = 'Faktor ' + v + ' = <b>' + fs.join(', ') + '</b>' + (fs.length === 2 ? ' (hanya 2 faktor: bilangan prima)' : '');
    };
    n.oninput = upN; upN();

    const pair = el.querySelector('#f-pair');
    const upP = () => {
      const [a, b] = pair.value.split(',').map(Number); const g = gcd([a, b]);
      const row = x => '<div class="lz-row"><span>Faktor ' + x + '</span><div class="chips">' + factors(x).map(f => { const c = a % f === 0 && b % f === 0; return '<span class="nchip ' + (f === g ? 'best' : c ? 'common' : '') + '">' + f + '</span>'; }).join('') + '</div></div>';
      const common = factors(Math.min(a, b)).filter(f => a % f === 0 && b % f === 0);
      el.querySelector('#f-common').innerHTML = row(a) + row(b) + '<div class="lz-answer">Faktor persekutuan: ' + common.join(', ') + ' → FPB dari ' + a + ' dan ' + b + ' = <b>' + g + '</b></div>';
    };
    pair.onchange = upP; upP();

    const fruit = el.querySelector('#f-fruit'); let k = 2;
    const upF = () => {
      const [ap, jr] = fruit.value.split(',').map(Number); const g = gcd([ap, jr]);
      const maxK = Math.min(ap, jr);
      if (k > maxK) k = 2;
      el.querySelector('#f-k').innerHTML = Array.from({ length: Math.min(maxK, 12) }, (_, i) => i + 1).map(i => '<button class="kbtn" aria-pressed="' + (i === k) + '" data-k="' + i + '">' + i + '</button>').join('');
      const pa = Math.floor(ap / k), pj = Math.floor(jr / k), ra = ap % k, rj = jr % k;
      el.querySelector('#f-baskets').innerHTML = Array.from({ length: k }, () => '<div class="basket">' + '<i class="fruit apple"></i>'.repeat(pa) + '<i class="fruit orange"></i>'.repeat(pj) + '</div>').join('');
      const ok = ra === 0 && rj === 0;
      let v = '<p class="leftover">' + k + ' keranjang: tiap keranjang ' + pa + ' apel dan ' + pj + ' jeruk. ' +
        (ok ? '<span class="verdict ok">Rata, tanpa sisa!</span>' : '<span class="verdict no">Ada sisa: ' + ra + ' apel, ' + rj + ' jeruk</span>') + '</p>';
      if (ok && k === g) v += '<div class="lz-answer">Hebat! ' + k + ' adalah banyak keranjang <b>terbanyak</b> yang bisa dibuat. Itulah FPB dari ' + ap + ' dan ' + jr + ' = <b>' + g + '</b>.</div>';
      else if (ok) v += '<p>Rata! Tapi apakah bisa dibuat <b>lebih banyak</b> keranjang? Coba angka yang lebih besar.</p>';
      el.querySelector('#f-verdict').innerHTML = v;
    };
    el.querySelector('#f-k').onclick = e => { const b = e.target.closest('.kbtn'); if (!b) return; k = +b.dataset.k; upF(); MR.Audio.sfx('click'); };
    fruit.onchange = () => { k = 2; upF(); }; upF();
  }

  /* ------------------------ KPK ------------------------ */
  function kpkHTML() {
    return '' +
      '<div class="lz-intro">' +
      '<div class="lz-card"><h4>Apa itu kelipatan?</h4><p><b>Kelipatan</b> suatu bilangan adalah hasil kali bilangan itu dengan 1, 2, 3, 4, dan seterusnya. Contoh: kelipatan 4 adalah 4, 8, 12, 16, 20, … Seperti katak yang selalu melompat 4 langkah.</p></div>' +
      '<div class="lz-card"><h4>Cara menentukan KPK</h4><ol><li>Tulis kelipatan bilangan pertama.</li><li>Tulis kelipatan bilangan kedua.</li><li>Cari kelipatan yang sama (<b>kelipatan persekutuan</b>).</li><li>Pilih yang <b>terkecil</b>. Itulah KPK!</li></ol></div>' +
      '</div>' +
      '<section class="lz-block kpk"><h3>1. Lompatan katak: menemukan kelipatan</h3><p>Katak mulai dari 0 dan melompat dengan jarak yang sama. Tempat ia mendarat adalah kelipatannya.</p>' +
      '<div class="lz-controls"><label>Lompat setiap <input type="range" id="k-n" min="2" max="10" value="4"></label><span class="lz-num" id="k-nv">4</span><button class="btn-lz" id="k-hop">Lompat!</button></div>' +
      '<div class="numline"><div class="track" id="k-line"></div></div><div class="lz-answer" id="k-list"></div></section>' +
      '<section class="lz-block kpk"><h3>2. Kelipatan persekutuan &amp; KPK</h3><p>Dua katak melompat bersama dari 0. Di angka berwarna emas, keduanya mendarat di tempat yang sama. Angka emas pertama adalah KPK.</p>' +
      '<div class="lz-controls"><label>Bilangan <select id="k-pair">' + opts(PAIRS_KPK, '4,6') + '</select></label></div>' +
      '<div id="k-common"></div></section>' +
      '<section class="lz-block kpk"><h3>3. Kejadian berulang: dua lampu berkedip</h3><p>Lampu A menyala setiap beberapa detik, lampu B juga. Keduanya menyala bersamaan di detik 0. Kapan mereka menyala bersama lagi?</p>' +
      '<div class="lz-controls"><label>Lampu A tiap <select id="k-la">' + [2, 3, 4, 5, 6].map(x => '<option' + (x === 4 ? ' selected' : '') + '>' + x + '</option>').join('') + '</select> detik</label>' +
      '<label>Lampu B tiap <select id="k-lb">' + [3, 4, 5, 6, 8].map(x => '<option' + (x === 6 ? ' selected' : '') + '>' + x + '</option>').join('') + '</select> detik</label>' +
      '<button class="btn-lz" id="k-play">Mulai</button></div>' +
      '<div class="lamps"><div class="lamp a" id="lamp-a"><div class="bulb"></div>Lampu A</div><div class="lamp b" id="lamp-b"><div class="bulb"></div>Lampu B</div><div><span>Detik ke-</span><div class="clock" id="k-clock">0</div></div></div>' +
      '<div class="numline"><div class="track" id="k-lamp-line"></div></div><div id="k-lamp-res"></div></section>';
  }
  function line(max, marks) {
    return Array.from({ length: max }, (_, i) => i + 1).map(x => '<div class="cell ' + (marks(x) || '') + '">' + x + '</div>').join('');
  }
  function bindKpk(el) {
    const n = el.querySelector('#k-n'); let hopTimer = null;
    const upN = (upto) => {
      const v = +n.value; el.querySelector('#k-nv').textContent = v;
      const lim = upto === undefined ? v * 6 : upto;
      el.querySelector('#k-line').innerHTML = line(Math.max(40, v * 6), x => x % v === 0 && x <= lim ? 'b hop' : '');
      el.querySelector('#k-list').innerHTML = 'Kelipatan ' + v + ' = <b>' + multiples(v, v * 6).join(', ') + '</b>, …';
    };
    n.oninput = () => { clearInterval(hopTimer); upN(); };
    el.querySelector('#k-hop').onclick = () => {
      clearInterval(hopTimer); const v = +n.value; let c = 0; upN(0);
      hopTimer = setInterval(() => { c += v; upN(c); MR.Audio.sfx('jump'); if (c >= v * 6) clearInterval(hopTimer); }, 450);
    };
    upN();

    const pair = el.querySelector('#k-pair');
    const upP = () => {
      const [a, b] = pair.value.split(',').map(Number); const L = lcm([a, b]); const max = Math.max(L * 2, 36);
      const mk = (x) => x % a === 0 && x % b === 0 ? 'ab' + (x === L ? ' first' : '') : x % a === 0 ? 'a' : x % b === 0 ? 'b' : '';
      el.querySelector('#k-common').innerHTML =
        '<div class="lz-row"><span>Kelipatan ' + a + '</span><div class="chips">' + multiples(a, max).map(x => '<span class="nchip ' + (x % b === 0 ? (x === L ? 'best' : 'cm') : 'mult') + '">' + x + '</span>').join('') + '</div></div>' +
        '<div class="lz-row"><span>Kelipatan ' + b + '</span><div class="chips">' + multiples(b, max).map(x => '<span class="nchip ' + (x % a === 0 ? (x === L ? 'best' : 'cm') : 'mult') + '">' + x + '</span>').join('') + '</div></div>' +
        '<div class="numline"><div class="track">' + line(max, mk) + '</div></div>' +
        '<div class="lz-answer">Kelipatan persekutuan: ' + multiples(L, max).join(', ') + ', … → KPK dari ' + a + ' dan ' + b + ' = <b>' + L + '</b></div>';
    };
    pair.onchange = upP; upP();

    const la = el.querySelector('#k-la'), lb = el.querySelector('#k-lb');
    const drawLamp = (sec) => {
      const a = +la.value, b = +lb.value, L = lcm([a, b]);
      el.querySelector('#k-lamp-line').innerHTML = line(Math.max(L + 4, 24), x => x > sec ? '' : x % a === 0 && x % b === 0 ? 'ab first' : x % a === 0 ? 'a' : x % b === 0 ? 'b' : '');
    };
    const reset = () => { clearInterval(lampTimer); el.querySelector('#k-clock').textContent = '0'; el.querySelector('#k-lamp-res').innerHTML = ''; drawLamp(0); };
    la.onchange = reset; lb.onchange = reset;
    el.querySelector('#k-play').onclick = () => {
      reset(); const a = +la.value, b = +lb.value, L = lcm([a, b]); let s = 0;
      lampTimer = setInterval(() => {
        s++; el.querySelector('#k-clock').textContent = s; drawLamp(s);
        const A = s % a === 0, B = s % b === 0;
        el.querySelector('#lamp-a').classList.toggle('on', A); el.querySelector('#lamp-b').classList.toggle('on', B);
        if (A || B) MR.Audio.sfx('coin');
        setTimeout(() => { const pa = el.querySelector('#lamp-a'); if (pa) { pa.classList.remove('on'); el.querySelector('#lamp-b').classList.remove('on'); } }, 450);
        if (A && B) {
          clearInterval(lampTimer);
          setTimeout(() => { const la2 = el.querySelector('#lamp-a'); if (la2) { la2.classList.add('on'); el.querySelector('#lamp-b').classList.add('on'); } }, 460);
          el.querySelector('#k-lamp-res').innerHTML = '<div class="lz-answer">Keduanya menyala bersama lagi pada detik ke-<b>' + s + '</b>. Itulah KPK dari ' + a + ' dan ' + b + ' = <b>' + L + '</b>.</div>';
          MR.Audio.sfx('correct');
        }
      }, 700);
    };
    drawLamp(0);
  }

  MR.Learning = { render };
})();
