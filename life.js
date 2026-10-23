// rainier v2.1.0
// Living layer: gull flocks in the sky, wind-blown leaves and dust motes in front.
// Birds draw on #rainier-birds (behind the river and the near PNG group, over the
// clouds). Leaves and dust draw on #rainier-wind (in front of everything but the UI).
// Counts follow the same wind, precip, storm and daylight the rest of the scene uses.
import { CFG, RAD, SKY_Z, state } from './config.js';
import { astro, ss } from './astro.js';
import { simMs } from './weather.js';
import { clouds, effectiveWind } from './clouds.js';
import { precip } from './precip.js';

let bc = null;
let bg = null;
let wc = null;
let wg = null;
let W = 0;
let H = 0;
let last = 0;
let sunAlt = 30;
let sunStamp = -1;
let month = 0;
let flocks = [];
const leaves = [];
const dust = [];
let birdsClear = true;
let windClear = true;

const AUTUMN = ['#b4561b', '#d98a1f', '#8a3a14', '#c9a227', '#6e7b2a', '#9c4a1a'];
const GREEN = ['#4f7a2e', '#6a9a3a', '#8aab45', '#3c5e28', '#a3a23a', '#7b5a2a'];

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

function mk(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const far = Math.random();
    out.push({ ox: i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * rnd(16, 24), oy: i * rnd(5, 9), ph: rnd(0, 6.28), s: 1 - 0.07 * i, far: far });
  }
  return out;
}

function makeFlocks() {
  flocks = [];
  const n = Math.max(1, Math.round(CFG.life.maxBirds / 2.5));
  for (let i = 0; i < n; i++) {
    const depth = Math.random();
    const size = rnd(1, 3.4) | 0;
    flocks.push({
      x: rnd(0, 1) * (W + 400),
      y: H * rnd(0.09, 0.45),
      v: rnd(18, 44) * (1.15 - 0.6 * depth) * (Math.random() < 0.5 ? -1 : 1),
      sz: rnd(7, 13) * (1.1 - 0.65 * depth),
      depth: depth,
      fr: rnd(5, 8.5),
      bob: rnd(0, 6.28),
      glide: rnd(0, 6.28),
      a: 0,
      m: mk(size + 1)
    });
  }
  flocks.sort(function (a, b) { return b.depth - a.depth; });
}

export function initLife() {
  bc = document.getElementById('rainier-birds');
  wc = document.getElementById('rainier-wind');
  if (bc) bg = bc.getContext('2d');
  if (wc) wg = wc.getContext('2d');
  makeFlocks();
}

export function resizeLife() {
  W = window.innerWidth;
  H = window.innerHeight;
  [bc, wc].forEach(function (c) {
    if (!c) return;
    c.width = W;
    c.height = H;
  });
  makeFlocks();
}

function drawGull(g, x, y, s, ph, amp, col, a) {
  const f = Math.sin(ph) * amp;
  const lift = f * s * 0.75;
  g.globalAlpha = a;
  g.strokeStyle = col;
  g.lineWidth = Math.max(1, s * 0.2);
  g.beginPath();
  g.moveTo(x - s, y - lift * 0.9 + s * 0.12);
  g.quadraticCurveTo(x - s * 0.52, y - s * 0.5 - lift * 0.55, x, y);
  g.quadraticCurveTo(x + s * 0.52, y - s * 0.5 - lift * 0.55, x + s, y - lift * 0.9 + s * 0.12);
  g.stroke();
}

function tickBirds(dt, t, w, pan) {
  if (!bg) return;
  const on = CFG.life.birds;
  // gulls fly by day, in calm to moderate weather; the rain and gales ground them
  const day = ss(-3, 6, sunAlt);
  const act = on ? day * (1 - 0.9 * clouds.cur.storm) * (1 - 1.5 * precip.cur.intensity) * (1 - ss(11, 18, w.spd) * 0.8) * (1 - 0.7 * precip.cur.fog) : 0;
  const nShow = Math.round(Math.max(act, 0) * flocks.length);
  let any = false;
  const S = W + 400;
  bg.clearRect(0, 0, W, H);
  flocks.forEach(function (f, i) {
    const want = i < nShow ? 1 : 0;
    f.a += (want - f.a) * Math.min(dt * 0.8, 1);
    if (f.a < 0.02) {
      if (want === 0) return;
    }
    f.x += f.v * dt;
    f.bob += dt * 0.6;
    f.glide += dt * 0.25;
    any = true;
    const gl = 0.45 + 0.55 * Math.max(Math.sin(f.glide), -0.2) * 1.25;
    const amp = Math.min(Math.max(gl, 0.12), 1);
    const sx = (((f.x + pan) % S) + S) % S - 200;
    const sy = f.y + Math.sin(f.bob) * 6 * (1 - f.depth * 0.5);
    const alpha = f.a * (0.5 + 0.5 * (1 - f.depth));
    const col = f.depth > 0.6 ? '#3a4150' : '#1d222c';
    f.m.forEach(function (b) {
      b.ph += dt * f.fr * (0.9 + 0.2 * Math.sin(b.far * 9));
      const dir = f.v < 0 ? -1 : 1;
      drawGull(bg, sx - dir * b.ox, sy + b.oy * (1 - f.depth * 0.4), f.sz * b.s, b.ph, amp, col, alpha);
    });
  });
  bg.globalAlpha = 1;
  birdsClear = !any;
}

