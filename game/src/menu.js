// 인트로 로고 → 메인 메뉴 → 게임 → 일시정지 메뉴 흐름을 담당한다.
import { hasSave, savedAtText } from './save.js';
import { Audio } from './audio.js';

export function createMenu(handlers) {
  const el = (id) => document.getElementById(id);
  const intro = el('intro');
  const menu = el('menu');
  const pause = el('pause');
  const ui = el('ui');
  const continueBtn = el('btn-continue');
  const saveInfo = el('save-info');
  const pauseSaveInfo = el('pause-save-info');
  const muteBtn = el('btn-mute');
  const soundBtn = el('btn-sound');

  let introDone = false;

  // 브라우저 정책상 오디오는 사용자 입력이 있어야 시작된다
  function wakeAudio() {
    Audio.ensure();
    Audio.resume();
  }
  addEventListener('pointerdown', wakeAudio, { once: true });
  addEventListener('keydown', wakeAudio, { once: true });

  function refreshMuteUi() {
    const m = Audio.isMuted();
    muteBtn.classList.toggle('muted', m);
    soundBtn.textContent = m ? '소리 켜기' : '소리 끄기';
  }

  function refreshContinue() {
    const ok = hasSave();
    continueBtn.disabled = !ok;
    saveInfo.textContent = ok ? `마지막 저장: ${savedAtText()}` : '저장된 기록이 없습니다';
  }

  function showMenu() {
    refreshContinue();
    refreshMuteUi();
    menu.classList.remove('hidden');
    pause.classList.add('hidden');
    ui.classList.add('hidden');
  }

  function hideMenu() {
    menu.classList.add('hidden');
    ui.classList.remove('hidden');
  }

  function endIntro() {
    if (introDone) return;
    introDone = true;
    intro.classList.add('done');
    setTimeout(() => intro.remove(), 700);
    showMenu();
  }

  // 로고 애니메이션(2.6초)이 끝나면 자동 진행, 탭하면 건너뛴다
  setTimeout(endIntro, 2600);
  intro.addEventListener('pointerdown', endIntro);

  function beginGame(fn) {
    wakeAudio();
    hideMenu();
    fn();
    Audio.S.start();
    Audio.musicStart();
  }

  el('btn-new').addEventListener('click', () => {
    if (hasSave() && !confirm('새로 시작하면 저장된 기록이 지워집니다. 계속할까요?')) return;
    beginGame(handlers.onNew);
  });

  continueBtn.addEventListener('click', () => beginGame(handlers.onContinue));

  const levelup = el('levelup');
  const inventory = el('inventory');
  const invBody = el('inv-body');
  const isPaused = () => !pause.classList.contains('hidden');
  const isInvOpen = () => !inventory.classList.contains('hidden');
  // 메뉴나 레벨업 카드가 떠 있으면 일시정지·아이템창을 건드리지 않는다
  const inGame = () =>
    menu.classList.contains('hidden') && levelup.classList.contains('hidden');
  const canPause = () => inGame() && !isInvOpen();

  /* ------------------------------------------------------------ 아이템창 */
  function fillInventory(d) {
    invBody.textContent = '';
    const sec = (title, rows) => {
      const box = document.createElement('div');
      box.className = 'inv-sec';
      const h = document.createElement('h3');
      h.textContent = title;
      box.appendChild(h);
      for (const [label, value, cls] of rows) {
        const row = document.createElement('div');
        row.className = 'inv-row';
        const l = document.createElement('span');
        l.textContent = label;
        const v = document.createElement('b');
        v.textContent = value;
        if (cls) v.className = cls;
        row.append(l, v);
        box.appendChild(row);
      }
      invBody.appendChild(box);
    };

    sec('생존자', [
      ['레벨', `Lv.${d.level}`],
      ['경험치', `${d.xp} / ${d.xpNeed}`],
      ['체력', `${d.hp} / ${d.maxHp}`],
      ['검 피해', `${d.swordDamage}`],
      ['이동 속도', d.speedBonus ? `+${d.speedBonus}%` : '기본', d.speedBonus ? '' : 'off'],
    ]);
    sec('소지품', [
      ['나무', `${d.carry.wood} / ${d.cap}`, d.carry.wood >= d.cap ? 'hot' : ''],
      ['고기', `${d.carry.meat} / ${d.cap}`, d.carry.meat >= d.cap ? 'hot' : ''],
      ['돈', `$ ${d.money.toLocaleString('ko-KR')}`],
    ]);
    sec('판매대 재고', [
      ['통나무', `${d.stock.wood}`],
      ['구운 고기', `${d.stock.meat}`],
      ['화로에서 굽는 중', `${d.cooking}`, d.cooking ? 'hot' : 'off'],
    ]);
    sec('시설 · 장비', [
      ['검', `Lv.${d.swordLevel + 1}`],
      ['가방', `Lv.${d.bagLevel + 1} (최대 ${d.cap})`],
      ['일꾼', `${d.workers} 명`, d.workers ? '' : 'off'],
      ['궁수 망루', `${d.towers} 기`, d.towers ? '' : 'off'],
    ]);
    sec('스킬', d.skills.map((sk) => [
      `${sk.name} (${sk.key})`,
      sk.level ? `Lv.${sk.level}` : '미습득',
      sk.level ? '' : 'off',
    ]));
    sec('기록', [
      ['날짜', `${d.day}일차 ${d.night ? '밤' : '낮'}`],
      ['판매한 손님', `${d.served} 명`],
    ]);
  }

  function openInventory() {
    if (!inGame() || isInvOpen() || isPaused()) return;
    Audio.S.ui();
    fillInventory(handlers.onInventory());
    inventory.classList.remove('hidden');
    handlers.onPause();
  }

  function closeInventory() {
    if (!isInvOpen()) return;
    Audio.S.ui();
    inventory.classList.add('hidden');
    handlers.onResume();
  }

  el('btn-items').addEventListener('click', openInventory);
  el('btn-inv-close').addEventListener('click', closeInventory);

  function openPause() {
    if (!canPause() || isPaused()) return;
    Audio.S.ui();
    Audio.setMusicVolume(0.25);
    pause.classList.remove('hidden');
    pauseSaveInfo.textContent = hasSave() ? `마지막 저장: ${savedAtText()}` : '아직 저장하지 않았습니다';
    refreshMuteUi();
    handlers.onPause();
  }

  function closePause() {
    if (!isPaused()) return;
    Audio.S.ui();
    Audio.setMusicVolume(0.5);
    pause.classList.add('hidden');
    handlers.onResume();
  }

  el('btn-pause').addEventListener('click', openPause);
  el('btn-resume').addEventListener('click', closePause);

  // PC: ESC 로 일시정지, I 로 아이템창
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (isInvOpen()) closeInventory();
      else if (isPaused()) closePause();
      else openPause();
    } else if (e.code === 'KeyI') {
      e.preventDefault();
      if (isInvOpen()) closeInventory();
      else openInventory();
    }
  });

  el('btn-save').addEventListener('click', () => {
    Audio.S.ui();
    const ok = handlers.onSave();
    pauseSaveInfo.textContent = ok ? `저장했습니다 (${savedAtText()})` : '저장에 실패했습니다';
  });

  el('btn-quit').addEventListener('click', () => {
    handlers.onSave();
    Audio.setMusicVolume(0.5);
    pause.classList.add('hidden');
    handlers.onQuit();
    showMenu();
  });

  const toggleSound = () => {
    const nowMuted = Audio.toggle();
    refreshMuteUi();
    if (!nowMuted) {
      wakeAudio();
      Audio.S.ui();
      Audio.musicStart();
    }
  };
  muteBtn.addEventListener('click', toggleSound);
  soundBtn.addEventListener('click', toggleSound);
  refreshMuteUi();

  return { showMenu, refreshContinue };
}
