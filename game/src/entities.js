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
  m.receiveShadow = false;
  return m;
}

/* ---------------------------------------------------------------- 캐릭터 */

function humanoid(coatColor, scale = 1) {
  const g = new THREE.Group();

  const legs = mesh(new THREE.BoxGeometry(0.46, 0.42, 0.38), COLORS.woodDark);
  legs.position.y = 0.22;
  g.add(legs);

  const body = mesh(new THREE.CapsuleGeometry(0.36, 0.52, 3, 8), coatColor);
  body.position.y = 0.92;
  g.add(body);

  const collar = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 8), COLORS.fur);
  collar.position.y = 1.33;
  g.add(collar);

  const head = mesh(new THREE.SphereGeometry(0.29, 8, 6), COLORS.skin);
  head.position.y = 1.58;
  g.add(head);

  const hat = mesh(new THREE.SphereGeometry(0.33, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), COLORS.fur);
  hat.position.y = 1.62;
  g.add(hat);

  // 팔: 걷기 애니메이션에서 흔들 수 있도록 참조를 남겨둔다.
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.42, 3, 6);
  const armL = mesh(armGeo, coatColor);
  armL.position.set(-0.44, 0.98, 0);
  const armR = mesh(armGeo, coatColor);
  armR.position.set(0.44, 0.98, 0);
  g.add(armL, armR);

  g.scale.setScalar(scale);
  g.userData.parts = { legs, body, armL, armR, head };
  return g;
}

export function makePlayer() {
  const g = humanoid(COLORS.coat, 1.22);
  const carry = new THREE.Group(); // 머리 위 고기 더미
  carry.position.y = 1.95;
  g.add(carry);
  g.userData.carry = carry;
  return g;
}

export function makeWorker() {
  return humanoid(0xe0703a, 0.92);
}

export function makeArcherFigure() {
  return humanoid(0x6b57c8, 0.88);
}

/* -------------------------------------------------------------------- 곰 */

export function makeBear() {
  const g = new THREE.Group();

  const body = mesh(new THREE.CapsuleGeometry(0.72, 1.5, 4, 8), COLORS.bear);
  body.rotation.x = Math.PI / 2;   // 몸통 축을 진행 방향(+Z)에 맞춘다
  body.position.y = 1.18;
  g.add(body);

  const head = mesh(new THREE.SphereGeometry(0.56, 8, 6), COLORS.bear);
  head.position.set(0, 1.34, 1.28);
  g.add(head);

  const snout = mesh(new THREE.BoxGeometry(0.36, 0.28, 0.4), COLORS.bearShade);
  snout.position.set(0, 1.16, 1.72);
  g.add(snout);

  const nose = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.12), 0x3a3a3a);
  nose.position.set(0, 1.22, 1.94);
  g.add(nose);

  const earGeo = new THREE.SphereGeometry(0.16, 6, 5);
  for (const s2 of [-1, 1]) {
    const ear = mesh(earGeo, COLORS.bearShade);
    ear.position.set(0.33 * s2, 1.76, 1.08);
    g.add(ear);
  }

  const legGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.78, 6);
  const legs = [];
  for (const x of [-0.52, 0.52]) {
    for (const z of [-0.62, 0.66]) {
      const leg = mesh(legGeo, COLORS.bearShade);
      leg.position.set(x, 0.39, z);
      legs.push(leg);
      g.add(leg);
    }
  }

  const hump = mesh(new THREE.SphereGeometry(0.5, 7, 5), COLORS.bear);
  hump.scale.set(1, 0.6, 1.2);
  hump.position.set(0, 1.62, 0.35);
  g.add(hump);

  const tail = mesh(new THREE.SphereGeometry(0.19, 6, 5), COLORS.bear);
  tail.position.set(0, 1.25, -1.45);
  g.add(tail);

  g.scale.setScalar(1.22);
  g.userData.parts = { body, head, legs };
  return g;
}

/* --------------------------------------------------------------- HP 바 */

const hpBarGeo = new THREE.PlaneGeometry(1, 1);
export function makeHpBar(width = 1.6, height = 0.2) {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(hpBarGeo, new THREE.MeshBasicMaterial({ color: 0x1b2430 }));
  bg.scale.set(width, height, 1);
  const fill = new THREE.Mesh(hpBarGeo, new THREE.MeshBasicMaterial({ color: 0x54d16a }));
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
      fill.material.color.setHex(v > 0.5 ? 0x54d16a : v > 0.25 ? 0xffd23f : 0xff5a4e);
    },
  };
}

/* ------------------------------------------------------------ 아이템/무기 */

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

export function makeAxe() {
  const g = new THREE.Group();
  const handle = mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 6), COLORS.wood);
  handle.rotation.z = Math.PI / 2;
  g.add(handle);
  const blade = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 6, 1, false, 0, Math.PI), COLORS.steel);
  blade.rotation.x = Math.PI / 2;
  blade.rotation.z = -Math.PI / 2;
  blade.position.x = 0.55;
  g.add(blade);
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

