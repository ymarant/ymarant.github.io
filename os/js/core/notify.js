/* =========================================================
   YohannOS — notifications
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const history = [];

  function notify(o) {
    if (typeof o === 'string') o = { title: o };
    const item = {
      id: U.uid('n'), title: o.title || 'Notification', body: o.body || '', icon: o.icon || 'bell',
      app: o.app || null, time: Date.now(), type: o.type || 'info', onClick: o.onClick || null
    };
    history.unshift(item);
    if (history.length > 50) history.pop();
    Y.bus.emit('notify:change', history);

    if (Y.settings.get('dnd') && o.type !== 'error' && !o.force) return item;
    const host = document.getElementById('toasts');
    if (!host) return item;
    const app = item.app && Y.apps.get(item.app);
    const iconHtml = app ? Y.icons.tile(app.icon, app.color, 36) : Y.icons.tile(item.icon, item.type === 'error' ? ['#ff5c6c', '#c81d3a'] : item.type === 'success' ? ['#3ddc97', '#0f9d6b'] : null, 36);
    const timeout = o.timeout ?? 5500;
    const actions = el('div.t-actions');
    (o.actions || []).forEach(a => actions.appendChild(el('button.btn.sm', { class: a.primary ? 'primary' : null, onclick: ev => { ev.stopPropagation(); a.action(); dismiss(); } }, a.label)));
    const progress = el('div.t-progress');
    const toast = el('div.toast', { role: 'status' },
      el('div', { html: iconHtml }),
      el('div.t-body', el('div.t-title', item.title), item.body ? el('div.t-text', item.body) : null, o.actions ? actions : null),
      el('button.t-close', { html: Y.icons.svg('x', 14), onclick: ev => { ev.stopPropagation(); dismiss(); } }),
      timeout ? progress : null
    );
    toast.addEventListener('click', () => { if (item.onClick) item.onClick(); dismiss(); });
    host.appendChild(toast);
    while (host.children.length > 4) host.firstChild.remove();
    Y.sound.play(item.type === 'error' ? 'error' : 'notify');

    let t, remaining = timeout, startedAt = Date.now();
    function dismiss() {
      clearTimeout(t);
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }
    if (timeout) {
      const run = () => {
        startedAt = Date.now();
        progress.style.transition = `transform ${remaining}ms linear`;
        requestAnimationFrame(() => { progress.style.transform = 'scaleX(0)'; });
        t = setTimeout(dismiss, remaining);
      };
      toast.addEventListener('pointerenter', () => {
        clearTimeout(t);
        remaining -= Date.now() - startedAt;
        const cur = getComputedStyle(progress).transform;
        progress.style.transition = 'none';
        progress.style.transform = cur;
      });
      toast.addEventListener('pointerleave', run);
      run();
    }
    return item;
  }

  Y.notify = notify;
  Y.notifications = {
    list: () => history.slice(),
    clear() { history.length = 0; Y.bus.emit('notify:change', history); },
    remove(id) { const i = history.findIndex(n => n.id === id); if (i >= 0) history.splice(i, 1); Y.bus.emit('notify:change', history); }
  };
})(window.YOS);
