/* ── 남산타워 줄자 (N서울타워) — 세워 두는 자동 줄자 (1 = 1mm) ──────────────
   레퍼런스: 버건디 광택 케이스(왼쪽은 둥근 원, 오른쪽은 각진 D자) + 은색 테두리 + 검정 홈 고무 띠.
   앞면엔 크림색 0~100% 게이지 눈금판과 되감기 버튼. 오른쪽 앞엔 비스듬히 기댄 남산타워,
   줄자 끝(고리)은 곰돌이 — 평소엔 출구 위에서 타워를 끌어안고 있다.
   호버하면 크림색 띠가 윗면 출구에서 비틀리며 올라오고 곰돌이가 끝에 앉아 같이 올라간다.

   const tape = createTapeTower(THREE, scene, { x, z, size, turn });
   → { root, hitTarget, setHover(on), setProgress(p), update(dt), rebuild() }
   원점은 케이스 바닥, 눈금판 중심 바로 아래. 앞면이 +z, 세워 둔다.
   가운데는 자동 줄자의 되감기 버튼(위쪽 화살표), 눈금판은 0~100% 게이지 — setProgress(p) 로 스크롤 비율을 넘긴다. */

export const TOWER = {
  /* 케이스 */
  R: 34,           // 둥근 쪽 반지름 (= 눈금판 중심 높이)
  RIGHT: 34,       // 오른쪽 각진 쪽 끝 x
  TOP: 60,         // 오른쪽 윗변 높이 (줄자 출구)
  DIAL: 24,        // 눈금판 반지름
  /* 띠 */
  SLOT_X: 30.5,    // 띠가 나오는 x
  TAPE_W: 8,       // 띠 폭
  TAPE_Z: -2.2,    // 띠가 나오는 앞뒤 자리 — 검정 옆면(고무 띠) 한가운데
  SLOT_UP: 2.9,    // 출구 구멍이 윗변(TOP)보다 올라온 높이 — 검정 고무 띠 윗면
  TWIST: 30,       // 출구에서 이만큼 올라가는 동안 띠가 90° 비틀려 눈금이 앞을 본다
  EXT: 185,        // 다 풀렸을 때 올라오는 길이
  UNIT: 8.5,       // 띠 눈금 한 칸 (숫자 1)
  /* 타워 */
  /* 타워 자리·모양은 TOWER_SHAPE (타워 부분) */
  /* 색 */
  RED: 0x7a0811, CREAM: 0xefd9a8, SILVER: 0xd4d6d9, BLACK: 0x1c1a1a, INK: 0x9a1420,   // 빨강은 실·바늘꽂이처럼 짙고 맑게, 크림은 단추처럼 노란 기
  FUR: 0xf1dcab    // 곰돌이 몸 — 단추 크림(0xf0dcaa)과 같은 따뜻한 아이보리
};

function spring(value, stiffness, damping) { return { value, target: value, v: 0, stiffness, damping }; }
function stepSpring(s, dt, instant) {
  if (instant) { s.value = s.target; s.v = 0; return; }
  s.v += (s.stiffness * (s.target - s.value) - s.damping * s.v) * dt;
  s.value += s.v * dt;
}

/* ── 그림 (캔버스 텍스처) ─────────────────────────── */
const HEX = n => '#' + n.toString(16).padStart(6, '0');

/* 게이지 — 0% 는 왼쪽 아래, 시계 방향으로 300° 돌아 100% 가 오른쪽 아래. 아래 빈자리에 큰 % */
const GAUGE_FROM = -Math.PI * 5 / 6, GAUGE_SWEEP = Math.PI * 5 / 3;
const gaugeAngle = v => GAUGE_FROM + GAUGE_SWEEP * v;          // 맨 위에서 시계 방향 각

