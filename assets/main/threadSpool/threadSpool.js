/*
  실패 3D 모델 + 호버 인터랙션
  레퍼런스: 검정 나무 끝판 두 장, 가운데가 살짝 불룩하게 감긴 빨간 실, 크림색 심, 풀린 실 한 가닥.
  단면 곡선을 한 바퀴 돌려(Lathe) 만든다. 실 결과 나뭇결은 코드로 그린 무늬.

  눕혀 두고, 호버하면 앞으로 살짝 굴렀다가 떼면 돌아온다.
  미끄러지지 않고 구르도록 — 굴러간 거리 = 회전각 × 끝판 반지름.

  쓰는 법
    import { createThreadSpool } from './threadSpool.js';
    const spool = createThreadSpool(THREE, scene, { x: 0, z: 0 });
    spool.setHover(true);   // 구르기
    spool.update(dt);       // 매 프레임. 움직임이 남아 있으면 true

  단위: 끝판 반지름 1. 실패 축은 x 방향, 바닥은 y = 0.
*/

/* 레퍼런스 사진에서 잰 비율 (끝판 반지름 = 1) */
const SPOOL = {
  FLANGE_R: 1,        // 끝판 반지름
  FLANGE_T: .32,      // 끝판 두께
  LEN: 1.9,           // 끝판 사이 실 감긴 길이
  THREAD_END: .86,    // 끝판 가까이 실 반지름
  THREAD_MID: .98,    // 가운데 실 반지름 — 살짝 불룩
  CORE_OUT: .33,      // 심 바깥 반지름
  CORE_IN: .22,       // 심 구멍 반지름
  ROLL: .55           // 호버 때 구르는 각도(라디안) — 약 30°
};

export const SPOOL_COLORS = { thread: 0x8e0f17, wood: 0x151213, core: 0xeee6d4 };   // 풀린 실도 몸통과 같은 깊은 빨강

/* ── 무늬 ───────────────────────────────────────────── */
function canvasTexture(THREE, size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* 실 결 — 레퍼런스를 보고 그린 이미지(threadWound.webp)와 요철용 흑백 이미지.
   가로가 둘레 한 바퀴, 세로가 실 감긴 길이에 맞춰 그렸고 좌우 끝이 이어진다.
   두 이미지는 assets/main/threadTexturePainter.html 로 그렸다. 결을 바꾸려면 그 파일을 고쳐 다시 그린다 */
function threadTextures(THREE) {
  const load = name => new THREE.TextureLoader().load(new URL(name, import.meta.url).href);
  const map = load('./threadWound.webp');
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = load('./threadWoundBump.webp');
  for (const t of [map, bump]) { t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, bump };
}

/* 실 몸통 — 가운데가 불룩한 통에, 실이 뭉친 듯 곳곳이 아주 살짝 도톰하다 */
function barrelGeometry(THREE) {
  const { LEN, THREAD_END, THREAD_MID } = SPOOL;
  const SU = 288, SV = 110;                             // 촘촘해야 곡면이 매끈하게 돈다
  const rnd = seeded(23);
  const lumps = Array.from({ length: 34 }, () => ({    // 뭉친 자리
    a: rnd() * Math.PI * 2, y: (rnd() - .5) * LEN * .9,
    h: (rnd() - .35) * .009, wa: .35 + rnd() * .4, wy: .2 + rnd() * .3   // 아주 살짝, 넓게
  }));
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= SV; j++) {
    const v = j / SV, y = -LEN / 2 + LEN * v, u2 = (2 * y / LEN) ** 2;
    const base = THREAD_END + (THREAD_MID - THREAD_END) * (1 - u2);
    const edge = Math.min(1, (1 - Math.abs(2 * y / LEN)) / .08);   // 끝판 닿는 곳은 매끈하게
    for (let i = 0; i <= SU; i++) {
      const a = i / SU * Math.PI * 2;
      let r = base;
      for (const L of lumps) {
        let da = Math.abs(a - L.a); da = Math.min(da, Math.PI * 2 - da);
        r += L.h * Math.exp(-((da / L.wa) ** 2) - (((y - L.y) / L.wy) ** 2));
      }
      r = base + (r - base) * edge;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push(i / SU, v);
    }
  }
  const C = SU + 1;
  for (let j = 0; j < SV; j++) for (let i = 0; i < SU; i++) {
    const p = j * C + i;
    idx.push(p, p + 1, p + C, p + 1, p + C + 1, p + C);   // 바깥을 보도록 감는 순서
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  /* 둘레의 시작과 끝 열은 같은 자리 — 법선을 평균 내어 이음선을 없앤다 */
  const n = geo.attributes.normal;
  for (let j = 0; j <= SV; j++) {
    const a = j * C, b = a + SU;
    const x = n.getX(a) + n.getX(b), yv = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, yv, z) || 1;
    n.setXYZ(a, x / l, yv / l, z / l); n.setXYZ(b, x / l, yv / l, z / l);
  }
  return geo;
}

