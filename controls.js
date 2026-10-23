// rainier v2.1.0
import { CFG, RAD, SKY_Z, state } from './config.js';
import { astro } from './astro.js';
import { effectiveCover, effectiveWind } from './clouds.js';
import { simMs, wxNow, precipTargets } from './weather.js';
import { strike } from './lightning.js';

let slider;
let coverSlider;
let windSlider;
let precipSlider;
let tempSlider;
let fogSlider;
let wxEl;
let lastStat = 0;

function mark(name) {
  const n = new Date();
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  if (state.owm && name === 'Dawn') return Math.round((state.owm.sunrise - mid) / 60000);
  if (state.owm && name === 'Dusk') return Math.round((state.owm.sunset - mid) / 60000);
  if (name === 'Night') return 60;
  let best = -2;
  let rise = 0;
  let set = 0;
  let noon = 720;
  let seen = false;
  for (let m = 0; m < 1440; m += 5) {
    const alt = astro(new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, m)).sun.y;
    if (alt > best) { best = alt; noon = m; }
    if (alt > 0 && !seen) { seen = true; rise = m; }
    if (alt > 0) set = m;
  }
  return { Dawn: rise, Noon: noon, Dusk: set }[name];
}

function readFile(u) {
  return new Promise(function (res) {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', u);
      x.onload = function () { res(x.status === 0 || (x.status >= 200 && x.status < 300) ? x.responseText : ''); };
      x.onerror = function () { res(''); };
      x.send();
    } catch (err) { res(''); }
  });
}

async function loadKey() {
  if (CFG.owmKey.charAt(0) !== '%') {
    state.keySrc = 'inject';
    return true;
  }
  for (let i = 0; i < CFG.keyFiles.length; i++) {
    const m = (await readFile(CFG.keyFiles[i])).match(/[0-9a-f]{32}/i);
    if (m) {
      CFG.owmKey = m[0];
      state.keySrc = 'file';
      try { localStorage.setItem('rainier.key', m[0]); } catch (err) {}
      return true;
    }
  }
  try {
    const k = localStorage.getItem('rainier.key');
    if (k) {
      CFG.owmKey = k;
      state.keySrc = 'cache';
      return true;
    }
  } catch (err) {}
  state.owmStatus = 'nokey';
  return false;
}

async function loadOwm() {
  state.owmStatus = 'loading';
  try {
    const url = 'https://api.openweathermap.org/data/3.0/onecall?lat=' + CFG.lat + '&lon=' + CFG.lon + '&exclude=minutely,alerts&appid=' + CFG.owmKey;
    const r = await (await fetch(url)).json();
    if (!r.daily) {
      state.owmStatus = 'err ' + (r.cod || '') + ' ' + (r.message || 'no data');
      return;
    }
    const d = r.daily[0];
    state.owm = {
      sunrise: d.sunrise * 1000,
      sunset: d.sunset * 1000,
      moonrise: d.moonrise || null,
      moonset: d.moonset || null,
      phase: d.moon_phase,
      clouds: r.current ? r.current.clouds : null,
      windSpd: r.current ? r.current.wind_speed : null,
      windDeg: r.current ? r.current.wind_deg : null,
      icon: r.current && r.current.weather && r.current.weather[0] ? r.current.weather[0].icon : null,
      currentEntry: r.current || null,
      hourly: r.hourly || []
    };
    state.wxVer++;
    state.key = '';
    state.owmStatus = 'ok';
  } catch (err) {
    state.owmStatus = 'err ' + err.message;
  }
}

export function syncSlider() {
  const n = new Date(simMs());
  slider.value = n.getHours() * 60 + n.getMinutes();
  if (state.coverManual === null) coverSlider.value = Math.round(effectiveCover() * 100);
  if (state.windManual === null) windSlider.value = Math.round(effectiveWind().spd);
  if (state.precipManual === null) precipSlider.value = Math.round(precipTargets().intensity * 100);
  if (state.fogManual === null) fogSlider.value = Math.round(precipTargets().fog * 100);
  if (state.tempManual === null) {
    const w = wxNow();
    if (w && w.tc !== null && w.tc !== undefined) tempSlider.value = Math.round(w.tc);
  }
  const t = performance.now();
  if (t - lastStat > 500) {
    lastStat = t;
    const w = wxNow();
    const p = precipTargets();
    wxEl.textContent = 'key:' + state.keySrc + ' owm:' + state.owmStatus + (w ? ' ' + (w.icon || '-') + ' ' + (w.mm || 0).toFixed(1) + 'mm' : '') + ' rain:' + p.intensity.toFixed(2) + ' fog:' + p.fog.toFixed(2);
  }
}

