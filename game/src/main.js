// 화이트아웃 헌터 — 벌목/사냥으로 모은 자원을 정착지에서 손님에게 파는 아이들 게임.
import * as THREE from 'three';
import { CFG, COLORS } from './config.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createMenu } from './menu.js';
import { createMinimap } from './minimap.js';
import { createLevelUp } from './levelup.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { Audio } from './audio.js';
import {
  makePlayer, makeWorker, makeBear, makeHpBar, makeMeat, makeLog, makeCashBill,
  makeArrow, makeFurnace, makeStall, makeArcherTower, makePad, makeLabel,
  makeChoppableTree, makeStump, makeBuyer,
  makeSlashArc, makeSparks, makeShockwave, makeHandTorch, makeFrostShards,
} from './entities.js';

const canvas = document.getElementById('scene');
const world = createWorld(canvas);
const { renderer, scene, camera } = world;
const input = createInput(
  document.getElementById('surface'),
  document.getElementById('joy'),
  document.getElementById('joy-knob'),
);
const hud = createHud();

const C = CFG.world.camp;
const FIELD = CFG.world.field;
const FOREST = CFG.world.forest;
const GATE_X = C.x + C.w / 2;      // 캠프 오른쪽 문
const GATE_HALF = 5;

const FURNACE_POS = new THREE.Vector3(-24, 0.35, -5);
const STALL_POS = new THREE.Vector3(-6, 0.35, 6);
const CASH_POS = new THREE.Vector3(-18, 0.35, 11);
const SPAWN_POS = new THREE.Vector3(-10, 0.35, 0);

/* ================================================================= 상태 */

const S = {
  running: false,
  money: 0,
  swordLevel: 0,
  bagLevel: 0,
  carry: { wood: 0, meat: 0 },   // 종류별로 따로 짊어진다
  hp: CFG.player.maxHp,
  hurtTimer: 0,
  dead: 0,
  stock: { wood: 0, meat: 0 },   // meat = 화로에서 조리된 고기
  cookQueue: 0,
  cookTimer: 0,
  depositTimer: 0,
  swingCd: 0,
  swingT: 0,
  swingHit: false,
  swingTarget: null,
  level: 1,
  xp: 0,
  pendingLevels: 0,
  choosing: false,
  skills: { whirl: 0, charge: 0, frost: 0 },
  skillCd: { whirl: 0, charge: 0, frost: 0 },
  skillActive: null,
  skillT: 0,
  skillHit: false,
  chargeDir: 0,
  chargeHitIds: null,
  bonus: { hp: 0, speed: 0, dmg: 0 },
  clock: 0,          // 하루 주기 경과 시간(초)
  day: 1,
  night: false,
  spawnTimer: 2,
  buyerTimer: 3,
  autosaveTimer: CFG.autosaveEvery,
  time: 0,
  served: 0,
};

const bears = [];
const trees = [];
const pickups = [];   // 바닥에 떨어진 고기/통나무
const bills = [];
const arrows = [];
const workers = [];
const buyers = [];
const towers = [];

const carryCap = () => CFG.player.carryBase + CFG.player.carryPerLevel * S.bagLevel;
const swordDamage = () => CFG.sword.damage + CFG.sword.perLevelDamage * S.swordLevel + S.bonus.dmg;
const maxHp = () => CFG.player.maxHp + S.bonus.hp;
const moveSpeed = () => CFG.player.speed * (1 + S.bonus.speed);
const swingCooldown = () => Math.max(0.24, CFG.sword.cd - CFG.sword.perLevelCd * S.swordLevel);

/* ============================================================== 플레이어 */

const player = makePlayer();
player.position.copy(SPAWN_POS);
scene.add(player);

// 검 궤적(플레이어와 별도로 두어 스케일 영향을 받지 않게 한다)
const slash = makeSlashArc();
const slashGhost = makeSlashArc({ r0: 1.7, r1: 3.5, arc: 2.0 });
scene.add(slash, slashGhost);

const shockwave = makeShockwave();
shockwave.visible = false;
scene.add(shockwave);

const frostShards = makeFrostShards(14, 4);
scene.add(frostShards);

const levelUp = createLevelUp();

const sparkPool = [];
for (let i = 0; i < 5; i++) {
  const pts = makeSparks(14);
  pts.visible = false;
  scene.add(pts);
  sparkPool.push({ pts, life: 0 });
}

// 밤에 드는 횃불
const handTorch = makeHandTorch();
handTorch.position.set(0, -0.72, 0.12);
handTorch.rotation.x = -0.3;
handTorch.visible = false;
player.userData.parts.shoulderL.add(handTorch);

const footRing = new THREE.Mesh(
  new THREE.RingGeometry(0.62, 0.86, 22),
  new THREE.MeshBasicMaterial({ color: 0xe0b34a, transparent: true, opacity: 0.55, depthWrite: false }),
);
footRing.rotation.x = -Math.PI / 2;
footRing.position.y = 0.38;
scene.add(footRing);

// 나무는 오른쪽, 고기는 왼쪽 기둥으로 쌓는다
const carryMeshes = { wood: [], meat: [] };
const carryGroups = { wood: new THREE.Group(), meat: new THREE.Group() };
carryGroups.wood.position.x = 0.34;
carryGroups.meat.position.x = -0.34;
player.userData.carry.add(carryGroups.wood, carryGroups.meat);

/* ================================================================ 시설 */

const furnace = makeFurnace();
furnace.position.copy(FURNACE_POS);
scene.add(furnace);

const stall = makeStall();
stall.position.copy(STALL_POS);
scene.add(stall);

const stallLabel = makeLabel('cash', '판매대', 3.4);
stallLabel.sprite.position.set(STALL_POS.x, 4.2, STALL_POS.z);
scene.add(stallLabel.sprite);

const furnaceLabel = makeLabel('meat', '화로', 3.0);
furnaceLabel.sprite.position.set(FURNACE_POS.x, 5.6, FURNACE_POS.z);
scene.add(furnaceLabel.sprite);

const cashPad = makePad(3.6, 3.6);
cashPad.position.copy(CASH_POS);
scene.add(cashPad);
const cashLabel = makeLabel('cash', '$', 3.1);
cashLabel.sprite.position.set(CASH_POS.x, 2.6, CASH_POS.z);
cashLabel.sprite.visible = false;
scene.add(cashLabel.sprite);

for (const z of [-9, 9]) {
  const t = makeArcherTower();
  t.position.set(5, 0, z);
  t.visible = false;
  t.userData.cd = 0;
  scene.add(t);
  towers.push(t);
}

// 판매대 위 재고 더미(왼쪽 통나무, 오른쪽 고기)
const stockGroup = stall.userData.stock;
let stockShown = { wood: -1, meat: -1 };
function refreshStockVisual() {
  if (stockShown.wood === S.stock.wood && stockShown.meat === S.stock.meat) return;
  stockShown = { ...S.stock };
  stockGroup.clear();

  const woodN = Math.min(9, S.stock.wood);
  for (let i = 0; i < woodN; i++) {
    const log = makeLog(1.1);
    log.position.set(-1.4, 0.18 + Math.floor(i / 3) * 0.34, -0.35 + (i % 3) * 0.35);
    stockGroup.add(log);
  }
  const meatN = Math.min(9, S.stock.meat);
  for (let i = 0; i < meatN; i++) {
    const m = makeMeat();
    m.scale.setScalar(0.85);
    m.position.set(1.4, 0.2 + Math.floor(i / 3) * 0.3, -0.35 + (i % 3) * 0.35);
    stockGroup.add(m);
  }
}

/* ============================================================ 구매 패드 */

const padDefs = [
  { id: 'worker', icon: 'worker', price: 120, x: -30, z: 4, max: 3, mul: 1.8, buy: hireWorker, name: '일꾼' },
  { id: 'bag', icon: 'bag', price: 220, x: -24, z: 8, max: 3, mul: 1.7, buy: upgradeBag, name: '가방' },
  { id: 'sword', icon: 'sword', price: 400, x: -13, z: -7, max: 5, mul: 1.6, buy: upgradeSword, name: '검' },
  { id: 'archerA', icon: 'bow', price: 175, x: -2, z: -11, max: 1, mul: 1, buy: () => unlockTower(0), name: '궁수' },
  { id: 'archerB', icon: 'bow', price: 175, x: -20, z: -11, max: 1, mul: 1, buy: () => unlockTower(1), name: '궁수' },
];

