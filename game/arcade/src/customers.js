// 손님 대기열 AI — 배식대 앞에 줄을 서고, 접시를 받으면 지폐를 떨구고 떠난다.
import * as THREE from 'three';
import { CFG, C } from './config.js';
import { makeVillager, makeBubble } from './art.js';
import { moveTo, walkAnim } from './nav.js';

const COATS = [C.coatRed, C.coatOrange, C.coatSand, C.coatBrown, 0xb8556f, 0x6f7fb8];

export function createCustomers(scene, table, drops, onPaid) {
  const list = [];
  let timer = 2;

  const queueX = () => table.x;
  const slotZ = (i) => table.z + 2.0 + i * 1.5;

  function spawn() {
    const mesh = makeVillager({ coat: COATS[(Math.random() * COATS.length) | 0], scale: 0.98 });
    mesh.position.set(queueX() + (Math.random() - 0.5) * 1.2, 0, CFG.customer.spawnZ);
    scene.add(mesh);

    const bubble = makeBubble();
    bubble.position.y = 2.5;
    mesh.add(bubble);

    list.push({ mesh, bubble, state: 'queue', eat: CFG.customer.eatTime, bye: 0 });
  }

  function update(dt, time, camera, price) {
    timer -= dt;
    const waiting = list.filter((c) => c.state !== 'leave').length;
    if (timer <= 0 && waiting < CFG.customer.maxQueue) {
      timer = CFG.customer.interval;
      spawn();
    }

    let slot = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const cst = list[i];
      const m = cst.mesh;
      let moving = false;

      if (cst.state === 'leave') {
        cst.bye += dt;
        moving = true;
        m.position.z += CFG.customer.speed * 0.9 * dt;
        m.position.x += Math.sin(cst.bye * 2) * 0.4 * dt;
        m.rotation.y = 0;
        if (cst.bye > 1.2) m.scale.setScalar(Math.max(0, 0.98 * (1 - (cst.bye - 1.2) / 0.8)));
        if (cst.bye > 2.0) {
          scene.remove(m);
          list.splice(i, 1);
          continue;
        }
      } else {
        const idx = slot++;
        const d = moveTo(m, queueX(), slotZ(idx), CFG.customer.speed, dt);
        moving = d > 0.12;
        if (!moving) m.rotation.y = Math.PI;      // 카운터를 바라본다

        if (idx === 0 && !moving && table.count > 0) {
          cst.eat -= dt;
          if (cst.eat <= 0) {
            table.take();
            // 지폐를 바닥에 떨군다
            const bills = Math.max(1, Math.round(price / CFG.table.price));
            for (let k = 0; k < bills; k++) {
              drops.spawn('cash', table.x + 2.2 + (Math.random() - 0.5), table.z + 0.6 + (Math.random() - 0.5), 0.7);
            }
            cst.state = 'leave';
            cst.bubble.visible = false;
            onPaid();
          }
        }
      }

      walkAnim(m, moving, time + i, 0.8);
      if (cst.bubble.visible) cst.bubble.quaternion.copy(camera.quaternion);
    }
  }

  function clear() {
    for (const c2 of list) scene.remove(c2.mesh);
    list.length = 0;
    timer = 2;
  }

  return { list, update, clear };
}