function newLeaf(dir, init) {
  const pal = month >= 8 && month <= 10 ? AUTUMN : GREEN;
  return {
    x: init ? rnd(-160, W + 160) : (dir > 0 ? -160 : W + 160) + rnd(-30, 30),
    y: H * rnd(0.22, 0.95),
    s: rnd(3.4, 8.2),
    rot: rnd(0, 6.28),
    spin: rnd(-1, 1) * 4,
    flip: rnd(0, 6.28),
    ff: rnd(2, 5),
    k: rnd(0.65, 1.35),
    ph: rnd(0, 6.28),
    col: pal[(Math.random() * pal.length) | 0]
  };
}

function drawLeaf(g, l) {
  const sy = 0.3 + 0.7 * Math.abs(Math.cos(l.flip));
  g.save();
  g.translate(l.px, l.py);
  g.rotate(l.rot);
  g.scale(1, sy);
  g.fillStyle = l.col;
  g.beginPath();
  g.moveTo(-l.s, 0);
  g.quadraticCurveTo(0, -l.s * 0.78, l.s, 0);
  g.quadraticCurveTo(0, l.s * 0.78, -l.s, 0);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-l.s, 0);
  g.lineTo(l.s * 0.9, 0);
  g.stroke();
  g.restore();
}

function newMote(init, dir) {
  return {
    x: init ? rnd(-160, W + 160) : (dir > 0 ? -160 : W + 160),
    y: H * rnd(0.12, 0.98),
    r: rnd(0.6, 1.7),
    a: rnd(0.14, 0.46),
    k: rnd(0.35, 1.2),
    ph: rnd(0, 6.28),
    f: rnd(0.4, 1.4)
  };
}

function tickWind(dt, t, w, pan) {
  if (!wg) return;
  const L = CFG.life;
  const rel = (w.deg + 180 - CFG.viewAz) * RAD;
  const sr = Math.sin(rel);
  const dir = sr < 0 ? -1 : 1;
  const mag = Math.max(Math.abs(sr), 0.38);
  const wet = Math.min(1.4 * precip.cur.intensity, 1);
  const lowSun = ss(-6, 4, sunAlt);
  const wantLeaves = L.leaves ? Math.min(Math.max((w.spd - 2.2) * 5.5, 0), L.maxLeaves) * (1 - 0.92 * wet) : 0;
  const wantDust = L.dust ? Math.min(14 + w.spd * 7, L.maxDust) * (1 - wet) * (1 - 0.6 * clouds.cur.storm) * (0.25 + 0.75 * lowSun) * (1 - 0.5 * precip.cur.fog) : 0;

  while (leaves.length < wantLeaves && Math.random() < 0.35) leaves.push(newLeaf(dir, leaves.length < 4 && w.spd > 3));
  while (dust.length < wantDust) dust.push(newMote(true, dir));
  if (dust.length > wantDust + 6) dust.length = Math.floor(wantDust) + 6;

  wg.clearRect(0, 0, W, H);
  const gust = 0.75 + 0.25 * Math.sin(t * 0.7) + 0.2 * Math.sin(t * 1.9 + 1.3);
  const base = w.spd * mag * 17 * gust;

  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    if (leaves.length > wantLeaves && Math.random() < dt * 0.7) { leaves.splice(i, 1); continue; }
    l.x += dir * base * l.k * dt;
    l.y += (Math.sin(t * 1.7 * l.ff * 0.4 + l.ph) * w.spd * 5 + 9 + w.spd * 0.9 - Math.sin(t * 0.5 + l.x * 0.006) * w.spd * 3) * dt;
    l.rot += l.spin * dt * (0.6 + w.spd * 0.12);
    l.flip += l.ff * dt;
    if (l.y > H * 1.02 || l.y < -20 || l.x < -200 || l.x > W + 200 || leaves.length > wantLeaves + 8) {
      if (leaves.length > wantLeaves) { leaves.splice(i, 1); continue; }
      leaves[i] = newLeaf(dir, false);
      continue;
    }
    l.px = l.x + pan * 1.35;
    l.py = l.y;
    if (l.px > -20 && l.px < W + 20) drawLeaf(wg, l);
  }

  wg.fillStyle = '#fff6e2';
  dust.forEach(function (d) {
    d.x += (dir * base * 0.42 * d.k + Math.sin(t * d.f + d.ph) * 6) * dt;
    d.y += (Math.cos(t * d.f * 0.8 + d.ph) * 5 - 1.5) * dt;
    if (d.x < -200 || d.x > W + 200 || d.y < -10 || d.y > H + 10) {
      d.x = (dir > 0 ? -160 : W + 160);
      d.y = H * rnd(0.12, 0.98);
    }
    const px = d.x + pan * 1.1;
    if (px < -4 || px > W + 4) return;
    wg.globalAlpha = d.a * (0.55 + 0.45 * Math.sin(t * d.f * 2 + d.ph));
    wg.beginPath();
    wg.arc(px, d.y, d.r, 0, 6.283);
    wg.fill();
  });
  wg.globalAlpha = 1;
  windClear = leaves.length === 0 && dust.length === 0;
}

export function tickLife() {
  const now = performance.now();
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
  last = now;
  const t = now / 1000;
  const ms = simMs();
  const stamp = Math.floor(ms / 120000);
  if (stamp !== sunStamp) {
    sunStamp = stamp;
    const d = new Date(ms);
    sunAlt = Math.asin(astro(d).sun.y) / RAD;
    month = d.getMonth();
  }
  const w = effectiveWind();
  const pan = (CFG.viewAz * RAD - state.az) * H * SKY_Z / 2;
  tickBirds(dt, t, w, pan);
  tickWind(dt, t, w, pan);
}
