// 레벨업 때 뜨는 카드 선택 화면.
export function createLevelUp() {
  const wrap = document.getElementById('levelup');
  const cardsEl = document.getElementById('lv-cards');
  const titleEl = document.getElementById('lv-title');
  const subEl = document.getElementById('lv-sub');

  return {
    // cards: [{ kind:'new'|'up'|'stat', title, effect, desc, pick() }]
    show(level, cards, onPick) {
      titleEl.textContent = `Lv.${level} 달성!`;
      subEl.textContent = cards.length > 1 ? '하나를 고르세요' : '보상을 받으세요';
      cardsEl.textContent = '';

      for (const c of cards) {
        const el = document.createElement('div');
        el.className = 'lv-card';
        const tagClass = c.kind === 'up' ? 'tag up' : 'tag';
        const tagText = c.kind === 'new' ? '새 스킬' : c.kind === 'up' ? '강화' : '능력치';
        el.innerHTML =
          `<span class="${tagClass}">${tagText}</span>` +
          `<h3></h3><p></p><div class="eff"></div>`;
        el.querySelector('h3').textContent = c.title;
        el.querySelector('p').textContent = c.desc;
        el.querySelector('.eff').textContent = c.effect;
        el.addEventListener('click', () => {
          wrap.classList.add('hidden');
          onPick(c);
        });
        cardsEl.appendChild(el);
      }
      wrap.classList.remove('hidden');
    },
    hide() {
      wrap.classList.add('hidden');
    },
  };
}