/* 끝판 나무 — 거의 검정에 옅은 결 */
function woodTexture(THREE) {
  return canvasTexture(THREE, 256, (g, N) => {
    g.fillStyle = '#161314'; g.fillRect(0, 0, N, N);
    const rnd = seeded(11);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(80,72,70,${.05 + rnd() * .08})`;
      g.lineWidth = .6 + rnd() * 1.4;
      const y = rnd() * N;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(N * .3, y + (rnd() - .5) * 10, N * .7, y + (rnd() - .5) * 10, N, y);
      g.stroke();
    }
  });
}

/* ── 모양 ───────────────────────────────────────────── */
/* 실패 한 개 — y 축을 중심으로 세워 만든 뒤 눕힌다 */
function buildSpool(THREE) {
  const { FLANGE_R, FLANGE_T, LEN, THREAD_END, THREAD_MID, CORE_OUT, CORE_IN } = SPOOL;
  const V = (r, y) => new THREE.Vector2(r, y);
  const g = new THREE.Group();

  /* 실 — 가운데가 불룩한 통 */
  const tex = threadTextures(THREE);
  const threadMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: tex.map, bumpMap: tex.bump, bumpScale: 1.1,   // 크면 가닥이 면발처럼 부푼다
    roughness: .78, sheen: .12, sheenColor: new THREE.Color(0xa8222c), sheenRoughness: .6,   // 광은 죽이고
    envMapIntensity: .35                                // 주변 반사를 줄여야 어두운 면이 깊어진다
  });
  g.add(new THREE.Mesh(barrelGeometry(THREE), threadMat));

  /* 끝판 — 모서리가 둥근 두꺼운 원판 */
  const woodMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: woodTexture(THREE), roughness: .55, clearcoat: .3, clearcoatRoughness: .45   // 모서리에 은은한 반사
  });
  const rim = new THREE.SplineCurve([
    V(FLANGE_R - .1, 0), V(FLANGE_R - .02, .03), V(FLANGE_R, .12),
    V(FLANGE_R, FLANGE_T - .12), V(FLANGE_R - .02, FLANGE_T - .03), V(FLANGE_R - .1, FLANGE_T)
  ]).getPoints(24);
  const fPts = [V(CORE_OUT, 0), ...rim, V(CORE_OUT, FLANGE_T)];
  const flangeGeo = new THREE.LatheGeometry(fPts, 96);
  const top = new THREE.Mesh(flangeGeo, woodMat);
  top.position.y = LEN / 2;
  const bottom = new THREE.Mesh(flangeGeo, woodMat);
  bottom.position.y = -LEN / 2 - FLANGE_T;
  g.add(top, bottom);

  /* 심 — 크림색 관. 끝판 밖으로 살짝 나오고 가운데는 비어 있다 */
  const H = LEN / 2 + FLANGE_T + .03;
  const coreMat = new THREE.MeshStandardMaterial({ color: SPOOL_COLORS.core, roughness: .45, side: THREE.DoubleSide });
  const core = new THREE.Mesh(new THREE.LatheGeometry([
    V(CORE_IN, -H), V(CORE_OUT, -H), V(CORE_OUT - .005, -H + .01),
    V(CORE_OUT - .005, H - .01), V(CORE_OUT, H), V(CORE_IN, H), V(CORE_IN, -H)
  ], 64), coreMat);
  g.add(core);

  g.rotation.z = Math.PI / 2;                           // 눕힌다 — 축이 x 방향
  return { group: g, threadMat };
}

/* ── 조립 + 인터랙션 ─────────────────────────────────── */
function spring(value, stiffness, damping) { return { value, target: value, v: 0, stiffness, damping }; }
function stepSpring(s, dt, instant) {
  if (instant) { s.value = s.target; s.v = 0; return; }
  const a = s.stiffness * (s.target - s.value) - s.damping * s.v;
  s.v += a * dt; s.value += s.v * dt;
}

export function createThreadSpool(THREE, scene, { x = 0, z = 0, size = 1, turn = 0 } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const R = SPOOL.FLANGE_R;

  const root = new THREE.Group();                       // 놓인 자리와 방향 — 움직이지 않는다
  root.position.set(x, 0, z);
  root.rotation.y = turn;
  root.scale.setScalar(size);
  scene.add(root);

  const roller = new THREE.Group();                     // 구르며 앞으로 가는 부분
  root.add(roller);
  const spin = new THREE.Group();                       // 제 축으로 도는 부분
  spin.position.y = R;                                  // 끝판이 바닥에 닿는다
  roller.add(spin);
  const { group: spool, threadMat } = buildSpool(THREE);
  spin.add(spool);

  /* 바닥 그림자 */
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false,
      map: new THREE.CanvasTexture((() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        r.addColorStop(0, 'rgba(0,0,0,.8)'); r.addColorStop(.6, 'rgba(0,0,0,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c;
      })())
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(SPOOL.LEN + SPOOL.FLANGE_T * 2 + .6, 1.4, 1);
  shadow.position.y = .005;
  roller.add(shadow);

  /* 풀린 실 — 몸통에서 풀려 나와 바닥을 따라 늘어진다.
     바닥에 닿은 부분은 그대로 있고, 몸통에서 나오는 쪽만 구르는 대로 따라간다 */
  const tailMat = new THREE.MeshStandardMaterial({ color: SPOOL_COLORS.thread, roughness: .6 });
  const tail = new THREE.Mesh(new THREE.BufferGeometry(), tailMat);
  root.add(tail);
  const TAIL_X = .55;                                   // 몸통 길이 방향에서 실이 풀려 나오는 자리
  const floorPts = [
    new THREE.Vector3(TAIL_X + .25, .012, 1.45),
    new THREE.Vector3(TAIL_X + .8, .012, 1.9),
    new THREE.Vector3(TAIL_X + 1.5, .012, 2.05),
    new THREE.Vector3(TAIL_X + 2.1, .012, 2.5)
  ];
  const leave = new THREE.Vector3();
  function rebuildTail(roll) {
    /* 몸통 표면에서 실이 떨어지는 점 — 앞쪽 아래. 실은 접선으로 풀려 나오므로
       실패가 돌아도 이 점은 중심 기준 같은 자리에 있고, 중심만 굴러간 만큼 옮겨 간다 */
    const phi = -.9;                                    // 앞(+z)에서 아래로 기운 각도
    const r = SPOOL.THREAD_END + (SPOOL.THREAD_MID - SPOOL.THREAD_END) * (1 - (2 * TAIL_X / SPOOL.LEN) ** 2);
    leave.set(TAIL_X, R + Math.sin(phi) * r, roll * R + Math.cos(phi) * r);
    const drop = leave.clone().add(new THREE.Vector3(.06, -.18, .22));   // 바닥 위에서 휘어 내려온다
    const curve = new THREE.CatmullRomCurve3([leave, drop, ...floorPts]);
    tail.geometry.dispose();
    tail.geometry = new THREE.TubeGeometry(curve, 80, .012, 6, false);
  }

  const S = { roll: spring(0, 55, 10) };
  let last = null;                                      // 아직 한 번도 안 그림

  function apply() {
    const a = S.roll.value;
    spin.rotation.x = a;                                // 제 축으로 돌고
    roller.position.z = a * R;                          // 그만큼 앞으로 — 미끄러지지 않는다
    if (last === null || Math.abs(a - last) > 1e-4) { rebuildTail(a); last = a; }
  }
  apply();

  return {
    root,
    hitTarget: spin,                                    // 호버 판정용
    setHover(on) { S.roll.target = on ? SPOOL.ROLL : 0; },
    update(dt) {
      stepSpring(S.roll, dt, instant);
      apply();
      return Math.abs(S.roll.target - S.roll.value) > 1e-4 || Math.abs(S.roll.v) > 1e-4;
    }
  };
}
