// 화면 위 DOM 오버레이(돈, 재고, 체력, 적재량, 안내, 토스트).
export function createHud() {
  const el = {
    money: document.getElementById('money'),
    moneyPill: document.getElementById('money-pill'),
    wood: document.getElementById('stock-wood'),
    meat: document.getElementById('stock-meat'),
    carryWood: document.getElementById('carry-wood'),
    carryMeat: document.getElementById('carry-meat'),
    carryWrap: document.getElementById('carry-wrap'),
    hpFill: document.getElementById('hp-fill'),
    sword: document.getElementById('sword-lv'),
    day: document.getElementById('day-chip'),
    dayNum: document.getElementById('day-num'),
    dayIcon: document.getElementById('day-icon'),
    btnAttack: document.getElementById('btn-attack'),
    keyA: document.getElementById('key-a'),
    minimap: document.getElementById('minimap-wrap'),
    lvChip: document.getElementById('lv-chip'),
    xpFill: document.getElementById('xp-fill'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    damage: document.getElementById('damage-flash'),
  };

  let toastTimer = 0;
  let money = 0;

  // 스킬별 버튼(모바일)과 키캡(PC)을 한 묶음으로 다룬다
  const skillUi = {};
  for (const node of document.querySelectorAll('[data-skill]')) {
    const id = node.dataset.skill;
    if (!skillUi[id]) skillUi[id] = { nodes: [], cooling: false };
    skillUi[id].nodes.push(node);
  }

  function flashReady(id) {
    for (const node of skillUi[id].nodes) {
      node.classList.remove('ready-flash');
      void node.offsetWidth;
      node.classList.add('ready-flash');
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
    // 나무와 고기를 따로 표시한다
    setCarry(wood, meat, cap) {
      el.carryWood.textContent = `${wood}/${cap}`;
      el.carryMeat.textContent = `${meat}/${cap}`;
      el.carryWood.classList.toggle('num-full', wood >= cap);
      el.carryMeat.classList.toggle('num-full', meat >= cap);
      el.carryWrap.classList.toggle('full', wood >= cap || meat >= cap);
      el.carryWrap.classList.toggle('hidden', wood === 0 && meat === 0);
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
    // A(공격) 가능 여부
    setAttack(canAttack) {
      el.btnAttack.classList.toggle('dim', !canAttack);
      el.keyA.classList.toggle('dim', !canAttack);
    },
    // 스킬별 보유 여부·레벨·쿨타임 표시
    setSkills(list) {
      for (const sk of list) {
        const ui = skillUi[sk.id];
        if (!ui) continue;
        const ratio = sk.total > 0 ? Math.max(0, Math.min(1, sk.remain / sk.total)) : 0;
        const cooling = sk.owned && sk.remain > 0.01;

        for (const node of ui.nodes) {
          node.classList.toggle('off', !sk.owned);
          if (!sk.owned) continue;
          node.classList.toggle('dim', cooling);
          node.classList.toggle('cooling', cooling);
          const arc = node.querySelector('.cd-arc');
          if (arc) arc.style.setProperty('--cd', `${ratio * 360}deg`);
          const bar = node.querySelector('.cd');
          if (bar) bar.style.height = `${ratio * 100}%`;
          const badge = node.querySelector('.lv-badge');
          if (badge) badge.textContent = sk.level;
        }
        if (sk.owned && ui.cooling && !cooling) flashReady(sk.id);
        ui.cooling = cooling;
      }
    },
    setLevel(level, xp, need) {
      el.lvChip.textContent = `Lv.${level}`;
      el.xpFill.style.width = `${need > 0 ? Math.max(0, Math.min(1, xp / need)) * 100 : 100}%`;
    },
    setMinimap(visible) {
      el.minimap.classList.toggle('show', visible);
    },
    setSwordLevel(lv) {
      el.sword.textContent = `검 Lv.${lv + 1}`;
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
