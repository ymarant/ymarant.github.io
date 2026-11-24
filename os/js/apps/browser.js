/* YohannOS — Navigateur web (onglets, favoris, page d'accueil) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const HOME = 'yos://accueil';
  const DEFAULT_BOOKMARKS = [
    { title: 'Mon CV original', url: '../index.html' },
    { title: 'Carte de visite', url: '../visite.html' },
    { title: 'Wikipédia', url: 'https://fr.wikipedia.org/wiki/Wikip%C3%A9dia:Accueil_principal' },
    { title: 'Carte de Lille', url: 'https://www.openstreetmap.org/export/embed.html?bbox=2.99%2C50.60%2C3.12%2C50.66&layer=mapnik' }
  ];

  function startPage(token) {
    const tiles = [
      ['Mon CV original', '../index.html', '📄', '#7c6cff'],
      ['Carte de visite', '../visite.html', '🪪', '#06b6d4'],
      ['Wikipédia', 'https://fr.wikipedia.org/wiki/Wikip%C3%A9dia:Accueil_principal', '📚', '#64748b'],
      ['Lille (carte)', 'https://www.openstreetmap.org/export/embed.html?bbox=2.99%2C50.60%2C3.12%2C50.66&layer=mapnik', '🗺️', '#10b981'],
      ['EPSI', 'https://fr.wikipedia.org/wiki/%C3%89cole_priv%C3%A9e_des_sciences_informatiques', '🎓', '#f59e0b'],
      ['Example.com', 'https://example.com', '🌐', '#ec4899']
    ];
    const hour = new Date().getHours();
    const hello = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(at 20% 10%,#4f46e5 0,transparent 50%),radial-gradient(at 90% 90%,#0891b2 0,transparent 50%),#0b1022;color:#fff;display:flex;flex-direction:column;align-items:center;padding:8vh 20px 40px}
      h1{font-weight:300;font-size:42px;margin:0 0 6px}p{opacity:.7;margin:0 0 28px}
      form{width:min(560px,100%);display:flex;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:28px;overflow:hidden;backdrop-filter:blur(10px)}
      input{flex:1;border:none;background:transparent;color:#fff;font-size:16px;padding:14px 20px;outline:none}input::placeholder{color:rgba(255,255,255,.6)}
      button{border:none;background:rgba(255,255,255,.18);color:#fff;padding:0 20px;font-size:15px;cursor:pointer}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:14px;width:min(640px,100%);margin-top:40px}
      a{display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 8px;border-radius:16px;color:#fff;text-decoration:none;font-size:13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);transition:transform .15s,background .15s;text-align:center}
      a:hover{transform:translateY(-3px);background:rgba(255,255,255,.14)}
      .ic{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px}
      .foot{margin-top:auto;padding-top:40px;font-size:12px;opacity:.5}
    </style></head><body>
      <h1>${hello} 👋</h1><p>Navigateur YohannOS — recherche sur Wikipédia ou saisis une adresse</p>
      <form id="f"><input id="q" placeholder="Rechercher ou saisir une adresse" autofocus><button>Rechercher</button></form>
      <div class="grid">${tiles.map(t => `<a href="#" data-url="${t[1]}"><span class="ic" style="background:${t[3]}">${t[2]}</span>${t[0]}</a>`).join('')}</div>
      <div class="foot">Astuce : certains sites (Google, YouTube…) refusent de s'afficher dans une fenêtre intégrée.</div>
      <script>
        var T=${JSON.stringify(token)};
        function go(u){parent.postMessage({__yosNav:T,url:u},'*')}
        document.getElementById('f').onsubmit=function(e){e.preventDefault();var v=document.getElementById('q').value.trim();if(v)go(v)};
        document.querySelectorAll('a[data-url]').forEach(function(a){a.onclick=function(e){e.preventDefault();go(a.dataset.url)}});
      <\/script></body></html>`;
  }

  function normalizeUrl(input) {
    let v = input.trim();
    if (!v) return HOME;
    if (/^yos:\/\//i.test(v)) return v.toLowerCase();
    if (/^(https?:)?\/\//i.test(v) || /^\.{0,2}\//.test(v) || /\.html?(\?|#|$)/i.test(v) && !/\s/.test(v)) return v.startsWith('//') ? 'https:' + v : v;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) && !/\s/.test(v)) return 'https://' + v;
    if (/^localhost(:\d+)?/.test(v)) return 'http://' + v;
    return 'https://fr.wikipedia.org/w/index.php?search=' + encodeURIComponent(v);
  }
  const isExternal = url => /^https?:\/\//i.test(url) && !url.startsWith(location.origin);

  function launch(args) {
    const tabs = [];
    let active = null;
    let bookmarks = U.store.get('browser-bookmarks', DEFAULT_BOOKMARKS);

    const tabStrip = el('div.br-tabs');
    const newTabBtn = el('button.br-newtab', { title: 'Nouvel onglet (Ctrl+T)', html: Y.icons.svg('plus', 15), onclick: () => addTab(HOME) });
    const bBack = el('button.btn.ghost.sm.icon', { title: 'Précédent', html: Y.icons.svg('arrowLeft', 16), onclick: () => nav(-1) });
    const bFwd = el('button.btn.ghost.sm.icon', { title: 'Suivant', html: Y.icons.svg('arrowRight', 16), onclick: () => nav(1) });
    const bReload = el('button.btn.ghost.sm.icon', { title: 'Actualiser', html: Y.icons.svg('refresh', 15), onclick: () => reload() });
    const bHome = el('button.btn.ghost.sm.icon', { title: 'Accueil', html: Y.icons.svg('home', 15), onclick: () => go(HOME) });
    const lockIco = el('span.br-lock');
    const addr = el('input.br-addr', { spellcheck: 'false', placeholder: 'Rechercher ou saisir une adresse' });
    const star = el('button.btn.ghost.sm.icon', { title: 'Ajouter aux favoris', onclick: () => toggleBookmark() });
    const bExt = el('button.btn.ghost.sm.icon', { title: 'Ouvrir dans un vrai onglet', html: Y.icons.svg('external', 15), onclick: () => { const t = active; if (t && !t.url.startsWith('yos://')) window.open(new URL(t.url, location.href).href, '_blank', 'noopener'); } });
    const bar = el('div.br-bar', bBack, bFwd, bReload, bHome, el('div.br-addr-wrap', lockIco, addr, star), bExt);
    const bmBar = el('div.br-bookmarks');
    const info = el('div.br-info.hidden');
    const frames = el('div.br-frames');
    const loader = el('div.br-loader');
    const content = el('div.br', el('div.br-top', tabStrip, newTabBtn), bar, bmBar, info, loader, frames);
    const win = Y.apps.window('browser', { content, width: 980, height: 640, minWidth: 420, minHeight: 300 });

    function renderBookmarks() {
      bmBar.innerHTML = '';
      bookmarks.forEach((b, i) => {
        const btn = el('button.br-bm', { html: Y.icons.svg(b.url.startsWith('http') ? 'globe' : 'fileText', 13) + `<span>${U.escape(b.title)}</span>`, title: b.url });
        btn.addEventListener('click', e => (e.ctrlKey || e.button === 1) ? addTab(b.url) : go(b.url));
        btn.addEventListener('contextmenu', e => {
          e.preventDefault();
          Y.menu.show(e.clientX, e.clientY, [
            { label: 'Ouvrir', action: () => go(b.url) },
            { label: 'Ouvrir dans un nouvel onglet', action: () => addTab(b.url) },
            { label: 'Renommer', icon: 'edit', action: async () => { const n = await Y.dialog.prompt('Nom du favori :', { value: b.title, parent: win }); if (n) { b.title = n; saveBm(); } } },
            { label: 'Supprimer', icon: 'trash', danger: true, action: () => { bookmarks.splice(i, 1); saveBm(); } }
          ]);
        });
        bmBar.appendChild(btn);
      });
    }
    function saveBm() { U.store.set('browser-bookmarks', bookmarks); renderBookmarks(); updateBar(); }
    function toggleBookmark() {
      const t = active;
      if (!t || t.url === HOME) return;
      const i = bookmarks.findIndex(b => b.url === t.url);
      if (i >= 0) bookmarks.splice(i, 1); else bookmarks.push({ title: (t.title || t.url).slice(0, 30), url: t.url });
      saveBm();
    }

    function addTab(url, background) {
      const t = { id: U.uid('t'), url: '', title: 'Nouvel onglet', history: [], index: -1, token: U.uid('nav') };
      t.frame = el('iframe.br-frame', { sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads', referrerpolicy: 'no-referrer', allow: 'fullscreen' });
      t.frame.addEventListener('load', () => onLoad(t));
      t.tabEl = el('div.br-tab', el('span.br-fav', { html: Y.icons.svg('globe', 13) }), el('span.br-tab-title', t.title),
        el('button.br-tab-x', { title: 'Fermer l\'onglet', html: Y.icons.svg('x', 12), onclick: e => { e.stopPropagation(); closeTab(t); } }));
      t.tabEl.addEventListener('click', () => activate(t));
      t.tabEl.addEventListener('auxclick', e => { if (e.button === 1) closeTab(t); });
      tabStrip.appendChild(t.tabEl);
      frames.appendChild(t.frame);
      tabs.push(t);
      if (!background || !active) activate(t);
      load(t, normalizeUrl(url || HOME), true);
      return t;
    }
    function closeTab(t) {
      const i = tabs.indexOf(t);
      tabs.splice(i, 1);
      t.tabEl.remove(); t.frame.remove();
      if (!tabs.length) { win.close(); return; }
      if (active === t) activate(tabs[Math.min(i, tabs.length - 1)]);
    }
    function activate(t) {
      active = t;
      tabs.forEach(x => { x.tabEl.classList.toggle('active', x === t); x.frame.classList.toggle('hidden', x !== t); });
      updateBar();
      t.tabEl.scrollIntoView({ inline: 'nearest' });
    }
    function load(t, url, push) {
      if (push) { t.history = t.history.slice(0, t.index + 1); t.history.push(url); t.index = t.history.length - 1; }
      t.url = url;
      t.loading = true;
      if (url === HOME) { t.frame.removeAttribute('src'); t.frame.srcdoc = startPage(t.token); t.title = 'Accueil'; }
      else { t.frame.removeAttribute('srcdoc'); t.frame.src = url; t.title = isExternal(url) ? hostOf(url) : url.split('/').pop() || url; }
      updateTab(t);
      if (t === active) updateBar();
      clearTimeout(t.slowT);
      t.slowT = setTimeout(() => { if (t.loading) { t.loading = false; updateTab(t); if (t === active) updateBar(); } }, 8000);
    }
    function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
    function onLoad(t) {
      t.loading = false;
      try {
        const loc = t.frame.contentWindow.location.href;
        const title = t.frame.contentDocument && t.frame.contentDocument.title;
        if (loc && loc !== 'about:srcdoc' && loc !== 'about:blank' && t.url !== HOME) {
          const rel = loc.startsWith(location.origin) ? relativize(loc) : loc;
          if (rel !== t.url) { t.url = rel; t.history[t.index] = rel; }
        }
        if (title && t.url !== HOME) t.title = title;
      } catch (e) { /* page d'une autre origine */ }
      updateTab(t);
      if (t === active) updateBar();
    }
    function relativize(abs) {
      const base = location.href.replace(/[^/]*$/, '');
      const parent = base.replace(/[^/]+\/$/, '');
      if (abs.startsWith(base)) return abs.slice(base.length);
      if (abs.startsWith(parent)) return '../' + abs.slice(parent.length);
      return abs;
    }
    function updateTab(t) {
      t.tabEl.querySelector('.br-tab-title').textContent = t.title || 'Sans titre';
      t.tabEl.title = t.title;
      t.tabEl.querySelector('.br-fav').innerHTML = t.loading ? '<span class="spinner" style="width:12px;height:12px;border-width:2px"></span>' : Y.icons.svg(t.url === HOME ? 'home' : isExternal(t.url) ? 'globe' : 'fileText', 13);
    }
    function updateBar() {
      const t = active;
      if (!t) return;
      if (document.activeElement !== addr) addr.value = t.url === HOME ? '' : t.url;
      bBack.disabled = t.index <= 0;
      bFwd.disabled = t.index >= t.history.length - 1;
      const secure = t.url.startsWith('https://') || t.url.startsWith('yos://') || !isExternal(t.url);
      lockIco.innerHTML = Y.icons.svg(t.url === HOME ? 'search' : secure ? 'lock' : 'alert', 13);
      lockIco.title = t.url === HOME ? '' : secure ? 'Connexion sécurisée' : 'Connexion non sécurisée';
      const bm = bookmarks.some(b => b.url === t.url);
      star.innerHTML = `<svg class="ico" width="15" height="15" viewBox="0 0 24 24" fill="${bm ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${Y.icons.glyphs.star}</svg>`;
      star.style.color = bm ? '#ffb547' : '';
      star.disabled = t.url === HOME;
      info.classList.toggle('hidden', !isExternal(t.url));
      if (isExternal(t.url)) {
        info.innerHTML = '';
        info.append(el('span', { html: Y.icons.svg('info', 14) }), el('span.grow', 'Si la page reste blanche, ce site interdit l\'affichage dans une fenêtre intégrée.'),
          el('button.btn.sm', { onclick: () => window.open(t.url, '_blank', 'noopener') }, 'Ouvrir dans un vrai onglet'),
          el('button.btn.sm.ghost.icon', { html: Y.icons.svg('x', 13), onclick: () => info.classList.add('hidden') }));
      }
      loader.classList.toggle('on', !!t.loading);
      win.setTitle(`${t.title || 'Navigateur'} — Navigateur`);
    }
    function go(input) { if (active) load(active, normalizeUrl(input), true); }
    function nav(d) {
      const t = active;
      const ni = t.index + d;
      if (ni < 0 || ni >= t.history.length) return;
      t.index = ni;
      load(t, t.history[ni], false);
    }
    function reload() { if (active) load(active, active.url, false); }

    addr.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { go(addr.value); addr.blur(); }
      if (e.key === 'Escape') { addr.blur(); updateBar(); }
    });
    addr.addEventListener('focus', () => setTimeout(() => addr.select(), 0));
    addr.addEventListener('blur', () => updateBar());
    const onMsg = e => {
      const t = tabs.find(x => e.source === x.frame.contentWindow);
      if (t && e.data && e.data.__yosNav === t.token) { activate(t); load(t, normalizeUrl(e.data.url), true); }
    };
    window.addEventListener('message', onMsg);
    win.on('close', () => window.removeEventListener('message', onMsg));
    win.el.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 't') { e.preventDefault(); addTab(HOME); }
      else if (ctrl && k === 'w' && !e.altKey) { e.preventDefault(); active && closeTab(active); }
      else if (ctrl && k === 'l') { e.preventDefault(); addr.focus(); }
      else if (k === 'f5' || (ctrl && k === 'r')) { e.preventDefault(); reload(); }
      else if (e.altKey && k === 'arrowleft') nav(-1);
      else if (e.altKey && k === 'arrowright') nav(1);
    });

    renderBookmarks();
    addTab(args.url || HOME);
    win.openUrl = url => addTab(url);
    return win;
  }

  Y.apps.register({
    id: 'browser', name: 'Navigateur', icon: 'globe', color: ['#43cea2', '#185a9d'], category: 'Internet',
    description: 'Naviguer sur le web avec des onglets', keywords: 'web internet browser chrome firefox',
    desktop: true, desktopOrder: 4, single: true, launch,
    onReopen(win, args) { if (args.url && win.openUrl) win.openUrl(args.url); }
  });
})(window.YOS);
