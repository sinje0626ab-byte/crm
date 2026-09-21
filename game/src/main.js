// 설원 아이들 타이쿤: 곰 사냥 → 고기 운반 → 조리 → 돈 → 캠프 확장 루프.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import {
  makePlayer, makeWorker, makeBear, makeHpBar, makeMeat, makeAxe,
  makeCashBill, makeArrow, makeGrill, makeArcherTower, makePad, makeLabel,
} from './entities.js';

const canvas = document.getElementById('scene');
const { renderer, scene, camera, updateCamera } = createWorld(canvas);
const input = createInput(
  document.getElementById('surface'),
  document.getElementById('joy'),
  document.getElementById('joy-knob'),
);
const hud = createHud();

const B = CFG.world.base;
const F = CFG.world.field;
const GATE_X = B.x + B.w / 2;
const GATE_HALF = 4.6;

/* =============================================================== 상태 */

const S = {
  money: 0,
  axeLevel: 0,
  carry: 0,
  hp: CFG.player.maxHp,
  hurtTimer: 0,
  dead: 0,
  cookQueue: 0,
  cookTimer: 0,
  depositTimer: 0,
  spawnTimer: 1,
  time: 0,
};

const bears = [];
const meats = [];
const bills = [];
const arrows = [];
const workers = [];
const towers = [];
const axes = [];

const tmp = new THREE.Vector3();

/* ============================================================ 플레이어 */

const player = makePlayer();
player.position.set(-8, 0.35, 4);
scene.add(player);

const carryMeshes = [];
const axeGroup = new THREE.Group();
scene.add(axeGroup);

