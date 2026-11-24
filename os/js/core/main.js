/* =========================================================
   YohannOS — point d'entrée
   ========================================================= */
(function (Y) {
  'use strict';

  function init() {
    Y.settings.init();
    Y.fs.init();
    Y.wm.init();
    Y.taskbar.init();
    Y.desktop.init();

    // raccourcis clavier globaux
    document.addEventListener('keydown', e => {
      if (Y.boot.isLocked()) return;
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.altKey && k === 'k') { e.preventDefault(); Y.palette.isOpen() ? Y.palette.close() : Y.palette.open(); }
      else if (e.altKey && e.code === 'Space') { e.preventDefault(); Y.palette.open(); }
      else if (ctrl && e.altKey && k === 't') { e.preventDefault(); Y.apps.launch('terminal'); }
      else if (ctrl && e.altKey && k === 'e') { e.preventDefault(); Y.apps.launch('explorer'); }
      else if (ctrl && e.altKey && k === 'd') { e.preventDefault(); Y.wm.showDesktop(); }
      else if (ctrl && e.altKey && k === 'l') { e.preventDefault(); Y.boot.lock(); }
      else if (ctrl && e.altKey && k === 'w') { e.preventDefault(); const w = Y.wm.focused(); w && w.close(); }
      else if (ctrl && e.altKey && (k === 'arrowright' || k === 'arrowleft')) { e.preventDefault(); Y.wm.cycle(k === 'arrowright' ? 1 : -1); }
      else if (ctrl && e.altKey && k === 'arrowup') { e.preventDefault(); const w = Y.wm.focused(); w && w.toggleMaximize(); }
      else if (ctrl && e.altKey && k === 'arrowdown') { e.preventDefault(); const w = Y.wm.focused(); w && w.minimize(); }
    });

    // empêcher le menu contextuel du navigateur sur le bureau
    document.addEventListener('contextmenu', e => {
      if (e.target.closest('input, textarea, [contenteditable], .selectable, iframe')) return;
      e.preventDefault();
    });

    // erreurs non interceptées → notification discrète
    let lastErr = 0;
    window.addEventListener('error', e => {
      if (Date.now() - lastErr < 3000 || !e.message) return;
      lastErr = Date.now();
      Y.notify && Y.notify({ title: 'Erreur d\'application', body: e.message, type: 'error', icon: 'alert' });
    });

    Y.boot.start(() => {
      const first = !Y.U.store.get('visited', false);
      Y.U.store.set('visited', true);
      if (first) Y.apps.launch('welcome');
      Y.notify({
        title: `Bonjour ${Y.settings.get('username')} 👋`,
        body: first ? 'Bienvenue sur YohannOS ! Appuie sur Ctrl+K pour tout rechercher.' : 'Content de te revoir. Appuie sur Ctrl+K pour tout rechercher.',
        icon: 'sparkle', timeout: 6000
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.YOS);
