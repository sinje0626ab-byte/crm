// 플레이어 — 조이스틱/방향키 이동, 범위 안 자동 공격, 접촉 시 자동 수거·납품.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makePlayer } from './art.js';
import { createStack } from './stack.js';
import { clampMove, walkAnim } from './nav.js';

export function createPlayer(scene, ctx) {
  const mesh = makePlayer();
  mesh.position.set(0, 0, 4);
  scene.add(mesh);

  // 발밑 표시 링(광고의 흰 원)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.86, 26),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.24;
  scene.add(ring);

  const stack = createStack(mesh.userData.parts.back);

  const S = {
    mesh, stack, ring,
    speedLv: 0, bagLv: 0, dmgLv: 0,
    attackCd: 0, swing: 0, unloadTimer: 0, moving: false,
  };

  S.speed = () => CFG.player.speed + CFG.player.speedPerLevel * S.speedLv;
  S.capacity = () => CFG.player.capacity + CFG.player.capPerLevel * S.bagLv;
  S.damage = () => CFG.attack.damage + CFG.attack.damagePerLevel * S.dmgLv;

  function tryAttack(dt) {
    S.attackCd -= dt;
    const bear = ctx.bears.nearest(mesh.position.x, mesh.position.z, CFG.attack.range);
    if (!bear) return;
    // 대상 쪽을 보고 자동으로 내려친다(공격 버튼 없음)
    mesh.rotation.y = Math.atan2(bear.mesh.position.x - mesh.position.x, bear.mesh.position.z - mesh.position.z);
    if (S.attackCd > 0) return;
    S.attackCd = CFG.attack.cd;
    S.swing = 0.26;
    ctx.audio.swing();
    ctx.bears.hurt(bear, S.damage());
    ctx.audio.hit();
    ctx.world.shake(0.12);
  }

  function autoCollect() {
    const cap = S.capacity();
    ctx.drops.collect(mesh.position, CFG.player.pickRadius, (kind) => {
      if (!stack.canAdd(kind, cap)) return false;
      stack.add(kind);
      if (kind === 'cash') ctx.audio.coin(); else ctx.audio.stackUp();
      if (stack.count >= cap) ctx.audio.full();
      return true;
    });
  }

  function autoDeliver(dt) {
    S.unloadTimer -= dt;
    if (S.unloadTimer > 0) return;
    const near = (x, z, r) => Math.hypot(mesh.position.x - x, mesh.position.z - z) < r;
    const cap = S.capacity();

    // 생고기 → 그릴
    if (stack.type === 'meat' && near(ctx.grill.x, ctx.grill.z, 2.8)) {
      if (ctx.grill.accept(1)) {
        stack.take();
        S.unloadTimer = 0.1;
        ctx.audio.unload();
      }
      return;
    }
    // 구운 접시 → 등에 싣기
    if (ctx.grill.output.length > 0 && stack.canAdd('plate', cap)
        && near(ctx.grill.pileAt.x, ctx.grill.pileAt.z, 2.0)) {
      ctx.grill.takePlate();
      stack.add('plate');
      S.unloadTimer = 0.1;
      ctx.audio.stackUp();
      return;
    }
    // 접시 → 배식대
    if (stack.type === 'plate' && near(ctx.table.x, ctx.table.z, 3.0) && !ctx.table.full()) {
      if (ctx.table.add()) {
        stack.take();
        S.unloadTimer = 0.12;
        ctx.audio.unload();
      }
    }
  }

  S.update = (dt, time, dir) => {
    const len = Math.hypot(dir.x, dir.z);
    S.moving = len > 0.08;
    if (S.moving) {
      const sp = S.speed();
      const nx = mesh.position.x + dir.x * sp * dt;
      const nz = mesh.position.z + dir.z * sp * dt;
      const [cx, cz] = clampMove(mesh.position.x, mesh.position.z, nx, nz);
      mesh.position.x = THREE.MathUtils.clamp(cx, -60, 60);
      mesh.position.z = THREE.MathUtils.clamp(cz, -60, 60);
      if (S.swing <= 0) mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    tryAttack(dt);
    autoCollect();
    autoDeliver(dt);

    // 망치 휘두르기
    const arm = mesh.userData.parts.armR;
    if (S.swing > 0) {
      S.swing -= dt;
      const p = 1 - Math.max(0, S.swing) / 0.26;
      arm.rotation.x = THREE.MathUtils.lerp(-2.0, 0.9, Math.min(1, p * 1.3));
    } else {
      walkAnim(mesh, S.moving, time);
    }

    stack.update(dt, S.moving ? S.speed() : 0, time);
    ring.position.set(mesh.position.x, 0.24, mesh.position.z);
  };

  return S;
}
