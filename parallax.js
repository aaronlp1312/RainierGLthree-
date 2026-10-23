// rainier v2.1.0
import { CFG, RAD, SKY_Z, state } from './config.js';
import { clouds, effectiveWind } from './clouds.js';
import { lightning } from './lightning.js';
import { drawStage, hasStageArt } from './stage.js';

const layers = [];
let lastLight = -1;
const root = document.documentElement;

// Place and size every layer. Full-width layers get pan padding on both sides so
// their edges never show; narrower ones (trees) just pin to their align edge.
export function resizeParallax() {
  const H = window.innerHeight;
  const W = window.innerWidth;
  const pxRad = H * SKY_Z / 2;
  const lim = CFG.panLimit * RAD;
  layers.forEach(function (l) {
    if (l.gone) return;
    const vis = W * l.w / 100;
    let pad = l.w >= 100 ? lim * pxRad * l.k : 0;
    let x0;
    let Lw;
    if (l.fb) {
      // procedural art is drawn centred and shifted by ax (fraction of screen width)
      const shift = (l.ax || 0) * W;
      pad += Math.abs(shift);
      Lw = vis + 2 * pad;
      x0 = -pad + shift;
      l.el.style.height = H + 'px';
      const key = Math.round(Lw) + 'x' + H;
      if (key !== l.drawn) {
        l.drawn = key;
        drawStage(l.name, l.el, Lw, H, vis, pad, CFG.stageRes);
      }
    } else {
      Lw = vis + 2 * pad;
      if (l.align === 'right') x0 = W - Lw + pad;
      else if (l.align === 'center') x0 = (W - Lw) / 2;
      else x0 = -pad;
    }
    l.el.style.width = Lw + 'px';
    l.el.style.setProperty('--x0', x0.toFixed(1) + 'px');
  });
}

// Every PNG candidate failed: swap the <img> for a canvas with the procedural layer,
// or drop the layer when there is no procedural art for it.
function useFallback(layer) {
  if (!CFG.stageFallback || !hasStageArt(layer.name)) {
    layer.el.remove();
    layer.gone = true;
    return;
  }
  const cv = document.createElement('canvas');
  cv.className = layer.el.className;
  cv.style.bottom = layer.el.style.bottom;
  cv.style.setProperty('--k', layer.k);
  layer.el.replaceWith(cv);
  layer.el = cv;
  layer.fb = true;
  layer.drawn = '';
  resizeParallax();
}

export function initParallax() {
  const far = document.getElementById('plx-far');
  const near = document.getElementById('plx-near');
  CFG.plx.forEach(function (c) {
    const el = document.createElement('img');
    el.className = 'plx-layer';
    el.alt = '';
    el.draggable = false;
    el.style.bottom = (c.bottom || 0) + 'vh';
    el.style.setProperty('--k', c.k);
    const list = Array.isArray(c.src) ? c.src : [c.src];
    const layer = {
      el: el, k: c.k, w: c.w || 100, name: c.name, align: c.align || 'center', ax: c.ax || 0,
      sway: c.sway || 0, phase: Math.random() * 6.28, fb: false, drawn: '', gone: false, sw: 0
    };
    let i = 0;
    el.addEventListener('error', function () {
      i++;
      if (i < list.length) el.src = list[i];
      else useFallback(layer);
    });
    el.addEventListener('load', function () { resizeParallax(); });
    el.src = list[0];
    (c.group === 'far' ? far : near).appendChild(el);
    layers.push(layer);
  });
  resizeParallax();
}

export function tickParallax() {
  const H = window.innerHeight;
  root.style.setProperty('--plx-x', ((CFG.viewAz * RAD - state.az) * H * SKY_Z / 2).toFixed(1));
  const h = clouds.uniforms.uHor.value;
  const lum = h.x * 0.3 + h.y * 0.59 + h.z * 0.11;
  let L = Math.min(0.22 + 1.5 * lum, 1.05) * (1 - 0.35 * clouds.cur.storm) + lightning.flash * 0.9;
  L = Math.round(L * 200) / 200;
  if (L !== lastLight) {
    lastLight = L;
    root.style.setProperty('--plx-light', L);
  }

  // trees lean with the wind and flutter in the gusts, each on its own phase
  const w = effectiveWind();
  const t = performance.now() / 1000;
  const rel = (w.deg + 180 - CFG.viewAz) * RAD;
  const amt = Math.min(w.spd / 10, 2.2);
  layers.forEach(function (l) {
    if (!l.sway || l.gone) return;
    const a = l.sway * amt * (0.45 * Math.sin(rel) + 0.55 * Math.sin(t * 0.9 + l.phase) * Math.sin(t * 0.37 + l.phase * 2.1));
    if (Math.abs(a - l.sw) > 0.01) {
      l.sw = a;
      l.el.style.setProperty('--sway', a.toFixed(2) + 'deg');
    }
  });
}
