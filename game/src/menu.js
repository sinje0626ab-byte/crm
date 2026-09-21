// 인트로 로고 → 메인 메뉴 → 게임 → 일시정지 메뉴 흐름을 담당한다.
import { hasSave, savedAtText } from './save.js';

export function createMenu(handlers) {
  const el = (id) => document.getElementById(id);
  const intro = el('intro');
  const menu = el('menu');
  const pause = el('pause');
  const ui = el('ui');
  const continueBtn = el('btn-continue');
  const saveInfo = el('save-info');
  const pauseSaveInfo = el('pause-save-info');

  let introDone = false;

  function refreshContinue() {
    const ok = hasSave();
    continueBtn.disabled = !ok;
    saveInfo.textContent = ok ? `마지막 저장: ${savedAtText()}` : '저장된 기록이 없습니다';
  }

  function showMenu() {
    refreshContinue();
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

  // 인트로: 2.8초 후 자동 진행, 탭하면 건너뛴다
  setTimeout(endIntro, 2800);
  intro.addEventListener('pointerdown', endIntro);

  el('btn-new').addEventListener('click', () => {
    if (hasSave() && !confirm('새로 시작하면 저장된 기록이 지워집니다. 계속할까요?')) return;
    hideMenu();
    handlers.onNew();
  });

  continueBtn.addEventListener('click', () => {
    hideMenu();
    handlers.onContinue();
  });

  el('btn-pause').addEventListener('click', () => {
    pause.classList.remove('hidden');
    pauseSaveInfo.textContent = hasSave() ? `마지막 저장: ${savedAtText()}` : '아직 저장하지 않았습니다';
    handlers.onPause();
  });

  el('btn-resume').addEventListener('click', () => {
    pause.classList.add('hidden');
    handlers.onResume();
  });

  el('btn-save').addEventListener('click', () => {
    const ok = handlers.onSave();
    pauseSaveInfo.textContent = ok ? `저장했습니다 (${savedAtText()})` : '저장에 실패했습니다';
  });

  el('btn-quit').addEventListener('click', () => {
    handlers.onSave();
    pause.classList.add('hidden');
    handlers.onQuit();
    showMenu();
  });

  return { showMenu, refreshContinue };
}
