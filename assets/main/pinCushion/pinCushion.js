/*
  바늘꽂이 3D 모델
  레퍼런스: 바늘꽂이_3D_레퍼런스 폴더 (00~09). 바닥에 크림 진주핀 하나 — 머리는 캐릭터 코 모양 타원.

  구성
    몸통  모서리 둥근 사각 돔 — 빨간 체크 벨벳, 핀 꽂힌 자리는 살짝 눌림
    귀    양쪽 달걀형 쿠션 — 검정 부클레, 대각선 누빔 칸 + 빨간 꼬임 파이핑
    바닥  검정 천 판 + 빨간 파이핑
    핀    빨간 유광 구슬핀 4개

  무늬는 이미지 파일 없이 캔버스로 그린다. 곡면에 무늬가 찌그러지지 않도록
  위·앞·옆 세 방향에서 투영해 섞는다(트라이플래너).

  쓰는 법 — 실패(threadSpool)와 같은 모양이라 메인 장면에 그대로 꽂힌다
    import { createPinCushion } from './pinCushion.js';
    const pc = createPinCushion(THREE);
    scene.add(pc.root);                       // 바닥 중심이 원점, 폭 약 4.5
    pc.setHover(true);                        // 진주핀이 들리고 머리에 물결이 번진다
    pc.activate(() => location.href = '...'); // 클릭 — 코 자리에 꽂힌 뒤 페이지로
    pc.update(dt);                            // 매 프레임. 움직임이 남아 있으면 true
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

/* 빨간 모직 체크 + 별꽃 자수 — 색과 높낮이(범프) 두 장.

   두 가지를 고쳤다.
   1) **밝은 건 별꽃 자수뿐이다.** 격자 띠는 바탕보다 어둡다.
      전에는 반대로(밝은 격자선 + 묻힌 별꽃) 그려서 천이 아니라 형광 모눈종이로 보였다.
   2) 띠마다 진하기와 두께를 조금씩 흔든다. 전부 똑같으면 규칙적이라 가짜로 보인다. */
function plaidTextures(THREE) {
  const N = 1024, P = 64, BAND = 13;                    // 한 장에 체크 16칸, 띠 폭 13px
  const star = (g, x, y, r) => {
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, l = k % 2 ? r * .5 : r;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.stroke();
  };
  const stars = g => {                                  // 별꽃은 칸 한가운데
    for (let y = 0; y < N; y += P) for (let x = 0; x < N; x += P) star(g, x + P / 2, y + P / 2, P * .34);
  };
  /* 색과 범프가 같은 씨앗을 써야 두 장의 띠가 어긋나지 않는다 */
  const jitter = () => {
    const r = seeded(97), a = [];
    for (let k = 0; k < N / P; k++) a.push([.62 + r() * .76, .8 + r() * .5]);   // [진하기, 두께] 배수
    return a;
  };
  const color = canvas(N, (g) => {
    g.fillStyle = '#650d13'; g.fillRect(0, 0, N, N);
    const jx = jitter(), jy = jitter();
    for (let k = 0; k < N / P; k++) {                   // 어두운 띠. 겹치는 자리가 가장 어두운 칸이 된다
      const [av, wv] = jx[k], [ah, wh] = jy[k];
      g.fillStyle = `rgba(30,3,6,${.34 * av})`; g.fillRect(k * P - BAND * wv / 2, 0, BAND * wv, N);
      g.fillStyle = `rgba(30,3,6,${.34 * ah})`; g.fillRect(0, k * P - BAND * wh / 2, N, BAND * wh);
    }
    g.fillStyle = 'rgba(150,26,32,.16)';                // 띠 사이를 지나는 밝은 실 한 올 — 아주 약하게
    for (let k = 0; k < N; k += P) { g.fillRect(k + P / 2 - 1, 0, 2, N); g.fillRect(0, k + P / 2 - 1, N, 2); }
    g.strokeStyle = 'rgba(202,42,46,.8)'; g.lineWidth = 2.4; g.lineCap = 'round';   // 이 천에서 제일 도드라진다
    stars(g);
    const rnd = seeded(11), img = g.getImageData(0, 0, N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) {            // 올 하나하나의 얼룩
      const n = (rnd() - .5) * 16;
      d[i] += n; d[i + 1] += n * .3; d[i + 2] += n * .3;
    }
    g.putImageData(img, 0, 0);
  });
  const bump = canvas(N, (g) => {
    g.fillStyle = '#6b6b6b'; g.fillRect(0, 0, N, N);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;      // 씨실·날실
    for (let k = 0; k < N; k += 5) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k, N); g.stroke();
      g.beginPath(); g.moveTo(0, k + 2.5); g.lineTo(N, k + 2.5); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.14)';                    // 띠가 살짝 파였다 — 색과 같은 두께로
    const jx = jitter(), jy = jitter();
    for (let k = 0; k < N / P; k++) {
      g.fillRect(k * P - BAND * jx[k][1] / 2, 0, BAND * jx[k][1], N);
      g.fillRect(0, k * P - BAND * jy[k][1] / 2, N, BAND * jy[k][1]);
    }
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round';
    stars(g);                                           // 자수가 도드라진다
  });
  return wrap(THREE, color, bump, 1.8);                 // 한 장이 폭 1.8 → 몸통 가로에 체크 약 12칸
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

   전에는 정면 윤곽과 옆면 윤곽을 따로 재서 방향마다 섞었는데,
   한 곳을 고치면 다른 곳이 틀어졌다. 다시 재 보니 두 윤곽은 같은 곡선이고
   옆면이 폭만 B 배로 좁을 뿐이었다 — 그래서 윤곽을 하나만 쓴다. */