// 도끼가 도는 궤적을 링으로 표시(광고의 소용돌이 느낌)
const spinRing = new THREE.Mesh(
  new THREE.TorusGeometry(CFG.axe.radius, 0.07, 4, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
);
spinRing.rotation.x = Math.PI / 2;
spinRing.position.y = 1.4;
axeGroup.add(spinRing);

function rebuildAxes() {
  for (const a of axes) axeGroup.remove(a);
  spinRing.geometry.dispose();
  spinRing.geometry = new THREE.TorusGeometry(CFG.axe.radius, 0.07, 4, 32);
  axes.length = 0;
  const n = CFG.axe.count + CFG.axe.perLevelCount * S.axeLevel;
  for (let i = 0; i < n; i++) {
    const a = makeAxe();
    axeGroup.add(a);
    axes.push(a);
  }
  hud.setAxeLevel(S.axeLevel);
}
function axeDamage() {
  return CFG.axe.damage + CFG.axe.perLevelDamage * S.axeLevel;
}
rebuildAxes();

/* =============================================================== 건물 */

const grill = makeGrill();
grill.position.set(-11, 0.35, 1);
scene.add(grill);

const cashPad = makePad(3.6, 3.6, 0x2f6b3f);
cashPad.position.set(-17, 0.35, 7);
scene.add(cashPad);

const cashLabel = makeLabel('cash', '$', 3.1);
cashLabel.sprite.position.set(-17, 2.6, 7);
scene.add(cashLabel.sprite);
cashLabel.sprite.visible = false;

for (const z of [-9, 9]) {
  const t = makeArcherTower();
  t.position.set(4, 0, z);
  t.visible = false;
  t.userData.cd = 0;
  scene.add(t);
  towers.push(t);
}

/* ========================================================== 구매 패드 */

const padDefs = [
  { id: 'worker', icon: 'worker', name: '일꾼', price: 100, x: -24, z: 2, max: 3, mul: 1.8, buy: hireWorker },
  { id: 'archerA', icon: 'bow', name: '궁수', price: 175, x: -3, z: -7, max: 1, mul: 1, buy: () => unlockTower(0) },
  { id: 'archerB', icon: 'bow', name: '궁수', price: 175, x: -3, z: 7, max: 1, mul: 1, buy: () => unlockTower(1) },
  { id: 'axe', icon: 'axe', name: '도끼 강화', price: 400, x: -11, z: 10, max: 5, mul: 1.6, buy: upgradeAxe },
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

function padPrice(p) {
  return Math.round(p.price * Math.pow(p.mul, p.level));
}
function refreshPad(p) {
  if (p.done) {
    p.group.visible = false;
    p.label.sprite.visible = false;
    return;
  }
  p.label.render(`$ ${padPrice(p)}`);
  p.group.userData.fill.scale.z = 0.001;
}

function hireWorker() {
  const w = makeWorker();
  w.position.set(B.x + 4, 0.35, B.z - 3 + workers.length * 1.4);
  Object.assign(w.userData, { state: 'seek', carry: 0, target: null, stack: [], group: new THREE.Group() });
  w.userData.group.position.y = 1.8;
  w.add(w.userData.group);
  scene.add(w);
  workers.push(w);
  hud.toast(`일꾼 고용! (${workers.length}명)`);
}
function unlockTower(i) {
  towers[i].visible = true;
  hud.toast('궁수 배치 완료!');
}
function upgradeAxe() {
  S.axeLevel++;
  rebuildAxes();
  hud.toast(`도끼 강화! Lv.${S.axeLevel + 1}`);
}

/* =============================================================== 곰 */

function spawnBear() {
  const g = makeBear();
  const x = F.x0 + Math.random() * (F.x1 - F.x0);
  const z = F.z0 + Math.random() * (F.z1 - F.z0);
  g.position.set(x, 0.35, z);
  const bar = makeHpBar(1.8, 0.22);
  bar.group.position.y = 2.5;
  g.add(bar.group);
  scene.add(g);
  bears.push({
    mesh: g, bar, hp: CFG.bear.hp, maxHp: CFG.bear.hp,
    hitCd: 0, atkCd: 0, wander: new THREE.Vector2(x, z), wanderCd: 0,
    vx: 0, vz: 0, flash: 0,
  });
}

function hurtBear(b, dmg) {
  b.hp -= dmg;
  b.flash = 0.12;
  b.bar.setRatio(b.hp / b.maxHp);
  if (b.hp <= 0) killBear(b);
}

function killBear(b) {
  const n = CFG.bear.meatDrop;
  for (let i = 0; i < n; i++) {
    const m = makeMeat();
    m.position.copy(b.mesh.position);
    m.position.y = 1.2;
    scene.add(m);
    const a = Math.random() * Math.PI * 2;
    meats.push({
      mesh: m, vx: Math.cos(a) * (2 + Math.random() * 3), vz: Math.sin(a) * (2 + Math.random() * 3),
      vy: 5 + Math.random() * 3, settled: false, life: CFG.meat.life, claimed: null,
    });
  }
  scene.remove(b.mesh);
  bears.splice(bears.indexOf(b), 1);
}

/* ========================================================= 고기 / 현금 */

function stackCarry(group, arr, count, scale = 1) {
  while (arr.length < count) {
    const m = makeMeat();
    m.scale.setScalar(scale);
    m.position.y = arr.length * 0.24 * scale;
    m.rotation.y = Math.random() * Math.PI;
    group.add(m);
    arr.push(m);
  }
  while (arr.length > count) {
    group.remove(arr.pop());
  }
}

function spawnBill() {
  if (bills.length >= CFG.cash.maxBills) return;
  const m = makeCashBill();
  const i = bills.length;
  const col = i % 4;
  const row = Math.floor(i / 4) % 3;
  const layer = Math.floor(i / 12);
  m.position.set(
    cashPad.position.x + (col - 1.5) * 0.72,
    0.45 + layer * 0.1,
    cashPad.position.z + (row - 1) * 0.5,
  );
  m.rotation.y = (Math.random() - 0.5) * 0.3;
  scene.add(m);
  bills.push({ mesh: m, value: CFG.meat.value, pop: 0.35 });
}

/* ============================================================ 시스템 */

function inBase(x, z) {
  return x > B.x - B.w / 2 && x < B.x + B.w / 2 && z > B.z - B.d / 2 && z < B.z + B.d / 2;
}

// 울타리 통과 방지(오른쪽 문만 열려 있음). 축별로 나눠 검사해 벽을 따라 미끄러지게 한다.
function wallClamp(px, pz, nx, nz) {
  let rx = nx;
  let rz = nz;
  const gate = (x, z) => x > GATE_X - 1.5 && Math.abs(z - B.z) < GATE_HALF;
  if (inBase(px, pz) !== inBase(nx, pz) && !gate(nx, pz)) rx = px;
  if (inBase(rx, pz) !== inBase(rx, nz) && !gate(rx, nz)) rz = pz;
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

function walkAnim(obj, moving, t, amp = 1) {
  const p = obj.userData.parts;
  if (!p) return;
  const s = moving ? Math.sin(t * 12) : 0;
  p.armL.rotation.x = s * 0.9 * amp;
  p.armR.rotation.x = -s * 0.9 * amp;
  p.body.position.y = 0.92 + (moving ? Math.abs(s) * 0.06 : 0);
}

/* --------------------------------------------------------- 플레이어 */

function updatePlayer(dt) {
  if (S.dead > 0) {
    S.dead -= dt;
    if (S.dead <= 0) {
      player.position.set(B.x + 6, 0.35, B.z);
      S.hp = CFG.player.maxHp;
      player.visible = true;
      axeGroup.visible = true;
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
    player.position.x = THREE.MathUtils.clamp(cx, -95, 95);
    player.position.z = THREE.MathUtils.clamp(cz, -95, 95);
    player.rotation.y = Math.atan2(d.x, d.z);
  }
  walkAnim(player, moving, S.time);

  // 도끼 회전 + 링 범위 피해
  axeGroup.position.copy(player.position);
  axeGroup.rotation.y += CFG.axe.spin * dt;
  const r = CFG.axe.radius;
  axes.forEach((a, i) => {
    const ang = (i / axes.length) * Math.PI * 2;
    a.position.set(Math.cos(ang) * r, 1.4 + Math.sin(S.time * 4 + i) * 0.12, Math.sin(ang) * r);
    a.rotation.y = -ang + Math.PI / 2;
    a.rotation.z = Math.sin(S.time * 8 + i) * 0.5;
  });

  for (const b of [...bears]) {
    b.hitCd -= dt;
    const dist = Math.hypot(b.mesh.position.x - player.position.x, b.mesh.position.z - player.position.z);
    if (dist < r + 1.3 && b.hitCd <= 0) {
      hurtBear(b, axeDamage());
      b.hitCd = CFG.axe.hitCd;
      const a = Math.atan2(b.mesh.position.z - player.position.z, b.mesh.position.x - player.position.x);
      b.vx += Math.cos(a) * CFG.bear.knockback;
      b.vz += Math.sin(a) * CFG.bear.knockback;
    }
  }

  // 체력 회복
  S.hurtTimer -= dt;
  if (S.hurtTimer <= 0 && S.hp < CFG.player.maxHp) {
    S.hp = Math.min(CFG.player.maxHp, S.hp + CFG.player.regen * dt);
  }
  hud.setHp(S.hp / CFG.player.maxHp);
}

function damagePlayer(dmg) {
  S.hp -= dmg;
  S.hurtTimer = CFG.player.regenDelay;
  if (S.hp <= 0) {
    S.hp = 0;
    S.dead = 1.6;
    player.visible = false;
    axeGroup.visible = false;
    const lost = Math.floor(S.carry / 2);
    S.carry -= lost;
    hud.toast('기절! 캠프로 복귀합니다');
  }
}

/* ------------------------------------------------------------- 곰 AI */

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
    const pulse = b.flash > 0 ? 1.12 : 1;
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, pulse, 0.4));

    // 넉백 감쇠
    m.position.x += b.vx * dt;
    m.position.z += b.vz * dt;
    b.vx *= 1 - Math.min(1, 6 * dt);
    b.vz *= 1 - Math.min(1, 6 * dt);

    const dx = player.position.x - m.position.x;
    const dz = player.position.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    const chasing = S.dead <= 0 && dist < CFG.bear.aggro;

    if (chasing && dist > CFG.bear.atkRange) {
      moveToward(m, player.position.x, player.position.z, CFG.bear.speed, dt);
    } else if (chasing) {
      m.rotation.y = Math.atan2(dx, dz);
      if (b.atkCd <= 0) {
        b.atkCd = CFG.bear.atkCd;
        damagePlayer(CFG.bear.atkDmg);
        m.scale.setScalar(1.2);
      }
    } else {
      b.wanderCd -= dt;
      if (b.wanderCd <= 0) {
        b.wanderCd = 2 + Math.random() * 3;
        b.wander.set(
          F.x0 + Math.random() * (F.x1 - F.x0),
          F.z0 + Math.random() * (F.z1 - F.z0),
        );
      }
      moveToward(m, b.wander.x, b.wander.y, CFG.bear.speed * 0.45, dt);
    }

    // 곰은 사냥터 밖(캠프 안)으로 넘어오지 않는다
    m.position.x = THREE.MathUtils.clamp(m.position.x, F.x0 - 2, F.x1 + 2);
    m.position.z = THREE.MathUtils.clamp(m.position.z, F.z0 - 2, F.z1 + 2);

    // 다리 흔들기
    const gait = Math.sin(S.time * 9 + m.position.x);
    m.userData.parts.legs.forEach((leg, i) => {
      leg.rotation.x = gait * 0.5 * (i % 2 ? -1 : 1);
    });

    b.bar.group.quaternion.copy(camera.quaternion);
  }
}

