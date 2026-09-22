// 울타리 통과 규칙(문과 손님 통로만 열려 있다)과 공용 이동 헬퍼.
import { CFG } from './config.js';

const c = CFG.camp;

export const inCamp = (x, z) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1;

// 위쪽 문(사냥터)과 아래쪽 손님 통로만 지나갈 수 있다
function throughGap(x, z) {
  if (Math.abs(z - c.z0) < 1.4 && Math.abs(x - CFG.gate.x) < CFG.gate.half) return true;
  if (Math.abs(z - c.z1) < 1.4 && Math.abs(x - CFG.queueGap.x) < CFG.queueGap.half) return true;
  return false;
}

// 축을 나눠 검사해 벽을 따라 미끄러지게 한다
export function clampMove(px, pz, nx, nz) {
  let rx = nx;
  let rz = nz;
  if (inCamp(px, pz) !== inCamp(nx, pz) && !throughGap(nx, pz)) rx = px;
  if (inCamp(rx, pz) !== inCamp(rx, nz) && !throughGap(rx, nz)) rz = pz;
  return [rx, rz];
}

// 마당 안팎을 오갈 때는 문을 경유한다
export function routeTo(obj, tx, tz, speed, dt, useGate = true) {
  const insideNow = inCamp(obj.position.x, obj.position.z);
  const insideGoal = inCamp(tx, tz);
  if (useGate && insideNow !== insideGoal) {
    const gz = c.z0 + (insideNow ? -1.6 : 1.6);
    return moveTo(obj, CFG.gate.x, gz, speed, dt);
  }
  return moveTo(obj, tx, tz, speed, dt);
}

export function moveTo(obj, tx, tz, speed, dt) {
  const dx = tx - obj.position.x;
  const dz = tz - obj.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.02) return 0;
  const step = Math.min(speed * dt, d);
  obj.position.x += (dx / d) * step;
  obj.position.z += (dz / d) * step;
  obj.rotation.y = Math.atan2(dx, dz);
  return d;
}

// 걷기 애니메이션(팔 흔들기 + 살짝 통통 튀기)
export function walkAnim(obj, moving, t, amp = 1) {
  const p = obj.userData.parts;
  if (!p) return;
  const s = moving ? Math.sin(t * 11) : 0;
  p.armL.rotation.x = s * 0.8 * amp;
  p.armR.rotation.x = -s * 0.8 * amp;
  p.body.position.y = 0.72 + (moving ? Math.abs(s) * 0.06 : 0);
  p.head.position.y = 1.46 + (moving ? Math.abs(s) * 0.05 : 0);
}
