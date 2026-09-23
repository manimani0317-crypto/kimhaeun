/*
  바늘꽂이 3D 모델
  레퍼런스: 바늘꽂이_3D_레퍼런스 폴더 (00~08). 바닥에 놓인 진주핀은 제외했다.

  구성
    몸통  모서리 둥근 사각 돔 — 빨간 체크 벨벳, 핀 꽂힌 자리는 살짝 눌림
    귀    양쪽 달걀형 쿠션 — 검정 부클레, 대각선 누빔 칸 + 빨간 꼬임 파이핑
    바닥  검정 천 판 + 빨간 파이핑
    핀    빨간 유광 구슬핀 4개

  무늬는 이미지 파일 없이 캔버스로 그린다. 곡면에 무늬가 찌그러지지 않도록
  위·앞·옆 세 방향에서 투영해 섞는다(트라이플래너).

  쓰는 법
    import { createPinCushion } from './pinCushion.js';
    scene.add(createPinCushion(THREE));      // 바닥 중심이 원점, 폭 약 4.5
*/

/* ── 공통: 격자 곡면 — 가로(u)는 한 바퀴 이어 붙여 이음선 없이 ── */
function gridSurface(THREE, SU, SV, fn) {
  const pos = [], idx = [];
  for (let j = 0; j <= SV; j++)
    for (let i = 0; i < SU; i++) {
      const p = fn(i / SU, j / SV);
      pos.push(p.x, p.y, p.z);
    }
  for (let j = 0; j < SV; j++)
    for (let i = 0; i < SU; i++) {
      const a = j * SU + i, b = j * SU + (i + 1) % SU;
      const c = a + SU, d = b + SU;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ── 무늬 텍스처 ─────────────────────────────────────────── */
function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}
function seeded(seed) {                                 // 매번 같은 무늬가 나오게
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* 빨간 체크 + 별꽃 — 색과 높낮이(범프) 두 장 */
function plaidTextures(THREE) {
  /* 레퍼런스처럼 또렷한 체크 — 어두운 띠가 가로·세로로 칸의 절반씩 겹쳐
     밝은 칸 / 중간 칸 / 가장 어두운 칸 세 단계가 생긴다. 칸마다 별꽃 자수 */
  const N = 1024, P = 64;                               // 한 장에 체크 16칸
  const star = (g, x, y, r) => {
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, l = k % 2 ? r * .55 : r;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.stroke();
  };
  const stars = g => {
    for (let y = 0; y < N; y += 32) for (let x = 0; x < N; x += 32) star(g, x + 16, y + 16, 7);
  };
  const color = canvas(N, (g) => {
    g.fillStyle = '#8a0d14'; g.fillRect(0, 0, N, N);
    g.fillStyle = 'rgba(40, 0, 5, .5)';                 // 어두운 띠
    for (let k = 0; k < N; k += P) { g.fillRect(k + P / 2, 0, P / 2, N); g.fillRect(0, k + P / 2, N, P / 2); }
    g.fillStyle = 'rgba(255, 90, 90, .1)';              // 띠 경계의 밝은 실
    for (let k = 0; k < N; k += P) { g.fillRect(k + P / 2 - 2, 0, 2, N); g.fillRect(0, k + P / 2 - 2, N, 2); }
    g.strokeStyle = 'rgba(196, 30, 38, .55)'; g.lineWidth = 1.8; g.lineCap = 'round';   // 자수는 은은하게
    stars(g);
    const rnd = seeded(7), img = g.getImageData(0, 0, N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) {            // 벨벳 털의 미세한 얼룩
      const n = (rnd() - .5) * 18;
      d[i] += n; d[i + 1] += n * .25; d[i + 2] += n * .25;
    }
    g.putImageData(img, 0, 0);
  });
  const bump = canvas(N, (g) => {
    g.fillStyle = '#707070'; g.fillRect(0, 0, N, N);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;   // 직물 짜임
    for (let k = 0; k < N; k += 4) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k, N); g.stroke();
      g.beginPath(); g.moveTo(0, k + 2); g.lineTo(N, k + 2); g.stroke();
    }
    g.strokeStyle = '#fff'; g.lineWidth = 2.6; g.lineCap = 'round';
    stars(g);                                           // 자수가 도드라진다
  });
  return wrap(THREE, color, bump, 2);                   // 한 장이 폭 2 → 몸통 가로에 체크 약 16칸
}

