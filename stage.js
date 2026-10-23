// rainier v2.1.0
// Procedural stand-ins for the parallax PNG stack. parallax.js calls drawStage()
// when a layer's PNG is missing, so the Narrows stage is always on screen.
// A PNG that loads always wins over these.
//
// Every layer is drawn on a canvas the size of the viewport (plus the pan
// padding on each side), with the horizon at 50% height, the same place the
// river and sky shaders put it. Colours are mid-day; parallax.js dims the whole
// group with --plx-light, so they fall to near-black silhouettes at night.

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth 1D noise, 0..1
function wave(x, seed) {
  return 0.5 + 0.5 * (
    0.55 * Math.sin(x * 0.011 + seed) +
    0.30 * Math.sin(x * 0.027 + seed * 2.3) +
    0.15 * Math.sin(x * 0.061 + seed * 4.1)
  );
}

function conifer(c, x, yb, h, w) {
  const n = 4;
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const y = yb - h + (h * i) / n;
    const hw = (w / 2) * (i / n);
    pts.push([hw * 0.45, y - (h / n) * 0.55], [hw, y]);
    if (i < n) pts.push([hw * 0.5, y]);
  }
  c.moveTo(x, yb - h);
  pts.forEach(function (p) { c.lineTo(x + p[0], p[1]); });
  for (let i = pts.length - 1; i >= 0; i--) c.lineTo(x - pts[i][0], pts[i][1]);
  c.closePath();
}

function branch(c, rnd, x, y, ang, len, w) {
  const seg = 10;
  for (let i = 0; i < seg; i++) {
    const nx = x + Math.cos(ang) * len / seg;
    const ny = y + Math.sin(ang) * len / seg;
    c.lineWidth = Math.max(w * (1 - i / seg), 1);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(nx, ny);
    c.stroke();
    x = nx;
    y = ny;
    ang += (rnd() - 0.5) * 0.5;
    if (i === 4 && len > 40) branch(c, rnd, x, y, ang + (rnd() < 0.5 ? -0.7 : 0.7), len * 0.5, w * 0.5);
  }
}

// ---- far group -------------------------------------------------------------

function drawPeak(g, rnd) {
  const c = g.c;
  const H = g.H;
  const hy = g.hy;
  const cx = g.sx(0.5);
  const bw = g.W * 0.36;
  const sh = H * 0.17;
  const top = [];
  for (let x = cx - bw; x <= cx + bw; x += 3) {
    const t = Math.abs(x - cx) / bw;
    let h = Math.min(sh * Math.pow(1 - t, 1.3), sh * 0.93);
    h += sh * 0.16 * Math.exp(-Math.pow((x - (cx + bw * 0.52)) / (bw * 0.045), 2)) * (1 - t);
    h += (wave(x, 3) - 0.5) * sh * 0.07 * (t > 0.05 ? 1 : 0.3);
    top.push([x, hy - h]);
  }
  const yBase = hy + H * 0.02;

  c.save();
  c.beginPath();
  c.moveTo(top[0][0], yBase);
  top.forEach(function (p) { c.lineTo(p[0], p[1]); });
  c.lineTo(top[top.length - 1][0], yBase);
  c.closePath();
  const rock = c.createLinearGradient(0, hy - sh, 0, hy);
  rock.addColorStop(0, '#6a7590');
  rock.addColorStop(1, '#3f4b66');
  c.fillStyle = rock;
  c.fill();
  c.clip();

  // snow cap with glacier fingers
  const snowLine = hy - sh * 0.66;
  c.beginPath();
  c.moveTo(cx - bw, hy - sh - 20);
  for (let x = cx - bw; x <= cx + bw; x += 4) {
    const t = Math.abs(x - cx) / bw;
    const finger = wave(x * 1.7, 7) * sh * 0.16 + wave(x * 4.3, 2) * sh * 0.14 * (1 - t * 0.6);
    c.lineTo(x, snowLine + finger);
  }
  c.lineTo(cx + bw, hy - sh - 20);
  c.closePath();
  const snow = c.createLinearGradient(0, hy - sh, 0, snowLine + sh * 0.2);
  snow.addColorStop(0, '#f4f8ff');
  snow.addColorStop(1, '#c9d6ec');
  c.fillStyle = snow;
  c.fill();

  // shaded flank
  const shade = c.createLinearGradient(cx - bw * 0.2, 0, cx + bw, 0);
  shade.addColorStop(0, 'rgba(28,38,70,0)');
  shade.addColorStop(1, 'rgba(28,38,70,0.45)');
  c.fillStyle = shade;
  c.fillRect(cx - bw, hy - sh - 20, bw * 2, sh + H * 0.05);

  // ridges
  c.strokeStyle = 'rgba(30,40,70,0.16)';
  c.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const x0 = cx + (rnd() - 0.5) * bw * 0.25;
    const x1 = x0 + (rnd() - 0.5) * bw * 0.9;
    c.beginPath();
    c.moveTo(x0, hy - sh * 0.9);
    c.quadraticCurveTo((x0 + x1) / 2 + (rnd() - 0.5) * 30, hy - sh * 0.4, x1, hy);
    c.stroke();
  }

  // aerial haze toward the base
  const haze = c.createLinearGradient(0, hy - sh * 0.5, 0, hy + H * 0.01);
  haze.addColorStop(0, 'rgba(196,208,228,0)');
  haze.addColorStop(1, 'rgba(196,208,228,0.38)');
  c.fillStyle = haze;
  c.fillRect(cx - bw, hy - sh, bw * 2, sh + H * 0.03);
  c.restore();
}