/* 눈금판 — 스크롤을 얼마나 내렸는지 보여 주는 0~100% 게이지. 2% 마다 눈금, 10% 마다 긴 눈금, 20% 마다 빨간 숫자 */
function dialTexture(THREE, C) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), m = S / 2;
  g.fillStyle = HEX(C.CREAM); g.fillRect(0, 0, S, S);
  const r = m * .96, P = (a, rr) => [m + Math.cos(a - Math.PI / 2) * rr, m + Math.sin(a - Math.PI / 2) * rr];
  for (let i = 0; i <= 50; i++) {
    const a = gaugeAngle(i / 50), major = i % 10 === 0, ten = i % 5 === 0;
    const len = major ? r * .2 : ten ? r * .13 : r * .06;
    g.strokeStyle = major ? HEX(C.INK) : '#3a3232';
    g.lineWidth = major ? 9 : ten ? 5 : 2.5;
    g.beginPath(); g.moveTo(...P(a, r)); g.lineTo(...P(a, r - len)); g.stroke();
  }
  g.fillStyle = HEX(C.INK);
  g.font = '500 80px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0; v <= 100; v += 20) g.fillText(String(v), ...P(gaugeAngle(v / 100), r * .64));
  g.font = '600 150px "Helvetica Neue", Arial, sans-serif';          // 아래 빈자리의 큰 %
  g.fillText('%', m, m + r * .66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* 되감기 버튼 윗면 — 위를 향한 화살표 */
function arrowTexture(THREE) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f4ece0';
  g.beginPath();
  g.moveTo(128, 46); g.lineTo(200, 128); g.lineTo(152, 128); g.lineTo(152, 206);
  g.lineTo(104, 206); g.lineTo(104, 128); g.lineTo(56, 128); g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 띠 — 200mm. 아래 끝에서 15mm 가 0, 위(끝)로 갈수록 커진다. 왼쪽에 눈금, 5마다 빨간 숫자 */
function tapeTexture(THREE, C, len) {
  const W = 128, H = 2048, px = H / len, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = HEX(C.CREAM); g.fillRect(0, 0, W, H);
  const y = d => H - d * px;                      // 아래 끝에서 d mm
  for (let k = 0; ; k++) {
    const d = 15 + k * C.UNIT / 5;
    if (d > len) break;
    const unit = k % 5 === 0, five = k % 25 === 0;
    g.fillStyle = five ? HEX(C.INK) : '#6a4a4a';
    g.fillRect(0, y(d) - (five ? 3 : 1.5), five ? W * .5 : unit ? W * .34 : W * .2, five ? 6 : 3);
    if (five) {
      g.font = '600 46px "Helvetica Neue", Arial, sans-serif';
      g.textBaseline = 'middle';
      g.fillText(String(k / 5), W * .55, y(d));
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* 격자 무늬 — 타워 띠(빨강·크림 체크)와 전망대 창(크림에 회색 줄) */
function gridTexture(THREE, cols, rows, a, b, line) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d'), w = 512 / cols, h = 64 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    g.fillStyle = (i + j) % 2 ? a : b;
    g.fillRect(i * w, j * h, w, h);
  }
  if (line) {
    g.strokeStyle = line; g.lineWidth = 3;
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, 64); g.stroke(); }
    for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(0, j * h); g.lineTo(512, j * h); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 곰돌이 셔츠 로고 — 흰 하트 테두리 안에 N */
function logoTexture(THREE) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = '#f4ece0'; g.lineWidth = 12; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(128, 214);
  g.bezierCurveTo(40, 150, 20, 90, 60, 56);
  g.bezierCurveTo(92, 30, 122, 50, 128, 78);
  g.bezierCurveTo(134, 50, 164, 30, 196, 56);
  g.bezierCurveTo(236, 90, 216, 150, 128, 214);
  g.stroke();
  g.fillStyle = '#f4ece0';
  g.font = '700 92px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', 128, 124);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── 케이스 ───────────────────────────────────────── */
/* 옆모습 — 왼쪽 원(중심 (0, R)) + 오른쪽 사각(x 0~RIGHT, y 0~TOP). o 만큼 바깥으로 키운다 */
function outline(THREE, C, o) {
  const R = C.R + o, top = C.TOP + o, right = C.RIGHT + o, bottom = -o, rc = 5 + o * .5, rb = 3 + o * .5;
  const s = new THREE.Shape();
  const xTop = Math.sqrt(Math.max(0, R * R - (top - C.R) ** 2));
  s.moveTo(0, bottom);
  s.lineTo(right - rb, bottom);
  s.quadraticCurveTo(right, bottom, right, bottom + rb);
  s.lineTo(right, top - rc);
  s.quadraticCurveTo(right, top, right - rc, top);
  s.lineTo(xTop, top);
  s.absarc(0, C.R, R, Math.asin((top - C.R) / R), Math.PI * 1.5, false);   // 위로 넘어가 왼쪽으로 돌아 바닥까지
  s.closePath();
  return s;
}

function plate(THREE, shape, z0, depth, bevel, mat) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * .9,
    bevelSegments: 4, curveSegments: 64
  });
  g.translate(0, 0, z0 + bevel);
  return new THREE.Mesh(g, mat);
}

