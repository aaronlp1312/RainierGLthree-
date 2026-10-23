// rainier v2.1.0
import { CFG } from './config.js';
import { initRiver, resizeRiver } from './river.js';
import { initClouds, resizeClouds } from './clouds.js';
import { initPrecip, resizePrecip } from './precip.js';
import { initParallax, resizeParallax, tickParallax } from './parallax.js';
import { initScene, resizeScene, updateScene } from './scene.js';
import { initControls, syncSlider } from './controls.js';
import { initTimeline, tickTimeline } from './timeline.js';
import { initLightning, tickLightning } from './lightning.js';
import { initLife, resizeLife, tickLife } from './life.js';

document.title = 'Rainier v' + CFG.version;

initRiver();
initClouds();
initPrecip();
initParallax();
initScene();
initControls();
initTimeline();
initLightning();
initLife();

function resize() {
  resizeRiver();
  resizeClouds();
  resizePrecip();
  resizeParallax();
  resizeScene();
  resizeLife();
}
window.addEventListener('resize', resize);
resize();

function tick() {
  tickTimeline();
  tickLightning();
  syncSlider();
  updateScene();
  tickParallax();
  tickLife();
  requestAnimationFrame(tick);
}
tick();
