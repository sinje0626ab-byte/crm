// 로우폴리 메시 빌더 모음. 외부 에셋 없이 기본 지오메트리만 조합한다.
import * as THREE from 'three';
import { COLORS } from './config.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  }
  return matCache.get(key);
}

function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.castShadow = true;
  return m;
}

/* ================================================================ 캐릭터 */

// 어깨를 피벗 그룹으로 두어 팔을 휘두를 수 있게 만든다.
function humanoid({ coat = COLORS.coat, scale = 1, hood = true } = {}) {
  const g = new THREE.Group();

  const boots = mesh(new THREE.BoxGeometry(0.5, 0.38, 0.42), COLORS.woodDark);
  boots.position.y = 0.19;
  g.add(boots);

  const body = mesh(new THREE.CapsuleGeometry(0.38, 0.56, 3, 8), coat);
  body.position.y = 0.92;
  g.add(body);

  // 두꺼운 모피 깃
  const collar = mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.2, 9), COLORS.fur);
  collar.position.y = 1.34;
  g.add(collar);

  const head = mesh(new THREE.SphereGeometry(0.28, 8, 6), COLORS.skin);
  head.position.y = 1.58;
  g.add(head);

  if (hood) {
    const cap = mesh(new THREE.SphereGeometry(0.34, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), COLORS.fur);
    cap.position.y = 1.6;
    g.add(cap);
  }

  const armGeo = new THREE.CapsuleGeometry(0.13, 0.44, 3, 6);
  const shoulders = {};
  for (const side of ['L', 'R']) {
    const pivot = new THREE.Group();
    pivot.position.set(side === 'L' ? -0.44 : 0.44, 1.2, 0);
    const arm = mesh(armGeo, coat);
    arm.position.y = -0.3;
    pivot.add(arm);
    g.add(pivot);
    shoulders[side] = pivot;
  }

  g.scale.setScalar(scale);
  g.userData.parts = { body, boots, head, shoulderL: shoulders.L, shoulderR: shoulders.R };
  return g;
}

export function makePlayer() {
  const g = humanoid({ coat: COLORS.coat, scale: 1.24 });

  // 오른손에 검을 쥐여준다
  const sword = makeSword();
  sword.position.set(0, -0.5, 0.14);
  sword.rotation.x = -0.22;   // 손에서 위로 세워 든 자세
  g.userData.parts.shoulderR.add(sword);
  g.userData.sword = sword;

  const carry = new THREE.Group(); // 머리 위로 쌓이는 짐
  carry.position.y = 1.9;
  g.add(carry);
  g.userData.carry = carry;
  return g;
}

export function makeWorker() {
  return humanoid({ coat: COLORS.coatAlt, scale: 1.02 });
}

export function makeArcherFigure() {
  return humanoid({ coat: 0x4c5e8a, scale: 0.95 });
}

const BUYER_COATS = [0x8c5a7a, 0x5d7a4a, 0x8a7440, 0x4a6f7a, 0x7a5442];
export function makeBuyer(i) {
  return humanoid({ coat: BUYER_COATS[i % BUYER_COATS.length], scale: 1.02 });
}

export function makeSword() {
  const g = new THREE.Group();
  const grip = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 6), COLORS.woodDark);
  g.add(grip);
  const guard = mesh(new THREE.BoxGeometry(0.44, 0.09, 0.12), COLORS.gold);
  guard.position.y = 0.2;
  g.add(guard);
  const blade = mesh(new THREE.BoxGeometry(0.16, 1.25, 0.07), COLORS.steel);
  blade.position.y = 0.87;
  g.add(blade);
  const tip = mesh(new THREE.ConeGeometry(0.11, 0.26, 4), COLORS.steel);
  tip.position.y = 1.6;
  g.add(tip);
  return g;
}

/* ------------------------------------------------------------- 전투 이펙트 */