function ridge(g, amp, seed, color) {
  const c = g.c;
  c.beginPath();
  c.moveTo(0, g.hy + g.H * 0.02);
  for (let x = 0; x <= g.Lw + 4; x += 4) {
    c.lineTo(x, g.hy - amp * (0.55 * wave(x, seed) + 0.45 * wave(x * 2.3, seed + 5)));
  }
  c.lineTo(g.Lw, g.hy + g.H * 0.02);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function drawHorizon(g) {
  const c = g.c;
  const H = g.H;
  const hy = g.hy;
  ridge(g, H * 0.050, 11, 'rgba(98,114,140,0.80)');
  ridge(g, H * 0.030, 23, 'rgba(66,84,104,0.92)');
  ridge(g, H * 0.016, 37, 'rgba(40,58,66,0.96)');
  // fade the lower edge so it melts into the water
  c.globalCompositeOperation = 'destination-out';
  const f = c.createLinearGradient(0, hy + H * 0.004, 0, hy + H * 0.02);
  f.addColorStop(0, 'rgba(0,0,0,0)');
  f.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = f;
  c.fillRect(0, hy, g.Lw, H * 0.03);
  c.globalCompositeOperation = 'source-over';
}

// ---- near group ------------------------------------------------------------

function bank(g, rnd, xEdge, xEnd, topH, botDepth, seed, tone) {
  const c = g.c;
  const H = g.H;
  const hy = g.hy;
  const dir = xEnd > xEdge ? 1 : -1;
  const len = Math.abs(xEnd - xEdge);
  const u = function (x) { return Math.min(Math.abs(x - xEdge) / len, 1); };
  const ground = function (x) {
    return hy - topH * Math.pow(1 - u(x), 1.4) * (0.82 + 0.18 * wave(x, seed));
  };
  const floor = function (x) {
    return hy + (H * 0.012 + botDepth * Math.pow(1 - u(x), 1.7)) * (1 - Math.pow(u(x), 4));
  };
  const N = 60;
  c.beginPath();
  c.moveTo(xEdge, floor(xEdge));
  for (let i = 0; i <= N; i++) {
    const x = xEdge + dir * len * i / N;
    c.lineTo(x, ground(x));
  }
  for (let i = N; i >= 0; i--) {
    const x = xEdge + dir * len * i / N;
    c.lineTo(x, floor(x));
  }
  c.closePath();
  const body = c.createLinearGradient(0, hy - topH, 0, hy + botDepth);
  body.addColorStop(0, tone.top);
  body.addColorStop(1, tone.bot);
  c.fillStyle = body;
  c.fill();

  c.fillStyle = tone.tree;
  c.beginPath();
  for (let d = 0; d < len * 0.94; d += 5 + rnd() * 7) {
    const x = xEdge + dir * d;
    const h = H * (0.020 + 0.040 * rnd()) * (1 - 0.55 * u(x));
    conifer(c, x, ground(x) + h * 0.35, h, h * 0.42);
  }
  c.fill();
}

function drawShore(g, rnd) {
  const H = g.H;
  bank(g, rnd, g.Lw + 10, g.sx(0.80), H * 0.07, H * 0.05, 4,
    { top: '#2a3d3a', bot: '#16241f', tree: '#1d2e2a' });
  bank(g, rnd, -10, g.sx(0.30), H * 0.13, H * 0.12, 8,
    { top: '#17281d', bot: '#0a120d', tree: '#101c14' });
}

function drawBridge(g) {
  const c = g.c;
  const H = g.H;
  const hy = g.hy;
  const yd = hy - H * 0.055;
  const yt = hy - H * 0.27;
  const yw = hy + H * 0.006;
  const xl = g.sx(0.24);
  const xr = g.sx(0.76);
  const mid = (xl + xr) / 2;
  const half = (xr - xl) / 2;
  const sag = yd - H * 0.028;
  const ya = yd - H * 0.006;
  const deckH = H * 0.009;

  const cable = function (x) {
    if (x < xl) return yt + (ya - yt) * Math.pow((xl - x) / xl, 1.7);
    if (x > xr) return yt + (ya - yt) * Math.pow((x - xr) / (g.Lw - xr), 1.7);
    const u = (x - mid) / half;
    return yt + (sag - yt) * (1 - u * u);
  };

  // suspenders
  c.strokeStyle = 'rgba(42,32,24,0.85)';
  c.lineWidth = 0.9;
  c.beginPath();
  for (let x = 6; x < g.Lw; x += 12) {
    if (Math.abs(x - xl) < 10 || Math.abs(x - xr) < 10) continue;
    c.moveTo(x, cable(x));
    c.lineTo(x, yd);
  }
  c.stroke();

  // deck: planked top, truss below
  c.fillStyle = '#2a2018';
  c.fillRect(0, yd, g.Lw, deckH);
  c.fillStyle = '#5a4430';
  c.fillRect(0, yd, g.Lw, 1.8);
  c.strokeStyle = 'rgba(42,32,24,0.9)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(0, yd + deckH);
  for (let x = 0, k = 0; x < g.Lw + 14; x += 14, k++) c.lineTo(x, yd + deckH + (k % 2 ? 0 : H * 0.007));
  c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(0, yd + deckH, g.Lw, 1.5);

  // main cables
  c.strokeStyle = '#33271d';
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(0, cable(0));
  for (let x = 4; x <= g.Lw; x += 4) c.lineTo(x, cable(x));
  c.stroke();

  // towers
  const gap = Math.max(g.W * 0.007, 7);
  [xl, xr].forEach(function (x) {
    c.fillStyle = '#2a2018';
    [-gap, gap].forEach(function (o) {
      c.beginPath();
      c.moveTo(x + o - 3, yt);
      c.lineTo(x + o + 3, yt);
      c.lineTo(x + o + 4.5, yw);
      c.lineTo(x + o - 4.5, yw);
      c.closePath();
      c.fill();
      c.fillStyle = '#4a3828';
      c.fillRect(x + o - 3, yt, 1.4, yw - yt);
      c.fillStyle = '#2a2018';
    });
    const ys = [yt + H * 0.03, yt + H * 0.08, yt + H * 0.14, yd - H * 0.005];
    c.strokeStyle = '#2a2018';
    c.lineWidth = 2;
    c.beginPath();
    ys.forEach(function (y, i) {
      c.moveTo(x - gap, y);
      c.lineTo(x + gap, y);
      if (i < ys.length - 1) {
        c.moveTo(x - gap, y);
        c.lineTo(x + gap, ys[i + 1]);
        c.moveTo(x + gap, y);
        c.lineTo(x - gap, ys[i + 1]);
      }
    });
    c.stroke();
    c.fillStyle = '#1e1710';
    c.fillRect(x - gap - 5, yt - 4, gap * 2 + 10, 6);
  });
}

function drawDriftwood(g, rnd) {
  const c = g.c;
  const H = g.H;

  function log(x0, x1, y, th, tilt, seed) {
    const L = x1 - x0;
    c.save();
    c.translate(x0, y);
    c.rotate(tilt);
    const top = [];
    const bot = [];
    for (let i = 0; i <= 40; i++) {
      const x = (L * i) / 40;
      const t = th * (0.8 + 0.25 * wave(x * 1.3, seed)) * (0.88 + 0.12 * Math.sin(i * 0.4));
      top.push([x, -t / 2]);
      bot.push([x, t / 2 + 2 * wave(x, seed + 3)]);
    }
    c.beginPath();
    top.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
    for (let i = bot.length - 1; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]);
    c.closePath();
    const body = c.createLinearGradient(0, -th / 2, 0, th / 2);
    body.addColorStop(0, '#5f5344');
    body.addColorStop(0.45, '#3d342a');
    body.addColorStop(1, '#1c1712');
    c.fillStyle = body;
    c.fill();
    c.save();
    c.clip();
    c.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const x = rnd() * L;
      const y = (rnd() - 0.5) * th * 0.9;
      c.strokeStyle = rnd() > 0.5 ? 'rgba(200,190,170,0.16)' : 'rgba(0,0,0,0.28)';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 10 + rnd() * 40, y + (rnd() - 0.5) * 3);
      c.stroke();
    }
    c.restore();
    // cut end with rings
    c.fillStyle = '#74664f';
    c.beginPath();
    c.ellipse(0, 0, th * 0.14, th * 0.46, 0, 0, 6.283);
    c.fill();
    c.strokeStyle = 'rgba(40,30,20,0.5)';
    c.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      c.beginPath();
      c.ellipse(0, 0, th * 0.14 * r / 3.4, th * 0.46 * r / 3.4, 0, 0, 6.283);
      c.stroke();
    }
    c.restore();
  }

  const th = H * 0.05;
  const bx0 = g.sx(0.34);
  const beach = function (x) {
    const t = Math.max(0, Math.min((x - bx0) / (g.Lw - bx0), 1));
    return H * (0.965 - 0.20 * Math.pow(t, 0.8)) + (wave(x, 13) - 0.5) * H * 0.012;
  };

  // gravel beach the logs lie on
  c.beginPath();
  c.moveTo(bx0 - 40, H + 4);
  for (let x = bx0 - 40; x <= g.Lw + 4; x += 6) c.lineTo(x, x < bx0 ? Math.min(H + 4, H * 0.965 + (bx0 - x) * 2.5) : beach(x));
  c.lineTo(g.Lw + 4, H + 4);
  c.closePath();
  const sand = c.createLinearGradient(0, H * 0.74, 0, H);
  sand.addColorStop(0, '#4a4338');
  sand.addColorStop(1, '#17140f');
  c.fillStyle = sand;
  c.fill();
  c.strokeStyle = 'rgba(190,180,160,0.16)';
  c.lineWidth = 1.5;
  c.beginPath();
  for (let x = bx0; x <= g.Lw + 4; x += 6) { if (x === bx0) c.moveTo(x, beach(x)); else c.lineTo(x, beach(x)); }
  c.stroke();
  for (let i = 0; i < 60; i++) {
    const x = bx0 + rnd() * (g.Lw - bx0);
    const y = beach(x) + 4 + rnd() * (H - beach(x));
    const v = rnd();
    c.fillStyle = 'rgba(' + (30 + v * 36 | 0) + ',' + (28 + v * 32 | 0) + ',' + (24 + v * 26 | 0) + ',0.9)';
    c.beginPath();
    c.ellipse(x, y, 2 + rnd() * 6, 1.5 + rnd() * 3.5, 0, 0, 6.283);
    c.fill();
  }

  const xs0 = g.sx(0.47);
  const xs1 = g.sx(0.60);
  const x0 = g.sx(0.62);
  const x1 = g.sx(0.97);
  const yMain = beach((x0 + x1) / 2) - th * 0.15;
  const yShort = beach((xs0 + xs1) / 2) - th * 0.1;

  // contact shadows
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse((x0 + x1) / 2, yMain + th * 0.5, (x1 - x0) / 2, th * 0.22, 0, 0, 6.283);
  c.fill();
  c.beginPath();
  c.ellipse((xs0 + xs1) / 2, yShort + th * 0.3, (xs1 - xs0) / 2, th * 0.14, 0, 0, 6.283);
  c.fill();

  log(xs0, xs1, yShort, th * 0.55, 0.04, 21);
  log(x0, x1, yMain, th, -0.045, 5);

  // root ball at the right end
  c.save();
  c.translate(x1, yMain - 0.045 * (x1 - x0));
  c.strokeStyle = '#33291f';
  c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    branch(c, rnd, 0, 0, -1.9 + i * 0.62 + (rnd() - 0.5) * 0.3, H * (0.05 + rnd() * 0.06), th * 0.42);
  }
  c.restore();
  c.lineCap = 'butt';
}

