// 화면 위 DOM 오버레이(돈, 재고, 체력, 적재량, 안내, 토스트).
export function createHud() {
  const el = {
    money: document.getElementById('money'),
    moneyPill: document.getElementById('money-pill'),
    wood: document.getElementById('stock-wood'),
    meat: document.getElementById('stock-meat'),
    carry: document.getElementById('carry'),
    carryWrap: document.getElementById('carry-wrap'),
    hpFill: document.getElementById('hp-fill'),
    sword: document.getElementById('sword-lv'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    damage: document.getElementById('damage-flash'),
  };

  let toastTimer = 0;
  let money = 0;

  return {
    setMoney(v) {
      money = v;
      el.money.textContent = Math.floor(v).toLocaleString('ko-KR');
    },
    bumpMoney() {
      el.moneyPill.classList.remove('bump');
      void el.moneyPill.offsetWidth;
      el.moneyPill.classList.add('bump');
    },
    setStock(wood, meat) {
      el.wood.textContent = wood;
      el.meat.textContent = meat;
    },
    setCarry(n, cap) {
      const full = n >= cap;
      el.carry.textContent = full ? 'FULL' : `${n}/${cap}`;
      el.carryWrap.classList.toggle('full', full);
      el.carryWrap.classList.toggle('hidden', n === 0);
    },
    setHp(ratio) {
      const r = Math.max(0, Math.min(1, ratio));
      el.hpFill.style.width = `${r * 100}%`;
      el.hpFill.style.background = r > 0.5 ? '#5fd07a' : r > 0.25 ? '#ffd23f' : '#ff5a4e';
    },
    setSwordLevel(lv) {
      el.sword.textContent = `Lv.${lv + 1}`;
    },
    flashDamage() {
      el.damage.classList.remove('on');
      void el.damage.offsetWidth;
      el.damage.classList.add('on');
    },
    toast(msg) {
      el.toast.textContent = msg;
      el.toast.classList.add('on');
      toastTimer = 2.4;
    },
    setHint(msg) {
      if (el.hint.textContent !== msg) el.hint.textContent = msg;
    },
    tick(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) el.toast.classList.remove('on');
      }
    },
    get money() { return money; },
  };
}