// 검 궤적용 텍스처: 가로로는 시작이 옅고 끝이 밝은 띠, 세로로는 가장자리가 흐려진다.
let slashTex = null;
function slashTexture() {
  if (slashTex) return slashTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.28, 'rgba(190,230,255,0.75)');
  g.addColorStop(0.72, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 64);
  const v = ctx.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 256, 64);
  slashTex = new THREE.CanvasTexture(c);
  return slashTex;
}

// 초승달 모양의 베기 궤적(양 끝이 얇아진다).
export function makeSlashArc({ r0 = 1.95, r1 = 4.0, arc = 2.3, seg = 26 } = {}) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = -arc / 2 + arc * t;
    const taper = Math.pow(Math.sin(Math.PI * t), 0.6);
    const ri = r0 + (r1 - r0) * 0.3 * (1 - taper);
    const ro = r0 + (r1 - r0) * (0.5 + 0.5 * taper);
    pos.push(Math.cos(a) * ri, 0, Math.sin(a) * ri);
    pos.push(Math.cos(a) * ro, 0, Math.sin(a) * ro);
    uv.push(t, 0, t, 1);
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: slashTexture(), color: 0xd6ecff, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  m.renderOrder = 5;
  return m;
}

// 타격 지점에서 튀는 불똥/파편
export function makeSparks(count = 14) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfff2cf, size: 0.22, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.userData.vel = new Float32Array(count * 3);
  points.userData.count = count;
  return points;
}

// 스킬(회전베기)용 확산 충격파
export function makeShockwave(color = 0xbfe6ff) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 40),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 4;
  return m;
}

// 서리폭발용 얼음 파편 고리
export function makeFrostShards(count = 12, radius = 4) {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.28, 1.1, 4);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const shard = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x9fd8ff, flatShading: true, transparent: true, opacity: 0.9,
      emissive: 0x2c6b9c,
    }));
    shard.position.set(Math.cos(a) * radius, 0.6, Math.sin(a) * radius);
    shard.rotation.z = (Math.random() - 0.5) * 0.5;
    shard.rotation.x = (Math.random() - 0.5) * 0.5;
    g.add(shard);
  }
  g.visible = false;
  return g;
}

/* --------------------------------------------------------------- 밤 요소 */

// 손에 드는 횃불(밤에만 켠다)
export function makeHandTorch() {
  const g = new THREE.Group();
  const stick = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 5), COLORS.woodDark);
  g.add(stick);
  const wrap = mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.24, 6), 0x3a2f24);
  wrap.position.y = 0.5;
  g.add(wrap);
  const flame = mesh(new THREE.ConeGeometry(0.19, 0.5, 5), COLORS.ember, { emissive: 0xff8a2b });
  flame.position.y = 0.8;
  g.add(flame);
  const light = new THREE.PointLight(0xffb066, 0, 34, 2);
  light.position.y = 0.85;
  g.add(light);
  g.userData.flame = flame;
  g.userData.light = light;
  return g;
}

// 밤하늘의 별
export function makeStars(count = 260, radius = 120) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const h = 0.25 + Math.random() * 0.7;
    const r = radius * Math.sqrt(1 - h * h);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = radius * h;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xdce9ff, size: 0.9, transparent: true, opacity: 0, depthWrite: false,
  }));
  stars.frustumCulled = false;
  return stars;
}

/* ==================================================================== 곰 */

