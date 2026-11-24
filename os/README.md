# YohannOS

Un système d'exploitation de bureau complet qui tourne dans le navigateur, codé à la main en
**HTML, CSS et JavaScript**, sans aucune bibliothèque, framework ni étape de build.

➡️ En ligne : `https://ymarant.github.io/os/` (une fois la branche fusionnée dans `main`)

En local : ouvre `os/index.html` dans un navigateur, ou lance un petit serveur à la racine du dépôt
(`python3 -m http.server`) puis va sur <http://localhost:8000/os/>.

## Ce qu'il y a dedans

### Le système

| Module | Rôle |
|---|---|
| Démarrage | Écran BIOS, logo, écran de verrouillage avec mot de passe optionnel |
| Gestionnaire de fenêtres | Déplacer, redimensionner (8 poignées), réduire, agrandir, ancrer à gauche/droite/plein écran en glissant contre un bord, « toujours au premier plan », fenêtres modales |
| Système de fichiers | Arborescence Unix (`/home/yohann`, `/etc`…) sauvegardée dans le `localStorage`, corbeille avec restauration, export/import de sauvegarde |
| Bureau | Icônes déplaçables sur une grille, sélection au lasso, renommage, glisser-déposer vers un dossier ou la corbeille, import de fichiers depuis l'ordinateur par glisser-déposer |
| Barre des tâches | Menu Démarrer avec recherche, applis épinglées, centre de contrôle (thème, son, ne pas déranger…), notifications, calendrier, batterie et réseau réels |
| Palette de commandes | `Ctrl + K` : applis, fichiers, commandes système et calculs |
| Personnalisation | 12 fonds d'écran (dont 2 animés), thème clair/sombre/auto, couleur d'accent, transparence, économiseur d'écran |

### Les 21 applications

- **À propos de moi** : le CV interactif (onglets, compétences, parcours, projets)
- **Fichiers** : explorateur complet (grille/liste, tri, recherche, copier/couper/coller, glisser-déposer, propriétés)
- **Terminal** : shell `ysh` avec ~80 commandes (`ls`, `cd`, `cat`, `grep`, `find`, `tree`, `neofetch`, `cowsay`, `weather`…), pipes `|`, redirections `>`/`>>`, `&&`, `||`, `;`, variables, jokers `*`, historique et autocomplétion avec Tab
- **Bloc-notes** : éditeur avec aperçu Markdown, rechercher/remplacer, numéros de ligne
- **Code Studio** : mini-IDE HTML/CSS/JS avec coloration syntaxique, aperçu en direct, console JavaScript et modèles
- **Navigateur** : onglets, favoris, page d'accueil, ouvre aussi le CV d'origine
- **Paint** : pinceau, gomme, aérosol, formes, pot de peinture, pipette, texte, annuler/rétablir, zoom
- **Visionneuse** d'images, **Calculatrice** scientifique, **Horloge** (monde, chrono, minuteur, alarmes)
- **Météo** en temps réel (API Open-Meteo, sans clé)
- **Studio musique** : piano synthétiseur jouable au clavier + boîte à rythmes 16 pas, tout est synthétisé en Web Audio
- **Contact**, **Gestionnaire des tâches** (processus, graphiques de performance), **Paramètres**, **Bienvenue**
- **Jeux** : Démineur, Snake, Casse-briques (5 niveaux, bonus), Morpion (IA minimax)

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl + K` / `Alt + Espace` | Recherche / palette de commandes |
| `Ctrl + Alt + T` | Terminal |
| `Ctrl + Alt + E` | Explorateur de fichiers |
| `Ctrl + Alt + D` | Afficher le bureau |
| `Ctrl + Alt + L` | Verrouiller |
| `Ctrl + Alt + W` | Fermer la fenêtre active |
| `Ctrl + Alt + ← / →` | Fenêtre précédente / suivante |

## Organisation du code

```
os/
├── index.html            point d'entrée
├── css/
│   ├── base.css          variables, thèmes clair/sombre, composants (boutons, champs…)
│   ├── system.css        démarrage, bureau, barre des tâches, menus, notifications
│   ├── windows.css       fenêtres et boîtes de dialogue
│   └── apps.css          styles de chaque application
└── js/
    ├── core/             le « noyau »
    │   ├── utils.js      helpers DOM, stockage, bus d'événements, évaluateur mathématique
    │   ├── icons.js      bibliothèque d'icônes SVG
    │   ├── fs.js         système de fichiers virtuel
    │   ├── settings.js   réglages, thèmes, fonds d'écran
    │   ├── wm.js         gestionnaire de fenêtres
    │   ├── dialog.js     alertes, confirmations, ouvrir/enregistrer
    │   ├── desktop.js    bureau et icônes
    │   ├── taskbar.js    barre des tâches, menu Démarrer, centre de contrôle
    │   ├── boot.js       démarrage, verrouillage, arrêt, économiseur
    │   └── …
    └── apps/             une appli par fichier
```

Chaque application s'enregistre avec `YOS.apps.register({ id, name, icon, launch })` et crée sa
fenêtre avec `YOS.apps.window(id, { content })`. Pour modifier les infos du CV, édite l'objet
`PROFILE` en haut de `js/apps/about.js`.

Les données (fichiers, réglages, scores) restent dans le navigateur de chaque visiteur.
