// 광고 영상의 아트(따뜻한 흙바닥, 흰 울타리, 통통한 캐릭터)를 로우폴리로 옮긴 모델 모음.
import * as THREE from 'three';
import { C } from './config.js';

const cache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return cache.get(key);
}
function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.castShadow = true;
  return m;
}

/* ============================================================== 캐릭터 */

// 머리가 큰 통통한 비율. back 앵커에 짐이 쌓인다.
export function makeVillager({ coat = C.coatRed, scale = 1, hat = false } = {}) {
  const g = new THREE.Group();

  const boots = mesh(new THREE.BoxGeometry(0.52, 0.3, 0.42), C.boots);
  boots.position.y = 0.15;
  g.add(boots);

  const body = mesh(new THREE.CapsuleGeometry(0.36, 0.44, 4, 10), coat);
  body.position.y = 0.72;
  g.add(body);

  const collar = mesh(new THREE.CylinderGeometry(0.44, 0.42, 0.16, 12), C.fur);
  collar.position.y = 1.06;
  g.add(collar);

  const head = mesh(new THREE.SphereGeometry(0.42, 12, 10), C.skin);
  head.position.y = 1.46;
  g.add(head);

  const hood = mesh(new THREE.SphereGeometry(0.47, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), C.fur);
  hood.position.y = 1.5;
  g.add(hood);

  if (hat) {
    const cap = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.24, 10), coat);
    cap.position.y = 1.86;
    g.add(cap);
  }

  const arms = {};
  const armGeo = new THREE.CapsuleGeometry(0.14, 0.34, 3, 8);
  for (const side of ['L', 'R']) {
    const pivot = new THREE.Group();
    pivot.position.set(side === 'L' ? -0.42 : 0.42, 0.96, 0);
    const arm = mesh(armGeo, coat);
    arm.position.y = -0.26;
    pivot.add(arm);
    g.add(pivot);
    arms[side] = pivot;
  }

  // 짐이 쌓이는 등 위치
  const back = new THREE.Group();
  back.position.set(0, 1.0, -0.42);
  g.add(back);

  g.scale.setScalar(scale);
  g.userData.parts = { body, head, boots, armL: arms.L, armR: arms.R, back };
  return g;
}

export function makePlayer() {
  const g = makeVillager({ coat: C.coatPlayer, scale: 1.05 });
  const hammer = makeHammer();
  hammer.position.set(0, -0.5, 0.1);
  hammer.rotation.x = -0.4;
  g.userData.parts.armR.add(hammer);
  g.userData.hammer = hammer;
  return g;
}

export function makeHammer() {
  const g = new THREE.Group();
  const handle = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8), C.wood);
  g.add(handle);
  const head = mesh(new THREE.BoxGeometry(0.46, 0.3, 0.3), C.metal);
  head.position.y = 0.52;
  g.add(head);
  const band = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.34), C.metalLight);
  band.position.y = 0.52;
  g.add(band);
  return g;
}

/* ================================================================== 곰 */

export function makeBear() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.78, 1.25, 5, 10), C.bear);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.95;
  g.add(body);

  const head = mesh(new THREE.SphereGeometry(0.58, 12, 10), C.bear);
  head.position.set(0, 1.12, 1.12);
  g.add(head);

  const snout = mesh(new THREE.SphereGeometry(0.3, 10, 8), C.bearShade);
  snout.scale.set(1, 0.8, 1.1);
  snout.position.set(0, 0.96, 1.55);
  g.add(snout);

  const nose = mesh(new THREE.SphereGeometry(0.11, 8, 6), C.bearNose);
  nose.position.set(0, 1.02, 1.8);
  g.add(nose);

  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.17, 8, 6), C.bearShade);
    ear.position.set(0.34 * s, 1.5, 0.95);
    g.add(ear);
  }

  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.24, 0.27, 0.5, 8);
  for (const x of [-0.48, 0.48]) {
    for (const z of [-0.5, 0.62]) {
      const leg = mesh(legGeo, C.bearShade);
      leg.position.set(x, 0.25, z);
      legs.push(leg);
      g.add(leg);
    }
  }
  g.userData.parts = { body, head, legs };
  return g;
}