/* 검정 부클레 — 동글동글 뭉친 실타래 질감 */
function boucleTextures(THREE) {
  const N = 512, rnd = seeded(31);
  const blobs = [];
  for (let k = 0; k < 2600; k++) blobs.push([rnd() * N, rnd() * N, 3 + rnd() * 5]);
  const paint = (g, dark, light) => {
    g.fillStyle = dark; g.fillRect(0, 0, N, N);
    for (const [x, y, r] of blobs)
      for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {   // 이어 붙여도 끊기지 않게
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, light); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill();
      }
  };
  const color = canvas(N, g => paint(g, '#141313', 'rgba(70, 66, 64, .55)'));
  const bump = canvas(N, g => paint(g, '#303030', 'rgba(255,255,255,.9)'));
  return wrap(THREE, color, bump, .5);
}

/* 바닥 검정 천 — 성긴 평직 */
function linenTextures(THREE) {
  const N = 256;
  const color = canvas(N, g => {
    g.fillStyle = '#121111'; g.fillRect(0, 0, N, N);
    g.fillStyle = 'rgba(80,76,72,.18)';
    for (let k = 0; k < N; k += 4) { g.fillRect(k, 0, 1.4, N); g.fillRect(0, k + 2, N, 1.4); }
  });
  return wrap(THREE, color, color, .4);
}

/* 빨간 꼬임 파이핑 — 사선 줄무늬가 관을 따라 감긴다 */
function cordTexture(THREE) {
  const t = new THREE.CanvasTexture(canvas(64, (g, N) => {
    g.fillStyle = '#a3101a'; g.fillRect(0, 0, N, N);
    g.strokeStyle = '#4a0306'; g.lineWidth = 7;
    for (let k = -N; k < N * 2; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + N, N); g.stroke(); }
    g.strokeStyle = 'rgba(255,120,120,.35)'; g.lineWidth = 3;
    for (let k = -N; k < N * 2; k += 22) { g.beginPath(); g.moveTo(k + 9, 0); g.lineTo(k + 9 + N, N); g.stroke(); }
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function wrap(THREE, colorCanvas, bumpCanvas, scale) {
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bumpCanvas);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, bump, scale };
}

/* ── 트라이플래너 재질 — UV 없이 물체 좌표로 무늬를 입힌다 ─────────
   구 모양 UV는 꼭대기에서 무늬가 한 점으로 오그라드는데,
   메인 화면은 위에서 내려다보는 구도라 그 자리가 가장 잘 보인다. */
function triplanarMaterial(THREE, tex, params) {
  const mat = new THREE.MeshPhysicalMaterial({ ...params, map: tex.map, bumpMap: tex.bump });
  mat.onBeforeCompile = shader => {
    shader.uniforms.triScale = { value: tex.scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position;\nvTriNrm = normal;');
    const tri = `
      varying vec3 vTriPos;
      varying vec3 vTriNrm;
      uniform float triScale;
      vec3 triW() { vec3 w = pow(abs(normalize(vTriNrm)), vec3(4.0)); return w / (w.x + w.y + w.z); }
      vec4 triSample(sampler2D t) {
        vec3 p = vTriPos / triScale, w = triW();
        return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
      }`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + tri)
      .replace('#include <map_fragment>', 'diffuseColor *= triSample(map);')
      /* 범프도 같은 투영으로 — 높이값의 화면 미분으로 굴곡을 만든다 */
      .replace('#include <bumpmap_pars_fragment>', `
        uniform sampler2D bumpMap;
        uniform float bumpScale;
        vec2 dHdxy_fwd() {
          float h = bumpScale * triSample(bumpMap).x;
          return vec2(dFdx(h), dFdy(h));
        }
        vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
          vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
          vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
          vec3 vN = surf_norm;
          vec3 R1 = cross(vSigmaY, vN);
          vec3 R2 = cross(vN, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDirection;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          return normalize(abs(fDet) * surf_norm - vGrad);
        }`);
  };
  return mat;
}

/* ── 몸통 ─────────────────────────────────────────────
   치수는 정면 사진(01)에서 잰 값. 폭의 절반을 1로 둔다.
   옆선은 아래 40% 높이에서 가장 넓고, 위로 좁아지며 넓은 돔으로 덮인다. */
const BODY = { A: 1.0, B: .92, H: 1.46 };

/* 높이(0~1)별 폭 비율 — 정면 사진의 윤곽을 높이마다 잰 것 */
const BODY_PROFILE = [
  [.78, 0], [.84, .015], [.9, .05], [.96, .14], [.99, .28], [1.0, .42],
  [.98, .55], [.94, .66], [.87, .77], [.77, .86], [.6, .94], [.35, .985], [0, 1]
];

/* 옆면 사진(05)에서 잰 윤곽 — 바닥이 가장 넓고 꼭대기까지 한 번에 완만하게 좁아지는 돔.
   정면 윤곽처럼 옆선이 서 있지 않다 */
const BODY_PROFILE_SIDE = [
  [.86, 0], [.93, .03], [.98, .1], [1.0, .2], [.97, .35], [.92, .48],
  [.85, .6], [.74, .73], [.58, .85], [.4, .93], [.2, .98], [0, 1]
];
const PEAK_BACK = .12;                                   // 꼭대기가 가운데보다 뒤로 물러난 거리

/* 위에서 본 모서리 둥근 사각형 — 지수가 클수록 네모에 가깝다 */
function squircle(t) {
  const c = Math.cos(t), s = Math.sin(t), n = 2.3;   // 반측면에서 모서리 없이 둥글게
  const r = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), -1 / n);
  return [c * r, s * r];
}

