/*
  ★ 최종본 (FINAL) — 빨간 원형 단추 + 아이보리 꽃 단추
     이전 버전은 archive/ 폴더에 있다.

  단추 3D 모델 + 호버 인터랙션
  텍스처 없이 회전체(Lathe)와 돌출(Extrude)만으로 만든다. 여러 3D와 함께 불러와도 가볍게.

  쓰는 법
    import { createRedButton, createCreamButton, createButtonRig } from './buttonFinal.js';
    const rig = createButtonRig(THREE, scene, createRedButton(THREE), { x: 0, z: 0, size: 1 });
    rig.setHover(true);   // 들리기
    rig.update(dt);       // 매 프레임. 움직임이 남아 있으면 true 를 돌려준다

  단위: 단추 반지름 1. 크기는 size 로 조절한다.
*/

export const BUTTON_COLORS = {
  red:    0x7c0811,   // 실·바늘꽂이처럼 짙고 맑은 빨강 (0xb30604 는 조명 아래서 빛바래 탁해 보였다)
  cream:  0xf0dcaa,   // 배경2보다 노란 기가 도는 아이보리
  thread: 0xa2855c    // 크림 단추의 십자 바느질 실
};

/* 단면 곡선을 부드럽게 이어 회전체 점 목록으로 만든다 */
function smoothProfile(THREE, keys, samples = 48) {
  return new THREE.SplineCurve(keys.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(samples);
}

/* 두 단추가 같이 쓰는 단면 — 넓게 솟은 테두리 + 오목한 가운데.
   가운데는 반지름 FLAT_R 까지 높이 FLAT_Y 로 평평하다. */
const FLAT_R = .40, FLAT_Y = .07;
const RIM_KEYS = [
  [.40, .07], [.48, .09], [.56, .17], [.66, .27], [.78, .32],
  [.89, .30], [.97, .22], [1.0, .12], [.98, .03], [.93, .00]
];

/* ── 빨간 단추 — 크림 단추와 같은 모양에 구멍 4개 ─────────── */
export function createRedButton(THREE) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: BUTTON_COLORS.red, roughness: .28, metalness: 0,
    clearcoat: .7, clearcoatRoughness: .08, envMapIntensity: .55, side: THREE.DoubleSide   // 반사가 세면 분홍빛으로 뜬다
  });

  /* 테두리 — 평평한 가운데 경계부터 바깥까지 */
  const rimPts = smoothProfile(THREE, RIM_KEYS, 64);
  rimPts.push(new THREE.Vector2(FLAT_R, 0));
  const rim = new THREE.Mesh(new THREE.LatheGeometry(rimPts, 96), mat);

  /* 가운데 — 구멍 4개 뚫린 평평한 원판 (윗면·아랫면) */
  const HOLES = [[-.16, -.16], [.16, -.16], [.16, .16], [-.16, .16]];
  const HOLE_R = .1;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, FLAT_R + .002, 0, Math.PI * 2, false);
  HOLES.forEach(([x, y]) => {
    const h = new THREE.Path();
    h.absarc(x, y, HOLE_R, 0, Math.PI * 2, true);
    shape.holes.push(h);
  });
  const faceGeo = new THREE.ShapeGeometry(shape, 48);
  const top = new THREE.Mesh(faceGeo.clone().rotateX(-Math.PI / 2), mat);
  top.position.y = FLAT_Y;
  /* 바닥면 — 윗면과 같은 방향으로 눕힌 뒤 위아래만 뒤집는다.
     반대로 눕히면(+90°) 구멍 자리가 앞뒤로 거울처럼 뒤집혀 비대칭 구멍을 막는다 */
  const bottom = new THREE.Mesh(faceGeo.rotateX(-Math.PI / 2).scale(1, -1, 1), mat);

  /* 구멍 안쪽 벽 + 둥근 가장자리 */
  const wallGeo = new THREE.CylinderGeometry(HOLE_R, HOLE_R, FLAT_Y, 32, 1, true);
  const lipGeo = new THREE.TorusGeometry(HOLE_R, .016, 10, 40).rotateX(Math.PI / 2);
  const holes = new THREE.Group();
  HOLES.forEach(([x, y]) => {
    const wall = new THREE.Mesh(wallGeo, mat);
    wall.position.set(x, FLAT_Y / 2, -y);
    const lip = new THREE.Mesh(lipGeo, mat);
    lip.position.set(x, FLAT_Y, -y);
    holes.add(wall, lip);
  });

  const g = new THREE.Group();
  g.add(rim, top, bottom, holes);
  return g;
}

