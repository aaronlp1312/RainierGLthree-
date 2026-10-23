// rainier v2.1.0
import { CFG, state } from './config.js';
import { ss, mod } from './astro.js';

const ICON = {
  '01d': [0.00, 0.00, 0.00], '01n': [0.00, 0.00, 0.00],
  '02d': [0.80, 0.15, 0.00], '02n': [0.65, 0.12, 0.00],
  '03d': [0.60, 0.75, 0.00], '03n': [0.35, 0.70, 0.00],
  '04d': [0.35, 0.90, 0.00], '04n': [0.30, 0.85, 0.00],
  '09d': [0.25, 0.45, 0.78], '09n': [0.20, 0.40, 0.75],
  '10d': [0.30, 0.55, 0.85], '10n': [0.25, 0.50, 0.80],
  '11d': [0.15, 0.35, 0.95], '11n': [0.10, 0.30, 0.92],
  '13d': [0.18, 0.82, 0.75], '13n': [0.15, 0.78, 0.70],
  '50d': [0.55, 0.40, 0.12], '50n': [0.40, 0.30, 0.18]
};

let ver = -1;
let series = [];
let pastAsked = false;

export function simMs() {
  const n = Date.now();
  let base = n;
  if (state.minutes !== null) {
    const d = new Date(n);
    base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, state.minutes).getTime();
  }
  return base + state.offsetMin * 60000;
}

