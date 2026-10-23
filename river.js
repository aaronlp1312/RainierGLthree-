// rainier v2.1.0
import * as THREE from 'three';
import { CFG } from './config.js';
import { VERTEX, RIVER_FRAG } from './shaders.js';

export const river = {
  uniforms: {
    iGlobalTime: { value: 0.1 },
    iResolution: { value: new THREE.Vector2() },
    uLight: { value: new THREE.Vector3(0.0, 1.0, 0.8) },
    uLightAmt: { value: 1.0 },
    uSkyZenith: { value: new THREE.Vector3(0.0, 0.0, 0.6) },
    uSkyHorizon: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) }
  },
  renderer: null,
  camera: null
};

export function initRiver() {
  const timer = new THREE.Timer();
  timer.connect(document);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('rainier-river'),
    alpha: true,
    premultipliedAlpha: true
  });
  renderer.setPixelRatio(CFG.ratio.river);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);

  const material = new THREE.ShaderMaterial({
    uniforms: river.uniforms,
    vertexShader: VERTEX,
    fragmentShader: RIVER_FRAG
  });

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  water.frustumCulled = false;
  scene.add(water);

  river.renderer = renderer;
  river.camera = camera;

  renderer.setAnimationLoop(function (timestamp) {
    timer.update(timestamp);
    river.uniforms.iGlobalTime.value += timer.getDelta();
    renderer.render(scene, camera);
  });
}

export function resizeRiver() {
  river.renderer.setSize(window.innerWidth, window.innerHeight, false);
  river.camera.aspect = window.innerWidth / window.innerHeight;
  river.camera.updateProjectionMatrix();
  river.renderer.getDrawingBufferSize(river.uniforms.iResolution.value);
}