/* ── 크림 꽃 단추 — 빨간 단추와 같은 단면을 쓰고 바깥 윤곽만 꽃잎 5장으로 ── */
/* 각도별 바깥 반지름. 지수가 1보다 작을수록 꽃잎은 통통하고 사이 홈은 좁다 */
function petalRadius(a) {
  return .8 + .2 * Math.pow(Math.abs(Math.cos(a * 2.5)), .55);
}

export function createCreamButton(THREE) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: BUTTON_COLORS.cream, roughness: .3, metalness: 0,
    clearcoat: .85, clearcoatRoughness: .08, side: THREE.DoubleSide
  });

  /* 곡면 — 단면 곡선을 한 바퀴 돌리되, 바깥으로 갈수록 반지름을 꽃잎 윤곽에 맞춘다.
     가운데(평평한 부분)는 원 그대로라 구멍 판과 이음새 없이 만난다 */
  const profile = smoothProfile(THREE, RIM_KEYS, 64);
  profile.push(new THREE.Vector2(FLAT_R, 0));
  const SEG = 240;
  const pos = [], idx = [];
  const smooth = t => { t = Math.min(Math.max((t - FLAT_R) / (.92 - FLAT_R), 0), 1); return t * t * (3 - 2 * t); };
  for (let i = 0; i <= SEG; i++) {
    const a = i / SEG * Math.PI * 2 + Math.PI / 2;
    const petal = petalRadius(a - Math.PI / 2);
    for (const p of profile) {
      const k = 1 + (petal - 1) * smooth(p.x);        // 가운데는 1(원), 바깥은 꽃잎
      pos.push(Math.cos(a) * p.x * k, p.y, -Math.sin(a) * p.x * k);
    }
  }
  const P = profile.length;
  for (let i = 0; i < SEG; i++)
    for (let j = 0; j < P - 1; j++) {
      const a0 = i * P + j, a1 = a0 + 1, b0 = a0 + P, b1 = b0 + 1;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shellGeo.setIndex(idx);
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, mat);

  /* 가운데 — 구멍 2개 뚫린 평평한 원판 (빨간 단추와 같은 방식) */
  const HOLES = [[-.11, .15], [.11, -.15]];
  const HOLE_R = .105;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, FLAT_R + .002, 0, Math.PI * 2, false);
  HOLES.forEach(([x, y]) => {
    const h = new THREE.Path();
    h.absarc(x, y, HOLE_R, 0, Math.PI * 2, true);
    shape.holes.push(h);
  });
  const faceGeo = new THREE.ShapeGeometry(shape, 48);
  const top = new THREE.Mesh(faceGeo.clone().rotateX(-Math.PI / 2), mat);
  top.position.y = FLAT_Y;
  /* 바닥면 — 윗면과 같은 방향으로 눕힌 뒤 위아래만 뒤집는다.
     반대로 눕히면(+90°) 구멍 자리가 앞뒤로 거울처럼 뒤집혀 비대칭 구멍을 막는다 */
  const bottom = new THREE.Mesh(faceGeo.rotateX(-Math.PI / 2).scale(1, -1, 1), mat);

  const wallGeo = new THREE.CylinderGeometry(HOLE_R, HOLE_R, FLAT_Y, 32, 1, true);
  const lipGeo = new THREE.TorusGeometry(HOLE_R, .015, 10, 40).rotateX(Math.PI / 2);
  /* 구멍 안쪽은 빛이 거의 안 들어 어둡다. 단추와 같은 밝은 색으로 두면
     기울 때 벽이 빛을 받아 구멍이 메워진 것처럼 깜빡인다 */
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(BUTTON_COLORS.cream).multiplyScalar(.18),
    roughness: .9, metalness: 0, side: THREE.DoubleSide,
    envMapIntensity: 0                                 // 스튜디오 반사를 받으면 도로 밝아진다
  });
  const holes = new THREE.Group();
  HOLES.forEach(([x, y]) => {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(x, FLAT_Y / 2, -y);
    const lip = new THREE.Mesh(lipGeo, mat);
    lip.position.set(x, FLAT_Y, -y);
    holes.add(wall, lip);
  });

  const g = new THREE.Group();
  g.add(shell, top, bottom, holes);
  return g;
}