export function makeBear(tier = {}) {
  const g = new THREE.Group();
  const main = tier.color ?? COLORS.bear;
  const dark = tier.shade ?? COLORS.bearShade;

  const body = mesh(new THREE.CapsuleGeometry(0.72, 1.5, 4, 8), main);
  body.rotation.x = Math.PI / 2;
  body.position.y = 1.18;
  g.add(body);

  const hump = mesh(new THREE.SphereGeometry(0.5, 7, 5), main);
  hump.scale.set(1, 0.6, 1.2);
  hump.position.set(0, 1.62, 0.35);
  g.add(hump);

  const head = mesh(new THREE.SphereGeometry(0.56, 8, 6), main);
  head.position.set(0, 1.34, 1.28);
  g.add(head);

  const snout = mesh(new THREE.BoxGeometry(0.36, 0.28, 0.4), dark);
  snout.position.set(0, 1.16, 1.72);
  g.add(snout);

  const nose = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.12), 0x30363d);
  nose.position.set(0, 1.22, 1.94);
  g.add(nose);

  const earGeo = new THREE.SphereGeometry(0.16, 6, 5);
  for (const s of [-1, 1]) {
    const ear = mesh(earGeo, dark);
    ear.position.set(0.33 * s, 1.76, 1.08);
    g.add(ear);
  }

  const legGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.78, 6);
  const legs = [];
  for (const x of [-0.52, 0.52]) {
    for (const z of [-0.62, 0.66]) {
      const leg = mesh(legGeo, dark);
      leg.position.set(x, 0.39, z);
      legs.push(leg);
      g.add(leg);
    }
  }

  const tail = mesh(new THREE.SphereGeometry(0.19, 6, 5), main);
  tail.position.set(0, 1.25, -1.45);
  g.add(tail);

  g.scale.setScalar(tier.scale ?? 1.22);
  g.userData.parts = { body, head, legs };
  g.userData.tier = tier.id ?? 0;
  return g;
}

/* ============================================================== 체력 바 */

const barGeo = new THREE.PlaneGeometry(1, 1);
export function makeHpBar(width = 1.7, height = 0.2) {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x17202b }));
  bg.scale.set(width, height, 1);
  const fill = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x5fd07a }));
  fill.scale.set(width - 0.06, height - 0.06, 1);
  fill.position.z = 0.01;
  group.add(bg, fill);
  const inner = width - 0.06;
  return {
    group,
    setRatio(r) {
      const v = Math.max(0, Math.min(1, r));
      fill.scale.x = inner * v;
      fill.position.x = -(inner * (1 - v)) / 2;
      fill.material.color.setHex(v > 0.5 ? 0x5fd07a : v > 0.25 ? 0xffd23f : 0xff5a4e);
    },
  };
}

/* ============================================================ 자원/아이템 */

export function makeMeat() {
  const g = new THREE.Group();
  const flesh = mesh(new THREE.SphereGeometry(0.3, 6, 5), COLORS.meat);
  flesh.scale.set(1, 0.55, 0.85);
  g.add(flesh);
  const bone = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 5), COLORS.fat);
  bone.rotation.z = Math.PI / 2;
  bone.position.x = 0.32;
  g.add(bone);
  return g;
}

export function makeLog(len = 0.95) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.17, 0.17, len, 7), COLORS.wood);
  body.rotation.z = Math.PI / 2;   // 그룹 안에서 눕혀 두면 바깥 회전에 영향받지 않는다
  g.add(body);
  for (const s2 of [-1, 1]) {
    const ring = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 7), COLORS.trunk);
    ring.rotation.z = Math.PI / 2;
    ring.position.x = (len / 2 - 0.03) * s2;
    g.add(ring);
  }
  return g;
}

export function makeCashBill() {
  const g = mesh(new THREE.BoxGeometry(0.62, 0.07, 0.36), COLORS.cash);
  const band = mesh(new THREE.BoxGeometry(0.2, 0.08, 0.38), COLORS.cashDark);
  g.add(band);
  return g;
}

export function makeArrow() {
  const g = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5), COLORS.wood);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const tip = mesh(new THREE.ConeGeometry(0.09, 0.24, 5), COLORS.steel);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.55;
  g.add(tip);
  return g;
}

/* ================================================================== 나무 */

// 벨 수 있는 나무. 눈을 인 전나무 모양.
export function makeChoppableTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.5, 6), COLORS.trunk);
  trunk.position.y = 0.75;
  g.add(trunk);

  const canopy = new THREE.Group();
  const tiers = [
    { y: 2.0, r: 1.5, h: 2.2, c: COLORS.pineDeep },
    { y: 3.3, r: 1.0, h: 1.8, c: COLORS.pine },
  ];
  for (const t of tiers) {
    const cone = mesh(new THREE.ConeGeometry(t.r, t.h, 7), t.c);
    cone.position.y = t.y;
    canopy.add(cone);
    const snow = mesh(new THREE.ConeGeometry(t.r * 0.84, t.h * 0.4, 7), COLORS.pineSnow);
    snow.position.y = t.y + t.h * 0.3;
    snow.castShadow = false;
    canopy.add(snow);
  }
  g.add(canopy);
  g.scale.setScalar(scale);
  g.userData.parts = { trunk, canopy };
  return g;
}

