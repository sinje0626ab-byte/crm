// 화이트아웃 헌터 — 벌목/사냥으로 모은 자원을 정착지에서 손님에게 파는 아이들 게임.
import * as THREE from 'three';
import { CFG, COLORS } from './config.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createMenu } from './menu.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { Audio } from './audio.js';
import {
  makePlayer, makeWorker, makeBear, makeHpBar, makeMeat, makeLog, makeCashBill,
  makeArrow, makeFurnace, makeStall, makeArcherTower, makePad, makeLabel,
  makeChoppableTree, makeStump, makeBuyer, makeSwingTrail,
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
  carry: [],                 // [{type:'wood'|'meat'}]
  hp: CFG.player.maxHp,
  hurtTimer: 0,
  dead: 0,
  stock: { wood: 0, meat: 0 },
  cookQueue: 0,
  cookTimer: 0,
  depositTimer: 0,
  swingCd: 0,
  swingT: 0,
  swingHit: false,
  swingTarget: null,
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
const swordDamage = () => CFG.sword.damage + CFG.sword.perLevelDamage * S.swordLevel;
const swingCooldown = () => Math.max(0.24, CFG.sword.cd - CFG.sword.perLevelCd * S.swordLevel);

/* ============================================================== 플레이어 */

const player = makePlayer();
player.position.copy(SPAWN_POS);
scene.add(player);

const trail = makeSwingTrail();
player.add(trail);

const footRing = new THREE.Mesh(
  new THREE.RingGeometry(0.62, 0.86, 22),
  new THREE.MeshBasicMaterial({ color: 0xe0b34a, transparent: true, opacity: 0.55, depthWrite: false }),
);
footRing.rotation.x = -Math.PI / 2;
footRing.position.y = 0.38;
scene.add(footRing);

const carryMeshes = [];

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

// 판매대 위 재고 더미
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
    m.scale.setScalar(0.8);
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

    if (S.dead <= 0 && S.carry.length < cap) {
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z);
      if (d < CFG.player.pickRadius) {
        S.carry.push({ type: p.type });
        if (p.type === 'wood') Audio.S.pickWood(); else Audio.S.pickMeat();
        if (S.carry.length >= cap) Audio.S.full();
        scene.remove(o);
        pickups.splice(i, 1);
      }
    }
  }
  syncCarry();
}

// 머리 위 짐 더미(나무는 눕힌 통나무, 고기는 고깃덩이)
function syncCarry() {
  const g = player.userData.carry;
  while (carryMeshes.length > S.carry.length) g.remove(carryMeshes.pop());
  while (carryMeshes.length < S.carry.length) {
    const item = S.carry[carryMeshes.length];
    const m = item.type === 'wood' ? makeLog(1.15) : makeMeat();
    m.position.y = carryMeshes.length * 0.3;
    m.rotation.y = (carryMeshes.length % 2) * 0.5 + (item.type === 'wood' ? 0 : Math.random());
    m.scale.setScalar(item.type === 'wood' ? 0.85 : 0.9);
    g.add(m);
    carryMeshes.push(m);
  }
}

function countCarry(type) {
  return S.carry.reduce((n, it) => n + (it.type === type ? 1 : 0), 0);
}

function takeFromCarry(type) {
  const i = S.carry.findIndex((it) => it.type === type);
  if (i < 0) return false;
  S.carry.splice(i, 1);
  // 더미를 위에서부터 다시 쌓는다
  while (carryMeshes.length) player.userData.carry.remove(carryMeshes.pop());
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
  if (!target) return;

  Audio.S.swing();
  S.swingTarget = target;
  S.swingT = 0.3;
  S.swingHit = false;
  S.swingCd = swingCooldown();

  const tx = bear ? target.mesh.position.x : target.x;
  const tz = bear ? target.mesh.position.z : target.z;
  player.rotation.y = Math.atan2(tx - px, tz - pz);
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
    hitAny = true;
  }
  if (hitAny) return;

  const t = S.swingTarget;
  if (t && t.alive && Math.hypot(t.x - px, t.z - pz) < CFG.sword.range + 0.3) chopTree(t);
}

