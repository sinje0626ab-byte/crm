// 바닥에 떨어진 아이템(고기·지폐). 통통 튀어 내려앉고, 가까이 가면 주워진다.
import { CFG } from './config.js';
import { makeMeat, makeBill } from './art.js';

const MAKER = { meat: makeMeat, cash: makeBill };

export function createDrops(scene) {
  const list = [];

  function spawn(kind, x, z, spread = 1) {
    const mesh = (MAKER[kind] || makeMeat)();
    mesh.position.set(x, 0.9, z);
    scene.add(mesh);
    const a = Math.random() * Math.PI * 2;
    list.push({
      kind, mesh,
      vx: Math.cos(a) * (1.2 + Math.random() * 1.8) * spread,
      vz: Math.sin(a) * (1.2 + Math.random() * 1.8) * spread,
      vy: 4 + Math.random() * 2,
      settled: false, claimed: null, life: 90,
    });
  }

  function remove(d) {
    scene.remove(d.mesh);
    const i = list.indexOf(d);
    if (i >= 0) list.splice(i, 1);
  }

  function nearestFree(kind, from, maxD = Infinity) {
    let best = null;
    let bestD = maxD;
    for (const d of list) {
      if (d.kind !== kind || (d.claimed && d.claimed !== from)) continue;
      const dist = Math.hypot(d.mesh.position.x - from.position.x, d.mesh.position.z - from.position.z);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  // 반경 안의 아이템을 훑어 collect(kind) 가 true 를 돌려주면 가져간다
  function collect(pos, radius, collectFn) {
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      const dist = Math.hypot(d.mesh.position.x - pos.x, d.mesh.position.z - pos.z);
      if (dist > radius) continue;
      if (!collectFn(d.kind)) continue;
      remove(d);
    }
  }

  function update(dt, time) {
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      const o = d.mesh;
      if (!d.settled) {
        d.vy -= 16 * dt;
        o.position.x += d.vx * dt;
        o.position.z += d.vz * dt;
        o.position.y += d.vy * dt;
        o.rotation.x += dt * 5;
        if (o.position.y <= 0.3) {
          o.position.y = 0.3;
          d.vy = -d.vy * 0.32;
          d.vx *= 0.4;
          d.vz *= 0.4;
          if (Math.abs(d.vy) < 1) {
            d.settled = true;
            o.rotation.set(0, Math.random() * Math.PI, 0);
          }
        }
      } else {
        o.position.y = 0.32 + Math.sin(time * 3 + i) * 0.05;
        o.rotation.y += dt * 0.9;
      }
      d.life -= dt;
      if (d.life <= 0) remove(d);
    }
  }

  return { list, spawn, remove, nearestFree, collect, update };
}
