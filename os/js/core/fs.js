/* =========================================================
   YohannOS — système de fichiers virtuel (persisté)
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U;
  const KEY = 'fs';
  const HOME = '/home/yohann';
  const TRASH = HOME + '/.corbeille';
  let root = null;

  const now = () => Date.now();
  const dir = (children = {}) => ({ type: 'dir', children, ctime: now(), mtime: now() });
  const file = (content = '', extra) => Object.assign({ type: 'file', content, ctime: now(), mtime: now() }, extra || {});

  /* ---------- Chemins ---------- */
  function normalize(path, cwd = HOME) {
    if (path == null || path === '') path = cwd;
    path = String(path);
    if (path === '~' || path.startsWith('~/')) path = HOME + path.slice(1);
    if (!path.startsWith('/')) path = (cwd.endsWith('/') ? cwd : cwd + '/') + path;
    const out = [];
    for (const seg of path.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') out.pop(); else out.push(seg);
    }
    return '/' + out.join('/');
  }
  const basename = p => { const n = normalize(p); return n === '/' ? '/' : n.slice(n.lastIndexOf('/') + 1); };
  const dirname = p => { const n = normalize(p); const i = n.lastIndexOf('/'); return i <= 0 ? '/' : n.slice(0, i); };
  const join = (...parts) => normalize(parts.join('/'), '/');
  const ext = p => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };
  const stem = p => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(0, i) : b; };
  const pretty = p => { const n = normalize(p); return n === HOME ? '~' : n.startsWith(HOME + '/') ? '~' + n.slice(HOME.length) : n; };

  function err(msg, code) { const e = new Error(msg); e.code = code; return e; }

  function getNode(path) {
    const n = normalize(path);
    if (n === '/') return root;
    let cur = root;
    for (const seg of n.slice(1).split('/')) {
      if (!cur || cur.type !== 'dir') return null;
      cur = cur.children[seg];
    }
    return cur || null;
  }
  function parentOf(path) {
    const p = getNode(dirname(path));
    if (!p) throw err(`Dossier introuvable : ${pretty(dirname(path))}`, 'ENOENT');
    if (p.type !== 'dir') throw err(`${pretty(dirname(path))} n'est pas un dossier`, 'ENOTDIR');
    return p;
  }
  function validName(name) {
    if (!name || name === '.' || name === '..' || name.includes('/')) throw err(`Nom invalide : « ${name} »`, 'EINVAL');
    if (name.length > 120) throw err('Nom trop long', 'EINVAL');
  }
  function isProtected(path) {
    const n = normalize(path);
    return ['/', '/home', HOME, TRASH, '/etc', '/bin', '/tmp'].includes(n);
  }

  /* ---------- Persistance ---------- */
  const persist = U.debounce(() => {
    if (!U.store.set(KEY, root)) {
      Y.notify && Y.notify({ title: 'Stockage plein', body: 'Impossible d\'enregistrer le système de fichiers : le stockage du navigateur est plein. Supprimez des images volumineuses.', icon: 'alert', type: 'error' });
    }
  }, 300);

  function changed(path) {
    persist();
    Y.bus.emit('fs:change', normalize(path));
  }

  /* ---------- API ---------- */
  const fs = {
    HOME, TRASH, normalize, basename, dirname, join, ext, stem, pretty,

    init() {
      root = U.store.get(KEY, null);
      if (!root || root.type !== 'dir') { root = seed(); U.store.set(KEY, root); }
      // garantir les dossiers essentiels
      for (const d of ['/home', HOME, HOME + '/Bureau', HOME + '/Documents', HOME + '/Images', HOME + '/Musique', HOME + '/Téléchargements', TRASH, '/tmp', '/etc']) {
        if (!getNode(d)) fs.mkdir(d, { recursive: true, silent: true });
      }
    },

    stat(path) {
      const n = getNode(path);
      if (!n) return null;
      return {
        path: normalize(path), name: basename(path), type: n.type,
        isDir: n.type === 'dir', size: n.type === 'dir' ? Object.keys(n.children).length : fs.sizeOf(n),
        ctime: n.ctime, mtime: n.mtime, url: n.url || null, meta: n.meta || null
      };
    },
    exists: path => !!getNode(path),
    isDir: path => { const n = getNode(path); return !!n && n.type === 'dir'; },
    isFile: path => { const n = getNode(path); return !!n && n.type === 'file'; },
    sizeOf(n) {
      if (n.type === 'file') return n.content ? (n.content.startsWith('data:') ? Math.round(n.content.length * 0.75) : new Blob([n.content]).size) : (n.size || 0);
      return Object.values(n.children).reduce((s, c) => s + fs.sizeOf(c), 0);
    },

    readdir(path, opts = {}) {
      const n = getNode(path);
      if (!n) throw err(`Dossier introuvable : ${pretty(path)}`, 'ENOENT');
      if (n.type !== 'dir') throw err(`${pretty(path)} n'est pas un dossier`, 'ENOTDIR');
      const base = normalize(path);
      let list = Object.keys(n.children).map(name => {
        const c = n.children[name];
        return {
          name, path: (base === '/' ? '' : base) + '/' + name, type: c.type, isDir: c.type === 'dir',
          size: c.type === 'dir' ? Object.keys(c.children).length : fs.sizeOf(c), mtime: c.mtime, ctime: c.ctime, url: c.url || null, meta: c.meta || null
        };
      });
      if (!opts.all) list = list.filter(e => !e.name.startsWith('.'));
      list.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));
      return list;
    },

    readFile(path) {
      const n = getNode(path);
      if (!n) throw err(`Fichier introuvable : ${pretty(path)}`, 'ENOENT');
      if (n.type === 'dir') throw err(`${pretty(path)} est un dossier`, 'EISDIR');
      return n.content || '';
    },

    /** URL utilisable dans <img src> (data: ou lien relatif) */
    getUrl(path) {
      const n = getNode(path);
      if (!n || n.type !== 'file') return null;
      if (n.url) return n.url;
      if (n.content && n.content.startsWith('data:')) return n.content;
      return null;
    },

    writeFile(path, content, opts = {}) {
      const p = normalize(path);
      const parent = parentOf(p);
      const name = basename(p);
      validName(name);
      const existing = parent.children[name];
      if (existing && existing.type === 'dir') throw err(`${pretty(p)} est un dossier`, 'EISDIR');
      if (existing) {
        existing.content = String(content);
        existing.mtime = now();
        delete existing.url;
      } else {
        parent.children[name] = file(String(content), opts.extra);
      }
      parent.mtime = now();
      if (!opts.silent) changed(dirname(p));
      return p;
    },

    appendFile(path, content) {
      const prev = fs.exists(path) ? fs.readFile(path) : '';
      return fs.writeFile(path, prev + content);
    },

    mkdir(path, opts = {}) {
      const p = normalize(path);
      if (getNode(p)) {
        if (opts.recursive) return p;
        throw err(`Existe déjà : ${pretty(p)}`, 'EEXIST');
      }
      if (opts.recursive && !getNode(dirname(p))) fs.mkdir(dirname(p), { recursive: true, silent: true });
      const parent = parentOf(p);
      validName(basename(p));
      parent.children[basename(p)] = dir();
      parent.mtime = now();
      if (!opts.silent) changed(dirname(p));
      return p;
    },

    rm(path, opts = {}) {
      const p = normalize(path);
      if (isProtected(p)) throw err(`Opération refusée : ${pretty(p)} est protégé`, 'EPERM');
      const n = getNode(p);
      if (!n) throw err(`Introuvable : ${pretty(p)}`, 'ENOENT');
      if (n.type === 'dir' && Object.keys(n.children).length && !opts.recursive) throw err(`Le dossier ${pretty(p)} n'est pas vide`, 'ENOTEMPTY');
      const parent = parentOf(p);
      delete parent.children[basename(p)];
      parent.mtime = now();
      Y.desktopPositions && Y.desktopPositions.forget(p);
      if (!opts.silent) changed(dirname(p));
    },

    move(src, dest, opts = {}) {
      const s = normalize(src);
      let d = normalize(dest);
      if (isProtected(s)) throw err(`Opération refusée : ${pretty(s)} est protégé`, 'EPERM');
      const n = getNode(s);
      if (!n) throw err(`Introuvable : ${pretty(s)}`, 'ENOENT');
      if (fs.isDir(d)) d = join(d, basename(s));
      if (d === s) return d;
      if (d.startsWith(s + '/')) throw err('Impossible de déplacer un dossier dans lui-même', 'EINVAL');
      if (getNode(d)) {
        if (!opts.overwrite) throw err(`Existe déjà : ${pretty(d)}`, 'EEXIST');
        fs.rm(d, { recursive: true, silent: true });
      }
      const dp = parentOf(d);
      validName(basename(d));
      const sp = parentOf(s);
      delete sp.children[basename(s)];
      dp.children[basename(d)] = n;
      n.mtime = now();
      sp.mtime = dp.mtime = now();
      Y.desktopPositions && Y.desktopPositions.rename(s, d);
      if (!opts.silent) { changed(dirname(s)); if (dirname(s) !== dirname(d)) changed(dirname(d)); }
      return d;
    },

    rename(path, newName) {
      validName(newName);
      return fs.move(path, join(dirname(path), newName));
    },

    copy(src, dest) {
      const s = normalize(src);
      let d = normalize(dest);
      const n = getNode(s);
      if (!n) throw err(`Introuvable : ${pretty(s)}`, 'ENOENT');
      if (fs.isDir(d)) d = join(d, basename(s));
      if (d.startsWith(s + '/')) throw err('Impossible de copier un dossier dans lui-même', 'EINVAL');
      if (getNode(d)) d = fs.uniqueName(dirname(d), basename(d));
      const dp = parentOf(d);
      const clone = JSON.parse(JSON.stringify(n));
      const stamp = c => { c.ctime = c.mtime = now(); if (c.type === 'dir') Object.values(c.children).forEach(stamp); };
      stamp(clone);
      dp.children[basename(d)] = clone;
      changed(dirname(d));
      return d;
    },

    /** Renvoie un chemin libre : "Nouveau dossier (2)" */
    uniqueName(dirPath, name) {
      const base = normalize(dirPath);
      if (!getNode(join(base, name))) return join(base, name);
      const i = name.lastIndexOf('.');
      const hasExt = i > 0 && !fs.isDir(join(base, name));
      const s = hasExt ? name.slice(0, i) : name, e = hasExt ? name.slice(i) : '';
      for (let k = 2; k < 1000; k++) {
        const cand = join(base, `${s} (${k})${e}`);
        if (!getNode(cand)) return cand;
      }
      return join(base, U.uid() + e);
    },

    /* ---------- Corbeille ---------- */
    trash(path) {
      const p = normalize(path);
      if (p.startsWith(TRASH + '/')) { fs.rm(p, { recursive: true }); return null; }
      if (isProtected(p)) throw err(`Opération refusée : ${pretty(p)} est protégé`, 'EPERM');
      const target = fs.uniqueName(TRASH, basename(p));
      fs.move(p, target, { silent: true });
      const n = getNode(target);
      n.meta = Object.assign({}, n.meta, { origin: p, deleted: now() });
      changed(dirname(p));
      changed(TRASH);
      Y.bus.emit('trash:change');
      return target;
    },
    restore(trashPath) {
      const n = getNode(trashPath);
      if (!n) throw err('Élément introuvable dans la corbeille', 'ENOENT');
      const origin = (n.meta && n.meta.origin) || join(HOME, basename(trashPath));
      if (!fs.exists(dirname(origin))) fs.mkdir(dirname(origin), { recursive: true, silent: true });
      const dest = fs.exists(origin) ? fs.uniqueName(dirname(origin), basename(origin)) : origin;
      fs.move(trashPath, dest, { silent: true });
      if (n.meta) { delete n.meta.origin; delete n.meta.deleted; }
      changed(TRASH);
      changed(dirname(dest));
      Y.bus.emit('trash:change');
      return dest;
    },
    emptyTrash() {
      const t = getNode(TRASH);
      t.children = {};
      changed(TRASH);
      Y.bus.emit('trash:change');
    },
    trashCount: () => { const t = getNode(TRASH); return t ? Object.keys(t.children).length : 0; },

    /* ---------- Recherche ---------- */
    find(start = '/', pred = () => true, limit = 500) {
      const out = [];
      const walk = (p, n) => {
        if (out.length >= limit) return;
        if (n.type === 'dir') {
          for (const name of Object.keys(n.children)) {
            const cp = (p === '/' ? '' : p) + '/' + name;
            const c = n.children[name];
            if (pred(name, cp, c)) out.push(cp);
            walk(cp, c);
          }
        }
      };
      const n = getNode(start);
      if (n) walk(normalize(start), n);
      return out;
    },

    tree(path, opts = {}) {
      const lines = [];
      const walk = (p, prefix, depth) => {
        const entries = fs.readdir(p, { all: opts.all });
        entries.forEach((e, i) => {
          const last = i === entries.length - 1;
          lines.push(prefix + (last ? '└── ' : '├── ') + e.name + (e.isDir ? '/' : ''));
          if (e.isDir && depth < (opts.maxDepth || 8)) walk(e.path, prefix + (last ? '    ' : '│   '), depth + 1);
        });
      };
      walk(normalize(path), '', 0);
      return lines;
    },

    usage: () => U.store.size(),

    exportJSON: () => JSON.stringify({ format: 'yohannos-backup', version: 1, date: new Date().toISOString(), fs: root, settings: U.store.get('settings', {}) }, null, 1),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || data.format !== 'yohannos-backup' || !data.fs || data.fs.type !== 'dir') throw err('Fichier de sauvegarde invalide', 'EINVAL');
      root = data.fs;
      U.store.set(KEY, root);
      if (data.settings) U.store.set('settings', data.settings);
      Y.bus.emit('fs:change', '/');
    },
    reset() { root = seed(); U.store.set(KEY, root); Y.bus.emit('fs:change', '/'); },
    _root: () => root
  };

  /* ---------- Contenu initial ---------- */
  function seed() {
    const welcome = `Bienvenue sur YohannOS !
=======================

YohannOS est un système d'exploitation complet qui tourne
entièrement dans ton navigateur. Tout ce que tu crées ici
(fichiers, dessins, réglages) est sauvegardé localement.

Quelques idées pour commencer :

  • Double-clique sur « À propos de moi » pour découvrir mon profil
  • Ouvre le Terminal et tape « help » (ou « neofetch » !)
  • Dessine quelque chose dans Paint et enregistre-le dans Images
  • Écris du HTML/CSS/JS dans Code Studio avec aperçu en direct
  • Joue au Démineur, au Snake ou au Casse-briques
  • Compose un rythme dans le Studio musique
  • Clic droit sur le Bureau pour changer le fond d'écran

Raccourcis clavier :
  Ctrl + K          Recherche / palette de commandes
  Ctrl + Alt + T    Ouvrir un terminal
  Ctrl + Alt + E    Ouvrir l'explorateur de fichiers
  Ctrl + Alt + D    Afficher le bureau
  Ctrl + Alt + L    Verrouiller la session
  Ctrl + Alt + W    Fermer la fenêtre active

Bonne visite !
— Yohann
`;
    const cv = `# Yohann Marant

**Étudiant en informatique à l'EPSI Lille** — promotion 2024/2025

## Formation

- **2024 – aujourd'hui** : Étudiant à l'[EPSI](https://www.epsi.fr/campus/campus-de-lille/), campus de Lille
- **Baccalauréat général** : spécialités *Mathématiques* et *NSI*
- **Lycée Ozanam**, Lille

## Compétences

- Développement web : HTML, CSS, JavaScript, PHP
- Programmation : Python (NSI), algorithmique
- Outils : Git, GitHub, VS Code

## Centres d'intérêt

- 🏋️ Salle de sport
- 🎮 Jeux vidéo
- 🤝 Activités entre amis

## Contact

Ouvre l'application **Contact** pour m'envoyer un message.

> Ce site est lui-même un projet : un OS complet codé en HTML, CSS et JavaScript, sans aucune bibliothèque.
`;
    const notes = `Notes de cours — EPSI
---------------------

[Algo]
- Complexité : O(1) < O(log n) < O(n) < O(n log n) < O(n²)
- Tri fusion = diviser pour régner, O(n log n)
- Recherche dichotomique sur tableau trié : O(log n)

[Web]
- HTML = structure, CSS = présentation, JS = comportement
- Le DOM est un arbre : document.querySelector('#id')
- Flexbox : display:flex; justify-content; align-items
- localStorage garde des données côté navigateur (≈ 5 Mo)

[Réseau]
- Modèle OSI : Physique, Liaison, Réseau, Transport, Session, Présentation, Application
- HTTP 200 = OK, 404 = introuvable, 500 = erreur serveur

[À faire]
- [x] Finir le CV en HTML
- [x] Ajouter un formulaire de contact
- [ ] Réviser les sous-réseaux (masques /24, /16…)
- [ ] Projet de groupe : maquette Figma
`;
    const demoHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ma page de démo</title>
  <style>
    body { font-family: sans-serif; display: grid; place-items: center; height: 100vh; margin: 0;
           background: linear-gradient(135deg, #7c6cff, #06b6d4); color: white; }
    .carte { background: rgba(255,255,255,.15); padding: 2em 3em; border-radius: 20px; text-align: center;
             backdrop-filter: blur(10px); box-shadow: 0 10px 40px rgba(0,0,0,.2); }
    button { font-size: 1.1em; padding: .6em 1.4em; border: none; border-radius: 30px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="carte">
    <h1>Salut 👋</h1>
    <p>Cette page a été ouverte depuis le système de fichiers de YohannOS.</p>
    <button onclick="this.textContent = 'Clics : ' + (++window.n || (window.n = 1))">Clique-moi</button>
  </div>
</body>
</html>
`;
    const script = `// Petit script JavaScript : suite de Fibonacci
function fibonacci(n) {
  const suite = [0, 1];
  for (let i = 2; i < n; i++) suite.push(suite[i - 1] + suite[i - 2]);
  return suite.slice(0, n);
}

console.log(fibonacci(15).join(', '));
`;
    const python = `# Exercice NSI : tri par insertion
def tri_insertion(t):
    for i in range(1, len(t)):
        cle = t[i]
        j = i - 1
        while j >= 0 and t[j] > cle:
            t[j + 1] = t[j]
            j -= 1
        t[j + 1] = cle
    return t

print(tri_insertion([5, 2, 9, 1, 7, 3]))
`;
    const seq = JSON.stringify({
      format: 'yos-seq', bpm: 110, steps: 16,
      tracks: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        bass: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
        lead1: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        lead2: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        lead3: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]
      }
    }, null, 1);

    return dir({
      bin: dir({ 'README': file('Les commandes du terminal sont intégrées au shell « ysh ».\nTape « help » dans le Terminal pour les voir.\n') }),
      etc: dir({
        hostname: file('yohannos\n'),
        motd: file('Bienvenue sur YohannOS 2.0 — tape « help » pour commencer.\n'),
        'os-release': file('NAME="YohannOS"\nVERSION="2.0 (Lille)"\nID=yohannos\nPRETTY_NAME="YohannOS 2.0"\nHOME_URL="https://ymarant.github.io/os/"\n')
      }),
      tmp: dir(),
      home: dir({
        yohann: dir({
          Bureau: dir({
            'Bienvenue.txt': file(welcome),
            'Mon CV original.url': file('../index.html'),
          }),
          Documents: dir({
            'CV.md': file(cv),
            'Notes de cours.txt': file(notes),
            Projets: dir({
              'demo.html': file(demoHtml),
              'fibonacci.js': file(script),
              'tri_insertion.py': file(python),
            }),
          }),
          Images: dir({
            'epsi.png': file('', { url: '../epsi1.png', size: 14480 }),
            'lille.png': file('', { url: '../Lille1.png', size: 38686 }),
          }),
          Musique: dir({ 'Rythme démo.seq': file(seq) }),
          'Téléchargements': dir(),
          '.corbeille': dir(),
          '.ysh_history': file(''),
        })
      })
    });
  }

  Y.fs = fs;
})(window.YOS);