/* ----------------------------------------------------- 고기 / 조리 / 돈 */

function updateMeats(dt) {
  for (let i = meats.length - 1; i >= 0; i--) {
    const m = meats[i];
    const o = m.mesh;
    if (!m.settled) {
      m.vy -= 20 * dt;
      o.position.x += m.vx * dt;
      o.position.z += m.vz * dt;
      o.position.y += m.vy * dt;
      o.rotation.x += dt * 6;
      if (o.position.y <= 0.35) {
        o.position.y = 0.35;
        m.vy = -m.vy * 0.3;
        m.vx *= 0.4;
        m.vz *= 0.4;
        if (Math.abs(m.vy) < 1.2) {
          m.settled = true;
          o.rotation.x = 0;
        }
      }
    } else {
      o.position.y = 0.4 + Math.sin(S.time * 3 + i) * 0.06;
      o.rotation.y += dt * 1.2;
    }

    m.life -= dt;
    if (m.life <= 0) {
      scene.remove(o);
      meats.splice(i, 1);
      continue;
    }

    if (S.dead <= 0 && S.carry < CFG.player.carryCap) {
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z);
      if (d < CFG.player.pickRadius) {
        S.carry++;
        scene.remove(o);
        meats.splice(i, 1);
      }
    }
  }
  stackCarry(player.userData.carry, carryMeshes, S.carry, 0.8);
}

