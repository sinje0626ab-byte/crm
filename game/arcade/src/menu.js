// YJ GAMES 인트로(로고 + 징글) → 메인 메뉴 → 게임 → 일시정지.
import { Audio } from '../../src/audio.js';
import { hasSave, savedAtText } from './save.js';

export function createMenu(handlers) {
  const el = (id) => document.getElementById(id);
  const intro = el('intro');
  const menu = el('menu');
  const pause = el('pause');
  const ui = el('ui');
  const continueBtn = el('btn-continue');
  const saveInfo = el('save-info');
  const pauseInfo = el('pause-save-info');
  const muteBtn = el('btn-mute');
  const soundBtn = el('btn-sound');

  let introDone = false;
  let jinglePlayed = false;

  // 로고와 함께 징글을 깔아준다. 자동재생이 막혀 있으면 첫 입력 때 울린다.
  function playJingle() {
    if (jinglePlayed) return;
    jinglePlayed = Audio.logoJingle();
  }
  playJingle();
  const armJingle = () => { if (!introDone) playJingle(); };
  addEventListener('pointerdown', armJingle, { once: true });
  addEventListener('keydown', armJingle, { once: true });

  function refreshMute() {
    const m = Audio.isMuted();
    muteBtn.classList.toggle('muted', m);
    soundBtn.textContent = m ? '소리 켜기' : '소리 끄기';
  }

  function showMenu() {
    const ok = hasSave();
    continueBtn.disabled = !ok;
    saveInfo.textContent = ok ? `마지막 저장: ${savedAtText()}` : '저장된 기록이 없습니다';
    refreshMute();
    menu.classList.remove('hidden');
    pause.classList.add('hidden');
    ui.classList.add('hidden');
  }

  function endIntro() {
    if (introDone) return;
    introDone = true;
    intro.classList.add('done');
    setTimeout(() => intro.remove(), 700);
    showMenu();
  }
  setTimeout(endIntro, 3200);
  intro.addEventListener('pointerdown', () => { playJingle(); endIntro(); });

  function begin(fn) {
    Audio.ensure();
    Audio.resume();
    menu.classList.add('hidden');
    ui.classList.remove('hidden');
    fn();
    Audio.musicStart();
  }

  el('btn-new').addEventListener('click', () => {
    if (hasSave() && !confirm('새로 시작하면 저장된 기록이 지워집니다. 계속할까요?')) return;
    begin(handlers.onNew);
  });
  continueBtn.addEventListener('click', () => begin(handlers.onContinue));

  const isPaused = () => !pause.classList.contains('hidden');
  const inGame = () => menu.classList.contains('hidden');

  function openPause() {
    if (!inGame() || isPaused()) return;
    Audio.S.ui();
    Audio.setMusicVolume(0.25);
    pause.classList.remove('hidden');
    pauseInfo.textContent = hasSave() ? `마지막 저장: ${savedAtText()}` : '아직 저장하지 않았습니다';
    refreshMute();
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
  el('btn-save').addEventListener('click', () => {
    Audio.S.ui();
    pauseInfo.textContent = handlers.onSave() ? `저장했습니다 (${savedAtText()})` : '저장에 실패했습니다';
  });
  el('btn-quit').addEventListener('click', () => {
    handlers.onSave();
    Audio.setMusicVolume(0.5);
    pause.classList.add('hidden');
    handlers.onQuit();
    showMenu();
  });

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    if (isPaused()) closePause();
    else openPause();
  });

  const toggleSound = () => {
    const muted = Audio.toggle();
    refreshMute();
    if (!muted) {
      Audio.ensure();
      Audio.resume();
      Audio.S.ui();
      Audio.musicStart();
    }
  };
  muteBtn.addEventListener('click', toggleSound);
  soundBtn.addEventListener('click', toggleSound);
  refreshMute();

  return { showMenu };
}
