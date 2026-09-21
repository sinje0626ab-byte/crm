// 화면 위 DOM 오버레이(돈, 체력, 적재량, 안내 토스트).
export function createHud() {
  const el = {
    money: document.getElementById('money'),
    carry: document.getElementById('carry'),
    carryWrap: document.getElementById('carry-wrap'),
    hpFill: document.getElementById('hp-fill'),
    axeLv: document.getElementById('axe-lv'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
  };

  let shownMoney = 0;
  let toastTimer = 0;

  return {
    setMoney(v) {
      shownMoney = v;
      el.money.textContent = Math.floor(v).toLocaleString('ko-KR');
    },
    bumpMoney() {
      el.money.parentElement.classList.remove('bump');
      void el.money.parentElement.offsetWidth; // 리플로우로 애니메이션 재시작
      el.money.parentElement.classList.add('bump');
    },
    setCarry(n, cap) {
      el.carry.textContent = `${n}/${cap}`;
      el.carryWrap.classList.toggle('full', n >= cap);
      el.carryWrap.classList.toggle('hidden', n === 0);
    },
    setHp(ratio) {
      el.hpFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      el.hpFill.style.background = ratio > 0.5 ? '#54d16a' : ratio > 0.25 ? '#ffd23f' : '#ff5a4e';
    },
    setAxeLevel(lv) {
      el.axeLv.textContent = `Lv.${lv + 1}`;
    },
    toast(msg) {
      el.toast.textContent = msg;
      el.toast.classList.add('on');
      toastTimer = 2.4;
    },
    setHint(msg) {
      el.hint.textContent = msg;
    },
    tick(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) el.toast.classList.remove('on');
      }
    },
    get money() { return shownMoney; },
  };
}
