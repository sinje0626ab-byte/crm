// 바닥 원형 구역 — 지폐를 들고 올라서면 한 장씩 빠져나가며 금액이 줄고, 0이 되면 해금된다.
import { CFG } from './config.js';
import { makeZone, makeZoneLabel } from './art.js';

export function createZones(scene, onUnlock) {
  const list = CFG.zones.map((def) => {
    const group = makeZone(1.7);
    group.position.set(def.x, 0, def.z);
    scene.add(group);

    const label = makeZoneLabel(def.icon, `${def.price}`, 3.0);
    label.plane.position.set(def.x, 0.1, def.z + 2.1);
    scene.add(label.plane);

    return {
      ...def, group, label,
      level: 0, remain: def.price, price: def.price, done: false, tickTimer: 0,
    };
  });

  function refresh(z) {
    if (z.done) {
      z.group.visible = false;
      z.label.plane.visible = false;
      return;
    }
    z.label.render(`${Math.ceil(z.remain)}`);
    const ratio = 1 - z.remain / z.price;
    z.group.userData.fill.scale.setScalar(Math.max(0.001, ratio));
  }
  list.forEach(refresh);

  // 플레이어가 올라서 있으면 지폐를 한 장씩 집어넣는다
  function update(dt, player, stack, billValue, onSpend) {
    for (const z of list) {
      if (z.done) continue;
      const d = Math.hypot(player.position.x - z.x, player.position.z - z.z);
      const on = d < z.group.userData.radius + 0.3;
      if (!on || stack.type !== 'cash' || stack.count <= 0) continue;

      z.tickTimer -= dt;
      if (z.tickTimer > 0) continue;
      z.tickTimer = 0.07;

      const mesh = stack.take();
      if (!mesh) continue;
      z.remain -= billValue;
      onSpend();

      if (z.remain <= 0) {
        z.level++;
        z.done = z.level >= z.repeat;
        z.price = Math.round(z.price * z.mul);
        z.remain = z.price;
        onUnlock(z);
      }
      refresh(z);
    }
  }

  function snapshot() {
    return list.map((z) => ({ id: z.id, level: z.level, remain: Math.round(z.remain), price: z.price, done: z.done }));
  }

  function restore(saved, apply) {
    if (!saved) return;
    for (const s of saved) {
      const z = list.find((x) => x.id === s.id);
      if (!z) continue;
      z.level = s.level || 0;
      z.price = s.price || z.price;
      z.remain = s.remain ?? z.price;
      z.done = !!s.done;
      for (let i = 0; i < z.level; i++) apply(z, true);
      refresh(z);
    }
  }

  function reset() {
    for (const z of list) {
      z.level = 0;
      z.price = CFG.zones.find((d) => d.id === z.id).price;
      z.remain = z.price;
      z.done = false;
      z.group.visible = true;
      z.label.plane.visible = true;
      refresh(z);
    }
  }

  return { list, update, refresh, snapshot, restore, reset };
}