function updateGrill(dt) {
  // 플레이어가 화로 근처면 고기를 투입
  const d = Math.hypot(player.position.x - grill.position.x, player.position.z - grill.position.z);
  if (d < 2.8 && S.carry > 0 && S.cookQueue < CFG.grill.queueMax) {
    S.depositTimer -= dt;
    if (S.depositTimer <= 0) {
      S.depositTimer = 0.1;
      S.carry--;
      S.cookQueue++;
    }
  }

  if (S.cookQueue > 0) {
    S.cookTimer -= dt;
    if (S.cookTimer <= 0) {
      S.cookTimer = CFG.grill.cookTime;
      S.cookQueue--;
      spawnBill();
    }
  }
  const fire = grill.userData.fire;
  const active = S.cookQueue > 0;
  fire.scale.y = THREE.MathUtils.lerp(fire.scale.y, active ? 1.15 + Math.sin(S.time * 18) * 0.12 : 0.7, 0.2);
}

function updateBills(dt) {
  const pd = Math.hypot(player.position.x - cashPad.position.x, player.position.z - cashPad.position.z);
  cashLabel.sprite.visible = bills.length > 0;
  if (bills.length > 0) cashLabel.render(`$ ${bills.length * CFG.meat.value}`);

  for (let i = bills.length - 1; i >= 0; i--) {
    const b = bills[i];
    if (b.pop > 0) {
      b.pop -= dt;
      b.mesh.rotation.z = b.pop * 1.5;
    }
    if (S.dead <= 0 && pd < 2.6) {
      addMoney(b.value);
      scene.remove(b.mesh);
      bills.splice(i, 1);
    }
  }
}

function addMoney(v) {
  S.money += v;
  hud.setMoney(S.money);
  hud.bumpMoney();
}

/* ---------------------------------------------------------- 구매 패드 */

function updatePads(dt) {
  for (const p of pads) {
    if (p.done) continue;
    const onPad = S.dead <= 0
      && Math.abs(player.position.x - p.x) < 1.9
      && Math.abs(player.position.z - p.z) < 1.9;
    const price = padPrice(p);

    if (onPad && S.money > 0) {
      const want = price * CFG.padFillRate * dt;
      const pay = Math.min(want, S.money, price - p.paid);
      S.money -= pay;
      p.paid += pay;
      hud.setMoney(S.money);
      if (p.paid >= price - 0.01) {
        p.paid = 0;
        p.level++;
        p.buy();
        if (p.level >= p.max) p.done = true;
        refreshPad(p);
        continue;
      }
    }
    p.group.userData.fill.scale.z = Math.max(0.001, p.paid / price);
    p.group.userData.fill.position.z = -(p.group.userData.depth * (1 - p.paid / price)) / 2;
    p.label.sprite.material.opacity = S.money >= price * 0.2 || onPad ? 1 : 0.6;
  }
}

/* -------------------------------------------------------- 궁수 / 일꾼 */

