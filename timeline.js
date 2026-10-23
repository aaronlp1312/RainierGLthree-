// rainier v2.1.0
import { CFG, RAD, state } from './config.js';
import { ensurePast, simMs } from './weather.js';

const MAXM = CFG.swipe.maxMin;
let vel = 0;
let dragging = false;
let homing = false;
let lastX = 0;
let lastT = 0;
let lastTouch = 0;
let lastTick = 0;
let lastTapT = 0;
let label = null;

function move(dm) {
  const before = state.offsetMin;
  state.offsetMin = Math.min(Math.max(before + dm, -MAXM), MAXM);
  state.scrub += state.offsetMin - before;
  if (state.offsetMin < -20) ensurePast();
}

function touched() {
  lastTouch = performance.now();
  homing = false;
}

function whenText() {
  const m = state.offsetMin;
  const h = Math.abs(m) / 60;
  const lead = (m < 0 ? '-' : '+') + (h < 10 ? h.toFixed(1) : Math.round(h)) + 'h';
  const t = new Date(simMs()).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return lead + '  ' + t;
}

export function initTimeline() {
  const pad = document.getElementById('rainier-river');
  label = document.getElementById('rainier-when');
  const ids = new Set();
  let id = null;
  let downX = 0;
  let moved = 0;

  pad.addEventListener('pointerdown', function (e) {
    ids.add(e.pointerId);
    if (ids.size === 1) {
      id = e.pointerId;
      lastX = e.clientX;
      downX = e.clientX;
      moved = 0;
      lastT = e.timeStamp;
      vel = 0;
      dragging = true;
    } else {
      dragging = false;
      vel = 0;
    }
    touched();
  });

  pad.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== id || e.shiftKey) return;
    const dx = e.clientX - lastX;
    const dt = Math.max(e.timeStamp - lastT, 1);
    const dm = -dx / window.innerWidth * CFG.swipe.minPerScreen;
    move(dm);
    vel = 0.8 * vel + 0.2 * (dm / dt);
    moved += Math.abs(dx);
    lastX = e.clientX;
    lastT = e.timeStamp;
    touched();
  });

  function end(e) {
    ids.delete(e.pointerId);
    if (e.pointerId !== id) return;
    dragging = false;
    id = null;
    if (moved < 10 && Math.abs(e.clientX - downX) < 10) {
      const now = performance.now();
      if (now - lastTapT < 320) {
        homing = true;
        vel = 0;
      }
      lastTapT = now;
    }
  }
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', function (e) {
    ids.delete(e.pointerId);
    if (e.pointerId === id) {
      dragging = false;
      id = null;
    }
  });
}

export function tickTimeline() {
  const now = performance.now();
  const dt = lastTick ? Math.min(now - lastTick, 100) : 16;
  lastTick = now;

  if (!dragging && Math.abs(vel) > 0.00002) {
    move(vel * dt);
    vel *= Math.exp(-CFG.swipe.friction * dt / 1000);
  }

  const idle = (now - lastTouch) / 1000;
  const away = state.offsetMin !== 0;
  if (!dragging && away && (homing || idle > CFG.swipe.returnSec)) {
    const k = 1 - Math.exp(-dt * (homing ? 0.004 : 0.0015));
    const step = -state.offsetMin * k;
    move(Math.abs(state.offsetMin) < 0.5 ? -state.offsetMin : step);
  }

  // swiping through the day also sweeps the scene sideways, so the anchored layers
  // (Rainier and the bridge to the right, horizon and shore to the left) travel with it
  const lim = CFG.panLimit * RAD;
  const h0 = CFG.viewAz * RAD;
  state.scrollAz = (state.offsetMin / MAXM) * CFG.scrollPan * RAD;
  state.az = Math.max(h0 - lim, Math.min(h0 + lim, h0 + state.panAz + state.scrollAz));

  if (label) {
    if (away) {
      label.textContent = whenText();
      label.style.opacity = (dragging || homing || idle < 2.5 || Math.abs(vel) > 0.00002) ? '0.95' : '0.5';
    } else {
      label.style.opacity = '0';
    }
  }
}
