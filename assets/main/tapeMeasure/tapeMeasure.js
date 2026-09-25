/*
  자동 줄자 3D 모델 + 호버 인터랙션
  레퍼런스: references/mainScreen/objectReferenceBoard (빨간 줄자), mainScreenMockup.
    광택 있는 빨간 케이스, 크림 눈금판(둘레에 숫자), 황동 허브에 구멍 2개,
    옆구리의 은색 입구에서 크림색 띠(빨간 숫자·눈금)가 나와 책상에 깔린다. 끝에 은색 고리.

  3DREADME 방침대로 **케이스만 3D, 눈금은 2D** — 띠는 얇은 리본에 캔버스로 그린 눈금을 입힌다.

  띠가 몸체에서 이어져 보이게 하는 게 핵심이다.
  줄자 속 릴은 축이 세로라서 띠가 **세로로 선 채** 입구에서 나온다. 그러고는 내려오면서
  90° 비틀려 책상에 눕는다. 그래서 띠를 한 줄의 리본으로 두고, 매 프레임 입구 자리에서
  책상까지 이어 붙인다 — 케이스가 들리거나 기울어도 입구를 따라가 끊기지 않는다.

  눕혀 둔다(눈금판이 위를 본다). 호버하면 들리면서 띠가 풀린다 — 다 풀면 236.7m (N서울타워 높이).
  떼면 되감긴다.

  쓰는 법
    import { createTapeMeasure } from './tapeMeasure.js';
    const tape = createTapeMeasure(THREE, scene, { x: 0, z: 0, size: 1, turn: 0 });
    tape.setHover(true);
    tape.lean(worldPoint);   // 커서 쪽으로 기울기 (선택)
    tape.update(dt);         // 매 프레임. 움직임이 남아 있으면 true

  단위: 케이스 반지름 1. 바닥은 y = 0. 띠는 +x 쪽으로 뻗는다.
*/

/* 레퍼런스에서 잰 비율 (케이스 반지름 = 1) */
const CASE = {
  H: .5,           // 케이스 두께 — 레퍼런스는 도톰하다
  WELL_R: .62,     // 눈금판이 들어앉은 우묵한 자리 반지름
  WELL_D: .07,     // 그 깊이
  MOUTH_A: .25,    // 입구 자리 — 옆구리 각도(rad). 0 이면 +x 정면, + 는 앞쪽(카메라 쪽)
  TAPE_W: .3,      // 띠 폭
  READING: '236.7' // 다 풀었을 때 눈금이 가리키는 값 (N서울타워 높이, m)
};

export const TAPE_COLORS = {
  shell: 0x8c0a12,   // 레퍼런스의 짙은 빨강 — 더 밝게 두면 광을 받아 분홍으로 뜬다
  dial:  0xeeeae2,
  tape:  0xf1ebdd,   // 크림 띠
  ink:   0xb3141c,   // 띠의 빨간 숫자·눈금
  brass: 0xb99242,
  steel: 0xc9ced3
};

/* 띠가 책상에 깔리는 길 — 입구 앞 바닥에서 시작하는 S 자. [x, z], 케이스 기준 */
const DESK_PATH = [[1.5, .38], [2.1, .62], [2.8, .55], [3.35, .05], [3.9, -.35], [4.5, -.3]];
const LEAD_SEGS = 26;          // 입구 → 책상까지 내려오는 구간을 나누는 수
const DESK_STEP = .04;         // 책상 위 띠를 나누는 간격
const MIN_OUT = .3;            // 평소에도 책상 위로 나와 있는 길이
const TEX_LEN = 4.6;           // 띠 그림 한 장이 덮는 길이 — 1 = 10cm
const DESK_Y = .01;            // 책상 위 띠 높이 — 그림자(.004)와 같으면 서로 깜빡인다

/* ── 스프링 (다른 오브젝트 파일과 같은 방식) ──────────── */
function spring(value, stiffness, damping) { return { value, target: value, v: 0, stiffness, damping }; }
function stepSpring(s, dt, instant) {
  if (instant) { s.value = s.target; s.v = 0; return; }
  const a = s.stiffness * (s.target - s.value) - s.damping * s.v;
  s.v += a * dt; s.value += s.v * dt;
}
function settled(s) { return Math.abs(s.target - s.value) < 1e-4 && Math.abs(s.v) < 1e-4; }

