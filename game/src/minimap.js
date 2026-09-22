// 정착지 밖에 있을 때 뜨는 미니맵. 캔버스 2D로 그린다(3D 비용 없음).
import { CFG } from './config.js';

const C = CFG.world.camp;
const FOREST = CFG.world.forest;
const FIELD = CFG.world.field;

// 보여줄 월드 범위
const MINX = Math.min(C.x - C.w / 2, FOREST.x0, FIELD.x0) - 6;
const MAXX = Math.max(C.x + C.w / 2, FOREST.x1, FIELD.x1) + 6;
const MINZ = Math.min(C.z - C.d / 2, FOREST.z0, FIELD.z0) - 6;
const MAXZ = Math.max(C.z + C.d / 2, FOREST.z1, FIELD.z1) + 6;

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const CSS = 128;
  canvas.width = CSS * dpr;
  canvas.height = CSS * dpr;
  ctx.scale(dpr, dpr);

  const sx = CSS / (MAXX - MINX);
  const sz = CSS / (MAXZ - MINZ);
  const px = (x) => (x - MINX) * sx;
  const pz = (z) => (z - MINZ) * sz;

  function rect(x0, z0, x1, z1, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.fillRect(px(x0), pz(z0), (x1 - x0) * sx, (z1 - z0) * sz);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(px(x0), pz(z0), (x1 - x0) * sx, (z1 - z0) * sz);
    }
  }

  function dot(x, z, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(x), pz(z), r, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    draw({ player, bears, trees, pickups, buyers, stations, night }) {
      ctx.clearRect(0, 0, CSS, CSS);

      // 지형
      ctx.fillStyle = night ? 'rgba(14, 22, 34, 0.92)' : 'rgba(22, 32, 45, 0.85)';
      ctx.fillRect(0, 0, CSS, CSS);
      rect(FOREST.x0, FOREST.z0, FOREST.x1, FOREST.z1, 'rgba(47, 87, 76, 0.55)', 'rgba(90, 150, 130, 0.5)');
      rect(FIELD.x0, FIELD.z0, FIELD.x1, FIELD.z1, 'rgba(70, 90, 115, 0.5)', 'rgba(130, 160, 190, 0.45)');
      rect(C.x - C.w / 2, C.z - C.d / 2, C.x + C.w / 2, C.z + C.d / 2,
        'rgba(120, 95, 60, 0.75)', 'rgba(224, 179, 74, 0.9)');

      // 시설(화로·판매대·돈더미)
      ctx.fillStyle = '#e0b34a';
      for (const s of stations) ctx.fillRect(px(s.x) - 2, pz(s.z) - 2, 4, 4);

      // 살아있는 나무
      for (const t of trees) {
        if (!t.alive) continue;
        dot(t.x, t.z, 1.4, 'rgba(120, 200, 150, 0.9)');
      }
      // 떨어진 자원
      for (const p of pickups) {
        dot(p.mesh.position.x, p.mesh.position.z, 1.5, p.type === 'wood' ? '#d2a273' : '#e2564d');
      }
      // 야수
      for (const b of bears) dot(b.mesh.position.x, b.mesh.position.z, 2.4, '#ff5a4e');
      // 손님
      for (const b of buyers) dot(b.mesh.position.x, b.mesh.position.z, 2, '#7fc4ff');

      // 플레이어(바라보는 방향으로 삼각형)
      const a = player.rotation.y;
      const cx = px(player.position.x);
      const cy = pz(player.position.z);
      ctx.save();
      ctx.translate(cx, cy);
      // 월드 전방 (sin a, cos a) 가 미니맵에서 (오른쪽, 아래쪽)이 되도록
      ctx.rotate(Math.PI - a);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(3.6, 3.4);
      ctx.lineTo(0, 1.6);
      ctx.lineTo(-3.6, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  };
}
