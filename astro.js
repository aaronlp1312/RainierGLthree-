// rainier v2.1.0
import * as THREE from 'three';
import { CFG, RAD, DAY } from './config.js';

export function mod(a, n) {
  return a - n * Math.floor(a / n);
}

export function ss(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

export function astro(date) {
  const d = date.getTime() / DAY + 2440587.5 - 2451545;
  const phi = CFG.lat * RAD;
  const lst = RAD * (280.16 + 360.9856235 * d) + CFG.lon * RAD;
  const e = RAD * 23.4397;

  function toLocal(ra, dec) {
    const H = lst - ra;
    const cd = Math.cos(dec);
    const sd = Math.sin(dec);
    return new THREE.Vector3(
      -cd * Math.sin(H),
      sd * Math.sin(phi) + cd * Math.cos(H) * Math.cos(phi),
      cd * Math.cos(H) * Math.sin(phi) - sd * Math.cos(phi)
    );
  }

  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const sun = toLocal(
    Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)),
    Math.asin(Math.sin(L) * Math.sin(e))
  );

  const Lm = RAD * (218.316 + 13.176396 * d);
  const Mm = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.229350 * d);
  const l = Lm + RAD * 6.289 * Math.sin(Mm);
  const b = RAD * 5.128 * Math.sin(F);
  const moon = toLocal(
    Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)),
    Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
  );

  return { sun: sun, moon: moon, toLocal: toLocal };
}

const STOPS = [
  [-18, [0.005, 0.008, 0.03], [0.02, 0.03, 0.06]],
  [-12, [0.02, 0.03, 0.11], [0.12, 0.10, 0.22]],
  [-6,  [0.06, 0.10, 0.30], [0.75, 0.40, 0.35]],
  [0,   [0.12, 0.25, 0.55], [1.0, 0.60, 0.30]],
  [6,   [0.10, 0.25, 0.70], [0.95, 0.78, 0.60]],
  [35,  [0.0, 0.0, 0.6],    [1.0, 1.0, 1.0]]
];

const palTmp = new THREE.Vector3();

export function palette(alt, zen, hor) {
  let i = 0;
  while (i < STOPS.length - 2 && alt > STOPS[i + 1][0]) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = Math.min(Math.max((alt - a[0]) / (b[0] - a[0]), 0), 1);
  zen.fromArray(a[1]).lerp(palTmp.fromArray(b[1]), t);
  hor.fromArray(a[2]).lerp(palTmp.fromArray(b[2]), t);
}
