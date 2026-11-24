/* YohannOS — Paramètres */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const S = Y.settings;
  const FS = Y.fs;

  function launch(args) {
    const sections = [
      ['perso', 'Personnalisation', 'palette'], ['system', 'Système', 'monitor'], ['taskbar', 'Barre des tâches', 'apps'],
      ['storage', 'Stockage', 'drive'], ['keys', 'Raccourcis clavier', 'keyboard'], ['about', 'À propos', 'info']
    ];
    const nav = el('div.st-nav');
    const main = el('div.st-main.scroll');
    const search = el('input.input', { placeholder: 'Rechercher un réglage…' });
    const win = Y.apps.window('settings', { content: el('div.st', el('div.st-side', el('div.st-user', el('span.sm-avatar', S.get('username').charAt(0)), el('div', el('b', S.get('username')), el('div.dim', 'Compte local'))), search, nav), main), width: 860, height: 600, minWidth: 420, minHeight: 380 });
    let cur = null;
    sections.forEach(([id, label, icon]) => nav.appendChild(el('button.st-navbtn', { dataset: { id }, html: Y.icons.svg(icon, 17) + `<span>${label}</span>`, onclick: () => show(id) })));
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      const map = { perso: 'fond ecran wallpaper theme sombre clair couleur accent transparence animation', system: 'son volume notification utilisateur nom mot de passe demarrage economiseur ecran horloge secondes', taskbar: 'epingle barre taches', storage: 'stockage sauvegarde export import reinitialiser', keys: 'raccourcis clavier', about: 'version a propos' };
      nav.querySelectorAll('.st-navbtn').forEach(b => b.classList.toggle('hidden', !!q && !b.textContent.toLowerCase().includes(q) && !map[b.dataset.id].includes(q)));
    });

    function show(id) {
      cur = id;
      nav.querySelectorAll('.st-navbtn').forEach(b => b.classList.toggle('active', b.dataset.id === id));
      main.innerHTML = '';
      main.appendChild(el('h2.st-title', sections.find(s => s[0] === id)[1]));
      ({ perso, system, taskbar, storage, keys, about })[id]();
      main.scrollTop = 0;
    }
    const group = (title, ...rows) => el('div.st-group', title ? el('div.st-group-title', title) : null, ...rows);
    const row = (label, desc, control) => el('div.st-row', el('div.grow', el('div', label), desc ? el('div.dim.st-desc', desc) : null), control);
    const toggle = (key, after) => {
      const sw = el('label.switch', el('input', { type: 'checkbox' }), el('span'));
      sw.firstChild.checked = !!S.get(key);
      sw.firstChild.addEventListener('change', () => { S.set(key, sw.firstChild.checked); after && after(); });
      return sw;
    };
    const segmented = (key, options) => {
      const box = el('div.st-seg');
      options.forEach(([v, label]) => {
        const b = el('button', { class: S.get(key) === v ? 'on' : null }, label);
        b.addEventListener('click', () => { S.set(key, v); box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
        box.appendChild(b);
      });
      return box;
    };

    /* Personnalisation */
    function perso() {
      const gallery = el('div.st-wallpapers');
      const drawGallery = () => {
        gallery.innerHTML = '';
        S.WALLPAPERS.forEach(w => {
          const t = el('button.st-wp', { class: S.get('wallpaper') === w.id ? 'on' : null, title: w.name, style: { background: w.css } }, el('span', w.name + (w.live ? ' ✦' : '')));
          if (w.id === 'retro') t.style.background = 'linear-gradient(180deg, #120428 0%, #3b0a5c 45%, #ff3d81 62%, #170336 62.2%)';
          t.addEventListener('click', () => { S.set('wallpaper', w.id); drawGallery(); });
          gallery.appendChild(t);
        });
        if (S.get('customWallpaper')) {
          const t = el('button.st-wp', { class: S.get('wallpaper') === 'custom' ? 'on' : null, style: { background: `url("${S.get('customWallpaper')}") center/cover` } }, el('span', 'Personnalisé'));
          t.addEventListener('click', () => { S.set('wallpaper', 'custom'); drawGallery(); });
          gallery.appendChild(t);
        }
      };
      drawGallery();
      const fromFile = el('button.btn.sm', { html: Y.icons.svg('image', 14) + ' Depuis mes images' });
      fromFile.onclick = async () => {
        const p = await Y.dialog.openFile({ dir: FS.HOME + '/Images', exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], parent: win });
        if (p) { S.set('customWallpaper', FS.getUrl(p)); S.set('wallpaper', 'custom'); drawGallery(); }
      };
      const upload = el('button.btn.sm', { html: Y.icons.svg('upload', 14) + ' Depuis mon ordinateur' });
      upload.onclick = () => {
        const inp = el('input', { type: 'file', accept: 'image/*' });
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          if (f.size > 2.5 * 1024 * 1024) { Y.dialog.alert('Image trop lourde (2,5 Mo max) pour le stockage du navigateur.', { icon: 'warn', parent: win }); return; }
          const data = await U.readFileAs(f);
          FS.writeFile(FS.uniqueName(FS.HOME + '/Images', f.name), data);
          S.set('customWallpaper', data); S.set('wallpaper', 'custom'); drawGallery();
        };
        inp.click();
      };
      const accents = el('div.st-accents');
      const drawAccents = () => {
        accents.innerHTML = '';
        S.ACCENTS.forEach(c => { const s = el('button.swatch', { class: S.get('accent') === c ? 'on' : null, style: { background: c }, title: c }); s.onclick = () => { S.set('accent', c); drawAccents(); }; accents.appendChild(s); });
        const custom = el('input', { type: 'color', value: S.get('accent'), title: 'Couleur personnalisée' });
        custom.oninput = () => S.set('accent', custom.value);
        custom.onchange = drawAccents;
        accents.appendChild(custom);
      };
      drawAccents();
      main.append(
        group('Fond d\'écran', gallery, el('div.row.st-wp-actions', fromFile, upload, el('span.dim', { style: { fontSize: '12px' } }, '✦ = animé'))),
        group('Couleurs',
          row('Thème', 'Clair, sombre ou selon le système', segmented('theme', [['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Auto']])),
          row('Couleur d\'accent', 'Utilisée pour les boutons, sélections et indicateurs', accents)),
        group('Effets',
          row('Transparence', 'Effet de verre dépoli sur les fenêtres et panneaux', toggle('transparency')),
          row('Animations', 'Transitions des fenêtres et menus', toggle('animations'))));
    }

    /* Système */
    function system() {
      const vol = el('input.range', { type: 'range', min: 0, max: 100, value: Math.round(S.get('volume') * 100) });
      vol.oninput = () => S.set('volume', vol.value / 100);
      vol.onchange = () => Y.sound.play('notify');
      const name = el('input.input', { value: S.get('username'), style: { width: '180px' } });
      name.onchange = () => { const v = name.value.trim().slice(0, 24); if (v) S.set('username', v); };
      const pwd = el('input.input', { type: 'password', placeholder: S.get('password') ? '••••••' : 'Aucun', style: { width: '180px' } });
      pwd.onchange = () => { S.set('password', pwd.value); pwd.value = ''; pwd.placeholder = S.get('password') ? '••••••' : 'Aucun'; Y.notify({ title: 'Mot de passe mis à jour', body: S.get('password') ? 'Il sera demandé au prochain verrouillage.' : 'Session sans mot de passe.', app: 'settings' }); };
      const ss = el('select.select', el('option', { value: 'matrix' }, 'Pluie de code'), el('option', { value: 'stars' }, 'Champ d\'étoiles'), el('option', { value: 'none' }, 'Aucun'));
      ss.value = S.get('screensaver'); ss.onchange = () => S.set('screensaver', ss.value);
      const delay = el('select.select', ...[1, 2, 5, 10, 15, 30].map(m => el('option', { value: m }, m + ' min')));
      delay.value = S.get('screensaverDelay'); delay.onchange = () => S.set('screensaverDelay', +delay.value);
      main.append(
        group('Son', row('Sons système', 'Clics, notifications, démarrage…', toggle('sound')), row('Volume', null, vol)),
        group('Notifications', row('Ne pas déranger', 'Masque les notifications (elles restent dans le centre de contrôle)', toggle('dnd')),
          row('Tester', null, el('button.btn.sm', { onclick: () => Y.notify({ title: 'Notification de test', body: 'Tout fonctionne ! 🎉', app: 'settings', force: true }) }, 'Envoyer une notification'))),
        group('Session', row('Nom d\'utilisateur', 'Affiché sur l\'écran de connexion', name), row('Mot de passe', 'Laisser vide pour une session sans mot de passe', pwd),
          row('Démarrage rapide', 'Passer l\'écran du BIOS au démarrage', toggle('fastBoot'))),
        group('Économiseur d\'écran', row('Type', null, ss), row('Délai d\'inactivité', null, delay), row('Aperçu', null, el('button.btn.sm', { onclick: () => Y.boot.screensaver(true) }, 'Lancer maintenant'))),
        group('Horloge', row('Afficher les secondes', 'Dans la barre des tâches', toggle('clockSeconds'))));
    }

    /* Barre des tâches */
    function taskbar() {
      const list = el('div.st-pins');
      Y.apps.list().forEach(a => {
        const sw = el('label.switch', el('input', { type: 'checkbox' }), el('span'));
        sw.firstChild.checked = S.get('pinned').includes(a.id);
        sw.firstChild.onchange = () => Y.taskbar.togglePin(a.id);
        list.appendChild(el('div.st-row', { html: Y.icons.tile(a.icon, a.color, 28) }, el('div.grow', el('div', a.name), el('div.dim.st-desc', a.category)), sw));
      });
      main.append(group('Applications épinglées', el('p.dim', 'Choisis les applications toujours visibles dans la barre des tâches.'), list));
    }

    /* Stockage */
    function storage() {
      const used = U.store.size(), quota = 5 * 1024 * 1024;
      const home = FS.HOME;
      const parts = ['Documents', 'Images', 'Musique', 'Bureau', 'Téléchargements', '.corbeille'].map(n => {
        const p = home + '/' + n;
        const size = FS.exists(p) ? FS.find(p, () => true, 5000).reduce((s, fp) => s + (FS.isFile(fp) ? FS.stat(fp).size : 0), 0) : 0;
        return [n === '.corbeille' ? 'Corbeille' : n, size];
      });
      const bar = el('div.st-storage-bar', el('i', { style: { width: Math.min(100, used / quota * 100) + '%' } }));
      const exp = el('button.btn', { html: Y.icons.svg('download', 15) + ' Exporter une sauvegarde' });
      exp.onclick = () => U.download(`yohannos-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, FS.exportJSON(), 'application/json');
      const imp = el('button.btn', { html: Y.icons.svg('upload', 15) + ' Restaurer une sauvegarde' });
      imp.onclick = () => {
        const inp = el('input', { type: 'file', accept: '.json,application/json' });
        inp.onchange = async () => {
          try {
            const text = await U.readFileAs(inp.files[0], 'text');
            if (!(await Y.dialog.confirm('Remplacer tous les fichiers et réglages actuels par cette sauvegarde ?', { icon: 'warn', okText: 'Restaurer', danger: true, parent: win }))) return;
            FS.importJSON(text);
            location.reload();
          } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
        };
        inp.click();
      };
      const resetFs = el('button.btn', { html: Y.icons.svg('refresh', 15) + ' Réinitialiser les fichiers' });
      resetFs.onclick = async () => { if (await Y.dialog.confirm('Supprimer tous tes fichiers et restaurer les fichiers d\'origine ?', { icon: 'warn', okText: 'Réinitialiser', danger: true, parent: win })) { FS.reset(); show('storage'); } };
      const factory = el('button.btn.danger', { html: Y.icons.svg('alert', 15) + ' Réinitialisation complète' });
      factory.onclick = async () => { if (await Y.dialog.confirm('Effacer TOUTES les données de YohannOS (fichiers, réglages, scores) et redémarrer ?', { icon: 'warn', okText: 'Tout effacer', danger: true, parent: win })) { U.store.clearAll(); sessionStorage.clear(); location.reload(); } };
      main.append(
        group('Utilisation', el('div.st-storage', el('div.row', el('b', U.formatBytes(used)), el('span.dim', 'utilisés sur ≈ 5 Mo (stockage local du navigateur)')), bar,
          el('div.st-storage-list', parts.map(([n, s]) => el('div.row', el('span.grow', n), el('span.dim', U.formatBytes(s))))))),
        group('Sauvegarde', el('p.dim', 'Tes fichiers vivent dans ce navigateur. Exporte-les pour les garder ou les transférer sur un autre appareil.'), el('div.row.st-wrap', exp, imp)),
        group('Zone dangereuse', el('div.row.st-wrap', resetFs, factory)));
    }

    /* Raccourcis */
    function keys() {
      const list = [
        ['Ctrl + K', 'Recherche / palette de commandes'], ['Alt + Espace', 'Recherche'], ['Ctrl + Alt + T', 'Ouvrir un terminal'], ['Ctrl + Alt + E', 'Ouvrir l\'explorateur'],
        ['Ctrl + Alt + D', 'Afficher le bureau'], ['Ctrl + Alt + L', 'Verrouiller'], ['Ctrl + Alt + W', 'Fermer la fenêtre active'], ['Ctrl + Alt + ← / →', 'Fenêtre précédente / suivante'],
        ['Ctrl + Alt + ↑', 'Agrandir / restaurer'], ['Ctrl + Alt + ↓', 'Réduire'], ['Double-clic sur le titre', 'Agrandir / restaurer'], ['Glisser contre un bord', 'Ancrer la fenêtre (moitié / plein écran)'],
        ['F2', 'Renommer (bureau, fichiers)'], ['Suppr', 'Mettre à la corbeille'], ['Ctrl + C / X / V', 'Copier / couper / coller des fichiers'], ['Ctrl + S', 'Enregistrer (éditeurs)']
      ];
      main.append(group(null, el('div.st-keys', list.map(([k, d]) => el('div.st-row', el('div.grow', d), el('span', { html: k.split(' + ').map(x => `<span class="kbd">${U.escape(x)}</span>`).join(' + ') }))))));
    }

    /* À propos */
    function about() {
      const ua = navigator.userAgent;
      const lines = Object.keys(window.YOS).length;
      main.append(
        el('div.st-about', el('div.st-about-logo', { html: Y.icons.LOGO }), el('div', el('h1', { html: 'Yohann<b>OS</b> 2.0' }), el('div.dim', 'Édition « Lille » — ' + new Date().getFullYear()), el('p', 'Un système d\'exploitation de bureau complet, codé à la main en HTML, CSS et JavaScript, sans aucune bibliothèque ni framework.'))),
        group('Caractéristiques',
          row('Applications', null, el('b', String(Y.apps.all().length))),
          row('Modules système', null, el('b', String(lines))),
          row('Stockage', null, el('b', 'localStorage (' + U.formatBytes(U.store.size()) + ')')),
          row('Navigateur', null, el('span.dim', ua.length > 60 ? ua.slice(0, 60) + '…' : ua)),
          row('Écran', null, el('b', `${screen.width} × ${screen.height} (×${window.devicePixelRatio || 1})`))),
        group('Liens',
          row('CV classique', 'Ma première page HTML', el('button.btn.sm', { onclick: () => Y.apps.launch('browser', { url: '../index.html' }) }, 'Ouvrir')),
          row('Me contacter', null, el('button.btn.sm', { onclick: () => Y.apps.launch('contact') }, 'Contact')),
          row('Données météo', 'Fournies par Open-Meteo.com', el('span.dim', 'CC BY 4.0'))));
    }

    show(args.section || 'perso');
    win.show = show;
    return win;
  }

  Y.apps.register({
    id: 'settings', name: 'Paramètres', icon: 'settings', color: ['#868f96', '#596164'], category: 'Système',
    description: 'Personnaliser YohannOS', keywords: 'reglages options preferences configuration theme fond',
    single: true, launch,
    onReopen(win, args) { if (args.section && win.show) win.show(args.section); }
  });
})(window.YOS);