function rebuild() {
  const m = new Map();
  const add = function (e) { if (e && e.dt) m.set(e.dt, e); };
  Object.keys(state.owmPast).forEach(function (k) { add(state.owmPast[k]); });
  if (state.owm) {
    add(state.owm.currentEntry);
    (state.owm.hourly || []).forEach(add);
  }
  series = Array.from(m.values()).sort(function (a, b) { return a.dt - b.dt; });
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

function lerpAngle(a, b, f) {
  const d = mod(b - a + 540, 360) - 180;
  return mod(a + d * f + 360, 360);
}

function kelvin(e) {
  return typeof e.temp === 'number' ? e.temp : null;
}

function mmOf(e) {
  const r = e.rain && e.rain['1h'] ? e.rain['1h'] : 0;
  const s = e.snow && e.snow['1h'] ? e.snow['1h'] : 0;
  return r + s;
}

function iconOf(e) {
  return e.weather && e.weather[0] ? e.weather[0].icon : null;
}

export function weatherAt(ms) {
  if (state.wxVer !== ver) {
    ver = state.wxVer;
    rebuild();
  }
  if (series.length === 0) return null;
  const t = ms / 1000;
  let i = 0;
  while (i < series.length - 1 && series[i + 1].dt <= t) i++;
  const a = series[i];
  const b = series[Math.min(i + 1, series.length - 1)];
  const f = b.dt === a.dt ? 0 : Math.min(Math.max((t - a.dt) / (b.dt - a.dt), 0), 1);
  const ka = kelvin(a);
  const kb = kelvin(b);
  let tc = null;
  if (ka !== null && kb !== null) tc = lerp(ka, kb, f) - 273.15;
  else if (ka !== null) tc = ka - 273.15;
  else if (kb !== null) tc = kb - 273.15;
  return {
    tc: tc,
    mm: lerp(mmOf(a), mmOf(b), f),
    clouds: lerp(a.clouds, b.clouds, f),
    windSpd: lerp(a.wind_speed, b.wind_speed, f),
    windDeg: lerpAngle(a.wind_deg, b.wind_deg, f),
    icon: iconOf(f < 0.5 ? a : b)
  };
}

export function wxNow() {
  const w = weatherAt(simMs());
  if (w) return w;
  const o = state.owm;
  if (o && o.clouds !== null) {
    return { clouds: o.clouds, windSpd: o.windSpd, windDeg: o.windDeg, icon: o.icon || null };
  }
  return null;
}

export function cloudTargets() {
  const w = wxNow();
  const row = w && w.icon ? (ICON[w.icon] || ICON['01d']) : null;
  const frac = w && w.clouds !== null && w.clouds !== undefined ? w.clouds / 100 : null;
  let deck;
  let cirrus;
  let storm;
  if (state.coverManual !== null) {
    deck = state.coverManual;
    cirrus = 0.15 + 0.45 * deck;
    storm = Math.max(row ? row[2] * ss(0.5, 0.8, deck) : 0, state.precipManual !== null ? ss(0.7, 1.0, deck) : 0);
  } else {
    if (row && frac !== null) deck = 0.5 * row[1] + 0.5 * frac;
    else if (frac !== null) deck = frac;
    else if (row) deck = row[1];
    else deck = CFG.cloudDefault;
    cirrus = row ? row[0] : 0.25;
    storm = row ? row[2] : 0;
  }
  deck = Math.max(deck, storm * 0.95);
  return { cirrus: cirrus, deck: deck, storm: storm };
}

async function fetchPast(dt) {
  const key = 'rainier.past.' + CFG.lat + ',' + CFG.lon + '.' + dt;
  try {
    const c = localStorage.getItem(key);
    if (c) {
      state.owmPast[dt] = JSON.parse(c);
      state.wxVer++;
      return;
    }
  } catch (err) {}
  try {
    const url = 'https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=' + CFG.lat + '&lon=' + CFG.lon + '&dt=' + dt + '&appid=' + CFG.owmKey;
    const r = await (await fetch(url)).json();
    const e = r.data && r.data[0];
    if (!e) return;
    const slim = {
      dt: e.dt,
      clouds: e.clouds,
      wind_speed: e.wind_speed,
      wind_deg: e.wind_deg,
      temp: e.temp,
      rain: e.rain,
      snow: e.snow,
      weather: [{ icon: e.weather && e.weather[0] ? e.weather[0].icon : '01d' }]
    };
    state.owmPast[dt] = slim;
    state.wxVer++;
    try { localStorage.setItem(key, JSON.stringify(slim)); } catch (err) {}
  } catch (err) {}
}

export function ensurePast() {
  if (pastAsked || CFG.owmKey.charAt(0) === '%') return;
  pastAsked = true;
  const step = CFG.pastStepH * 3600;
  const top = Math.floor(Date.now() / 3600000) * 3600;
  for (let k = 1; k <= 24 / CFG.pastStepH; k++) fetchPast(top - k * step);
}

export function precipTargets() {
  const P = CFG.precip;
  const w = wxNow();
  const icon = w && w.icon ? w.icon : '';
  const g = icon.slice(0, 2);
  const tc = state.tempManual !== null ? state.tempManual : (w && w.tc !== null && w.tc !== undefined ? w.tc : null);
  const storm = cloudTargets().storm;
  const byIcon = { '09': 0.30, '10': 0.55, '11': 0.75, '13': 0.50, '50': 0.07 };
  let intensity = 0;
  if (state.precipManual !== null) {
    intensity = state.precipManual;
  } else if (w) {
    const mm = w.mm || 0;
    if (mm > 0) intensity = Math.min(Math.pow(mm / P.mmFull, 0.6), 1);
    if (byIcon[g] !== undefined) intensity = Math.max(intensity, byIcon[g] * (mm > 0 ? 0.6 : 1));
  }
  let phase = tc !== null ? 1 - ss(0.5, 3.5, tc) : 0;
  if (g === '13') phase = Math.max(phase, 0.8);
  else if (g === '09' || g === '10' || g === '11') phase = Math.min(phase, 0.5);
  let hail = 0;
  if (P.hail && intensity > 0) {
    const warm = tc !== null ? tc : 8;
    hail = Math.min(ss(0.55, 0.9, storm) * (1 - ss(P.hailWarmC, P.hailWarmC + 6, warm)) * (1 - 0.5 * phase), 0.6);
  }
  const manualStorm = state.precipManual !== null && storm > 0.7;
  const thunder = g === '11' || manualStorm ? Math.max(storm, 0.6) : 0;
  let fog = g === '50' ? 0.85 : 0;
  fog = Math.max(fog, Math.min(intensity * 0.3, 0.3));
  if (state.fogManual !== null) fog = state.fogManual;
  return { intensity: intensity, phase: phase, hail: hail, thunder: thunder, fog: fog };
}
