// rainier v2.1.0
import { CFG, RAD } from './config.js';
import { astro, mod } from './astro.js';

const GN = 24;
const GAMMA = 1 / 0.75;
const SUN_EDGE = -0.833;
let table = [];
const timesCache = {};

function hexToRgb(h) {
  let s = h.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return [
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255
  ];
}

export function parseGradient(str) {
  const re = /(#[0-9a-fA-F]{3,6})\s*([\d.]+)?/g;
  const stops = [];
  let m;
  while ((m = re.exec(str)) !== null) {
    stops.push({ c: hexToRgb(m[1]), p: m[2] === undefined ? null : parseFloat(m[2]) / 100 });
  }
  if (stops.length === 0) return stops;
  if (stops[0].p === null) stops[0].p = 0;
  if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 1;
  let i = 0;
  while (i < stops.length) {
    if (stops[i].p !== null) { i++; continue; }
    let j = i;
    while (stops[j].p === null) j++;
    const a = stops[i - 1].p;
    const b = stops[j].p;
    for (let k = i; k < j; k++) {
      stops[k].p = a + (b - a) * (k - i + 1) / (j - i + 1);
    }
    i = j;
  }
  return stops;
}

export function sampleStops(stops, v) {
  if (stops.length === 0) return [0, 0, 0.05];
  if (stops.length === 1 || v <= stops[0].p) return stops[0].c;
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i].p) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = b.p === a.p ? 1 : (v - a.p) / (b.p - a.p);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * t,
        a.c[1] + (b.c[1] - a.c[1]) * t,
        a.c[2] + (b.c[2] - a.c[2]) * t
      ];
    }
  }
  return stops[stops.length - 1].c;
}

export function loadSkyTable() {
  const cs = getComputedStyle(document.documentElement);
  table = [];
  for (let h = 0; h < 24; h++) {
    const name = '--sky-' + (h < 10 ? '0' + h : h);
    table.push(parseGradient(cs.getPropertyValue(name)));
  }
}

function sunTimes(day) {
  const key = day.getTime();
  if (timesCache[key]) return timesCache[key];
  let rise = null;
  let set = null;
  let prevT = 0;
  let prevAlt = null;
  for (let m = 0; m <= 1440; m += 2) {
    const t = key + m * 60000;
    const alt = Math.asin(astro(new Date(t)).sun.y) / RAD;
    if (prevAlt !== null) {
      const f = (SUN_EDGE - prevAlt) / (alt - prevAlt);
      if (rise === null && prevAlt < SUN_EDGE && alt >= SUN_EDGE) rise = prevT + f * (t - prevT);
      if (prevAlt >= SUN_EDGE && alt < SUN_EDGE) set = prevT + f * (t - prevT);
    }
    prevT = t;
    prevAlt = alt;
  }
  if (rise === null) rise = key + 6 * 3600000;
  if (set === null) set = key + 18 * 3600000;
  timesCache[key] = { rise: rise, set: set };
  return timesCache[key];
}

function dayStart(date, off) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + off);
}

export function virtualHour(date) {
  const t = date.getTime();
  const prev = sunTimes(dayStart(date, -1));
  const today = sunTimes(dayStart(date, 0));
  const next = sunTimes(dayStart(date, 1));
  if (t < today.rise) return 19 + (t - prev.set) / (today.rise - prev.set) * 12 - 24;
  if (t < today.set) return 7 + (t - today.rise) / (today.set - today.rise) * 12;
  return 19 + (t - today.set) / (next.rise - today.set) * 12;
}

export function skyGradient(hourV, cover, out) {
  const H = mod(hourV, 24);
  const i0 = Math.floor(H);
  const f = H - i0;
  const i1 = mod(i0 + 1, 24);
  const k = CFG.wxSky * cover * cover;
  for (let n = 0; n < GN; n++) {
    const v = n / (GN - 1);
    const a = sampleStops(table[i0], v);
    const b = sampleStops(table[i1], v);
    const r = a[0] + (b[0] - a[0]) * f;
    const g = a[1] + (b[1] - a[1]) * f;
    const bl = a[2] + (b[2] - a[2]) * f;
    const lum = (0.299 * r + 0.587 * g + 0.114 * bl) * 0.85;
    out[n].set(
      Math.pow(r + (lum - r) * k, GAMMA),
      Math.pow(g + (lum - g) * k, GAMMA),
      Math.pow(bl + (lum - bl) * k, GAMMA)
    );
  }
}
