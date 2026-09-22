// 이동: 방향키(PC) / 플로팅 조이스틱(모바일)
// 행동: A = 공격, S = 스킬 (화면 버튼으로도 누를 수 있다)
export function createInput(surface, joyEl, knobEl) {
  const dir = { x: 0, z: 0 };
  const keys = new Set();
  const MAX_R = 52;
  let touchId = null;
  let origin = { x: 0, y: 0 };

  // 버튼/키 눌림 상태
  const action = { attack: false, skill: false };
  const pressedOnce = { attack: false, skill: false };

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyA') { action.attack = true; pressedOnce.attack = true; }
    if (e.code === 'KeyS') { action.skill = true; pressedOnce.skill = true; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyS'].includes(e.code)) {
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'KeyA') action.attack = false;
    if (e.code === 'KeyS') action.skill = false;
  });
  addEventListener('blur', () => {
    keys.clear();
    action.attack = false;
    action.skill = false;
  });

  /* ------------------------------------------------------------ 조이스틱 */
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
  surface.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  /* --------------------------------------------------------- 액션 버튼 */
  function bindButton(el, name) {
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      action[name] = true;
      pressedOnce[name] = true;
      el.classList.add('down');
      el.setPointerCapture?.(e.pointerId);
    };
    const up = (e) => {
      e.stopPropagation();
      action[name] = false;
      el.classList.remove('down');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  return {
    bindButtons(attackEl, skillEl) {
      bindButton(attackEl, 'attack');
      bindButton(skillEl, 'skill');
    },
    // 월드 기준 이동 방향(-1..1)
    read() {
      if (touchId !== null) return dir;
      let x = 0;
      let z = 0;
      if (keys.has('ArrowLeft')) x -= 1;
      if (keys.has('ArrowRight')) x += 1;
      if (keys.has('ArrowUp')) z -= 1;
      if (keys.has('ArrowDown')) z += 1;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    },
    held(name) { return action[name]; },
    // 이번 프레임에 새로 눌렸는지(스킬처럼 한 번만 반응해야 하는 입력용)
    consume(name) {
      const v = pressedOnce[name];
      pressedOnce[name] = false;
      return v;
    },
  };
}