function buildCase(THREE, C, M, lying = false) {
  const g = new THREE.Group();
  /* 검정 고무 몸통 + 둘레 홈 (톱니처럼 촘촘히) */
  g.add(plate(THREE, outline(THREE, C, 2.2), -10, 15.6, .8, M.black));
  const path = outline(THREE, C, 3.1);
  const n = 104, ridge = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 2.6, 14), M.black, n);   // 톱니처럼 도드라진 고무 홈
  const q = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const t = i / n, p = path.getPointAt(t), d = path.getTangentAt(t);
    q.position.set(p.x, p.y, -2.2);
    q.rotation.set(0, 0, Math.atan2(d.y, d.x));
    const atSlot = p.y > C.TOP && Math.abs(p.x - C.SLOT_X) < 3.6;   // 출구 자리엔 홈을 두지 않는다
    q.scale.setScalar((p.y < 1 && !lying) || atSlot ? 0 : 1);  // 세워 둘 땐 바닥 변도 비운다 (책상을 뚫지 않게)
    q.updateMatrix();
    ridge.setMatrixAt(i, q.matrix);
  }
  g.add(ridge);
  /* 버건디 앞판·뒤판 + 앞판 둘레 은색 테두리 */
  g.add(plate(THREE, outline(THREE, C, .7), 4.6, 1.4, 0, M.silver));
  g.add(plate(THREE, outline(THREE, C, -1), 5.6, 4.6, 1.1, M.red));
  g.add(plate(THREE, outline(THREE, C, -1), -10.6, 4, 1.1, M.red));
  /* 눈금판 둘레 볼록한 버건디 테 */
  const rim = new THREE.Mesh(new THREE.TorusGeometry(C.DIAL + 1.6, 1.5, 16, 96), M.red);
  rim.position.set(0, C.R, 10);
  g.add(rim);
  /* 줄자 출구 — 윗면에 케이스 두께 방향으로 길쭉하게 난 구멍. 은색 테두리를 두르고 안은 어둡게 파여 있다 */
  const sy = C.TOP + C.SLOT_UP, hx = 2.5, hz = C.TAPE_W / 2 + 2.2, ix = .95, iz = C.TAPE_W / 2 + .6;
  const bezel = new THREE.Shape();
  const rr = (s, x, z, r, hole) => {               // 둥근 모서리 사각형 (모양의 y 는 z)
    s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r);
    s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z); s.lineTo(-x + r, z);
    s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
    return s;
  };
  rr(bezel, hx, hz, 1.6);
  bezel.holes.push(rr(new THREE.Path(), ix, iz, .6));
  const bg = new THREE.ExtrudeGeometry(bezel, { depth: .9, bevelEnabled: true, bevelThickness: .35, bevelSize: .3, bevelSegments: 3, curveSegments: 10 });
  bg.rotateX(-Math.PI / 2);
  const rim2 = new THREE.Mesh(bg, M.silver);
  rim2.position.set(C.SLOT_X, sy - .2, C.TAPE_Z);
  const pit = new THREE.Mesh(new THREE.BoxGeometry(ix * 2 + .2, 2.4, iz * 2 + .2), M.hole);   // 구멍 속 그림자
  pit.position.set(C.SLOT_X, sy - .6, C.TAPE_Z);
  g.add(rim2, pit);
  return g;
}

/* 게이지 — 눈금판은 고정, 버튼 밑에서 나온 빨간 바늘과 테두리를 따라 차오르는 빨간 호가 % 를 가리킨다 */
function buildDial(THREE, C, M) {
  const g = new THREE.Group();
  g.position.set(0, C.R, 10.2);
  const face = new THREE.Mesh(new THREE.CircleGeometry(C.DIAL, 96),
    new THREE.MeshPhysicalMaterial({ map: dialTexture(THREE, C), roughness: .5, clearcoat: .4 }));
  face.position.z = .3;
  g.add(face);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(C.DIAL, C.DIAL, .6, 96, 1, true), M.cream);
  edge.rotation.x = Math.PI / 2;
  g.add(edge);
  /* 바늘 — 가운데에서 끝으로 가늘어진다 (위를 향한 게 0 각) */
  const ns = new THREE.Shape();
  ns.moveTo(-1.1, -2.5); ns.lineTo(1.1, -2.5); ns.lineTo(.28, C.DIAL - 3); ns.lineTo(-.28, C.DIAL - 3); ns.closePath();
  const ng = new THREE.ExtrudeGeometry(ns, { depth: .5, bevelEnabled: false });
  const needle = new THREE.Mesh(ng, M.needle);
  needle.position.z = .5;
  g.add(needle);
  /* 차오르는 호 — 값이 바뀔 때만 다시 만든다 */
  const arc = new THREE.Mesh(new THREE.BufferGeometry(), M.arc);
  arc.position.z = .36;
  g.add(arc);
  let shown = -1;
  const set = v => {
    v = Math.min(1, Math.max(0, v));
    needle.rotation.z = -gaugeAngle(v);
    if (Math.abs(v - shown) < .002) return;
    shown = v;
    arc.geometry.dispose();
    const a0 = Math.PI / 2 - gaugeAngle(0), len = GAUGE_SWEEP * v;   // 수학 각(반시계)으로
    arc.geometry = new THREE.RingGeometry(C.DIAL - 1.1, C.DIAL - .15, 96, 1, a0 - len, Math.max(1e-4, len));
  };
  set(0);
  return { group: g, set };
}

/* 되감기 버튼 — 은색 테두리 안에 둥글게 솟은 버건디 버튼, 윗면에 위쪽 화살표. 누르면 쏙 들어간다 */
function buildButton(THREE, C, M) {
  const g = new THREE.Group();
  g.position.set(0, C.R, 10.2);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.9, 1.4, 64), M.silver);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = 1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.1, .75, 16, 64), M.silver);
  ring.position.z = 1.8;
  g.add(collar, ring);
  const cap = new THREE.Group();                   // 눌리는 부분
  const prof = [[6.3, 0], [6.3, 1.5], [6, 2.25], [5.1, 2.75], [3.4, 3.02], [0, 3.1]];   // 아래에서 위로 (면이 바깥을 보게)
  const dome = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64), M.red);
  dome.rotation.x = Math.PI / 2;
  const arrow = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48),
    new THREE.MeshBasicMaterial({ map: arrowTexture(THREE), transparent: true, depthWrite: false }));
  arrow.position.z = 3.14;
  cap.add(dome, arrow);
  cap.position.z = 1.2;
  g.add(cap);
  return { group: g, cap };
}

