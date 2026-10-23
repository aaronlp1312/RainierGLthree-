// rainier v2.1.0
import * as THREE from 'three';
import { CFG, RAD, SKY_Z, state } from './config.js';
import { VERTEX, CLOUD_FRAG } from './shaders.js';
import { wxNow, cloudTargets } from './weather.js';
import { lightning } from './lightning.js';

export const clouds = {
  uniforms: {
    uRes: { value: new THREE.Vector2() },
    uAz: { value: 0 },
    uDrift: { value: new THREE.Vector3() },
    uCover: { value: 0.45 },
    uScale: { value: 2.2 },
    uZen: { value: new THREE.Vector3() },
    uHor: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Vector3() },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonCol: { value: new THREE.Vector3() },
    uSunColHi: { value: new THREE.Vector3() },
    uCirrus: { value: 0 },
    uStorm: { value: 0 },
    uFlash: { value: 0 },
    uCirrusDrift: { value: new THREE.Vector3() },
    uWindDir: { value: new THREE.Vector2(1, 0) }
  },
  cur: { cirrus: 0, deck: 0.45, storm: 0 },
  renderer: null,
  camera: null
};

export function effectiveCover() {
  return cloudTargets().deck;
}

export function effectiveWind() {
  const w = wxNow();
  const deg = w && w.windDeg !== null && w.windDeg !== undefined ? w.windDeg : CFG.windDefault.deg;
  let spd = w && w.windSpd !== null && w.windSpd !== undefined ? w.windSpd : CFG.windDefault.spd;
  if (state.windManual !== null) spd = state.windManual;
  return { spd: spd, deg: deg };
}

export function initClouds() {
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('rainier-clouds'),
    alpha: true,
    premultipliedAlpha: true
  });
  renderer.setPixelRatio(CFG.ratio.clouds);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      defines: { SKY_Z: SKY_Z.toFixed(3) },
      uniforms: clouds.uniforms,
      vertexShader: VERTEX,
      fragmentShader: CLOUD_FRAG
    })
  );
  quad.frustumCulled = false;
  scene.add(quad);

  clouds.renderer = renderer;
  clouds.camera = camera;

  const u = clouds.uniforms;
  let last = 0;

  renderer.setAnimationLoop(function (ts) {
    const dt = Math.min((ts - last) / 1000, 0.1);
    last = ts;

    const w = effectiveWind();
    const sc = state.scrub;
    state.scrub = 0;
    const adv = w.spd * CFG.windK * dt + (w.spd + 4) * CFG.scrubK * sc;
    const b = (w.deg + 180) * RAD;
    u.uDrift.value.x += Math.sin(b) * adv;
    u.uDrift.value.z -= Math.cos(b) * adv;
    u.uDrift.value.y += CFG.evolve * dt;

    const b2 = (w.deg + 205) * RAD;
    const adv2 = 1.6 * adv;
    u.uCirrusDrift.value.x += Math.sin(b2) * adv2;
    u.uCirrusDrift.value.z -= Math.cos(b2) * adv2;
    u.uCirrusDrift.value.y += CFG.evolve * 0.6 * dt;
    u.uWindDir.value.set(Math.sin(b2), -Math.cos(b2));

    const tg = cloudTargets();
    const k = 1 - Math.exp(-dt * CFG.fadeRate);
    clouds.cur.cirrus += (tg.cirrus - clouds.cur.cirrus) * k;
    clouds.cur.deck += (tg.deck - clouds.cur.deck) * k;
    clouds.cur.storm += (tg.storm - clouds.cur.storm) * k;

    u.uAz.value = state.az;
    u.uCover.value = clouds.cur.deck;
    u.uCirrus.value = clouds.cur.cirrus;
    u.uStorm.value = clouds.cur.storm;
    u.uFlash.value = lightning.flash;
    renderer.render(scene, camera);
  });
}

export function resizeClouds() {
  clouds.renderer.setSize(window.innerWidth, window.innerHeight, false);
  clouds.camera.aspect = window.innerWidth / window.innerHeight;
  clouds.camera.updateProjectionMatrix();
  clouds.renderer.getDrawingBufferSize(clouds.uniforms.uRes.value);
}
