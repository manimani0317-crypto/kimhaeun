/*
  자동 줄자 3D 모델 + 호버 인터랙션
  레퍼런스: 둥근 빨간 케이스, 테두리에 세로 홈, 크림색 눈금판(숫자 1~20),
  황동 허브에 구멍 2개, 옆구리에 강철 벨트 클립, 밑에서 나온 노란 눈금 띠.

  3DREADME 방침대로 **케이스만 3D, 눈금 띠는 2D** — 띠는 책상 위에 놓인
  평평한 리본에 캔버스로 그린 눈금을 입힌다. 인쇄물이라 3D로 만들 게 없다.

  눕혀 둔다(눈금판이 위를 본다). 호버하면 들리면서 띠가 236.7m 까지 풀린다 —
  N서울타워 높이. 떼면 되감긴다.

  쓰는 법
    import { createTapeMeasure } from './tapeMeasure.js';
    const tape = createTapeMeasure(THREE, scene, { x: 0, z: 0, size: 1, turn: 0 });
    tape.setHover(true);
    tape.lean(worldPoint);   // 커서 쪽으로 기울기 (선택)
    tape.update(dt);         // 매 프레임. 움직임이 남아 있으면 true

  단위: 케이스 반지름 1. 바닥은 y = 0.
*/

/* 레퍼런스에서 잰 비율 (케이스 반지름 = 1) */
const CASE = {
  H: .44,          // 케이스 두께
  WELL_R: .60,     // 눈금판이 들어앉은 우묵한 자리 반지름
  WELL_D: .07,     // 그 깊이
  RIBS: 46,        // 테두리 세로 홈 개수
  RIB_AMP: .013,   // 홈 깊이 — 과하면 톱니처럼 보인다
  TAPE_W: .30,     // 눈금 띠 폭
  READING: '236.7' // 다 풀었을 때 눈금이 가리키는 값 (N서울타워 높이, m)
};

export const TAPE_COLORS = {
  shell: 0x7a0706,   // 포인트 레드 — 단추(#b30604)보다 어둡게 둬야 둘이 안 싸운다
  dial:  0xeeeae2,
  band:  0xe0b03a,
  brass: 0xb99242,
  steel: 0xb9bfc4
};

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

/* ── 눈금판 — 크림 바탕에 잔눈금과 숫자 1~20 ──────────────
   13 이상은 빨강. 레퍼런스 사진의 배치를 그대로 옮겼다 */