/* ── 호버 인터랙션 — 들리고, 커서 쪽으로 기울고, 살짝 돌고, 광이 한 번 지나간다 ── */
function spring(value, stiffness, damping) {
  return { value, target: value, v: 0, stiffness, damping };
}
function stepSpring(s, dt, instant) {
  if (instant) { s.value = s.target; s.v = 0; return; }
  const a = s.stiffness * (s.target - s.value) - s.damping * s.v;
  s.v += a * dt;
  s.value += s.v * dt;
}
function settled(s) { return Math.abs(s.target - s.value) < 1e-4 && Math.abs(s.v) < 1e-4; }

let shadowTexture = null;
function getShadowTexture(THREE) {
  if (shadowTexture) return shadowTexture;             // 모든 단추가 한 장을 같이 쓴다
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.9)');
  r.addColorStop(.55, 'rgba(0,0,0,.45)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

export function createButtonRig(THREE, scene, model, { x = 0, z = 0, size = 1, spin = 0 } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const group = new THREE.Group();                     // 들림
  const pivot = new THREE.Group();                     // 기울기·회전
  pivot.add(model);
  pivot.rotation.y = spin;
  group.add(pivot);
  group.position.set(x, 0, z);
  group.scale.setScalar(size);
  scene.add(group);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 2.9),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(THREE), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -.01;
  scene.add(shadow);

  /* 광이 흐르는 빛 — 단추마다 하나, 평소엔 꺼져 있다 */
  const sweepLight = new THREE.PointLight(0xffffff, 0, 6 * size, 1.6);
  scene.add(sweepLight);

  const S = {
    lift: spring(0, 140, 13),
    tx:   spring(0, 120, 12),
    tz:   spring(0, 120, 12),
    spin: spring(0, 60, 11)
  };
  let sweep = 0;

  return {
    group,
    setHover(on) {
      S.lift.target = on ? 1 : 0;
      S.spin.target = on ? .5 : 0;
      if (!on) { S.tx.target = 0; S.tz.target = 0; }
      if (on && !instant) sweep = .0001;
    },
    /* 월드 좌표의 커서 위치 쪽으로 기운다 */
    lean(point) {
      S.tx.target = THREE.MathUtils.clamp((point.z - z) * .35, -.28, .28);
      S.tz.target = THREE.MathUtils.clamp(-(point.x - x) * .35, -.28, .28);
    },
    update(dt) {
      for (const k in S) stepSpring(S[k], dt, instant);
      const l = S.lift.value;
      group.position.y = l * .42 * size;
      pivot.rotation.x = S.tx.value;
      pivot.rotation.z = S.tz.value;
      pivot.rotation.y = spin + S.spin.value;
      shadow.scale.setScalar(size * (1 + l * .45));
      shadow.material.opacity = .85 - l * .45;
      shadow.position.x = x + (.08 + l * .25) * size;
      shadow.position.z = z + (.12 + l * .3) * size;

      if (sweep > 0) {
        sweep = Math.min(sweep + dt / .75, 1);
        const e = sweep * sweep * (3 - 2 * sweep);
        sweepLight.position.set(x + (-1.6 + e * 3.2) * size, 1.1 * size, z + (-1 + e * 2) * size);
        sweepLight.intensity = Math.sin(sweep * Math.PI) * 9 * size ** 1.6;   // 거리가 size 배로 멀어진 만큼 세게
        if (sweep >= 1) { sweep = 0; sweepLight.intensity = 0; }
      }
      return sweep > 0 || !Object.values(S).every(settled);
    }
  };
}
