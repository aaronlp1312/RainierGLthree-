// rainier v2.1.0
import * as THREE from 'three';
import { CFG, RAD, VFOV, SKY_Z, state } from './config.js';
import { VERTEX, SKY_FRAG, SUN_VERT, SUN_FRAG } from './shaders.js';
import { mod, ss, astro, palette } from './astro.js';
import { river } from './river.js';
import { clouds, effectiveCover } from './clouds.js';
import { loadSkyTable, virtualHour, skyGradient } from './sky-gradient.js';
import { simMs } from './weather.js';

const zen = new THREE.Vector3();
const hor = new THREE.Vector3();
const tmp = new THREE.Vector3();

let skyL, moonL, sunL, sunMesh, sunMat, moonMesh, moonLight, moonCanvas, info;

// Orion: RA (hours), Dec (deg), visual magnitude. Betelgeuse, Rigel, Bellatrix, Mintaka,
// Alnilam, Alnitak (the belt), Saiph, Meissa, Hatysa (sword).
const ORION = [
  [5.9195, 7.407, 0.5],
  [5.2423, -8.202, 0.13],
  [5.4189, 6.350, 1.64],
  [5.5334, -0.299, 2.23],
  [5.6036, -1.202, 1.69],
  [5.6793, -1.943, 1.77],
  [5.7959, -9.670, 2.09],
  [5.5855, 9.934, 3.3],
  [5.5906, -5.910, 2.77]
];

const su = {
  uRes: { value: new THREE.Vector2() },
  uAz: { value: 0 },
  uZen: { value: new THREE.Vector3() },
  uHor: { value: new THREE.Vector3() },
  uSunDir: { value: new THREE.Vector3() },
  uMoonDir: { value: new THREE.Vector3() },
  uGlow: { value: 0 },
  uNight: { value: 0 },
  uMoonGlow: { value: 0 },
  uA: { value: new THREE.Vector3() },
  uB: { value: new THREE.Vector3() },
  uC: { value: new THREE.Vector3() },
  uOrion: { value: CFG.orion && CFG.orion.on ? 1 : 0 },
  uOri: { value: ORION.map(function (o) {
    const ra = o[0] * 15 * RAD;
    const de = o[1] * RAD;
    const w = Math.min(Math.max((2.6 - o[2]) / 2.5, 0), 1);
    return new THREE.Vector4(Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de), w);
  }) },
  uGrad: { value: Array.from({ length: 24 }, function () { return new THREE.Vector3(); }) }
};

function makeLayer(id, ratio) {
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById(id),
    alpha: true,
    premultipliedAlpha: true
  });
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VFOV, 1, 1, 1000);
  return { renderer: renderer, scene: scene, camera: camera };
}

function moonTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b9b7b2';
  g.fillRect(0, 0, 512, 256);
  let s = 7;
  const rnd = function () {
    s = mod(s * 16807, 2147483647);
    return s / 2147483647;
  };
  for (let i = 0; i < 16; i++) {
    g.fillStyle = 'rgba(70,72,80,0.5)';
    g.beginPath();
    g.ellipse(40 + rnd() * 220, 40 + rnd() * 176, 10 + rnd() * 30, 8 + rnd() * 22, 0, 0, 6.283);
    g.fill();
  }
  for (let i = 0; i < 600; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 256, rnd() * 2 + 0.5, 0, 6.283);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


// Moon PNG: the sphere's front hemisphere is mapped straight onto the disc in the
// image (orthographic), so a flat moon photo wraps correctly and the sun-lit phase
// shading still works. The disc is auto-measured when the browser lets us read the
// pixels (not from file://), otherwise CFG.moonDisc says how much of the image it fills.
function loadMoon(mesh) {
  const list = CFG.moonSrc || [];
  let i = 0;
  const img = new Image();
  img.onerror = function () {
    i++;
    if (i < list.length) img.src = list[i];
  };
  img.onload = function () {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    let cx = iw / 2;
    let cy = ih / 2;
    let R = Math.min(iw, ih) / 2 * CFG.moonDisc;
    try {
      const c = document.createElement('canvas');
      c.width = iw;
      c.height = ih;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, iw, ih).data;
      let x0 = iw, y0 = ih, x1 = -1, y1 = -1;
      for (let y = 0; y < ih; y += 2) {
        for (let x = 0; x < iw; x += 2) {
          const k = (y * iw + x) * 4;
          if (d[k + 3] > 16 && d[k] + d[k + 1] + d[k + 2] > 60) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 > x0 && y1 > y0) {
        cx = (x0 + x1) / 2;
        cy = (y0 + y1) / 2;
        R = Math.max(x1 - x0, y1 - y0) / 2;
      }
    } catch (err) {}
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let n = 0; n < pos.count; n++) {
      uv.setXY(n, (cx + pos.getX(n) * R) / iw, 1 - (cy - pos.getY(n) * R) / ih);
    }
    uv.needsUpdate = true;
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    const old = mesh.material.map;
    mesh.material.map = t;
    mesh.material.needsUpdate = true;
    if (old) old.dispose();
    state.key = '';
  };
  if (list.length) img.src = list[0];
}

