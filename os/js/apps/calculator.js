/* YohannOS — Calculatrice (standard + scientifique, historique) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;

  function launch() {
    let expr = '', justEvaluated = false, sci = U.store.get('calc-sci', false), deg = true, mem = 0;
    let history = U.store.get('calc-history', []);
    const exprEl = el('div.calc-expr');
    const resEl = el('div.calc-res', '0');
    const histList = el('div.calc-hist-list');
    const keys = el('div.calc-keys');
    const sciKeys = el('div.calc-sci');
    const modeBtn = el('button.btn.sm', { onclick: () => { sci = !sci; U.store.set('calc-sci', sci); layout(); } });
    const degBtn = el('button.btn.sm', { onclick: () => { deg = !deg; degBtn.textContent = deg ? 'DEG' : 'RAD'; preview(); } }, 'DEG');
    const content = el('div.calc',
      el('div.calc-main',
        el('div.toolbar', modeBtn, degBtn, el('span.grow'), el('span.dim', { style: { fontSize: '12px' } }, 'Clavier supporté')),
        el('div.calc-display.selectable', exprEl, resEl),
        el('div.calc-pad', sciKeys, keys)),
      el('div.calc-hist', el('div.calc-hist-head', el('b', 'Historique'), el('button.btn.ghost.sm', { onclick: () => { history = []; U.store.set('calc-history', history); renderHist(); } }, 'Effacer')), histList));
    const win = Y.apps.window('calculator', { content, width: 600, height: 520, minWidth: 300, minHeight: 440 });

    const STD = [
      ['MC', 'fn', () => { mem = 0; }], ['MR', 'fn', () => input(U.formatNumber(mem))], ['M+', 'fn', () => { mem += safeEval() || 0; }], ['%', 'op', () => input('%')],
      ['C', 'fn danger', () => clearAll()], ['⌫', 'fn', () => backspace()], ['(', 'fn', () => input('(')], [')', 'fn', () => input(')')],
      ['7'], ['8'], ['9'], ['÷', 'op', () => input('÷')],
      ['4'], ['5'], ['6'], ['×', 'op', () => input('×')],
      ['1'], ['2'], ['3'], ['−', 'op', () => input('−')],
      ['±', 'fn', () => negate()], ['0'], [',', '', () => input(',')], ['+', 'op', () => input('+')],
      ['=', 'eq', () => evaluate()]
    ];
    const SCI = [
      ['sin', () => input('sin(')], ['cos', () => input('cos(')], ['tan', () => input('tan(')], ['π', () => input('π')],
      ['ln', () => input('ln(')], ['log', () => input('log(')], ['√', () => input('√(')], ['e', () => input('e')],
      ['x²', () => input('^2')], ['xʸ', () => input('^')], ['n!', () => input('!')], ['1/x', () => { expr = `1/(${expr || '0'})`; preview(); render(); }],
      ['asin', () => input('asin(')], ['acos', () => input('acos(')], ['atan', () => input('atan(')], ['|x|', () => input('abs(')]
    ];

    function layout() {
      modeBtn.textContent = sci ? 'Standard' : 'Scientifique';
      sciKeys.classList.toggle('hidden', !sci);
      win.setSize(sci ? 720 : 600, 520);
    }
    STD.forEach(([label, cls, fn]) => {
      const b = el('button.calc-key', { class: cls || 'num' }, label);
      if (label === '=') b.classList.add('wide');
      b.addEventListener('click', () => { (fn || (() => input(label)))(); Y.sound.play('click'); });
      keys.appendChild(b);
    });
    SCI.forEach(([label, fn]) => { const b = el('button.calc-key.sci', label); b.addEventListener('click', fn); sciKeys.appendChild(b); });

    function input(s) {
      if (justEvaluated) { if (/^[\d,.(πe√a-z]/.test(s)) expr = ''; justEvaluated = false; }
      expr += s;
      render(); preview();
    }
    function clearAll() { expr = ''; justEvaluated = false; render(); resEl.textContent = '0'; resEl.classList.remove('err'); }
    function backspace() { expr = expr.replace(/(sin|cos|tan|asin|acos|atan|ln|log|abs|√)\($|.$/, ''); justEvaluated = false; render(); preview(); }
    function negate() { expr = expr.startsWith('−(') && expr.endsWith(')') ? expr.slice(2, -1) : `−(${expr || '0'})`; render(); preview(); }
    function safeEval() { try { const v = U.evalMath(expr, { degrees: deg }); return isFinite(v) ? v : null; } catch (e) { return null; } }
    function render() { exprEl.textContent = expr || ' '; exprEl.scrollLeft = exprEl.scrollWidth; }
    function preview() {
      const v = safeEval();
      resEl.classList.remove('err');
      if (v != null && expr) resEl.textContent = fmt(v);
    }
    function fmt(v) { const s = U.formatNumber(v); if (/e/.test(s)) return s.replace('.', ','); const [i, d] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + (d ? ',' + d : ''); }
    function evaluate() {
      if (!expr) return;
      try {
        const v = U.evalMath(expr, { degrees: deg });
        if (!isFinite(v)) throw new Error(isNaN(v) ? 'Résultat indéfini' : 'Division par zéro');
        const res = U.formatNumber(v);
        history.unshift({ expr, res });
        history = history.slice(0, 50);
        U.store.set('calc-history', history);
        renderHist();
        exprEl.textContent = expr + ' =';
        resEl.textContent = fmt(v);
        expr = res.replace('.', ',');
        justEvaluated = true;
      } catch (e) {
        resEl.textContent = e.message.length < 30 ? e.message : 'Erreur';
        resEl.classList.add('err');
        Y.sound.play('error');
      }
    }
    function renderHist() {
      histList.innerHTML = '';
      if (!history.length) histList.appendChild(el('div.empty-state', 'Aucun calcul'));
      history.forEach(h => {
        const row = el('button.calc-hist-item', el('div.dim', h.expr + ' ='), el('div', fmt(parseFloat(h.res))));
        row.addEventListener('click', () => { expr = h.res.replace('.', ','); justEvaluated = true; render(); resEl.textContent = fmt(parseFloat(h.res)); });
        histList.appendChild(row);
      });
    }
    win.el.addEventListener('keydown', e => {
      const k = e.key;
      if (/^[0-9]$/.test(k)) input(k);
      else if (k === '+' ) input('+');
      else if (k === '-') input('−');
      else if (k === '*') input('×');
      else if (k === '/') { e.preventDefault(); input('÷'); }
      else if (k === '.' || k === ',') input(',');
      else if (k === '(' || k === ')' || k === '%' || k === '^' || k === '!') input(k);
      else if (k === 'Enter' || k === '=') { e.preventDefault(); evaluate(); }
      else if (k === 'Backspace') backspace();
      else if (k === 'Escape' || k === 'Delete') clearAll();
      else if (k === 'p') input('π');
      else return;
      const btn = Array.from(keys.children).find(b => b.textContent === ({ '-': '−', '*': '×', '/': '÷', Enter: '=', '.': ',', Backspace: '⌫', Escape: 'C' }[k] || k));
      if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 120); }
    });
    layout(); renderHist(); render();
    return win;
  }

  Y.apps.register({
    id: 'calculator', name: 'Calculatrice', icon: 'calculator', color: ['#8e9aaf', '#4d5668'], category: 'Productivité',
    description: 'Calculs standard et scientifiques', keywords: 'calcul maths calculator',
    single: true, launch
  });
})(window.YOS);