/* ============================================================== 아이템 */

export function makeMeat() {
  const g = new THREE.Group();
  const flesh = mesh(new THREE.SphereGeometry(0.32, 10, 8), C.meat);
  flesh.scale.set(1, 0.5, 0.82);
  g.add(flesh);
  const fat = mesh(new THREE.SphereGeometry(0.33, 10, 8), C.meatFat);
  fat.scale.set(0.99, 0.18, 0.8);
  fat.position.y = 0.09;
  g.add(fat);
  const bone = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 6), C.meatFat);
  bone.rotation.z = Math.PI / 2;
  bone.position.x = 0.34;
  g.add(bone);
  return g;
}

// 조리된 고기(접시에 담긴 스테이크)
export function makePlate() {
  const g = new THREE.Group();
  const plate = mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.09, 12), C.plate);
  g.add(plate);
  const steak = mesh(new THREE.SphereGeometry(0.22, 10, 8), C.cooked);
  steak.scale.set(1, 0.45, 0.85);
  steak.position.y = 0.1;
  g.add(steak);
  return g;
}

export function makeBill() {
  const g = new THREE.Group();
  const note = mesh(new THREE.BoxGeometry(0.62, 0.1, 0.36), C.cash);
  g.add(note);
  const band = mesh(new THREE.BoxGeometry(0.2, 0.11, 0.38), C.cashDark);
  g.add(band);
  return g;
}

/* ============================================================== 건물 */

// 바베큐 그릴(조리대)
export function makeGrill() {
  const g = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(0.16, 0.9, 0.16);
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.45, 0.45]) {
      const leg = mesh(legGeo, C.metal);
      leg.position.set(x, 0.45, z);
      g.add(leg);
    }
  }
  const basin = mesh(new THREE.BoxGeometry(2.3, 0.44, 1.3), C.metal);
  basin.position.y = 1.1;
  g.add(basin);

  const coals = mesh(new THREE.BoxGeometry(2.0, 0.12, 1.05), 0x93362a, { emissive: 0xff5a1e });
  coals.position.y = 1.3;
  g.add(coals);

  const bars = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const bar = mesh(new THREE.BoxGeometry(2.1, 0.06, 0.07), C.metalLight);
    bar.position.set(0, 1.38, -0.5 + i * 0.17);
    bars.add(bar);
  }
  g.add(bars);

  // 굽는 중인 고기
  const cooking = new THREE.Group();
  cooking.position.y = 1.44;
  g.add(cooking);

  const fire = mesh(new THREE.ConeGeometry(0.3, 0.6, 6), C.fire, { emissive: 0xff7a18 });
  fire.position.set(0, 1.55, 0);
  fire.visible = false;
  g.add(fire);

  const glow = new THREE.PointLight(0xff8a2b, 6, 9, 2);
  glow.position.set(0, 1.6, 0);
  g.add(glow);

  g.userData = { cooking, fire, glow };
  return g;
}

// 배식대(긴 나무 테이블 + 금전등록기)
export function makeTable(slots = 6) {
  const g = new THREE.Group();
  const w = slots * 0.85 + 1.2;

  const top = mesh(new THREE.BoxGeometry(w, 0.18, 1.5), C.plankTop);
  top.position.y = 1.0;
  g.add(top);
  const skirt = mesh(new THREE.BoxGeometry(w - 0.2, 0.55, 1.2), C.plank);
  skirt.position.y = 0.72;
  g.add(skirt);
  const legGeo = new THREE.BoxGeometry(0.22, 0.95, 0.22);
  for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) {
    for (const z of [-0.55, 0.55]) {
      const leg = mesh(legGeo, C.plankDark);
      leg.position.set(x, 0.48, z);
      g.add(leg);
    }
  }

  // 금전등록기
  const reg = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(0.7, 0.44, 0.5), 0xf2f6fa);
  box.position.y = 1.32;
  reg.add(box);
  const screen = mesh(new THREE.BoxGeometry(0.5, 0.26, 0.06), 0x3f6f9e);
  screen.position.set(0, 1.45, 0.26);
  reg.add(screen);
  reg.position.x = w / 2 - 0.9;
  g.add(reg);

  const slotsGroup = new THREE.Group();   // 접시가 놓이는 자리
  slotsGroup.position.y = 1.12;
  g.add(slotsGroup);

  g.userData = { slots: slotsGroup, width: w };
  return g;
}

