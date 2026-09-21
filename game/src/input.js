// 키보드(WASD/화살표) + 화면 아무 곳이나 누르면 나타나는 플로팅 조이스틱.
export function createInput(surface, joyEl, knobEl) {
  const dir = { x: 0, z: 0 };
  const keys = new Set();
  const MAX_R = 52; // 조이스틱 반경(px)
  let touchId = null;
  let origin = { x: 0, y: 0 };

  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  function showJoy(x, y) {
    origin = { x, y };
    joyEl.style.left = `${x}px`;
    joyEl.style.top = `${y}px`;
    joyEl.classList.add('on');
    knobEl.style.transform = 'translate(-50%, -50%)';
  }

  function moveJoy(x, y) {
    let dx = x - origin.x;
    let dy = y - origin.y;
    const len = Math.hypot(dx, dy);
    if (len > MAX_R) {
      dx = (dx / len) * MAX_R;
      dy = (dy / len) * MAX_R;
    }
    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const norm = Math.min(len, MAX_R) / MAX_R;
    const a = Math.atan2(dy, dx);
    dir.x = Math.cos(a) * norm;
    dir.z = Math.sin(a) * norm;
  }

  function hideJoy() {
    touchId = null;
    joyEl.classList.remove('on');
    dir.x = 0;
    dir.z = 0;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (touchId !== null) return;
    touchId = e.pointerId;
    surface.setPointerCapture(e.pointerId);
    showJoy(e.clientX, e.clientY);
    moveJoy(e.clientX, e.clientY);
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touchId) return;
    moveJoy(e.clientX, e.clientY);
  });
  const end = (e) => { if (e.pointerId === touchId) hideJoy(); };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('lostpointercapture', end);

  // 화면 스크롤/줌 방지
  surface.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    // 월드 기준 이동 방향(-1..1). 조이스틱이 없으면 키보드 입력을 쓴다.
    read() {
      if (touchId !== null) return dir;
      let x = 0;
      let z = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    },
  };
}
