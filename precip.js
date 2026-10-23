// rainier v2.1.0
import * as THREE from 'three';
import { CFG, RAD, SKY_Z, state } from './config.js';
import { VERTEX, PRECIP_FRAG } from './shaders.js';
import { precipTargets } from './weather.js';
import { clouds, effectiveWind } from './clouds.js';
import { lightning } from './lightning.js';

export const precip = {
  uniforms: {
    uRes: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uPan: { value: 0 },
    uInt: { value: 0 },
    uPhase: { value: 0 },
    uHail: { value: 0 },
    uSlant: { value: 0 },
    uTint: { value: new THREE.Vector3(0.5, 0.55, 0.6) },
    uFlash: { value: 0 },
    uBolt: { value: 0 },
    uBoltX: { value: 0.5 },
    uBoltY: { value: 0.3 },
    uBoltSeed: { value: 0 },
    uFog: { value: 0 },
    uFogX: { value: 0 }
  },
  cur: { intensity: 0, phase: 0, hail: 0, fog: 0 },
  renderer: null,
  camera: null
};

export function initPrecip() {
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('rainier-precip'),
    alpha: true,
    premultipliedAlpha: true
  });
  renderer.setPixelRatio(CFG.ratio.precip);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: precip.uniforms,
      vertexShader: VERTEX,
      fragmentShader: PRECIP_FRAG
    })
  );
  quad.frustumCulled = false;
  scene.add(quad);

  precip.renderer = renderer;
  precip.camera = camera;

  const u = precip.uniforms;
  const c = precip.cur;
  let last = 0;
  let time = 0;
  let fogX = 0;
  let idle = false;

  renderer.setAnimationLoop(function (ts) {
    const dt = Math.min((ts - last) / 1000, 0.1);
    last = ts;

    const tg = precipTargets();
    const k = 1 - Math.exp(-dt * CFG.precip.fade);
    c.intensity += (tg.intensity - c.intensity) * k;
    c.phase += (tg.phase - c.phase) * k;
    c.hail += (tg.hail - c.hail) * k;
    c.fog += (tg.fog - c.fog) * k;
    if (tg.fog === 0 && c.fog < 0.004) c.fog = 0;
    if (tg.intensity === 0 && c.intensity < 0.004) c.intensity = 0;
    document.documentElement.style.setProperty('--fog', c.fog.toFixed(3));

    if (c.intensity === 0 && c.fog === 0 && lightning.bolt < 0.003) {
      if (!idle) {
        renderer.clear();
        idle = true;
      }
      return;
    }
    idle = false;

    time += dt;
    if (time > 20000) time -= 20000;

    const w = effectiveWind();
    const rel = (w.deg + 180 - CFG.viewAz) * RAD;
    const h = clouds.uniforms.uHor.value;
    const lum = h.x * 0.3 + h.y * 0.59 + h.z * 0.11;
    const kk = Math.min(0.25 + 1.4 * lum, 1);

    u.uTime.value = time;
    fogX += Math.sin(rel) * (0.01 + w.spd * 0.004) * dt;
    u.uFog.value = c.fog;
    u.uFogX.value = fogX;
    u.uPan.value = (state.az - CFG.viewAz * RAD) * SKY_Z / 2;
    u.uInt.value = c.intensity;
    u.uPhase.value = c.phase;
    u.uHail.value = c.hail;
    u.uSlant.value = Math.sin(rel) * Math.min(w.spd / 18, 1) * 0.55;
    u.uTint.value.set(h.x * 0.4 + 0.5 * kk * 0.9, h.y * 0.4 + 0.5 * kk * 0.95, h.z * 0.4 + 0.5 * kk);
    u.uFlash.value = lightning.flash;
    u.uBolt.value = lightning.bolt;
    u.uBoltX.value = lightning.x;
    u.uBoltY.value = lightning.y;
    u.uBoltSeed.value = lightning.seed;
    renderer.render(scene, camera);
  });
}

export function resizePrecip() {
  precip.renderer.setSize(window.innerWidth, window.innerHeight, false);
  precip.camera.aspect = window.innerWidth / window.innerHeight;
  precip.camera.updateProjectionMatrix();
  precip.renderer.getDrawingBufferSize(precip.uniforms.uRes.value);
}
