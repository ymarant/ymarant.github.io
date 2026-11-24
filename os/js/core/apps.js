/* =========================================================
   YohannOS — registre des applications
   Chaque appli : Y.apps.register({ id, name, icon, color,
   category, exts, single, desktop, launch(args) → win })
   ========================================================= */
(function (Y) {
  'use strict';
  const registry = new Map();
  const CATEGORIES = ['Système', 'Productivité', 'Création', 'Internet', 'Multimédia', 'Jeux'];

  const apps = {
    CATEGORIES,
    register(def) {
      def.category = def.category || 'Système';
      def.color = def.color || ['#7c6cff', '#4b8bff'];
      registry.set(def.id, def);
    },
    get: id => registry.get(id),
    list: () => Array.from(registry.values()).filter(a => !a.hidden),
    all: () => Array.from(registry.values()),

    launch(id, args = {}) {
      const def = registry.get(id);
      if (!def) {
        Y.notify({ title: 'Application introuvable', body: `« ${id} » n'est pas installée.`, type: 'error', icon: 'alert' });
        return null;
      }
      if (def.single) {
        const existing = Y.wm.byApp(id)[0];
        if (existing) {
          existing.focus();
          if (def.onReopen) def.onReopen(existing, args);
          return existing;
        }
      }
      try {
        const win = def.launch(args || {});
        Y.sound.play('open');
        Y.bus.emit('app:launch', id, win);
        return win;
      } catch (e) {
        console.error(e);
        Y.dialog.alert(`L'application « ${def.name} » a rencontré une erreur :\n${e.message}`, { title: 'Erreur', icon: 'err' });
        return null;
      }
    },

    /** Crée la fenêtre standard d'une appli */
    window(id, o = {}) {
      const def = registry.get(id);
      return Y.wm.create(Object.assign({ app: id, title: def.name, icon: def.icon, color: def.color }, o));
    },

    /** Applis capables d'ouvrir un fichier */
    forFile(path) {
      const ext = Y.fs.ext(path);
      const score = a => (a.exts.includes(ext) ? 100 : 0) + ((a.extPriority && a.extPriority[ext]) || 0);
      return Array.from(registry.values()).filter(a => a.exts && (a.exts.includes(ext) || a.exts.includes('*')))
        .sort((a, b) => score(b) - score(a));
    },

    openFile(path, appId) {
      path = Y.fs.normalize(path);
      if (!Y.fs.exists(path)) {
        Y.dialog.alert(`L'élément « ${Y.fs.pretty(path)} » est introuvable.`, { icon: 'err', title: 'Introuvable' });
        return null;
      }
      if (Y.fs.isDir(path)) {
        if (path === Y.fs.TRASH) return apps.launch('explorer', { path });
        return apps.launch('explorer', { path });
      }
      const ext = Y.fs.ext(path);
      if (ext === 'url' && !appId) {
        const url = Y.fs.readFile(path).trim();
        Y.recent.add(path);
        return apps.launch('browser', { url });
      }
      let app = appId ? registry.get(appId) : apps.forFile(path)[0];
      if (!app) app = registry.get('notepad');
      Y.recent.add(path);
      return apps.launch(app.id, { path });
    },

    /** Sous-menu « Ouvrir avec » */
    openWithMenu(path) {
      const list = Array.from(registry.values()).filter(a => a.exts);
      return list.map(a => ({ label: a.name, iconHtml: true, icon: a.icon, action: () => apps.openFile(path, a.id) }));
    }
  };

  Y.apps = apps;
})(window.YOS);