function drawCliff(g, rnd) {
  const c = g.c;
  const H = g.H;
  const xr = g.pad + g.W * 0.17;
  const edge = function (x) {
    const t = Math.min(x / xr, 1);
    return H * (0.46 + 0.42 * Math.pow(t, 1.35)) + (wave(x, 5) - 0.5) * H * 0.05 * (1 - t * 0.5);
  };

  const pts = [];
  for (let x = -10; x < xr; x += 30 + rnd() * 60) pts.push([x, edge(x) + (rnd() - 0.5) * H * 0.04]);
  pts.push([xr, edge(xr) + H * 0.01]);

  c.save();
  c.beginPath();
  c.moveTo(-10, H + 4);
  pts.forEach(function (p) { c.lineTo(p[0], p[1]); });
  c.lineTo(xr + 6, H * 0.97);
  c.lineTo(xr, H + 4);
  c.closePath();
  const body = c.createLinearGradient(0, 0, xr, 0);
  body.addColorStop(0, '#14171a');
  body.addColorStop(1, '#2a2f33');
  c.fillStyle = body;
  c.fill();
  c.clip();

  // faceted faces
  for (let i = 0; i < pts.length - 1; i++) {
    c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,' + (0.03 + rnd() * 0.05).toFixed(3) + ')' : 'rgba(0,0,0,' + (0.10 + rnd() * 0.14).toFixed(3) + ')';
    c.beginPath();
    c.moveTo(pts[i][0], pts[i][1]);
    c.lineTo(pts[i + 1][0], pts[i + 1][1]);
    c.lineTo(pts[i + 1][0], H + 4);
    c.lineTo(pts[i][0], H + 4);
    c.closePath();
    c.fill();
  }

  // strata
  for (let k = 0; k < 16; k++) {
    const y = H * 0.48 + k * H * 0.034;
    c.strokeStyle = 'rgba(120,130,135,' + (0.10 + rnd() * 0.09).toFixed(2) + ')';
    c.lineWidth = 1 + rnd();
    c.beginPath();
    c.moveTo(-10, y);
    for (let x = 0; x <= xr + 20; x += 18) c.lineTo(x, y + x * 0.04 + (rnd() - 0.5) * 5);
    c.stroke();
  }
  // cracks
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    let x = rnd() * xr;
    let y = H * 0.5 + rnd() * H * 0.3;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rnd() - 0.5) * 12;
      y += 10 + rnd() * 16;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();

  // lit top edge, moss and a few firs growing out of the rock
  c.strokeStyle = 'rgba(150,160,150,0.28)';
  c.lineWidth = 1.5;
  c.beginPath();
  pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
  c.stroke();
  c.fillStyle = '#22331f';
  pts.forEach(function (p) {
    if (rnd() < 0.6) {
      c.beginPath();
      c.ellipse(p[0], p[1], 3 + rnd() * 7, 2 + rnd() * 3, 0, 0, 6.283);
      c.fill();
    }
  });
  c.fillStyle = '#0d150f';
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = xr * (0.12 + i * 0.2) + rnd() * 20;
    const h = H * (0.07 + rnd() * 0.06);
    conifer(c, x, edge(x) + 4, h, h * 0.4);
  }
  c.fill();
}

const ART = {
  'rainier-peak': drawPeak,
  'horizon-strip': drawHorizon,
  'forested-shore': drawShore,
  'wood-suspension-bridge': drawBridge,
  'driftwood': drawDriftwood,
  'cliff-face': drawCliff
};

export function stageName(src) {
  return String(src).split('/').pop().replace(/\.[a-z0-9]+$/i, '');
}

export function hasStageArt(name) {
  return Object.prototype.hasOwnProperty.call(ART, name);
}

// Draw one layer. Lw is the full canvas width in CSS px, W the visible part of it
// (Lw minus the pan padding on both sides), H the viewport height.
export function drawStage(name, cv, Lw, H, W, pad, res) {
  const fn = ART[name];
  if (!fn) return false;
  cv.width = Math.max(1, Math.round(Lw * res));
  cv.height = Math.max(1, Math.round(H * res));
  const c = cv.getContext('2d');
  c.setTransform(res, 0, 0, res, 0, 0);
  c.clearRect(0, 0, Lw, H);
  let seed = 17;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  fn({
    c: c,
    Lw: Lw,
    H: H,
    W: W,
    pad: pad,
    hy: H * 0.5,
    sx: function (f) { return pad + f * W; }
  }, rng(seed));
  return true;
}
