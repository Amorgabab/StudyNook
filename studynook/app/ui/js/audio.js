/* ============================================================
   StudyNook · audio.js — ambience + UI sounds
   Ambience prefers REAL recordings: if the app folder contains
   assets/sounds/<name>.mp3 (rain / waves / fire / cafe) it loops
   them gaplessly through WebAudio. Otherwise it falls back to
   synthesized noise beds. One-shots (clicks, bells) are synthetic.
   ============================================================ */
'use strict';
window.Audio2 = (function () {
  let ctx = null, master = null, amb = null, volume = 0.6;
  let crackleTimer = null, ambToken = 0;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(volume, ac().currentTime, 0.1);
  }

  function noiseBuffer(kind) {
    const c = ac();
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { last = 0.95 * last + 0.05 * white; d[i] = last * 2.2 + white * 0.35; }
      else d[i] = white;
    }
    return buf;
  }
  function src(buf, loop = true) { const s = ac().createBufferSource(); s.buffer = buf; s.loop = loop; return s; }
  function filter(type, freq, q) { const f = ac().createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }
  function gain(v) { const g = ac().createGain(); g.gain.value = v; return g; }
  function lfo(freq, depth, target) {
    const o = ac().createOscillator(); o.frequency.value = freq;
    const g = gain(depth);
    o.connect(g); g.connect(target); o.start();
    return o;
  }

  function stopAmbience() {
    ambToken++;
    if (crackleTimer) { clearInterval(crackleTimer); crackleTimer = null; }
    if (amb) {
      try { amb.out.gain.setTargetAtTime(0, ac().currentTime, 0.4); } catch (e) {}
      const old = amb;
      setTimeout(() => { try { old.nodes.forEach((n) => n.stop && n.stop()); old.osc && old.osc.forEach((o) => o.stop()); } catch (e) {} }, 1200);
      amb = null;
    }
  }

  /* ---------- synthesized fallback beds ---------- */
  function synth(name, out, nodes, osc) {
    if (name === 'rain') {
      const s = src(noiseBuffer('white'));
      const hp = filter('highpass', 500), lp = filter('lowpass', 6500);
      const g = gain(0.32);
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      osc.push(lfo(0.13, 0.07, g.gain));
      s.start(); nodes.push(s);
      return true;
    }
    if (name === 'fire') {
      const s = src(noiseBuffer('brown'));
      const lp = filter('lowpass', 750);
      const g = gain(0.5);
      s.connect(lp); lp.connect(g); g.connect(out);
      s.start(); nodes.push(s);
      crackleTimer = setInterval(() => {
        if (!amb) return;
        const t = ac().currentTime;
        const burst = src(noiseBuffer('white'), false);
        const bp = filter('bandpass', 1500 + Math.random() * 1800, 2.5);
        const gg = gain(0.0); gg.gain.setValueAtTime(0.12 + Math.random() * 0.1, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08 + Math.random() * 0.08);
        burst.connect(bp); bp.connect(gg); gg.connect(out);
        burst.start(t); burst.stop(t + 0.25);
      }, 260);
      return true;
    }
    if (name === 'waves') {
      const s = src(noiseBuffer('brown'));
      const lp = filter('lowpass', 900);
      const g = gain(0.18);
      s.connect(lp); lp.connect(g); g.connect(out);
      osc.push(lfo(0.07, 0.16, g.gain));
      osc.push(lfo(0.031, 0.1, g.gain));
      s.start(); nodes.push(s);
      return true;
    }
    if (name === 'cafe') {
      const s = src(noiseBuffer('pink'));
      const lp = filter('lowpass', 1100);
      const g = gain(0.3);
      s.connect(lp); lp.connect(g); g.connect(out);
      osc.push(lfo(0.21, 0.05, g.gain));
      s.start(); nodes.push(s);
      return true;
    }
    return false;
  }

  /* ---------- start: real file first, synth fallback ---------- */
  async function startAmbience(name) {
    stopAmbience();
    if (!name || name === 'off') return false;
    const my = ++ambToken;
    const nodes = [], osc = [];
    const out = gain(0);
    out.connect(master);

    let started = false;
    try {
      const r = await nook.invoke('sound:get', { id: name });
      if (my !== ambToken) return false;
      if (r && r.ok && r.base64) {
        const bin = atob(r.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const audioBuf = await ac().decodeAudioData(bytes.buffer);
        if (my !== ambToken) return false;
        const s = ac().createBufferSource();
        s.buffer = audioBuf; s.loop = true;      // gapless loop
        const g = gain(0.9);
        s.connect(g); g.connect(out);
        s.start(); nodes.push(s);
        started = true;
      }
    } catch (e) { /* no file or decode error → synth */ }
    if (my !== ambToken) return false;
    if (!started) started = synth(name, out, nodes, osc);
    if (!started) return false;
    out.gain.setTargetAtTime(0.9, ac().currentTime, 1.2);
    amb = { name, out, nodes, osc };
    return true;
  }

  /* ---------- one-shot sounds ---------- */
  function tone(freq, t0, dur, type = 'sine', vol = 0.16, attack = 0.015) {
    const c = ac();
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function bell(freq, t0, dur, vol) {
    tone(freq, t0, dur, 'sine', vol, 0.01);
    tone(freq * 2.756, t0, dur * 0.4, 'sine', vol * 0.22, 0.005);
    tone(freq * 5.4, t0, dur * 0.18, 'sine', vol * 0.08, 0.005);
  }
  function click() { if (!enabled.ui) return; tone(1500, ac().currentTime, 0.035, 'sine', 0.028, 0.002); }
  function chime() {
    if (!enabled.chimes) return;
    const t = ac().currentTime;
    bell(523.25, t, 1.5, 0.11);
    bell(659.25, t + 0.18, 1.5, 0.11);
    bell(783.99, t + 0.36, 1.7, 0.11);
    bell(1046.5, t + 0.6, 2.0, 0.08);
  }
  function chimeSoft() {
    if (!enabled.chimes) return;
    const t = ac().currentTime;
    bell(659.25, t, 1.2, 0.09);
    bell(880, t + 0.22, 1.4, 0.08);
  }
  function begin() {
    if (!enabled.chimes) return;
    const t = ac().currentTime;
    bell(392, t, 0.9, 0.08);
    bell(523.25, t + 0.16, 1.2, 0.09);
  }
  function pop() {
    if (!enabled.ui) return;
    const t = ac().currentTime;
    tone(587.33, t, 0.1, 'triangle', 0.1, 0.004);
    tone(880, t + 0.07, 0.14, 'triangle', 0.08, 0.004);
  }
  function purr() {
    if (!enabled.ui) return;
    const c = ac(); const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    const l = c.createOscillator(); l.frequency.value = 24;
    const lg = c.createGain(); lg.gain.value = 0.03;
    l.connect(lg); lg.connect(g.gain);
    g.gain.setTargetAtTime(0.045, t, 0.05);
    g.gain.setTargetAtTime(0.0001, t + 0.5, 0.15);
    const lp = filter('lowpass', 300);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.9); l.start(t); l.stop(t + 0.9);
  }

  const enabled = { ui: true, chimes: true };
  function setEnabled(u) { enabled.ui = !!u.ui; enabled.chimes = !!u.chimes; }

  return { startAmbience, stopAmbience, setVolume, click, chime, chimeSoft, begin, pop, purr, setEnabled, resume: ac };
})();
