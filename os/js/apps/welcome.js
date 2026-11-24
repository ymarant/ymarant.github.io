/* YohannOS — Appli « Bienvenue » */
(function (Y) {
  'use strict';
  const { el } = Y.U;

  Y.apps.register({
    id: 'welcome', name: 'Bienvenue', icon: 'sparkle', color: ['#fc5c7d', '#6a82fb'], category: 'Système',
    description: 'Visite guidée de YohannOS', keywords: 'aide help tour guide',
    single: true,
    launch() {
      const cards = [
        ['about', 'Qui suis-je ?', 'Mon parcours, mes études et mes centres d\'intérêt.'],
        ['terminal', 'Terminal', 'Un vrai shell : ls, cd, cat, grep, pipes… tape « help ».'],
        ['codestudio', 'Code Studio', 'HTML / CSS / JS avec aperçu en direct et console.'],
        ['paint', 'Paint', 'Dessine et enregistre tes œuvres dans « Images ».'],
        ['synth', 'Studio musique', 'Piano et boîte à rythmes synthétisés.'],
        ['minesweeper', 'Jeux', 'Démineur, Snake, Casse-briques, Morpion…']
      ];
      const grid = el('div.wel-grid');
      cards.forEach(([id, t, d]) => {
        const a = Y.apps.get(id);
        if (!a) return;
        const c = el('button.wel-card', { html: Y.icons.tile(a.icon, a.color, 40) }, el('div', el('b', t), el('span', d)));
        c.addEventListener('click', () => Y.apps.launch(id));
        grid.appendChild(c);
      });
      const tips = el('div.wel-tips',
        el('div', { html: '<span class="kbd">Ctrl</span> + <span class="kbd">K</span> rechercher n\'importe quoi' }),
        el('div', { html: '<span class="kbd">Clic droit</span> sur le bureau pour plus d\'options' }),
        el('div', { html: 'Glisse une fenêtre contre un bord de l\'écran pour l\'ancrer' }),
        el('div', { html: 'Dépose des fichiers de ton ordinateur sur le bureau pour les importer' }));
      const content = el('div.wel scroll',
        el('div.wel-hero',
          el('div.wel-logo', { html: Y.icons.LOGO }),
          el('h1', { html: 'Bienvenue sur Yohann<b>OS</b>' }),
          el('p', 'Un système d\'exploitation complet qui tourne dans ton navigateur — codé à la main en HTML, CSS et JavaScript, sans aucune bibliothèque.')),
        grid, tips,
        el('div.wel-foot', el('button.btn.primary', { onclick: () => Y.apps.launch('about') }, 'Découvrir mon profil'), el('button.btn', { onclick: () => win.close() }, 'Commencer à explorer')));
      const win = Y.apps.window('welcome', { content, width: 680, height: 600 });
      return win;
    }
  });
})(window.YOS);
