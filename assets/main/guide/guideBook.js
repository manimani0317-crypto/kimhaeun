/* ── 김하은 안내서 — 책상에 눕혀 둔 얇은 책 (1 = 1mm) ─────────────
   표지는 왼쪽 모서리에 묶여 왼쪽으로 넘어간다(한국식).
   지금은 책이 제자리에 누운 채 표지만 스르륵 넘어간다 — 왼쪽 화면 밖으로 잘려도 괜찮다.
   SLIDE·LIFT·TILT 를 켜면 예전 방식: 한 장 폭만큼 오른쪽으로 옮겨 가며, 들어 올려 앞으로 세운다.

   표지는 뻣뻣한 판이 아니라 종이 — 넘어가는 동안 끝이 뒤처지며 곡선으로 휘고,
   다 넘어간 뒤엔 몇 번 팔랑거리다 멈춘다 (용수철로 휨 정도를 따라가게 한다).

   const book = createGuideBook(THREE, { x, z, width, turn });
   scene.add(book.root);   → { root, hitTarget, setHover(on), update(dt) }
   원점은 닫힌 책의 왼쪽 모서리 한가운데. */

const DIR = new URL('./', import.meta.url).href;

export const GUIDE = {
  RATIO: 1.414,    // 세로 / 가로 (A 판형)
  BLOCK: 3,        // 속지 두께
  SLIDE: 0,        // 펼칠 때 오른쪽으로 옮겨 가는 몫 (1 = 한 장 폭, 0 = 제자리)
  LIFT: 0,         // 펼칠 때 들어 올리는 높이 (예전 방식 60)
  TILT: 0,         // 펼칠 때 먼 쪽을 들어 카메라 쪽으로 세우는 각도 (rad, 예전 방식 .22)
  TIME: 1.25,      // 다 펼치는 데 걸리는 시간 (초)
  /* 표지 휨 */
  SEG: 48,         // 표지를 가로로 나눈 칸 수 — 많을수록 곡선이 매끈
  DRAG: .22,       // 넘기는 빠르기에 비해 끝이 뒤처지는 정도
  CURL: 1.6,       // 휨이 끝 쪽에 몰리는 정도 (1 = 고르게)
  STIFF: 150,      // 용수철 세기 — 클수록 팔랑임이 빠르다
  DAMP: 4.2,       // 팔랑임이 잦아드는 빠르기 — 작을수록 오래 팔랑인다 (펼칠 때)
  DAMP_SHUT: 26,   // 닫힐 때 — 튕기지 않고 가라앉는 값 (2 × √STIFF 쯤)
  MAXBEND: 1.3,    // 휨 한도 (rad)
  DROOP: .3        // 다 넘어간 표지가 처질 수 있는 각도 (rad) — 책상에 닿는 만큼까지만
};