const pads = padDefs.map((d) => {
  const group = makePad(3.4, 3.4);
  group.position.set(d.x, 0.35, d.z);
  scene.add(group);
  const label = makeLabel(d.icon, `$ ${d.price}`, 3.1);
  label.sprite.position.set(d.x, 2.7, d.z);
  scene.add(label.sprite);
  return { ...d, group, label, paid: 0, level: 0, done: false };
});

const padPrice = (p) => Math.round(p.price * Math.pow(p.mul, p.level));

function refreshPad(p) {
  const hide = p.level >= p.max;
  p.done = hide;
  p.group.visible = !hide;
  p.label.sprite.visible = !hide;
  if (!hide) p.label.render(`$ ${padPrice(p)}`);
}

function hireWorker(silent) {
  const w = makeWorker();
  w.position.set(C.x + 6, 0.35, C.z - 4 + workers.length * 1.6);
  Object.assign(w.userData, {
    state: 'seek', carry: 0, type: null, target: null, stack: [], group: new THREE.Group(),
  });
  w.userData.group.position.y = 1.75;
  w.add(w.userData.group);
  scene.add(w);
  workers.push(w);
  if (!silent) hud.toast(`일꾼 고용! (${workers.length}명)`);
}
function unlockTower(i, silent) {
  towers[i].visible = true;
  if (!silent) hud.toast('궁수 배치 완료!');
}
function upgradeSword(silent) {
  S.swordLevel++;
  hud.setSwordLevel(S.swordLevel);
  if (!silent) hud.toast(`검 강화! Lv.${S.swordLevel + 1}`);
}
function upgradeBag(silent) {
  S.bagLevel++;
  if (!silent) hud.toast(`가방 확장! 최대 ${carryCap()}개`);
}

/* ================================================================== 나무 */

function plantTrees() {
  const cells = [];
  const cols = 8;
  const rows = Math.ceil(CFG.world.choppableTrees / cols);
  const w = (FOREST.x1 - FOREST.x0) / cols;
  const d = (FOREST.z1 - FOREST.z0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells.length >= CFG.world.choppableTrees) break;
      cells.push([
        FOREST.x0 + w * (c + 0.2 + Math.random() * 0.6),
        FOREST.z0 + d * (r + 0.2 + Math.random() * 0.6),
      ]);
    }
  }
  for (const [x, z] of cells) {
    const scale = 0.9 + Math.random() * 0.4;
    const mesh = makeChoppableTree(scale);
    mesh.position.set(x, 0.3, z);
    mesh.rotation.y = Math.random() * Math.PI;
    scene.add(mesh);
    const stump = makeStump();
    stump.position.set(x, 0.2, z);
    stump.visible = false;
    scene.add(stump);
    trees.push({ mesh, stump, x, z, scale, hp: CFG.tree.hp, alive: true, fall: 0, respawn: 0, shake: 0 });
  }
}

function chopTree(t) {
  t.hp--;
  t.shake = 0.25;
  Audio.S.chop();
  if (t.hp <= 0) {
    t.alive = false;
    t.fall = 0.6;
    t.stump.visible = true;
    Audio.S.treeFall();
    gainXp(CFG.level.treeXp);
    for (let i = 0; i < CFG.tree.logs; i++) spawnPickup('wood', t.x, t.z, 1.4);
  }
}

function updateTrees(dt) {
  for (const t of trees) {
    if (t.shake > 0) {
      t.shake -= dt;
      t.mesh.rotation.z = Math.sin(S.time * 40) * 0.05 * Math.max(0, t.shake / 0.25);
    }
    if (!t.alive) {
      if (t.fall > 0) {
        t.fall -= dt;
        t.mesh.rotation.z = THREE.MathUtils.lerp(t.mesh.rotation.z, Math.PI / 2.1, 1 - Math.pow(0.002, dt));
        if (t.fall <= 0) {
          t.mesh.visible = false;
          t.mesh.rotation.z = 0;
          t.respawn = CFG.tree.respawn;
        }
      } else if (t.respawn > 0) {
        t.respawn -= dt;
        if (t.respawn <= 0) {
          t.alive = true;
          t.hp = CFG.tree.hp;
          t.mesh.visible = true;
          t.mesh.scale.setScalar(t.scale * 0.15);
          t.stump.visible = false;
        }
      }
    } else if (t.mesh.scale.x < t.scale) {
      t.mesh.scale.setScalar(Math.min(t.scale, t.mesh.scale.x + dt * t.scale * 0.6));
    }
  }
}

/* ============================================================ 떨어진 자원 */

function spawnPickup(type, x, z, spread = 1) {
  const mesh = type === 'wood' ? makeLog() : makeMeat();
  mesh.position.set(x, 1.2, z);
  scene.add(mesh);
  const a = Math.random() * Math.PI * 2;
  pickups.push({
    type, mesh,
    vx: Math.cos(a) * (1.5 + Math.random() * 2.5) * spread,
    vz: Math.sin(a) * (1.5 + Math.random() * 2.5) * spread,
    vy: 5 + Math.random() * 3,
    settled: false, life: 90, claimed: null,
  });
}

function updatePickups(dt) {
  const cap = carryCap();
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const o = p.mesh;
    if (!p.settled) {
      p.vy -= 20 * dt;
      o.position.x += p.vx * dt;
      o.position.z += p.vz * dt;
      o.position.y += p.vy * dt;
      o.rotation.x += dt * 5;
      if (o.position.y <= 0.35) {
        o.position.y = 0.35;
        p.vy = -p.vy * 0.3;
        p.vx *= 0.4;
        p.vz *= 0.4;
        if (Math.abs(p.vy) < 1.2) {
          p.settled = true;
          o.rotation.set(0, Math.random() * Math.PI, p.type === 'wood' ? 0 : 0);
        }
      }
    } else {
      o.position.y = 0.4 + Math.sin(S.time * 3 + i) * 0.05;
      o.rotation.y += dt * 1.0;
    }

    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(o);
      pickups.splice(i, 1);
      continue;
    }

    // 종류별로 따로 담는다(한쪽이 가득 차도 다른 쪽은 계속 주울 수 있다)
    if (S.dead <= 0 && S.carry[p.type] < cap) {
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z);
      if (d < CFG.player.pickRadius) {
        S.carry[p.type]++;
        if (p.type === 'wood') Audio.S.pickWood(); else Audio.S.pickMeat();
        if (S.carry[p.type] >= cap) Audio.S.full();
        scene.remove(o);
        pickups.splice(i, 1);
      }
    }
  }
  syncCarry();
}

// 머리 위 짐 더미 — 나무와 고기를 좌우로 나눠 따로 쌓는다
function syncCarry() {
  for (const type of ['wood', 'meat']) {
    const arr = carryMeshes[type];
    const g = carryGroups[type];
    const n = S.carry[type];
    while (arr.length > n) g.remove(arr.pop());
    while (arr.length < n) {
      const m = type === 'wood' ? makeLog(1.05) : makeMeat();
      m.position.y = arr.length * 0.3;
      m.scale.setScalar(type === 'wood' ? 0.8 : 0.85);
      m.rotation.y = type === 'wood' ? (arr.length % 2) * 0.35 : Math.random() * Math.PI;
      g.add(m);
      arr.push(m);
    }
  }
}

const carryTotal = () => S.carry.wood + S.carry.meat;

// 한 개 내려놓기
function takeFromCarry(type) {
  if (S.carry[type] <= 0) return false;
  S.carry[type]--;
  syncCarry();
  return true;
}

/* ================================================================== 전투 */