/* ── 남산타워 — 아래에서 위로 쌓는다 (받침 원점, +y 위) ── */
/* 모양·자리는 TOWER_SHAPE — 확인 페이지 조절판(E 키)으로 맞추고 '코드 복사'로 여기에 붙인다 */
export const TOWER_SHAPE = {
  X: 28.31, Y: 1.77, Z: 10.64,       // 받침 자리 (좌우 · 높이 · 앞뒤)
  LEAN: .14,        // 꼭대기가 눈금판 쪽으로 기운 각 (rad)
  TWIST: -.05,        // 제자리에서 돌린 각 (rad)
  SCALE: .91,        // 전체 크기
  BASE_R: 1, BASE_H: .73,       // 받침 굵기 · 높이 (배율)
  SHAFT_R: 1.075,      // 기둥 굵기 (배율)
  LOW: 15.25,         // 체크 띠 아래 기둥 길이
  BAND: 6.49,       // 빨강·크림 체크 띠 높이
  HIGH: 18.095,        // 체크 띠 위 기둥 길이
  DECK_R: 1.425, DECK_H: 1.6,       // 전망대 굵기 · 높이 (배율)
  ANT_R: .865,        // 안테나 굵기 (배율)
  ANT_SEG: 2.815,    // 안테나 줄무늬 한 칸 높이
  ANT_N: 6,        // 안테나 줄무늬 칸 수
  NEEDLE: 7.82        // 꼭대기 은색 바늘 길이
};
function buildTower(THREE, C, M, T = TOWER_SHAPE) {
  const g = new THREE.Group();
  /* 무늬 재질은 한 번만 만든다 (조절판에서 다시 만들 때 느려지지 않게) */
  M.checker ||= new THREE.MeshPhysicalMaterial({ map: gridTexture(THREE, 16, 2, HEX(C.RED), HEX(C.CREAM), '#e8dccb'), roughness: .35, clearcoat: .6 });
  M.tiles ||= new THREE.MeshPhysicalMaterial({ map: gridTexture(THREE, 24, 1, HEX(C.CREAM), HEX(C.CREAM), '#9d9590'), roughness: .35, clearcoat: .6 });
  let y = 0;
  const ring = (r0, r1, h, mat, seg = 48) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat);
    m.position.y = y + h / 2;
    g.add(m);
    y += h;
    return m;
  };
  /* 받침 */
  const b = T.BASE_R, bh = T.BASE_H;
  ring(10.5 * b, 10.5 * b, 2.5 * bh, M.silver);
  ring(12 * b, 12 * b, 3.6 * bh, M.tiles);
  ring(11 * b, 10 * b, 2 * bh, M.silver);
  ring(9 * b, 6.8 * T.SHAFT_R, 7 * bh, M.silver);
  ring(6.4 * T.SHAFT_R, 6.4 * T.SHAFT_R, 1.2 * bh, M.silver);
  /* 기둥 — 위로 갈수록 가늘어진다. 중간에 빨강·크림 체크 띠 */
  const s = T.SHAFT_R;
  ring(5.6 * s, 5.3 * s, T.LOW, M.cream);
  ring(6.3 * s, 6.3 * s, 1, M.silver);
  ring(6.3 * s, 6.3 * s, T.BAND, M.checker);
  ring(6.3 * s, 6.3 * s, 1, M.silver);
  ring(5.2 * s, 4.8 * s, T.HIGH, M.cream);
  /* 전망대 */
  const d = T.DECK_R, dh = T.DECK_H;
  ring(5.6 * s, 6.6 * d, 1.6 * dh, M.silver);
  ring(7.4 * d, 7.4 * d, 3.2 * dh, M.tiles);
  ring(7.2 * d, 6.8 * d, 1.4 * dh, M.silver);
  ring(6.2 * d, 6.2 * d, 2.6 * dh, M.tiles);
  ring(6 * d, 5.2 * d, 1.4 * dh, M.silver);
  ring(4.6 * d, 4.2 * d, 2.4 * dh, M.cream);
  ring(4.4 * d, 4.4 * d, 1 * dh, M.silver);
  /* 안테나 — 빨강·크림 줄무늬로 점점 가늘게 */
  const n = Math.max(1, Math.round(T.ANT_N));
  for (let i = 0; i < n; i++) {
    const r = (3.4 - i * 1.92 / Math.max(1, n - 1)) * T.ANT_R;
    ring(r, r * .96, T.ANT_SEG, i % 2 ? M.cream : M.red, 32);
    if (i % 2 === 0) ring(r + .25, r + .25, .5, M.red, 32);
  }
  ring(.7 * T.ANT_R, .5 * T.ANT_R, T.NEEDLE, M.silver, 16);   // 꼭대기 바늘
  /* 자리 — 받침이 원점. 꼭대기가 눈금판 쪽으로 기운다 */
  g.position.set(T.X, T.Y, T.Z);
  g.rotation.set(0, T.TWIST, T.LEAN);
  g.scale.setScalar(T.SCALE);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ── 곰돌이 (N사랑곰) — 머리와 몸이 이어진 젤리빈 모양. 원점은 발바닥 아래 ──
   레퍼런스 줄자 색: 크림 몸 + 버건디 셔츠(흰 하트 N) + 빨간 눈·입.
   모양은 BEAR_SHAPE, 자세는 BEAR_POSE — 확인 페이지 조절판(E 키)으로 맞추고 '코드 복사'로 여기에 붙인다 */