/* 핀 — 꽂힌 자리(x, z)와 머리 쪽 방향. 윗면(07)·정면(01) 사진에서 잰 값.
   가운데서 바깥으로 벌어지고 뒤로 기운다 */
const PINS = [
  { x: -.44, z: -.54, dir: [-.16, .37, -.28] },
  { x: -.12, z: -.14, dir: [-.09, .32, -.18] },
  { x:  .24, z: -.55, dir: [ .06, .30, -.23] },
  { x:  .45, z: -.13, dir: [ .15, .24, -.19] }
];

function bodyGeometry(THREE) {
  const { A, B, H } = BODY;
  const kFront = profileLookup(THREE, BODY_PROFILE);
  const kSide = profileLookup(THREE, BODY_PROFILE_SIDE);
  const SV = 130;
  return gridSurface(THREE, 220, SV, (u, v) => {
    const j = Math.round(v * SV);
    if (j === 0) return new THREE.Vector3(0, 0, -PEAK_BACK * 0);   // 바닥 가운데
    const s = (j - 1) / (SV - 1);
    const t = (1 - Math.cos(Math.PI * s)) / 2;         // 바닥 모서리와 꼭대기에 점을 촘촘히
    const th = u * Math.PI * 2;
    const [sx, sz] = squircle(th);
    /* 정면 방향(x)은 정면 윤곽, 옆 방향(z)은 옆면 윤곽 — 그 사이는 섞는다 */
    const c2 = Math.cos(th) ** 2, s2 = 1 - c2;
    const k = kFront(t) * c2 + kSide(t) * s2;
    const x = A * sx * k;
    const z = B * sz * k - PEAK_BACK * t * t;          // 위로 갈수록 뒤로 — 앞쪽 비탈이 길고 완만
    let y = t * H;
    if (t > .8) {                                       // 핀 꽂힌 자리 눌림
      for (const pin of PINS) {
        const d2 = (x - pin.x) ** 2 + (z - pin.z) ** 2;
        y -= .035 * Math.exp(-d2 / (.05 * .05));
      }
    }
    return new THREE.Vector3(x, y, z);
  });
}

/* 높이(0~1) → 폭 비율. 윤곽 점들을 부드러운 곡선으로 이은 뒤 높이로 찾아 읽는다 */
function profileLookup(THREE, keys) {
  const pts = new THREE.SplineCurve(keys.map(([k, t]) => new THREE.Vector2(k, t))).getPoints(400);
  return t => {
    let i = 1;
    while (i < pts.length - 1 && pts[i].y < t) i++;
    const a = pts[i - 1], b = pts[i];
    const f = Math.min(Math.max((t - a.y) / ((b.y - a.y) || 1), 0), 1);
    return Math.max(a.x + (b.x - a.x) * f, 0);
  };
}

/* ── 귀 ─────────────────────────────────────────────
   아래가 통통한 달걀. 윗부분이 몸통 쪽으로 기운다.
   누빔은 곧게 뻗은 사선 홈 3줄 → 통통한 칸 4개. 홈 안에는 빨간 스티치만 있고 파이핑은 없다.
   사선 방향은 정면(01)과 옆면(05) 사진에서 계산했다 —
   정면에서는 위쪽 안에서 아래쪽 바깥으로, 옆면에서는 아래 뒤에서 위 앞으로 비스듬하다. */