/* 조절판에서 바꿔 볼 수 있게 내보낸다.
     B  앞뒤 폭 비율      H  높이      N  위에서 본 모서리(클수록 네모)
     BR 바닥 폭 — 작을수록 아래가 안으로 동그랗게 오므라든다
     BH 아래 둥근 부분이 올라오는 높이(몸통 높이 대비) — 클수록 둥글게 말리는 구간이 길다
     BS 아래 둥근 정도 — 1 곧은 사선, 2 완만, 3 이상 동그랗게 */
export const BODY = { A: 1, B: .915, H: 1.455, N: 2, BR: .735, BH: .3, BS: 1.33 };

/* 높이(0~1)별 폭 비율 — 정면 사진의 윤곽을 높이마다 잰 것.
   바닥 바로 위가 가장 넓고, 절반까지 거의 곧게 서 있다가 위에서 둥글게 넘어가는 종 모양 돔이다.
   가운데가 가장 넓으면 둥근 정육면체처럼 보인다 */
const BODY_PROFILE = [
  [.90, 0], [.965, .05], [.99, .10], [1.0, .20], [.995, .30], [.975, .40],
  [.95, .50], [.905, .60], [.83, .70], [.72, .80], [.60, .87],
  [.44, .93], [.25, .975], [0, 1]
];
const PEAK_BACK = .06;                                   // 꼭대기가 가운데보다 뒤로 물러난 거리

/* 실제로 쓰는 윤곽 — 잰 윤곽에 아래쪽만 오므림을 곱한다. 높이 t(0~1) → 폭 비율.

   전에는 아래를 1/4 타원으로 따로 그려 붙였는데 두 가지가 불룩해 보였다.
   - 타원은 바닥에서 폭이 급하게 튀어나온다
   - BH 에서 폭이 1 에 닿은 뒤 위쪽 윤곽과 만나는 자리에 혹이 생긴다
   그래서 윤곽은 그대로 두고, 바닥(0)에서 BR 까지 줄였던 폭이 BH 에서 원래대로
   돌아오도록 부드럽게 곱한다. 이음매가 없고, BS 로 둥근 정도를 고른다.
     BS 1 = 곧은 사선(모따기)  2 = 완만  3 이상 = 동그랗게 */