export function createGuideBook(THREE, { x = 0, z = 0, width = 200, turn = 0 } = {}) {
  const W = width, D = width * GUIDE.RATIO, T = GUIDE.BLOCK, N = GUIDE.SEG;

  const loader = new THREE.TextureLoader();
  const tex = name => {
    const t = loader.load(DIR + name);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const paper = map => new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: .82, metalness: 0 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: .9 });

  /* 위를 보는 종이 — 그림 윗변이 먼 쪽(-z). 경첩(왼쪽 모서리)이 x = 0 */
  const sheetUp = (seg = 1) => { const g = new THREE.PlaneGeometry(W, D, seg, 1); g.rotateX(-Math.PI / 2); g.translate(W / 2, 0, 0); return g; };
  /* 아래를 보는 종이 — 표지가 왼쪽으로 넘어가면 위를 보며 똑바로 읽힌다 */
  const sheetDown = (seg = 1) => { const g = new THREE.PlaneGeometry(W, D, seg, 1); g.rotateX(Math.PI / 2); g.rotateY(Math.PI); g.translate(W / 2, 0, 0); return g; };

  const root = new THREE.Group();          // 책상 위 자리 · 들어 올림 · 기울임
  root.position.set(x, 0, z);
  root.rotation.set(0, turn, 0, 'XYZ');
  const slide = new THREE.Group();         // 펼칠 때 오른쪽으로 옮겨 가는 몫
  root.add(slide);

  /* 속지 뭉치 + 첫 장 */
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), edge);
  block.position.set(W / 2, T / 2, 0);
  const first = new THREE.Mesh(sheetUp(), paper(tex('guideSpreadRight.png')));
  first.position.y = T + .05;
  slide.add(block, first);

  /* 표지 — 앞면과 안쪽 면 두 장을 같은 곡선에 붙여 휜다 */
  const hinge = new THREE.Group();
  hinge.position.y = T + .35;
  const front = new THREE.Mesh(sheetUp(N), paper(tex('guideCover.png')));
  const inside = new THREE.Mesh(sheetDown(N), paper(tex('guideSpreadLeft.png')));
  hinge.add(front, inside);
  slide.add(hinge);
  const sheets = [[front, .2], [inside, -.2]].map(([mesh, off]) => ({
    mesh, off, rest: Float32Array.from(mesh.geometry.attributes.position.array)
  }));

  for (const m of [block, first, front, inside]) { m.castShadow = true; m.receiveShadow = true; }

  /* 호버 판정 — 보이지 않는 상자. 펼치면 펼침면 크기로 넓어져 움직이는 동안에도 호버가 풀리지 않는다 */
  const hitTarget = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
  root.add(hitTarget);

  /* 표지 곡선 — 경첩에서 끝까지 각도 θ(s) = 넘김 각 − 휨 × s^CURL 을 따라 이어 붙인다 */
  const px = new Float32Array(N + 1), py = new Float32Array(N + 1), nx = new Float32Array(N + 1), ny = new Float32Array(N + 1);
  function bendCover(phi, bend) {
    /* 넘어간 쪽 책상 높이까지만 처진다 — 책이 누워 있으면 거의 안 처지고 위로만 팔랑인다 */
    const droop = Math.min(GUIDE.DROOP, Math.asin(Math.min(1, (hinge.position.y + root.position.y) / W)));
    let cx = 0, cy = 0;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      /* 닫힐 땐 속지로 파고들지 않게 0 아래로는 안 간다. 펼친 쪽은 책이 들려 있어 조금 처질 수 있다 */
      const th = Math.max(0, Math.min(Math.PI + droop, phi - bend * Math.pow(s, GUIDE.CURL)));
      px[i] = cx; py[i] = cy; nx[i] = -Math.sin(th); ny[i] = Math.cos(th);
      cx += Math.cos(th) * W / N; cy += Math.sin(th) * W / N;
    }
    for (const { mesh, off, rest } of sheets) {
      const p = mesh.geometry.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const i = Math.round(rest[v * 3] / W * N);          // 이 꼭짓점이 경첩에서 몇 번째 칸인지
        p.setXYZ(v, px[i] + nx[i] * off, py[i] + ny[i] * off, rest[v * 3 + 2]);
      }
      p.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    }
  }

  let target = 0, open = 0, phiPrev = 0;
  let bend = 0, bendV = 0;
  const ease = t => t * t * (3 - 2 * t);

  function update(dt) {
    open += Math.sign(target - open) * Math.min(Math.abs(target - open), dt / GUIDE.TIME);
    const e = ease(open);
    slide.position.x = W * GUIDE.SLIDE * e;
    root.position.y = GUIDE.LIFT * Math.sin(Math.PI * e / 2);
    root.rotation.x = GUIDE.TILT * e;

    /* 넘김 각 — 표지가 조금 먼저 다 넘어간다. 그 빠르기만큼 끝이 뒤처지도록 휨을 용수철로 따라가게 */
    const phi = Math.PI * ease(Math.min(1, open * 1.12));
    if (dt > 0) {
      const want = Math.max(-GUIDE.MAXBEND, Math.min(GUIDE.MAXBEND, (phi - phiPrev) / dt * GUIDE.DRAG));
      /* 닫힐 땐 팔랑임 없이 바로 가라앉는다 — 덮인 책이 혼자 들썩이지 않게 */
      const damp = target > 0 ? GUIDE.DAMP : GUIDE.DAMP_SHUT;
      bendV += (GUIDE.STIFF * (want - bend) - damp * bendV) * dt;
      bend += bendV * dt;
      if (Math.abs(bend) < 1e-4 && Math.abs(bendV) < 1e-3 && want === 0) bend = bendV = 0;
    }
    phiPrev = phi;
    bendCover(phi, bend);

    /* 펼치면 넘어간 표지 자리까지 판정을 넓힌다 — 움직이는 동안 호버가 풀리지 않게 */
    const left = target > 0 ? W * (1 - GUIDE.SLIDE) : 0, right = W * (1 + (target > 0 ? GUIDE.SLIDE : 0));
    hitTarget.scale.set(left + right, T + GUIDE.LIFT * e + 12, D);
    hitTarget.position.set((right - left) / 2, hitTarget.scale.y / 2, 0);
  }
  update(0);

  return { root, hitTarget, setHover: on => { target = on ? 1 : 0; }, update };
}