const EAR = { X: .45, Y: .6, Z: .64, TAPER: .15, TILT: .35 };    // 정면 사진 비율 — 폭 .8, 높이 1.15
const SEAMS = [-.45, 0, .45];                           // 단위구에서 홈 위치 → 칸 4개
const SEAM_STEP = .45;
const GROOVE = .035;                                    // 홈 깊이 — 윤곽은 매끈한 달걀로 남게
/* 홈 평면에 수직인 방향 — 정면(01) 기준.
   평면이 시선 방향(앞뒤)을 품고 있어야 정면에서 휘지 않고 곧은 평행선으로 보인다.
   왼쪽 귀는 오른쪽 위→왼쪽 아래(/), 오른쪽 귀는 대칭(\). 귀가 기울어 있어 실제로는 더 가파르다 */
const earDir = side => new THREE_V(side, .25, 0);             // 앞뒤 성분 없음 → 정면에서 곧은 평행 사선.
                                                        // y 가 작을수록 사선이 선다 — 귀 기울기를 더해 약 65°
const EAR_TURN = 0;                                     // 넓은 면이 바라보는 방향 — 돌리지 않는다

/* THREE 없이 쓰는 작은 벡터 — earDir 을 모듈 위쪽에서 정의하려고 */
function THREE_V(x, y, z) { const l = Math.hypot(x, y, z); this.x = x / l; this.y = y / l; this.z = z / l; }

/* 단위구 위의 점 → 달걀형 귀 표면 (아래가 더 통통) */
function earPoint(THREE, n, k) {
  const p = n.clone().multiplyScalar(k);
  const taper = 1 - EAR.TAPER * p.y;
  return new THREE.Vector3(p.x * EAR.X * taper, p.y * EAR.Y, p.z * EAR.Z * taper);
}

/* 단위구 방향 n 에서의 반지름 — 홈에서 파이고 칸 가운데에서 부푼다 */
function earRadius(n, d) {
  const s = n.x * d.x + n.y * d.y + n.z * d.z;
  const dist = Math.min(...SEAMS.map(c => Math.abs(s - c)));
  const groove = GROOVE * Math.exp(-((dist / .045) ** 2));
  const puff = .014 * Math.sin(Math.PI * s / SEAM_STEP) ** 2;
  return 1 + puff - groove;
}

function earGeometry(THREE, d) {
  const n = new THREE.Vector3();
  return gridSurface(THREE, 180, 100, (u, v) => {
    const th = u * Math.PI * 2, ph = -Math.PI / 2 + v * Math.PI;
    n.set(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th));
    return earPoint(THREE, n, earRadius(n, d));
  });
}

/* 홈 한 줄 — 사선 평면이 귀를 자르는 선을 한 바퀴 따라간다 */
function seamCurve(THREE, d, c) {
  const dv = new THREE.Vector3(d.x, d.y, d.z);
  const u = new THREE.Vector3(0, 0, 1).cross(dv).normalize();
  const w = dv.clone().cross(u).normalize();
  const r = Math.sqrt(1 - c * c), pts = [];
  for (let k = 0; k < 160; k++) {
    const a = k / 160 * Math.PI * 2;
    const n = dv.clone().multiplyScalar(c)
      .addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r).normalize();
    pts.push(earPoint(THREE, n, earRadius(n, d) + .006));
  }
  return new THREE.CatmullRomCurve3(pts, true);
}

/* 바느질 땀 — 곡선을 따라 짧은 실땀을 박는다 (홈질: 한 줄).
   땀 수백 개를 인스턴스 한 번으로 그려서 무게는 한 개 그리는 것과 비슷하다 */
function stitchDashes(THREE, curve, mat, { gap = .042, len = .026, lift = .006, slant = .5, center = null } = {}) {
  const count = Math.floor(curve.getLength() / gap);
  const dash = new THREE.CapsuleGeometry(.0075, len, 2, 6);
  const mesh = new THREE.InstancedMesh(dash, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count;
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const out = center ? p.clone().sub(center).normalize() : new THREE.Vector3(0, -1, 0);
    q.setFromUnitVectors(up, tan);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(out, slant));   // 땀이 홈을 비스듬히 가로지른다
    m.compose(p.clone().addScaledVector(out, lift), q, one);
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}

function createEar(THREE, side, mats) {
  const d = earDir(side);
  /* 회전 두 개를 한 그룹에 주면 오일러 순서 때문에 꼬인다 — 그룹을 나눈다 */
  const face = new THREE.Group();                       // 넓은 면을 바깥 앞쪽으로
  face.rotation.y = -side * EAR_TURN;
  face.add(new THREE.Mesh(earGeometry(THREE, d), mats.boucle));
  const origin = new THREE.Vector3();
  for (const c of SEAMS)
    face.add(stitchDashes(THREE, seamCurve(THREE, d, c), mats.stitch, { center: origin }));
  const g = new THREE.Group();                          // 기울기와 자리
  g.add(face);
  g.position.set(side * 1.15, .74, 0);                  // 정면 사진에서 잰 귀 중심 — 몸통 옆에 붙는다
  g.rotation.z = side * EAR.TILT;                       // 윗부분이 몸통 쪽으로
  return g;
}

