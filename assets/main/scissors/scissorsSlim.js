/* ── 휴대용 쪽가위 (에뛰드) — 슬림형 · 확정 디자인 (1 = 1mm) ─────────────
   레퍼런스: 크림색 쪽가위 + 날만 덮는 짧은 캡(원래 투명, 여기선 불투명).
   닫혀 있을 땐 넓은 막대 하나처럼 보이고, 두 팔을 가르는 선이 윗면을 S자로 비스듬히 가로지른다.
     ① 버튼 팔(-z) — 둥근 뒤 끝과 버튼을 통째로 가진다. 앞으로 갈수록 좁아진다.
     ② 옆 팔(+z)  — 버튼 근처에서 뾰족하게 시작해 앞으로 갈수록 넓어진다.
   캡을 빼면 두 짝이 뒤 끝 원판(버튼)을 축으로 반대 방향으로 같이 튕기며 벌어져 곡선 틈이 생기고, 날 끝이 V자가 된다.
   팔 앞쪽엔 날 등을 따라 뻗는 가는 막대와 미끄럼 방지 홈.
   날은 등이 둥근 잎 모양 — 뿌리 쪽에서 서로 교차한 뒤 끝으로 벌어진다.
   캡 모양은 나중에 에뛰드 화장품처럼 바꿀 예정 — buildCap() 만 갈아 끼우면 된다.

   const snips = createScissorsSlim(THREE, scene, { x, z, size, turn });
   → { root, hitTarget, setHover(on), update(dt) }   (scissors.js 의 createScissors 와 같은 방식)
   원점은 몸통 한가운데 바닥, 날이 +x 쪽. */

import { spring, stepSpring, box2, slab } from './scissors.js';

export const SLIM = {
  /* 몸통 */
  REAR: -58,       // 뒤 끝
  ARM_TO: 6,       // 팔 끝 = 날이 박히는 곳
  W: 18,           // 닫혀 있을 때 전체 폭
  H: 7,            // 두께
  BEVEL: 2,        // 모서리 둥글기
  SEAM_FROM: -44,  // ② 팔이 뾰족하게 시작하는 곳 (가르는 선의 뒤 끝)
  SEAM_MID: -8,    // 가르는 선이 가운데에 닿는 곳 — 여기부터 앞까지는 곧게
  SEAM_Z: -.6,     // 앞쪽에서 가르는 선의 z (가운데보다 살짝 ① 쪽)
  GAP: .35,        // 가르는 선의 틈 (한쪽)
  BUTTON: 3.6,     // 뒤 끝 윗면 버튼 반지름
  STEM: 13,        // 팔 끝에서 날 등을 따라 뻗는 가는 막대 길이
  /* 날 */
  BLADE_TO: 52,    // 날 끝
  CROSS: 4.2,      // 뿌리 쪽에서 날이 가운데를 넘어 교차하는 깊이 (붙어 있을 때)
  TIP_Z: -.3,      // 붙어 있을 때 날 끝 위치 (가운데 기준, 음수면 살짝 겹침)
  /* 캡 — 날만 덮는 짧은 U자 */
  CAP_FROM: 1, CAP_TO: 60, CAP_W: 20, CAP_H: 7.5,   // 높이는 몸통(7)보다 살짝만 높게
  /* 색 */
  BODY: 0xeee8dc, CAP: 0xf4f0e8, BUTTON_C: 0xe2dacb, STEEL: 0xc9ccd0,
  /* 움직임 */
  CAP_OUT: 70, CAP_SIDE: 28,
  ARM_OPEN: .045,  // 팔 한 짝이 뒤 끝 원판을 축으로 벌어지는 각 (rad) — 두 짝이 반대로 같이 벌어진다
  BITE: -.1,
  SNIPS: 0
};