function nearestBear(x, z, maxD) {
  let best = null;
  let bestD = maxD;
  for (const b of bears) {
    const d = Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function nearestTree(x, z, maxD) {
  let best = null;
  let bestD = maxD;
  for (const t of trees) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function startSwing() {
  const px = player.position.x;
  const pz = player.position.z;
  const bear = nearestBear(px, pz, CFG.sword.range + 0.4);
  const tree = bear ? null : nearestTree(px, pz, CFG.sword.range - 0.3);
  const target = bear || tree;

  Audio.S.swing();
  S.swingTarget = target;
  S.swingT = 0.3;
  S.swingHit = false;
  S.swingCd = swingCooldown();

  if (target) {
    const tx = bear ? target.mesh.position.x : target.x;
    const tz = bear ? target.mesh.position.z : target.z;
    player.rotation.y = Math.atan2(tx - px, tz - pz);
  }

  // 궤적을 휘두르는 방향에 맞춰 세팅
  slash.position.set(px, 1.25, pz);
  slash.rotation.y = player.rotation.y + 0.95;
  slash.material.opacity = 0;
  slashGhost.position.set(px, 1.05, pz);
  slashGhost.rotation.y = slash.rotation.y;
  slashGhost.material.opacity = 0;
}

// 타격 지점에서 불똥을 튀긴다
function burstSparks(x, y, z, color = 0xfff2cf, speed = 4.5) {
  const slot = sparkPool.find((s2) => s2.life <= 0) || sparkPool[0];
  const arr = slot.pts.geometry.attributes.position.array;
  const vel = slot.pts.userData.vel;
  for (let i = 0; i < slot.pts.userData.count; i++) {
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
    const a = Math.random() * Math.PI * 2;
    const up = 0.4 + Math.random() * 1.2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    vel[i * 3] = Math.cos(a) * sp;
    vel[i * 3 + 1] = up * speed * 0.5;
    vel[i * 3 + 2] = Math.sin(a) * sp;
  }
  slot.pts.geometry.attributes.position.needsUpdate = true;
  slot.pts.material.color.setHex(color);
  slot.pts.material.opacity = 1;
  slot.pts.visible = true;
  slot.life = 0.5;
}

function updateSparks(dt) {
  for (const slot of sparkPool) {
    if (slot.life <= 0) continue;
    slot.life -= dt;
    const arr = slot.pts.geometry.attributes.position.array;
    const vel = slot.pts.userData.vel;
    for (let i = 0; i < slot.pts.userData.count; i++) {
      vel[i * 3 + 1] -= 14 * dt;
      arr[i * 3] += vel[i * 3] * dt;
      arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }
    slot.pts.geometry.attributes.position.needsUpdate = true;
    slot.pts.material.opacity = Math.max(0, slot.life / 0.5);
    if (slot.life <= 0) slot.pts.visible = false;
  }
}

function applySwingHit() {
  const px = player.position.x;
  const pz = player.position.z;
  const fx = Math.sin(player.rotation.y);
  const fz = Math.cos(player.rotation.y);
  const cosArc = Math.cos(CFG.sword.arc / 2);

  let hitAny = false;
  for (const b of [...bears]) {
    const dx = b.mesh.position.x - px;
    const dz = b.mesh.position.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > CFG.sword.range + 0.5) continue;
    if ((dx / d) * fx + (dz / d) * fz < cosArc) continue;
    hurtBear(b, swordDamage());
    b.vx += (dx / d) * CFG.bear.knockback;
    b.vz += (dz / d) * CFG.bear.knockback;
    burstSparks(b.mesh.position.x, 1.3, b.mesh.position.z, 0xffd9c0, 5);
    hitAny = true;
  }
  if (hitAny) {
    world.shake(0.22);
    return;
  }

  const t = S.swingTarget;
  if (t && t.alive && Math.hypot(t.x - px, t.z - pz) < CFG.sword.range + 0.3) {
    chopTree(t);
    burstSparks(t.x, 1.1, t.z, 0xd8b98a, 3.6);
    world.shake(0.14);
  }
}

function updateSwing(dt) {
  const arm = player.userData.parts.shoulderR;
  if (S.swingT > 0) {
    S.swingT -= dt;
    const p = 1 - Math.max(0, S.swingT) / 0.3;
    arm.rotation.x = THREE.MathUtils.lerp(-2.3, 1.0, Math.min(1, p * 1.25));
    player.userData.parts.body.rotation.y = Math.sin(p * Math.PI) * 0.45;

    // 궤적이 몸을 따라 훑고 지나가며 옅어진다
    const sweep = THREE.MathUtils.lerp(0.95, -1.05, Math.min(1, p * 1.15));
    slash.position.set(player.position.x, 1.25, player.position.z);
    slash.rotation.y = player.rotation.y + sweep;
    slash.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.85;
    slash.scale.setScalar(0.9 + p * 0.25);

    const ghostP = Math.max(0, p - 0.16);
    slashGhost.position.set(player.position.x, 1.1, player.position.z);
    slashGhost.rotation.y = player.rotation.y + THREE.MathUtils.lerp(0.95, -1.05, Math.min(1, ghostP * 1.15));
    slashGhost.material.opacity = Math.sin(Math.min(1, ghostP) * Math.PI) * 0.4;
    slashGhost.scale.setScalar(0.85 + ghostP * 0.2);

    if (!S.swingHit && p > 0.42) {
      S.swingHit = true;
      applySwingHit();
    }
  } else {
    if (S.skillT <= 0) arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, 0, 1 - Math.pow(0.001, dt));
    player.userData.parts.body.rotation.y *= 0.8;
    slash.material.opacity *= 0.82;
    slashGhost.material.opacity *= 0.82;
  }
}

/* ================================================================ 스킬 */

const SKILL_IDS = ['whirl', 'charge', 'frost'];

// 스킬 레벨에 따른 수치(레벨 1이 기본값, 레벨마다 perLevel 만큼 변한다)
function skillParam(id, key) {
  const def = CFG.skills[id];
  const lv = Math.max(1, S.skills[id]);
  return (def[key] ?? 0) + (def.perLevel?.[key] ?? 0) * (lv - 1);
}

function skillReady(id) {
  return S.skills[id] > 0 && S.skillCd[id] <= 0;
}

function castSkill(id) {
  if (!skillReady(id) || S.skillT > 0) return;
  S.skillCd[id] = Math.max(1.5, skillParam(id, 'cooldown'));
  S.skillActive = id;
  S.skillT = CFG.skills[id].duration;
  S.skillHit = false;
  Audio.S.skill();
  hud.toast(`${CFG.skills[id].name}!`);

  if (id === 'whirl') {
    shockwave.visible = true;
    shockwave.material.color.setHex(0xbfe6ff);
    shockwave.material.opacity = 0.9;
    shockwave.scale.setScalar(1);
    shockwave.position.set(player.position.x, 0.5, player.position.z);
  } else if (id === 'charge') {
    S.chargeDir = player.rotation.y;
    S.chargeHitIds = new Set();
    slash.position.set(player.position.x, 1.25, player.position.z);
    slash.rotation.y = player.rotation.y;
  } else if (id === 'frost') {
    frostShards.position.set(player.position.x, 0.35, player.position.z);
    frostShards.visible = true;
    frostShards.scale.setScalar(0.35);
    shockwave.visible = true;
    shockwave.material.color.setHex(0x8fd4ff);
    shockwave.material.opacity = 0.95;
    shockwave.scale.setScalar(1);
    shockwave.position.set(player.position.x, 0.5, player.position.z);
  }
}

// 회전베기: 주변 전체를 벤다(나무도 찍는다)
function hitWhirl() {
  const px = player.position.x;
  const pz = player.position.z;
  const r = skillParam('whirl', 'radius');
  const dmg = swordDamage() * skillParam('whirl', 'damageMul');
  const knock = skillParam('whirl', 'knock');
  let hits = 0;

  for (const b of [...bears]) {
    const dx = b.mesh.position.x - px;
    const dz = b.mesh.position.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > r) continue;
    hurtBear(b, dmg);
    b.vx += (dx / d) * knock;
    b.vz += (dz / d) * knock;
    burstSparks(b.mesh.position.x, 1.4, b.mesh.position.z, 0xffe0b0, 6);
    hits++;
  }
  for (const t of [...trees]) {
    if (!t.alive || Math.hypot(t.x - px, t.z - pz) > r) continue;
    chopTree(t);
    burstSparks(t.x, 1.1, t.z, 0xd8b98a, 3.5);
    hits++;
  }
  world.shake(hits > 0 ? 0.5 : 0.25);
}

// 서리폭발: 넓은 범위 피해 + 둔화
function hitFrost() {
  const px = player.position.x;
  const pz = player.position.z;
  const r = skillParam('frost', 'radius');
  const dmg = swordDamage() * skillParam('frost', 'damageMul');
  const slowTime = skillParam('frost', 'slowTime');
  let hits = 0;

  for (const b of [...bears]) {
    const d = Math.hypot(b.mesh.position.x - px, b.mesh.position.z - pz);
    if (d > r) continue;
    hurtBear(b, dmg);
    b.slowT = slowTime;
    burstSparks(b.mesh.position.x, 1.4, b.mesh.position.z, 0x9fd8ff, 5);
    hits++;
  }
  world.shake(hits > 0 ? 0.4 : 0.2);
}