export const BEAR_SHAPE = {
  H: 28.09,         // 키 (발바닥~머리 꼭대기)
  BOTTOM: 7.8,     // 엉덩이 쪽 반지름
  BELLY: 9.6,      // 가장 넓은 배 반지름
  HEAD: 8.41,         // 머리(눈 높이) 반지름
  CROWN: .69,      // 머리 꼭대기 둥글기 — 작을수록 뾰족, 클수록 납작하게 넓다
  DEPTH: .835,      // 앞뒤 두께 비율 (1 = 동그란 기둥)
  EAR_R: 3.19, EAR_X: 5.51, EAR_Y: 26.74,          // 귀 크기 · 벌어짐 · 높이
  EYE_X: 3.345, EYE_Y: 21.795, EYE_S: 1.045,            // 눈 간격(반) · 높이 · 크기
  MOUTH_Y: 21.27,   // 입 높이
  SHIRT_TOP: 15.815, SHIRT_BOTTOM: 7.085,             // 셔츠 목선 · 밑단 높이
  ARM_R: 2.39, ARM_LEN: 4.415,                     // 팔 굵기 · 길이
  SHOULDER_X: 8.63, SHOULDER_Y: 13.455,            // 어깨 자리
  LEG_R: 3.095, LEG_X: 4.265, LEG_Z: 4.13,           // 발 크기 · 벌어짐 · 앞으로 뻗은 정도
  SCALE: .945         // 전체 크기
};
export const BEAR_POSE = {
  X: -.83, Y: 1.2, Z: 1.455,                          // 안고 있을 때 자리 (출구 기준 좌우 · 턱 위 높이 · 앞뒤)
  LEAN: .18,       // 타워 쪽으로 기대는 각 (rad)
  TURN: -.385,       // 몸을 타워 쪽으로 돌린 각 (rad)
  L_Z: -2.365, L_Y: .925, L_X: .105,                  // 타워 쪽 팔 — 옆으로 드는 각 · 앞으로 감는 각 · 위아래
  R_Z: -1.335, R_Y: 1.125, R_X: 0,                 // 반대 팔
  WAVE: 2.32        // 띠가 다 올라갔을 때 흔드는 팔을 드는 각
};

/* 옆모습 (반지름, 높이) — 아래가 넓고 위로 둥글게 */
function bearProfile(S) {
  const H = S.H, c = S.CROWN;
  return [
    [0, 1.2], [S.BOTTOM * .68, 1.4], [S.BOTTOM, 2.8], [(S.BOTTOM + S.BELLY) / 2 + .2, H * .18],
    [S.BELLY, H * .3], [S.BELLY * .96, H * .43], [(S.BELLY + S.HEAD) / 2, H * .55],
    [S.HEAD * 1.04, H * .65], [S.HEAD, H * .745], [S.HEAD * (.8 + c * .15), H * .85],
    [S.HEAD * (.55 + c * .25), H * .93], [S.HEAD * (.3 + c * .25), H * .98], [0, H]
  ];
}
function radiusAt(P, y) {
  for (let i = 1; i < P.length; i++) {
    const [r0, y0] = P[i - 1], [r1, y1] = P[i];
    if (y <= y1) return r0 + (r1 - r0) * (y - y0) / Math.max(1e-6, y1 - y0);
  }
  return 0;
}
function buildBear(THREE, C, M, S = BEAR_SHAPE) {
  const g = new THREE.Group(), prof = bearProfile(S), R = y => radiusAt(prof, y), D = S.DEPTH;
  const lathe = (pts, mat) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 56), mat);
    m.scale.z = D;
    g.add(m);
    return m;
  };
  lathe(prof, M.fur);
  /* 셔츠 — 몸에 딱 붙는 통. 목과 밑단은 살짝 안으로 접힌다 */
  const shirtPts = [[R(S.SHIRT_BOTTOM) - .3, S.SHIRT_BOTTOM - .4]];
  for (let y = S.SHIRT_BOTTOM; y <= S.SHIRT_TOP; y += .6) shirtPts.push([R(y) + .45, y]);
  shirtPts.push([R(S.SHIRT_TOP) + .45, S.SHIRT_TOP], [R(S.SHIRT_TOP + .4) - .2, S.SHIRT_TOP + .8]);
  lathe(shirtPts, M.shirt);
  const ly = (S.SHIRT_BOTTOM + S.SHIRT_TOP) / 2 - .4;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: logoTexture(THREE), transparent: true, depthWrite: false }));
  logo.position.set(0, ly, R(ly) * D + .75);
  g.add(logo);
  const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, mat = M.fur) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  /* 귀 · 다리(앉아서 앞으로 뻗은 발) · 꼬리 */
  ball(S.EAR_R, -S.EAR_X, S.EAR_Y, -.4, 1, 1, .7);
  ball(S.EAR_R, S.EAR_X, S.EAR_Y, -.4, 1, 1, .7);
  ball(S.LEG_R, -S.LEG_X, S.LEG_R * .75, S.LEG_Z, 1, .85, 1.35);
  ball(S.LEG_R, S.LEG_X, S.LEG_R * .75, S.LEG_Z, 1, .85, 1.35);
  ball(1.8, 0, S.H * .15, -R(S.H * .15) * D - .6);
  /* 얼굴 — 멀리 떨어진 세로로 긴 빨간 눈, 가운데 짧은 입 (표면 곡률을 따라 살짝 안쪽으로) */
  const fz = (x, y) => Math.sqrt(Math.max(0, R(y) ** 2 - x * x)) * D - .15;
  for (const x of [-S.EYE_X, S.EYE_X]) {
    const eye = new THREE.Mesh(new THREE.CapsuleGeometry(.7 * S.EYE_S, 1.5 * S.EYE_S, 4, 12), M.face);
    eye.position.set(x, S.EYE_Y, fz(x, S.EYE_Y) - .05);
    g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(.42 * S.EYE_S, 1.2 * S.EYE_S, 4, 10), M.face);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, S.MOUTH_Y, fz(0, S.MOUTH_Y) + .1);
  g.add(mouth);
  /* 팔 — 어깨에 매단 그룹. 소매(버건디) + 짧고 뭉툭한 팔. 아래로 늘어진 게 기본 */
  const arm = side => {
    const p = new THREE.Group();
    p.position.set(side * S.SHOULDER_X, S.SHOULDER_Y, .4);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(S.ARM_R + .5, 1.2, 6, 16), M.shirt);
    sleeve.position.y = -1.4;
    const paw = new THREE.Mesh(new THREE.CapsuleGeometry(S.ARM_R, S.ARM_LEN, 6, 16), M.fur);
    paw.position.y = -1.4 - S.ARM_LEN / 2 - .9;
    p.add(sleeve, paw);
    g.add(p);
    return p;
  };
  const armL = arm(-1), armR = arm(1);
  g.scale.setScalar(S.SCALE);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, armL, armR };
}