function updateSwing(dt) {
  const arm = player.userData.parts.shoulderR;
  if (S.swingT > 0) {
    S.swingT -= dt;
    const p = 1 - Math.max(0, S.swingT) / 0.3;       // 0 → 1
    arm.rotation.x = THREE.MathUtils.lerp(-2.3, 1.0, Math.min(1, p * 1.25));
    player.userData.parts.body.rotation.y = Math.sin(p * Math.PI) * 0.4;
    trail.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.5;
    trail.rotation.z = THREE.MathUtils.lerp(0.9, -0.9, p);
    if (!S.swingHit && p > 0.45) {
      S.swingHit = true;
      applySwingHit();
    }
  } else {
    arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, 0, 1 - Math.pow(0.001, dt));
    player.userData.parts.body.rotation.y *= 0.8;
    trail.material.opacity = 0;
  }
}

/* ================================================================== 곰 */

function spawnBear(atX, atZ) {
  const g = makeBear();
  const x = atX ?? FIELD.x0 + Math.random() * (FIELD.x1 - FIELD.x0);
  const z = atZ ?? FIELD.z0 + Math.random() * (FIELD.z1 - FIELD.z0);
  g.position.set(x, 0.35, z);
  const bar = makeHpBar(1.8, 0.22);
  bar.group.position.y = 2.5;
  g.add(bar.group);
  scene.add(g);
  bears.push({
    mesh: g, bar, hp: CFG.bear.hp, maxHp: CFG.bear.hp,
    atkCd: 0, wander: new THREE.Vector2(x, z), wanderCd: 0, vx: 0, vz: 0, flash: 0,
  });
}

function hurtBear(b, dmg) {
  b.hp -= dmg;
  b.flash = 0.12;
  b.bar.setRatio(b.hp / b.maxHp);
  Audio.S.bearHit();
  if (b.hp <= 0) {
    Audio.S.bearDie();
    for (let i = 0; i < CFG.bear.meatDrop; i++) spawnPickup('meat', b.mesh.position.x, b.mesh.position.z);
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
    b.atkCd -= dt;
    b.flash = Math.max(0, b.flash - dt);
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, b.flash > 0 ? 1.34 : 1.22, 0.35));

    m.position.x += b.vx * dt;
    m.position.z += b.vz * dt;
    b.vx *= 1 - Math.min(1, 6 * dt);
    b.vz *= 1 - Math.min(1, 6 * dt);

    const dx = player.position.x - m.position.x;
    const dz = player.position.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    const chasing = S.dead <= 0 && dist < CFG.bear.aggro;

    if (chasing && dist > CFG.bear.atkRange + 0.5) {
      moveToward(m, player.position.x, player.position.z, CFG.bear.speed, dt);
    } else if (chasing) {
      m.rotation.y = Math.atan2(dx, dz);
      if (b.atkCd <= 0) {
        b.atkCd = CFG.bear.atkCd;
        damagePlayer(CFG.bear.atkDmg);
        m.scale.setScalar(1.45);
      }
    } else {
      b.wanderCd -= dt;
      if (b.wanderCd <= 0) {
        b.wanderCd = 2 + Math.random() * 3;
        b.wander.set(
          FIELD.x0 + Math.random() * (FIELD.x1 - FIELD.x0),
          FIELD.z0 + Math.random() * (FIELD.z1 - FIELD.z0),
        );
      }
      moveToward(m, b.wander.x, b.wander.y, CFG.bear.speed * 0.45, dt);
    }

    // 같은 자리에 겹치지 않도록 서로 밀어낸다
    for (const o of bears) {
      if (o === b) continue;
      const ox = o.mesh.position.x - m.position.x;
      const oz = o.mesh.position.z - m.position.z;
      const od = Math.hypot(ox, oz);
      if (od > 0.001 && od < 2.5) {
        const push = (2.5 - od) * 0.5;
        m.position.x -= (ox / od) * push;
        m.position.z -= (oz / od) * push;
        o.mesh.position.x += (ox / od) * push;
        o.mesh.position.z += (oz / od) * push;
      }
    }

    m.position.x = THREE.MathUtils.clamp(m.position.x, FIELD.x0 - 3, FIELD.x1 + 3);
    m.position.z = THREE.MathUtils.clamp(m.position.z, FIELD.z0 - 3, FIELD.z1 + 3);

    const gait = Math.sin(S.time * 9 + m.position.x);
    b.mesh.userData.parts.legs.forEach((leg, i) => { leg.rotation.x = gait * 0.5 * (i % 2 ? -1 : 1); });
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
      S.hp = CFG.player.maxHp;
      player.visible = true;
    }
    return;
  }

  const d = input.read();
  const len = Math.hypot(d.x, d.z);
  const moving = len > 0.08;
  if (moving) {
    const nx = player.position.x + d.x * CFG.player.speed * dt;
    const nz = player.position.z + d.z * CFG.player.speed * dt;
    const [cx, cz] = wallClamp(player.position.x, player.position.z, nx, nz);
    player.position.x = THREE.MathUtils.clamp(cx, -105, 105);
    player.position.z = THREE.MathUtils.clamp(cz, -105, 105);
    if (S.swingT <= 0) player.rotation.y = Math.atan2(d.x, d.z);
  }
  walkAnim(player, moving, S.time);
  footRing.position.set(player.position.x, 0.38, player.position.z);
  footRing.visible = player.visible;

  S.swingCd -= dt;
  if (S.swingCd <= 0 && S.swingT <= 0) startSwing();
  updateSwing(dt);

  S.hurtTimer -= dt;
  if (S.hurtTimer <= 0 && S.hp < CFG.player.maxHp) {
    S.hp = Math.min(CFG.player.maxHp, S.hp + CFG.player.regen * dt);
  }
  hud.setHp(S.hp / CFG.player.maxHp);
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
    const lose = Math.floor(S.carry.length / 2);
    S.carry.splice(0, lose);
    while (carryMeshes.length) player.userData.carry.remove(carryMeshes.pop());
    syncCarry();
    Audio.S.down();
    hud.toast('기절! 정착지로 돌아갑니다');
  }
}