function dialTexture(THREE) {
  return canvasTexture(THREE, 512, 512, (g, N) => {
    const m = N / 2;
    const bg = g.createRadialGradient(m * .7, m * .62, 8, m, m, m);
    bg.addColorStop(0, '#fdfaf2'); bg.addColorStop(.6, '#eeeae2'); bg.addColorStop(1, '#cdc4b2');
    g.fillStyle = bg; g.beginPath(); g.arc(m, m, m, 0, 7); g.fill();

    for (let i = 0; i < 100; i++) {                       // 잔눈금
      const a = i * Math.PI / 50, big = i % 5 === 0;
      g.strokeStyle = '#171413'; g.globalAlpha = big ? .82 : .38;
      g.lineWidth = big ? 4 : 2.2;
      g.beginPath();
      g.moveTo(m + Math.cos(a) * (m - 8), m + Math.sin(a) * (m - 8));
      g.lineTo(m + Math.cos(a) * (m - (big ? 34 : 21)), m + Math.sin(a) * (m - (big ? 34 : 21)));
      g.stroke();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
    for (let n = 1; n <= 20; n++) {
      const a = (n / 20) * Math.PI * 2 - Math.PI / 2, r = m - 74;
      g.save();
      g.translate(m + Math.cos(a) * r, m + Math.sin(a) * r);
      g.rotate(a + Math.PI / 2);
      g.fillStyle = n > 12 ? '#7a0706' : '#171413';
      g.fillText(n, 0, 0);
      g.restore();
    }
    /* 허브 자리와 구멍 두 개 — 작아서 따로 모델링하지 않고 그려 넣는다 */
    g.fillStyle = '#b99242'; g.beginPath(); g.arc(m, m, 40, 0, 7); g.fill();
    g.fillStyle = '#8a6a2c'; g.beginPath(); g.arc(m, m, 40, 0, 7);
    g.arc(m, m, 33, 0, 7, true); g.fill();
    g.fillStyle = '#241e1b';
    g.beginPath(); g.arc(m - 14, m, 8.5, 0, 7); g.arc(m + 14, m, 8.5, 0, 7); g.fill();
  });
}

/* ── 눈금 띠 — 길이 방향으로 이어지는 2D 인쇄물 ──────────
   세로가 띠 폭, 가로가 길이. UV 로 길이만큼 반복시킨다 */
function bandTexture(THREE) {
  const t = canvasTexture(THREE, 1024, 96, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H);        // 폭 방향으로 살짝 말린 음영
    bg.addColorStop(0, '#a87c1b'); bg.addColorStop(.12, '#ddab31');
    bg.addColorStop(.38, '#f2cb58'); bg.addColorStop(.62, '#e4b437');
    bg.addColorStop(.88, '#c9971f'); bg.addColorStop(1, '#8e6512');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    for (let i = 0; i < 256; i++) {                        // 인쇄 얼룩 — 규칙적이면 가짜로 보인다
      g.globalAlpha = .02 + Math.random() * .04;
      g.fillStyle = Math.random() > .5 ? '#fff3c4' : '#6b4d10';
      g.fillRect(Math.random() * W, Math.random() * H, 6 + Math.random() * 40, 1 + Math.random() * 3);
    }
    g.globalAlpha = 1;

    const STEP = W / 40;                                   // 한 칸 = 1cm, 40칸이 한 바퀴
    for (let i = 0; i < 40; i++) {
      const x = i * STEP, maj = i % 10 === 0, mid = i % 5 === 0;
      const len = maj ? H * .52 : (mid ? H * .34 : H * .20);
      g.fillStyle = '#171413'; g.globalAlpha = .07;        // 잉크 번짐
      g.fillRect(x - 1.4, H - len - 2, maj ? 6 : 4.4, len + 2);
      g.globalAlpha = maj ? .88 : (mid ? .7 : .48);
      g.fillRect(x, H - len, maj ? 3.4 : 2.2, len);
    }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 30px "IBM Plex Mono", ui-monospace, monospace';
    for (let i = 0; i < 4; i++) {                          // 10칸마다 붉은 숫자, 길이에 직각
      g.save();
      g.translate(i * STEP * 10 + 17, H * .26);
      g.rotate(-Math.PI / 2);
      g.fillStyle = '#7a0706'; g.fillText((i + 1) * 10, 0, 0);
      g.restore();
    }
    g.fillStyle = 'rgba(255,246,214,.5)'; g.fillRect(0, 1, W, 2);   // 위 모서리 빛
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, H - 3, W, 3);     // 아래 모서리 그늘
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/* ── 테두리 홈 — 반지름을 각도에 따라 물결치게 준 원통 ──── */
function ribbedRim(THREE, y0, y1) {
  const SU = CASE.RIBS * 4, SV = 6;
  const pos = [], nor = [], idx = [];
  for (let j = 0; j <= SV; j++) {
    const v = j / SV, y = y0 + (y1 - y0) * v;
    /* 위아래 끝은 케이스 몸통에 맞물리도록 홈을 죽인다 */
    const fade = Math.min(1, Math.min(v, 1 - v) / .18);
    for (let i = 0; i <= SU; i++) {
      const a = i / SU * Math.PI * 2;
      const r = 1 + CASE.RIB_AMP * Math.cos(a * CASE.RIBS) * fade;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      nor.push(Math.sin(a), 0, Math.cos(a));
    }
  }
  const C = SU + 1;
  for (let j = 0; j < SV; j++) for (let i = 0; i < SU; i++) {
    const p = j * C + i;
    idx.push(p, p + C, p + 1, p + 1, p + C, p + C + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ── 케이스 ─────────────────────────────────────────── */
function buildCase(THREE) {
  const { H, WELL_R, WELL_D } = CASE;
  const V = (r, y) => new THREE.Vector2(r, y);
  const g = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: TAPE_COLORS.shell, roughness: .34, metalness: 0,
    clearcoat: .55, clearcoatRoughness: .18      // 광을 과하게 주면 빨강이 분홍으로 뜬다
  });

  /* 몸통 — 아래위 모서리가 둥글고, 윗면 가운데가 우묵하게 파였다 */
  const profile = [
    V(0, 0), V(.62, 0), V(.82, .01), V(.93, .05), V(.985, .13),
    V(.985, H - .13), V(.93, H - .05), V(.82, H - .01), V(WELL_R + .05, H),
    V(WELL_R, H - .012), V(WELL_R - .012, H - WELL_D), V(0, H - WELL_D)
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 96), shellMat));
  g.add(new THREE.Mesh(ribbedRim(THREE, .13, H - .13), shellMat));

  /* 눈금판 */
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(WELL_R - .015, 64),
    new THREE.MeshStandardMaterial({ map: dialTexture(THREE), roughness: .58 })
  );
  dial.rotation.x = -Math.PI / 2;
  dial.position.y = H - WELL_D + .004;
  g.add(dial);

  /* 띠가 나오는 구멍 — 케이스 옆구리에 낸 어두운 홈 */
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(CASE.TAPE_W + .06, .1, .16),
    new THREE.MeshStandardMaterial({ color: 0x1a0f0e, roughness: .9 })
  );
  slot.position.set(.94, H * .42, 0);
  slot.rotation.y = Math.PI / 2;
  g.add(slot);

  /* 벨트 클립 — 반대쪽 옆구리의 강철 조각 */
  const steel = new THREE.MeshStandardMaterial({
    color: TAPE_COLORS.steel, metalness: .92, roughness: .28
  });
  const clip = new THREE.Mesh(new THREE.BoxGeometry(.30, .09, .26), steel);
  clip.position.set(-1.0, H * .5, 0);
  clip.rotation.z = .18;
  g.add(clip);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), steel);
  knob.position.set(-1.1, H * .5 + .04, 0);
  g.add(knob);

  return { group: g, dial };
}