// 돌진베기: 앞으로 내달리며 스치는 야수를 벤다(프레임마다 판정)
function chargeSweep() {
  const px = player.position.x;
  const pz = player.position.z;
  const w = CFG.skills.charge.width;
  const dmg = swordDamage() * skillParam('charge', 'damageMul');
  const knock = skillParam('charge', 'knock');

  for (const b of [...bears]) {
    if (S.chargeHitIds.has(b)) continue;
    const dx = b.mesh.position.x - px;
    const dz = b.mesh.position.z - pz;
    if (Math.hypot(dx, dz) > w + 1.4) continue;
    S.chargeHitIds.add(b);
    hurtBear(b, dmg);
    const len = Math.hypot(dx, dz) || 1;
    b.vx += (dx / len) * knock;
    b.vz += (dz / len) * knock;
    burstSparks(b.mesh.position.x, 1.4, b.mesh.position.z, 0xffe6c4, 6);
    world.shake(0.35);
  }
}

function updateSkills(dt) {
  for (const id of SKILL_IDS) S.skillCd[id] = Math.max(0, S.skillCd[id] - dt);
  if (S.skillT <= 0) return;

  const id = S.skillActive;
  const dur = CFG.skills[id].duration;
  S.skillT -= dt;
  const p = 1 - Math.max(0, S.skillT) / dur;
  player.userData.parts.shoulderR.rotation.x = 1.2;

  if (id === 'whirl') {
    player.rotation.y += dt * (Math.PI * 4) / dur * (1 - p * 0.3);
    slash.position.set(player.position.x, 1.3, player.position.z);
    slash.rotation.y = player.rotation.y;
    slash.scale.setScalar(1.5);
    slash.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.9;
    shockwave.position.set(player.position.x, 0.5, player.position.z);
    shockwave.scale.setScalar(1 + p * skillParam('whirl', 'radius'));
    shockwave.material.opacity = (1 - p) * 0.85;
    if (!S.skillHit && p > 0.28) {
      S.skillHit = true;
      hitWhirl();
    }
  } else if (id === 'charge') {
    const speed = skillParam('charge', 'distance') / dur;
    const nx = player.position.x + Math.sin(S.chargeDir) * speed * dt;
    const nz = player.position.z + Math.cos(S.chargeDir) * speed * dt;
    const [cx, cz] = wallClamp(player.position.x, player.position.z, nx, nz);
    player.position.x = THREE.MathUtils.clamp(cx, -160, 160);
    player.position.z = THREE.MathUtils.clamp(cz, -160, 160);
    player.rotation.y = S.chargeDir;
    slash.position.set(player.position.x, 1.25, player.position.z);
    slash.rotation.y = S.chargeDir - 0.4;
    slash.scale.setScalar(1.1);
    slash.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.8;
    chargeSweep();
  } else if (id === 'frost') {
    frostShards.scale.setScalar(0.35 + p * 1.5);
    frostShards.rotation.y += dt * 2.4;
    for (const shard of frostShards.children) {
      shard.material.opacity = (1 - p) * 0.9;
      shard.position.y = 0.6 + p * 1.4;
    }
    shockwave.position.set(player.position.x, 0.5, player.position.z);
    shockwave.scale.setScalar(1 + p * skillParam('frost', 'radius'));
    shockwave.material.opacity = (1 - p) * 0.9;
    if (!S.skillHit && p > 0.22) {
      S.skillHit = true;
      hitFrost();
    }
  }

  if (S.skillT <= 0) {
    shockwave.visible = false;
    frostShards.visible = false;
    slash.scale.setScalar(1);
    S.skillActive = null;
  }
}

/* ============================================================ 레벨 / 경험치 */

const xpNeed = (level) => CFG.level.baseXp + CFG.level.stepXp * (level - 1);

function gainXp(n) {
  if (S.level >= CFG.level.maxLevel) return;
  S.xp += n;
  while (S.level < CFG.level.maxLevel && S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++;
    S.pendingLevels++;
  }
  hud.setLevel(S.level, S.xp, xpNeed(S.level));
  if (S.pendingLevels > 0 && !S.choosing) openLevelUp();
}

function skillUpText(id) {
  const def = CFG.skills[id];
  const per = def.perLevel || {};
  const bits = [];
  if (per.damageMul) bits.push(`피해 +${Math.round(per.damageMul * 100)}%p`);
  if (per.radius) bits.push(`범위 +${per.radius}`);
  if (per.distance) bits.push(`거리 +${per.distance}`);
  if (per.slowTime) bits.push(`둔화 +${per.slowTime}초`);
  if (per.cooldown) bits.push(`쿨타임 ${per.cooldown}초`);
  return bits.join(', ');
}

