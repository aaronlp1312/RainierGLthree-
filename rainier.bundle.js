// rainier v2.1.0 bundle
import * as THREE from 'three';
// rainier v2.1.0
const CFG = {
  lat: 46.85,
  lon: -121.76,
  viewAz: 180,
  version: '2.1.0',
  sunDeg: 3.5,
  moonDeg: 4.0,
  owmKey: '%OWM_KEY%',
  keyFiles: ['file:///storage/emulated/0/weatherapi', 'weatherapi'],
  ratio: { sky: 1, sun: 2, moon: 2, clouds: 0.7, river: 1, precip: 1 },
  precip: { mmFull: 8, hail: true, hailWarmC: 12, fade: 1.2 },
  shake: { max: 7 },
  panLimit: 16,
  scrollPan: 12,          // degrees the scene sweeps from -24h to +24h of swiping
  moonSrc: ['assets/moon1.png', 'assets/moon.png'],
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

const RAD = Math.PI / 180;
const DAY = 86400000;
const SKY_Z = 1.1;
const VFOV = 2 * Math.atan(1 / SKY_Z) / RAD;

const state = {
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
// rainier v2.1.0

function mod(a, n) {
  return a - n * Math.floor(a / n);
}

function ss(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function astro(date) {
  const d = date.getTime() / DAY + 2440587.5 - 2451545;
  const phi = CFG.lat * RAD;
  const lst = RAD * (280.16 + 360.9856235 * d) + CFG.lon * RAD;
  const e = RAD * 23.4397;

  function toLocal(ra, dec) {
    const H = lst - ra;
    const cd = Math.cos(dec);
    const sd = Math.sin(dec);
    return new THREE.Vector3(
      -cd * Math.sin(H),
      sd * Math.sin(phi) + cd * Math.cos(H) * Math.cos(phi),
      cd * Math.cos(H) * Math.sin(phi) - sd * Math.cos(phi)
    );
  }

  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const sun = toLocal(
    Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)),
    Math.asin(Math.sin(L) * Math.sin(e))
  );

  const Lm = RAD * (218.316 + 13.176396 * d);
  const Mm = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.229350 * d);
  const l = Lm + RAD * 6.289 * Math.sin(Mm);
  const b = RAD * 5.128 * Math.sin(F);
  const moon = toLocal(
    Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)),
    Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
  );

  return { sun: sun, moon: moon, toLocal: toLocal };
}

const STOPS = [
  [-18, [0.005, 0.008, 0.03], [0.02, 0.03, 0.06]],
  [-12, [0.02, 0.03, 0.11], [0.12, 0.10, 0.22]],
  [-6,  [0.06, 0.10, 0.30], [0.75, 0.40, 0.35]],
  [0,   [0.12, 0.25, 0.55], [1.0, 0.60, 0.30]],
  [6,   [0.10, 0.25, 0.70], [0.95, 0.78, 0.60]],
  [35,  [0.0, 0.0, 0.6],    [1.0, 1.0, 1.0]]
];

const palTmp = new THREE.Vector3();

function palette(alt, zen, hor) {
  let i = 0;
  while (i < STOPS.length - 2 && alt > STOPS[i + 1][0]) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = Math.min(Math.max((alt - a[0]) / (b[0] - a[0]), 0), 1);
  zen.fromArray(a[1]).lerp(palTmp.fromArray(b[1]), t);
  hor.fromArray(a[2]).lerp(palTmp.fromArray(b[2]), t);
}
// rainier v2.1.0
const VERTEX = `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

const RIVER_FRAG = `
  uniform float iGlobalTime;
  uniform vec2 iResolution;
  uniform vec3 uLight;
  uniform float uLightAmt;
  uniform vec3 uSkyZenith;
  uniform vec3 uSkyHorizon;
  uniform vec3 uTint;

  const int NUM_STEPS = 8;
  const float PI = 3.1415;
  const float EPSILON = 1e-3;
  float EPSILON_NRM;

  // sea variables
  const int ITER_GEOMETRY = 3;
  const int ITER_FRAGMENT = 5;
  const float SEA_HEIGHT = 0.6;
  const float SEA_CHOPPY = 1.0;
  const float SEA_SPEED = 1.0;
  const float SEA_FREQ = 0.16;
  const vec3 SEA_BASE = vec3(0.1,0.19,0.22);
  const vec3 SEA_WATER_COLOR = vec3(0.8,0.9,0.6);
  float SEA_TIME;
  mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);

  mat3 fromEuler(vec3 ang) {
    vec2 a1 = vec2(sin(ang.x),cos(ang.x));
    vec2 a2 = vec2(sin(ang.y),cos(ang.y));
    vec2 a3 = vec2(sin(ang.z),cos(ang.z));
    mat3 m;
    m[0] = vec3(
      a1.y*a3.y+a1.x*a2.x*a3.x,
      a1.y*a2.x*a3.x+a3.y*a1.x,
      -a2.y*a3.x
    );
    m[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);
    m[2] = vec3(
      a3.y*a1.x*a2.x+a1.y*a3.x,
      a1.x*a3.x-a1.y*a3.y*a2.x,
      a2.y*a3.y
    );
    return m;
  }

  float hash( vec2 p ) {
    float h = dot(p,vec2(127.1,311.7));
    return fract(sin(h)*43758.5453123);
  }

  float noise( in vec2 p ) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
      mix(
        hash(i + vec2(0.0,0.0)
      ),
      hash(i + vec2(1.0,0.0)), u.x),
      mix(hash(i + vec2(0.0,1.0) ),
      hash(i + vec2(1.0,1.0) ), u.x),
      u.y
    );
  }

  float diffuse(vec3 n,vec3 l,float p) {
    return pow(dot(n,l) * 0.4 + 0.6,p);
  }

  float specular(vec3 n,vec3 l,vec3 e,float s) {
    float nrm = (s + 8.0) / (3.1415 * 8.0);
    return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;
  }

  vec3 getSkyColor(vec3 e) {
    e.y = max(e.y, 0.0);
    vec3 t = vec3(pow(1.0 - e.y, 2.0), 1.0 - e.y, 1.0 - e.y);
    return mix(uSkyZenith, uSkyHorizon, t);
  }

  float sea_octave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
  }

  float map(vec3 p) {
    float freq = SEA_FREQ;
    float amp = SEA_HEIGHT;
    float choppy = SEA_CHOPPY;
    vec2 uv = p.xz;
    uv.x *= 0.75;

    float d, h = 0.0;
    for(int i = 0; i < ITER_GEOMETRY; i++) {
      d = sea_octave((uv + SEA_TIME) * freq, choppy);
      d += sea_octave((uv - SEA_TIME) * freq, choppy);
      h += d * amp;
      uv *= octave_m;
      freq *= 1.9;
      amp *= 0.22;
      choppy = mix(choppy, 1.0, 0.2);
    }
    return p.y - h;
  }

  float map_detailed(vec3 p) {
    float freq = SEA_FREQ;
    float amp = SEA_HEIGHT;
    float choppy = SEA_CHOPPY;
    vec2 uv = p.xz;
    uv.x *= 0.75;

    float d, h = 0.0;
    for(int i = 0; i < ITER_FRAGMENT; i++) {
      d = sea_octave((uv+SEA_TIME) * freq, choppy);
      d += sea_octave((uv-SEA_TIME) * freq, choppy);
      h += d * amp;
      uv *= octave_m;
      freq *= 1.9;
      amp *= 0.22;
      choppy = mix(choppy,1.0,0.2);
    }
    return p.y - h;
  }

  vec3 getSeaColor(
    vec3 p,
    vec3 n,
    vec3 l,
    vec3 eye,
    vec3 dist
  ) {
    float fresnel = 1.0 - max(dot(n,-eye),0.0);
    fresnel = pow(fresnel,3.0) * 0.65;

    vec3 reflected = getSkyColor(reflect(eye,n));
    vec3 refracted = SEA_BASE + diffuse(n,l,80.0) * SEA_WATER_COLOR * 0.12 * uLightAmt;

    vec3 color = mix(refracted,reflected,fresnel);

    float atten = max(1.0 - dot(dist,dist) * 0.001, 0.0);
    color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;

    color += vec3(specular(n,l,eye,60.0)) * uLightAmt;

    return color;
  }

  // tracing
  vec3 getNormal(vec3 p, float eps) {
    vec3 n;
    n.y = map_detailed(p);
    n.x = map_detailed(vec3(p.x+eps,p.y,p.z)) - n.y;
    n.z = map_detailed(vec3(p.x,p.y,p.z+eps)) - n.y;
    n.y = eps;
    return normalize(n);
  }

  float heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {
    float tm = 0.0;
    float tx = 1000.0;
    float hx = map(ori + dir * tx);

    if(hx > 0.0) {
      return tx;
    }

    float hm = map(ori + dir * tm);
    float tmid = 0.0;
    for(int i = 0; i < NUM_STEPS; i++) {
      tmid = mix(tm,tx, hm/(hm-hx));
      p = ori + dir * tmid;
      float hmid = map(p);
      if(hmid < 0.0) {
        tx = tmid;
        hx = hmid;
      } else {
        tm = tmid;
        hm = hmid;
      }
    }
    return tmid;
  }

  void main() {
    EPSILON_NRM = 0.1 / iResolution.x;
    SEA_TIME = iGlobalTime * SEA_SPEED;
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    float time = iGlobalTime * 0.3;

    // ray
    vec3 ang = vec3(
      sin(time*3.0)*0.1,sin(time)*0.2+0.3,time
    );
    vec3 ori = vec3(0.0,3.5,time*5.0);
    vec3 dir = normalize(
      vec3(uv.xy,-2.0)
    );
    dir.z += length(uv) * 0.15;
    dir = normalize(dir);

    // tracing
    vec3 p;
    heightMapTracing(ori,dir,p);
    vec3 dist = p - ori;
    vec3 n = getNormal(
      p,
      dot(dist,dist) * EPSILON_NRM
    );
    vec3 light = normalize(uLight);

    // water only, sky pixels stay transparent for rainier-sky underneath
    float mask = pow(smoothstep(0.0,-0.05,dir.y),0.3);
    vec3 sea = getSeaColor(p,n,light,dir,dist);

    // post
    gl_FragColor = vec4(pow(sea * uTint,vec3(0.75)) * mask, mask);
  }