/* --------------------------------------------------------------- 건물/지형 */

export function makeGrill() {
  const g = new THREE.Group();
  const stones = mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.5, 7), 0x9aa4ae);
  stones.position.y = 0.25;
  g.add(stones);

  const fire = mesh(new THREE.ConeGeometry(0.5, 0.8, 6), COLORS.fire, { emissive: 0xff7a18, emissiveIntensity: 0.6 });
  fire.position.y = 0.72;
  g.add(fire);

  const pot = mesh(new THREE.CylinderGeometry(0.8, 0.5, 1.05, 8), 0xc9d2da);
  pot.position.y = 1.15;
  g.add(pot);

  const rim = mesh(new THREE.TorusGeometry(0.8, 0.08, 4, 10), COLORS.wood);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.66;
  g.add(rim);

  g.userData.fire = fire;
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

export function makeFence(w, d, height = 1.1, gapHalf = 0) {
  const g = new THREE.Group();
  const picket = new THREE.BoxGeometry(0.26, height, 0.14);
  const step = 0.62;
  const add = (x, z, rotY) => {
    const p = mesh(picket, COLORS.fence);
    p.position.set(x, height / 2, z);
    p.rotation.y = rotY;
    g.add(p);
  };
  for (let x = -w / 2; x <= w / 2; x += step) {
    add(x, -d / 2, 0);
    add(x, d / 2, 0);
  }
  for (let z = -d / 2; z <= d / 2; z += step) {
    add(-w / 2, z, Math.PI / 2);
    if (Math.abs(z) > gapHalf) add(w / 2, z, Math.PI / 2); // 오른쪽은 문만큼 비운다
  }
  return g;
}

export function makeArcherTower() {
  const g = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(2.1, 0.5, 2.1), COLORS.wood);
  deck.position.y = 1.5;
  g.add(deck);
  const legGeo = new THREE.BoxGeometry(0.22, 1.6, 0.22);
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.8, 0.8]) {
      const leg = mesh(legGeo, COLORS.woodDark);
      leg.position.set(x, 0.8, z);
      g.add(leg);
    }
  }
  const archer = makeArcherFigure();
  archer.position.y = 1.75;
  g.add(archer);
  g.userData.archer = archer;
  return g;
}

/* ------------------------------------------------------- 구매 패드 & 라벨 */

export function makePad(w, d, color = 0x46403b) {
  const g = new THREE.Group();

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.05, d + 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  border.position.y = 0.02;
  g.add(border);
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.08, d),
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.92 })
  );
  slab.position.y = 0.04;
  slab.receiveShadow = true;
  g.add(slab);

  // 진행도 표시: 패드 위에 차오르는 밝은 판
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.2, 0.06, d - 0.2),
    new THREE.MeshBasicMaterial({ color: 0x7ce08a, transparent: true, opacity: 0.55 })
  );
  fill.position.y = 0.1;
  fill.scale.z = 0.001;
  g.add(fill);

  g.userData.fill = fill;
  g.userData.depth = d - 0.2;
  return g;
}

// 캔버스로 그린 아이콘 + 가격 라벨(이모지 폰트에 의존하지 않도록 직접 그린다).
function drawIcon(ctx, type, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#2b3440';
  ctx.fillStyle = '#2b3440';
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
  } else if (type === 'axe') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.45);
    ctx.lineTo(s * 0.25, -s * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 0.5);
    ctx.quadraticCurveTo(s * 0.62, -s * 0.5, s * 0.5, s * 0.08);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.05, s * 0.05, -s * 0.5);
    ctx.fill();
  } else if (type === 'worker') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.22, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.45);
    ctx.quadraticCurveTo(0, -s * 0.12, s * 0.38, s * 0.45);
    ctx.fill();
  } else if (type === 'cash') {
    ctx.beginPath();
    ctx.roundRect(-s * 0.48, -s * 0.3, s * 0.96, s * 0.6, s * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
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

export function makeLabel(iconType, text, width = 2.6) {
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

  function render(label, dim = false) {
    ctx.clearRect(0, 0, 320, 160);
    ctx.globalAlpha = dim ? 0.45 : 1;
    // 둥근 말풍선 배경
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cfdae6';
    ctx.lineWidth = 6;
    const r = 44;
    ctx.beginPath();
    ctx.moveTo(24 + r, 22);
    ctx.arcTo(296, 22, 296, 138, r);
    ctx.arcTo(296, 138, 24, 138, r);
    ctx.arcTo(24, 138, 24, 22, r);
    ctx.arcTo(24, 22, 296, 22, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawIcon(ctx, iconType, 92, 80, 54);

    ctx.fillStyle = '#2b3440';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let size = 54;
    const avail = 274 - 142;
    do {
      ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
      size -= 3;
    } while (ctx.measureText(label).width > avail && size > 26);
    ctx.fillText(label, 142, 84);
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  }

  render(text);
  return { sprite, render };
}
