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
    day: document.getElementById('day-chip'),
    dayNum: document.getElementById('day-num'),
    dayIcon: document.getElementById('day-icon'),
    btnAttack: document.getElementById('btn-attack'),
    btnSkill: document.getElementById('btn-skill'),
    skillCd: document.getElementById('skill-cd'),
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
    setDay(dayNo, night) {
      el.dayNum.textContent = `${dayNo}일차`;
      el.day.classList.toggle('night', night);
      el.dayIcon.classList.toggle('moon', night);
    },
    // A(공격) 가능 여부와 S(스킬) 쿨타임 표시
    setActions(canAttack, skillReady, cdRatio) {
      el.btnAttack.classList.toggle('dim', !canAttack);
      el.btnSkill.classList.toggle('dim', !skillReady);
      el.skillCd.style.height = `${Math.max(0, Math.min(1, 1 - cdRatio)) * 100}%`;
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