function bodyProfile(THREE) {
  const measured = profileLookup(THREE, BODY_PROFILE);
  const { BR, BH, BS } = BODY, r = BR / measured(0);
  return t => {
    const k = measured(t);
    if (t >= BH) return k;
    const ease = 1 - (1 - t / BH) ** BS;                 // 0 → 1, BH 에서 기울기 0 이라 이음매가 없다
    return k * (r + (1 - r) * ease);
  };
}

/* 위에서 본 모서리 둥근 사각형 — 지수가 클수록 네모에 가깝다 */
function squircle(t) {
  const c = Math.cos(t), s = Math.sin(t), n = BODY.N;   // 윗면 사진(07)에서 잰 값은 2.7
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
  const kAt = bodyProfile(THREE);
  const SV = 130;
  return gridSurface(THREE, 220, SV, (u, v) => {
    const j = Math.round(v * SV);
    if (j === 0) return new THREE.Vector3(0, 0, -PEAK_BACK * 0);   // 바닥 가운데
    const s = (j - 1) / (SV - 1);
    const t = (1 - Math.cos(Math.PI * s)) / 2;         // 바닥 모서리와 꼭대기에 점을 촘촘히
    const th = u * Math.PI * 2;
    const [sx, sz] = squircle(th);
    const k = kAt(t);                                  // 윤곽은 하나. 앞뒤는 폭만 B 배로 좁다
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
/* 앞뒤(Z)를 줄이는 게 핵심이다. 크면 옆에서 볼 때 살이 스티치 줄 바깥으로 넘쳐
   누빔 칸이 아니라 그냥 검은 덩어리로 보인다 — 윤곽이 바깥 스티치에 가깝게 붙어야 한다 */
/* 확인 페이지의 조절판(E 키)에서 바로 바꿔 볼 수 있게 내보낸다.
     X  정면 좌우 폭      Y  정면 높이      Z  옆면 두께 (정면 모양과 무관)
     TAPER  위쪽이 좁아지는 정도      TILT  몸통 쪽으로 기운 각(rad)
     PX, PY  귀 중심 자리 — 몸통 옆에 붙는다
     SLANT  스티치 줄 기울기(rad) — 0 이면 줄이 곧게 서고, 클수록 눕는다
     LINES  스티치 줄 수      GAP  줄 사이 간격 — 줄들은 귀 가운데를 기준으로 고르게 놓인다 */
export const EAR = { X: .365, Y: .63, Z: .4, TAPER: .175, TILT: .46, PX: .905, PY: .81, SLANT: -.99, LINES: 4, GAP: .41 };

/* 홈 위치 — 단위구에서 n·d 값. 줄 수와 간격으로 가운데 정렬해 만든다 */
const seams = () => {
  const n = Math.max(1, Math.round(EAR.LINES)), out = [];
  for (let i = 0; i < n; i++) out.push((i - (n - 1) / 2) * EAR.GAP);
  return out.filter(c => Math.abs(c) < .95);            // 귀 밖으로 나가는 줄은 뺀다
};
const GROOVE = .035;                                    // 홈 깊이 — 윤곽은 매끈한 달걀로 남게
/* 홈 평면에 수직인 방향 — 정면(01) 기준.
   평면이 시선 방향(앞뒤)을 품고 있어야 정면에서 휘지 않고 곧은 평행선으로 보인다.
   왼쪽 귀는 오른쪽 위→왼쪽 아래(/), 오른쪽 귀는 대칭(\). 귀가 기울어 있어 실제로는 더 가파르다 */
const earDir = side =>                                  // 앞뒤 성분 없음 → 정면에서 곧은 평행 사선.
  new THREE_V(side * Math.cos(EAR.SLANT), Math.sin(EAR.SLANT), 0);   // SLANT 가 작을수록 사선이 선다
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
  const list = seams();
  const dist = Math.min(...list.map(c => Math.abs(s - c)));
  const groove = GROOVE * Math.exp(-((dist / .045) ** 2));
  const puff = .014 * Math.sin(Math.PI * (s - list[0]) / EAR.GAP) ** 2;   // 줄 사이가 불룩 — 줄 자리에서 0
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
  for (const c of seams())
    face.add(stitchDashes(THREE, seamCurve(THREE, d, c), mats.stitch, { center: origin }));
  const g = new THREE.Group();                          // 기울기와 자리
  g.add(face);
  g.position.set(side * EAR.PX, EAR.PY, 0);             // 귀 중심 — 몸통 옆에 붙는다
  g.rotation.z = side * EAR.TILT;                       // 윗부분이 몸통 쪽으로
  return g;
}

/* ── 바닥 판 + 테두리 파이핑 ───────────────────────────── */
function createBase(THREE, mats) {
  const S = .95, pts = [];                             // 바닥 윤곽보다 살짝 안쪽 — 몸통 밑으로 숨는다
  for (let k = 0; k < 160; k++) {
    const [x, z] = squircle(k / 160 * Math.PI * 2);
    pts.push(new THREE.Vector3(x * BODY.A * BODY.BR * S, .012, z * BODY.B * BODY.BR * S));   // 바닥 폭을 따라간다
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

/* ── 바닥의 크림 진주핀 ─────────────────────────────────
   머리는 왈가왈BOT 코 모양 — 가로로 긴 타원(젤리빈). 몸통 앞 왼쪽에 머리를 두고
   바늘 끝이 오른쪽 앞으로 가게 바닥에 눕힌다 (refFront01 의 자리).
   클릭하면 날아가 몸통 정면에 캐릭터 코처럼 꽂힌다.
   조절판에서 바꿔 볼 수 있게 내보낸다.
     PX, PZ  머리 자리 (좌우, 앞뒤)      ANGLE  바늘이 향하는 방향(rad, 0 = 오른쪽, + 는 앞쪽으로)
     LEN  바늘 길이      HL 머리 — 바늘 방향 반지름      HW 머리 — 옆 반지름(가로로 긴 쪽)      HH 머리 — 높이 반지름
     NY  클릭하면 꽂히는 코 자리의 높이 */
export const PEARL = { PX: -1.42, PZ: .95, ANGLE: .27, LEN: 1.1, HL: .085, HW: .14, HH: .079, NY: .62 };

/* 호버·클릭 움직임 — 숫자만 바꾸면 느낌이 바뀐다 */
const MOTION = {
  LIFT: [.06, .2, -.04],     // 호버 때 들리는 방향 — 위로, 몸통 쪽으로 살짝
  LIFT_TILT: .12,            // 들릴 때 머리 쪽이 더 들린다(rad)
  RIPPLE_T: 1.3,             // 물결 고리 한 번이 번지는 시간(초)
  FLY_T: .75,                // 코 앞까지 날아가는 시간
  STAB_T: .22,               // 마지막에 꽂히는 시간
  HOLD_T: .35,               // 꽂힌 뒤 페이지로 넘어가기 전 멈춤
  /* 바늘꽂이 몸통의 '띠용' — 덜 멈추는 스프링이라 몇 번 통통 튀다 가라앉는다 */
  BOING_STIFF: 260,          // 클수록 빨리 튄다
  BOING_DAMP: 7,             // 작을수록 오래 출렁인다
  BOING_KICK: 2.4,           // 호버에 들어올 때 튕기는 세기 (나갈 때는 절반)
  STAB_KICK: -1.8,           // 진주핀이 꽂히는 순간 움찔 — 음수라 눌렸다 튀어 오른다
  SQUASH: .55                // 튈 때 키가 늘어나는 비율 (옆으로는 절반만큼 줄어 부피가 유지돼 보인다)
};

/* 물결 고리 — 가운데가 비고 테두리만 부드럽게 빛나는 원 */
function rippleTexture(THREE) {
  const t = new THREE.CanvasTexture(canvas(128, (g, N) => {
    const r = N / 2, gr = g.createRadialGradient(r, r, r * .5, r, r, r * .98);
    gr.addColorStop(0, 'rgba(255,236,196,0)');
    gr.addColorStop(.6, 'rgba(255,236,196,.95)');
    gr.addColorStop(1, 'rgba(255,236,196,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 핀 한 자루 — 머리 중심이 원점, 바늘은 +x 로 뻗는다. 자세는 바깥에서 준다 */
function createPearlPin(THREE, mats) {
  const { LEN, HL, HW, HH } = PEARL;
  const pin = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mats.pearl);
  head.scale.set(HL, HH, HW);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .025, 16).rotateZ(Math.PI / 2), mats.steel);
  collar.position.x = HL * .95;                         // 머리와 바늘 사이 작은 고리
  const TIP = .09, shaftLen = LEN - HL - TIP;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, shaftLen, 12).rotateZ(Math.PI / 2), mats.steel);
  shaft.position.x = HL + shaftLen / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.011, TIP, 12).rotateZ(-Math.PI / 2), mats.steel);
  tip.position.x = HL + shaftLen + TIP / 2;             // 끝으로 갈수록 뾰족하게
  pin.add(head, collar, shaft, tip);

  /* 물결 고리 두 장 — 반 박자씩 어긋나 끊기지 않고 번진다. 스프라이트라 늘 카메라를 본다 */
  pin.userData.ripples = [0, .5].map(offset => {
    const s = new THREE.Sprite(mats.ripple.clone());
    s.userData.offset = offset;
    s.renderOrder = 2;
    pin.add(s);
    return s;
  });
  return pin;
}

/* 바닥에 누운 자세 — 머리가 바닥에 닿고, 바늘 끝도 바닥에 닿도록 살짝 숙인다 */
function restPose(THREE) {
  const tilt = Math.atan2(PEARL.HH - .011, PEARL.LEN);
  return {
    pos: new THREE.Vector3(PEARL.PX, PEARL.HH, PEARL.PZ),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -PEARL.ANGLE, -tilt, 'YXZ'))
  };
}

