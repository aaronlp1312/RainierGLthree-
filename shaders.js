// rainier v2.1.0
export const VERTEX = `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

export const RIVER_FRAG = `
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

export const SKY_FRAG = `
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

export const SUN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SUN_FRAG = `
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

export const CLOUD_FRAG = `
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

export const PRECIP_FRAG = `
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