export function makeStump() {
  const g = mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.4, 6), COLORS.trunk);
  const top = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 6), COLORS.plank);
  top.position.y = 0.21;
  g.add(top);
  g.position.y = 0.2;
  return g;
}

/* ================================================================== 건물 */

// WOS의 상징인 중앙 화로: 돌 기단 + 무쇠 몸통 + 굴뚝 + 불빛
export function makeFurnace() {
  const g = new THREE.Group();

  const base = mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.7, 8), COLORS.stoneDark);
  base.position.y = 0.35;
  base.receiveShadow = true;
  g.add(base);

  const bodyM = mesh(new THREE.CylinderGeometry(1.7, 2.1, 2.4, 8), COLORS.stone);
  bodyM.position.y = 1.85;
  g.add(bodyM);

  const band = mesh(new THREE.TorusGeometry(1.85, 0.12, 4, 12), COLORS.steel);
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.7;
  g.add(band);

  // 아궁이 입구와 불꽃
  const mouth = mesh(new THREE.BoxGeometry(1.5, 1.0, 0.3), 0x2a2f36);
  mouth.position.set(0, 1.2, 1.95);
  g.add(mouth);
  const fire = mesh(new THREE.ConeGeometry(0.55, 1.0, 6), COLORS.fire, { emissive: 0xff6a10 });
  fire.position.set(0, 1.15, 1.95);
  fire.rotation.x = Math.PI / 2.4;
  g.add(fire);

  const chimney = mesh(new THREE.CylinderGeometry(0.6, 0.75, 1.8, 7), COLORS.stoneDark);
  chimney.position.y = 3.6;
  g.add(chimney);
  const cap = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 7), COLORS.steel);
  cap.position.y = 4.5;
  g.add(cap);

  const glow = new THREE.PointLight(0xff9b3d, 10, 24, 2);
  glow.position.set(0, 1.6, 1.6);
  g.add(glow);

  g.userData.fire = fire;
  g.userData.glow = glow;
  return g;
}

// 판매대: 나무 카운터 + 차양 + 재고를 올려두는 자리
export function makeStall() {
  const g = new THREE.Group();

  const counter = mesh(new THREE.BoxGeometry(4.6, 1.0, 1.5), COLORS.plank);
  counter.position.y = 0.5;
  g.add(counter);
  const top = mesh(new THREE.BoxGeometry(5.0, 0.16, 1.9), COLORS.wood);
  top.position.y = 1.06;
  g.add(top);

  const postGeo = new THREE.BoxGeometry(0.2, 3.0, 0.2);
  for (const x of [-2.4, 2.4]) {
    const p = mesh(postGeo, COLORS.woodDark);
    p.position.set(x, 1.5, -0.9);
    g.add(p);
  }

  // 뒤쪽 간판(위에서 내려다봐도 카운터 위 재고가 보이도록 지붕은 두지 않는다)
  const board = mesh(new THREE.BoxGeometry(5.0, 1.1, 0.18), COLORS.canvas);
  board.position.set(0, 2.5, -0.9);
  g.add(board);
  const boardSnow = mesh(new THREE.BoxGeometry(5.1, 0.16, 0.34), COLORS.roof);
  boardSnow.position.set(0, 3.08, -0.9);
  g.add(boardSnow);

  const stock = new THREE.Group(); // 재고 더미가 올라갈 자리
  stock.position.set(0, 1.16, 0);
  g.add(stock);
  g.userData.stock = stock;
  return g;
}