function canvasTexture(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ── 눈금판 — 크림 바탕에 잔눈금과 숫자, 가운데 황동 허브 ── */
function dialTexture(THREE) {
  return canvasTexture(THREE, 512, 512, (g, N) => {
    const m = N / 2;
    const bg = g.createRadialGradient(m * .7, m * .62, 8, m, m, m);
    bg.addColorStop(0, '#fdfaf2'); bg.addColorStop(.6, '#eeeae2'); bg.addColorStop(1, '#d6cdbb');
    g.fillStyle = bg; g.beginPath(); g.arc(m, m, m, 0, 7); g.fill();

    g.strokeStyle = '#b3141c'; g.lineWidth = 3;          // 숫자 안쪽 가는 빨간 테
    g.beginPath(); g.arc(m, m, m - 112, 0, 7); g.stroke();

    for (let i = 0; i < 100; i++) {                       // 잔눈금
      const a = i * Math.PI / 50, big = i % 5 === 0;
      g.strokeStyle = i % 10 === 0 ? '#b3141c' : '#171413';
      g.globalAlpha = big ? .85 : .4;
      g.lineWidth = big ? 4 : 2.2;
      g.beginPath();
      g.moveTo(m + Math.cos(a) * (m - 8), m + Math.sin(a) * (m - 8));
      g.lineTo(m + Math.cos(a) * (m - (big ? 34 : 21)), m + Math.sin(a) * (m - (big ? 34 : 21)));
      g.stroke();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 38px Georgia, "Times New Roman", serif';
    for (let n = 1; n <= 10; n++) {                        // 둘레 숫자 — 레퍼런스처럼 10 단위, 빨강·검정 번갈아
      const a = (n / 10) * Math.PI * 2 - Math.PI / 2, r = m - 72;
      g.save();
      g.translate(m + Math.cos(a) * r, m + Math.sin(a) * r);
      g.rotate(a + Math.PI / 2);
      g.fillStyle = n % 2 ? '#b3141c' : '#171413';
      g.fillText(n * 10, 0, 0);
      g.restore();
    }
    /* 허브와 구멍 두 개 — 단추처럼 */
    const hub = g.createRadialGradient(m - 12, m - 12, 4, m, m, 46);
    hub.addColorStop(0, '#e6c983'); hub.addColorStop(.7, '#b99242'); hub.addColorStop(1, '#7c5e24');
    g.fillStyle = hub; g.beginPath(); g.arc(m, m, 46, 0, 7); g.fill();
    g.fillStyle = '#241e1b';
    g.beginPath(); g.arc(m - 15, m, 8.5, 0, 7); g.arc(m + 15, m, 8.5, 0, 7); g.fill();
  });
}

/* ── 띠 그림 — 크림 바탕, 가장자리 두 줄 눈금, 10cm 마다 빨간 숫자 ─────
   가로가 길이(왼쪽 끝 = 띠 끝 고리 = 0), 세로가 폭. 숫자는 케이스 쪽으로 갈수록 커진다 */
function tapeTexture(THREE) {
  const W = 3072, H = 200, PX = W / TEX_LEN / 10;           // 1cm 의 픽셀 수
  return canvasTexture(THREE, W, H, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, H);         // 폭 방향으로 살짝 말린 음영
    bg.addColorStop(0, '#d8cfbd'); bg.addColorStop(.1, '#f3eee2');
    bg.addColorStop(.5, '#faf6ec'); bg.addColorStop(.9, '#efe8da'); bg.addColorStop(1, '#d2c8b4');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    for (let i = 0; i < 700; i++) {                        // 천 결 — 규칙적이면 가짜로 보인다
      g.globalAlpha = .025 + Math.random() * .035;
      g.fillStyle = Math.random() > .5 ? '#fffdf6' : '#8a7c62';
      g.fillRect(Math.random() * W, Math.random() * H, 10 + Math.random() * 60, 1 + Math.random() * 2);
    }
    g.globalAlpha = 1;

    const cm = Math.floor(W / PX);
    for (let i = 0; i <= cm * 2; i++) {                     // 5mm 마다 — 위아래 가장자리 두 줄
      const x = i * PX / 2, c = i / 2;
      const ten = c % 10 === 0, five = c % 5 === 0, whole = Number.isInteger(c);
      const len = ten ? H * .3 : five ? H * .2 : whole ? H * .14 : H * .08;
      g.fillStyle = ten ? '#b3141c' : '#1d1917';
      g.globalAlpha = ten ? .95 : whole ? .75 : .45;
      const w = ten ? 4 : whole ? 2.6 : 1.8;
      g.fillRect(x - w / 2, 0, w, len);
      g.fillRect(x - w / 2, H - len, w, len);
    }
    g.globalAlpha = 1;
    /* 숫자는 좌우를 뒤집어 그린다 — 가로 좌표가 띠 끝(고리)에서 케이스 쪽으로 늘어나서,
       책상 위에서 보면 그림의 가로가 거꾸로 놓인다. 그대로 그리면 20 이 "02" 처럼 거울 글씨가 된다 */
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const num = (c, y) => { g.save(); g.translate(c * PX, y); g.scale(-1, 1); g.fillText(c, 0, 0); g.restore(); };
    for (let c = 1; c <= cm; c++) {
      if (c % 10 === 0) {                                   // 10cm — 크고 빨갛게
        g.font = '700 74px Georgia, "Times New Roman", serif';
        g.fillStyle = '#b3141c'; num(c, H / 2 + 4);
      } else if (c % 5 === 0) {                             // 5cm — 작고 검게
        g.font = '600 34px Georgia, "Times New Roman", serif';
        g.fillStyle = '#1d1917'; num(c, H / 2 + 2);
      }
    }
  });
}

