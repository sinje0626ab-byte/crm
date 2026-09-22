// 사냥터의 북극곰: 돌아다니다 맞으면 죽고 고기를 떨군다.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeBear, makeHpBar } from './art.js';
import { moveTo } from './nav.js';

export function createBears(scene, camera, onDrop) {
  const list = [];
  let spawnTimer = 0;

  function spawn(atX, atZ) {
    const h = CFG.hunt;
    const x = atX ?? h.x0 + Math.random() * (h.x1 - h.x0);
    const z = atZ ?? h.z0 + Math.random() * (h.z1 - h.z0);
    const mesh = makeBear();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    const bar = makeHpBar(1.6);
    bar.group.position.y = 2.2;
    mesh.add(bar.group);
    scene.add(mesh);
    list.push({
      mesh, bar, hp: CFG.bear.hp, maxHp: CFG.bear.hp,
      wander: new THREE.Vector2(x, z), wanderCd: Math.random() * 3, flash: 0,
    });
  }

  function hurt(b, dmg) {
    b.hp -= dmg;
    b.flash = 0.12;
    b.bar.setRatio(b.hp / b.maxHp);
    if (b.hp <= 0) {
      for (let i = 0; i < CFG.bear.meat; i++) onDrop(b.mesh.position.x, b.mesh.position.z);
      scene.remove(b.mesh);
      list.splice(list.indexOf(b), 1);
      return true;
    }
    return false;
  }

  function nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const b of list) {
      const d = Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function update(dt, time) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && list.length < CFG.bear.maxAlive) {
      spawn();
      spawnTimer = CFG.bear.spawnCd;
    }

    const h = CFG.hunt;
    for (const b of list) {
      b.flash = Math.max(0, b.flash - dt);
      b.mesh.scale.setScalar(THREE.MathUtils.lerp(b.mesh.scale.x, b.flash > 0 ? 1.12 : 1, 0.3));

      b.wanderCd -= dt;
      if (b.wanderCd <= 0) {
        b.wanderCd = CFG.bear.wanderCd + Math.random() * 3;
        b.wander.set(h.x0 + Math.random() * (h.x1 - h.x0), h.z0 + Math.random() * (h.z1 - h.z0));
      }
      const moving = moveTo(b.mesh, b.wander.x, b.wander.y, 1.5, dt) > 0.4;
      const gait = Math.sin(time * 6 + b.mesh.position.x);
      b.mesh.userData.parts.legs.forEach((leg, i) => { leg.rotation.x = (moving ? gait : 0) * 0.35 * (i % 2 ? -1 : 1); });
      b.bar.group.quaternion.copy(camera.quaternion);
    }
  }

  return { list, spawn, hurt, nearest, update };
}