export function makeHut(w = 4, d = 3.4, h = 2.2) {
  const g = new THREE.Group();
  const walls = mesh(new THREE.BoxGeometry(w, h, d), COLORS.wood);
  walls.position.y = h / 2;
  walls.receiveShadow = true;
  g.add(walls);

  const roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.5, 4), COLORS.woodDark);
  roof.position.y = h + 0.7;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const snow = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 0.9, 4), COLORS.roof);
  snow.position.y = h + 1.1;
  snow.rotation.y = Math.PI / 4;
  g.add(snow);

  const door = mesh(new THREE.BoxGeometry(0.9, 1.3, 0.12), COLORS.woodDark);
  door.position.set(0, 0.65, d / 2 + 0.02);
  g.add(door);
  return g;
}

export function makeTent() {
  const g = new THREE.Group();
  const body = mesh(new THREE.ConeGeometry(1.7, 2.6, 5), COLORS.canvas);
  body.position.y = 1.3;
  g.add(body);
  const snow = mesh(new THREE.ConeGeometry(1.45, 1.1, 5), COLORS.roof);
  snow.position.y = 2.0;
  g.add(snow);
  return g;
}

export function makeTorch(withLight = true) {
  const g = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.2, 5), COLORS.woodDark);
  post.position.y = 1.1;
  g.add(post);
  const bowl = mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.3, 6), COLORS.steel);
  bowl.position.y = 2.3;
  g.add(bowl);
  const flame = mesh(new THREE.ConeGeometry(0.22, 0.5, 5), COLORS.ember, { emissive: 0xff8a2b });
  flame.position.y = 2.65;
  g.add(flame);
  if (withLight) {
    const light = new THREE.PointLight(0xffa64d, 5, 12, 2);
    light.position.y = 2.7;
    g.add(light);
    g.userData.light = light;
  }
  g.userData.flame = flame;
  return g;
}

export function makeBarrel() {
  const g = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 8), COLORS.wood);
  g.position.y = 0.5;
  const b1 = mesh(new THREE.TorusGeometry(0.44, 0.05, 4, 10), COLORS.steel);
  b1.rotation.x = Math.PI / 2;
  b1.position.y = 0.25;
  const b2 = b1.clone();
  b2.position.y = -0.25;
  g.add(b1, b2);
  return g;
}

export function makeLogStack(rows = 4, cols = 5) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.28, 0.28, 3.4, 7);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const log = mesh(geo, c % 2 ? COLORS.wood : COLORS.woodDark);
      log.rotation.x = Math.PI / 2;
      log.position.set((c - (cols - 1) / 2) * 0.58, 0.28 + r * 0.54, (r % 2) * 0.1);
      g.add(log);
    }
  }
  return g;
}

// 울타리는 말뚝이 수백 개라 인스턴싱으로 두 번의 드로우콜에 그린다.
export function makeFence(w, d, height = 1.2, gapHalf = 0) {
  const g = new THREE.Group();
  const step = 0.66;
  const spots = [];
  for (let x = -w / 2; x <= w / 2; x += step) {
    spots.push([x, -d / 2, 0]);
    spots.push([x, d / 2, 0]);
  }
  for (let z = -d / 2; z <= d / 2; z += step) {
    spots.push([-w / 2, z, Math.PI / 2]);
    if (Math.abs(z) > gapHalf) spots.push([w / 2, z, Math.PI / 2]);
  }

  const pickets = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, height, 0.16), mat(COLORS.woodDark), spots.length);
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.2), mat(COLORS.roof), spots.length);
  pickets.castShadow = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach(([x, z, ry], i) => {
    q.setFromAxisAngle(up, ry);
    v.set(x, height / 2, z);
    pickets.setMatrixAt(i, m4.compose(v, q, one));
    v.set(x, height, z);
    caps.setMatrixAt(i, m4.compose(v, q, one));
  });
  g.add(pickets, caps);
  return g;
}

