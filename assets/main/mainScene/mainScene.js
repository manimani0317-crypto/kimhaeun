/*
  메인 화면 뼈대 — 책상 장면, 고개 드는 카메라, 오브젝트 자리
  스케치: references/mainScreen/ (mainScreenSketches, deskLayoutSketch)

  아직 오브젝트는 없다. 자리(슬롯)만 표시해 두고 구도와 움직임을 먼저 확정한다.
  단추·실패가 완성돼 있으니 슬롯에 그대로 꽂으면 된다 — attach() 참고.

  쓰는 법
    import { createMainScene } from './mainScene.js';
    const main = createMainScene(THREE, renderer);
    main.attach('threadSpool', createThreadSpool(THREE, main.scene, main.placement('threadSpool')));
    main.update(dt);              // 움직임이 남아 있으면 true
    renderer.render(main.scene, main.camera);

  단위: 1 = 1cm. 책상 바닥은 y = 0. x 오른쪽, z 화면 앞쪽.
  화면에 보이는 책상은 대략 가로 64 × 세로 42.
*/

export const PALETTE = { black: 0x171413, red: 0x7a0706, cream: 0xeeeae2 };

/* ── 카메라 두 자세 ───────────────────────────────────
   DESK  평소 — 책상을 내려다본다 (스케치의 빨간 프레임)
   RAISE 고개를 들었을 때 — 책상 안쪽 끝의 미싱과 거울이 보인다

   DESK는 사람 눈이 아니라 새의 눈이다. 그 높이에서 위로 틸트만 하면
   미싱은 여전히 발밑에 깔린다. 그래서 고개를 들 때 시선 높이까지 함께 내려온다 —
   실제로 고개를 드는 동작이 그렇다. 눈이 앞으로 나가고 보는 곳이 올라간다. */
export const VIEW = {
  DESK:  { pos: [0, 62.8, 39.2], target: [0,  1,  -4], fov: 30 },
  RAISE: { pos: [0, 36.0, 22.0], target: [0, 12, -50], fov: 34 }
};

/* ── 오브젝트 자리 ────────────────────────────────────
   스케치 배치 + 빨간 메모("중요한 건 잘 보이게, 크기로!")의 우선순위.
   rank 1이 제일 중요 → 지름(dia)을 크게 준다. manual은 순위 밖의 앵커.
   왼쪽 아래는 Portfolio 타이포가 앉는 자리라 비워 둔다 — 안내서는 그 위쪽에. */
export const SLOTS = [
  { id:'manual',       ko:'김하은 안내서',  project:'About Me',  index:'01', rank:0, x:-20,  z: -7,  dia:19, tall:2.0 },
  { id:'pinCushion',   ko:'바늘꽂이',      project:'왈가왈BOT',  index:'02', rank:1, x: 10,  z:-16,  dia:10, tall:6.5 },
  { id:'tapeMeasure',  ko:'자동 줄자',     project:'N서울타워',  index:'03', rank:2, x: -2,  z:-10,  dia: 8, tall:3.2 },
  { id:'threadSpool',  ko:'실패',          project:'탐정일지',   index:'04', rank:3, x: 15,  z: -3,  dia:7.5, tall:4.0 },
  { id:'scissors',     ko:'재단가위',      project:'에뛰드',     index:'05', rank:4, x: 17,  z:  8,  dia:12, tall:1.6 },
  { id:'button',       ko:'단추',          project:'오키디아',   index:'06', rank:5, x: 25,  z:-10,  dia:5.5, tall:1.0 },
  { id:'fabricSwatch', ko:'원단 스와치',   project:'기타',       index:'07', rank:6, x:  2,  z:  4,  dia: 9, tall:0.4 }
];

/* 고개를 들면 보이는 것 — 책상 안쪽 끝 */
const BACKDROP = [
  { id:'sewingMachine', ko:'미싱',  x:  6, z:-50, w:30, h:26, d:14 },
  { id:'mirror',        ko:'거울',  x:-16, z:-48, w:18, h:26, d: 3 }
];

/* ── 스프링 (다른 오브젝트 파일과 같은 방식) ──────────── */
function spring(value, stiffness, damping) { return { value, target: value, v: 0, stiffness, damping }; }
function stepSpring(s, dt, instant) {
  if (instant) { s.value = s.target; s.v = 0; return; }
  const a = s.stiffness * (s.target - s.value) - s.damping * s.v;
  s.v += a * dt; s.value += s.v * dt;
}
function settled(s) { return Math.abs(s.target - s.value) < 1e-4 && Math.abs(s.v) < 1e-4; }

