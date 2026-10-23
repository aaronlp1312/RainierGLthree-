// rainier v2.1.0
import { CFG } from './config.js';
import { precipTargets } from './weather.js';

export const lightning = { flash: 0, bolt: 0, x: 0.5, y: 0.3, seed: 0 };

let stage = null;
let pulses = [];
let shakes = [];
let next = 0;
let shaking = false;

export function initLightning() {
  stage = document.getElementById('rainier-stage');
}

export function strike(level) {
  const now = performance.now() / 1000;
  const lv = level === undefined ? 1 : level;
  lightning.x = 0.12 + Math.random() * 0.76;
  lightning.y = 0.2 + Math.random() * 0.2;
  lightning.seed = Math.random() * 100;
  pulses = [
    { t: now, a: 1, b: true },
    { t: now + 0.08, a: 0.5 + Math.random() * 0.4, b: true }
  ];
  if (Math.random() < 0.5) pulses.push({ t: now + 0.2, a: 0.25 + Math.random() * 0.3, b: false });
  const delay = 0.25 + Math.random() * 1.75;
  shakes.push({ t: now + delay, a: CFG.shake.max * (1 - delay / 2.4) * (0.5 + 0.5 * lv) });
}

export function tickLightning() {
  const now = performance.now() / 1000;
  const th = precipTargets().thunder;
  if (th > 0) {
    if (next === 0) next = now + 1.5 + Math.random() * 3;
    if (now >= next) {
      strike(th);
      next = now + (18 - 14 * th) * (0.5 + Math.random());
    }
  } else {
    next = 0;
  }

  let f = 0;
  let b = 0;
  pulses = pulses.filter(function (p) { return now - p.t < 0.6; });
  pulses.forEach(function (p) {
    const d = now - p.t;
    if (d < 0) return;
    const v = p.a * Math.exp(-d * 14);
    if (v > f) f = v;
    if (p.b && v > b) b = v;
  });
  lightning.flash = f;
  lightning.bolt = Math.min(b * 1.4, 1);

  let sx = 0;
  let sy = 0;
  shakes = shakes.filter(function (s) { return now - s.t < 1.8; });
  shakes.forEach(function (s) {
    const d = now - s.t;
    if (d < 0) return;
    const e = s.a * Math.exp(-d * 4);
    sx += e * Math.sin(d * 140);
    sy += e * 0.6 * Math.sin(d * 110 + 1.3);
  });
  if (!stage) return;
  if (Math.abs(sx) + Math.abs(sy) > 0.02) {
    stage.style.transform = 'translate3d(' + sx.toFixed(2) + 'px,' + sy.toFixed(2) + 'px,0)';
    shaking = true;
  } else if (shaking) {
    stage.style.transform = '';
    shaking = false;
  }
}