`;

const SKY_FRAG = `
  uniform vec2 uRes;
  uniform float uAz;
  uniform vec3 uZen;
  uniform vec3 uHor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uGrad[24];
  uniform float uGlow;
  uniform float uNight;
  uniform float uMoonGlow;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec4 uOri[9];
  uniform float uOrion;

  const vec3 GAL_POLE = vec3(-0.8677, -0.1981, 0.4560);
  const vec3 GAL_CENTER = vec3(-0.0549, -0.8734, -0.4838);

  float h31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vn(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(h31(i), h31(i + vec3(1.0,0.0,0.0)), f.x),
        mix(h31(i + vec3(0.0,1.0,0.0)), h31(i + vec3(1.0,1.0,0.0)), f.x),
        f.y
      ),
      mix(
        mix(h31(i + vec3(0.0,0.0,1.0)), h31(i + vec3(1.0,0.0,1.0)), f.x),
        mix(h31(i + vec3(0.0,1.0,1.0)), h31(i + vec3(1.0,1.0,1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  vec3 gradAt(float v) {
    float x = clamp(v, 0.0, 1.0) * 23.0;
    int i = int(min(floor(x), 22.0));
    return mix(uGrad[i], uGrad[i + 1], x - float(i));
  }

  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * vn(p);
      p *= 2.0;
      a *= 0.5;
    }
    return s / 0.9375;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    uv.x *= uRes.x / uRes.y;
    vec3 c = normalize(vec3(uv, -SKY_Z));
    vec3 f = vec3(sin(uAz), 0.0, -cos(uAz));
    vec3 r = vec3(cos(uAz), 0.0, sin(uAz));
    vec3 dir = r * c.x + vec3(0.0, 1.0, 0.0) * c.y + f * (-c.z);

    float e = max(dir.y, 0.0);
    float v = 1.0 - clamp(dir.y / (1.0 / sqrt(1.0 + SKY_Z * SKY_Z)), 0.0, 1.0);
    vec3 col = gradAt(v);

    col += vec3(1.0, 0.55, 0.25) * pow(max(dot(dir, uSunDir), 0.0), 6.0) * uGlow * (1.0 - e);
    col += vec3(0.25, 0.3, 0.45) * pow(max(dot(dir, uMoonDir), 0.0), 60.0) * uMoonGlow;

    if (uNight > 0.0 && dir.y > 0.0) {
      vec3 eq = vec3(dot(dir, uA), dot(dir, uB), dot(dir, uC));
      float sb = dot(eq, GAL_POLE);
      float band = exp(-sb * sb * 28.0);
      float gc = pow(max(dot(eq, GAL_CENTER), 0.0), 5.0);
      float dust = 0.55 + 0.9 * fbm(eq * 7.0);
      float mw = band * dust * (0.25 + 1.6 * gc);
      vec3 mwCol = mix(vec3(0.45, 0.52, 0.75), vec3(0.95, 0.78, 0.55), gc);

      vec3 sp = eq * 130.0;
      vec3 id = floor(sp);
      vec3 fp = fract(sp) - 0.5;
      float h = h31(id);
      vec3 off = (vec3(h31(id + 3.1), h31(id + 7.7), h31(id + 11.3)) - 0.5) * 0.5;
      float thr = 0.975 - 0.02 * band;
      float big = step(0.9, h31(id + 31.7));
      float rad = mix(0.42, 0.7, big);
      float star = step(thr, h) * (1.0 - smoothstep(0.0, rad, length(fp - off))) * (0.55 + 0.9 * h31(id + 19.9) + 0.8 * big);

      float vis = uNight * smoothstep(0.0, 0.12, dir.y);
      // Orion: nine real stars at their RA/Dec, drawn with the same point size and
      // falloff as the field stars (130 cells per radian, radius 0.42 to 0.7 cells),
      // so it reads as part of the sky. Only the brightest ones (Rigel, Betelgeuse)
      // are bigger, like the field's own big stars.
      vec3 ori = vec3(0.0);
      if (uOrion > 0.0 && dot(eq, vec3(0.1045, 0.9945, 0.0)) > 0.86) {
        for (int i = 0; i < 9; i++) {
          vec4 o = uOri[i];
          float d = length(eq - o.xyz) * 130.0;
          float rd = mix(0.42, 0.7, o.w);
          float s = (1.0 - smoothstep(0.0, rd, d)) * (0.75 + 0.95 * o.w);
          vec3 tint = vec3(1.0);
          if (i == 0) tint = vec3(1.0, 0.64, 0.42);
          else if (i == 1) tint = vec3(0.72, 0.82, 1.0);
          else if (i == 2 || i == 3 || i == 4 || i == 5) tint = vec3(0.86, 0.92, 1.0);
          ori += tint * s;
        }
      }
      col += (mwCol * mw * 0.22 + vec3(star) + ori * uOrion) * vis;
    }

    gl_FragColor = vec4(pow(col, vec3(0.75)), 1.0);
  }
`;

const SUN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAG = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uAmt;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float disc = 1.0 - smoothstep(0.10, 0.14, r);
    float halo = exp(-r * r * 14.0) * 0.55;
    float edge = 1.0 - smoothstep(0.85, 1.0, r);
    gl_FragColor = vec4(uColor, clamp(disc + halo, 0.0, 1.0) * uAmt * edge);
  }
`;

const CLOUD_FRAG = `
  uniform vec2 uRes;
  uniform float uAz;
  uniform vec3 uDrift;
  uniform float uCover;
  uniform float uScale;
  uniform vec3 uZen;
  uniform vec3 uHor;
  uniform vec3 uSunDir;
  uniform vec3 uSunCol;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonCol;
  uniform vec3 uSunColHi;
  uniform float uCirrus;
  uniform float uStorm;
  uniform float uFlash;
  uniform vec3 uCirrusDrift;
  uniform vec2 uWindDir;

  const float BASE0 = 1.0;
  const float TOP0 = 1.45;
  const float CIRRUS_H = 2.8;
  const int STEPS = 16;
  const float SIGMA = 14.0;

  float cBase() {
    return mix(BASE0, 0.8, uStorm);
  }

  float cTop() {
    return mix(TOP0, 1.9, uStorm);
  }

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return -1.0 + 2.0 * fract((p3.xxy + p3.yxx) * p3.zyx);
  }

  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(
        mix(dot(hash33(i), f),
            dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
        mix(dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
            dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x),
        u.y),
      mix(
        mix(dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
            dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
        mix(dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
            dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x),
        u.y),
      u.z
    );
  }

  float fbm3(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 3; i++) {
      s += a * gnoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.3);
      a *= 0.5;
    }
    return s;
  }

  float cloudDensity(vec3 p, float detailAmt) {
    float h = (p.y - cBase()) / (cTop() - cBase());
    if (h <= 0.0 || h >= 1.0) {
      return 0.0;
    }
    vec3 q = (p - uDrift) * uScale;
    float thr = 0.25 - 0.39 * uCover;
    float pr = smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.55, 1.0, h));
    float s = fbm3(q * 0.9) - thr - (1.0 - pr) * 0.25;
    if (s < -0.15) {
      return 0.0;
    }
    if (detailAmt > 0.5) {
      s -= fbm3(q * 3.5) * 0.6 * (0.6 + 0.8 * h);
    }
    return clamp(s * 4.0, 0.0, 1.0);
  }

  float lightOD(vec3 p, vec3 l) {
    float od = 0.0;
    for (int i = 0; i < 3; i++) {
      p += l * 0.07;
      od += cloudDensity(p, 0.0);
    }
    return od;
  }

  float hg(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
  }

  float shadowTerm(float od) {
    return exp(-od * 0.9) * 0.85 + 0.15 * exp(-od * 0.3);
  }

  vec4 cirrusLayer(vec3 rd) {
    if (uCirrus < 0.02) {
      return vec4(0.0);
    }
    float t = CIRRUS_H / rd.y;
    vec2 xz = rd.xz * t - uCirrusDrift.xz;
    vec2 w = uWindDir;
    vec2 q = vec2(dot(xz, w) * 0.2, dot(xz, vec2(-w.y, w.x))) * 0.9;
    float n = fbm3(vec3(q, uCirrusDrift.y));
    float fine = fbm3(vec3(q.x * 2.0, q.y * 6.0, uCirrusDrift.y * 1.6 + 4.0));
    float thr = 0.12 - 0.24 * uCirrus;
    float d = smoothstep(thr, thr + 0.16, n + 0.35 * fine);
    float a = d * 0.6 * (0.5 + 0.5 * uCirrus);
    a *= smoothstep(0.015, 0.25, rd.y);
    vec3 sk = mix(uHor, uZen, 0.55);
    vec3 amb = mix(sk, vec3(dot(sk, vec3(0.3, 0.59, 0.11)) * 1.2), 0.5) * 0.8 + 0.03;
    float ph = 0.4 + 1.4 * hg(dot(rd, uSunDir), 0.5);
    vec3 lit = amb * (1.0 - 0.45 * uStorm) + uSunColHi * ph;
    lit += uMoonCol * (0.4 + hg(dot(rd, uMoonDir), 0.5)) * 0.8;
    return vec4(lit * a, a);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    uv.x *= uRes.x / uRes.y;
    vec3 c = normalize(vec3(uv, -SKY_Z));
    vec3 f = vec3(sin(uAz), 0.0, -cos(uAz));
    vec3 r = vec3(cos(uAz), 0.0, sin(uAz));
    vec3 rd = r * c.x + vec3(0.0, 1.0, 0.0) * c.y + f * (-c.z);

    if (rd.y < 0.015) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float t0 = cBase() / rd.y;
    float t1 = cTop() / rd.y;
    float len = min(t1 - t0, 1.6 + 1.2 * uStorm);
    float dt = len / float(STEPS);
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));

    vec3 sky = mix(uHor, uZen, 0.5);
    bool sunOn = dot(uSunCol, vec3(1.0)) > 0.02;
    bool moonOn = dot(uMoonCol, vec3(1.0)) > 0.02;
    float phS = 0.35 + 1.6 * hg(dot(rd, uSunDir), 0.65);
    float phM = 0.35 + 1.6 * hg(dot(rd, uMoonDir), 0.65);

    float T = 1.0;
    vec3 col = vec3(0.0);

    for (int i = 0; i < STEPS; i++) {
      vec3 p = rd * (t0 + (float(i) + jit) * dt);
      float d = cloudDensity(p, 1.0);
      if (d > 0.01) {
        float h = clamp((p.y - cBase()) / (cTop() - cBase()), 0.0, 1.0);
        vec3 sk = mix(uHor, uZen, h);
        vec3 amb = mix(sk, vec3(dot(sk, vec3(0.3, 0.59, 0.11)) * 1.2), 0.40);
        vec3 lit = amb * (0.42 + 0.50 * h) + vec3(0.02, 0.025, 0.045);
        lit *= 1.0 - 0.5 * uStorm;
        lit += vec3(0.7, 0.78, 1.0) * uFlash * 2.2;
        float sunK = 1.0 - 0.65 * uStorm;
        if (sunOn) {
          lit += uSunCol * phS * sunK * shadowTerm(lightOD(p, uSunDir));
        }
        if (moonOn) {
          lit += uMoonCol * phM * sunK * shadowTerm(lightOD(p, uMoonDir));
        }
        float stepT = exp(-d * mix(SIGMA, 24.0, uStorm) * dt);
        col += T * (1.0 - stepT) * lit;
        T *= stepT;
        if (T < 0.02) {
          break;
        }
      }
    }

    vec4 cir = cirrusLayer(rd);
    vec3 tot = col + T * cir.rgb;
    float aT = 1.0 - T * (1.0 - cir.a);
    float alpha = aT * smoothstep(0.015, 0.22, rd.y);
    vec3 rgb = tot / max(aT, 0.001);
    rgb = 1.0 - exp(-rgb * 1.7);
    rgb = pow(rgb, vec3(0.75));
    gl_FragColor = vec4(rgb * alpha, alpha);
  }
`;

const PRECIP_FRAG = `
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uPan;
  uniform float uInt;
  uniform float uPhase;
  uniform float uHail;
  uniform float uSlant;
  uniform vec3 uTint;
  uniform float uFlash;
  uniform float uBolt;
  uniform float uBoltX;
  uniform float uBoltY;
  uniform float uBoltSeed;
  uniform float uFog;
  uniform float uFogX;

  float h11(float n) {
    return fract(sin(n * 127.1) * 43758.5453);
  }

  float h21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec3 layer(vec2 p, float li) {
    float cell = mix(0.035, 0.14, li);
    float k = 0.6 + 0.8 * li;
    vec2 q = p;
    q.x += uPan * k;
    q.x += q.y * uSlant * (1.0 + 0.25 * sin(uTime * 0.6 + li * 3.0));
    float cx = floor(q.x / cell);
    float fx = fract(q.x / cell);
    float rc = h21(vec2(cx, li * 9.0 + 1.0));
    float rk = h21(vec2(cx, li * 9.0 + 5.0));
    float rs = h21(vec2(cx, li * 9.0 + 8.0));
    float kHail = step(rk, uHail);
    float kSnow = (1.0 - kHail) * step(rs, uPhase);

    float sp = mix(0.55, 1.5, li) * mix(0.55, 1.35, uInt);
    sp = mix(sp, mix(0.16, 0.34, li), kSnow);
    sp = mix(sp, mix(1.1, 2.1, li), kHail);
    sp *= 0.8 + 0.4 * rc;

    float thick = mix(0.0010, 0.0034, uInt) * mix(0.7, 1.4, li);
    float rad = mix(0.003, 0.009, li) * mix(0.8, 1.3, uInt);
    float len = mix(0.025, 0.11, uInt) * mix(0.6, 1.2, li);
    len = mix(len, 0.0, kSnow);
    len = mix(len, 0.012 * mix(0.6, 1.2, li), kHail);

    float rowH = max(cell * 2.5, len * 1.6 + 0.03);
    float yy = q.y / rowH + uTime * sp / rowH + rc * 31.0;
    float row = floor(yy);
    float fy = fract(yy);
    float rm = mod(row, 64.0);
    float rr = h21(vec2(cx * 1.37 + rm * 0.71, li * 5.0 + rc));
    float dens = clamp(pow(uInt, 0.6), 0.0, 1.0) * mix(0.9, 0.7, li) * mix(1.0, 1.4, kSnow);
    float xr = 0.3 + 0.4 * h21(vec2(rm, cx) + 11.0);
    float yh = mix(0.02, max(rowH - len - 0.02, 0.03), h21(vec2(rm, cx) + 23.0));
    float ly = fy * rowH - yh;
    float sway = kSnow * sin(uTime * 1.3 + rc * 40.0 + q.y * 4.0) * cell * 0.16;
    float lx = (fx - xr) * cell - sway;

    float dRain = length(vec2(lx, ly - clamp(ly, 0.0, len)));
    float dSnow = length(vec2(lx, ly));
    float d = mix(dRain, dSnow, kSnow);
    float r = mix(thick, rad, kSnow);
    r = mix(r, thick * 2.2, kHail);
    float soft = mix(0.35, 0.0, kSnow);
    float al = (1.0 - smoothstep(r * soft, r, d)) * step(rr, dens);
    float scale = mix(0.45, 1.0, li) * mix(0.6, 1.0, uInt);
    return vec3(al * scale, kSnow, kHail);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
      mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float segd(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float bolt(vec2 p) {
    float ax = uRes.x / uRes.y;
    float top = 1.05;
    float stp = (top - uBoltY) / 14.0;
    vec2 a = vec2(uBoltX * ax, top);
    vec2 br = a;
    float dmin = 1000.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float off = (h11(uBoltSeed + fi * 1.7) - 0.5) * 0.11;
      vec2 b = vec2(a.x + off, a.y - stp);
      dmin = min(dmin, segd(p, a, b));
      if (i == 6) {
        br = b;
      }
      a = b;
    }
    vec2 c = br;
    for (int j = 0; j < 6; j++) {
      float fj = float(j);
      float off = 0.045 + (h11(uBoltSeed + 40.0 + fj * 2.3) - 0.3) * 0.07;
      vec2 e = vec2(c.x + off, c.y - stp * 0.8);
      dmin = min(dmin, segd(p, c, e) * 1.8);
      c = e;
    }
    return dmin;
  }

  void main() {
    vec2 p = gl_FragCoord.xy / uRes.y;
    float a = 0.0;
    float sa = 0.0;
    float ws = 0.0;
    float wh = 0.0;
    if (uInt > 0.002) {
      for (int i = 0; i < 6; i++) {
        vec3 l = layer(p, float(i) / 5.0);
        a = 1.0 - (1.0 - a) * (1.0 - l.x);
        sa += l.x;
        ws += l.x * l.y;
        wh += l.x * l.z;
      }
    }
    float inv = 1.0 / max(sa, 0.001);
    vec3 ice = min(uTint * 1.7 + 0.1, vec3(1.0));
    vec3 col = mix(uTint, ice, clamp((ws + wh) * inv, 0.0, 1.0));
    col *= 1.0 + 2.5 * uFlash;
    col = min(col, vec3(1.0));
    vec3 rgb = col * a;
    float alpha = a;

    if (uFog > 0.004) {
      vec2 q = vec2(p.x * 1.4 + uFogX, p.y * 3.0);
      float n = vnoise(q) * 0.55 + vnoise(q * 2.1 + 7.3) * 0.3 + vnoise(q * 4.3 + vec2(uFogX * 1.5 + 2.1, 5.7)) * 0.15;
      float bx = (p.y - 0.52) / 0.2;
      float band = exp(-bx * bx);
      float fa = clamp(uFog * (0.3 + 0.7 * band) * (0.5 + n), 0.0, 0.92);
      vec3 fc = min(min(uTint * 1.3 + 0.05, vec3(1.0)) * (1.0 + 1.5 * uFlash), vec3(1.0));
      rgb = rgb + fc * fa * (1.0 - a);
      alpha = a + fa * (1.0 - a);
    }

    if (uBolt > 0.003) {
      vec2 pb = p;
      pb.x += uPan * 0.5;
      float d = bolt(pb);
      float core = 1.0 - smoothstep(0.0, 0.006, d);
      float glow = 0.006 / (d + 0.012);
      float b = clamp(core + glow * 0.8, 0.0, 1.0) * uBolt;
      rgb = rgb * (1.0 - b) + vec3(0.82, 0.88, 1.0) * b;
      alpha = 1.0 - (1.0 - alpha) * (1.0 - b);
    }
    gl_FragColor = vec4(rgb, alpha);
  }
`;
// rainier v2.1.0

const GN = 24;
const GAMMA = 1 / 0.75;
const SUN_EDGE = -0.833;
let table = [];
const timesCache = {};

function hexToRgb(h) {
  let s = h.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return [
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255
  ];
}

function parseGradient(str) {
  const re = /(#[0-9a-fA-F]{3,6})\s*([\d.]+)?/g;
  const stops = [];
  let m;
  while ((m = re.exec(str)) !== null) {
    stops.push({ c: hexToRgb(m[1]), p: m[2] === undefined ? null : parseFloat(m[2]) / 100 });
  }
  if (stops.length === 0) return stops;
  if (stops[0].p === null) stops[0].p = 0;
  if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 1;
  let i = 0;
  while (i < stops.length) {
    if (stops[i].p !== null) { i++; continue; }
    let j = i;
    while (stops[j].p === null) j++;
    const a = stops[i - 1].p;
    const b = stops[j].p;
    for (let k = i; k < j; k++) {
      stops[k].p = a + (b - a) * (k - i + 1) / (j - i + 1);
    }
    i = j;
  }
  return stops;
}

function sampleStops(stops, v) {
  if (stops.length === 0) return [0, 0, 0.05];
  if (stops.length === 1 || v <= stops[0].p) return stops[0].c;
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i].p) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = b.p === a.p ? 1 : (v - a.p) / (b.p - a.p);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * t,
        a.c[1] + (b.c[1] - a.c[1]) * t,
        a.c[2] + (b.c[2] - a.c[2]) * t
      ];
    }
  }
  return stops[stops.length - 1].c;
}