/* ── 무늬 ─────────────────────────────────────────── */
function canvasTexture(THREE, w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* 책상 — 검정 펠트. 무늬가 규칙적이면 가짜처럼 보이니 얼룩을 불규칙하게 뿌린다 */
function deskTexture(THREE) {
  const t = canvasTexture(THREE, 1024, 1024, (g, N) => {
    g.fillStyle = '#171413'; g.fillRect(0, 0, N, N);
    const rnd = seeded(7);
    for (let i = 0; i < 9000; i++) {                       // 펠트 보풀
      const v = rnd();
      g.fillStyle = v > .5 ? `rgba(58,50,46,${.05 + rnd() * .10})`
                           : `rgba(0,0,0,${.06 + rnd() * .12})`;
      const x = rnd() * N, y = rnd() * N, len = 1 + rnd() * 4;
      g.fillRect(x, y, len, 1);
    }
    for (let i = 0; i < 26; i++) {                         // 넓고 옅은 얼룩
      const x = rnd() * N, y = rnd() * N, r = 60 + rnd() * 180;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(44,37,34,${.05 + rnd() * .06})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3.4);
  return t;
}

/* 슬롯 이름표 — 3D 안에 떠 있어서 고개를 들어도 같이 따라간다 */
function labelSprite(THREE, slot) {
  const W = 512, H = 128;
  const tex = canvasTexture(THREE, W, H, (g) => {
    g.clearRect(0, 0, W, H);
    g.font = '600 30px "IBM Plex Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    g.fillStyle = '#c4140e';
    g.fillText(slot.index, 8, 30);
    g.fillStyle = '#eeeae2';
    g.font = '500 38px "IBM Plex Mono", ui-monospace, monospace';
    g.fillText(slot.ko, 66, 30);
    g.fillStyle = 'rgba(238,234,226,.45)';
    g.font = '400 27px "IBM Plex Mono", ui-monospace, monospace';
    g.fillText(slot.project, 8, 82);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: .5
  }));
  s.scale.set(16, 4, 1);
  s.renderOrder = 10;
  return s;
}

/* ── 슬롯 표시물 ───────────────────────────────────────
   바닥의 얇은 링 = 오브젝트가 차지할 자리와 크기.
   그 위로 가는 기둥 하나, 꼭대기에 이름표. 오브젝트가 꽂히면 전부 사라진다. */
function buildSlotMarker(THREE, slot) {
  const g = new THREE.Group();
  g.position.set(slot.x, 0, slot.z);

  const r = slot.dia / 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - .22, r, 64),
    new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: .55, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .06;
  g.add(ring);

  const dot = new THREE.Mesh(                              // 중심점
    new THREE.CircleGeometry(.35, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: .8, depthWrite: false })
  );
  dot.rotation.x = -Math.PI / 2; dot.position.y = .07;
  g.add(dot);

  const post = new THREE.Mesh(                             // 이름표까지 올라가는 가는 선
    new THREE.CylinderGeometry(.07, .07, slot.tall, 6),
    new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: .22, depthWrite: false })
  );
  post.position.y = slot.tall / 2;
  g.add(post);

  const label = labelSprite(THREE, slot);
  label.position.y = slot.tall + 3.4;
  g.add(label);

  /* 호버 판정용 — 눈에 보이지 않는 넉넉한 판 */
  const hit = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.05, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.rotation.x = -Math.PI / 2;
  hit.position.y = .04;
  g.add(hit);

  return { group: g, ring, dot, post, label, hit };
}