/* ========================================================= 화로 / 판매대 */

function updateStations(dt) {
  S.depositTimer -= dt;

  // 화로: 생고기를 넣으면 조리되어 판매 재고가 된다
  const dF = Math.hypot(player.position.x - FURNACE_POS.x, player.position.z - FURNACE_POS.z);
  if (dF < 4.2 && countCarry('meat') > 0 && S.cookQueue < CFG.grill.queueMax && S.depositTimer <= 0) {
    S.depositTimer = CFG.stall.depositRate;
    if (takeFromCarry('meat')) { S.cookQueue++; Audio.S.deposit(); }
  }

  // 판매대: 통나무를 내려놓으면 바로 재고가 된다
  const dS = Math.hypot(player.position.x - STALL_POS.x, player.position.z - STALL_POS.z);
  if (dS < 4.2 && countCarry('wood') > 0 && S.stock.wood < CFG.stall.stockMax && S.depositTimer <= 0) {
    S.depositTimer = CFG.stall.depositRate;
    if (takeFromCarry('wood')) { S.stock.wood++; Audio.S.deposit(); }
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
  furnace.userData.glow.intensity = (hot ? 3.2 : 2.2) + Math.sin(S.time * 10) * 0.25;

  refreshStockVisual();
}

/* ================================================================ 손님 */

const QUEUE_X = STALL_POS.x;
const QUEUE_Z0 = STALL_POS.z + 3.2;

function spawnBuyer() {
  const mesh = makeBuyer(buyers.length + Math.floor(S.time));
  mesh.position.set(GATE_X + 5, 0.35, C.z + (Math.random() - 0.5) * 3);
  Object.assign(mesh.userData, { stack: [], group: new THREE.Group() });
  mesh.userData.group.position.y = 1.7;
  mesh.add(mesh.userData.group);
  scene.add(mesh);

  const type = Math.random() < 0.55 ? 'wood' : 'meat';
  const want = CFG.buyer.wantMin + Math.floor(Math.random() * (CFG.buyer.wantMax - CFG.buyer.wantMin + 1));
  const label = makeLabel(type, `× ${want}`, 2.2);
  label.sprite.position.y = 3.0;
  mesh.add(label.sprite);

  Audio.S.buyerCome();
  buyers.push({ mesh, label, type, want, state: 'enter', serve: CFG.buyer.serveTime, got: 0, wait: 0 });
}

function updateBuyers(dt) {
  S.buyerTimer -= dt;
  const stockTotal = S.stock.wood + S.stock.meat;
  if (S.buyerTimer <= 0 && buyers.length < CFG.buyer.maxQueue && stockTotal > 0) {
    S.buyerTimer = CFG.buyer.interval;
    spawnBuyer();
  }

  buyers.forEach((b, idx) => {
    const m = b.mesh;
    let moving = true;

    if (b.state === 'enter' || b.state === 'queue') {
      const slotZ = QUEUE_Z0 + idx * 1.6;
      const d = routeThroughGate(m, QUEUE_X, slotZ, CFG.buyer.speed, dt);
      if (d < 0.4) {
        moving = false;
        m.rotation.y = Math.PI; // 카운터를 바라본다
        b.state = idx === 0 ? 'serve' : 'queue';
      }
    } else if (b.state === 'serve') {
      moving = false;
      m.rotation.y = Math.PI;
      if (S.stock[b.type] > 0) {
        b.serve -= dt;
        if (b.serve <= 0) {
          b.serve = CFG.buyer.serveTime / 2;
          S.stock[b.type]--;
          b.got++;
          const price = b.type === 'wood' ? CFG.goods.woodPrice : CFG.goods.meatPrice;
          spawnBill(price);
          const item = b.type === 'wood' ? makeLog(0.9) : makeMeat();
          item.scale.setScalar(0.8);
          item.position.y = b.mesh.userData.stack.length * 0.28;
          b.mesh.userData.group.add(item);
          b.mesh.userData.stack.push(item);
          b.label.render(`× ${b.want - b.got}`);
          if (b.got >= b.want) {
            b.state = 'leave';
            b.label.sprite.visible = false;
            S.served++;
            Audio.S.sell();
            hud.toast(`판매 완료! +$${price * b.got}`);
          }
        }
      } else {
        b.wait += dt;
      }
    } else {
      const d = routeThroughGate(m, GATE_X + 8, C.z, CFG.buyer.speed, dt);
      if (m.position.x > GATE_X + 6 || d < 0.5) {
        scene.remove(m);
        buyers.splice(buyers.indexOf(b), 1);
        return;
      }
    }

    walkAnim(m, moving, S.time + idx, 0.7);
    if (b.label.sprite.visible) b.label.sprite.quaternion.copy(camera.quaternion);
  });
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

/* ================================================================ 안내 */

function updateHint() {
  const cap = carryCap();
  let msg;
  if (S.carry.length >= cap) msg = '가방이 가득 찼습니다! 정착지로 돌아가세요';
  else if (buyers.some((b) => b.state === 'serve' && S.stock[b.type] === 0)) {
    msg = '손님이 물건을 기다립니다!';
  } else if (bills.length >= 6) msg = '판매대 옆 돈다발을 주우세요';
  else if (countCarry('wood') > 0) msg = '판매대에 나무를 내려놓으세요';
  else if (countCarry('meat') > 0) msg = '화로에 고기를 넣으세요';
  else if (S.stock.wood + S.stock.meat === 0) msg = '북쪽 숲에서 나무를 베거나 남쪽에서 곰을 사냥하세요';
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
  };
}

function saveGame() {
  return writeSave(snapshot());
}

function applySave(data) {
  S.money = data.money || 0;
  S.stock.wood = data.stock?.wood || 0;
  S.stock.meat = data.stock?.meat || 0;
  S.served = data.served || 0;

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
  S.hp = CFG.player.maxHp;
  S.dead = 0;
  S.carry.length = 0;
  while (carryMeshes.length) player.userData.carry.remove(carryMeshes.pop());

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
    updatePlayer(dt);
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
    hud.setCarry(S.carry.length, carryCap());
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
hud.setCarry(0, carryCap());
hud.setStock(0, 0);
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
  spawnBear, spawnPickup, saveGame, snapshot, Audio,
};

document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
