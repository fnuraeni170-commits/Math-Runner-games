/* =========================================================
   MATH RUNNER — Audio (disintesis dengan Web Audio API)
   Tidak memerlukan file suara eksternal → ringan & bebas lisensi.
   ========================================================= */
(function () {
  'use strict';
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false, musicOn = false, timer = null, step = 0, nextTime = 0, theme = 'jungle';
  try { muted = localStorage.getItem('mathRunner.muted') === '1'; } catch (e) { }

  const SCALES = { // pentatonik per tema (frekuensi dasar)
    jungle: { root: 220, scale: [0, 2, 4, 7, 9], tempo: 112 },
    bridge: { root: 196, scale: [0, 3, 5, 7, 10], tempo: 118 },
    temple: { root: 174.6, scale: [0, 1, 5, 7, 8], tempo: 104 },
    cave: { root: 164.8, scale: [0, 2, 3, 7, 9], tempo: 124 },
    menu: { root: 246.9, scale: [0, 2, 4, 7, 9], tempo: 92 }
  };
  const MELODY = [0, 2, 4, 2, 3, 4, 1, 0, 0, 2, 4, 5, 4, 2, 1, -1];
  const BASS = [0, 0, 3, 3, 4, 4, 2, 2];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }
  const semi = (root, n) => root * Math.pow(2, n / 12);
  function noteFreq(sc, deg, oct) {
    const L = sc.scale.length; const o = Math.floor(deg / L); const i = ((deg % L) + L) % L;
    return semi(sc.root, sc.scale[i] + 12 * (o + (oct || 0)));
  }
  function tone(freq, t, dur, type, gain, dest, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, gain, freq, dest) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(dest || sfxGain); s.start(t);
  }

  function schedule() {
    if (!ctx || !musicOn) return;
    const sc = SCALES[theme] || SCALES.jungle; const beat = 60 / sc.tempo / 2;
    while (nextTime < ctx.currentTime + 0.25) {
      const s = step % 32;
      const m = MELODY[s % 16];
      if (s % 2 === 0 || (theme !== 'menu' && Math.random() < 0.25)) {
        if (m >= 0) tone(noteFreq(sc, m + (s >= 16 ? 2 : 0), 1), nextTime, beat * 1.6, 'triangle', 0.18, musicGain);
      }
      if (s % 4 === 0) tone(noteFreq(sc, BASS[(s / 4) % 8], -1), nextTime, beat * 3.5, 'sine', 0.35, musicGain);
      if (theme !== 'menu') {
        if (s % 4 === 0) tone(110, nextTime, 0.18, 'sine', 0.5, musicGain, 45);         // kick
        if (s % 4 === 2) noise(nextTime, 0.08, 0.25, 6000, musicGain);                     // hat
        if (s % 8 === 4) noise(nextTime, 0.14, 0.3, 1800, musicGain);                      // snare
      }
      nextTime += beat; step++;
    }
  }

  MR.Audio = {
    unlock() { ensure(); },
    isMuted() { return muted; },
    setMuted(v) {
      muted = !!v; try { localStorage.setItem('mathRunner.muted', muted ? '1' : '0'); } catch (e) { }
      if (master) master.gain.value = muted ? 0 : 0.8;
    },
    music(th) {
      if (!ensure()) return;
      theme = th || 'jungle';
      if (!musicOn) { musicOn = true; step = 0; nextTime = ctx.currentTime + 0.05; timer = setInterval(schedule, 60); }
    },
    stopMusic() { musicOn = false; clearInterval(timer); timer = null; },
    sfx(name) {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      switch (name) {
        case 'coin': tone(988, t, 0.08, 'square', 0.12); tone(1319, t + 0.07, 0.14, 'square', 0.12); break;
        case 'jump': tone(300, t, 0.22, 'triangle', 0.3, null, 700); break;
        case 'slide': noise(t, 0.3, 0.35, 900); break;
        case 'lane': tone(520, t, 0.06, 'sine', 0.15, null, 640); break;
        case 'hit': tone(160, t, 0.35, 'sawtooth', 0.3, null, 60); noise(t, 0.25, 0.5, 400); break;
        case 'correct': [0, 4, 7, 12].forEach((n, i) => tone(semi(523.25, n), t + i * 0.08, 0.3, 'triangle', 0.25)); break;
        case 'wrong': tone(330, t, 0.25, 'triangle', 0.25, null, 220); tone(262, t + 0.2, 0.35, 'triangle', 0.22, null, 180); break;
        case 'gate': tone(392, t, 0.6, 'sine', 0.2, null, 784); break;
        case 'level': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(semi(392, n), t + i * 0.09, 0.4, 'triangle', 0.22)); break;
        case 'click': tone(700, t, 0.05, 'sine', 0.12); break;
        case 'badge': [12, 16, 19, 24].forEach((n, i) => tone(semi(523.25, n), t + i * 0.12, 0.5, 'sine', 0.2)); break;
      }
    }
  };
})();
