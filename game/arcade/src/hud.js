// 우측 상단 현금, 적재 표시, 토스트, 안내 문구.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const money = el('money');
  const moneyPill = el('money-pill');
  const carryWrap = el('carry-wrap');
  const carryIcon = el('carry-icon');
  const carryText = el('carry');
  const toastEl = el('toast');
  const hintEl = el('hint');
  let toastTimer = 0;

  return {
    setMoney(v) {
      money.textContent = Math.floor(v).toLocaleString('ko-KR');
    },
    bump() {
      moneyPill.classList.remove('bump');
      void moneyPill.offsetWidth;
      moneyPill.classList.add('bump');
    },
    setCarry(type, n, cap) {
      carryWrap.classList.toggle('hidden', n === 0);
      carryWrap.classList.toggle('full', n >= cap);
      carryIcon.className = `carry-icon ${type || 'meat'}`;
      carryText.textContent = `${n}/${cap}`;
    },
    toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      toastTimer = 2.2;
    },
    hint(msg) {
      if (hintEl.textContent !== msg) hintEl.textContent = msg;
    },
    tick(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.classList.remove('on');
      }
    },
  };
}