function updateTowers(dt) {
  for (const t of towers) {
    if (!t.visible) continue;
    t.userData.cd -= dt;
    let best = null;
    let bestD = CFG.archer.range;
    for (const b of bears) {
      const d = Math.hypot(b.mesh.position.x - t.position.x, b.mesh.position.z - t.position.z);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best) {
      const a = Math.atan2(best.mesh.position.x - t.position.x, best.mesh.position.z - t.position.z);
      t.userData.archer.rotation.y = a;
      if (t.userData.cd <= 0) {
        t.userData.cd = CFG.archer.cd;
        const arrow = makeArrow();
        arrow.position.set(t.position.x, 2.6, t.position.z);
        scene.add(arrow);
        arrows.push({ mesh: arrow, target: best });
      }
    }
  }

  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    const t = a.target;
    if (!t || t.hp <= 0 || !bears.includes(t)) {
      scene.remove(a.mesh);
      arrows.splice(i, 1);
      continue;
    }
    const dx = t.mesh.position.x - a.mesh.position.x;
    const dy = 1.3 - a.mesh.position.y;
    const dz = t.mesh.position.z - a.mesh.position.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.9) {
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

function nearestFreeMeat(from) {
  let best = null;
  let bestD = Infinity;
  for (const m of meats) {
    if (m.claimed && m.claimed !== from) continue;
    const d = Math.hypot(m.mesh.position.x - from.position.x, m.mesh.position.z - from.position.z);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

function updateWorkers(dt) {
  for (const w of workers) {
    const u = w.userData;
    let moving = true;

    if (u.state === 'seek') {
      if (!u.target || !meats.includes(u.target)) {
        u.target = nearestFreeMeat(w);
        if (u.target) u.target.claimed = w;
      }
      if (u.target) {
        const t = u.target.mesh.position;
        // 캠프 안이면 먼저 문으로 나간다
        if (inBase(w.position.x, w.position.z)) {
          moveToward(w, GATE_X + 1.5, B.z, CFG.worker.speed, dt);
        } else {
          const d = moveToward(w, t.x, t.z, CFG.worker.speed, dt);
          if (d < 1.4) {
            scene.remove(u.target.mesh);
            meats.splice(meats.indexOf(u.target), 1);
            u.target = null;
            u.carry++;
            if (u.carry >= CFG.worker.carryCap) u.state = 'haul';
          }
        }
      } else if (u.carry > 0) {
        u.state = 'haul';
      } else {
        moveToward(w, GATE_X + 4, B.z, CFG.worker.speed * 0.6, dt);
        moving = false;
      }
    } else {
      // 운반: 캠프 밖이면 문을 경유해 화로로
      if (!inBase(w.position.x, w.position.z)) {
        moveToward(w, GATE_X - 1.5, B.z, CFG.worker.speed, dt);
      } else {
        const d = moveToward(w, grill.position.x, grill.position.z + 2.2, CFG.worker.speed, dt);
        if (d < 2.4) {
          S.cookQueue = Math.min(CFG.grill.queueMax, S.cookQueue + u.carry);
          u.carry = 0;
          u.state = 'seek';
        }
      }
    }

    stackCarry(u.group, u.stack, u.carry, 0.7);
    walkAnim(w, moving, S.time + w.position.x, 0.8);
  }
}

/* ------------------------------------------------------------- 안내 */

function updateHint() {
  let msg;
  if (S.carry >= CFG.player.carryCap) msg = '가방이 가득! 화로에 고기를 넣으세요';
  else if (bills.length >= 6) msg = '캠프의 돈다발을 주우세요';
  else if (S.carry > 0) msg = '화로로 고기를 옮기세요';
  else if (bears.length > 0) msg = '오른쪽 사냥터에서 곰을 잡으세요';
  else msg = '곰이 나타나기를 기다리는 중...';
  hud.setHint(msg);
}

/* ============================================================= 루프 */

let last = performance.now();
let hintTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.time += dt;

  updatePlayer(dt);
  updateBears(dt);
  updateMeats(dt);
  updateGrill(dt);
  updateBills(dt);
  updatePads(dt);
  updateTowers(dt);
  updateWorkers(dt);

  hintTimer -= dt;
  if (hintTimer <= 0) {
    hintTimer = 0.5;
    updateHint();
  }
  hud.setCarry(S.carry, CFG.player.carryCap);
  hud.tick(dt);

  updateCamera(player.position, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// 디버그 훅: 콘솔에서 상태를 들여다보거나 자동 테스트에 쓴다.
window.__game = { S, bears, meats, bills, workers, towers, pads, player, scene, CFG, spawnBear };

// 초기화
hud.setMoney(0);
hud.setHp(1);
hud.setCarry(0, CFG.player.carryCap);
for (const p of pads) refreshPad(p);
for (let i = 0; i < 4; i++) spawnBear();
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
