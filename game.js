/* =========================================================
   MATH RUNNER: THE LOST TEMPLE — Mesin game 3D (Three.js)
   ---------------------------------------------------------
   Three-lane endless runner. Dunia bergerak ke arah +z,
   karakter tetap di z = 0. Semua aset dibuat secara prosedural
   (geometri + tekstur kanvas) sehingga tidak ada file eksternal.
   Modul ini hanya mengurus dunia 3D & fisika; logika soal,
   skor, dan penyimpanan diatur oleh app.js melalui "hooks".
   ========================================================= */
(function () {
  'use strict';
  const T = THREE;
  const LANES = [-2.4, 0, 2.4];
  const SEG_LEN = 12, SEG_COUNT = 13, SPAWN_Z = -100, DESPAWN_Z = 16, GATE_Z = -92;
  const GRAV = -26, JUMP_V = 9.2, SLIDE_TIME = 0.75, LANE_SPEED = 15;

  /* ---------------- Tema lingkungan ---------------- */
  const THEMES = {
    jungle: {
      sky: ['#5fc2b4', '#d9f2c9'], fog: 0xbde3c4, fogNear: 28, fogFar: 108,
      hemi: [0xf2ffe8, 0x47612b, 1.9], sun: [0xfff0c8, 2.6], floorTex: 'stone', side: 0x5f8f34,
      stone: 0x8f8a74, accent: 0x18b3a3, particles: { color: 0xeaff8a, size: 0.22, count: 90, rise: 0.25 },
      musicKey: 'jungle', label: 'Hutan Tropis & Jalan Batu Kuno'
    },
    bridge: {
      sky: ['#f39a5c', '#ffe3b0'], fog: 0xf2cfa0, fogNear: 26, fogFar: 112,
      hemi: [0xffe9cc, 0x5a4636, 1.8], sun: [0xffd49a, 2.6], floorTex: 'wood', side: null,
      stone: 0x7b5a3a, accent: 0xf2b632, particles: { color: 0xffffff, size: 0.35, count: 70, rise: 0.05 },
      musicKey: 'bridge', label: 'Jembatan Kayu di Atas Jurang'
    },
    temple: {
      sky: ['#1f4e5a', '#c9a35e'], fog: 0x6f7c63, fogNear: 22, fogFar: 98,
      hemi: [0xffe2b0, 0x2b3a33, 1.5], sun: [0xffcf8a, 2.2], floorTex: 'temple', side: 0x4f5a3c,
      stone: 0xb09a6c, accent: 0x2fe0c8, particles: { color: 0xffa040, size: 0.2, count: 90, rise: 0.9 },
      musicKey: 'temple', label: 'Reruntuhan Kuil'
    },
    cave: {
      sky: ['#05101f', '#123a55'], fog: 0x0b1f33, fogNear: 16, fogFar: 84,
      hemi: [0x9fd8ff, 0x0b1424, 1.2], sun: [0x8fd0ff, 1.2], floorTex: 'cave', side: null,
      stone: 0x3b4a5e, accent: 0x5ff0ff, particles: { color: 0x7ff6ff, size: 0.18, count: 120, rise: 0.15 },
      musicKey: 'cave', label: 'Gua Kristal & Gerbang Kuil Ajaib'
    }
  };
  const LEVEL_THEME = { 1: 'jungle', 2: 'bridge', 3: 'temple', 4: 'cave' };
  const LEVEL_SPEED = { 1: [11, 16.5], 2: [12, 18], 3: [13, 19.5], 4: [13.5, 20.5] };
  const LEVEL_GAP = { 1: 24, 2: 21, 3: 19, 4: 18 };
  const LANE_COLORS = ['#13b5a6', '#f2b632', '#3d8bfd'];

  /* ---------------- State ---------------- */
  let renderer, scene, camera, clock, container, sun, hemi, playerLight;
  let themeKey = null, theme = null;
  let segments = [], objects = [], farGroup = null, envAnim = [];
  let player = null, ambient = null, bursts = null, glowTex = null;
  let hooks = {};
  let quality = 'auto', qualityLevel = 'high', fpsAcc = 0, fpsFrames = 0, fpsTimer = 0, fpsChecked = 0;
  const cache = { geo: {}, mat: {}, tex: {} };
  const gcache = { geo: {}, mat: {}, tex: {} };

  const S = {
    mode: 'menu', paused: false, level: 1, speed: 0, baseSpeed: 11, maxSpeed: 17, levelTime: 0, dist: 0,
    lane: 1, x: 0, y: 0, vy: 0, slideT: 0, hearts: 3, invuln: 0, hitT: 0, shake: 0,
    gateIndex: 0, gatesTotal: 5, nextGateDist: 0, nextChunkDist: 0, levelEndSpawned: false,
    q: null, wait: false, animT: 0, runPhase: 0, coinsLevel: 0, hudT: 0, celebrate: 0
  };

  /* ---------------- Util cache ---------------- */
  function G(key, fn, global) { const c = global ? gcache.geo : cache.geo; return c[key] || (c[key] = fn()); }
  function M(key, fn, global) { const c = global ? gcache.mat : cache.mat; return c[key] || (c[key] = fn()); }
  function std(color, o) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.0, flatShading: true }, o || {})); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function mesh(geo, mat, x, y, z, cast) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (cast) m.castShadow = true; return m; }
  function disposeThemeCache() {
    Object.values(cache.geo).forEach(g => g.dispose && g.dispose());
    Object.values(cache.mat).forEach(m => { if (m.map && !m.map.__global) m.map.dispose(); m.dispose && m.dispose(); });
    Object.values(cache.tex).forEach(t => t.dispose && t.dispose());
    cache.geo = {}; cache.mat = {}; cache.tex = {};
  }

  /* ---------------- Tekstur kanvas prosedural ---------------- */
  function canvasTex(w, h, draw, repeat, global) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4; if (global) t.__global = true;
    return t;
  }
  function noiseFill(g, w, h, base, vari, n) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(' + vari + ',' + Math.random() * 0.15 + ')'; g.fillRect(Math.random() * w, Math.random() * h, rnd(2, 8), rnd(2, 8)); }
  }
  const TEX = {
    stone: () => canvasTex(256, 256, (g, w, h) => {
      noiseFill(g, w, h, '#7d6e57', '30,20,10', 500);
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        let x = -rnd(0, 40); const y = r * h / rows;
        while (x < w) {
          const bw = rnd(50, 90); const l = rnd(-14, 14);
          g.fillStyle = `rgb(${150 + l},${138 + l},${112 + l})`;
          g.fillRect(x + 3, y + 3, bw - 6, h / rows - 6);
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, y + 3, bw - 6, 5);
          if (Math.random() < 0.35) { g.fillStyle = 'rgba(70,120,40,0.55)'; g.beginPath(); g.arc(x + rnd(5, bw - 5), y + rnd(5, h / rows - 5), rnd(4, 11), 0, 7); g.fill(); }
          x += bw;
        }
      }
    }, [2, 2]),
    wood: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2a1a0e'; g.fillRect(0, 0, w, h);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const y = i * h / n; const l = rnd(-18, 18);
        g.fillStyle = `rgb(${150 + l},${100 + l},${58 + l})`; g.fillRect(0, y + 3, w, h / n - 6);
        g.strokeStyle = 'rgba(70,40,15,0.45)'; g.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, y + rnd(6, h / n - 6)); g.bezierCurveTo(w * 0.3, y + rnd(5, 25), w * 0.6, y + rnd(5, 25), w, y + rnd(6, h / n - 6)); g.stroke(); }
        g.fillStyle = '#3b2512'; [18, w - 18].forEach(nx => { g.beginPath(); g.arc(nx, y + h / n / 2, 3.5, 0, 7); g.fill(); });
      }
    }, [1, 2]),
    temple: () => canvasTex(256, 256, (g, w, h) => {
      noiseFill(g, w, h, '#a8915f', '60,40,10', 400);
      g.strokeStyle = '#5c4a2a'; g.lineWidth = 6;
      for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); }
      g.strokeStyle = 'rgba(47,224,200,0.7)'; g.lineWidth = 3;
      [[64, 64], [192, 192]].forEach(([cx, cy]) => {
        g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(cx - 18, cy); g.lineTo(cx + 18, cy); g.moveTo(cx, cy - 18); g.lineTo(cx, cy + 18); g.stroke();
      });
      g.strokeStyle = 'rgba(255,220,140,0.5)'; g.lineWidth = 2;
      [[192, 64], [64, 192]].forEach(([cx, cy]) => { g.strokeRect(cx - 26, cy - 26, 52, 52); g.strokeRect(cx - 12, cy - 12, 24, 24); });
    }, [2, 2]),
    cave: () => canvasTex(256, 256, (g, w, h) => {
      noiseFill(g, w, h, '#1d2a3c', '0,0,0', 600);
      for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(120,150,190,' + Math.random() * 0.15 + ')'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
      g.strokeStyle = 'rgba(95,240,255,0.85)'; g.lineWidth = 2.5; g.shadowColor = '#5ff0ff'; g.shadowBlur = 8;
      for (let k = 0; k < 5; k++) {
        const x0 = Math.random() * w; const pts = [[x0, 0]]; let x = x0, y = 0;
        while (y < h) { x += rnd(-22, 22); y = Math.min(h, y + rnd(12, 30)); pts.push([x, y]); }
        const drift = x - x0; pts.forEach(p => { p[0] -= drift * p[1] / h; });
        [-w, 0, w].forEach(off => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + off, p[1]) : g.moveTo(p[0] + off, p[1])); g.stroke(); });
      }
    }, [2, 2]),
    grass: () => canvasTex(128, 128, (g, w, h) => {
      noiseFill(g, w, h, '#5c8f32', '20,60,10', 300);
      for (let i = 0; i < 160; i++) { g.strokeStyle = 'rgba(160,210,90,' + rnd(0.2, 0.5) + ')'; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y - rnd(4, 9)); g.stroke(); }
    }, [8, 3]),
    rock: () => canvasTex(128, 128, (g, w, h) => { noiseFill(g, w, h, '#6d6656', '20,20,20', 400); }, [1, 1])
  };
  function tex(name) { return cache.tex[name] || (cache.tex[name] = TEX[name]()); }

  function makeGlowTex() {
    return canvasTex(128, 128, (g, w, h) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }, null, true);
  }
  function skyTex(c1, c2) {
    return canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  }

  /* ---------------- Karakter penjelajah ---------------- */
  function makeExplorer() {
    const P = {};
    const skin = M('skin', () => std(0xc68a5c, { flatShading: false }), true);
    const shirt = M('shirt', () => std(0x16a99a, { flatShading: false }), true);
    const vest = M('vest', () => std(0xd2a868, { flatShading: false }), true);
    const shorts = M('shorts', () => std(0x6e4a2c, { flatShading: false }), true);
    const boot = M('boot', () => std(0x40281a, { flatShading: false }), true);
    const hatM = M('hat', () => std(0xe0b86e, { flatShading: false }), true);
    const band = M('band', () => std(0x8a3f22, { flatShading: false }), true);
    const pack = M('pack', () => std(0xb5652b, { flatShading: false }), true);
    const hair = M('hair', () => std(0x1d1410, { flatShading: false }), true);
    const eye = M('eye', () => new T.MeshBasicMaterial({ color: 0x111111 }), true);
    const scarf = M('scarf', () => std(0xe8553f, { flatShading: false }), true);
    const white = M('white', () => new T.MeshBasicMaterial({ color: 0xffffff }), true);

    const root = new T.Group();
    const hips = new T.Group(); hips.position.y = 0.92; root.add(hips);
    hips.add(mesh(new T.CapsuleGeometry(0.29, 0.28, 4, 10), shirt, 0, 0.36, 0, true));
    const v = mesh(new T.BoxGeometry(0.62, 0.42, 0.42), vest, 0, 0.36, 0, true); hips.add(v);
    hips.add(mesh(new T.BoxGeometry(0.5, 0.56, 0.24), pack, 0, 0.42, 0.3, true));
    hips.add(mesh(new T.BoxGeometry(0.36, 0.12, 0.14), band, 0, 0.18, 0.43));
    hips.add(mesh(new T.TorusGeometry(0.2, 0.07, 8, 16), scarf, 0, 0.7, 0).rotateX(Math.PI / 2));
    hips.add(mesh(new T.BoxGeometry(0.64, 0.1, 0.44), band, 0, 0.12, 0));

    const head = new T.Group(); head.position.y = 1.02; hips.add(head);
    head.add(mesh(new T.SphereGeometry(0.34, 20, 16), skin, 0, 0, 0, true));
    const hr = mesh(new T.SphereGeometry(0.355, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.02, 0.03); head.add(hr);
    [-0.12, 0.12].forEach(x => {
      head.add(mesh(new T.SphereGeometry(0.075, 10, 8), white, x, 0.03, -0.29));
      head.add(mesh(new T.SphereGeometry(0.045, 8, 8), eye, x, 0.03, -0.345));
    });
    head.add(mesh(new T.SphereGeometry(0.05, 8, 8), skin, 0, -0.06, -0.34));
    const smile = mesh(new T.TorusGeometry(0.08, 0.016, 6, 12, Math.PI), eye, 0, -0.14, -0.31); smile.rotation.z = Math.PI; head.add(smile);
    const hat = new T.Group(); hat.position.y = 0.24; head.add(hat);
    hat.add(mesh(new T.CylinderGeometry(0.56, 0.56, 0.05, 24), hatM, 0, 0, 0, true));
    hat.add(mesh(new T.CylinderGeometry(0.3, 0.35, 0.28, 20), hatM, 0, 0.14, 0, true));
    hat.add(mesh(new T.CylinderGeometry(0.355, 0.355, 0.08, 20), band, 0, 0.05, 0));
    P.hat = hat; P.head = head;

    function arm(side) {
      const a = new T.Group(); a.position.set(0.4 * side, 0.6, 0);
      a.add(mesh(new T.CapsuleGeometry(0.1, 0.22, 4, 8), shirt, 0, -0.16, 0, true));
      a.add(mesh(new T.CapsuleGeometry(0.085, 0.18, 4, 8), skin, 0, -0.42, 0, true));
      a.add(mesh(new T.SphereGeometry(0.1, 10, 8), skin, 0, -0.58, 0, true));
      hips.add(a); return a;
    }
    function leg(side) {
      const l = new T.Group(); l.position.set(0.16 * side, 0.04, 0);
      l.add(mesh(new T.BoxGeometry(0.24, 0.3, 0.26), shorts, 0, -0.12, 0, true));
      l.add(mesh(new T.CapsuleGeometry(0.085, 0.3, 4, 8), skin, 0, -0.45, 0, true));
      l.add(mesh(new T.BoxGeometry(0.22, 0.2, 0.36), boot, 0, -0.78, -0.05, true));
      hips.add(l); return l;
    }
    P.armL = arm(-1); P.armR = arm(1); P.legL = leg(-1); P.legR = leg(1);
    P.root = root; P.hips = hips;
    const shadow = new T.Mesh(G('blob', () => new T.CircleGeometry(0.55, 20), true), M('blob', () => new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }), true));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; P.shadow = shadow;
    return P;
  }

  function animatePlayer(dt) {
    const P = player; if (!P) return;
    const t = S.animT += dt;
    const lerp = (o, k, v, s) => { o[k] += (v - o[k]) * Math.min(1, dt * (s || 14)); };
    let state = 'idle';
    if (S.mode === 'down') state = 'down';
    else if (S.mode === 'levelEnd') state = 'victory';
    else if (S.mode === 'menu' || (S.mode === 'run' && S.speed > 0.5 && !S.paused)) state = 'run';
    if (S.mode === 'run' || S.mode === 'menu') {
      if (S.y > 0.05) state = 'jump';
      if (S.slideT > 0) state = 'slide';
    }
    if (S.hitT > 0) state = 'hit';
    if (S.paused || S.wait) state = state === 'run' ? 'idle' : state;

    const H = P.hips;
    if (state === 'run' || state === 'hit') {
      const sp = S.mode === 'menu' ? 7 : S.speed;
      S.runPhase += dt * (6 + sp * 0.42);
      const s = Math.sin(S.runPhase);
      lerp(P.legL.rotation, 'x', s * 0.95); lerp(P.legR.rotation, 'x', -s * 0.95);
      lerp(P.armL.rotation, 'x', -s * 0.9); lerp(P.armR.rotation, 'x', s * 0.9);
      lerp(P.armL.rotation, 'z', -0.15); lerp(P.armR.rotation, 'z', 0.15);
      H.position.y = 0.92 + Math.abs(Math.cos(S.runPhase)) * 0.08;
      lerp(H.rotation, 'x', -0.14); lerp(P.head.rotation, 'y', 0);
      lerp(H.rotation, 'z', state === 'hit' ? Math.sin(t * 40) * 0.25 : 0, 20);
    } else if (state === 'jump') {
      lerp(P.legL.rotation, 'x', 1.0); lerp(P.legR.rotation, 'x', 0.25);
      lerp(P.armL.rotation, 'x', 2.6); lerp(P.armR.rotation, 'x', 2.2);
      lerp(H.rotation, 'x', -0.05); H.position.y = 0.92; lerp(H.rotation, 'z', 0);
    } else if (state === 'slide') {
      lerp(H.rotation, 'x', 1.05, 20); lerp(H.position, 'y', 0.42, 20);
      lerp(P.legL.rotation, 'x', 1.45, 20); lerp(P.legR.rotation, 'x', 1.25, 20);
      lerp(P.armL.rotation, 'x', -0.6); lerp(P.armR.rotation, 'x', -0.6);
    } else if (state === 'victory') {
      const b = Math.abs(Math.sin(t * 5));
      H.position.y = 0.92 + b * 0.35;
      lerp(P.armL.rotation, 'x', 2.9); lerp(P.armR.rotation, 'x', 2.9);
      lerp(P.armL.rotation, 'z', -0.4 - b * 0.3); lerp(P.armR.rotation, 'z', 0.4 + b * 0.3);
      lerp(P.legL.rotation, 'x', 0); lerp(P.legR.rotation, 'x', 0); lerp(H.rotation, 'x', 0);
      lerp(H.rotation, 'z', 0);
    } else if (state === 'down') {
      lerp(H.position, 'y', 0.38, 6); lerp(H.rotation, 'x', 0.45, 6);
      lerp(P.legL.rotation, 'x', 1.5, 6); lerp(P.legR.rotation, 'x', 1.4, 6);
      lerp(P.armL.rotation, 'x', 0.3); lerp(P.armR.rotation, 'x', 0.3);
      lerp(P.head.rotation, 'x', 0.35);
    } else { // idle
      H.position.y = 0.92 + Math.sin(t * 2.2) * 0.02;
      lerp(H.rotation, 'x', 0); lerp(H.rotation, 'z', 0, 6);
      lerp(P.legL.rotation, 'x', 0); lerp(P.legR.rotation, 'x', 0);
      lerp(P.armL.rotation, 'x', Math.sin(t * 2.2) * 0.06); lerp(P.armR.rotation, 'x', -Math.sin(t * 2.2) * 0.06);
      lerp(P.armL.rotation, 'z', -0.12); lerp(P.armR.rotation, 'z', 0.12);
      lerp(P.head.rotation, 'y', Math.sin(t * 0.8) * 0.35, 4);
    }
    if (state !== 'down') lerp(P.head.rotation, 'x', 0);
    P.root.position.set(S.x, S.y, 0);
    P.root.rotation.y = S.mode === 'menu' ? 0 : (LANES[S.lane] - S.x) * -0.08;
    P.root.visible = !(S.invuln > 0 && S.mode === 'run' && Math.floor(S.invuln * 12) % 2 === 0);
    P.shadow.position.x = S.x; const sc = Math.max(0.4, 1 - S.y * 0.25); P.shadow.scale.set(sc, sc, sc);
  }

  /* ---------------- Partikel ---------------- */
  function makeAmbient() {
    if (ambient) { scene.remove(ambient.points); ambient.points.geometry.dispose(); ambient.points.material.dispose(); }
    const p = theme.particles; const n = qualityLevel === 'low' ? Math.floor(p.count / 2) : p.count;
    const geo = new T.BufferGeometry(); const pos = new Float32Array(n * 3); const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-14, 14); pos[i * 3 + 1] = rnd(0.3, 8); pos[i * 3 + 2] = rnd(-90, 12); ph[i] = Math.random() * 6.28; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ color: p.color, size: p.size, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    ambient = { points: pts, phase: ph, n };
  }
  function updateAmbient(dt, dz) {
    if (!ambient) return;
    const a = ambient.points.geometry.attributes.position; const arr = a.array; const rise = theme.particles.rise;
    for (let i = 0; i < ambient.n; i++) {
      arr[i * 3 + 2] += dz * 0.9; arr[i * 3 + 1] += rise * dt; arr[i * 3] += Math.sin(S.animT * 1.3 + ambient.phase[i]) * dt * 0.4;
      if (arr[i * 3 + 2] > 12 || arr[i * 3 + 1] > 9) { arr[i * 3 + 2] = rnd(-95, -40); arr[i * 3 + 1] = rnd(0.3, 4); arr[i * 3] = rnd(-14, 14); }
    }
    a.needsUpdate = true;
  }
  function makeBursts() {
    const n = 420; const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3).fill(0); const col = new Float32Array(n * 3).fill(1);
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const mat = new T.PointsMaterial({ size: 0.32, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    bursts = { points: pts, vel: new Float32Array(n * 3), life: new Float32Array(n), n, cursor: 0 };
  }
  function emit(x, y, z, color, count, speed, up) {
    if (!bursts) return;
    const c = new T.Color(color); const pos = bursts.points.geometry.attributes.position.array; const col = bursts.points.geometry.attributes.color.array;
    for (let k = 0; k < count; k++) {
      const i = bursts.cursor = (bursts.cursor + 1) % bursts.n;
      pos[i * 3] = x + rnd(-0.3, 0.3); pos[i * 3 + 1] = y + rnd(-0.3, 0.3); pos[i * 3 + 2] = z + rnd(-0.3, 0.3);
      const th = Math.random() * 6.28, ph = Math.random() * 3.14; const s = speed * rnd(0.4, 1);
      bursts.vel[i * 3] = Math.cos(th) * Math.sin(ph) * s; bursts.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s * (up || 1); bursts.vel[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * s;
      bursts.life[i] = rnd(0.6, 1.2);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }
  function updateBursts(dt, dz) {
    if (!bursts) return;
    const g = bursts.points.geometry; const pos = g.attributes.position.array; const col = g.attributes.color.array;
    for (let i = 0; i < bursts.n; i++) {
      if (bursts.life[i] <= 0) continue;
      bursts.life[i] -= dt;
      if (bursts.life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
      bursts.vel[i * 3 + 1] -= 6 * dt;
      pos[i * 3] += bursts.vel[i * 3] * dt; pos[i * 3 + 1] += bursts.vel[i * 3 + 1] * dt; pos[i * 3 + 2] += bursts.vel[i * 3 + 2] * dt + dz;
      const f = 1 - dt * 1.2; col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }

  /* ---------------- Dekorasi lingkungan ---------------- */
  function tree() {
    const g = new T.Group();
    const h = rnd(3.5, 6);
    g.add(mesh(G('trunk', () => new T.CylinderGeometry(0.22, 0.36, 1, 7)), M('trunk', () => std(0x6b4a2b)), 0, h / 2, 0)).children[0].scale.y = h;
    const leaf = [M('leafA', () => std(0x2f8a3a)), M('leafB', () => std(0x3fa046)), M('leafC', () => std(0x1f6b3a))];
    for (let i = 0; i < 3; i++) {
      const s = rnd(1.4, 2.2) * (1 - i * 0.18);
      const m = mesh(G('canopy', () => new T.IcosahedronGeometry(1, 0)), pick(leaf), rnd(-0.4, 0.4), h + i * 0.9 - 0.2, rnd(-0.4, 0.4));
      m.scale.set(s, s * 0.8, s); m.rotation.y = Math.random() * 3; g.add(m);
    }
    return g;
  }
  function palm() {
    const g = new T.Group(); const h = rnd(4, 6.5);
    for (let i = 0; i < 5; i++) { const m = mesh(G('palmSeg', () => new T.CylinderGeometry(0.17, 0.22, 1, 6)), M('trunk2', () => std(0x8a6a40)), Math.sin(i * 0.5) * 0.25, i * h / 5 + h / 10, 0); m.scale.y = h / 5; g.add(m); }
    for (let i = 0; i < 6; i++) {
      const lf = mesh(G('frond', () => { const geo = new T.ConeGeometry(0.35, 2.6, 4); geo.translate(0, 1.3, 0); return geo; }), M('frond', () => std(0x2e9c4a)), 0.5, h, 0);
      lf.rotation.set(0, i * Math.PI / 3, 1.2); const holder = new T.Group(); holder.rotation.y = i * Math.PI / 3; holder.position.set(0.3, h, 0); lf.position.set(0, 0, 0); lf.rotation.set(0, 0, 1.25); holder.add(lf); g.add(holder);
    }
    return g;
  }
  function bush() {
    const g = new T.Group(); const m = pick([M('leafA', () => std(0x2f8a3a)), M('leafB', () => std(0x3fa046))]);
    for (let i = 0; i < 3; i++) { const s = rnd(0.5, 0.9); const b = mesh(G('bush', () => new T.IcosahedronGeometry(1, 0)), m, rnd(-0.6, 0.6), s * 0.6, rnd(-0.6, 0.6)); b.scale.setScalar(s); g.add(b); }
    if (Math.random() < 0.5) { const f = mesh(G('flower', () => new T.SphereGeometry(0.12, 6, 5)), pick([M('flR', () => std(0xff5a6e, { emissive: 0x401018 })), M('flY', () => std(0xffd23f, { emissive: 0x403000 }))]), rnd(-0.4, 0.4), 1.1, rnd(-0.3, 0.3)); g.add(f); }
    return g;
  }
  function rock(color, s) {
    const m = mesh(G('rock', () => new T.DodecahedronGeometry(1, 0)), M('rock' + color, () => std(color)), 0, 0, 0, false);
    m.scale.set(s * rnd(0.8, 1.3), s * rnd(0.6, 1), s * rnd(0.8, 1.2)); m.position.y = s * 0.4; m.rotation.set(Math.random(), Math.random(), Math.random()); return m;
  }
  function ruinPillar(broken) {
    const g = new T.Group(); const h = broken ? rnd(1.2, 2.6) : rnd(3.2, 4.2);
    const mat = M('ruin', () => std(theme.stone));
    g.add(mesh(G('pBase', () => new T.BoxGeometry(1.1, 0.35, 1.1)), mat, 0, 0.17, 0));
    const shaft = mesh(G('pShaft', () => new T.CylinderGeometry(0.4, 0.45, 1, 8)), mat, 0, 0.35 + h / 2, 0); shaft.scale.y = h; g.add(shaft);
    if (!broken) g.add(mesh(G('pCap', () => new T.BoxGeometry(1.1, 0.35, 1.1)), mat, 0, 0.35 + h + 0.17, 0));
    if (Math.random() < 0.6) { const v = mesh(G('vine', () => new T.BoxGeometry(0.08, 1, 0.08)), M('vineM', () => std(0x2f8a3a)), 0.42, 0.35 + h * 0.6, 0.1); v.scale.y = h * 0.8; g.add(v); }
    return g;
  }
  function torch() {
    const g = new T.Group();
    g.add(mesh(G('tPole', () => new T.CylinderGeometry(0.07, 0.09, 2.2, 6)), M('tPole', () => std(0x4a3523)), 0, 1.1, 0));
    g.add(mesh(G('tBowl', () => new T.CylinderGeometry(0.28, 0.16, 0.25, 8)), M('tBowl', () => std(0x6a5a3a, { metalness: 0.4 })), 0, 2.25, 0));
    const fl = mesh(G('flame', () => new T.ConeGeometry(0.2, 0.55, 7)), M('flame', () => new T.MeshBasicMaterial({ color: 0xffa62b })), 0, 2.6, 0);
    g.add(fl);
    const glow = new T.Sprite(M('tGlow', () => new T.SpriteMaterial({ map: glowTex, color: 0xff9a3c, transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    glow.scale.set(2.2, 2.2, 1); glow.position.y = 2.6; g.add(glow);
    envAnim.push({ obj: g, fn: (o, t) => { fl.scale.set(1 + Math.sin(t * 17 + o.id) * 0.15, 1 + Math.sin(t * 13 + o.id) * 0.2, 1); glow.material.opacity = 0.75 + Math.sin(t * 11 + o.id) * 0.2; } });
    return g;
  }
  function statue() {
    const g = new T.Group(); const mat = M('ruin', () => std(theme.stone));
    g.add(mesh(G('stBase', () => new T.BoxGeometry(1.2, 0.6, 1.2)), mat, 0, 0.3, 0));
    g.add(mesh(G('stBody', () => new T.BoxGeometry(0.9, 1.4, 0.8)), mat, 0, 1.3, 0));
    g.add(mesh(G('stHead', () => new T.BoxGeometry(1, 0.9, 0.9)), mat, 0, 2.45, 0));
    const em = M('eyeGlow', () => new T.MeshBasicMaterial({ color: theme.accent }));
    [-0.22, 0.22].forEach(x => g.add(mesh(G('stEye', () => new T.BoxGeometry(0.18, 0.12, 0.05)), em, x, 2.5, -0.46)));
    g.add(mesh(G('stEar', () => new T.BoxGeometry(1.4, 0.2, 0.3)), mat, 0, 2.95, 0));
    return g;
  }
  function crystal(color, s) {
    const g = new T.Group();
    const mat = M('cr' + color, () => std(color, { emissive: color, emissiveIntensity: 0.65, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const c = mesh(G('crystal', () => { const geo = new T.OctahedronGeometry(0.5, 0); geo.scale(0.6, 2.2, 0.6); return geo; }), mat, rnd(-0.5, 0.5), 0.6 * s, rnd(-0.4, 0.4));
      c.scale.setScalar(s * rnd(0.6, 1.2)); c.rotation.set(rnd(-0.4, 0.4), Math.random() * 3, rnd(-0.4, 0.4)); g.add(c);
    }
    return g;
  }
  function stalactite() {
    const m = mesh(G('stal', () => { const geo = new T.ConeGeometry(0.4, 1, 6); geo.rotateX(Math.PI); return geo; }), M('stal', () => std(0x2c3a4e)), 0, 0, 0);
    const h = rnd(1.5, 4); m.scale.set(rnd(0.7, 1.4), h, rnd(0.7, 1.4)); m.position.y = 8.5 - h / 2; return m;
  }

  function buildSegment(seg) {
    const g = seg.group;
    while (g.children.length) g.remove(g.children[0]);
    const floorMat = M('floor', () => {
      const t = tex(theme.floorTex);
      return themeKey === 'cave' ? std(0xffffff, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, flatShading: false }) : std(0xffffff, { map: t, flatShading: false });
    });
    const floor = mesh(G('floor', () => new T.BoxGeometry(7.8, 0.5, SEG_LEN)), floorMat, 0, -0.25, 0); floor.receiveShadow = true; g.add(floor);

    if (themeKey === 'jungle') {
      const grass = M('grass', () => std(0xffffff, { map: tex('grass'), flatShading: false }));
      [-1, 1].forEach(sd => { const sg = mesh(G('sideG', () => new T.BoxGeometry(30, 0.5, SEG_LEN)), grass, sd * 18.9, -0.3, 0); sg.receiveShadow = true; g.add(sg); });
      const edge = M('edge', () => std(0x7a7260));
      [-1, 1].forEach(sd => { for (let k = 0; k < 4; k++) { const e = mesh(G('edgeStone', () => new T.BoxGeometry(0.5, 0.35, 2.6)), edge, sd * 4.1, 0.05, -SEG_LEN / 2 + 1.5 + k * 3); e.rotation.y = rnd(-0.1, 0.1); g.add(e); } });
      [-1, 1].forEach(sd => {
        for (let k = 0; k < 3; k++) {
          const r = Math.random(); let d;
          if (r < 0.45) d = tree(); else if (r < 0.7) d = palm(); else if (r < 0.88) d = bush(); else d = ruinPillar(Math.random() < 0.6);
          d.position.set(sd * rnd(5.5, 13), 0, rnd(-SEG_LEN / 2, SEG_LEN / 2)); d.rotation.y = Math.random() * 6; g.add(d);
        }
        if (Math.random() < 0.7) { const b = bush(); b.position.set(sd * rnd(4.6, 5.4), 0, rnd(-5, 5)); g.add(b); }
      });
    } else if (themeKey === 'bridge') {
      const wood = M('post', () => std(0x6b4425));
      const rope = M('rope', () => std(0xc9a46b));
      [-1, 1].forEach(sd => {
        [-SEG_LEN / 2 + 0.5, 0.5].forEach(z => g.add(mesh(G('post', () => new T.CylinderGeometry(0.14, 0.17, 1.8, 6)), wood, sd * 4.0, 0.6, z, true)));
        [0.9, 1.4].forEach(y => g.add(mesh(G('rope', () => new T.BoxGeometry(0.06, 0.06, SEG_LEN)), rope, sd * 4.0, y, 0)));
        g.add(mesh(G('beam', () => new T.BoxGeometry(0.3, 0.3, SEG_LEN)), wood, sd * 3.5, -0.6, 0));
      });
      if (Math.random() < 0.5) {
        const sd = pick([-1, 1]);
        const lan = mesh(G('lantern', () => new T.BoxGeometry(0.3, 0.4, 0.3)), M('lantern', () => new T.MeshBasicMaterial({ color: 0xffc35a })), sd * 4.0, 1.75, 0.5);
        g.add(lan);
        const gl = new T.Sprite(M('lGlow', () => new T.SpriteMaterial({ map: glowTex, color: 0xffb347, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending })));
        gl.scale.set(2, 2, 1); gl.position.copy(lan.position); g.add(gl);
      }
      const r = Math.random();
      if (r < 0.35) { const cl = rock(0x8a6f55, rnd(4, 7)); cl.position.set(pick([-1, 1]) * rnd(16, 26), rnd(-10, -4), rnd(-5, 5)); g.add(cl); }
    } else if (themeKey === 'temple') {
      const wallM = M('wall', () => std(theme.stone));
      [-1, 1].forEach(sd => {
        g.add(mesh(G('ledge', () => new T.BoxGeometry(6, 0.6, SEG_LEN)), M('ledge', () => std(0x7a6a48)), sd * 6.9, -0.1, 0));
        for (let k = 0; k < 4; k++) {
          if (Math.random() < 0.25) continue;
          const h = rnd(1.5, 4.5);
          const b = mesh(G('wallBlock', () => new T.BoxGeometry(1.6, 1, 2.9)), wallM, sd * rnd(6.2, 7), h / 2, -SEG_LEN / 2 + 1.5 + k * 3); b.scale.y = h; g.add(b);
        }
        const r = Math.random();
        let d = r < 0.4 ? ruinPillar(Math.random() < 0.4) : r < 0.65 ? statue() : r < 0.9 ? torch() : null;
        if (d) { d.position.set(sd * 4.6, 0, rnd(-4, 4)); d.rotation.y = sd * Math.PI / 2; g.add(d); }
        if (Math.random() < 0.5) { const t2 = torch(); t2.position.set(sd * 4.4, 0, rnd(-5, 5)); g.add(t2); }
      });
    } else if (themeKey === 'cave') {
      const rockC = 0x2a3648;
      const cols = [0x4fe3ff, 0x5a8cff, 0x9a6bff, 0x3df0c2];
      [-1, 1].forEach(sd => {
        for (let k = 0; k < 3; k++) { const r = rock(rockC, rnd(1.8, 3)); r.position.set(sd * rnd(6.5, 8.5), rnd(-0.5, 1.5), rnd(-6, 6)); g.add(r); }
        for (let k = 0; k < 2; k++) { const c = crystal(pick(cols), rnd(0.8, 1.6)); c.position.set(sd * rnd(4.4, 6), 0, rnd(-6, 6)); g.add(c); }
      });
      for (let k = 0; k < 4; k++) { const s = stalactite(); s.position.x = rnd(-7, 7); s.position.z = rnd(-6, 6); g.add(s); }
      g.add(mesh(G('ceil', () => new T.BoxGeometry(22, 0.6, SEG_LEN)), M('ceil', () => std(0x141d2b)), 0, 8.8, 0));
    }
    g.traverse(o => { if (o.isMesh && o !== floor) o.castShadow = false; });
  }

  function buildFar() {
    if (farGroup) scene.remove(farGroup);
    farGroup = new T.Group(); scene.add(farGroup);
    if (themeKey === 'jungle') {
      const cols = [0x3f7d4a, 0x2f6b46, 0x4f8f50];
      for (let i = 0; i < 14; i++) { const h = rnd(18, 40); const m = mesh(G('hill', () => new T.ConeGeometry(1, 1, 7)), M('hill' + (i % 3), () => std(cols[i % 3])), rnd(-90, 90), h / 2 - 2, rnd(-150, -120)); m.scale.set(rnd(14, 26), h, 12); farGroup.add(m); }
      const tmp = mesh(G('ziggurat', () => new T.CylinderGeometry(6, 14, 16, 4)), M('zig', () => std(0x6d7a5a)), 18, 6, -135); tmp.rotation.y = Math.PI / 4; farGroup.add(tmp);
    } else if (themeKey === 'bridge') {
      for (let i = 0; i < 12; i++) { const h = rnd(30, 60); const m = mesh(G('mtn', () => new T.ConeGeometry(1, 1, 6)), M('mtn' + (i % 2), () => std(i % 2 ? 0x8a6a6f : 0x9c7b6a)), rnd(-120, 120), h / 2 - 30, rnd(-160, -130)); m.scale.set(rnd(18, 30), h, 14); farGroup.add(m); }
      const river = mesh(G('river', () => new T.PlaneGeometry(400, 300)), M('river', () => std(0x1fb5c8, { emissive: 0x0b4a55, flatShading: false })), 0, -40, -60); river.rotation.x = -Math.PI / 2; farGroup.add(river);
      [-1, 1].forEach(sd => { for (let i = 0; i < 5; i++) { const c = mesh(G('cliff', () => new T.BoxGeometry(1, 1, 1)), M('cliff', () => std(0x8a6a4c)), sd * rnd(30, 50), -20, -i * 35 + 10); c.scale.set(rnd(14, 24), rnd(30, 50), rnd(20, 34)); farGroup.add(c); } });
    } else if (themeKey === 'temple') {
      const z = mesh(G('ziggurat', () => new T.CylinderGeometry(6, 14, 16, 4)), M('zig2', () => std(0x5a5a46)), 0, 4, -150); z.rotation.y = Math.PI / 4; z.scale.set(2.2, 2, 2.2); farGroup.add(z);
      const top = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: theme.accent, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      top.scale.set(26, 26, 1); top.position.set(0, 38, -150); farGroup.add(top);
      envAnim.push({ obj: top, fn: (o, t) => { o.material.opacity = 0.6 + Math.sin(t * 1.5) * 0.25; } });
      for (let i = 0; i < 10; i++) { const h = rnd(14, 30); const m = mesh(G('hill', () => new T.ConeGeometry(1, 1, 7)), M('jhill', () => std(0x2f4a3a)), pick([-1, 1]) * rnd(30, 100), h / 2 - 2, rnd(-150, -110)); m.scale.set(rnd(14, 20), h, 12); farGroup.add(m); }
    } else if (themeKey === 'cave') {
      [-1, 1].forEach(sd => { const w = mesh(G('cwall', () => new T.BoxGeometry(10, 30, 260)), M('cwall', () => std(0x101826)), sd * 14, 8, -100); farGroup.add(w); });
    }
  }

  /* ---------------- Rintangan ---------------- */
  function obstacleMesh(type) {
    const g = new T.Group(); const k = themeKey;
    const hit = []; // [width, height]
    if (type === 'block') {
      if (k === 'jungle') { const r = rock(0x7d7a6a, 1.05); r.position.y = 0.85; r.castShadow = true; g.add(r); const m = mesh(G('moss', () => new T.IcosahedronGeometry(0.5, 0)), M('leafA', () => std(0x2f8a3a)), 0.2, 1.7, 0.1); m.scale.set(1.2, 0.5, 1.1); g.add(m); }
      else if (k === 'bridge') { const cm = M('crate', () => std(0x9a6a38)); const b1 = mesh(G('crate', () => new T.BoxGeometry(1.4, 1.2, 1.2)), cm, 0, 0.6, 0, true); g.add(b1); g.add(mesh(G('crate2', () => new T.BoxGeometry(1.0, 0.9, 1.0)), cm, 0.1, 1.65, 0, true)); g.add(mesh(G('crateBand', () => new T.BoxGeometry(1.45, 0.12, 1.25)), M('band2', () => std(0x4a2e18)), 0, 0.6, 0)); }
      else if (k === 'temple') { const p = ruinPillar(false); p.scale.set(0.95, 0.75, 0.95); p.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(p); }
      else { const c = crystal(0x5a8cff, 1.5); c.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(c); const r = rock(0x2a3648, 0.9); r.position.y = 0.4; g.add(r); }
    } else if (type === 'jump') { // rendah, penuh 3 lajur
      if (k === 'jungle') { const l = mesh(G('log', () => new T.CylinderGeometry(0.42, 0.42, 7.4, 10)), M('log', () => std(0x7a5232)), 0, 0.42, 0, true); l.rotation.z = Math.PI / 2; g.add(l); [-3.7, 3.7].forEach(x => { const e = mesh(G('logEnd', () => new T.CylinderGeometry(0.38, 0.38, 0.05, 10)), M('logEnd', () => std(0xd9b27a)), x, 0.42, 0); e.rotation.z = Math.PI / 2; g.add(e); }); }
      else if (k === 'bridge') { g.add(mesh(G('barrier', () => new T.BoxGeometry(7.4, 0.7, 0.4)), M('barrier', () => std(0x8a5a2b)), 0, 0.35, 0, true)); for (let i = -3; i <= 3; i++) g.add(mesh(G('bpost', () => new T.BoxGeometry(0.16, 0.9, 0.5)), M('band2', () => std(0x4a2e18)), i * 1.15, 0.45, 0)); }
      else if (k === 'temple') { const base = mesh(G('trap', () => new T.BoxGeometry(7.4, 0.15, 1)), M('trap', () => std(0x4a3d2a)), 0, 0.07, 0); g.add(base); for (let i = 0; i < 14; i++) { const s = mesh(G('spike', () => new T.ConeGeometry(0.16, 0.7, 5)), M('spike', () => std(0xb8b8b8, { metalness: 0.6, roughness: 0.4 })), -3.4 + i * 0.52, 0.45, rnd(-0.2, 0.2), true); g.add(s); } }
      else { for (let i = 0; i < 7; i++) { const c = mesh(G('lowCr', () => { const geo = new T.OctahedronGeometry(0.45, 0); geo.scale(0.8, 1.4, 0.8); return geo; }), M('cr' + 0x9a6bff, () => std(0x9a6bff, { emissive: 0x9a6bff, emissiveIntensity: 0.6, roughness: 0.3 })), -3.2 + i * 1.07, 0.4, rnd(-0.2, 0.2), true); c.rotation.z = rnd(-0.4, 0.4); g.add(c); } }
    } else if (type === 'slide') { // tinggi, penuh 3 lajur
      const holder = new T.Group(); g.add(holder);
      if (k === 'jungle') { const br = mesh(G('branch', () => new T.CylinderGeometry(0.3, 0.35, 8.6, 8)), M('log', () => std(0x7a5232)), 0, 1.75, 0, true); br.rotation.z = Math.PI / 2; holder.add(br); for (let i = 0; i < 6; i++) { const lv = mesh(G('canopy', () => new T.IcosahedronGeometry(1, 0)), M('leafB', () => std(0x3fa046)), -3.5 + i * 1.4, 2.2, 0); lv.scale.set(0.7, 0.45, 0.6); holder.add(lv); } [-4.3, 4.3].forEach(x => g.add(mesh(G('sPost', () => new T.CylinderGeometry(0.2, 0.25, 2.4, 6)), M('trunk', () => std(0x6b4a2b)), x, 1.2, 0))); }
      else if (k === 'bridge') { holder.add(mesh(G('swing', () => new T.BoxGeometry(8, 0.45, 0.45)), M('barrier', () => std(0x8a5a2b)), 0, 1.75, 0, true)); [-4.2, 4.2].forEach(x => g.add(mesh(G('sPost2', () => new T.BoxGeometry(0.3, 2.6, 0.3)), M('post', () => std(0x6b4425)), x, 1.3, 0))); for (let i = -2; i <= 2; i++) holder.add(mesh(G('rope2', () => new T.BoxGeometry(0.05, 0.6, 0.05)), M('rope', () => std(0xc9a46b)), i * 1.6, 2.2, 0)); envAnim.push({ obj: holder, fn: (o, t) => { o.position.y = Math.sin(t * 3 + o.id) * 0.08; } }); }
      else if (k === 'temple') { holder.add(mesh(G('lintel', () => new T.BoxGeometry(8.4, 0.7, 0.8)), M('ruin', () => std(theme.stone)), 0, 1.95, 0, true)); [-4.3, 4.3].forEach(x => g.add(mesh(G('sPost3', () => new T.BoxGeometry(0.6, 2.4, 0.8)), M('ruin', () => std(theme.stone)), x, 1.2, 0))); for (let i = -3; i <= 3; i++) holder.add(mesh(G('rune', () => new T.BoxGeometry(0.4, 0.3, 0.05)), M('eyeGlow', () => new T.MeshBasicMaterial({ color: theme.accent })), i * 1.15, 1.95, 0.42)); }
      else { holder.add(mesh(G('crBeam', () => new T.BoxGeometry(8.4, 0.55, 0.6)), M('cr' + 0x4fe3ff, () => std(0x4fe3ff, { emissive: 0x4fe3ff, emissiveIntensity: 0.65, roughness: 0.25, transparent: true, opacity: 0.92 })), 0, 1.85, 0, true)); for (let i = -3; i <= 3; i++) { const s = mesh(G('stal', () => { const geo = new T.ConeGeometry(0.4, 1, 6); geo.rotateX(Math.PI); return geo; }), M('stal', () => std(0x2c3a4e)), i * 1.2, 2.6, 0); s.scale.set(0.6, 1.2, 0.6); holder.add(s); } envAnim.push({ obj: holder, fn: (o, t) => { o.position.y = Math.sin(t * 2 + o.id) * 0.05; } }); }
    }
    return g;
  }
  function addObstacle(type, lanes, z) {
    const m = obstacleMesh(type);
    if (type === 'block') m.position.x = LANES[lanes[0]];
    m.position.z = z; scene.add(m);
    objects.push({ kind: 'obs', type, lanes, mesh: m, z, depth: type === 'block' ? 1.2 : 0.7, hit: false, fly: 0 });
  }

  /* ---------------- Koin ---------------- */
  function coinMesh() {
    const g = new T.Group();
    const c = mesh(G('coin', () => { const geo = new T.CylinderGeometry(0.36, 0.36, 0.09, 18); geo.rotateX(Math.PI / 2); return geo; }, true),
      M('coin', () => std(0xffcf40, { metalness: 0.35, roughness: 0.35, emissive: 0xb07800, emissiveIntensity: 0.75, flatShading: false }), true));
    g.add(c);
    g.add(mesh(G('coinStar', () => new T.CylinderGeometry(0.17, 0.17, 0.11, 5).rotateX(Math.PI / 2), true), M('coinIn', () => std(0xfff0a0, { emissive: 0x806000, emissiveIntensity: 0.5 }), true), 0, 0, 0));
    return g;
  }
  function addCoin(lane, z, y) {
    const m = coinMesh(); m.position.set(LANES[lane], y, z); scene.add(m);
    objects.push({ kind: 'coin', lane, mesh: m, z, y, taken: false });
  }
  function coinLine(lane, z, n, y, arcOver) {
    for (let i = 0; i < n; i++) {
      let yy = y;
      if (arcOver) { const t = i / (n - 1); yy = 0.8 + Math.sin(t * Math.PI) * 1.6; }
      addCoin(lane, z - i * 1.7, yy);
    }
  }

  /* ---------------- Gerbang soal ---------------- */
  function labelTexture(text, idx) {
    return canvasTex(256, 352, (g, w, h) => {
      const col = LANE_COLORS[idx];
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col); gr.addColorStop(1, '#0d2a2a');
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
      g.fillStyle = gr; roundRect(g, 10, 10, w - 20, h - 20, 26); g.fill();
      g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,0.9)'; roundRect(g, 10, 10, w - 20, h - 20, 26); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(w / 2, 58, 30, 0, 7); g.fill();
      g.fillStyle = col; g.font = '900 40px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABC'[idx], w / 2, 60);
      g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8;
      const s = String(text);
      let lines = [s];
      if (s.length > 5) { const parts = s.split(', '); lines = []; let cur = ''; parts.forEach((p, i) => { const add = (cur ? cur + ', ' : '') + p + (i < parts.length - 1 ? ',' : ''); if (add.replace(/,$/, '').length > 9 && cur) { lines.push(cur + ','); cur = p; } else cur = (cur ? cur + ', ' : '') + p; }); lines.push(cur); }
      let size = lines.length === 1 ? (s.length <= 2 ? 150 : s.length <= 3 ? 118 : 84) : lines.length <= 2 ? 62 : 50;
      g.font = '900 ' + size + 'px "Baloo 2", system-ui, sans-serif';
      while (lines.some(l => g.measureText(l).width > w - 44) && size > 24) { size -= 4; g.font = '900 ' + size + 'px "Baloo 2", system-ui, sans-serif'; }
      const lh = size * 1.05; const y0 = 205 - (lines.length - 1) * lh / 2;
      lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
    });
  }
  function bannerTexture(text, color) {
    return canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = '#2a1d10'; roundRect(g, 4, 4, w - 8, h - 8, 18); g.fill();
      g.lineWidth = 5; g.strokeStyle = color; roundRect(g, 4, 4, w - 8, h - 8, 18); g.stroke();
      g.fillStyle = '#ffd772'; g.font = '900 50px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 14; g.fillText(text, w / 2, h / 2 + 3);
    });
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function makeQuestionGate(labels, title) {
    const g = new T.Group(); const own = [];
    const stone = M('gateStone', () => std(themeKey === 'cave' ? 0x3a4a64 : 0x9a8458));
    const rune = M('gateRune', () => new T.MeshBasicMaterial({ color: theme.accent }));
    [-3.6, -1.2, 1.2, 3.6].forEach(x => {
      g.add(mesh(G('gPost', () => new T.BoxGeometry(0.55, 4.1, 0.75)), stone, x, 2.05, 0, true));
      g.add(mesh(G('gRune', () => new T.BoxGeometry(0.14, 3.2, 0.78)), rune, x, 2.0, 0));
      g.add(mesh(G('gCap', () => new T.BoxGeometry(0.8, 0.3, 0.9)), stone, x, 0.15, 0));
    });
    g.add(mesh(G('gLintel', () => new T.BoxGeometry(8.4, 0.65, 0.9)), stone, 0, 4.35, 0, true));
    const btex = bannerTexture(title, '#' + new T.Color(theme.accent).getHexString()); own.push(btex);
    const bmat = new T.MeshBasicMaterial({ map: btex, transparent: true }); own.push(bmat);
    const banner = mesh(G('gBanner', () => new T.PlaneGeometry(5.6, 1.05)), bmat, 0, 5.25, 0.05); g.add(banner);
    const doors = [], glows = [];
    labels.forEach((lab, i) => {
      const t = labelTexture(lab, i); own.push(t);
      const m = new T.MeshBasicMaterial({ map: t, transparent: true, side: T.DoubleSide }); own.push(m);
      const d = mesh(G('gDoor', () => new T.PlaneGeometry(2.0, 2.75)), m, LANES[i], 1.65, 0); g.add(d); doors.push(d);
      const gm = new T.SpriteMaterial({ map: glowTex, color: LANE_COLORS[i], transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }); own.push(gm);
      const gl = new T.Sprite(gm); gl.scale.set(3.6, 4.2, 1); gl.position.set(LANES[i], 1.8, -0.2); g.add(gl); glows.push(gl);
    });
    return { group: g, doors, glows, own };
  }

  function makeLevelPortal(final) {
    const g = new T.Group(); const own = [];
    const gold = M('portalGold', () => std(0xf2b632, { metalness: 0.7, roughness: 0.3, emissive: 0x5a3a00, emissiveIntensity: 0.6 }));
    const arch = mesh(G('arch', () => new T.TorusGeometry(4.3, 0.45, 10, 40, Math.PI)), gold, 0, 0.6, 0, true); g.add(arch);
    [-4.3, 4.3].forEach(x => g.add(mesh(G('archLeg', () => new T.BoxGeometry(1, 1.4, 1)), gold, x, 0.4, 0, true)));
    const dm = new T.MeshBasicMaterial({ map: glowTex, color: final ? 0xffd35a : theme.accent, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }); own.push(dm);
    const disc = mesh(G('portalDisc', () => new T.CircleGeometry(3.9, 40)), dm, 0, 0.6, -0.05); g.add(disc);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const rm = new T.MeshBasicMaterial({ color: i % 2 ? 0xffffff : theme.accent, transparent: true, opacity: 0.7 }); own.push(rm);
      const r = mesh(G('ring' + i, () => new T.TorusGeometry(2.2 + i * 0.6, 0.05, 6, 48)), rm, 0, 2.2, 0); g.add(r); rings.push(r);
    }
    const btex = bannerTexture(final ? 'GERBANG KUIL AJAIB' : 'CHECKPOINT LEVEL', '#ffd35a'); own.push(btex);
    const bm = new T.MeshBasicMaterial({ map: btex, transparent: true }); own.push(bm);
    g.add(mesh(G('gBanner2', () => new T.PlaneGeometry(6, 1.1)), bm, 0, 5.8, 0.2));
    envAnim.push({ obj: g, fn: (o, t) => { rings.forEach((r, i) => { r.rotation.z = t * (i % 2 ? -1 : 1) * (0.8 + i * 0.3); r.rotation.y = Math.sin(t + i) * 0.4; }); dm.opacity = 0.65 + Math.sin(t * 3) * 0.2; } });
    return { group: g, own };
  }

  /* ---------------- Pola rintangan per "chunk" ---------------- */
  function spawnChunk(z) {
    const L = S.level;
    const w = L === 1 ? { blockOne: 4, blockTwo: 1, jumpAll: 3, slideAll: 2, coins: 3 }
      : L === 2 ? { blockOne: 3, blockTwo: 2, jumpAll: 3, slideAll: 3, coins: 2 }
        : L === 3 ? { blockOne: 3, blockTwo: 3, jumpAll: 3, slideAll: 3, coins: 1, combo: 2 }
          : { blockOne: 2, blockTwo: 4, jumpAll: 3, slideAll: 3, coins: 1, combo: 3 };
    const keys = Object.keys(w); let tot = keys.reduce((a, k) => a + w[k], 0), r = Math.random() * tot, pat = keys[0];
    for (const k of keys) { r -= w[k]; if (r <= 0) { pat = k; break; } }
    const lane = Math.floor(Math.random() * 3);
    if (pat === 'blockOne') { addObstacle('block', [lane], z); coinLine((lane + 1 + Math.floor(Math.random() * 2)) % 3, z + 3, 5, 0.8); }
    else if (pat === 'blockTwo') { const free = lane; [0, 1, 2].filter(i => i !== free).forEach(i => addObstacle('block', [i], z)); coinLine(free, z + 4, 6, 0.8); }
    else if (pat === 'jumpAll') { addObstacle('jump', [0, 1, 2], z); coinLine(lane, z + 3.4, 5, 0, true); }
    else if (pat === 'slideAll') { addObstacle('slide', [0, 1, 2], z); coinLine(lane, z + 2.5, 4, 0.55); }
    else if (pat === 'coins') { coinLine(lane, z, 8, 0.8); }
    else if (pat === 'combo') { addObstacle('block', [lane], z); addObstacle('jump', [0, 1, 2], z - 9); coinLine((lane + 1) % 3, z + 2, 4, 0.8); }
  }

  /* ---------------- Lingkungan / tema ---------------- */
  function setTheme(key) {
    if (themeKey === key) return;
    // bersihkan objek lama
    objects.forEach(o => scene.remove(o.mesh)); objects = [];
    segments.forEach(s => scene.remove(s.group)); segments = [];
    if (farGroup) { scene.remove(farGroup); farGroup = null; }
    envAnim = [];
    disposeThemeCache();
    themeKey = key; theme = THEMES[key];
    scene.background = skyTex(theme.sky[0], theme.sky[1]); cache.tex.sky = scene.background;
    scene.fog = new T.Fog(theme.fog, theme.fogNear, theme.fogFar);
    hemi.color.setHex(theme.hemi[0]); hemi.groundColor.setHex(theme.hemi[1]); hemi.intensity = theme.hemi[2];
    sun.color.setHex(theme.sun[0]); sun.intensity = theme.sun[1];
    playerLight.intensity = key === 'cave' ? 28 : key === 'temple' ? 8 : 0;
    playerLight.color.setHex(key === 'cave' ? 0x7fe8ff : 0xffb060);
    for (let i = 0; i < SEG_COUNT; i++) {
      const seg = { group: new T.Group(), z: SEG_LEN - i * SEG_LEN };
      seg.group.position.z = seg.z; buildSegment(seg); scene.add(seg.group); segments.push(seg);
    }
    buildFar();
    makeAmbient();
  }

  /* ---------------- Kualitas grafis ---------------- */
  function applyQuality(level) {
    qualityLevel = level;
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(level === 'high' ? Math.min(dpr, 2) : level === 'medium' ? Math.min(dpr, 1.5) : 1);
    const shadows = level !== 'low';
    renderer.shadowMap.enabled = shadows; sun.castShadow = shadows;
    const size = level === 'high' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
    resize();
  }
  function autoQualityInitial() {
    const coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    return coarse ? 'medium' : 'high';
  }

  /* ---------------- Init ---------------- */
  function init(el, h) {
    container = el; hooks = h || {};
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(62, 1, 0.1, 400);
    hemi = new T.HemisphereLight(0xffffff, 0x444444, 1.5); scene.add(hemi);
    sun = new T.DirectionalLight(0xffffff, 2.5); sun.position.set(-8, 16, 6);
    sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -18;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    playerLight = new T.PointLight(0x7fe8ff, 0, 16, 2); playerLight.position.set(0, 3, -2); scene.add(playerLight);
    glowTex = makeGlowTex();
    player = makeExplorer(); scene.add(player.root); scene.add(player.shadow);
    makeBursts();
    try { quality = localStorage.getItem('mathRunner.quality') || 'auto'; } catch (e) { }
    applyQuality(quality === 'auto' ? autoQualityInitial() : quality);
    setTheme('jungle');
    clock = new T.Clock();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container); else window.addEventListener('resize', resize);
    resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'run' && !S.paused) { pause(); hooks.onAutoPause && hooks.onAutoPause(); } });
    renderer.setAnimationLoop(loop);
  }
  function resize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 74 : 62; camera.updateProjectionMatrix();
  }

  /* ---------------- Alur level ---------------- */
  function resetRunState() {
    S.lane = 1; S.x = 0; S.y = 0; S.vy = 0; S.slideT = 0; S.hitT = 0; S.invuln = 0; S.shake = 0;
    S.levelTime = 0; S.dist = 0; S.gateIndex = 0; S.levelEndSpawned = false; S.q = null; S.wait = false; S.coinsLevel = 0; S.celebrate = 0;
  }
  function clearObjects(filter) {
    objects = objects.filter(o => {
      if (!filter || filter(o)) { scene.remove(o.mesh); if (o.own) o.own.forEach(x => x.dispose && x.dispose()); return false; }
      return true;
    });
  }
  function startLevel(level, gatesTotal) {
    setTheme(LEVEL_THEME[level]);
    clearObjects();
    resetRunState();
    S.level = level; S.gatesTotal = gatesTotal || 5; S.hearts = 3;
    S.baseSpeed = LEVEL_SPEED[level][0]; S.maxSpeed = LEVEL_SPEED[level][1]; S.speed = S.baseSpeed * 0.6;
    S.nextChunkDist = 30; S.nextGateDist = 150;
    S.mode = 'run'; S.paused = false;
    if (window.MR && MR.Audio) MR.Audio.music(theme.musicKey);
    hooks.onHud && hooks.onHud(S);
  }
  function setMenu() {
    setTheme('jungle'); clearObjects(); resetRunState();
    S.mode = 'menu'; S.paused = false; S.speed = 6;
  }

  /* ---------------- Kontrol ---------------- */
  function canAct() { return S.mode === 'run' && !S.paused; }
  function markChoice() { if (S.q && !S.q.resolved) { S.q.chosen = true; if (S.wait) { S.wait = false; hooks.onChoiceMade && hooks.onChoiceMade(); } hooks.onLaneChange && hooks.onLaneChange(S.lane); } }
  function moveLeft() { if (!canAct() && !S.wait) return; if (S.lane > 0) { S.lane--; MR.Audio && MR.Audio.sfx('lane'); } markChoice(); }
  function moveRight() { if (!canAct() && !S.wait) return; if (S.lane < 2) { S.lane++; MR.Audio && MR.Audio.sfx('lane'); } markChoice(); }
  function selectLane(i) { if (S.mode !== 'run' || S.paused) return; if (S.lane !== i) MR.Audio && MR.Audio.sfx('lane'); S.lane = i; markChoice(); }
  function jump() { if (!canAct() || S.wait) return; if (S.y <= 0.001) { S.vy = JUMP_V; S.slideT = 0; MR.Audio && MR.Audio.sfx('jump'); } }
  function slide() { if (!canAct() || S.wait) return; if (S.y > 0.05) S.vy = -18; S.slideT = SLIDE_TIME; MR.Audio && MR.Audio.sfx('slide'); }
  function pause() { if (S.mode === 'run') S.paused = true; }
  function resume() { S.paused = false; clock.getDelta(); }
  function continueFromCheckpoint() {
    S.hearts = 3; S.invuln = 2.5; S.hitT = 0; S.mode = 'run'; S.paused = false; S.speed = S.baseSpeed * 0.7;
    clearObjects(o => o.kind === 'obs' && o.mesh.position.z < 2);
    hooks.onHud && hooks.onHud(S);
  }

  /* ---------------- Gerbang ---------------- */
  function spawnGate() {
    // gerbang ajaib menyingkirkan rintangan di depan
    objects.filter(o => o.kind === 'obs' && o.mesh.position.z < -1).forEach(o => emit(o.mesh.position.x, 1, o.mesh.position.z, theme.accent, 14, 3));
    clearObjects(o => o.kind === 'obs' && o.mesh.position.z < -1);
    const info = hooks.onGateSpawn ? hooks.onGateSpawn(S.gateIndex) : null;
    if (!info) return;
    const gate = makeQuestionGate(info.labels, info.title);
    gate.group.position.z = GATE_Z; scene.add(gate.group);
    const o = { kind: 'gate', mesh: gate.group, gate, index: S.gateIndex, own: gate.own, resolved: false };
    objects.push(o);
    const words = (info.readWords || 10);
    const tRead = Math.max(10, Math.min(26, 8 + words * 0.38));
    S.q = { obj: o, chosen: false, resolved: false, qSpeed: Math.max(3.2, (Math.abs(GATE_Z) - 12) / tRead) };
    // koin hadiah menuju gerbang
    coinLine(S.lane, -18, 5, 0.8);
  }
  function resolveGate(o) {
    o.resolved = true; S.q.resolved = true;
    const lane = S.lane;
    const res = hooks.onGateCross ? hooks.onGateCross(o.index, lane) : { correct: true, correctLane: lane };
    const gz = o.mesh.position.z;
    if (res.correct) {
      emit(LANES[lane], 2, gz, 0x58ff9a, 60, 7); emit(LANES[lane], 2.5, gz, 0xffe066, 40, 5);
      o.opening = { lane, t: 0, correct: true };
      MR.Audio && MR.Audio.sfx('correct');
    } else {
      emit(LANES[lane], 2, gz, 0xff5252, 50, 6);
      o.opening = { lane, t: 0, correct: false, correctLane: res.correctLane };
      o.gate.doors[lane].material.color.setHex(0xff6b6b);
      if (res.correctLane !== undefined) emit(LANES[res.correctLane], 2, gz, 0x58ff9a, 30, 4);
      MR.Audio && MR.Audio.sfx('wrong');
    }
    S.gateIndex++;
    S.q = null;
    S.nextGateDist = S.dist + 150 + S.level * 10;
    S.nextChunkDist = S.dist + 22;
    if (S.gateIndex >= S.gatesTotal) S.nextGateDist = Infinity;
    hooks.onHud && hooks.onHud(S);
  }

  /* ---------------- Loop utama ---------------- */
  let elapsed = 0, simSteps = 1; // simSteps > 1 hanya untuk pengujian otomatis
  function loop() {
    let dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    if (S.paused) dt = 0;
    for (let i = 0; i < simSteps; i++) update(dt);
    // kamera
    const isMenu = S.mode === 'menu';
    let cx, cy, cz, lx, ly, lz;
    if (isMenu) {
      const a = 0.75 + Math.sin(elapsed * 0.25) * 0.45;
      cx = Math.sin(a) * 5.2; cy = 2.3; cz = -Math.cos(a) * 5.2 + 1.0; lx = 0; ly = 1.4; lz = 0;
      if (camera.aspect < 0.8) { cx *= 1.35; cz *= 1.35; cy = 2.8; }
    } else if (S.mode === 'levelEnd') {
      cx = S.x + Math.sin(elapsed * 0.6) * 4.5; cy = 2.6; cz = -4.5; lx = S.x; ly = 1.3; lz = 0;
    } else {
      cx = S.x * 0.55; cy = 3.9 + S.y * 0.35; cz = 7.4; lx = S.x * 0.75; ly = 1.2 + S.y * 0.3; lz = -9;
      if (camera.aspect < 0.8) { cy = 4.6; cz = 8.6; }
    }
    const k = Math.min(1, (dt || 0.016) * (isMenu ? 2 : 6));
    camera.position.x += (cx - camera.position.x) * k; camera.position.y += (cy - camera.position.y) * k; camera.position.z += (cz - camera.position.z) * k;
    if (!camera.userData.look) camera.userData.look = new T.Vector3(lx, ly, lz);
    const L = camera.userData.look; L.x += (lx - L.x) * k; L.y += (ly - L.y) * k; L.z += (lz - L.z) * k;
    camera.lookAt(L);
    if (S.shake > 0) { camera.position.x += rnd(-1, 1) * S.shake * 0.25; camera.position.y += rnd(-1, 1) * S.shake * 0.25; S.shake = Math.max(0, S.shake - dt * 3); }
    sun.position.set(S.x - 8, 16, 6); sun.target.position.set(S.x, 0, -4);
    playerLight.position.set(S.x, 3, -3);
    renderer.render(scene, camera);
    // adaptasi kualitas otomatis
    if (quality === 'auto' && S.mode === 'run' && !S.paused && fpsChecked < 3) {
      fpsTimer += dt; fpsFrames++;
      if (fpsTimer > 3) {
        const fps = fpsFrames / fpsTimer; fpsTimer = 0; fpsFrames = 0; fpsChecked++;
        if (fps < 38 && qualityLevel !== 'low') applyQuality(qualityLevel === 'high' ? 'medium' : 'low');
      }
    }
  }

  function update(dt) {
    const t = elapsed;
    envAnim.forEach(e => { if (!e.obj.id) e.obj.id = Math.random() * 10; e.fn(e.obj, t); });

    // kecepatan
    let target = 0;
    if (S.mode === 'menu') target = 6;
    else if (S.mode === 'run') {
      S.levelTime += dt;
      target = Math.min(S.maxSpeed, S.baseSpeed + S.levelTime * 0.09);
      if (S.q && !S.q.resolved) target = Math.min(target, S.q.qSpeed);
      if (S.wait) target = 0;
    }
    S.speed += (target - S.speed) * Math.min(1, dt * (S.wait ? 8 : 2.2));
    if (S.wait) S.speed = Math.max(0, S.speed);
    const dz = S.speed * dt;
    if (S.mode === 'run') S.dist += dz;

    // segmen tanah
    const wrap = SEG_COUNT * SEG_LEN;
    segments.forEach(seg => {
      seg.z += dz;
      if (seg.z > SEG_LEN + 8) { seg.z -= wrap; buildSegment(seg); }
      seg.group.position.z = seg.z;
    });

    // fisika karakter
    if (S.mode === 'run' || S.mode === 'menu') {
      const tx = LANES[S.lane];
      const d = tx - S.x; const step = LANE_SPEED * dt;
      S.x = Math.abs(d) <= step ? tx : S.x + Math.sign(d) * step;
      if (S.y > 0 || S.vy > 0) { S.vy += GRAV * dt; S.y += S.vy * dt; if (S.y <= 0) { S.y = 0; S.vy = 0; } }
      if (S.slideT > 0) S.slideT -= dt;
      if (S.invuln > 0) S.invuln -= dt;
      if (S.hitT > 0) S.hitT -= dt;
    }

    // spawn
    if (S.mode === 'run' && !S.wait) {
      if (!S.q && S.gateIndex < S.gatesTotal && S.dist >= S.nextGateDist) spawnGate();
      if (!S.q && S.gateIndex < S.gatesTotal && S.dist >= S.nextChunkDist && S.dist < S.nextGateDist - 70) {
        spawnChunk(SPAWN_Z); S.nextChunkDist = S.dist + LEVEL_GAP[S.level] * rnd(0.85, 1.2);
      }
      if (S.gateIndex >= S.gatesTotal && !S.levelEndSpawned && !objects.some(o => o.kind === 'gate')) {
        S.levelEndSpawned = true;
        const p = makeLevelPortal(S.level === 4);
        p.group.position.z = GATE_Z; scene.add(p.group);
        objects.push({ kind: 'portal', mesh: p.group, own: p.own });
        coinLine(1, -30, 8, 0.8);
      }
    }

    // objek
    const px = S.x, py = S.y, sliding = S.slideT > 0;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]; const m = o.mesh;
      m.position.z += dz;
      const z = m.position.z;
      if (o.kind === 'coin') {
        m.rotation.y += dt * 4; m.position.y = o.y + Math.sin(t * 4 + z) * 0.08;
        if (!o.taken && S.mode === 'run' && Math.abs(z) < 0.8 && Math.abs(m.position.x - px) < 0.95 && Math.abs(m.position.y - (py + (sliding ? 0.4 : 0.9))) < 1.15) {
          o.taken = true; S.coinsLevel++; emit(m.position.x, m.position.y, z, 0xffd23f, 10, 3);
          MR.Audio && MR.Audio.sfx('coin'); hooks.onCoin && hooks.onCoin();
          scene.remove(m); objects.splice(i, 1); continue;
        }
      } else if (o.kind === 'obs') {
        if (o.fly > 0) { o.fly += dt; m.position.y += dt * 6; m.rotation.x += dt * 6; m.scale.multiplyScalar(1 - dt * 1.5); }
        else if (S.mode === 'run' && S.invuln <= 0 && !o.hit && Math.abs(z) < o.depth / 2 + 0.35) {
          const inLane = o.lanes.some(l => Math.abs(LANES[l] - px) < 1.15);
          let hit = false;
          if (inLane) {
            if (o.type === 'block') hit = true;
            else if (o.type === 'jump') hit = py < 0.85;
            else if (o.type === 'slide') hit = !sliding;
          }
          if (hit) {
            o.hit = true; o.fly = 0.01; S.hearts--; S.invuln = 1.6; S.hitT = 0.5; S.shake = 1; S.speed *= 0.55;
            emit(px, 1.2, 0, 0xffffff, 18, 4); MR.Audio && MR.Audio.sfx('hit');
            hooks.onHit && hooks.onHit(S.hearts);
            if (S.hearts <= 0) { S.mode = 'down'; S.speed = 0; hooks.onOutOfHearts && hooks.onOutOfHearts(); }
            hooks.onHud && hooks.onHud(S);
          }
        }
      } else if (o.kind === 'gate') {
        o.gate.glows.forEach((g, gi) => { g.material.opacity = 0.45 + Math.sin(t * 4 + gi) * 0.15 + (S.q && gi === S.lane && !o.resolved ? 0.35 : 0); });
        if (!o.resolved && S.mode === 'run') {
          if (z > -11 && S.q && !S.q.chosen && !S.wait) { S.wait = true; hooks.onNeedChoice && hooks.onNeedChoice(); }
          if (z >= -0.2) resolveGate(o);
        }
        if (o.opening) {
          o.opening.t += dt; const ot = o.opening.t;
          if (o.opening.correct) {
            const d = o.gate.doors[o.opening.lane]; d.position.y = 1.65 + ot * 6; d.material.opacity = Math.max(0, 1 - ot * 1.5);
          } else {
            const d = o.gate.doors[o.opening.lane]; d.scale.setScalar(Math.max(0.01, 1 - ot * 2)); d.rotation.z += dt * 8;
            const c = o.opening.correctLane; if (c !== undefined) { o.gate.doors[c].material.color.setHex(Math.floor(ot * 8) % 2 ? 0x9dffb5 : 0xffffff); }
          }
        }
      } else if (o.kind === 'portal') {
        if (S.mode === 'run' && z >= 0 && !o.done) {
          o.done = true; S.mode = 'levelEnd'; S.speed = 0;
          for (let k = 0; k < 4; k++) emit(rnd(-3, 3), rnd(1, 4), rnd(-2, 0), pick([0xffd35a, 0x58ff9a, 0x5ff0ff, 0xffffff]), 40, 7, 1.5);
          MR.Audio && MR.Audio.sfx('level');
          hooks.onLevelComplete && hooks.onLevelComplete();
        }
      }
      if (z > DESPAWN_Z) { scene.remove(m); if (o.own) o.own.forEach(x => x.dispose && x.dispose()); objects.splice(i, 1); }
    }
    if (S.mode === 'levelEnd' && Math.random() < dt * 4) emit(rnd(-4, 4), rnd(2, 5), rnd(-6, -1), pick([0xffd35a, 0x58ff9a, 0x5ff0ff]), 16, 4);

    updateAmbient(dt, dz);
    updateBursts(dt, dz);
    animatePlayer(dt);
    S.hudT += dt; if (S.hudT > 0.12 && S.mode === 'run') { S.hudT = 0; hooks.onHud && hooks.onHud(S); }
  }

  function setQuality(q) {
    quality = q; try { localStorage.setItem('mathRunner.quality', q); } catch (e) { }
    fpsChecked = 0; applyQuality(q === 'auto' ? autoQualityInitial() : q);
  }

  MR.Game = {
    init, startLevel, setMenu, pause, resume, moveLeft, moveRight, jump, slide, selectLane, continueFromCheckpoint, setQuality,
    set _simSteps(n) { simSteps = Math.max(1, Math.min(20, n | 0)); },
    get state() { return S; }, get quality() { return quality; }, get qualityLevel() { return qualityLevel; },
    THEMES, LEVEL_THEME, LANE_COLORS
  };
})();