/* 코 자리 — 몸통 정면에 광선을 쏴서 맞은 자리. 바늘은 몸통 속으로, 머리의 긴 쪽은 가로로 */
function nosePose(THREE, body) {
  const ray = new THREE.Raycaster(new THREE.Vector3(0, PEARL.NY, 5), new THREE.Vector3(0, 0, -1));
  body.updateMatrixWorld(true);
  const hit = ray.intersectObject(body)[0];
  const point = hit ? hit.point : new THREE.Vector3(0, PEARL.NY, BODY.B);
  const n = hit ? hit.face.normal.clone().transformDirection(body.matrixWorld) : new THREE.Vector3(0, 0, 1);
  const x = n.clone().negate();                          // 바늘 → 몸통 속
  const z = new THREE.Vector3().crossVectors(x, new THREE.Vector3(0, 1, 0)).normalize();   // 머리 긴 쪽 → 가로
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return {
    pos: point.clone().addScaledVector(n, PEARL.HL * .8),   // 머리가 천에 살짝 묻힌다
    quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)),
    normal: n
  };
}

/* ── 움직임 도구 ── */
function spring(value, stiffness, damping) { return { value, target: value, v: 0, stiffness, damping }; }
function stepSpring(s, dt) {
  const a = s.stiffness * (s.target - s.value) - s.damping * s.v;
  s.v += a * dt; s.value += s.v * dt;
}
const settled = s => Math.abs(s.target - s.value) < 1e-4 && Math.abs(s.v) < 1e-4;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const clamp01 = t => Math.min(1, Math.max(0, t));