/* ── 조립 + 인터랙션 ───────────────────────────────────
   lying: false (기본) — 세워 둔다. 띠가 위로 쭉 올라가고 곰돌이가 끝에 앉아 같이 올라간다.
                  ★ 페이지를 넘어가 스크롤할 때 쓸 모습 — 이 동작은 그대로 보관한다 (setHover 대신 스크롤로 움직일 예정)
   lying: true  — 메인 화면용. 뒤판을 책상에 대고 눕힌다. 띠는 출구에서 책상으로 휘어 내려와 곡선으로 쭉 뽑혀 있고,
                  끝(곰돌이)은 책상 위에 서 있다. 호버하면 버튼이 눌리며 띠가 살짝 감겨 들어간다. */
export const DESK = {
  LEN: 150,        // 눕혔을 때 뽑혀 있는 띠 길이 (출구에서 끝까지)
  PULL: 22,        // 호버하면 감겨 들어가는 길이
  /* 책상 위 곡선 — 출구에서 뻗어 나가는 방향(몸 기준 +y)으로 (옆 x, 앞 y) 점들. 단위 mm */
  PATH: [[0, 14], [7, 38], [-4, 70], [8, 104], [26, 132], [40, 160]]
};

export function createTapeTower(THREE, scene, { x = 0, z = 0, size = 1, turn = 0, lying = false } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = TOWER;
  const M = {
    red: new THREE.MeshPhysicalMaterial({ color: C.RED, roughness: .3, metalness: 0, clearcoat: .7, clearcoatRoughness: .1, envMapIntensity: .55 }),   // 금속감·반사를 줄여야 분홍빛으로 뜨지 않는다
    shirt: new THREE.MeshPhysicalMaterial({ color: C.RED, roughness: .4, clearcoat: .7, clearcoatRoughness: .2 }),
    cream: new THREE.MeshPhysicalMaterial({ color: C.CREAM, roughness: .35, clearcoat: .7, clearcoatRoughness: .2 }),
    fur: new THREE.MeshPhysicalMaterial({ color: C.FUR, roughness: .38, clearcoat: .6, clearcoatRoughness: .25, side: THREE.DoubleSide }),
    silver: new THREE.MeshStandardMaterial({ color: C.SILVER, metalness: .95, roughness: .2 }),
    black: new THREE.MeshStandardMaterial({ color: C.BLACK, roughness: .55, metalness: .2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: .8, roughness: .4 }),
    face: new THREE.MeshPhysicalMaterial({ color: 0x8a0f18, roughness: .3, clearcoat: .8 }),
    needle: new THREE.MeshPhysicalMaterial({ color: C.INK, roughness: .3, clearcoat: .9 }),
    arc: new THREE.MeshBasicMaterial({ color: C.INK, transparent: true, opacity: .85 }),
    hole: new THREE.MeshStandardMaterial({ color: 0x080707, roughness: .9 })
  };

  const root = new THREE.Group();                 // 놓인 자리 · 방향 · 크기
  root.position.set(x, 0, z);
  root.rotation.y = turn;
  root.scale.setScalar(size);
  scene.add(root);
  /* 몸 — 눕힐 땐 앞면(+z)이 위를 보게 돌리고 뒤판이 책상에 닿게 올린다 */
  const BACK = 10.6, stand = new THREE.Group();
  if (lying) { stand.rotation.x = -Math.PI / 2; stand.position.y = BACK; }
  root.add(stand);

  stand.add(buildCase(THREE, C, M, lying));
  const dial = buildDial(THREE, C, M);
  const button = buildButton(THREE, C, M);
  stand.add(dial.group, button.group);

  let tower = buildTower(THREE, C, M);
  stand.add(tower);

  /* 띠 — 말랑한 천 줄자. 그림은 200mm 짜리, 끝(곰돌이 쪽)이 그림 위쪽. 보이는 만큼 잘라 쓴다 */
  const LEN = 200, SY = C.TOP + C.SLOT_UP, W = C.TAPE_W;
  const tapeTex = tapeTexture(THREE, C, LEN);
  const tapeMat = new THREE.MeshPhysicalMaterial({ map: tapeTex, roughness: .5, clearcoat: .25, side: THREE.DoubleSide });

  /* 세워 둘 때 — 출구에선 옆면을 보이며(폭이 케이스 두께 방향) 나오고, TWIST 만큼 올라가며 90° 비틀려 눈금이 앞을 본다 */
  const SEG = 90;
  const tapeGeo = new THREE.PlaneGeometry(W, 1, 1, SEG);
  const tapeU = [], tapeF = [];                     // 꼭짓점마다 폭 방향 위치 · 아래 끝에서의 비율
  for (let i = 0; i < tapeGeo.attributes.position.count; i++) {
    tapeU.push(tapeGeo.attributes.position.getX(i));
    tapeF.push(tapeGeo.attributes.uv.getY(i));
  }
  const tape = new THREE.Mesh(tapeGeo, tapeMat);
  tape.frustumCulled = false;                       // 매 프레임 모양이 바뀐다
  tape.visible = !lying;
  stand.add(tape);
  let tapeShown = -1;
  function layTape(len) {
    const vis = Math.min(LEN, Math.max(.5, len + 6)), top = SY + len, bottom = top - vis;
    tapeTex.repeat.y = vis / LEN;
    tapeTex.offset.y = 1 - vis / LEN;
    if (Math.abs(len - tapeShown) < .01) return;
    tapeShown = len;
    const p = tapeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = bottom + tapeF[i] * vis, s = Math.min(1, Math.max(0, (y - SY) / C.TWIST));
      const th = Math.PI / 2 * (1 - s * s * (3 - 2 * s)), u = tapeU[i];
      p.setXYZ(i, C.SLOT_X + u * Math.cos(th), y, C.TAPE_Z + u * Math.sin(th));   // 비트는 방향: u 가 + 인 쪽이 뒤로
    }
    p.needsUpdate = true;
    tapeGeo.computeVertexNormals();
  }

  /* 눕혔을 때 — 출구에서 잠깐 나와 책상(뒤판 높이)으로 휘어 내려앉고, DESK.PATH 곡선을 따라 뻗는다.
     출구에선 옆면(법선 +x), 책상에 닿으면 눈금이 위(눕힌 몸 기준 +z)를 보도록 그 사이에서 비틀린다 */
  let desk = null;
  if (lying) {
    const DZ = -BACK + .15, SX = C.SLOT_X, TZ = C.TAPE_Z;
    const pts = [[SX, SY - 6, TZ], [SX, SY, TZ], [SX, SY + 3.5, TZ - .8], [SX, SY + 8, DZ + 2.2], [SX + .4, SY + 12, DZ]]
      .concat(DESK.PATH.map(([dx, dy]) => [SX + dx, SY + dy, DZ]))
      .map(([a, b, c]) => new THREE.Vector3(a, b, c));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const total = curve.getLength(), sIn = 6;       // 케이스 속 6mm 부터 그린다
    const N = 160, geo = new THREE.BufferGeometry();
    const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = [];
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, tapeMat);
    mesh.frustumCulled = false;
    stand.add(mesh);
    const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), wv = new THREE.Vector3();
    const tip = new THREE.Vector3(), tipDir = new THREE.Vector3();
    let shown = -1;
    desk = {
      tip, tipDir,
      lay(vis) {                                      // vis: 출구 밖으로 나와 있는 길이
        if (Math.abs(vis - shown) < .01) return;
        shown = vis;
        const end = Math.min(total, sIn + vis);
        for (let i = 0; i <= N; i++) {
          const s = end * i / N, u = s / total;
          const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
          const b = Math.min(1, Math.max(0, (s - sIn - 2) / 12)), bb = b * b * (3 - 2 * b);
          n.copy(X).lerp(Z, bb).normalize();          // 눈금 면이 볼 쪽: 옆 → 위
          wv.crossVectors(n, tg).normalize().multiplyScalar(W / 2);
          pos.set([p.x - wv.x, p.y - wv.y, p.z - wv.z, p.x + wv.x, p.y + wv.y, p.z + wv.z], i * 6);
          const v = 1 - (end - s) / LEN;               // 끝이 그림 위쪽 — 감기면 눈금도 같이 들어간다
          uv.set([0, v, 1, v], i * 4);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.uv.needsUpdate = true;
        geo.computeVertexNormals();
        tip.copy(curve.getPointAt(end / total));
        tipDir.copy(curve.getTangentAt(end / total));
      }
    };
  }

  let bear = buildBear(THREE, C, M);
  stand.add(bear.group);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const S = {
    ext: spring(0, 42, 10),                       // 세워 둘 때: 0 감김 · 1 다 풀림 (살짝 넘쳤다 자리 잡는다)
    hug: spring(1, 60, 12),                       // 1 타워를 안음 · 0 팔을 내리고 손 흔들 준비
    pull: spring(0, 90, 13),                      // 눕혔을 때: 0 뽑혀 있음 · 1 살짝 감겨 들어감
    gauge: spring(0, 60, 12)                      // 게이지 바늘 (0~1)
  };
  let t = 0, progress = null, pressT = 0, hover = false;   // progress: null 이면 띠가 풀린 만큼, 숫자면 그 % (setProgress)
  const PRESS = .45;

  function apply() {
    dial.set(S.gauge.value);
    /* 되감기 버튼 — 띠가 감기기 시작할 때 꾹 눌렸다 올라온다 */
    button.cap.position.z = 1.2 - (pressT > 0 ? 1.3 * Math.sin(Math.PI * (1 - pressT / PRESS)) : 0);
    const P = BEAR_POSE;

    if (lying) {
      /* 띠 끝에 서 있는 곰돌이 — 몸을 세우고(눕힌 몸 기준 +z 가 위) 카메라 쪽을 본다. 감길 땐 딸려 오며 손을 흔든다 */
      desk.lay(DESK.LEN - DESK.PULL * S.pull.value);
      const g = bear.group, w = S.pull.value;
      g.position.copy(desk.tip).addScaledVector(desk.tipDir, 2);
      g.rotation.set(Math.PI / 2, 0, -turn + Math.sin(t * 3) * .03, 'ZYX');
      bear.armL.rotation.set(0, 0, -.25);
      bear.armR.rotation.set(0, 0, .3 * (1 - w) + (P.WAVE + Math.sin(t * 8) * .35) * w);
      return;
    }

    const e = S.ext.value, h = S.hug.value, len = C.EXT * e;
    layTape(len);
    /* 곰돌이 — 띠 끝에 앉는다. 감겨 있을 땐 출구 위 턱에 앉아 타워 쪽으로 몸을 기대고 두 팔로 끌어안는다.
       다 올라가면 똑바로 앉아 한 손을 흔든다 (h: 1 안음 · 0 손 흔듦) */
    const k = 1 - h, wave = Math.sin(t * 8) * .35 * k;
    const zUp = C.TAPE_Z + 3.5;                   // 띠 끝에 앉았을 때 — 띠 바로 앞
    bear.group.position.set(C.SLOT_X + P.X, C.TOP + P.Y + len, zUp + (P.Z - zUp) * h);
    bear.group.rotation.set(0, P.TURN * h, P.LEAN * h + Math.sin(t * 6) * .04 * k * Math.min(1, e * 2));
    bear.armL.rotation.set(P.L_X * h, P.L_Y * h, P.L_Z * h - .25 * k);               // 타워 앞을 감싼다 → 옆에 내린다
    bear.armR.rotation.set(P.R_X * h, P.R_Y * h, P.R_Z * h + (P.WAVE + wave) * k);   // 배 앞으로 모은다 → 들어서 흔든다
  }
  apply();

  return {
    root,
    hitTarget: root,
    setHover(on) {
      if (on === hover) return;
      hover = on;
      if (lying) {                                  // 눕혔을 때: 올리면 버튼을 누른 것처럼 살짝 감긴다
        if (on) pressT = PRESS;
        S.pull.target = on ? 1 : 0;
        return;
      }
      if (!on && S.ext.target > 0 && S.ext.value > .15) pressT = PRESS;   // 감길 땐 버튼을 누른 것처럼
      S.ext.target = on ? 1 : 0;
      S.hug.target = on ? 0 : 1;
    },
    /* 게이지에 보일 % (0~1). 스크롤 페이지에서 스크롤 비율을 넘겨준다. null 이면 띠가 풀린 만큼 */
    setProgress(p) { progress = p == null ? null : Math.min(1, Math.max(0, p)); },
    update(dt) {
      t += dt;
      pressT = Math.max(0, pressT - dt);
      const pulled = lying ? (DESK.LEN - DESK.PULL * S.pull.value) / C.EXT : S.ext.value;
      S.gauge.target = progress ?? Math.min(1, Math.max(0, pulled));
      for (const k in S) stepSpring(S[k], dt, instant);
      apply();
    },
    /* 조절판용 — BEAR_SHAPE·TOWER_SHAPE 를 바꾼 뒤 곰과 타워를 다시 만든다 (재질은 그대로 쓴다).
       자세(BEAR_POSE)는 매 프레임 반영된다 */
    rebuild() {
      for (const old of [bear.group, tower]) {
        stand.remove(old);
        old.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      bear = buildBear(THREE, C, M);
      tower = buildTower(THREE, C, M);
      stand.add(bear.group, tower);
      apply();
    }
  };
}
