// 고용한 일꾼 AI — 사냥꾼(고기 조달) · 조리사(굽기 가속) · 배식원(접시 운반).
import { CFG, C } from './config.js';
import { makeVillager } from './art.js';
import { createStack } from './stack.js';
import { moveTo, routeTo, walkAnim, inCamp } from './nav.js';

export function createWorkers(scene, ctx) {
  const list = [];

  function hire(role) {
    const coat = role === 'hunter' ? C.coatBrown : role === 'cook' ? C.coatRed : C.coatOrange;
    const mesh = makeVillager({ coat, scale: 0.96, hat: role === 'cook' });
    const spot = role === 'cook'
      ? { x: ctx.grill.x - 1.7, z: ctx.grill.z + 0.2 }
      : { x: CFG.gate.x + list.length * 1.2 - 2, z: CFG.camp.z0 + 3 };
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);

    const w = {
      role, mesh, state: 'idle', target: null, attackCd: 0, deliverTimer: 0,
      stack: createStack(mesh.userData.parts.back),
    };
    list.push(w);
    if (role === 'cook') ctx.grill.cookers = list.filter((x) => x.role === 'cook').length;
    return w;
  }

  function updateHunter(w, dt, time) {
    const cap = CFG.worker.carry;
    let moving = true;

    if (w.state === 'idle' || w.state === 'hunt') {
      w.state = 'hunt';
      // 이미 떨어진 고기가 있으면 그것부터 줍는다
      const meat = ctx.drops.nearestFree('meat', w.mesh, 60);
      if (meat && w.stack.canAdd('meat', cap)) {
        meat.claimed = w.mesh;
        const d = routeTo(w.mesh, meat.mesh.position.x, meat.mesh.position.z, CFG.worker.speed, dt);
        if (d < 1.1) {
          ctx.drops.remove(meat);
          w.stack.add('meat');
          ctx.audio.stackUp();
        }
      } else {
        const bear = ctx.bears.nearest(w.mesh.position.x, w.mesh.position.z, 80);
        if (bear && w.stack.canAdd('meat', cap)) {
          const d = routeTo(w.mesh, bear.mesh.position.x, bear.mesh.position.z, CFG.worker.speed, dt);
          if (d < CFG.attack.range) {
            moving = false;
            w.attackCd -= dt;
            if (w.attackCd <= 0) {
              w.attackCd = CFG.attack.cd * 1.3;
              w.mesh.userData.parts.armR.rotation.x = -1.6;
              ctx.bears.hurt(bear, CFG.attack.damage * 0.8);
              ctx.audio.hit();
            }
          }
        } else {
          w.state = 'deliver';
        }
      }
      if (w.stack.count >= cap) w.state = 'deliver';
    } else {
      // 그릴로 가서 생고기를 내려놓는다
      const d = routeTo(w.mesh, ctx.grill.x, ctx.grill.z + 1.8, CFG.worker.speed, dt);
      if (d < 2.2 && inCamp(w.mesh.position.x, w.mesh.position.z)) {
        moving = false;
        w.deliverTimer -= dt;
        if (w.deliverTimer <= 0 && w.stack.count > 0) {
          w.deliverTimer = 0.12;
          if (ctx.grill.accept(1)) {
            w.stack.take();
            ctx.audio.unload();
          }
        }
        if (w.stack.count === 0) w.state = 'hunt';
      }
    }
    return moving;
  }

  function updateServer(w, dt) {
    const cap = CFG.worker.carry;
    let moving = true;
    if (w.state === 'idle' || w.state === 'pick') {
      w.state = 'pick';
      const d = moveTo(w.mesh, ctx.grill.pileAt.x + 1.2, ctx.grill.pileAt.z, CFG.worker.speed, dt);
      if (d < 1.6) {
        moving = false;
        w.deliverTimer -= dt;
        if (w.deliverTimer <= 0 && ctx.grill.output.length > 0 && w.stack.canAdd('plate', cap)) {
          w.deliverTimer = 0.14;
          ctx.grill.takePlate();
          w.stack.add('plate');
          ctx.audio.stackUp();
        }
      }
      if (w.stack.count >= cap || (w.stack.count > 0 && ctx.grill.output.length === 0)) w.state = 'serve';
    } else {
      const d = moveTo(w.mesh, ctx.table.x - 1.2, ctx.table.z - 1.6, CFG.worker.speed, dt);
      if (d < 1.6) {
        moving = false;
        w.deliverTimer -= dt;
        if (w.deliverTimer <= 0 && w.stack.count > 0) {
          w.deliverTimer = 0.16;
          if (ctx.table.add()) {
            w.stack.take();
            ctx.audio.unload();
          }
        }
        if (w.stack.count === 0) w.state = 'pick';
      }
    }
    return moving;
  }

  function update(dt, time) {
    for (const w of list) {
      let moving = false;
      if (w.role === 'hunter') moving = updateHunter(w, dt, time);
      else if (w.role === 'server') moving = updateServer(w, dt);
      else {
        // 조리사는 그릴 앞에서 고기를 뒤집는다
        w.mesh.rotation.y = Math.PI / 2;
        w.mesh.userData.parts.armR.rotation.x = Math.sin(time * 6) * 0.7 - 0.4;
      }
      if (w.role !== 'cook') walkAnim(w.mesh, moving, time + w.mesh.position.x, 0.8);
      w.stack.update(dt, moving ? CFG.worker.speed : 0, time);
    }
  }

  function clear() {
    for (const w of list) scene.remove(w.mesh);
    list.length = 0;
    ctx.grill.cookers = 0;
  }

  return { list, hire, update, clear, count: (role) => list.filter((w) => w.role === role).length };
}