function loadSkyTable() {
  const cs = getComputedStyle(document.documentElement);
  table = [];
  for (let h = 0; h < 24; h++) {
    const name = '--sky-' + (h < 10 ? '0' + h : h);
    table.push(parseGradient(cs.getPropertyValue(name)));
  }
}

function sunTimes(day) {
  const key = day.getTime();
  if (timesCache[key]) return timesCache[key];
  let rise = null;
  let set = null;
  let prevT = 0;
  let prevAlt = null;
  for (let m = 0; m <= 1440; m += 2) {
    const t = key + m * 60000;
    const alt = Math.asin(astro(new Date(t)).sun.y) / RAD;
    if (prevAlt !== null) {
      const f = (SUN_EDGE - prevAlt) / (alt - prevAlt);
      if (rise === null && prevAlt < SUN_EDGE && alt >= SUN_EDGE) rise = prevT + f * (t - prevT);
      if (prevAlt >= SUN_EDGE && alt < SUN_EDGE) set = prevT + f * (t - prevT);
    }
    prevT = t;
    prevAlt = alt;
  }
  if (rise === null) rise = key + 6 * 3600000;
  if (set === null) set = key + 18 * 3600000;
  timesCache[key] = { rise: rise, set: set };
  return timesCache[key];
}

function dayStart(date, off) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + off);
}

