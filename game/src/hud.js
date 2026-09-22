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
    skillSec: document.getElementById('skill-sec'),
    keyA: document.getElementById('key-a'),
    keyS: document.getElementById('key-s'),
    keyCd: document.querySelector('#key-s .cd'),
    keySec: document.querySelector('#key-s .sec'),
    minimap: document.getElementById('minimap-wrap'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    damage: document.getElementById('damage-flash'),
  };

  let toastTimer = 0;
  let money = 0;
  let wasCooling = false;

  function flashReady() {
    for (const el2 of [el.btnSkill, el.keyS]) {
      el2.classList.remove('ready-flash');
      void el2.offsetWidth;
      el2.classList.add('ready-flash');
    }
  }

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
    // remain = 남은 쿨타임(초), total = 전체 쿨타임(초)
    setActions(canAttack, skillReady, remain, total) {
      el.btnAttack.classList.toggle('dim', !canAttack);
      el.keyA.classList.toggle('dim', !canAttack);

      const ratio = total > 0 ? Math.max(0, Math.min(1, remain / total)) : 0;
      const cooling = remain > 0.01;

      el.btnSkill.classList.toggle('dim', cooling);
      el.btnSkill.classList.toggle('cooling', cooling);
      el.skillCd.style.setProperty('--cd', `${ratio * 360}deg`);
      el.skillSec.textContent = cooling ? Math.ceil(remain) : '';

      el.keyS.classList.toggle('dim', cooling);
      el.keyS.classList.toggle('cooling', cooling);
      el.keyCd.style.height = `${ratio * 100}%`;
      el.keySec.textContent = cooling ? Math.ceil(remain) : '';

      if (wasCooling && !cooling) flashReady();
      wasCooling = cooling;
    },
    setMinimap(visible) {
      el.minimap.classList.toggle('show', visible);
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
