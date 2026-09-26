/* ── 휴대용 쪽가위 (에뛰드) — 캡을 씌워 들고 다니는 수예용 쪽가위 (1 = 1mm) ─────────
   레퍼런스: 둥근 막대 모양 플라스틱 몸통 + 앞쪽 절반을 덮는 캡.
   몸통 뒤쪽은 통으로 된 손잡이(윗면에 흰 타원 패드), 앞쪽에서 두 갈래 팔로 갈라진다.
   팔 끝마다 넓적한 날이 박혀 있다 — 날은 팔 폭 그대로 나와 안쪽으로 비스듬히 모이고,
   가운데에서 서로 겹친 뒤 끝이 나란히 뾰족하게 뻗는다.
   캡을 씌우면 두 팔이 붙어 있다가, 캡을 빼면 반동으로 살짝 벌어지며 날 끝이 V자가 된다.
   캡과 손잡이 이음매는 위아래가 어긋난 계단 모양.
   캡 모양은 나중에 에뛰드 화장품처럼 바꿀 예정 — buildCap() 만 갈아 끼우면 된다.

   const snips = createScissors(THREE, scene, { x, z, size, turn });
   → { root, hitTarget, setHover(on), update(dt) }
   원점은 몸통 한가운데 바닥, 날이 +x 쪽. 호버하면 캡이 앞으로 빠져 옆에 놓이고 팔이 튕기듯 벌어진다. */

export const SNIPS = {
  /* 몸통 */
  LEN: 108,        // 캡까지 씌운 전체 길이
  W: 17,           // 폭
  HALF: 5.6,       // 위·아래 한 겹 두께
  R: 7,            // 평면 모서리 둥글기
  BEVEL: 1.4,      // 모서리 깎임
  /* 이음매 — 윗겹과 아랫겹 이음매가 어긋나 계단이 된다 (몸통 가운데 기준 x) */
  SEAM_TOP: -2,
  SEAM_BOT: 7,
  /* 흰 패드 */
  PAD_FROM: -50, PAD_TO: -17, PAD_W: 12.5,
  /* 두 갈래 팔 */
  FORK: -8,        // 팔이 갈라지기 시작하는 곳
  ARM_TO: 22,      // 팔 끝 = 날이 박히는 곳
  SLOT: 3.6,       // 두 팔 사이 틈
  ARM_W: 6.4,      // 팔 한 쪽 폭
  ARM_H: 7,        // 팔 두께
  /* 날 */
  BLADE_TO: 51,    // 날 끝
  CROSS: 7,        // 팔 끝에서 날이 가운데까지 모이는 거리
  OVERLAP: 1.5,    // 가운데를 넘어 맞은편 날과 겹치는 폭
  TAPER: 17,       // 끝에서 이만큼 전부터 등이 비스듬히 좁아진다
  TIP_GAP: .9,     // 날 끝이 가운데에서 떨어진 거리 — 두 날 끝이 이 두 배만큼 벌어져 V가 된다
  /* 색 */
  BODY: 0xb0121b, PAD: 0xf4f1ec, STEEL: 0xc9ccd0,
  /* 움직임 */
  CAP_OUT: 70,     // 캡이 앞으로 빠지는 거리
  CAP_SIDE: 26,    // 빠진 캡이 옆으로 놓이는 거리
  ARM_OPEN: .025,  // 팔 한 쪽이 갈라지는 곳을 축으로 벌어지는 각 (rad)
  BITE: -.35,      // 오므릴 때 가운데를 넘어 날끼리 스치는 정도 (ARM_OPEN 에 대한 비율)
  SNIPS: 0         // 벌어진 뒤 싹둑 횟수 (0 = 벌어진 채로 쉰다)
};

export function spring(value, stiffness, damping) { return { value, target: value, v: 0, stiffness, damping }; }
export function stepSpring(s, dt, instant) {
  if (instant) { s.value = s.target; s.v = 0; return; }
  s.v += (s.stiffness * (s.target - s.value) - s.damping * s.v) * dt;
  s.value += s.v * dt;
}

/* 평면(x, z)에서 네 모서리가 둥근 사각형 — x0~x1, z0~z1.
   r = [뒤·z0, 앞·z0, 앞·z1, 뒤·z1] 모서리 반지름. 모양의 y 는 -z 라서 부호를 뒤집어 그린다 */
export function box2(THREE, x0, x1, z0, z1, r) {
  const s = new THREE.Shape(), y0 = -z1, y1 = -z0;
  const [rb0, rf0, rf1, rb1] = r;
  s.moveTo(x0 + rb1, y0);
  s.lineTo(x1 - rf1, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + rf1);
  s.lineTo(x1, y1 - rf0);
  s.quadraticCurveTo(x1, y1, x1 - rf0, y1);
  s.lineTo(x0 + rb0, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - rb0);
  s.lineTo(x0, y0 + rb1);
  s.quadraticCurveTo(x0, y0, x0 + rb1, y0);
  return s;
}
/* 가운데 기준 폭 w 짜리 */
export const plan = (THREE, x0, x1, w, rBack, rFront) => box2(THREE, x0, x1, -w / 2, w / 2, [rBack, rFront, rFront, rBack]);