/* ============================================================ 울타리 */

// 끝이 뾰족한 하얀 말뚝 울타리. gaps = [{axis:'x'|'z', at, half}] 만큼 비운다.
export function makeFence(x0, x1, z0, z1, gaps = []) {
  const g = new THREE.Group();
  const step = 0.56;
  const H = 1.25;
  const spots = [];
  const skip = (axis, v, side) => gaps.some(
    (gp) => gp.axis === axis && gp.side === side && Math.abs(v - gp.at) < gp.half,
  );

  for (let x = x0; x <= x1 + 0.01; x += step) {
    if (!skip('x', x, 'z0')) spots.push([x, z0, 0]);
    if (!skip('x', x, 'z1')) spots.push([x, z1, 0]);
  }
  for (let z = z0 + step; z <= z1 - step + 0.01; z += step) {
    if (!skip('z', z, 'x0')) spots.push([x0, z, Math.PI / 2]);
    if (!skip('z', z, 'x1')) spots.push([x1, z, Math.PI / 2]);
  }

  const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, H, 0.16), mat(C.fence), spots.length);
  const tip = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 0.3, 4), mat(C.fenceTip), spots.length);
  post.castShadow = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach(([x, z, ry], i) => {
    q.setFromAxisAngle(up, ry);
    v.set(x, H / 2, z);
    post.setMatrixAt(i, m4.compose(v, q, one));
    v.set(x, H + 0.1, z);
    tip.setMatrixAt(i, m4.compose(v, q, one));
  });
  g.add(post, tip);

  // 가로 지지대
  for (const [len, pos, rot] of [
    [x1 - x0, [(x0 + x1) / 2, 0.85, z0], 0],
    [x1 - x0, [(x0 + x1) / 2, 0.85, z1], 0],
    [z1 - z0, [x0, 0.85, (z0 + z1) / 2], Math.PI / 2],
    [z1 - z0, [x1, 0.85, (z0 + z1) / 2], Math.PI / 2],
  ]) {
    const rail = mesh(new THREE.BoxGeometry(len, 0.12, 0.08), C.plankDark);
    rail.position.set(pos[0], pos[1], pos[2]);
    rail.rotation.y = rot;
    g.add(rail);
  }
  return g;
}

// 문(X 보강대가 있는 나무판)
export function makeGate(width = 3) {
  const g = new THREE.Group();
  const panel = mesh(new THREE.BoxGeometry(width, 1.5, 0.16), C.gate);
  panel.position.y = 0.8;
  g.add(panel);
  for (const dir of [-1, 1]) {
    const brace = mesh(new THREE.BoxGeometry(Math.hypot(width, 1.3), 0.16, 0.2), C.gateDark);
    brace.position.y = 0.8;
    brace.rotation.z = dir * Math.atan2(1.3, width);
    g.add(brace);
  }
  const top = mesh(new THREE.BoxGeometry(width + 0.2, 0.18, 0.24), C.gateDark);
  top.position.y = 1.55;
  g.add(top);
  return g;
}

/* ======================================================= 원형 해금 구역 */

