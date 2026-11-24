/* YohannOS — Météo (données Open-Meteo, sans clé d'API) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;

  const CODES = {
    0: ['Ciel dégagé', '☀️', 'sun'], 1: ['Plutôt dégagé', '🌤️', 'cloudSun'], 2: ['Partiellement nuageux', '⛅', 'cloudSun'], 3: ['Couvert', '☁️', 'cloud'],
    45: ['Brouillard', '🌫️', 'fog'], 48: ['Brouillard givrant', '🌫️', 'fog'],
    51: ['Bruine légère', '🌦️', 'rain'], 53: ['Bruine', '🌦️', 'rain'], 55: ['Bruine dense', '🌧️', 'rain'], 56: ['Bruine verglaçante', '🌧️', 'rain'], 57: ['Bruine verglaçante', '🌧️', 'rain'],
    61: ['Pluie faible', '🌦️', 'rain'], 63: ['Pluie', '🌧️', 'rain'], 65: ['Forte pluie', '🌧️', 'rain'], 66: ['Pluie verglaçante', '🌧️', 'rain'], 67: ['Pluie verglaçante', '🌧️', 'rain'],
    71: ['Neige faible', '🌨️', 'snow'], 73: ['Neige', '🌨️', 'snow'], 75: ['Forte neige', '❄️', 'snow'], 77: ['Grains de neige', '🌨️', 'snow'],
    80: ['Averses', '🌦️', 'rain'], 81: ['Averses', '🌧️', 'rain'], 82: ['Violentes averses', '⛈️', 'rain'], 85: ['Averses de neige', '🌨️', 'snow'], 86: ['Averses de neige', '❄️', 'snow'],
    95: ['Orage', '⛈️', 'storm'], 96: ['Orage avec grêle', '⛈️', 'storm'], 99: ['Orage violent', '⛈️', 'storm']
  };
  Y.weatherCode = code => { const c = CODES[code] || ['Inconnu', '🌡️', 'thermo']; return { label: c[0], emoji: c[1], icon: c[2] }; };
  const DEFAULT = { name: 'Lille', country: 'France', lat: 50.6292, lon: 3.0573 };

  function launch() {
    let place = Y.settings.get('weatherCity') || DEFAULT;
    const input = el('input.input.wx-search', { placeholder: 'Rechercher une ville…', spellcheck: 'false' });
    const sugg = el('div.wx-sugg.hidden');
    const locBtn = el('button.btn.icon', { title: 'Ma position', html: Y.icons.svg('pin', 16) });
    const refreshBtn = el('button.btn.icon', { title: 'Actualiser', html: Y.icons.svg('refresh', 16) });
    const main = el('div.wx-main.scroll');
    const content = el('div.wx', el('div.wx-top', el('div.wx-search-wrap', input, sugg), locBtn, refreshBtn), main);
    const win = Y.apps.window('weather', { content, width: 760, height: 600, minWidth: 360, minHeight: 400 });

    async function load() {
      main.innerHTML = '';
      main.appendChild(el('div.empty-state', el('div.spinner'), el('div', `Chargement de la météo pour ${place.name}…`)));
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,pressure_msl&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        render(await r.json());
      } catch (e) {
        main.innerHTML = '';
        main.appendChild(el('div.empty-state', { html: Y.icons.svg('wifiOff', 40) }, el('div', 'Impossible de récupérer la météo.'), el('div.faint', navigator.onLine ? 'Le service météo est peut-être inaccessible.' : 'Vous semblez être hors ligne.'), el('button.btn', { onclick: load }, 'Réessayer')));
      }
    }

    function render(d) {
      const c = d.current, w = Y.weatherCode(c.weather_code);
      const night = !c.is_day;
      const theme = night ? 'night' : ['rain', 'storm'].includes(w.icon) ? 'rain' : w.icon === 'snow' ? 'snow' : ['cloud', 'fog'].includes(w.icon) ? 'cloud' : 'sun';
      content.dataset.theme = theme;
      win.setTitle(`Météo — ${place.name}`);
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
      const fmtT = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      main.innerHTML = '';
      main.appendChild(el('div.wx-hero',
        el('div',
          el('div.wx-place', { html: Y.icons.svg('pin', 15) + `<b>${U.escape(place.name)}${place.country ? `<span>, ${U.escape(place.country)}</span>` : ''}</b>` }),
          el('div.wx-temp', Math.round(c.temperature_2m) + '°'),
          el('div.wx-desc', w.label),
          el('div.wx-minmax', `Max ${Math.round(d.daily.temperature_2m_max[0])}° · Min ${Math.round(d.daily.temperature_2m_min[0])}°`)),
        el('div.wx-emoji', night && w.icon === 'sun' ? '🌙' : w.emoji)));
      const stat = (icon, k, v) => el('div.wx-stat', { html: Y.icons.svg(icon, 18) }, el('div', el('div.dim', k), el('b', v)));
      main.appendChild(el('div.wx-stats',
        stat('thermo', 'Ressenti', Math.round(c.apparent_temperature) + '°'),
        stat('droplet', 'Humidité', c.relative_humidity_2m + ' %'),
        stat('wind', 'Vent', `${Math.round(c.wind_speed_10m)} km/h ${dirs[Math.round(c.wind_direction_10m / 45) % 8]}`),
        stat('activity', 'Pression', Math.round(c.pressure_msl) + ' hPa'),
        stat('sun', 'Lever / coucher', `${fmtT(d.daily.sunrise[0])} · ${fmtT(d.daily.sunset[0])}`),
        stat('alert', 'Indice UV', String(Math.round(d.daily.uv_index_max[0] || 0)))));

      // prochaines 24 h
      const nowIdx = Math.max(0, d.hourly.time.findIndex(t => new Date(t) >= new Date(Date.now() - 3600000)));
      const hours = el('div.wx-hours');
      for (let i = nowIdx; i < Math.min(nowIdx + 24, d.hourly.time.length); i++) {
        const hw = Y.weatherCode(d.hourly.weather_code[i]);
        const p = d.hourly.precipitation_probability[i];
        hours.appendChild(el('div.wx-hour', { class: i === nowIdx ? 'now' : null },
          el('div.dim', i === nowIdx ? 'Maint.' : new Date(d.hourly.time[i]).getHours() + ' h'),
          el('div.wx-hour-ico', !d.hourly.is_day[i] && hw.icon === 'sun' ? '🌙' : hw.emoji),
          el('b', Math.round(d.hourly.temperature_2m[i]) + '°'),
          el('div.wx-rain', p ? `💧${p}%` : ' ')));
      }
      main.appendChild(el('div.wx-section', el('h3', 'Prochaines 24 heures'), hours));

      // 7 jours : barre min → max sur l'échelle de la semaine
      const lo = Math.min(...d.daily.temperature_2m_min), hi = Math.max(...d.daily.temperature_2m_max);
      const days = el('div.wx-days');
      d.daily.time.forEach((t, i) => {
        const dw = Y.weatherCode(d.daily.weather_code[i]);
        const mn = d.daily.temperature_2m_min[i], mx = d.daily.temperature_2m_max[i];
        const left = ((mn - lo) / (hi - lo || 1)) * 100, width = ((mx - mn) / (hi - lo || 1)) * 100;
        days.appendChild(el('div.wx-day',
          el('span.wx-dname', i === 0 ? 'Aujourd\'hui' : U.capitalize(new Date(t).toLocaleDateString('fr-FR', { weekday: 'long' }))),
          el('span.wx-dico', { title: dw.label }, dw.emoji),
          el('span.wx-drain.dim', d.daily.precipitation_probability_max[i] ? `💧${d.daily.precipitation_probability_max[i]}%` : ''),
          el('span.wx-dmin.dim', Math.round(mn) + '°'),
          el('span.wx-range', el('i', { style: { left: left + '%', width: Math.max(4, width) + '%' } })),
          el('span.wx-dmax', Math.round(mx) + '°')));
      });
      main.appendChild(el('div.wx-section', el('h3', 'Prévisions sur 7 jours'), days));
      main.appendChild(el('div.faint.wx-credit', { html: 'Données : <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · mise à jour ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }));
    }

    const search = U.debounce(async () => {
      const q = input.value.trim();
      if (q.length < 2) { sugg.classList.add('hidden'); return; }
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr`).then(x => x.json());
        sugg.innerHTML = '';
        (r.results || []).forEach(p => {
          const b = el('button', el('b', p.name), el('span.dim', ` ${[p.admin1, p.country].filter(Boolean).join(', ')}`));
          b.onclick = () => { place = { name: p.name, country: p.country, lat: p.latitude, lon: p.longitude }; Y.settings.set('weatherCity', place); input.value = ''; sugg.classList.add('hidden'); load(); };
          sugg.appendChild(b);
        });
        if (!sugg.childElementCount) sugg.appendChild(el('div.dim', { style: { padding: '8px 12px' } }, 'Aucune ville trouvée'));
        sugg.classList.remove('hidden');
      } catch (e) { sugg.classList.add('hidden'); }
    }, 300);
    input.addEventListener('input', search);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = sugg.querySelector('button'); b && b.click(); } if (e.key === 'Escape') sugg.classList.add('hidden'); });
    input.addEventListener('blur', () => setTimeout(() => sugg.classList.add('hidden'), 200));
    refreshBtn.onclick = load;
    locBtn.onclick = () => {
      if (!navigator.geolocation) return Y.dialog.alert('La géolocalisation n\'est pas disponible.', { parent: win });
      navigator.geolocation.getCurrentPosition(pos => {
        place = { name: 'Ma position', country: '', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) };
        Y.settings.set('weatherCity', place);
        load();
      }, () => Y.dialog.alert('Impossible d\'obtenir votre position (autorisation refusée ?).', { parent: win, icon: 'warn' }));
    };
    win.interval(load, 15 * 60000);
    load();
    return win;
  }

  Y.apps.register({
    id: 'weather', name: 'Météo', icon: 'cloudSun', color: ['#56ccf2', '#2f80ed'], category: 'Internet',
    description: 'Prévisions météo en temps réel', keywords: 'meteo temps pluie soleil forecast',
    single: true, launch
  });
})(window.YOS);
