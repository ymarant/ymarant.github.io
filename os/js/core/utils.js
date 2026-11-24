/* =========================================================
   YohannOS — utilitaires & bus d'événements
   ========================================================= */
window.YOS = window.YOS || {};

(function (Y) {
  'use strict';

  const U = {};

  /** Crée un élément DOM : el('div.classe', {attrs}, ...enfants) */
  U.el = function (tag, attrs, ...children) {
    if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    const parts = tag.split('.');
    const node = document.createElement(parts[0] || 'div');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) node.style.setProperty(sk, v[sk]); else node.style[sk] = v[sk]; } }
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'value') node.value = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  };

  /** Crée un élément à partir d'une chaîne HTML */
  U.html = function (str) {
    const t = document.createElement('template');
    t.innerHTML = String(str).trim();
    return t.content.childNodes.length === 1 ? t.content.firstChild : t.content;
  };

  U.$ = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  U.uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + (Date.now() % 1e6).toString(36);
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => Math.random() * (b - a) + a;
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.pad = (n, l = 2) => String(n).padStart(l, '0');
  U.sleep = ms => new Promise(r => setTimeout(r, ms));

  U.escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.debounce = (fn, ms) => {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  };
  U.throttle = (fn, ms) => {
    let last = 0, t;
    return function (...a) {
      const now = Date.now();
      clearTimeout(t);
      if (now - last >= ms) { last = now; fn.apply(this, a); }
      else t = setTimeout(() => { last = Date.now(); fn.apply(this, a); }, ms - (now - last));
    };
  };

  U.formatBytes = b => {
    if (b < 1024) return b + ' o';
    const u = ['Ko', 'Mo', 'Go'];
    let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return b.toFixed(b < 10 ? 1 : 0).replace('.', ',') + ' ' + u[i];
  };
  U.formatDate = (ts, opts) => new Date(ts).toLocaleString('fr-FR', opts || { dateStyle: 'short', timeStyle: 'short' });
  U.formatDuration = ms => {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return `${h} h ${U.pad(m)} min`;
    if (m) return `${m} min ${U.pad(s % 60)} s`;
    return `${s} s`;
  };
  U.timeAgo = ts => {
    const d = (Date.now() - ts) / 1000;
    if (d < 45) return 'à l\'instant';
    if (d < 3600) return `il y a ${Math.round(d / 60)} min`;
    if (d < 86400) return `il y a ${Math.round(d / 3600)} h`;
    return U.formatDate(ts, { dateStyle: 'medium' });
  };
  U.capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

  /** Stockage local (préfixé, tolérant aux erreurs) */
  const PREFIX = 'yos:';
  U.store = {
    get(k, d) {
      try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; }
      catch (e) { console.warn('Stockage plein ou indisponible', e); return false; }
    },
    remove(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ } },
    keys() {
      try { return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)); }
      catch (e) { return []; }
    },
    size() {
      let n = 0;
      try { for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) n += (k.length + (localStorage.getItem(k) || '').length) * 2; }
      catch (e) { /* ignore */ }
      return n;
    },
    clearAll() { for (const k of U.store.keys()) U.store.remove(k); }
  };

  /** Télécharger un fichier vers l'ordinateur réel */
  U.download = (filename, data, mime) => {
    let blob;
    if (data instanceof Blob) blob = data;
    else if (typeof data === 'string' && data.startsWith('data:')) blob = U.dataURLtoBlob(data);
    else blob = new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  U.dataURLtoBlob = dataURL => {
    const [head, body] = dataURL.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const isB64 = head.includes(';base64');
    const raw = isB64 ? atob(body) : decodeURIComponent(body);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };
  U.readFileAs = (file, mode) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    if (mode === 'text') r.readAsText(file); else r.readAsDataURL(file);
  });

  U.isMobile = () => window.innerWidth < 720 || window.innerHeight < 480;
  U.isTouch = () => matchMedia('(pointer: coarse)').matches;

  /**
   * Aide au glisser (pointer events) : U.drag(e, {move(dx,dy,e), end(e), cursor})
   * À appeler dans un pointerdown.
   */
  U.drag = (e, h) => {
    const sx = e.clientX, sy = e.clientY;
    const target = e.currentTarget || e.target;
    try { target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const move = ev => h.move && h.move(ev.clientX - sx, ev.clientY - sy, ev);
    const up = ev => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      document.body.classList.remove(h.bodyClass || 'dragging');
      h.end && h.end(ev, ev.clientX - sx, ev.clientY - sy);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    if (h.bodyClass !== false) document.body.classList.add(h.bodyClass || 'dragging');
  };

  /** Infobulle simple : U.tooltip(el, texte) */
  let tipEl, tipTimer;
  U.tooltip = (node, text) => {
    node.addEventListener('pointerenter', ev => {
      if (ev.pointerType === 'touch') return;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        tipEl = tipEl || document.getElementById('tooltip');
        const t = typeof text === 'function' ? text() : text;
        if (!t || !node.isConnected) return;
        tipEl.textContent = t;
        const r = node.getBoundingClientRect();
        tipEl.classList.add('show');
        const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
        let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
        if (y < 4) y = r.bottom + 8;
        tipEl.style.left = U.clamp(x, 4, innerWidth - tw - 4) + 'px';
        tipEl.style.top = y + 'px';
      }, 450);
    });
    const hide = () => { clearTimeout(tipTimer); tipEl && tipEl.classList.remove('show'); };
    node.addEventListener('pointerleave', hide);
    node.addEventListener('pointerdown', hide);
  };

  /** Évaluateur d'expressions mathématiques sûr (sans eval) */
  U.evalMath = (expr, opts = {}) => {
    const deg = !!opts.degrees;
    const src = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
    let i = 0;
    const toRad = x => deg ? x * Math.PI / 180 : x;
    const fromRad = x => deg ? x * 180 / Math.PI : x;
    const fact = n => { if (n < 0 || n % 1) return NaN; if (n > 170) return Infinity; let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
    const funcs = {
      sin: x => Math.sin(toRad(x)), cos: x => Math.cos(toRad(x)), tan: x => Math.tan(toRad(x)),
      asin: x => fromRad(Math.asin(x)), acos: x => fromRad(Math.acos(x)), atan: x => fromRad(Math.atan(x)),
      sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10, log2: Math.log2,
      exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, fact
    };
    const consts = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };
    const ws = () => { while (src[i] === ' ') i++; };
    const peek = () => { ws(); return src[i]; };
    function expression() {
      let v = term();
      for (;;) {
        const c = peek();
        if (c === '+') { i++; v += term(); }
        else if (c === '-') { i++; v -= term(); }
        else return v;
      }
    }
    function term() {
      let v = factor();
      for (;;) {
        const c = peek();
        if (c === '*') { i++; v *= factor(); }
        else if (c === '/') { i++; v /= factor(); }
        else if (c === '%') { i++; v %= factor(); }
        else if (c === '(' || /[a-z]/i.test(c || '') || (c && /[0-9.]/.test(c) && false)) { v *= factor(); }
        else return v;
      }
    }
    function factor() {
      const c = peek();
      if (c === '-') { i++; return -factor(); }
      if (c === '+') { i++; return factor(); }
      let base = power();
      return base;
    }
    function power() {
      let b = postfix();
      if (peek() === '^') { i++; return Math.pow(b, factor()); }
      if (src[i] === '*' && src[i + 1] === '*') { i += 2; return Math.pow(b, factor()); }
      return b;
    }
    function postfix() {
      let v = primary();
      while (peek() === '!') { i++; v = fact(v); }
      return v;
    }
    function primary() {
      const c = peek();
      if (c === '(') {
        i++;
        const v = expression();
        if (peek() !== ')') throw new Error('Parenthèse manquante');
        i++;
        return v;
      }
      if (/[0-9.]/.test(c || '')) {
        const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
        if (!m) throw new Error('Nombre invalide');
        i += m[0].length;
        return parseFloat(m[0]);
      }
      if (/[a-z]/i.test(c || '')) {
        const m = src.slice(i).match(/^[a-z][a-z0-9]*/i);
        const name = m[0].toLowerCase();
        i += m[0].length;
        if (name in consts) return consts[name];
        if (name in funcs) {
          if (peek() === '(') { i++; const v = expression(); if (peek() !== ')') throw new Error('Parenthèse manquante'); i++; return funcs[name](v); }
          return funcs[name](postfix());
        }
        throw new Error('Inconnu : ' + name);
      }
      throw new Error('Expression invalide');
    }
    const v = expression();
    ws();
    if (i < src.length) throw new Error('Caractère inattendu : ' + src[i]);
    return v;
  };
  U.formatNumber = v => {
    if (!isFinite(v)) return isNaN(v) ? 'Erreur' : (v > 0 ? '∞' : '-∞');
    const r = Math.round(v * 1e12) / 1e12;
    if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-9 && r !== 0)) return r.toExponential(8).replace(/\.?0+e/, 'e');
    return String(r);
  };

  Y.U = U;

  /* ---------- Bus d'événements ---------- */
  const handlers = {};
  Y.bus = {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return () => Y.bus.off(evt, fn); },
    off(evt, fn) { if (handlers[evt]) handlers[evt] = handlers[evt].filter(f => f !== fn); },
    emit(evt, ...args) {
      (handlers[evt] || []).slice().forEach(fn => {
        try { fn(...args); } catch (err) { console.error('[bus]', evt, err); }
      });
    }
  };

  /* ---------- Fichiers récents ---------- */
  Y.recent = {
    list() { return U.store.get('recent', []); },
    add(path) {
      const l = Y.recent.list().filter(p => p !== path);
      l.unshift(path);
      U.store.set('recent', l.slice(0, 12));
      Y.bus.emit('recent:change');
    },
    clear() { U.store.set('recent', []); Y.bus.emit('recent:change'); }
  };

  Y.startTime = Date.now();
})(window.YOS);