function buildCards() {
  const owned = SKILL_IDS.filter((id) => S.skills[id] > 0);
  const pool = [];

  for (const id of SKILL_IDS) {
    const def = CFG.skills[id];
    const lv = S.skills[id];
    if (lv === 0) {
      pool.push({
        kind: 'new', weight: 3,
        title: `${def.name} (${def.key})`,
        desc: def.desc,
        effect: '새 스킬 습득',
        apply: () => { S.skills[id] = 1; },
      });
    } else if (lv < CFG.skillMaxLevel) {
      pool.push({
        kind: 'up', weight: 2,
        title: `${def.name} Lv.${lv + 1}`,
        desc: def.desc,
        effect: skillUpText(id),
        apply: () => { S.skills[id]++; },
      });
    }
  }

  // 첫 스킬을 고르는 레벨에서는 스킬만 보여준다
  if (owned.length === 0) return pool.slice(0, 3);

  pool.push({
    kind: 'stat', weight: 1, title: '튼튼한 몸', desc: '추운 밤에도 더 오래 버틴다',
    effect: '최대 체력 +25',
    apply: () => { S.bonus.hp += 25; S.hp += 25; },
  });
  pool.push({
    kind: 'stat', weight: 1, title: '날랜 발', desc: '눈밭을 더 빠르게 가로지른다',
    effect: '이동 속도 +8%',
    apply: () => { S.bonus.speed += 0.08; },
  });
  pool.push({
    kind: 'stat', weight: 1, title: '날카로운 검', desc: '한 번의 휘두름이 더 깊게 든다',
    effect: '검 피해 +10',
    apply: () => { S.bonus.dmg += 10; },
  });

  // 가중치를 반영해 섞은 뒤 세 장만
  const bag = [];
  for (const c of pool) for (let i = 0; i < c.weight; i++) bag.push(c);
  const picked = [];
  while (picked.length < 3 && bag.length) {
    const c = bag.splice((Math.random() * bag.length) | 0, 1)[0];
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

function openLevelUp() {
  S.choosing = true;
  S.running = false;
  Audio.S.levelup();
  levelUp.show(S.level, buildCards(), (card) => {
    card.apply();
    S.pendingLevels--;
    S.choosing = false;
    hud.setSwordLevel(S.swordLevel);
    updateActionUi();          // 습득한 스킬 버튼을 바로 보여준다
    if (S.pendingLevels > 0) {
      openLevelUp();
    } else {
      S.running = true;
      saveGame();
    }
  });
}

/* ================================================================== 곰 */

// 정착지에서 멀수록 강한 등급이 나온다
function tierForDepth(depth) {
  let tier = CFG.bear.tiers[0];
  for (const t of CFG.bear.tiers) if (depth >= t.depth) tier = t;
  return tier;
}

const inRegion = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

// 플레이어가 밖에 있으면 그 근처(조금 떨어진 곳)에서 우선 나오게 한다
function spawnPointNear(region) {
  if (inCamp(player.position.x, player.position.z)) return null;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 18 + Math.random() * 22;
    const x = player.position.x + Math.cos(a) * d;
    const z = player.position.z + Math.sin(a) * d;
    if (inRegion(region, x, z)) return [x, z];
  }
  return null;
}

function spawnBear(atX, atZ) {
  // 사냥터와 숲 양쪽에 나온다(깊이 들어갈수록 위험하다)
  const region = Math.random() < 0.5 ? FIELD : FOREST;
  const near = (atX === undefined && Math.random() < 0.7) ? spawnPointNear(region) : null;
  const x = atX ?? (near ? near[0] : region.x0 + Math.random() * (region.x1 - region.x0));
  const z = atZ ?? (near ? near[1] : region.z0 + Math.random() * (region.z1 - region.z0));
  const depth = Math.hypot(x - C.x, z - C.z);
  const tier = tierForDepth(depth);

  const g = makeBear(tier);
  g.position.set(x, 0.35, z);
  const bar = makeHpBar(1.7 * tier.scale, 0.22);
  bar.group.position.y = 2.1 * tier.scale + 0.4;
  g.add(bar.group);
  scene.add(g);

  bears.push({
    mesh: g, bar, tier, region,
    hp: tier.hp, maxHp: tier.hp,
    atkCd: 0, wander: new THREE.Vector2(x, z), wanderCd: 0,
    vx: 0, vz: 0, flash: 0, slowT: 0,
  });
}

function hurtBear(b, dmg) {
  b.hp -= dmg;
  b.flash = 0.12;
  b.bar.setRatio(b.hp / b.maxHp);
  Audio.S.bearHit();
  if (b.hp <= 0) {
    Audio.S.bearDie();
    for (let i = 0; i < b.tier.meat; i++) spawnPickup('meat', b.mesh.position.x, b.mesh.position.z);
    gainXp(b.tier.xp);
    scene.remove(b.mesh);
    bears.splice(bears.indexOf(b), 1);
  }
}

function updateBears(dt) {
  S.spawnTimer -= dt;
  if (S.spawnTimer <= 0 && bears.length < CFG.bear.maxAlive) {
    spawnBear();
    S.spawnTimer = CFG.bear.spawnCd;
  }

  for (const b of bears) {
    const m = b.mesh;
    const tier = b.tier;
    b.atkCd -= dt;
    b.flash = Math.max(0, b.flash - dt);
    b.slowT = Math.max(0, b.slowT - dt);
    const slowed = b.slowT > 0;
    const speed = tier.speed * (slowed ? CFG.skills.frost.slow : 1);

    const baseScale = tier.scale;
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, b.flash > 0 ? baseScale * 1.1 : baseScale, 0.35));

    m.position.x += b.vx * dt;
    m.position.z += b.vz * dt;
    b.vx *= 1 - Math.min(1, 6 * dt);
    b.vz *= 1 - Math.min(1, 6 * dt);

    const dx = player.position.x - m.position.x;
    const dz = player.position.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    const chasing = S.dead <= 0 && dist < CFG.bear.aggro;

    if (chasing && dist > CFG.bear.atkRange + 0.5) {
      moveToward(m, player.position.x, player.position.z, speed, dt);
    } else if (chasing) {
      m.rotation.y = Math.atan2(dx, dz);
      if (b.atkCd <= 0) {
        b.atkCd = CFG.bear.atkCd;
        damagePlayer(tier.dmg);
        m.scale.setScalar(baseScale * 1.2);
      }
    } else {
      b.wanderCd -= dt;
      if (b.wanderCd <= 0) {
        b.wanderCd = 2 + Math.random() * 3;
        b.wander.set(
          b.region.x0 + Math.random() * (b.region.x1 - b.region.x0),
          b.region.z0 + Math.random() * (b.region.z1 - b.region.z0),
        );
      }
      moveToward(m, b.wander.x, b.wander.y, speed * 0.45, dt);
    }

    // 같은 자리에 겹치지 않도록 서로 밀어낸다
    for (const o of bears) {
      if (o === b) continue;
      const ox = o.mesh.position.x - m.position.x;
      const oz = o.mesh.position.z - m.position.z;
      const od = Math.hypot(ox, oz);
      const minD = 1.9 * (tier.scale + o.tier.scale) / 2;
      if (od > 0.001 && od < minD) {
        const push = (minD - od) * 0.5;
        m.position.x -= (ox / od) * push;
        m.position.z -= (oz / od) * push;
        o.mesh.position.x += (ox / od) * push;
        o.mesh.position.z += (oz / od) * push;
      }
    }

    // 자기 구역을 벗어나지 않는다(정착지 안으로는 못 들어온다)
    m.position.x = THREE.MathUtils.clamp(m.position.x, b.region.x0 - 3, b.region.x1 + 3);
    m.position.z = THREE.MathUtils.clamp(m.position.z, b.region.z0 - 3, b.region.z1 + 3);

    const gait = Math.sin(S.time * 9 + m.position.x);
    m.userData.parts.legs.forEach((leg, i) => { leg.rotation.x = gait * 0.5 * (i % 2 ? -1 : 1); });
    b.bar.group.quaternion.copy(camera.quaternion);
  }
}

/* ============================================================== 이동 공용 */

function inCamp(x, z) {
  return x > C.x - C.w / 2 && x < C.x + C.w / 2 && z > C.z - C.d / 2 && z < C.z + C.d / 2;
}

function wallClamp(px, pz, nx, nz) {
  const gate = (x, z) => x > GATE_X - 1.6 && Math.abs(z - C.z) < GATE_HALF;
  let rx = nx;
  let rz = nz;
  if (inCamp(px, pz) !== inCamp(nx, pz) && !gate(nx, pz)) rx = px;
  if (inCamp(rx, pz) !== inCamp(rx, nz) && !gate(rx, nz)) rz = pz;
  return [rx, rz];
}

function moveToward(obj, tx, tz, speed, dt) {
  const dx = tx - obj.position.x;
  const dz = tz - obj.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return 0;
  const step = Math.min(speed * dt, d);
  obj.position.x += (dx / d) * step;
  obj.position.z += (dz / d) * step;
  obj.rotation.y = Math.atan2(dx, dz);
  return d;
}

// 캠프 안팎을 오갈 때는 문을 경유한다
function routeThroughGate(obj, tx, tz, speed, dt) {
  const insideNow = inCamp(obj.position.x, obj.position.z);
  const insideGoal = inCamp(tx, tz);
  if (insideNow !== insideGoal) {
    return moveToward(obj, GATE_X + (insideNow ? 1.8 : -1.8), C.z, speed, dt);
  }
  return moveToward(obj, tx, tz, speed, dt);
}

function walkAnim(obj, moving, t, amp = 1) {
  const p = obj.userData.parts;
  if (!p) return;
  const s = moving ? Math.sin(t * 11) : 0;
  p.shoulderL.rotation.x = s * 0.8 * amp;
  if (S.swingT <= 0 || obj !== player) p.shoulderR.rotation.x = -s * 0.8 * amp;
  p.body.position.y = 0.92 + (moving ? Math.abs(s) * 0.05 : 0);
}

/* ============================================================== 플레이어 */

function updatePlayer(dt) {
  if (S.dead > 0) {
    S.dead -= dt;
    if (S.dead <= 0) {
      player.position.copy(SPAWN_POS);
      S.hp = maxHp();
      player.visible = true;
    }
    return;
  }

  const d = input.read();
  const len = Math.hypot(d.x, d.z);
  const moving = len > 0.08 && S.skillT <= 0;   // 스킬 중에는 제자리에서 회전
  if (moving) {
    const nx = player.position.x + d.x * moveSpeed() * dt;
    const nz = player.position.z + d.z * moveSpeed() * dt;
    const [cx, cz] = wallClamp(player.position.x, player.position.z, nx, nz);
    player.position.x = THREE.MathUtils.clamp(cx, -105, 105);
    player.position.z = THREE.MathUtils.clamp(cz, -105, 105);
    if (S.swingT <= 0) player.rotation.y = Math.atan2(d.x, d.z);
  }
  walkAnim(player, moving, S.time);
  footRing.position.set(player.position.x, 0.38, player.position.z);
  footRing.visible = player.visible;

  // A = 공격(누르고 있으면 계속), S/D/F = 스킬
  S.swingCd -= dt;
  let casted = false;
  for (const id of SKILL_IDS) {
    if (input.consume(id) && skillReady(id) && S.skillT <= 0) {
      castSkill(id);
      casted = true;
      break;
    }
  }
  if (!casted && input.held('attack') && S.swingCd <= 0 && S.swingT <= 0 && S.skillT <= 0) {
    startSwing();
  }
  updateSwing(dt);
  updateSkills(dt);

  S.hurtTimer -= dt;
  if (S.hurtTimer <= 0 && S.hp < maxHp()) {
    S.hp = Math.min(maxHp(), S.hp + CFG.player.regen * dt);
  }
  hud.setHp(S.hp / maxHp());
}