/* 평면 모양을 y0 ~ y0+h 높이로 세운 둥근 덩어리 */
export function slab(THREE, shape, y0, h, bevel) {
  const b = Math.min(bevel, h / 2 - .05);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * .9, bevelSegments: 4, curveSegments: 14
  });
  g.rotateX(-Math.PI / 2);                       // 모양의 y → -z, 두께 → +y
  g.translate(0, y0 + b, 0);
  g.computeVertexNormals();
  return g;
}

/* ── 부품 ─────────────────────────────────────────── */
function buildParts(THREE, C = SNIPS) {
  const L = C.LEN / 2, W = C.W, H = C.HALF, R = C.R, B = C.BEVEL;
  const plastic = new THREE.MeshPhysicalMaterial({ color: C.BODY, roughness: .38, clearcoat: .6, clearcoatRoughness: .3 });
  const pad = new THREE.MeshStandardMaterial({ color: C.PAD, roughness: .55 });
  const steel = new THREE.MeshStandardMaterial({ color: C.STEEL, metalness: .95, roughness: .26, side: THREE.DoubleSide });
  const inset = B * .9;                           // 둥근 모서리가 바깥으로 부푸는 만큼 안쪽으로 그린다

  /* 손잡이 — 통으로 된 뒤쪽. 아랫겹(SEAM_BOT 까지) + 윗겹(SEAM_TOP 까지) */
  const grip = new THREE.Group();
  grip.add(new THREE.Mesh(slab(THREE, plan(THREE, -L + inset, C.SEAM_BOT - inset, W - 2 * inset, R, 1), 0, H, B), plastic));
  grip.add(new THREE.Mesh(slab(THREE, plan(THREE, -L + inset, C.SEAM_TOP - inset, W - 2 * inset, R, 1), H, H, B), plastic));
  const pw = C.PAD_W;
  grip.add(new THREE.Mesh(slab(THREE, plan(THREE, C.PAD_FROM, C.PAD_TO, pw, pw / 2, pw / 2), 2 * H - .35, .8, .35), pad));

  /* 팔 + 날 — side +1 은 +z 쪽, -1 은 -z 쪽. 팔은 갈라지는 곳 안쪽 모서리를 축으로 돈다 */
  const armY = (2 * H - C.ARM_H) / 2;
  const arm = side => {
    const pivot = new THREE.Group();
    const zIn = C.SLOT / 2, zOut = zIn + C.ARM_W;
    pivot.position.set(C.FORK, 0, side * zIn);
    const part = new THREE.Group();
    part.position.set(-C.FORK, 0, -side * zIn);
    pivot.add(part);

    /* 팔 — 모서리가 둥근 긴 막대. 바깥 앞 모서리가 둥글다
       (스케일 -1 로 뒤집으면 면이 뒤집혀 안 보이므로 좌표를 직접 뒤집어 그린다) */
    const r = side > 0 ? [.8, 2.2, 2.2, .8] : [.8, 2.2, 2.2, .8];
    const shape = side > 0
      ? box2(THREE, C.FORK, C.ARM_TO, zIn + .4, zOut - .4, r)
      : box2(THREE, C.FORK, C.ARM_TO, -(zOut - .4), -(zIn + .4), r);
    part.add(new THREE.Mesh(slab(THREE, shape, armY, C.ARM_H, 1), plastic));

    /* 날 — 팔 폭 그대로 나와 안쪽으로 비스듬히 모이고, 가운데를 조금 넘어 겹친 뒤 끝으로 뾰족하게.
       두께만큼 높이를 어긋나게 둬서 맞은편 날과 스친다 */
    const s = new THREE.Shape();
    const x0 = C.ARM_TO - 6, xa = C.ARM_TO, xc = C.ARM_TO + C.CROSS, xt = C.BLADE_TO;
    const out = zOut - 1.2, inn = zIn + .3, mid = -C.OVERLAP;
    const P = (x, z) => [x, -side * z];          // 모양의 y = -z. -z 쪽 날은 좌표째 뒤집는다
    s.moveTo(...P(x0, inn));
    s.lineTo(...P(x0, out));
    s.lineTo(...P(xt - C.TAPER, out));           // 등 — 곧게
    s.lineTo(...P(xt, C.TIP_GAP));               // 끝으로 비스듬히 좁아져 뾰족 — 끝은 가운데에서 살짝 떨어져 있다
    s.lineTo(...P(xc + 6, mid));                 // 안쪽 날 — 가운데를 넘어 겹쳤다가 끝으로 살짝 벌어진다
    s.lineTo(...P(xc, mid));
    s.lineTo(...P(xa + 1.5, inn));               // 팔 쪽으로 비스듬히 벌어진다
    s.closePath();
    const hole = new THREE.Path();               // 날을 팔에 박는 작은 구멍
    const [hx, hy] = P(xa + 4, (inn + out) / 2 + .6);
    hole.absarc(hx, hy, 1.1, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const bg = new THREE.ExtrudeGeometry(s, { depth: .7, bevelEnabled: false, curveSegments: 16 });
    bg.rotateX(-Math.PI / 2);
    bg.translate(0, side > 0 ? H - .7 : H, 0);
    bg.computeVertexNormals();
    part.add(new THREE.Mesh(bg, steel));
    return pivot;
  };
  const arms = [arm(1), arm(-1)];

  return { grip, arms, plastic, pad, steel };
}

/* 캡 — 윗겹·아랫겹 이음매가 어긋난 계단 모양. 에뛰드 모양으로 바꿀 땐 이 함수만 바꾼다 */
function buildCap(THREE, plastic, C = SNIPS) {
  const L = C.LEN / 2, W = C.W, H = C.HALF, R = C.R, B = C.BEVEL, inset = B * .9;
  const cap = new THREE.Group();
  cap.add(new THREE.Mesh(slab(THREE, plan(THREE, C.SEAM_BOT + inset, L - inset, W - 2 * inset, 1, R), 0, H, B), plastic));
  cap.add(new THREE.Mesh(slab(THREE, plan(THREE, C.SEAM_TOP + inset, L - inset, W - 2 * inset, 1, R), H, H, B), plastic));
  return cap;
}

/* ── 조립 + 인터랙션 ─────────────────────────────────── */
export function createScissors(THREE, scene, { x = 0, z = 0, size = 1, turn = 0 } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = SNIPS;

  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = turn;
  root.scale.setScalar(size);
  scene.add(root);

  const body = new THREE.Group();                 // 몸통 (들림)
  root.add(body);
  const { grip, arms, plastic } = buildParts(THREE, C);
  body.add(grip, ...arms);

  const cap = buildCap(THREE, plastic, C);
  const capMove = new THREE.Group();              // 캡이 빠져나가는 몫
  capMove.add(cap);
  root.add(capMove);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const S = {
    lift: spring(0, 140, 16),
    off: spring(0, 60, 11),                       // 0 씌움 · 1 빠져서 옆에 놓임
    open: spring(0, 190, 6.5)                     // 캡이 빠질 때 튕기듯 벌어졌다 자리 잡는 반동
  };
  let hovered = false, snipT = -1;                // 싹둑 타이머 (-1 = 안 함)

  function apply() {
    const l = S.lift.value, o = Math.max(0, S.off.value);
    body.position.y = l * 6;

    /* 캡 — 앞으로 쭉 빠진 뒤(0~.55) 옆으로 비켜 내려앉는다(.55~1). 빠지는 동안은 몸통과 같이 들려 있다 */
    const pull = Math.min(1, o / .55), aside = Math.max(0, (o - .55) / .45);
    const e = aside * aside * (3 - 2 * aside);
    capMove.position.set(C.CAP_OUT * pull, l * 6 * (1 - e) + Math.sin(Math.PI * aside) * 10, C.CAP_SIDE * e);
    capMove.rotation.y = -.35 * e;

    /* 팔 — 1 벌어짐(쉬는 자세) · 0 캡 속에서 붙어 있음 · 0 아래 = 쥐어서 날끼리 스침 */
    const a = C.ARM_OPEN * Math.max(C.BITE, S.open.value);
    arms[0].rotation.y = -a;                      // +z 쪽 팔은 +z 로
    arms[1].rotation.y = a;                       // -z 쪽 팔은 -z 로
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
      /* 캡이 날 끝을 벗어나는 순간 튕겨 벌어진다. SNIPS 가 있으면 반동이 가라앉은 뒤 싹둑.
         캡이 다시 씌워질 땐 붙어서 들어간다 */
      if (hovered && S.off.value > .32) {
        snipT += dt;
        const k = Math.floor(Math.max(0, snipT - .7) / .26);   // 1 오므림 · 2 벌림 · 3 오므림 …
        S.open.target = snipT > .7 && k >= 1 && k <= C.SNIPS * 2 && k % 2 === 1 ? C.BITE : 1;
      } else if (!hovered) {
        S.open.target = S.off.value < .45 ? 0 : 1;    // 캡이 날 가까이 오면 붙는다
      }
      for (const k in S) stepSpring(S[k], dt, instant);
      apply();
    }
  };
}