export function initScene() {
  loadSkyTable();
  skyL = makeLayer('rainier-sky', CFG.ratio.sky);
  moonL = makeLayer('rainier-moon', CFG.ratio.moon);
  sunL = makeLayer('rainier-sun', CFG.ratio.sun);
  moonCanvas = document.getElementById('rainier-moon');
  info = document.getElementById('rainier-info');

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      defines: { SKY_Z: SKY_Z.toFixed(3) },
      uniforms: su,
      vertexShader: VERTEX,
      fragmentShader: SKY_FRAG
    })
  );
  sky.frustumCulled = false;
  skyL.scene.add(sky);

  sunMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Vector3(1, 1, 1) }, uAmt: { value: 1 } },
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG
  });
  sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMat);
  sunMesh.scale.setScalar(2 * 100 * Math.tan(CFG.sunDeg * RAD / 2) / 0.12);
  sunL.scene.add(sunMesh);

  moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshStandardMaterial({ map: moonTex(), roughness: 1, metalness: 0 })
  );
  moonMesh.scale.setScalar(100 * Math.tan(CFG.moonDeg * RAD / 2));
  moonLight = new THREE.DirectionalLight(0xffffff, 3.2);
  moonL.scene.add(moonMesh, moonLight, new THREE.AmbientLight(0x223355, 0.6));
  loadMoon(moonMesh);
}

export function resizeScene() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  [skyL, moonL, sunL].forEach(function (l) {
    l.renderer.setSize(w, h, false);
    l.camera.aspect = w / h;
    l.camera.updateProjectionMatrix();
  });
  skyL.renderer.getDrawingBufferSize(su.uRes.value);
  state.key = '';
}

export function simDate() {
  return new Date(simMs());
}

function hm(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function updateScene() {
  const date = simDate();
  const key = Math.floor(date.getTime() / 60000) + ':' + state.az.toFixed(4) + ':' + effectiveCover().toFixed(2) + ':' + clouds.cur.storm.toFixed(2);
  if (key === state.key) return;
  state.key = key;

  const a = astro(date);
  const sunAlt = Math.asin(a.sun.y) / RAD;
  const moonAlt = Math.asin(a.moon.y) / RAD;
  const illum = (1 - a.sun.dot(a.moon)) / 2;
  const night = ss(-6, -16, sunAlt);
  const moonUp = moonAlt > 0 ? 1 : 0;
  const hourV = virtualHour(date);
  skyGradient(hourV, effectiveCover(), su.uGrad.value);
  zen.copy(su.uGrad.value[0]);
  hor.copy(su.uGrad.value[23]);

  su.uAz.value = state.az;
  su.uZen.value.copy(zen);
  su.uHor.value.copy(hor);
  su.uSunDir.value.copy(a.sun);
  su.uMoonDir.value.copy(a.moon);
  su.uGlow.value = ss(-8, 0, sunAlt) * (1 - ss(0, 15, sunAlt));
  su.uNight.value = night;
  su.uMoonGlow.value = moonUp * illum * 0.6 * night;
  su.uA.value.copy(a.toLocal(0, 0));
  su.uB.value.copy(a.toLocal(Math.PI / 2, 0));
  su.uC.value.copy(a.toLocal(0, Math.PI / 2));

  sunL.camera.rotation.y = -state.az;
  moonL.camera.rotation.y = -state.az;

  sunMesh.position.copy(a.sun).multiplyScalar(100);
  sunMesh.lookAt(0, 0, 0);
  sunMesh.visible = sunAlt > -3;
  sunMat.uniforms.uColor.value.set(1.0, 0.45, 0.15).lerp(tmp.set(1.0, 0.97, 0.9), ss(0, 20, sunAlt));
  sunMat.uniforms.uAmt.value = ss(-2, 1, sunAlt) * (1 - 0.7 * clouds.cur.storm);

  moonMesh.position.copy(a.moon).multiplyScalar(100);
  moonMesh.lookAt(0, 0, 0);
  moonMesh.visible = moonAlt > -2;
  moonLight.position.copy(a.sun).multiplyScalar(100);
  moonCanvas.style.opacity = (0.3 + 0.7 * night) * (1 - 0.6 * clouds.cur.storm);

  const ru = river.uniforms;
  if (sunAlt > -3) {
    ru.uLight.value.copy(a.sun);
    ru.uLightAmt.value = ss(-3, 6, sunAlt);
  } else {
    ru.uLight.value.copy(a.moon);
    ru.uLightAmt.value = moonUp * 0.25 * illum;
  }
  ru.uLightAmt.value *= 1 - 0.4 * clouds.cur.storm;
  ru.uSkyZenith.value.copy(zen);
  ru.uSkyHorizon.value.copy(hor);
  ru.uTint.value.set(1, 1, 1).lerp(tmp.set(0.10, 0.14, 0.24), ss(2, -14, sunAlt));

  const cu = clouds.uniforms;
  const sunStr = ss(-9, 2, sunAlt) * 1.6;
  const moonStr = moonUp * illum * 0.55 * night;
  cu.uZen.value.copy(zen);
  cu.uHor.value.copy(hor);
  cu.uSunDir.value.copy(a.sun);
  cu.uSunCol.value.set(1.0, 0.38, 0.12).lerp(tmp.set(1.0, 0.97, 0.9), ss(-2, 18, sunAlt)).multiplyScalar(sunStr);
  cu.uSunColHi.value.set(1.0, 0.42, 0.22).lerp(tmp.set(1.0, 0.97, 0.9), ss(0, 18, sunAlt)).multiplyScalar(ss(-14, 3, sunAlt) * 1.5);
  cu.uMoonDir.value.copy(a.moon);
  cu.uMoonCol.value.set(0.55, 0.65, 1.0).multiplyScalar(moonStr);

  skyL.renderer.render(skyL.scene, skyL.camera);
  moonL.renderer.render(moonL.scene, moonL.camera);
  sunL.renderer.render(sunL.scene, sunL.camera);

  let txt = 'sky ' + mod(hourV, 24).toFixed(1) + '  sun ' + sunAlt.toFixed(1) + '  moon ' + moonAlt.toFixed(1) + '  lit ' + Math.round(illum * 100);
  if (state.owm) txt += '  rise ' + hm(state.owm.sunrise) + '  set ' + hm(state.owm.sunset);
  info.textContent = txt;
}
