/* =========================================================
   YohannOS — Studio musique : piano synthétiseur +
   boîte à rythmes 16 pas + visualiseur (Web Audio)
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;
  const NOTE_NAMES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const WHITE_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'];
  const BLACK_CODES = { 1: 'KeyW', 3: 'KeyE', 6: 'KeyT', 8: 'KeyY', 10: 'KeyU', 13: 'KeyO', 15: 'KeyP' };
  const TRACKS = [
    ['kick', 'Grosse caisse', '#ff6b6b'], ['snare', 'Caisse claire', '#ffa94d'], ['hihat', 'Charleston', '#ffd43b'], ['clap', 'Clap', '#69db7c'],
    ['bass', 'Basse (Do)', '#4dabf7'], ['lead1', 'Synthé Sol', '#9775fa'], ['lead2', 'Synthé Do', '#da77f2'], ['lead3', 'Synthé Mi', '#f783ac']
  ];
  const LEAD_MIDI = { bass: 36, lead1: 67, lead2: 72, lead3: 76 };

  function launch(args) {
    const ctx = Y.sound.context();
    if (!ctx) { Y.dialog.alert('Web Audio n\'est pas disponible dans ce navigateur.', { icon: 'err' }); return null; }

    /* ---------- Graphe audio ---------- */
    const master = ctx.createGain(); master.gain.value = 0.7;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.3;
    const feedback = ctx.createGain(); feedback.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.2;
    master.connect(analyser);
    master.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(analyser);
    analyser.connect(ctx.destination);
    let noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

    const P = { wave: 'sawtooth', attack: 0.01, release: 0.35, cutoff: 3000, octave: 4 };
    const active = new Map();

    function voice(midi, t = ctx.currentTime, dur = null, vel = 0.35) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = o2.type = P.wave;
      o.frequency.value = freq(midi); o2.frequency.value = freq(midi); o2.detune.value = 8;
      f.type = 'lowpass'; f.frequency.value = P.cutoff; f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + Math.max(0.005, P.attack));
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
      o.start(t); o2.start(t);
      const v = { o, o2, g, stop(at = ctx.currentTime) {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + P.release);
        o.stop(at + P.release + 0.05); o2.stop(at + P.release + 0.05);
      } };
      if (dur) v.stop(t + dur);
      return v;
    }
    function noise(t, dur, type, fq, vol) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.02);
    }
    const DRUMS = {
      kick(t) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
        g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.5);
      },
      snare(t) {
        noise(t, 0.2, 'highpass', 1200, 0.5);
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 190;
        g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
      },
      hihat(t) { noise(t, 0.05, 'highpass', 7500, 0.3); },
      clap(t) { [0, 0.012, 0.024].forEach(d => noise(t + d, 0.09, 'bandpass', 1400, 0.5)); }
    };
    function playTrack(id, t) {
      if (DRUMS[id]) DRUMS[id](t);
      else voice(LEAD_MIDI[id], t, id === 'bass' ? 0.18 : 0.12, id === 'bass' ? 0.45 : 0.22);
    }

    /* ---------- Séquenceur ---------- */
    let pattern = {}; TRACKS.forEach(([id]) => { pattern[id] = Array(16).fill(0); });
    let bpm = 110, playing = false, step = 0, nextTime = 0, schedT = 0, path = null;
    const queue = [];
    function scheduler() {
      while (nextTime < ctx.currentTime + 0.12) {
        TRACKS.forEach(([id]) => { if (pattern[id][step]) playTrack(id, nextTime); });
        queue.push({ step, time: nextTime });
        nextTime += 60 / bpm / 4;
        step = (step + 1) % 16;
      }
    }
    function play() {
      if (playing) return stop();
      if (ctx.state === 'suspended') ctx.resume();
      playing = true; step = 0; nextTime = ctx.currentTime + 0.05;
      schedT = setInterval(scheduler, 25);
      playBtn.innerHTML = Y.icons.svg('stop', 14) + ' Stop';
      playBtn.classList.add('danger'); playBtn.classList.remove('primary');
    }
    function stop() {
      playing = false; clearInterval(schedT); queue.length = 0;
      playBtn.innerHTML = Y.icons.svg('play', 13) + ' Lecture';
      playBtn.classList.remove('danger'); playBtn.classList.add('primary');
      grid.querySelectorAll('.sq-cell.now').forEach(c => c.classList.remove('now'));
    }

    /* ---------- Interface ---------- */
    const scope = el('canvas.sy-scope');
    const playBtn = el('button.btn.primary', { onclick: () => play() });
    const bpmIn = el('input.range', { type: 'range', min: 60, max: 180, value: bpm });
    const bpmLbl = el('span.sy-val', bpm + ' BPM');
    bpmIn.oninput = () => { bpm = +bpmIn.value; bpmLbl.textContent = bpm + ' BPM'; };
    const volIn = el('input.range', { type: 'range', min: 0, max: 100, value: 70 });
    volIn.oninput = () => { master.gain.value = volIn.value / 100; };
    const tb = (icon, label, fn) => el('button.btn.sm', { html: Y.icons.svg(icon, 14) + (label ? ' ' + label : ''), onclick: fn });
    const grid = el('div.sq-grid');
    TRACKS.forEach(([id, name, col]) => {
      const row = el('div.sq-row');
      row.appendChild(el('button.sq-name', { style: { '--c': col }, title: 'Écouter', onclick: () => playTrack(id, ctx.currentTime) }, name));
      for (let s = 0; s < 16; s++) {
        const cell = el('button.sq-cell', { style: { '--c': col }, dataset: { t: id, s } });
        if (s % 4 === 0) cell.classList.add('beat');
        cell.addEventListener('pointerdown', e => {
          e.preventDefault();
          const on = !pattern[id][s];
          paint(id, s, on);
          const over = ev => { const c = ev.target.closest && ev.target.closest('.sq-cell'); if (c && c.dataset.t === id) paint(id, +c.dataset.s, on); };
          const upH = () => { grid.removeEventListener('pointerover', over); window.removeEventListener('pointerup', upH); };
          grid.addEventListener('pointerover', over);
          window.addEventListener('pointerup', upH);
        });
        row.appendChild(cell);
      }
      grid.appendChild(row);
    });
    function paint(id, s, on) {
      if (pattern[id][s] === (on ? 1 : 0)) return;
      pattern[id][s] = on ? 1 : 0;
      grid.querySelector(`.sq-cell[data-t="${id}"][data-s="${s}"]`).classList.toggle('on', on);
      if (on && !playing) playTrack(id, ctx.currentTime);
      dirtyMark();
    }
    function renderGrid() { grid.querySelectorAll('.sq-cell').forEach(c => c.classList.toggle('on', !!pattern[c.dataset.t][+c.dataset.s])); }
    function dirtyMark() { win.setTitle(`${path ? FS.basename(path) : 'Nouveau rythme'} — Studio musique`); }

    const waveSel = el('select.select', ...['sine', 'square', 'sawtooth', 'triangle'].map(w => el('option', { value: w }, { sine: 'Sinus', square: 'Carré', sawtooth: 'Dent de scie', triangle: 'Triangle' }[w])));
    waveSel.value = P.wave; waveSel.onchange = () => { P.wave = waveSel.value; };
    const slider = (label, min, max, val, step, fn, fmt) => {
      const i = el('input.range', { type: 'range', min, max, value: val, step });
      const v = el('span.sy-val', fmt(val));
      i.oninput = () => { fn(+i.value); v.textContent = fmt(+i.value); };
      return el('label.sy-knob', el('span', label), i, v);
    };
    const octLbl = el('span.sy-val', 'Octave ' + P.octave);
    const keyboard = el('div.sy-keys');
    const content = el('div.sy',
      el('div.sy-head', scope, el('div.sy-transport', playBtn, el('label.sy-knob', el('span', 'Tempo'), bpmIn, bpmLbl), el('label.sy-knob', el('span', 'Volume'), volIn))),
      el('div.toolbar',
        tb('trash', 'Effacer', () => { TRACKS.forEach(([id]) => pattern[id].fill(0)); renderGrid(); }),
        tb('dice', 'Aléatoire', () => randomize()),
        tb('folderOpen', 'Ouvrir', () => openSeq()),
        tb('save', 'Enregistrer', () => saveSeq()),
        el('span.grow'), el('span.dim', { style: { fontSize: '12px' } }, 'Barre d\'espace : lecture / stop')),
      el('div.sq-wrap', grid),
      el('div.sy-synth',
        el('label.sy-knob', el('span', 'Onde'), waveSel),
        slider('Attaque', 0, 1, P.attack, 0.01, v => { P.attack = v; }, v => v.toFixed(2) + ' s'),
        slider('Relâche', 0.05, 2, P.release, 0.05, v => { P.release = v; }, v => v.toFixed(2) + ' s'),
        slider('Filtre', 200, 8000, P.cutoff, 100, v => { P.cutoff = v; }, v => Math.round(v) + ' Hz'),
        slider('Écho', 0, 0.8, 0.2, 0.05, v => { wet.gain.value = v; }, v => Math.round(v * 100) + ' %'),
        el('div.sy-oct', el('button.btn.sm.icon', { html: Y.icons.svg('chevronLeft', 14), onclick: () => setOct(-1) }), octLbl, el('button.btn.sm.icon', { html: Y.icons.svg('chevronRight', 14), onclick: () => setOct(1) }))),
      keyboard);
    const win = Y.apps.window('synth', { content, width: 900, height: 660, minWidth: 560, minHeight: 500 });

    /* Clavier de piano (2 octaves) */
    let labels = {};
    function buildKeys() {
      keyboard.innerHTML = '';
      const whites = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];
      whites.forEach((semi, i) => {
        const k = el('div.sy-white', { dataset: { semi } }, el('span.sy-klabel', (labels[WHITE_CODES[i]] || WHITE_CODES[i].replace('Key', '').replace('Semicolon', ';').replace('Quote', "'")).toUpperCase()), el('span.sy-note', NOTE_NAMES[semi % 12] + (P.octave + Math.floor(semi / 12))));
        keyboard.appendChild(k);
      });
      Object.entries(BLACK_CODES).forEach(([semi, code]) => {
        semi = +semi;
        const whiteIndex = whites.filter(w => w < semi).length;
        const k = el('div.sy-black', { dataset: { semi }, style: { left: `calc(${whiteIndex} * (100% / ${whites.length}) - (100% / ${whites.length}) * 0.3)` } }, el('span.sy-klabel', (labels[code] || code.replace('Key', '')).toUpperCase()));
        keyboard.appendChild(k);
      });
    }
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { labels = {}; m.forEach((v, k) => { labels[k] = v; }); buildKeys(); }).catch(() => {});
    function noteOn(semi) {
      if (active.has(semi)) return;
      if (ctx.state === 'suspended') ctx.resume();
      active.set(semi, voice((P.octave + 1) * 12 + semi));
      const k = keyboard.querySelector(`[data-semi="${semi}"]`); k && k.classList.add('down');
    }
    function noteOff(semi) {
      const v = active.get(semi);
      if (v) { v.stop(); active.delete(semi); }
      const k = keyboard.querySelector(`[data-semi="${semi}"]`); k && k.classList.remove('down');
    }
    function setOct(d) { allOff(); P.octave = U.clamp(P.octave + d, 1, 7); octLbl.textContent = 'Octave ' + P.octave; buildKeys(); }
    function allOff() { Array.from(active.keys()).forEach(noteOff); }
    keyboard.addEventListener('pointerdown', e => {
      const k = e.target.closest('[data-semi]');
      if (!k) return;
      e.preventDefault();
      keyboard.setPointerCapture(e.pointerId);
      let cur = +k.dataset.semi;
      noteOn(cur);
      const move = ev => {
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const kk = t && t.closest && t.closest('[data-semi]');
        if (kk && +kk.dataset.semi !== cur) { noteOff(cur); cur = +kk.dataset.semi; noteOn(cur); }
      };
      const up = () => { noteOff(cur); keyboard.removeEventListener('pointermove', move); keyboard.removeEventListener('pointerup', up); keyboard.removeEventListener('pointercancel', up); };
      keyboard.addEventListener('pointermove', move);
      keyboard.addEventListener('pointerup', up);
      keyboard.addEventListener('pointercancel', up);
    });
    const codeToSemi = code => { const wi = WHITE_CODES.indexOf(code); if (wi >= 0) return [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17][wi]; const b = Object.entries(BLACK_CODES).find(([, c]) => c === code); return b ? +b[0] : null; };
    win.el.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); play(); return; }
      if (e.code === 'KeyZ') { setOct(-1); return; }
      if (e.code === 'KeyX') { setOct(1); return; }
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      const s = codeToSemi(e.code);
      if (s != null) { e.preventDefault(); noteOn(s); }
    });
    win.el.addEventListener('keyup', e => { const s = codeToSemi(e.code); if (s != null) noteOff(s); });
    win.on('blur', allOff);

    /* Fichiers */
    function randomize() {
      const prob = { kick: 0.3, snare: 0.15, hihat: 0.55, clap: 0.08, bass: 0.25, lead1: 0.1, lead2: 0.1, lead3: 0.1 };
      TRACKS.forEach(([id]) => { pattern[id] = pattern[id].map((_, s) => +(Math.random() < prob[id] || (id === 'kick' && s % 8 === 0) || (id === 'snare' && s % 8 === 4))); });
      renderGrid();
    }
    function loadSeq(p) {
      try {
        const d = JSON.parse(FS.readFile(p));
        if (d.format !== 'yos-seq') throw new Error('Format inconnu');
        TRACKS.forEach(([id]) => { pattern[id] = (d.tracks[id] || []).concat(Array(16).fill(0)).slice(0, 16).map(Number); });
        bpm = d.bpm || 110; bpmIn.value = bpm; bpmLbl.textContent = bpm + ' BPM';
        path = FS.normalize(p);
        renderGrid(); dirtyMark();
        Y.recent.add(path);
      } catch (e) { Y.dialog.alert('Fichier de rythme invalide : ' + e.message, { icon: 'err', parent: win }); }
    }
    async function openSeq() { const p = await Y.dialog.openFile({ dir: FS.HOME + '/Musique', exts: ['seq'], parent: win }); if (p) loadSeq(p); }
    async function saveSeq() {
      const p = await Y.dialog.saveFile({ dir: FS.HOME + '/Musique', name: path ? FS.basename(path) : 'Mon rythme.seq', ext: 'seq', parent: win });
      if (!p) return;
      FS.writeFile(p, JSON.stringify({ format: 'yos-seq', bpm, steps: 16, tracks: pattern }, null, 1));
      path = FS.normalize(p); dirtyMark();
      Y.notify({ title: 'Rythme enregistré', body: FS.pretty(path), app: 'synth' });
    }

    /* Visualiseur + indicateur de pas */
    const sctx = scope.getContext('2d');
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0, lastStep = -1;
    function draw() {
      raf = requestAnimationFrame(draw);
      const w = scope.clientWidth, h = scope.clientHeight;
      if (scope.width !== w * 2) { scope.width = w * 2; scope.height = h * 2; }
      sctx.setTransform(2, 0, 0, 2, 0, 0);
      sctx.clearRect(0, 0, w, h);
      analyser.getByteTimeDomainData(data);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6cff';
      sctx.lineWidth = 2; sctx.strokeStyle = accent; sctx.shadowColor = accent; sctx.shadowBlur = 8;
      sctx.beginPath();
      for (let i = 0; i < data.length; i++) { const x = i / data.length * w, y = data[i] / 255 * h; i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); }
      sctx.stroke();
      while (queue.length && queue[0].time <= ctx.currentTime) {
        const q = queue.shift();
        if (q.step !== lastStep) {
          grid.querySelectorAll('.sq-cell.now').forEach(c => c.classList.remove('now'));
          grid.querySelectorAll(`.sq-cell[data-s="${q.step}"]`).forEach(c => c.classList.add('now'));
          lastStep = q.step;
        }
      }
    }
    draw();
    win.on('close', () => { stop(); allOff(); cancelAnimationFrame(raf); setTimeout(() => { try { analyser.disconnect(); } catch (e) { /* ignore */ } }, 1000); });

    stop(); buildKeys();
    if (args.path) loadSeq(args.path);
    else if (FS.exists(FS.HOME + '/Musique/Rythme démo.seq')) loadSeq(FS.HOME + '/Musique/Rythme démo.seq');
    else dirtyMark();
    return win;
  }

  Y.apps.register({
    id: 'synth', name: 'Studio musique', icon: 'piano', color: ['#f953c6', '#b91d73'], category: 'Multimédia',
    description: 'Piano synthétiseur et boîte à rythmes', keywords: 'musique piano synthe beat drum son audio',
    exts: ['seq'], extPriority: { seq: 10 }, single: true, launch
  });
})(window.YOS);