/* ── 눈금 띠 — 책상 위를 따라 굽은 평평한 리본 ─────────────
   전체를 한 번 만들어 두고 setDrawRange 로 보이는 만큼만 그린다.
   매 프레임 지오메트리를 다시 만들지 않아 가볍다 */
const BAND_PATH = [[1.02, .12], [2.2, .58], [3.2, -.34], [4.25, .34]];   // [x, z] 3차 베지에
const BAND_SEGS = 72;

function buildBand(THREE) {
  const W = CASE.TAPE_W, P = BAND_PATH;
  const pts = [];
  for (let i = 0; i <= BAND_SEGS; i++) {
    const u = i / BAND_SEGS, v = 1 - u;
    pts.push([
      v*v*v*P[0][0] + 3*v*v*u*P[1][0] + 3*v*u*u*P[2][0] + u*u*u*P[3][0],
      v*v*v*P[0][1] + 3*v*v*u*P[1][1] + 3*v*u*u*P[2][1] + u*u*u*P[3][1]
    ]);
  }
  const pos = [], uv = [], idx = [];
  let run = 0;
  for (let i = 0; i <= BAND_SEGS; i++) {
    const p = pts[i];
    const a = pts[Math.min(i + 1, BAND_SEGS)], b = pts[Math.max(i - 1, 0)];
    const tx = a[0] - b[0], tz = a[1] - b[1], L = Math.hypot(tx, tz) || 1;
    const nx = -tz / L, nz = tx / L;                    // 진행 방향의 직각 = 띠 폭 방향
    if (i > 0) run += Math.hypot(p[0] - pts[i-1][0], p[1] - pts[i-1][1]);
    /* 멀어질수록 살짝 좁아지게 — 풀린 띠가 가늘어 보이는 실제 모습 */
    const w = W * (1 - .22 * (i / BAND_SEGS)) / 2;
    pos.push(p[0] + nx * w, .012, p[1] + nz * w);
    pos.push(p[0] - nx * w, .012, p[1] - nz * w);
    uv.push(run / 1.6, 1, run / 1.6, 0);
  }
  for (let i = 0; i < BAND_SEGS; i++) {
    const q = i * 2;
    idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, pts };
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

  const { group: shell, dial } = buildCase(THREE);
  tilter.add(shell);

  /* 띠 — 케이스와 함께 들리면 끊겨 보이므로 책상에 그대로 둔다 */
  const { geo: bandGeo, pts } = buildBand(THREE);
  const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({
    map: bandTexture(THREE), roughness: .72, side: THREE.DoubleSide
  }));
  root.add(band);

  /* 끝단 금속 후크 */
  const hook = new THREE.Mesh(
    new THREE.BoxGeometry(.07, .05, CASE.TAPE_W + .06),
    new THREE.MeshStandardMaterial({ color: TAPE_COLORS.steel, metalness: .9, roughness: .26 })
  );
  hook.position.y = .03;
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
    pull: spring(.22, 46, 12),                           // 띠가 풀린 정도 0~1 — 평소에도 조금 나와 있다
    tx:   spring(0, 110, 12),
    tz:   spring(0, 110, 12)
  };

  function apply() {
    const l = S.lift.value, p = Math.max(0, Math.min(1, S.pull.value));

    lifter.position.y = l * .38;
    tilter.rotation.x = S.tx.value;
    tilter.rotation.z = S.tz.value;

    /* 띠 — 보이는 만큼만 그린다 */
    const seg = Math.max(1, Math.round(p * BAND_SEGS));
    bandGeo.setDrawRange(0, seg * 6);

    /* 후크는 띠 끝에 붙어 간다 */
    const i = Math.min(seg, BAND_SEGS), a = pts[i], b = pts[Math.max(i - 1, 0)];
    hook.position.x = a[0]; hook.position.z = a[1];
    hook.rotation.y = Math.atan2(a[0] - b[0], a[1] - b[1]);

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
      S.pull.target = on ? 1 : .22;
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