function damagePlayer(dmg) {
  S.hp -= dmg;
  S.hurtTimer = CFG.player.regenDelay;
  hud.flashDamage();
  Audio.S.hurt();
  if (S.hp <= 0) {
    S.hp = 0;
    S.dead = 1.6;
    player.visible = false;
    S.carry.wood = Math.ceil(S.carry.wood / 2);
    S.carry.meat = Math.ceil(S.carry.meat / 2);
    syncCarry();
    Audio.S.down();
    hud.toast('기절! 정착지로 돌아갑니다');
  }
}

/* ========================================================= 화로 / 판매대 */

function updateStations(dt) {
  S.depositTimer -= dt;
  const ready = S.depositTimer <= 0 && S.dead <= 0;
  const near = (pos) => Math.hypot(player.position.x - pos.x, player.position.z - pos.z) < 4.2;

  // 판매대: 통나무를 내려놓으면 바로 재고가 된다
  if (ready && near(STALL_POS) && S.carry.wood > 0 && S.stock.wood < CFG.stall.stockMax) {
    S.depositTimer = CFG.stall.depositRate;
    if (takeFromCarry('wood')) { S.stock.wood++; Audio.S.deposit(); }
  } else if (ready && near(FURNACE_POS) && S.carry.meat > 0 && S.cookQueue < CFG.grill.queueMax) {
    // 화로: 고기를 구우면 판매 재고가 된다
    S.depositTimer = CFG.stall.depositRate;
    if (takeFromCarry('meat')) { S.cookQueue++; Audio.S.deposit(); }
  }

  if (S.cookQueue > 0) {
    S.cookTimer -= dt;
    if (S.cookTimer <= 0) {
      S.cookTimer = CFG.grill.cookTime;
      S.cookQueue--;
      S.stock.meat = Math.min(CFG.stall.stockMax, S.stock.meat + 1);
      Audio.S.cook();
    }
  }

  const fire = furnace.userData.fire;
  const hot = S.cookQueue > 0;
  fire.scale.setScalar(THREE.MathUtils.lerp(fire.scale.x, hot ? 1.25 : 0.85, 0.15));
  furnace.userData.glow.intensity = (hot ? 16 : 10) + Math.sin(S.time * 10) * 1.2;

  refreshStockVisual();
}

/* ================================================================ 손님 */

// 판매대 앞 대기줄
const QUEUE_X = STALL_POS.x;
const QUEUE_Z0 = STALL_POS.z + 3.4;
const BUYER_SCALE = 1.02;
const slotZ = (i) => QUEUE_Z0 + i * 1.7;

function spawnBuyer() {
  const idx = buyers.filter((b) => b.state !== 'leave').length;
  const mesh = makeBuyer(buyers.length + Math.floor(S.time));
  mesh.position.set(QUEUE_X + (Math.random() - 0.5) * 0.5, 0.35, slotZ(idx));
  mesh.rotation.y = Math.PI;          // 카운터를 바라본다
  mesh.scale.setScalar(0.02);
  Object.assign(mesh.userData, { stack: [], group: new THREE.Group() });
  mesh.userData.group.position.y = 1.7;
  mesh.add(mesh.userData.group);
  scene.add(mesh);

  // 재고가 있는 물건을 사러 온다
  const has = ['wood', 'meat'].filter((k) => S.stock[k] > 0);
  const kind = has.length ? has[(Math.random() * has.length) | 0] : 'wood';
  const want = CFG.buyer.wantMin + Math.floor(Math.random() * (CFG.buyer.wantMax - CFG.buyer.wantMin + 1));
  const label = makeLabel(kind, `× ${want}`, 2.2);
  label.sprite.position.y = 3.0;
  mesh.add(label.sprite);

  Audio.S.buyerCome();
  buyers.push({ mesh, label, kind, want, state: 'queue', serve: CFG.buyer.serveTime, got: 0, bye: 0, paid: 0 });
}

function updateBuyers(dt) {
  S.buyerTimer -= dt;
  const waiting = buyers.filter((b) => b.state !== 'leave').length;
  if (S.buyerTimer <= 0 && waiting < CFG.buyer.maxQueue && S.stock.wood + S.stock.meat > 0) {
    S.buyerTimer = CFG.buyer.interval;
    spawnBuyer();
  }

  let slot = 0;
  for (let i = buyers.length - 1; i >= 0; i--) {
    const b = buyers[i];
    const m = b.mesh;
    let moving = false;

    if (b.state === 'leave') {
      b.bye += dt;
      m.position.z += dt * CFG.buyer.speed * 0.8;
      m.position.x += dt * CFG.buyer.speed * 0.5;
      m.rotation.y = Math.PI * 0.25;
      moving = true;
      const k = Math.max(0, 1 - b.bye / 1.1);
      m.scale.setScalar(BUYER_SCALE * k);
      if (b.bye > 1.1) {
        scene.remove(m);
        buyers.splice(i, 1);
        continue;
      }
    } else {
      // 앞사람이 빠지면 한 칸씩 당겨 선다
      const idx = slot++;
      const targetZ = slotZ(idx);
      m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, BUYER_SCALE, 1 - Math.pow(0.002, dt)));
      const dz = targetZ - m.position.z;
      if (Math.abs(dz) > 0.06) {
        m.position.z += Math.sign(dz) * Math.min(Math.abs(dz), CFG.buyer.speed * dt);
        moving = true;
      }
      const dx = QUEUE_X - m.position.x;
      if (Math.abs(dx) > 0.06) m.position.x += Math.sign(dx) * Math.min(Math.abs(dx), CFG.buyer.speed * dt);
      m.rotation.y = Math.PI;

      if (idx === 0 && S.stock[b.kind] > 0) {
        b.serve -= dt;
        if (b.serve <= 0) {
          b.serve = CFG.buyer.serveTime / 2;
          S.stock[b.kind]--;
          b.got++;
          const price = b.kind === 'wood' ? CFG.goods.woodPrice : CFG.goods.meatPrice;
          b.paid += price;
          spawnBill(price);
          const item = b.kind === 'wood' ? makeLog(0.9) : makeMeat();
          item.scale.setScalar(0.8);
          item.position.y = m.userData.stack.length * 0.28;
          m.userData.group.add(item);
          m.userData.stack.push(item);
          b.label.render(`× ${b.want - b.got}`);
          if (b.got >= b.want) {
            b.state = 'leave';
            b.label.sprite.visible = false;
            S.served++;
            gainXp(CFG.level.saleXp * b.got);
            Audio.S.sell();
            hud.toast(`판매 완료! +$${b.paid}`);
          }
        }
      }
    }

    walkAnim(m, moving, S.time + i, 0.7);
    if (b.label.sprite.visible) b.label.sprite.quaternion.copy(camera.quaternion);
  }
}

/* ============================================================== 낮 / 밤 */

const CYCLE = CFG.dayNight.day + CFG.dayNight.night;

// 1 = 한낮, 0 = 한밤 (해질녘·새벽은 그 사이를 오간다)
function daylightFactor() {
  const { day, night, blend } = CFG.dayNight;
  const t = S.clock % CYCLE;
  if (t < day - blend) return 1;
  if (t < day) return 1 - (t - (day - blend)) / blend;
  if (t < day + night - blend) return 0;
  return (t - (day + night - blend)) / blend;
}

function updateDayNight(dt) {
  S.clock += dt;
  const dayNo = Math.floor(S.clock / CYCLE) + 1;
  const f = daylightFactor();
  world.setDaylight(f);

  // 어두워지면 횃불을 든다
  const torchOn = f < 0.62;
  handTorch.visible = torchOn;
  handTorch.userData.light.intensity = torchOn ? (1 - f) * 9 : 0;
  if (torchOn) handTorch.userData.flame.scale.setScalar(0.85 + Math.sin(S.time * 11) * 0.15);

  const night = f < 0.4;
  if (night !== S.night) {
    S.night = night;
    hud.toast(night ? '밤이 되었습니다 — 횃불을 들었습니다' : `${dayNo}일차 아침이 밝았습니다`);
  }
  S.day = dayNo;
  hud.setDay(dayNo, night);
}

/* ================================================================ 현금 */