/* ── 바닥 판 + 테두리 파이핑 ───────────────────────────── */
function createBase(THREE, mats) {
  const S = .95, pts = [];                             // 바닥 윤곽보다 살짝 안쪽 — 몸통 밑으로 숨는다
  for (let k = 0; k < 160; k++) {
    const [x, z] = squircle(k / 160 * Math.PI * 2);
    pts.push(new THREE.Vector3(x * BODY.A * BODY_PROFILE[0][0] * S, .012, z * BODY.B * BODY_PROFILE_SIDE[0][0] * S));
  }
  /* 아래를 보는 판 — +90° 로 눕히면 도형의 y 가 +z 로 가고 면은 아래(-Y)를 본다 */
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.z)));
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1).rotateX(Math.PI / 2), mats.linen);
  panel.position.y = -.004;                              // 몸통 바닥면과 겹쳐 깜빡이지 않게 살짝 아래
  const cord = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, .014, 8, true), mats.piping);   // 바닥 테두리는 검정
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const g = new THREE.Group();
  g.add(panel, cord, stitchDashes(THREE, curve, mats.stitch, { side: .036, lift: .004 }));
  return g;
}

/* ── 핀 ─────────────────────────────────────────────── */
function createPins(THREE, bodyMesh, mats) {
  const g = new THREE.Group();
  const ray = new THREE.Raycaster();
  const headGeo = new THREE.SphereGeometry(.078, 32, 20);
  const shaftGeo = new THREE.CylinderGeometry(.011, .011, 1, 10);
  bodyMesh.updateMatrixWorld(true);
  for (const p of PINS) {
    ray.set(new THREE.Vector3(p.x, 5, p.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(bodyMesh)[0];
    if (!hit) continue;
    const dir = new THREE.Vector3(...p.dir);
    const len = dir.length();
    dir.normalize();
    const start = hit.point.clone().addScaledVector(dir, -.1);   // 끝이 천 속에 묻힌다
    const end = hit.point.clone().addScaledVector(dir, len);
    const shaft = new THREE.Mesh(shaftGeo, mats.steel);
    shaft.position.copy(start).lerp(end, .5);
    shaft.scale.y = start.distanceTo(end);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const head = new THREE.Mesh(headGeo, mats.pinHead);
    head.position.copy(end).addScaledVector(dir, .06);
    g.add(shaft, head);
  }
  return g;
}

/* ── 조립 ─────────────────────────────────────────────── */
export function createPinCushion(THREE) {
  const mats = {
    velvet: triplanarMaterial(THREE, plaidTextures(THREE), {
      color: 0xffffff, roughness: .82, metalness: 0,
      sheen: .6, sheenColor: new THREE.Color(0xd83038), sheenRoughness: .45, bumpScale: .5   // 크면 위에서 볼 때 물결무늬가 생긴다
    }),
    boucle: triplanarMaterial(THREE, boucleTextures(THREE), {
      color: 0xffffff, roughness: .95, metalness: 0,
      sheen: .5, sheenColor: new THREE.Color(0x6a6464), sheenRoughness: .8, bumpScale: 2.6
    }),
    linen: new THREE.MeshStandardMaterial({ map: linenTextures(THREE).map, roughness: 1 }),
    cord: new THREE.MeshStandardMaterial({ map: cordTexture(THREE), roughness: .6 }),
    piping: new THREE.MeshStandardMaterial({ color: 0x141213, roughness: .8 }),
    stitch: new THREE.MeshStandardMaterial({ color: 0xb8161f, roughness: .5 }),   // 땀 실 — 파이핑보다 밝은 빨강
    steel: new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 1, roughness: .18 }),
    pinHead: new THREE.MeshPhysicalMaterial({
      color: 0x7d0a0f, roughness: .18, clearcoat: 1, clearcoatRoughness: .04
    })
  };
  mats.cord.map.repeat.set(70, 1);
  mats.linen.map.wrapS = mats.linen.map.wrapT = THREE.RepeatWrapping;
  mats.linen.map.repeat.set(6, 6);

  const root = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry(THREE), mats.velvet);
  root.add(body);
  root.add(createEar(THREE, -1, mats), createEar(THREE, 1, mats));
  root.add(createBase(THREE, mats));
  root.add(createPins(THREE, body, mats));
  return root;
}
