// rainier v2.1.0
export const CFG = {
  lat: 46.85,
  lon: -121.76,
  viewAz: 180,
  version: '2.1.0',
  sunDeg: 3.5,
  moonDeg: 4.0,
  owmKey: '3c511677984d2f330e332b9553c15ae7',
  keyFiles: ['file:///storage/emulated/0/weatherapi', 'weatherapi'],
  ratio: { sky: 1, sun: 2, moon: 2, clouds: 0.7, river: 1, precip: 1 },
  precip: { mmFull: 8, hail: true, hailWarmC: 12, fade: 1.2 },
  shake: { max: 7 },
  panLimit: 16,
  scrollPan: 12,          // degrees the scene sweeps from -24h to +24h of swiping
  moonSrc: ['https://github.com/aaronlp1312/TOWNTHREEOWM/blob/main/moon1.png', 'assets/moon.png'],
  moonDisc: 1.0,          // fraction of the PNG half-width the moon disc fills (auto-detected when readable)
  orion: { on: true, lines: 0 },
  life: { birds: true, leaves: true, dust: true, maxBirds: 9, maxLeaves: 70, maxDust: 90 },
  stageFallback: true,
  stageRes: 0.75,
  ui: { startHidden: false },
  // Parallax stack. src is a list: the first file that loads wins, then the procedural
  // stage layer of the same name draws if none do (stage.js).
  //   w      width of the PNG as % of the screen (PNG is pinned to its align edge)
  //   align  'left' | 'right' | 'center': the screen edge the PNG is anchored to
  //   ax     procedural fallback only: shift from centre as a fraction of screen width
  //   k      parallax depth, sway: tree wind sway in degrees at 10 m/s
  plx: [
    { name: 'rainier-peak',   src: ['assets/rainiertw.png', 'assets/rainier-peak.png'],            group: 'far',  k: 1.0,  w: 100, align: 'right',  ax: 0.20,  bottom: 0 },
    { name: 'horizon-strip',  src: ['assets/horizontw.png', 'assets/horizon-strip.png'],           group: 'far',  k: 1.0,  w: 100, align: 'left',   ax: -0.10, bottom: 0 },
    { name: 'farground',      src: ['assets/fargroundtw.png', 'assets/farground.png'],             group: 'far',  k: 1.08, w: 100, align: 'left',   ax: -0.12, bottom: 0 },
    { name: 'forested-shore', src: ['assets/foregroundtw.png', 'assets/forested-shore.png'],       group: 'near', k: 1.15, w: 100, align: 'left',   ax: -0.08, bottom: 0 },
    { name: 'wood-suspension-bridge', src: ['assets/wood-suspension-bridge.png'],                  group: 'near', k: 1.15, w: 100, align: 'right',  ax: 0.12,  bottom: 0 },
    { name: 'driftwood',      src: ['assets/driftwood.png'],                                       group: 'near', k: 1.3,  w: 100, align: 'left',   ax: -0.05, bottom: 0 },
    { name: 'cliff-face',     src: ['assets/cliff-face.png'],                                      group: 'near', k: 1.45, w: 100, align: 'left',   ax: -0.10, bottom: 0 },
    { name: 'trunk2', src: ['assets/trunk2.png'], group: 'near', k: 1.4,  w: 22, align: 'right', ax: 0, bottom: 0, sway: 0.5 },
    { name: 'tree3l', src: ['assets/tree3l.png'], group: 'near', k: 1.3,  w: 34, align: 'right', ax: 0, bottom: 0, sway: 1.4 },
    { name: 'tree1l', src: ['assets/tree1l.png'], group: 'near', k: 1.22, w: 30, align: 'right', ax: 0, bottom: 0, sway: 1.8 }
  ],

  windK: 0.0004,
  evolve: 0.003,
  cloudDefault: 0.45,
  windDefault: { spd: 4, deg: 250 },
  wxSky: 0.6,
  fadeRate: 1.6,
  scrubK: 0.0012,
  pastStepH: 3,
  swipe: { minPerScreen: 720, maxMin: 1440, friction: 2.6, returnSec: 45 }
};

export const RAD = Math.PI / 180;
export const DAY = 86400000;
export const SKY_Z = 1.1;
export const VFOV = 2 * Math.atan(1 / SKY_Z) / RAD;

export const state = {
  az: CFG.viewAz * RAD,
  minutes: null,
  key: '',
  owm: null,
  coverManual: null,
  windManual: null,
  offsetMin: 0,
  scrub: 0,
  owmPast: {},
  wxVer: 0,
  precipManual: null,
  fogManual: null,
  panAz: 0,
  scrollAz: 0,
  keySrc: 'none',
  owmStatus: 'wait',
  tempManual: null
};
