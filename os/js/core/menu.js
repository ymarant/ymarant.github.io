/* =========================================================
   YohannOS — menus contextuels
   items : [{ label, icon, shortcut, action, disabled, danger,
             checked, submenu:[...] }, '-' (séparateur), { title }]
   ========================================================= */
(function (Y) {
  'use strict';
  const { el } = Y.U;
  let stack = [];
  let onCloseCb = null;

  function host() { return document.getElementById('menus'); }

  function build(items, level) {
    const m = el('div.ctx-menu', { role: 'menu' });
    m.dataset.level = level;
    items.filter(Boolean).forEach(it => {
      if (it === '-' || it.separator) { m.appendChild(el('div.ctx-sep')); return; }
      if (it.title) { m.appendChild(el('div.ctx-title', it.title)); return; }
      const row = el('div.ctx-item', { role: 'menuitem', class: [it.disabled && 'disabled', it.danger && 'danger'].filter(Boolean).join(' ') || null });
      const icoSlot = el('span.ico-slot', { html: it.checked !== undefined ? (it.checked ? Y.icons.svg('check', 14) : '') : (it.icon ? Y.icons.svg(it.icon, 15) : '') });
      row.append(icoSlot, el('span.label', it.label));
      if (it.shortcut) row.appendChild(el('span.shortcut', it.shortcut));
      if (it.submenu) row.appendChild(el('span.shortcut', { html: Y.icons.svg('chevronRight', 13) }));
      row.addEventListener('pointerenter', () => {
        closeFrom(level + 1);
        m.querySelectorAll('.sub-open,.kb').forEach(x => x.classList.remove('sub-open', 'kb'));
        if (it.submenu && !it.disabled) {
          row.classList.add('sub-open');
          const r = row.getBoundingClientRect();
          openAt(r.right - 4, r.top - 5, typeof it.submenu === 'function' ? it.submenu() : it.submenu, level + 1, r.left + 4);
        }
      });
      row.addEventListener('click', ev => {
        ev.stopPropagation();
        if (it.disabled || it.submenu) return;
        hide();
        Y.sound.play('click');
        try { it.action && it.action(); } catch (e) { console.error(e); Y.dialog && Y.dialog.alert(e.message, { title: 'Erreur', icon: 'err' }); }
      });
      row._item = it;
      m.appendChild(row);
    });
    return m;
  }

  function openAt(x, y, items, level, flipX) {
    const m = build(items, level);
    host().appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = x, top = y;
    if (left + w > innerWidth - 4) left = flipX != null ? flipX - w : innerWidth - w - 4;
    if (top + h > innerHeight - 4) top = Math.max(4, innerHeight - h - 4);
    m.style.left = Math.max(4, left) + 'px';
    m.style.top = Math.max(4, top) + 'px';
    stack[level] = m;
    return m;
  }

  function closeFrom(level) {
    for (let i = stack.length - 1; i >= level; i--) { stack[i] && stack[i].remove(); stack.length = i; }
  }

  function hide() {
    if (!stack.length) return;
    closeFrom(0);
    const cb = onCloseCb; onCloseCb = null;
    cb && cb();
  }

  function onKey(e) {
    if (!stack.length) return;
    const m = stack[stack.length - 1];
    const rows = Array.from(m.querySelectorAll('.ctx-item:not(.disabled)'));
    let i = rows.findIndex(r => r.classList.contains('kb'));
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (stack.length > 1) closeFrom(stack.length - 1); else hide(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      rows.forEach(r => r.classList.remove('kb'));
      i = e.key === 'ArrowDown' ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
      rows[i] && rows[i].classList.add('kb');
    } else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); rows[i].click(); }
    else if (e.key === 'ArrowRight' && i >= 0 && rows[i]._item.submenu) {
      e.preventDefault(); rows[i].dispatchEvent(new PointerEvent('pointerenter'));
      const sub = stack[stack.length - 1]; const first = sub.querySelector('.ctx-item:not(.disabled)'); first && first.classList.add('kb');
    } else if (e.key === 'ArrowLeft' && stack.length > 1) { e.preventDefault(); closeFrom(stack.length - 1); }
  }

  document.addEventListener('pointerdown', e => { if (stack.length && !e.target.closest('.ctx-menu')) hide(); }, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);

  Y.menu = {
    show(x, y, items, opts = {}) {
      hide();
      onCloseCb = opts.onClose || null;
      openAt(x, y, items, 0);
    },
    /** Affiche le menu sous un élément (bouton) */
    showFor(anchor, items, opts) {
      const r = anchor.getBoundingClientRect();
      Y.menu.show(r.left, r.bottom + 4, items, opts);
    },
    hide,
    isOpen: () => stack.length > 0
  };
})(window.YOS);