/* 고개 들면 보이는 자리 — 상자 윤곽만 */
function buildBackdropMarker(THREE, b) {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.z);
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, b.h, b.d)),
    new THREE.LineBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: .18 })
  );
  box.position.y = b.h / 2;
  g.add(box);
  const tex = canvasTexture(THREE, 256, 64, (gg) => {
    gg.font = '500 34px "IBM Plex Mono", ui-monospace, monospace';
    gg.textBaseline = 'middle';
    gg.fillStyle = 'rgba(238,234,226,.55)';
    gg.fillText(b.ko, 6, 34);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(14, 3.5, 1);
  s.position.y = b.h + 3;
  s.renderOrder = 10;
  g.add(s);
  return g;
}

/* ── 본체 ─────────────────────────────────────────── */
export function createMainScene(THREE, renderer, { showMarkers = true } = {}) {
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VIEW.DESK.fov, 1, .5, 400);

  /* 조명 — threadSpool3d.html 과 같은 설정. 오브젝트를 합칠 때 여기 하나로 통일한다 */
  (function environment() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#6a6460'); gr.addColorStop(.3, '#fff8ee');
    gr.addColorStop(.45, '#8a8480'); gr.addColorStop(.65, '#2a2624'); gr.addColorStop(1, '#0e0c0c');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
  })();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1414, .12));   // 주변광은 아주 약하게 — 대비가 살도록
  /* 주 조명은 위쪽 약간 뒤에서 — 윗면은 밝고, 앞쪽 아래로 돌아가는 면은 깊게 어두워진다 */
  const key = new THREE.DirectionalLight(0xfff2e4, 4.6);
  key.position.set(-30, 70, -15);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe8e0, .35);          // 앞쪽이 완전히 묻히지 않을 만큼만
  fill.position.set(20, 20, 60);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, .35);
  rim.position.set(30, 30, -40);
  scene.add(rim);

  /* 먼 쪽이 어둠에 잠기도록 — 고개를 들었을 때 깊이가 생긴다 */
  scene.fog = new THREE.Fog(0x0b0908, 90, 190);

  /* 책상 */
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 170),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: deskTexture(THREE), roughness: .95 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.z = -35;
  scene.add(desk);

  /* 책상 뒤 어둠 */
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 120),
    new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 })
  );
  wall.position.set(0, 60, -120);
  scene.add(wall);

  /* 슬롯 */
  const markers = new THREE.Group();
  markers.visible = showMarkers;
  scene.add(markers);
  const slots = new Map();
  for (const s of SLOTS) {
    const m = buildSlotMarker(THREE, s);
    markers.add(m.group);
    slots.set(s.id, {
      def: s, marker: m, objects: [],          // 한 자리에 여럿이 놓일 수 있다 (단추 두 종류 등)
      hover: spring(0, 120, 13)
    });
  }
  const backdrop = new THREE.Group();
  backdrop.visible = showMarkers;
  for (const b of BACKDROP) backdrop.add(buildBackdropMarker(THREE, b));
  scene.add(backdrop);

  /* ── 카메라 움직임 ──────────────────────────────────
     gaze 0 = 책상, 1 = 고개 듦. 두 자세 사이를 그대로 섞는다.
     커서 높이를 따라 계속 바뀌므로 살짝 묵직하게 — 목이 움직이는 무게감 */
  const gaze = spring(0, 34, 11);
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();
  function applyCamera() {
    const g = gaze.value;
    const e = g * g * (3 - 2 * g);                         // 부드럽게 시작하고 멈춤
    _p.fromArray(VIEW.DESK.pos).lerp(_t.fromArray(VIEW.RAISE.pos), e);
    camera.position.copy(_p);
    _p.fromArray(VIEW.DESK.target).lerp(_t.fromArray(VIEW.RAISE.target), e);
    camera.lookAt(_p);
    const fov = VIEW.DESK.fov + (VIEW.RAISE.fov - VIEW.DESK.fov) * e;
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  /* ── 호버 판정 ──────────────────────────────────────
     맞은 메시에서 부모를 거슬러 올라가 어느 슬롯인지 찾는다 —
     오브젝트마다 속 구조가 달라도(실패는 hitTarget, 단추는 group) 같은 방식으로 걸린다 */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hoveredId = null;
  const hitRoots = [];                                   // 레이캐스트 대상
  const hitOwner = new Map();                            // Object3D → { id, obj }
  let hoveredObj = null;                                 // 지금 반응 중인 오브젝트 하나
  for (const [id, s] of slots) { hitRoots.push(s.marker.hit); hitOwner.set(s.marker.hit, { id, obj: null }); }

  /* 책상면(y=0) 위의 커서 위치 — 단추가 커서 쪽으로 기울 때 쓴다 */
  const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const deskPoint = new THREE.Vector3();

  return {
    scene, camera, slots, SLOTS,

    /* 슬롯 자리값 — 오브젝트 모듈에 그대로 넘긴다
       createThreadSpool(THREE, main.scene, main.placement('threadSpool')) */
    placement(id, nativeRadius = 1) {
      const s = slots.get(id); if (!s) return null;
      return { x: s.def.x, z: s.def.z, size: (s.def.dia / 2) / nativeRadius };
    },

    /* 완성된 오브젝트를 슬롯에 꽂는다. 자리 표시물은 숨긴다.
       오브젝트 모듈이 저마다 다른 이름으로 뿌리를 돌려주므로 순서대로 찾는다.
       한 자리에 여럿이 놓이면(단추 두 종류, 원단 스와치 여러 장) 배열로 넘긴다 */
    attach(id, object) {
      const s = slots.get(id); if (!s) return;
      const list = [].concat(object);
      s.objects = list;
      for (const part of ['ring', 'dot', 'post', 'label']) s.marker[part].visible = false;

      const roots = [];
      for (const obj of list) {
        const root = obj.hitTarget || obj.group || obj.root;
        if (!root) continue;
        roots.push(root);
        hitOwner.set(root, { id, obj });                 // 오브젝트마다 따로 걸려야 하나씩 반응한다
      }
      if (!roots.length) return;
      const i = hitRoots.indexOf(s.marker.hit);
      if (i >= 0) hitRoots.splice(i, 1, ...roots);
      hitOwner.delete(s.marker.hit);
    },

    /* 화면 좌표(-1~1)를 받아 어떤 슬롯 위인지 알려준다. 바뀌었으면 id, 아니면 undefined */
    pick(nx, ny) {
      ndc.set(nx, ny);
      ray.setFromCamera(ndc, camera);

      const hit = ray.intersectObjects(hitRoots, true)[0];
      let found = null;
      for (let o = hit?.object; o; o = o.parent) {         // 부모를 거슬러 올라가 주인을 찾는다
        const owner = hitOwner.get(o);
        if (owner) { found = owner; break; }
      }
      const id = found?.id ?? null, obj = found?.obj ?? null;

      /* 커서가 책상 어디를 가리키는지 — 기울기 반응에 쓴다 */
      if (obj && ray.ray.intersectPlane(deskPlane, deskPoint)) obj.lean?.(deskPoint);

      if (obj === hoveredObj && id === hoveredId) return undefined;

      /* 한 번에 하나만 반응한다 — index.html 과 같은 방식 */
      hoveredObj?.setHover?.(false);
      if (id !== hoveredId && hoveredId) slots.get(hoveredId).hover.target = 0;

      hoveredObj = obj;
      hoveredId = id;
      if (id) slots.get(id).hover.target = 1;
      obj?.setHover?.(true);
      return id;
    },
    get hovered() { return hoveredId; },

    /* 고개 들기 — 0 책상 / 1 미싱과 거울 */
    setGaze(v) { gaze.target = Math.max(0, Math.min(1, v)); },
    nudgeGaze(d) { this.setGaze(gaze.target + d); },
    get gaze() { return gaze.value; },

    resize(w, h) {
      camera.aspect = w / h;
      /* 세로로 긴 화면에서도 책상 가로폭이 유지되도록 화각을 넓힌다 */
      const base = VIEW.DESK.fov + (VIEW.RAISE.fov - VIEW.DESK.fov) * gaze.value;
      camera.fov = w / h < 16 / 9 ? base * (16 / 9) / Math.max(w / h, .6) : base;
      camera.updateProjectionMatrix();
    },

    update(dt) {
      stepSpring(gaze, dt, instant);
      applyCamera();
      let moving = !settled(gaze);
      for (const s of slots.values()) {
        stepSpring(s.hover, dt, instant);
        if (!settled(s.hover)) moving = true;
        if (s.objects.length) {
          for (const o of s.objects) if (o.update?.(dt)) moving = true;
          continue;
        }
        /* 표시물만 있을 때 — 올라오고 밝아진다 */
        const h = s.hover.value;
        s.marker.ring.material.opacity = .55 + h * .45;
        s.marker.ring.scale.setScalar(1 + h * .06);
        s.marker.label.material.opacity = .5 + h * .5;
        s.marker.label.position.y = s.def.tall + 3.4 + h * 1.2;
        s.marker.post.material.opacity = .22 + h * .3;
      }
      return moving;
    }
  };
}