function buildParts(THREE, C = SLIM) {
  const H = C.H, hw = C.W / 2, g = C.BEVEL * .9, e = hw - g;   // e: 둥근 모서리가 부푸는 만큼 안쪽 선
  const plastic = new THREE.MeshPhysicalMaterial({ color: C.BODY, roughness: .5, clearcoat: .25, clearcoatRoughness: .5 });
  const btn = new THREE.MeshStandardMaterial({ color: C.BUTTON_C, roughness: .45 });
  const steel = new THREE.MeshStandardMaterial({ color: C.STEEL, metalness: .95, roughness: .24, side: THREE.DoubleSide });
  const P = (x, z) => [x, -z];                    // 모양의 y = -z

  /* 가르는 선 — 뒤(SEAM_FROM)에선 +z 가장자리, SEAM_MID 에서 가운데로 S자로 내려와 앞까지 곧게 */
  const seam = x => {
    const t = Math.min(1, Math.max(0, (x - C.SEAM_FROM) / (C.SEAM_MID - C.SEAM_FROM)));
    return hw + (C.SEAM_Z - hw) * t * t * (3 - 2 * t);
  };
  const N = 40, xs = [];
  for (let i = 0; i <= N; i++) xs.push(C.ARM_TO - g - (C.ARM_TO - g - C.SEAM_FROM) * i / N);   // 앞 → 뒤

  const out = hw - 2.4;                           // 날 등이 오는 z (한 짝 기준, 바깥쪽)
  /* 몸체 한 짝 — ① 과 ② 는 똑같이 생긴 부품이고, ② 는 ① 을 길이 방향으로 뒤집어 포갠 것이다.
     한 짝은 위층·아래층 두 겹: 위층은 뒤 끝 원판 + 가르는 선 아래쪽(-z), 아래층은 거울 선 아래쪽.
     뒤집어 포개면 위층끼리·아래층끼리 가르는 선을 사이에 두고 딱 맞물리고,
     뒤 끝 원판은 ① 의 위층과 ② 의 아래층이 포개져 버튼을 축으로 부드럽게 돈다 */
  const hl = H / 2, gl = Math.min(C.BEVEL, hl - .05) * .9, el = hw - gl;
  const bx = C.REAR + hw;                         // 뒤 끝 원판 중심 = 버튼 = 회전축
  const half = () => {
    const part = new THREE.Group();

    /* 위층 — 뒤 끝 원판 전체 + 가르는 선 아래쪽 */
    const st = new THREE.Shape();
    const zT = x => Math.min(el, seam(x) - C.GAP - gl);
    st.moveTo(...P(C.ARM_TO - gl, -el));
    for (const x of xs) st.lineTo(...P(x, zT(x)));
    st.lineTo(...P(bx, el));
    st.absarc(bx, 0, el, -Math.PI / 2, -Math.PI * 1.5, true);   // 뒤 끝 반원
    st.closePath();
    part.add(new THREE.Mesh(slab(THREE, st, hl, hl, C.BEVEL), plastic));

    /* 아래층 — 거울 선 아래쪽. 뒤로 갈수록 좁아져 뾰족하게 끝난다 (맞은편 원판 밑으로 들어간다) */
    const sb = new THREE.Shape();
    const zB = x => -(seam(x) + C.GAP + gl);
    const xsB = xs.filter(x => zB(x) > -el + .6);
    const xb0 = xsB[xsB.length - 1];
    sb.moveTo(...P(C.ARM_TO - gl, -el));
    for (const x of xsB) sb.lineTo(...P(x, zB(x)));
    sb.lineTo(...P(xb0 - 3, -el));
    sb.closePath();
    part.add(new THREE.Mesh(slab(THREE, sb, 0, hl, C.BEVEL), plastic));

    /* 뒤 끝 버튼 — 테두리 고리 + 원판 (뒤집힌 짝에선 바닥 쪽에 숨는다) */
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(C.BUTTON, C.BUTTON, .6, 36), btn);
    disc.position.set(bx, H - .15, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(C.BUTTON + .2, .45, 10, 44), btn);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, H + .05, 0);
    part.add(disc, ring);

    /* 팔 앞 — 날 등을 따라 뻗는 가는 막대 + 미끄럼 방지 홈 (위·아래 둘 다 — 뒤집어도 위에 오도록) */
    const z0 = out - 1.6, z1 = out + 1.4;
    const stem = box2(THREE, C.ARM_TO - 4, C.ARM_TO + C.STEM, -z1, -z0, [.5, 1.4, 1.4, .5]);
    part.add(new THREE.Mesh(slab(THREE, stem, hl - 2.3, 4.6, 1.1), plastic));
    for (const y of [H - .05, .05]) for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(.6, .45, 3.2), plastic);
      rib.position.set(C.ARM_TO - 12 + i * 1.5, y, -(hw - 3.6));
      part.add(rib);
    }

    /* 날 — 가운데 높이 바로 위에. 뒤집힌 짝의 날은 바로 아래에 와서 서로 스친다 */
    part.add(blade());
    return part;
  };

  /* 날 — 팔 폭 그대로 나와 등은 둥글게 부풀었다 끝으로 모이고,
     안쪽 날은 뿌리에서 가운데를 넘어 교차한 뒤 곧게 끝까지 간다 (-z 쪽 짝 기준) */
  function blade() {
    const s = new THREE.Shape();
    const Q = (x, z) => [x, z];                   // -z 쪽: 모양의 y = -z = z 를 뒤집은 것
    const x0 = C.ARM_TO - 6, xa = C.ARM_TO, xt = C.BLADE_TO, inn = .4;
    s.moveTo(...Q(x0, inn));
    s.lineTo(...Q(x0, out));
    s.lineTo(...Q(xa + 2, out));
    s.bezierCurveTo(...Q(xa + 20, out + .6), ...Q(xt - 9, 3.4), ...Q(xt, C.TIP_Z));
    s.lineTo(...Q(xa + 9, -C.CROSS));
    s.lineTo(...Q(xa + 1, inn));
    s.closePath();
    const bg = new THREE.ExtrudeGeometry(s, { depth: .75, bevelEnabled: false, curveSegments: 24 });
    bg.rotateX(-Math.PI / 2);
    bg.translate(0, hl + .02, 0);
    bg.computeVertexNormals();
    return new THREE.Mesh(bg, steel);
  }

  const armA = half();                            // ① 그대로
  const pivotA = new THREE.Group();               // ① 도 원판 중심을 축으로 돈다
  pivotA.position.set(bx, 0, 0);
  armA.position.set(-bx, 0, 0);
  pivotA.add(armA);
  const flip = half();                            // ② 뒤집어 포갠다 — 길이 방향 축으로 반 바퀴
  flip.rotation.x = Math.PI;
  flip.position.set(-bx, H, 0);
  const pivot = new THREE.Group();                // ② 는 뒤 끝 원판 중심(버튼)을 축으로 돈다
  pivot.position.set(bx, 0, 0);
  pivot.add(flip);

  return { pivotA, pivot };
}