function spawnBill(value) {
  if (bills.length >= CFG.cash.maxBills) {
    S.money += value; // 더미가 가득 차면 바로 금고로
    hud.setMoney(S.money);
    return;
  }
  const m = makeCashBill();
  const i = bills.length;
  m.position.set(
    CASH_POS.x + ((i % 4) - 1.5) * 0.72,
    0.45 + Math.floor(i / 12) * 0.1,
    CASH_POS.z + ((Math.floor(i / 4) % 3) - 1) * 0.5,
  );
  m.rotation.y = (Math.random() - 0.5) * 0.4;
  scene.add(m);
  bills.push({ mesh: m, value, pop: 0.3 });
}

function updateBills(dt) {
  const pd = Math.hypot(player.position.x - CASH_POS.x, player.position.z - CASH_POS.z);
  cashLabel.sprite.visible = bills.length > 0;
  if (bills.length > 0) {
    cashLabel.render(`$ ${bills.reduce((n, b) => n + b.value, 0)}`);
  }
  for (let i = bills.length - 1; i >= 0; i--) {
    const b = bills[i];
    if (b.pop > 0) {
      b.pop -= dt;
      b.mesh.rotation.z = b.pop * 1.6;
    }
    if (S.dead <= 0 && pd < 2.8) {
      S.money += b.value;
      hud.setMoney(S.money);
      hud.bumpMoney();
      Audio.S.coin();
      scene.remove(b.mesh);
      bills.splice(i, 1);
    }
  }
}

/* ============================================================ 구매 패드 */

function updatePads(dt) {
  for (const p of pads) {
    if (p.done) continue;
    const onPad = S.dead <= 0
      && Math.abs(player.position.x - p.x) < 1.9
      && Math.abs(player.position.z - p.z) < 1.9;
    const price = padPrice(p);

    if (onPad && S.money > 0) {
      const pay = Math.min(price * CFG.padFillRate * dt, S.money, price - p.paid);
      S.money -= pay;
      p.paid += pay;
      hud.setMoney(S.money);
      if (p.paid >= price - 0.01) {
        p.paid = 0;
        p.level++;
        Audio.S.buy();
        p.buy(false);
        refreshPad(p);
        saveGame();
        continue;
      }
    }
    const ratio = p.paid / price;
    p.group.userData.fill.scale.z = Math.max(0.001, ratio);
    p.group.userData.fill.position.z = -(p.group.userData.depth * (1 - ratio)) / 2;
  }
}

/* ========================================================= 궁수 / 일꾼 */

function updateTowers(dt) {
  for (const t of towers) {
    if (!t.visible) continue;
    t.userData.cd -= dt;
    const best = nearestBear(t.position.x, t.position.z, CFG.archer.range);
    if (best) {
      t.userData.archer.rotation.y = Math.atan2(
        best.mesh.position.x - t.position.x, best.mesh.position.z - t.position.z,
      );
      if (t.userData.cd <= 0) {
        t.userData.cd = CFG.archer.cd;
        Audio.S.arrow();
        const arrow = makeArrow();
        arrow.position.set(t.position.x, 3.0, t.position.z);
        scene.add(arrow);
        arrows.push({ mesh: arrow, target: best });
      }
    }
  }

  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    const t = a.target;
    if (!t || !bears.includes(t)) {
      scene.remove(a.mesh);
      arrows.splice(i, 1);
      continue;
    }
    const dx = t.mesh.position.x - a.mesh.position.x;
    const dy = 1.4 - a.mesh.position.y;
    const dz = t.mesh.position.z - a.mesh.position.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1.0) {
      hurtBear(t, CFG.archer.damage);
      scene.remove(a.mesh);
      arrows.splice(i, 1);
      continue;
    }
    const step = CFG.archer.arrowSpeed * dt;
    a.mesh.position.x += (dx / d) * step;
    a.mesh.position.y += (dy / d) * step;
    a.mesh.position.z += (dz / d) * step;
    a.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
  }
}

