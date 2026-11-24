/* YohannOS — Contact (formulaire qui prépare un e-mail) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const TO = 'yohann.marant@gmail.com';

  function launch() {
    const field = (label, input) => el('label.ct-field', el('span', label), input);
    const name = el('input.input', { placeholder: 'Ton nom', autocomplete: 'name' });
    const email = el('input.input', { type: 'email', placeholder: 'ton.adresse@exemple.fr', autocomplete: 'email' });
    const subject = el('select.select', el('option', 'Proposition de stage / alternance'), el('option', 'Projet ou collaboration'), el('option', 'Question sur YohannOS'), el('option', 'Juste dire bonjour 👋'));
    const msg = el('textarea.textarea', { rows: 7, placeholder: 'Ton message…' });
    const count = el('span.faint', '0 / 2000');
    const err = el('div.ct-err');
    const send = el('button.btn.primary', { html: Y.icons.svg('send', 15) + ' Envoyer' });
    const draft = U.store.get('contact-draft', {});
    name.value = draft.name || ''; email.value = draft.email || ''; msg.value = draft.msg || '';
    const saveDraft = U.debounce(() => U.store.set('contact-draft', { name: name.value, email: email.value, msg: msg.value }), 300);
    [name, email, msg].forEach(i => i.addEventListener('input', () => { saveDraft(); count.textContent = `${msg.value.length} / 2000`; err.textContent = ''; }));
    msg.maxLength = 2000;
    count.textContent = `${msg.value.length} / 2000`;

    const content = el('div.ct.scroll',
      el('div.ct-head', el('div.ct-avatar', 'YM'), el('div', el('h2', 'Contacte-moi'), el('p.dim', 'Remplis le formulaire : ton logiciel de messagerie s\'ouvrira avec le message prêt à partir.'))),
      el('div.ct-grid', field('Nom', name), field('E-mail', email)),
      field('Sujet', subject),
      field('Message', msg),
      el('div.row', count, el('span.grow'), err, send),
      el('div.ct-alt',
        el('div.card', { html: Y.icons.svg('mail', 18) }, el('div', el('div.dim', 'E-mail personnel'), el('a', { href: 'mailto:' + TO }, TO))),
        el('div.card', { html: Y.icons.svg('graduation', 18) }, el('div', el('div.dim', 'E-mail école'), el('a', { href: 'mailto:yohann.marant@ecoles-epsi.net' }, 'yohann.marant@ecoles-epsi.net')))));
    const win = Y.apps.window('contact', { content, width: 560, height: 620, minWidth: 340 });

    send.addEventListener('click', () => {
      if (!name.value.trim()) { err.textContent = 'Indique ton nom.'; name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { err.textContent = 'Adresse e-mail invalide.'; email.focus(); return; }
      if (msg.value.trim().length < 5) { err.textContent = 'Ton message est un peu court.'; msg.focus(); return; }
      const body = `${msg.value.trim()}\n\n— ${name.value.trim()} (${email.value.trim()})\nEnvoyé depuis YohannOS`;
      const a = el('a', { href: `mailto:${TO}?subject=${encodeURIComponent('[YohannOS] ' + subject.value)}&body=${encodeURIComponent(body)}` });
      document.body.appendChild(a); a.click(); a.remove();
      U.store.remove('contact-draft');
      Y.notify({ title: 'Message prêt ✉️', body: 'Ton logiciel de messagerie devrait s\'ouvrir. Merci !', app: 'contact', type: 'success' });
    });
    setTimeout(() => (name.value ? msg : name).focus(), 60);
    return win;
  }

  Y.apps.register({
    id: 'contact', name: 'Contact', icon: 'mail', color: ['#ee0979', '#ff6a00'], category: 'Internet',
    description: 'M\'envoyer un message', keywords: 'mail email message ecrire',
    single: true, launch
  });
})(window.YOS);