// 바닥 원 + 남은 금액이 줄어드는 라벨(광고의 ( 50 💵 ) 표기)
export function makeZone(radius = 1.6) {
  const g = new THREE.Group();

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshBasicMaterial({ color: C.zone, transparent: true, opacity: 0.45 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.05;
  g.add(disc);

  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshBasicMaterial({ color: 0x7ce08a, transparent: true, opacity: 0.55 }),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.07;
  fill.scale.setScalar(0.001);
  g.add(fill);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.96, radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);

  g.userData = { fill, radius };
  return g;
}

/* ================================================================ 라벨 */

function drawBill(ctx, x, y, w, h) {
  ctx.fillStyle = '#5fd07a';
  ctx.strokeStyle = '#2f8b4d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, h * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = '#dff7e6';
  ctx.fill();
}

function drawGlyph(ctx, type, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#f7efdc';
  ctx.strokeStyle = '#f7efdc';
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  if (type === 'worker') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.24, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.45);
    ctx.quadraticCurveTo(0, -s * 0.12, s * 0.4, s * 0.45);
    ctx.fill();
  } else if (type === 'boot') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.45);
    ctx.lineTo(-s * 0.1, s * 0.2);
    ctx.lineTo(s * 0.45, s * 0.2);
    ctx.lineTo(s * 0.45, s * 0.45);
    ctx.lineTo(-s * 0.45, s * 0.45);
    ctx.lineTo(-s * 0.45, -s * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'bag') {
    ctx.beginPath();
    ctx.roundRect(-s * 0.38, -s * 0.18, s * 0.76, s * 0.6, s * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.18, s * 0.22, Math.PI, 0);
    ctx.stroke();
  } else if (type === 'cash') {
    drawBill(ctx, -s * 0.45, -s * 0.28, s * 0.9, s * 0.56);
  }
  ctx.restore();
}

// 바닥에 눕는 라벨 — ( 아이콘  남은금액 ) 형태로 가운데 정렬해 그린다.
export function makeZoneLabel(icon, text, width = 3.0) {
  const W = 400;
  const H = 150;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * H / W),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.1;

  function render(label) {
    ctx.clearRect(0, 0, W, H);
    const cy = H / 2;
    const iconS = 52;
    ctx.font = 'bold 58px "Trebuchet MS", system-ui, sans-serif';
    const textW = ctx.measureText(label).width;
    const total = iconS + 18 + textW;
    const x0 = (W - total) / 2;

    // 양쪽 괄호 ( )
    ctx.strokeStyle = '#fdf6e8';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    const R = 44;
    ctx.beginPath();                       // 왼쪽 '('
    ctx.arc(x0 - 16 + R, cy, R, Math.PI - 0.8, Math.PI + 0.8);
    ctx.stroke();
    ctx.beginPath();                       // 오른쪽 ')'
    ctx.arc(x0 + total + 16 - R, cy, R, -0.8, 0.8);
    ctx.stroke();

    drawGlyph(ctx, icon, x0 + iconS / 2, cy, iconS * 0.9);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(40,28,16,0.8)';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(label, x0 + iconS + 18, cy + 3);
    ctx.fillText(label, x0 + iconS + 18, cy + 3);
    tex.needsUpdate = true;
  }

  render(text);
  return { plane, render };
}

// 머리 위 말풍선(손님이 원하는 것)
export function makeBubble() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 112, 92, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(52, 96);
  ctx.lineTo(64, 122);
  ctx.lineTo(78, 96);
  ctx.closePath();
  ctx.fill();
  // 접시에 담긴 고기
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.ellipse(64, 60, 40, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0432f';
  ctx.beginPath();
  ctx.ellipse(64, 52, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.needsUpdate = true;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.1, 1.1, 1);
  return sprite;
}

export function makeHpBar(width = 1.5) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1);
  const bg = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a2018 }));
  bg.scale.set(width, 0.2, 1);
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5fd07a }));
  fill.scale.set(width - 0.06, 0.14, 1);
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

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.8, 6), C.wood);
  trunk.position.y = 0.4;
  g.add(trunk);
  for (const [y, r, h] of [[1.2, 0.85, 1.3], [2.0, 0.62, 1.05]]) {
    const cone = mesh(new THREE.ConeGeometry(r, h, 8), C.pine);
    cone.position.y = y;
    g.add(cone);
    const snow = mesh(new THREE.ConeGeometry(r * 0.78, h * 0.4, 8), C.pineSnow);
    snow.position.y = y + h * 0.32;
    g.add(snow);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeRock(scale = 1) {
  const g = mesh(new THREE.DodecahedronGeometry(0.6, 0), 0xa9b7c4);
  g.scale.setScalar(scale);
  g.position.y = 0.25;
  return g;
}