function virtualHour(date) {
  const t = date.getTime();
  const prev = sunTimes(dayStart(date, -1));
  const today = sunTimes(dayStart(date, 0));
  const next = sunTimes(dayStart(date, 1));
  if (t < today.rise) return 19 + (t - prev.set) / (today.rise - prev.set) * 12 - 24;
  if (t < today.set) return 7 + (t - today.rise) / (today.set - today.rise) * 12;
  return 19 + (t - today.set) / (next.rise - today.set) * 12;
}

function skyGradient(hourV, cover, out) {
  const H = mod(hourV, 24);
  const i0 = Math.floor(H);
  const f = H - i0;
  const i1 = mod(i0 + 1, 24);
  const k = CFG.wxSky * cover * cover;
  for (let n = 0; n < GN; n++) {
    const v = n / (GN - 1);
    const a = sampleStops(table[i0], v);
    const b = sampleStops(table[i1], v);
    const r = a[0] + (b[0] - a[0]) * f;
    const g = a[1] + (b[1] - a[1]) * f;
    const bl = a[2] + (b[2] - a[2]) * f;
    const lum = (0.299 * r + 0.587 * g + 0.114 * bl) * 0.85;
    out[n].set(
      Math.pow(r + (lum - r) * k, GAMMA),
      Math.pow(g + (lum - g) * k, GAMMA),
      Math.pow(bl + (lum - bl) * k, GAMMA)
    );
  }
}
// rainier v2.1.0

