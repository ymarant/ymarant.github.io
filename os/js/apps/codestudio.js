/* =========================================================
   YohannOS — Code Studio : éditeur HTML/CSS/JS avec
   coloration syntaxique, aperçu en direct et console
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;
  const esc = U.escape;

  /* ---------- Coloration syntaxique ---------- */
  const JS_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`?|'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?)|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|try|catch|finally|throw|typeof|instanceof|in|of|async|await|yield|delete|void|static|get|set)\b|\b(true|false|null|undefined|NaN|Infinity|this|document|window|console|Math|JSON)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
  const CSS_RE = /(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|([^{}\s;][^{};]*?)(?=\s*\{)|([\w-]+)(?=\s*:)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|turn)?)/g;

  function hlJS(s) {
    let out = '', last = 0;
    s.replace(JS_RE, (m, com, str, kw, lit, num, fn, off) => {
      out += esc(s.slice(last, off));
      const cls = com ? 'c' : str ? 's' : kw ? 'k' : lit ? 'l' : num ? 'n' : 'f';
      out += `<i class="t-${cls}">${esc(m)}</i>`;
      last = off + m.length;
      return m;
    });
    return out + esc(s.slice(last));
  }
  function hlCSS(s) {
    let out = '', last = 0;
    s.replace(CSS_RE, (m, com, str, at, hex, sel, prop, num, off) => {
      out += esc(s.slice(last, off));
      const cls = com ? 'c' : str ? 's' : at ? 'k' : hex ? 'n' : sel ? 'sel' : prop ? 'p' : 'n';
      out += `<i class="t-${cls}">${esc(m)}</i>`;
      last = off + m.length;
      return m;
    });
    return out + esc(s.slice(last));
  }
  const ATTR_RE = /([^\s=\/>"']+)(?:(\s*=\s*)("[^"]*"?|'[^']*'?|[^\s>"']+))?/g;
  function hlTag(t) {
    const m = t.match(/^(<\/?)([\w-]+)([\s\S]*?)(\/?>)?$/);
    if (!m) return esc(t);
    let out = esc(m[1]) + `<i class="t-tag">${esc(m[2])}</i>`, last = 0;
    const attrs = m[3];
    attrs.replace(ATTR_RE, (mm, name, eq, val, off) => {
      out += esc(attrs.slice(last, off)) + `<i class="t-attr">${esc(name)}</i>` + (eq ? esc(eq) + `<i class="t-s">${esc(val || '')}</i>` : '');
      last = off + mm.length;
      return mm;
    });
    return out + esc(attrs.slice(last)) + (m[4] ? esc(m[4]) : '');
  }
  function hlHTML(s) {
    const RE = /(<!--[\s\S]*?(?:-->|$))|(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|(<\/?[\w-][^>]*>?)|(&\w+;)/g;
    let out = '', last = 0;
    s.replace(RE, (m, com, so, sc, se, sto, stc, ste, tag, ent, off) => {
      out += esc(s.slice(last, off));
      if (com) out += `<i class="t-c">${esc(com)}</i>`;
      else if (so) out += hlTag(so) + hlJS(sc) + hlTag(se);
      else if (sto) out += hlTag(sto) + hlCSS(stc) + hlTag(ste);
      else if (tag) out += hlTag(tag);
      else out += `<i class="t-n">${esc(ent)}</i>`;
      last = off + m.length;
      return m;
    });
    return out + esc(s.slice(last));
  }
  const HL = { html: hlHTML, css: hlCSS, js: hlJS };

  /* ---------- Composant éditeur ---------- */
  function codeEditor(lang, onChange) {
    const gutter = el('div.ce-gutter');
    const code = el('code');
    const pre = el('pre.ce-hl', code);
    const ta = el('textarea.ce-ta', { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', wrap: 'off' });
    const root = el('div.ce', gutter, el('div.ce-area', pre, ta));
    let lines = 0;
    const render = () => {
      code.innerHTML = HL[lang](ta.value) + '\n';
      const n = ta.value.split('\n').length;
      if (n !== lines) { lines = n; gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
      sync();
    };
    const sync = () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; };
    const insert = text => { if (!document.execCommand('insertText', false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); };
    const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    ta.addEventListener('input', () => { render(); onChange && onChange(); });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => {
      const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s !== en && v.slice(s, en).includes('\n')) {
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          const block = v.slice(ls, en);
          const nb = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
          ta.setSelectionRange(ls, en); insert(nb); ta.setSelectionRange(ls, ls + nb.length);
        } else if (e.shiftKey) {
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          if (v.slice(ls, ls + 2) === '  ') { ta.setSelectionRange(ls, ls + 2); insert(''); ta.setSelectionRange(s - 2, s - 2); }
        } else insert('  ');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const indent = v.slice(ls).match(/^[ \t]*/)[0];
        const prev = v[s - 1], next = v[s];
        const opens = prev === '{' || prev === '(' || prev === '[' || (lang === 'html' && prev === '>' && /<[\w-][^>]*>$/.test(v.slice(ls, s)) && !/<\/|\/>$/.test(v.slice(ls, s)));
        if (opens && (next === '}' || next === ')' || next === ']' || (lang === 'html' && v.slice(s, s + 2) === '</'))) {
          insert('\n' + indent + '  \n' + indent);
          ta.setSelectionRange(s + indent.length + 3, s + indent.length + 3);
        } else insert('\n' + indent + (opens ? '  ' : ''));
      } else if (PAIRS[e.key] && !e.ctrlKey && !e.metaKey) {
        const next = v[s] || '';
        if ((e.key === '"' || e.key === "'" || e.key === '`') && next === e.key && s === en) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
        if (s !== en) { e.preventDefault(); const sel = v.slice(s, en); insert(e.key + sel + PAIRS[e.key]); ta.setSelectionRange(s + 1, s + 1 + sel.length); return; }
        if (/[\s)\]};,]|^$/.test(next) && !(e.key === "'" && /\w/.test(v[s - 1] || ''))) { e.preventDefault(); insert(e.key + PAIRS[e.key]); ta.setSelectionRange(s + 1, s + 1); }
      } else if ([')', ']', '}'].includes(e.key) && v[s] === e.key && s === en) {
        e.preventDefault(); ta.setSelectionRange(s + 1, s + 1);
      } else if (e.key === 'Backspace' && s === en && s > 0 && PAIRS[v[s - 1]] === v[s]) {
        e.preventDefault(); ta.setSelectionRange(s - 1, s + 1); insert('');
      } else if (lang === 'html' && e.key === '>' && s === en) {
        const m = v.slice(0, s).match(/<([a-zA-Z][\w-]*)[^<>]*$/);
        if (m && !/^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)$/i.test(m[1]) && v[s - 1] !== '/') {
          e.preventDefault(); insert(`></${m[1]}>`); ta.setSelectionRange(s + 1, s + 1);
        }
      }
    });
    return {
      root, ta,
      get value() { return ta.value; },
      set value(v) { ta.value = v; render(); },
      focus() { ta.focus(); },
      render
    };
  }

  /* ---------- Modèles ---------- */
  const TEMPLATES = {
    demo: { name: 'Carte interactive', html: '<div class="carte">\n  <h1>Salut 👋</h1>\n  <p>Modifie le code à gauche : l\'aperçu se met à jour en direct.</p>\n  <button id="btn">Clique-moi</button>\n  <p id="compteur">0 clic</p>\n</div>\n', css: 'body {\n  margin: 0;\n  height: 100vh;\n  display: grid;\n  place-items: center;\n  font-family: system-ui, sans-serif;\n  background: linear-gradient(135deg, #7c6cff, #06b6d4);\n  color: white;\n}\n\n.carte {\n  background: rgba(255, 255, 255, .15);\n  padding: 2em 3em;\n  border-radius: 20px;\n  text-align: center;\n  box-shadow: 0 10px 40px rgba(0, 0, 0, .25);\n}\n\nbutton {\n  font-size: 1.1em;\n  padding: .6em 1.4em;\n  border: none;\n  border-radius: 30px;\n  cursor: pointer;\n  transition: transform .15s;\n}\n\nbutton:active { transform: scale(.95); }\n', js: 'let n = 0;\nconst btn = document.querySelector("#btn");\nconst compteur = document.querySelector("#compteur");\n\nbtn.addEventListener("click", () => {\n  n++;\n  compteur.textContent = n + (n > 1 ? " clics" : " clic");\n  console.log("Clic numéro", n);\n});\n' },
    anim: { name: 'Animation CSS', html: '<div class="scene">\n  <div class="balle b1"></div>\n  <div class="balle b2"></div>\n  <div class="balle b3"></div>\n</div>\n', css: 'body {\n  margin: 0;\n  height: 100vh;\n  background: #111827;\n  display: grid;\n  place-items: center;\n}\n\n.scene { display: flex; gap: 24px; }\n\n.balle {\n  width: 50px;\n  height: 50px;\n  border-radius: 50%;\n  animation: rebond 1s ease-in-out infinite alternate;\n}\n\n.b1 { background: #f472b6; }\n.b2 { background: #a78bfa; animation-delay: .2s; }\n.b3 { background: #22d3ee; animation-delay: .4s; }\n\n@keyframes rebond {\n  from { transform: translateY(60px) scale(1.1, .9); }\n  to   { transform: translateY(-60px); }\n}\n', js: '// Pas de JavaScript ici : tout est en CSS !\n' },
    canvas: { name: 'Canvas : particules', html: '<canvas id="c"></canvas>\n', css: 'body { margin: 0; overflow: hidden; background: #0b1022; }\ncanvas { display: block; }\n', js: 'const c = document.getElementById("c");\nconst ctx = c.getContext("2d");\nlet W, H;\nfunction resize() { W = c.width = innerWidth; H = c.height = innerHeight; }\nresize();\naddEventListener("resize", resize);\n\nconst parts = [];\naddEventListener("pointermove", e => {\n  for (let i = 0; i < 4; i++) {\n    parts.push({\n      x: e.clientX, y: e.clientY,\n      vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4,\n      life: 1, hue: (Date.now() / 10) % 360\n    });\n  }\n});\n\nfunction loop() {\n  ctx.fillStyle = "rgba(11, 16, 34, .2)";\n  ctx.fillRect(0, 0, W, H);\n  for (const p of parts) {\n    p.x += p.vx; p.y += p.vy; p.life -= .015;\n    ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${p.life})`;\n    ctx.beginPath();\n    ctx.arc(p.x, p.y, 4 * p.life + 1, 0, Math.PI * 2);\n    ctx.fill();\n  }\n  while (parts.length && parts[0].life <= 0) parts.shift();\n  requestAnimationFrame(loop);\n}\nloop();\nconsole.log("Bouge la souris sur l\'aperçu !");\n' },
    clock: { name: 'Horloge numérique', html: '<div id="heure">--:--:--</div>\n<div id="date"></div>\n', css: 'body {\n  margin: 0;\n  height: 100vh;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  background: #000;\n  color: #3ddc97;\n  font-family: monospace;\n}\n#heure { font-size: 18vw; text-shadow: 0 0 20px #3ddc97; }\n#date { font-size: 4vw; opacity: .7; }\n', js: 'function tick() {\n  const d = new Date();\n  document.getElementById("heure").textContent = d.toLocaleTimeString("fr-FR");\n  document.getElementById("date").textContent = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });\n}\ntick();\nsetInterval(tick, 1000);\n' },
    blank: { name: 'Page vide', html: '<h1>Bonjour !</h1>\n', css: 'body { font-family: system-ui, sans-serif; }\n', js: '' }
  };

  /* ---------- Assemblage du document de prévisualisation ---------- */
  function hookScript(token) {
    return `<script>(function(){var T=${JSON.stringify(token)};function s(v){try{if(v instanceof Error)return v.stack||String(v);if(typeof v==='object'&&v!==null)return JSON.stringify(v,null,1);return String(v)}catch(e){return String(v)}}
['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){try{parent.postMessage({__yos:T,type:k,args:[].map.call(arguments,s)},'*')}catch(e){}o&&o.apply(console,arguments)}});
addEventListener('error',function(e){parent.postMessage({__yos:T,type:'error',args:[e.message+(e.lineno?' (ligne '+e.lineno+')':'')]},'*')});
addEventListener('unhandledrejection',function(e){parent.postMessage({__yos:T,type:'error',args:['Promesse rejetée : '+s(e.reason)]},'*')});
addEventListener('message',function(e){if(!e.data||e.data.__yosEval!==T)return;try{var r=(0,eval)(e.data.code);parent.postMessage({__yos:T,type:'result',args:[s(r)]},'*')}catch(err){parent.postMessage({__yos:T,type:'error',args:[String(err)]},'*')}});})();<\/script>`;
  }
  function buildDoc(html, css, js, token) {
    const head = (token ? hookScript(token) : '') + (css.trim() ? `<style>\n${css}\n</style>` : '');
    const tail = js.trim() ? `<script>\n${js}\n<\/script>` : '';
    if (/<html[\s>]/i.test(html) || /<head[\s>]/i.test(html)) {
      let doc = html;
      doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, head + '\n</head>') : doc.replace(/<html[^>]*>/i, m => m + '<head>' + head + '</head>');
      doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>(?![\s\S]*<\/body>)/i, tail + '\n</body>') : doc + tail;
      return doc;
    }
    return `<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n${html}\n${tail}\n</body>\n</html>`;
  }
  /** Découpe un fichier HTML complet en trois parties */
  function splitDoc(src) {
    let css = '', js = '';
    let html = src.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, c) => { css += c.replace(/^\n|\n$/g, '') + '\n'; return ''; });
    html = html.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (m, c) => { js += c.replace(/^\n|\n$/g, '') + '\n'; return ''; });
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const hasCustomHead = /<head[^>]*>[\s\S]*?(<link|<script[^>]*src)/i.test(html);
    if (body && !hasCustomHead) html = body[1].replace(/^\s*\n/, '').replace(/\n\s*$/, '\n');
    return { html: html.replace(/\n{3,}/g, '\n\n'), css, js };
  }

  /* ---------- Application ---------- */
  function launch(args) {
    let path = null, savedSig = '', auto = U.store.get('cs-auto', true), device = 'auto', consoleOpen = U.store.get('cs-console', true);
    const token = U.uid('cs');
    let current = 'html';
    const eds = {
      html: codeEditor('html', changed),
      css: codeEditor('css', changed),
      js: codeEditor('js', changed)
    };
    const tabs = el('div.cs-tabs');
    const tabBtns = {};
    [['html', 'HTML', '#e34c26'], ['css', 'CSS', '#2965f1'], ['js', 'JS', '#d4a507']].forEach(([id, label, col]) => {
      tabBtns[id] = el('button.cs-tab', { onclick: () => showTab(id) }, el('span.cs-dot', { style: { background: col } }), label);
      tabs.appendChild(tabBtns[id]);
    });
    const edWrap = el('div.cs-editors', eds.html.root, eds.css.root, eds.js.root);
    const iframe = el('iframe.cs-frame', { sandbox: 'allow-scripts allow-modals allow-pointer-lock', title: 'Aperçu' });
    const frameWrap = el('div.cs-frame-wrap', iframe);
    const consoleList = el('div.cs-console-list.selectable');
    const consoleInput = el('input.cs-console-input', { placeholder: '› Évaluer du JavaScript dans l\'aperçu…', spellcheck: 'false' });
    const consoleCount = el('span.badge.hidden');
    const consoleEl = el('div.cs-console', { class: consoleOpen ? null : 'collapsed' },
      el('div.cs-console-head', el('span', { html: Y.icons.svg('terminal', 14) + ' Console' }), consoleCount, el('span.grow'),
        el('button.btn.ghost.sm', { onclick: () => { consoleList.innerHTML = ''; consoleCount.classList.add('hidden'); } }, 'Effacer'),
        el('button.btn.ghost.sm.icon', { title: 'Afficher / masquer', html: Y.icons.svg('chevronDown', 14), onclick: () => { consoleOpen = !consoleOpen; U.store.set('cs-console', consoleOpen); consoleEl.classList.toggle('collapsed', !consoleOpen); } })),
      consoleList, consoleInput);
    const deviceSel = el('select.select.sm', { title: 'Taille de l\'aperçu' }, el('option', { value: 'auto' }, 'Adaptatif'), el('option', { value: '375' }, 'Mobile (375)'), el('option', { value: '768' }, 'Tablette (768)'), el('option', { value: '1280' }, 'Bureau (1280)'));
    deviceSel.style.height = '26px';
    deviceSel.addEventListener('change', () => { device = deviceSel.value; applyDevice(); });
    const pane = el('div.cs-preview',
      el('div.cs-preview-head', el('span.dim', { html: Y.icons.svg('eye', 14) + ' Aperçu' }), el('span.grow'), deviceSel,
        el('button.btn.ghost.sm.icon', { title: 'Actualiser (Ctrl+Entrée)', html: Y.icons.svg('refresh', 14), onclick: () => run() }),
        el('button.btn.ghost.sm.icon', { title: 'Ouvrir dans une fenêtre', html: Y.icons.svg('external', 14), onclick: () => popOut() })),
      frameWrap, consoleEl);
    const splitter = el('div.cs-split');
    const left = el('div.cs-left', tabs, edWrap);
    const body = el('div.cs-body', left, splitter, pane);
    const autoChk = el('input', { type: 'checkbox' });
    autoChk.checked = auto;
    autoChk.addEventListener('change', () => { auto = autoChk.checked; U.store.set('cs-auto', auto); if (auto) run(); });
    const tplBtn = el('button.btn.sm', { html: Y.icons.svg('sparkle', 14) + ' Modèles' });
    tplBtn.addEventListener('click', () => Y.menu.showFor(tplBtn, Object.entries(TEMPLATES).map(([id, t]) => ({ label: t.name, action: () => loadTemplate(id) }))));
    const toolbar = el('div.toolbar',
      el('button.btn.sm.primary', { html: Y.icons.svg('play', 13) + ' Exécuter', title: 'Ctrl+Entrée', onclick: () => run() }),
      el('label.row.cs-auto', autoChk, el('span', 'Auto')),
      el('div.sep'),
      el('button.btn.ghost.sm.icon', { title: 'Nouveau', html: Y.icons.svg('file', 15), onclick: () => newProject() }),
      el('button.btn.ghost.sm.icon', { title: 'Ouvrir un fichier HTML (Ctrl+O)', html: Y.icons.svg('folderOpen', 15), onclick: () => openProject() }),
      el('button.btn.ghost.sm.icon', { title: 'Enregistrer (Ctrl+S)', html: Y.icons.svg('save', 15), onclick: () => save() }),
      el('button.btn.ghost.sm.icon', { title: 'Télécharger le fichier HTML', html: Y.icons.svg('download', 15), onclick: () => U.download(path ? FS.basename(path) : 'projet.html', fullDoc()) }),
      tplBtn,
      el('span.grow'),
      el('button.btn.ghost.sm.icon', { title: 'Disposition', html: Y.icons.svg('gridView', 15), onclick: () => body.classList.toggle('stacked') }));
    const status = el('div.statusbar');
    const content = el('div.cs', toolbar, body, status);
    const win = Y.apps.window('codestudio', { content, width: 1040, height: 620, minWidth: 520, minHeight: 320 });

    function showTab(id) {
      current = id;
      Object.entries(eds).forEach(([k, e]) => e.root.classList.toggle('hidden', k !== id));
      Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle('active', k === id));
      eds[id].render();
      eds[id].focus();
      updateStatus();
    }
    const sig = () => eds.html.value + '\u0001' + eds.css.value + '\u0001' + eds.js.value;
    const dirty = () => sig() !== savedSig;
    const fullDoc = () => buildDoc(eds.html.value, eds.css.value, eds.js.value, null);
    const runDebounced = U.debounce(() => run(), 600);
    function changed() {
      updateTitle(); updateStatus();
      if (auto) runDebounced();
      if (!path) saveDraft();
    }
    const saveDraft = U.debounce(() => U.store.set('cs-draft', { html: eds.html.value, css: eds.css.value, js: eds.js.value }), 500);
    function updateTitle() { win.setTitle(`${dirty() ? '● ' : ''}${path ? FS.basename(path) : 'Sans titre'} — Code Studio`); }
    function updateStatus() {
      const ta = eds[current].ta;
      const before = ta.value.slice(0, ta.selectionStart);
      status.innerHTML = '';
      status.append(el('span', `${current.toUpperCase()}`), el('span', `Ln ${before.split('\n').length}, Col ${ta.selectionStart - before.lastIndexOf('\n')}`), el('span', `${ta.value.split('\n').length} lignes`), el('span.grow'), el('span', path ? FS.pretty(path) : 'Brouillon (sauvegarde auto)'));
    }
    function run() {
      consoleList.innerHTML = '';
      consoleCount.classList.add('hidden');
      iframe.srcdoc = buildDoc(eds.html.value, eds.css.value, eds.js.value, token);
    }
    function applyDevice() {
      if (device === 'auto') { iframe.style.width = '100%'; frameWrap.classList.remove('device'); }
      else { iframe.style.width = device + 'px'; frameWrap.classList.add('device'); }
    }
    function log(type, args) {
      const row = el('div.cs-log.' + type, el('span.cs-log-ico', { html: type === 'error' ? Y.icons.svg('x', 12) : type === 'warn' ? Y.icons.svg('alert', 12) : type === 'result' ? Y.icons.svg('chevronLeft', 12) : Y.icons.svg('chevronRight', 12) }), el('span', args.join(' ')));
      consoleList.appendChild(row);
      consoleList.scrollTop = consoleList.scrollHeight;
      const n = consoleList.childElementCount;
      consoleCount.textContent = n; consoleCount.classList.toggle('hidden', !n);
    }
    const onMsg = e => { if (e.data && e.data.__yos === token && e.source === iframe.contentWindow) log(e.data.type, e.data.args || []); };
    window.addEventListener('message', onMsg);
    win.on('close', () => window.removeEventListener('message', onMsg));
    consoleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && consoleInput.value.trim()) {
        log('input', [consoleInput.value]);
        iframe.contentWindow && iframe.contentWindow.postMessage({ __yosEval: token, code: consoleInput.value }, '*');
        consoleInput.value = '';
      }
    });

    function setAll(p, isPath) {
      eds.html.value = p.html; eds.css.value = p.css; eds.js.value = p.js;
      if (isPath !== undefined) path = isPath;
      savedSig = sig();
      updateTitle(); updateStatus(); run();
    }
    async function confirmDiscard() {
      if (!dirty() || !path) return true;
      const r = await Y.dialog.ask3(`Enregistrer les modifications de « ${FS.basename(path)} » ?`, { title: 'Code Studio', parent: win });
      if (r === 'yes') return await save();
      return r === 'no';
    }
    async function loadTemplate(id) {
      if (!(await confirmDiscard())) return;
      const t = TEMPLATES[id];
      path = null;
      setAll(t);
      savedSig = '';
      saveDraft();
      updateTitle();
    }
    async function newProject() { await loadTemplate('blank'); }
    function loadFile(p) {
      try {
        const src = FS.readFile(p);
        const ext = FS.ext(p);
        if (ext === 'css') setAll({ html: '', css: src, js: '' }, null);
        else if (ext === 'js') setAll({ html: '', css: '', js: src }, null);
        else setAll(splitDoc(src), FS.normalize(p));
        if (ext === 'css') showTab('css'); else if (ext === 'js') showTab('js'); else showTab('html');
        Y.recent.add(FS.normalize(p));
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
    }
    async function openProject() {
      if (!(await confirmDiscard())) return;
      const p = await Y.dialog.openFile({ dir: path ? FS.dirname(path) : FS.HOME + '/Documents/Projets', exts: ['html', 'htm', 'css', 'js'], parent: win });
      if (p) loadFile(p);
    }
    async function save(as) {
      let p = path;
      if (!p || as) {
        p = await Y.dialog.saveFile({ dir: FS.HOME + '/Documents/Projets', name: 'projet.html', ext: 'html', parent: win });
        if (!p) return false;
      }
      try {
        FS.writeFile(p, fullDoc());
        path = FS.normalize(p);
        savedSig = sig();
        updateTitle(); updateStatus();
        Y.recent.add(path);
        return true;
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); return false; }
    }
    function popOut() {
      const f = el('iframe', { sandbox: 'allow-scripts allow-modals allow-pointer-lock', style: { border: 'none', width: '100%', height: '100%', background: '#fff' } });
      f.srcdoc = fullDoc();
      Y.wm.create({ app: 'codestudio', title: `Aperçu — ${path ? FS.basename(path) : 'Sans titre'}`, icon: 'eye', color: ['#2b5876', '#4e4376'], content: f, width: 800, height: 560 });
    }

    // séparateur redimensionnable
    splitter.addEventListener('pointerdown', e => {
      const stacked = body.classList.contains('stacked');
      const start = stacked ? left.offsetHeight : left.offsetWidth;
      const total = stacked ? body.offsetHeight : body.offsetWidth;
      U.drag(e, {
        bodyClass: 'resizing',
        move(dx, dy) { const v = U.clamp(start + (stacked ? dy : dx), 160, total - 160); left.style.flex = `0 0 ${v}px`; }
      });
    });

    win.el.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 'enter') { e.preventDefault(); run(); }
      else if (ctrl && k === 's') { e.preventDefault(); save(e.shiftKey); }
      else if (ctrl && k === 'o') { e.preventDefault(); openProject(); }
      else if (e.altKey && ['1', '2', '3'].includes(k)) { e.preventDefault(); showTab(['html', 'css', 'js'][+k - 1]); }
    });
    Object.values(eds).forEach(ed => ['keyup', 'click'].forEach(ev => ed.ta.addEventListener(ev, updateStatus)));
    win.on('beforeclose', confirmDiscard);

    if (args.path && FS.exists(args.path)) loadFile(args.path);
    else {
      const d = U.store.get('cs-draft', null);
      setAll(d || TEMPLATES.demo, null);
      savedSig = '';
      updateTitle();
    }
    showTab(args.path && FS.ext(args.path) === 'css' ? 'css' : args.path && FS.ext(args.path) === 'js' ? 'js' : 'html');
    win.loadFile = p => confirmDiscard().then(ok => ok && loadFile(p));
    return win;
  }

  Y.apps.register({
    id: 'codestudio', name: 'Code Studio', icon: 'code', color: ['#2b5876', '#4e4376'], category: 'Création',
    description: 'HTML, CSS et JS avec aperçu en direct', keywords: 'code ide editeur html css javascript web',
    exts: ['html', 'htm', 'css', 'js'], extPriority: { html: 10, htm: 10 },
    desktop: true, desktopOrder: 5, launch
  });
  Y.codeEditor = codeEditor;
})(window.YOS);
