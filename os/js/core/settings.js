/* =========================================================
   YohannOS — réglages, thèmes et fonds d'écran
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U;

  const DEFAULTS = {
    theme: 'dark',            // dark | light | auto
    accent: '#7c6cff',
    wallpaper: 'aurora',
    customWallpaper: null,    // URL ou data:
    transparency: true,
    animations: true,
    sound: true,
    volume: 0.6,
    dnd: false,               // ne pas déranger
    username: 'Yohann',
    password: '',
    fastBoot: false,
    screensaver: 'matrix',    // matrix | stars | none
    screensaverDelay: 5,      // minutes
    clockSeconds: false,
    pinned: ['explorer', 'terminal', 'browser', 'notepad', 'codestudio', 'paint', 'settings'],
    weatherCity: null,
    iconPositions: {}
  };

  const ACCENTS = ['#7c6cff', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7'];

  const WALLPAPERS = [
    { id: 'aurora', name: 'Aurore', css: 'radial-gradient(at 18% 22%, #4f46e5 0, transparent 50%), radial-gradient(at 82% 8%, #db2777 0, transparent 45%), radial-gradient(at 85% 85%, #0891b2 0, transparent 50%), radial-gradient(at 5% 95%, #7c3aed 0, transparent 50%), #0b1022' },
    { id: 'constellation', name: 'Constellation', css: 'radial-gradient(ellipse at 50% 120%, #1e3a8a 0, transparent 60%), linear-gradient(180deg, #050816, #0b1230)', live: 'constellation' },
    { id: 'retro', name: 'Rétro', css: '#120428', html: '<div class="wp-retro"><div class="stars"></div><div class="sun"></div><div class="grid"></div></div>' },
    { id: 'ocean', name: 'Océan', css: 'radial-gradient(at 70% 20%, rgba(56,189,248,.35) 0, transparent 50%), radial-gradient(at 20% 80%, rgba(16,185,129,.25) 0, transparent 50%), linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
    { id: 'sunset', name: 'Crépuscule', css: 'radial-gradient(circle at 50% 115%, #ffb35c 0, #ff5f6d 22%, transparent 58%), linear-gradient(180deg, #120c35 0%, #43216e 50%, #b83b7a 100%)' },
    { id: 'forest', name: 'Forêt', css: 'radial-gradient(at 30% 25%, #2d6a4f 0, transparent 55%), radial-gradient(at 75% 80%, #52b788 0, transparent 45%), linear-gradient(135deg, #081c15, #1b4332)' },
    { id: 'neon', name: 'Néon', css: 'radial-gradient(at 0% 0%, #ff0080 0, transparent 42%), radial-gradient(at 100% 100%, #7928ca 0, transparent 52%), radial-gradient(at 100% 0%, #00dfd8 0, transparent 40%), #0b0b12' },
    { id: 'galaxy', name: 'Galaxie', css: 'radial-gradient(1px 1px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 82% 32%, #fff, transparent), radial-gradient(1.5px 1.5px at 42% 72%, #fff, transparent), radial-gradient(1px 1px at 66% 12%, #fff, transparent), radial-gradient(1px 1px at 22% 82%, #fff, transparent), radial-gradient(1.2px 1.2px at 92% 76%, #fff, transparent), radial-gradient(ellipse at 60% 45%, rgba(168,85,247,.55) 0, transparent 45%), radial-gradient(ellipse at 35% 55%, rgba(59,130,246,.45) 0, transparent 40%), #05030f' },
    { id: 'slate', name: 'Ardoise', css: 'linear-gradient(135deg, #232526, #414345)' },
    { id: 'pastel', name: 'Pastel', css: 'radial-gradient(at 20% 20%, #ffd1e8 0, transparent 50%), radial-gradient(at 80% 30%, #c7d2fe 0, transparent 50%), radial-gradient(at 50% 90%, #a7f3d0 0, transparent 55%), #f1f0ff' },
    { id: 'dune', name: 'Dunes', css: 'radial-gradient(ellipse at 30% 110%, #c2410c 0, transparent 50%), radial-gradient(ellipse at 80% 105%, #ea580c 0, transparent 45%), linear-gradient(180deg, #fde68a 0%, #fb923c 55%, #9a3412 100%)' },
    { id: 'mint', name: 'Menthe', css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }
  ];

  let data = {};

  const settings = {
    DEFAULTS, ACCENTS, WALLPAPERS,
    init() {
      data = Object.assign({}, DEFAULTS, U.store.get('settings', {}));
      settings.apply();
      matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => data.theme === 'auto' && settings.apply());
    },
    get(k) { return k in data ? data[k] : DEFAULTS[k]; },
    set(k, v) {
      data[k] = v;
      U.store.set('settings', data);
      if (['theme', 'accent', 'transparency', 'animations', 'wallpaper', 'customWallpaper'].includes(k)) settings.apply();
      Y.bus.emit('settings:change', k, v);
    },
    all: () => Object.assign({}, data),
    reset() { data = Object.assign({}, DEFAULTS); U.store.set('settings', data); settings.apply(); Y.bus.emit('settings:change', '*'); },

    effectiveTheme() {
      if (data.theme === 'auto') return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      return data.theme;
    },

    apply() {
      const html = document.documentElement;
      html.dataset.theme = settings.effectiveTheme();
      const rgb = hexToRgb(data.accent) || [124, 108, 255];
      html.style.setProperty('--accent', data.accent);
      html.style.setProperty('--accent-rgb', rgb.join(', '));
      const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
      html.style.setProperty('--accent-fg', lum > 0.68 ? '#111' : '#fff');
      html.classList.toggle('no-blur', !data.transparency);
      html.classList.toggle('no-anim', !data.animations);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = html.dataset.theme === 'light' ? '#e9ecf5' : '#0f1020';
      wallpaper.apply();
    }
  };

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  settings.hexToRgb = hexToRgb;

  /* ---------- Fonds d'écran ---------- */
  const wallpaper = {
    current: null,
    css(id) {
      if (id === 'custom' && data.customWallpaper) return `url("${data.customWallpaper}") center / cover no-repeat, #000`;
      const w = WALLPAPERS.find(x => x.id === id) || WALLPAPERS[0];
      return w.css;
    },
    apply() {
      const el = document.getElementById('wallpaper');
      if (!el) return;
      const id = data.wallpaper;
      if (wallpaper.current === id + '|' + (id === 'custom' ? data.customWallpaper : '')) return;
      wallpaper.current = id + '|' + (id === 'custom' ? data.customWallpaper : '');
      const w = WALLPAPERS.find(x => x.id === id);
      el.style.background = wallpaper.css(id);
      el.innerHTML = (w && w.html) || '';
      live.stop();
      if (w && w.live) live.start(w.live);
      Y.bus.emit('wallpaper:change', id);
    },
    next() {
      const i = WALLPAPERS.findIndex(w => w.id === data.wallpaper);
      settings.set('wallpaper', WALLPAPERS[(i + 1) % WALLPAPERS.length].id);
    }
  };

  /* Fond d'écran animé : constellation de particules */
  const live = {
    raf: 0, running: false,
    start(kind) {
      const c = document.getElementById('wallpaper-canvas');
      if (!c) return;
      c.classList.add('on');
      const ctx = c.getContext('2d');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let W, H, pts = [];
      const mouse = { x: -999, y: -999 };
      const resize = () => {
        W = c.clientWidth; H = c.clientHeight;
        c.width = W * dpr; c.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.round(Math.min(130, (W * H) / 11000));
        pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.6 + .6 }));
      };
      resize();
      live.onResize = resize;
      live.onMouse = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', live.onMouse);
      live.running = true;
      const accent = () => hexToRgb(data.accent) || [124, 108, 255];
      const tick = () => {
        if (!live.running) return;
        live.raf = requestAnimationFrame(tick);
        if (document.hidden) return;
        ctx.clearRect(0, 0, W, H);
        const [r, g, b] = accent();
        for (const p of pts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
          const dxm = p.x - mouse.x, dym = p.y - mouse.y, dm = dxm * dxm + dym * dym;
          if (dm < 14000) { p.x += dxm * 0.01; p.y += dym * 0.01; }
        }
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          for (let j = i + 1; j < pts.length; j++) {
            const q = pts[j], dx = a.x - q.x, dy = a.y - q.y, d = dx * dx + dy * dy;
            if (d < 15000) {
              ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d / 15000) * 0.45})`;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            }
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      };
      tick();
    },
    stop() {
      live.running = false;
      cancelAnimationFrame(live.raf);
      const c = document.getElementById('wallpaper-canvas');
      if (c) { c.classList.remove('on'); c.getContext('2d').clearRect(0, 0, c.width, c.height); }
      if (live.onResize) window.removeEventListener('resize', live.onResize);
      if (live.onMouse) window.removeEventListener('pointermove', live.onMouse);
    }
  };

  Y.settings = settings;
  Y.wallpaper = wallpaper;
})(window.YOS);