/* ── 케이스 ─────────────────────────────────────────── */
function buildCase(THREE) {
  const { H, WELL_R, WELL_D, MOUTH_A, TAPE_W } = CASE;
  const V = (r, y) => new THREE.Vector2(r, y);
  const g = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: TAPE_COLORS.shell, roughness: .3, metalness: 0,
    clearcoat: .55, clearcoatRoughness: .16     // 광을 과하게 주면 빨강이 분홍으로 뜬다
  });

  /* 몸통 — 옆은 둥글게 부푼 띠, 윗면은 둘레가 도톰한 테를 이루고 가운데가 우묵하다 */
  const profile = [
    V(0, 0), V(.6, 0), V(.84, .012), V(.95, .06), V(.99, .14), V(1.0, H * .5),
    V(.99, H - .12), V(.955, H - .04), V(.9, H - .006), V(.8, H + .012),
    V(WELL_R + .06, H), V(WELL_R + .01, H - .02), V(WELL_R - .005, H - WELL_D), V(0, H - WELL_D)
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 128), shellMat));

  /* 위아래 반쪽이 맞물린 이음매 — 가는 어두운 선 */
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1.003, .007, 6, 128),
    new THREE.MeshStandardMaterial({ color: 0x3a0406, roughness: .6 }));
  seam.rotation.x = Math.PI / 2;
  seam.position.y = H * .5;
  g.add(seam);

  /* 눈금판 */
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(WELL_R - .01, 72),
    new THREE.MeshStandardMaterial({ map: dialTexture(THREE), roughness: .55 })
  );
  dial.rotation.x = -Math.PI / 2;
  dial.position.y = H - WELL_D + .004;
  g.add(dial);

  /* 은색 입구 — 옆구리에 붙은 금속판. 가운데 세로 틈으로 띠가 선 채 나온다 */
  const steel = new THREE.MeshStandardMaterial({ color: TAPE_COLORS.steel, metalness: .95, roughness: .22 });
  const mouth = new THREE.Group();
  mouth.position.set(Math.cos(MOUTH_A), 0, Math.sin(MOUTH_A));
  mouth.rotation.y = -MOUTH_A;                            // 로컬 +x 가 바깥을 본다
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.04, H * .66, .42), steel);
  plate.position.set(.012, H * .5, 0);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(.02, TAPE_W + .05, .045),
    new THREE.MeshStandardMaterial({ color: 0x120c0b, roughness: .9 }));
  slit.position.set(.04, H * .5, 0);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, .02, 16).rotateZ(Math.PI / 2), steel);
  screw.position.set(.04, H * .5, .18);
  mouth.add(plate, slit, screw);
  g.add(mouth);

  /* 띠가 나오는 자리와 방향 — 리본이 매 프레임 여기서 시작한다 */
  const exit = new THREE.Object3D();
  exit.position.set(.05, H * .5, 0);
  mouth.add(exit);

  return { group: g, dial, exit };
}

/* ── 띠 리본 ─────────────────────────────────────────
   정점 버퍼를 한 번 만들어 두고 매 프레임 자리만 고쳐 쓴다 (새로 만들지 않아 가볍다) */