/* 캡 — 날만 덮는 짧은 U자 덮개 (불투명). 에뛰드 모양으로 바꿀 땐 이 함수만 바꾼다 */
function buildCap(THREE, C = SLIM) {
  const mat = new THREE.MeshPhysicalMaterial({ color: C.CAP, roughness: .35, clearcoat: .5, clearcoatRoughness: .3 });
  const b = 2.6, g = b * .9, hw = C.CAP_W / 2 - g, x0 = C.CAP_FROM + g, x1 = C.CAP_TO - g;
  const s = new THREE.Shape();
  const P = (x, z) => [x, -z];
  s.moveTo(...P(x0, -hw));
  s.lineTo(...P(x1 - hw * 1.1, -hw * .92));       // 앞으로 아주 살짝 좁아진다
  s.bezierCurveTo(...P(x1 - hw * .45, -hw * .9), ...P(x1, -hw * .55), ...P(x1, 0));   // 둥근 U 끝
  s.bezierCurveTo(...P(x1, hw * .55), ...P(x1 - hw * .45, hw * .9), ...P(x1 - hw * 1.1, hw * .92));
  s.lineTo(...P(x0, hw));
  s.closePath();
  const cap = new THREE.Group();
  cap.add(new THREE.Mesh(slab(THREE, s, 0, C.CAP_H, b), mat));
  return cap;
}

export function createScissorsSlim(THREE, scene, { x = 0, z = 0, size = 1, turn = 0 } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = SLIM;

  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = turn;
  root.scale.setScalar(size);
  scene.add(root);

  const body = new THREE.Group();
  root.add(body);
  const { pivotA, pivot } = buildParts(THREE, C);
  body.add(pivotA, pivot);

  const capMove = new THREE.Group();
  capMove.add(buildCap(THREE, C));
  root.add(capMove);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const S = {
    lift: spring(0, 140, 16),
    off: spring(0, 60, 11),
    open: spring(0, 190, 6.5)                     // 캡이 빠질 때 튕기듯 벌어졌다 자리 잡는 반동
  };
  let hovered = false, snipT = -1;

  function apply() {
    const l = S.lift.value, o = Math.max(0, S.off.value);
    body.position.y = l * 6;
    const pull = Math.min(1, o / .55), aside = Math.max(0, (o - .55) / .45);
    const e = aside * aside * (3 - 2 * aside);
    capMove.position.set(C.CAP_OUT * pull, l * 6 * (1 - e) + Math.sin(Math.PI * aside) * 10, C.CAP_SIDE * e);
    capMove.rotation.y = -.35 * e;
    const a = C.ARM_OPEN * Math.max(C.BITE, S.open.value);
    pivot.rotation.y = -a;                        // ② 는 +z 쪽으로
    pivotA.rotation.y = a;                        // ① 은 -z 쪽으로 — 같은 반동으로 같이 벌어진다
  }
  apply();

  return {
    root,
    hitTarget: root,
    setHover(on) {
      hovered = on;
      S.lift.target = on ? 1 : 0;
      S.off.target = on ? 1 : 0;
      snipT = on ? 0 : -1;
    },
    update(dt) {
      if (hovered && S.off.value > .32) {
        snipT += dt;
        const k = Math.floor(Math.max(0, snipT - .7) / .26);
        S.open.target = snipT > .7 && k >= 1 && k <= C.SNIPS * 2 && k % 2 === 1 ? C.BITE : 1;
      } else if (!hovered) {
        S.open.target = S.off.value < .45 ? 0 : 1;
      }
      for (const k in S) stepSpring(S[k], dt, instant);
      apply();
    }
  };
}