function nearestPickup(from, type) {
  let best = null;
  let bestD = Infinity;
  for (const p of pickups) {
    if (type && p.type !== type) continue;
    if (p.claimed && p.claimed !== from) continue;
    const d = Math.hypot(p.mesh.position.x - from.position.x, p.mesh.position.z - from.position.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function updateWorkers(dt) {
  for (const w of workers) {
    const u = w.userData;
    let moving = true;

    if (u.state === 'seek') {
      if (!u.target || !pickups.includes(u.target)) {
        u.target = nearestPickup(w, u.type);
        if (u.target) {
          u.target.claimed = w;
          u.type = u.target.type; // 한 번에 한 종류만 나른다
        }
      }
      if (u.target) {
        const d = routeThroughGate(w, u.target.mesh.position.x, u.target.mesh.position.z, CFG.worker.speed, dt);
        if (d < 1.5 && !inCamp(u.target.mesh.position.x, u.target.mesh.position.z) === !inCamp(w.position.x, w.position.z)) {
          scene.remove(u.target.mesh);
          pickups.splice(pickups.indexOf(u.target), 1);
          u.target = null;
          u.carry++;
          if (u.carry >= CFG.worker.carryCap) u.state = 'haul';
        }
      } else if (u.carry > 0) {
        u.state = 'haul';
      } else {
        moveToward(w, GATE_X + 4, C.z + 3, CFG.worker.speed * 0.6, dt);
        moving = false;
      }
    } else {
      const dest = u.type === 'wood' ? STALL_POS : FURNACE_POS;
      const d = routeThroughGate(w, dest.x, dest.z + 3, CFG.worker.speed, dt);
      if (d < 3.6 && inCamp(w.position.x, w.position.z)) {
        if (u.type === 'wood') S.stock.wood = Math.min(CFG.stall.stockMax, S.stock.wood + u.carry);
        else S.cookQueue = Math.min(CFG.grill.queueMax, S.cookQueue + u.carry);
        u.carry = 0;
        u.type = null;
        u.state = 'seek';
      }
    }

    // 일꾼이 든 짐 표시
    const g = u.group;
    while (u.stack.length > u.carry) g.remove(u.stack.pop());
    while (u.stack.length < u.carry) {
      const m = u.type === 'wood' ? makeLog(0.9) : makeMeat();
      m.scale.setScalar(0.75);
      m.position.y = u.stack.length * 0.26;
      g.add(m);
      u.stack.push(m);
    }
    walkAnim(w, moving, S.time + w.position.x, 0.8);
  }
}

/* ============================================================= 액션 UI */

// 터치 기기는 우측 고정 버튼, PC는 캐릭터 옆에 뜨는 A/S 키 안내
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
input.bindButtons(
  document.getElementById('btn-attack'),
  document.querySelectorAll('#action-pad [data-skill]'),
);

const keyHints = document.getElementById('key-hints');
const projV = new THREE.Vector3();

const minimap = createMinimap(document.getElementById('minimap'));
const MINIMAP_STATIONS = [
  { x: FURNACE_POS.x, z: FURNACE_POS.z },
  { x: STALL_POS.x, z: STALL_POS.z },
  { x: CASH_POS.x, z: CASH_POS.z },
];
let minimapTimer = 0;

function updateActionUi() {
  const px = player.position.x;
  const pz = player.position.z;
  const target = nearestBear(px, pz, CFG.sword.range + 0.6) || nearestTree(px, pz, CFG.sword.range);
  const canAttack = !!target && S.dead <= 0;

  hud.setAttack(canAttack);
  hud.setSkills(SKILL_IDS.map((id) => ({
    id,
    owned: S.skills[id] > 0,
    level: S.skills[id],
    remain: S.skillCd[id],
    total: Math.max(1.5, skillParam(id, 'cooldown')),
  })));

  const anySkill = SKILL_IDS.some((id) => S.skills[id] > 0);
  if (!isTouch) {
    projV.set(px, 2.4, pz).project(camera);
    const x = (projV.x * 0.5 + 0.5) * innerWidth;
    const y = (-projV.y * 0.5 + 0.5) * innerHeight;
    keyHints.style.transform = `translate(${Math.round(x + 46)}px, ${Math.round(y)}px)`;
    // 나무나 야수가 사정거리에 들어오면 캐릭터 옆에 뜬다
    keyHints.classList.toggle('show', canAttack || (anySkill && S.dead <= 0 && !inCamp(px, pz)));
  }
}

// 정착지 밖에서만 미니맵을 띄운다
function updateMinimap(dt) {
  const outside = !inCamp(player.position.x, player.position.z);
  world.updateHouse(player.position.x, player.position.z, !outside, dt);
  hud.setMinimap(outside);
  if (!outside) return;
  minimapTimer -= dt;
  if (minimapTimer > 0) return;
  minimapTimer = 0.09;
  minimap.draw({
    player, bears, trees, pickups, buyers,
    stations: MINIMAP_STATIONS,
    night: S.night,
  });
}

/* ================================================================ 안내 */

function updateHint() {
  const cap = carryCap();
  let msg;
  if (S.carry.wood >= cap && S.carry.meat >= cap) msg = '양손이 가득 찼습니다! 정착지로 돌아가세요';
  else if (S.carry.wood >= cap) msg = '나무가 가득! 판매대에 내려놓으세요';
  else if (S.carry.meat >= cap) msg = '고기가 가득! 화로에 넣으세요';
  else if (buyers.some((b) => b.state === 'serve' && S.stock[b.type] === 0)) {
    msg = '손님이 물건을 기다립니다!';
  } else if (bills.length >= 6) msg = '판매대 옆 돈다발을 주우세요';
  else if (S.carry.wood > 0) msg = '판매대에 통나무를 내려놓으세요';
  else if (S.carry.meat > 0) msg = '화로에 고기를 넣으세요';
  else if (S.stock.wood + S.stock.meat === 0) {
    const owned = SKILL_IDS.filter((id) => S.skills[id] > 0).map((id) => CFG.skills[id].key);
    msg = isTouch
      ? `북쪽 숲이나 남쪽 사냥터에서 A 버튼으로 공격${owned.length ? ' · 스킬 버튼도 쓰세요' : ''}`
      : `이동은 방향키, 공격 A${owned.length ? ` · 스킬 ${owned.join('/')}` : ' (Lv.2부터 스킬 습득)'}`;
  }
  else msg = '손님이 오기를 기다리는 중...';
  hud.setHint(msg);
}

/* ============================================================ 저장/불러오기 */

function snapshot() {
  return {
    money: Math.floor(S.money),
    swordLevel: S.swordLevel,
    bagLevel: S.bagLevel,
    workers: workers.length,
    towers: towers.map((t) => t.visible),
    padLevels: Object.fromEntries(pads.map((p) => [p.id, p.level])),
    stock: { ...S.stock },
    served: S.served,
    clock: Math.round(S.clock),
    level: S.level,
    xp: Math.round(S.xp),
    skills: { ...S.skills },
    bonus: { ...S.bonus },
  };
}

function saveGame() {
  return writeSave(snapshot());
}

function applySave(data) {
  S.money = data.money || 0;
  S.stock.wood = data.stock?.wood || 0;
  S.stock.meat = data.stock?.meat || 0;
  // 예전 저장본에 남아 있던 조리된 고기도 재고로 합친다
  S.stock.meat += data.stock?.cooked || 0;
  S.served = data.served || 0;
  S.clock = data.clock || 0;
  S.level = data.level || 1;
  S.xp = data.xp || 0;
  if (data.skills) for (const id of SKILL_IDS) S.skills[id] = data.skills[id] || 0;
  if (data.bonus) S.bonus = { hp: 0, speed: 0, dmg: 0, ...data.bonus };
  S.hp = maxHp();
  hud.setLevel(S.level, S.xp, xpNeed(S.level));

  for (let i = 0; i < (data.swordLevel || 0); i++) upgradeSword(true);
  for (let i = 0; i < (data.bagLevel || 0); i++) upgradeBag(true);
  for (let i = 0; i < (data.workers || 0); i++) hireWorker(true);
  (data.towers || []).forEach((on, i) => { if (on) unlockTower(i, true); });

  for (const p of pads) {
    p.level = data.padLevels?.[p.id] || 0;
    p.paid = 0;
    refreshPad(p);
  }
  hud.setMoney(S.money);
  refreshStockVisual();
}

function resetGame() {
  S.money = 0;
  S.swordLevel = 0;
  S.bagLevel = 0;
  S.stock = { wood: 0, meat: 0 };
  S.cookQueue = 0;
  S.served = 0;
  S.hp = maxHp();
  S.dead = 0;
  S.clock = 0;
  S.day = 1;
  S.night = false;
  S.level = 1;
  S.xp = 0;
  S.pendingLevels = 0;
  S.choosing = false;
  S.bonus = { hp: 0, speed: 0, dmg: 0 };
  for (const id of SKILL_IDS) {
    S.skills[id] = 0;
    S.skillCd[id] = 0;
  }
  S.skillActive = null;
  S.skillT = 0;
  S.swingT = 0;
  levelUp.hide();
  frostShards.visible = false;
  shockwave.visible = false;
  slash.material.opacity = 0;
  slashGhost.material.opacity = 0;
  S.carry.wood = 0;
  S.carry.meat = 0;
  syncCarry();

  for (const w of workers) scene.remove(w);
  workers.length = 0;
  for (const b of buyers) scene.remove(b.mesh);
  buyers.length = 0;
  for (const b of bills) scene.remove(b.mesh);
  bills.length = 0;
  for (const p of pickups) scene.remove(p.mesh);
  pickups.length = 0;
  for (const b of [...bears]) { scene.remove(b.mesh); }
  bears.length = 0;
  for (const t of towers) t.visible = false;
  for (const p of pads) { p.level = 0; p.paid = 0; refreshPad(p); }
  for (const t of trees) {
    t.alive = true;
    t.hp = CFG.tree.hp;
    t.mesh.visible = true;
    t.mesh.rotation.z = 0;
    t.mesh.scale.setScalar(t.scale);
    t.stump.visible = false;
    t.respawn = 0;
    t.fall = 0;
  }

  player.position.copy(SPAWN_POS);
  player.visible = true;
  hud.setMoney(0);
  hud.setSwordLevel(0);
  hud.setLevel(1, 0, xpNeed(1));
  hud.setHp(1);
  refreshStockVisual();
  for (let i = 0; i < 4; i++) spawnBear();
}

/* ================================================================ 루프 */

let last = performance.now();
let hintTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.running) {
    S.time += dt;
    Audio.frameReset();
    updateDayNight(dt);
    updatePlayer(dt);
    updateSparks(dt);
    updateBears(dt);
    updateTrees(dt);
    updatePickups(dt);
    updateStations(dt);
    updateBuyers(dt);
    updateBills(dt);
    updatePads(dt);
    updateTowers(dt);
    updateWorkers(dt);
    world.tickAmbient(dt, S.time);

    hintTimer -= dt;
    if (hintTimer <= 0) {
      hintTimer = 0.5;
      updateHint();
    }
    S.autosaveTimer -= dt;
    if (S.autosaveTimer <= 0) {
      S.autosaveTimer = CFG.autosaveEvery;
      saveGame();
    }
    updateActionUi();
    updateMinimap(dt);
    hud.setCarry(S.carry.wood, S.carry.meat, carryCap());
    hud.setStock(S.stock.wood, S.stock.meat);
    hud.tick(dt);
  }

  world.updateSnow(dt, player.position, S.time);
  world.updateCamera(player.position, S.running ? dt : dt * 0.6);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ================================================================ 시작 */

plantTrees();
hud.setMoney(0);
hud.setHp(1);
hud.setSwordLevel(0);
hud.setCarry(0, 0, carryCap());
hud.setStock(0, 0);
hud.setLevel(1, 0, xpNeed(1));
for (const p of pads) refreshPad(p);

createMenu({
  onNew() {
    clearSave();
    resetGame();
    S.running = true;
    hud.toast('북쪽 숲에서 나무를 베어 보세요');
  },
  onContinue() {
    resetGame();
    const data = loadSave();
    if (data) applySave(data);
    S.running = true;
  },
  onPause() { S.running = false; },
  onResume() { S.running = true; },
  onSave() { return saveGame(); },
  onQuit() { S.running = false; },
});

// 디버그 훅: 콘솔에서 상태를 들여다보거나 자동 테스트에 쓴다.
window.__game = {
  S, bears, trees, pickups, bills, buyers, workers, towers, pads, player, scene, CFG,
  spawnBear, spawnPickup, saveGame, snapshot, Audio, startSwing, castSkill, gainXp, SKILL_IDS,
  camera, renderer,
};

document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