const river = {
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

function initRiver() {
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

function resizeRiver() {
  river.renderer.setSize(window.innerWidth, window.innerHeight, false);
  river.camera.aspect = window.innerWidth / window.innerHeight;
  river.camera.updateProjectionMatrix();
  river.renderer.getDrawingBufferSize(river.uniforms.iResolution.value);
}
// rainier v2.1.0

const ICON = {
  '01d': [0.00, 0.00, 0.00], '01n': [0.00, 0.00, 0.00],
  '02d': [0.80, 0.15, 0.00], '02n': [0.65, 0.12, 0.00],
  '03d': [0.60, 0.75, 0.00], '03n': [0.35, 0.70, 0.00],
  '04d': [0.35, 0.90, 0.00], '04n': [0.30, 0.85, 0.00],
  '09d': [0.25, 0.45, 0.78], '09n': [0.20, 0.40, 0.75],
  '10d': [0.30, 0.55, 0.85], '10n': [0.25, 0.50, 0.80],
  '11d': [0.15, 0.35, 0.95], '11n': [0.10, 0.30, 0.92],
  '13d': [0.18, 0.82, 0.75], '13n': [0.15, 0.78, 0.70],
  '50d': [0.55, 0.40, 0.12], '50n': [0.40, 0.30, 0.18]
};

let ver = -1;
let series = [];
let pastAsked = false;

function simMs() {
  const n = Date.now();
  let base = n;
  if (state.minutes !== null) {
    const d = new Date(n);
    base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, state.minutes).getTime();
  }
  return base + state.offsetMin * 60000;
}

function rebuild() {
  const m = new Map();
  const add = function (e) { if (e && e.dt) m.set(e.dt, e); };
  Object.keys(state.owmPast).forEach(function (k) { add(state.owmPast[k]); });
  if (state.owm) {
    add(state.owm.currentEntry);
    (state.owm.hourly || []).forEach(add);
  }
  series = Array.from(m.values()).sort(function (a, b) { return a.dt - b.dt; });
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

function lerpAngle(a, b, f) {
  const d = mod(b - a + 540, 360) - 180;
  return mod(a + d * f + 360, 360);
}

function kelvin(e) {
  return typeof e.temp === 'number' ? e.temp : null;
}

function mmOf(e) {
  const r = e.rain && e.rain['1h'] ? e.rain['1h'] : 0;
  const s = e.snow && e.snow['1h'] ? e.snow['1h'] : 0;
  return r + s;
}

function iconOf(e) {
  return e.weather && e.weather[0] ? e.weather[0].icon : null;
}

function weatherAt(ms) {
  if (state.wxVer !== ver) {
    ver = state.wxVer;
    rebuild();
  }
  if (series.length === 0) return null;
  const t = ms / 1000;
  let i = 0;
  while (i < series.length - 1 && series[i + 1].dt <= t) i++;
  const a = series[i];
  const b = series[Math.min(i + 1, series.length - 1)];
  const f = b.dt === a.dt ? 0 : Math.min(Math.max((t - a.dt) / (b.dt - a.dt), 0), 1);
  const ka = kelvin(a);
  const kb = kelvin(b);
  let tc = null;
  if (ka !== null && kb !== null) tc = lerp(ka, kb, f) - 273.15;
  else if (ka !== null) tc = ka - 273.15;
  else if (kb !== null) tc = kb - 273.15;
  return {
    tc: tc,
    mm: lerp(mmOf(a), mmOf(b), f),
    clouds: lerp(a.clouds, b.clouds, f),
    windSpd: lerp(a.wind_speed, b.wind_speed, f),
    windDeg: lerpAngle(a.wind_deg, b.wind_deg, f),
    icon: iconOf(f < 0.5 ? a : b)
  };
}

function wxNow() {
  const w = weatherAt(simMs());
  if (w) return w;
  const o = state.owm;
  if (o && o.clouds !== null) {
    return { clouds: o.clouds, windSpd: o.windSpd, windDeg: o.windDeg, icon: o.icon || null };
  }
  return null;
}

function cloudTargets() {
  const w = wxNow();
  const row = w && w.icon ? (ICON[w.icon] || ICON['01d']) : null;
  const frac = w && w.clouds !== null && w.clouds !== undefined ? w.clouds / 100 : null;
  let deck;
  let cirrus;
  let storm;
  if (state.coverManual !== null) {
    deck = state.coverManual;
    cirrus = 0.15 + 0.45 * deck;
    storm = Math.max(row ? row[2] * ss(0.5, 0.8, deck) : 0, state.precipManual !== null ? ss(0.7, 1.0, deck) : 0);
  } else {
    if (row && frac !== null) deck = 0.5 * row[1] + 0.5 * frac;
    else if (frac !== null) deck = frac;
    else if (row) deck = row[1];
    else deck = CFG.cloudDefault;
    cirrus = row ? row[0] : 0.25;
    storm = row ? row[2] : 0;
  }
  deck = Math.max(deck, storm * 0.95);
  return { cirrus: cirrus, deck: deck, storm: storm };
}

async function fetchPast(dt) {
  const key = 'rainier.past.' + CFG.lat + ',' + CFG.lon + '.' + dt;
  try {
    const c = localStorage.getItem(key);
    if (c) {
      state.owmPast[dt] = JSON.parse(c);
      state.wxVer++;
      return;
    }
  } catch (err) {}
  try {
    const url = 'https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=' + CFG.lat + '&lon=' + CFG.lon + '&dt=' + dt + '&appid=' + CFG.owmKey;
    const r = await (await fetch(url)).json();
    const e = r.data && r.data[0];
    if (!e) return;
    const slim = {
      dt: e.dt,
      clouds: e.clouds,
      wind_speed: e.wind_speed,
      wind_deg: e.wind_deg,
      temp: e.temp,
      rain: e.rain,
      snow: e.snow,
      weather: [{ icon: e.weather && e.weather[0] ? e.weather[0].icon : '01d' }]
    };
    state.owmPast[dt] = slim;
    state.wxVer++;
    try { localStorage.setItem(key, JSON.stringify(slim)); } catch (err) {}
  } catch (err) {}
}

function ensurePast() {
  if (pastAsked || CFG.owmKey.charAt(0) === '%') return;
  pastAsked = true;
  const step = CFG.pastStepH * 3600;
  const top = Math.floor(Date.now() / 3600000) * 3600;
  for (let k = 1; k <= 24 / CFG.pastStepH; k++) fetchPast(top - k * step);
}

function precipTargets() {
  const P = CFG.precip;
  const w = wxNow();
  const icon = w && w.icon ? w.icon : '';
  const g = icon.slice(0, 2);
  const tc = state.tempManual !== null ? state.tempManual : (w && w.tc !== null && w.tc !== undefined ? w.tc : null);
  const storm = cloudTargets().storm;
  const byIcon = { '09': 0.30, '10': 0.55, '11': 0.75, '13': 0.50, '50': 0.07 };
  let intensity = 0;
  if (state.precipManual !== null) {
    intensity = state.precipManual;
  } else if (w) {
    const mm = w.mm || 0;
    if (mm > 0) intensity = Math.min(Math.pow(mm / P.mmFull, 0.6), 1);
    if (byIcon[g] !== undefined) intensity = Math.max(intensity, byIcon[g] * (mm > 0 ? 0.6 : 1));
  }
  let phase = tc !== null ? 1 - ss(0.5, 3.5, tc) : 0;
  if (g === '13') phase = Math.max(phase, 0.8);
  else if (g === '09' || g === '10' || g === '11') phase = Math.min(phase, 0.5);
  let hail = 0;
  if (P.hail && intensity > 0) {
    const warm = tc !== null ? tc : 8;
    hail = Math.min(ss(0.55, 0.9, storm) * (1 - ss(P.hailWarmC, P.hailWarmC + 6, warm)) * (1 - 0.5 * phase), 0.6);
  }
  const manualStorm = state.precipManual !== null && storm > 0.7;
  const thunder = g === '11' || manualStorm ? Math.max(storm, 0.6) : 0;
  let fog = g === '50' ? 0.85 : 0;
  fog = Math.max(fog, Math.min(intensity * 0.3, 0.3));
  if (state.fogManual !== null) fog = state.fogManual;
  return { intensity: intensity, phase: phase, hail: hail, thunder: thunder, fog: fog };
}
// rainier v2.1.0

const lightning = { flash: 0, bolt: 0, x: 0.5, y: 0.3, seed: 0 };

let stage = null;
let pulses = [];
let shakes = [];
let next = 0;
let shaking = false;

function initLightning() {
  stage = document.getElementById('rainier-stage');
}

function strike(level) {
  const now = performance.now() / 1000;
  const lv = level === undefined ? 1 : level;
  lightning.x = 0.12 + Math.random() * 0.76;
  lightning.y = 0.2 + Math.random() * 0.2;
  lightning.seed = Math.random() * 100;
  pulses = [
    { t: now, a: 1, b: true },
    { t: now + 0.08, a: 0.5 + Math.random() * 0.4, b: true }
  ];
  if (Math.random() < 0.5) pulses.push({ t: now + 0.2, a: 0.25 + Math.random() * 0.3, b: false });
  const delay = 0.25 + Math.random() * 1.75;
  shakes.push({ t: now + delay, a: CFG.shake.max * (1 - delay / 2.4) * (0.5 + 0.5 * lv) });
}

function tickLightning() {
  const now = performance.now() / 1000;
  const th = precipTargets().thunder;
  if (th > 0) {
    if (next === 0) next = now + 1.5 + Math.random() * 3;
    if (now >= next) {
      strike(th);
      next = now + (18 - 14 * th) * (0.5 + Math.random());
    }
  } else {
    next = 0;
  }

  let f = 0;
  let b = 0;
  pulses = pulses.filter(function (p) { return now - p.t < 0.6; });
  pulses.forEach(function (p) {
    const d = now - p.t;
    if (d < 0) return;
    const v = p.a * Math.exp(-d * 14);
    if (v > f) f = v;
    if (p.b && v > b) b = v;
  });
  lightning.flash = f;
  lightning.bolt = Math.min(b * 1.4, 1);

  let sx = 0;
  let sy = 0;
  shakes = shakes.filter(function (s) { return now - s.t < 1.8; });
  shakes.forEach(function (s) {
    const d = now - s.t;
    if (d < 0) return;
    const e = s.a * Math.exp(-d * 4);
    sx += e * Math.sin(d * 140);
    sy += e * 0.6 * Math.sin(d * 110 + 1.3);
  });
  if (!stage) return;
  if (Math.abs(sx) + Math.abs(sy) > 0.02) {
    stage.style.transform = 'translate3d(' + sx.toFixed(2) + 'px,' + sy.toFixed(2) + 'px,0)';
    shaking = true;
  } else if (shaking) {
    stage.style.transform = '';
    shaking = false;
  }
}
// rainier v2.1.0

const clouds = {
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

function effectiveCover() {
  return cloudTargets().deck;
}

function effectiveWind() {
  const w = wxNow();
  const deg = w && w.windDeg !== null && w.windDeg !== undefined ? w.windDeg : CFG.windDefault.deg;
  let spd = w && w.windSpd !== null && w.windSpd !== undefined ? w.windSpd : CFG.windDefault.spd;
  if (state.windManual !== null) spd = state.windManual;
  return { spd: spd, deg: deg };
}

function initClouds() {
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

function resizeClouds() {
  clouds.renderer.setSize(window.innerWidth, window.innerHeight, false);
  clouds.camera.aspect = window.innerWidth / window.innerHeight;
  clouds.camera.updateProjectionMatrix();
  clouds.renderer.getDrawingBufferSize(clouds.uniforms.uRes.value);
}
// rainier v2.1.0

const precip = {
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

function initPrecip() {
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

function resizePrecip() {
  precip.renderer.setSize(window.innerWidth, window.innerHeight, false);
  precip.camera.aspect = window.innerWidth / window.innerHeight;
  precip.camera.updateProjectionMatrix();
  precip.renderer.getDrawingBufferSize(precip.uniforms.uRes.value);
}
// rainier v2.1.0

// Living layer: gull flocks in the sky, wind-blown leaves and dust motes in front.
// Birds draw on #rainier-birds (behind the river and the near PNG group, over the
// clouds). Leaves and dust draw on #rainier-wind (in front of everything but the UI).
// Counts follow the same wind, precip, storm and daylight the rest of the scene uses.
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

function initLife() {
  bc = document.getElementById('rainier-birds');
  wc = document.getElementById('rainier-wind');
  if (bc) bg = bc.getContext('2d');
  if (wc) wg = wc.getContext('2d');
  makeFlocks();
}

function resizeLife() {
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

function tickLife() {
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

function stageName(src) {
  return String(src).split('/').pop().replace(/\.[a-z0-9]+$/i, '');
}

function hasStageArt(name) {
  return Object.prototype.hasOwnProperty.call(ART, name);
}

// Draw one layer. Lw is the full canvas width in CSS px, W the visible part of it
// (Lw minus the pan padding on both sides), H the viewport height.
function drawStage(name, cv, Lw, H, W, pad, res) {
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
// rainier v2.1.0

const layers = [];
let lastLight = -1;
const root = document.documentElement;

// Place and size every layer. Full-width layers get pan padding on both sides so
// their edges never show; narrower ones (trees) just pin to their align edge.
function resizeParallax() {
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

function initParallax() {
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

function tickParallax() {
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
// rainier v2.1.0

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

function initScene() {
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

function resizeScene() {
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

function simDate() {
  return new Date(simMs());
}

function hm(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateScene() {
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
// rainier v2.1.0

let slider;
let coverSlider;
let windSlider;
let precipSlider;
let tempSlider;
let fogSlider;
let wxEl;
let lastStat = 0;

function mark(name) {
  const n = new Date();
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  if (state.owm && name === 'Dawn') return Math.round((state.owm.sunrise - mid) / 60000);
  if (state.owm && name === 'Dusk') return Math.round((state.owm.sunset - mid) / 60000);
  if (name === 'Night') return 60;
  let best = -2;
  let rise = 0;
  let set = 0;
  let noon = 720;
  let seen = false;
  for (let m = 0; m < 1440; m += 5) {
    const alt = astro(new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, m)).sun.y;
    if (alt > best) { best = alt; noon = m; }
    if (alt > 0 && !seen) { seen = true; rise = m; }
    if (alt > 0) set = m;
  }
  return { Dawn: rise, Noon: noon, Dusk: set }[name];
}

function readFile(u) {
  return new Promise(function (res) {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', u);
      x.onload = function () { res(x.status === 0 || (x.status >= 200 && x.status < 300) ? x.responseText : ''); };
      x.onerror = function () { res(''); };
      x.send();
    } catch (err) { res(''); }
  });
}

async function loadKey() {
  if (CFG.owmKey.charAt(0) !== '%') {
    state.keySrc = 'inject';
    return true;
  }
  for (let i = 0; i < CFG.keyFiles.length; i++) {
    const m = (await readFile(CFG.keyFiles[i])).match(/[0-9a-f]{32}/i);
    if (m) {
      CFG.owmKey = m[0];
      state.keySrc = 'file';
      try { localStorage.setItem('rainier.key', m[0]); } catch (err) {}
      return true;
    }
  }
  try {
    const k = localStorage.getItem('rainier.key');
    if (k) {
      CFG.owmKey = k;
      state.keySrc = 'cache';
      return true;
    }
  } catch (err) {}
  state.owmStatus = 'nokey';
  return false;
}

async function loadOwm() {
  state.owmStatus = 'loading';
  try {
    const url = 'https://api.openweathermap.org/data/3.0/onecall?lat=' + CFG.lat + '&lon=' + CFG.lon + '&exclude=minutely,alerts&appid=' + CFG.owmKey;
    const r = await (await fetch(url)).json();
    if (!r.daily) {
      state.owmStatus = 'err ' + (r.cod || '') + ' ' + (r.message || 'no data');
      return;
    }
    const d = r.daily[0];
    state.owm = {
      sunrise: d.sunrise * 1000,
      sunset: d.sunset * 1000,
      moonrise: d.moonrise || null,
      moonset: d.moonset || null,
      phase: d.moon_phase,
      clouds: r.current ? r.current.clouds : null,
      windSpd: r.current ? r.current.wind_speed : null,
      windDeg: r.current ? r.current.wind_deg : null,
      icon: r.current && r.current.weather && r.current.weather[0] ? r.current.weather[0].icon : null,
      currentEntry: r.current || null,
      hourly: r.hourly || []
    };
    state.wxVer++;
    state.key = '';
    state.owmStatus = 'ok';
  } catch (err) {
    state.owmStatus = 'err ' + err.message;
  }
}

function syncSlider() {
  const n = new Date(simMs());
  slider.value = n.getHours() * 60 + n.getMinutes();
  if (state.coverManual === null) coverSlider.value = Math.round(effectiveCover() * 100);
  if (state.windManual === null) windSlider.value = Math.round(effectiveWind().spd);
  if (state.precipManual === null) precipSlider.value = Math.round(precipTargets().intensity * 100);
  if (state.fogManual === null) fogSlider.value = Math.round(precipTargets().fog * 100);
  if (state.tempManual === null) {
    const w = wxNow();
    if (w && w.tc !== null && w.tc !== undefined) tempSlider.value = Math.round(w.tc);
  }
  const t = performance.now();
  if (t - lastStat > 500) {
    lastStat = t;
    const w = wxNow();
    const p = precipTargets();
    wxEl.textContent = 'key:' + state.keySrc + ' owm:' + state.owmStatus + (w ? ' ' + (w.icon || '-') + ' ' + (w.mm || 0).toFixed(1) + 'mm' : '') + ' rain:' + p.intensity.toFixed(2) + ' fog:' + p.fog.toFixed(2);
  }
}

function initControls() {
  slider = document.getElementById('rainier-time');
  slider.addEventListener('input', function () { state.minutes = +slider.value; state.offsetMin = 0; });

  coverSlider = document.getElementById('rainier-cover');
  windSlider = document.getElementById('rainier-wind');
  coverSlider.addEventListener('input', function () { state.coverManual = +coverSlider.value / 100; });
  windSlider.addEventListener('input', function () { state.windManual = +windSlider.value; });
  precipSlider = document.getElementById('rainier-precip-amt');
  tempSlider = document.getElementById('rainier-temp');
  fogSlider = document.getElementById('rainier-fog');
  fogSlider.addEventListener('input', function () { state.fogManual = +fogSlider.value / 100; });
  wxEl = document.getElementById('rainier-wx');
  precipSlider.addEventListener('input', function () { state.precipManual = +precipSlider.value / 100; });
  tempSlider.addEventListener('input', function () { state.tempManual = +tempSlider.value; });
  document.getElementById('rainier-zap').addEventListener('click', function () { strike(1); });
  document.querySelector('#rainier-ui button[data-c]').addEventListener('click', function () {
    state.coverManual = null;
    state.windManual = null;
    state.precipManual = null;
    state.tempManual = null;
    state.fogManual = null;
  });

  // one tap sets the whole precipitation spectrum: mist, rain, sleet, snow, hail, fog
  const PRESETS = {
    Clear: { p: 0, fog: 0 },
    Mist: { p: 0.12, t: 9, fog: 0.5, c: 0.7 },
    Rain: { p: 0.55, t: 10, fog: 0.15, c: 0.8 },
    Sleet: { p: 0.5, t: 1.8, fog: 0.15, c: 0.85 },
    Snow: { p: 0.55, t: -4, fog: 0.2, c: 0.85 },
    Hail: { p: 0.7, t: 8, fog: 0, c: 0.95 },
    Fog: { p: 0, fog: 0.95, c: 0.6 }
  };
  document.querySelectorAll('#rainier-ui button[data-p]').forEach(function (b) {
    b.addEventListener('click', function () {
      const q = PRESETS[b.dataset.p];
      if (!q) return;
      state.precipManual = q.p;
      state.fogManual = q.fog;
      if (q.t !== undefined) state.tempManual = q.t;
      if (q.c !== undefined) state.coverManual = q.c;
      if (b.dataset.p === 'Clear') { state.tempManual = null; state.coverManual = null; }
      precipSlider.value = Math.round(q.p * 100);
      fogSlider.value = Math.round(q.fog * 100);
    });
  });

  document.querySelectorAll('#rainier-ui button[data-m]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.minutes = b.dataset.m === 'Now' ? null : mark(b.dataset.m);
      state.offsetMin = 0;
    });
  });

  const pad = document.getElementById('rainier-river');
  let dragX = null;
  let panId = null;
  const active = new Set();
  const ui = document.getElementById('rainier-ui');
  document.getElementById('rainier-ver').textContent = 'v' + CFG.version;
  if (CFG.ui.startHidden) ui.style.display = 'none';
  let lp = null;
  let lpX = 0;
  let lpY = 0;
  function lpClear() {
    if (lp !== null) clearTimeout(lp);
    lp = null;
  }
  pad.addEventListener('pointerdown', function (e) {
    active.add(e.pointerId);
    lpClear();
    if (active.size === 1) {
      lpX = e.clientX;
      lpY = e.clientY;
      lp = setTimeout(function () {
        ui.style.display = ui.style.display === 'none' ? '' : 'none';
        lp = null;
      }, 700);
    }
    if (panId === null) { panId = e.pointerId; dragX = e.clientX; }
  });
  pad.addEventListener('pointermove', function (e) {
    if (lp !== null && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) lpClear();
    if (dragX === null || e.pointerId !== panId) return;
    if (active.size < 2 && !e.shiftKey) { dragX = e.clientX; return; }
    const lim = CFG.panLimit * RAD;
    state.panAz = Math.max(-lim, Math.min(lim, state.panAz - (e.clientX - dragX) * 2 / (SKY_Z * window.innerHeight)));
    dragX = e.clientX;
  });
  function panEnd(e) {
    lpClear();
    active.delete(e.pointerId);
    if (e.pointerId === panId) { panId = null; dragX = null; }
  }
  pad.addEventListener('pointerup', panEnd);
  pad.addEventListener('pointercancel', panEnd);

  loadKey().then(function (ok) { if (ok) loadOwm(); });
}
// rainier v2.1.0

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

function initTimeline() {
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

function tickTimeline() {
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
// rainier v2.1.0

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
