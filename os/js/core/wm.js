/* =========================================================
   YohannOS — gestionnaire de fenêtres
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el, clamp } = U;

  const wins = new Map();
  let order = [];          // ordre de focus (le plus récent à la fin)
  let focused = null;
  let z = 100;
  let cascadeIndex = 0;
  let container, preview;
  let hiddenByShowDesktop = [];

  const bounds = () => ({ w: container.clientWidth, h: container.clientHeight });

  class Win {
    constructor(o) {
      this.id = o.id || U.uid('w');
      this.app = o.app || null;
      this.o = o;
      this.handlers = {};
      this.maximized = false;
      this.minimized = false;
      this.snapped = null;
      this.restoreRect = null;
      this.ontop = false;
      this.parent = o.parent || null;
      this.children = new Set();
      this.modalChild = null;
      this.closed = false;
      this.createdAt = Date.now();
      this.build();
    }

    build() {
      const o = this.o;
      const iconHtml = o.iconHtml || (o.icon ? Y.icons.tile(o.icon, o.color, 20) : '');
      this.el = el('div.win', { tabindex: '-1', role: 'dialog', 'aria-label': o.title || '', class: o.className || null });
      this.el.dataset.id = this.id;
      if (this.app) this.el.dataset.app = this.app;
      this.titleEl = el('div.win-title', o.title || 'Fenêtre');
      const ctr = el('div.win-controls');
      if (o.minimizable !== false) {
        this.btnMin = ctr.appendChild(el('button.min', { title: 'Réduire', html: Y.icons.svg('minus', 15), onclick: e => { e.stopPropagation(); this.minimize(); } }));
      }
      if (o.maximizable !== false && o.resizable !== false) {
        this.btnMax = ctr.appendChild(el('button.max', { title: 'Agrandir', html: Y.icons.svg('square', 13), onclick: e => { e.stopPropagation(); this.toggleMaximize(); } }));
      }
      ctr.appendChild(el('button.close', { title: 'Fermer', html: Y.icons.svg('x', 16), onclick: e => { e.stopPropagation(); this.close(); } }));
      const iconEl = el('div.win-icon', { html: iconHtml });
      this.titlebar = el('div.win-titlebar', iconEl, this.titleEl, ctr);
      this.body = el('div.win-body', { class: o.bodyClass || null });
      this.el.append(this.titlebar, this.body);
      if (o.resizable !== false) {
        for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
          const h = el('div.win-rz.' + d);
          h.addEventListener('pointerdown', e => this.startResize(e, d));
          this.el.appendChild(h);
        }
      } else this.el.classList.add('no-resize');

      if (o.content) {
        if (typeof o.content === 'string') this.body.innerHTML = o.content;
        else this.body.appendChild(o.content);
      }

      this.el.addEventListener('pointerdown', () => this.focus(), true);
      this.titlebar.addEventListener('pointerdown', e => this.startMove(e));
      this.titlebar.addEventListener('dblclick', e => {
        if (e.target.closest('.win-controls')) return;
        if (o.resizable !== false && o.maximizable !== false) this.toggleMaximize();
      });
      this.titlebar.addEventListener('contextmenu', e => { e.preventDefault(); this.showMenu(e.clientX, e.clientY); });
      iconEl.addEventListener('click', () => { const r = iconEl.getBoundingClientRect(); this.showMenu(r.left, r.bottom + 4); });

      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(U.throttle(() => !this.closed && this.emit('resize', this.body.clientWidth, this.body.clientHeight), 50));
        this.ro.observe(this.body);
      }
    }

    /* ---------- Placement ---------- */
    place() {
      const B = bounds(), o = this.o;
      const w = Math.min(o.width || 720, B.w - 16);
      const h = Math.min(o.height || 480, B.h - 16);
      let x, y;
      if (this.parent && !this.parent.closed) {
        const pr = this.parent.rect();
        x = pr.x + (pr.w - w) / 2;
        y = pr.y + Math.max(30, (pr.h - h) / 3);
      } else if (o.x != null && o.y != null) {
        x = o.x; y = o.y;
      } else {
        const n = cascadeIndex++ % 7;
        x = (B.w - w) / 2 + (n - 3) * 28;
        y = (B.h - h) / 2 + (n - 3) * 26 - 10;
      }
      x = clamp(x, 0, Math.max(0, B.w - w));
      y = clamp(y, 0, Math.max(0, B.h - h));
      this.setRect(x, y, w, h);
      if (U.isMobile() && o.resizable !== false) { this.el.classList.add('maximized'); this.maximized = true; this.updateMaxBtn(); }
      else if (o.maximized) this.maximize(true);
    }

    setRect(x, y, w, h) {
      const s = this.el.style;
      s.left = Math.round(x) + 'px'; s.top = Math.round(y) + 'px';
      s.width = Math.round(w) + 'px'; s.height = Math.round(h) + 'px';
    }
    rect() { return { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight }; }
    inlineRect() {
      const s = this.el.style;
      return { x: parseFloat(s.left) || 0, y: parseFloat(s.top) || 0, w: parseFloat(s.width) || 400, h: parseFloat(s.height) || 300 };
    }
    setSize(w, h) { const r = this.inlineRect(); this.setRect(r.x, r.y, w, h); this.clampIntoView(); }
    center() {
      const B = bounds(), r = this.inlineRect();
      this.setRect((B.w - r.w) / 2, Math.max(0, (B.h - r.h) / 2), r.w, r.h);
    }
    clampIntoView() {
      if (this.maximized) return;
      const B = bounds(), r = this.inlineRect();
      const w = Math.min(r.w, B.w), h = Math.min(r.h, B.h);
      this.setRect(clamp(r.x, -w + 100, B.w - 100), clamp(r.y, 0, Math.max(0, B.h - 40)), w, h);
    }
    animate(fn) {
      this.el.classList.add('animating');
      fn();
      clearTimeout(this._animT);
      this._animT = setTimeout(() => this.el.classList.remove('animating'), 300);
    }

    /* ---------- Déplacement ---------- */
    startMove(e) {
      if (e.button !== 0 || e.target.closest('.win-controls') || e.target.closest('.win-icon')) return;
      if (U.isMobile()) return;
      const B = bounds();
      const crect = container.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      let r = this.inlineRect();
      let started = false, snap = null;
      const tb = this.titlebar;
      try { tb.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!started) {
          if (Math.abs(dx) + Math.abs(dy) < 5) return;
          started = true;
          document.body.classList.add('dragging');
          this.el.classList.add('moving');
          if (this.maximized || this.snapped) {
            const cur = this.rect();
            const size = this.snapped && this.restoreRect ? this.restoreRect : r;
            const ratio = (sx - crect.left - cur.x) / cur.w;
            this.el.classList.remove('maximized');
            this.maximized = false;
            this.snapped = null;
            this.restoreRect = null;
            this.updateMaxBtn();
            r = { x: sx - crect.left - size.w * ratio, y: sy - crect.top - 18, w: size.w, h: size.h };
            this.setRect(r.x, r.y, r.w, r.h);
            this.emit('restore');
          }
        }
        const nx = clamp(r.x + dx, -r.w + 90, B.w - 90);
        const ny = clamp(r.y + dy, 0, B.h - 36);
        this.el.style.left = nx + 'px';
        this.el.style.top = ny + 'px';
        snap = null;
        if (this.o.resizable !== false && this.o.maximizable !== false) {
          const px = ev.clientX - crect.left, py = ev.clientY - crect.top;
          if (py <= 3) snap = 'max';
          else if (px <= 3) snap = 'left';
          else if (px >= B.w - 4) snap = 'right';
        }
        showPreview(snap && this.snapRect(snap));
      };
      const up = () => {
        tb.removeEventListener('pointermove', move);
        tb.removeEventListener('pointerup', up);
        tb.removeEventListener('pointercancel', up);
        document.body.classList.remove('dragging');
        this.el.classList.remove('moving');
        showPreview(null);
        if (started && snap) { if (snap === 'max') this.maximize(); else this.snapTo(snap); }
      };
      tb.addEventListener('pointermove', move);
      tb.addEventListener('pointerup', up);
      tb.addEventListener('pointercancel', up);
    }

    /* ---------- Redimensionnement ---------- */
    startResize(e, dir) {
      if (e.button !== 0 || this.maximized) return;
      e.stopPropagation();
      e.preventDefault();
      const handle = e.currentTarget;
      const B = bounds();
      const start = this.inlineRect();
      const minW = this.o.minWidth || 280, minH = this.o.minHeight || 160;
      const sx = e.clientX, sy = e.clientY;
      this.snapped = null;
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      document.body.classList.add('resizing');
      this.el.classList.add('moving');
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        let { x, y, w, h } = start;
        if (dir.includes('e')) w = clamp(start.w + dx, minW, B.w - start.x);
        if (dir.includes('s')) h = clamp(start.h + dy, minH, B.h - start.y);
        if (dir.includes('w')) { w = clamp(start.w - dx, minW, start.x + start.w); x = start.x + start.w - w; }
        if (dir.includes('n')) { h = clamp(start.h - dy, minH, start.y + start.h); y = start.y + start.h - h; }
        this.setRect(x, y, w, h);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        document.body.classList.remove('resizing');
        this.el.classList.remove('moving');
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    }

    /* ---------- États ---------- */
    snapRect(kind) {
      const B = bounds();
      if (kind === 'left') return { x: 0, y: 0, w: Math.round(B.w / 2), h: B.h };
      if (kind === 'right') return { x: Math.round(B.w / 2), y: 0, w: B.w - Math.round(B.w / 2), h: B.h };
      return { x: 0, y: 0, w: B.w, h: B.h };
    }
    snapTo(kind) {
      if (this.maximized) { this.el.classList.remove('maximized'); this.maximized = false; }
      if (!this.snapped) this.restoreRect = this.inlineRect();
      const s = this.snapRect(kind);
      this.animate(() => this.setRect(s.x, s.y, s.w, s.h));
      this.snapped = kind;
      this.updateMaxBtn();
    }
    maximize(instant) {
      if (this.maximized) return;
      const f = () => this.el.classList.add('maximized');
      instant ? f() : this.animate(f);
      this.maximized = true;
      this.updateMaxBtn();
      this.emit('maximize');
    }
    restore() {
      if (this.minimized) return this.unminimize();
      if (this.maximized) {
        if (U.isMobile()) return;
        this.animate(() => this.el.classList.remove('maximized'));
        this.maximized = false;
      } else if (this.snapped && this.restoreRect) {
        const r = this.restoreRect;
        this.animate(() => this.setRect(r.x, r.y, r.w, r.h));
        this.snapped = null;
        this.restoreRect = null;
      }
      this.updateMaxBtn();
      this.emit('restore');
    }
    toggleMaximize() { this.maximized ? this.restore() : this.maximize(); }
    updateMaxBtn() {
      if (!this.btnMax) return;
      this.btnMax.innerHTML = Y.icons.svg(this.maximized ? 'restore' : 'square', this.maximized ? 14 : 13);
      this.btnMax.title = this.maximized ? 'Restaurer' : 'Agrandir';
    }

    minimize() {
      if (this.minimized || this.o.minimizable === false) return;
      const item = Y.taskbar && Y.taskbar.itemRect(this.app);
      if (item) {
        const r = this.el.getBoundingClientRect();
        this.el.style.transformOrigin = `${item.left + item.width / 2 - r.left}px ${item.top - r.top}px`;
      }
      this.minimized = true;
      this.el.classList.add('minimized');
      Y.sound.play('minimize');
      this.emit('minimize');
      Y.bus.emit('wm:minimize', this);
      if (focused === this) {
        focused.el.classList.remove('focused');
        focused = null;
        const next = topVisible();
        if (next) next.focus(); else Y.bus.emit('wm:focus', null);
      }
    }
    unminimize() {
      if (!this.minimized) return;
      this.minimized = false;
      this.el.classList.remove('minimized');
      setTimeout(() => { if (!this.minimized) this.el.style.transformOrigin = ''; }, 350);
      this.emit('restore');
      Y.bus.emit('wm:restore', this);
      this.focus();
    }

    focus() {
      if (this.closed) return;
      if (this.modalChild && !this.modalChild.closed) {
        const c = this.modalChild;
        if (this.minimized) this.unminimizeSilently();
        c.focus();
        c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash');
        return;
      }
      if (this.minimized) { this.unminimize(); return; }
      if (focused !== this) {
        if (focused) { focused.el.classList.remove('focused'); focused.emit('blur'); }
        focused = this;
        this.el.classList.add('focused');
        order = order.filter(w => w !== this);
        order.push(this);
        this.emit('focus');
        Y.bus.emit('wm:focus', this);
      }
      this.el.style.zIndex = ++z + (this.ontop ? 100000 : 0);
      if (!this.el.contains(document.activeElement)) this.el.focus({ preventScroll: true });
    }
    unminimizeSilently() { this.minimized = false; this.el.classList.remove('minimized'); Y.bus.emit('wm:restore', this); }

    setTitle(t) {
      this.titleEl.textContent = t;
      this.el.setAttribute('aria-label', t);
      this.o.title = t;
      Y.bus.emit('wm:title', this);
    }
    get title() { return this.o.title; }

    async close(force) {
      if (this.closed || this._closing) return false;
      if (!force) {
        this._closing = true;
        try {
          for (const fn of (this.handlers.beforeclose || [])) { if ((await fn()) === false) { this._closing = false; return false; } }
        } catch (e) { console.error(e); }
        this._closing = false;
      }
      for (const c of Array.from(this.children)) c.close(true);
      this.closed = true;
      this.emit('close');
      wins.delete(this.id);
      order = order.filter(w => w !== this);
      if (this.parent) {
        this.parent.children.delete(this);
        if (this.parent.modalChild === this) {
          this.parent.modalChild = null;
          this.parent.shade && this.parent.shade.remove();
          this.parent.shade = null;
        }
      }
      this.ro && this.ro.disconnect();
      this.el.classList.add('closing');
      setTimeout(() => this.el.remove(), 220);
      Y.sound.play('close');
      Y.bus.emit('wm:close', this);
      if (focused === this) {
        focused = null;
        const next = (this.parent && !this.parent.closed && !this.parent.minimized) ? this.parent : topVisible();
        if (next) next.focus(); else Y.bus.emit('wm:focus', null);
      }
      return true;
    }

    showMenu(x, y) {
      const items = [
        { label: 'Restaurer', icon: 'restore', disabled: !(this.maximized || this.snapped), action: () => this.restore() },
        { label: 'Réduire', icon: 'minus', disabled: this.o.minimizable === false, action: () => this.minimize() },
        { label: 'Agrandir', icon: 'square', disabled: this.maximized || this.o.resizable === false, action: () => this.maximize() },
        '-',
        { label: 'Ancrer à gauche', icon: 'chevronLeft', disabled: this.o.resizable === false, action: () => this.snapTo('left') },
        { label: 'Ancrer à droite', icon: 'chevronRight', disabled: this.o.resizable === false, action: () => this.snapTo('right') },
        { label: 'Centrer', icon: 'maximize', disabled: this.maximized, action: () => this.animate(() => this.center()) },
        { label: 'Toujours au premier plan', checked: this.ontop, action: () => { this.ontop = !this.ontop; this.focus(); } },
        '-',
        { label: 'Fermer', icon: 'x', shortcut: 'Ctrl+Alt+W', action: () => this.close() }
      ];
      Y.menu.show(x, y, items);
    }

    on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
    off(evt, fn) { if (this.handlers[evt]) this.handlers[evt] = this.handlers[evt].filter(f => f !== fn); }
    emit(evt, ...a) {
      if (evt === 'beforeclose') return;
      (this.handlers[evt] || []).slice().forEach(fn => { try { fn(...a); } catch (e) { console.error('[win]', evt, e); } });
    }
    /** Écoute un événement du bus et se désabonne à la fermeture */
    listen(evt, fn) { const off = Y.bus.on(evt, fn); this.on('close', off); return off; }
    /** setInterval nettoyé à la fermeture */
    interval(fn, ms) { const t = setInterval(fn, ms); this.on('close', () => clearInterval(t)); return t; }
    isVisible() { return !this.closed && !this.minimized; }
    isFocused() { return focused === this; }
  }

  function topVisible() {
    for (let i = order.length - 1; i >= 0; i--) if (order[i].isVisible()) return order[i];
    return null;
  }

  function showPreview(r) {
    if (!preview) return;
    if (!r) { preview.classList.remove('show'); return; }
    const m = 6;
    Object.assign(preview.style, { left: r.x + m + 'px', top: r.y + m + 'px', width: r.w - 2 * m + 'px', height: r.h - 2 * m + 'px' });
    preview.classList.add('show');
  }

  function onViewportResize() {
    const mobile = U.isMobile();
    for (const w of wins.values()) {
      if (mobile && w.o.resizable !== false && !w.maximized) { w.el.classList.add('maximized'); w.maximized = true; w.updateMaxBtn(); }
      else if (w.snapped) { const s = w.snapRect(w.snapped); w.setRect(s.x, s.y, s.w, s.h); }
      else w.clampIntoView();
    }
  }

  Y.wm = {
    init() {
      container = document.getElementById('windows');
      preview = document.getElementById('snap-preview');
      window.addEventListener('resize', U.debounce(onViewportResize, 120));
    },
    create(o) {
      const w = new Win(o);
      wins.set(w.id, w);
      container.appendChild(w.el);
      if (w.parent) {
        w.parent.children.add(w);
        if (o.modal) {
          w.parent.modalChild = w;
          w.parent.shade = el('div.win-shade');
          w.parent.shade.addEventListener('pointerdown', ev => { ev.stopPropagation(); w.parent.focus(); });
          w.parent.el.appendChild(w.parent.shade);
        }
      }
      w.place();
      w.focus();
      Y.bus.emit('wm:open', w);
      return w;
    },
    get: id => wins.get(id),
    list: () => Array.from(wins.values()),
    byApp: app => Array.from(wins.values()).filter(w => w.app === app),
    focused: () => focused,
    order: () => order.slice(),
    topVisible,
    bounds: () => bounds(),

    minimizeAll() { for (const w of wins.values()) if (!w.parent) w.minimize(); },
    showDesktop() {
      const visible = Array.from(wins.values()).filter(w => w.isVisible() && !w.parent);
      if (visible.length) { hiddenByShowDesktop = visible; visible.forEach(w => w.minimize()); }
      else { hiddenByShowDesktop.forEach(w => !w.closed && w.unminimize()); hiddenByShowDesktop = []; }
    },
    closeAll() { for (const w of Array.from(wins.values())) w.close(); },
    cascade() {
      const B = bounds();
      Array.from(wins.values()).filter(w => w.isVisible() && !w.parent).forEach((w, i) => {
        w.el.classList.remove('maximized'); w.maximized = false; w.snapped = null; w.updateMaxBtn();
        const ww = Math.min(720, B.w * 0.7), hh = Math.min(480, B.h * 0.7);
        w.animate(() => w.setRect(30 + i * 32, 20 + i * 32, ww, hh));
        w.focus();
      });
    },
    tile() {
      const B = bounds();
      const list = Array.from(wins.values()).filter(w => w.isVisible() && !w.parent);
      if (!list.length) return;
      const cols = Math.ceil(Math.sqrt(list.length)), rows = Math.ceil(list.length / cols);
      list.forEach((w, i) => {
        w.el.classList.remove('maximized'); w.maximized = false; w.snapped = null; w.updateMaxBtn();
        const c = i % cols, r = Math.floor(i / cols);
        const cw = B.w / cols, ch = B.h / rows;
        w.animate(() => w.setRect(c * cw, r * ch, cw, ch));
      });
    },
    cycle(dir = 1) {
      const list = Array.from(wins.values()).filter(w => !w.parent);
      if (!list.length) return;
      list.sort((a, b) => a.createdAt - b.createdAt);
      const i = list.indexOf(focused);
      const next = list[(i + dir + list.length) % list.length];
      next.focus();
    }
  };
})(window.YOS);
