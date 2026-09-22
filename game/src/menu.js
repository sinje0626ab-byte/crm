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
  const isPaused = () => !pause.classList.contains('hidden');
  // 메뉴나 레벨업 카드가 떠 있으면 일시정지를 건드리지 않는다
  const canPause = () =>
    menu.classList.contains('hidden') && levelup.classList.contains('hidden');

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

  // PC: ESC 로 일시정지를 여닫는다
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    if (isPaused()) closePause();
    else openPause();
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