function buildDeskPath(THREE) {
  const curve = new THREE.CatmullRomCurve3(DESK_PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const len = curve.getLength(), n = Math.ceil(len / DESK_STEP);
  const pts = curve.getSpacedPoints(n);
  return { pts, len, step: len / n };
}

function buildRibbon(THREE, maxPts) {
  const pos = new Float32Array(maxPts * 2 * 3), uv = new Float32Array(maxPts * 2 * 2), idx = [];
  for (let i = 0; i < maxPts - 1; i++) {
    const q = i * 2;
    idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  return geo;
}

let shadowTex = null;
function getShadowTexture(THREE) {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.88)'); r.addColorStop(.55, 'rgba(0,0,0,.42)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

/* ── 조립 + 인터랙션 ─────────────────────────────────── */
export function createTapeMeasure(THREE, scene, { x = 0, z = 0, size = 1, turn = 0 } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = new THREE.Group();                        // 놓인 자리 — 움직이지 않는다
  root.position.set(x, 0, z);
  root.rotation.y = turn;
  root.scale.setScalar(size);
  scene.add(root);

  const lifter = new THREE.Group();                      // 들림
  const tilter = new THREE.Group();                      // 커서 쪽으로 기울기
  lifter.add(tilter);
  root.add(lifter);

  const { group: shell, dial, exit } = buildCase(THREE);
  tilter.add(shell);

  /* 띠 — 책상 위의 길은 고정, 입구에서 책상까지는 매 프레임 다시 잇는다 */
  const desk = buildDeskPath(THREE);
  const MAX = LEAD_SEGS + 1 + desk.pts.length + 1;
  const ribbonGeo = buildRibbon(THREE, MAX);
  const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({
    map: tapeTexture(THREE), roughness: .8, side: THREE.DoubleSide
  }));
  ribbon.frustumCulled = false;                          // 매 프레임 모양이 바뀌어 경계 상자가 맞지 않는다
  root.add(ribbon);

  /* 끝단 은색 고리 — 납작한 판 + 끝에서 꺾여 선 턱 */
  const steel = new THREE.MeshStandardMaterial({ color: TAPE_COLORS.steel, metalness: .92, roughness: .24 });
  const hook = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.BoxGeometry(.13, .02, CASE.TAPE_W + .03), steel);
  cap.position.set(-.05, .012, 0);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(.02, .07, CASE.TAPE_W + .03), steel);
  lip.position.set(.02, .035, 0);
  hook.add(cap, lip);
  root.add(hook);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 3.1),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(THREE), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .004;
  root.add(shadow);

  const S = {
    lift: spring(0, 130, 13),
    pull: spring(0, 46, 12),                             // 띠가 풀린 정도 0~1
    tx:   spring(0, 110, 12),
    tz:   spring(0, 110, 12)
  };

  /* ── 리본 다시 잇기 ── */
  const UP = new THREE.Vector3(0, 1, 0);
  const M = new THREE.Vector3(), D = new THREE.Vector3(), Ucase = new THREE.Vector3();
  const P0 = desk.pts[0], T0 = desk.pts[1].clone().sub(desk.pts[0]).normalize();
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3();
  const P = [], Wd = [];                                  // 샘플 자리와 폭 방향 (재사용)
  for (let i = 0; i < MAX; i++) { P.push(new THREE.Vector3()); Wd.push(new THREE.Vector3()); }
  const b = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const T = new THREE.Vector3(), Hp = new THREE.Vector3();

  function relayRibbon(p) {
    /* 입구의 자리·방향을 root 기준으로 */
    root.updateMatrixWorld(true);
    tmpM.copy(root.matrixWorld).invert();
    exit.getWorldPosition(M).applyMatrix4(tmpM);
    tmpV.set(1, 0, 0).transformDirection(exit.matrixWorld);
    D.copy(tmpV).transformDirection(tmpM);
    Ucase.set(0, 1, 0).transformDirection(exit.matrixWorld).transformDirection(tmpM);

    /* 입구 → 책상: 3차 베지에. 나올 땐 바깥으로, 닿을 땐 책상 길 방향으로 */
    b[0].copy(M); b[1].copy(M).addScaledVector(D, .32);
    b[2].copy(P0).addScaledVector(T0, -.36); b[3].copy(P0);
    let n = 0;
    for (let i = 0; i <= LEAD_SEGS; i++, n++) {
      const t = i / LEAD_SEGS, u = 1 - t;
      P[n].set(0, 0, 0).addScaledVector(b[0], u * u * u).addScaledVector(b[1], 3 * u * u * t)
        .addScaledVector(b[2], 3 * u * t * t).addScaledVector(b[3], t * t * t);
      P[n].y = Math.max(P[n].y, DESK_Y);
    }
    /* 책상 위 — 풀린 만큼 */
    const out = MIN_OUT + p * (desk.len - MIN_OUT);
    const k = Math.min(desk.pts.length - 1, Math.floor(out / desk.step));
    for (let i = 1; i <= k; i++, n++) P[n].copy(desk.pts[i]).setY(DESK_Y);
    if (k < desk.pts.length - 1) {                        // 칸 사이 끝자락
      const f = (out - k * desk.step) / desk.step;
      P[n].copy(desk.pts[k]).lerp(desk.pts[k + 1], f).setY(DESK_Y); n++;
    }

    /* 폭 방향 — 입구에선 세로(케이스의 위쪽), 책상에 닿을수록 눕는다 */
    for (let i = 0; i < n; i++) {
      T.copy(P[Math.min(i + 1, n - 1)]).sub(P[Math.max(i - 1, 0)]).normalize();
      Hp.crossVectors(T, UP);
      if (Hp.lengthSq() < 1e-6) Hp.set(0, 0, 1);
      Hp.normalize();
      if (i <= LEAD_SEGS) {
        const t = i / LEAD_SEGS, e = Math.min(1, t * 1.35), phi = e * e * (3 - 2 * e) * Math.PI / 2;
        Wd[i].copy(Ucase).lerp(UP, t).normalize().multiplyScalar(Math.cos(phi)).addScaledVector(Hp, Math.sin(phi)).normalize();
      } else Wd[i].copy(Hp);
    }

    /* 정점 쓰기 — 가로 좌표는 띠 끝(고리)에서 잰 길이라 숫자가 케이스 쪽으로 커진다 */
    const pos = ribbonGeo.attributes.position.array, uv = ribbonGeo.attributes.uv.array;
    let run = 0; const lens = [0];
    for (let i = 1; i < n; i++) { run += P[i].distanceTo(P[i - 1]); lens.push(run); }
    const w = CASE.TAPE_W / 2;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      pos[o]     = P[i].x + Wd[i].x * w; pos[o + 1] = P[i].y + Wd[i].y * w; pos[o + 2] = P[i].z + Wd[i].z * w;
      pos[o + 3] = P[i].x - Wd[i].x * w; pos[o + 4] = P[i].y - Wd[i].y * w; pos[o + 5] = P[i].z - Wd[i].z * w;
      const u = (run - lens[i]) / TEX_LEN;
      uv[i * 4] = u; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1;
    }
    ribbonGeo.attributes.position.needsUpdate = true;
    ribbonGeo.attributes.uv.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (n - 1) * 6);
    ribbonGeo.computeVertexNormals();

    /* 고리는 띠 끝에 붙어 간다 */
    const e = P[n - 1], pre = P[n - 2];
    hook.position.copy(e).setY(0);
    hook.rotation.y = -Math.atan2(e.z - pre.z, e.x - pre.x);
  }

  function apply() {
    const l = S.lift.value, p = Math.max(0, Math.min(1, S.pull.value));

    lifter.position.y = l * .38;
    tilter.rotation.x = S.tx.value;
    tilter.rotation.z = S.tz.value;

    relayRibbon(p);

    /* 눈금판은 풀린 만큼 돈다 — 띠가 릴에서 감겨 나오는 것이므로 */
    dial.rotation.z = -p * Math.PI * 4;

    shadow.scale.setScalar(1 + l * .42);
    shadow.material.opacity = .9 - l * .42;
    shadow.position.x = (.06 + l * .22);
    shadow.position.z = (.1 + l * .26);
  }
  apply();

  return {
    root,
    hitTarget: shell,                                    // 호버 판정은 케이스만 — 띠는 얇아서 잡기 어렵다
    reading: CASE.READING,

    setHover(on) {
      S.lift.target = on ? 1 : 0;
      S.pull.target = on ? 1 : 0;
      if (!on) { S.tx.target = 0; S.tz.target = 0; }
    },
    /* 월드 좌표의 커서 쪽으로 기운다 (단추와 같은 방식) */
    lean(point) {
      S.tx.target = THREE.MathUtils.clamp((point.z - z) * .06, -.2, .2);
      S.tz.target = THREE.MathUtils.clamp(-(point.x - x) * .06, -.2, .2);
    },
    update(dt) {
      for (const k in S) stepSpring(S[k], dt, instant);
      apply();
      return !Object.values(S).every(settled);
    }
  };
}