/* ── 조립 + 인터랙션 ─────────────────────────────────────
   메인 장면(mainScene.attach)이 찾는 모양 그대로 돌려준다 — 실패(threadSpool)와 같은 규칙.
     root          장면에 넣을 뿌리
     hitTarget     호버 판정 대상
     setHover(on)  호버 켜고 끄기 — 진주핀이 들리고 머리에 물결이 번진다
     update(dt)    매 프레임. 움직임이 남아 있으면 true
     activate(fn)  클릭 — 진주핀이 코 자리에 꽂힌 뒤 fn() 을 부른다 (페이지 이동은 fn 에서)
     reset()       진주핀을 바닥으로 되돌린다
     rebuild()     EAR·BODY·PEARL 값을 바꾼 뒤 모양만 다시 만든다 (조절판용) */
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
    pinHead: new THREE.MeshPhysicalMaterial({           // 스티치(0xb8161f)보다 조금 짙고 맑은 빨강.
      color: 0xa2081a, roughness: .12, clearcoat: 1, clearcoatRoughness: .03   // 0x7d0a0f 는 빛바래 탁해 보였다
    }),
    pearl: new THREE.MeshPhysicalMaterial({             // 노란 기가 도는 크림 진주 — 은은한 무지갯빛 광
      color: 0xefd49e, roughness: .28, clearcoat: 1, clearcoatRoughness: .08,
      iridescence: .3, iridescenceIOR: 1.4, sheen: .4, sheenColor: new THREE.Color(0xffe9c2),
      emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 0   // 호버 때 숨 쉬듯 빛난다
    }),
    ripple: new THREE.SpriteMaterial({ map: rippleTexture(THREE), transparent: true, depthWrite: false, opacity: 0 })
  };
  mats.cord.map.repeat.set(70, 1);
  mats.linen.map.wrapS = mats.linen.map.wrapT = THREE.RepeatWrapping;
  mats.linen.map.repeat.set(6, 6);

  /* 모양만 다시 만든다 — 재질·무늬 텍스처는 그대로 둔다(다시 그리면 느리다) */
  const root = new THREE.Group();
  const cushion = new THREE.Group();                    // 통통 튀는 쪽 — 몸통·귀·밑단·꽂힌 핀. 바닥(y=0)이 원점이라 바닥을 딛고 튄다
  root.add(cushion);
  let parts = [], pearl = null, rest = null, nose = null;
  const build = () => {
    for (const p of parts) {
      p.parent.remove(p);
      p.traverse(o => { o.geometry && o.geometry.dispose(); o.isSprite && o.material.dispose(); });
    }
    const body = new THREE.Mesh(bodyGeometry(THREE), mats.velvet);
    pearl = createPearlPin(THREE, mats);          // 진주핀은 따로 움직이므로 튀는 무리에 넣지 않는다
    const bouncy = [
      body,
      createEar(THREE, -1, mats), createEar(THREE, 1, mats),
      createBase(THREE, mats),
      createPins(THREE, body, mats)            // 핀은 몸통 표면에 꽂으므로 몸통과 함께 다시 만든다
    ];
    cushion.add(...bouncy);
    root.add(pearl);
    parts = [...bouncy, pearl];
    rest = restPose(THREE);
    nose = nosePose(THREE, body);
    apply();
  };

  /* 상태 */
  const hover = spring(0, 120, 14);
  const boing = spring(0, MOTION.BOING_STIFF, MOTION.BOING_DAMP);
  let time = 0;
  let fly = null;            // 클릭 뒤 { t, from:{pos,quat}, done:fn, called }
  const tmpQ = new THREE.Quaternion(), liftQ = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), ctrl = new THREE.Vector3(), approach = new THREE.Vector3();

  /* 바닥 ↔ 들린 자세 */
  function hoverPose(h, outPos, outQuat) {
    outPos.copy(rest.pos).add(v0.set(...MOTION.LIFT).multiplyScalar(h));
    liftQ.setFromAxisAngle(zAxis, -MOTION.LIFT_TILT * h);   // 바늘 쪽이 내려가 머리가 들린다
    outQuat.copy(rest.quat).multiply(liftQ);
  }

  function apply() {
    if (!pearl) return;
    const h = hover.value;

    /* 띠용 — 키가 늘면 옆은 줄어든다 */
    const w = boing.value * MOTION.SQUASH;
    cushion.scale.set(1 - w * .5, 1 + w, 1 - w * .5);

    if (!fly) {
      hoverPose(h, pearl.position, pearl.quaternion);
    } else {
      /* 날아가기 — 위로 둥글게 떠서 코 앞까지 간 뒤, 몸통 속으로 콕 꽂힌다 */
      const T = MOTION.FLY_T, S = MOTION.STAB_T;
      approach.copy(nose.pos).addScaledVector(nose.normal, .45);
      if (fly.t < T) {
        const e = easeInOut(clamp01(fly.t / T));
        ctrl.copy(fly.from.pos).lerp(approach, .5).add(v1.set(0, .9, .35));
        const a = 1 - e;                                   // 2차 베지어
        pearl.position.set(0, 0, 0)
          .addScaledVector(fly.from.pos, a * a).addScaledVector(ctrl, 2 * a * e).addScaledVector(approach, e * e);
        pearl.quaternion.copy(fly.from.quat).slerp(nose.quat, e);
      } else {
        const u = clamp01((fly.t - T) / S);
        pearl.position.copy(approach).lerp(nose.pos, u * u);   // 끝으로 갈수록 빨라진다
        pearl.quaternion.copy(nose.quat);
      }
    }

    /* 눌러도 된다는 신호 — 물결 고리가 번지고 머리가 숨 쉬듯 빛난다. 날아가기 시작하면 사라진다 */
    const show = fly ? Math.max(0, 1 - fly.t / .2) : h;
    const size = PEARL.HW * 2;
    for (const s of pearl.userData.ripples) {
      const p = (time / MOTION.RIPPLE_T + s.userData.offset) % 1;
      s.scale.setScalar(size * (1.2 + p * 2));
      s.material.opacity = (1 - p) ** 1.5 * .8 * show;
    }
    mats.pearl.emissiveIntensity = show * (.12 + .1 * Math.sin(time * 5));
  }

  build();

  return {
    root,
    hitTarget: root,
    setHover(on) {
      if (fly) return;
      const next = on ? 1 : 0;
      if (next !== hover.target) boing.v += MOTION.BOING_KICK * (on ? 1 : .5);   // 들어올 때 크게, 나갈 때 작게 튄다
      hover.target = next;
    },
    update(dt) {
      time += dt;
      stepSpring(hover, dt);
      stepSpring(boing, dt);
      if (fly) {
        const end = MOTION.FLY_T + MOTION.STAB_T;
        if (fly.t < end && fly.t + dt >= end) boing.v += MOTION.STAB_KICK;   // 꽂히는 순간 움찔
        fly.t += dt;
        if (fly.t >= end + MOTION.HOLD_T && !fly.called) { fly.called = true; fly.done?.(); }
      }
      apply();
      /* 호버 중에는 물결이 계속 번지므로 멈추지 않는다 */
      return hover.value > 1e-3 || !settled(hover) || !settled(boing) || (fly && !fly.called);
    },
    activate(done) {
      if (fly) return;
      fly = { t: 0, from: { pos: pearl.position.clone(), quat: pearl.quaternion.clone() }, done, called: false };
      hover.target = 0;
    },
    reset() {
      fly = null;
      for (const s of [hover, boing]) { s.target = 0; s.value = 0; s.v = 0; }
      apply();
    },
    rebuild: build
  };
}