export function makeArcherTower() {
  const g = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(0.24, 2.2, 0.24);
  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.85, 0.85]) {
      const leg = mesh(legGeo, COLORS.woodDark);
      leg.position.set(x, 1.1, z);
      g.add(leg);
    }
  }
  const deck = mesh(new THREE.BoxGeometry(2.3, 0.35, 2.3), COLORS.plank);
  deck.position.y = 2.3;
  g.add(deck);
  const rail = mesh(new THREE.BoxGeometry(2.3, 0.5, 0.16), COLORS.woodDark);
  rail.position.set(0, 2.7, -1.05);
  g.add(rail);
  const archer = makeArcherFigure();
  archer.position.y = 2.48;
  g.add(archer);
  g.userData.archer = archer;
  return g;
}

/* ============================================================ 구매 패드 */

export function makePad(w, d) {
  const g = new THREE.Group();

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.05, d + 0.5),
    new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.55 })
  );
  border.position.y = 0.02;
  g.add(border);

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.08, d),
    new THREE.MeshLambertMaterial({ color: 0x2c333d, transparent: true, opacity: 0.94 })
  );
  slab.position.y = 0.05;
  slab.receiveShadow = true;
  g.add(slab);

  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.2, 0.06, d - 0.2),
    new THREE.MeshBasicMaterial({ color: 0x7ce08a, transparent: true, opacity: 0.6 })
  );
  fill.position.y = 0.11;
  fill.scale.z = 0.001;
  g.add(fill);

  g.userData.fill = fill;
  g.userData.depth = d - 0.2;
  return g;
}

/* ============================================================= 월드 라벨 */

function drawIcon(ctx, type, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#f2e6c8';
  ctx.fillStyle = '#f2e6c8';
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'bow') {
    ctx.beginPath();
    ctx.arc(-s * 0.1, 0, s * 0.5, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.1 + Math.cos(-Math.PI * 0.42) * s * 0.5, Math.sin(-Math.PI * 0.42) * s * 0.5);
    ctx.lineTo(-s * 0.1 + Math.cos(Math.PI * 0.42) * s * 0.5, Math.sin(Math.PI * 0.42) * s * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, 0);
    ctx.lineTo(s * 0.45, 0);
    ctx.stroke();
  } else if (type === 'sword') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.42);
    ctx.lineTo(s * 0.42, -s * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, s * 0.05);
    ctx.lineTo(-s * 0.02, s * 0.45);
    ctx.stroke();
  } else if (type === 'worker') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.22, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.45);
    ctx.quadraticCurveTo(0, -s * 0.12, s * 0.38, s * 0.45);
    ctx.fill();
  } else if (type === 'bag') {
    ctx.beginPath();
    ctx.roundRect(-s * 0.38, -s * 0.2, s * 0.76, s * 0.62, s * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.2, s * 0.22, Math.PI, 0);
    ctx.stroke();
  } else if (type === 'cash') {
    ctx.beginPath();
    ctx.roundRect(-s * 0.48, -s * 0.3, s * 0.96, s * 0.6, s * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'wood') {
    ctx.beginPath();
    ctx.roundRect(-s * 0.45, -s * 0.26, s * 0.9, s * 0.24, s * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-s * 0.45, s * 0.06, s * 0.9, s * 0.24, s * 0.1);
    ctx.stroke();
  } else if (type === 'meat') {
    ctx.beginPath();
    ctx.ellipse(s * 0.05, 0, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s * 0.4, 0, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 어두운 목재 패널 + 금색 테두리의 월드 라벨
export function makeLabel(iconType, text, width = 3.1) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sprite.scale.set(width, width * 0.5, 1);

  function render(label) {
    ctx.clearRect(0, 0, 320, 160);
    ctx.fillStyle = 'rgba(26, 33, 43, 0.94)';
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 6;
    const r = 40;
    ctx.beginPath();
    ctx.roundRect(22, 22, 276, 116, r);
    ctx.fill();
    ctx.stroke();

    drawIcon(ctx, iconType, 84, 80, 52);

    ctx.fillStyle = '#f7efdc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let size = 52;
    const avail = 276 - 116;
    do {
      ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
      size -= 3;
    } while (ctx.measureText(label).width > avail && size > 24);
    ctx.fillText(label, 136, 82);
    tex.needsUpdate = true;
  }

  render(text);
  return { sprite, render };
}
