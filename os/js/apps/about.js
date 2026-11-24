/* YohannOS — Appli « À propos de moi » (CV interactif) */
(function (Y) {
  'use strict';
  const { el } = Y.U;

  /* ✏️ Modifie ces informations pour mettre ton CV à jour */
  const PROFILE = {
    name: 'Yohann Marant',
    title: 'Étudiant en informatique',
    school: 'EPSI Lille',
    city: 'Lille, France',
    email: 'yohann.marant@ecoles-epsi.net',
    bio: 'Passionné d\'informatique depuis le lycée (spécialités Maths et NSI), je me forme au développement à l\'EPSI Lille. J\'aime comprendre comment les choses fonctionnent sous le capot — ce site, un OS complet codé from scratch, en est la preuve.',
    education: [
      { when: '2024 – aujourd\'hui', what: 'Étudiant à l\'EPSI', where: 'Campus de Lille', link: 'https://www.epsi.fr/campus/campus-de-lille/', icon: 'graduation' },
      { when: '2024', what: 'Baccalauréat général', where: 'Spécialités Mathématiques & NSI', icon: 'book' },
      { when: 'Lycée', what: 'Lycée Ozanam', where: 'Lille', link: 'https://www.groupe-oec.fr/', icon: 'home' }
    ],
    skills: [
      { name: 'HTML', level: 85, color: '#e34c26' },
      { name: 'CSS', level: 80, color: '#2965f1' },
      { name: 'JavaScript', level: 70, color: '#d4a507' },
      { name: 'Python', level: 65, color: '#3572a5' },
      { name: 'PHP', level: 45, color: '#777bb3' },
      { name: 'Git / GitHub', level: 60, color: '#f05032' }
    ],
    softSkills: ['Curieux', 'Persévérant', 'Esprit d\'équipe', 'Autonome', 'Logique'],
    hobbies: [
      { name: 'Salle de sport', icon: 'dumbbell', desc: 'Musculation et cardio régulièrement.' },
      { name: 'Jeux vidéo', icon: 'gamepad', desc: 'Des jeux de stratégie aux FPS.' },
      { name: 'Amis', icon: 'users', desc: 'Sorties et activités entre amis.' },
      { name: 'Code', icon: 'code', desc: 'Projets perso comme… ce site !' }
    ],
    projects: [
      { name: 'YohannOS', desc: 'Un OS de bureau complet dans le navigateur : gestionnaire de fenêtres, système de fichiers, terminal, plus de 20 applications.', tags: ['HTML', 'CSS', 'JS'] },
      { name: 'CV en HTML', desc: 'Ma première page web : CV, carte de visite et formulaire de contact.', tags: ['HTML', 'CSS', 'PHP'], url: '../index.html' }
    ]
  };

  function launch(args) {
    const tabs = [['profil', 'Profil', 'user'], ['parcours', 'Parcours', 'graduation'], ['competences', 'Compétences', 'code'], ['projets', 'Projets', 'briefcase'], ['loisirs', 'Loisirs', 'heart']];
    const nav = el('div.ab-nav');
    const main = el('div.ab-main.scroll.selectable');
    const header = el('div.ab-header',
      el('div.ab-avatar', 'YM'),
      el('div', el('h1', PROFILE.name), el('div.ab-sub', `${PROFILE.title} · ${PROFILE.school}`),
        el('div.ab-chips', el('span.badge', { html: Y.icons.svg('pin', 12) + ' ' + PROFILE.city }), el('span.badge', { html: Y.icons.svg('graduation', 12) + ' Promo 2024/2025' }))));
    const sections = {
      profil: () => el('div',
        el('p.ab-bio', PROFILE.bio),
        el('div.ab-cards',
          card('graduation', 'Formation', 'EPSI Lille'),
          card('book', 'Bac', 'Général — Maths / NSI'),
          card('pin', 'Ville', PROFILE.city),
          card('mail', 'Contact', PROFILE.email)),
        el('div.ab-actions',
          el('button.btn.primary', { html: Y.icons.svg('send', 15) + ' Me contacter', onclick: () => Y.apps.launch('contact') }),
          el('button.btn', { html: Y.icons.svg('fileText', 15) + ' CV en Markdown', onclick: () => Y.apps.openFile(Y.fs.HOME + '/Documents/CV.md') }),
          el('button.btn', { html: Y.icons.svg('globe', 15) + ' CV original', onclick: () => Y.apps.launch('browser', { url: '../index.html' }) }))),
      parcours: () => el('div.ab-timeline', PROFILE.education.map(e => el('div.ab-tl-item',
        el('div.ab-tl-dot', { html: Y.icons.svg(e.icon, 14) }),
        el('div', el('div.ab-tl-when', e.when), el('div.ab-tl-what', e.link ? el('a', { href: e.link, target: '_blank', rel: 'noopener' }, e.what) : e.what), el('div.dim', e.where))))),
      competences: () => el('div',
        el('h3', 'Langages & outils'),
        el('div.ab-skills', PROFILE.skills.map(s => el('div.ab-skill',
          el('div.row', el('span', s.name), el('span.grow'), el('span.dim', s.level + ' %')),
          el('div.ab-bar', el('i', { style: { width: '0%', background: s.color }, dataset: { w: s.level } }))))),
        el('h3', 'Qualités'),
        el('div.ab-chips', PROFILE.softSkills.map(s => el('span.badge', s)))),
      projets: () => el('div.ab-projects', PROFILE.projects.map(p => el('div.card',
        el('div.row', el('b', p.name), el('span.grow'), p.url ? el('button.btn.sm', { onclick: () => Y.apps.launch('browser', { url: p.url }) }, 'Voir') : null),
        el('p.dim', p.desc),
        el('div.ab-chips', p.tags.map(t => el('span.badge', t)))))),
      loisirs: () => el('div.ab-cards', PROFILE.hobbies.map(h => el('div.card.ab-hobby', { html: Y.icons.tile(h.icon, null, 40) }, el('b', h.name), el('span.dim', h.desc))))
    };
    function card(icon, k, v) { return el('div.card.ab-card', { html: Y.icons.svg(icon, 18) }, el('div', el('div.dim', k), el('div', v))); }
    function show(id) {
      nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.id === id));
      main.innerHTML = '';
      main.appendChild(sections[id]());
      main.scrollTop = 0;
      requestAnimationFrame(() => main.querySelectorAll('.ab-bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
    }
    tabs.forEach(([id, label, icon]) => nav.appendChild(el('button', { dataset: { id }, html: Y.icons.svg(icon, 16) + `<span>${label}</span>`, onclick: () => show(id) })));
    const content = el('div.ab', header, el('div.ab-body', nav, main));
    const win = Y.apps.window('about', { content, width: 760, height: 560, minWidth: 360 });
    show(args.tab || 'profil');
    return win;
  }

  Y.apps.register({
    id: 'about', name: 'À propos de moi', desktopName: 'À propos de moi', icon: 'idcard', color: ['#7f5cff', '#4b8bff'],
    category: 'Système', description: 'Le CV interactif de Yohann', keywords: 'cv profil yohann marant moi',
    desktop: true, desktopOrder: 1, single: true, launch
  });
})(window.YOS);