export function initControls() {
  slider = document.getElementById('rainier-time');
  slider.addEventListener('input', function () { state.minutes = +slider.value; state.offsetMin = 0; });

  coverSlider = document.getElementById('rainier-cover');
  windSlider = document.getElementById('rainier-wind');
  coverSlider.addEventListener('input', function () { state.coverManual = +coverSlider.value / 100; });
  windSlider.addEventListener('input', function () { state.windManual = +windSlider.value; });
  precipSlider = document.getElementById('rainier-precip-amt');
  tempSlider = document.getElementById('rainier-temp');
  fogSlider = document.getElementById('rainier-fog');
  fogSlider.addEventListener('input', function () { state.fogManual = +fogSlider.value / 100; });
  wxEl = document.getElementById('rainier-wx');
  precipSlider.addEventListener('input', function () { state.precipManual = +precipSlider.value / 100; });
  tempSlider.addEventListener('input', function () { state.tempManual = +tempSlider.value; });
  document.getElementById('rainier-zap').addEventListener('click', function () { strike(1); });
  document.querySelector('#rainier-ui button[data-c]').addEventListener('click', function () {
    state.coverManual = null;
    state.windManual = null;
    state.precipManual = null;
    state.tempManual = null;
    state.fogManual = null;
  });

  // one tap sets the whole precipitation spectrum: mist, rain, sleet, snow, hail, fog
  const PRESETS = {
    Clear: { p: 0, fog: 0 },
    Mist: { p: 0.12, t: 9, fog: 0.5, c: 0.7 },
    Rain: { p: 0.55, t: 10, fog: 0.15, c: 0.8 },
    Sleet: { p: 0.5, t: 1.8, fog: 0.15, c: 0.85 },
    Snow: { p: 0.55, t: -4, fog: 0.2, c: 0.85 },
    Hail: { p: 0.7, t: 8, fog: 0, c: 0.95 },
    Fog: { p: 0, fog: 0.95, c: 0.6 }
  };
  document.querySelectorAll('#rainier-ui button[data-p]').forEach(function (b) {
    b.addEventListener('click', function () {
      const q = PRESETS[b.dataset.p];
      if (!q) return;
      state.precipManual = q.p;
      state.fogManual = q.fog;
      if (q.t !== undefined) state.tempManual = q.t;
      if (q.c !== undefined) state.coverManual = q.c;
      if (b.dataset.p === 'Clear') { state.tempManual = null; state.coverManual = null; }
      precipSlider.value = Math.round(q.p * 100);
      fogSlider.value = Math.round(q.fog * 100);
    });
  });

  document.querySelectorAll('#rainier-ui button[data-m]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.minutes = b.dataset.m === 'Now' ? null : mark(b.dataset.m);
      state.offsetMin = 0;
    });
  });

  const pad = document.getElementById('rainier-river');
  let dragX = null;
  let panId = null;
  const active = new Set();
  const ui = document.getElementById('rainier-ui');
  document.getElementById('rainier-ver').textContent = 'v' + CFG.version;
  if (CFG.ui.startHidden) ui.style.display = 'none';
  let lp = null;
  let lpX = 0;
  let lpY = 0;
  function lpClear() {
    if (lp !== null) clearTimeout(lp);
    lp = null;
  }
  pad.addEventListener('pointerdown', function (e) {
    active.add(e.pointerId);
    lpClear();
    if (active.size === 1) {
      lpX = e.clientX;
      lpY = e.clientY;
      lp = setTimeout(function () {
        ui.style.display = ui.style.display === 'none' ? '' : 'none';
        lp = null;
      }, 700);
    }
    if (panId === null) { panId = e.pointerId; dragX = e.clientX; }
  });
  pad.addEventListener('pointermove', function (e) {
    if (lp !== null && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) lpClear();
    if (dragX === null || e.pointerId !== panId) return;
    if (active.size < 2 && !e.shiftKey) { dragX = e.clientX; return; }
    const lim = CFG.panLimit * RAD;
    state.panAz = Math.max(-lim, Math.min(lim, state.panAz - (e.clientX - dragX) * 2 / (SKY_Z * window.innerHeight)));
    dragX = e.clientX;
  });
  function panEnd(e) {
    lpClear();
    active.delete(e.pointerId);
    if (e.pointerId === panId) { panId = null; dragX = null; }
  }
  pad.addEventListener('pointerup', panEnd);
  pad.addEventListener('pointercancel', panEnd);

  loadKey().then(function (ok) { if (ok) loadOwm(); });
}
