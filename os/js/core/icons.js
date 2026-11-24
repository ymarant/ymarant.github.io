/* =========================================================
   YohannOS — bibliothèque d'icônes (SVG maison)
   ========================================================= */
(function (Y) {
  'use strict';

  const G = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 10h4M14 14h3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folderOpen: '<path d="M3 17V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1"/><path d="M3 19l3-8h16l-3 8z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    fileText: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    brush: '<path d="M18.5 3.5a2 2 0 0 1 3 3L13 15l-3-3z"/><path d="M10 12c-2.5 0-4.5 1.6-4.5 4 0 1.5-1 2.5-2.5 3 3 1.5 7.5 1 8.5-2 .4-1.2.5-2.2.5-2.9"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.3-.8-2.2 0-.8.7-1.3 1.5-1.3H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h0M12 12h0M16 12h0M8 16h0M12 16h0M16 16h0"/>',
    bomb: '<circle cx="12" cy="12" r="5.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="10.2" cy="10.2" r="1" fill="currentColor" stroke="none"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    snake: '<path d="M3 18h9a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h9"/><circle cx="19" cy="6" r="1.6"/>',
    bricks: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M9 4v5M15 4v5"/><circle cx="12" cy="14" r="2"/><path d="M8 20h8"/>',
    hash: '<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    piano: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M12 4v16M16 4v16"/><path d="M6.5 4h3v9h-3zM14.5 4h3v9h-3z" fill="currentColor"/>',
    cloudSun: '<path d="M10 2v1.5M4.2 4.2l1 1M2 10h1.5M15.8 4.2l-1 1"/><path d="M6.6 12a4 4 0 0 1 7.2-3.4"/><path d="M17 20H9a4 4 0 1 1 .7-7.9A5 5 0 0 1 19 14a3 3 0 0 1-2 6z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    cloud: '<path d="M17 19H8a5 5 0 1 1 1.2-9.9A6 6 0 0 1 20.5 12 3.5 3.5 0 0 1 17 19z"/>',
    rain: '<path d="M17 15H8a5 5 0 1 1 1.2-9.9A6 6 0 0 1 20.5 8 3.5 3.5 0 0 1 17 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow: '<path d="M17 14H8a5 5 0 1 1 1.2-9.9A6 6 0 0 1 20.5 7 3.5 3.5 0 0 1 17 14z"/><path d="M8 18h0M12 20h0M16 18h0M10 22h0M14 22h0"/>',
    storm: '<path d="M17 14H8a5 5 0 1 1 1.2-9.9A6 6 0 0 1 20.5 7 3.5 3.5 0 0 1 17 14z"/><path d="M13 14l-3 4h4l-3 4"/>',
    fog: '<path d="M4 9h16M3 13h18M5 17h14M8 21h8"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    drive: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l3-8h8l3 8M17 16.5h0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6M19 5l1.5 1.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    trashFull: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    power: '<path d="M12 3v9"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    restart: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h0"/>',
    wifiOff: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h0M3 3l18 18"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
    volumeLow: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    volumeX: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
    bellOff: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4M3 3l18 18"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M4 4v4h4M20 20v-4h-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    minus: '<path d="M5 12h14"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    restore: '<rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4H18.5A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronUp: '<path d="M6 15l6-6 6 6"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h0"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h0"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h0"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    download: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    upload: '<path d="M12 20V8M6 14l6-6 6 6M4 4h16"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
    save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    gridView: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    listView: '<path d="M9 6h11M9 12h11M9 18h11M4 6h0M4 12h0M4 18h0"/>',
    apps: '<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    eraser: '<path d="M20 20H9L4 15l10-10 7 7-8 8"/><path d="M9 10l5 5"/>',
    line: '<path d="M5 19L19 5"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    bucket: '<path d="M4.5 11.5l7-7 7 7-7 7z"/><path d="M4.5 11.5h14M20 15c0 2 1.5 3 1.5 4.3a1.5 1.5 0 0 1-3 0C18.5 18 20 17 20 15z"/>',
    pipette: '<path d="M19 5a2.1 2.1 0 0 0-3 0l-2 2 3 3 2-2a2.1 2.1 0 0 0 0-3zM14 7l-9 9v3h3l9-9"/>',
    type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    spray: '<rect x="6" y="9" width="8" height="12" rx="2"/><path d="M8 9V6h4v3M17 5h0M19.5 7h0M19.5 3h0M22 5h0M17 9h0"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4M15 12h0M18 13.5h0"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5L20 19M8.5 15.5L20 5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    thermo: '<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/>',
    pin: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h0M10 10h0M14 10h0M18 10h0M7 14h10"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    maximize: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    graduation: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    dumbbell: '<path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2.5.5 4 2.5 4 5.5"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    wave: '<path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h0M15 9h0M12 12h0M9 15h0M15 15h0"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h0M15 9h0"/>'
  };

  function svg(name, size = 18, cls = '') {
    const g = G[name] || G.file;
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`;
  }

  function tile(name, colors, size = 40) {
    const [c1, c2] = colors || ['#7c6cff', '#4b8bff'];
    const r = Math.round(size * 0.56);
    return `<span class="app-tile" style="--c1:${c1};--c2:${c2};width:${size}px;height:${size}px">${svg(name, r)}</span>`;
  }

  /* Types de fichiers : icône + couleur du badge d'extension */
  const FILE_TYPES = {
    txt: ['fileText', '#5c677d'], md: ['fileText', '#3b82f6'], log: ['fileText', '#5c677d'],
    html: ['code', '#e34c26'], htm: ['code', '#e34c26'], css: ['code', '#2965f1'], js: ['code', '#d4a507'],
    json: ['code', '#7a7a7a'], py: ['code', '#3572a5'], php: ['code', '#777bb3'], sh: ['terminal', '#3a3f4b'],
    png: ['image', '#10b981'], jpg: ['image', '#10b981'], jpeg: ['image', '#10b981'], gif: ['image', '#10b981'], webp: ['image', '#10b981'], svg: ['image', '#f59e0b'],
    seq: ['music', '#b91d73'], url: ['link', '#185a9d'], csv: ['fileText', '#16a34a']
  };

  function fileIcon(name, isDir, size = 48) {
    if (isDir) {
      return `<span class="file-ico" style="width:${size}px;height:${size}px">${folderSvg(size)}</span>`;
    }
    const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
    const t = FILE_TYPES[ext] || ['file', '#5c677d'];
    return `<span class="file-ico" style="width:${size}px;height:${size}px;--ext-color:${t[1]}">${docSvg(size, t[1])}${ext && size >= 32 ? `<span class="ext">${Y.U.escape(ext.slice(0, 4))}</span>` : ''}</span>`;
  }

  function folderSvg(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M4 12a4 4 0 0 1 4-4h10l4 4h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#e8a33d"/>
      <path d="M4 18a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#ffc35c"/>
      <path d="M4 18a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v2H4z" fill="#ffd68a" opacity=".6"/></svg>`;
  }
  function docSvg(size, color) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 4h17l10 10v28a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#f4f6fb"/>
      <path d="M29 4l10 10h-8a2 2 0 0 1-2-2z" fill="#cfd5e3"/>
      <path d="M15 20h14M15 25h18M15 30h12" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>`;
  }

  const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="yos-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c6cff"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#yos-lg)"/><path d="M19 17l13 17 13-17M32 34v14" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  Y.icons = { glyphs: G, svg, tile, fileIcon, FILE_TYPES, LOGO };
})(window.YOS);
