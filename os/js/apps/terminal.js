/* =========================================================
   YohannOS — Terminal (shell « ysh »)
   Pipes |, redirections > >>, enchaînements && ;, variables,
   jokers *, historique, autocomplétion (Tab), couleurs ANSI
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;
  const E = '\x1b[';
  const c = (code, s) => `${E}${code}m${s}${E}0m`;
  const blue = s => c('1;34', s), green = s => c('1;32', s), red = s => c('31', s), yellow = s => c('33', s),
    cyan = s => c('36', s), magenta = s => c('35', s), bold = s => c('1', s), dim = s => c('2', s);
  const stripAnsi = s => String(s).replace(/\x1b\[[\d;]*m/g, '');

  const ANSI_COLORS = { 30: '#3b3f4c', 31: '#ff6b7a', 32: '#3ddc97', 33: '#ffcb6b', 34: '#6cb6ff', 35: '#d38cff', 36: '#4dd8e6', 37: '#e6e6e6', 90: '#7b8195', 91: '#ff8a96', 92: '#6ef0b5', 93: '#ffe08a', 94: '#93c8ff', 95: '#e3adff', 96: '#8ae9f2', 97: '#ffffff' };
  function ansiToHtml(s) {
    let out = '', open = 0;
    const parts = String(s).split(/\x1b\[([\d;]*)m/);
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { out += U.escape(parts[i]); continue; }
      const codes = parts[i].split(';').map(Number);
      if (codes.includes(0) || parts[i] === '') { out += '</span>'.repeat(open); open = 0; continue; }
      const st = [];
      codes.forEach(k => {
        if (k === 1) st.push('font-weight:700');
        else if (k === 2) st.push('opacity:.6');
        else if (k === 3) st.push('font-style:italic');
        else if (k === 4) st.push('text-decoration:underline');
        else if (ANSI_COLORS[k]) st.push('color:' + ANSI_COLORS[k]);
        else if (k >= 40 && k <= 47) st.push('background:' + ANSI_COLORS[k - 10]);
      });
      out += `<span style="${st.join(';')}">`;
      open++;
    }
    return out + '</span>'.repeat(open);
  }

  /* ---------- Analyse de la ligne de commande ---------- */
  function tokenize(line, env) {
    const toks = [];
    let i = 0, cur = '', has = false, quoted = false, glob = false;
    const push = () => { if (has) toks.push({ t: 'w', v: cur, q: quoted, g: glob }); cur = ''; has = false; quoted = false; glob = false; };
    const expandVar = () => {
      let name = '';
      if (line[i + 1] === '{') { const j = line.indexOf('}', i); name = line.slice(i + 2, j); i = j + 1; }
      else if (line[i + 1] === '?') { name = '?'; i += 2; }
      else { const m = line.slice(i + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/); if (!m) { i++; return '$'; } name = m[0]; i += 1 + name.length; }
      return env[name] != null ? String(env[name]) : '';
    };
    while (i < line.length) {
      const ch = line[i];
      if (ch === '\\' && i + 1 < line.length) { cur += line[i + 1]; has = true; i += 2; continue; }
      if (ch === "'") { const j = line.indexOf("'", i + 1); if (j < 0) throw new Error('guillemet simple non fermé'); cur += line.slice(i + 1, j); has = true; quoted = true; i = j + 1; continue; }
      if (ch === '"') {
        i++; has = true; quoted = true;
        while (i < line.length && line[i] !== '"') {
          if (line[i] === '\\' && i + 1 < line.length) { cur += line[i + 1]; i += 2; }
          else if (line[i] === '$') cur += expandVar();
          else cur += line[i++];
        }
        if (line[i] !== '"') throw new Error('guillemet double non fermé');
        i++; continue;
      }
      if (ch === '$') { cur += expandVar(); has = true; continue; }
      if (/\s/.test(ch)) { push(); i++; continue; }
      if (ch === '|' && line[i + 1] === '|') { push(); toks.push({ t: 'op', v: '||' }); i += 2; continue; }
      if (ch === '&' && line[i + 1] === '&') { push(); toks.push({ t: 'op', v: '&&' }); i += 2; continue; }
      if (ch === '>' && line[i + 1] === '>') { push(); toks.push({ t: 'op', v: '>>' }); i += 2; continue; }
      if (ch === '|' || ch === '>' || ch === ';' || ch === '<') { push(); toks.push({ t: 'op', v: ch }); i++; continue; }
      if (ch === '~' && !has && (line[i + 1] === undefined || line[i + 1] === '/' || /\s/.test(line[i + 1]))) { cur += env.HOME; has = true; i++; continue; }
      if (ch === '*' || ch === '?') glob = true;
      cur += ch; has = true; i++;
    }
    push();
    return toks;
  }

  /** Découpe la ligne en segments séparés par && || ; (hors guillemets) */
  function splitSeq(line) {
    const out = [];
    let cur = '', q = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '\\' && i + 1 < line.length) { cur += ch + line[++i]; continue; }
      if (q) { if (ch === q) q = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if ((ch === '&' && line[i + 1] === '&') || (ch === '|' && line[i + 1] === '|')) { out.push({ text: cur, next: ch + ch }); cur = ''; i++; continue; }
      if (ch === ';') { out.push({ text: cur, next: ';' }); cur = ''; continue; }
      cur += ch;
    }
    if (q) throw new Error(q === '"' ? 'guillemet double non fermé' : 'guillemet simple non fermé');
    out.push({ text: cur, next: ';' });
    return out.filter(s => s.text.trim());
  }

  function globExpand(word, cwd) {
    const abs = FS.normalize(word, cwd);
    const dir = FS.dirname(abs), pat = FS.basename(abs);
    if (!/[*?]/.test(pat) || !FS.isDir(dir)) return [word];
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const prefix = word.includes('/') ? word.slice(0, word.lastIndexOf('/') + 1) : '';
    const matches = FS.readdir(dir).filter(e => re.test(e.name)).map(e => prefix + e.name);
    return matches.length ? matches : [word];
  }

  function parse(toks, cwd) {
    // → [{ pipeline:[{argv, out:{file,append}, inFile}], next:'&&'|'||'|';' }]
    const seqs = [];
    let pipeline = [], cmd = { argv: [] };
    const endCmd = () => { if (cmd.argv.length || cmd.out) pipeline.push(cmd); cmd = { argv: [] }; };
    const endSeq = op => { endCmd(); if (pipeline.length) seqs.push({ pipeline, next: op }); pipeline = []; };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'w') { if (t.g && !t.q) cmd.argv.push(...globExpand(t.v, cwd)); else cmd.argv.push(t.v); continue; }
      if (t.v === '|') { if (!cmd.argv.length) throw new Error('erreur de syntaxe près de « | »'); endCmd(); }
      else if (t.v === '>' || t.v === '>>') { const f = toks[++i]; if (!f || f.t !== 'w') throw new Error('erreur de syntaxe : fichier attendu après ' + t.v); cmd.out = { file: f.v, append: t.v === '>>' }; }
      else if (t.v === '<') { const f = toks[++i]; if (!f || f.t !== 'w') throw new Error('erreur de syntaxe : fichier attendu après <'); cmd.inFile = f.v; }
      else endSeq(t.v);
    }
    endSeq(';');
    return seqs;
  }

  function flags(args, allowed = '') {
    const f = new Set(), rest = [], opts = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { rest.push(...args.slice(i + 1)); break; }
      if (/^-n$/.test(a) && allowed.includes('N') && args[i + 1] != null) { opts.n = parseInt(args[++i], 10); continue; }
      if (/^-\d+$/.test(a) && allowed.includes('N')) { opts.n = parseInt(a.slice(1), 10); continue; }
      if (/^--name$/.test(a) || a === '-name') { opts.name = args[++i]; continue; }
      if (/^--?type$/.test(a)) { opts.type = args[++i]; continue; }
      if (a.length > 1 && a[0] === '-' && !/^-\d/.test(a)) { for (const ch of a.slice(1)) f.add(ch); continue; }
      rest.push(a);
    }
    return { f, rest, opts };
  }

  const FORTUNES = [
    'Il n\'y a que deux choses difficiles en informatique : l\'invalidation de cache et nommer les choses.',
    '« Ça marche sur ma machine. » — Tout développeur, un jour.',
    'Un bon code est son propre meilleur commentaire.',
    'Le premier 90 % du code prend 90 % du temps. Les 10 % restants prennent les autres 90 %.',
    'Tout programme suffisamment avancé contient au moins un bug.',
    'Petit à petit, l\'oiseau fait son nid.',
    'Les erreurs sont les portes de la découverte.',
    'Il y a 10 types de personnes : celles qui comprennent le binaire et les autres.',
    'Pourquoi les développeurs confondent-ils Halloween et Noël ? Parce que OCT 31 = DEC 25.',
    'Avant d\'optimiser, mesure.',
    'Le meilleur moment pour commencer était hier. Le deuxième meilleur, c\'est maintenant.',
    'git commit -m "correction de la correction de la correction"',
    'La simplicité est la sophistication suprême.',
    'Qui veut aller loin ménage sa monture.'
  ];

  const LOGO = [
    ' __      __ ',
    ' \\ \\    / / ',
    '  \\ \\  / /  ',
    '   \\ \\/ /   ',
    '    \\  /    ',
    '    |  |    ',
    '    |__|    '
  ];

  let pidCounter = 1000;
  const pids = new WeakMap();
  const pidOf = w => { if (!pids.has(w)) pids.set(w, ++pidCounter); return pids.get(w); };

  /* ---------- Commandes ---------- */
  const CMDS = {
    help: { desc: 'Affiche la liste des commandes', run(a) {
      if (a[0] && CMDS[a[0]]) return `${bold(a[0])} — ${CMDS[a[0]].desc}${CMDS[a[0]].usage ? '\nUsage : ' + CMDS[a[0]].usage : ''}`;
      const groups = {
        'Fichiers': ['ls', 'cd', 'pwd', 'cat', 'touch', 'mkdir', 'rm', 'rmdir', 'mv', 'cp', 'tree', 'find', 'du', 'nano', 'open', 'download', 'trash'],
        'Texte': ['echo', 'head', 'tail', 'wc', 'grep', 'sort', 'uniq', 'rev', 'seq', 'base64', 'sha256', 'json'],
        'Système': ['neofetch', 'whoami', 'hostname', 'uname', 'uptime', 'date', 'cal', 'ps', 'kill', 'apps', 'launch', 'df', 'free', 'env', 'export', 'alias', 'history', 'which', 'man', 'clear', 'exit'],
        'Personnalisation': ['theme', 'accent', 'wallpaper', 'notify'],
        'Réseau': ['weather', 'ping', 'curl'],
        'Fun': ['cowsay', 'fortune', 'sl', 'matrix', 'calc', 'coin', 'dice', 'screensaver', 'sudo'],
        'Session': ['lock', 'reboot', 'shutdown']
      };
      let s = bold('ysh — le shell de YohannOS') + '\n' + dim('Astuces : Tab pour compléter, ↑/↓ pour l\'historique, Ctrl+C pour annuler, Ctrl+L pour effacer.') + '\n' + dim('Opérateurs : cmd1 | cmd2, cmd > fichier, cmd >> fichier, cmd1 && cmd2, cmd1 ; cmd2') + '\n\n';
      for (const [g, list] of Object.entries(groups)) s += yellow(g) + '\n  ' + list.map(n => cyan(n.padEnd(11))).join('').replace(/(.{1,120})(\s|$)/g, '$1\n  ').trimEnd() + '\n';
      return s + '\n' + dim('Tape « help <commande> » ou « man <commande> » pour plus de détails.');
    } },
    man: { desc: 'Manuel d\'une commande', usage: 'man <commande>', run(a) {
      if (!a[0]) throw new Error('Quelle page de manuel voulez-vous ?');
      const k = CMDS[a[0]];
      if (!k) throw new Error(`Aucune entrée de manuel pour ${a[0]}`);
      return `${bold('NOM')}\n    ${a[0]} — ${k.desc}\n\n${bold('SYNOPSIS')}\n    ${k.usage || a[0]}\n`;
    } },
    clear: { desc: 'Efface l\'écran', run(a, x) { x.term.clear(); } },
    echo: { desc: 'Affiche du texte', usage: 'echo [-n] [-e] texte…', run(a) {
      const { f, rest } = flags(a, '');
      let s = rest.join(' ');
      if (f.has('e')) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return s + (f.has('n') ? '' : '\n');
    } },
    pwd: { desc: 'Affiche le dossier courant', run(a, x) { return x.sh.cwd; } },
    cd: { desc: 'Change de dossier', usage: 'cd [dossier | - | ~]', run(a, x) {
      let target = a[0] == null ? FS.HOME : a[0] === '-' ? (x.sh.env.OLDPWD || x.sh.cwd) : a[0];
      const p = FS.normalize(target, x.sh.cwd);
      if (!FS.exists(p)) throw new Error(`cd: ${target}: Aucun fichier ou dossier de ce type`);
      if (!FS.isDir(p)) throw new Error(`cd: ${target}: N'est pas un dossier`);
      x.sh.env.OLDPWD = x.sh.cwd;
      x.sh.cwd = p;
      x.sh.env.PWD = p;
      if (a[0] === '-') return p;
    } },
    ls: { desc: 'Liste le contenu d\'un dossier', usage: 'ls [-l] [-a] [-h] [-S] [-t] [chemin…]', run(a, x) {
      const { f, rest } = flags(a);
      const targets = rest.length ? rest : ['.'];
      const out = [];
      targets.forEach((t, ti) => {
        const p = FS.normalize(t, x.sh.cwd);
        const st = FS.stat(p);
        if (!st) throw new Error(`ls: impossible d'accéder à '${t}': Aucun fichier ou dossier de ce type`);
        let list = st.isDir ? FS.readdir(p, { all: f.has('a') }) : [{ name: t, path: p, isDir: false, size: st.size, mtime: st.mtime }];
        if (f.has('S')) list.sort((m, n) => n.size - m.size);
        if (f.has('t')) list.sort((m, n) => n.mtime - m.mtime);
        if (f.has('r')) list.reverse();
        if (targets.length > 1) out.push((ti ? '\n' : '') + t + ':');
        const color = e => e.isDir ? blue(e.name) : ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(FS.ext(e.name)) ? magenta(e.name) : ['sh', 'js', 'py'].includes(FS.ext(e.name)) ? green(e.name) : FS.ext(e.name) === 'url' ? cyan(e.name) : e.name;
        if (f.has('l')) {
          out.push(`total ${list.length}`);
          list.forEach(e => {
            const size = e.isDir ? 4096 : e.size;
            const sz = f.has('h') ? U.formatBytes(size).replace(' ', '') : String(size);
            const d = new Date(e.mtime);
            const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            out.push(`${e.isDir ? 'd' : '-'}rw${e.isDir ? 'x' : '-'}r-${e.isDir ? 'x' : '-'}r-${e.isDir ? 'x' : '-'} 1 yohann yohann ${sz.padStart(7)} ${date.padEnd(14)} ${color(e)}${e.isDir ? '/' : ''}`);
          });
        } else if (x.piped) {
          list.forEach(e => out.push(e.name));
        } else {
          out.push(list.map(e => color(e) + (e.isDir ? '/' : '')).join('  '));
        }
      });
      return out.join('\n');
    } },
    cat: { desc: 'Affiche le contenu de fichiers', usage: 'cat [-n] [fichier…]', run(a, x) {
      const { f, rest } = flags(a);
      let s = rest.length ? rest.map(t => readText(t, x)).join('') : (x.stdin || '');
      if (f.has('n')) s = s.split('\n').map((l, i) => `${String(i + 1).padStart(6)}  ${l}`).join('\n');
      return s;
    } },
    head: { desc: 'Premières lignes', usage: 'head [-n N] [fichier]', run(a, x) { const { rest, opts } = flags(a, 'N'); return input(rest, x).split('\n').slice(0, opts.n || 10).join('\n'); } },
    tail: { desc: 'Dernières lignes', usage: 'tail [-n N] [fichier]', run(a, x) { const { rest, opts } = flags(a, 'N'); const l = input(rest, x).replace(/\n$/, '').split('\n'); return l.slice(-(opts.n || 10)).join('\n'); } },
    wc: { desc: 'Compte lignes, mots et caractères', usage: 'wc [-l|-w|-c] [fichier]', run(a, x) {
      const { f, rest } = flags(a);
      const s = input(rest, x);
      const l = s ? s.replace(/\n$/, '').split('\n').length : 0, w = (s.match(/\S+/g) || []).length, ch = s.length;
      if (f.has('l')) return String(l);
      if (f.has('w')) return String(w);
      if (f.has('c')) return String(ch);
      return `${String(l).padStart(7)} ${String(w).padStart(7)} ${String(ch).padStart(7)}${rest[0] ? ' ' + rest[0] : ''}`;
    } },
    grep: { desc: 'Recherche un motif dans du texte', usage: 'grep [-i] [-n] [-v] [-c] [-r] motif [fichier…]', run(a, x) {
      const { f, rest } = flags(a);
      const pat = rest.shift();
      if (pat == null) throw new Error('usage : grep [options] motif [fichier…]');
      let re;
      try { re = new RegExp(pat, f.has('i') ? 'gi' : 'g'); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.has('i') ? 'gi' : 'g'); }
      const sources = [];
      if (!rest.length) sources.push(['', x.stdin || '']);
      rest.forEach(t => {
        const p = FS.normalize(t, x.sh.cwd);
        if (FS.isDir(p)) {
          if (!f.has('r')) throw new Error(`grep: ${t}: est un dossier`);
          FS.find(p, (n, fp, node) => node.type === 'file' && !node.url && !(node.content || '').startsWith('data:')).forEach(fp => sources.push([FS.pretty(fp), FS.readFile(fp)]));
        } else sources.push([rest.length > 1 || f.has('r') ? t : '', readText(t, x)]);
      });
      const out = [];
      let count = 0;
      sources.forEach(([name, text]) => {
        text.split('\n').forEach((line, i) => {
          re.lastIndex = 0;
          const m = re.test(line);
          if (m === f.has('v')) return;
          count++;
          if (f.has('c')) return;
          re.lastIndex = 0;
          const shown = f.has('v') || x.piped ? line : line.replace(re, s => red(bold(s)));
          out.push((name ? magenta(name) + ':' : '') + (f.has('n') ? green(i + 1) + ':' : '') + shown);
        });
      });
      if (f.has('c')) return String(count);
      if (!count) x.status = 1;
      return out.join('\n');
    } },
    sort: { desc: 'Trie des lignes', usage: 'sort [-r] [-n] [-u] [fichier]', run(a, x) {
      const { f, rest } = flags(a);
      let l = input(rest, x).replace(/\n$/, '').split('\n');
      l.sort(f.has('n') ? (p, q) => parseFloat(p) - parseFloat(q) : (p, q) => p.localeCompare(q, 'fr'));
      if (f.has('u')) l = [...new Set(l)];
      if (f.has('r')) l.reverse();
      return l.join('\n');
    } },
    uniq: { desc: 'Supprime les doublons consécutifs', usage: 'uniq [-c] [fichier]', run(a, x) {
      const { f, rest } = flags(a);
      const out = [];
      input(rest, x).replace(/\n$/, '').split('\n').forEach(l => {
        const last = out[out.length - 1];
        if (last && last.l === l) last.n++; else out.push({ l, n: 1 });
      });
      return out.map(o => f.has('c') ? `${String(o.n).padStart(7)} ${o.l}` : o.l).join('\n');
    } },
    rev: { desc: 'Inverse chaque ligne', run(a, x) { return input(a, x).split('\n').map(l => Array.from(l).reverse().join('')).join('\n'); } },
    seq: { desc: 'Affiche une suite de nombres', usage: 'seq [début] fin [pas]', run(a) {
      let [s, e, st] = a.length === 1 ? [1, +a[0], 1] : a.length === 2 ? [+a[0], +a[1], 1] : [+a[0], +a[2], +a[1]];
      if ([s, e, st].some(isNaN) || !st) throw new Error('seq: argument invalide');
      const out = [];
      for (let i = s; st > 0 ? i <= e : i >= e; i += st) { out.push(i); if (out.length > 10000) break; }
      return out.join('\n');
    } },
    touch: { desc: 'Crée un fichier vide', usage: 'touch fichier…', run(a, x) {
      if (!a.length) throw new Error('touch: opérande de fichier manquant');
      a.forEach(t => { const p = FS.normalize(t, x.sh.cwd); if (!FS.exists(p)) FS.writeFile(p, ''); });
    } },
    mkdir: { desc: 'Crée un dossier', usage: 'mkdir [-p] dossier…', run(a, x) {
      const { f, rest } = flags(a);
      if (!rest.length) throw new Error('mkdir: opérande manquant');
      rest.forEach(t => FS.mkdir(FS.normalize(t, x.sh.cwd), { recursive: f.has('p') }));
    } },
    rm: { desc: 'Supprime des fichiers', usage: 'rm [-r] [-f] fichier…', run(a, x) {
      const { f, rest } = flags(a);
      if (!rest.length) throw new Error('rm: opérande manquant');
      if (rest.some(t => FS.normalize(t, x.sh.cwd) === '/')) throw new Error('rm: Permission refusée. Bien essayé 😉 (essaie « sudo » pour voir…)');
      rest.forEach(t => {
        const p = FS.normalize(t, x.sh.cwd);
        if (!FS.exists(p)) { if (!f.has('f')) throw new Error(`rm: impossible de supprimer '${t}': Aucun fichier ou dossier de ce type`); return; }
        if (FS.isDir(p) && !f.has('r')) throw new Error(`rm: impossible de supprimer '${t}': est un dossier (utilisez -r)`);
        FS.rm(p, { recursive: true });
      });
    } },
    rmdir: { desc: 'Supprime un dossier vide', usage: 'rmdir dossier', run(a, x) { a.forEach(t => { const p = FS.normalize(t, x.sh.cwd); if (!FS.isDir(p)) throw new Error(`rmdir: '${t}': N'est pas un dossier`); FS.rm(p); }); } },
    trash: { desc: 'Met des fichiers à la corbeille', usage: 'trash fichier…', run(a, x) { a.forEach(t => FS.trash(FS.normalize(t, x.sh.cwd))); } },
    mv: { desc: 'Déplace ou renomme', usage: 'mv source… destination', run(a, x) {
      if (a.length < 2) throw new Error('mv: opérande manquant');
      const dest = FS.normalize(a[a.length - 1], x.sh.cwd);
      if (a.length > 2 && !FS.isDir(dest)) throw new Error(`mv: la cible '${a[a.length - 1]}' n'est pas un dossier`);
      a.slice(0, -1).forEach(s => FS.move(FS.normalize(s, x.sh.cwd), dest, { overwrite: true }));
    } },
    cp: { desc: 'Copie des fichiers', usage: 'cp [-r] source… destination', run(a, x) {
      const { f, rest } = flags(a);
      if (rest.length < 2) throw new Error('cp: opérande manquant');
      const dest = FS.normalize(rest[rest.length - 1], x.sh.cwd);
      rest.slice(0, -1).forEach(s => {
        const sp = FS.normalize(s, x.sh.cwd);
        if (FS.isDir(sp) && !f.has('r')) throw new Error(`cp: -r non spécifié ; omission du dossier '${s}'`);
        if (!FS.isDir(dest) && FS.isFile(sp) && FS.exists(dest)) FS.writeFile(dest, FS.readFile(sp));
        else FS.copy(sp, dest);
      });
    } },
    tree: { desc: 'Arborescence d\'un dossier', usage: 'tree [-a] [dossier]', run(a, x) {
      const { f, rest } = flags(a);
      const p = FS.normalize(rest[0] || '.', x.sh.cwd);
      if (!FS.isDir(p)) throw new Error(`tree: ${rest[0]}: n'est pas un dossier`);
      const lines = FS.tree(p, { all: f.has('a') });
      const dirs = lines.filter(l => l.endsWith('/')).length;
      return blue(rest[0] || '.') + '\n' + lines.map(l => l.endsWith('/') ? l.replace(/([^─ ]+\/)$/, m => blue(m)) : l).join('\n') + `\n\n${dirs} dossier(s), ${lines.length - dirs} fichier(s)`;
    } },
    find: { desc: 'Recherche des fichiers', usage: 'find [chemin] [-name motif] [-type f|d]', run(a, x) {
      const { rest, opts } = flags(a);
      const start = FS.normalize(rest[0] || '.', x.sh.cwd);
      const re = opts.name ? new RegExp('^' + opts.name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i') : null;
      const res = FS.find(start, (n, p, node) => (!re || re.test(n)) && (!opts.type || (opts.type === 'd') === (node.type === 'dir')), 1000);
      const base = rest[0] || '.';
      return res.map(p => base === '.' ? './' + p.slice(start.length + (start === '/' ? 0 : 1)) : p).join('\n');
    } },
    du: { desc: 'Taille d\'un dossier', usage: 'du [-h] [chemin]', run(a, x) {
      const { rest } = flags(a);
      const p = FS.normalize(rest[0] || '.', x.sh.cwd);
      const st = FS.stat(p);
      if (!st) throw new Error('du: introuvable');
      const n = FS.find(p, () => true, 5000).reduce((s, fp) => s + (FS.isFile(fp) ? FS.stat(fp).size : 0), FS.isFile(p) ? st.size : 0);
      return `${U.formatBytes(n)}\t${rest[0] || '.'}`;
    } },
    df: { desc: 'Espace de stockage', run() {
      const used = FS.usage(), total = 5 * 1024 * 1024;
      return `Sys. de fichiers   Taille  Utilisé  Dispo  Uti%  Monté sur\nlocalStorage       ${U.formatBytes(total).padEnd(7)} ${U.formatBytes(used).padEnd(8)} ${U.formatBytes(Math.max(0, total - used)).padEnd(6)} ${String(Math.round(used / total * 100)).padStart(3)}%  /`;
    } },
    free: { desc: 'Mémoire utilisée', run() {
      const m = performance.memory;
      if (!m) return `Mémoire de l'appareil : ${navigator.deviceMemory ? navigator.deviceMemory + ' Go' : 'inconnue'}\n(Détails non disponibles dans ce navigateur)`;
      return `              total       utilisé     libre\nTas JS :  ${U.formatBytes(m.jsHeapSizeLimit).padStart(10)}  ${U.formatBytes(m.usedJSHeapSize).padStart(10)}  ${U.formatBytes(m.jsHeapSizeLimit - m.usedJSHeapSize).padStart(10)}`;
    } },
    nano: { desc: 'Édite un fichier dans le Bloc-notes', usage: 'nano fichier', run(a, x) {
      if (!a[0]) { Y.apps.launch('notepad'); return; }
      const p = FS.normalize(a[0], x.sh.cwd);
      if (!FS.exists(p)) FS.writeFile(p, '');
      Y.apps.launch('notepad', { path: p });
      return dim(`Ouverture de ${FS.pretty(p)} dans le Bloc-notes…`);
    } },
    open: { desc: 'Ouvre un fichier avec l\'appli associée', usage: 'open fichier|dossier|url', run(a, x) {
      if (!a[0]) throw new Error('open: opérande manquant');
      if (/^https?:\/\//.test(a[0])) { Y.apps.launch('browser', { url: a[0] }); return; }
      Y.apps.openFile(FS.normalize(a[0], x.sh.cwd));
    } },
    download: { desc: 'Télécharge un fichier sur ton vrai ordinateur', usage: 'download fichier', run(a, x) {
      const p = FS.normalize(a[0] || '', x.sh.cwd);
      if (!FS.isFile(p)) throw new Error('download: fichier introuvable');
      Y.downloadFile(p);
      return green('✓ ') + 'Téléchargement lancé';
    } },
    history: { desc: 'Historique des commandes', usage: 'history [-c]', run(a, x) {
      if (a[0] === '-c') { x.sh.history = []; x.sh.saveHistory(); return; }
      return x.sh.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join('\n');
    } },
    date: { desc: 'Date et heure', run(a) { const d = new Date(); if (a[0] === '+%s') return String(Math.floor(d / 1000)); return U.capitalize(d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })); } },
    cal: { desc: 'Calendrier du mois', run() {
      const d = new Date(), y = d.getFullYear(), m = d.getMonth();
      const title = U.capitalize(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
      let s = title.padStart(Math.floor((20 + title.length) / 2)) + '\nLu Ma Me Je Ve Sa Di\n';
      const off = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      s += '   '.repeat(off);
      for (let i = 1; i <= days; i++) {
        const t = String(i).padStart(2);
        s += (i === d.getDate() ? c('7', t) : t) + ((i + off) % 7 === 0 ? '\n' : ' ');
      }
      return s;
    } },
    whoami: { desc: 'Nom d\'utilisateur', run: () => 'yohann' },
    hostname: { desc: 'Nom de la machine', run: () => 'yohannos' },
    uname: { desc: 'Informations système', usage: 'uname [-a]', run(a) { return a[0] === '-a' ? `YohannOS yohannos 2.0.0-lille #1 SMP ${new Date().getFullYear()} web-js ${navigator.platform || 'web'} GNU/Navigateur` : 'YohannOS'; } },
    uptime: { desc: 'Durée depuis le démarrage', run() { return `actif depuis ${U.formatDuration(Date.now() - Y.startTime)}, ${Y.wm.list().length} fenêtre(s) ouverte(s)`; } },
    neofetch: { desc: 'Infos système stylées', run() {
      const ua = navigator.userAgent;
      const browser = /Firefox\/(\d+)/.test(ua) ? 'Firefox ' + RegExp.$1 : /Edg\/(\d+)/.test(ua) ? 'Edge ' + RegExp.$1 : /Chrome\/(\d+)/.test(ua) ? 'Chromium ' + RegExp.$1 : /Safari/.test(ua) ? 'Safari' : 'Navigateur';
      const info = [
        green('yohann') + '@' + green('yohannos'),
        '-----------------',
        `${cyan('OS')}: YohannOS 2.0 (Lille)`,
        `${cyan('Hôte')}: ${browser}`,
        `${cyan('Noyau')}: JavaScript ES2020`,
        `${cyan('Uptime')}: ${U.formatDuration(Date.now() - Y.startTime)}`,
        `${cyan('Applis')}: ${Y.apps.all().length} installées`,
        `${cyan('Shell')}: ysh 1.0`,
        `${cyan('Résolution')}: ${screen.width}x${screen.height}`,
        `${cyan('Thème')}: ${Y.settings.effectiveTheme() === 'dark' ? 'Sombre' : 'Clair'} [${Y.settings.get('accent')}]`,
        `${cyan('Fond')}: ${(Y.settings.WALLPAPERS.find(w => w.id === Y.settings.get('wallpaper')) || { name: 'Perso' }).name}`,
        `${cyan('CPU')}: ${navigator.hardwareConcurrency || '?'} cœurs`,
        `${cyan('Stockage')}: ${U.formatBytes(FS.usage())} / 5 Mo`,
        '',
        [40, 41, 42, 43, 44, 45, 46, 47].map(k => `${E}${k}m   ${E}0m`).join('')
      ];
      const lines = [];
      for (let i = 0; i < Math.max(LOGO.length, info.length); i++) lines.push(c('1;35', (LOGO[i] || '').padEnd(22)) + '  ' + (info[i] || ''));
      return lines.join('\n');
    } },
    env: { desc: 'Variables d\'environnement', run(a, x) { return Object.entries(x.sh.env).map(([k, v]) => `${k}=${v}`).join('\n'); } },
    export: { desc: 'Définit une variable', usage: 'export NOM=valeur', run(a, x) { a.forEach(kv => { const i = kv.indexOf('='); if (i > 0) x.sh.env[kv.slice(0, i)] = kv.slice(i + 1); }); } },
    alias: { desc: 'Définit un alias', usage: 'alias nom=\'commande\'', run(a, x) {
      if (!a.length) return Object.entries(x.sh.aliases).map(([k, v]) => `alias ${k}='${v}'`).join('\n');
      a.forEach(kv => { const i = kv.indexOf('='); if (i > 0) x.sh.aliases[kv.slice(0, i)] = kv.slice(i + 1); });
      U.store.set('term-aliases', x.sh.aliases);
    } },
    unalias: { desc: 'Supprime un alias', run(a, x) { a.forEach(k => delete x.sh.aliases[k]); U.store.set('term-aliases', x.sh.aliases); } },
    which: { desc: 'Localise une commande', run(a, x) { return a.map(n => x.sh.aliases[n] ? `${n}: alias de « ${x.sh.aliases[n]} »` : CMDS[n] ? `/bin/${n}` : red(`${n} introuvable`)).join('\n'); } },
    ps: { desc: 'Processus (fenêtres) en cours', run() {
      const rows = [`${'PID'.padStart(6)}  ${'APPLI'.padEnd(14)} TITRE`, `${'1'.padStart(6)}  ${'kernel'.padEnd(14)} yohannos-kernel`, `${'2'.padStart(6)}  ${'wm'.padEnd(14)} gestionnaire de fenêtres`];
      Y.wm.list().forEach(w => rows.push(`${String(pidOf(w)).padStart(6)}  ${(w.app || '-').padEnd(14)} ${w.title}`));
      return rows.join('\n');
    } },
    kill: { desc: 'Ferme une fenêtre par son PID', usage: 'kill <pid>', run(a, x) {
      const pid = parseInt(a[a.length - 1], 10);
      if (pid === 1 || pid === 2) throw new Error('kill: opération non permise (le système a besoin de ce processus !)');
      const w = Y.wm.list().find(w => pidOf(w) === pid);
      if (!w) throw new Error(`kill: (${a[0]}) — processus inexistant`);
      if (w === x.win) x.out(yellow('Le terminal se ferme lui-même… au revoir !'));
      w.close(true);
    } },
    apps: { desc: 'Liste les applications', run() { return Y.apps.all().map(a => `${cyan(a.id.padEnd(13))} ${a.name}${a.description ? dim(' — ' + a.description) : ''}`).join('\n'); } },
    launch: { desc: 'Lance une application', usage: 'launch <id>', run(a) {
      if (!a[0]) throw new Error('launch: indiquez un identifiant (voir « apps »)');
      if (!Y.apps.get(a[0])) throw new Error(`launch: application « ${a[0]} » introuvable`);
      Y.apps.launch(a[0]);
    } },
    theme: { desc: 'Change le thème', usage: 'theme [dark|light|auto]', run(a) {
      if (!a[0]) return `Thème actuel : ${Y.settings.get('theme')}`;
      if (!['dark', 'light', 'auto', 'sombre', 'clair'].includes(a[0])) throw new Error('theme: valeurs possibles : dark, light, auto');
      Y.settings.set('theme', { sombre: 'dark', clair: 'light' }[a[0]] || a[0]);
      return green('✓ ') + 'Thème appliqué';
    } },
    accent: { desc: 'Change la couleur d\'accent', usage: 'accent #rrggbb', run(a) {
      if (!a[0] || !Y.settings.hexToRgb(a[0])) throw new Error('accent: couleur hexadécimale attendue, ex : accent #ff6600');
      Y.settings.set('accent', a[0].startsWith('#') ? a[0] : '#' + a[0]);
      return green('✓ ') + 'Couleur d\'accent appliquée';
    } },
    wallpaper: { desc: 'Change le fond d\'écran', usage: 'wallpaper [next|list|<id>]', run(a) {
      if (!a[0] || a[0] === 'list') return Y.settings.WALLPAPERS.map(w => `${(w.id === Y.settings.get('wallpaper') ? green('● ') : '  ')}${cyan(w.id.padEnd(15))} ${w.name}`).join('\n');
      if (a[0] === 'next') { Y.wallpaper.next(); return; }
      if (!Y.settings.WALLPAPERS.find(w => w.id === a[0])) throw new Error('wallpaper: fond inconnu (voir « wallpaper list »)');
      Y.settings.set('wallpaper', a[0]);
    } },
    notify: { desc: 'Envoie une notification', usage: 'notify message', run(a) { Y.notify({ title: 'Terminal', body: a.join(' ') || 'Coucou !', app: 'terminal' }); } },
    calc: { desc: 'Calculatrice', usage: 'calc expression (ex : calc 2^10 + sqrt(16))', run(a, x) {
      const expr = a.join(' ') || x.stdin || '';
      if (!expr.trim()) throw new Error('calc: expression manquante');
      return U.formatNumber(U.evalMath(expr));
    } },
    cowsay: { desc: 'Une vache qui parle', usage: 'cowsay message', run(a, x) {
      const msg = (a.join(' ') || (x.stdin || '').trim() || 'Meuh !').replace(/\s+/g, ' ');
      const words = msg.split(' '), lines = [];
      let cur = '';
      words.forEach(w => { if ((cur + ' ' + w).trim().length > 38) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
      if (cur) lines.push(cur);
      const w = Math.max(...lines.map(l => l.length));
      const box = lines.length === 1 ? [`< ${lines[0]} >`] : lines.map((l, i) => `${i === 0 ? '/' : i === lines.length - 1 ? '\\' : '|'} ${l.padEnd(w)} ${i === 0 ? '\\' : i === lines.length - 1 ? '/' : '|'}`);
      return [' ' + '_'.repeat(w + 2), ...box, ' ' + '-'.repeat(w + 2), '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'].join('\n');
    } },
    fortune: { desc: 'Une citation au hasard', run: () => U.pick(FORTUNES) },
    coin: { desc: 'Pile ou face', run: () => Math.random() < 0.5 ? '🪙 Pile !' : '🪙 Face !' },
    dice: { desc: 'Lance un dé', usage: 'dice [faces]', run(a) { const n = parseInt(a[0], 10) || 6; return `🎲 ${U.randInt(1, n)} (d${n})`; } },
    base64: { desc: 'Encode / décode en base64', usage: 'base64 [-d] texte', run(a, x) {
      const { f, rest } = flags(a);
      const s = rest.length ? rest.join(' ') : (x.stdin || '').replace(/\n$/, '');
      if (f.has('d')) { try { return decodeURIComponent(escape(atob(s.trim()))); } catch (e) { throw new Error('base64: entrée invalide'); } }
      return btoa(unescape(encodeURIComponent(s)));
    } },
    sha256: { desc: 'Empreinte SHA-256', usage: 'sha256 texte', async run(a, x) {
      const s = a.length ? a.join(' ') : (x.stdin || '');
      if (!crypto.subtle) throw new Error('sha256: indisponible (contexte non sécurisé)');
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } },
    json: { desc: 'Formate du JSON', usage: 'json [fichier]', run(a, x) { try { return JSON.stringify(JSON.parse(input(a, x)), null, 2); } catch (e) { throw new Error('json: JSON invalide — ' + e.message); } } },
    weather: { desc: 'Météo d\'une ville', usage: 'weather [ville]', async run(a, x) {
      const city = a.join(' ') || 'Lille';
      x.out(dim(`Recherche de « ${city} »…`));
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`).then(r => r.json());
      if (!g.results || !g.results.length) throw new Error(`weather: ville « ${city} » introuvable`);
      const p = g.results[0];
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`).then(r => r.json());
      const desc = Y.weatherCode ? Y.weatherCode(w.current.weather_code) : { label: 'code ' + w.current.weather_code, emoji: '' };
      let s = `${bold(p.name)}${p.country ? dim(', ' + p.country) : ''}\n${desc.emoji}  ${yellow(Math.round(w.current.temperature_2m) + '°C')}  ${desc.label}\n💨 ${w.current.wind_speed_10m} km/h   💧 ${w.current.relative_humidity_2m} %\n`;
      w.daily.time.forEach((t, i) => { const d = Y.weatherCode ? Y.weatherCode(w.daily.weather_code[i]) : { emoji: '' }; s += `\n${U.capitalize(new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })).padEnd(10)} ${d.emoji}  ${Math.round(w.daily.temperature_2m_min[i])}° / ${Math.round(w.daily.temperature_2m_max[i])}°`; });
      return s;
    } },
    curl: { desc: 'Récupère le contenu d\'une URL (si CORS autorisé)', usage: 'curl url', async run(a) {
      if (!a[0]) throw new Error('curl: URL manquante');
      try { const r = await fetch(a[0]); const t = await r.text(); return t.length > 20000 ? t.slice(0, 20000) + '\n' + dim('… (tronqué)') : t; }
      catch (e) { throw new Error('curl: échec de la requête (le site bloque peut-être les requêtes cross-origin)'); }
    } },
    ping: { desc: 'Teste la connexion (simulation)', usage: 'ping hôte', async run(a, x) {
      const host = a[0] || 'ymarant.github.io';
      x.out(`PING ${host} (${U.randInt(1, 223)}.${U.randInt(0, 255)}.${U.randInt(0, 255)}.${U.randInt(1, 254)}) 56(84) octets de données.`);
      const times = [];
      for (let i = 1; i <= 4; i++) {
        await U.sleep(700);
        if (x.sh.aborted) break;
        const t = navigator.onLine ? U.rand(8, 40) : 0;
        if (!navigator.onLine) { x.out(red('Réseau inaccessible')); continue; }
        times.push(t);
        x.out(`64 octets de ${host} : icmp_seq=${i} ttl=56 temps=${t.toFixed(1)} ms`);
      }
      return times.length ? `\n--- statistiques ping ${host} ---\n${times.length} paquets transmis, ${times.length} reçus, 0 % de perte\nrtt min/moy/max = ${Math.min(...times).toFixed(1)}/${(times.reduce((p, q) => p + q, 0) / times.length).toFixed(1)}/${Math.max(...times).toFixed(1)} ms` : '';
    } },
    sl: { desc: 'Un petit train passe…', async run(a, x) {
      const train = [
        '      ====        ________                ___________ ',
        '  _D _|  |_______/        \\__I_I_____===__|_________| ',
        '   |(_)---  |   H\\________/ |   |        =|___ ___|   ',
        '   /     |  |   H  |  |     |   |         ||_| |_||   ',
        '  |      |  |   H  |__--------------------| [___] |   ',
        '  | ________|___H__/__|_____/[][]~\\_______|       |   ',
        '  |/ |   |-----------I_____I [][] []  D   |=======|__ ',
        '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ',
        ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ',
        '  \\_/      \\O=====O=====O=====O_/      \\_/            '
      ];
      const box = x.term.raw();
      const width = Math.floor(box.parentNode.clientWidth / 8.4);
      for (let pos = width; pos > -train[0].length; pos -= 2) {
        if (x.sh.aborted) break;
        box.textContent = train.map(l => (pos >= 0 ? ' '.repeat(pos) + l : l.slice(-pos)).slice(0, width)).join('\n');
        x.term.scroll();
        await U.sleep(40);
      }
      box.remove();
    } },
    matrix: { desc: 'Pluie de code façon film culte', async run(a, x) {
      const cv = el('canvas.term-matrix');
      x.term.root.appendChild(cv);
      const ctx = cv.getContext('2d');
      const W = cv.width = x.term.root.clientWidth, H = cv.height = x.term.root.clientHeight;
      const cols = Math.floor(W / 14), drops = Array(cols).fill(0).map(() => U.randInt(-30, 0));
      x.out(dim('(appuie sur une touche pour arrêter)'));
      const t0 = Date.now();
      while (!x.sh.aborted && Date.now() - t0 < 15000) {
        ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#2bff88'; ctx.font = '14px monospace';
        drops.forEach((d, i) => { ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), i * 14, d * 14); if (d * 14 > H && Math.random() > 0.97) drops[i] = 0; drops[i]++; });
        await U.sleep(50);
      }
      cv.remove();
    } },
    screensaver: { desc: 'Lance l\'économiseur d\'écran', run() { setTimeout(() => Y.boot.screensaver(true), 300); } },
    sudo: { desc: 'Exécute en super-utilisateur', run(a, x) {
      if (a.join(' ').replace(/\s+/g, ' ').match(/^rm -(rf|fr) \/\*?$/)) { x.out(red('Suppression de tout le système… 😱')); setTimeout(() => Y.boot.crash(), 1200); return; }
      if (a[0] === 'make' && a[1] === 'me' && a[2] === 'a' && a[3] === 'sandwich') return 'D\'accord. 🥪';
      return `[sudo] mot de passe de yohann : \n${red('yohann n\'est pas dans le fichier sudoers. Cet incident sera signalé.')} 😄`;
    } },
    lock: { desc: 'Verrouille la session', run() { setTimeout(() => Y.boot.lock(), 200); } },
    reboot: { desc: 'Redémarre', run() { setTimeout(() => Y.boot.restart(), 300); return 'Redémarrage…'; } },
    shutdown: { desc: 'Éteint', run() { setTimeout(() => Y.boot.shutdown(), 300); return 'Arrêt du système…'; } },
    exit: { desc: 'Ferme le terminal', run(a, x) { setTimeout(() => x.win.close(), 50); } },
    panic: { desc: 'Ne surtout pas taper ça', hidden: true, run() { Y.boot.crash(); } }
  };
  CMDS.cls = CMDS.clear; CMDS.dir = CMDS.ls; CMDS.edit = CMDS.nano; CMDS.vim = CMDS.nano; CMDS.code = CMDS.nano; CMDS['xdg-open'] = CMDS.open; CMDS.bc = CMDS.calc; CMDS.type = CMDS.cat;

  function readText(t, x) {
    const p = FS.normalize(t, x.sh.cwd);
    if (!FS.exists(p)) throw new Error(`${t}: Aucun fichier ou dossier de ce type`);
    if (FS.isDir(p)) throw new Error(`${t}: est un dossier`);
    const st = FS.stat(p);
    const s = FS.readFile(p);
    if (st.url || s.startsWith('data:')) return dim(`[fichier binaire : ${st.name}, ${U.formatBytes(st.size)}]`) + '\n';
    return s;
  }
  function input(rest, x) { return rest.length ? rest.map(t => readText(t, x)).join('') : (x.stdin || ''); }

  /* ---------- Shell ---------- */
  class Shell {
    constructor(term, win, cwd) {
      this.term = term; this.win = win;
      this.cwd = FS.isDir(cwd || '') ? FS.normalize(cwd) : FS.HOME;
      this.env = { USER: 'yohann', HOME: FS.HOME, PWD: this.cwd, SHELL: '/bin/ysh', HOSTNAME: 'yohannos', LANG: 'fr_FR.UTF-8', PATH: '/bin', TERM: 'yterm-256color', '?': '0' };
      this.aliases = Object.assign({ ll: 'ls -l', la: 'ls -la', l: 'ls', '..': 'cd ..' }, U.store.get('term-aliases', {}));
      this.history = [];
      try { this.history = FS.readFile(FS.HOME + '/.ysh_history').split('\n').filter(Boolean).slice(-300); } catch (e) { /* ignore */ }
      this.running = false;
      this.aborted = false;
    }
    saveHistory() { try { FS.writeFile(FS.HOME + '/.ysh_history', this.history.slice(-300).join('\n') + '\n', { silent: true }); } catch (e) { /* ignore */ } }
    prompt() { return `${c('1;32', 'yohann@yohannos')}:${c('1;34', FS.pretty(this.cwd))}$ `; }

    async exec(line) {
      line = line.trim();
      if (!line) return;
      // expansion de l'historique
      if (line === '!!' || /^!\d+$/.test(line)) {
        const h = line === '!!' ? this.history[this.history.length - 1] : this.history[parseInt(line.slice(1), 10) - 1];
        if (!h) { this.term.print(red('ysh: événement introuvable')); return; }
        line = h;
        this.term.print(dim(line));
      }
      if (this.history[this.history.length - 1] !== line) { this.history.push(line); this.saveHistory(); }
      let segs;
      try { segs = splitSeq(line); }
      catch (e) { this.term.print(red('ysh: ' + e.message)); this.env['?'] = '2'; return; }
      this.running = true; this.aborted = false;
      let status = 0;
      for (let i = 0; i < segs.length; i++) {
        const prev = i > 0 ? segs[i - 1].next : ';';
        if ((prev === '&&' && status !== 0) || (prev === '||' && status === 0)) continue;
        let text = segs[i].text.trim();
        const first = text.split(/\s+/)[0];
        if (this.aliases[first]) text = this.aliases[first] + text.slice(first.length);
        let seqs;
        try { seqs = parse(tokenize(text, this.env), this.cwd); }
        catch (e) { this.term.print(red('ysh: ' + e.message)); status = 2; continue; }
        for (const sq of seqs) status = await this.runPipeline(sq.pipeline);
        this.env['?'] = String(status);
        if (this.aborted) break;
      }
      this.env['?'] = String(status);
      this.running = false;
    }

    async runPipeline(pipeline) {
      let stdin = null, status = 0;
      for (let i = 0; i < pipeline.length; i++) {
        const cmd = pipeline[i];
        const last = i === pipeline.length - 1;
        let [name, ...args] = cmd.argv;
        if (!name) { if (cmd.out) { try { FS.writeFile(FS.normalize(cmd.out.file, this.cwd), ''); } catch (e) { this.term.print(red(e.message)); } } continue; }
        // affectation VAR=valeur
        if (/^[A-Za-z_]\w*=/.test(name) && !args.length) { const j = name.indexOf('='); this.env[name.slice(0, j)] = name.slice(j + 1); continue; }
        const def = CMDS[name];
        if (!def) {
          const p = FS.normalize(name, this.cwd);
          if (FS.isFile(p) && /\.(sh|ysh)$/.test(name)) { // exécuter un script
            for (const l of FS.readFile(p).split('\n')) { if (l.trim() && !l.trim().startsWith('#')) await this.exec(l); }
            continue;
          }
          const sugg = Object.keys(CMDS).filter(k => lev(k, name) <= 2).slice(0, 3);
          this.term.print(red(`ysh: ${name} : commande introuvable`) + (sugg.length ? dim(`\nVouliez-vous dire : ${sugg.join(', ')} ?`) : ''));
          return 127;
        }
        if (cmd.inFile) { try { stdin = readText(cmd.inFile, { sh: this }); } catch (e) { this.term.print(red('ysh: ' + e.message)); return 1; } }
        const ctx = { sh: this, term: this.term, win: this.win, stdin, piped: !last || !!cmd.out, status: 0, out: s => this.term.print(s) };
        try {
          let res = await def.run(args, ctx);
          status = ctx.status;
          res = res == null ? '' : String(res);
          if (cmd.out) {
            const p = FS.normalize(cmd.out.file, this.cwd);
            const text = stripAnsi(res) + (res && !res.endsWith('\n') ? '\n' : '');
            cmd.out.append ? FS.appendFile(p, text) : FS.writeFile(p, text);
            stdin = '';
          } else if (last) {
            if (res) this.term.print(res.replace(/\n$/, ''));
          } else stdin = stripAnsi(res);
        } catch (e) {
          this.term.print(red(e.message.startsWith(name) ? e.message : `${name}: ${e.message}`));
          return 1;
        }
      }
      return status;
    }

    complete(text, caret) {
      const before = text.slice(0, caret);
      const m = before.match(/(\S*)$/);
      const word = m[1];
      const isCmd = !before.slice(0, before.length - word.length).trim() || /[|;&]\s*$/.test(before.slice(0, before.length - word.length));
      let cands;
      if (isCmd && !word.includes('/')) {
        cands = Object.keys(CMDS).concat(Object.keys(this.aliases)).filter(k => !CMDS[k] || !CMDS[k].hidden).filter(k => k.startsWith(word)).map(k => ({ v: k, s: ' ' }));
      } else {
        const expanded = word.startsWith('~') ? FS.HOME + word.slice(1) : word;
        const slash = expanded.lastIndexOf('/');
        const dirPart = slash >= 0 ? expanded.slice(0, slash + 1) : '';
        const pre = slash >= 0 ? expanded.slice(slash + 1) : expanded;
        const dir = FS.normalize(dirPart || '.', this.cwd);
        if (!FS.isDir(dir)) return null;
        const shownDir = slash >= 0 ? word.slice(0, word.lastIndexOf('/') + 1) : '';
        cands = FS.readdir(dir, { all: pre.startsWith('.') }).filter(e => e.name.startsWith(pre)).map(e => ({ v: shownDir + e.name.replace(/ /g, '\\ '), s: e.isDir ? '/' : ' ', label: e.name + (e.isDir ? '/' : '') }));
      }
      if (!cands.length) return null;
      if (cands.length === 1) return { text: before.slice(0, before.length - word.length) + cands[0].v + cands[0].s + text.slice(caret), list: null };
      let common = cands[0].v;
      cands.forEach(cd => { while (!cd.v.startsWith(common)) common = common.slice(0, -1); });
      return { text: before.slice(0, before.length - word.length) + common + text.slice(caret), list: common.length > word.length ? null : cands.map(cd => cd.label || cd.v) };
    }
  }

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  /* ---------- Interface ---------- */
  function launch(args) {
    const out = el('div.term-out');
    const promptEl = el('span.term-prompt');
    const input = el('input.term-input', { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Ligne de commande' });
    const inputLine = el('div.term-line.term-inputline', promptEl, input);
    const scroller = el('div.term-scroll.selectable', out, inputLine);
    const root = el('div.term', scroller);
    const win = Y.apps.window('terminal', { content: root, width: 760, height: 470, minWidth: 360, minHeight: 200 });

    const term = {
      root,
      print(s) {
        const line = el('div.term-line', { html: ansiToHtml(s) });
        out.appendChild(line);
        while (out.childNodes.length > 1500) out.firstChild.remove();
        term.scroll();
      },
      raw() { const pre = el('pre.term-raw'); out.appendChild(pre); return pre; },
      clear() { out.innerHTML = ''; },
      scroll() { scroller.scrollTop = scroller.scrollHeight; }
    };
    const sh = new Shell(term, win, args.cwd);
    let hIndex = -1, draft = '';

    const updatePrompt = () => { promptEl.innerHTML = ansiToHtml(sh.prompt()); };
    term.print(`${c('1;35', 'YohannOS')} ${dim('— ysh 1.0')}`);
    term.print(dim('Tape ') + cyan('help') + dim(' pour la liste des commandes, ') + cyan('neofetch') + dim(' pour frimer.'));
    term.print('');
    updatePrompt();

    async function submit() {
      const line = input.value;
      term.print(sh.prompt() + line);
      input.value = '';
      hIndex = -1;
      inputLine.classList.add('busy');
      try { await sh.exec(line); } catch (e) { term.print(red('ysh: ' + e.message)); }
      if (win.closed) return;
      inputLine.classList.remove('busy');
      updatePrompt();
      term.scroll();
      input.focus();
    }

    input.addEventListener('keydown', e => {
      if (sh.running) {
        if ((e.ctrlKey && e.key.toLowerCase() === 'c') || e.key === 'Escape' || e.key.length === 1) { sh.aborted = true; }
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const r = sh.complete(input.value, input.selectionStart);
        if (r) {
          if (r.list) { term.print(sh.prompt() + input.value); term.print(r.list.join('   ')); }
          input.value = r.text;
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!sh.history.length) return;
        if (hIndex === -1) { draft = input.value; hIndex = sh.history.length; }
        hIndex = Math.max(0, hIndex - 1);
        input.value = sh.history[hIndex];
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hIndex === -1) return;
        hIndex++;
        if (hIndex >= sh.history.length) { hIndex = -1; input.value = draft; } else input.value = sh.history[hIndex];
      } else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); term.clear(); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection().toString()) { e.preventDefault(); term.print(sh.prompt() + input.value + '^C'); input.value = ''; hIndex = -1; }
      else if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); input.value = input.value.slice(input.selectionStart); }
    });
    win.el.addEventListener('keydown', e => {
      if (!sh.running || e.target === input) return;
      if ((e.ctrlKey && e.key.toLowerCase() === 'c') || e.key === 'Escape' || e.key.length === 1) { sh.aborted = true; e.preventDefault(); }
    });
    root.addEventListener('mouseup', () => { if (!window.getSelection().toString()) input.focus(); });
    win.on('focus', () => setTimeout(() => { if (!window.getSelection().toString()) input.focus(); }, 0));
    win.on('close', () => { sh.aborted = true; });
    setTimeout(() => input.focus(), 60);
    if (args.command) { input.value = args.command; submit(); }
    return win;
  }

  Y.apps.register({
    id: 'terminal', name: 'Terminal', icon: 'terminal', color: ['#3a3f4b', '#14161b'], category: 'Système',
    description: 'Ligne de commande ysh', keywords: 'shell bash console cmd ligne de commande',
    desktop: true, desktopOrder: 3, launch
  });
  Y.terminal = { commands: CMDS, ansiToHtml };
})(window.YOS);
