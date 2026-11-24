/* =========================================================
   YohannOS — sons système synthétisés (Web Audio)
   ========================================================= */
(function (Y) {
  'use strict';
  let ctx = null, master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.value = Y.settings.get('volume');
    return ctx;
  }

  function tone(freq, start, dur, { type = 'sine', gain = 0.15, slide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  const SOUNDS = {
    click: t => tone(1200, t, 0.04, { type: 'triangle', gain: 0.05 }),
    open: t => { tone(520, t, 0.12, { gain: 0.07 }); tone(780, t + 0.05, 0.14, { gain: 0.06 }); },
    close: t => { tone(700, t, 0.1, { gain: 0.06 }); tone(460, t + 0.05, 0.12, { gain: 0.05 }); },
    minimize: t => tone(600, t, 0.15, { gain: 0.05, slide: 0.5 }),
    notify: t => { tone(880, t, 0.18, { gain: 0.08 }); tone(1320, t + 0.09, 0.25, { gain: 0.07 }); },
    error: t => { tone(220, t, 0.18, { type: 'square', gain: 0.05 }); tone(180, t + 0.12, 0.22, { type: 'square', gain: 0.05 }); },
    trash: t => tone(300, t, 0.2, { type: 'sawtooth', gain: 0.04, slide: 0.4 }),
    startup: t => {
      [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => tone(f, t + i * 0.11, 1.4 - i * 0.12, { gain: 0.07 }));
      tone(130.8, t, 1.8, { type: 'triangle', gain: 0.06 });
    },
    shutdown: t => [659.3, 523.3, 392, 261.6].forEach((f, i) => tone(f, t + i * 0.13, 0.9, { gain: 0.07 })),
    login: t => { tone(587, t, 0.25, { gain: 0.07 }); tone(880, t + 0.12, 0.4, { gain: 0.07 }); },
    pop: t => tone(400, t, 0.08, { gain: 0.08, slide: 2.2 }),
    success: t => { tone(660, t, 0.12, { gain: 0.07 }); tone(990, t + 0.1, 0.2, { gain: 0.07 }); },
    alarm: t => { for (let i = 0; i < 6; i++) tone(i % 2 ? 880 : 1046, t + i * 0.18, 0.16, { type: 'square', gain: 0.05 }); }
  };

  Y.sound = {
    play(name) {
      if (!Y.settings.get('sound')) return;
      try {
        if (!ensure()) return;
        (SOUNDS[name] || SOUNDS.click)(ctx.currentTime + 0.01);
      } catch (e) { /* audio indisponible */ }
    },
    context: () => ensure(),
    setVolume(v) { if (master) master.gain.value = v; }
  };

  Y.bus.on('settings:change', k => { if (k === 'volume' && master) master.gain.value = Y.settings.get('volume'); });
})(window.YOS);
