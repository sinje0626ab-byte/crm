// 등 뒤 스태킹 시스템 — 캐릭터 등에 아이템이 수직으로 쌓이고, 움직이면 흔들린다.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeMeat, makePlate, makeBill } from './art.js';

const MAKER = { meat: makeMeat, plate: makePlate, cash: makeBill };

export function createStack(anchor) {
  const items = [];          // { mesh, phase }
  let type = null;
  const pivot = new THREE.Group();
  anchor.add(pivot);

  return {
    get type() { return type; },
    get count() { return items.length; },
    // 같은 종류만 쌓을 수 있다(들고 있는 걸 내려놔야 다른 걸 든다)
    canAdd(kind, cap) {
      return items.length < cap && (type === null || type === kind);
    },
    add(kind) {
      if (type !== null && type !== kind) return false;
      type = kind;
      const m = (MAKER[kind] || makeMeat)();
      m.position.y = items.length * CFG.stack.itemH;
      m.rotation.y = (Math.random() - 0.5) * 0.5;
      m.scale.setScalar(0.9);
      pivot.add(m);
      items.push({ mesh: m, phase: Math.random() * Math.PI * 2 });
      return true;
    },
    take() {
      const it = items.pop();
      if (!it) return null;
      pivot.remove(it.mesh);
      if (!items.length) type = null;
      return it.mesh;
    },
    clear() {
      while (items.length) pivot.remove(items.pop().mesh);
      type = null;
    },
    // 이동 속도에 따라 위로 갈수록 크게 휘청인다
    update(dt, speed, time) {
      const sway = Math.min(1, speed / 5);
      pivot.rotation.z = THREE.MathUtils.lerp(pivot.rotation.z, 0, 1 - Math.pow(0.02, dt));
      items.forEach((it, i) => {
        const k = (i + 1) / Math.max(1, items.length);
        const amp = CFG.stack.lean * k * sway;
        it.mesh.position.x = Math.sin(time * CFG.stack.wobble + it.phase) * amp * 0.25;
        it.mesh.rotation.z = Math.sin(time * CFG.stack.wobble + it.phase) * amp * 0.5;
        it.mesh.position.y = i * CFG.stack.itemH;
      });
    },
  };
}
